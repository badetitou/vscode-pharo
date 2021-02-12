/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { client } from './extension';

export class Moosebook implements vscode.Disposable {


	constructor(doc: vscode.NotebookDocument) {
		
	}

	async dispose() {
		
	}

	public async restartKernel() {

	}

	public async toggleDebugging(document: vscode.NotebookDocument) {

	}

	public async eval(cell: vscode.NotebookCell): Promise<string> {
		// Eval
		return client.sendRequest('command:printIt', {"line": cell.document.getText()}).then( (result: string) => {
			return result;
		}).catch((error) => { throw new Error(error);
		});
	}

	public addDebugSession(session: vscode.DebugSession) {

	}

	public removeDebugSession(session: vscode.DebugSession) {

	}

}
