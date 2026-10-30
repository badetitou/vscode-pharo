import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { applyEdits, modify } from 'jsonc-parser';
import { parseJsoncObject } from '../jsonc';

// The MCP server of evref-BL/MCP, that the Pharo Language Server starts in the image and announces in the
// capabilities answered to initialize (experimental.mcp). Agents reach the image through it.

export const MCP_PROVIDER_ID = 'pharo-language-server.mcp';
export const CONFIGURE_AGENT_COMMAND = 'pharo.mcp.configureAgent';
/** The npm package that installs the guides, skills and MCP configuration of the agents, at the version of the MCP server of the image. */
export const PHARO_MCP_PACKAGE = '@evref-bl/pharo-mcp@3.1.0';
/** The name the MCP server gives itself (serverInfo.name), from which VS Code builds the names of its tools. */
const MCP_SERVER_NAME = 'MCP Pharo';

export interface McpEndpoint {
	url: string;
	protocolVersions: string[];
}

/** The endpoint announced in experimental.mcp, or undefined when the server does not run one. */
export function mcpEndpointFrom(experimental: unknown): McpEndpoint | undefined {
	if (!experimental || typeof experimental !== 'object') {
		return undefined;
	}
	const mcp = (experimental as Record<string, unknown>).mcp;
	if (!mcp || typeof mcp !== 'object') {
		return undefined;
	}
	const { url, protocolVersions } = mcp as Record<string, unknown>;
	if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
		return undefined;
	}
	const versions = Array.isArray(protocolVersions) ? protocolVersions.filter((each): each is string => typeof each === 'string') : [];
	return { url, protocolVersions: versions };
}

/** The initializationOptions of the language server: only sent to disable the MCP server, so that servers predating them still start. */
export function mcpInitializationOptions(enabled: boolean): { mcp: { enabled: false } } | undefined {
	return enabled ? undefined : { mcp: { enabled: false } };
}

/** Declares to VS Code the MCP server of the image of this window, so that Copilot sees its tools without configuration. */
export class PharoMcpServers implements vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition>, vscode.Disposable {
	private readonly changeEmitter = new vscode.EventEmitter<void>();
	readonly onDidChangeMcpServerDefinitions = this.changeEmitter.event;
	private current: { endpoint: McpEndpoint; imageName: string } | undefined;

	get endpoint(): McpEndpoint | undefined {
		return this.current?.endpoint;
	}

	/** Set the endpoint of the image when the server starts, or undefined when it stops. */
	setEndpoint(endpoint: McpEndpoint | undefined, imageName = ''): void {
		if (this.current?.endpoint.url === endpoint?.url) {
			return;
		}
		this.current = endpoint && { endpoint, imageName };
		this.changeEmitter.fire();
	}

	provideMcpServerDefinitions(): vscode.McpHttpServerDefinition[] {
		if (!this.current) {
			return [];
		}
		const label = this.current.imageName ? `Pharo (${this.current.imageName})` : 'Pharo';
		return [new vscode.McpHttpServerDefinition(label, vscode.Uri.parse(this.current.endpoint.url))];
	}

	resolveMcpServerDefinition(server: vscode.McpHttpServerDefinition): vscode.McpHttpServerDefinition {
		if (!this.current) {
			throw new Error('The Pharo image of this window does not run an MCP server.');
		}
		server.uri = vscode.Uri.parse(this.current.endpoint.url);
		return server;
	}

	dispose(): void {
		this.changeEmitter.dispose();
	}
}

/** Whether a tool of vscode.lm.tools comes from the MCP server of a Pharo image. */
export function isPharoMcpTool(name: string): boolean {
	return PHARO_MCP_TOOL_PREFIX.test(name);
}

/** The tool of the MCP server of the image named toolName (class_get, image_evaluate...), preferring the first server. */
export function findPharoMcpTool<T extends { name: string }>(tools: readonly T[], toolName: string): T | undefined {
	const candidates = tools.filter((tool) => isPharoMcpTool(tool.name) && tool.name.endsWith(`_${toolName}`));
	return candidates.sort((left, right) => left.name.length - right.name.length)[0];
}

/**
 * VS Code names the tools of an MCP server `mcp_<its name, sanitized and cut>_<tool>`, numbering the prefix of a
 * second server of the same name: mcp_mcp_pharo_class_get, then mcp_mcp_pharo2_class_get.
 */
const PHARO_MCP_TOOL_PREFIX = new RegExp(`^mcp_${MCP_SERVER_NAME.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').slice(0, 13)}\\d*_`);

// ---------------------------------------------------------------------------
// CLI agents: Claude Code, Codex and OpenCode read the MCP server from a configuration file of the workspace.
// The installer of @evref-bl/pharo-mcp writes it with port 4000; the image listens on a free port that changes
// at each start, so the extension keeps the url of the `pharo` entry up to date.

export const AGENT_HOSTS = {
	claude: { label: 'Claude Code', configuration: '.mcp.json' },
	codex: { label: 'Codex', configuration: path.join('.codex', 'config.toml') },
	opencode: { label: 'OpenCode', configuration: 'opencode.json' }
} as const;
export type AgentHost = keyof typeof AGENT_HOSTS;

const JSON_URL_PATHS: Record<Exclude<AgentHost, 'codex'>, string[]> = {
	claude: ['mcpServers', 'pharo', 'url'],
	opencode: ['mcp', 'pharo', 'url']
};
const CODEX_SECTION = '[mcp_servers.pharo]';

/** The url of the `pharo` MCP server in the configuration of an agent, or undefined when it has none. */
export function pharoMcpUrlIn(host: AgentHost, content: string): string | undefined {
	if (host === 'codex') {
		const section = codexPharoSection(content);
		const url = section && /^\s*url\s*=\s*"([^"]*)"/m.exec(content.slice(section.start, section.end));
		return url ? url[1] : undefined;
	}
	let value: unknown = parseJsoncObject(content, AGENT_HOSTS[host].configuration);
	for (const key of JSON_URL_PATHS[host]) {
		value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
	}
	return typeof value === 'string' ? value : undefined;
}

/** The configuration of an agent with its `pharo` MCP server at url, added when missing, the rest kept as written. */
export function withPharoMcpUrl(host: AgentHost, content: string, url: string): string {
	if (host === 'codex') {
		const section = codexPharoSection(content);
		if (!section) {
			const separator = content.length === 0 || content.endsWith('\n\n') ? '' : content.endsWith('\n') ? '\n' : '\n\n';
			return `${content}${separator}${CODEX_SECTION}\nenabled = true\nurl = "${url}"\n`;
		}
		const body = content.slice(section.start, section.end);
		const updated = /^\s*url\s*=.*$/m.test(body)
			? body.replace(/^(\s*)url\s*=.*$/m, `$1url = "${url}"`)
			: `\nurl = "${url}"${body}`;
		return content.slice(0, section.start) + updated + content.slice(section.end);
	}
	const entryPath = JSON_URL_PATHS[host];
	const exists = pharoMcpUrlIn(host, content || '{}') !== undefined;
	const value = exists ? url : host === 'claude' ? { type: 'http', url } : { type: 'remote', url, enabled: true };
	const target = exists ? entryPath : entryPath.slice(0, -1);
	const source = content.trim().length > 0 ? content : '{}\n';
	return applyEdits(source, modify(source, target, value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
}

/** Whether the configured url names an MCP server of this machine, which the extension may move to the port of the image. */
export function isLocalMcpUrl(url: string): boolean {
	return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(url);
}

/** The text after the `[mcp_servers.pharo]` line, up to the next table. */
function codexPharoSection(content: string): { start: number; end: number } | undefined {
	const header = /^\[mcp_servers\.pharo\]\s*$/m.exec(content);
	if (!header) {
		return undefined;
	}
	const start = header.index + header[0].length;
	const next = /^\[/m.exec(content.slice(start));
	return { start, end: next ? start + next.index : content.length };
}

/**
 * Point the `pharo` MCP server of the agents configured in these folders at url, when it names a server of this machine.
 * Answer the files changed.
 */
export function updateAgentConfigurations(folders: readonly string[], url: string, log: (message: string) => void): string[] {
	const changed: string[] = [];
	for (const folder of folders) {
		for (const host of Object.keys(AGENT_HOSTS) as AgentHost[]) {
			const file = path.join(folder, AGENT_HOSTS[host].configuration);
			try {
				if (!fs.existsSync(file)) {
					continue;
				}
				const content = fs.readFileSync(file, 'utf8');
				const current = pharoMcpUrlIn(host, content);
				if (current === undefined || current === url || !isLocalMcpUrl(current)) {
					continue;
				}
				fs.writeFileSync(file, withPharoMcpUrl(host, content, url));
				changed.push(file);
			} catch (error) {
				log(`Unable to update the Pharo MCP server in ${file}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
	return changed;
}

/** Run the installer of @evref-bl/pharo-mcp: guides, skills and MCP configuration of the agent. */
function runInstaller(host: AgentHost, cwd: string, log: (message: string) => void): Promise<void> {
	const args = ['--yes', PHARO_MCP_PACKAGE, 'install', '--host', host];
	log(`Running npx ${args.join(' ')} in ${cwd}`);
	return new Promise((resolve, reject) => {
		child_process.execFile('npx', args, { cwd, shell: process.platform === 'win32' }, (error, stdout, stderr) => {
			if (stdout) {
				log(stdout.trimEnd());
			}
			if (stderr) {
				log(stderr.trimEnd());
			}
			if (error) {
				reject(new Error(stderr.trim() || error.message));
			} else {
				resolve();
			}
		});
	});
}

export interface ConfigureAgentDependencies {
	getEndpoint: () => McpEndpoint | undefined;
	outputChannel: vscode.OutputChannel;
}

/** Pharo: Configure a CLI Agent. Install the guidance of the agent in the workspace, and point it at the MCP server of the image. */
export function registerConfigureAgentCommand(dependencies: ConfigureAgentDependencies): vscode.Disposable {
	const log = (message: string) => dependencies.outputChannel.appendLine(message);
	return vscode.commands.registerCommand(CONFIGURE_AGENT_COMMAND, async (requestedHost?: AgentHost) => {
		const endpoint = dependencies.getEndpoint();
		if (!endpoint) {
			void vscode.window.showErrorMessage('The Pharo image does not run an MCP server: start the Pharo Language Server, with pharo.mcp.enabled set.');
			return;
		}
		const host = requestedHost ?? (await vscode.window.showQuickPick(
			(Object.keys(AGENT_HOSTS) as AgentHost[]).map((each) => ({ label: AGENT_HOSTS[each].label, description: AGENT_HOSTS[each].configuration, host: each })),
			{ placeHolder: 'Agent to connect to the Pharo image' }
		))?.host;
		if (!host) {
			return;
		}
		const folder = await pickFileFolder();
		if (!folder) {
			return;
		}
		const file = path.join(folder.uri.fsPath, AGENT_HOSTS[host].configuration);
		try {
			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: `Configuring ${AGENT_HOSTS[host].label} for the Pharo image` },
				async () => {
					// The installer refuses to replace a configuration that is not its own: once written, only its url changes.
					if (!fs.existsSync(file)) {
						await runInstaller(host, folder.uri.fsPath, log);
					}
					const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
					fs.mkdirSync(path.dirname(file), { recursive: true });
					fs.writeFileSync(file, withPharoMcpUrl(host, content, endpoint.url));
				}
			);
		} catch (error) {
			log(`Unable to configure ${AGENT_HOSTS[host].label}: ${error instanceof Error ? error.message : String(error)}`);
			void vscode.window.showErrorMessage(`Unable to configure ${AGENT_HOSTS[host].label}: ${error instanceof Error ? error.message : String(error)}`, 'Show Output')
				.then((selection) => selection && dependencies.outputChannel.show(true));
			return;
		}
		log(`${AGENT_HOSTS[host].label} uses the MCP server of the image at ${endpoint.url} (${file}).`);
		const open = 'Open Configuration';
		const selection = await vscode.window.showInformationMessage(
			`${AGENT_HOSTS[host].label} is connected to the Pharo image. The extension updates its port at each start of the image.`,
			open
		);
		if (selection === open) {
			await vscode.window.showTextDocument(vscode.Uri.file(file));
		}
	});
}

async function pickFileFolder(): Promise<vscode.WorkspaceFolder | undefined> {
	const folders = (vscode.workspace.workspaceFolders ?? []).filter((folder) => folder.uri.scheme === 'file');
	if (folders.length === 0) {
		void vscode.window.showErrorMessage('Open a folder to configure an agent in it.');
		return undefined;
	}
	if (folders.length === 1) {
		return folders[0];
	}
	return (await vscode.window.showQuickPick(
		folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
		{ placeHolder: 'Folder in which the agent runs' }
	))?.folder;
}
