import * as assert from 'assert';
import * as vscode from 'vscode';
import { getPharoChatTools, parseJsonIfPossible, parseKeyValuePrompt, pharoToolCall, toolInfoToChatTool, trimCodeFence } from '../../ai/pharoChatParticipant';

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

	test('getPharoChatTools offers the tools of the MCP server of the image', () => {
		const tools = [
			{ name: 'mcp_mcp_pharo_class_get', description: 'A', inputSchema: undefined, tags: [] },
			{ name: 'pharo-create-package', description: 'B', inputSchema: undefined, tags: [] },
			{ name: 'mcp_github_search', description: 'C', inputSchema: undefined, tags: [] },
		] satisfies vscode.LanguageModelToolInformation[];

		assert.deepStrictEqual(getPharoChatTools(tools).map(t => t.name), ['mcp_mcp_pharo_class_get', 'pharo-create-package']);
	});

	test('pharoToolCall routes the slash commands to the MCP server when the image runs it', () => {
		const tools = [{ name: 'mcp_mcp_pharo_class_create' }, { name: 'mcp_mcp_pharo_test_run' }];

		assert.deepStrictEqual(
			pharoToolCall('pharo-create-class', { packageName: 'P', className: 'C', superclassName: 'Object', instanceVariables: 'a  b' }, tools),
			{ name: 'mcp_mcp_pharo_class_create', input: { name: 'C', package: 'P', superclass: 'Object', slots: ['a', 'b'] } }
		);
		assert.deepStrictEqual(
			pharoToolCall('pharo-run-test-method', { className: 'CTest', testMethod: 'testA' }, tools),
			{ name: 'mcp_mcp_pharo_test_run', input: { methods: ['CTest>>#testA'] } }
		);
		assert.deepStrictEqual(pharoToolCall('pharo-eval', { code: '1' }, tools), { name: 'pharo-eval', input: { code: '1' } });
		assert.deepStrictEqual(pharoToolCall('pharo-create-package', { packageName: 'P' }, tools), { name: 'pharo-create-package', input: { packageName: 'P' } });
	});
});
