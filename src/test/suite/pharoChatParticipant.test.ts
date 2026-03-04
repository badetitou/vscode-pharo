import * as assert from 'assert';
import * as vscode from 'vscode';
import { getPharoChatTools, parseJsonIfPossible, parseKeyValuePrompt, toolInfoToChatTool, trimCodeFence } from '../../ai/pharoChatParticipant';

suite('Pharo chat participant helpers', () => {
	test('trimCodeFence returns trimmed when no fence', () => {
		assert.strictEqual(trimCodeFence('  1 + 2  '), '1 + 2');
	});

	test('trimCodeFence removes triple backticks and optional language', () => {
		const input = '```smalltalk\n1 + 2\n```';
		assert.strictEqual(trimCodeFence(input), '1 + 2');
	});

	test('parseKeyValuePrompt parses simple key=value tokens', () => {
		assert.deepStrictEqual(parseKeyValuePrompt('packageName=MyPkg className=MyClass'), {
			packageName: 'MyPkg',
			className: 'MyClass',
		});
	});

	test('parseJsonIfPossible parses JSON object or returns undefined', () => {
		assert.deepStrictEqual(parseJsonIfPossible('{"a":1}'), { a: 1 });
		assert.strictEqual(parseJsonIfPossible('not json'), undefined);
	});

	test('toolInfoToChatTool maps tool information', () => {
		const info = {
			name: 'pharo-eval',
			description: 'Execute code',
			inputSchema: { type: 'object' },
			tags: ['pharo']
		} satisfies vscode.LanguageModelToolInformation;

		assert.deepStrictEqual(toolInfoToChatTool(info), {
			name: 'pharo-eval',
			description: 'Execute code',
			inputSchema: { type: 'object' },
		});
	});

	test('getPharoChatTools filters only pharo-* tools', () => {
		const tools = [
			{ name: 'pharo-eval', description: 'A', inputSchema: undefined, tags: [] },
			{ name: 'pharo-create-class', description: 'B', inputSchema: { type: 'object' }, tags: [] },
			{ name: 'other.tool', description: 'C', inputSchema: undefined, tags: [] },
		] satisfies vscode.LanguageModelToolInformation[];

		const chatTools = getPharoChatTools(tools);
		assert.deepStrictEqual(chatTools.map(t => t.name), ['pharo-eval', 'pharo-create-class']);
	});
});
