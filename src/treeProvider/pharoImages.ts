import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

export interface PharoImage {
	name: string;
	resource: vscode.Uri;
	isDirectory: boolean;
}


export class PharoImagesProvider implements vscode.TreeDataProvider<PharoImage> {

	private pharoImagesClients: Array<LanguageClient>;

	constructor(pic: Array<LanguageClient>) {
		this.pharoImagesClients = pic;
	}

	onDidChangeTreeData?: vscode.Event<void | PharoImage | PharoImage[]>;

	getTreeItem(element: PharoImage): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return {
					resourceUri: element.resource,
					collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
					command: {
						command: 'pharo.browseImage',
						arguments: [element],
						title: 'Select Pharo Image'
					}
				};
	}
	getChildren(element?: PharoImage): vscode.ProviderResult<PharoImage[]> {
		return this.pharoImagesClients.map((client) => {
			return { name: client.name, resource: vscode.Uri.parse('pharo:/' + client.name, true), isDirectory: false}
		})
	}
	
	getParent?(element: PharoImage): vscode.ProviderResult<PharoImage> {
		throw new Error('Method not implemented.');
	}
	resolveTreeItem?(item: vscode.TreeItem, element: PharoImage, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
		throw new Error('Method not implemented.');
	}

}

export class PharoImagesExplorer {
	constructor(context: vscode.ExtensionContext, pharoImagesClients: Array<LanguageClient>) {
		const pharoDataProvider = new PharoImagesProvider(pharoImagesClients);
		vscode.window.createTreeView('images', { treeDataProvider: pharoDataProvider });
	}

}