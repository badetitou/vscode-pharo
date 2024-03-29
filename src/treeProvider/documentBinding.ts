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
		vscode.workspace.onDidOpenTextDocument(e => this.refresh());
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
		if (vscode.window.activeTextEditor !== undefined &&  vscode.window.activeTextEditor.document !== undefined) {
			if (element === undefined) {
				return client.sendRequest('pls:documentVariables', { textDocument: vscode.window.activeTextEditor.document }).then((result: Array<PLSVariable>) => {
					return result.map((item) => { return { name: item.name + ': ' + item.value, variableReference: item.variableReference, value: item.value, isDirectory: item.isDirectory }; });
				});

			}
			return client.sendRequest('pls:childrenVariables', { variableReference: element.variableReference, textDocument: vscode.window.activeTextEditor.document }).then((result: Array<PLSVariable>) => {
				return result.sort().map((item) => {
					return {
						name: item.name + ': ' + item.value,
						variableReference: item.variableReference,
						value: item.value,
						isDirectory: item.isDirectory
					};
				});
			});
		} else {
			return [];
		}

	}

}

export class PharoDocumentExplorer {

	public pharoBindingProvider = new PharoBindingProvider();

	constructor(context: vscode.ExtensionContext) {
		vscode.window.createTreeView('pharoBindingView', { treeDataProvider: this.pharoBindingProvider });
	}

	refresh() {
		this.pharoBindingProvider.refresh();
	}

}