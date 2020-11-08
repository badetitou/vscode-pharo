/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
const vscode = require('vscode');
import * as net from 'net';
import { workspace, ExtensionContext, extensions } from 'vscode';
import * as child_process from 'child_process';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';
import * as lc from 'vscode-languageclient';

let client: LanguageClient;
let socket: net.Socket;

export async function activate(context: ExtensionContext) {

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = () => createServerWithSocket('pharo', context); 
	
	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'plaintext' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);
		
	// Start the client. This will also launch the server
	context.subscriptions.push(client.start());
}

export function deactivate() {
}


async function createServerWithSocket(pharoPath: string, context: ExtensionContext) {
    let dls: child_process.ChildProcess;
	dls = child_process.spawn(pharoPath.trim(), [
		process.env.HOME + '/Pharo/images/LSP2/LSP2.image', 'st', context.asAbsolutePath('client/src/res/run-server.st')
	]);

	console.log('here');
	await sleep(10000);

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