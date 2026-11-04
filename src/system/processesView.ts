import * as vscode from 'vscode';
import { PharoProcess, StackFrame, expectDebugSessionId, expectProcesses, expectStack } from './systemContracts';

// The Processes view: the processes of the image (pls-system:processes), with the stack of each one, to find a stuck
// process and terminate or debug it, as the Process Browser of Pharo does.

export const PROCESSES_VIEW_ID = 'pharoProcesses';
export const PROCESSES_REQUEST = 'pls-system:processes';
export const STACK_REQUEST = 'pls-system:stack';
export const TERMINATE_REQUEST = 'pls-system:terminate';
export const DEBUG_PROCESS_REQUEST = 'pls-system:debug';

/** Frames of a stack the view shows. */
const STACK_LIMIT = 50;
/** Processes at this priority or above run the system (timers, finalization, I/O): terminating them can break the image. */
const SYSTEM_PRIORITY = 50;

export type SystemRequest = (method: string, params?: unknown) => PromiseLike<unknown>;

export type ProcessNode =
	| { kind: 'process'; process: PharoProcess }
	| { kind: 'frame'; frame: StackFrame; process: number; index: number }
	| { kind: 'message'; text: string; icon: string };

export interface ProcessesUi {
	confirm(message: string, detail: string, action: string): PromiseLike<boolean>;
	error(message: string): void;
}

const STATE_ICONS: Record<PharoProcess['state'], string> = {
	running: 'play-circle',
	ready: 'debug-start',
	waiting: 'watch',
	suspended: 'debug-pause',
	terminated: 'debug-stop'
};

export class ProcessesProvider implements vscode.TreeDataProvider<ProcessNode> {
	private readonly changeEmitter = new vscode.EventEmitter<ProcessNode | undefined>();
	readonly onDidChangeTreeData = this.changeEmitter.event;

	constructor(private readonly request: () => SystemRequest | undefined) {}

	refresh(): void {
		this.changeEmitter.fire(undefined);
	}

	async getChildren(node?: ProcessNode): Promise<ProcessNode[]> {
		const request = this.request();
		if (!request || node?.kind === 'frame' || node?.kind === 'message') {
			return [];
		}
		try {
			if (!node) {
				const processes = expectProcesses(await request(PROCESSES_REQUEST), PROCESSES_REQUEST);
				return processes.map((process) => ({ kind: 'process', process }));
			}
			const frames = expectStack(await request(STACK_REQUEST, { id: node.process.id, limit: STACK_LIMIT }), STACK_REQUEST);
			return frames.map((frame, index) => ({ kind: 'frame', frame, process: node.process.id, index }));
		} catch (error) {
			return [{ kind: 'message', text: messageOf(error), icon: 'error' }];
		}
	}

	getTreeItem(node: ProcessNode): vscode.TreeItem {
		switch (node.kind) {
			case 'process': {
				const { process } = node;
				const item = new vscode.TreeItem(process.name, vscode.TreeItemCollapsibleState.Collapsed);
				item.id = `process/${process.id}`;
				item.description = describe(process);
				item.tooltip = tooltipOf(process);
				item.iconPath = new vscode.ThemeIcon(STATE_ICONS[process.state]);
				item.contextValue = process.current ? 'pharoProcess.current' : 'pharoProcess';
				return item;
			}
			case 'frame': {
				const item = new vscode.TreeItem(node.frame.label);
				item.id = `process/${node.process}/${node.index}`;
				item.iconPath = new vscode.ThemeIcon(node.frame.label.startsWith('[] in ') ? 'symbol-namespace' : 'symbol-method');
				if (node.frame.uri) {
					item.command = { command: 'vscode.open', title: 'Open Method', arguments: [vscode.Uri.parse(node.frame.uri)] };
				}
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

/** Answer the description of a process in the view: its priority, its state and the method it runs. */
export function describe(process: PharoProcess): string {
	return [`${process.priority}`, process.state, process.method].filter((part) => part !== undefined).join(' · ');
}

function tooltipOf(process: PharoProcess): vscode.MarkdownString {
	const tooltip = new vscode.MarkdownString();
	tooltip.appendMarkdown(`**${process.name}**\n\nPriority ${process.priority}, ${process.state}`);
	if (process.ui) {
		tooltip.appendMarkdown(' — user interface process');
	}
	if (process.current) {
		tooltip.appendMarkdown(' — answers VS Code');
	}
	if (process.method) {
		tooltip.appendMarkdown('\n\n');
		tooltip.appendCodeblock(process.method, 'pharo');
	}
	return tooltip;
}

/**
 * Terminate a process after a confirmation, which warns when the process runs the system or the user interface of
 * the image. Answer whether it was terminated.
 */
export async function terminateProcess(process: PharoProcess, request: SystemRequest, ui: ProcessesUi): Promise<boolean> {
	if (process.current) {
		ui.error('This process answers VS Code: it cannot be terminated.');
		return false;
	}
	const risk = process.ui
		? 'It runs the user interface of the image.'
		: process.priority >= SYSTEM_PRIORITY
			? `Its priority (${process.priority}) is the one of a process of the system: the image may stop working.`
			: 'Its stack is unwound: the blocks of its ensure: run, the rest of its work is lost.';
	if (!(await ui.confirm(`Terminate "${process.name}"?`, risk, 'Terminate'))) {
		return false;
	}
	try {
		await request(TERMINATE_REQUEST, { id: process.id });
		return true;
	} catch (error) {
		ui.error(`Cannot terminate "${process.name}": ${messageOf(error)}`);
		return false;
	}
}

/**
 * Suspend a process and give it to the debugger. The image tells the client with a pls-debug/stopped notification
 * that opens the debugger at once (see debugLive.ts). Answer the id of the debug session.
 */
export async function debugProcess(process: PharoProcess, request: SystemRequest, ui: ProcessesUi): Promise<number | undefined> {
	if (process.current) {
		ui.error('This process answers VS Code: it cannot be debugged.');
		return undefined;
	}
	try {
		return expectDebugSessionId(await request(DEBUG_PROCESS_REQUEST, { id: process.id }), DEBUG_PROCESS_REQUEST);
	} catch (error) {
		ui.error(`Cannot debug "${process.name}": ${messageOf(error)}`);
		return undefined;
	}
}

const vscodeUi: ProcessesUi = {
	confirm: async (message, detail, action) => (await vscode.window.showWarningMessage(message, { modal: true, detail }, action)) === action,
	error: (message) => void vscode.window.showErrorMessage(message)
};

export function registerProcessesView(context: vscode.ExtensionContext, request: () => SystemRequest | undefined): ProcessesProvider {
	const provider = new ProcessesProvider(request);
	const view = vscode.window.createTreeView(PROCESSES_VIEW_ID, { treeDataProvider: provider, showCollapseAll: true });
	const withProcess = (action: (process: PharoProcess, request: SystemRequest) => PromiseLike<unknown>) =>
		async (node?: ProcessNode) => {
			const target = node ?? view.selection[0];
			const server = request();
			if (target?.kind === 'process' && server) {
				await action(target.process, server);
			}
		};
	context.subscriptions.push(
		view,
		view.onDidChangeVisibility((event) => event.visible && provider.refresh()),
		vscode.commands.registerCommand('pharo.processes.refresh', () => provider.refresh()),
		vscode.commands.registerCommand('pharo.processes.terminate', withProcess(async (process, server) => {
			if (await terminateProcess(process, server, vscodeUi)) {
				provider.refresh();
			}
		})),
		vscode.commands.registerCommand('pharo.processes.debug', withProcess(async (process, server) => {
			await debugProcess(process, server, vscodeUi);
			provider.refresh();
		})),
		vscode.commands.registerCommand('pharo.processes.openMethod', withProcess(async (process) => {
			if (process.uri) {
				await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(process.uri));
			}
		}))
	);
	return provider;
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
