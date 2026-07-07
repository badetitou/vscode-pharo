import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildPharoUri, ICE_REPOSITORY_QUERY_KEY, PHARO_IMAGE_SCHEME, repositoryNameFromPharoUri } from '../../treeProvider/pharoUri';

suite('Pharo URI helpers', () => {
	test('repositoryNameFromPharoUri reads repository from query', () => {
		const uri = vscode.Uri.parse(`${PHARO_IMAGE_SCHEME}:/MyPackage/MyClass.class.st?${ICE_REPOSITORY_QUERY_KEY}=My%20Repo`, true);
		assert.strictEqual(repositoryNameFromPharoUri(uri), 'My Repo');
	});

	test('repositoryNameFromPharoUri ignores missing or invalid repository context', () => {
		assert.strictEqual(repositoryNameFromPharoUri(undefined), undefined);
		assert.strictEqual(repositoryNameFromPharoUri(vscode.Uri.parse('file:///tmp/test.st', true)), undefined);
		assert.strictEqual(repositoryNameFromPharoUri(vscode.Uri.parse(`${PHARO_IMAGE_SCHEME}:/MyPackage`, true)), undefined);
	});

	test('buildPharoUri keeps path and encodes repository query', () => {
		const uri = buildPharoUri('/MyPackage/MyClass.class.st', 'Repo With Space');
		assert.strictEqual(uri.scheme, PHARO_IMAGE_SCHEME);
		assert.strictEqual(uri.path, '/MyPackage/MyClass.class.st');
		assert.strictEqual(uri.query, `${ICE_REPOSITORY_QUERY_KEY}=Repo%20With%20Space`);
	});

	test('buildPharoUri omits query when no repository is provided', () => {
		const uri = buildPharoUri('/MyPackage');
		assert.strictEqual(uri.query, '');
	});
});