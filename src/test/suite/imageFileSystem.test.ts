import * as assert from 'assert';
import * as vscode from 'vscode';
import { PharoDataProvider } from '../../treeProvider/imageExplorer';

suite('Pharo image file system', () => {
	let provider: PharoDataProvider;
	let requests: string[];

	setup(() => {
		requests = [];
		provider = new PharoDataProvider(async (method) => {
			requests.push(method);
			switch (method) {
				case 'pls:packages':
					return ['Core'];
				case 'pls:classes':
					return ['Object', 'String'];
				default:
					throw new Error(`Unexpected request: ${method}`);
			}
		}, () => true);
	});

	teardown(() => provider.dispose());

	test('reports missing package and class paths as FileNotFound', async () => {
		await assert.rejects(
			provider.stat(vscode.Uri.parse('pharoImage:/Missing')),
			(error: unknown) => error instanceof vscode.FileSystemError && error.code === 'FileNotFound'
		);
		await assert.rejects(
			provider.stat(vscode.Uri.parse('pharoImage:/Core/DoesNotExist.class.st')),
			(error: unknown) => error instanceof vscode.FileSystemError && error.code === 'FileNotFound'
		);
	});

	test('recognizes only existing package and class resources', async () => {
		assert.strictEqual((await provider.stat(vscode.Uri.parse('pharoImage:/Core'))).type, vscode.FileType.Directory);
		assert.strictEqual((await provider.stat(vscode.Uri.parse('pharoImage:/Core/String.class.st'))).type, vscode.FileType.File);
		assert.deepStrictEqual(await provider.readDirectory(vscode.Uri.parse('pharoImage:/Core')), [
			['Object.class.st', vscode.FileType.File],
			['String.class.st', vscode.FileType.File]
		]);
	});

	test('bounds requests with caches and invalidates them on refresh', async () => {
		await provider.stat(vscode.Uri.parse('pharoImage:/Core'));
		await provider.stat(vscode.Uri.parse('pharoImage:/Core'));
		assert.strictEqual(requests.filter((method) => method === 'pls:packages').length, 1);

		const events: vscode.FileChangeEvent[][] = [];
		const listener = provider.onDidChangeFile((changes) => events.push(changes));
		provider.refresh(vscode.Uri.parse('pharoImage:/Core/String.class.st'));
		await provider.stat(vscode.Uri.parse('pharoImage:/Core'));
		listener.dispose();

		assert.strictEqual(requests.filter((method) => method === 'pls:packages').length, 2);
		assert.ok(events[0].some((change) => change.uri.toString() === 'pharoImage:/'));
		assert.ok(events[0].some((change) => change.uri.toString() === 'pharoImage:/Core/String.class.st'));
	});
});
