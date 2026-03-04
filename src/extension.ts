import { workspace, ExtensionContext, commands, window, Uri, Selection, CancellationTokenSource, scm, StatusBarAlignment, StatusBarItem, FileType } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	StreamInfo,
	TransportKind,
} from 'vscode-languageclient/node';
import * as requirements from './requirements';
import * as net from 'net';
import * as child_process from 'child_process';
import { activateDebug } from './activateDebug';
import { DebugAdapterFactory } from './debugFactory';
import { PharoImageExplorer } from './treeProvider/imageExplorer';
import { PharoDocumentExplorer } from './treeProvider/documentBinding';
import { MoosebookSerializer } from './moosebook/MoosebookSerializer';
import { MoosebookController } from './moosebook/MoosebookController';
import * as path from 'path';
const os = require('os');

import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";
import { IceControlManager } from './ice/IceControlManager';
import { initTestController } from './testController/testController';
import { PharoImagesExplorer, PharoImagesNode, createWorkspaceForImage } from './treeProvider/pharoImages';
import { registerPharoLanguageModelTools } from './ai/pharoLmTools';
import { registerPharoChatParticipant } from './ai/pharoChatParticipant';


export let client: LanguageClient;
export let documentExplorer: PharoDocumentExplorer;
let dls: child_process.ChildProcess;
export let extensionContext: ExtensionContext;

let pharoImagesExplorer: PharoImagesExplorer;

let plsStatusBar: StatusBarItem;
const PHARO_IMAGE_WORKSPACE_SCHEME = 'pharoImage';
const PHARO_IMAGE_WORKSPACE_NAME = 'Pharo Image';
const PHARO_IMAGE_REPOSITORY_QUERY_KEY = 'iceRepository';
let pharoImageExplorer: PharoImageExplorer;

export async function activate(context: ExtensionContext) {


	extensionContext = context;
	// AI entrypoints: @pharo participant + tool-calls (pharo.*)
	registerPharoLanguageModelTools(context);
	registerPharoChatParticipant(context);
	initStatusBar(extensionContext);
	// Create new command
	createCommands(context);
	pharoImagesExplorer = new PharoImagesExplorer(context);
	registerPharoImagesCommands(context);
	pharoImageExplorer = new PharoImageExplorer(context);
	syncPharoImageWorkspaceFolder();
	context.subscriptions.push(workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('pharo.imageWorkspace')) {
			syncPharoImageWorkspaceFolder();
			void commands.executeCommand('pharo.ice.refresh');
		}
	}));

	// Testing Pharo can be used
	let resolvedRequirements: requirements.RequirementsData;
	try {
		resolvedRequirements = await requirements.resolveRequirements();
	} catch (error) {
		window.showErrorMessage(error.message, error.label).then((selection) => {
			if (error.label && error.label === selection && error.command) {
				commands.executeCommand(error.command, error.commandParam);
			}
		});
		setStatusBarText('Configuration error');
		return;
	}

	// Create the pharo language server client
	client = createPharoLanguageServer(resolvedRequirements, context);

	try {
		// Start the client. This will also launch the server
		await client.start();
		context.subscriptions.push(client);

		pharoImageExplorer.refresh();
		documentExplorer = new PharoDocumentExplorer(context);

		// Create debugguer
		let factory = new DebugAdapterFactory();
		activateDebug(context, factory);
		context.subscriptions.push(workspace.registerNotebookSerializer('moosebook', new MoosebookSerializer()));
		context.subscriptions.push(new MoosebookController());

		// Create Ice
		let iceControlManager = new IceControlManager(client);
		context.subscriptions.push(iceControlManager);

		// Create Tests
		initTestController();

		resetStatusBarText();
	} catch (err) {
		setStatusBarText('Error Pharo Language Server');
	}
}

function createCommands(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('pharo.extensionVersion', commandPharoExtensionVersion));
	context.subscriptions.push(commands.registerCommand('pharo.printIt', commandPharoPrintIt));
	context.subscriptions.push(commands.registerCommand('pharo.showIt', commandPharoShowIt));
	context.subscriptions.push(commands.registerCommand('pharo.doIt', commandPharoDoIt));
	context.subscriptions.push(commands.registerCommand('pharo.save', commandPharoSave));
	context.subscriptions.push(commands.registerCommand('pharo.createPackage', commandPharoCreatePackage));
	context.subscriptions.push(commands.registerCommand('pharo.createClass', commandPharoCreateClass));
	context.subscriptions.push(commands.registerCommand('pharo.ice.addPackage', commandPharoIceAddPackage));
	context.subscriptions.push(commands.registerCommand('pharo.executeTest', commandPharoExecuteTest));
	context.subscriptions.push(commands.registerCommand('pharo.executeClassTests', commandPharoExecuteClassTests));
	context.subscriptions.push(commands.registerCommand('pharo.installIt', commandPharoInstallLastVersion));
	context.subscriptions.push(commands.registerCommand('pharo.createProject', commandPharoCreateProject));
	context.subscriptions.push(commands.registerCommand('pharo.addImageToWorkspace', commandPharoAddImageToWorkspace));
	context.subscriptions.push(commands.registerCommand('pharo.openLog', commandPharoOpenLog));
	context.subscriptions.push(commands.registerCommand('pharo.clearLog', commandPharoClearLog));
}

function registerPharoImagesCommands(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('pharo.images.refresh', () => {
		pharoImagesExplorer?.refresh();
	}));
	context.subscriptions.push(commands.registerCommand('pharo.images.play', async (node?: PharoImagesNode) => {
		await pharoImagesExplorer?.play(node);
	}));
	context.subscriptions.push(commands.registerCommand('pharo.images.download', async () => {
		await commandPharoImagesDownload();
	}));
}

function pharoImagesRootFolderFsPath(): string {
	return path.join(os.homedir(), 'Documents', 'Pharo', 'images');
}

async function copyDirectoryRecursive(source: Uri, destination: Uri): Promise<void> {
	await workspace.fs.createDirectory(destination);
	const entries = await workspace.fs.readDirectory(source);
	for (const [name, fileType] of entries) {
		const src = Uri.joinPath(source, name);
		const dst = Uri.joinPath(destination, name);
		if (fileType === FileType.Directory) {
			await copyDirectoryRecursive(src, dst);
		} else {
			await workspace.fs.copy(src, dst, { overwrite: true });
		}
	}
}

async function commandPharoImagesDownload(): Promise<void> {
	const localName = (await window.showInputBox({
		title: 'Télécharger une image Pharo Language Server',
		placeHolder: 'Nom local (dossier + .image/.changes) (ex: MonProjet-PLS)',
		validateInput: (value) => {
			const trimmed = value.trim();
			if (trimmed.length === 0) {
				return 'Le nom est requis.';
			}
			if (/[\\/]/.test(trimmed)) {
				return 'Le nom ne doit pas contenir de / ou \\.';
			}
			return undefined;
		}
	}))?.trim();

	if (!localName) {
		return;
	}

	const quickInstallConfig = workspace.getConfiguration('pharo quick install');
	const serverVersion: string = quickInstallConfig.get('server version');
	const sourceImageName: string = quickInstallConfig.get('image name');
	const zipUri = pharoLanguageServerImageZipUri(serverVersion, sourceImageName);

	let downloadedDirectory: Uri;
	try {
		downloadedDirectory = await download(zipUri, true, sourceImageName);
	} catch (error) {
		window.showErrorMessage(`Téléchargement impossible: ${error?.message ?? String(error)}`);
		return;
	}

	const rootFolder = Uri.file(pharoImagesRootFolderFsPath());
	const targetFolder = Uri.joinPath(rootFolder, localName);
	try {
		await workspace.fs.createDirectory(rootFolder);
		await copyDirectoryRecursive(downloadedDirectory, targetFolder);
	} catch (error) {
		window.showErrorMessage(`Impossible de copier l'image vers ${targetFolder.fsPath}: ${error?.message ?? String(error)}`);
		return;
	}

	async function renameIfExists(from: Uri, to: Uri): Promise<void> {
		try {
			await workspace.fs.stat(from);
		} catch {
			return;
		}
		try {
			await workspace.fs.delete(to, { recursive: false, useTrash: false });
		} catch {
			// ignore
		}
		await workspace.fs.rename(from, to);
	}

	async function findFirstWithExtension(dir: Uri, ext: string): Promise<Uri | undefined> {
		try {
			const entries = await workspace.fs.readDirectory(dir);
			const found = entries.find(([name, type]) => type === FileType.File && name.toLowerCase().endsWith(ext));
			return found ? Uri.joinPath(dir, found[0]) : undefined;
		} catch {
			return undefined;
		}
	}

	// Rename downloaded .image/.changes to match the requested local name.
	const desiredImageUri = Uri.joinPath(targetFolder, `${localName}.image`);
	const desiredChangesUri = Uri.joinPath(targetFolder, `${localName}.changes`);

	const sourceImageUriByName = Uri.joinPath(targetFolder, `${sourceImageName}.image`);
	const sourceChangesUriByName = Uri.joinPath(targetFolder, `${sourceImageName}.changes`);

	if (localName !== sourceImageName) {
		await renameIfExists(sourceImageUriByName, desiredImageUri);
		await renameIfExists(sourceChangesUriByName, desiredChangesUri);

		// Fallback: if the upstream name differs, rename the first matching file.
		const anyImage = await findFirstWithExtension(targetFolder, '.image');
		if (anyImage && anyImage.fsPath !== desiredImageUri.fsPath) {
			await renameIfExists(anyImage, desiredImageUri);
		}
		const anyChanges = await findFirstWithExtension(targetFolder, '.changes');
		if (anyChanges && anyChanges.fsPath !== desiredChangesUri.fsPath) {
			await renameIfExists(anyChanges, desiredChangesUri);
		}
	}

	try {
		await workspace.fs.stat(desiredImageUri);
	} catch {
		window.showErrorMessage(`Téléchargement incomplet: fichier image introuvable (${desiredImageUri.fsPath}).`);
		return;
	}

	const imageUri = desiredImageUri;
	let workspaceUri: Uri;
	try {
		workspaceUri = await createWorkspaceForImage(imageUri);
	} catch (error) {
		window.showErrorMessage(`Impossible de créer le workspace: ${error?.message ?? String(error)}`);
		return;
	}

	// Show the config (workspace file) then open it in a new VS Code window.
	try {
		await commands.executeCommand('vscode.open', workspaceUri);
	} catch {
		// ignore
	}

	pharoImagesExplorer?.refresh();
	await commands.executeCommand('vscode.openFolder', workspaceUri, true);
}

export function deactivate() {
}

/*
 * Section with extension commands
 */

function commandPharoExtensionVersion() {
	client.sendRequest("command:version").then((result: string) => {
		console.log(result);
		window.showInformationMessage(result);
	});
}

function commandPharoDoIt() {
	let editor = window.activeTextEditor;
	let selection = editor.selection;
	client.sendRequest('command:printIt', { "line": editor.document.getText(selection), "textDocumentURI": editor.document.uri }).then((result: string) => {
		documentExplorer.refresh();
	}).catch((error) => window.showErrorMessage(error));
}


function commandPharoPrintIt() {
	let editor = window.activeTextEditor;
	let selection = editor.selection;
	client.sendRequest('command:printIt', { "line": editor.document.getText(selection), "textDocumentURI": editor.document.uri }).then((result: string) => {
		editor.edit(editBuilder => {
			editBuilder.replace(new Selection(selection.end, selection.end), ' "' + result + '" ');
		});
		documentExplorer.refresh();
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoShowIt() {
	let editor = window.activeTextEditor;
	client.sendRequest('command:printIt', { "line": editor.document.getText(editor.selection), "textDocumentURI": editor.document.uri }).then((result: string) => {
		window.showInformationMessage(result);
		documentExplorer.refresh();
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoSave() {
	client.sendRequest('command:save').then((result: string) => {
		window.showInformationMessage(result);
	}).catch((error) => window.showErrorMessage(error));
}

async function commandPharoCreatePackage(_target?: unknown) {
	const packageName = (await window.showInputBox({
		title: 'Create Pharo Package',
		placeHolder: 'Package name',
		validateInput: (value) => value.trim().length === 0 ? 'Package name is required.' : undefined
	}))?.trim();
	if (!packageName) {
		return;
	}

	client.sendRequest('pls:createPackage', { packageName }).then((result: string) => {
		window.showInformationMessage(result);
		pharoImageExplorer.refresh();
	}).catch((error) => window.showErrorMessage(error));
}

async function commandPharoCreateClass(target?: unknown) {
	const packageName = packageNameFromPharoFolderTarget(target) ?? await pickPharoPackageName();
	if (!packageName) {
		return;
	}

	const className = (await window.showInputBox({
		title: 'Create Pharo Class',
		placeHolder: 'Class name (e.g. MyNewClass)',
		validateInput: (value) => value.trim().length === 0 ? 'Class name is required.' : undefined
	}))?.trim();
	if (!className) {
		return;
	}

	const superclassName = (await window.showInputBox({
		title: 'Superclass',
		value: 'Object',
		placeHolder: 'Superclass name'
	}))?.trim() || 'Object';

	const instanceVariables = (await window.showInputBox({
		title: 'Instance Variables',
		placeHolder: "Space-separated names (e.g. name age), optional"
	}))?.trim() ?? '';

	client.sendRequest('pls:createClass', {
		packageName,
		className,
		superclassName,
		instanceVariables
	}).then((result: string) => {
		window.showInformationMessage(result);
		pharoImageExplorer.refresh();
		void commands.executeCommand(
			'vscode.open',
			Uri.from({ scheme: 'pharoImage', path: `/${packageName}/${className}.class.st` })
		);
	}).catch((error) => window.showErrorMessage(error));
}

async function commandPharoIceAddPackage() {
	const packageName = await pickPharoPackageName();
	if (!packageName) {
		return;
	}

	let repositories: Array<{ name: string; valid: boolean }> = [];
	try {
		repositories = await client.sendRequest('pls-ice:repositories') as Array<{ name: string; valid: boolean }>;
	} catch (error) {
		window.showErrorMessage('Unable to load Iceberg repositories from Pharo.');
		return;
	}

	const validRepositories = repositories.filter((repository) => repository.valid).map((repository) => repository.name);
	if (validRepositories.length === 0) {
		window.showWarningMessage('No valid Iceberg repository available in this image.');
		return;
	}

	const selectedRepository = await window.showQuickPick(validRepositories.sort((left, right) => left.localeCompare(right)), {
		title: 'Add Package To Iceberg',
		placeHolder: 'Select the target Iceberg repository'
	});
	if (!selectedRepository) {
		return;
	}

	client.sendRequest('pls-ice:addPackage', {
		aRepositoryName: selectedRepository,
		packageName
	}).then((result: string) => {
		window.showInformationMessage(result);
		void commands.executeCommand('pharo.ice.refresh');
	}).catch((error) => window.showErrorMessage(error));
}

async function pickPharoPackageName(): Promise<string | undefined> {
	let packages: string[] = [];
	try {
		packages = await client.sendRequest('pls:packages', {}) as string[];
	} catch (_error) {
		// Fall back to a free-form input below.
	}

	const createNewPackageLabel = '$(add) Create New Package';
	const options = packages.length === 0
		? [createNewPackageLabel]
		: [createNewPackageLabel, ...packages.sort((left, right) => left.localeCompare(right))];

	const selected = await window.showQuickPick(options, {
		title: 'Select Package',
		placeHolder: 'Choose an existing package or create a new one'
	});
	if (!selected) {
		return undefined;
	}

	if (selected === createNewPackageLabel) {
		const newPackageName = (await window.showInputBox({
			title: 'New Package Name',
			placeHolder: 'Package name',
			validateInput: (value) => value.trim().length === 0 ? 'Package name is required.' : undefined
		}))?.trim();
		if (!newPackageName) {
			return undefined;
		}
		try {
			await client.sendRequest('pls:createPackage', { packageName: newPackageName });
			pharoImageExplorer.refresh();
			return newPackageName;
		} catch (error) {
			window.showErrorMessage(String(error));
			return undefined;
		}
	}

	return selected;
}

function packageNameFromPharoFolderTarget(target: unknown): string | undefined {
	const uri = uriFromCommandTarget(target);
	if (!uri || uri.scheme !== PHARO_IMAGE_WORKSPACE_SCHEME) {
		return undefined;
	}

	const segments = uri.path
		.split('/')
		.filter((segment) => segment.length > 0)
		.map((segment) => decodeURIComponent(segment));
	return segments.length === 1 ? segments[0] : undefined;
}

function uriFromCommandTarget(target: unknown): Uri | undefined {
	if (!target) {
		return undefined;
	}

	if (target instanceof Uri) {
		return target;
	}

	if (typeof target === 'string') {
		return Uri.parse(target, true);
	}

	if (typeof target === 'object') {
		const possibleTarget = target as { resourceUri?: Uri; uri?: Uri | string };
		if (possibleTarget.resourceUri instanceof Uri) {
			return possibleTarget.resourceUri;
		}
		if (possibleTarget.uri instanceof Uri) {
			return possibleTarget.uri;
		}
		if (typeof possibleTarget.uri === 'string') {
			return Uri.parse(possibleTarget.uri, true);
		}
	}

	return undefined;
}

function commandPharoExecuteTest(aClass: string, testMethod: string) {
	client.sendRequest('pls:executeClassTest', { class: aClass, testMethod: testMethod }).then((result: string) => {
		window.showInformationMessage(result);
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoExecuteClassTests(aClass: string) {
	client.sendRequest('pls:executeClassTests', { className: aClass }).then((result: string) => {
		window.showInformationMessage(result);
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoCreateProject() {
	let rootProject: Uri = workspace.workspaceFolders.at(0).uri;
	workspace.fs.createDirectory(Uri.file(rootProject.fsPath + "/src"));
	workspace.fs.writeFile(
		Uri.file(rootProject.fsPath + "\\.project"),
		new Uint8Array(Buffer.from("{\n    'srcDirectory' : 'src'\n}")));
	workspace.fs.writeFile(
		Uri.file(rootProject.fsPath + "/src/.properties"),
		new Uint8Array(Buffer.from("{\n    #format : #tonel\n}")));
}
function commandPharoOpenLog() {
	client.sendRequest('pls-developer:openLog').then(() => { }).catch((error) => window.showErrorMessage(error));
}

function commandPharoClearLog() {
	client.sendRequest('pls-developer:clearLog').then(() => { }).catch((error) => window.showErrorMessage(error));
}

async function commandPharoAddImageToWorkspace() {
	const added = ensurePharoImageWorkspaceFolder();
	if (!added) {
		window.showWarningMessage('Unable to add the Pharo image workspace folder.');
		return;
	}

	const hasWorkspaceFolder = (workspace.workspaceFolders ?? []).length > 0;
	// `update(..., false)` targets workspace settings when a workspace is open.
	await workspace.getConfiguration('pharo').update('imageWorkspace', true, hasWorkspaceFolder ? false : true);
	void commands.executeCommand('pharo.ice.refresh');
	window.showInformationMessage('Pharo image added to workspace.');
}

function pharoVmZipUri(vmVersion: string): Uri {
	if (os.platform() === 'linux') {
		return Uri.parse(`https://files.pharo.org/get-files/${vmVersion}/pharo-vm-Linux-x86_64-stable.zip`);
	}
	if (os.platform() === 'darwin') {
		const arch = os.arch();
		if (arch === 'arm64') {
			return Uri.parse(`https://files.pharo.org/get-files/${vmVersion}/pharo-vm-Darwin-arm64-latest.zip`);
		}
		return Uri.parse(`https://files.pharo.org/get-files/${vmVersion}/pharo-vm-Darwin-x86_64-latest.zip`);
	}
	return Uri.parse(`https://files.pharo.org/get-files/${vmVersion}/pharo-vm-Windows-x86_64-stable.zip`);
}

function pharoVmExecutablePath(vmDirectory: Uri): string {
	if (os.platform() === 'linux') {
		return vmDirectory.fsPath + '/pharo';
	}
	if (os.platform() === 'darwin') {
		return vmDirectory.fsPath + '/Pharo.app/Contents/MacOS/Pharo';
	}
	return vmDirectory.fsPath + '\\Pharo.exe';
}

function pharoLanguageServerImageZipUri(serverVersion: string, imageName: string): Uri {
	return Uri.parse(`https://github.com/badetitou/Pharo-LanguageServer/releases/download/${serverVersion}/${imageName}.zip`);
}

function pharoImageFilePath(pharoDirectory: Uri, imageName: string): string {
	if (os.platform() === 'linux' || os.platform() === 'darwin') {
		return pharoDirectory.fsPath + '/' + imageName + '.image';
	}
	return pharoDirectory.fsPath + '\\' + imageName + '.image';
}

export async function commandPharoInstallLastVersion() {

	if (dls !== undefined) {
		dls.kill(9);
	}

	// Download pharo VM
	let vmVersion: string = workspace.getConfiguration('pharo quick install').get('server VM version');
	let vmDirectory = await download(pharoVmZipUri(vmVersion), true, 'pharoVM');
	workspace.getConfiguration('pharo').update('pathToVM', pharoVmExecutablePath(vmDirectory), true);
	window.showInformationMessage('VM updated. Please wait');

	// Download image
	let imageName: string = workspace.getConfiguration('pharo quick install').get('image name');
	let serverVersion: string = workspace.getConfiguration('pharo quick install').get('server version');
	let pharoDirectory = await download(pharoLanguageServerImageZipUri(serverVersion, imageName), true, imageName);
	workspace.getConfiguration('pharo').update('pathToImage', pharoImageFilePath(pharoDirectory, imageName), true);

	window.showInformationMessage('Pharo updated. Please restart', 'Restart VSCode').then(() => {
		commands.executeCommand('workbench.action.reloadWindow');
	});
}


async function download(uri: Uri, unzip: boolean, location: string): Promise<Uri> {

	// let mooseImageUri = Uri.parse("", true);
	const fileDownloader: FileDownloader = await getApi();
	// update to string
	uri.toString = (skipEncoding?: boolean): string => {
		return uri.scheme + "://" + uri.authority + uri.path + "?" + uri.query;
	};

	const cancellationTokenSource = new CancellationTokenSource();
	const cancellationToken = cancellationTokenSource.token;

	const progressCallback = (downloadedBytes: number, totalBytes: number | undefined) => {
		setStatusBarText(`Downloaded ${downloadedBytes}/${totalBytes} bytes`);
	};
	const vmDirectory: Uri = await fileDownloader.downloadFile(
		uri,
		location,
		extensionContext,
		cancellationToken,
		progressCallback,
		{ shouldUnzip: unzip }
	);
	resetStatusBarText();
	return vmDirectory;
}

/*
 * Section with function for Pharo Language Server
 */

function createPharoLanguageServer(requirements: requirements.RequirementsData, context: ExtensionContext) {
	let serverOptions: ServerOptions = () => createServerWithSocket(requirements.pathToVM, requirements.pathToImage, context);

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [
			{ scheme: 'file', language: 'pharo' },
			{ scheme: 'pharoImage', language: 'pharo' },
			{ notebook: 'moosebook', language: 'pharo' }
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	return new LanguageClient(
		'pharoLanguageServer',
		'Pharo Language Server',
		serverOptions,
		clientOptions
	);
}

function syncPharoImageWorkspaceFolder() {
	const shouldUseImageWorkspace = workspace.getConfiguration('pharo').get<boolean>('imageWorkspace', false);

	if (shouldUseImageWorkspace) {
		ensurePharoImageWorkspaceFolder();
		return;
	}

	removePharoImageWorkspaceFolders();
}

function ensurePharoImageWorkspaceFolder(): boolean {
	const folders = workspace.workspaceFolders ?? [];
	const imageWorkspaceFolderIndex = folders.findIndex((folder) =>
		folder.uri.scheme === PHARO_IMAGE_WORKSPACE_SCHEME && !isRepositoryScopedImageFolder(folder.uri)
	);
	if (imageWorkspaceFolderIndex !== -1) {
		return true;
	}

	return workspace.updateWorkspaceFolders(folders.length, 0, {
		uri: Uri.parse(`${PHARO_IMAGE_WORKSPACE_SCHEME}:/`),
		name: PHARO_IMAGE_WORKSPACE_NAME
	});
}

function removePharoImageWorkspaceFolders(): void {
	const folders = workspace.workspaceFolders ?? [];
	const folderIndexesToRemove = folders
		.map((folder, index) => ({ folder, index }))
		.filter(({ folder }) => folder.uri.scheme === PHARO_IMAGE_WORKSPACE_SCHEME)
		.map(({ index }) => index)
		.sort((left, right) => right - left);

	folderIndexesToRemove.forEach((index) => {
		workspace.updateWorkspaceFolders(index, 1);
	});
}

function isRepositoryScopedImageFolder(uri: Uri): boolean {
	if (!uri.query) {
		return false;
	}
	const query = new URLSearchParams(uri.query);
	const repositoryName = query.get(PHARO_IMAGE_REPOSITORY_QUERY_KEY);
	return repositoryName !== null && repositoryName.trim().length > 0;
}

async function createServerWithSocket(pharoPath: string, pathToImage: string, context: ExtensionContext): Promise<StreamInfo> {

	let options = [pathToImage, 'st', context.asAbsolutePath('/res/run-server.st')];
	if (workspace.getConfiguration('pharo').get('headless') && !workspace.getConfiguration('pharo').get('debugMode')) {
		options.unshift('--headless');
	}
	dls = child_process.spawn(pharoPath.trim(), options);

	dls.on('close', (code: number, signal: NodeJS.Signals) => {
		window.showErrorMessage(code + " - Pharo Language Server stops working. Please report an [issue](https://github.com/badetitou/vscode-pharo/issues).");
	});

	let socket = await Promise.resolve(getSocket(dls));

	let result: StreamInfo = {
		writer: socket,
		reader: socket
	};
	return Promise.resolve(result);
}

async function getSocket(dls: child_process.ChildProcess): Promise<net.Socket> {
	return new Promise(function (resolve) {
		let socket: net.Socket;
		dls.stdout.on('data', (data) => {
			console.log(`Try to connect to port ${data}`);
			socket = net.connect({ port: parseInt(data), host: '127.0.0.1' }, () => {
				// 'connect' listener.
				console.log('connected to server!');
				resolve(socket);
			});
		});
	});
}

// About Status bar
function initStatusBar(context: ExtensionContext) {
	plsStatusBar = window.createStatusBarItem(StatusBarAlignment.Right, 100);
	context.subscriptions.push(plsStatusBar);
	plsStatusBar.tooltip = 'Pharo Language Server';
	plsStatusBar.command = 'extension.showQuickPick';

	commands.registerCommand('extension.showQuickPick', async () => {
		const addImageOption = '$(folder-opened) Add Image to Workspace';
		const openSettingsOption = '$(settings-gear) Open Settings';
		const options = [addImageOption, openSettingsOption];
		const selection = await window.showQuickPick(options, {
			canPickMany: false,
			title: 'Select option'
		});
		if (selection === addImageOption) {
			commands.executeCommand('pharo.addImageToWorkspace');
		} else if (selection === openSettingsOption) {
			commands.executeCommand('workbench.action.openSettings', '@ext:badetitou.pharo-language-server');
		}
	});

	plsStatusBar.show();
	setStatusBarText('Starting Up');
}

function setStatusBarText(text: string) {
	plsStatusBar.text = "$(pls-icon)" + text;
}

function resetStatusBarText() {
	plsStatusBar.text = "$(pls-icon)";
}
