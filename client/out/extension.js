"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require('vscode');
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const requirements = require("./requirements");
const net = require("net");
const child_process = require("child_process");
let client;
let socket;
async function activate(context) {
    // Testing Pharo can be used
    return requirements.resolveRequirements().catch(error => {
        vscode_1.window.showErrorMessage(error.message, error.label).then((selection) => {
            if (error.label && error.label === selection && error.command) {
                vscode_1.commands.executeCommand(error.command, error.commandParam);
            }
        });
    }).then(async (requirements) => {
        // Create the pharo language server client
        client = createPharoLanguageServer(requirements, context);
        // Start the client. This will also launch the server
        context.subscriptions.push(client.start());
        vscode_1.window.showInformationMessage('Client started');
        // Create new command
        createCommands(context);
    });
}
exports.activate = activate;
function createCommands(context) {
    const command = 'pharo.extensionVersion';
    context.subscriptions.push(vscode.commands.registerCommand(command, commandPharoExtensionVersion));
}
function deactivate() {
}
exports.deactivate = deactivate;
/*
 * Section with extension commands
 */
function commandPharoExtensionVersion() {
    client.sendRequest("command:version").then((result) => {
        console.log(result);
        vscode_1.window.showInformationMessage(result + '');
    });
}
/*
 * Section with function for Pharo Language Server
 */
function createPharoLanguageServer(requirements, context) {
    let serverOptions = () => createServerWithSocket(requirements.pathToVM, requirements.pathToImage, context);
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
    return new vscode_languageclient_1.LanguageClient('pharoServerExample', 'Pharo Server Example', serverOptions, clientOptions);
}
async function createServerWithSocket(pharoPath, pathToImage, context) {
    let dls;
    dls = child_process.spawn(pharoPath.trim(), [
        pathToImage, 'st', context.asAbsolutePath('client/src/res/run-server.st')
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