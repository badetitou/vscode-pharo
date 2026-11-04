import * as vscode from 'vscode';
import { ENTITY_SCHEME, entityIdOf, parseEntityUri } from './env/entityUri';

// The breakpoints of VS Code are debug points of the image (docs/debug-points.md): the image keeps them installed whether
// a debug session runs or not, and a process that hits one stops for the debugger (pls-debug/stopped). The extension
// sends them with pls-debug:setBreakpoints and pls-debug:setFunctionBreakpoints each time they change, and shows the
// debug points the image already holds.

export const SET_BREAKPOINTS_REQUEST = 'pls-debug:setBreakpoints';
export const SET_FUNCTION_BREAKPOINTS_REQUEST = 'pls-debug:setFunctionBreakpoints';
export const BREAKPOINTS_REQUEST = 'pls-debug:breakpoints';

/** JSON-RPC error of a request the server does not know. */
const METHOD_NOT_FOUND = -32601;

export interface DebugPointsServer {
	sendRequest(method: string, params?: unknown): PromiseLike<unknown>;
}

/** What of the breakpoints of VS Code the synchronization needs: easy to replace in the tests. */
export interface BreakpointsApi {
	breakpoints(): readonly vscode.Breakpoint[];
	add(breakpoints: vscode.Breakpoint[]): void;
}

/** A breakpoint of the image, as pls-debug:breakpoints answers it. */
export interface ImageBreakpoint {
	entity: string;
	uri: string;
	line: number;
	condition?: string;
	hitCondition?: string;
	logMessage?: string;
}

interface BreakpointParams {
	line: number;
	condition?: string;
	hitCondition?: string;
	logMessage?: string;
}

/** The pls-env id of the method of an editor, or undefined when the editor does not show a method of the image. */
function methodEntityOf(uri: vscode.Uri): string | undefined {
	const location = parseEntityUri(uri);
	return location?.side ? entityIdOf(location) : undefined;
}

function paramsOf(breakpoint: vscode.SourceBreakpoint): BreakpointParams {
	const params: BreakpointParams = { line: breakpoint.location.range.start.line + 1 };
	if (breakpoint.condition) {
		params.condition = breakpoint.condition;
	}
	if (breakpoint.hitCondition) {
		params.hitCondition = breakpoint.hitCondition;
	}
	if (breakpoint.logMessage) {
		params.logMessage = breakpoint.logMessage;
	}
	return params;
}

function sameUri(a: vscode.Uri, b: vscode.Uri): boolean {
	return a.scheme === b.scheme && a.path === b.path;
}

export class DebugPointsSync implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	/** Entities whose breakpoints the image holds, to remove them when VS Code has none left. */
	private readonly sent = new Set<string>();
	private supported = true;
	private queue: Promise<unknown> = Promise.resolve();

	constructor(private readonly server: DebugPointsServer, private readonly api: BreakpointsApi, private readonly log: (message: string) => void = () => undefined) {}

	/** Show the breakpoints of the image VS Code does not have, then install the ones of VS Code in the image. */
	async start(): Promise<void> {
		await this.importImageBreakpoints();
		await this.sendAll();
	}

	/** Send again the breakpoints of the entities that the change touched. */
	onDidChange(event: vscode.BreakpointsChangeEvent): Promise<void> {
		const touched = [...event.added, ...event.removed, ...event.changed];
		const uris: vscode.Uri[] = [];
		for (const breakpoint of touched) {
			if (breakpoint instanceof vscode.SourceBreakpoint && !uris.some((uri) => sameUri(uri, breakpoint.location.uri))) {
				uris.push(breakpoint.location.uri);
			}
		}
		const functions = touched.some((breakpoint) => breakpoint instanceof vscode.FunctionBreakpoint);
		return this.enqueue(async () => {
			for (const uri of uris) {
				await this.sendEntity(uri);
			}
			if (functions) {
				await this.sendFunctions();
			}
		});
	}

	/** Saving a method compiles it again, which removes its debug points: install them again. */
	onDidSave(uri: vscode.Uri): Promise<void> {
		const entity = methodEntityOf(uri);
		if (!entity || !this.sent.has(entity)) {
			return Promise.resolve();
		}
		return this.enqueue(() => this.sendEntity(uri));
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		const next = this.queue.then(task, task);
		this.queue = next.catch(() => undefined);
		return next;
	}

	private sourceBreakpoints(): vscode.SourceBreakpoint[] {
		return this.api
			.breakpoints()
			.filter((breakpoint): breakpoint is vscode.SourceBreakpoint => breakpoint instanceof vscode.SourceBreakpoint && breakpoint.location.uri.scheme === ENTITY_SCHEME);
	}

	private async importImageBreakpoints(): Promise<void> {
		let listed: ImageBreakpoint[];
		try {
			listed = ((await this.server.sendRequest(BREAKPOINTS_REQUEST)) as ImageBreakpoint[] | null) ?? [];
		} catch (error) {
			this.handleError(error);
			return;
		}
		const known = this.sourceBreakpoints();
		const added: vscode.Breakpoint[] = [];
		for (const each of listed) {
			const uri = vscode.Uri.parse(each.uri);
			if (known.some((breakpoint) => sameUri(breakpoint.location.uri, uri))) {
				continue;
			}
			added.push(
				new vscode.SourceBreakpoint(
					new vscode.Location(uri, new vscode.Position(Math.max(each.line - 1, 0), 0)),
					true,
					each.condition,
					each.hitCondition,
					each.logMessage
				)
			);
		}
		if (added.length > 0) {
			this.api.add(added);
		}
	}

	private async sendAll(): Promise<void> {
		const uris: vscode.Uri[] = [];
		for (const breakpoint of this.sourceBreakpoints()) {
			if (!uris.some((uri) => sameUri(uri, breakpoint.location.uri))) {
				uris.push(breakpoint.location.uri);
			}
		}
		for (const uri of uris) {
			await this.sendEntity(uri);
		}
		await this.sendFunctions();
	}

	private async sendEntity(uri: vscode.Uri): Promise<void> {
		const entity = methodEntityOf(uri);
		if (!entity || !this.supported) {
			return;
		}
		const breakpoints = this.sourceBreakpoints()
			.filter((breakpoint) => breakpoint.enabled && sameUri(breakpoint.location.uri, uri))
			.map(paramsOf);
		if (breakpoints.length === 0 && !this.sent.has(entity)) {
			return;
		}
		try {
			const answers = ((await this.server.sendRequest(SET_BREAKPOINTS_REQUEST, { entity, breakpoints })) as { verified: boolean; message?: string }[] | null) ?? [];
			answers.forEach((answer, index) => {
				if (!answer.verified) {
					this.log(`Breakpoint at line ${breakpoints[index]?.line} of ${entity} not installed: ${answer.message ?? 'unknown reason'}`);
				}
			});
			if (breakpoints.length === 0) {
				this.sent.delete(entity);
			} else {
				this.sent.add(entity);
			}
		} catch (error) {
			this.handleError(error);
		}
	}

	private async sendFunctions(): Promise<void> {
		if (!this.supported) {
			return;
		}
		const breakpoints = this.api
			.breakpoints()
			.filter((breakpoint): breakpoint is vscode.FunctionBreakpoint => breakpoint instanceof vscode.FunctionBreakpoint && breakpoint.enabled)
			.map((breakpoint) => {
				const params: { name: string; condition?: string; hitCondition?: string } = { name: breakpoint.functionName };
				if (breakpoint.condition) {
					params.condition = breakpoint.condition;
				}
				if (breakpoint.hitCondition) {
					params.hitCondition = breakpoint.hitCondition;
				}
				return params;
			});
		try {
			const answers = ((await this.server.sendRequest(SET_FUNCTION_BREAKPOINTS_REQUEST, { breakpoints })) as { verified: boolean; message?: string }[] | null) ?? [];
			answers.forEach((answer, index) => {
				if (!answer.verified) {
					this.log(`Function breakpoint ${breakpoints[index]?.name} not installed: ${answer.message ?? 'unknown reason'}`);
				}
			});
		} catch (error) {
			this.handleError(error);
		}
	}

	private handleError(error: unknown): void {
		if ((error as { code?: number })?.code === METHOD_NOT_FOUND) {
			if (this.supported) {
				this.log('The Pharo Language Server does not install breakpoints (pls-debug:setBreakpoints); update the server to use them.');
			}
			this.supported = false;
			return;
		}
		this.log(`Could not install the breakpoints in the image: ${(error as Error)?.message ?? error}`);
	}

	dispose(): void {
		this.disposables.forEach((disposable) => disposable.dispose());
	}

	/** Follow the breakpoints of VS Code and the saves of the method editors. */
	listen(): this {
		this.disposables.push(
			vscode.debug.onDidChangeBreakpoints((event) => void this.onDidChange(event)),
			vscode.workspace.onDidSaveTextDocument((document) => void this.onDidSave(document.uri))
		);
		return this;
	}
}

export function activateDebugPoints(context: vscode.ExtensionContext, server: DebugPointsServer, log: (message: string) => void): void {
	const sync = new DebugPointsSync(server, { breakpoints: () => vscode.debug.breakpoints, add: (breakpoints) => vscode.debug.addBreakpoints(breakpoints) }, log).listen();
	context.subscriptions.push(sync);
	void sync.start();
}
