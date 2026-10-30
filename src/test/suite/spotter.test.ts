import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { expectEnvSearchResult } from '../../env/envContracts';
import { matchesWords, parseSpotterQuery, searchItemOf } from '../../env/spotter';

const recorded: Record<string, any> = JSON.parse(
	fs.readFileSync(path.resolve(__dirname, '../../../testFixture/env/recorded.json'), 'utf8')
);

suite('Pharo Spotter', () => {
	test('searches every kind and the other categories without prefix', () => {
		assert.deepStrictEqual(parseSpotterQuery('  Array col '), { kinds: ['class', 'method', 'package', 'project'], others: true, text: 'Array col' });
		assert.deepStrictEqual(parseSpotterQuery(''), { kinds: ['class', 'method', 'package', 'project'], others: true, text: '' });
	});

	test('keeps one kind of entities after a prefix', () => {
		assert.deepStrictEqual(parseSpotterQuery('#Arr'), { kinds: ['class'], others: false, text: 'Arr' });
		assert.deepStrictEqual(parseSpotterQuery('>> Array col'), { kinds: ['method'], others: false, text: 'Array col' });
		assert.deepStrictEqual(parseSpotterQuery('@Collections'), { kinds: ['package'], others: false, text: 'Collections' });
		assert.deepStrictEqual(parseSpotterQuery('!Pharo'), { kinds: ['project'], others: false, text: 'Pharo' });
	});

	test('a class side method keeps its own syntax', () => {
		assert.deepStrictEqual(parseSpotterQuery('Array class>>new:').text, 'Array class>>new:');
	});

	test('matches open editors and commands on every word', () => {
		assert.ok(matchesWords('Pharo: Create Class', 'create pharo'));
		assert.ok(matchesWords('Array>>collect:', ''));
		assert.ok(!matchesWords('Pharo: Create Class', 'create method'));
	});

	test('names the class that defines an inherited method', () => {
		const [inherited] = expectEnvSearchResult(recorded.search, 'pls-env:search').items;
		const item = searchItemOf(inherited);
		assert.strictEqual(item.label, '$(symbol-method) Array>>collect:');
		assert.strictEqual(item.description, 'SequenceableCollection · Collections-Sequenceable');
		assert.ok(item.alwaysShow);
		const own = searchItemOf({ ...inherited, label: 'SequenceableCollection>>collect:' });
		assert.strictEqual(own.description, 'Collections-Sequenceable');
	});
});
