import * as vscode from 'vscode';
import { client } from '../extension';

export interface PharoNode {
	name: string;
	resource: vscode.Uri;
	isDirectory: boolean;
}

export class PharoBindingProvider implements vscode.TreeDataProvider<PharoNode> {

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
		return []
	}

}

export class PharoImageExplorer {
	constructor(context: vscode.ExtensionContext) {
		const pharoBindingProvider = new PharoBindingProvider();
		vscode.window.createTreeView('pharoBindingView', { treeDataProvider: pharoBindingProvider });

	}

	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource);
	}
}