import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { locationOf } from './entityCommands';
import { ENTITY_SCHEME, entityUri } from './entityUri';
import { ENV_SEARCH_KINDS, EnvNode, EnvSearchItem, EnvSearchKind, parseEnvId } from './envContracts';
import { packageNameOfEnvId } from './environmentChanges';
import { PharoEnvironment } from './pharoEnvironment';

// Pharo: Spotter, one Quick Pick to find the entities of the image, the open Pharo editors and the Pharo commands.
// A prefix of the query keeps one category: `#` classes, `>>` methods, `@` packages, `!` projects.

export interface SpotterQuery {
	/** The kinds of entities to search for. */
	kinds: EnvSearchKind[];
	/** False when a prefix keeps one kind of entities only: open editors and commands are left out. */
	others: boolean;
	text: string;
}

const PREFIXES: Array<[string, EnvSearchKind]> = [['>>', 'method'], ['#', 'class'], ['@', 'package'], ['!', 'project']];
/** Most results of each kind, when searching all kinds and when searching one kind. */
const LIMIT_PER_KIND = 20;
const LIMIT_ONE_KIND = 100;
/** Time to wait for the next keystroke before searching. */
const TYPING_DELAY = 50;

const ICONS: Record<string, string> = {
	project: '$(project)',
	package: '$(package)',
	tag: '$(tag)',
	extensions: '$(extensions)',
	class: '$(symbol-class)',
	method: '$(symbol-method)'
};

interface SpotterItem extends vscode.QuickPickItem {
	/** An entity of the image to open or dive into. */
	entity?: EnvNode;
	/** An open editor to show. */
	tab?: { uri: vscode.Uri; viewColumn: vscode.ViewColumn };
	/** A command to run. */
	command?: string;
}

export function parseSpotterQuery(value: string): SpotterQuery {
	const trimmed = value.trimStart();
	for (const [prefix, kind] of PREFIXES) {
		if (trimmed.startsWith(prefix)) {
			return { kinds: [kind], others: false, text: trimmed.slice(prefix.length).trim() };
		}
	}
	return { kinds: [...ENV_SEARCH_KINDS], others: true, text: trimmed.trim() };
}

/** Answer whether text holds every word of query, ignoring case. */
export function matchesWords(text: string, query: string): boolean {
	const lowercase = text.toLowerCase();
	return query.toLowerCase().split(/\s+/).every((word) => lowercase.includes(word));
}

/** Answer the Quick Pick item of a search result. A method found from another class names the class that defines it. */
export function searchItemOf(item: EnvSearchItem): SpotterItem {
	const packageName = item.package ? packageNameOfEnvId(item.package) : undefined;
	let description = packageName;
	if (item.kind === 'method') {
		const definer = parseEnvId(item.id).path.replace(/>>.*$/, '');
		if (!item.label.startsWith(`${definer}>>`)) {
			description = packageName ? `${definer} · ${packageName}` : definer;
		}
	}
	return { label: `${ICONS[item.kind]} ${item.label}`, description, entity: item, alwaysShow: true };
}

/** Register the command Pharo: Spotter. */
export function registerSpotter(context: vscode.ExtensionContext, environment: () => PharoEnvironment | undefined): void {
	context.subscriptions.push(vscode.commands.registerCommand('pharo.env.spotter', async (initialValue?: unknown) => {
		const current = environment();
		if (!current?.capabilities.search) {
			void vscode.window.showErrorMessage('The Pharo Language Server is not running, or cannot search the image (pls-env:search).');
			return;
		}
		await spot(current, pharoCommands(context), typeof initialValue === 'string' ? initialValue : '');
	}));
}

async function spot(environment: PharoEnvironment, commands: SpotterItem[], initialValue: string): Promise<void> {
	const picker = vscode.window.createQuickPick<SpotterItem>();
	picker.title = 'Pharo Spotter';
	picker.placeholder = 'Search the image: Array, Array col, Array class>>new:. Prefixes: # classes, >> methods, @ packages, ! projects';
	picker.matchOnDescription = false;
	const preview = new Preview(environment);
	let search: vscode.CancellationTokenSource | undefined;
	let typing: NodeJS.Timeout | undefined;

	const update = (value: string) => {
		search?.cancel();
		search?.dispose();
		clearTimeout(typing);
		const query = parseSpotterQuery(value);
		const others = query.others ? [...openEditors(query.text), ...commands.filter((item) => matchesWords(`${item.label} ${item.description}`, query.text))] : [];
		if (!query.text) {
			picker.items = others;
			picker.busy = false;
			return;
		}
		const source = new vscode.CancellationTokenSource();
		search = source;
		picker.busy = true;
		typing = setTimeout(async () => {
			const limit = query.kinds.length === 1 ? LIMIT_ONE_KIND : LIMIT_PER_KIND;
			try {
				const result = await environment.search(query.text, { kinds: query.kinds, limit }, source.token);
				if (!source.token.isCancellationRequested) {
					picker.items = [...result.items.map(searchItemOf), ...others];
				}
			} catch (error) {
				if (!source.token.isCancellationRequested) {
					picker.items = [{ label: '$(error) The search failed', detail: error instanceof Error ? error.message : String(error), alwaysShow: true }, ...others];
				}
			} finally {
				if (search === source) {
					picker.busy = false;
				}
			}
		}, TYPING_DELAY);
	};

	picker.onDidChangeValue(update);
	picker.onDidChangeActive(([item]) => {
		if (item?.entity && (item.entity.kind === 'class' || item.entity.kind === 'method')) {
			void preview.show(item.entity.id);
		}
	});
	picker.onDidAccept(async () => {
		const [item] = picker.selectedItems;
		if (!item) {
			return;
		}
		if (item.entity?.kind === 'class' || item.entity?.kind === 'method') {
			preview.keep();
		}
		picker.hide();
		try {
			await accept(environment, item);
		} catch (error) {
			void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
		}
	});
	picker.onDidHide(() => {
		search?.cancel();
		search?.dispose();
		clearTimeout(typing);
		void preview.close();
		picker.dispose();
	});
	picker.value = initialValue;
	update(initialValue);
	picker.show();
}

async function accept(environment: PharoEnvironment, item: SpotterItem): Promise<void> {
	if (item.command) {
		await vscode.commands.executeCommand(item.command);
	} else if (item.tab) {
		await vscode.window.showTextDocument(item.tab.uri, { viewColumn: item.tab.viewColumn, preview: false });
	} else if (item.entity) {
		await openOrDive(environment, item.entity);
	}
}

/** Open the editor of a class or method; for a project or package, choose one of its packages or classes. */
async function openOrDive(environment: PharoEnvironment, entity: EnvNode): Promise<void> {
	if (entity.kind === 'class' || entity.kind === 'method') {
		await vscode.window.showTextDocument(entityUri(await locationOf(environment, entity.id)), { preview: false });
		return;
	}
	const picker = vscode.window.createQuickPick<SpotterItem>();
	picker.title = `Pharo Spotter: ${entity.name}`;
	picker.placeholder = entity.kind === 'project' ? 'Choose a package' : 'Choose a class';
	picker.busy = true;
	picker.show();
	try {
		picker.items = (await contentsOf(environment, entity)).map((node) => ({ label: `${ICONS[node.kind]} ${node.name}`, entity: node }));
	} finally {
		picker.busy = false;
	}
	const chosen = await new Promise<SpotterItem | undefined>((resolve) => {
		picker.onDidAccept(() => {
			resolve(picker.selectedItems[0]);
			picker.hide();
		});
		picker.onDidHide(() => {
			resolve(undefined);
			picker.dispose();
		});
	});
	if (chosen?.entity) {
		await openOrDive(environment, chosen.entity);
	}
}

/** Answer the packages of a project, or the classes of a package, its tags flattened. */
async function contentsOf(environment: PharoEnvironment, entity: EnvNode): Promise<EnvNode[]> {
	const children = await environment.children(entity.id);
	if (entity.kind !== 'package') {
		return children;
	}
	const classes = await Promise.all(children.map(async (child) => child.kind === 'tag' ? environment.children(child.id) : child.kind === 'class' ? [child] : []));
	return classes.flat().sort((a, b) => a.name.localeCompare(b.name));
}

/** The open editors of Pharo code: entity editors, `pharoImage:` classes and `.st` files. */
function openEditors(query: string): SpotterItem[] {
	return vscode.window.tabGroups.all.flatMap((group) => group.tabs.flatMap((tab): SpotterItem[] => {
		if (!(tab.input instanceof vscode.TabInputText)) {
			return [];
		}
		const uri = tab.input.uri;
		if (uri.scheme !== ENTITY_SCHEME && uri.scheme !== 'pharoImage' && !uri.path.endsWith('.st')) {
			return [];
		}
		if (query && !matchesWords(tab.label, query)) {
			return [];
		}
		return [{ label: `$(file-code) ${tab.label}`, description: 'Open editor', tab: { uri, viewColumn: group.viewColumn }, alwaysShow: true }];
	}));
}

interface ContributedCommand {
	command: string;
	title: string;
	category?: string;
	enablement?: string;
}

/** The commands that the extension contributes in a Pharo category, with their localized titles. */
function pharoCommands(context: vscode.ExtensionContext): SpotterItem[] {
	const contributes = context.extension.packageJSON.contributes ?? {};
	const commands: ContributedCommand[] = contributes.commands ?? [];
	const palette: Array<{ command: string; when?: string }> = contributes.menus?.commandPalette ?? [];
	const hidden = new Set(palette.filter((entry) => entry.when === 'false').map((entry) => entry.command));
	const titles = localizedTitles(context.extensionPath);
	return commands
		.filter((command) => command.category?.startsWith('Pharo') && command.command !== 'pharo.env.spotter'
			&& command.enablement !== 'false' && !hidden.has(command.command))
		.map((command) => ({
			label: `$(terminal) ${command.category}: ${titles(command.title)}`,
			description: 'Command',
			command: command.command,
			alwaysShow: true
		}));
}

/** Answer a function that replaces a `%key%` title of package.json by its text in the language of VS Code. */
function localizedTitles(extensionPath: string): (title: string) => string {
	const read = (file: string): Record<string, string> => {
		try {
			return JSON.parse(fs.readFileSync(path.join(extensionPath, file), 'utf8'));
		} catch {
			return {};
		}
	};
	const messages = { ...read('package.nls.json'), ...read(`package.nls.${vscode.env.language}.json`) };
	return (title) => title.replace(/^%(.+)%$/, (whole, key: string) => messages[key] ?? whole);
}

/** Shows the editor of the active entity while the Spotter is open, and closes the editors it opened unless one is kept. */
class Preview {
	private readonly opened = new Set<string>();
	private readonly previousEditor = vscode.window.activeTextEditor;
	private latest = 0;
	private kept = false;

	constructor(private readonly environment: PharoEnvironment) { }

	async show(id: string): Promise<void> {
		const request = ++this.latest;
		try {
			const uri = entityUri(await locationOf(this.environment, id));
			if (request !== this.latest || this.kept) {
				return;
			}
			if (!isOpen(uri)) {
				this.opened.add(uri.toString());
			}
			await vscode.window.showTextDocument(uri, { preview: true, preserveFocus: true });
		} catch {
			// An entity removed meanwhile shows no preview.
		}
	}

	/** Keep the editor about to be opened by the selection. */
	keep(): void {
		this.kept = true;
	}

	async close(): Promise<void> {
		if (this.kept) {
			return;
		}
		const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs)
			.filter((tab) => tab.isPreview && tab.input instanceof vscode.TabInputText && this.opened.has(tab.input.uri.toString()));
		await vscode.window.tabGroups.close(tabs);
		if (this.previousEditor && !this.previousEditor.document.isClosed) {
			await vscode.window.showTextDocument(this.previousEditor.document, this.previousEditor.viewColumn);
		}
	}
}

function isOpen(uri: vscode.Uri): boolean {
	return vscode.window.tabGroups.all.some((group) => group.tabs.some((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString()));
}
