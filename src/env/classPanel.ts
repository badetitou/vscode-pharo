import * as path from 'path';
import * as vscode from 'vscode';
import { EnvEntity, EnvNode, isEnvUnknownEntityError } from './envContracts';
import { EnvChangeSummary, classNameOfEnvId } from './environmentChanges';
import { openNewMethod, pickProtocol, reportErrors, requireEnvironment } from './entityCommands';
import { PharoEntityFileSystem } from './entityFileSystem';
import { EntitySide, parseEntityUri } from './entityUri';
import { PharoEnvironment } from './pharoEnvironment';

// Class panel: the slots, protocols and methods of the class of the active editor, on one of its sides, or the methods
// of the traits it uses. It lives in the Secondary Side Bar, as the class pane of Pulsar.

export const CLASS_PANEL_VIEW_ID = 'pharoClassPanel';

export type ClassPanelMode = EntitySide | 'traits';

/** What the panel needs from the environment, so that tests can use a fake image. */
export type ClassPanelEnvironment = Pick<PharoEnvironment, 'entity' | 'children' | 'invalidate'>;

export type ClassPanelItem =
	| { kind: 'section'; key: string; section: 'slots' | 'protocols' }
	| { kind: 'slot'; key: string; parentKey: string; name: string; sideId: string; classVariable: boolean }
	| { kind: 'protocol'; key: string; parentKey: string; sideId: string; name: string; protocolId: string | undefined; methods: EnvNode[] }
	| { kind: 'trait'; key: string; traitId: string }
	| { kind: 'traitClassSide'; key: string; parentKey: string; traitId: string }
	| { kind: 'method'; key: string; parentKey: string; node: EnvNode; overridden: boolean };

export const ALL_PROTOCOLS = '(All)';

interface SideContents {
	slots: ClassPanelItem[];
	protocols: Array<Extract<ClassPanelItem, { kind: 'protocol' }>>;
}

/**
 * Tree of the class panel. The items of one class are loaded at once, so that the panel can reveal the method of
 * the active editor: getParent answers from what is loaded.
 */
export class ClassPanelProvider implements vscode.TreeDataProvider<ClassPanelItem>, vscode.Disposable {
	private readonly changeEmitter = new vscode.EventEmitter<ClassPanelItem | undefined>();
	private readonly items = new Map<string, ClassPanelItem>();
	private readonly childrenOf = new Map<string, ClassPanelItem[]>();
	private roots: ClassPanelItem[] = [];
	private loading: Promise<void> = Promise.resolve();
	private generation = 0;

	readonly onDidChangeTreeData: vscode.Event<ClassPanelItem | undefined> = this.changeEmitter.event;

	className: string | undefined;
	mode: ClassPanelMode = 'instance';
	filter = '';
	/** The traits the class uses, once loaded. */
	traits: string[] = [];
	/** Why the panel is empty, if it is. */
	message: string | undefined;

	constructor(private readonly environment: () => ClassPanelEnvironment | undefined) { }

	/** Show className on a side, or its traits. The panel loads it before telling the tree. */
	show(className: string | undefined, mode: ClassPanelMode = this.mode): Promise<void> {
		this.className = className;
		this.mode = mode;
		return this.reload();
	}

	setFilter(filter: string): Promise<void> {
		this.filter = filter.trim();
		return this.reload();
	}

	/** Load again the current class, dropping what the environment cached about its sides. */
	reload(): Promise<void> {
		const generation = ++this.generation;
		const environment = this.environment();
		if (environment && this.className) {
			for (const sideId of [`side:${this.className}`, `side:${this.className} class`]) {
				environment.invalidate(sideId);
			}
		}
		this.loading = this.load(generation).then(() => {
			if (generation === this.generation) {
				this.changeEmitter.fire(undefined);
			}
		});
		return this.loading;
	}

	/** Reload when a burst of changes of the image touched the class, its sides or one of its traits. */
	applyChanges(summary: EnvChangeSummary): Promise<void> | undefined {
		if (!this.className) {
			return undefined;
		}
		const shown = new Set([this.className, ...this.traits.map((id) => id.slice('class:'.length))]);
		const touched = summary.reset || [...summary.classes, ...summary.removedClasses].some((name) => shown.has(name));
		return touched ? this.reload() : undefined;
	}

	/** Answer the item of a method once the panel shows it, loading the current class first. */
	async methodItem(methodId: string): Promise<ClassPanelItem | undefined> {
		await this.loading;
		const items = [...this.items.values()].filter((item) => item.kind === 'method' && item.node.id === methodId);
		// A method shows in (All) and in its protocol: reveal it in its protocol.
		return items.find((item) => item.kind === 'method' && !item.parentKey.endsWith(`>>${ALL_PROTOCOLS}`)) ?? items[0];
	}

	getTreeItem(item: ClassPanelItem): vscode.TreeItem {
		return treeItemOf(item, this.filter !== '');
	}

	async getChildren(item?: ClassPanelItem): Promise<ClassPanelItem[]> {
		await this.loading;
		return item ? this.childrenOf.get(item.key) ?? [] : this.roots;
	}

	getParent(item: ClassPanelItem): ClassPanelItem | undefined {
		return 'parentKey' in item ? this.items.get(item.parentKey) : undefined;
	}

	dispose(): void {
		this.changeEmitter.dispose();
	}

	private async load(generation: number): Promise<void> {
		const environment = this.environment();
		const roots: ClassPanelItem[] = [];
		const childrenOf = new Map<string, ClassPanelItem[]>();
		let message: string | undefined;
		let traits: string[] = [];
		if (!environment) {
			message = 'The Pharo Language Server does not provide the environment model (pls-env).';
		} else if (this.className) {
			try {
				const instanceSide = await environment.entity(`side:${this.className}`);
				traits = instanceSide.traits ?? [];
				if (this.mode === 'traits') {
					await this.loadTraits(environment, traits, roots, childrenOf);
					message = traits.length === 0 ? `${this.className} uses no trait.` : undefined;
				} else {
					const sideId = this.mode === 'class' ? `side:${this.className} class` : `side:${this.className}`;
					const side = this.mode === 'class' ? await environment.entity(sideId) : instanceSide;
					const contents = await this.loadSide(environment, side, sideId);
					if (contents.slots.length > 0) {
						const slots: ClassPanelItem = { kind: 'section', key: 'slots', section: 'slots' };
						roots.push(slots);
						childrenOf.set(slots.key, contents.slots);
					}
					const protocols: ClassPanelItem = { kind: 'section', key: 'protocols', section: 'protocols' };
					roots.push(protocols);
					childrenOf.set(protocols.key, contents.protocols);
					for (const protocol of contents.protocols) {
						childrenOf.set(protocol.key, this.methodItems(protocol, side));
					}
				}
			} catch (error) {
				roots.length = 0;
				childrenOf.clear();
				message = isEnvUnknownEntityError(error)
					? `${this.className} is no longer in the image.`
					: `Cannot load ${this.className}: ${error instanceof Error ? error.message : String(error)}`;
			}
		}
		if (generation !== this.generation) {
			return;
		}
		this.roots = roots;
		this.childrenOf.clear();
		this.items.clear();
		for (const [key, children] of childrenOf) {
			this.childrenOf.set(key, children);
		}
		for (const item of [...roots, ...[...childrenOf.values()].flat()]) {
			this.items.set(item.key, item);
		}
		this.traits = traits;
		this.message = message;
	}

	private async loadSide(environment: ClassPanelEnvironment, side: EnvEntity, sideId: string): Promise<SideContents> {
		const slots: ClassPanelItem[] = [
			...(side.slots ?? []).map((name) => ({ name, classVariable: false })),
			...(side.classVariables ?? []).map((name) => ({ name, classVariable: true }))
		]
			.filter(({ name }) => this.matches(name))
			.map(({ name, classVariable }) => ({ kind: 'slot', key: `slot:${sideId}>>${name}`, parentKey: 'slots', name, sideId, classVariable }));
		const protocols = await this.loadProtocols(environment, sideId, 'protocols', true);
		return { slots, protocols };
	}

	private async loadProtocols(
		environment: ClassPanelEnvironment,
		sideId: string,
		parentKey: string,
		withAll: boolean
	): Promise<Array<Extract<ClassPanelItem, { kind: 'protocol' }>>> {
		const protocolNodes = await environment.children(sideId);
		const protocols = await Promise.all(protocolNodes.map(async (node) => ({
			kind: 'protocol' as const,
			key: `${parentKey}/${node.id}`,
			parentKey,
			sideId,
			name: node.name,
			protocolId: node.id,
			methods: (await environment.children(node.id)).filter((method) => this.matches(method.name))
		})));
		const shown = this.filter ? protocols.filter((protocol) => protocol.methods.length > 0) : protocols;
		if (!withAll) {
			return shown;
		}
		const all = {
			kind: 'protocol' as const,
			key: `${parentKey}/protocol:${sideId.slice('side:'.length)}>>${ALL_PROTOCOLS}`,
			parentKey,
			sideId,
			name: ALL_PROTOCOLS,
			protocolId: undefined,
			methods: protocols.flatMap((protocol) => protocol.methods).sort((left, right) => left.name.localeCompare(right.name))
		};
		return [all, ...shown];
	}

	private async loadTraits(
		environment: ClassPanelEnvironment,
		traits: string[],
		roots: ClassPanelItem[],
		childrenOf: Map<string, ClassPanelItem[]>
	): Promise<void> {
		for (const traitId of traits) {
			const trait: ClassPanelItem = { kind: 'trait', key: traitId, traitId };
			const traitName = traitId.slice('class:'.length);
			const protocols = await this.loadProtocols(environment, `side:${traitName}`, trait.key, false);
			const classSideKey = `${traitId}/class side`;
			const classSideProtocols = await this.loadProtocols(environment, `side:${traitName} class`, classSideKey, false);
			const children: ClassPanelItem[] = [...protocols];
			if (classSideProtocols.length > 0) {
				children.push({ kind: 'traitClassSide', key: classSideKey, parentKey: trait.key, traitId });
				childrenOf.set(classSideKey, classSideProtocols);
			}
			for (const protocol of [...protocols, ...classSideProtocols]) {
				childrenOf.set(protocol.key, this.methodItems(protocol, undefined));
			}
			if (children.length > 0 || !this.filter) {
				roots.push(trait);
				childrenOf.set(trait.key, children);
			}
		}
	}

	private methodItems(protocol: Extract<ClassPanelItem, { kind: 'protocol' }>, side: EnvEntity | undefined): ClassPanelItem[] {
		const overridden = new Set(side?.overridden ?? []);
		return protocol.methods.map((node) => ({
			kind: 'method',
			key: `${protocol.key}/${node.id}`,
			parentKey: protocol.key,
			node,
			overridden: overridden.has(node.name)
		}));
	}

	private matches(name: string): boolean {
		return !this.filter || name.toLowerCase().includes(this.filter.toLowerCase());
	}
}

/** Answer the markers of a method, in the order the panel shows them: ↑ overrides, ↓ redefined below, and so on. */
export function methodMarkersOf(item: Extract<ClassPanelItem, { kind: 'method' }>): string[] {
	const flags = item.node.flags;
	return [
		...(flags.override ? ['↑'] : []),
		...(item.overridden ? ['↓'] : []),
		...(flags.abstract ? ['abstract'] : []),
		...(flags.extension ? ['extension'] : []),
		...(flags.fromTrait ? [`from ${item.node.trait?.slice('class:'.length) ?? 'a trait'}`] : []),
		...(flags.deprecated ? ['deprecated'] : [])
	];
}

function treeItemOf(item: ClassPanelItem, filtered: boolean): vscode.TreeItem {
	const expanded = vscode.TreeItemCollapsibleState.Expanded;
	const collapsed = vscode.TreeItemCollapsibleState.Collapsed;
	switch (item.kind) {
		case 'section': {
			const treeItem = new vscode.TreeItem(item.section === 'slots' ? 'Slots' : 'Protocols', expanded);
			treeItem.id = item.key;
			treeItem.contextValue = `pharoClassPanel.${item.section}`;
			return treeItem;
		}
		case 'slot': {
			const treeItem = new vscode.TreeItem(item.name, vscode.TreeItemCollapsibleState.None);
			treeItem.id = item.key;
			treeItem.iconPath = new vscode.ThemeIcon(item.classVariable ? 'symbol-constant' : 'symbol-field');
			treeItem.description = item.classVariable ? 'class variable' : undefined;
			treeItem.contextValue = item.classVariable ? 'pharoClassPanel.classVariable' : 'pharoClassPanel.slot';
			return treeItem;
		}
		case 'protocol': {
			const treeItem = new vscode.TreeItem(item.name, filtered ? expanded : collapsed);
			treeItem.id = item.key;
			treeItem.description = String(item.methods.length);
			treeItem.iconPath = new vscode.ThemeIcon(item.protocolId === undefined ? 'list-flat' : item.name.startsWith('*') ? 'package' : 'folder');
			treeItem.contextValue = item.protocolId === undefined ? 'pharoClassPanel.allProtocols' : 'pharoClassPanel.protocol';
			return treeItem;
		}
		case 'trait': {
			const treeItem = new vscode.TreeItem(item.traitId.slice('class:'.length), expanded);
			treeItem.id = item.key;
			treeItem.iconPath = new vscode.ThemeIcon('symbol-interface');
			treeItem.contextValue = 'pharoClassPanel.trait';
			treeItem.command = { command: 'pharo.env.openEntity', title: 'Open Trait', arguments: [item.traitId] };
			return treeItem;
		}
		case 'traitClassSide': {
			const treeItem = new vscode.TreeItem('class side', collapsed);
			treeItem.id = item.key;
			treeItem.iconPath = new vscode.ThemeIcon('symbol-namespace');
			return treeItem;
		}
		case 'method': {
			const markers = methodMarkersOf(item);
			const flags = item.node.flags;
			const treeItem = new vscode.TreeItem(item.node.name, vscode.TreeItemCollapsibleState.None);
			treeItem.id = item.key;
			treeItem.description = markers.join(' ');
			treeItem.iconPath = new vscode.ThemeIcon(
				flags.test ? 'beaker' : flags.abstract ? 'symbol-interface' : flags.fromTrait ? 'symbol-misc' : 'symbol-method',
				flags.extension ? new vscode.ThemeColor('charts.purple') : undefined
			);
			treeItem.tooltip = new vscode.MarkdownString([
				`\`${item.node.id.slice('method:'.length)}\``,
				...(flags.override ? ['- overrides a method of a superclass'] : []),
				...(item.overridden ? ['- redefined in a subclass'] : []),
				...(flags.abstract ? ['- abstract'] : []),
				...(flags.extension ? ['- extension of another package'] : []),
				...(flags.fromTrait ? [`- comes from the trait ${item.node.trait?.slice('class:'.length) ?? ''}`] : []),
				...(flags.test ? ['- test'] : []),
				...(flags.deprecated ? ['- deprecated'] : [])
			].join('\n'));
			treeItem.contextValue = flags.test ? 'pharoClassPanel.method.test' : 'pharoClassPanel.method';
			treeItem.command = { command: 'pharo.env.openEntity', title: 'Open Method', arguments: [item.node.id] };
			return treeItem;
		}
	}
}

/** Answer the class and side an editor shows: a `pharo:` entity editor, a `pharoImage:` class or a Tonel file. */
export function classOfEditor(uri: vscode.Uri): { className: string; side?: EntitySide; methodId?: string } | undefined {
	const entity = parseEntityUri(uri);
	if (entity) {
		const sidePath = entity.side === 'class' ? `${entity.className} class` : entity.className;
		return {
			className: entity.className,
			side: entity.side,
			methodId: entity.side && entity.selector !== undefined ? `method:${sidePath}>>${entity.selector}` : undefined
		};
	}
	if (uri.scheme !== 'pharoImage' && uri.scheme !== 'file') {
		return undefined;
	}
	const match = /^(.+)\.(class|trait|extension)\.st$/.exec(decodeURIComponent(path.posix.basename(uri.path)));
	return match ? { className: match[1] } : undefined;
}

/** Register the class panel, which follows the active editor and the changes of the image, and its commands. */
export function registerClassPanel(
	context: vscode.ExtensionContext,
	environment: () => PharoEnvironment | undefined,
	fileSystem: PharoEntityFileSystem
): ClassPanel {
	const panel = new ClassPanel(environment);
	const provider = panel.provider;
	const command = (name: string, action: (item?: ClassPanelItem) => Promise<void>) =>
		vscode.commands.registerCommand(`pharo.classPanel.${name}`, (item?: ClassPanelItem) => reportErrors(() => action(item)));
	context.subscriptions.push(
		panel,
		command('showInstanceSide', () => provider.show(provider.className, 'instance')),
		command('showClassSide', () => provider.show(provider.className, 'class')),
		command('showTraits', () => provider.show(provider.className, 'traits')),
		command('refresh', () => provider.reload()),
		command('filter', async () => {
			const filter = await vscode.window.showInputBox({
				title: 'Filter the Class Panel',
				prompt: 'Show the slots and methods whose name holds this text',
				value: provider.filter
			});
			if (filter !== undefined) {
				await provider.setFilter(filter);
			}
		}),
		command('clearFilter', () => provider.setFilter('')),
		command('newMethod', async (item) => {
			const sideId = item && (item.kind === 'protocol' || item.kind === 'slot') ? item.sideId : currentSideId(provider);
			if (!sideId) {
				return;
			}
			const sidePath = sideId.slice('side:'.length);
			const side: EntitySide = sidePath.endsWith(' class') ? 'class' : 'instance';
			const protocol = item?.kind === 'protocol' && item.protocolId !== undefined ? item.name : undefined;
			await openNewMethod(requireEnvironment(environment), fileSystem, sidePath.replace(/ class$/, ''), side, protocol);
		}),
		command('generateAccessors', async (item) => {
			if (item?.kind !== 'slot') {
				return;
			}
			const current = requireEnvironment(environment);
			const existing = new Set((await Promise.all((await current.children(item.sideId))
				.map((protocol) => current.children(protocol.id)))).flat().map((method) => method.name));
			const sources = accessorSourcesOf(item.name).filter((source) => !existing.has(source.split(/\s/)[0]));
			if (sources.length === 0) {
				void vscode.window.showInformationMessage(`${item.name} already has its accessors.`);
				return;
			}
			for (const source of sources) {
				const result = await current.compile(item.sideId, source, { protocol: 'accessing' });
				if (!result.compiled) {
					throw new Error(`Cannot compile the accessor of ${item.name}: ${result.diagnostics.map((diagnostic) => diagnostic.message).join(', ')}`);
				}
			}
			await provider.reload();
		}),
		command('moveToProtocol', async (item) => {
			if (item?.kind !== 'method') {
				return;
			}
			const current = requireEnvironment(environment);
			const { sidePath } = methodReferenceOf(item);
			const protocols = (await current.children(`side:${sidePath}`)).map((node) => node.name);
			const protocol = await pickProtocol(protocols, `Move ${item.node.name} to Protocol`);
			if (protocol !== undefined) {
				await current.classify(item.node.id, protocol);
				await provider.reload();
			}
		}),
		command('removeMethod', async (item) => {
			if (item?.kind !== 'method') {
				return;
			}
			const label = item.node.id.slice('method:'.length);
			const remove = 'Remove';
			if (await vscode.window.showWarningMessage(`Remove ${label} from the image?`, { modal: true }, remove) !== remove) {
				return;
			}
			await requireEnvironment(environment).remove(item.node.id);
			await provider.reload();
		}),
		command('runTest', async (item) => {
			if (item?.kind === 'method') {
				const { className, selector } = methodReferenceOf(item);
				await vscode.commands.executeCommand('pharo.executeTest', className, selector);
			}
		})
	);
	return panel;
}

function currentSideId(provider: ClassPanelProvider): string | undefined {
	if (!provider.className) {
		return undefined;
	}
	return provider.mode === 'class' ? `side:${provider.className} class` : `side:${provider.className}`;
}

export class ClassPanel implements vscode.Disposable {
	readonly provider: ClassPanelProvider;
	readonly treeView: vscode.TreeView<ClassPanelItem>;
	private readonly subscriptions: vscode.Disposable[] = [];

	constructor(private readonly environment: () => PharoEnvironment | undefined) {
		this.provider = new ClassPanelProvider(environment);
		this.treeView = vscode.window.createTreeView(CLASS_PANEL_VIEW_ID, { treeDataProvider: this.provider, showCollapseAll: true });
		this.subscriptions.push(
			this.provider,
			this.treeView,
			this.provider.onDidChangeTreeData(() => this.updateTitle()),
			// A hidden panel follows the active editor once it shows, so that switching editors loads nothing meanwhile.
			vscode.window.onDidChangeActiveTextEditor((editor) => {
				if (editor && this.treeView.visible) {
					void this.follow(editor.document.uri);
				}
			}),
			this.treeView.onDidChangeVisibility(({ visible }) => {
				const editor = vscode.window.activeTextEditor;
				if (visible && editor) {
					void this.follow(editor.document.uri);
				}
			})
		);
		this.updateTitle();
	}

	/** Show the class of an editor, on the side of its method, and select that method. */
	async follow(uri: vscode.Uri): Promise<void> {
		const shown = classOfEditor(uri);
		if (!shown || !this.environment()) {
			return;
		}
		const mode: ClassPanelMode = shown.side ?? (shown.className === this.provider.className ? this.provider.mode : 'instance');
		if (shown.className !== this.provider.className || mode !== this.provider.mode) {
			await this.provider.show(shown.className, mode);
		}
		if (shown.methodId && this.treeView.visible) {
			const item = await this.provider.methodItem(shown.methodId);
			if (item) {
				await this.treeView.reveal(item, { select: true, focus: false });
			}
		}
	}

	async show(className: string | undefined, mode: ClassPanelMode = this.provider.mode): Promise<void> {
		await this.provider.show(className, mode);
	}

	applyChanges(summary: EnvChangeSummary): void {
		void this.provider.applyChanges(summary);
	}

	/** Reload the panel once the server starts, or show why it stays empty. */
	refresh(): Promise<void> {
		return this.provider.reload();
	}

	dispose(): void {
		vscode.Disposable.from(...this.subscriptions).dispose();
	}

	private updateTitle(): void {
		const { className, mode, filter, traits, message } = this.provider;
		const sideLabel = mode === 'traits' ? 'traits' : mode === 'class' ? 'class side' : 'instance side';
		this.treeView.description = className ? [`${className} · ${sideLabel}`, ...(filter ? [`filter: ${filter}`] : [])].join(' · ') : undefined;
		this.treeView.message = message;
		void vscode.commands.executeCommand('setContext', 'pharo.classPanel.mode', mode);
		void vscode.commands.executeCommand('setContext', 'pharo.classPanel.hasClass', className !== undefined);
		void vscode.commands.executeCommand('setContext', 'pharo.classPanel.hasTraits', traits.length > 0);
		void vscode.commands.executeCommand('setContext', 'pharo.classPanel.filtered', filter !== '');
	}
}

/** Answer the getter and setter of a slot, as Pharo generates them. */
export function accessorSourcesOf(slot: string): string[] {
	const argument = /^[aeiouAEIOU]/.test(slot) ? `an${capitalized(slot)}` : `a${capitalized(slot)}`;
	return [`${slot}\n\n\t^ ${slot}`, `${slot}: ${argument}\n\n\t${slot} := ${argument}`];
}

function capitalized(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Answer the class of a method item as `Array` or `Array class`, and its selector. */
export function methodReferenceOf(item: Extract<ClassPanelItem, { kind: 'method' }>): { sidePath: string; className: string; selector: string } {
	const path = item.node.id.slice('method:'.length);
	const separator = path.indexOf('>>');
	return {
		sidePath: path.slice(0, separator),
		className: classNameOfEnvId(item.node.id) ?? path.slice(0, separator),
		selector: path.slice(separator + 2)
	};
}
