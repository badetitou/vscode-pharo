import * as assert from 'assert';
import * as vscode from 'vscode';
import { EnvLostChange, EnvReplayResult } from '../../env/envContracts';
import { LostChangeState, LostChanges, describeKind, lostChangeRefsOf, lostChangeUri } from '../../env/lostChanges';
import { PharoEnvironment } from '../../env/pharoEnvironment';

const addition: EnvLostChange = {
	ref: '1', kind: 'classAddition', label: 'Basket', id: 'class:Basket', time: null,
	oldSource: null, source: 'Object << #Basket\n\tpackage: \'Shop\''
};
const modification: EnvLostChange = {
	ref: '2', kind: 'methodModification', label: 'Basket>>total', id: 'method:Basket>>total', time: '2026-10-31T09:30:00+01:00',
	oldSource: 'total\n\t^ 0', source: 'total\n\t^ items sum'
};
const removal: EnvLostChange = {
	ref: '3', kind: 'methodRemoval', label: 'Basket class>>//', id: 'method:Basket class>>//', time: null,
	oldSource: '// other\n\t^ nil', source: null
};

/** An image whose last session lost changes; replaying a change whose ref is in failing fails. */
class FakeImage {
	readonly image = '/images/Shop.image';
	pending = [addition, modification, removal];
	readonly replayed: string[][] = [];
	readonly failing = new Set<string>();

	async lostChanges(): Promise<EnvLostChange[]> {
		return this.pending;
	}

	async replayLostChanges(refs: string[]): Promise<EnvReplayResult> {
		this.replayed.push(refs);
		const failures = refs.filter((ref) => this.failing.has(ref)).map((ref) => ({ ref, message: 'Unknown class: \'Basket\'' }));
		this.pending = this.pending.filter((change) => !refs.includes(change.ref) || this.failing.has(change.ref));
		return { replayed: refs.filter((ref) => !this.failing.has(ref)), failures };
	}

	async dismissLostChanges(refs: string[]): Promise<void> {
		this.pending = this.pending.filter((change) => !refs.includes(change.ref));
	}
}

suite('Lost changes', () => {
	let image: FakeImage;
	let lostChanges: LostChanges;

	setup(() => {
		image = new FakeImage();
		lostChanges = new LostChanges(() => image as unknown as PharoEnvironment);
	});

	teardown(() => lostChanges.dispose());

	test('names a change as the editor of its entity would', () => {
		assert.strictEqual(lostChangeUri(modification, 'after').path, '/Basket/total.st');
		assert.strictEqual(lostChangeUri(removal, 'before').path, '/Basket class/%2F%2F.st');
		assert.strictEqual(lostChangeUri(addition, 'after').path, '/Basket.class.st');
		assert.strictEqual(lostChangeUri({ ...addition, id: 'package:Shop', label: 'Shop/Core' }, 'after').path, '/Shop∕Core');
		assert.strictEqual(lostChangeUri(modification, 'before').query, 'ref=2&side=before');
		assert.strictEqual(describeKind('methodModification'), 'Method modification');
	});

	test('shows the sources before and after a change', async () => {
		await lostChanges.refresh();
		assert.strictEqual(lostChanges.provideTextDocumentContent(lostChangeUri(modification, 'before')), 'total\n\t^ 0');
		assert.strictEqual(lostChanges.provideTextDocumentContent(lostChangeUri(modification, 'after')), 'total\n\t^ items sum');
		assert.strictEqual(lostChanges.provideTextDocumentContent(lostChangeUri(addition, 'before')), '');
	});

	test('decorates additions, modifications and removals', () => {
		const icons = [addition, modification, removal].map((change) => (new LostChangeState(change).decorations.iconPath as vscode.ThemeIcon).id);
		assert.deepStrictEqual(icons, ['diff-added', 'diff-modified', 'diff-removed']);
		assert.strictEqual(new LostChangeState(removal).decorations.strikeThrough, true);
		assert.strictEqual(new LostChangeState(modification).decorations.strikeThrough, false);
	});

	test('replays changes, then lists the ones left', async () => {
		await lostChanges.refresh();
		await lostChanges.replay(['2']);
		assert.deepStrictEqual(image.replayed, [['2']]);
		assert.deepStrictEqual(lostChanges.pending.map((change) => change.ref), ['1', '3']);
	});

	test('keeps a change that failed to replay', async () => {
		image.failing.add('3');
		await lostChanges.refresh();
		await lostChanges.replay(['1', '2', '3']);
		assert.deepStrictEqual(lostChanges.pending.map((change) => change.ref), ['3']);
	});

	test('dismisses changes', async () => {
		await lostChanges.refresh();
		await lostChanges.dismiss(['1', '3']);
		assert.deepStrictEqual(lostChanges.pending.map((change) => change.ref), ['2']);
		await lostChanges.dismiss(['2']);
		assert.deepStrictEqual(lostChanges.pending, []);
	});

	test('the commands of the Source Control view act on the selected changes, or on a whole group', () => {
		const states = [addition, modification, removal].map((change) => new LostChangeState(change));
		assert.deepStrictEqual(lostChangeRefsOf(states[1]), ['2']);
		assert.deepStrictEqual(lostChangeRefsOf(states[0], [states[2], states[0]]), ['1', '3']);
		assert.deepStrictEqual(lostChangeRefsOf({ id: 'lostChanges', resourceStates: states }), ['1', '2', '3']);
		assert.deepStrictEqual(lostChangeRefsOf(undefined), []);
	});
});
