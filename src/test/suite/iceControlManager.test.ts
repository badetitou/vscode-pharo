import * as assert from 'assert';
import * as vscode from 'vscode';
import { getUnsavedPharoBuffers } from '../../ice/IceControlManager';

suite('Iceberg image state', () => {
	test('separates dirty image buffers by repository and excludes original resources', () => {
		const documents = [
			{
				uri: vscode.Uri.parse('pharoImage:/Core/One.class.st?iceRepository=Core%20Repo'),
				isDirty: true
			},
			{
				uri: vscode.Uri.parse('pharoImage:/Other/Two.class.st?iceRepository=Other%20Repo'),
				isDirty: true
			},
			{
				uri: vscode.Uri.parse('pharoImage:/Core/Clean.class.st?iceRepository=Core%20Repo'),
				isDirty: false
			},
			{
				uri: vscode.Uri.parse('pharoImage:/Core/Original.class.st?iceRepository=Core%20Repo&iceOriginal=1'),
				isDirty: true
			},
			{
				uri: vscode.Uri.parse('file:///workspace/Local.class.st'),
				isDirty: true
			}
		];

		const resources = getUnsavedPharoBuffers(documents, 'Core Repo');
		assert.strictEqual(resources.length, 1);
		assert.strictEqual(resources[0].resourceUri.path, '/Core/One.class.st');
		assert.deepStrictEqual(resources[0].command, {
			command: 'vscode.open',
			title: 'Open Unsaved Buffer',
			arguments: [documents[0].uri]
		});
		assert.strictEqual(resources[0].contextValue, 'pharo-ice-unsaved-buffer');
		assert.match(resources[0].decorations?.tooltip ?? '', /not yet saved to the active Pharo image/);
	});
});
