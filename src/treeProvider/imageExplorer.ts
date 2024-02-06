import * as vscode from 'vscode';
import { client } from '../extension';

export interface PharoNode {
	name: string;
	resource: vscode.Uri;
	isDirectory: boolean;
}

export class PharoDataProvider implements vscode.TreeDataProvider<PharoNode>, vscode.FileSystemProvider {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

	constructor() { }

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		throw new Error('Method not implemented.');
	}
	stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
		return { ctime: 0, mtime: 0, size: 100, type: vscode.FileType.File };
	}
	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		throw new Error('Method not implemented.');
	}
	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
		return client.sendRequest("pls:classContent", { class: uri.path }).then((result: string) => Buffer.from(result));
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
		// This is already done by the Pharo Language Server
	}

	delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}
	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}
	copy?(source: vscode.Uri, destination: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}

	public refresh(): any {
		this._onDidChangeTreeData.fire(undefined);
	}


	public getTreeItem(element: PharoNode): vscode.TreeItem {
		return {
			resourceUri: element.resource,
			collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
			command: element.isDirectory ? void 0 : {
				command: 'vscode.open',
				arguments: [element.resource],
				title: 'Open Pharo Class'
			}
		};
	}

	public getChildren(element?: PharoNode): PharoNode[] | Thenable<PharoNode[]> {
		if (element === undefined) {
			return client.sendRequest('pls:packages', {}).then((result: Array<string>) => {
				return result.sort().map((item) => { return { name: item, resource: vscode.Uri.parse('pharoImage:/' + item, true), isDirectory: true }; });
			});
		}
		return client.sendRequest('pls:classes', { package: element.name }).then((result: Array<string>) => {
			return result.sort().map((item) => {
				return {
					name: item,
					resource: vscode.Uri.parse('pharoImage:/' + item, true),
					isDirectory: false
				};
			});
		});
	}

}

export class PharoImageExplorer {
	constructor(context: vscode.ExtensionContext) {
		const pharoDataProvider = new PharoDataProvider();
		vscode.window.createTreeView('pharoImage', { treeDataProvider: pharoDataProvider });
		// context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('pharoImage', pharoDataProvider));
		context.subscriptions.push(vscode.workspace.registerFileSystemProvider('pharoImage', pharoDataProvider, { isCaseSensitive: true }));
	}

}