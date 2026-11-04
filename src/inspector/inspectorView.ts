import * as vscode from 'vscode';
import { InspectedObject, InspectorItem, expectInspectorView } from './inspectorContracts';
import { InspectorRequest, InspectorSession } from './inspectorSession';

// The Inspector view, docked in the panel, and the quick inspector, a hover on the code of an Inspect it.
// Other features open the view on an object of the image with the command pharo.inspector.inspect, given the
// reference of the object or an expression to evaluate.

export const INSPECTOR_VIEW_ID = 'pharoInspector';
/** Number of slots the quick inspector shows. */
const QUICK_INSPECTOR_SLOTS = 10;
/** Number of lines of a text view the tree shows; the whole text opens in an editor. */
const MAXIMUM_TEXT_LINES = 500;
const BREADCRUMB_LABEL_LENGTH = 30;

export type InspectorNode =
	| { kind: 'item'; item: InspectorItem; parent?: InspectorItem }
	/** Shows the next items of the view, or of the parent item. */
	| { kind: 'more'; parent?: InspectorItem; remaining: number }
	| { kind: 'line'; text: string; index: number }
	| { kind: 'message'; text: string; icon: string };

/** What the command pharo.inspector.inspect accepts: the reference of an object of the image, or an expression to evaluate. */
export interface InspectTarget {
	ref?: string;
	expression?: string;
	/** URI of the document whose bindings the expression uses. */
	textDocumentURI?: unknown;
	/** Label of the page in the breadcrumb, the expression by default. */
	label?: string;
}

export class InspectorTreeProvider implements vscode.TreeDataProvider<InspectorNode> {

	private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<InspectorNode | undefined>();
	readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

	constructor(readonly session: InspectorSession) {}

	refresh(): void {
		this.onDidChangeTreeDataEmitter.fire(undefined);
	}

	dispose(): void {
		this.onDidChangeTreeDataEmitter.dispose();
	}

	async getChildren(node?: InspectorNode): Promise<InspectorNode[]> {
		const page = this.session.current;
		if (!page) {
			return [];
		}
		if (node) {
			if (node.kind !== 'item') {
				return [];
			}
			const children = await this.session.childrenOf(node.item);
			return withMore(children.items.map((item) => ({ kind: 'item', item, parent: node.item })), children.total, node.item);
		}
		const nodes: InspectorNode[] = page.object.error === undefined
			? []
			: [{ kind: 'message', text: page.object.error || page.object.className, icon: 'error' }];
		const view = page.view;
		if (!view) {
			return nodes;
		}
		switch (view.kind) {
			case 'tree':
			case 'table':
				return [...nodes, ...withMore(view.items.map((item) => ({ kind: 'item', item })), view.total)];
			case 'text': {
				const lines = view.text.split(/\r?\n/);
				return [
					...nodes,
					...lines.slice(0, MAXIMUM_TEXT_LINES).map((text, index): InspectorNode => ({ kind: 'line', text, index })),
					...(lines.length > MAXIMUM_TEXT_LINES ? [{ kind: 'more' as const, remaining: lines.length - MAXIMUM_TEXT_LINES }] : [])
				];
			}
			case 'unsupported':
				return [...nodes, { kind: 'message', text: view.text, icon: 'info' }];
		}
	}

	getTreeItem(node: InspectorNode): vscode.TreeItem {
		const serial = this.session.current?.serial ?? 0;
		switch (node.kind) {
			case 'item': {
				const { item } = node;
				const cells = item.cells;
				const treeItem = new vscode.TreeItem(
					cells && cells.length > 0 ? cells[0] : item.name,
					item.hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
				);
				treeItem.id = `${serial}/${node.parent?.ref ?? ''}/${item.ref}`;
				treeItem.description = cells && cells.length > 1 ? cells.slice(1).join(' │ ') : item.printString;
				treeItem.tooltip = itemTooltip(item);
				treeItem.iconPath = new vscode.ThemeIcon(cells ? 'symbol-enum-member' : 'symbol-field');
				treeItem.contextValue = 'pharoInspectorItem';
				return treeItem;
			}
			case 'more': {
				const treeItem = new vscode.TreeItem(`Show more (${node.remaining} remaining)`);
				treeItem.id = `${serial}/${node.parent?.ref ?? ''}/more`;
				treeItem.iconPath = new vscode.ThemeIcon('ellipsis');
				treeItem.command = { command: 'pharo.inspector.loadMore', title: 'Show more', arguments: [node] };
				return treeItem;
			}
			case 'line': {
				const treeItem = new vscode.TreeItem(node.text.length > 0 ? node.text : ' ');
				treeItem.id = `${serial}/line/${node.index}`;
				return treeItem;
			}
			case 'message': {
				const treeItem = new vscode.TreeItem(node.text);
				treeItem.iconPath = new vscode.ThemeIcon(node.icon);
				treeItem.tooltip = node.text;
				return treeItem;
			}
		}
	}
}

function withMore(nodes: InspectorNode[], total: number, parent?: InspectorItem): InspectorNode[] {
	return total > nodes.length ? [...nodes, { kind: 'more', parent, remaining: total - nodes.length }] : nodes;
}

function itemTooltip(item: InspectorItem): vscode.MarkdownString {
	const tooltip = new vscode.MarkdownString();
	tooltip.appendMarkdown(`**${escapeMarkdown(item.name)}** — \`${item.className}\`\n\n`);
	tooltip.appendCodeblock(item.printString, 'pharo');
	return tooltip;
}

/** Answer the breadcrumb of the pages, from the first one to the current one. */
export function breadcrumbOf(labels: readonly string[]): string {
	return labels.map((label) => {
		const line = label.replace(/\s+/g, ' ').trim();
		return line.length > BREADCRUMB_LABEL_LENGTH ? `${line.slice(0, BREADCRUMB_LABEL_LENGTH - 1)}…` : line;
	}).join(' › ');
}

/** Answer the code an Inspect it evaluates in editor: its selection, or the line of the cursor when nothing is selected. */
export function codeToEvaluate(editor: vscode.TextEditor): { code: string; range: vscode.Range } {
	const selection = editor.selection;
	const range = selection.isEmpty ? editor.document.lineAt(selection.active.line).range : selection;
	return { code: editor.document.getText(range), range };
}

/** An object the quick inspector shows when hovering the code that answered it. */
interface QuickInspection {
	range: vscode.Range;
	object: InspectedObject;
	slots: InspectorItem[];
	totalSlots: number;
	/** References the inspection received and releases when it goes away. */
	refs: Set<string>;
}

/** The quick inspector: a hover on the code of the last Inspect it of each document. */
export class QuickInspector implements vscode.HoverProvider {

	private readonly inspections = new Map<string, QuickInspection>();

	constructor(private readonly request: () => InspectorRequest | undefined) {}

	/** Show object, which the code at range of document answered, when hovering that code; the inspection owns the reference of object when ownsObject is true. */
	async record(document: vscode.TextDocument, range: vscode.Range, object: InspectedObject, ownsObject: boolean): Promise<void> {
		const request = this.request();
		const refs = new Set<string>(ownsObject ? [object.ref] : []);
		let slots: InspectorItem[] = [];
		let totalSlots = 0;
		if (request) {
			try {
				const view = expectInspectorView(
					await request('pls-inspector:view', { ref: object.ref, view: 'raw', offset: 0, limit: QUICK_INSPECTOR_SLOTS }),
					'pls-inspector:view'
				);
				if (view.kind === 'tree' || view.kind === 'table') {
					slots = view.items;
					totalSlots = view.total;
					slots.forEach((slot) => refs.add(slot.ref));
				}
			} catch {
				// The quick inspector then shows the object without its slots.
			}
		}
		this.forget(document.uri);
		this.inspections.set(document.uri.toString(), { range, object, slots, totalSlots, refs });
	}

	/** Stop owning the reference ref, which the Inspector view owns from now on; answer whether the quick inspector owned it. */
	disown(ref: string): boolean {
		for (const inspection of this.inspections.values()) {
			if (inspection.refs.delete(ref)) {
				return true;
			}
		}
		return false;
	}

	/** Forget the inspection of the document of uri, which the edit of its code makes stale. */
	forget(uri: vscode.Uri, change?: vscode.TextDocumentContentChangeEvent): void {
		const inspection = this.inspections.get(uri.toString());
		if (!inspection || (change && change.range.start.isAfter(inspection.range.end))) {
			return;
		}
		this.inspections.delete(uri.toString());
		this.release([...inspection.refs]);
	}

	forgetAll(): void {
		const refs = [...this.inspections.values()].flatMap((inspection) => [...inspection.refs]);
		this.inspections.clear();
		this.release(refs);
	}

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
		const inspection = this.inspections.get(document.uri.toString());
		if (!inspection || !inspection.range.contains(position)) {
			return undefined;
		}
		return new vscode.Hover(quickInspectorMarkdown(inspection), inspection.range);
	}

	private release(refs: string[]): void {
		const request = this.request();
		if (request && refs.length > 0) {
			void request('pls-inspector:release', { refs }).catch(() => undefined);
		}
	}
}

function quickInspectorMarkdown(inspection: QuickInspection): vscode.MarkdownString {
	const { object } = inspection;
	const markdown = new vscode.MarkdownString(undefined, true);
	markdown.isTrusted = { enabledCommands: ['pharo.inspector.inspect'] };
	if (object.error !== undefined) {
		markdown.appendMarkdown(`$(error) ${escapeMarkdown(object.error || object.className)}\n\n`);
	}
	markdown.appendMarkdown(`**${escapeMarkdown(object.className)}**\n`);
	markdown.appendCodeblock(object.printString, 'pharo');
	if (inspection.slots.length > 0) {
		markdown.appendMarkdown(`\n| ${'Slot'} | ${'Value'} |\n|---|---|\n`);
		for (const slot of inspection.slots) {
			markdown.appendMarkdown(`| ${tableCell(slot.name)} | ${tableCell(slot.printString)} |\n`);
		}
		if (inspection.totalSlots > inspection.slots.length) {
			markdown.appendMarkdown(`\n${inspection.totalSlots - inspection.slots.length} more\n`);
		}
	}
	const target: InspectTarget = { ref: object.ref, label: object.printString };
	const args = encodeURIComponent(JSON.stringify([target]));
	markdown.appendMarkdown(`\n[$(search) ${'Open in the Inspector'}](command:pharo.inspector.inspect?${args})`);
	return markdown;
}

function tableCell(text: string): string {
	const line = text.replace(/\s+/g, ' ');
	return escapeMarkdown(line.length > 80 ? `${line.slice(0, 79)}…` : line).replace(/\|/g, '\\|');
}

function escapeMarkdown(text: string): string {
	return text.replace(/[\\`*_{}[\]()#+\-.!<>]/g, '\\$&');
}

/**
 * Register the Inspector view, the quick inspector and their commands. request answers how to send a request to the
 * language server, or undefined while it does not run or does not provide the inspector.
 */
export function registerInspector(context: vscode.ExtensionContext, request: () => InspectorRequest | undefined): InspectorTreeProvider {
	const session = new InspectorSession((method, params) => {
		const send = request();
		return send ? send(method, params) : Promise.reject(new Error('The Pharo Language Server does not provide the inspector.'));
	});
	const provider = new InspectorTreeProvider(session);
	const treeView = vscode.window.createTreeView(INSPECTOR_VIEW_ID, { treeDataProvider: provider, showCollapseAll: true });
	const quick = new QuickInspector(request);

	const update = () => {
		const page = session.current;
		treeView.title = page ? `Inspector: ${page.object.className}` : 'Inspector';
		treeView.description = breadcrumbOf(session.pages.map((each) => each.label));
		const viewTitle = page?.object.views.find((view) => view.id === page.viewId)?.title;
		treeView.message = page ? `${viewTitle ? `[${viewTitle}] ` : ''}${page.object.printString}` : undefined;
		void vscode.commands.executeCommand('setContext', 'pharo.inspector.hasPage', page !== undefined);
		void vscode.commands.executeCommand('setContext', 'pharo.inspector.canGoBack', session.pages.length > 1);
		void vscode.commands.executeCommand('setContext', 'pharo.inspector.isText', page?.view?.kind === 'text');
		provider.refresh();
	};
	const run = (action: () => Promise<unknown>) => async () => {
		try {
			await action();
		} catch (error) {
			void vscode.window.showErrorMessage(`Pharo Inspector: ${formatError(error)}`);
		}
		update();
	};
	const show = async () => {
		await vscode.commands.executeCommand(`${INSPECTOR_VIEW_ID}.focus`);
	};
	const inspectEditor = (quickOnly: boolean) => run(async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const { code, range } = codeToEvaluate(editor);
		if (code.trim().length === 0) {
			return;
		}
		const object = await session.evaluate(code, { textDocumentURI: editor.document.uri });
		if (quickOnly) {
			await quick.record(editor.document, range, object, true);
			editor.selection = new vscode.Selection(range.start, range.end);
			await vscode.commands.executeCommand('editor.action.showHover');
			return;
		}
		await session.open(object, code, true);
		await quick.record(editor.document, range, object, false);
		await show();
	});

	context.subscriptions.push(
		treeView,
		provider,
		{ dispose: () => { quick.forgetAll(); void session.closeAll(); } },
		vscode.languages.registerHoverProvider({ language: 'pharo' }, quick),
		vscode.workspace.onDidChangeTextDocument((event) => event.contentChanges.forEach((change) => quick.forget(event.document.uri, change))),
		vscode.workspace.onDidCloseTextDocument((document) => quick.forget(document.uri)),
		vscode.commands.registerCommand('pharo.inspectIt', inspectEditor(false)),
		vscode.commands.registerCommand('pharo.quickInspectIt', inspectEditor(true)),
		vscode.commands.registerCommand('pharo.inspector.inspect', (target?: InspectTarget) => run(async () => {
			if (target?.ref !== undefined) {
				// The caller hands the reference over: the view releases it when its page closes.
				quick.disown(target.ref);
				const object = await session.describe(target.ref);
				await session.open(object, target.label ?? object.printString, true);
			} else if (target?.expression !== undefined) {
				const object = await session.evaluate(target.expression, { textDocumentURI: target.textDocumentURI });
				await session.open(object, target.label ?? target.expression, true);
			} else {
				return;
			}
			await show();
		})()),
		vscode.commands.registerCommand('pharo.inspector.dive', (node?: InspectorNode) => run(async () => {
			const target = node ?? treeView.selection[0];
			if (target?.kind === 'item') {
				await session.dive(target.item);
			}
		})()),
		vscode.commands.registerCommand('pharo.inspector.back', run(() => session.back())),
		vscode.commands.registerCommand('pharo.inspector.breadcrumb', run(async () => {
			const pages = session.pages;
			const picked = await vscode.window.showQuickPick(
				pages.map((page, index) => ({ label: page.label.replace(/\s+/g, ' '), description: page.object.className, index })).reverse(),
				{ placeHolder: 'Go back to an inspected object' }
			);
			if (picked) {
				await session.backTo(picked.index);
			}
		})),
		vscode.commands.registerCommand('pharo.inspector.selectView', run(async () => {
			const page = session.current;
			if (!page) {
				return;
			}
			const picked = await vscode.window.showQuickPick(
				page.object.views.map((view) => ({ label: view.title, description: view.id === page.viewId ? 'current' : undefined, id: view.id })),
				{ placeHolder: `Show a view of ${page.object.printString}` }
			);
			if (picked) {
				await session.selectView(picked.id);
			}
		})),
		vscode.commands.registerCommand('pharo.inspector.evaluate', run(async () => {
			const page = session.current;
			if (!page) {
				return;
			}
			const expression = await vscode.window.showInputBox({
				title: `Evaluate with self = ${page.object.printString}`,
				placeHolder: 'self',
				prompt: 'The result opens in a new page of the Inspector.'
			});
			if (!expression || expression.trim().length === 0) {
				return;
			}
			await session.push(await session.evaluate(expression, { receiver: page.object.ref }), expression, true);
		})),
		vscode.commands.registerCommand('pharo.inspector.refresh', run(() => session.refresh())),
		vscode.commands.registerCommand('pharo.inspector.close', run(() => session.closeAll())),
		vscode.commands.registerCommand('pharo.inspector.loadMore', (node?: InspectorNode) => run(async () => {
			if (node?.kind !== 'more') {
				return;
			}
			if (node.parent) {
				await session.childrenOf(node.parent, true);
			} else if (session.current?.view?.kind === 'text') {
				await openText();
			} else {
				await session.loadMoreItems();
			}
		})()),
		vscode.commands.registerCommand('pharo.inspector.openText', run(() => openText())),
		vscode.commands.registerCommand('pharo.inspector.copyPrintString', async (node?: InspectorNode) => {
			if (node?.kind === 'item') {
				await vscode.env.clipboard.writeText(node.item.printString);
			}
		}),
		// The item of the view, or else the object of the page, goes in a chest of the Chest view
		vscode.commands.registerCommand('pharo.inspector.storeInChest', async (node?: InspectorNode) => {
			const target = node?.kind === 'item'
				? { ref: node.item.ref, label: node.item.name }
				: session.current && { ref: session.current.object.ref, label: session.current.label };
			if (target) {
				await vscode.commands.executeCommand('pharo.chest.store', target);
			}
		})
	);

	async function openText(): Promise<void> {
		const view = session.current?.view;
		if (view?.kind === 'text') {
			await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: view.text }), { preview: true });
		}
	}

	update();
	return provider;
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
