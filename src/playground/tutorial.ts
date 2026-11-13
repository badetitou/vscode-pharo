import * as vscode from 'vscode';
import { PLAYGROUND_SCHEME, PlaygroundFileSystem, pageUri } from './playgroundPages';
import type { PlaygroundServer } from './playground';

// Learn Pharo: the lessons of ProfStef, read from the image, shown one at a time in a page of the playground.
// The lessons ask to evaluate `ProfStef next`: in the page, these expressions move between lessons instead of opening
// the tutorial in the world of the image.

/** A lesson of the Pharo syntax tutorial of the image. */
export interface Lesson {
	title: string;
	lesson: string;
}

/** The page of the playground that shows the current lesson. */
export const TUTORIAL_PAGE = 'Learn Pharo.st';

/** Expression evaluated in the image to answer the lessons of ProfStef, as JSON. */
export const LESSONS_EXPRESSION = 'STON toJsonString: (PharoSyntaxTutorial new lessons asArray collect: [ :each | '
	+ 'Dictionary new at: \'title\' put: each title; at: \'lesson\' put: each lesson; yourself ])';

const CURRENT_LESSON_KEY = 'pharo.tutorial.lesson';

/** Answer the lessons from the result of Print it on LESSONS_EXPRESSION, quoted as a Pharo string or not. */
export function parseLessons(result: string): Lesson[] {
	const trimmed = result.trim();
	const json = trimmed.length >= 2 && trimmed.startsWith('\'') && trimmed.endsWith('\'')
		? trimmed.slice(1, -1).replace(/''/g, '\'')
		: trimmed;
	const lessons: unknown = JSON.parse(json);
	if (!Array.isArray(lessons)) {
		throw new Error('The image did not answer a list of lessons.');
	}
	return lessons.map((each) => ({
		title: String((each as Partial<Lesson>).title ?? ''),
		lesson: String((each as Partial<Lesson>).lesson ?? '').replace(/\r\n?/g, '\n')
	}));
}

/** Answer the text of the page of a lesson: a comment with its number and title, then the lesson. */
export function lessonText(lesson: Lesson, index: number, count: number): string {
	const title = lesson.title.replace(/"/g, '""');
	return `"Lesson ${index + 1}/${count}: ${title}"\n\n${lesson.lesson.trim()}\n`;
}

export type Move = 'next' | 'previous' | 'first' | 'last';

/** Answer the move asked by an expression such as `ProfStef next.`, or undefined for any other code. */
export function moveOf(code: string): Move | undefined {
	const match = /^\s*ProfStef\s+(next|previous|go|first|last)\s*\.?\s*$/.exec(code);
	if (!match) {
		return undefined;
	}
	return match[1] === 'go' ? 'first' : match[1] as Move;
}

/** Answer the index of the lesson after a move, kept within the lessons. */
export function indexAfter(move: Move, index: number, count: number): number {
	switch (move) {
		case 'first': return 0;
		case 'last': return count - 1;
		case 'next': return Math.min(index + 1, count - 1);
		case 'previous': return Math.max(index - 1, 0);
	}
}

/**
 * The Learn Pharo tutorial: the lessons of ProfStef, in a page of the playground of the active image, with lenses to
 * move between them. The current lesson is remembered across sessions.
 */
export class Tutorial implements vscode.Disposable {
	private lessons: { server: PlaygroundServer; lessons: Lesson[] } | undefined;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(
		private readonly pages: PlaygroundFileSystem,
		private readonly state: vscode.Memento,
		private readonly server: () => PlaygroundServer | undefined
	) {}

	register(): void {
		this.disposables.push(
			vscode.languages.registerCodeLensProvider({ scheme: PLAYGROUND_SCHEME }, { provideCodeLenses: (document) => this.codeLenses(document) }),
			vscode.commands.registerCommand('pharo.tutorial.open', () => this.show(this.state.get<number>(CURRENT_LESSON_KEY, 0))),
			vscode.commands.registerCommand('pharo.tutorial.restart', () => this.move('first')),
			vscode.commands.registerCommand('pharo.tutorial.next', () => this.move('next')),
			vscode.commands.registerCommand('pharo.tutorial.previous', () => this.move('previous'))
		);
	}

	dispose(): void {
		this.disposables.forEach((disposable) => disposable.dispose());
	}

	/** Answer whether a page is the page of the tutorial. */
	isTutorialPage(uri: vscode.Uri): boolean {
		return uri.scheme === PLAYGROUND_SCHEME && uri.path.endsWith(`/${TUTORIAL_PAGE}`);
	}

	/** Move between lessons when the code evaluated in the page of the tutorial asks for it; answer whether it did. */
	async evaluate(uri: vscode.Uri, code: string): Promise<boolean> {
		const move = this.isTutorialPage(uri) ? moveOf(code) : undefined;
		if (!move) {
			return false;
		}
		await this.move(move);
		return true;
	}

	/** Answer the lenses of the page of the tutorial, on its first line. */
	codeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		if (!this.isTutorialPage(document.uri) || document.lineCount === 0) {
			return [];
		}
		const range = document.lineAt(0).range;
		return [
			new vscode.CodeLens(range, { title: '$(arrow-left) Previous Lesson', command: 'pharo.tutorial.previous' }),
			new vscode.CodeLens(range, { title: 'Next Lesson $(arrow-right)', command: 'pharo.tutorial.next' }),
			new vscode.CodeLens(range, { title: '$(debug-restart) Restart', command: 'pharo.tutorial.restart' })
		];
	}

	async move(move: Move): Promise<void> {
		const lessons = await this.loadLessons();
		if (lessons) {
			await this.show(indexAfter(move, this.state.get<number>(CURRENT_LESSON_KEY, 0), lessons.length));
		}
	}

	/** Write a lesson in the page of the tutorial, and show it. */
	async show(index: number): Promise<void> {
		const lessons = await this.loadLessons();
		const image = this.pages.image;
		if (!lessons || !image) {
			return;
		}
		if (lessons.length === 0) {
			void vscode.window.showErrorMessage('The image has no lesson of ProfStef.');
			return;
		}
		const current = Math.min(Math.max(index, 0), lessons.length - 1);
		await this.state.update(CURRENT_LESSON_KEY, current);
		const uri = pageUri(image, TUTORIAL_PAGE);
		const text = lessonText(lessons[current], current, lessons.length);
		const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
		if (open) {
			// Replace the text of the open page, so that an edit of the previous lesson does not block the move
			const edit = new vscode.WorkspaceEdit();
			edit.replace(uri, new vscode.Range(0, 0, open.lineCount, 0), text);
			await vscode.workspace.applyEdit(edit);
			await open.save();
		} else {
			await this.pages.writeFile(uri, new TextEncoder().encode(text), { create: true, overwrite: true });
		}
		const editor = await vscode.window.showTextDocument(uri, { preview: false });
		editor.selection = new vscode.Selection(0, 0, 0, 0);
		editor.revealRange(new vscode.Range(0, 0, 0, 0), vscode.TextEditorRevealType.AtTop);
	}

	/** Answer the lessons of the image, read once per server, or undefined when the server is not started or fails. */
	private async loadLessons(): Promise<Lesson[] | undefined> {
		const server = this.server();
		const image = this.pages.image;
		if (!server || !image) {
			void vscode.window.showErrorMessage('Start the Pharo Language Server to learn Pharo: the lessons come from the image.');
			return undefined;
		}
		if (this.lessons?.server === server) {
			return this.lessons.lessons;
		}
		try {
			const result = await server.sendRequest('command:printIt', { line: LESSONS_EXPRESSION, textDocumentURI: pageUri(image, TUTORIAL_PAGE) });
			this.lessons = { server, lessons: parseLessons(String(result)) };
			return this.lessons.lessons;
		} catch (error) {
			void vscode.window.showErrorMessage(`Unable to read the lessons of ProfStef: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}
}
