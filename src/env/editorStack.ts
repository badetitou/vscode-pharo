import * as vscode from 'vscode';
import { EnvChange } from './envContracts';
import { classNameOfEnvId } from './environmentChanges';

// The editor stack of an image: the classes and methods visited in entity editors, and the history of the visits.
// Entities are known by pls-env id (`class:Array`, `method:Array class>>new:`), which survives restarting the image.

export type EditorStackSort = 'recent' | 'name' | 'package';

export interface EditorStackEntry {
	id: string;
	/** Package of the entity when it was last visited, to sort and describe it without asking the image. */
	packageName: string;
	/** Time of the last visit, in milliseconds. */
	visited: number;
}

/** An entity editor open when the session was saved. */
export interface OpenEntityEditor {
	id: string;
	/** View column of the editor group, from 1. */
	column: number;
	active: boolean;
}

/** What is saved of the session of an image, in the workspace state. */
export interface EditorSessionState {
	version: 1;
	entries: EditorStackEntry[];
	history: string[];
	historyIndex: number;
	sort: EditorStackSort;
	/** Entity editors open, in the order of their tabs. */
	openEditors: OpenEntityEditor[];
	/** State of the other views of the image (selections, playground), by view. */
	views: Record<string, unknown>;
}

export const MAX_STACK_ENTRIES = 100;
export const MAX_HISTORY = 100;

/** Answer the readable name of a class or method id: `Array`, `Array>>collect:` or `Array class>>new:`. */
export function labelOfEntityId(id: string): string {
	return id.replace(/^(class|method):/, '');
}

/**
 * The entities visited in the editors of an image, with a back and forward history as in a browser:
 * visiting an entity after going back drops the entities ahead.
 */
export class EditorStack implements vscode.Disposable {
	private entries: EditorStackEntry[] = [];
	private history: string[] = [];
	private historyIndex = -1;
	private sortOrder: EditorStackSort = 'recent';
	private readonly didChangeEmitter = new vscode.EventEmitter<void>();

	readonly onDidChange: vscode.Event<void> = this.didChangeEmitter.event;

	get sort(): EditorStackSort {
		return this.sortOrder;
	}

	set sort(sort: EditorStackSort) {
		this.sortOrder = sort;
		this.didChangeEmitter.fire();
	}

	get canGoBack(): boolean {
		return this.historyIndex > 0;
	}

	get canGoForward(): boolean {
		return this.historyIndex < this.history.length - 1;
	}

	/** Answer the entity of the history the user stands on, if any. */
	get current(): string | undefined {
		return this.history[this.historyIndex];
	}

	/** Answer the entries in the order of the current sort. */
	sorted(): EditorStackEntry[] {
		const byName = (a: EditorStackEntry, b: EditorStackEntry) => labelOfEntityId(a.id).localeCompare(labelOfEntityId(b.id));
		switch (this.sortOrder) {
			case 'name':
				return [...this.entries].sort(byName);
			case 'package':
				return [...this.entries].sort((a, b) => a.packageName.localeCompare(b.packageName) || byName(a, b));
			default:
				return [...this.entries].sort((a, b) => b.visited - a.visited);
		}
	}

	has(id: string): boolean {
		return this.entries.some((entry) => entry.id === id);
	}

	/**
	 * Record a visit of an entity. A visit made by going back or forward does not change the history,
	 * other visits replace the entities ahead in the history.
	 */
	visit(id: string, packageName: string, now = Date.now()): void {
		this.entries = [{ id, packageName, visited: now }, ...this.entries.filter((entry) => entry.id !== id)].slice(0, MAX_STACK_ENTRIES);
		if (this.current !== id) {
			this.history = [...this.history.slice(0, this.historyIndex + 1), id].slice(-MAX_HISTORY);
			this.historyIndex = this.history.length - 1;
		}
		this.didChangeEmitter.fire();
	}

	/** Move one step back in the history, and answer the entity to show. */
	back(): string | undefined {
		return this.move(-1);
	}

	/** Move one step forward in the history, and answer the entity to show. */
	forward(): string | undefined {
		return this.move(1);
	}

	/** Forget entities: those removed from the image, or those the user removes from the stack. */
	remove(ids: Iterable<string>): void {
		const removed = new Set(ids);
		if (removed.size === 0) {
			return;
		}
		this.entries = this.entries.filter((entry) => !removed.has(entry.id));
		this.mapHistory((id) => removed.has(id) ? undefined : id);
		this.didChangeEmitter.fire();
	}

	/** Follow the renames and removals of a burst of changes of the image. */
	applyChanges(changes: EnvChange[]): void {
		const renames = new Map<string, string>();
		const removed = new Set<string>();
		const removedClasses = new Set<string>();
		for (const change of changes) {
			if (change.kind === 'removed') {
				removed.add(change.id);
				if (change.id.startsWith('class:')) {
					removedClasses.add(classNameOfEnvId(change.id)!);
				}
			} else if (change.kind === 'renamed' && change.oldId && (change.id.startsWith('class:') || change.id.startsWith('method:'))) {
				renames.set(change.oldId, change.id);
			}
		}
		const renamedClasses = new Map([...renames].filter(([oldId]) => oldId.startsWith('class:'))
			.map(([oldId, id]) => [classNameOfEnvId(oldId)!, classNameOfEnvId(id)!]));
		const follow = (id: string) => {
			if (removed.has(id) || removedClasses.has(classNameOfEnvId(id) ?? '')) {
				return undefined;
			}
			return renames.get(id) ?? renameClassOf(id, renamedClasses);
		};

		const before = JSON.stringify(this.toState([]));
		const entries = new Map<string, EditorStackEntry>();
		for (const entry of this.entries) {
			const id = follow(entry.id);
			if (id !== undefined && !entries.has(id)) {
				entries.set(id, { ...entry, id });
			}
		}
		this.entries = [...entries.values()];
		this.mapHistory(follow);
		if (JSON.stringify(this.toState([])) !== before) {
			this.didChangeEmitter.fire();
		}
	}

	/** Forget every entry but the given ones, and the whole history but the current entity. */
	clear(keep: Iterable<string> = []): void {
		const kept = new Set(keep);
		this.entries = this.entries.filter((entry) => kept.has(entry.id));
		const current = this.current;
		this.history = current !== undefined && kept.has(current) ? [current] : [];
		this.historyIndex = this.history.length - 1;
		this.didChangeEmitter.fire();
	}

	toState(openEditors: OpenEntityEditor[], views: Record<string, unknown> = {}): EditorSessionState {
		return {
			version: 1,
			entries: this.entries.map((entry) => ({ ...entry })),
			history: [...this.history],
			historyIndex: this.historyIndex,
			sort: this.sortOrder,
			openEditors,
			views
		};
	}

	restore(state: EditorSessionState | undefined): void {
		const valid = isEditorSessionState(state);
		this.entries = valid ? state.entries.slice(0, MAX_STACK_ENTRIES) : [];
		this.history = valid ? state.history.slice(-MAX_HISTORY) : [];
		this.historyIndex = valid ? Math.min(Math.max(state.historyIndex, -1), this.history.length - 1) : -1;
		if (this.historyIndex < 0 && this.history.length > 0) {
			this.historyIndex = this.history.length - 1;
		}
		this.sortOrder = valid ? state.sort : 'recent';
		this.didChangeEmitter.fire();
	}

	dispose(): void {
		this.didChangeEmitter.dispose();
	}

	/** Rename or drop (undefined) the entities of the history, and stay on the current one, or the closest before it. */
	private mapHistory(follow: (id: string) => string | undefined): void {
		const history: string[] = [];
		let index = -1;
		this.history.forEach((id, position) => {
			const next = follow(id);
			if (next !== undefined && history[history.length - 1] !== next) {
				history.push(next);
			}
			if (position <= this.historyIndex) {
				index = history.length - 1;
			}
		});
		this.history = history;
		this.historyIndex = history.length === 0 ? -1 : Math.max(0, index);
	}

	private move(step: number): string | undefined {
		const index = this.historyIndex + step;
		if (index < 0 || index >= this.history.length) {
			return undefined;
		}
		this.historyIndex = index;
		this.didChangeEmitter.fire();
		return this.history[index];
	}
}

/** Answer whether a value read from the workspace state is a session this version understands. */
export function isEditorSessionState(value: unknown): value is EditorSessionState {
	const state = value as Partial<EditorSessionState> | undefined;
	return typeof state === 'object' && state !== null && state.version === 1
		&& Array.isArray(state.entries) && state.entries.every((entry) => typeof entry?.id === 'string' && typeof entry.packageName === 'string' && typeof entry.visited === 'number')
		&& Array.isArray(state.history) && state.history.every((id) => typeof id === 'string')
		&& typeof state.historyIndex === 'number'
		&& (state.sort === 'recent' || state.sort === 'name' || state.sort === 'package')
		&& Array.isArray(state.openEditors) && state.openEditors.every((editor) => typeof editor?.id === 'string' && typeof editor.column === 'number')
		&& typeof state.views === 'object' && state.views !== null;
}

function renameClassOf(id: string, renamedClasses: Map<string, string>): string {
	const className = classNameOfEnvId(id);
	const newName = className === undefined ? undefined : renamedClasses.get(className);
	if (newName === undefined) {
		return id;
	}
	const match = /^(class|method):[^\s>]+(.*)$/.exec(id);
	return match ? `${match[1]}:${newName}${match[2]}` : id;
}
