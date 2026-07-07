import * as fs from 'fs';
const vscode = require('vscode');

export interface RequirementsData {
	pathToVM: string;
	pathToImage: string;
}

export class RequirementsError {
	constructor(
		public message: string,
		public label: string,
		public command: string,
		public commandParam?: any
	) { }
}

export async function resolveRequirements(): Promise<RequirementsData> {
	const pathToVM = await checkPathToVM();
	const pathToImage = await checkPathToImage();
	return Promise.resolve({ pathToVM: pathToVM, pathToImage: pathToImage });
}

async function checkPathToVM(): Promise<string> {
	return new Promise(async (resolve, reject) => {
		if (!fs.existsSync(vscode.workspace.getConfiguration('pharo').get('pathToVM'))) {
			reject(new RequirementsError('Path to VM incorrectly set', 'Open settings', 'workbench.action.openSettings'));
		}
		return resolve(vscode.workspace.getConfiguration('pharo').get('pathToVM'));

	});
}

async function checkPathToImage(): Promise<string> {
	return new Promise(async (resolve, reject) => {
		if (!fs.existsSync(vscode.workspace.getConfiguration('pharo').get('pathToImage'))) {
			reject(new RequirementsError('Path to Image incorrectly set', 'Open settings', 'workbench.action.openSettings'));
		}
		return resolve(vscode.workspace.getConfiguration('pharo').get('pathToImage'));
	});
}