import * as assert from 'assert';
import * as vscode from 'vscode';
import { EnvEntity, ENV_UNKNOWN_ENTITY_ERROR_CODE } from '../../env/envContracts';
import { EditorSession, SessionEnvironment, SessionView, sessionKeyOf } from '../../env/editorSession';
import { EditorSessionState, EditorStack, isEditorSessionState, labelOfEntityId } from '../../env/editorStack';

suite('Pharo editor stack', () => {
	let stack: EditorStack;

	setup(() => { stack = new EditorStack(); });
	teardown(() => stack.dispose());

	test('goes back and forward like a browser', () => {
		stack.visit('class:Basket', 'Shop', 1);
		stack.visit('method:Basket>>total', 'Shop', 2);
		stack.visit('method:Item>>price', 'Shop', 3);
		assert.strictEqual(stack.back(), 'method:Basket>>total');
		assert.strictEqual(stack.back(), 'class:Basket');
		assert.strictEqual(stack.back(), undefined);
		assert.strictEqual(stack.canGoBack, false);
		assert.strictEqual(stack.forward(), 'method:Basket>>total');

		// Showing the entity gone back to does not change the history; visiting another one drops those ahead.
		stack.visit('method:Basket>>total', 'Shop', 4);
		assert.strictEqual(stack.canGoForward, true);
		stack.visit('class:Item', 'Shop', 5);
		assert.strictEqual(stack.canGoForward, false);
		assert.strictEqual(stack.back(), 'method:Basket>>total');
		assert.strictEqual(stack.back(), 'class:Basket');
	});

	test('sorts by visit, name or package', () => {
		stack.visit('method:Item>>price', 'Shop-Core', 1);
		stack.visit('class:Basket', 'Shop-UI', 2);
		stack.visit('method:Basket>>total', 'Shop-Core', 3);
		stack.visit('method:Item>>price', 'Shop-Core', 4);
		const ids = () => stack.sorted().map((entry) => entry.id);
		assert.deepStrictEqual(ids(), ['method:Item>>price', 'method:Basket>>total', 'class:Basket']);
		stack.sort = 'name';
		assert.deepStrictEqual(ids(), ['class:Basket', 'method:Basket>>total', 'method:Item>>price']);
		stack.sort = 'package';
		assert.deepStrictEqual(ids(), ['method:Basket>>total', 'method:Item>>price', 'class:Basket']);
	});

	test('forgets removed entities and stays near the current one', () => {
		stack.visit('class:Basket', 'Shop', 1);
		stack.visit('method:Basket>>total', 'Shop', 2);
		stack.visit('class:Basket', 'Shop', 3);
		stack.visit('method:Item>>price', 'Shop', 4);
		stack.back();
		stack.remove(['method:Basket>>total']);
		assert.deepStrictEqual(stack.toState([]).history, ['class:Basket', 'method:Item>>price']);
		assert.strictEqual(stack.current, 'class:Basket');
		assert.strictEqual(stack.has('method:Basket>>total'), false);
	});

	test('follows renames and removals of the image', () => {
		stack.visit('class:Basket', 'Shop', 1);
		stack.visit('method:Basket>>total', 'Shop', 2);
		stack.visit('method:Item>>price', 'Shop', 3);
		stack.visit('method:Item>>name', 'Shop', 4);
		stack.applyChanges([
			{ kind: 'renamed', id: 'class:Cart', oldId: 'class:Basket' },
			{ kind: 'renamed', id: 'method:Item>>cost', oldId: 'method:Item>>price' },
			{ kind: 'removed', id: 'method:Item>>name' }
		]);
		assert.deepStrictEqual(stack.toState([]).history, ['class:Cart', 'method:Cart>>total', 'method:Item>>cost']);
		assert.strictEqual(stack.current, 'method:Item>>cost');

		stack.applyChanges([{ kind: 'removed', id: 'class:Cart' }]);
		assert.deepStrictEqual(stack.sorted().map((entry) => entry.id), ['method:Item>>cost']);
	});

	test('clears all but the open entities', () => {
		stack.visit('class:Basket', 'Shop', 1);
		stack.visit('method:Basket>>total', 'Shop', 2);
		stack.clear(['method:Basket>>total']);
		assert.deepStrictEqual(stack.sorted().map((entry) => entry.id), ['method:Basket>>total']);
		assert.strictEqual(stack.canGoBack, false);
	});

	test('saves and restores its state', () => {
		stack.visit('class:Basket', 'Shop', 1);
		stack.visit('method:Basket>>total', 'Shop', 2);
		stack.back();
		stack.sort = 'package';
		const state = stack.toState([{ id: 'class:Basket', column: 1, active: true }], { projects: 'project:Shop' });
		assert.ok(isEditorSessionState(JSON.parse(JSON.stringify(state))));

		const restored = new EditorStack();
		restored.restore(state);
		assert.strictEqual(restored.current, 'class:Basket');
		assert.strictEqual(restored.canGoForward, true);
		assert.strictEqual(restored.sort, 'package');
		restored.restore({ version: 2 } as unknown as EditorSessionState);
		assert.strictEqual(restored.sorted().length, 0);
		restored.dispose();
	});

	test('names entities', () => {
		assert.strictEqual(labelOfEntityId('method:Array class>>new:'), 'Array class>>new:');
		assert.strictEqual(labelOfEntityId('class:Array'), 'Array');
	});
});

class FakeMemento implements vscode.Memento {
	readonly values = new Map<string, unknown>();
	keys(): readonly string[] { return [...this.values.keys()]; }
	get<T>(key: string, defaultValue?: T): T | undefined { return (this.values.has(key) ? this.values.get(key) : defaultValue) as T | undefined; }
	async update(key: string, value: unknown): Promise<void> { this.values.set(key, value); }
}

class FakeImage implements SessionEnvironment {
	constructor(readonly image: string, private readonly known: Set<string>) {}
	async entity(id: string): Promise<EnvEntity> {
		if (!this.known.has(id)) {
			throw { code: ENV_UNKNOWN_ENTITY_ERROR_CODE, message: `Unknown entity ${id}` };
		}
		return { id, kind: 'class', name: id, parent: null, hasChildren: false, flags: {}, package: 'package:Shop', repository: null };
	}
}

/** A view whose state is its selection. */
class FakeView implements SessionView {
	readonly sessionKey = 'projects';
	readonly emitter = new vscode.EventEmitter<void>();
	readonly onDidChangeSessionState = this.emitter.event;
	readonly restored: unknown[] = [];
	selection: string | undefined;

	sessionState(): unknown {
		return { selection: this.selection };
	}

	async restoreSessionState(state: unknown): Promise<void> {
		this.restored.push(state);
		this.selection = (state as { selection?: string } | undefined)?.selection;
	}

	select(id: string): void {
		this.selection = id;
		this.emitter.fire();
	}
}

suite('Pharo editor session', () => {
	async function sessionOf(memento: FakeMemento, image: string): Promise<{ session: EditorSession; view: FakeView }> {
		const session = new EditorSession(memento);
		const view = new FakeView();
		session.registerView(view);
		await session.start(new FakeImage(image, new Set()));
		return { session, view };
	}

	test('keeps one session per image', async () => {
		const memento = new FakeMemento();
		const first = await sessionOf(memento, '/images/A.image');
		assert.deepStrictEqual(first.view.restored, [undefined]);
		first.session.stack.visit('class:Basket', 'Shop', 1);
		first.view.select('project:Shop');
		first.session.dispose();

		const other = await sessionOf(memento, '/images/B.image');
		assert.strictEqual(other.session.stack.sorted().length, 0);
		assert.strictEqual(other.view.selection, undefined);
		other.session.dispose();

		const again = await sessionOf(memento, '/images/A.image');
		assert.deepStrictEqual(again.session.stack.sorted().map((entry) => entry.id), ['class:Basket']);
		assert.strictEqual(again.view.selection, 'project:Shop');
		assert.ok(memento.keys().includes(sessionKeyOf('/images/A.image')));
		again.session.dispose();
	});

	test('saves the views only once they are restored', async () => {
		const memento = new FakeMemento();
		const first = await sessionOf(memento, '/images/A.image');
		first.view.select('project:Shop');
		first.session.dispose();

		const session = new EditorSession(memento);
		const view = new FakeView();
		session.registerView(view);
		// A view that changes while the session restores its editors does not overwrite the saved state.
		view.select('project:Other');
		await session.start(new FakeImage('/images/A.image', new Set()));
		assert.strictEqual(view.selection, 'project:Shop');
		session.dispose();
	});

	test('skips the entities removed from the image', async () => {
		const memento = new FakeMemento();
		const state: EditorSessionState = {
			version: 1,
			entries: [{ id: 'method:Basket>>total', packageName: 'Shop', visited: 1 }],
			history: ['method:Basket>>total'],
			historyIndex: 0,
			sort: 'recent',
			openEditors: [{ id: 'method:Basket>>total', column: 1, active: true }],
			views: {}
		};
		await memento.update(sessionKeyOf('/images/A.image'), state);
		const session = new EditorSession(memento);
		await session.start(new FakeImage('/images/A.image', new Set()));
		assert.strictEqual(session.stack.sorted().length, 0);
		assert.strictEqual(await session.open('class:Basket'), false);
		session.dispose();
	});
});
