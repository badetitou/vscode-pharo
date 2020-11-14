"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require('vscode');
const net = require("net");
const vscode_1 = require("vscode");
const child_process = require("child_process");
const vscode_languageclient_1 = require("vscode-languageclient");
let client;
let socket;
async function activate(context) {
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions = () => createServerWithSocket(vscode.workspace.getConfiguration('pharo').get('pathToVM'), context);
    // Options to control the language client
    let clientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'pharo' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // Create the language client and start the client.
    client = new vscode_languageclient_1.LanguageClient('pharoServerExample', 'Pharo Server Example', serverOptions, clientOptions);
    // Start the client. This will also launch the server
    context.subscriptions.push(client.start());
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
async function createServerWithSocket(pharoPath, context) {
    let dls;
    dls = child_process.spawn(pharoPath.trim(), [
        vscode.workspace.getConfiguration('pharo').get('pathToImage'), 'st', context.asAbsolutePath('client/src/res/run-server.st')
    ]);
    await sleep(8000); // Wait that the Pharo server start
    socket = net.connect({ port: 4000, host: '127.0.0.1' }, () => {
        // 'connect' listener.
        console.log('connected to server!');
    });
    let result = {
        writer: socket,
        reader: socket
    };
    return Promise.resolve(result);
}
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=extension.js.map