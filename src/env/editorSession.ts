import * as path from 'path';
import * as vscode from 'vscode';
import { isEnvUnknownEntityError } from './envContracts';
import { locationOf } from './entityCommands';
import { EditorStack, EditorStackEntry, EditorStackSort, OpenEntityEditor, isEditorSessionState, labelOfEntityId } from './editorStack';
import { ENTITY_SCHEME, entityIdOf, entityUri, imageNameOf, parseEntityUri } from './entityUri';
import { PharoEnvironment } from './pharoEnvironment';

/** What the session needs from the environment, so that tests can use a fake image. */
export type SessionEnvironment = Pick<PharoEnvironment, 'image' | 'entity'>;

const SESSION_KEY_PREFIX = 'pharo.editorSession:';

/** A view whose state belongs to the session of the image, such as its selection or its filter. */
export interface SessionView {
	/** Key of the state of the view in the session. */
	readonly sessionKey: string;
	readonly onDidChangeSessionState: vscode.Event<void>;
	/** Answer the state to save, a JSON value. */
	sessionState(): unknown;
	/** Restore a saved state, or undefined for an image without one. Entities removed from the image are skipped. */
	restoreSessionState(state: unknown): Promise<void>;
}

/** Answer the key of the workspace state that holds the session of an image. */
export function sessionKeyOf(pathToImage: string): string {
	return `${SESSION_KEY_PREFIX}${path.resolve(pathToImage)}`;
}

/**
 * The working session of the active image: its editor stack, its open entity editors and the state of its views.
 * It is saved in the workspace state under the path of the image, at each change, and restored once the server starts:
 * after a reload of VS Code, and after a change of the active image, which reloads VS Code.
 */
export class EditorSession implements vscode.Disposable {
	readonly stack = new EditorStack();
	private environment: SessionEnvironment | undefined;
	private views: Record<string, unknown> = {};
	private readonly sessionViews: SessionView[] = [];
	/** The editors and the views of the session are restored: changes of the views are now saved. */
	private restored = false;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly didChangeEmitter = new vscode.EventEmitter<void>();

	/** The stack or the open editors changed. */
	readonly onDidChange: vscode.Event<void> = this.didChangeEmitter.event;

	constructor(private readonly memento: vscode.Memento) {}

	get started(): boolean {
		return this.environment !== undefined;
	}

	/** Restore the session of the image of an environment, then follow the entity editors. */
	async start(environment: SessionEnvironment): Promise<void> {
		const saved = this.memento.get<unknown>(sessionKeyOf(environment.image));
		const state = isEditorSessionState(saved) ? saved : undefined;
		this.environment = environment;
		this.stack.restore(state);
		this.views = { ...state?.views };
		await this.restoreEditors(state?.openEditors ?? this.openEditors());
		for (const view of this.sessionViews) {
			await this.restoreView(view);
		}
		this.restored = true;

		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor((editor) => this.visit(editor?.document.uri)),
			vscode.window.tabGroups.onDidChangeTabs(() => this.changed()),
			vscode.window.tabGroups.onDidChangeTabGroups(() => this.changed()),
			this.stack.onDidChange(() => this.changed())
		);
		this.visit(vscode.window.activeTextEditor?.document.uri);
		this.changed();
	}

	/**
	 * Save the state of a view with the session, and restore it once the editors of the session are: a view that follows
	 * the active editor still shows the entity of that editor.
	 */
	registerView(view: SessionView): vscode.Disposable {
		this.sessionViews.push(view);
		if (this.restored) {
			void this.restoreView(view);
		}
		const subscription = view.onDidChangeSessionState(() => {
			if (this.restored) {
				this.views[view.sessionKey] = view.sessionState();
				this.save();
			}
		});
		return new vscode.Disposable(() => {
			subscription.dispose();
			this.sessionViews.splice(this.sessionViews.indexOf(view), 1);
		});
	}

	/** Answer the ids of the entities that have an open editor. */
	openIds(): Set<string> {
		return new Set(this.entityTabs().map(({ id }) => id));
	}

	/** Open the editor of an entity. Answer false, and forget the entity, when it no longer exists in the image. */
	async open(id: string, options: vscode.TextDocumentShowOptions = {}): Promise<boolean> {
		const environment = this.requireEnvironment();
		let uri: vscode.Uri;
		try {
			await environment.entity(id);
			uri = entityUri(await locationOf(environment, id));
		} catch (error) {
			if (isEnvUnknownEntityError(error)) {
				this.stack.remove([id]);
				return false;
			}
			throw error;
		}
		await vscode.window.showTextDocument(uri, { preview: false, ...options });
		return true;
	}

	/** Go back in the history, past the entities removed from the image. */
	async back(): Promise<void> {
		let id = this.stack.back();
		while (id !== undefined && !await this.open(id)) {
			id = this.stack.current;
		}
	}

	/** Go forward in the history, past the entities removed from the image. */
	async forward(): Promise<void> {
		let id = this.stack.forward();
		while (id !== undefined && !await this.open(id)) {
			id = this.stack.forward();
		}
	}

	/** Close the editors of entities. */
	async close(ids: Iterable<string>): Promise<void> {
		const closing = new Set(ids);
		await vscode.window.tabGroups.close(this.entityTabs().filter(({ id }) => closing.has(id)).map(({ tab }) => tab));
	}

	dispose(): void {
		vscode.Disposable.from(...this.disposables).dispose();
		this.stack.dispose();
		this.didChangeEmitter.dispose();
	}

	private async restoreView(view: SessionView): Promise<void> {
		try {
			await view.restoreSessionState(this.views[view.sessionKey]);
		} catch {
			// A view that cannot be restored is not worth stopping the session.
		}
	}

	private visit(uri: vscode.Uri | undefined): void {
		const location = uri ? parseEntityUri(uri) : undefined;
		const id = location ? entityIdOf(location) : undefined;
		if (location && id && this.environment && location.image === imageNameOf(this.environment.image)) {
			this.stack.visit(id, location.packageName);
		}
	}

	/**
	 * Reopen the entity editors of the session with the source of the image, in their editor groups.
	 * The entity editors that VS Code restored by itself could not be read before the server started, or belong to
	 * another image: they are closed, unless they hold unsaved changes. Entities removed from the image are skipped.
	 */
	private async restoreEditors(editors: OpenEntityEditor[]): Promise<void> {
		const stale = vscode.window.tabGroups.all.flatMap((group) => group.tabs)
			.filter((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.scheme === ENTITY_SCHEME && !tab.isDirty);
		if (stale.length > 0) {
			await vscode.window.tabGroups.close(stale, true);
		}
		const active = editors.find((editor) => editor.active);
		for (const editor of [...editors.filter((editor) => editor !== active), ...(active ? [active] : [])]) {
			try {
				await this.open(editor.id, { viewColumn: editor.column, preserveFocus: editor !== active, preview: false });
			} catch {
				// An editor that cannot be restored is not worth stopping the others.
			}
		}
	}

	/** Answer the entity editors of the active image, in the order of their groups and tabs. */
	private openEditors(): OpenEntityEditor[] {
		return this.entityTabs().map(({ id, column, active }) => ({ id, column, active }));
	}

	private entityTabs(): Array<OpenEntityEditor & { tab: vscode.Tab }> {
		const image = this.environment ? imageNameOf(this.environment.image) : undefined;
		return vscode.window.tabGroups.all.flatMap((group) => group.tabs.flatMap((tab) => {
			const location = tab.input instanceof vscode.TabInputText ? parseEntityUri(tab.input.uri) : undefined;
			const id = location && location.image === image ? entityIdOf(location) : undefined;
			return id ? [{ id, column: group.viewColumn, active: tab.isActive && group.isActive, tab }] : [];
		}));
	}

	private changed(): void {
		this.save();
		void vscode.commands.executeCommand('setContext', 'pharo.editors.canGoBack', this.stack.canGoBack);
		void vscode.commands.executeCommand('setContext', 'pharo.editors.canGoForward', this.stack.canGoForward);
		this.didChangeEmitter.fire();
	}

	private save(): void {
		if (this.environment) {
			void this.memento.update(sessionKeyOf(this.environment.image), this.stack.toState(this.openEditors(), this.views));
		}
	}

	private requireEnvironment(): SessionEnvironment {
		if (!this.environment) {
			throw new Error('The Pharo Language Server is not running, or does not provide the environment model (pls-env).');
		}
		return this.environment;
	}
}

/** The view of the editor stack: the entities visited in the image, open or closed, in the order the user chose. */
export class EditorStackTreeProvider implements vscode.TreeDataProvider<EditorStackEntry>, vscode.Disposable {
	private readonly didChangeEmitter = new vscode.EventEmitter<void>();
	private readonly subscription: vscode.Disposable;

	readonly onDidChangeTreeData: vscode.Event<void> = this.didChangeEmitter.event;

	constructor(private readonly session: EditorSession) {
		this.subscription = session.onDidChange(() => this.didChangeEmitter.fire());
	}

	getChildren(element?: EditorStackEntry): EditorStackEntry[] {
		return element || !this.session.started ? [] : this.session.stack.sorted();
	}

	getTreeItem(entry: EditorStackEntry): vscode.TreeItem {
		const open = this.session.openIds().has(entry.id);
		const item = new vscode.TreeItem(labelOfEntityId(entry.id));
		item.id = entry.id;
		item.description = open ? entry.packageName : `${entry.packageName} · closed`;
		item.tooltip = `${labelOfEntityId(entry.id)}\n${entry.packageName}\nVisited ${new Date(entry.visited).toLocaleString()}`;
		const icon = entry.id.startsWith('class:') ? 'symbol-class' : 'symbol-method';
		item.iconPath = open ? new vscode.ThemeIcon(icon) : new vscode.ThemeIcon(icon, new vscode.ThemeColor('disabledForeground'));
		item.contextValue = open ? 'pharoEditorStack.open' : 'pharoEditorStack.closed';
		item.command = { command: 'pharo.editors.open', title: 'Open', arguments: [entry] };
		return item;
	}

	dispose(): void {
		this.subscription.dispose();
		this.didChangeEmitter.dispose();
	}
}

const SORT_LABELS: Record<EditorStackSort, string> = {
	recent: 'Most recently visited',
	name: 'By name',
	package: 'By package'
};

/** Register the editor stack view and its commands. The session starts once the environment of the image is known. */
export function registerEditorSession(context: vscode.ExtensionContext): EditorSession {
	const session = new EditorSession(context.workspaceState);
	const tree = new EditorStackTreeProvider(session);
	const view = vscode.window.createTreeView('pharoEditorStack', { treeDataProvider: tree });
	const describeSort = () => { view.description = session.stack.sort === 'recent' ? undefined : SORT_LABELS[session.stack.sort]; };
	const idsOf = (entry?: EditorStackEntry, selected?: readonly EditorStackEntry[]) =>
		(selected && selected.length > 0 ? selected : entry ? [entry] : view.selection).map(({ id }) => id);

	context.subscriptions.push(
		session,
		tree,
		view,
		session.onDidChange(describeSort),
		vscode.commands.registerCommand('pharo.editors.back', () => reportErrors(() => session.back())),
		vscode.commands.registerCommand('pharo.editors.forward', () => reportErrors(() => session.forward())),
		vscode.commands.registerCommand('pharo.editors.open', (entry?: EditorStackEntry) => reportErrors(async () => {
			if (entry && !await session.open(entry.id)) {
				void vscode.window.showInformationMessage(`${labelOfEntityId(entry.id)} no longer exists in the image.`);
			}
		})),
		vscode.commands.registerCommand('pharo.editors.close', (entry?: EditorStackEntry, selected?: EditorStackEntry[]) =>
			reportErrors(() => session.close(idsOf(entry, selected)))
		),
		vscode.commands.registerCommand('pharo.editors.remove', (entry?: EditorStackEntry, selected?: EditorStackEntry[]) => {
			session.stack.remove(idsOf(entry, selected));
		}),
		vscode.commands.registerCommand('pharo.editors.clear', () => session.stack.clear(session.openIds())),
		vscode.commands.registerCommand('pharo.editors.sort', async () => {
			const picked = await vscode.window.showQuickPick(
				(Object.keys(SORT_LABELS) as EditorStackSort[]).map((sort) => ({
					label: SORT_LABELS[sort],
					description: sort === session.stack.sort ? 'current' : undefined,
					sort
				})),
				{ title: 'Sort the Editor Stack' }
			);
			if (picked) {
				session.stack.sort = picked.sort;
			}
		})
	);
	return session;
}

async function reportErrors(action: () => Promise<void>): Promise<void> {
	try {
		await action();
	} catch (error) {
		void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
	}
}
