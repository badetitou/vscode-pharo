import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	PharoMcpServers,
	findPharoMcpTool,
	isLocalMcpUrl,
	isPharoMcpTool,
	mcpEndpointFrom,
	mcpInitializationOptions,
	pharoMcpUrlIn,
	updateAgentConfigurations,
	withPharoMcpUrl
} from '../../ai/pharoMcp';

// The configurations that `npx @evref-bl/pharo-mcp install --host <host>` writes.
const CLAUDE_TEMPLATE = '{\n  "mcpServers": {\n    "pharo": {\n      "type": "http",\n      "url": "http://127.0.0.1:4000"\n    }\n  }\n}\n';
const CODEX_TEMPLATE = '[mcp_servers.pharo]\nenabled = true\nrequired = true\nurl = "http://127.0.0.1:4000"\n';
const OPENCODE_TEMPLATE = '{\n  "$schema": "https://opencode.ai/config.json",\n  "mcp": {\n    "pharo": {\n      "type": "remote",\n      "url": "http://127.0.0.1:4000",\n      "enabled": true\n    }\n  }\n}\n';
const URL = 'http://127.0.0.1:61408/';

suite('Pharo MCP server', () => {
	test('reads the endpoint announced in experimental.mcp', () => {
		assert.deepStrictEqual(
			mcpEndpointFrom({ 'pls-env': { version: 1 }, mcp: { url: URL, protocolVersions: ['2025-06-18', 3] } }),
			{ url: URL, protocolVersions: ['2025-06-18'] }
		);
		assert.strictEqual(mcpEndpointFrom({ 'pls-env': { version: 1 } }), undefined);
		assert.strictEqual(mcpEndpointFrom({ mcp: { url: 'file:///tmp' } }), undefined);
		assert.strictEqual(mcpEndpointFrom(undefined), undefined);
	});

	test('only sends initializationOptions to disable the MCP server', () => {
		assert.strictEqual(mcpInitializationOptions(true), undefined);
		assert.deepStrictEqual(mcpInitializationOptions(false), { mcp: { enabled: false } });
	});

	test('declares the server of the image, and tells VS Code when it changes', () => {
		const servers = new PharoMcpServers();
		let changes = 0;
		servers.onDidChangeMcpServerDefinitions(() => changes++);
		assert.deepStrictEqual(servers.provideMcpServerDefinitions(), []);

		servers.setEndpoint({ url: URL, protocolVersions: [] }, 'Moose64-12-PLS');
		const [definition] = servers.provideMcpServerDefinitions();
		assert.strictEqual(definition.label, 'Pharo (Moose64-12-PLS)');
		assert.strictEqual(definition.uri.toString(), URL);
		servers.setEndpoint({ url: URL, protocolVersions: [] }, 'Moose64-12-PLS');
		assert.strictEqual(changes, 1);

		servers.setEndpoint(undefined);
		assert.strictEqual(changes, 2);
		assert.deepStrictEqual(servers.provideMcpServerDefinitions(), []);
		assert.throws(() => servers.resolveMcpServerDefinition(definition), /does not run an MCP server/);
		servers.dispose();
	});

	test('recognizes the tools VS Code names after the server', () => {
		assert.ok(isPharoMcpTool('mcp_mcp_pharo_class_get'));
		assert.ok(isPharoMcpTool('mcp_mcp_pharo2_class_get'));
		assert.ok(!isPharoMcpTool('mcp_github_class_get'));
		assert.ok(!isPharoMcpTool('pharo-eval'));
		const tools = [{ name: 'mcp_mcp_pharo2_test_run' }, { name: 'mcp_mcp_pharo_test_run' }, { name: 'mcp_mcp_pharo_class_get' }];
		assert.strictEqual(findPharoMcpTool(tools, 'test_run')?.name, 'mcp_mcp_pharo_test_run');
		assert.strictEqual(findPharoMcpTool(tools, 'image_evaluate'), undefined);
	});
});

suite('Pharo MCP configuration of the CLI agents', () => {
	test('moves the pharo server of each agent to the port of the image', () => {
		const claude = withPharoMcpUrl('claude', CLAUDE_TEMPLATE, URL);
		assert.strictEqual(claude, CLAUDE_TEMPLATE.replace('http://127.0.0.1:4000', URL));
		assert.strictEqual(pharoMcpUrlIn('claude', claude), URL);

		const codex = withPharoMcpUrl('codex', CODEX_TEMPLATE, URL);
		assert.strictEqual(codex, CODEX_TEMPLATE.replace('http://127.0.0.1:4000', URL));
		assert.strictEqual(pharoMcpUrlIn('codex', codex), URL);

		const opencode = withPharoMcpUrl('opencode', OPENCODE_TEMPLATE, URL);
		assert.strictEqual(opencode, OPENCODE_TEMPLATE.replace('http://127.0.0.1:4000', URL));
		assert.strictEqual(pharoMcpUrlIn('opencode', opencode), URL);
	});

	test('adds the pharo server to a configuration that has other servers', () => {
		const claude = withPharoMcpUrl('claude', '{\n  // mine\n  "mcpServers": { "other": { "type": "http", "url": "http://example.com" } }\n}\n', URL);
		assert.match(claude, /\/\/ mine/);
		assert.strictEqual(pharoMcpUrlIn('claude', claude), URL);
		assert.strictEqual(pharoMcpUrlIn('claude', withPharoMcpUrl('claude', '', URL)), URL);

		const codex = withPharoMcpUrl('codex', 'model = "o3"\n\n[mcp_servers.other]\nurl = "http://example.com"\n', URL);
		assert.strictEqual(pharoMcpUrlIn('codex', codex), URL);
		assert.match(codex, /\[mcp_servers\.other\]\nurl = "http:\/\/example\.com"/);
		assert.strictEqual(pharoMcpUrlIn('codex', '[mcp_servers.pharo]\nenabled = true\n[other]\nurl = "x"\n'), undefined);
		assert.strictEqual(pharoMcpUrlIn('codex', withPharoMcpUrl('codex', '[mcp_servers.pharo]\nenabled = true\n[other]\nurl = "x"\n', URL)), URL);

		assert.strictEqual(pharoMcpUrlIn('opencode', withPharoMcpUrl('opencode', '{ "mcp": {} }', URL)), URL);
	});

	test('only moves servers of this machine', () => {
		assert.ok(isLocalMcpUrl('http://127.0.0.1:4000'));
		assert.ok(isLocalMcpUrl('http://localhost:4000/'));
		assert.ok(!isLocalMcpUrl('http://127.0.0.10:4000'));
		assert.ok(!isLocalMcpUrl('https://pharo.example.com/mcp'));
	});

	test('updates the configurations of the workspace that name the pharo server', () => {
		const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pharo-mcp-'));
		try {
			fs.writeFileSync(path.join(folder, '.mcp.json'), CLAUDE_TEMPLATE);
			fs.mkdirSync(path.join(folder, '.codex'));
			fs.writeFileSync(path.join(folder, '.codex', 'config.toml'), CODEX_TEMPLATE.replace('http://127.0.0.1:4000', 'https://pharo.example.com'));
			fs.writeFileSync(path.join(folder, 'opencode.json'), '{ "mcp": {} }');
			const messages: string[] = [];

			const changed = updateAgentConfigurations([folder], URL, (message) => messages.push(message));

			assert.deepStrictEqual(changed, [path.join(folder, '.mcp.json')]);
			assert.strictEqual(pharoMcpUrlIn('claude', fs.readFileSync(path.join(folder, '.mcp.json'), 'utf8')), URL);
			assert.strictEqual(fs.readFileSync(path.join(folder, 'opencode.json'), 'utf8'), '{ "mcp": {} }');
			assert.deepStrictEqual(updateAgentConfigurations([folder], URL, (message) => messages.push(message)), []);
			assert.deepStrictEqual(messages, []);
		} finally {
			fs.rmSync(folder, { recursive: true, force: true });
		}
	});
});
