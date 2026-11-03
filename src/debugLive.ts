import * as vscode from 'vscode';
import { ENTITY_SCHEME } from './env/entityUri';

// Debugger-driven development in the `pharodb` debugger: Create the missing method, edit-and-continue and the restarts
// of the exception. They talk to the custom requests of the DAP server of the image (`pharoMissingMethod`,
// `pharoCreateMissingMethod`, `restartFrame`, `pharoRestarts` and `pharoRestart`).

export const DEBUG_TYPE = 'pharodb';

/** What of a debug session the features need: easy to replace in the tests. */
export interface DebugSessionLike {
	customRequest(command: string, args?: unknown): PromiseLike<any>;
}

export interface MissingMethod {
	kind: 'doesNotUnderstand' | 'subclassResponsibility';
	selector: string;
	className: string;
	classes: string[];
	protocols: string[];
}

export interface Restart {
	id: string;
	label: string;
	detail?: string;
	needsValue: boolean;
}

export interface DebugUi {
	pick<T extends vscode.QuickPickItem>(items: T[], placeHolder: string): PromiseLike<T | undefined>;
	input(prompt: string): PromiseLike<string | undefined>;
	openEntity(uri: vscode.Uri): PromiseLike<unknown>;
	error(message: string): void;
}

export const UNCLASSIFIED_PROTOCOL = 'as yet unclassified';

/** Answer the method that the stopped process misses, or undefined when it did not stop on one. */
export async function missingMethodOf(session: DebugSessionLike): Promise<MissingMethod | undefined> {
	try {
		return (await session.customRequest('pharoMissingMethod')) as MissingMethod;
	} catch {
		return undefined;
	}
}

/**
 * Implement the missing method, asking the class and the protocol, and open its editor. Answer whether the method was
 * created: the user can cancel.
 */
export async function createMissingMethod(session: DebugSessionLike, ui: DebugUi, missing?: MissingMethod): Promise<boolean> {
	missing ??= await missingMethodOf(session);
	if (!missing) {
		ui.error('The Pharo process did not stop on a missing method.');
		return false;
	}
	const className = await ui.pick(
		missing.classes.map((label) => ({ label, description: label === missing!.className ? 'class of the receiver' : undefined })),
		`Class that implements ${missing.selector}`
	);
	if (!className) {
		return false;
	}
	const protocol = await ui.pick(
		[UNCLASSIFIED_PROTOCOL, ...missing.protocols.filter((name) => name !== UNCLASSIFIED_PROTOCOL)].map((label) => ({ label })),
		`Protocol of ${className.label}>>${missing.selector}`
	);
	if (!protocol) {
		return false;
	}
	try {
		const body = await session.customRequest('pharoCreateMissingMethod', { className: className.label, protocol: protocol.label });
		if (typeof body?.uri === 'string') {
			await ui.openEntity(vscode.Uri.parse(body.uri));
		}
		return true;
	} catch (error) {
		ui.error(`Could not create the method: ${(error as Error).message}`);
		return false;
	}
}

/** Show the restarts of the exception and run the one the user picks, asking the expression it needs. */
export async function pickRestart(session: DebugSessionLike, ui: DebugUi): Promise<boolean> {
	let restarts: Restart[];
	try {
		restarts = (await session.customRequest('pharoRestarts')).restarts as Restart[];
	} catch (error) {
		ui.error(`Could not get the restarts: ${(error as Error).message}`);
		return false;
	}
	const picked = await ui.pick(
		restarts.map((restart) => ({ label: restart.label, detail: restart.detail, restart })),
		'Restarts of the exception'
	);
	if (!picked) {
		return false;
	}
	const restart = picked.restart;
	if (restart.id === 'create') {
		return createMissingMethod(session, ui);
	}
	const args: { id: string; expression?: string } = { id: restart.id };
	if (restart.needsValue) {
		const expression = await ui.input(`Expression of the value (${restart.label.replace('…', '')})`);
		if (expression === undefined) {
			return false;
		}
		args.expression = expression;
	}
	try {
		await session.customRequest('pharoRestart', args);
		return true;
	} catch (error) {
		ui.error(`${restart.label} failed: ${(error as Error).message}`);
		return false;
	}
}

/** The id of the top frame of the stack that runs the method of the editor `uri`, if any. */
export async function frameOfEditor(session: DebugSessionLike, uri: vscode.Uri): Promise<number | undefined> {
	const { threads } = await session.customRequest('threads');
	for (const thread of threads ?? []) {
		const { stackFrames } = await session.customRequest('stackTrace', { threadId: thread.id });
		const frame = (stackFrames ?? []).find((each: any) => each.source?.path && vscode.Uri.parse(each.source.path).path === uri.path);
		if (frame) {
			return frame.id;
		}
	}
	return undefined;
}

/**
 * Edit-and-continue: the method of an editor that was saved is on the stack, so restart its frame on the new code. The
 * server answers with a stopped event, which refreshes the stack of the client. Answer whether a frame was restarted.
 */
export async function restartFrameOfSavedMethod(session: DebugSessionLike, uri: vscode.Uri): Promise<boolean> {
	if (uri.scheme !== ENTITY_SCHEME) {
		return false;
	}
	const frameId = await frameOfEditor(session, uri);
	if (frameId === undefined) {
		return false;
	}
	await session.customRequest('restartFrame', { frameId });
	return true;
}

const vscodeUi: DebugUi = {
	pick: (items, placeHolder) => vscode.window.showQuickPick(items, { placeHolder, matchOnDetail: true }),
	input: (prompt) => vscode.window.showInputBox({ prompt }),
	openEntity: (uri) => vscode.window.showTextDocument(uri, { preview: false }),
	error: (message) => void vscode.window.showErrorMessage(message)
};

function pharoSession(): vscode.DebugSession | undefined {
	const session = vscode.debug.activeDebugSession;
	return session?.type === DEBUG_TYPE ? session : undefined;
}

/** Watch the stops of the sessions of the Pharo debugger to offer Create on a missing method. */
class PharoDebugTracker implements vscode.DebugAdapterTrackerFactory {
	createDebugAdapterTracker(session: vscode.DebugSession): vscode.DebugAdapterTracker {
		return {
			onDidSendMessage: (message: any) => {
				if (message?.type === 'event' && message.event === 'stopped' && message.body?.reason === 'exception') {
					void offerCreate(session);
				}
			}
		};
	}
}

async function offerCreate(session: vscode.DebugSession): Promise<void> {
	const missing = await missingMethodOf(session);
	if (!missing) {
		return;
	}
	const create = `Create method ${missing.selector}`;
	const choice = await vscode.window.showInformationMessage(
		missing.kind === 'doesNotUnderstand'
			? `${missing.className} does not understand ${missing.selector}`
			: `${missing.className} must implement ${missing.selector} (subclassResponsibility)`,
		create
	);
	if (choice === create) {
		await createMissingMethod(session, vscodeUi, missing);
	}
}

export function activateLiveDebugging(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.debug.registerDebugAdapterTrackerFactory(DEBUG_TYPE, new PharoDebugTracker()),
		vscode.commands.registerCommand('pharo.debug.createMethod', () => {
			const session = pharoSession();
			return session && createMissingMethod(session, vscodeUi);
		}),
		vscode.commands.registerCommand('pharo.debug.restarts', () => {
			const session = pharoSession();
			return session && pickRestart(session, vscodeUi);
		}),
		vscode.workspace.onDidSaveTextDocument((document) => {
			const session = pharoSession();
			if (session && document.uri.scheme === ENTITY_SCHEME) {
				void restartFrameOfSavedMethod(session, document.uri).catch(() => undefined);
			}
		})
	);
}
