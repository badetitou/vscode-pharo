
import { workspace, Uri, env, window, ConfigurationTarget, commands, ExtensionContext } from 'vscode';
import * as fs from 'fs';
const vscode = require('vscode');

export interface RequirementsData {
    pathToVM: string;
    pathToImage: string;
}

interface ErrorData {
    message: string;
    label: string;
    command: string;
    commandParam: any;
}

export async function resolveRequirements(): Promise<RequirementsData> {
    const pathToVM = await checkPathToVM();
	const pathToImage = await checkPathToImage();
    return Promise.resolve({ pathToVM: pathToVM, pathToImage: pathToImage });
}

async function checkPathToVM(): Promise<string> {
	return new Promise(async (resolve, reject) => {
		if (!fs.existsSync(vscode.workspace.getConfiguration('pharo').get('pathToVM'))) {
			reject({
				message: 'Path to VM incorrectly set',
				label: 'Open settings',
				command: 'workbench.action.openSettings'
			});
		}
		return resolve(vscode.workspace.getConfiguration('pharo').get('pathToVM'));

	});
}

async function checkPathToImage(): Promise<string> {
	return new Promise(async (resolve, reject) => {
		if (!fs.existsSync(vscode.workspace.getConfiguration('pharo').get('pathToImage'))) {
			reject({
				message: 'Path to Image incorrectly set',
				label: 'Open settings',
				command: 'workbench.action.openSettings'
			});
		}
		return resolve(vscode.workspace.getConfiguration('pharo').get('pathToImage'));
	});
}