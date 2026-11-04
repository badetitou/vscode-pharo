import * as assert from 'assert';
import * as vscode from 'vscode';
import { ChooseAnswer, UiHost, UiTransport, choose, chooseFile, confirm, inspect, registerImageUi, request } from '../../ui/imageUi';

/** A user who answers with what the test sets, and records what they were shown. */
class FakeUser implements UiHost {
	modal?: { message: string; detail: string | undefined; items: vscode.MessageItem[] };
	modalAnswer = (items: vscode.MessageItem[]): vscode.MessageItem | undefined => items[0];
	inputBox?: vscode.InputBoxOptions;
	inputAnswer: string | undefined = 'typed';
	edited?: { prompt: string; text: string };
	pickOptions?: { items: string[]; title?: string; placeHolder?: string; allowOther: boolean };
	pickAnswer: ChooseAnswer = { index: 1 };
	openOptions?: vscode.OpenDialogOptions;
	saveOptions?: vscode.SaveDialogOptions;
	readonly commands: { command: string; args: unknown[] }[] = [];

	async showModal(message: string, detail: string | undefined, items: vscode.MessageItem[]): Promise<vscode.MessageItem | undefined> {
		this.modal = { message, detail, items };
		return this.modalAnswer(items);
	}

	async showInputBox(options: vscode.InputBoxOptions): Promise<string | undefined> {
		this.inputBox = options;
		return this.inputAnswer;
	}

	async editText(prompt: string, text: string): Promise<string | undefined> {
		this.edited = { prompt, text };
		return `${text}\nmore`;
	}

	async pick(items: string[], options: { title?: string; placeHolder?: string; allowOther: boolean }): Promise<ChooseAnswer> {
		this.pickOptions = { items, ...options };
		return this.pickAnswer;
	}

	async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[] | undefined> {
		this.openOptions = options;
		return [vscode.Uri.file('/tmp/chosen')];
	}

	async showSaveDialog(options: vscode.SaveDialogOptions): Promise<vscode.Uri | undefined> {
		this.saveOptions = options;
		return vscode.Uri.file('/tmp/saved.st');
	}

	async executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
		this.commands.push({ command, args });
		return undefined;
	}
}

suite('Tools and questions of the image', () => {
	let user: FakeUser;

	setup(() => {
		user = new FakeUser();
	});

	test('confirms with the choices of Pharo', async () => {
		assert.strictEqual(await confirm(user, { message: 'Remove Foo?', title: 'Question', trueChoice: 'Remove', falseChoice: 'Keep' }), true);
		assert.strictEqual(user.modal?.message, 'Question');
		assert.strictEqual(user.modal?.detail, 'Remove Foo?');
		assert.deepStrictEqual(user.modal?.items.map((item) => item.title), ['Remove', 'Keep']);

		user.modalAnswer = (items) => items[1];
		assert.strictEqual(await confirm(user, { message: 'Sure?' }), false);
		assert.strictEqual(user.modal?.message, 'Sure?');
		assert.deepStrictEqual(user.modal?.items.map((item) => item.title), ['Yes', 'No']);
	});

	test('answers null when the dialog is closed, and names a cancel choice of its own', async () => {
		user.modalAnswer = () => undefined;
		assert.strictEqual(await confirm(user, { message: 'Sure?', cancelChoice: 'Cancel' }), null);
		assert.strictEqual(user.modal?.items.length, 2, 'the dialog has its own Cancel button');

		user.modalAnswer = (items) => items[2];
		assert.strictEqual(await confirm(user, { message: 'Save?', cancelChoice: 'Later' }), null);
		assert.strictEqual(user.modal?.items[2].isCloseAffordance, true);
	});

	test('requests a text in an input box', async () => {
		assert.strictEqual(await request(user, { message: 'Name of the class?', title: 'New class', initialAnswer: 'Foo' }), 'typed');
		assert.strictEqual(user.inputBox?.prompt, 'Name of the class?');
		assert.strictEqual(user.inputBox?.title, 'New class');
		assert.strictEqual(user.inputBox?.value, 'Foo');
		assert.strictEqual(user.inputBox?.password, false);

		await request(user, { message: 'Token?', password: true });
		assert.strictEqual(user.inputBox?.password, true);

		user.inputAnswer = undefined;
		assert.strictEqual(await request(user, { message: 'Name?' }), null);
	});

	test('requests a text of several lines in an editor', async () => {
		assert.strictEqual(await request(user, { message: 'Comment?', initialAnswer: 'A class', multiline: true }), 'A class\nmore');
		assert.deepStrictEqual(user.edited, { prompt: 'Comment?', text: 'A class' });
		assert.strictEqual(user.inputBox, undefined);
	});

	test('chooses in a Quick Pick', async () => {
		assert.deepStrictEqual(await choose(user, { items: ['one', 'two'], title: 'Pick', message: 'Which one?' }), { index: 1 });
		assert.deepStrictEqual(user.pickOptions, { items: ['one', 'two'], title: 'Pick', placeHolder: 'Which one?', allowOther: false });

		user.pickAnswer = { text: 'three' };
		assert.deepStrictEqual(await choose(user, { items: ['one'], allowOther: true }), { text: 'three' });
		assert.strictEqual(user.pickOptions?.allowOther, true);
	});

	test('chooses files and directories in the dialogs of VS Code', async () => {
		assert.strictEqual(await chooseFile(user, { title: 'Directory', directory: true, path: '/tmp' }), vscode.Uri.file('/tmp/chosen').fsPath);
		assert.strictEqual(user.openOptions?.canSelectFolders, true);
		assert.strictEqual(user.openOptions?.canSelectFiles, false);
		assert.strictEqual(user.openOptions?.defaultUri?.fsPath, vscode.Uri.file('/tmp').fsPath);

		assert.strictEqual(await chooseFile(user, { title: 'Save', save: true, extensions: ['st'] }), vscode.Uri.file('/tmp/saved.st').fsPath);
		assert.deepStrictEqual(user.saveOptions?.filters, { Files: ['st'] });
	});

	test('opens the Inspector view on the reference the image sends', async () => {
		await inspect(user, { ref: '12', label: 'an Array' });
		assert.deepStrictEqual(user.commands, [{ command: 'pharo.inspector.inspect', args: [{ ref: '12', label: 'an Array' }] }]);
	});

	test('answers the requests of the language server', async () => {
		const requests = new Map<string, (params: never) => unknown>();
		const notifications = new Map<string, (params: never) => void>();
		const transport: UiTransport = {
			onRequest: (method, handler) => {
				requests.set(method, handler);
				return new vscode.Disposable(() => requests.delete(method));
			},
			onNotification: (method, handler) => {
				notifications.set(method, handler);
				return new vscode.Disposable(() => notifications.delete(method));
			}
		};
		const logged: string[] = [];
		const registration = registerImageUi(transport, user, (message) => logged.push(message));

		assert.deepStrictEqual([...requests.keys()].sort(), ['pls-ui/choose', 'pls-ui/chooseFile', 'pls-ui/confirm', 'pls-ui/request']);
		assert.deepStrictEqual([...notifications.keys()], ['pls-ui/inspect']);
		assert.strictEqual(await requests.get('pls-ui/confirm')!({ message: 'Sure?' } as never), true);

		user.showInputBox = async () => {
			throw new Error('no input');
		};
		assert.strictEqual(await requests.get('pls-ui/request')!({ message: 'Name?' } as never), null);
		assert.deepStrictEqual(logged, ['pls-ui/request failed: no input']);

		registration.dispose();
		assert.strictEqual(requests.size + notifications.size, 0);
	});
});
