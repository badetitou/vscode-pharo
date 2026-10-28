import * as assert from 'assert';
import { parseJsoncObject } from '../../jsonc';

suite('JSONC configuration parsing', () => {
	test('parses JSON and JSONC objects', () => {
		assert.deepStrictEqual(parseJsoncObject('{"folders":[{"path":"."}]}', 'workspace'), {
			folders: [{ path: '.' }]
		});
		assert.deepStrictEqual(parseJsoncObject(`{
			// Workspace-specific Pharo image
			"settings": {
				"pharo.pathToImage": "/tmp/Image.image",
			},
		}`, 'workspace'), {
			settings: { 'pharo.pathToImage': '/tmp/Image.image' }
		});
	});

	test('reports malformed JSONC with its source and location', () => {
		assert.throws(
			() => parseJsoncObject('{\n  "settings": [\n}', '/tmp/test.code-workspace'),
			/Invalid JSONC in .*test\.code-workspace: .*line 3/
		);
	});

	test('rejects non-object JSON roots', () => {
		assert.throws(
			() => parseJsoncObject('[]', 'settings'),
			/expected an object at the root/
		);
	});
});
