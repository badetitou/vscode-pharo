import * as vscode from 'vscode';
import { EnvChange, EnvDidChangeParams, parseEnvId } from './envContracts';

/**
 * What a burst of pls-env/didChange notifications changed, by name, so that the views that know classes and
 * packages by name (the pharoImage: file system, the Test Explorer) can invalidate only what they show.
 */
export interface EnvChangeSummary {
	/** The server dropped the changes: everything must be reloaded. */
	reset: boolean;
	/** A project or a package was added, removed or renamed: the list of packages changed. */
	packagesChanged: boolean;
	/** Packages whose list of classes changed. */
	packages: Set<string>;
	/** Classes whose definition or methods changed, or that were added. */
	classes: Set<string>;
	/** Classes that no longer exist, renamed classes included under their old name. */
	removedClasses: Set<string>;
	/** The changes of the burst, in the order the server sent them. */
	changes: EnvChange[];
}

export const DEFAULT_CHANGE_DELAY_MS = 100;
export const DEFAULT_CHANGE_MAX_DELAY_MS = 500;

/** Answer the class named by an id of a class, side, protocol or method, or undefined for another kind of id. */
export function classNameOfEnvId(id: string): string | undefined {
	const { kind, path } = parseEnvId(id);
	switch (kind) {
		case 'class':
			return path;
		case 'side':
			return instanceSideName(path);
		case 'protocol':
		case 'method': {
			const separator = path.indexOf('>>');
			return separator < 0 ? undefined : instanceSideName(path.slice(0, separator));
		}
		default:
			return undefined;
	}
}

/** Answer the package named by an id of a package, tag or extensions node, or undefined for another kind of id. */
export function packageNameOfEnvId(id: string): string | undefined {
	const { kind, path } = parseEnvId(id);
	switch (kind) {
		case 'package':
		case 'extensions':
			return path;
		case 'tag': {
			const separator = path.indexOf('/');
			return separator < 0 ? path : path.slice(0, separator);
		}
		default:
			return undefined;
	}
}

export function summarizeEnvChanges(notifications: EnvDidChangeParams[]): EnvChangeSummary {
	const summary: EnvChangeSummary = {
		reset: false,
		packagesChanged: false,
		packages: new Set(),
		classes: new Set(),
		removedClasses: new Set(),
		changes: []
	};
	for (const notification of notifications) {
		summary.reset = summary.reset || notification.reset;
		summary.changes.push(...notification.changes);
		for (const change of notification.changes) {
			addChange(summary, change);
		}
	}
	// A class removed then added again in the same burst still exists.
	for (const className of summary.classes) {
		summary.removedClasses.delete(className);
	}
	return summary;
}

function addChange(summary: EnvChangeSummary, change: EnvChange): void {
	const kind = safeKindOf(change.id);
	if (kind === 'project' || kind === 'package') {
		summary.packagesChanged = true;
	}
	for (const parent of [change.parent, change.oldParent]) {
		const packageName = parent ? safely(packageNameOfEnvId, parent) : undefined;
		if (packageName) {
			summary.packages.add(packageName);
		}
	}
	const className = safely(classNameOfEnvId, change.id);
	if (!className) {
		return;
	}
	if (kind === 'class' && change.kind === 'removed') {
		summary.removedClasses.add(className);
	} else {
		summary.classes.add(className);
	}
	const oldClassName = change.oldId ? safely(classNameOfEnvId, change.oldId) : undefined;
	if (oldClassName && oldClassName !== className) {
		summary.removedClasses.add(oldClassName);
	}
}

/**
 * Event bus of the changes of the image. It gathers the pls-env/didChange notifications that arrive close together
 * and fires one summary once they stop for delayMs, or at most maxDelayMs after the first of them, so that a burst
 * (an Iceberg checkout, a Metacello load) refreshes each view once.
 * Listeners are told after PharoEnvironment has invalidated its cache.
 */
export class EnvChangeBus implements vscode.Disposable {
	private readonly emitter = new vscode.EventEmitter<EnvChangeSummary>();
	private readonly subscription: vscode.Disposable;
	private pending: EnvDidChangeParams[] = [];
	private quietTimer: ReturnType<typeof setTimeout> | undefined;
	private maxTimer: ReturnType<typeof setTimeout> | undefined;

	readonly onDidChange: vscode.Event<EnvChangeSummary> = this.emitter.event;

	constructor(
		source: vscode.Event<EnvDidChangeParams>,
		private readonly delayMs = DEFAULT_CHANGE_DELAY_MS,
		private readonly maxDelayMs = DEFAULT_CHANGE_MAX_DELAY_MS
	) {
		this.subscription = source((params) => this.push(params));
	}

	/** Fire the pending changes now, if any. */
	flush(): void {
		this.clearTimers();
		if (this.pending.length === 0) {
			return;
		}
		const notifications = this.pending;
		this.pending = [];
		this.emitter.fire(summarizeEnvChanges(notifications));
	}

	dispose(): void {
		this.clearTimers();
		this.pending = [];
		this.subscription.dispose();
		this.emitter.dispose();
	}

	private push(params: EnvDidChangeParams): void {
		if (!params.reset && params.changes.length === 0) {
			return;
		}
		this.pending.push(params);
		if (this.quietTimer) {
			clearTimeout(this.quietTimer);
		}
		this.quietTimer = setTimeout(() => this.flush(), this.delayMs);
		if (!this.maxTimer) {
			this.maxTimer = setTimeout(() => this.flush(), this.maxDelayMs);
		}
	}

	private clearTimers(): void {
		if (this.quietTimer) {
			clearTimeout(this.quietTimer);
			this.quietTimer = undefined;
		}
		if (this.maxTimer) {
			clearTimeout(this.maxTimer);
			this.maxTimer = undefined;
		}
	}
}

function instanceSideName(sidePath: string): string {
	return sidePath.endsWith(' class') ? sidePath.slice(0, -' class'.length) : sidePath;
}

function safeKindOf(id: string): string | undefined {
	try {
		return parseEnvId(id).kind;
	} catch {
		return undefined;
	}
}

function safely(read: (id: string) => string | undefined, id: string): string | undefined {
	try {
		return read(id);
	} catch {
		return undefined;
	}
}
