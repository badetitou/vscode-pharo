/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { client } from './extension';

interface PharoResponse {
	mimetype: string,
	content: string
}


export class Moosebook implements vscode.Disposable {


	constructor(doc: vscode.NotebookDocument) {
		
	}

	async dispose() {
		
	}

	public async restartKernel() {

	}

	public async toggleDebugging(document: vscode.NotebookDocument) {

	}

	public async eval(cell: vscode.NotebookCell): Promise<PharoResponse> {
		// Eval
		return client.sendRequest('command:notebookPrintIt', {"line": cell.document.getText()}).then( (result: PharoResponse) => {
			return result;
		}).catch((error) => { throw new Error(error);
		});
	}

	public addDebugSession(session: vscode.DebugSession) {

	}

	public removeDebugSession(session: vscode.DebugSession) {

	}

}
