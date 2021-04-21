import * as vscode from 'vscode';
import { client } from '../extension';

export interface PharoNode {
	name: string;
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
			collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
			command: element.isDirectory ? void 0 : {
				command: 'pharoImage.openClass',
				arguments: [element.resource],
				title: 'Open Pharo Class'
			}
		};
	}

	public getChildren(element?: PharoNode): PharoNode[] | Thenable<PharoNode[]> {
		if (element === undefined) {
			return client.onReady().then(() =>
				client.sendRequest('pls:packages', {}).then((result: Array<string>) => {
					return result.sort().map((item) => { return { name: item, resource: vscode.Uri.parse('pharoImage:' + item, true), isDirectory: true }; })
				})
			)
		}
		return client.onReady().then(() =>
			client.sendRequest('pls:classes', { package: element.name }).then((result: Array<string>) => {
				return result.sort().map((item) => {
					return {
						name: item,
						resource: vscode.Uri.parse('pharoImage:' + item, true),
						isDirectory: false
					};
				})
			})
		)
	}

	public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
		return client.onReady().then(() =>{
			return client.sendRequest('pls:classContent', { class: uri.path }).then((result: string) => result);
		});
	}
}

export class PharoImageExplorer {
	constructor(context: vscode.ExtensionContext) {
		const pharoDataProvider = new PharoDataProvider();
		vscode.window.createTreeView('pharoImage', { treeDataProvider: pharoDataProvider });
		context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('pharoImage', pharoDataProvider));
		vscode.commands.registerCommand('pharoImage.openClass', resource => this.openResource(resource));

	}

	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource);
	}
}