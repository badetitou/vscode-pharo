import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { Playground, PlaygroundServer, playgroundFeaturesFrom } from '../../playground/playground';
import {
	PlaygroundFileSystem,
	evaluationRangeOf,
	nextPageName,
	pageLabelOf,
	pagesDirectoryOf,
	paragraphsOf,
	transcriptText
} from '../../playground/playgroundPages';

suite('Pharo playground', () => {
	let storage: vscode.Uri;
	let pathToImage: string | undefined;
	let pages: PlaygroundFileSystem;

	setup(() => {
		storage = vscode.Uri.file(fs.mkdtempSync(path.join(os.tmpdir(), 'pharo-playground-')));
		pathToImage = '/images/Moose/Moose.image';
		pages = new PlaygroundFileSystem(storage, () => pathToImage);
	});

	teardown(() => {
		pages.dispose();
		fs.rmSync(storage.fsPath, { recursive: true, force: true });
	});

	test('names a new page after the existing ones', () => {
		assert.strictEqual(nextPageName([]), 'Page 1.st');
		assert.strictEqual(nextPageName(['Page 1.st', 'Page 3.st', 'Notes.st']), 'Page 4.st');
	});

	test('keeps the pages of each image apart', async () => {
		const first = await pages.newPage();
		const second = await pages.newPage();
		assert.strictEqual(first.toString(), 'pharo-playground:/Moose/Page%201.st');
		assert.strictEqual(pageLabelOf(second), 'Page 2');
		await pages.writeFile(first, new TextEncoder().encode('3 + 4'), { create: false, overwrite: true });
		assert.strictEqual(new TextDecoder().decode(await pages.readFile(first)), '3 + 4');
		assert.ok(fs.existsSync(path.join(pagesDirectoryOf(storage, '/images/Moose/Moose.image').fsPath, 'Page 1.st')));

		pathToImage = '/images/Other/Other.image';
		assert.deepStrictEqual(await pages.pages(), []);
		await assert.rejects(
			pages.readFile(first),
			(error: unknown) => error instanceof vscode.FileSystemError && error.code === 'FileNotFound'
		);
	});

	test('lists the pages, the most recently changed first', async () => {
		const first = await pages.newPage();
		await pages.newPage();
		await new Promise((resolve) => setTimeout(resolve, 20));
		await pages.writeFile(first, new TextEncoder().encode('Transcript show: 1'), { create: false, overwrite: true });
		assert.deepStrictEqual((await pages.pages()).map(({ uri }) => pageLabelOf(uri)), ['Page 1', 'Page 2']);
	});

	test('evaluates the paragraph, the selection or the line', async () => {
		const document = await vscode.workspace.openTextDocument({ content: 'x := 3.\ny := 4.\n\n  \nx + y', language: 'pharo' });
		assert.deepStrictEqual(paragraphsOf(document).map((range) => document.getText(range)), ['x := 3.\ny := 4.', 'x + y']);
		assert.strictEqual(document.getText(evaluationRangeOf(document, new vscode.Selection(1, 2, 1, 2))), 'y := 4.');
		assert.strictEqual(document.getText(evaluationRangeOf(document, new vscode.Selection(0, 0, 0, 1))), 'x');
	});

	test('reads the playground capability of the server', () => {
		assert.deepStrictEqual(playgroundFeaturesFrom(undefined), { transcript: false, resetBindings: false, inspectIt: false });
		assert.deepStrictEqual(
			playgroundFeaturesFrom({ 'pls-playground': { version: 1, transcript: true, resetBindings: true, inspectIt: true } }),
			{ transcript: true, resetBindings: true, inspectIt: true }
		);
	});

	test('writes the lines of the Transcript', () => {
		assert.strictEqual(transcriptText('one\rtwo\r\n'), 'one\ntwo\n');
	});

	test('prints the result after the code, selected, and resets the variables', async () => {
		const requests: { method: string; params: unknown }[] = [];
		const server: PlaygroundServer = {
			sendRequest: async (method, params) => {
				requests.push({ method, params });
				return 'a "quoted" result';
			},
			onNotification: () => new vscode.Disposable(() => undefined)
		};
		const playground = new Playground(pages, vscode.Uri.joinPath(storage, 'debug'));
		try {
			playground.attach(server, playgroundFeaturesFrom({ 'pls-playground': { resetBindings: true } }), false);
			const document = await vscode.workspace.openTextDocument({ content: 'x := 3.\n\nx printString', language: 'pharo' });
			const [, last] = paragraphsOf(document);
			await playground.evaluate('printIt', document.uri, last);

			assert.deepStrictEqual(requests.map(({ method }) => method), ['command:printIt']);
			assert.strictEqual((requests[0].params as { line: string }).line, 'x printString');
			assert.strictEqual(document.getText(), 'x := 3.\n\nx printString "a ""quoted"" result"');
			const editor = vscode.window.activeTextEditor;
			assert.strictEqual(editor?.document.getText(editor.selection), ' "a ""quoted"" result"');

			await playground.resetBindings(document.uri);
			assert.strictEqual(requests[1].method, 'pls:resetBindings');
			assert.deepStrictEqual(requests[1].params, { textDocument: { uri: document.uri } });
		} finally {
			await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
			playground.dispose();
		}
	});
});
