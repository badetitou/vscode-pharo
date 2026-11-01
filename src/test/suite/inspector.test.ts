import * as assert from 'assert';
import { InspectorItem, expectInspectedObject, expectInspectorView, inspectorCapabilitiesFrom } from '../../inspector/inspectorContracts';
import { InspectorSession } from '../../inspector/inspectorSession';
import { InspectorNode, InspectorTreeProvider, breadcrumbOf } from '../../inspector/inspectorView';

interface FakeObject {
	className: string;
	printString: string;
	slots: Array<[string, string]>;
	views?: Record<string, unknown>;
	error?: string;
}

// An image holding Smalltalk, whose globals hold 150 entries, each a string.
const objects: Record<string, FakeObject> = {
	Smalltalk: { className: 'SmalltalkImage', printString: 'Smalltalk', slots: [['globals', 'globals'], ['vm', 'vm']] },
	globals: {
		className: 'SystemEnvironment',
		printString: 'a SystemEnvironment',
		slots: Array.from({ length: 150 }, (_, index): [string, string] => [`key${index}`, 'entry']),
		views: { 'inspectionItems:': { kind: 'table', columns: ['Key', 'Value'] } }
	},
	vm: { className: 'VirtualMachine', printString: 'a VirtualMachine', slots: [] },
	entry: { className: 'ByteString', printString: "'entry'", slots: [], views: { 'inspectionFullString:': { kind: 'text', text: 'line 1\nline 2' } } },
	error: { className: 'ZeroDivide', printString: 'ZeroDivide', slots: [], error: 'Division by zero' }
};

/** A fake image answering the pls-inspector:* requests, which records the references it holds. */
class FakeImage {
	readonly held = new Map<string, string>();
	readonly requests: Array<{ method: string; params: any }> = [];
	private next = 0;

	readonly request = async (method: string, params: any): Promise<unknown> => {
		this.requests.push({ method, params });
		switch (method) {
			case 'pls-inspector:evaluate':
				return this.describe(this.register(params.expression));
			case 'pls-inspector:inspect':
				return this.describe(params.ref);
			case 'pls-inspector:view':
				return this.view(this.objectOf(params.ref), params.view, params.offset, params.limit);
			case 'pls-inspector:children': {
				const page = this.page(this.objectOf(params.ref).slots, params.offset, params.limit);
				return page;
			}
			case 'pls-inspector:release':
				for (const ref of params.refs) {
					this.held.delete(ref);
				}
				return null;
			default:
				throw new Error(`Unexpected request ${method}`);
		}
	};

	private register(name: string): string {
		const ref = String(++this.next);
		this.held.set(ref, name);
		return ref;
	}

	private objectOf(ref: string): FakeObject {
		const name = this.held.get(ref);
		if (name === undefined) {
			throw new Error(`Unknown inspector reference: ${ref}`);
		}
		return objects[name];
	}

	private describe(ref: string): unknown {
		const object = this.objectOf(ref);
		const views = [...Object.keys(object.views ?? {}).map((id) => ({ id, title: id })), { id: 'raw', title: 'Raw' }, { id: 'meta', title: 'Meta' }];
		return { ref, className: object.className, printString: object.printString, hasChildren: object.slots.length > 0, views, error: object.error ?? null };
	}

	private page(slots: Array<[string, string]>, offset = 0, limit = slots.length, cells = false) {
		return {
			items: slots.slice(offset, offset + limit).map(([name, value]) => ({
				name,
				ref: this.register(value),
				className: objects[value].className,
				printString: objects[value].printString,
				hasChildren: objects[value].slots.length > 0,
				...(cells ? { cells: [name, objects[value].printString] } : {})
			})),
			total: slots.length
		};
	}

	private view(object: FakeObject, view: string, offset: number, limit: number): unknown {
		if (view === 'raw') {
			return { kind: 'tree', ...this.page(object.slots, offset, limit) };
		}
		const extension = object.views?.[view] as any;
		return extension.kind === 'table' ? { ...extension, ...this.page(object.slots, offset, limit, true) } : extension;
	}
}

async function open(image: FakeImage, session: InspectorSession, expression: string) {
	return session.open(await session.evaluate(expression, {}), expression, true);
}

function itemsOf(nodes: InspectorNode[]): InspectorItem[] {
	return nodes.flatMap((node) => node.kind === 'item' ? [node.item] : []);
}

suite('Pharo inspector contracts', () => {
	test('reads the capabilities of the inspector', () => {
		assert.deepStrictEqual(inspectorCapabilitiesFrom({ 'pls-inspector': { version: 1 } }), { version: 1 });
		assert.strictEqual(inspectorCapabilitiesFrom({ 'pls-env': { version: 1 } }), undefined);
		assert.strictEqual(inspectorCapabilitiesFrom(undefined), undefined);
	});

	test('validates the description of an object', () => {
		const object = expectInspectedObject({ ref: '1', className: 'ZeroDivide', printString: 'ZeroDivide', hasChildren: true, views: [{ id: 'raw', title: 'Raw' }], error: '' }, 'pls-inspector:evaluate');
		assert.strictEqual(object.error, '');
		assert.throws(() => expectInspectedObject({ ref: 1 }, 'pls-inspector:evaluate'), /pls-inspector:evaluate/);
	});

	test('validates the views', () => {
		assert.deepStrictEqual(
			expectInspectorView({ kind: 'table', columns: ['Index', 'Value'], items: [{ name: '1', ref: '2', className: 'SmallInteger', printString: '10', hasChildren: false, cells: ['1', '10'] }], total: 1 }, 'pls-inspector:view'),
			{ kind: 'table', columns: ['Index', 'Value'], items: [{ name: '1', ref: '2', className: 'SmallInteger', printString: '10', hasChildren: false, cells: ['1', '10'] }], total: 1 }
		);
		assert.deepStrictEqual(expectInspectorView({ kind: 'text', text: 'hello' }, 'pls-inspector:view'), { kind: 'text', text: 'hello' });
		assert.throws(() => expectInspectorView({ kind: 'morph' }, 'pls-inspector:view'), /unknown view kind/);
	});
});

suite('Pharo inspector session', () => {
	test('navigates several levels and goes back, releasing the references of the closed pages', async () => {
		const image = new FakeImage();
		const session = new InspectorSession(image.request);
		const smalltalk = await open(image, session, 'Smalltalk');
		assert.strictEqual(smalltalk.view?.kind, 'tree');

		const globalsItem = (smalltalk.view as any).items[0] as InspectorItem;
		const globals = await session.dive(globalsItem);
		assert.strictEqual(globals.object.className, 'SystemEnvironment');
		assert.strictEqual(globals.viewId, 'inspectionItems:', 'the first view of an object is the first view of its class');
		const entry = await session.dive((globals.view as any).items[0]);
		assert.deepStrictEqual(session.pages.map((page) => page.label), ['Smalltalk', 'globals', 'key0']);

		const heldBefore = image.held.size;
		await session.back();
		assert.strictEqual(session.current, globals);
		assert.ok(image.held.size <= heldBefore);
		await session.backTo(0);
		assert.strictEqual(session.current, smalltalk);
		assert.ok(![...globals.refs].some((ref) => image.held.has(ref)), 'the references of the closed pages are released');
		assert.ok(image.held.has(smalltalk.object.ref), 'the object of the open page stays held');
		assert.ok(image.held.has(globalsItem.ref), 'the items of the open page stay held');
		assert.ok(entry.object.ref);
	});

	test('pages the items of a view and the children of an item', async () => {
		const image = new FakeImage();
		const session = new InspectorSession(image.request);
		const smalltalk = await open(image, session, 'Smalltalk');
		const globalsItem = (smalltalk.view as any).items[0] as InspectorItem;

		const first = await session.childrenOf(globalsItem);
		assert.deepStrictEqual([first.items.length, first.total], [100, 150]);
		assert.strictEqual(await session.childrenOf(globalsItem), first, 'the children are asked once');
		const all = await session.childrenOf(globalsItem, true);
		assert.strictEqual(all.items.length, 150);

		await session.dive(globalsItem);
		await session.loadMoreItems();
		assert.strictEqual((session.current!.view as any).items.length, 150);
	});

	test('releases the references of a view when showing another one', async () => {
		const image = new FakeImage();
		const session = new InspectorSession(image.request);
		const page = await open(image, session, 'globals');
		const tableRefs = [...page.refs];
		await session.selectView('raw');
		assert.strictEqual(page.view?.kind, 'tree');
		assert.ok(!tableRefs.some((ref) => image.held.has(ref)));
		assert.ok(image.held.has(page.object.ref));
	});

	test('evaluates in the context of the inspected object', async () => {
		const image = new FakeImage();
		const session = new InspectorSession(image.request);
		const page = await open(image, session, 'Smalltalk');
		await session.push(await session.evaluate('vm', { receiver: page.object.ref }), 'vm', true);
		assert.deepStrictEqual(image.requests.filter((each) => each.method === 'pls-inspector:evaluate').pop()?.params,
			{ expression: 'vm', textDocumentURI: undefined, receiver: page.object.ref });
		const result = session.current!;
		await session.back();
		assert.ok(!image.held.has(result.object.ref), 'the result of an evaluation is released with its page');
	});

	test('opening the object of the current page again keeps its reference', async () => {
		const image = new FakeImage();
		const session = new InspectorSession(image.request);
		const page = await open(image, session, 'Smalltalk');
		const reopened = await session.open(await session.describe(page.object.ref), 'Smalltalk', false);
		assert.ok(image.held.has(page.object.ref));
		assert.ok(reopened.ownsObject);
		assert.strictEqual(session.pages.length, 1);
	});
});

suite('Pharo inspector view', () => {
	test('shows the rows of a table, then a node to show more', async () => {
		const image = new FakeImage();
		const session = new InspectorSession(image.request);
		await open(image, session, 'globals');
		const nodes = await new InspectorTreeProvider(session).getChildren();
		assert.strictEqual(itemsOf(nodes).length, 100);
		assert.deepStrictEqual(nodes[nodes.length - 1], { kind: 'more', parent: undefined, remaining: 50 });
		const treeItem = new InspectorTreeProvider(session).getTreeItem(nodes[0]);
		assert.strictEqual(treeItem.label, 'key0');
		assert.strictEqual(treeItem.description, "'entry'");
	});

	test('shows a text view line by line', async () => {
		const image = new FakeImage();
		const session = new InspectorSession(image.request);
		await open(image, session, 'entry');
		assert.deepStrictEqual(await new InspectorTreeProvider(session).getChildren(), [
			{ kind: 'line', text: 'line 1', index: 0 },
			{ kind: 'line', text: 'line 2', index: 1 }
		]);
	});

	test('shows the error an evaluation signaled', async () => {
		const image = new FakeImage();
		const session = new InspectorSession(image.request);
		await open(image, session, 'error');
		const [first] = await new InspectorTreeProvider(session).getChildren();
		assert.deepStrictEqual(first, { kind: 'message', text: 'Division by zero', icon: 'error' });
	});

	test('shortens the labels of the breadcrumb', () => {
		assert.strictEqual(breadcrumbOf(['Smalltalk', 'globals']), 'Smalltalk › globals');
		assert.strictEqual(breadcrumbOf(['Smalltalk globals\n\tat: #Object']), 'Smalltalk globals at: #Object');
		assert.strictEqual(breadcrumbOf(['x'.repeat(40)]), `${'x'.repeat(29)}…`);
	});
});
