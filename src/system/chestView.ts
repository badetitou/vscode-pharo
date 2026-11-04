import * as vscode from 'vscode';
import { Chest, ChestContents, ChestItem, expectChestContents, expectChestKey } from './systemContracts';
import { SystemRequest } from './processesView';

// The Chest view: the objects kept by name in the chests of the image (github://pharo-spec/Chest), shared between the
// playground, the inspector and the debugger. An object goes in from the inspector (Store in Chest) and comes back
// with the code that answers it, as Paste object from chest does in Pharo.

export const CHEST_VIEW_ID = 'pharoChest';
export const CHEST_LIST_REQUEST = 'pls-chest:list';
export const CHEST_INSPECT_REQUEST = 'pls-chest:inspect';
export const CHEST_STORE_REQUEST = 'pls-chest:store';
export const CHEST_REMOVE_REQUEST = 'pls-chest:remove';
/** Set when Chest is loaded in the image, to tell the user how to load it otherwise. */
const AVAILABLE_CONTEXT_KEY = 'pharo.chest.available';

export const CHEST_LOAD_SCRIPT = `Metacello new
	baseline: 'Chest';
	repository: 'github://pharo-spec/Chest:main/src';
	load.`;

export type ChestNode =
	| { kind: 'chest'; chest: Chest }
	| { kind: 'item'; chest: string; item: ChestItem }
	| { kind: 'message'; text: string; icon: string };

/** An object of the image to store, as the inspector holds it. */
export interface StoreTarget {
	ref: string;
	label?: string;
}

export interface ChestUi {
	/** Answer the name to store an object under: empty for a name the chest chooses, undefined when cancelled. */
	askKey(label: string): PromiseLike<string | undefined>;
	pickChest(names: string[]): PromiseLike<string | undefined>;
	info(message: string): void;
	error(message: string): void;
}

export class ChestProvider implements vscode.TreeDataProvider<ChestNode> {
	private readonly changeEmitter = new vscode.EventEmitter<ChestNode | undefined>();
	readonly onDidChangeTreeData = this.changeEmitter.event;
	private contents: ChestContents | undefined;

	constructor(
		private readonly request: () => SystemRequest | undefined,
		private readonly setAvailable: (available: boolean) => void = (available) =>
			void vscode.commands.executeCommand('setContext', AVAILABLE_CONTEXT_KEY, available)
	) {}

	refresh(): void {
		this.changeEmitter.fire(undefined);
	}

	/** The chests the view shows, from its last refresh. */
	get chests(): Chest[] {
		return this.contents?.chests ?? [];
	}

	async getChildren(node?: ChestNode): Promise<ChestNode[]> {
		if (node?.kind === 'chest') {
			return node.chest.items.map((item) => ({ kind: 'item', chest: node.chest.name, item }));
		}
		const request = this.request();
		if (node || !request) {
			return [];
		}
		try {
			this.contents = expectChestContents(await request(CHEST_LIST_REQUEST), CHEST_LIST_REQUEST);
			this.setAvailable(this.contents.available);
			return this.contents.chests.map((chest) => ({ kind: 'chest', chest }));
		} catch (error) {
			return [{ kind: 'message', text: messageOf(error), icon: 'error' }];
		}
	}

	getTreeItem(node: ChestNode): vscode.TreeItem {
		switch (node.kind) {
			case 'chest': {
				const item = new vscode.TreeItem(node.chest.name, vscode.TreeItemCollapsibleState.Expanded);
				item.id = `chest/${node.chest.name}`;
				item.description = `${node.chest.items.length}`;
				item.iconPath = new vscode.ThemeIcon('archive');
				item.contextValue = 'pharoChest';
				return item;
			}
			case 'item': {
				const item = new vscode.TreeItem(node.item.key);
				item.id = `chest/${node.chest}/${node.item.key}`;
				item.description = node.item.printString;
				item.tooltip = tooltipOf(node.item);
				item.iconPath = new vscode.ThemeIcon('symbol-variable');
				item.contextValue = 'pharoChestItem';
				item.command = { command: 'pharo.chest.inspect', title: 'Inspect', arguments: [node] };
				return item;
			}
			case 'message': {
				const item = new vscode.TreeItem(node.text);
				item.iconPath = new vscode.ThemeIcon(node.icon);
				return item;
			}
		}
	}
}

function tooltipOf(item: ChestItem): vscode.MarkdownString {
	const tooltip = new vscode.MarkdownString();
	tooltip.appendMarkdown(`**${item.key}** — \`${item.className}\`\n\n`);
	tooltip.appendCodeblock(item.printString, 'pharo');
	tooltip.appendMarkdown('\n\n');
	tooltip.appendCodeblock(item.code, 'pharo');
	return tooltip;
}

/**
 * Store an object of the inspector in a chest: the only chest, or the one the user picks, under the name the user
 * gives (the chest names it when the name is empty). Answer the name, or undefined when cancelled or refused.
 */
export async function storeInChest(target: StoreTarget, chests: string[], request: SystemRequest, ui: ChestUi): Promise<string | undefined> {
	const chest = chests.length > 1 ? await ui.pickChest(chests) : chests[0];
	if (chests.length > 1 && chest === undefined) {
		return undefined;
	}
	const key = await ui.askKey(target.label ?? 'the object');
	if (key === undefined) {
		return undefined;
	}
	try {
		const stored = expectChestKey(
			await request(CHEST_STORE_REQUEST, { ref: target.ref, chest: chest ?? null, key: key.trim() === '' ? null : key.trim() }),
			CHEST_STORE_REQUEST
		);
		ui.info(`Stored in ${chest ?? 'the chest'} as "${stored}".`);
		return stored;
	} catch (error) {
		ui.error(`Cannot store in the chest: ${messageOf(error)}`);
		return undefined;
	}
}

const vscodeUi: ChestUi = {
	askKey: (label) =>
		vscode.window.showInputBox({
			title: 'Store in Chest',
			prompt: `Name of ${label} in the chest (leave empty for a name the chest chooses)`,
			validateInput: (value) => /^\s*$|^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value) ? undefined : 'A name is a letter followed by letters, digits or _'
		}),
	pickChest: (names) => vscode.window.showQuickPick(names, { title: 'Store in Chest', placeHolder: 'Chest' }),
	info: (message) => void vscode.window.showInformationMessage(message),
	error: (message) => void vscode.window.showErrorMessage(message)
};

export function registerChestView(context: vscode.ExtensionContext, request: () => SystemRequest | undefined): ChestProvider {
	const provider = new ChestProvider(request);
	const view = vscode.window.createTreeView(CHEST_VIEW_ID, { treeDataProvider: provider });
	const withItem = (action: (node: Extract<ChestNode, { kind: 'item' }>, server: SystemRequest) => PromiseLike<unknown>) =>
		async (node?: ChestNode) => {
			const target = node ?? view.selection[0];
			const server = request();
			if (target?.kind === 'item' && server) {
				try {
					await action(target, server);
				} catch (error) {
					vscodeUi.error(messageOf(error));
				}
			}
		};
	context.subscriptions.push(
		view,
		view.onDidChangeVisibility((event) => event.visible && provider.refresh()),
		vscode.commands.registerCommand('pharo.chest.refresh', () => provider.refresh()),
		vscode.commands.registerCommand('pharo.chest.inspect', withItem(async (node, server) => {
			const object = await server(CHEST_INSPECT_REQUEST, { chest: node.chest, key: node.item.key }) as { ref?: unknown };
			if (typeof object?.ref === 'string') {
				// The inspector takes the reference over and releases it
				await vscode.commands.executeCommand('pharo.inspector.inspect', { ref: object.ref, label: node.item.key });
			}
		})),
		vscode.commands.registerCommand('pharo.chest.copyCode', withItem(async (node) => {
			await vscode.env.clipboard.writeText(node.item.code);
		})),
		vscode.commands.registerCommand('pharo.chest.insertCode', withItem(async (node) => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				await vscode.env.clipboard.writeText(node.item.code);
				vscodeUi.info('No editor is active: the code is copied to the clipboard.');
				return;
			}
			await editor.edit((edit) => editor.selections.forEach((selection) => edit.replace(selection, node.item.code)));
		})),
		vscode.commands.registerCommand('pharo.chest.remove', withItem(async (node, server) => {
			await server(CHEST_REMOVE_REQUEST, { chest: node.chest, key: node.item.key });
			provider.refresh();
		})),
		vscode.commands.registerCommand('pharo.chest.store', async (target?: StoreTarget) => {
			const server = request();
			if (!server || typeof target?.ref !== 'string') {
				return;
			}
			if (provider.chests.length === 0) {
				await provider.getChildren();
			}
			if (await storeInChest(target, provider.chests.map((chest) => chest.name), server, vscodeUi)) {
				provider.refresh();
			}
		}),
		vscode.commands.registerCommand('pharo.chest.copyLoadScript', async () => {
			await vscode.env.clipboard.writeText(CHEST_LOAD_SCRIPT);
			vscodeUi.info('The script that loads Chest is copied: evaluate it in a playground, then refresh the Chest view.');
		})
	);
	return provider;
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
