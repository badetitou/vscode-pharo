import * as vscode from 'vscode';
import { EnvEntity, EnvNode } from './envContracts';
import { EnvChangeSummary, classNameOfEnvId, packageNameOfEnvId } from './environmentChanges';
import { imageNameOf, parseEntityUri } from './entityUri';
import { SessionView } from './editorSession';
import { PharoEnvironment } from './pharoEnvironment';

// The Projects view: project → package → tag → class, over the environment model (docs/environment-model.md).

export const PROJECTS_VIEW_ID = 'pharoProjects';
/** A filter shorter than this shows the projects unfiltered, as in Pulsar. */
export const MINIMUM_FILTER_LENGTH = 3;

const VOLATILE_PROJECT_ID = 'project:*';

/** What the user chose to see, per image. */
export interface ProjectsViewState {
	pinned: string[];
	hidden: string[];
	showAll: boolean;
}

/** What the session of the image saves of the view, besides the projects pinned and hidden. */
export interface ProjectsSessionState {
	filter: string;
	/** Id of the selected node. */
	selection?: string;
}

/** What the view needs from the language client to create packages and classes. */
export type ProjectsRequest = (method: string, params: unknown) => Promise<unknown>;

/**
 * Answer the projects the view shows, pinned ones first. By default, a project shows when it is pinned, when an Iceberg
 * repository holds it, or when it is the volatile project; a hidden project never shows. `showAll` shows every project,
 * hidden ones included, so that the user can show them again.
 */
export function visibleProjects(
	projects: readonly EnvNode[],
	repositoryOf: (id: string) => string | null,
	state: ProjectsViewState
): EnvNode[] {
	const shown = projects.filter((project) => state.showAll || (!state.hidden.includes(project.id)
		&& (state.pinned.includes(project.id) || project.id === VOLATILE_PROJECT_ID || repositoryOf(project.id) !== null)));
	return [
		...shown.filter((project) => state.pinned.includes(project.id)),
		...shown.filter((project) => !state.pinned.includes(project.id))
	];
}

/** Answer whether a filter applies: it needs MINIMUM_FILTER_LENGTH characters. */
export function isActiveFilter(filter: string): boolean {
	return filter.trim().length >= MINIMUM_FILTER_LENGTH;
}

export function matchesFilter(name: string, filter: string): boolean {
	return name.toLowerCase().includes(filter.trim().toLowerCase());
}

/** Answer a Tonel class definition moved to the tag of its package, for a class created in a tag. */
export function classDefinitionInTag(definition: string, tag: string): string {
	const quoted = `'${tag.replace(/'/g, "''")}'`;
	if (/#tag\s*:/.test(definition)) {
		return definition.replace(/(#tag\s*:\s*)'(?:[^']|'')*'/, `$1${quoted}`);
	}
	return definition.replace(/(#package\s*:\s*'(?:[^']|'')*')/, `$1,\n\t#tag : ${quoted}`);
}

/** Answer the class an editor shows: a `pharo:` class or method editor, or a `pharoImage:` class file. */
export function classNameOfEditor(uri: vscode.Uri): string | undefined {
	const entity = parseEntityUri(uri);
	if (entity) {
		return entity.className;
	}
	if (uri.scheme !== 'pharoImage' || !uri.path.endsWith('.class.st')) {
		return undefined;
	}
	return decodeURIComponent(uri.path.split('/').pop() ?? '').slice(0, -'.class.st'.length) || undefined;
}

/** Tree of the projects of the image, down to their classes. */
export class ProjectsTreeProvider implements vscode.TreeDataProvider<EnvNode> {
	private readonly didChangeTreeData = new vscode.EventEmitter<EnvNode | undefined>();
	readonly onDidChangeTreeData = this.didChangeTreeData.event;

	private environment: PharoEnvironment | undefined;
	private filterText = '';

	constructor(private readonly state: () => ProjectsViewState) {}

	get filter(): string {
		return this.filterText;
	}

	setEnvironment(environment: PharoEnvironment | undefined): void {
		this.environment = environment;
		this.refresh();
	}

	setFilter(filter: string): void {
		this.filterText = filter.trim();
		this.refresh();
	}

	refresh(): void {
		this.didChangeTreeData.fire(undefined);
	}

	/** Reload what a burst of changes of the image touched, and the Iceberg state of projects and packages. */
	applyChanges(_summary: EnvChangeSummary): void {
		this.environment?.invalidateEntitiesOf(['project', 'package']);
		this.refresh();
	}

	async getTreeItem(node: EnvNode): Promise<vscode.TreeItem> {
		const item = new vscode.TreeItem(node.name, this.collapsibleStateOf(node));
		item.id = node.id;
		const entity = node.kind === 'project' || node.kind === 'package' ? await this.entityOrUndefined(node.id) : undefined;
		const repository = entity?.repository ?? null;
		item.description = repository ? `${entity?.modified ? '● ' : ''}${repository}` : undefined;
		item.tooltip = this.tooltipOf(node, entity);
		item.iconPath = this.iconOf(node);
		item.contextValue = this.contextValueOf(node, repository);
		if (node.kind === 'class') {
			item.command = { command: 'pharo.env.openEntity', title: 'Open Class Definition', arguments: [node.id] };
		}
		return item;
	}

	async getChildren(node?: EnvNode): Promise<EnvNode[]> {
		const environment = this.environment;
		if (!environment) {
			return [];
		}
		if (!node) {
			return this.rootsOf(environment);
		}
		if (node.kind === 'class') {
			return [];
		}
		const children = (await environment.children(node.id)).filter((child) => child.kind !== 'extensions');
		if (node.kind === 'project' && isActiveFilter(this.filterText) && !matchesFilter(node.name, this.filterText)) {
			return children.filter((child) => matchesFilter(child.name, this.filterText));
		}
		return children;
	}

	async getParent(node: EnvNode): Promise<EnvNode | undefined> {
		return node.parent && this.environment ? this.environment.entity(node.parent) : undefined;
	}

	/** Answer the node of a class, or undefined when the view does not show its project. */
	async classNodeOf(className: string): Promise<EnvNode | undefined> {
		const environment = this.environment;
		if (!environment) {
			return undefined;
		}
		const classNode = await environment.entity(`class:${className}`);
		const packageId = classNode.package;
		const projectId = packageId ? (await environment.entity(packageId)).parent : null;
		const roots = await this.rootsOf(environment);
		if (!projectId || !roots.some((project) => project.id === projectId)) {
			return undefined;
		}
		const packageName = packageNameOfEnvId(packageId ?? '');
		const project = roots.find((root) => root.id === projectId);
		if (isActiveFilter(this.filterText) && project && !matchesFilter(project.name, this.filterText)
			&& !(packageName && matchesFilter(packageName, this.filterText))) {
			return undefined;
		}
		return classNode;
	}

	dispose(): void {
		this.didChangeTreeData.dispose();
	}

	private async rootsOf(environment: PharoEnvironment): Promise<EnvNode[]> {
		const projects = await environment.projects();
		const state = this.state();
		if (!isActiveFilter(this.filterText)) {
			const repositories = new Map<string, string | null>();
			await Promise.all(projects.map(async (project) => {
				repositories.set(project.id, (await this.entityOrUndefined(project.id))?.repository ?? null);
			}));
			return visibleProjects(projects, (id) => repositories.get(id) ?? null, state);
		}
		// A filter searches every project that is not hidden, whether the view shows it by default or not.
		const candidates = visibleProjects(projects, () => '', state);
		const matches = await Promise.all(candidates.map(async (project) => matchesFilter(project.name, this.filterText)
			|| (await environment.children(project.id)).some((child) => matchesFilter(child.name, this.filterText))));
		return candidates.filter((_project, index) => matches[index]);
	}

	private collapsibleStateOf(node: EnvNode): vscode.TreeItemCollapsibleState {
		if (node.kind === 'class' || !node.hasChildren) {
			return vscode.TreeItemCollapsibleState.None;
		}
		return node.kind === 'project' && isActiveFilter(this.filterText)
			? vscode.TreeItemCollapsibleState.Expanded
			: vscode.TreeItemCollapsibleState.Collapsed;
	}

	private iconOf(node: EnvNode): vscode.ThemeIcon {
		switch (node.kind) {
			case 'project':
				return new vscode.ThemeIcon(node.flags.volatile ? 'circle-large-outline' : this.state().pinned.includes(node.id) ? 'pinned' : 'project');
			case 'package':
				return new vscode.ThemeIcon(node.flags.test ? 'beaker' : 'package');
			case 'tag':
				return new vscode.ThemeIcon('tag');
			default:
				return new vscode.ThemeIcon(node.flags.trait ? 'symbol-interface' : 'symbol-class');
		}
	}

	/** Answer the context value that the menus of package.json match, such as `pharo.project pinned iceberg`. */
	private contextValueOf(node: EnvNode, repository: string | null): string {
		const keywords = [`pharo.${node.kind}`];
		if (node.kind === 'project') {
			const state = this.state();
			keywords.push(state.pinned.includes(node.id) ? 'pinned' : 'unpinned', state.hidden.includes(node.id) ? 'hidden' : 'shown');
		}
		if (repository) {
			keywords.push('iceberg');
		}
		return keywords.join(' ');
	}

	private tooltipOf(node: EnvNode, entity: EnvEntity | undefined): string {
		const lines = [node.kind === 'project' && !node.flags.volatile ? `BaselineOf${node.name}` : node.name];
		if (node.flags.volatile) {
			lines.push('Loaded packages that no baseline declares');
		}
		if (entity?.repository) {
			lines.push(`Iceberg repository: ${entity.repository}${entity.modified ? ' (uncommitted changes)' : ''}`);
		}
		return lines.join('\n');
	}

	private async entityOrUndefined(id: string): Promise<EnvEntity | undefined> {
		try {
			return await this.environment?.entity(id);
		} catch {
			return undefined;
		}
	}
}

/** The Projects view, its commands, and the synchronization with the active editor. */
export class ProjectsView implements vscode.Disposable, SessionView {
	readonly sessionKey = 'projects';
	private readonly provider: ProjectsTreeProvider;
	private readonly treeView: vscode.TreeView<EnvNode>;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly sessionStateEmitter = new vscode.EventEmitter<void>();
	private environment: PharoEnvironment | undefined;
	private changesSubscription: vscode.Disposable | undefined;
	/** Node of a restored session to select once the view shows: revealing a node shows a hidden view. */
	private pendingSelection: string | undefined;

	readonly onDidChangeSessionState: vscode.Event<void> = this.sessionStateEmitter.event;

	constructor(private readonly context: vscode.ExtensionContext, private readonly request: ProjectsRequest) {
		this.provider = new ProjectsTreeProvider(() => this.state);
		this.treeView = vscode.window.createTreeView(PROJECTS_VIEW_ID, { treeDataProvider: this.provider, showCollapseAll: true });
		const command = (name: string, action: (node?: EnvNode) => Thenable<unknown> | void) =>
			vscode.commands.registerCommand(`pharo.projects.${name}`, (node?: EnvNode) => reportErrors(async () => action(node)));
		this.disposables.push(
			this.provider,
			this.treeView,
			command('refresh', () => this.refresh()),
			command('filter', () => this.askFilter()),
			command('clearFilter', () => this.setFilter('')),
			command('showAll', () => this.updateState({ showAll: true })),
			command('showDefault', () => this.updateState({ showAll: false })),
			command('pin', (node) => this.updateProject(node, (state, id) => ({ pinned: [...state.pinned, id], hidden: without(state.hidden, id) }))),
			command('unpin', (node) => this.updateProject(node, (state, id) => ({ pinned: without(state.pinned, id) }))),
			command('hide', (node) => this.updateProject(node, (state, id) => ({ hidden: [...state.hidden, id], pinned: without(state.pinned, id) }))),
			command('unhide', (node) => this.updateProject(node, (state, id) => ({ hidden: without(state.hidden, id) }))),
			command('newPackage', (node) => this.newPackage(node)),
			command('newClass', (node) => this.newClass(node)),
			command('runTests', (node) => this.runTests(node)),
			command('openDefinition', (node) => this.openDefinition(node)),
			command('newMethod', (node) => node?.kind === 'class' ? vscode.commands.executeCommand('pharo.env.newMethod', node.id) : undefined),
			command('commit', (node) => this.commit(node)),
			command('reveal', () => this.revealActiveEditor(true)),
			vscode.window.onDidChangeActiveTextEditor(() => void this.revealActiveEditor(false)),
			this.treeView.onDidChangeVisibility(({ visible }) => visible ? void this.revealOnShow() : undefined),
			this.treeView.onDidChangeSelection(() => this.sessionStateEmitter.fire()),
			this.sessionStateEmitter
		);
		this.updateContext();
	}

	/** Show the projects of the environment, and follow its changes. */
	setEnvironment(environment: PharoEnvironment | undefined, changes?: vscode.Event<EnvChangeSummary>): void {
		this.environment = environment;
		this.changesSubscription?.dispose();
		this.changesSubscription = changes?.((summary) => this.provider.applyChanges(summary));
		this.provider.setEnvironment(environment);
		this.updateContext();
	}

	sessionState(): ProjectsSessionState {
		return { filter: this.provider.filter, selection: this.treeView.selection[0]?.id ?? this.pendingSelection };
	}

	/** Restore the filter, and the selection unless the view follows a class editor. */
	async restoreSessionState(state: unknown): Promise<void> {
		const saved = state as Partial<ProjectsSessionState> | undefined;
		if (typeof saved?.filter === 'string') {
			this.setFilter(saved.filter);
		}
		this.pendingSelection = typeof saved?.selection === 'string' ? saved.selection : undefined;
		if (this.treeView.visible) {
			await this.revealOnShow();
		}
	}

	refresh(): void {
		this.environment?.invalidateEntitiesOf(['project', 'package']);
		this.provider.refresh();
	}

	dispose(): void {
		this.changesSubscription?.dispose();
		this.disposables.forEach((disposable) => disposable.dispose());
	}

	private get stateKey(): string {
		return `pharo.projects.${this.environment ? imageNameOf(this.environment.image) : ''}`;
	}

	private get state(): ProjectsViewState {
		const stored = this.context.workspaceState.get<Partial<ProjectsViewState>>(this.stateKey) ?? {};
		return { pinned: stored.pinned ?? [], hidden: stored.hidden ?? [], showAll: stored.showAll ?? false };
	}

	private async updateState(change: Partial<ProjectsViewState>): Promise<void> {
		await this.context.workspaceState.update(this.stateKey, { ...this.state, ...change });
		this.updateContext();
		this.provider.refresh();
	}

	private async updateProject(
		node: EnvNode | undefined,
		change: (state: ProjectsViewState, id: string) => Partial<ProjectsViewState>
	): Promise<void> {
		if (node?.kind === 'project') {
			await this.updateState(change(this.state, node.id));
		}
	}

	private updateContext(): void {
		void vscode.commands.executeCommand('setContext', 'pharo.env', this.environment !== undefined);
		void vscode.commands.executeCommand('setContext', 'pharo.projects.showAll', this.state.showAll);
		void vscode.commands.executeCommand('setContext', 'pharo.projects.filtered', isActiveFilter(this.provider.filter));
		this.treeView.message = isActiveFilter(this.provider.filter) ? `Filtered by “${this.provider.filter}”` : undefined;
	}

	private async askFilter(): Promise<void> {
		const filter = await vscode.window.showInputBox({
			title: 'Filter Pharo Projects',
			prompt: `Projects and packages whose name holds this text (${MINIMUM_FILTER_LENGTH} characters or more)`,
			value: this.provider.filter,
			validateInput: (value) => value.trim().length > 0 && !isActiveFilter(value)
				? `Type at least ${MINIMUM_FILTER_LENGTH} characters.`
				: undefined
		});
		if (filter !== undefined) {
			this.setFilter(filter);
		}
	}

	private setFilter(filter: string): void {
		this.provider.setFilter(isActiveFilter(filter) ? filter : '');
		this.sessionStateEmitter.fire();
		this.updateContext();
	}

	/** Create a package and add it to the Iceberg repository of the project. Its baseline still has to declare it. */
	private async newPackage(node?: EnvNode): Promise<void> {
		const environment = requireEnvironment(this.environment);
		const project = node?.kind === 'project' && !node.flags.volatile ? node : undefined;
		const packageName = (await vscode.window.showInputBox({
			title: 'New Pharo Package',
			value: project ? `${project.name}-` : '',
			valueSelection: project ? [project.name.length + 1, project.name.length + 1] : undefined,
			validateInput: (value) => value.trim().length === 0 ? 'Package name is required.' : undefined
		}))?.trim();
		if (!packageName) {
			return;
		}
		await this.request('pls:createPackage', { packageName });
		const repository = project ? (await environment.entity(project.id)).repository : null;
		if (repository) {
			await this.request('pls-ice:addPackage', { aRepositoryName: repository, packageName });
		}
		this.refresh();
		if (project) {
			void vscode.window.showInformationMessage(
				`Package ${packageName} created${repository ? ` in ${repository}` : ''}. Declare it in BaselineOf${project.name} so that it belongs to ${project.name}.`
			);
		}
	}

	/** Create a class in a package or a tag, then open its definition. */
	private async newClass(node?: EnvNode): Promise<void> {
		const environment = requireEnvironment(this.environment);
		const packageName = node ? packageNameOfEnvId(node.id) : undefined;
		if (!node || !packageName) {
			return;
		}
		const className = (await vscode.window.showInputBox({
			title: `New Class in ${node.kind === 'tag' ? `${packageName} / ${node.name}` : packageName}`,
			placeHolder: 'Class name, such as MyClass',
			validateInput: (value) => /^[A-Z]\w*$/.test(value.trim()) ? undefined : 'A class name starts with an uppercase letter.'
		}))?.trim();
		if (!className) {
			return;
		}
		const superclassName = (await vscode.window.showInputBox({ title: 'Superclass', value: 'Object' }))?.trim();
		if (superclassName === undefined) {
			return;
		}
		await this.request('pls:createClass', { packageName, className, superclassName: superclassName || 'Object', instanceVariables: '' });
		const classId = `class:${className}`;
		if (node.kind === 'tag') {
			const definition = await environment.read(classId);
			const result = await environment.compile(classId, classDefinitionInTag(definition.source, node.name), { expectedVersion: definition.version });
			if (!result.compiled) {
				throw new Error(`${className} was created, but not moved to the tag ${node.name}: ${result.diagnostics.map((diagnostic) => diagnostic.message).join(', ')}`);
			}
		}
		this.refresh();
		await vscode.commands.executeCommand('pharo.env.openEntity', classId);
	}

	/** Run the tests of a package, or of every package of a project. */
	private async runTests(node?: EnvNode): Promise<void> {
		const environment = requireEnvironment(this.environment);
		if (node?.kind !== 'project' && node?.kind !== 'package') {
			return;
		}
		const packages = node.kind === 'package' ? [node.name] : (await environment.children(node.id)).map((child) => child.name);
		await vscode.commands.executeCommand('pharo.tests.runPackages', packages);
	}

	private async openDefinition(node?: EnvNode): Promise<void> {
		const environment = requireEnvironment(this.environment);
		const className = node ? classNameOfEnvId(node.id) : undefined;
		if (className) {
			await vscode.commands.executeCommand('pharo.env.openEntity', `class:${className}`);
		} else if (node?.kind === 'project' && !node.flags.volatile) {
			await vscode.commands.executeCommand('pharo.env.openEntity', `class:BaselineOf${node.name}`);
		} else if (node) {
			const entity = await environment.entity(node.id);
			throw new Error(`${entity.name} has no definition to open.`);
		}
	}

	private async commit(node?: EnvNode): Promise<void> {
		const repository = node ? (await requireEnvironment(this.environment).entity(node.id)).repository : null;
		if (repository) {
			await vscode.commands.executeCommand('pharo.ice.commit', repository);
			this.refresh();
		}
	}

	/** Select the node of a restored session, unless the active editor shows a class: the view selects that class. */
	private async revealOnShow(): Promise<void> {
		const id = this.pendingSelection;
		const uri = vscode.window.activeTextEditor?.document.uri;
		this.pendingSelection = undefined;
		if (!id || !this.environment || (uri && classNameOfEditor(uri))) {
			return this.revealActiveEditor(false);
		}
		try {
			await this.treeView.reveal(await this.environment.entity(id), { select: true, focus: false, expand: false });
		} catch {
			// The node was removed from the image, or the view no longer shows its project.
		}
	}

	/** Select the class of the active editor, when the view is visible or the user asks for it. */
	private async revealActiveEditor(requested: boolean): Promise<void> {
		const uri = vscode.window.activeTextEditor?.document.uri;
		const className = uri ? classNameOfEditor(uri) : undefined;
		if (!className || (!requested && !this.treeView.visible)) {
			return;
		}
		try {
			const node = await this.provider.classNodeOf(className);
			if (node) {
				await this.treeView.reveal(node, { select: true, focus: requested, expand: false });
			} else if (requested) {
				void vscode.window.showInformationMessage(`The Projects view does not show the project of ${className}: show all projects, or clear the filter.`);
			}
		} catch (error) {
			if (requested) {
				throw error;
			}
		}
	}
}

function without(ids: readonly string[], id: string): string[] {
	return ids.filter((candidate) => candidate !== id);
}

function requireEnvironment(environment: PharoEnvironment | undefined): PharoEnvironment {
	if (!environment) {
		throw new Error('The Pharo Language Server is not running, or does not provide the environment model (pls-env).');
	}
	return environment;
}

async function reportErrors(action: () => Promise<unknown>): Promise<void> {
	try {
		await action();
	} catch (error) {
		void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
	}
}
