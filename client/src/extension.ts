/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

const vscode = require('vscode');
import { workspace, ExtensionContext, extensions, commands, window } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';
import * as requirements from './requirements';
import * as net from 'net';
import * as child_process from 'child_process';
import * as lc from 'vscode-languageclient';

let client: LanguageClient;
let socket: net.Socket;

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
		context.subscriptions.push(client.start());
		window.showInformationMessage('Client started');
	
		// Create new command
		createCommands(context);
	})

}

function createCommands(context: ExtensionContext) {
	const command = 'pharo.extensionVersion';
	context.subscriptions.push(vscode.commands.registerCommand(command, commandPharoExtensionVersion));
}



export function deactivate() {
}

/*
 * Section with extension commands
 */

function commandPharoExtensionVersion() {
	client.sendRequest("command:version").then( (result) => {
		console.log(result);
		window.showInformationMessage(result + '');
	});
	
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
		'pharoServerExample',
		'Pharo Server Example',
		serverOptions,
		clientOptions
	);
}

async function createServerWithSocket(pharoPath: string, pathToImage: string, context: ExtensionContext) {
    let dls: child_process.ChildProcess;
	dls = child_process.spawn(pharoPath.trim(), [
		pathToImage, 'st', context.asAbsolutePath('client/src/res/run-server.st')
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
