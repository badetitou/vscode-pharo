import * as vscode from 'vscode';
import { client } from '../extension';

export interface PharoNode {
	name: string;
	resource: vscode.Uri;
	isDirectory: boolean;
}

const CLASS_FILE_SUFFIX = '.class.st';
const PACKAGES_CACHE_TTL_MS = 2000;
const CLASSES_CACHE_TTL_MS = 2000;

export class PharoDataProvider implements vscode.TreeDataProvider<PharoNode>, vscode.FileSystemProvider {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

	constructor() { }

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;
	private requestQueue: Promise<void> = Promise.resolve();
	private packagesCache?: { values: string[]; loadedAt: number };
	private packagesInFlight?: Promise<Array<string>>;
	private classesCache = new Map<string, { values: string[]; loadedAt: number }>();
	private classesInFlight = new Map<string, Promise<Array<string>>>();

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		return new vscode.Disposable(() => undefined);
	}
	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		const segments = this.getPathSegments(uri);
		if (segments.length === 0) {
			return this.directoryStat();
		}

		if (segments.length === 1) {
			if (this.isCachedPackageName(segments[0])) {
				return this.directoryStat();
			}
			// Compatibility with existing URIs such as pharoImage:/ClassName.
			return this.fileStat();
		}

		if (segments.length === 2) {
			return this.fileStat();
		}

		throw vscode.FileSystemError.FileNotFound(uri);
	}
	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const segments = this.getPathSegments(uri);
		if (segments.length === 0) {
			const packages = await this.getPackages();
			return packages.sort().map((item) => [item, vscode.FileType.Directory]);
		}

		if (segments.length === 1) {
			const packageName = segments[0];
			const classes = await this.getClasses(packageName);
			return classes
				.sort()
				.map((item) => [this.toClassFilename(item), vscode.FileType.File]);
		}

		throw vscode.FileSystemError.FileNotADirectory(uri);
	}
	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		throw vscode.FileSystemError.NoPermissions(uri);
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const segments = this.getPathSegments(uri);
		if (segments.length === 0) {
			throw vscode.FileSystemError.FileIsADirectory(uri);
		}

		if (segments.length === 1) {
			const packages = await this.getPackages();
			if (packages.includes(segments[0])) {
				throw vscode.FileSystemError.FileIsADirectory(uri);
			}
		}

		if (this.isIceOriginalUri(uri)) {
			return this.sendRequestSerialized<string>('pls-ice:originalContent', { uri: uri.toString() }).then((result: string) => Buffer.from(result));
		}

		const className = this.toClassName(segments[segments.length - 1]);
		return this.sendRequestSerialized<string>('pls:classContent', { class: className }).then((result: string) => Buffer.from(result));
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
		// This is already done by the Pharo Language Server
	}

	delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
		throw vscode.FileSystemError.NoPermissions(uri);
	}
	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		throw vscode.FileSystemError.NoPermissions(oldUri);
	}
	copy?(source: vscode.Uri, destination: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		throw vscode.FileSystemError.NoPermissions(source);
	}

	public refresh(): any {
		this.packagesCache = undefined;
		this.packagesInFlight = undefined;
		this.classesCache.clear();
		this.classesInFlight.clear();
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
			return this.getPackages().then((result: Array<string>) => {
				return result.sort().map((item) => { return { name: item, resource: this.packageUri(item), isDirectory: true }; });
			});
		}
		return this.getClasses(element.name).then((result: Array<string>) => {
			return result.sort().map((item) => {
				return {
					name: item,
					resource: this.classUri(element.name, item),
					isDirectory: false
				};
			});
		});
	}

	private getPackages(): Promise<Array<string>> {
		if (!this.isClientReady()) {
			return Promise.resolve([]);
		}

		const now = Date.now();
		if (this.packagesCache && now - this.packagesCache.loadedAt < PACKAGES_CACHE_TTL_MS) {
			return Promise.resolve(this.packagesCache.values);
		}

		if (this.packagesInFlight) {
			return this.packagesInFlight;
		}

		this.packagesInFlight = this.sendRequestSerialized<Array<string>>('pls:packages', {}).then((result) => {
			this.packagesCache = { values: result, loadedAt: Date.now() };
			return result;
		}).finally(() => {
			this.packagesInFlight = undefined;
		});
		return this.packagesInFlight;
	}

	private getClasses(packageName: string): Promise<Array<string>> {
		if (!this.isClientReady()) {
			return Promise.resolve([]);
		}

		const now = Date.now();
		const cached = this.classesCache.get(packageName);
		if (cached && now - cached.loadedAt < CLASSES_CACHE_TTL_MS) {
			return Promise.resolve(cached.values);
		}

		const inFlight = this.classesInFlight.get(packageName);
		if (inFlight) {
			return inFlight;
		}

		const request = this.sendRequestSerialized<Array<string>>('pls:classes', { package: packageName }).then((result) => {
			this.classesCache.set(packageName, { values: result, loadedAt: Date.now() });
			return result;
		}).finally(() => {
			this.classesInFlight.delete(packageName);
		});
		this.classesInFlight.set(packageName, request);
		return request;
	}

	private getPathSegments(uri: vscode.Uri): string[] {
		return uri.path.split('/').filter((segment) => segment.length > 0).map((segment) => decodeURIComponent(segment));
	}

	private toClassName(pathSegment: string): string {
		if (pathSegment.endsWith(CLASS_FILE_SUFFIX)) {
			return pathSegment.substring(0, pathSegment.length - CLASS_FILE_SUFFIX.length);
		}
		if (pathSegment.endsWith('.st')) {
			return pathSegment.substring(0, pathSegment.length - 3);
		}
		return pathSegment;
	}

	private toClassFilename(className: string): string {
		return `${this.toClassName(className)}${CLASS_FILE_SUFFIX}`;
	}

	private isCachedPackageName(name: string): boolean {
		return this.packagesCache !== undefined && this.packagesCache.values.includes(name);
	}

	private isClientReady(): boolean {
		return client !== undefined && client.isRunning();
	}

	private isIceOriginalUri(uri: vscode.Uri): boolean {
		if (!uri.query) {
			return false;
		}
		const query = new URLSearchParams(uri.query);
		return query.get('iceOriginal') === '1';
	}

	private sendRequestSerialized<T>(method: string, params: unknown): Promise<T> {
		if (!this.isClientReady()) {
			return Promise.reject(vscode.FileSystemError.Unavailable('Pharo language server is not running.'));
		}

		const run = this.requestQueue.then(() => client.sendRequest(method, params) as Promise<T>);
		this.requestQueue = run.then(() => undefined, () => undefined);
		return run;
	}

	private packageUri(packageName: string): vscode.Uri {
		return vscode.Uri.from({ scheme: 'pharoImage', path: `/${packageName}` });
	}

	private classUri(packageName: string, className: string): vscode.Uri {
		return vscode.Uri.from({ scheme: 'pharoImage', path: `/${packageName}/${this.toClassFilename(className)}` });
	}

	private directoryStat(): vscode.FileStat {
		const now = Date.now();
		return { ctime: now, mtime: now, size: 0, type: vscode.FileType.Directory };
	}

	private fileStat(): vscode.FileStat {
		const now = Date.now();
		return { ctime: now, mtime: now, size: 0, type: vscode.FileType.File };
	}
}

export class PharoImageExplorer {
	private readonly pharoDataProvider: PharoDataProvider;

	constructor(context: vscode.ExtensionContext) {
		this.pharoDataProvider = new PharoDataProvider();
		vscode.window.createTreeView('pharoImage', { treeDataProvider: this.pharoDataProvider });
		// context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('pharoImage', pharoDataProvider));
		context.subscriptions.push(vscode.workspace.registerFileSystemProvider('pharoImage', this.pharoDataProvider, { isCaseSensitive: true }));
	}

	public refresh(): void {
		this.pharoDataProvider.refresh();
	}

}
