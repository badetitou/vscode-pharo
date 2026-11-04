import * as assert from 'assert';
import * as vscode from 'vscode';
import { BREAKPOINTS_REQUEST, BreakpointsApi, DebugPointsSync, SET_BREAKPOINTS_REQUEST, SET_FUNCTION_BREAKPOINTS_REQUEST } from '../../debugPoints';
import { DebugStoppedServer, attachOnStop } from '../../debugLive';

class FakeServer {
	readonly requests: { method: string; params?: any }[] = [];
	constructor(private readonly answers: Record<string, any> = {}) {}

	async sendRequest(method: string, params?: any): Promise<unknown> {
		this.requests.push({ method, params });
		const answer = this.answers[method];
		if (answer instanceof Error) {
			throw answer;
		}
		if (typeof answer === 'function') {
			return answer(params);
		}
		return answer;
	}

	of(method: string): any[] {
		return this.requests.filter((request) => request.method === method).map((request) => request.params);
	}
}

class FakeBreakpoints implements BreakpointsApi {
	constructor(public all: vscode.Breakpoint[] = []) {}
	breakpoints(): readonly vscode.Breakpoint[] {
		return this.all;
	}
	add(breakpoints: vscode.Breakpoint[]): void {
		this.all = [...this.all, ...breakpoints];
	}
}

const sumUri = vscode.Uri.parse('pharo:/image/Pkg/Shop/instance/sum%3A.st');
const classUri = vscode.Uri.parse('pharo:/image/Pkg/Shop.class.st');

function at(uri: vscode.Uri, line: number, condition?: string, hitCondition?: string, logMessage?: string, enabled = true): vscode.SourceBreakpoint {
	return new vscode.SourceBreakpoint(new vscode.Location(uri, new vscode.Position(line, 0)), enabled, condition, hitCondition, logMessage);
}

const verified = (params: any) => params.breakpoints.map(() => ({ verified: true }));

function change(added: vscode.Breakpoint[] = [], removed: vscode.Breakpoint[] = [], changed: vscode.Breakpoint[] = []): vscode.BreakpointsChangeEvent {
	return { added, removed, changed };
}

suite('Breakpoints as debug points of the image', () => {
	test('installs the breakpoints of a method editor, with lines from 1 and their condition, hit condition and log message', async () => {
		const server = new FakeServer({ [BREAKPOINTS_REQUEST]: [], [SET_BREAKPOINTS_REQUEST]: verified, [SET_FUNCTION_BREAKPOINTS_REQUEST]: [] });
		const api = new FakeBreakpoints([at(sumUri, 2, 'b > 1'), at(sumUri, 4, undefined, '3', 'b is {b}'), at(sumUri, 5, undefined, undefined, undefined, false)]);
		await new DebugPointsSync(server, api).start();
		assert.deepStrictEqual(server.of(SET_BREAKPOINTS_REQUEST), [
			{ entity: 'method:Shop>>sum:', breakpoints: [{ line: 3, condition: 'b > 1' }, { line: 5, hitCondition: '3', logMessage: 'b is {b}' }] }
		]);
		assert.deepStrictEqual(server.of(SET_FUNCTION_BREAKPOINTS_REQUEST), [{ breakpoints: [] }]);
	});

	test('ignores breakpoints outside method editors', async () => {
		const server = new FakeServer({ [BREAKPOINTS_REQUEST]: [], [SET_BREAKPOINTS_REQUEST]: verified, [SET_FUNCTION_BREAKPOINTS_REQUEST]: [] });
		const api = new FakeBreakpoints([at(classUri, 1), at(vscode.Uri.file('/tmp/Shop.class.st'), 3)]);
		await new DebugPointsSync(server, api).start();
		assert.deepStrictEqual(server.of(SET_BREAKPOINTS_REQUEST), []);
	});

	test('shows the breakpoints of the image on the methods that have none in VS Code', async () => {
		const server = new FakeServer({
			[BREAKPOINTS_REQUEST]: [
				{ entity: 'method:Shop>>sum:', uri: 'pharo:/image/Pkg/Shop/instance/sum%3A.st', line: 4, condition: 'b > 1' },
				{ entity: 'method:Shop>>total', uri: 'pharo:/image/Pkg/Shop/instance/total.st', line: 2 }
			],
			[SET_BREAKPOINTS_REQUEST]: verified,
			[SET_FUNCTION_BREAKPOINTS_REQUEST]: []
		});
		const api = new FakeBreakpoints([at(sumUri, 0)]);
		await new DebugPointsSync(server, api).start();
		assert.strictEqual(api.all.length, 2);
		const imported = api.all[1] as vscode.SourceBreakpoint;
		assert.strictEqual(imported.location.uri.path, '/image/Pkg/Shop/instance/total.st');
		assert.strictEqual(imported.location.range.start.line, 1);
		assert.deepStrictEqual(server.of(SET_BREAKPOINTS_REQUEST).map((params) => params.entity), ['method:Shop>>sum:', 'method:Shop>>total']);
	});

	test('sends again the breakpoints of a method when they change, and an empty list when none is left', async () => {
		const server = new FakeServer({ [BREAKPOINTS_REQUEST]: [], [SET_BREAKPOINTS_REQUEST]: verified, [SET_FUNCTION_BREAKPOINTS_REQUEST]: [] });
		const first = at(sumUri, 2);
		const api = new FakeBreakpoints([first]);
		const sync = new DebugPointsSync(server, api);
		await sync.start();
		const second = at(sumUri, 6);
		api.all = [first, second];
		await sync.onDidChange(change([second]));
		api.all = [];
		await sync.onDidChange(change([], [first, second]));
		assert.deepStrictEqual(
			server.of(SET_BREAKPOINTS_REQUEST).map((params) => params.breakpoints.map((breakpoint: any) => breakpoint.line)),
			[[3], [3, 7], []]
		);
	});

	test('installs the breakpoints of a method again when it is saved', async () => {
		const server = new FakeServer({ [BREAKPOINTS_REQUEST]: [], [SET_BREAKPOINTS_REQUEST]: verified, [SET_FUNCTION_BREAKPOINTS_REQUEST]: [] });
		const sync = new DebugPointsSync(server, new FakeBreakpoints([at(sumUri, 2)]));
		await sync.start();
		await sync.onDidSave(sumUri);
		await sync.onDidSave(vscode.Uri.parse('pharo:/image/Pkg/Shop/instance/total.st'));
		assert.strictEqual(server.of(SET_BREAKPOINTS_REQUEST).length, 2);
	});

	test('sends the function breakpoints when one changes', async () => {
		const server = new FakeServer({ [BREAKPOINTS_REQUEST]: [], [SET_BREAKPOINTS_REQUEST]: verified, [SET_FUNCTION_BREAKPOINTS_REQUEST]: verified });
		const api = new FakeBreakpoints();
		const sync = new DebugPointsSync(server, api);
		await sync.start();
		const function_ = new vscode.FunctionBreakpoint('Shop>>sum:', true, 'b > 1');
		api.all = [function_, new vscode.FunctionBreakpoint('Shop>>total', false)];
		await sync.onDidChange(change([function_]));
		assert.deepStrictEqual(server.of(SET_FUNCTION_BREAKPOINTS_REQUEST).slice(-1)[0], { breakpoints: [{ name: 'Shop>>sum:', condition: 'b > 1' }] });
	});

	test('logs the breakpoints the image could not install', async () => {
		const logs: string[] = [];
		const server = new FakeServer({
			[BREAKPOINTS_REQUEST]: [],
			[SET_BREAKPOINTS_REQUEST]: [{ verified: false, message: 'No statement on this line or after it' }],
			[SET_FUNCTION_BREAKPOINTS_REQUEST]: []
		});
		await new DebugPointsSync(server, new FakeBreakpoints([at(sumUri, 9)]), (message) => logs.push(message)).start();
		assert.strictEqual(logs.length, 1);
		assert.ok(logs[0].includes('line 10'));
	});

	test('stops sending to a server that does not know the requests', async () => {
		const logs: string[] = [];
		const unknown = Object.assign(new Error('Unhandled method'), { code: -32601 });
		const server = new FakeServer({ [BREAKPOINTS_REQUEST]: unknown, [SET_BREAKPOINTS_REQUEST]: unknown, [SET_FUNCTION_BREAKPOINTS_REQUEST]: unknown });
		const api = new FakeBreakpoints([at(sumUri, 2)]);
		const sync = new DebugPointsSync(server, api, (message) => logs.push(message));
		await sync.start();
		await sync.onDidChange(change([at(sumUri, 4)]));
		assert.deepStrictEqual(server.requests.map((request) => request.method), [BREAKPOINTS_REQUEST]);
		assert.strictEqual(logs.length, 1);
	});

	test('opens the debugger at once on a process stopped on a breakpoint', async () => {
		let handler: ((params: any) => Promise<void>) | undefined;
		const server: DebugStoppedServer = {
			onNotification: (_method, each) => {
				handler = each as any;
				return new vscode.Disposable(() => undefined);
			},
			sendRequest: async () => undefined
		};
		const started: vscode.DebugConfiguration[] = [];
		const offered: string[] = [];
		attachOnStop(server, async (configuration) => started.push(configuration), { mode: () => 'notify', choose: async (message) => { offered.push(message); return undefined; } }, async () => undefined);
		await handler!({ id: 7, name: 'Break', exception: 'Break', breakpoint: true });
		assert.deepStrictEqual(offered, []);
		assert.deepStrictEqual(started, [{ type: 'pharodb', request: 'attach', name: 'Break', debugSessionId: 7 }]);
	});
});
