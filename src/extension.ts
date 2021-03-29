/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { workspace, ExtensionContext, commands, window, Selection } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions
} from 'vscode-languageclient';
import * as requirements from './requirements';
import * as net from 'net';
import * as child_process from 'child_process';
import * as lc from 'vscode-languageclient';
import { activateDebug } from './activateDebug'
import { DebugAdapterFactory } from './debugFactory'
import { MoosebookContentProvider } from './moosebookProvider';

export let client: LanguageClient;
let socket: net.Socket;

export async function activate(context: ExtensionContext) {
	// Testing Pharo can be used
	console.info('Start Pharo Language extension');
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
		context.subscriptions.push(client.start());
		window.showInformationMessage('Client started');
	
		// Create new command
		createCommands(context);

		// Create debugguer
		let factory = new DebugAdapterFactory();
		activateDebug(context, factory);

		// Create Moosebook
		console.info('Start moosebook');
		const moosebookContentProvider = new MoosebookContentProvider();
		context.subscriptions.push(vscode.notebook.registerNotebookKernelProvider({ viewType: 'moosebook' }, moosebookContentProvider));
		context.subscriptions.push(vscode.notebook.registerNotebookContentProvider('moosebook', moosebookContentProvider));
	})

}

function createCommands(context: ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('pharo.extensionVersion', commandPharoExtensionVersion));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.printIt', commandPharoPrintIt));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.showIt', commandPharoShowIt));
	context.subscriptions.push(vscode.commands.registerCommand('pharo.save', commandPharoSave));
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

function commandPharoPrintIt() {
	let editor = vscode.window.activeTextEditor;
	let selection = editor.selection;
	client.sendRequest('command:printIt', {"line": editor.document.getText(selection)}).then( (result: string) => {
		editor.edit(editBuilder => {
			editBuilder.replace( new vscode.Selection(selection.end, selection.end), ' "' + result + '" ');
		})
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoShowIt() {
	let editor = vscode.window.activeTextEditor;
	client.sendRequest('command:printIt', {"line": editor.document.getText(editor.selection)}).then( (result: string) => {
		window.showInformationMessage(result);
	}).catch((error) => window.showErrorMessage(error));
}

function commandPharoSave() {
	client.sendRequest('command:save').then( (result: string) => {
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
		documentSelector: [{ scheme: 'file', language: 'pharo' }],
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

async function createServerWithSocket(pharoPath: string, pathToImage: string, context: ExtensionContext) {
    let dls: child_process.ChildProcess;
	dls = child_process.spawn(pharoPath.trim(), [
		pathToImage, 'st', context.asAbsolutePath('/res/run-server.st')
	]);

	await sleep(8000); // Wait that the Pharo server start

	socket = net.connect({ port: 4000, host: '127.0.0.1' }, () => {
		// 'connect' listener.
		console.log('connected to server!');
	});

	let result: lc.StreamInfo = {
		writer: socket,
		reader: socket
	};
	return Promise.resolve(result);
}

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
