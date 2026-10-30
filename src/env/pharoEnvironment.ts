import * as vscode from 'vscode';
import {
	EnvCapabilities,
	EnvClassification,
	EnvCompileResult,
	EnvDidChangeParams,
	EnvEntity,
	EnvKind,
	EnvNode,
	EnvSearchKind,
	EnvSearchResult,
	EnvSource,
	envCapabilitiesFrom,
	expectEnvChildrenPage,
	expectEnvClassification,
	expectEnvCompileResult,
	expectEnvDidChangeParams,
	expectEnvEntity,
	expectEnvNodes,
	expectEnvSearchResult,
	expectEnvSource,
	parseEnvId
} from './envContracts';

/** What the environment needs from the language client, so that tests can replay recorded responses. */
export interface EnvTransport {
	sendRequest(method: string, params?: unknown, token?: vscode.CancellationToken): Promise<unknown>;
	onNotification(method: string, handler: (params: unknown) => void): vscode.Disposable;
}

export interface EnvSearchOptions {
	/** Defaults to every kind. */
	kinds?: EnvSearchKind[];
	/** Most results of each kind; the server defaults to 50. */
	limit?: number;
}

export interface EnvCompileOptions {
	protocol?: string;
	expectedVersion?: string;
}

const DEFAULT_PAGE_SIZE = 500;

/**
 * Client of the environment model of one Pharo image (pls-env:* requests).
 * Projects, children and entities are loaded on demand and cached until a pls-env/didChange notification,
 * a compilation or a removal invalidates them. Listeners of onDidChange are told after the cache is invalidated.
 */
export class PharoEnvironment implements vscode.Disposable {
	private projectsCache: Promise<EnvNode[]> | undefined;
	private readonly childrenCache = new Map<string, Promise<EnvNode[]>>();
	private readonly entityCache = new Map<string, Promise<EnvEntity>>();
	private readonly parents = new Map<string, string>();
	private readonly didChangeEmitter = new vscode.EventEmitter<EnvDidChangeParams>();
	private readonly notificationSubscription: vscode.Disposable | undefined;

	readonly onDidChange: vscode.Event<EnvDidChangeParams> = this.didChangeEmitter.event;

	constructor(
		readonly image: string,
		readonly capabilities: EnvCapabilities,
		private readonly transport: EnvTransport,
		private readonly pageSize = DEFAULT_PAGE_SIZE
	) {
		if (capabilities.didChange) {
			this.notificationSubscription = transport.onNotification('pls-env/didChange', (params) => {
				this.applyChanges(expectEnvDidChangeParams(params, 'pls-env/didChange'));
			});
		}
	}

	projects(): Promise<EnvNode[]> {
		if (!this.projectsCache) {
			const loading = this.transport.sendRequest('pls-env:projects')
				.then((value) => this.remember(expectEnvNodes(value, 'pls-env:projects')));
			this.projectsCache = loading;
			loading.catch(() => {
				if (this.projectsCache === loading) {
					this.projectsCache = undefined;
				}
			});
		}
		return this.projectsCache;
	}

	children(id: string): Promise<EnvNode[]> {
		return this.cached(this.childrenCache, id, () => this.loadAllChildren(id));
	}

	entity(id: string): Promise<EnvEntity> {
		return this.cached(this.entityCache, id, async () => {
			const entity = expectEnvEntity(await this.transport.sendRequest('pls-env:entity', { id }), 'pls-env:entity');
			this.remember([entity]);
			return entity;
		});
	}

	/**
	 * Find the classes, methods, packages and projects that match query, such as `Array col` or `Array class>>new:`.
	 * Never cached: the image changes under the search. Cancelling token cancels the request on the server.
	 */
	async search(query: string, options: EnvSearchOptions = {}, token?: vscode.CancellationToken): Promise<EnvSearchResult> {
		return expectEnvSearchResult(
			await this.transport.sendRequest('pls-env:search', { query, kinds: options.kinds, limit: options.limit }, token),
			'pls-env:search'
		);
	}

	/** Read the source of a class or method. It is never cached, so that an editor always opens the source of the image. */
	async read(id: string): Promise<EnvSource> {
		return expectEnvSource(await this.transport.sendRequest('pls-env:read', { id }), 'pls-env:read');
	}

	/**
	 * Compile a class or method. A JSON-RPC error with code ENV_CONFLICT_ERROR_CODE rejects the promise when
	 * expectedVersion is no longer the version of id; envConflictOf reads it.
	 */
	async compile(id: string, source: string, options: EnvCompileOptions = {}): Promise<EnvCompileResult> {
		const result = expectEnvCompileResult(
			await this.transport.sendRequest('pls-env:compile', { id, source, protocol: options.protocol, expectedVersion: options.expectedVersion }),
			'pls-env:compile'
		);
		if (result.compiled) {
			this.invalidate(id);
			if (result.id) {
				this.invalidate(result.id);
			}
		}
		return result;
	}

	/** Move a method to another protocol without compiling it again. */
	async classify(id: string, protocol: string): Promise<EnvClassification> {
		const result = expectEnvClassification(await this.transport.sendRequest('pls-env:classify', { id, protocol }), 'pls-env:classify');
		const path = parseEnvId(id).path;
		const sidePath = path.slice(0, path.indexOf('>>'));
		this.forget(id);
		this.childrenCache.delete(`side:${sidePath}`);
		this.childrenCache.delete(`protocol:${sidePath}>>${result.protocol}`);
		return result;
	}

	async remove(id: string, expectedVersion?: string): Promise<void> {
		await this.transport.sendRequest('pls-env:remove', { id, expectedVersion });
		this.forget(id);
	}

	/** Drop what is cached about the entity id and the children of its parent. */
	invalidate(id: string): void {
		this.entityCache.delete(id);
		const parent = this.parents.get(id);
		if (parent) {
			this.childrenCache.delete(parent);
		}
	}

	/** Drop the cached entities of these kinds, such as the projects and packages whose Iceberg state may have changed. */
	invalidateEntitiesOf(kinds: readonly EnvKind[]): void {
		for (const id of [...this.entityCache.keys()]) {
			if (kinds.some((kind) => id.startsWith(`${kind}:`))) {
				this.entityCache.delete(id);
			}
		}
	}

	clear(): void {
		this.projectsCache = undefined;
		this.childrenCache.clear();
		this.entityCache.clear();
		this.parents.clear();
	}

	applyChanges(params: EnvDidChangeParams): void {
		if (params.reset) {
			this.clear();
		} else {
			for (const change of params.changes) {
				for (const parent of [change.parent, change.oldParent]) {
					if (parent) {
						this.childrenCache.delete(parent);
					}
				}
				if (change.kind === 'removed' || change.kind === 'renamed') {
					this.forget(change.id);
					if (change.oldId) {
						this.forget(change.oldId);
					}
				} else {
					this.invalidate(change.id);
				}
				if (change.kind === 'moved') {
					this.parents.delete(change.id);
				}
				if (change.id.startsWith('project:') || change.id.startsWith('package:')) {
					this.projectsCache = undefined;
				}
			}
		}
		this.didChangeEmitter.fire(params);
	}

	dispose(): void {
		this.notificationSubscription?.dispose();
		this.didChangeEmitter.dispose();
		this.clear();
	}

	/** Drop the entity id, the children of its parent, and everything cached below it. */
	private forget(id: string): void {
		this.invalidate(id);
		for (const descendant of [...this.parents.keys()].filter((candidate) => this.isDescendant(candidate, id))) {
			this.entityCache.delete(descendant);
			this.childrenCache.delete(descendant);
			this.parents.delete(descendant);
		}
		this.childrenCache.delete(id);
		this.parents.delete(id);
	}

	private isDescendant(candidate: string, ancestor: string): boolean {
		const visited = new Set<string>();
		for (let parent = this.parents.get(candidate); parent && !visited.has(parent); parent = this.parents.get(parent)) {
			if (parent === ancestor) {
				return true;
			}
			visited.add(parent);
		}
		return false;
	}

	private async loadAllChildren(id: string): Promise<EnvNode[]> {
		const children: EnvNode[] = [];
		let total = Number.POSITIVE_INFINITY;
		while (children.length < total) {
			const page = expectEnvChildrenPage(
				await this.transport.sendRequest('pls-env:children', { id, offset: children.length, limit: this.pageSize }),
				'pls-env:children'
			);
			total = page.total;
			if (page.items.length === 0) {
				break;
			}
			children.push(...page.items);
		}
		return this.remember(children);
	}

	private remember<T extends EnvNode>(nodes: T[]): T[] {
		for (const node of nodes) {
			if (node.parent) {
				this.parents.set(node.id, node.parent);
			}
		}
		return nodes;
	}

	/** Share one load per key between callers; a failed load is forgotten so that the next call retries. */
	private cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
		const cachedValue = cache.get(key);
		if (cachedValue) {
			return cachedValue;
		}
		const loading = load();
		cache.set(key, loading);
		loading.catch(() => {
			if (cache.get(key) === loading) {
				cache.delete(key);
			}
		});
		return loading;
	}
}

/** Answer the environment of the image served by the language client, or undefined when the server predates pls-env. */
export function createPharoEnvironment(
	image: string,
	experimentalCapabilities: unknown,
	transport: EnvTransport
): PharoEnvironment | undefined {
	const capabilities = envCapabilitiesFrom(experimentalCapabilities);
	return capabilities ? new PharoEnvironment(image, capabilities, transport) : undefined;
}
