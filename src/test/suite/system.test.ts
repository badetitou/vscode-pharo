import * as assert from 'assert';
import * as vscode from 'vscode';
import { expectChestContents, expectProcesses, expectProfile, systemCapabilitiesFrom, PharoProcess, ProfileNode } from '../../system/systemContracts';
import {
	DEBUG_PROCESS_REQUEST,
	PROCESSES_REQUEST,
	ProcessesProvider,
	ProcessesUi,
	STACK_REQUEST,
	TERMINATE_REQUEST,
	debugProcess,
	describe,
	terminateProcess
} from '../../system/processesView';
import { CHEST_LIST_REQUEST, CHEST_STORE_REQUEST, ChestProvider, ChestUi, storeInChest } from '../../system/chestView';
import { codeToProfile, hotMethods, profileHtml } from '../../system/profiler';

class FakeServer {
	readonly requests: { method: string; params?: any }[] = [];
	constructor(private readonly answers: Record<string, any> = {}) {}

	async sendRequest(method: string, params?: any): Promise<unknown> {
		this.requests.push({ method, params });
		const answer = this.answers[method];
		if (answer instanceof Error) {
			throw answer;
		}
		return typeof answer === 'function' ? answer(params) : answer;
	}

	readonly request = (method: string, params?: unknown) => this.sendRequest(method, params);

	of(method: string): any[] {
		return this.requests.filter((request) => request.method === method).map((request) => request.params);
	}
}

class FakeUi implements ProcessesUi, ChestUi {
	readonly confirmations: { message: string; detail: string }[] = [];
	readonly errors: string[] = [];
	readonly infos: string[] = [];
	constructor(private readonly answers: { confirm?: boolean; key?: string; chest?: string } = {}) {}

	async confirm(message: string, detail: string): Promise<boolean> {
		this.confirmations.push({ message, detail });
		return this.answers.confirm ?? true;
	}
	async askKey(): Promise<string | undefined> {
		return this.answers.key;
	}
	async pickChest(): Promise<string | undefined> {
		return this.answers.chest;
	}
	info(message: string): void {
		this.infos.push(message);
	}
	error(message: string): void {
		this.errors.push(message);
	}
}

const sleeper = {
	id: 42,
	name: 'sleeper',
	priority: 40,
	state: 'waiting',
	method: '[] in Shop>>wait',
	uri: 'pharo:/image/Pkg/Shop/instance/wait.st',
	ui: false,
	current: false
};

function processWith(fields: Partial<PharoProcess>): PharoProcess {
	return { ...(sleeper as PharoProcess), ...fields };
}

function node(label: string, samples: number, selfSamples: number, children: ProfileNode[] = [], uri?: string): ProfileNode {
	return { label, samples, selfSamples, children, uri };
}

suite('System tools of the image', () => {
	test('reads the capabilities of the server, and nothing from an older server', () => {
		assert.deepStrictEqual(systemCapabilitiesFrom({ 'pls-system': { version: 1, processes: true, profile: true, chest: true } }), {
			version: 1,
			processes: true,
			profile: true,
			chest: true
		});
		assert.strictEqual(systemCapabilitiesFrom({ 'pls-inspector': { version: 1 } }), undefined);
		assert.strictEqual(systemCapabilitiesFrom(undefined), undefined);
	});

	test('validates the processes, with the null method of a process without stack', () => {
		const [process] = expectProcesses({ items: [{ ...sleeper, method: null, uri: null }] }, PROCESSES_REQUEST);
		assert.strictEqual(process.method, undefined);
		assert.strictEqual(process.state, 'waiting');
		assert.throws(() => expectProcesses({ items: [{ ...sleeper, state: 'sleeping' }] }, PROCESSES_REQUEST), /unknown state/);
		assert.throws(() => expectProcesses({}, PROCESSES_REQUEST), /expected items/);
	});

	test('lists the processes, then the stack of a process with links to its methods', async () => {
		const server = new FakeServer({
			[PROCESSES_REQUEST]: { items: [sleeper] },
			[STACK_REQUEST]: { items: [{ label: '[] in Shop>>wait', uri: sleeper.uri }, { label: 'UndefinedObject>>DoIt', uri: null }] }
		});
		const provider = new ProcessesProvider(() => server.request);
		const [processNode] = await provider.getChildren();
		const processItem = provider.getTreeItem(processNode);
		assert.strictEqual(processItem.label, 'sleeper');
		assert.strictEqual(processItem.description, '40 · waiting · [] in Shop>>wait');
		assert.strictEqual(processItem.contextValue, 'pharoProcess');

		const frames = await provider.getChildren(processNode);
		assert.deepStrictEqual(server.of(STACK_REQUEST), [{ id: 42, limit: 50 }]);
		const linked = provider.getTreeItem(frames[0]);
		assert.strictEqual(linked.command?.command, 'vscode.open');
		assert.strictEqual(String(linked.command?.arguments?.[0]), sleeper.uri);
		assert.strictEqual(provider.getTreeItem(frames[1]).command, undefined);
	});

	test('shows the error of the server in the view', async () => {
		const provider = new ProcessesProvider(() => new FakeServer({ [PROCESSES_REQUEST]: new Error('broken') }).request);
		const [message] = await provider.getChildren();
		assert.strictEqual(provider.getTreeItem(message).label, 'broken');
	});

	test('shows nothing while the server does not provide the processes', async () => {
		assert.deepStrictEqual(await new ProcessesProvider(() => undefined).getChildren(), []);
	});

	test('describes a process without method', () => {
		assert.strictEqual(describe(processWith({ method: undefined, state: 'suspended' })), '40 · suspended');
	});

	test('terminates a process once confirmed', async () => {
		const server = new FakeServer({ [TERMINATE_REQUEST]: null });
		const ui = new FakeUi();
		assert.strictEqual(await terminateProcess(processWith({}), server.request, ui), true);
		assert.deepStrictEqual(server.of(TERMINATE_REQUEST), [{ id: 42 }]);
	});

	test('does not terminate a process when the user cancels', async () => {
		const server = new FakeServer();
		assert.strictEqual(await terminateProcess(processWith({}), server.request, new FakeUi({ confirm: false })), false);
		assert.deepStrictEqual(server.of(TERMINATE_REQUEST), []);
	});

	test('warns before terminating a process of the system or of the user interface', async () => {
		const ui = new FakeUi({ confirm: false });
		await terminateProcess(processWith({ priority: 60 }), new FakeServer().request, ui);
		await terminateProcess(processWith({ ui: true }), new FakeServer().request, ui);
		assert.match(ui.confirmations[0].detail, /process of the system/);
		assert.match(ui.confirmations[1].detail, /user interface/);
	});

	test('never terminates nor debugs the process that answers VS Code', async () => {
		const server = new FakeServer();
		const ui = new FakeUi();
		assert.strictEqual(await terminateProcess(processWith({ current: true }), server.request, ui), false);
		assert.strictEqual(await debugProcess(processWith({ current: true }), server.request, ui), undefined);
		assert.deepStrictEqual(server.requests, []);
		assert.strictEqual(ui.errors.length, 2);
	});

	test('gives a process to the debugger and answers its debug session', async () => {
		const server = new FakeServer({ [DEBUG_PROCESS_REQUEST]: { debugSessionId: 7 } });
		assert.strictEqual(await debugProcess(processWith({}), server.request, new FakeUi()), 7);
		assert.deepStrictEqual(server.of(DEBUG_PROCESS_REQUEST), [{ id: 42 }]);
	});

	test('reports a process that cannot be debugged', async () => {
		const ui = new FakeUi();
		const server = new FakeServer({ [DEBUG_PROCESS_REQUEST]: new Error('Unknown process: 42') });
		assert.strictEqual(await debugProcess(processWith({}), server.request, ui), undefined);
		assert.match(ui.errors[0], /Unknown process/);
	});

	test('lists the chests and their objects, and tells whether Chest is loaded', async () => {
		const availability: boolean[] = [];
		const server = new FakeServer({
			[CHEST_LIST_REQUEST]: {
				available: true,
				chests: [{ name: 'Default', items: [{ key: 'cart', className: 'Cart', printString: 'a Cart', code: "(Chest named: 'Default') at: 'cart'" }] }]
			}
		});
		const provider = new ChestProvider(() => server.request, (available) => availability.push(available));
		const [chest] = await provider.getChildren();
		assert.strictEqual(provider.getTreeItem(chest).description, '1');
		const [item] = await provider.getChildren(chest);
		const treeItem = provider.getTreeItem(item);
		assert.strictEqual(treeItem.label, 'cart');
		assert.strictEqual(treeItem.description, 'a Cart');
		assert.strictEqual(treeItem.command?.command, 'pharo.chest.inspect');
		assert.deepStrictEqual(availability, [true]);
		assert.deepStrictEqual(provider.chests.map((each) => each.name), ['Default']);
	});

	test('tells when Chest is not loaded', async () => {
		const availability: boolean[] = [];
		const provider = new ChestProvider(
			() => new FakeServer({ [CHEST_LIST_REQUEST]: { available: false, chests: [] } }).request,
			(available) => availability.push(available)
		);
		assert.deepStrictEqual(await provider.getChildren(), []);
		assert.deepStrictEqual(availability, [false]);
		assert.throws(() => expectChestContents({ available: true }, CHEST_LIST_REQUEST), /expected the chests/);
	});

	test('stores an object of the inspector under the name the user gives', async () => {
		const server = new FakeServer({ [CHEST_STORE_REQUEST]: { key: 'cart' } });
		const ui = new FakeUi({ key: ' cart ' });
		assert.strictEqual(await storeInChest({ ref: '3', label: 'a Cart' }, ['Default'], server.request, ui), 'cart');
		assert.deepStrictEqual(server.of(CHEST_STORE_REQUEST), [{ ref: '3', chest: 'Default', key: 'cart' }]);
		assert.match(ui.infos[0], /Default/);
	});

	test('lets the chest name an object when the name is empty, and asks for the chest when there are several', async () => {
		const server = new FakeServer({ [CHEST_STORE_REQUEST]: { key: 'chestObject1' } });
		await storeInChest({ ref: '3' }, ['Default', 'Work'], server.request, new FakeUi({ key: '', chest: 'Work' }));
		assert.deepStrictEqual(server.of(CHEST_STORE_REQUEST), [{ ref: '3', chest: 'Work', key: null }]);
	});

	test('stores nothing when the user cancels', async () => {
		const server = new FakeServer();
		assert.strictEqual(await storeInChest({ ref: '3' }, ['Default'], server.request, new FakeUi({ key: undefined })), undefined);
		assert.strictEqual(await storeInChest({ ref: '3' }, ['Default', 'Work'], server.request, new FakeUi({ key: 'x', chest: undefined })), undefined);
		assert.deepStrictEqual(server.requests, []);
	});

	test('reports a name already used in the chest', async () => {
		const ui = new FakeUi({ key: 'cart' });
		const server = new FakeServer({ [CHEST_STORE_REQUEST]: new Error('You cannot put an object named cart as it already exist in this chest') });
		assert.strictEqual(await storeInChest({ ref: '3' }, ['Default'], server.request, ui), undefined);
		assert.match(ui.errors[0], /already exist/);
	});

	test('validates a profile', () => {
		const profile = expectProfile(
			{ milliseconds: 12, samples: 10, error: null, root: { label: '1 + 2', uri: null, samples: 10, selfSamples: 0, children: [] } },
			'pls-system:profile'
		);
		assert.strictEqual(profile.error, undefined);
		assert.strictEqual(profile.root.uri, undefined);
		assert.throws(() => expectProfile({ milliseconds: 1, samples: 1, root: { label: 'x' } }, 'pls-system:profile'), /children/);
	});

	test('ranks the hot methods by their own samples, counting a recursion once', () => {
		const root = node('do it', 10, 0, [
			node('Shop>>total', 8, 2, [node('Shop>>total', 6, 6, [], 'pharo:/total')], 'pharo:/total'),
			node('Shop>>tax', 2, 2)
		]);
		assert.deepStrictEqual(hotMethods(root), [
			{ label: 'Shop>>total', uri: 'pharo:/total', selfSamples: 8, samples: 8 },
			{ label: 'Shop>>tax', uri: undefined, selfSamples: 2, samples: 2 }
		]);
	});

	test('profiles the selection, or else the line of the cursor', async () => {
		const document = await vscode.workspace.openTextDocument({ content: 'x := 3.\n  100 factorial  \n' });
		const atCursor = { document, selection: new vscode.Selection(1, 4, 1, 4) };
		assert.strictEqual(codeToProfile(atCursor), '100 factorial');
		const selected = { document, selection: new vscode.Selection(0, 5, 0, 6) };
		assert.strictEqual(codeToProfile(selected), '3');
	});

	test('keeps a label from closing the script of the profile page', () => {
		const html = profileHtml(
			{ milliseconds: 1, samples: 1, root: node('</script><script>alert(1)</script>', 1, 1) },
			[],
			'abc'
		);
		assert.ok(!html.includes('</script><script>alert(1)'));
		assert.ok(html.includes("script-src 'nonce-abc'"));
	});
});
