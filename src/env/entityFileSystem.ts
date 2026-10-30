import * as vscode from 'vscode';
import { EnvChange, EnvDiagnostic, envConflictOf, isEnvUnknownEntityError } from './envContracts';
import { classNameOfEnvId } from './environmentChanges';
import {
	ENTITY_SCHEME,
	EntityLocation,
	entityIdOf,
	entityLabelOf,
	entityUri,
	imageNameOf,
	parseEntityUri,
	sideIdOf
} from './entityUri';
import { PharoEnvironment } from './pharoEnvironment';

/** What the entity editors need from the environment, so that tests can use a fake image. */
export type EntityEnvironment = Pick<PharoEnvironment, 'image' | 'entity' | 'read' | 'compile' | 'remove'>;

/** A save compiled another entity than the one of the editor: a renamed selector, or a new method. */
export interface EntityCreatedEvent {
	from: vscode.Uri;
	to: vscode.Uri;
}

const NEW_METHOD_TEMPLATE = 'selector\n\t"comment stating purpose of message"\n\n\t';
const DEFAULT_PROTOCOL = 'as yet unclassified';

/**
 * File system of the entity editors (scheme `pharo:`): one class definition or one method per document.
 * Reading answers the source of the image, saving compiles it.
 *
 * Each entity gets a modification time that moves forward when its version changes in the image. When an editor with
 * local changes is saved after its entity changed, VS Code sees the newer time and offers to compare, overwrite or
 * revert. Overwriting compiles against the latest version seen, so a change made in between is still detected.
 */
export class PharoEntityFileSystem implements vscode.FileSystemProvider, vscode.Disposable {
	private readonly fileChangeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	private readonly createdEmitter = new vscode.EventEmitter<EntityCreatedEvent>();
	private readonly documentChangeListener: vscode.Disposable;
	/** Latest version seen of each entity, by id, with its modification time. A removed entity has no version. */
	private readonly versions = new Map<string, { version: string | undefined; mtime: number }>();
	private readonly newMethodProtocols = new Map<string, string>();
	private lastMtime = 0;

	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.fileChangeEmitter.event;
	readonly onDidCreateEntity: vscode.Event<EntityCreatedEvent> = this.createdEmitter.event;

	constructor(
		private readonly environment: () => EntityEnvironment | undefined,
		private readonly diagnostics: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('pharo-compile')
	) {
		this.documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.scheme === ENTITY_SCHEME && event.contentChanges.length > 0) {
				this.diagnostics.delete(event.document.uri);
			}
		});
	}

	/** Answer the URI of the editor of a new method on a side of a class, compiled in protocol once saved. */
	newMethodUri(location: Omit<EntityLocation, 'selector'>, protocol = DEFAULT_PROTOCOL): vscode.Uri {
		const uri = entityUri({ ...location, selector: undefined });
		this.newMethodProtocols.set(uri.toString(), protocol);
		return uri;
	}

	watch(): vscode.Disposable {
		return new vscode.Disposable(() => undefined);
	}

	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		const { environment, location, id } = this.resolve(uri);
		if (!location) {
			return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
		}
		if (!id) {
			return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
		}
		let version: string | undefined;
		try {
			version = (await environment.entity(id)).version;
		} catch (error) {
			if (isEnvUnknownEntityError(error)) {
				this.see(id, undefined);
				throw vscode.FileSystemError.FileNotFound(uri);
			}
			throw error;
		}
		const mtime = this.see(id, version);
		return { type: vscode.FileType.File, ctime: 0, mtime, size: 0 };
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const { environment, location, id } = this.resolve(uri);
		if (!location) {
			throw vscode.FileSystemError.FileIsADirectory(uri);
		}
		if (!id) {
			return Buffer.from(NEW_METHOD_TEMPLATE);
		}
		try {
			const source = await environment.read(id);
			this.see(id, source.version);
			return Buffer.from(source.source);
		} catch (error) {
			if (isEnvUnknownEntityError(error)) {
				this.see(id, undefined);
				throw vscode.FileSystemError.FileNotFound(uri);
			}
			throw error;
		}
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
		const { environment, location, id } = this.resolve(uri);
		if (!location) {
			throw vscode.FileSystemError.FileIsADirectory(uri);
		}
		const source = Buffer.from(content).toString('utf8');
		const seen = id ? this.versions.get(id) : undefined;
		// A new method, or a method removed from the image since, is compiled again on its side.
		const recreate = !id || (location.side !== undefined && seen !== undefined && seen.version === undefined);
		const target = recreate ? sideIdOf(location) : id!;
		const protocol = id ? undefined : this.newMethodProtocols.get(uri.toString()) ?? DEFAULT_PROTOCOL;

		let result;
		try {
			result = await environment.compile(target, source, { protocol, expectedVersion: recreate ? undefined : seen?.version });
		} catch (error) {
			const conflict = envConflictOf(error);
			if (conflict && id) {
				// Make VS Code see the newer entity, so that the next save offers to compare or overwrite.
				this.see(id, conflict.currentVersion ?? undefined);
				this.fileChangeEmitter.fire([{ type: conflict.currentVersion ? vscode.FileChangeType.Changed : vscode.FileChangeType.Deleted, uri }]);
				throw vscode.FileSystemError.Unavailable(
					`${entityLabelOf(location)} changed in the image since it was opened. Save again to compare or overwrite.`
				);
			}
			throw error;
		}

		if (!result.compiled || !result.id) {
			this.diagnostics.set(uri, result.diagnostics.map(toDiagnostic));
			const firstError = result.diagnostics.find((diagnostic) => diagnostic.severity === 1) ?? result.diagnostics[0];
			throw vscode.FileSystemError.Unavailable(
				`${entityLabelOf(location)} does not compile${firstError ? `: ${firstError.message}` : '.'}`
			);
		}

		this.diagnostics.set(uri, result.diagnostics.map(toDiagnostic));
		this.see(result.id, result.version ?? undefined);
		if (result.id !== id) {
			if (id) {
				// The editor keeps the entity it names: reload it with the source of the image.
				this.touch(id);
				setTimeout(() => this.fileChangeEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]), 0);
			}
			const created = parseEntityId(result.id, location);
			if (created) {
				this.createdEmitter.fire({ from: uri, to: entityUri(created) });
			}
		}
	}

	async delete(uri: vscode.Uri): Promise<void> {
		const { environment, id } = this.resolve(uri);
		if (!id) {
			throw vscode.FileSystemError.NoPermissions(uri);
		}
		await environment.remove(id, this.versions.get(id)?.version);
		this.see(id, undefined);
	}

	readDirectory(): [string, vscode.FileType][] {
		return [];
	}

	createDirectory(uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions(uri);
	}

	rename(oldUri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions(oldUri);
	}

	/**
	 * Tell VS Code which open editors a burst of changes of the image touched: it reloads those without local changes,
	 * and offers to compare or overwrite on the next save of the others.
	 */
	applyChanges(changes: EnvChange[], reset: boolean, openDocuments: readonly vscode.TextDocument[] = vscode.workspace.textDocuments): void {
		const changed = new Set<string>();
		const removed = new Set<string>();
		const removedClasses = new Set<string>();
		for (const change of changes) {
			if (change.kind === 'removed') {
				removed.add(change.id);
			} else {
				changed.add(change.id);
			}
			if (change.oldId) {
				removed.add(change.oldId);
			}
			if (change.id.startsWith('class:') && (change.kind === 'removed' || change.kind === 'renamed')) {
				removedClasses.add(classNameOfEnvId(change.oldId ?? change.id)!);
			}
		}

		const events: vscode.FileChangeEvent[] = [];
		for (const document of openDocuments) {
			const location = parseEntityUri(document.uri);
			const id = location ? entityIdOf(location) : undefined;
			if (!location || !id) {
				continue;
			}
			if (removed.has(id) || removedClasses.has(location.className)) {
				events.push({ type: vscode.FileChangeType.Deleted, uri: document.uri });
			} else if (reset || changed.has(id)) {
				events.push({ type: vscode.FileChangeType.Changed, uri: document.uri });
			}
		}
		if (events.length > 0) {
			this.fileChangeEmitter.fire(events);
		}
	}

	dispose(): void {
		this.documentChangeListener.dispose();
		this.fileChangeEmitter.dispose();
		this.createdEmitter.dispose();
		this.diagnostics.dispose();
	}

	private resolve(uri: vscode.Uri): { environment: EntityEnvironment; location: EntityLocation | undefined; id: string | undefined } {
		const environment = this.environment();
		if (!environment) {
			throw vscode.FileSystemError.Unavailable('The Pharo Language Server is not running, or does not provide the environment model.');
		}
		const location = parseEntityUri(uri);
		if (location && location.image !== imageNameOf(environment.image)) {
			throw vscode.FileSystemError.Unavailable(`${uri.toString(true)} belongs to the image ${location.image}, which is not the active one.`);
		}
		return { environment, location, id: location ? entityIdOf(location) : undefined };
	}

	/** Record the version of an entity, and answer its modification time, moved forward if the version changed. */
	private see(id: string, version: string | undefined): number {
		const known = this.versions.get(id);
		if (known && known.version === version) {
			return known.mtime;
		}
		const mtime = this.nextMtime();
		this.versions.set(id, { version, mtime });
		return mtime;
	}

	/** Move the modification time of an entity forward without changing its version, so that its editors reload. */
	private touch(id: string): void {
		const known = this.versions.get(id);
		this.versions.set(id, { version: known?.version, mtime: this.nextMtime() });
	}

	private nextMtime(): number {
		this.lastMtime = Math.max(Date.now(), this.lastMtime + 1);
		return this.lastMtime;
	}
}

/** Answer the location of a class or method id, in the image and package of an editor of the same class. */
function parseEntityId(id: string, near: EntityLocation): EntityLocation | undefined {
	if (id.startsWith('class:')) {
		return { image: near.image, packageName: near.packageName, className: id.slice('class:'.length) };
	}
	const match = /^method:(.+?)( class)?>>(.+)$/.exec(id);
	if (!match) {
		return undefined;
	}
	return {
		image: near.image,
		packageName: near.packageName,
		className: match[1],
		side: match[2] ? 'class' : 'instance',
		selector: match[3]
	};
}

function toDiagnostic(diagnostic: EnvDiagnostic): vscode.Diagnostic {
	const range = new vscode.Range(
		diagnostic.range.start.line,
		diagnostic.range.start.character,
		diagnostic.range.end.line,
		diagnostic.range.end.character
	);
	const result = new vscode.Diagnostic(
		range,
		diagnostic.message,
		diagnostic.severity === 1 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
	);
	result.source = 'Pharo';
	return result;
}
