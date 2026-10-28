import { workspace, ExtensionContext, commands, window, Uri, Selection, CancellationTokenSource, scm, StatusBarAlignment, StatusBarItem, FileType, OutputChannel, FileSystemError } from 'vscode';
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
import { buildPharoUri, ICE_REPOSITORY_QUERY_KEY, repositoryNameFromPharoUri } from './treeProvider/pharoUri';
import { expectString, expectStringArray } from './rpcContracts';
import { registerServerDiagnosticsCommand } from './serverDiagnostics';
import { installImageDirectory, ImageInstallResult } from './imageInstall';


export let client: LanguageClient;
export let documentExplorer: PharoDocumentExplorer;
let dls: child_process.ChildProcess | undefined;
export let extensionContext: ExtensionContext;
export let iceControlManager: IceControlManager;

let pharoImagesExplorer: PharoImagesExplorer;

let plsStatusBar: StatusBarItem;
let pharoRepositoryStatusBar: StatusBarItem;
let outputChannel: OutputChannel;
let serverStarted = false;
let isDeactivating = false;
let serverLifecycleStatus = 'Starting up';
const SERVER_START_TIMEOUT_MS = 30_000;
const PROCESS_STOP_TIMEOUT_MS = 5_000;
const PHARO_IMAGE_WORKSPACE_SCHEME = 'pharoImage';
const PHARO_IMAGE_WORKSPACE_NAME = 'Pharo Image';
let pharoImageExplorer: PharoImageExplorer;

export async function activate(context: ExtensionContext) {


	extensionContext = context;
	outputChannel = window.createOutputChannel('Pharo Language Server');
	context.subscriptions.push(outputChannel);
	isDeactivating = false;
	serverStarted = false;
	serverLifecycleStatus = 'Starting up';
	// AI entrypoints: @pharo participant + tool-calls (pharo.*)
	registerPharoLanguageModelTools(context);
	registerPharoChatParticipant(context);
	initStatusBar(extensionContext);
	registerRepositoryContextUi(context);
	// Create new command
	createCommands(context);
	context.subscriptions.push(registerServerDiagnosticsCommand({
		getClient: () => typeof client === 'undefined' ? undefined : client,
		getProcess: () => dls,
		getLifecycleStatus: () => serverLifecycleStatus,
		getExtensionVersion: () => extensionContext.extension.packageJSON.version,
		outputChannel
	}));
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
		if (error instanceof requirements.RequirementsError) {
			outputChannel.appendLine(error.message);
			window.showErrorMessage(error.message, error.label).then((selection) => {
				if (error.label && error.label === selection && error.command) {
					commands.executeCommand(error.command, error.commandParam);
				}
			});
		} else {
			outputChannel.appendLine(`Unable to validate Pharo configuration: ${formatError(error)}`);
			window.showErrorMessage(
				`Unable to validate Pharo configuration: ${formatError(error)}. See the Pharo Language Server output for details.`,
				'Show Output'
			).then((selection) => {
				if (selection === 'Show Output') {
					outputChannel.show(true);
				}
			});
		}
		setStatusBarText('Configuration error');
		serverLifecycleStatus = 'Configuration error';
		return;
	}

	// Create the pharo language server client
	client = createPharoLanguageServer(resolvedRequirements, context);

	try {
		// Start the client. This will also launch the server
		await client.start();
		serverStarted = true;
		serverLifecycleStatus = 'Connected';
		context.subscriptions.push(client);

		pharoImageExplorer.refresh();
		documentExplorer = new PharoDocumentExplorer(context);

		// Create debugguer
		let factory = new DebugAdapterFactory();
		activateDebug(context, factory);
		context.subscriptions.push(workspace.registerNotebookSerializer('moosebook', new MoosebookSerializer()));
		context.subscriptions.push(new MoosebookController());

		// Create Ice
		iceControlManager = new IceControlManager(client, () => pharoImageExplorer?.refresh());
		context.subscriptions.push(iceControlManager);

		// Create Tests
		context.subscriptions.push(initTestController());

		resetStatusBarText();
	} catch (err) {
		serverStarted = false;
		serverLifecycleStatus = 'Startup failed';
		outputChannel.appendLine(`Failed to start the Pharo Language Server: ${formatError(err)}`);
		if (err instanceof Error && err.stack) {
			outputChannel.appendLine(err.stack);
		}
		setStatusBarText('Server startup failed');
		window.showErrorMessage(
			`Could not start the Pharo Language Server: ${formatError(err)}. See the Pharo Language Server output for details.`,
			'Show Output'
		).then((selection) => {
			if (selection === 'Show Output') {
				outputChannel.show(true);
			}
		});
		if (client) {
			try {
				await client.stop();
			} catch (stopError) {
				outputChannel.appendLine(`Error cleaning up the Pharo language client: ${formatError(stopError)}`);
			}
		}
		await stopPharoProcess();
	}
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function registerRepositoryContextUi(context: ExtensionContext) {
	context.subscriptions.push(window.onDidChangeActiveTextEditor(() => updateRepositoryStatusBar()));
	updateRepositoryStatusBar();
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

async function commandPharoImagesDownload(): Promise<void> {
	const rootFolder = Uri.file(pharoImagesRootFolderFsPath());
	let localName: string | undefined;
	let replaceExisting = false;
	while (!localName) {
		const requestedName = (await window.showInputBox({
			title: 'Télécharger une image Pharo Language Server',
			placeHolder: 'Nom local (dossier + .image/.changes) (ex: MonProjet-PLS)',
			validateInput: (value) => {
				const trimmed = value.trim();
				if (trimmed.length === 0 || trimmed === '.' || trimmed === '..' || /[<>:"|?*\x00-\x1f]/.test(trimmed) || /[. ]$/.test(trimmed)) {
					return 'Le nom doit être un nom de dossier valide.';
				}
				if (/[\\/]/.test(trimmed)) {
					return 'Le nom ne doit pas contenir de / ou \\.';
				}
				return undefined;
			}
		}))?.trim();

		if (!requestedName) {
			return;
		}

		const targetFolder = Uri.joinPath(rootFolder, requestedName);
		try {
			await workspace.fs.stat(targetFolder);
		} catch (error) {
			if (error instanceof FileSystemError && error.code === 'FileNotFound') {
				localName = requestedName;
				continue;
			}
			window.showErrorMessage(`Impossible de vérifier la destination ${targetFolder.fsPath}: ${formatError(error)}`);
			return;
		}

		const replaceLabel = 'Remplacer l’installation';
		const chooseAnotherLabel = 'Choisir un autre nom';
		const choice = await window.showWarningMessage(
			`Une installation existe déjà dans ${targetFolder.fsPath}. Le remplacement supprimera tout le dossier, y compris le workspace et les fichiers personnalisés.`,
			{ modal: true, detail: 'L’installation existante sera conservée en sauvegarde temporaire jusqu’à la validation de la nouvelle image.' },
			replaceLabel,
			chooseAnotherLabel
		);
		if (choice === replaceLabel) {
			localName = requestedName;
			replaceExisting = true;
		} else if (choice !== chooseAnotherLabel) {
			return;
		}
	}

	const quickInstallConfig = workspace.getConfiguration('pharo quick install');
	const serverVersion: string = quickInstallConfig.get('server version') as string;
	const sourceImageName: string = quickInstallConfig.get('image name') as string;
	const zipUri = pharoLanguageServerImageZipUri(serverVersion, sourceImageName);

	let downloadedDirectory: Uri;
	try {
		downloadedDirectory = await download(zipUri, true, sourceImageName);
	} catch (error) {
		window.showErrorMessage(`Téléchargement impossible: ${(error as Error).message ?? String(error)}`);
		return;
	}

	const targetFolder = Uri.joinPath(rootFolder, localName);
	let installResult: ImageInstallResult;
	try {
		installResult = await installImageDirectory({
			sourceDirectory: downloadedDirectory.fsPath,
			targetDirectory: targetFolder.fsPath,
			sourceImageName,
			localName,
			replaceExisting
		});
	} catch (error) {
		window.showErrorMessage(`Impossible d'installer l'image dans ${targetFolder.fsPath}: ${formatError(error)}`);
		return;
	}
	const desiredImageUri = Uri.joinPath(targetFolder, `${localName}.image`);
	if (installResult.backupCleanupError) {
		window.showWarningMessage(
			`Image installée, mais la sauvegarde de l’installation précédente n’a pas pu être supprimée : ${installResult.backupDirectory}. ${installResult.backupCleanupError}`
		);
	}

	const imageUri = desiredImageUri;
	let workspaceUri: Uri;
	try {
		workspaceUri = await createWorkspaceForImage(imageUri);
	} catch (error) {
		window.showErrorMessage(`Impossible de créer le workspace: ${(error as Error)?.message ?? String(error)}`);
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

export async function deactivate(): Promise<void> {
	isDeactivating = true;
	serverStarted = false;
	if (client) {
		try {
			await client.stop();
		} catch (error) {
			outputChannel?.appendLine(`Error stopping the Pharo language client: ${formatError(error)}`);
		}
	}
	await stopPharoProcess();
}

/*
 * Section with extension commands
 */

function commandPharoExtensionVersion() {
	void client.sendRequest("command:version")
		.then((result) => window.showInformationMessage(String(result)))
		.catch((error) => {
			outputChannel.appendLine(`Unable to read Pharo Language Server version: ${formatError(error)}`);
			void window.showErrorMessage(`Unable to read Pharo Language Server version: ${formatError(error)}`);
		});
}

function commandPharoDoIt() {
	let editor = window.activeTextEditor;
	if (!editor) {
		return;
	}
	let selection = editor.selection;
	client.sendRequest('command:printIt', { "line": editor.document.getText(selection), "textDocumentURI": editor.document.uri })
		.then(() => {
			documentExplorer.refresh();
		}).catch((error) => window.showErrorMessage(error));

}


function commandPharoPrintIt() {
	let editor = window.activeTextEditor;
	if (!editor) {
		return;
	}
	let selection = editor.selection;
	client.sendRequest('command:printIt', { "line": editor.document.getText(selection), "textDocumentURI": editor.document.uri })
	.then((result) => {
		editor.edit(editBuilder => {
			editBuilder.replace(new Selection(selection.end, selection.end), ' "' + result + '" ');
		});
		documentExplorer.refresh();
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoShowIt() {
	let editor = window.activeTextEditor;
	if (!editor) {
		return;
	}
	client.sendRequest('command:printIt', { "line": editor.document.getText(editor.selection), "textDocumentURI": editor.document.uri })
	.then((result) => {
		window.showInformationMessage(result as string);
		documentExplorer.refresh();
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoSave() {
	client.sendRequest('command:save').then((result) => {
		window.showInformationMessage(result as string);
	}).catch((error) => window.showErrorMessage(error));
}

async function commandPharoCreatePackage(target?: unknown) {
	const packageName = (await window.showInputBox({
		title: 'Create Pharo Package',
		placeHolder: 'Package name',
		validateInput: (value) => value.trim().length === 0 ? 'Package name is required.' : undefined
	}))?.trim();
	if (!packageName) {
		return;
	}

	const targetUri = uriFromCommandTarget(target);
	const repositoryName = repositoryNameFromPharoUri(targetUri);

	client.sendRequest('pls:createPackage', { packageName }).then(async (result) => {
		if (repositoryName) {
			await client.sendRequest('pls-ice:addPackage', {
				aRepositoryName: repositoryName,
				packageName
			});
		}
		window.showInformationMessage(result as string);
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
	}).then((result) => {
		const targetUri = uriFromCommandTarget(target);
		window.showInformationMessage(result as string);
		pharoImageExplorer.refresh();
		void commands.executeCommand(
			'vscode.open',
			pharoClassUri(packageName, className, targetUri)
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
	}).then((result) => {
		window.showInformationMessage(result as string);
		void commands.executeCommand('pharo.ice.refresh');
	}).catch((error) => window.showErrorMessage(error));
}

async function pickPharoPackageName(): Promise<string | undefined> {
	let packages: string[] = [];
	try {
		packages = expectStringArray(await client.sendRequest('pls:packages', {}), 'pls:packages');
	} catch (error) {
		outputChannel.appendLine(`Unable to load Pharo packages: ${formatError(error)}`);
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

function pharoClassUri(packageName: string, className: string, sourceUri?: Uri): Uri {
	const repositoryName = repositoryNameFromPharoUri(sourceUri);
	return buildPharoUri(`/${packageName}/${className}.class.st`, repositoryName, PHARO_IMAGE_WORKSPACE_SCHEME);
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
	client.sendRequest('pls:executeClassTest', { class: aClass, testMethod: testMethod }).then((result) => {
		window.showInformationMessage(result as string);
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoExecuteClassTests(aClass: string) {
	client.sendRequest('pls:executeClassTests', { className: aClass }).then((result) => {
		window.showInformationMessage(result as string);
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoCreateProject() {
	let rootProject: Uri = workspace.workspaceFolders![0].uri;
	workspace.fs.createDirectory(Uri.file(rootProject.fsPath + "/src"));
	workspace.fs.writeFile(
		Uri.file(rootProject.fsPath + "\\.project"),
		new Uint8Array(Buffer.from("{\n    'srcDirectory' : 'src'\n}")));
	workspace.fs.writeFile(
		Uri.file(rootProject.fsPath + "/src/.properties"),
		new Uint8Array(Buffer.from("{\n    #format : #tonel\n}")));
}
function commandPharoOpenLog() {
	void client.sendRequest('pls-developer:openLog')
		.catch((error) => window.showErrorMessage(formatError(error)));
}

function commandPharoClearLog() {
	void client.sendRequest('pls-developer:clearLog')
		.catch((error) => window.showErrorMessage(formatError(error)));
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

	serverStarted = false;
	await stopPharoProcess();

	// Download pharo VM
	let vmVersion: string = workspace.getConfiguration('pharo quick install').get('server VM version') as string;
	let vmDirectory = await download(pharoVmZipUri(vmVersion), true, 'pharoVM');
	workspace.getConfiguration('pharo').update('pathToVM', pharoVmExecutablePath(vmDirectory), true);
	window.showInformationMessage('VM updated. Please wait');

	// Download image
	let imageName: string = workspace.getConfiguration('pharo quick install').get('image name') as string;
	let serverVersion: string = workspace.getConfiguration('pharo quick install').get('server version') as string;
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
	const repositoryName = query.get(ICE_REPOSITORY_QUERY_KEY);
	return repositoryName !== null && repositoryName.trim().length > 0;
}

async function createServerWithSocket(pharoPath: string, pathToImage: string, context: ExtensionContext): Promise<StreamInfo> {

	let options = [pathToImage, 'st', context.asAbsolutePath('/res/run-server.st')];
	if (workspace.getConfiguration('pharo').get('headless') && !workspace.getConfiguration('pharo').get('debugMode')) {
		options.unshift('--headless');
	}
	outputChannel.appendLine(`Starting Pharo VM: ${pharoPath} ${options.join(' ')}`);
	try {
		dls = child_process.spawn(pharoPath, options);
	} catch (error) {
		throw new Error(`Unable to launch the Pharo VM: ${formatError(error)}`);
	}

	const process = dls;
	process.stdout?.on('data', (data: Buffer) => outputChannel.append(`[Pharo stdout] ${data.toString()}`));
	process.stderr?.on('data', (data: Buffer) => outputChannel.append(`[Pharo stderr] ${data.toString()}`));
	process.on('error', (error) => {
		serverLifecycleStatus = 'VM process error';
		setStatusBarText('VM process error');
		outputChannel.appendLine(`Pharo VM process error: ${formatError(error)}`);
	});
	process.on('close', (code, signal) => {
		outputChannel.appendLine(`Pharo VM exited (code: ${code ?? 'none'}, signal: ${signal ?? 'none'}).`);
		if (serverStarted && !isDeactivating) {
			serverStarted = false;
			serverLifecycleStatus = 'Stopped';
			setStatusBarText('Server stopped');
			window.showErrorMessage(
				`The Pharo Language Server stopped (code: ${code ?? 'none'}, signal: ${signal ?? 'none'}). See the Pharo Language Server output for details.`,
				'Show Output'
			).then((selection) => {
				if (selection === 'Show Output') {
					outputChannel.show(true);
				}
			});
		}
	});

	const socket = await getSocket(process);
	return { writer: socket, reader: socket };
}

async function getSocket(process: child_process.ChildProcess): Promise<net.Socket> {
	return new Promise((resolve, reject) => {
		const stdout = process.stdout;
		if (!stdout) {
			reject(new Error('Pharo VM stdout is unavailable; cannot read the language server port.'));
			return;
		}

		let output = '';
		let socket: net.Socket | undefined;
		let settled = false;
		const timeout = setTimeout(() => {
			fail(new Error(`Timed out after ${SERVER_START_TIMEOUT_MS / 1000} seconds waiting for the Pharo Language Server socket.`));
		}, SERVER_START_TIMEOUT_MS);

		const cleanup = () => {
			clearTimeout(timeout);
			stdout.removeListener('data', onData);
			process.removeListener('error', onProcessError);
			process.removeListener('close', onProcessClose);
			socket?.removeListener('error', onSocketError);
		};

		const fail = (error: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			socket?.destroy();
			reject(error);
		};

		const onProcessError = (error: Error) => fail(new Error(`Pharo VM failed to start: ${error.message}`));
		const onProcessClose = (code: number | null, signal: NodeJS.Signals | null) => {
			fail(new Error(`Pharo VM exited before the language server connected (code: ${code ?? 'none'}, signal: ${signal ?? 'none'}).`));
		};
		const onSocketError = (error: Error) => fail(new Error(`Unable to connect to the Pharo Language Server socket: ${error.message}`));

		const onData = (data: Buffer) => {
			const text = data.toString();
			outputChannel.append(`[Pharo port] ${text}`);
			output += text;
			if (output.length > 8192) {
				output = output.slice(-8192);
			}
			const portLine = output.split(/\r?\n/).map((line) => line.trim()).find((line) => /^\d{1,5}$/.test(line));
			if (!portLine || socket) {
				return;
			}

			const port = Number(portLine);
			if (port < 1 || port > 65535) {
				fail(new Error(`Pharo Language Server returned an invalid port: ${portLine}`));
				return;
			}

			socket = net.createConnection({ port, host: '127.0.0.1' });
			socket.once('error', onSocketError);
			socket.once('connect', () => {
				if (settled) {
					socket?.destroy();
					return;
				}
				settled = true;
				cleanup();
				outputChannel.appendLine(`Connected to Pharo Language Server on port ${port}.`);
				resolve(socket!);
			});
		};

		stdout.on('data', onData);
		process.once('error', onProcessError);
		process.once('close', onProcessClose);
	});
}

async function stopPharoProcess(): Promise<void> {
	const process = dls;
	if (!process || process.exitCode !== null || process.signalCode !== null) {
		dls = undefined;
		return;
	}

	await new Promise<void>((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(forceKillTimeout);
			process.removeListener('close', finish);
			dls = undefined;
			resolve();
		};
		const forceKillTimeout = setTimeout(() => {
			outputChannel?.appendLine('Pharo VM did not stop after SIGTERM; sending SIGKILL.');
			try {
				if (!process.kill('SIGKILL')) {
					finish();
				}
			} catch (error) {
				outputChannel?.appendLine(`Unable to force-stop Pharo VM: ${formatError(error)}`);
				finish();
			}
		}, PROCESS_STOP_TIMEOUT_MS);

		process.once('close', finish);
		try {
			if (!process.kill('SIGTERM')) {
				finish();
			}
		} catch (error) {
			outputChannel?.appendLine(`Unable to stop Pharo VM: ${formatError(error)}`);
			finish();
		}
	});
}

// About Status bar
function initStatusBar(context: ExtensionContext) {
	plsStatusBar = window.createStatusBarItem(StatusBarAlignment.Right, 100);
	context.subscriptions.push(plsStatusBar);
	plsStatusBar.tooltip = 'Pharo Language Server: starting';
	plsStatusBar.command = 'extension.showQuickPick';

	pharoRepositoryStatusBar = window.createStatusBarItem(StatusBarAlignment.Right, 99);
	pharoRepositoryStatusBar.name = 'Pharo Iceberg Repository';
	pharoRepositoryStatusBar.tooltip = 'Iceberg repository for the active Pharo document';
	context.subscriptions.push(pharoRepositoryStatusBar);

	context.subscriptions.push(commands.registerCommand('extension.showQuickPick', async () => {
		const addImageOption = '$(folder-opened) Add Image to Workspace';
		const openSettingsOption = '$(settings-gear) Open Settings';
		const diagnosticsOption = '$(stethoscope) Pharo Language Server Diagnostics';
		const options = [diagnosticsOption, addImageOption, openSettingsOption];
		const selection = await window.showQuickPick(options, {
			canPickMany: false,
			title: 'Select option'
		});
		if (selection === diagnosticsOption) {
			await commands.executeCommand('pharo.diagnose');
		} else if (selection === addImageOption) {
			commands.executeCommand('pharo.addImageToWorkspace');
		} else if (selection === openSettingsOption) {
			commands.executeCommand('workbench.action.openSettings', '@ext:badetitou.pharo-language-server');
		}
	}));

	plsStatusBar.show();
	setStatusBarText('Starting Up');
	updateRepositoryStatusBar();
}

function setStatusBarText(text: string) {
	plsStatusBar.text = "$(pls-icon)" + text;
	plsStatusBar.tooltip = `Pharo Language Server: ${text}`;
}

function resetStatusBarText() {
	serverLifecycleStatus = 'Connected';
	setStatusBarText('Connected');
}

function updateRepositoryStatusBar() {
	const uri = window.activeTextEditor?.document.uri;
	const repositoryName = repositoryNameFromPharoUri(uri);
	if (!repositoryName) {
		pharoRepositoryStatusBar?.hide();
		return;
	}

	pharoRepositoryStatusBar.text = `$(repo) ${repositoryName}`;
	pharoRepositoryStatusBar.tooltip = `Iceberg repository: ${repositoryName}`;
	pharoRepositoryStatusBar.show();
}
