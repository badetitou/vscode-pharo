import * as vscode from 'vscode';
import { client } from '../extension';

export interface PharoNode {

	resource: vscode.Uri;
	isDirectory: boolean;

}

export class PharoDataProvider implements vscode.TreeDataProvider<PharoNode>, vscode.TextDocumentContentProvider {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

	constructor() { }

	public refresh(): any {
		this._onDidChangeTreeData.fire(undefined);
	}


	public getTreeItem(element: PharoNode): vscode.TreeItem {
		return {
			resourceUri: element.resource,
			collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0
		};
	}

	public getChildren(element?: PharoNode): PharoNode[] | Thenable<PharoNode[]> {
		if (element === undefined) {
			return client.onReady().then(() =>
				client.sendRequest('pls:packages', {}).then((result: Array<string>) => {
					return result.sort().map((item) => { return { resource: vscode.Uri.parse(item), isDirectory: true }; })
				})
			)
		}
		return [{ resource: vscode.Uri.parse('test'), isDirectory: true }];
	}

	public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
		return 'hello'
	}
}

export class PharoImageExplorer {
	constructor(context: vscode.ExtensionContext) {
		const pharoDataProvider = new PharoDataProvider();
		context.subscriptions.push(vscode.window.createTreeView('pharoImage', { treeDataProvider: pharoDataProvider }));
	}
}