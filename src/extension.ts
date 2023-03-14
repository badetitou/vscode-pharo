import { workspace, ExtensionContext, commands, window, Uri, Selection, CancellationTokenSource, scm } from 'vscode';
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
const os = require('os');

import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";
import { IceControlManager } from './ice/IceControlManager';


export let client: LanguageClient;
export let documentExplorer: PharoDocumentExplorer;
let dls: child_process.ChildProcess;
export let extensionContext: ExtensionContext;


export async function activate(context: ExtensionContext) {

	extensionContext = context;
	// Create new command
	createCommands(context);

	// Testing Pharo can be used
	return requirements.resolveRequirements().catch(error => {
		window.showErrorMessage(error.message, error.label).then((selection) => {
			if (error.label && error.label === selection && error.command) {
				commands.executeCommand(error.command, error.commandParam);
			}
		});
	}).then (
		async (requirements : requirements.RequirementsData) => {
		
		// Create the pharo language server client
		client = createPharoLanguageServer(requirements, context);
		
		// Start the client. This will also launch the server
		client.start();
		context.subscriptions.push(client);
		window.showInformationMessage('Client started');
	
		new PharoImageExplorer(context);
		documentExplorer = new PharoDocumentExplorer(context);

		// Create debugguer
		let factory = new DebugAdapterFactory();
		activateDebug(context, factory);
		context.subscriptions.push(workspace.registerNotebookSerializer('moosebook', new MoosebookSerializer()));
		context.subscriptions.push(new MoosebookController());

		// Create Ice
		let iceControlManager = new IceControlManager(client, context);
		context.subscriptions.push(iceControlManager);
	});
}

function createCommands(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('pharo.extensionVersion', commandPharoExtensionVersion));
	context.subscriptions.push(commands.registerCommand('pharo.printIt', commandPharoPrintIt));
	context.subscriptions.push(commands.registerCommand('pharo.showIt', commandPharoShowIt));
	context.subscriptions.push(commands.registerCommand('pharo.doIt', commandPharoDoIt));
	context.subscriptions.push(commands.registerCommand('pharo.save', commandPharoSave));
	context.subscriptions.push(commands.registerCommand('pharo.executeTest', commandPharoExecuteTest));
	context.subscriptions.push(commands.registerCommand('pharo.executeClassTests', commandPharoExecuteClassTests));
	context.subscriptions.push(commands.registerCommand('pharo.installIt', commandPharoInstallLastVersion));
	context.subscriptions.push(commands.registerCommand('pharo.createProject', commandPharoCreateProject));
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
	client.sendRequest('command:save').then( (result: string) => {
		window.showInformationMessage(result);
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoExecuteTest(aClass: string, testMethod: string) {
	client.sendRequest('pls:executeClassTest', {class: aClass, testMethod: testMethod}).then( (result: string) => {
		window.showInformationMessage(result);
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoExecuteClassTests(aClass: string) {
	client.sendRequest('pls:executeClassTests', {className: aClass}).then( (result: string) => {
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

export async function commandPharoInstallLastVersion() {

	if(dls !== undefined){
		dls.kill(9);
	}

	// Download pharo VM

	let vmPath = '';
	if (os.platform() === 'linux') {
		vmPath = 'https://files.pharo.org/get-files/100/pharo64-linux-stable.zip';
	} else if (os.platform() === 'darwin') { // MacOSX
		vmPath = 'https://files.pharo.org/get-files/100/pharo64-mac-stable.zip';
	} else {
		vmPath = 'https://files.pharo.org/get-files/100/pharo-vm-Windows-x86_64-stable.zip';
	}

	let vmDirectory = await download(Uri.parse(vmPath), true, 'pharoVM');

	if (os.platform() === 'linux') {
		workspace.getConfiguration('pharo').update('pathToVM', vmDirectory.fsPath + "/pharo", true);
	} else if (os.platform() === 'darwin') { // MacOSX
		workspace.getConfiguration('pharo').update('pathToVM', vmDirectory.fsPath + "/Pharo.app/Contents/MacOS/Pharo", true);
	} else {
		workspace.getConfiguration('pharo').update('pathToVM', vmDirectory.fsPath + "\\Pharo.exe", true);
	}
	window.showInformationMessage('VM updated. Please wait');

	// Download image
	let imageName = 'Moose64-10-PLS';
	let pharoDirectory = await download(Uri.parse("https://github.com/badetitou/Pharo-LanguageServer/releases/download/v3.1.2/" + imageName + ".zip"), true, imageName);

	if (os.platform() === 'linux' || os.platform() === 'darwin') {
		workspace.getConfiguration('pharo').update('pathToImage', pharoDirectory.fsPath + "/" + imageName + ".image", true);
	} else {
		workspace.getConfiguration('pharo').update('pathToImage', pharoDirectory.fsPath + "\\" + imageName + ".image", true);
	}
	
	window.showInformationMessage('Pharo updated. Please restart', 'Restart VSCode').then(() => {
		commands.executeCommand('workbench.action.reloadWindow');
	});
}


async function download(uri: Uri, unzip: boolean, location: string): Promise<Uri> {

	// let mooseImageUri = Uri.parse("", true);
	const fileDownloader: FileDownloader = await getApi();
	console.log('Download ', uri);
	console.log('Download ', uri.toString());
	// update to string
	uri.toString = (skipEncoding?: boolean): string => {
		return uri.scheme + "://" + uri.authority + uri.path + "?" + uri.query;
	};
	console.log('Download ', uri.toString());


	const cancellationTokenSource = new CancellationTokenSource();
	const cancellationToken = cancellationTokenSource.token;

	const progressCallback = (downloadedBytes: number, totalBytes: number | undefined) => {
		console.log(`Downloaded ${downloadedBytes}/${totalBytes} bytes`);
	};
	const vmDirectory: Uri = await fileDownloader.downloadFile(
		uri,
		location,
		extensionContext,
		cancellationToken,
		progressCallback,
		{ shouldUnzip: unzip }
	);
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

async function createServerWithSocket(pharoPath: string, pathToImage: string, context: ExtensionContext): Promise<StreamInfo> {
	
	let options = [	pathToImage, 'st', context.asAbsolutePath('/res/run-server.st') ];
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

async function getSocket(dls: child_process.ChildProcess): Promise<net.Socket>  {
	return new Promise(function(resolve) {
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
