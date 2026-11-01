import * as vscode from 'vscode';
import { EnvVersion } from './envContracts';
import { locationOf, reportErrors, requireEnvironment } from './entityCommands';
import { entityIdOf, entityLabelOf, entityUri, parseEntityUri } from './entityUri';
import { PharoEnvironment } from './pharoEnvironment';

// Versions of a method, from the changes file of the image (pls-env:history). The Timeline of VS Code would be their
// natural place, but its API is still proposed: a Quick Pick lists them instead, and the diff editor of VS Code shows
// each one against the editor of the method, whose arrows copy a block of the old version into the method.

/** Scheme of the read-only documents of the old versions of methods. */
export const HISTORY_SCHEME = 'pharo-history';
/** Set while the active editor compares an old version with its method, to show Restore This Version. */
const DIFF_CONTEXT_KEY = 'pharo.history.diffActive';

/** An old version of a method, as its read-only document shows it. */
interface VersionDocument {
	id: string;
	label: string;
	version: EnvVersion;
}

interface VersionItem extends vscode.QuickPickItem {
	uri: vscode.Uri;
}

/**
 * Answer the method id of an argument of a command: an editor URI of a method, a pls-env id, a method of the Projects
 * view or of the class panel. Undefined for anything else, such as a class.
 */
export function methodIdOf(argument: unknown): string | undefined {
	if (argument instanceof vscode.Uri) {
		const location = parseEntityUri(argument);
		return location?.side ? entityIdOf(location) : undefined;
	}
	const item = argument as { id?: unknown; node?: { id?: unknown } } | undefined;
	const id = typeof argument === 'string' ? argument : item?.node?.id ?? item?.id;
	return typeof id === 'string' && id.startsWith('method:') ? id : undefined;
}

/** Answer how to show when a version was compiled: a local date for an ISO stamp, the stamp itself otherwise. */
export function formatStamp(stamp: string | null): string {
	if (!stamp) {
		return 'Unknown date';
	}
	const date = new Date(stamp);
	return /^\d{4}-\d{2}-\d{2}T/.test(stamp) && !isNaN(date.getTime()) ? date.toLocaleString() : stamp;
}

/** Answer the items of the Quick Pick: the versions older than the current one, newest first. */
export function versionItems(versions: EnvVersion[], uriOf: (index: number) => vscode.Uri): VersionItem[] {
	const current = versions[0];
	return versions.slice(1).map((version, offset) => ({
		label: `$(history) ${formatStamp(version.stamp)}`,
		description: version.protocol === current.protocol ? undefined : `in ${version.protocol}`,
		detail: changedLinesOf(version.source, current.source),
		uri: uriOf(offset + 1)
	}));
}

/** Answer how many lines of a version the current source no longer holds, as a rough idea of the change. */
function changedLinesOf(source: string, current: string): string | undefined {
	const currentLines = new Set(current.split(/\r\n|\r|\n/));
	const changed = source.split(/\r\n|\r|\n/).filter((line) => !currentLines.has(line)).length;
	return changed === 0 ? undefined : `${changed} line${changed === 1 ? '' : 's'} not in the current version`;
}

/** Holds the old versions shown in diff editors, and restores them. */
export class MethodHistory implements vscode.TextDocumentContentProvider, vscode.Disposable {
	private readonly documents = new Map<string, VersionDocument>();
	private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
	private readonly subscriptions: vscode.Disposable[];

	readonly onDidChange = this.changeEmitter.event;

	constructor(private readonly environment: () => PharoEnvironment | undefined) {
		this.subscriptions = [
			vscode.window.tabGroups.onDidChangeTabs(() => this.updateDiffContext()),
			vscode.window.tabGroups.onDidChangeTabGroups(() => this.updateDiffContext())
		];
	}

	provideTextDocumentContent(uri: vscode.Uri): string {
		return this.documents.get(uri.toString())?.version.source ?? '';
	}

	/** List the versions of a method, previewing each one against the editor of the method. */
	async show(argument?: unknown): Promise<void> {
		const environment = requireEnvironment(this.environment);
		const id = methodIdOf(argument ?? vscode.window.activeTextEditor?.document.uri);
		if (!id) {
			throw new Error('Open a method, or choose one, to show its history.');
		}
		const location = await locationOf(environment, id);
		const label = entityLabelOf(location);
		const methodUri = entityUri(location);
		const versions = await environment.history(id);
		if (versions.length < 2) {
			void vscode.window.showInformationMessage(`${label} has no earlier version in the changes file of the image.`);
			return;
		}
		const items = versionItems(versions, (index) => {
			const uri = methodUri.with({ scheme: HISTORY_SCHEME, query: `${index}` });
			this.documents.set(uri.toString(), { id, label, version: versions[index] });
			this.changeEmitter.fire(uri);
			return uri;
		});
		const picker = vscode.window.createQuickPick<VersionItem>();
		picker.title = `History of ${label}`;
		picker.placeholder = 'Choose a version to compare with the method';
		picker.matchOnDescription = true;
		picker.items = items;
		const compare = (item: VersionItem | undefined, preserveFocus: boolean) => item && vscode.commands.executeCommand(
			'vscode.diff', item.uri, methodUri, `${label} (${formatStamp(this.documents.get(item.uri.toString())!.version.stamp)}) ↔ Image`,
			{ preview: true, preserveFocus }
		);
		picker.onDidChangeActive(([item]) => void compare(item, true));
		picker.onDidAccept(() => {
			void compare(picker.selectedItems[0], false);
			picker.hide();
		});
		picker.onDidHide(() => picker.dispose());
		picker.show();
	}

	/** Compile the old version of the active diff editor into its method. */
	async restore(): Promise<void> {
		const environment = requireEnvironment(this.environment);
		const diff = activeHistoryDiff();
		const document = diff && this.documents.get(diff.original.toString());
		if (!diff || !document) {
			throw new Error('Compare an old version of a method with its method first, from Show Method History.');
		}
		const methodDocument = vscode.workspace.textDocuments.find((candidate) => candidate.uri.toString() === diff.modified.toString());
		if (methodDocument?.isDirty) {
			throw new Error(`${document.label} has unsaved changes: save or revert them before restoring a version.`);
		}
		const result = await environment.compile(document.id, document.version.source, { protocol: document.version.protocol });
		if (!result.compiled) {
			throw new Error(`Unable to restore ${document.label}: ${result.diagnostics[0]?.message ?? 'it does not compile any more'}.`);
		}
		void vscode.window.setStatusBarMessage(`Restored ${document.label} as of ${formatStamp(document.version.stamp)}`, 5000);
	}

	dispose(): void {
		this.subscriptions.forEach((subscription) => subscription.dispose());
		this.changeEmitter.dispose();
		this.documents.clear();
	}

	private updateDiffContext(): void {
		void vscode.commands.executeCommand('setContext', DIFF_CONTEXT_KEY, activeHistoryDiff() !== undefined);
	}
}

function activeHistoryDiff(): vscode.TabInputTextDiff | undefined {
	const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
	return input instanceof vscode.TabInputTextDiff && input.original.scheme === HISTORY_SCHEME ? input : undefined;
}

/** Register the documents of the old versions and the commands `pharo.history.show` and `pharo.history.restore`. */
export function registerMethodHistory(context: vscode.ExtensionContext, environment: () => PharoEnvironment | undefined): MethodHistory {
	const history = new MethodHistory(environment);
	context.subscriptions.push(
		history,
		vscode.workspace.registerTextDocumentContentProvider(HISTORY_SCHEME, history),
		vscode.commands.registerCommand('pharo.history.show', (argument?: unknown) => reportErrors(() => history.show(argument))),
		vscode.commands.registerCommand('pharo.history.restore', () => reportErrors(() => history.restore()))
	);
	return history;
}
