import * as assert from 'assert';
import * as vscode from 'vscode';
import { DebugSessionLike, DebugStoppedServer, DebugUi, attachOnStop, createMissingMethod, pickRestart, restartFrameOfSavedMethod } from '../../debugLive';

class FakeSession implements DebugSessionLike {
	readonly calls: { command: string; args?: any }[] = [];
	constructor(private readonly answers: Record<string, any>) {}

	async customRequest(command: string, args?: any): Promise<any> {
		this.calls.push({ command, args });
		const answer = this.answers[command];
		if (answer instanceof Error) {
			throw answer;
		}
		return answer;
	}
}

class FakeUi implements DebugUi {
	readonly opened: vscode.Uri[] = [];
	readonly errors: string[] = [];
	constructor(private readonly labels: string[], private readonly expression?: string) {}

	async pick<T extends vscode.QuickPickItem>(items: T[]): Promise<T | undefined> {
		const label = this.labels.shift();
		return label === undefined ? undefined : items.find((item) => item.label === label);
	}
	async input(): Promise<string | undefined> {
		return this.expression;
	}
	async openEntity(uri: vscode.Uri): Promise<void> {
		this.opened.push(uri);
	}
	error(message: string): void {
		this.errors.push(message);
	}
}

const missing = {
	kind: 'doesNotUnderstand',
	selector: 'foo:',
	className: 'Shop',
	classes: ['Shop', 'Object'],
	protocols: ['accessing', 'testing']
};
const methodUri = 'pharo:/image/Pkg/Shop/instance/foo%3A.st';

suite('Debugger-driven development', () => {
	test('creates the missing method in the class and protocol that were picked, and opens it', async () => {
		const session = new FakeSession({ pharoMissingMethod: missing, pharoCreateMissingMethod: { uri: methodUri } });
		const ui = new FakeUi(['Object', 'testing']);
		assert.strictEqual(await createMissingMethod(session, ui), true);
		assert.deepStrictEqual(session.calls[1], { command: 'pharoCreateMissingMethod', args: { className: 'Object', protocol: 'testing' } });
		assert.strictEqual(ui.opened[0].toString(), vscode.Uri.parse(methodUri).toString());
	});

	test('creates nothing when the user cancels', async () => {
		const session = new FakeSession({ pharoMissingMethod: missing });
		assert.strictEqual(await createMissingMethod(session, new FakeUi([])), false);
		assert.strictEqual(session.calls.length, 1);
	});

	test('reports a stop that is not on a missing method', async () => {
		const session = new FakeSession({ pharoMissingMethod: new Error('no') });
		const ui = new FakeUi([]);
		assert.strictEqual(await createMissingMethod(session, ui), false);
		assert.strictEqual(ui.errors.length, 1);
	});

	test('runs the restart that was picked, with the expression it needs', async () => {
		const restarts = [
			{ id: 'proceed', label: 'Proceed', needsValue: false },
			{ id: 'returnValue', label: 'Return value…', needsValue: true }
		];
		const session = new FakeSession({ pharoRestarts: { restarts }, pharoRestart: {} });
		assert.strictEqual(await pickRestart(session, new FakeUi(['Return value…'], '42')), true);
		assert.deepStrictEqual(session.calls[1], { command: 'pharoRestart', args: { id: 'returnValue', expression: '42' } });
	});

	test('the Create restart creates the missing method', async () => {
		const restarts = [{ id: 'create', label: 'Create', needsValue: false }];
		const session = new FakeSession({ pharoRestarts: { restarts }, pharoMissingMethod: missing, pharoCreateMissingMethod: { uri: methodUri } });
		const ui = new FakeUi(['Create', 'Shop', 'accessing']);
		assert.strictEqual(await pickRestart(session, ui), true);
		assert.strictEqual(ui.opened.length, 1);
	});

	test('saving a method of the stack restarts its frame', async () => {
		const session = new FakeSession({
			threads: { threads: [{ id: 1 }] },
			stackTrace: { stackFrames: [{ id: 7, source: { path: 'pharo:/image/Pkg/Other/instance/bar.st' } }, { id: 9, source: { path: methodUri } }] },
			restartFrame: {}
		});
		assert.strictEqual(await restartFrameOfSavedMethod(session, vscode.Uri.parse(methodUri)), true);
		assert.deepStrictEqual(session.calls[session.calls.length - 1], { command: 'restartFrame', args: { frameId: 9 } });
	});

	test('saving a method that is not on the stack restarts nothing', async () => {
		const session = new FakeSession({ threads: { threads: [{ id: 1 }] }, stackTrace: { stackFrames: [] } });
		assert.strictEqual(await restartFrameOfSavedMethod(session, vscode.Uri.parse(methodUri)), false);
		assert.ok(!session.calls.some((call) => call.command === 'restartFrame'));
	});
});

suite('Debug sessions of the stopped processes', () => {
	function serverWith(): { server: DebugStoppedServer; requests: { method: string; params: any }[]; notify(params: unknown): Promise<void> } {
		let handler: ((params: any) => any) | undefined;
		const requests: { method: string; params: any }[] = [];
		return {
			requests,
			server: {
				onNotification: (_method, h) => { handler = h; return new vscode.Disposable(() => undefined); },
				sendRequest: async (method, params) => { requests.push({ method, params }); return true; }
			},
			notify: async (params) => handler?.(params)
		};
	}

	async function run(params: unknown, answer: string | undefined, mode: 'notify' | 'debug' = 'notify') {
		const { server, requests, notify } = serverWith();
		const started: vscode.DebugConfiguration[] = [];
		const offered: { message: string; actions: string[] }[] = [];
		let created = 0;
		attachOnStop(
			server,
			async (configuration) => started.push(configuration),
			{ mode: () => mode, choose: async (message, actions) => { offered.push({ message, actions }); return answer; } },
			async () => { created++; }
		);
		await notify(params);
		return { started, offered, requests, created: () => created };
	}

	const zeroDivide = { id: 3, name: 'ZeroDivide', exception: 'ZeroDivide', frames: ['Foo>>bar'] };
	const attach = { type: 'pharodb', request: 'attach', name: 'ZeroDivide', debugSessionId: 3 };

	test('notifies first, with Debug and Dismiss on an ordinary error', async () => {
		const result = await run(zeroDivide, undefined);
		assert.deepStrictEqual(result.offered, [{ message: 'ZeroDivide in Foo>>bar', actions: ['Debug', 'Dismiss'] }]);
		assert.strictEqual(result.started.length, 0);
	});

	test('Debug attaches a Pharo debug session to the stopped process', async () => {
		const result = await run(zeroDivide, 'Debug');
		assert.deepStrictEqual(result.started, [attach]);
	});

	test('offers Create method on a missing method and creates it in the debug session', async () => {
		const result = await run({ ...zeroDivide, doesNotUnderstand: true }, 'Create method');
		assert.deepStrictEqual(result.offered[0].actions, ['Debug', 'Create method', 'Dismiss']);
		assert.deepStrictEqual(result.started, [attach]);
		assert.strictEqual(result.created(), 1);
	});

	test('Dismiss ends the stopped process in the image', async () => {
		const result = await run(zeroDivide, 'Dismiss');
		assert.deepStrictEqual(result.requests, [{ method: 'pls-debug:dismiss', params: { aDebugSessionId: 3 } }]);
		assert.strictEqual(result.started.length, 0);
	});

	test('opens the debugger at once when the setting says so', async () => {
		const result = await run(zeroDivide, undefined, 'debug');
		assert.deepStrictEqual(result.started, [attach]);
		assert.strictEqual(result.offered.length, 0);
	});

	test('ignores a notification without a session id', async () => {
		const result = await run({ name: 'ZeroDivide' }, 'Debug');
		assert.strictEqual(result.started.length, 0);
		assert.strictEqual(result.offered.length, 0);
	});
});
