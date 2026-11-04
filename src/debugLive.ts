import * as vscode from 'vscode';
import { ENTITY_SCHEME } from './env/entityUri';

// Debugger-driven development in the `pharodb` debugger: Create the missing method, edit-and-continue and the restarts
// of the exception. They talk to the custom requests of the DAP server of the image (`pharoMissingMethod`,
// `pharoCreateMissingMethod`, `restartFrame`, `pharoRestarts` and `pharoRestart`). And the context of a stopped frame:
// the values of its variables at the end of the lines, and Open in Inspector on a variable (`pharoInspectVariable`).

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

/** A variable of a line that the debugger can show at its end. */
export interface VariableOccurrence {
	line: number;
	character: number;
	name: string;
}

const PSEUDO_VARIABLES = new Set(['self', 'super', 'thisContext', 'true', 'false', 'nil']);

/**
 * Answer the variables of the Smalltalk `text` read on lines `firstLine` to `lastLine`, once per line: the identifiers
 * that are neither a selector, a pseudo-variable, a global, a declaration of temporaries nor in a comment, a string or a
 * literal. VS Code looks each name up in the scopes of the stopped frame.
 */
export function variableOccurrences(text: string, firstLine: number, lastLine: number): VariableOccurrence[] {
	const occurrences: VariableOccurrence[] = [];
	const seen = new Set<string>();
	let line = 0;
	let lineStart = 0;
	// After an operand the next identifier is a unary selector; after a cascade too.
	let afterOperand = false;
	let inTemporaries = false;
	let i = 0;
	const skipTo = (end: number) => {
		for (; i < end && i < text.length; i++) {
			if (text[i] === '\n') {
				line++;
				lineStart = i + 1;
			}
		}
	};
	const skipDelimited = (open: number, close: string) => {
		// From the opening quote, skip to after the closing one; a doubled quote stays in the literal
		let end = open + 1;
		while (end < text.length) {
			if (text[end] === close) {
				if (text[end + 1] !== close) {
					break;
				}
				end++;
			}
			end++;
		}
		skipTo(end + 1);
	};
	while (i < text.length && line <= lastLine) {
		const char = text[i];
		if (char === '\n' || /\s/.test(char)) {
			skipTo(i + 1);
		} else if (char === '"') {
			skipDelimited(i, '"');
		} else if (char === '\'') {
			skipDelimited(i, '\'');
			afterOperand = true;
		} else if (char === '$') {
			skipTo(i + 2);
			afterOperand = true;
		} else if (char === '#') {
			if (text[i + 1] === '(' || text[i + 1] === '[') {
				// A literal array: skip to its balanced end
				let depth = 0;
				let end = i + 1;
				for (; end < text.length; end++) {
					if (text[end] === '(' || text[end] === '[') {
						depth++;
					} else if ((text[end] === ')' || text[end] === ']') && --depth === 0) {
						break;
					}
				}
				skipTo(end + 1);
			} else if (text[i + 1] === '\'') {
				skipTo(i + 1);
				skipDelimited(i, '\'');
			} else {
				const symbol = /^#[A-Za-z0-9_:]*|^#[-+*/\\<>=~@%&?,|]+/.exec(text.slice(i))![0];
				skipTo(i + Math.max(symbol.length, 1));
			}
			afterOperand = true;
		} else if (/[0-9]/.test(char)) {
			const number = /^[0-9]+(r[0-9A-Z]+)?(\.[0-9]+)?(e-?[0-9]+)?/.exec(text.slice(i))![0];
			skipTo(i + number.length);
			afterOperand = true;
		} else if (/[A-Za-z_]/.test(char)) {
			const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))![0];
			const isKeyword = text[i + name.length] === ':' && text[i + name.length + 1] !== '=';
			const character = i - lineStart;
			skipTo(i + name.length);
			if (isKeyword) {
				skipTo(i + 1);
				afterOperand = false;
				continue;
			}
			// The first identifier of a line is looked up even after an operand: it starts the statement after the
			// selector of a unary method, and a unary selector that continues a cascade on its line only shows nothing
			const startsLine = text.slice(lineStart, character + lineStart).trim() === '';
			const isVariable = (!afterOperand || startsLine) && !PSEUDO_VARIABLES.has(name) && !/^[A-Z]/.test(name);
			if (isVariable && !inTemporaries && line >= firstLine && !seen.has(`${line}:${name}`)) {
				seen.add(`${line}:${name}`);
				occurrences.push({ line, character, name });
			}
			afterOperand = !inTemporaries;
		} else if (char === '|') {
			// A bar opens or closes a declaration of temporaries, unless it is the binary message | between operands; a
			// bar that starts its line opens one, after the selector of a unary method
			if (inTemporaries || !afterOperand || text.slice(lineStart, i).trim() === '') {
				inTemporaries = !inTemporaries;
			}
			afterOperand = false;
			skipTo(i + 1);
		} else if (char === ')' || char === ']' || char === '}') {
			afterOperand = true;
			skipTo(i + 1);
		} else if (char === ';') {
			afterOperand = true;
			skipTo(i + 1);
		} else {
			// Parentheses, brackets, block parameters, statement ends, returns, assignments and binary selectors
			afterOperand = false;
			skipTo(i + 1);
		}
	}
	return occurrences;
}

/** The values of the variables of the method of a stopped frame, at the end of its lines up to the stop. */
export class PharoInlineValuesProvider implements vscode.InlineValuesProvider {
	provideInlineValues(document: vscode.TextDocument, viewPort: vscode.Range, context: vscode.InlineValueContext): vscode.InlineValue[] {
		const lastLine = Math.min(viewPort.end.line, context.stoppedLocation.end.line);
		return variableOccurrences(document.getText(), viewPort.start.line, lastLine).map(
			({ line, character, name }) =>
				new vscode.InlineValueVariableLookup(new vscode.Range(line, character, line, character + name.length), name, true)
		);
	}
}

/** What VS Code gives to a command of the context menu of the Variables view. */
export interface VariableMenuContext {
	sessionId?: string;
	container?: { variablesReference?: number };
	variable?: { name?: string; value?: string };
}

/**
 * Open the Inspector on the object of a variable of the Variables view: the server registers it in the inspector of the
 * language server and answers its reference, that the Inspector view takes over.
 */
export async function inspectVariable(
	session: DebugSessionLike,
	context: VariableMenuContext,
	inspect: (target: { ref: string; label: string }) => PromiseLike<unknown>,
	error: (message: string) => void
): Promise<boolean> {
	const reference = context.container?.variablesReference;
	const name = context.variable?.name;
	if (reference === undefined || name === undefined) {
		return false;
	}
	try {
		const body = await session.customRequest('pharoInspectVariable', { variablesReference: reference, name });
		if (typeof body?.ref !== 'string') {
			error(`Could not inspect ${name}.`);
			return false;
		}
		await inspect({ ref: body.ref, label: context.variable?.value ? `${name}: ${context.variable.value}` : name });
		return true;
	} catch (failure) {
		error(`Could not inspect ${name}: ${(failure as Error).message}`);
		return false;
	}
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
				if (session.configuration.request !== 'attach' && message?.type === 'event' && message.event === 'stopped' && message.body?.reason === 'exception') {
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

/** The notification of the server when a process of the image stopped on an exception that nobody handled. */
export const DEBUG_STOPPED_NOTIFICATION = 'pls-debug/stopped';
export const DEBUG_DISMISS_REQUEST = 'pls-debug:dismiss';

export interface StoppedProcess {
	id: number;
	name?: string;
	exception?: string;
	description?: string;
	receiverClass?: string;
	doesNotUnderstand?: boolean;
	subclassResponsibility?: boolean;
	frames?: string[];
}

export interface DebugStoppedServer {
	onNotification(method: string, handler: (params: Partial<StoppedProcess>) => void): vscode.Disposable;
	sendRequest(method: string, params?: unknown): PromiseLike<unknown>;
}

export interface StoppedProcessUi {
	/** `notify` shows a notification first, `debug` opens the debugger at once. */
	mode(): 'notify' | 'debug';
	choose(message: string, actions: string[]): PromiseLike<string | undefined>;
}

export const DEBUG_ACTION = 'Debug';
export const CREATE_ACTION = 'Create method';
export const DISMISS_ACTION = 'Dismiss';

export function stoppedProcessMessage(process: StoppedProcess): string {
	const where = process.frames?.[0] ?? process.receiverClass;
	return `${process.exception ?? process.name ?? 'Error'}${where ? ` in ${where}` : ''}`;
}

/**
 * Offer a debugger on every process of the image that stops on an exception, like the debugger of Pharo does: a light
 * notification with Debug, Create method (on a missing method) and Dismiss, or the debugger at once by setting.
 */
export function attachOnStop(
	server: DebugStoppedServer,
	start: (configuration: vscode.DebugConfiguration) => PromiseLike<unknown>,
	ui: StoppedProcessUi,
	createMethod: () => PromiseLike<unknown>
): vscode.Disposable {
	return server.onNotification(DEBUG_STOPPED_NOTIFICATION, async (params) => {
		if (typeof params?.id !== 'number') {
			return;
		}
		const process = params as StoppedProcess;
		const attach = () =>
			start({ type: DEBUG_TYPE, request: 'attach', name: process.name ?? 'Pharo', debugSessionId: process.id });
		if (ui.mode() === 'debug') {
			await attach();
			return;
		}
		const missing = process.doesNotUnderstand || process.subclassResponsibility;
		const choice = await ui.choose(
			stoppedProcessMessage(process),
			missing ? [DEBUG_ACTION, CREATE_ACTION, DISMISS_ACTION] : [DEBUG_ACTION, DISMISS_ACTION]
		);
		if (choice === DEBUG_ACTION) {
			await attach();
		} else if (choice === CREATE_ACTION) {
			await attach();
			await createMethod();
		} else if (choice === DISMISS_ACTION) {
			await server.sendRequest(DEBUG_DISMISS_REQUEST, { aDebugSessionId: process.id });
		}
	});
}

export function activateLiveDebugging(context: vscode.ExtensionContext, server?: DebugStoppedServer): void {
	if (server) {
		context.subscriptions.push(
			attachOnStop(
				server,
				(configuration) => vscode.debug.startDebugging(undefined, configuration),
				{
					mode: () => (vscode.workspace.getConfiguration('pharo').get<string>('debug.onUnhandledError') === 'debug' ? 'debug' : 'notify'),
					choose: (message, actions) => vscode.window.showInformationMessage(message, ...actions)
				},
				async () => {
					const session = pharoSession();
					return session && createMissingMethod(session, vscodeUi);
				}
			)
		);
	}
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
		vscode.commands.registerCommand('pharo.debug.inspectVariable', (menuContext: VariableMenuContext) => {
			const session = pharoSession();
			return (
				session &&
				inspectVariable(
					session,
					menuContext,
					(target) => vscode.commands.executeCommand('pharo.inspector.inspect', target),
					vscodeUi.error
				)
			);
		}),
		vscode.languages.registerInlineValuesProvider({ language: 'pharo' }, new PharoInlineValuesProvider()),
		vscode.workspace.onDidSaveTextDocument((document) => {
			const session = pharoSession();
			if (session && document.uri.scheme === ENTITY_SCHEME) {
				void restartFrameOfSavedMethod(session, document.uri).catch(() => undefined);
			}
		})
	);
}
