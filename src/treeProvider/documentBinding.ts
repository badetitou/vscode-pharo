import * as vscode from 'vscode';
import { client } from '../extension';

export interface PLSVariable {
	name: string;
	value: string;
	variableReference: string;
	isDirectory: boolean;
}

export class PharoBindingProvider implements vscode.TreeDataProvider<PLSVariable> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

	constructor() { 
		vscode.workspace.onDidOpenTextDocument(e => this.refresh())
	}

	public refresh(): any {
		this._onDidChangeTreeData.fire(undefined);
		
	}


	public getTreeItem(element: PLSVariable): vscode.TreeItem {
		return {
			label: element.name,
			id: element.variableReference,
			collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0
		};
	}

	public getChildren(element?: PLSVariable): PLSVariable[] | Thenable<PLSVariable[]> {
		if (element === undefined) {
			return client.onReady().then(() =>
				client.sendRequest('pls:documentVariables', {textDocument: vscode.window.activeTextEditor.document}).then((result: Array<PLSVariable>) => {
					return result.map((item) => { return { name: item.name + ': ' + item.value, variableReference: item.variableReference, value: item.value, isDirectory: true }; })
				})
			)
		}
		return client.onReady().then(() =>
			client.sendRequest('pls:childrenVariables', { variableReference: element.variableReference, textDocument: vscode.window.activeTextEditor.document }).then((result: Array<PLSVariable>) => {
				return result.sort().map((item) => {
					return {
						name: item.name + ': ' + item.value,
						variableReference: item.variableReference,
						value: item.value,
						isDirectory: true
					};
				})
			})
		)
	}

}

export class PharoDocumentExplorer {
	constructor(context: vscode.ExtensionContext) {
		const pharoBindingProvider = new PharoBindingProvider();
		vscode.window.createTreeView('pharoBindingView', { treeDataProvider: pharoBindingProvider });

	}
}