import * as assert from 'assert';
import * as vscode from 'vscode';
import { EnvChange, EnvDidChangeParams } from '../../env/envContracts';
import {
	EnvChangeBus,
	EnvChangeSummary,
	classNameOfEnvId,
	packageNameOfEnvId,
	summarizeEnvChanges
} from '../../env/environmentChanges';
import { PharoDataProvider } from '../../treeProvider/imageExplorer';
import { discoverAllTests, discoverTestOf, refreshTestsAfterChanges } from '../../testController/testController';

function notification(...changes: EnvChange[]): EnvDidChangeParams {
	return { changes, reset: false };
}

function methodChanged(className: string, selector: string): EnvChange {
	return { kind: 'changed', id: `method:${className}>>${selector}`, version: 'v2' };
}

function summary(...changes: EnvChange[]): EnvChangeSummary {
	return summarizeEnvChanges([notification(...changes)]);
}

function openDocument(uri: string, isDirty = false): vscode.TextDocument {
	return { uri: vscode.Uri.parse(uri), isDirty } as vscode.TextDocument;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

suite('Pharo environment changes', () => {
	test('names the class and the package of an id', () => {
		assert.strictEqual(classNameOfEnvId('class:Array'), 'Array');
		assert.strictEqual(classNameOfEnvId('side:Array class'), 'Array');
		assert.strictEqual(classNameOfEnvId('protocol:Array class>>instance creation'), 'Array');
		assert.strictEqual(classNameOfEnvId('method:Behavior>>>>'), 'Behavior');
		assert.strictEqual(classNameOfEnvId('package:Kernel'), undefined);
		assert.strictEqual(packageNameOfEnvId('package:Kernel'), 'Kernel');
		assert.strictEqual(packageNameOfEnvId('tag:Kernel/Numbers'), 'Kernel');
		assert.strictEqual(packageNameOfEnvId('extensions:Kernel'), 'Kernel');
		assert.strictEqual(packageNameOfEnvId('class:Array'), undefined);
	});

	test('summarizes changes by class and package', () => {
		const result = summary(
			{ kind: 'added', id: 'class:Basket', parent: 'tag:Shop/Model', version: 'v1' },
			methodChanged('Basket class', 'new'),
			{ kind: 'renamed', id: 'class:Cart', oldId: 'class:Trolley' },
			{ kind: 'removed', id: 'class:Old', parent: 'package:Legacy' },
			{ kind: 'moved', id: 'method:Cart>>total', parent: 'protocol:Cart>>accessing', oldParent: 'protocol:Cart>>math' }
		);

		assert.strictEqual(result.reset, false);
		assert.strictEqual(result.packagesChanged, false);
		assert.deepStrictEqual([...result.packages].sort(), ['Legacy', 'Shop']);
		assert.deepStrictEqual([...result.classes].sort(), ['Basket', 'Cart']);
		assert.deepStrictEqual([...result.removedClasses].sort(), ['Old', 'Trolley']);
		assert.strictEqual(result.changes.length, 5);
	});

	test('keeps a class removed then added again in the same burst', () => {
		const result = summary(
			{ kind: 'removed', id: 'class:Basket', parent: 'package:Shop' },
			{ kind: 'added', id: 'class:Basket', parent: 'package:Shop', version: 'v1' }
		);
		assert.deepStrictEqual([...result.removedClasses], []);
		assert.deepStrictEqual([...result.classes], ['Basket']);
	});

	test('marks package changes and resets', () => {
		assert.strictEqual(summary({ kind: 'added', id: 'package:Shop', parent: 'project:*' }).packagesChanged, true);
		assert.strictEqual(summarizeEnvChanges([{ changes: [], reset: true }]).reset, true);
	});

	test('fires one summary for a burst of notifications', async () => {
		const source = new vscode.EventEmitter<EnvDidChangeParams>();
		const bus = new EnvChangeBus(source.event, 20, 1000);
		const summaries: EnvChangeSummary[] = [];
		bus.onDidChange((value) => summaries.push(value));

		for (let index = 0; index < 200; index++) {
			source.fire(notification(methodChanged(`Class${index % 10}`, `m${index}`)));
		}
		source.fire(notification());
		await wait(60);

		assert.strictEqual(summaries.length, 1);
		assert.strictEqual(summaries[0].changes.length, 200);
		assert.strictEqual(summaries[0].classes.size, 10);
		bus.dispose();
		source.dispose();
	});

	test('fires a continuous stream of notifications at most every max delay', async () => {
		const source = new vscode.EventEmitter<EnvDidChangeParams>();
		const bus = new EnvChangeBus(source.event, 30, 60);
		const summaries: EnvChangeSummary[] = [];
		bus.onDidChange((value) => summaries.push(value));

		const started = Date.now();
		while (Date.now() - started < 150) {
			source.fire(notification(methodChanged('Basket', 'total')));
			await wait(10);
		}
		await wait(80);

		assert.ok(summaries.length >= 2 && summaries.length <= 4, `${summaries.length} summaries`);
		bus.dispose();
		source.dispose();
	});

	test('fires nothing after being disposed', async () => {
		const source = new vscode.EventEmitter<EnvDidChangeParams>();
		const bus = new EnvChangeBus(source.event, 10, 20);
		let fired = 0;
		bus.onDidChange(() => fired++);
		source.fire(notification(methodChanged('Basket', 'total')));
		bus.dispose();
		source.fire(notification(methodChanged('Basket', 'total')));
		await wait(40);
		assert.strictEqual(fired, 0);
		source.dispose();
	});
});

suite('Pharo image file system after changes', () => {
	let provider: PharoDataProvider;
	let requests: string[];
	let treeChanges: number;
	let fileChanges: vscode.FileChangeEvent[][];

	setup(() => {
		requests = [];
		treeChanges = 0;
		fileChanges = [];
		provider = new PharoDataProvider(async (method) => {
			requests.push(method);
			return method === 'pls:packages' ? ['Shop'] : ['Basket', 'Cart'];
		}, () => true);
		provider.onDidChangeTreeData(() => treeChanges++);
		provider.onDidChangeFile((changes) => fileChanges.push(changes));
	});

	teardown(() => provider.dispose());

	test('reloads the open class editors that a method change touched, and nothing else', async () => {
		await provider.readDirectory(vscode.Uri.parse('pharoImage:/Shop'));
		const conflicts = provider.applyEnvironmentChanges(summary(methodChanged('Basket', 'total')), [
			openDocument('pharoImage:/Shop/Basket.class.st'),
			openDocument('pharoImage:/Shop/Cart.class.st'),
			openDocument('file:///work/Basket.class.st')
		]);
		await provider.readDirectory(vscode.Uri.parse('pharoImage:/Shop'));

		assert.deepStrictEqual(conflicts, []);
		assert.strictEqual(treeChanges, 0);
		assert.deepStrictEqual(fileChanges, [[{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse('pharoImage:/Shop/Basket.class.st') }]]);
		assert.strictEqual(requests.filter((method) => method === 'pls:classes').length, 1);
	});

	test('reloads the classes of a package whose classes changed', async () => {
		await provider.readDirectory(vscode.Uri.parse('pharoImage:/Shop'));
		provider.applyEnvironmentChanges(summary({ kind: 'added', id: 'class:Order', parent: 'package:Shop', version: 'v1' }), []);
		await provider.readDirectory(vscode.Uri.parse('pharoImage:/Shop'));

		assert.strictEqual(treeChanges, 1);
		assert.strictEqual(requests.filter((method) => method === 'pls:classes').length, 2);
		assert.strictEqual(requests.filter((method) => method === 'pls:packages').length, 1);
	});

	test('reports removed classes as deleted and edited classes as conflicts', () => {
		const edited = openDocument('pharoImage:/Shop/Cart.class.st', true);
		const conflicts = provider.applyEnvironmentChanges(summary(
			{ kind: 'removed', id: 'class:Basket', parent: 'package:Shop' },
			methodChanged('Cart', 'total')
		), [openDocument('pharoImage:/Shop/Basket.class.st'), edited]);

		assert.deepStrictEqual(conflicts, [edited]);
		assert.deepStrictEqual(fileChanges[fileChanges.length - 1], [
			{ type: vscode.FileChangeType.Deleted, uri: vscode.Uri.parse('pharoImage:/Shop/Basket.class.st') },
			{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse('pharoImage:/Shop/Cart.class.st') }
		]);
	});

	test('reloads everything on a reset', () => {
		provider.applyEnvironmentChanges(summarizeEnvChanges([{ changes: [], reset: true }]), [
			openDocument('pharoImage:/Shop/Basket.class.st')
		]);
		assert.strictEqual(treeChanges, 1);
		assert.ok(fileChanges.flat().some((change) => change.uri.toString() === 'pharoImage:/'));
		assert.ok(fileChanges.flat().some((change) => change.uri.toString() === 'pharoImage:/Shop/Basket.class.st'));
	});

	test('a burst of notifications refreshes the views once, and refreshing sends no change back', async () => {
		const source = new vscode.EventEmitter<EnvDidChangeParams>();
		const bus = new EnvChangeBus(source.event, 10, 100);
		let refreshes = 0;
		bus.onDidChange((value) => {
			refreshes++;
			provider.applyEnvironmentChanges(value, [openDocument('pharoImage:/Shop/Basket.class.st')]);
		});

		for (let index = 0; index < 50; index++) {
			source.fire(notification(
				{ kind: 'added', id: `class:C${index}`, parent: 'package:Shop', version: 'v1' },
				methodChanged('Basket', `m${index}`)
			));
		}
		await wait(50);

		assert.strictEqual(refreshes, 1);
		assert.strictEqual(treeChanges, 1);
		assert.strictEqual(fileChanges.length, 2);
		bus.dispose();
		source.dispose();
	});
});

suite('Pharo Test Explorer after changes', () => {
	let controller: vscode.TestController;
	let requests: Array<{ method: string; params: any }>;
	let classes: string[];

	const testClient = {
		isRunning: () => true,
		sendRequest: async (method: string, params?: any): Promise<unknown> => {
			requests.push({ method, params });
			switch (method) {
				case 'pls:test-packages':
					return ['pharoImage:/Shop-Tests'];
				case 'pls:test-in-package':
					return classes.map((name) => `pharoImage:/Shop-Tests/${name}.class.st`);
				case 'pls:test-in-class':
					return [`${params.aClassURI.external}#testTotal`];
				default:
					throw new Error(`Unexpected request: ${method}`);
			}
		}
	};

	async function resolveAll(): Promise<void> {
		await controller.resolveHandler!(undefined);
		const packageItem = controller.items.get('pharoImage:/Shop-Tests')!;
		await controller.resolveHandler!(packageItem);
		for (const [, classItem] of packageItem.children) {
			await controller.resolveHandler!(classItem);
		}
	}

	setup(() => {
		requests = [];
		classes = ['BasketTest', 'CartTest'];
		controller = vscode.tests.createTestController('pharo-test-changes', 'Pharo Test Changes');
		controller.resolveHandler = (item) => item
			? discoverTestOf(testClient, item, controller)
			: discoverAllTests(testClient, controller);
	});

	teardown(() => controller.dispose());

	test('resolves again only the test class that changed', async () => {
		await resolveAll();
		requests = [];

		await refreshTestsAfterChanges(testClient, controller, summary(methodChanged('CartTest', 'testTotal')));

		assert.deepStrictEqual(requests.map((request) => request.method), ['pls:test-in-class']);
		assert.strictEqual(requests[0].params.aClassURI.path, '/Shop-Tests/CartTest.class.st');
	});

	test('resolves again the package of an added test class', async () => {
		await resolveAll();
		requests = [];
		classes = ['BasketTest', 'CartTest', 'OrderTest'];

		await refreshTestsAfterChanges(testClient, controller, summary(
			{ kind: 'added', id: 'class:OrderTest', parent: 'package:Shop-Tests', version: 'v1' }
		));

		assert.deepStrictEqual(requests.map((request) => request.method), ['pls:test-in-package']);
		assert.strictEqual(controller.items.get('pharoImage:/Shop-Tests')!.children.size, 3);
	});

	test('ignores changes of classes it does not show', async () => {
		await resolveAll();
		requests = [];

		await refreshTestsAfterChanges(testClient, controller, summary(methodChanged('Basket', 'total')));

		assert.deepStrictEqual(requests, []);
	});
});
