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
	function serverWith(): { server: DebugStoppedServer; notify(params: unknown): void } {
		let handler: ((params: any) => void) | undefined;
		return {
			server: { onNotification: (_method, h) => { handler = h; return new vscode.Disposable(() => undefined); } },
			notify: (params) => handler?.(params)
		};
	}

	test('attaches a Pharo debug session to a process that stopped on an exception', () => {
		const { server, notify } = serverWith();
		const started: vscode.DebugConfiguration[] = [];
		attachOnStop(server, async (configuration) => started.push(configuration));
		notify({ id: 3, name: 'ZeroDivide', exception: 'ZeroDivide' });
		assert.deepStrictEqual(started, [{ type: 'pharodb', request: 'attach', name: 'ZeroDivide', debugSessionId: 3 }]);
	});

	test('ignores a notification without a session id', () => {
		const { server, notify } = serverWith();
		const started: vscode.DebugConfiguration[] = [];
		attachOnStop(server, async (configuration) => started.push(configuration));
		notify({ name: 'ZeroDivide' });
		assert.strictEqual(started.length, 0);
	});
});
