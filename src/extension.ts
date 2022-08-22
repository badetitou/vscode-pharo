/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { workspace, ExtensionContext, commands, window, Selection } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	StreamInfo,
	TransportKind
} from 'vscode-languageclient/node';
import * as requirements from './requirements';
import * as net from 'net';
import * as child_process from 'child_process';
import * as lc from 'vscode-languageclient';
import { activateDebug } from './activateDebug'
import { DebugAdapterFactory } from './debugFactory'
import { PharoImageExplorer } from './treeProvider/imageExplorer';
import { PharoDocumentExplorer } from './treeProvider/documentBinding';
import { sign } from 'crypto';
import { MoosebookSerializer } from './moosebook/MoosebookSerializer'
import { MoosebookController } from './moosebook/MoosebookController';

export let client: LanguageClient;
let documentExplorer: PharoDocumentExplorer;

export async function activate(context: ExtensionContext) {
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
	
		// Create new command
		createCommands(context);

		new PharoImageExplorer(context);
		documentExplorer = new PharoDocumentExplorer(context);

		// Create debugguer
		let factory = new DebugAdapterFactory();
		activateDebug(context, factory);
		context.subscriptions.push(vscode.workspace.registerNotebookSerializer('moosebook', new MoosebookSerializer()));
		context.subscriptions.push(new MoosebookController());
	})

}

function createCommands(context: ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('pharo.extensionVersion', commandPharoExtensionVersion));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.printIt', commandPharoPrintIt));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.showIt', commandPharoShowIt));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.doIt', commandPharoDoIt));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.save', commandPharoSave));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.executeTest', commandPharoExecuteTest));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.executeClassTests', commandPharoExecuteClassTests));
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
	let editor = vscode.window.activeTextEditor;
	let selection = editor.selection;
	client.sendRequest('command:printIt', { "line": editor.document.getText(selection), "textDocumentURI": editor.document.uri }).then((result: string) => {
		documentExplorer.refresh();
	}).catch((error) => window.showErrorMessage(error));
}


function commandPharoPrintIt() {
	let editor = vscode.window.activeTextEditor;
	let selection = editor.selection;
	client.sendRequest('command:printIt', { "line": editor.document.getText(selection), "textDocumentURI": editor.document.uri }).then((result: string) => {
		editor.edit(editBuilder => {
			editBuilder.replace(new vscode.Selection(selection.end, selection.end), ' "' + result + '" ');
		})
		documentExplorer.refresh();
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoShowIt() {
	let editor = vscode.window.activeTextEditor;
	client.sendRequest('pls-gtk:inspectIt', { "line": editor.document.getText(editor.selection), "textDocumentURI": editor.document.uri }).then((result: string) => {
		window.showInformationMessage(result);
		// documentExplorer.refresh();
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
			{ scheme: 'pharoImage', language: 'pharo' }
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
    let dls: child_process.ChildProcess;
	
	dls = child_process.spawn(pharoPath.trim(), [
		pathToImage, 'st', context.asAbsolutePath('/res/run-server.st')
	]);

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
			resolve(socket)
		});
		});
	});
}
