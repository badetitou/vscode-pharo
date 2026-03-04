import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

type WorkspaceDescriptor =
	| { kind: 'workspaceFile'; uri: vscode.Uri }
	| { kind: 'folderSettings'; uri: vscode.Uri };

export type PharoImagesNode =
	| { kind: 'folder'; label: string; uri: vscode.Uri }
	| { kind: 'image'; label: string; imageUri: vscode.Uri; folderUri: vscode.Uri; workspace?: WorkspaceDescriptor };

function defaultPharoImagesFolderUri(): vscode.Uri {
	return vscode.Uri.file(path.join(os.homedir(), 'Documents', 'Pharo', 'images'));
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

function normalizeFsPath(fsPath: string): string {
	return path.normalize(path.resolve(fsPath));
}

async function tryParseWorkspaceFile(workspaceFileUri: vscode.Uri): Promise<any | undefined> {
	try {
		const raw = await vscode.workspace.fs.readFile(workspaceFileUri);
		const text = Buffer.from(raw).toString('utf8');
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

async function resolveWorkspaceForImage(imageUri: vscode.Uri): Promise<WorkspaceDescriptor | undefined> {
	const folderUri = vscode.Uri.file(path.dirname(imageUri.fsPath));
	let entries: Array<[string, vscode.FileType]> = [];
	try {
		entries = await vscode.workspace.fs.readDirectory(folderUri);
	} catch {
		return undefined;
	}

	const normalizedImagePath = normalizeFsPath(imageUri.fsPath);
	const workspaceFiles = entries
		.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.code-workspace'))
		.map(([name]) => vscode.Uri.joinPath(folderUri, name));

	for (const workspaceFileUri of workspaceFiles) {
		const json = await tryParseWorkspaceFile(workspaceFileUri);
		const configured = json?.settings?.['pharo.pathToImage'];
		if (typeof configured === 'string' && normalizeFsPath(configured) === normalizedImagePath) {
			return { kind: 'workspaceFile', uri: workspaceFileUri };
		}
	}

	const vscodeSettingsUri = vscode.Uri.joinPath(folderUri, '.vscode', 'settings.json');
	if (await uriExists(vscodeSettingsUri)) {
		try {
			const raw = await vscode.workspace.fs.readFile(vscodeSettingsUri);
			const text = Buffer.from(raw).toString('utf8');
			const json = JSON.parse(text);
			const configured = json?.['pharo.pathToImage'];
			if (typeof configured === 'string' && normalizeFsPath(configured) === normalizedImagePath) {
				return { kind: 'folderSettings', uri: folderUri };
			}
		} catch {
			// ignore malformed settings
		}
	}

	return undefined;
}

export async function createWorkspaceForImage(imageUri: vscode.Uri): Promise<vscode.Uri> {
	const folderPath = path.dirname(imageUri.fsPath);
	const base = path.basename(imageUri.fsPath, '.image');
	const candidateNames = [
		`${base}.code-workspace`,
		`${base}-pharo.code-workspace`,
		`pharo-${base}.code-workspace`,
		`pharo.code-workspace`
	];

	let chosenUri: vscode.Uri | undefined;
	for (const name of candidateNames) {
		const uri = vscode.Uri.file(path.join(folderPath, name));
		if (!(await uriExists(uri))) {
			chosenUri = uri;
			break;
		}
	}

	if (!chosenUri) {
		chosenUri = vscode.Uri.file(path.join(folderPath, `${base}-${Date.now()}.code-workspace`));
	}

	const currentPharoConfig = vscode.workspace.getConfiguration('pharo');
	const pathToVM = currentPharoConfig.get<string>('pathToVM');
	const headless = currentPharoConfig.get<boolean>('headless');

	const settings: Record<string, unknown> = {
		'pharo.pathToImage': imageUri.fsPath
	};
	if (typeof pathToVM === 'string' && pathToVM.trim().length > 0) {
		settings['pharo.pathToVM'] = pathToVM;
	}
	if (typeof headless === 'boolean') {
		settings['pharo.headless'] = headless;
	}

	const workspaceJson = {
		folders: [{ path: '.' }],
		settings
	};

	await vscode.workspace.fs.writeFile(
		chosenUri,
		Buffer.from(JSON.stringify(workspaceJson, null, 2) + '\n', 'utf8')
	);

	return chosenUri;
}

export class PharoImagesProvider implements vscode.TreeDataProvider<PharoImagesNode> {
	private readonly didChangeTreeDataEmitter = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData: vscode.Event<void> = this.didChangeTreeDataEmitter.event;

	refresh(): void {
		this.didChangeTreeDataEmitter.fire();
	}

	getTreeItem(element: PharoImagesNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
		if (element.kind === 'folder') {
			const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
			item.iconPath = new vscode.ThemeIcon('folder');
			item.contextValue = 'pharoImages.folder';
			item.tooltip = element.uri.fsPath;
			return item;
		}

		const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
		item.iconPath = new vscode.ThemeIcon('file-binary');
		item.contextValue = 'pharoImages.image';
		item.tooltip = element.imageUri.fsPath;
		item.description = element.workspace
			? (element.workspace.kind === 'workspaceFile' ? 'workspace' : 'dossier configuré')
			: 'pas de workspace';
		item.command = {
			command: 'pharo.images.play',
			title: 'Ouvrir le workspace Pharo',
			arguments: [element]
		};
		return item;
	}

	async getChildren(element?: PharoImagesNode): Promise<PharoImagesNode[]> {
		if (element?.kind === 'image') {
			return [];
		}

		if (element?.kind === 'folder') {
			let entries: Array<[string, vscode.FileType]> = [];
			try {
				entries = await vscode.workspace.fs.readDirectory(element.uri);
			} catch {
				return [];
			}

			const images = entries
				.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.image'))
				.map(([name]) => vscode.Uri.joinPath(element.uri, name));

			const nodes = await Promise.all(images.map(async (imageUri) => {
				const label = path.basename(imageUri.fsPath, '.image');
				const workspace = await resolveWorkspaceForImage(imageUri);
				return { kind: 'image', label, imageUri, folderUri: element.uri, workspace } as PharoImagesNode;
			}));

			return nodes.sort((a, b) => a.kind === 'image' && b.kind === 'image'
				? a.label.localeCompare(b.label)
				: 0
			);
		}

		const rootUri = defaultPharoImagesFolderUri();
		if (!(await uriExists(rootUri))) {
			return [];
		}

		let entries: Array<[string, vscode.FileType]> = [];
		try {
			entries = await vscode.workspace.fs.readDirectory(rootUri);
		} catch {
			return [];
		}

		const directImages = entries
			.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.image'))
			.map(([name]) => vscode.Uri.joinPath(rootUri, name));

		const directories = entries
			.filter(([_, type]) => type === vscode.FileType.Directory)
			.map(([name]) => ({ name, uri: vscode.Uri.joinPath(rootUri, name) }));

		const folderNodes: PharoImagesNode[] = [];
		for (const dir of directories) {
			try {
				const subEntries = await vscode.workspace.fs.readDirectory(dir.uri);
				const hasImage = subEntries.some(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.image'));
				if (hasImage) {
					folderNodes.push({ kind: 'folder', label: dir.name, uri: dir.uri });
				}
			} catch {
				// ignore unreadable subdirs
			}
		}

		const directImageNodes = await Promise.all(directImages.map(async (imageUri) => {
			const label = path.basename(imageUri.fsPath, '.image');
			const folderUri = rootUri;
			const workspace = await resolveWorkspaceForImage(imageUri);
			return { kind: 'image', label, imageUri, folderUri, workspace } as PharoImagesNode;
		}));

		return [
			...folderNodes.sort((a, b) => (a.kind === 'folder' && b.kind === 'folder') ? a.label.localeCompare(b.label) : 0),
			...directImageNodes.sort((a, b) => (a.kind === 'image' && b.kind === 'image') ? a.label.localeCompare(b.label) : 0)
		];
	}
}

export class PharoImagesExplorer {
	private readonly provider: PharoImagesProvider;
	private readonly view: vscode.TreeView<PharoImagesNode>;

	constructor(_context: vscode.ExtensionContext) {
		this.provider = new PharoImagesProvider();
		this.view = vscode.window.createTreeView('images', { treeDataProvider: this.provider });
	}

	refresh(): void {
		this.provider.refresh();
	}

	async play(node?: PharoImagesNode): Promise<void> {
		if (!node || node.kind !== 'image') {
			return;
		}

		const existing = await resolveWorkspaceForImage(node.imageUri);
		if (existing?.kind === 'workspaceFile') {
			await vscode.commands.executeCommand('vscode.openFolder', existing.uri, true);
			return;
		}
		if (existing?.kind === 'folderSettings') {
			await vscode.commands.executeCommand('vscode.openFolder', existing.uri, true);
			return;
		}

		const createdWorkspaceUri = await createWorkspaceForImage(node.imageUri);
		await vscode.commands.executeCommand('vscode.openFolder', createdWorkspaceUri, true);
	}
}