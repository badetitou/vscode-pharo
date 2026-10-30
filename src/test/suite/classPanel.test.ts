import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	ALL_PROTOCOLS,
	ClassPanelEnvironment,
	ClassPanelItem,
	ClassPanelProvider,
	accessorSourcesOf,
	classOfEditor,
	methodMarkersOf
} from '../../env/classPanel';
import { EnvEntity, EnvNode, ENV_UNKNOWN_ENTITY_ERROR_CODE, parseEnvId } from '../../env/envContracts';
import { summarizeEnvChanges } from '../../env/environmentChanges';
import { entityUri } from '../../env/entityUri';

function method(id: string, flags: Record<string, boolean> = {}, trait?: string): EnvNode {
	const path = parseEnvId(id).path;
	const separator = path.indexOf('>>');
	return { id, kind: 'method', name: path.slice(separator + 2), parent: null, hasChildren: false, flags, ...(trait ? { trait } : {}) };
}

function protocol(id: string): EnvNode {
	const path = parseEnvId(id).path;
	return { id, kind: 'protocol', name: path.slice(path.indexOf('>>') + 2), parent: null, hasChildren: true, flags: {} };
}

/** A Basket class that uses the trait TCountable. */
class FakeImage implements ClassPanelEnvironment {
	readonly invalidated: string[] = [];
	readonly sides = new Map<string, Partial<EnvEntity>>([
		['side:Basket', { slots: ['items', 'owner'], classVariables: ['Default'], traits: ['class:TCountable'], overridden: ['add:'] }],
		['side:Basket class', { slots: [], classVariables: [], traits: ['class:TCountable'], overridden: [] }],
		['side:TCountable', { slots: [], classVariables: [], traits: [], overridden: [] }],
		['side:TCountable class', { slots: [], classVariables: [], traits: [], overridden: [] }]
	]);
	readonly childrenById = new Map<string, EnvNode[]>([
		['side:Basket', [protocol('protocol:Basket>>accessing'), protocol('protocol:Basket>>adding'), protocol('protocol:Basket>>*Shop-Extensions')]],
		['protocol:Basket>>accessing', [method('method:Basket>>items'), method('method:Basket>>count', { fromTrait: true }, 'class:TCountable')]],
		['protocol:Basket>>adding', [method('method:Basket>>add:', { override: true }), method('method:Basket>>addAll:', { abstract: true })]],
		['protocol:Basket>>*Shop-Extensions', [method('method:Basket>>printOn:', { extension: true })]],
		['side:Basket class', [protocol('protocol:Basket class>>instance creation')]],
		['protocol:Basket class>>instance creation', [method('method:Basket class>>new')]],
		['side:TCountable', [protocol('protocol:TCountable>>accessing')]],
		['protocol:TCountable>>accessing', [method('method:TCountable>>count')]],
		['side:TCountable class', []]
	]);

	async entity(id: string): Promise<EnvEntity> {
		const side = this.sides.get(id);
		if (!side) {
			throw { code: ENV_UNKNOWN_ENTITY_ERROR_CODE, message: `Unknown entity ${id}` };
		}
		return { id, kind: 'side', name: id, parent: null, hasChildren: true, flags: {}, package: 'package:Shop', repository: null, ...side };
	}

	async children(id: string): Promise<EnvNode[]> {
		return this.childrenById.get(id) ?? [];
	}

	invalidate(id: string): void {
		this.invalidated.push(id);
	}
}

function labelOf(item: ClassPanelItem, provider: ClassPanelProvider): string {
	const treeItem = provider.getTreeItem(item);
	const label = typeof treeItem.label === 'string' ? treeItem.label : treeItem.label?.label;
	return treeItem.description ? `${label} (${treeItem.description})` : `${label}`;
}

async function labelsOf(provider: ClassPanelProvider, item?: ClassPanelItem): Promise<string[]> {
	return (await provider.getChildren(item)).map((child) => labelOf(child, provider));
}

async function childNamed(provider: ClassPanelProvider, name: string, item?: ClassPanelItem): Promise<ClassPanelItem> {
	const child = (await provider.getChildren(item)).find((candidate) => labelOf(candidate, provider).split(' (')[0] === name);
	assert.ok(child, `${name} is not shown`);
	return child;
}

suite('Pharo class panel', () => {
	test('shows the slots, then the protocols with (All) and their number of methods', async () => {
		const provider = new ClassPanelProvider(() => new FakeImage());
		await provider.show('Basket');
		assert.deepStrictEqual(await labelsOf(provider), ['Slots', 'Protocols']);
		assert.deepStrictEqual(await labelsOf(provider, await childNamed(provider, 'Slots')), ['items', 'owner', 'Default (class variable)']);
		const protocols = await childNamed(provider, 'Protocols');
		assert.deepStrictEqual(await labelsOf(provider, protocols), [`${ALL_PROTOCOLS} (5)`, 'accessing (2)', 'adding (2)', '*Shop-Extensions (1)']);
		assert.deepStrictEqual(
			await labelsOf(provider, await childNamed(provider, ALL_PROTOCOLS, protocols)),
			['add: (↑ ↓)', 'addAll: (abstract)', 'count (from TCountable)', 'items', 'printOn: (extension)']
		);
		assert.strictEqual(provider.getTreeItem(await childNamed(provider, 'Slots')).contextValue, 'pharoClassPanel.slots');
	});

	test('shows the class side and the traits of the class', async () => {
		const provider = new ClassPanelProvider(() => new FakeImage());
		await provider.show('Basket', 'class');
		assert.deepStrictEqual(await labelsOf(provider), ['Protocols']);
		assert.deepStrictEqual(await labelsOf(provider, await childNamed(provider, 'Protocols')), [`${ALL_PROTOCOLS} (1)`, 'instance creation (1)']);
		await provider.show('Basket', 'traits');
		assert.deepStrictEqual(provider.traits, ['class:TCountable']);
		const trait = await childNamed(provider, 'TCountable');
		assert.deepStrictEqual(await labelsOf(provider, trait), ['accessing (1)']);
		assert.deepStrictEqual(await labelsOf(provider, await childNamed(provider, 'accessing', trait)), ['count']);
	});

	test('filters the slots and methods, and hides the protocols left empty', async () => {
		const provider = new ClassPanelProvider(() => new FakeImage());
		await provider.show('Basket');
		await provider.setFilter('ADD');
		assert.deepStrictEqual(await labelsOf(provider), ['Protocols']);
		assert.deepStrictEqual(await labelsOf(provider, await childNamed(provider, 'Protocols')), [`${ALL_PROTOCOLS} (2)`, 'adding (2)']);
		await provider.setFilter('');
		assert.deepStrictEqual(await labelsOf(provider), ['Slots', 'Protocols']);
	});

	test('finds the method of an editor in its protocol, so that the tree can reveal it', async () => {
		const provider = new ClassPanelProvider(() => new FakeImage());
		await provider.show('Basket');
		const item = await provider.methodItem('method:Basket>>add:');
		assert.ok(item);
		const protocolItem = provider.getParent(item);
		assert.ok(protocolItem);
		assert.strictEqual(labelOf(protocolItem, provider), 'adding (2)');
		const section = provider.getParent(protocolItem);
		assert.ok(section);
		assert.strictEqual(labelOf(section, provider), 'Protocols');
		assert.strictEqual(provider.getParent(section), undefined);
		const treeItem = provider.getTreeItem(item);
		assert.deepStrictEqual(treeItem.command?.arguments, ['method:Basket>>add:']);
		assert.strictEqual(await provider.methodItem('method:Basket>>missing'), undefined);
	});

	test('reloads when the image changes the class or one of its traits, and only then', async () => {
		const image = new FakeImage();
		const provider = new ClassPanelProvider(() => image);
		await provider.show('Basket');
		image.childrenById.get('protocol:Basket>>adding')?.push(method('method:Basket>>remove:'));
		assert.strictEqual(provider.applyChanges(summarizeEnvChanges([{ reset: false, changes: [{ kind: 'added', id: 'method:Other>>x' }] }])), undefined);
		await provider.applyChanges(summarizeEnvChanges([{ reset: false, changes: [{ kind: 'added', id: 'method:Basket>>remove:' }] }]));
		assert.ok(image.invalidated.includes('side:Basket'));
		assert.deepStrictEqual((await labelsOf(provider, await childNamed(provider, 'Protocols')))[2], 'adding (3)');
		assert.ok(provider.applyChanges(summarizeEnvChanges([{ reset: false, changes: [{ kind: 'changed', id: 'method:TCountable>>count' }] }])));
		assert.ok(provider.applyChanges(summarizeEnvChanges([{ reset: true, changes: [] }])));
	});

	test('says when the class is no longer in the image, or when the server has no environment model', async () => {
		const image = new FakeImage();
		const provider = new ClassPanelProvider(() => image);
		await provider.show('Basket');
		image.sides.delete('side:Basket');
		await provider.reload();
		assert.deepStrictEqual(await provider.getChildren(), []);
		assert.strictEqual(provider.message, 'Basket is no longer in the image.');
		const withoutServer = new ClassPanelProvider(() => undefined);
		await withoutServer.show('Basket');
		assert.match(withoutServer.message ?? '', /pls-env/);
	});

	test('reads the class of an entity editor, a pharoImage class and a Tonel file', () => {
		const location = { image: 'PLS', packageName: 'Shop', className: 'Basket' };
		assert.deepStrictEqual(classOfEditor(entityUri({ ...location, side: 'class', selector: 'new' })), {
			className: 'Basket', side: 'class', methodId: 'method:Basket class>>new'
		});
		assert.deepStrictEqual(classOfEditor(entityUri(location)), { className: 'Basket', side: undefined, methodId: undefined });
		assert.deepStrictEqual(classOfEditor(entityUri({ ...location, side: 'instance' })), { className: 'Basket', side: 'instance', methodId: undefined });
		assert.deepStrictEqual(classOfEditor(vscode.Uri.parse('pharoImage:/Shop/Basket.class.st')), { className: 'Basket' });
		assert.deepStrictEqual(classOfEditor(vscode.Uri.file('/src/Shop/TCountable.trait.st')), { className: 'TCountable' });
		assert.strictEqual(classOfEditor(vscode.Uri.file('/src/Shop/package.st')), undefined);
		assert.strictEqual(classOfEditor(vscode.Uri.parse('untitled:Basket.class.st')), undefined);
	});

	test('names the markers of a method and the accessors of a slot', () => {
		const item = (flags: Record<string, boolean>, overridden = false): Extract<ClassPanelItem, { kind: 'method' }> =>
			({ kind: 'method', key: 'k', parentKey: 'p', node: method('method:Basket>>add:', flags, 'class:TCountable'), overridden });
		assert.deepStrictEqual(methodMarkersOf(item({ override: true }, true)), ['↑', '↓']);
		assert.deepStrictEqual(methodMarkersOf(item({ fromTrait: true, deprecated: true })), ['from TCountable', 'deprecated']);
		assert.deepStrictEqual(accessorSourcesOf('items'), ['items\n\n\t^ items', 'items: anItems\n\n\titems := anItems']);
		assert.deepStrictEqual(accessorSourcesOf('owner')[1], 'owner: anOwner\n\n\towner := anOwner');
		assert.deepStrictEqual(accessorSourcesOf('count')[1], 'count: aCount\n\n\tcount := aCount');
	});
});
