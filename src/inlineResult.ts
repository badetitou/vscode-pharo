import * as vscode from 'vscode';

const MAX_DISPLAY_LENGTH = 100;

/** A result of Print it shown after the code that answered it. */
interface InlineResult {
	range: vscode.Range;
	code: string;
	result: string;
	/** The document is edited from this line down: the result does not belong to the code any more. */
	uri: vscode.Uri;
}

/** The result as a comment of Smalltalk, the text Print it inserts after the code. */
export function insertedResultText(result: string): string {
	return ` "${result.replace(/"/g, '""')}"`;
}

/** The result on one line, shortened to fit after the code. */
export function displayedResult(result: string): string {
	const line = result.replace(/\s+/g, ' ').trim();
	return line.length > MAX_DISPLAY_LENGTH ? `${line.slice(0, MAX_DISPLAY_LENGTH - 1)}…` : line;
}

/** Whether Print it inserts its result in the code, as before the inline results (setting pharo.printIt.insertResult). */
export function insertsPrintResult(): boolean {
	return vscode.workspace.getConfiguration('pharo').get<boolean>('printIt.insertResult', false);
}

/**
 * The results of Print it, shown as decorations after the evaluated code without changing the document.
 * A document shows one result: hovering it offers to inspect, copy or insert the result; it goes away with the next
 * edit of its line, with Escape or when the document closes.
 */
export class InlineResults implements vscode.Disposable {
	private readonly results = new Map<string, InlineResult>();
	private readonly decoration = vscode.window.createTextEditorDecorationType({});
	private readonly disposables: vscode.Disposable[] = [];

	constructor() {
		this.disposables.push(
			this.decoration,
			vscode.workspace.onDidChangeTextDocument((event) => event.contentChanges.forEach((change) => this.forget(event.document.uri, change))),
			vscode.workspace.onDidCloseTextDocument((document) => this.clear(document.uri)),
			vscode.commands.registerCommand('pharo.inlineResult.clear', () => this.clearActive()),
			vscode.commands.registerCommand('pharo.inlineResult.copy', (uri?: string) => this.copy(uri)),
			vscode.commands.registerCommand('pharo.inlineResult.insert', (uri?: string) => this.insert(uri))
		);
	}

	dispose(): void {
		this.disposables.forEach((disposable) => disposable.dispose());
	}

	/** Answer whether the document of uri shows a result. */
	has(uri: vscode.Uri): boolean {
		return this.results.has(uri.toString());
	}

	/** Show result after the code at range of editor, in place of the previous result of its document. */
	show(editor: vscode.TextEditor, range: vscode.Range, code: string, result: string): void {
		const uri = editor.document.uri;
		this.clear(uri);
		this.results.set(uri.toString(), { range, code, result, uri });
		this.render(uri);
		void vscode.commands.executeCommand('setContext', 'pharo.inlineResultVisible', true);
	}

	clear(uri: vscode.Uri): void {
		if (this.results.delete(uri.toString())) {
			this.render(uri);
		}
		void vscode.commands.executeCommand('setContext', 'pharo.inlineResultVisible', this.results.size > 0);
	}

	/** Forget the result of the document of uri when change touches its line or the lines above. */
	forget(uri: vscode.Uri, change: vscode.TextDocumentContentChangeEvent): void {
		const shown = this.results.get(uri.toString());
		if (shown && change.range.start.line <= shown.range.end.line) {
			this.clear(uri);
		}
	}

	private clearActive(): void {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			this.clear(editor.document.uri);
		}
	}

	private async copy(uri?: string): Promise<void> {
		const shown = this.find(uri);
		if (shown) {
			await vscode.env.clipboard.writeText(shown.result);
		}
	}

	/** Insert the result after the code, selected so that typing replaces it. */
	private async insert(uri?: string): Promise<void> {
		const shown = this.find(uri);
		if (!shown) {
			return;
		}
		const editor = await vscode.window.showTextDocument(shown.uri, { preserveFocus: false, preview: false });
		const target = shown.range;
		this.clear(shown.uri);
		await insertResult(editor, target, shown.result);
	}

	private find(uri?: string): InlineResult | undefined {
		const key = uri ?? vscode.window.activeTextEditor?.document.uri.toString();
		return key ? this.results.get(key) : undefined;
	}

	private render(uri: vscode.Uri): void {
		const shown = this.results.get(uri.toString());
		for (const editor of vscode.window.visibleTextEditors) {
			if (editor.document.uri.toString() === uri.toString()) {
				editor.setDecorations(this.decoration, shown ? [this.optionsOf(shown)] : []);
			}
		}
	}

	private optionsOf(shown: InlineResult): vscode.DecorationOptions {
		return {
			range: shown.range,
			hoverMessage: hoverOf(shown),
			renderOptions: {
				after: {
					contentText: `  ⇒ ${displayedResult(shown.result)}`,
					color: new vscode.ThemeColor('editorCodeLens.foreground'),
					fontStyle: 'italic'
				}
			}
		};
	}
}

/** Insert result after the range of the code in editor, selected so that typing replaces it. */
export async function insertResult(editor: vscode.TextEditor, range: vscode.Range, result: string): Promise<void> {
	const printed = insertedResultText(result);
	if (await editor.edit((builder) => builder.insert(range.end, printed))) {
		editor.selection = new vscode.Selection(range.end, range.end.translate(0, printed.length));
	}
}

function hoverOf(shown: InlineResult): vscode.MarkdownString {
	const markdown = new vscode.MarkdownString(undefined, true);
	markdown.isTrusted = { enabledCommands: ['pharo.inspector.inspect', 'pharo.inlineResult.copy', 'pharo.inlineResult.insert'] };
	markdown.appendCodeblock(shown.result, 'pharo');
	const uri = encodeURIComponent(JSON.stringify([shown.uri.toString()]));
	const inspect = encodeURIComponent(JSON.stringify([{ expression: shown.code, textDocumentURI: shown.uri, label: shown.code }]));
	markdown.appendMarkdown(
		`[$(search) Inspect](command:pharo.inspector.inspect?${inspect}) | ` +
		`[$(copy) Copy](command:pharo.inlineResult.copy?${uri}) | ` +
		`[$(insert) Insert](command:pharo.inlineResult.insert?${uri})`
	);
	return markdown;
}
