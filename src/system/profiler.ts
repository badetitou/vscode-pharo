import * as vscode from 'vscode';
import { Profile, ProfileNode, expectProfile } from './systemContracts';
import { SystemRequest } from './processesView';

// Profile It: the image evaluates the code while its profiler samples it (pls-system:profile), and a webview shows the
// calls as a flame graph, the root on top, with the methods that cost the most. Clicking a call opens its method.

export const PROFILE_REQUEST = 'pls-system:profile';
const PANEL_TYPE = 'pharo.profile';

/** A method of a profile, with the samples spent in the method itself and in the calls under it. */
export interface HotMethod {
	label: string;
	uri?: string;
	selfSamples: number;
	samples: number;
}

/**
 * Answer the methods of a profile, the ones the most samples were spent in first. A recursive method counts its
 * samples once, at its outermost call.
 */
export function hotMethods(root: ProfileNode): HotMethod[] {
	const methods = new Map<string, HotMethod>();
	const visit = (node: ProfileNode, onPath: Set<string>) => {
		const method = methods.get(node.label) ?? { label: node.label, uri: node.uri, selfSamples: 0, samples: 0 };
		method.selfSamples += node.selfSamples;
		if (!onPath.has(node.label)) {
			method.samples += node.samples;
		}
		methods.set(node.label, method);
		const path = new Set(onPath).add(node.label);
		node.children.forEach((child) => visit(child, path));
	};
	root.children.forEach((child) => visit(child, new Set()));
	return [...methods.values()]
		.filter((method) => method.samples > 0)
		.sort((a, b) => b.selfSamples - a.selfSamples || b.samples - a.samples || a.label.localeCompare(b.label));
}

/** Answer the code to profile in an editor: its selection, or else the line of the cursor. */
export function codeToProfile(editor: Pick<vscode.TextEditor, 'document' | 'selection'>): string {
	const { document, selection } = editor;
	return (selection.isEmpty ? document.lineAt(selection.active.line).text : document.getText(selection)).trim();
}

export async function profile(code: string, document: vscode.Uri | undefined, request: SystemRequest): Promise<Profile> {
	return expectProfile(await request(PROFILE_REQUEST, { expression: code, textDocumentURI: document ?? null }), PROFILE_REQUEST);
}

export function registerProfiler(context: vscode.ExtensionContext, request: () => SystemRequest | undefined): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('pharo.profileIt', async () => {
			const editor = vscode.window.activeTextEditor;
			const server = request();
			if (!editor || !server) {
				return;
			}
			const code = codeToProfile(editor);
			if (code === '') {
				void vscode.window.showWarningMessage('Select the Pharo code to profile.');
				return;
			}
			try {
				const result = await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: 'Profiling in the image…' },
					() => profile(code, editor.document.uri, server)
				);
				showProfile(code, result);
			} catch (error) {
				void vscode.window.showErrorMessage(`Cannot profile: ${error instanceof Error ? error.message : String(error)}`);
			}
		})
	);
}

function showProfile(code: string, result: Profile): void {
	const title = `Profile: ${code.length > 40 ? `${code.slice(0, 40)}…` : code}`;
	const panel = vscode.window.createWebviewPanel(PANEL_TYPE, title, vscode.ViewColumn.Beside, { enableScripts: true });
	panel.iconPath = new vscode.ThemeIcon('flame');
	panel.webview.html = profileHtml(result, hotMethods(result.root), nonce());
	panel.webview.onDidReceiveMessage((message: { command?: string; uri?: unknown }) => {
		if (message.command === 'open' && typeof message.uri === 'string') {
			void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(message.uri), { viewColumn: vscode.ViewColumn.One });
		}
	});
}

function nonce(): string {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	return Array.from({ length: 32 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
}

/** Answer the page of a profile: a summary, the flame graph and the table of the hot methods. */
export function profileHtml(result: Profile, methods: HotMethod[], scriptNonce: string): string {
	// < is escaped so that a label cannot close the script
	const data = JSON.stringify({ profile: result, methods: methods.slice(0, 50) }).replace(/</g, '\\u003c');
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}';">
<style>
	body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 0 12px 12px; }
	h2 { font-size: 1.1em; margin: 16px 0 8px; }
	.summary { color: var(--vscode-descriptionForeground); margin-top: 12px; }
	.error { color: var(--vscode-errorForeground); }
	#flame { position: relative; width: 100%; }
	.frame { position: absolute; height: 18px; box-sizing: border-box; border: 1px solid var(--vscode-editor-background); overflow: hidden;
		white-space: nowrap; text-overflow: ellipsis; font-size: 11px; line-height: 16px; padding: 0 3px; cursor: default;
		background: var(--vscode-charts-orange); color: var(--vscode-editor-background); }
	.frame.link { cursor: pointer; }
	.frame.root { background: var(--vscode-charts-red); }
	.frame:hover { outline: 1px solid var(--vscode-focusBorder); z-index: 1; }
	table { border-collapse: collapse; width: 100%; }
	th, td { text-align: left; padding: 2px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
	td.number, th.number { text-align: right; font-variant-numeric: tabular-nums; }
	td a { color: var(--vscode-textLink-foreground); cursor: pointer; }
</style>
</head>
<body>
<div class="summary" id="summary"></div>
<h2>Calls</h2>
<div id="flame"></div>
<h2>Hot methods</h2>
<table><thead><tr><th>Method</th><th class="number">Self</th><th class="number">Total</th></tr></thead><tbody id="methods"></tbody></table>
<script nonce="${scriptNonce}">
	const vscode = acquireVsCodeApi();
	const { profile, methods } = ${data};
	const total = Math.max(profile.root.samples, 1);
	const percent = (samples) => (100 * samples / total).toFixed(1) + '%';
	const open = (uri) => vscode.postMessage({ command: 'open', uri });

	const summary = document.getElementById('summary');
	summary.textContent = profile.milliseconds + ' ms, ' + profile.samples + ' samples.';
	if (profile.error) {
		const error = document.createElement('div');
		error.className = 'error';
		error.textContent = 'The code signalled an error: ' + profile.error;
		summary.appendChild(error);
	}

	const flame = document.getElementById('flame');
	let depth = 0;
	const draw = (node, left, width, level) => {
		depth = Math.max(depth, level + 1);
		const frame = document.createElement('div');
		frame.className = 'frame' + (level === 0 ? ' root' : '') + (node.uri ? ' link' : '');
		frame.style.left = (left * 100) + '%';
		frame.style.width = (width * 100) + '%';
		frame.style.top = (level * 18) + 'px';
		frame.textContent = node.label;
		frame.title = node.label + '\\n' + node.samples + ' samples (' + percent(node.samples) + '), self ' + node.selfSamples;
		if (node.uri) {
			frame.addEventListener('click', () => open(node.uri));
		}
		flame.appendChild(frame);
		let childLeft = left;
		for (const child of node.children) {
			const childWidth = width * child.samples / Math.max(node.samples, 1);
			draw(child, childLeft, childWidth, level + 1);
			childLeft += childWidth;
		}
	};
	draw(profile.root, 0, 1, 0);
	flame.style.height = (depth * 18) + 'px';

	const body = document.getElementById('methods');
	for (const method of methods) {
		const row = document.createElement('tr');
		const name = document.createElement('td');
		if (method.uri) {
			const link = document.createElement('a');
			link.textContent = method.label;
			link.addEventListener('click', () => open(method.uri));
			name.appendChild(link);
		} else {
			name.textContent = method.label;
		}
		const self = document.createElement('td');
		self.className = 'number';
		self.textContent = percent(method.selfSamples);
		const all = document.createElement('td');
		all.className = 'number';
		all.textContent = percent(method.samples);
		row.append(name, self, all);
		body.appendChild(row);
	}
</script>
</body>
</html>`;
}
