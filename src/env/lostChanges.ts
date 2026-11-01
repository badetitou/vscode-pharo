import * as path from 'path';
import * as vscode from 'vscode';
import { EnvLostChange } from './envContracts';
import { reportErrors, requireEnvironment } from './entityCommands';
import { PharoEnvironment } from './pharoEnvironment';

// Changes of the last session of the image that it did not save, after a crash or a quit without saving: Epicea logged
// them, and pls-env:lostChanges lists them. They appear in the Source Control view of VS Code, as an Epicea provider
// beside Iceberg: selecting one compares its sources before and after in the diff editor, and inline actions replay or
// dismiss it.

/** Scheme of the read-only documents of the sources of lost changes, before and after them. */
export const LOST_CHANGE_SCHEME = 'pharo-lost';
const SOURCE_CONTROL_ID = 'pharo-epicea';

/** A lost change in the Source Control view. */
export class LostChangeState implements vscode.SourceControlResourceState {
	readonly resourceUri: vscode.Uri;
	readonly command: vscode.Command;
	readonly decorations: vscode.SourceControlResourceDecorations;

	constructor(readonly change: EnvLostChange) {
		this.resourceUri = lostChangeUri(change, 'after');
		this.command = { title: 'Compare', command: 'pharo.lostChanges.open', arguments: [this] };
		this.decorations = {
			strikeThrough: change.source === null && change.oldSource !== null,
			tooltip: `${describeKind(change.kind)}${change.time ? `, ${new Date(change.time).toLocaleString()}` : ''}`,
			iconPath: new vscode.ThemeIcon(change.oldSource === null ? 'diff-added' : change.source === null ? 'diff-removed' : 'diff-modified')
		};
	}
}

/**
 * Answer the URI of the source of a change, before or after it. Its path names the entity as its editor would, so that
 * the Source Control view shows a method as `collect:.st` in `Array`; the query keeps the changes of one entity apart.
 */
export function lostChangeUri(change: EnvLostChange, side: 'before' | 'after'): vscode.Uri {
	const method = change.id?.startsWith('method:') ? /^method:(.+?)>>(.+)$/.exec(change.id) : null;
	const file = method
		? `/${method[1]}/${method[2].replace(/%/g, '%25').replace(/\//g, '%2F')}.st`
		: change.id?.startsWith('class:') ? `/${change.id.slice('class:'.length)}.class.st` : `/${change.label.replace(/\//g, '∕')}`;
	return vscode.Uri.from({ scheme: LOST_CHANGE_SCHEME, path: file, query: `ref=${encodeURIComponent(change.ref)}&side=${side}` });
}

/** Answer `Method modification` for `methodModification`. */
export function describeKind(kind: string): string {
	const words = kind.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Lists the lost changes of the image in the Source Control view, while there are some, and replays them. */
export class LostChanges implements vscode.TextDocumentContentProvider, vscode.Disposable {
	private changes: EnvLostChange[] = [];
	private sourceControl: vscode.SourceControl | undefined;
	private group: vscode.SourceControlResourceGroup | undefined;
	private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();

	readonly onDidChange = this.changeEmitter.event;

	constructor(private readonly environment: () => PharoEnvironment | undefined) { }

	get pending(): readonly EnvLostChange[] {
		return this.changes;
	}

	provideTextDocumentContent(uri: vscode.Uri): string {
		const query = new URLSearchParams(uri.query);
		const change = this.changes.find((candidate) => candidate.ref === query.get('ref'));
		return (query.get('side') === 'before' ? change?.oldSource : change?.source) ?? '';
	}

	/** Load the lost changes of the image again. */
	async refresh(): Promise<void> {
		const environment = this.environment();
		this.update(environment ? await environment.lostChanges() : []);
	}

	/** Load the lost changes of a newly started image, and offer to review them if there are some. */
	async start(): Promise<void> {
		await this.refresh();
		const count = this.changes.length;
		if (count === 0) {
			return;
		}
		const image = path.basename(requireEnvironment(this.environment).image, '.image');
		const review = 'Review Changes';
		const replayAll = 'Replay All';
		const selection = await vscode.window.showWarningMessage(
			`The last session of the image ${image} ended without saving ${count === 1 ? '1 change' : `${count} changes`} of code. Epicea kept ${count === 1 ? 'it' : 'them'}.`,
			review,
			replayAll
		);
		if (selection === review) {
			await this.reveal();
		} else if (selection === replayAll) {
			await this.replay(this.changes.map((change) => change.ref));
		}
	}

	/** Show the lost changes in the Source Control view, or tell that there are none. */
	async reveal(): Promise<void> {
		await this.refresh();
		if (this.changes.length === 0) {
			void vscode.window.showInformationMessage('No change of the last session of the image is lost: it saved them all, or they were replayed or dismissed.');
			return;
		}
		await vscode.commands.executeCommand('workbench.view.scm');
	}

	/** Compare the sources of a change, before and after it. */
	async open(state: LostChangeState): Promise<void> {
		const { change } = state;
		if (change.oldSource === null && change.source === null) {
			void vscode.window.showInformationMessage(`${describeKind(change.kind)}: ${change.label}`);
			return;
		}
		await vscode.commands.executeCommand(
			'vscode.diff',
			lostChangeUri(change, 'before'),
			lostChangeUri(change, 'after'),
			`${change.label} (${describeKind(change.kind).toLowerCase()}, lost)`,
			{ preview: true }
		);
	}

	/** Apply changes to the image, in the order of the log, and tell which ones failed. */
	async replay(refs: string[]): Promise<void> {
		if (refs.length === 0) {
			return;
		}
		const result = await requireEnvironment(this.environment).replayLostChanges(refs);
		const labels = new Map(this.changes.map((change) => [change.ref, change.label]));
		await this.refresh();
		if (result.failures.length > 0) {
			const reasons = result.failures.map((failure) => `${labels.get(failure.ref) ?? failure.ref}: ${failure.message}`).join('; ');
			void vscode.window.showWarningMessage(`Unable to replay ${result.failures.length === 1 ? '1 change' : `${result.failures.length} changes`}. ${reasons}`);
		}
		if (result.replayed.length > 0) {
			void vscode.window.setStatusBarMessage(`Replayed ${result.replayed.length === 1 ? '1 lost change' : `${result.replayed.length} lost changes`}`, 5000);
		}
	}

	async dismiss(refs: string[]): Promise<void> {
		if (refs.length === 0) {
			return;
		}
		await requireEnvironment(this.environment).dismissLostChanges(refs);
		await this.refresh();
	}

	dispose(): void {
		this.sourceControl?.dispose();
		this.changeEmitter.dispose();
	}

	private update(changes: EnvLostChange[]): void {
		this.changes = changes;
		if (changes.length === 0) {
			this.sourceControl?.dispose();
			this.sourceControl = undefined;
			this.group = undefined;
			return;
		}
		if (!this.sourceControl || !this.group) {
			this.sourceControl = vscode.scm.createSourceControl(SOURCE_CONTROL_ID, 'Epicea');
			this.sourceControl.inputBox.visible = false;
			this.group = this.sourceControl.createResourceGroup('lostChanges', 'Lost Changes');
		}
		this.group.resourceStates = changes.map((change) => new LostChangeState(change));
		this.sourceControl.count = changes.length;
		for (const change of changes) {
			this.changeEmitter.fire(lostChangeUri(change, 'before'));
			this.changeEmitter.fire(lostChangeUri(change, 'after'));
		}
	}
}

/**
 * Answer the refs of the arguments of a command of the Source Control view: the selected resource states, as VS Code
 * passes them one argument each, or a resource group.
 */
export function lostChangeRefsOf(argument: unknown, others: unknown[] = []): string[] {
	const states = argument && typeof argument === 'object' && 'resourceStates' in argument
		? (argument as vscode.SourceControlResourceGroup).resourceStates
		: [argument, ...others];
	const refs = states.filter((state): state is LostChangeState => state instanceof LostChangeState).map((state) => state.change.ref);
	return [...new Set(refs)];
}

/** Register the Epicea source control and the commands `pharo.lostChanges.*`. */
export function registerLostChanges(context: vscode.ExtensionContext, environment: () => PharoEnvironment | undefined): LostChanges {
	const lostChanges = new LostChanges(environment);
	context.subscriptions.push(
		lostChanges,
		vscode.workspace.registerTextDocumentContentProvider(LOST_CHANGE_SCHEME, lostChanges),
		vscode.commands.registerCommand('pharo.lostChanges.show', () => reportErrors(() => lostChanges.reveal())),
		vscode.commands.registerCommand('pharo.lostChanges.refresh', () => reportErrors(() => lostChanges.refresh())),
		vscode.commands.registerCommand('pharo.lostChanges.open', (state: LostChangeState) => reportErrors(() => lostChanges.open(state))),
		vscode.commands.registerCommand('pharo.lostChanges.replay', (argument?: unknown, ...others: unknown[]) =>
			reportErrors(() => lostChanges.replay(lostChangeRefsOf(argument, others)))),
		vscode.commands.registerCommand('pharo.lostChanges.dismiss', (argument?: unknown, ...others: unknown[]) =>
			reportErrors(() => lostChanges.dismiss(lostChangeRefsOf(argument, others)))),
		vscode.commands.registerCommand('pharo.lostChanges.replayAll', () =>
			reportErrors(() => lostChanges.replay(lostChanges.pending.map((change) => change.ref)))),
		vscode.commands.registerCommand('pharo.lostChanges.dismissAll', () =>
			reportErrors(() => lostChanges.dismiss(lostChanges.pending.map((change) => change.ref))))
	);
	return lostChanges;
}
