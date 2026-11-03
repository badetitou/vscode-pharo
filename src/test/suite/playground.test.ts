import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { InlineResults, displayedResult, insertedResultText } from '../../inlineResult';
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

	test('Insert writes the result in a page of the playground, without argument', async () => {
		const server: PlaygroundServer = { sendRequest: async () => '7', onNotification: () => new vscode.Disposable(() => undefined) };
		const results = new InlineResults();
		const playground = new Playground(pages, vscode.Uri.joinPath(storage, 'debug'), results);
		try {
			playground.register();
			playground.attach(server, playgroundFeaturesFrom(undefined), false);
			const page = await pages.newPage();
			await pages.writeFile(page, new TextEncoder().encode('3 + 4'), { create: false, overwrite: true });
			const document = await vscode.workspace.openTextDocument(page);
			await playground.evaluate('printIt', page, new vscode.Range(0, 0, 0, 5));
			assert.ok(results.has(page));
			await vscode.commands.executeCommand('pharo.inlineResult.insert');
			assert.strictEqual(document.getText(), '3 + 4 "7"');
		} finally {
			await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
			playground.dispose();
			results.dispose();
		}
	});

	test('formats the inline result', () => {
		assert.strictEqual(insertedResultText('a "quoted" result'), ' "a ""quoted"" result"');
		assert.strictEqual(displayedResult('one\n  two'), 'one two');
		assert.strictEqual(displayedResult('x'.repeat(300)).length, 100);
	});

	test('prints the result over the code, without editing, until the next edit or Escape; Insert writes it; resets the variables', async () => {
		const requests: { method: string; params: unknown }[] = [];
		const server: PlaygroundServer = {
			sendRequest: async (method, params) => {
				requests.push({ method, params });
				return 'a "quoted" result';
			},
			onNotification: () => new vscode.Disposable(() => undefined)
		};
		const results = new InlineResults();
		const playground = new Playground(pages, vscode.Uri.joinPath(storage, 'debug'), results);
		try {
			playground.attach(server, playgroundFeaturesFrom({ 'pls-playground': { resetBindings: true } }), false);
			const document = await vscode.workspace.openTextDocument({ content: 'x := 3.\n\nx printString\n\nnext', language: 'pharo' });
			await playground.evaluate('printIt', document.uri, new vscode.Range(2, 0, 2, 13));

			assert.deepStrictEqual(requests.map(({ method }) => method), ['command:printIt']);
			assert.strictEqual((requests[0].params as { line: string }).line, 'x printString');
			assert.strictEqual(document.getText(), 'x := 3.\n\nx printString\n\nnext');
			assert.ok(results.has(document.uri));

			// An edit below keeps the result, Escape removes it
			const editor = vscode.window.activeTextEditor!;
			await editor.edit((builder) => builder.insert(new vscode.Position(4, 4), '!'));
			assert.ok(results.has(document.uri));
			await vscode.commands.executeCommand('pharo.inlineResult.clear');
			assert.ok(!results.has(document.uri));

			// An edit of the line removes it
			await playground.evaluate('printIt', document.uri, new vscode.Range(2, 0, 2, 13));
			assert.ok(results.has(document.uri));
			await editor.edit((builder) => builder.insert(new vscode.Position(2, 0), ' '));
			assert.ok(!results.has(document.uri));

			// Insert writes the result after the code, selected
			await playground.evaluate('printIt', document.uri, new vscode.Range(2, 1, 2, 14));
			await vscode.commands.executeCommand('pharo.inlineResult.insert', document.uri.toString());
			assert.strictEqual(document.lineAt(2).text, ' x printString "a ""quoted"" result"');
			assert.strictEqual(editor.document.getText(editor.selection), ' "a ""quoted"" result"');
			assert.ok(!results.has(document.uri));

			// The setting inserts the result at once
			const configuration = vscode.workspace.getConfiguration('pharo');
			await configuration.update('printIt.insertResult', true, vscode.ConfigurationTarget.Global);
			try {
				await playground.evaluate('printIt', document.uri, new vscode.Range(0, 0, 0, 7));
				assert.strictEqual(document.lineAt(0).text, 'x := 3. "a ""quoted"" result"');
				assert.ok(!results.has(document.uri));
			} finally {
				await configuration.update('printIt.insertResult', undefined, vscode.ConfigurationTarget.Global);
			}

			await playground.resetBindings(document.uri);
			assert.strictEqual(requests[requests.length - 1].method, 'pls:resetBindings');
			assert.deepStrictEqual(requests[requests.length - 1].params, { textDocument: { uri: document.uri } });
		} finally {
			await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
			playground.dispose();
			results.dispose();
		}
	});
});
