import * as vscode from 'vscode';

// The tools and the questions of the image shown by VS Code. When the extension announces it in its initialization
// options, the language server registers tools (Smalltalk tools) and a UI manager that send here what Pharo would show
// in a window nobody sees: `anObject inspect` opens the Inspector view, `aClass browse` the editor of the class
// (window/showDocument), `UIManager default confirm:` a modal dialog, `request:` an input box, `chooseFrom:` a Quick
// Pick, and the jobs of the image the progress of VS Code (window/workDoneProgress, handled by the language client).
// See docs/ui.md.

/** Initialization options that ask the language server to show its tools and questions in VS Code. */
export const UI_INITIALIZATION_OPTIONS = { ui: { version: 1 } };

/** `pls-ui/confirm`: answer true, false, or null when dismissed. */
export interface ConfirmParams {
	message: string;
	title?: string;
	trueChoice?: string;
	falseChoice?: string;
	cancelChoice?: string;
}

/** `pls-ui/request`: answer the text, or null when cancelled. */
export interface RequestParams {
	message?: string;
	title?: string;
	initialAnswer?: string;
	password?: boolean;
	multiline?: boolean;
}

/** `pls-ui/choose`: answer `{ index }` (zero-based), `{ text }` when other answers are allowed, or null. */
export interface ChooseParams {
	items: string[];
	message?: string;
	title?: string;
	allowOther?: boolean;
}

/** `pls-ui/chooseFile`: answer the path of the file or directory, or null. */
export interface ChooseFileParams {
	title?: string;
	path?: string;
	directory?: boolean;
	save?: boolean;
	extensions?: string[];
}

/** `pls-ui/inspect` (notification): a reference the Inspector view takes over. */
export interface InspectParams {
	ref: string;
	label?: string;
}

export type ChooseAnswer = { index: number } | { text: string } | null;

/** What the questions need of VS Code; the tests give their own. */
export interface UiHost {
	/** A modal dialog; answer the chosen item, or undefined when closed. */
	showModal(message: string, detail: string | undefined, items: vscode.MessageItem[]): Thenable<vscode.MessageItem | undefined>;
	showInputBox(options: vscode.InputBoxOptions): Thenable<string | undefined>;
	/** Let the user edit a text of several lines; answer it, or undefined when cancelled. */
	editText(prompt: string, text: string): Thenable<string | undefined>;
	pick(items: string[], options: { title?: string; placeHolder?: string; allowOther: boolean }): Thenable<ChooseAnswer>;
	showOpenDialog(options: vscode.OpenDialogOptions): Thenable<vscode.Uri[] | undefined>;
	showSaveDialog(options: vscode.SaveDialogOptions): Thenable<vscode.Uri | undefined>;
	executeCommand(command: string, ...args: unknown[]): Thenable<unknown>;
}

/** The requests of the language server to the extension. */
export interface UiTransport {
	onRequest(method: string, handler: (params: never) => unknown): vscode.Disposable;
	onNotification(method: string, handler: (params: never) => void): vscode.Disposable;
}

export async function confirm(host: UiHost, params: ConfirmParams): Promise<boolean | null> {
	const yes: vscode.MessageItem = { title: params.trueChoice || 'Yes' };
	const no: vscode.MessageItem = { title: params.falseChoice || 'No' };
	const items = [yes, no];
	// The dialog has its own Cancel button; a cancel choice of another name replaces it
	if (params.cancelChoice && params.cancelChoice !== 'Cancel') {
		items.push({ title: params.cancelChoice, isCloseAffordance: true });
	}
	const chosen = params.title
		? await host.showModal(params.title, params.message, items)
		: await host.showModal(params.message, undefined, items);
	return chosen === yes ? true : chosen === no ? false : null;
}

export async function request(host: UiHost, params: RequestParams): Promise<string | null> {
	const prompt = [params.title, params.message].filter((each) => each).join(': ');
	if (params.multiline) {
		return (await host.editText(prompt, params.initialAnswer ?? '')) ?? null;
	}
	const answer = await host.showInputBox({
		title: params.title,
		prompt: params.message,
		value: params.initialAnswer ?? '',
		password: params.password === true,
		ignoreFocusOut: true
	});
	return answer ?? null;
}

export async function choose(host: UiHost, params: ChooseParams): Promise<ChooseAnswer> {
	const answer = await host.pick(params.items ?? [], {
		title: params.title,
		placeHolder: params.message,
		allowOther: params.allowOther === true
	});
	return answer ?? null;
}

export async function chooseFile(host: UiHost, params: ChooseFileParams): Promise<string | null> {
	const defaultUri = params.path ? vscode.Uri.file(params.path) : undefined;
	const filters = params.extensions?.length ? { Files: params.extensions } : undefined;
	if (params.save) {
		const uri = await host.showSaveDialog({ title: params.title, defaultUri, filters });
		return uri?.fsPath ?? null;
	}
	const uris = await host.showOpenDialog({
		title: params.title,
		defaultUri,
		filters: params.directory ? undefined : filters,
		canSelectFiles: !params.directory,
		canSelectFolders: params.directory === true,
		canSelectMany: false
	});
	return uris?.[0]?.fsPath ?? null;
}

export async function inspect(host: UiHost, params: InspectParams): Promise<void> {
	if (typeof params?.ref === 'string') {
		await host.executeCommand('pharo.inspector.inspect', { ref: params.ref, label: params.label ?? undefined });
	}
}

/** Answer the requests and notifications of the language server about its tools and questions. */
export function registerImageUi(transport: UiTransport, host: UiHost = vscodeUiHost, log?: (message: string) => void): vscode.Disposable {
	const report = (method: string) => (error: unknown) => {
		log?.(`${method} failed: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	};
	return vscode.Disposable.from(
		transport.onRequest('pls-ui/confirm', (params: ConfirmParams) => confirm(host, params).catch(report('pls-ui/confirm'))),
		transport.onRequest('pls-ui/request', (params: RequestParams) => request(host, params).catch(report('pls-ui/request'))),
		transport.onRequest('pls-ui/choose', (params: ChooseParams) => choose(host, params).catch(report('pls-ui/choose'))),
		transport.onRequest('pls-ui/chooseFile', (params: ChooseFileParams) => chooseFile(host, params).catch(report('pls-ui/chooseFile'))),
		transport.onNotification('pls-ui/inspect', (params: InspectParams) => void inspect(host, params).catch(report('pls-ui/inspect')))
	);
}

/** Let the user edit a text in an untitled editor, accepted or cancelled from a notification. */
async function editText(prompt: string, text: string): Promise<string | undefined> {
	const document = await vscode.workspace.openTextDocument({ content: text });
	await vscode.window.showTextDocument(document, { preview: false });
	const choice = await vscode.window.showInformationMessage(
		`${prompt || 'Pharo asks for a text'}: edit it in the editor, then accept it.`, 'Accept', 'Cancel');
	const answer = choice === 'Accept' ? document.getText() : undefined;
	const editor = vscode.window.visibleTextEditors.find((each) => each.document === document);
	if (editor) {
		await vscode.window.showTextDocument(document, editor.viewColumn);
		await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
	}
	return answer;
}

/** A Quick Pick that also accepts a text of the user when allowOther is set. */
function pick(items: string[], options: { title?: string; placeHolder?: string; allowOther: boolean }): Promise<ChooseAnswer> {
	return new Promise((resolve) => {
		const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { index: number }>();
		quickPick.title = options.title;
		quickPick.placeholder = options.placeHolder;
		quickPick.ignoreFocusOut = true;
		quickPick.items = items.map((label, index) => ({ label, index }));
		let answer: ChooseAnswer = null;
		quickPick.onDidAccept(() => {
			const selected = quickPick.selectedItems[0];
			if (selected) {
				answer = { index: selected.index };
			} else if (options.allowOther && quickPick.value) {
				answer = { text: quickPick.value };
			} else {
				return;
			}
			quickPick.hide();
		});
		quickPick.onDidHide(() => {
			quickPick.dispose();
			resolve(answer);
		});
		quickPick.show();
	});
}

export const vscodeUiHost: UiHost = {
	showModal: (message, detail, items) => vscode.window.showInformationMessage(message, { modal: true, detail }, ...items),
	showInputBox: (options) => vscode.window.showInputBox(options),
	editText,
	pick,
	showOpenDialog: (options) => vscode.window.showOpenDialog(options),
	showSaveDialog: (options) => vscode.window.showSaveDialog(options),
	executeCommand: (command, ...args) => vscode.commands.executeCommand(command, ...args)
};
