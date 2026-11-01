import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseJsoncObject } from '../jsonc';
import { isExplicitlySet } from '../requirements';
import { LauncherImage, LauncherLocations, findImages, pharoVersionLabel, readLauncherLocations } from '../pharoLauncher';

type WorkspaceDescriptor =
	| { kind: 'workspaceFile'; uri: vscode.Uri }
	| { kind: 'folderSettings'; uri: vscode.Uri };

export type PharoImagesNode = {
	kind: 'image';
	label: string;
	imageUri: vscode.Uri;
	folderUri: vscode.Uri;
	workspace?: WorkspaceDescriptor;
	image: LauncherImage;
};

async function uriExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch (error) {
		if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
			return false;
		}
		throw error;
	}
}

function normalizeFsPath(fsPath: string): string {
	return path.normalize(path.resolve(fsPath));
}

async function readJsoncFile(fileUri: vscode.Uri): Promise<Record<string, unknown>> {
	const raw = await vscode.workspace.fs.readFile(fileUri);
	return parseJsoncObject(Buffer.from(raw).toString('utf8'), fileUri.fsPath);
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
		const json = await readJsoncFile(workspaceFileUri);
		const settings = json.settings;
		const configured = settings && typeof settings === 'object' && !Array.isArray(settings)
			? (settings as Record<string, unknown>)['pharo.pathToImage']
			: undefined;
		if (typeof configured === 'string' && normalizeFsPath(configured) === normalizedImagePath) {
			return { kind: 'workspaceFile', uri: workspaceFileUri };
		}
	}

	const vscodeSettingsUri = vscode.Uri.joinPath(folderUri, '.vscode', 'settings.json');
	if (await uriExists(vscodeSettingsUri)) {
		const json = await readJsoncFile(vscodeSettingsUri);
		const configured = json['pharo.pathToImage'];
		if (typeof configured === 'string' && normalizeFsPath(configured) === normalizedImagePath) {
			return { kind: 'folderSettings', uri: folderUri };
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

	const currentPharoConfig = vscode.workspace.getConfiguration('pharo');
	// A VM left to its default is resolved for each image from Pharo Launcher, so it is not copied
	const pathToVM = isExplicitlySet(currentPharoConfig.inspect<string>('pathToVM'))
		? currentPharoConfig.get<string>('pathToVM')
		: undefined;
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
	const content = JSON.stringify(workspaceJson, null, 2) + '\n';
	for (const name of candidateNames) {
		const uri = vscode.Uri.file(path.join(folderPath, name));
		if (await uriExists(uri)) {
			continue;
		}
		try {
			await fs.promises.writeFile(uri.fsPath, content, { encoding: 'utf8', flag: 'wx' });
			return uri;
		} catch (error) {
			if (isAlreadyExistsError(error)) {
				continue;
			}
			throw error;
		}
	}

	for (let suffix = Date.now(); ; suffix++) {
		const uri = vscode.Uri.file(path.join(folderPath, `${base}-${suffix}.code-workspace`));
		try {
			await fs.promises.writeFile(uri.fsPath, content, { encoding: 'utf8', flag: 'wx' });
			return uri;
		} catch (error) {
			if (!isAlreadyExistsError(error)) {
				throw error;
			}
		}
	}
}

function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function activeImagePath(): string | undefined {
	const configured = vscode.workspace.getConfiguration('pharo').get<string>('pathToImage', '').trim();
	return configured ? normalizeFsPath(configured) : undefined;
}

function imageTooltip(node: PharoImagesNode, active: boolean): vscode.MarkdownString {
	const metadata = node.image.metadata;
	const version = pharoVersionLabel(metadata?.pharoVersion);
	const lines = [`**${node.label}**${active ? ' — active in this window' : ''}`, ''];
	const addLine = (label: string, value: string | undefined) => {
		if (value) {
			lines.push(`${label}: ${value}  `);
		}
	};
	addLine('Pharo', version && metadata?.architecture ? `${version} (${metadata.architecture} bits)` : version);
	addLine('Template', metadata?.template);
	addLine('VM', metadata?.vmId);
	addLine('Last saved', new Date(node.image.lastModified).toLocaleString());
	addLine('Workspace', node.workspace
		? (node.workspace.kind === 'workspaceFile' ? path.basename(node.workspace.uri.fsPath) : 'folder settings')
		: 'none');
	addLine('Path', node.imageUri.fsPath);
	if (metadata?.description) {
		lines.push('', metadata.description);
	}
	const tooltip = new vscode.MarkdownString(lines.join('\n'));
	tooltip.supportHtml = false;
	return tooltip;
}

export class PharoImagesProvider implements vscode.TreeDataProvider<PharoImagesNode> {
	private readonly didChangeTreeDataEmitter = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData: vscode.Event<void> = this.didChangeTreeDataEmitter.event;
	/** The locations of the last listing, to describe the view. */
	locations: LauncherLocations | undefined;

	constructor(private readonly onListed: (locations: LauncherLocations, count: number) => void = () => undefined) {}

	refresh(): void {
		this.didChangeTreeDataEmitter.fire();
	}

	dispose(): void {
		this.didChangeTreeDataEmitter.dispose();
	}

	getTreeItem(element: PharoImagesNode): vscode.TreeItem {
		const active = activeImagePath() === normalizeFsPath(element.imageUri.fsPath);
		const metadata = element.image.metadata;
		const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
		item.id = element.imageUri.fsPath;
		item.iconPath = active
			? new vscode.ThemeIcon('vm-running', new vscode.ThemeColor('charts.green'))
			: new vscode.ThemeIcon('vm');
		item.contextValue = active ? 'pharoImages.image.active' : 'pharoImages.image';
		item.description = [
			active ? 'active' : undefined,
			pharoVersionLabel(metadata?.pharoVersion) && `Pharo ${pharoVersionLabel(metadata?.pharoVersion)}`,
			metadata?.template
		].filter(Boolean).join(' · ');
		item.tooltip = imageTooltip(element, active);
		return item;
	}

	async getChildren(element?: PharoImagesNode): Promise<PharoImagesNode[]> {
		if (element) {
			return [];
		}
		const locations = await readLauncherLocations();
		this.locations = locations;
		const images = await findImages(locations);
		const nodes = await Promise.all(images.map(async (image): Promise<PharoImagesNode> => {
			const imageUri = vscode.Uri.file(image.imagePath);
			let workspace: WorkspaceDescriptor | undefined;
			try {
				workspace = await resolveWorkspaceForImage(imageUri);
			} catch {
				// An unreadable workspace file does not hide the image
			}
			return {
				kind: 'image',
				label: image.label,
				imageUri,
				folderUri: vscode.Uri.file(path.dirname(image.imagePath)),
				workspace,
				image
			};
		}));
		this.onListed(locations, nodes.length);
		return nodes;
	}
}

export class PharoImagesExplorer {
	private readonly provider: PharoImagesProvider;
	private readonly view: vscode.TreeView<PharoImagesNode>;

	constructor(context: vscode.ExtensionContext) {
		this.provider = new PharoImagesProvider((locations, count) => this.describe(locations, count));
		this.view = vscode.window.createTreeView('images', { treeDataProvider: this.provider });
		context.subscriptions.push(this, vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('pharo.pathToImage')) {
				this.refresh();
			}
		}));
	}

	refresh(): void {
		this.provider.refresh();
	}

	dispose(): void {
		this.view.dispose();
		this.provider.dispose();
	}

	/** The folder the images are listed from, the one Pharo Launcher uses when it is installed. */
	async imagesDirectory(): Promise<string> {
		return (this.provider.locations ?? await readLauncherLocations()).imagesDirectory;
	}

	private describe(locations: LauncherLocations, count: number): void {
		this.view.description = locations.settingsFile ? 'Pharo Launcher' : undefined;
		this.view.message = count === 0
			? `No Pharo image in ${locations.imagesDirectory}. Download one with the toolbar.`
			: undefined;
	}

	async play(node?: PharoImagesNode): Promise<void> {
		if (!node) {
			return;
		}

		const existing = await resolveWorkspaceForImage(node.imageUri);
		if (existing) {
			await vscode.commands.executeCommand('vscode.openFolder', existing.uri, true);
			return;
		}

		const createdWorkspaceUri = await createWorkspaceForImage(node.imageUri);
		await vscode.commands.executeCommand('vscode.openFolder', createdWorkspaceUri, true);
	}
}
