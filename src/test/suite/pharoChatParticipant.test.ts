import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getPharoChatTools, parseJsonIfPossible, parseKeyValuePrompt, pharoToolCall, toolInfoToChatTool, trimCodeFence } from '../../ai/pharoChatParticipant';
import { computeUnifiedDiff } from '../../ai/pharoLmTools';

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
		const tools = [{ name: 'mcp_mcp_pharo_class_create' }, { name: 'mcp_mcp_pharo_test_run' }, { name: 'mcp_mcp_pharo_package_search' }];

		assert.deepStrictEqual(
			pharoToolCall('pharo-create-class', { packageName: 'P', className: 'C', superclassName: 'Object', instanceVariables: 'a  b' }, tools),
			{ name: 'mcp_mcp_pharo_class_create', input: { name: 'C', package: 'P', superclass: 'Object', slots: ['a', 'b'] } }
		);
		assert.deepStrictEqual(
			pharoToolCall('pharo-run-test-method', { className: 'CTest', testMethod: 'testA' }, tools),
			{ name: 'mcp_mcp_pharo_test_run', input: { methods: ['CTest>>#testA'] } }
		);
		assert.deepStrictEqual(pharoToolCall('pharo-list-packages', {}, tools), { name: 'mcp_mcp_pharo_package_search', input: {} });
		assert.deepStrictEqual(pharoToolCall('pharo-create-package', { packageName: 'P' }, tools), { name: 'pharo-create-package', input: { packageName: 'P' } });
	});

	test('pharoToolCall answers no tool for a removed tool when the image does not run the MCP server', () => {
		assert.strictEqual(pharoToolCall('pharo-eval', { code: '1' }, []), undefined);
		assert.strictEqual(pharoToolCall('pharo-read-class', { className: 'C' }, [{ name: 'pharo-read-class' }]), undefined);
	});
});

suite('Pharo agent customizations', () => {
	const extension = vscode.extensions.getExtension('badetitou.pharo-language-server')!;
	const contributes = extension.packageJSON.contributes;

	test('each skill is named after its directory and describes when to use it', () => {
		const paths: string[] = contributes.chatSkills.map((skill: { path: string }) => skill.path);
		assert.deepStrictEqual(paths.map((skillPath) => path.basename(path.dirname(skillPath))), ['pharo-live-image', 'pharo-verify', 'pharo-iceberg']);
		for (const skillPath of paths) {
			const frontmatter = frontmatterOf(path.join(extension.extensionPath, skillPath));
			assert.strictEqual(frontmatter.name, path.basename(path.dirname(skillPath)), skillPath);
			assert.ok(frontmatter.description && frontmatter.description.length <= 1024, skillPath);
		}
	});

	test('the Pharo agent has a description', () => {
		const [agent] = contributes.chatAgents;
		assert.strictEqual(frontmatterOf(path.join(extension.extensionPath, agent.path)).name, 'Pharo');
	});

	test('no Language Model Tool duplicates a tool of the MCP server', () => {
		assert.deepStrictEqual(
			contributes.languageModelTools.map((tool: { name: string }) => tool.name),
			['pharo-create-package', 'pharo-ice-list-changes', 'pharo-ice-show-diff']
		);
	});
});

suite('Iceberg diff of the Language Model Tools', () => {
	test('computeUnifiedDiff answers a unified diff with the changed lines', () => {
		const diff = computeUnifiedDiff('a\nb\nc\n', 'a\nB\nc\n', 'original', 'modified');
		assert.ok(diff.includes('--- original'), diff);
		assert.ok(diff.includes('+++ modified'), diff);
		assert.ok(diff.includes('-b\n+B'), diff);
	});

	test('computeUnifiedDiff says when nothing changed', () => {
		assert.strictEqual(computeUnifiedDiff('a', 'a', 'original', 'modified'), '(no changes)');
	});

	test('computeUnifiedDiff stays fast on large sources', () => {
		const original = Array.from({ length: 20000 }, (_, i) => `line ${i}`).join('\n');
		const modified = original.replace('line 10000', 'changed');
		const start = Date.now();
		computeUnifiedDiff(original, modified, 'original', 'modified');
		assert.ok(Date.now() - start < 2000, `took ${Date.now() - start} ms`);
	});
});

/** The keys of the YAML frontmatter of a Markdown file whose values are on one line. */
function frontmatterOf(file: string): Record<string, string> {
	const match = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, 'utf8'));
	assert.ok(match, `${file} has no frontmatter`);
	const fields: Record<string, string> = {};
	for (const line of match[1].split('\n')) {
		const colon = line.indexOf(':');
		if (colon > 0) {
			fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
		}
	}
	return fields;
}
