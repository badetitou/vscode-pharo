import * as vscode from 'vscode';
import { client } from '../extension';

export interface PLSVariable {
	name: string;
	value: string;
	variableReference: string;
	isDirectory: boolean;
}

export class PharoBindingProvider implements vscode.TreeDataProvider<PLSVariable> {

	private readonly _onDidChangeTreeData = new vscode.EventEmitter<PLSVariable | undefined>();
	readonly onDidChangeTreeData: vscode.Event<PLSVariable | undefined> = this._onDidChangeTreeData.event;
	private readonly documentOpenedListener = vscode.workspace.onDidOpenTextDocument(() => this.refresh());

	constructor() {}

	public refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	dispose(): void {
		this.documentOpenedListener.dispose();
		this._onDidChangeTreeData.dispose();
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
				return client.sendRequest('pls:documentVariables', { textDocument: vscode.window.activeTextEditor.document })
				.then((result: unknown) => {
					const typedResult = result as Array<PLSVariable>;
					return typedResult.map((item) => { return { name: item.name + ': ' + item.value, variableReference: item.variableReference, value: item.value, isDirectory: item.isDirectory }; });
				});

			}
			return client.sendRequest('pls:childrenVariables', { variableReference: element.variableReference, textDocument: vscode.window.activeTextEditor.document })
			.then((result: unknown) => {
				const typedResult = result as Array<PLSVariable>;
				return typedResult.sort().map((item) => {
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
	private readonly treeView: vscode.TreeView<PLSVariable>;

	constructor(context: vscode.ExtensionContext) {
		this.treeView = vscode.window.createTreeView('pharoBindingView', { treeDataProvider: this.pharoBindingProvider });
		context.subscriptions.push(this);
	}

	refresh() {
		this.pharoBindingProvider.refresh();
	}

	dispose(): void {
		this.treeView.dispose();
		this.pharoBindingProvider.dispose();
	}

}