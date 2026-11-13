import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { InlineResults } from '../../inlineResult';
import { Playground, PlaygroundServer, playgroundFeaturesFrom } from '../../playground/playground';
import { PlaygroundFileSystem } from '../../playground/playgroundPages';
import { LESSONS_EXPRESSION, Tutorial, indexAfter, lessonText, moveOf, parseLessons } from '../../playground/tutorial';

class MemoryMemento implements vscode.Memento {
	private readonly values = new Map<string, unknown>();
	keys(): readonly string[] {
		return [...this.values.keys()];
	}
	get<T>(key: string, defaultValue?: T): T {
		return (this.values.has(key) ? this.values.get(key) : defaultValue) as T;
	}
	async update(key: string, value: unknown): Promise<void> {
		this.values.set(key, value);
	}
}

const LESSONS = [
	{ title: 'Welcome', lesson: '"Hello! I\'m Professor Stef."\r\rProfStef next.' },
	{ title: 'Doing', lesson: '"Try it"\r\r1 + 2.\r\rProfStef next.' },
	{ title: 'The End', lesson: '"Bye"' }
];

/** Answer the result of Print it on the JSON of the lessons, as the image prints a string. */
function printedLessons(): string {
	return `'${JSON.stringify(LESSONS).replace(/'/g, '\'\'')}'`;
}

suite('Learn Pharo', () => {
	test('reads the lessons printed by the image, quoted or not', () => {
		const lessons = parseLessons(printedLessons());
		assert.strictEqual(lessons.length, 3);
		assert.strictEqual(lessons[0].lesson, '"Hello! I\'m Professor Stef."\n\nProfStef next.');
		assert.deepStrictEqual(parseLessons(JSON.stringify(LESSONS)).map(({ title }) => title), ['Welcome', 'Doing', 'The End']);
		assert.throws(() => parseLessons('\'nil\''));
	});

	test('shows the number and the title of a lesson in a comment', () => {
		assert.strictEqual(lessonText({ title: 'Say "hi"', lesson: '\n1 + 2.\n\n' }, 1, 30), '"Lesson 2/30: Say ""hi"""\n\n1 + 2.\n');
	});

	test('recognises the moves of ProfStef and keeps them within the lessons', () => {
		assert.strictEqual(moveOf('ProfStef next.'), 'next');
		assert.strictEqual(moveOf('  ProfStef previous'), 'previous');
		assert.strictEqual(moveOf('ProfStef go.'), 'first');
		assert.strictEqual(moveOf('ProfStef next. 1 + 2'), undefined);
		assert.strictEqual(moveOf('Transcript show: 1'), undefined);
		assert.strictEqual(indexAfter('next', 2, 3), 2);
		assert.strictEqual(indexAfter('previous', 0, 3), 0);
		assert.strictEqual(indexAfter('last', 0, 3), 2);
	});

	test('shows the lessons of the image in a page, and moves on ProfStef next instead of evaluating it', async () => {
		const storage = vscode.Uri.file(fs.mkdtempSync(path.join(os.tmpdir(), 'pharo-tutorial-')));
		const pages = new PlaygroundFileSystem(storage, () => '/images/Pharo/Pharo.image');
		const requests: string[] = [];
		const server: PlaygroundServer = {
			sendRequest: async (_method, params) => {
				const line = (params as { line: string }).line;
				requests.push(line);
				return line === LESSONS_EXPRESSION ? printedLessons() : '3';
			},
			onNotification: () => new vscode.Disposable(() => undefined)
		};
		const results = new InlineResults();
		const playground = new Playground(pages, vscode.Uri.joinPath(storage, 'debug'), results);
		const tutorial = new Tutorial(pages, new MemoryMemento(), () => playground.attachedServer);
		try {
			playground.register();
			playground.attach(server, playgroundFeaturesFrom(undefined), false);
			playground.intercept((page, code) => tutorial.evaluate(page, code));

			await tutorial.show(0);
			let document = vscode.window.activeTextEditor!.document;
			assert.ok(tutorial.isTutorialPage(document.uri));
			assert.ok(document.getText().startsWith('"Lesson 1/3: Welcome"'));
			assert.strictEqual(tutorial.codeLenses(document).length, 3);

			// ProfStef next moves to the next lesson without being sent to the image
			const line = document.getText().split('\n').findIndex((text) => text.startsWith('ProfStef next'));
			await playground.evaluate('doIt', document.uri, document.lineAt(line).range);
			document = vscode.window.activeTextEditor!.document;
			assert.ok(document.getText().startsWith('"Lesson 2/3: Doing"'));

			// Other code is evaluated in the image; the lessons are read once
			await playground.evaluate('printIt', document.uri, new vscode.Range(4, 0, 4, 6));
			assert.deepStrictEqual(requests, [LESSONS_EXPRESSION, '1 + 2.']);

			await tutorial.move('last');
			await tutorial.move('next');
			assert.ok(vscode.window.activeTextEditor!.document.getText().startsWith('"Lesson 3/3: The End"'));
		} finally {
			await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			tutorial.dispose();
			playground.dispose();
			results.dispose();
			pages.dispose();
			fs.rmSync(storage.fsPath, { recursive: true, force: true });
		}
	});
});
