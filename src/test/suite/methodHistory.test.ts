import * as assert from 'assert';
import * as vscode from 'vscode';
import { entityUri } from '../../env/entityUri';
import { HISTORY_SCHEME, formatStamp, methodIdOf, versionItems } from '../../env/methodHistory';

suite('Method history', () => {
	test('finds the method of an editor, an id, or an item of the views', () => {
		const method = entityUri({ image: 'PLS', packageName: 'Shop', className: 'Basket', side: 'class', selector: 'new' });
		assert.strictEqual(methodIdOf(method), 'method:Basket class>>new');
		assert.strictEqual(methodIdOf('method:Basket>>add:'), 'method:Basket>>add:');
		assert.strictEqual(methodIdOf({ id: 'method:Basket>>add:', kind: 'method', parent: 'protocol:Basket>>adding' }), 'method:Basket>>add:');
		assert.strictEqual(methodIdOf({ kind: 'method', node: { id: 'method:Basket>>total' } }), 'method:Basket>>total');
	});

	test('a class, a new method or another document has no history', () => {
		assert.strictEqual(methodIdOf(entityUri({ image: 'PLS', packageName: 'Shop', className: 'Basket' })), undefined);
		assert.strictEqual(methodIdOf(entityUri({ image: 'PLS', packageName: 'Shop', className: 'Basket', side: 'instance' })), undefined);
		assert.strictEqual(methodIdOf(vscode.Uri.file('/tmp/Basket.st')), undefined);
		assert.strictEqual(methodIdOf('class:Basket'), undefined);
		assert.strictEqual(methodIdOf(undefined), undefined);
	});

	test('shows an ISO stamp as a date, and an older stamp as it is', () => {
		assert.strictEqual(formatStamp('2026-11-01T18:05:59.044579+01:00'), new Date('2026-11-01T18:05:59.044+01:00').toLocaleString());
		assert.strictEqual(formatStamp('bv 3/4/2024 10:00'), 'bv 3/4/2024 10:00');
		assert.strictEqual(formatStamp(null), 'Unknown date');
	});

	test('lists the versions older than the current one, newest first', () => {
		const versions = [
			{ source: 'total\n\t^ items sum', protocol: 'accessing', stamp: '2026-11-01T18:05:59+01:00' },
			{ source: 'total\n\t^ items inject: 0 into: [ :a :b | a + b ]', protocol: 'accessing', stamp: '2026-10-30T10:00:00+01:00' },
			{ source: 'total\n\t^ items sum', protocol: 'as yet unclassified', stamp: null }
		];
		const uri = (index: number) => vscode.Uri.from({ scheme: HISTORY_SCHEME, path: '/PLS/Shop/Basket/instance/total.st', query: `${index}` });
		const items = versionItems(versions, uri);
		assert.deepStrictEqual(items.map((item) => item.uri.query), ['1', '2']);
		assert.deepStrictEqual(items.map((item) => item.description), [undefined, 'in as yet unclassified']);
		assert.deepStrictEqual(items.map((item) => item.detail), ['1 line not in the current version', undefined]);
		assert.strictEqual(items[1].label, '$(history) Unknown date');
	});
});
