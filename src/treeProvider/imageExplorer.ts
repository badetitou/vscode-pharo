import * as vscode from 'vscode';
import { client } from '../extension';
import { buildPharoUri, ICE_REPOSITORY_QUERY_KEY, repositoryNameFromPharoUri } from './pharoUri';
import { expectStringArray, isMethodNotFoundError } from '../rpcContracts';

export interface PharoNode {
	name: string;
	resource: vscode.Uri;
	isDirectory: boolean;
	repositoryName?: string;
}

const PHARO_IMAGE_ROOT_URI = vscode.Uri.parse('pharoImage:/');
const CLASS_FILE_SUFFIX = '.class.st';
const PACKAGES_CACHE_TTL_MS = 2000;
const CLASSES_CACHE_TTL_MS = 2000;
export class PharoDataProvider implements vscode.TreeDataProvider<PharoNode>, vscode.FileSystemProvider {

	private readonly _onDidChangeTreeData = new vscode.EventEmitter<PharoNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<PharoNode | undefined> = this._onDidChangeTreeData.event;

	private readonly saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.uri.scheme === 'pharoImage' && document.languageId === 'pharo') {
			this.refresh(document.uri);
		}
	});

	constructor(
		sendRequest: (method: string, params: unknown) => Promise<unknown> = (method, params) => client.sendRequest(method, params),
		clientReady: () => boolean = () => client !== undefined && client.isRunning()
	) {
		this.sendRequest = sendRequest;
		this.clientReady = clientReady;
	}

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;
	private requestQueue: Promise<void> = Promise.resolve();
	private packagesCache?: { values: string[]; loadedAt: number };
	private packagesInFlight?: Promise<Array<string>>;
	private repositoryPackagesCache = new Map<string, { values: string[]; loadedAt: number }>();
	private repositoryPackagesInFlight = new Map<string, Promise<Array<string>>>();
	private classesCache = new Map<string, { values: string[]; loadedAt: number }>();
	private classesInFlight = new Map<string, Promise<Array<string>>>();
	private cacheGeneration = 0;
	private readonly sendRequest: (method: string, params: unknown) => Promise<unknown>;
	private readonly clientReady: () => boolean;

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		return new vscode.Disposable(() => undefined);
	}
	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		const segments = this.getPathSegments(uri);
		const repositoryName = this.repositoryNameFrom(uri);
		if (segments.length === 0) {
			return this.directoryStat();
		}

		if (segments.length === 1) {
			if (await this.hasPackageName(segments[0], repositoryName)) {
				return this.directoryStat();
			}
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		if (segments.length === 2) {
			const packageName = segments[0];
			const className = this.toClassName(segments[1]);
			if (!await this.hasPackageName(packageName, repositoryName)
				|| !await this.hasClassName(packageName, className)) {
				throw vscode.FileSystemError.FileNotFound(uri);
			}
			return this.fileStat();
		}

		throw vscode.FileSystemError.FileNotFound(uri);
	}
	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const segments = this.getPathSegments(uri);
		const repositoryName = this.repositoryNameFrom(uri);
		if (segments.length === 0) {
			const packages = await this.getPackages(repositoryName);
			return packages.sort().map((item) => [item, vscode.FileType.Directory]);
		}

		if (segments.length === 1) {
			const packageName = segments[0];
			if (!await this.hasPackageName(packageName, repositoryName)) {
				throw vscode.FileSystemError.FileNotFound(uri);
			}
			const classes = await this.getClasses(packageName);
			return classes
				.sort()
				.map((item) => [this.toClassFilename(item), vscode.FileType.File]);
		}

		throw vscode.FileSystemError.FileNotADirectory(uri);
	}
	async createDirectory(uri: vscode.Uri): Promise<void> {
		const segments = this.getPathSegments(uri);
		if (segments.length !== 1) {
			throw vscode.FileSystemError.NoPermissions('Pharo supports package folders only at the root level.');
		}

		const packageName = segments[0].trim();
		if (!packageName) {
			throw vscode.FileSystemError.NoPermissions('Package name cannot be empty.');
		}

		await this.createPackageForUri(packageName, uri);
		this.refresh();
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const segments = this.getPathSegments(uri);
		const repositoryName = this.repositoryNameFrom(uri);
		if (segments.length === 0) {
			throw vscode.FileSystemError.FileIsADirectory(uri);
		}

		if (segments.length === 1) {
			if (await this.hasPackageName(segments[0], repositoryName)) {
				throw vscode.FileSystemError.FileIsADirectory(uri);
			}
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		if (segments.length !== 2) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		const packageName = segments[0];
		const className = this.toClassName(segments[1]);
		if (!await this.hasPackageName(packageName, repositoryName)
			|| !await this.hasClassName(packageName, className)) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		if (this.isIceOriginalUri(uri)) {
			return this.sendRequestSerialized<string>('pls-ice:originalContent', { uri: uri.toString(true) })
			.then((result: string) => Buffer.from(result));
		}

		return this.sendRequestSerialized<string>('pls:classContent', { class: className }).then((result: string) => Buffer.from(result));
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
		if (!options.create) {
			// Class content updates are handled by textDocument/didSave in the language server.
			return;
		}

		const segments = this.getPathSegments(uri);
		if (segments.length !== 2) {
			throw vscode.FileSystemError.NoPermissions('Create files inside a package folder (Package/Class.class.st).');
		}

		const packageName = segments[0].trim();
		const className = this.toClassName(segments[1]).trim();
		if (!packageName || !className) {
			throw vscode.FileSystemError.NoPermissions('Package and class names are required.');
		}

		await this.createPackageForUri(packageName, uri);
		await this.sendRequestSerialized('pls:createClass', {
			packageName,
			className,
			superclassName: 'Object',
			instanceVariables: ''
		});
		this.refresh();
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

	public refresh(changedUri: vscode.Uri = PHARO_IMAGE_ROOT_URI): void {
		this.cacheGeneration++;
		const changedFiles: vscode.FileChangeEvent[] = [
			{ type: vscode.FileChangeType.Changed, uri: PHARO_IMAGE_ROOT_URI },
			{ type: vscode.FileChangeType.Changed, uri: changedUri }
		];
		const packageSegments = this.getPathSegments(changedUri);
		if (packageSegments.length > 0) {
			changedFiles.push({
				type: vscode.FileChangeType.Changed,
				uri: this.packageUri(packageSegments[0], this.repositoryNameFrom(changedUri))
			});
		}
		this.packagesCache = undefined;
		this.packagesInFlight = undefined;
		this.repositoryPackagesCache.clear();
		this.repositoryPackagesInFlight.clear();
		this.classesCache.clear();
		this.classesInFlight.clear();
		this._onDidChangeTreeData.fire(undefined);
		this._emitter.fire(changedFiles);
	}

	dispose(): void {
		this.saveListener.dispose();
		this._onDidChangeTreeData.dispose();
		this._emitter.dispose();
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
		const repositoryName = element.repositoryName ?? this.repositoryNameFrom(element.resource);
		return this.getClasses(element.name).then((result: Array<string>) => {
			return result.sort().map((item) => {
				let name = this.toClassName(item.split('/').slice(-1)[0]);
				return {
					name: name,
					resource: this.classUri(element.name, name, repositoryName),
					isDirectory: false,
					repositoryName
				};
			});
		});
	}

	private getPackages(repositoryName?: string): Promise<Array<string>> {
		if (!this.isClientReady()) {
			return Promise.reject(vscode.FileSystemError.Unavailable('Pharo language server is not running.'));
		}

		if (repositoryName) {
			return this.getPackagesForRepository(repositoryName);
		}

		const now = Date.now();
		if (this.packagesCache && now - this.packagesCache.loadedAt < PACKAGES_CACHE_TTL_MS) {
			return Promise.resolve(this.packagesCache.values);
		}

		if (this.packagesInFlight) {
			return this.packagesInFlight;
		}

		const generation = this.cacheGeneration;
		const request = this.sendRequestSerialized<unknown>('pls:packages', {}).then((result) => {
			const packages = expectStringArray(result, 'pls:packages');
			if (generation === this.cacheGeneration) {
				this.packagesCache = { values: packages, loadedAt: Date.now() };
			}
			return packages;
		}).finally(() => {
			if (this.packagesInFlight === request) {
				this.packagesInFlight = undefined;
			}
		});
		this.packagesInFlight = request;
		return request;
	}

	private getPackagesForRepository(repositoryName: string): Promise<Array<string>> {
		const now = Date.now();
		const cached = this.repositoryPackagesCache.get(repositoryName);
		if (cached && now - cached.loadedAt < PACKAGES_CACHE_TTL_MS) {
			return Promise.resolve(cached.values);
		}

		const inFlight = this.repositoryPackagesInFlight.get(repositoryName);
		if (inFlight) {
			return inFlight;
		}

		const generation = this.cacheGeneration;
		const request = this.sendRequestSerialized<unknown>('pls-ice:repositoryPackages', { aRepositoryName: repositoryName }).then((result) => {
			const packages = expectStringArray(result, 'pls-ice:repositoryPackages');
			if (generation === this.cacheGeneration) {
				this.repositoryPackagesCache.set(repositoryName, { values: packages, loadedAt: Date.now() });
			}
			return packages;
		}).catch((error: unknown) => {
			if (!isMethodNotFoundError(error)) {
				throw error;
			}
			return this.getPackages();
		}).finally(() => {
			if (this.repositoryPackagesInFlight.get(repositoryName) === request) {
				this.repositoryPackagesInFlight.delete(repositoryName);
			}
		});
		this.repositoryPackagesInFlight.set(repositoryName, request);
		return request;
	}

	private getClasses(packageName: string): Promise<Array<string>> {
		if (!this.isClientReady()) {
			return Promise.reject(vscode.FileSystemError.Unavailable('Pharo language server is not running.'));
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

		const generation = this.cacheGeneration;
		const request = this.sendRequestSerialized<unknown>('pls:classes', { package: packageName }).then((result) => {
			const classes = expectStringArray(result, 'pls:classes');
			if (generation === this.cacheGeneration) {
				this.classesCache.set(packageName, { values: classes, loadedAt: Date.now() });
			}
			return classes;
		}).finally(() => {
			if (this.classesInFlight.get(packageName) === request) {
				this.classesInFlight.delete(packageName);
			}
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

	private async hasPackageName(name: string, repositoryName?: string): Promise<boolean> {
		if (!repositoryName && this.isCachedPackageName(name)) {
			return true;
		}
		const packages = await this.getPackages(repositoryName);
		return packages.includes(name);
	}

	private isClientReady(): boolean {
		return this.clientReady();
	}

	private isIceOriginalUri(uri: vscode.Uri): boolean {
		if (!uri.query) {
			return false;
		}
		const query = new URLSearchParams(uri.query);
		return query.get('iceOriginal') === '1';
	}

	private repositoryNameFrom(uri: vscode.Uri): string | undefined {
		return repositoryNameFromPharoUri(uri);
	}

	private async createPackageForUri(packageName: string, uri: vscode.Uri): Promise<void> {
		await this.sendRequestSerialized('pls:createPackage', { packageName });
		const repositoryName = this.repositoryNameFrom(uri);
		if (!repositoryName) {
			return;
		}

		await this.sendRequestSerialized('pls-ice:addPackage', {
			aRepositoryName: repositoryName,
			packageName
		});
	}

	private sendRequestSerialized<T>(method: string, params: unknown): Promise<T> {
		if (!this.isClientReady()) {
			return Promise.reject(vscode.FileSystemError.Unavailable('Pharo language server is not running.'));
		}

		const run = this.requestQueue.then(() => this.sendRequest(method, params) as Promise<T>);
		this.requestQueue = run.then(() => undefined, () => undefined);
		return run;
	}

	private packageUri(packageName: string, repositoryName?: string): vscode.Uri {
		return this.pharoUri(`/${packageName}`, repositoryName);
	}

	private async hasClassName(packageName: string, className: string): Promise<boolean> {
		const classes = await this.getClasses(packageName);
		return classes.some((value) => this.toClassName(value.split('/').pop() ?? '') === className);
	}

	private classUri(packageName: string, className: string, repositoryName?: string): vscode.Uri {
		return this.pharoUri(`/${packageName}/${this.toClassFilename(className)}`, repositoryName);
	}

	private pharoUri(path: string, repositoryName?: string): vscode.Uri {
		return buildPharoUri(path, repositoryName);
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
	private readonly treeView: vscode.TreeView<PharoNode>;
	private readonly fileSystemRegistration: vscode.Disposable;

	constructor(context: vscode.ExtensionContext) {
		this.pharoDataProvider = new PharoDataProvider();
		this.treeView = vscode.window.createTreeView('pharoImage', { treeDataProvider: this.pharoDataProvider });
		this.fileSystemRegistration = vscode.workspace.registerFileSystemProvider(
			'pharoImage',
			this.pharoDataProvider,
			{ isCaseSensitive: true }
		);
		context.subscriptions.push(this);
		// context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('pharoImage', pharoDataProvider));
	}

	public refresh(): void {
		this.pharoDataProvider.refresh();
	}

	dispose(): void {
		this.fileSystemRegistration.dispose();
		this.treeView.dispose();
		this.pharoDataProvider.dispose();
	}

}
