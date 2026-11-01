import * as vscode from 'vscode';
import {
	PLAYGROUND_SCHEME,
	PlaygroundFileSystem,
	evaluationRangeOf,
	pageLabelOf,
	paragraphsOf,
	transcriptText
} from './playgroundPages';

/** What the playground needs from the language client, so that tests can use a fake server. */
export interface PlaygroundServer {
	sendRequest(method: string, params: unknown): Promise<unknown>;
	onNotification(method: string, handler: (params: { text?: unknown }) => void): vscode.Disposable;
}

/** What the server offers to the playground (experimental capability `pls-playground`). */
export interface PlaygroundFeatures {
	/** The server sends the Transcript in pls/transcript notifications. */
	transcript: boolean;
	/** pls:resetBindings forgets the variables of a page. */
	resetBindings: boolean;
	/** pls:inspectIt binds the result to the variable `it` of the page. */
	inspectIt: boolean;
}

export function playgroundFeaturesFrom(experimental: unknown): PlaygroundFeatures {
	const playground = (experimental as { 'pls-playground'?: Record<string, unknown> } | undefined)?.['pls-playground'];
	return {
		transcript: playground?.transcript === true,
		resetBindings: playground?.resetBindings === true,
		inspectIt: playground?.inspectIt === true
	};
}

type Evaluation = 'doIt' | 'printIt' | 'inspectIt';

const DEBUG = 'Debug';
const NEW_PAGE = 'New Page';

/**
 * The playground of the active image: pages `pharo-playground:` evaluated in the image, whose variables survive between
 * evaluations and show in the Variables view, and the Transcript of the image in an output channel.
 * The pages are registered at activation, so that VS Code reopens them; the evaluations wait for the server.
 */
export class Playground implements vscode.Disposable {
	private server: PlaygroundServer | undefined;
	private features: PlaygroundFeatures = { transcript: false, resetBindings: false, inspectIt: false };
	private refreshVariables: () => void = () => undefined;
	private evaluating = 0;
	private readonly transcript: vscode.OutputChannel;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(private readonly pages: PlaygroundFileSystem, private readonly debugDirectory: vscode.Uri) {
		this.transcript = vscode.window.createOutputChannel('Pharo Transcript', 'pharo');
		this.disposables.push(this.transcript);
	}

	/** Register the pages, their lenses and the commands of the playground. */
	register(): void {
		this.disposables.push(
			vscode.workspace.registerFileSystemProvider(PLAYGROUND_SCHEME, this.pages),
			vscode.languages.registerCodeLensProvider({ scheme: PLAYGROUND_SCHEME }, { provideCodeLenses: (document) => this.codeLenses(document) }),
			vscode.commands.registerCommand('pharo.playground.new', () => this.newPage()),
			vscode.commands.registerCommand('pharo.playground.open', () => this.openPage()),
			vscode.commands.registerCommand('pharo.playground.doIt', (uri?: vscode.Uri, range?: vscode.Range) => this.evaluate('doIt', uri, range)),
			vscode.commands.registerCommand('pharo.playground.printIt', (uri?: vscode.Uri, range?: vscode.Range) => this.evaluate('printIt', uri, range)),
			vscode.commands.registerCommand('pharo.playground.inspectIt', (uri?: vscode.Uri, range?: vscode.Range) => this.evaluate('inspectIt', uri, range)),
			vscode.commands.registerCommand('pharo.playground.resetBindings', (uri?: vscode.Uri) => this.resetBindings(uri)),
			vscode.commands.registerCommand('pharo.transcript.show', () => this.transcript.show()),
			// The Variables view shows the variables of the active editor
			vscode.window.onDidChangeActiveTextEditor(() => this.refreshVariables())
		);
	}

	/** Evaluate the pages in the image of a started server. */
	attach(server: PlaygroundServer, features: PlaygroundFeatures, refreshVariables: () => void): void {
		this.server = server;
		this.features = features;
		this.refreshVariables = refreshVariables;
		void vscode.commands.executeCommand('setContext', 'pharo.playground.resetBindings', features.resetBindings);
		if (features.transcript) {
			this.disposables.push(server.onNotification('pls/transcript', (params) => this.showOnTranscript(params.text)));
		}
	}

	dispose(): void {
		this.disposables.forEach((disposable) => disposable.dispose());
	}

	/** Answer the lenses of a page: Do it, Print it and Inspect it on each paragraph. */
	codeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		return paragraphsOf(document).flatMap((range) => [
			new vscode.CodeLens(range, { title: '$(play) Do it', command: 'pharo.playground.doIt', arguments: [document.uri, range] }),
			new vscode.CodeLens(range, { title: 'Print it', command: 'pharo.playground.printIt', arguments: [document.uri, range] }),
			new vscode.CodeLens(range, { title: 'Inspect it', command: 'pharo.playground.inspectIt', arguments: [document.uri, range] })
		]);
	}

	async newPage(): Promise<void> {
		try {
			const uri = await this.pages.newPage();
			await vscode.window.showTextDocument(uri, { preview: false });
		} catch (error) {
			void vscode.window.showErrorMessage(`Unable to create a playground page: ${messageOf(error)}`);
		}
	}

	/** Reopen a page of the image, the most recent first, or delete one. */
	async openPage(): Promise<void> {
		const pages = await this.pages.pages();
		const deleteButton: vscode.QuickInputButton = { iconPath: new vscode.ThemeIcon('trash'), tooltip: 'Delete Page' };
		type PageItem = vscode.QuickPickItem & { uri?: vscode.Uri };
		const items = async (): Promise<PageItem[]> => [
			{ label: `$(add) ${NEW_PAGE}` },
			...await Promise.all(pages.map(async ({ uri, mtime }) => ({
				label: pageLabelOf(uri),
				description: new Date(mtime).toLocaleString(),
				detail: await this.firstLineOf(uri),
				buttons: [deleteButton],
				uri
			})))
		];
		const quickPick = vscode.window.createQuickPick<PageItem>();
		quickPick.title = 'Playground Pages';
		quickPick.placeholder = 'Open a playground page of the image';
		quickPick.matchOnDetail = true;
		quickPick.items = await items();
		quickPick.onDidTriggerItemButton(async ({ item }) => {
			if (!item.uri) {
				return;
			}
			await vscode.workspace.fs.delete(item.uri);
			pages.splice(pages.findIndex(({ uri }) => uri.toString() === item.uri?.toString()), 1);
			quickPick.items = await items();
		});
		quickPick.onDidAccept(() => {
			const [item] = quickPick.selectedItems;
			quickPick.hide();
			if (item?.uri) {
				void vscode.window.showTextDocument(item.uri, { preview: false });
			} else if (item) {
				void this.newPage();
			}
		});
		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	}

	/**
	 * Evaluate a range of a page, or the selection of the active editor, or else the line of its cursor.
	 * Print it writes the result after the code, selected so that typing replaces it; Inspect it binds it to `it` and
	 * shows the Variables view. An error offers to debug the code.
	 */
	async evaluate(evaluation: Evaluation, uri?: vscode.Uri, range?: vscode.Range): Promise<void> {
		const editor = uri ? await vscode.window.showTextDocument(uri, { preserveFocus: true, preview: false }) : vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const document = editor.document;
		const target = range ?? evaluationRangeOf(document, editor.selection);
		const code = document.getText(target);
		if (code.trim().length === 0) {
			return;
		}
		const server = this.requireServer();
		if (!server) {
			return;
		}
		const method = evaluation === 'inspectIt' && this.features.inspectIt ? 'pls:inspectIt' : 'command:printIt';
		this.evaluating++;
		let result: string;
		try {
			result = String(await server.sendRequest(method, { line: code, textDocumentURI: document.uri }));
		} catch (error) {
			void this.offerToDebug(document.uri, code, messageOf(error));
			return;
		} finally {
			this.evaluating--;
			this.refreshVariables();
		}
		if (evaluation === 'printIt') {
			const printed = ` "${result.replace(/"/g, '""')}"`;
			const inserted = await editor.edit((builder) => builder.insert(target.end, printed));
			if (inserted) {
				editor.selection = new vscode.Selection(target.end, target.end.translate(0, printed.length));
			}
		} else if (evaluation === 'inspectIt') {
			if (this.features.inspectIt) {
				void vscode.commands.executeCommand('pharoBindingView.focus');
				vscode.window.setStatusBarMessage(`it := ${result}`, 5000);
			} else {
				void vscode.window.showInformationMessage(result);
			}
		}
	}

	/** Forget the variables of a page, or of the active editor. */
	async resetBindings(uri?: vscode.Uri): Promise<void> {
		const target = uri ?? vscode.window.activeTextEditor?.document.uri;
		const server = this.requireServer();
		if (!target || !server) {
			return;
		}
		try {
			await server.sendRequest('pls:resetBindings', { textDocument: { uri: target } });
		} catch (error) {
			void vscode.window.showErrorMessage(`Unable to reset the variables: ${messageOf(error)}`);
		}
		this.refreshVariables();
	}

	/** Append an entry of the Transcript, and show the Transcript when an evaluation writes on it. */
	showOnTranscript(text: unknown): void {
		if (typeof text !== 'string') {
			return;
		}
		this.transcript.append(transcriptText(text));
		if (this.evaluating > 0) {
			this.transcript.show(true);
		}
	}

	private requireServer(): PlaygroundServer | undefined {
		if (!this.server) {
			void vscode.window.showErrorMessage('The Pharo Language Server is not started.');
		}
		return this.server;
	}

	/** Report an error of evaluation, and debug the code in the debugger of the image when asked. */
	private async offerToDebug(page: vscode.Uri, code: string, message: string): Promise<void> {
		const label = page.scheme === PLAYGROUND_SCHEME ? pageLabelOf(page) : page.path.split('/').pop();
		if (await vscode.window.showErrorMessage(`${label}: ${message}`, DEBUG) !== DEBUG) {
			return;
		}
		// The debug adapter launches a file: the code is debugged without the variables of the page
		const program = vscode.Uri.joinPath(this.debugDirectory, `${label}.st`);
		await vscode.workspace.fs.writeFile(program, new TextEncoder().encode(code));
		await vscode.debug.startDebugging(undefined, {
			type: 'pharodb',
			name: `Debug ${label}`,
			request: 'launch',
			program: program.fsPath
		});
	}

	private async firstLineOf(uri: vscode.Uri): Promise<string> {
		try {
			const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
			return text.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? '';
		} catch {
			return '';
		}
	}
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
