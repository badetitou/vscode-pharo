import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { expectStringArray, isMethodNotFoundError } from '../rpcContracts';
import { parseTonelMethods, TonelMethod } from '../tonel';
import { buildPharoUri } from './pharoUri';

const COMMAND_ID = 'pharo.millerNavigation.open';
const GO_TO_COMMAND_ID = 'pharo.goTo';
const CLASS_FILE_SUFFIX = '.class.st';

interface PharoRepository {
	name: string;
	valid: boolean;
}

export interface MillerEntry {
	label: string;
	value: string;
	description?: string;
}

export interface MillerAction {
	label: string;
	action: string;
}

export interface MillerColumn {
	title: string;
	entries: MillerEntry[];
	selectedValue?: string;
	loading?: boolean;
	actions?: MillerAction[];
}

interface PharoNavigationClient {
	isRunning(): boolean;
	sendRequest<T = unknown>(method: string, params?: unknown): Promise<T>;
}

export function registerPharoMillerNavigation(
	getClient: () => PharoNavigationClient | undefined
): vscode.Disposable {
	let panel: vscode.WebviewPanel | undefined;
	const openPanel = async (focusSearch: boolean) => {
		const client = getClient();
		if (!client?.isRunning()) {
			void vscode.window.showErrorMessage('The Pharo Language Server is not running.');
			return;
		}

		if (panel) {
			panel.reveal(vscode.ViewColumn.Beside);
			if (focusSearch) {
				void panel.webview.postMessage({ type: 'focusSearch' });
			}
			return;
		}
		panel = openNavigationPanel(client, focusSearch);
		panel.onDidDispose(() => { panel = undefined; });
	};
	const command = vscode.commands.registerCommand(COMMAND_ID, () => openPanel(false));
	const goToCommand = vscode.commands.registerCommand(GO_TO_COMMAND_ID, () => openPanel(true));
	return vscode.Disposable.from(
		command,
		goToCommand,
		new vscode.Disposable(() => panel?.dispose())
	);
}

function openNavigationPanel(client: PharoNavigationClient, focusSearch: boolean): vscode.WebviewPanel {
	const imagePath = vscode.workspace.getConfiguration('pharo').get<string>('pathToImage');
	const imageName = imagePath ? path.basename(imagePath, path.extname(imagePath)) : 'Pharo Image';
	const panel = vscode.window.createWebviewPanel(
		'pharoMillerNavigation',
		`Pharo: ${imageName}`,
		vscode.ViewColumn.Beside,
		{ enableScripts: true, retainContextWhenHidden: true }
	);
	panel.webview.html = getWebviewHtml(panel.webview);

	let packages: string[] = [];
	let repositories: PharoRepository[] = [];
	let selectedRepositoryName: string | undefined;
	let classes: string[] = [];
	let methods: TonelMethod[] = [];
	let packageName: string | undefined;
	let className: string | undefined;
	let protocol: string | undefined;
	let generation = 0;
	let webviewReady = false;
	let packagesLoading = false;
	let pendingError: string | undefined;

	const packageEntries = (): MillerEntry[] => packages.map((name) => ({ label: name, value: name }));
	const classEntries = (): MillerEntry[] => classes.map((name) => ({ label: name, value: name }));
	const protocolEntries = (): MillerEntry[] => [...new Set(methods.map((method) => method.protocol))]
		.sort((left, right) => left.localeCompare(right))
		.map((name) => ({ label: name, value: name }));

	const render = (loadingColumn?: number) => {
		if (!webviewReady) {
			return;
		}
		const columns: MillerColumn[] = [{ title: 'Packages', entries: packageEntries(), selectedValue: packageName }];
		if (packageName !== undefined) {
			columns.push({
				title: 'Classes',
				entries: classEntries(),
				selectedValue: className,
				loading: loadingColumn === 1,
				actions: className ? [
					{ label: 'Open class', action: 'openClass' },
					{ label: 'Run tests', action: 'runClassTests' }
				] : undefined
			});
		}
		if (className !== undefined) {
			columns.push({
				title: 'Protocols',
				entries: protocolEntries(),
				selectedValue: protocol,
				loading: loadingColumn === 2
			});
		}
		if (protocol !== undefined) {
			columns.push({
				title: 'Methods',
				entries: methods
					.filter((method) => method.protocol === protocol)
					.map((method) => ({
						label: method.selector,
						value: method.id,
						description: `${method.side} side`
					})),
				loading: loadingColumn === 3
			});
		}

		void panel.webview.postMessage({
			type: 'update',
			columns,
			repositories,
			selectedRepositoryName,
			breadcrumb: [packageName, className, protocol].filter((part): part is string => part !== undefined)
		});
	};

	const showError = (error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		if (!webviewReady) {
			pendingError = message;
			return;
		}
		void panel.webview.postMessage({ type: 'error', message });
	};

	const refreshNavigation = async () => {
		const requestGeneration = ++generation;
		packagesLoading = true;
		packages = [];
		classes = [];
		methods = [];
		packageName = undefined;
		className = undefined;
		protocol = undefined;
		render(0);
		try {
			let rawRepositories: unknown;
			try {
				rawRepositories = await client.sendRequest<unknown>('pls-ice:repositories');
			} catch (error) {
				if (!isMethodNotFoundError(error)) {
					throw error;
				}
				rawRepositories = [];
			}
			if (requestGeneration !== generation) {
				return;
			}
			repositories = parseRepositories(rawRepositories).filter((repository) => repository.valid);
			if (selectedRepositoryName && !repositories.some((repository) => repository.name === selectedRepositoryName)) {
				selectedRepositoryName = undefined;
			}
			const result = await packagesForRepository(client, selectedRepositoryName);
			if (requestGeneration !== generation) {
				return;
			}
			packagesLoading = false;
			packages = result.sort((left, right) => left.localeCompare(right));
			render();
		} catch (error) {
			if (requestGeneration === generation) {
				packagesLoading = false;
				render();
				showError(error);
			}
		}
	};

	panel.webview.onDidReceiveMessage(async (message: unknown) => {
		if (!message || typeof message !== 'object') {
			return;
		}
		const request = message as {
			type?: unknown;
			column?: unknown;
			value?: unknown;
			action?: unknown;
			repositoryName?: unknown;
		};
		if (request.type === 'ready') {
			webviewReady = true;
			render(packagesLoading ? 0 : undefined);
			if (pendingError) {
				void panel.webview.postMessage({ type: 'error', message: pendingError });
				pendingError = undefined;
			}
			return;
		}
		if (request.type === 'refresh') {
			await refreshNavigation();
			return;
		}
		if (request.type === 'repository' && (request.repositoryName === undefined || typeof request.repositoryName === 'string')) {
			const repositoryName = request.repositoryName as string | undefined;
			if (repositoryName !== undefined && !repositories.some((repository) => repository.name === repositoryName)) {
				return;
			}
			const requestGeneration = ++generation;
			selectedRepositoryName = repositoryName;
			packages = [];
			classes = [];
			methods = [];
			packageName = undefined;
			className = undefined;
			protocol = undefined;
			packagesLoading = true;
			render(0);
			try {
				packages = (await packagesForRepository(client, selectedRepositoryName))
					.sort((left, right) => left.localeCompare(right));
				if (requestGeneration !== generation) {
					return;
				}
				packagesLoading = false;
				render();
			} catch (error) {
				if (requestGeneration === generation) {
					packagesLoading = false;
					render();
					showError(error);
				}
			}
			return;
		}
		let requestGeneration: number | undefined;
		try {
			if (request.type === 'select' && Number.isInteger(request.column) && typeof request.value === 'string') {
				const isValidSelection =
					(request.column === 0 && packages.includes(request.value)) ||
					(request.column === 1 && packageName !== undefined && classes.includes(request.value)) ||
					(request.column === 2 && className !== undefined && methods.some((method) => method.protocol === request.value)) ||
					(request.column === 3 && protocol !== undefined && methods.some((method) => method.id === request.value && method.protocol === protocol));
				if (!isValidSelection) {
					return;
				}
				requestGeneration = ++generation;
				if (request.column === 0 && packages.includes(request.value)) {
					packageName = request.value;
					className = undefined;
					protocol = undefined;
					classes = [];
					methods = [];
					render(1);
					const result = await client.sendRequest<unknown>('pls:classes', { package: packageName });
					if (requestGeneration !== generation) {
						return;
					}
					classes = expectStringArray(result, 'pls:classes')
						.map((name) => name.split('/').pop() ?? name)
						.sort((left, right) => left.localeCompare(right));
					render();
					return;
				}

				if (request.column === 1 && packageName && classes.includes(request.value)) {
					className = request.value;
					protocol = undefined;
					methods = [];
					render(2);
					const uri = classUri(packageName, className);
					const document = await vscode.workspace.openTextDocument(uri);
					if (requestGeneration !== generation) {
						return;
					}
					methods = parseTonelMethods(document.getText());
					render();
					return;
				}

				if (request.column === 2 && className) {
					const availableProtocols = new Set(methods.map((method) => method.protocol));
					if (!availableProtocols.has(request.value)) {
						return;
					}
					protocol = request.value;
					render();
					return;
				}

				if (request.column === 3 && protocol) {
					const method = methods.find((candidate) => candidate.id === request.value && candidate.protocol === protocol);
					if (!method || !packageName || !className) {
						return;
					}
					const document = await vscode.workspace.openTextDocument(classUri(packageName, className));
					if (requestGeneration !== generation) {
						return;
					}
					const editor = await vscode.window.showTextDocument(document);
					const line = Math.max(0, Math.min(method.startLine, document.lineCount - 1));
					const position = new vscode.Position(line, 0);
					editor.selection = new vscode.Selection(position, position);
					editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
					return;
				}
			}

			if (request.type === 'action' && typeof request.action === 'string' && className) {
				if (request.action === 'openClass' && packageName) {
					const document = await vscode.workspace.openTextDocument(classUri(packageName, className));
					await vscode.window.showTextDocument(document);
				} else if (request.action === 'runClassTests') {
					await vscode.commands.executeCommand('pharo.executeClassTests', className);
				}
			}
		} catch (error) {
			if (requestGeneration === undefined || requestGeneration === generation) {
				render();
				showError(error);
			}
		}
	});

	function classUri(selectedPackage: string, selectedClass: string): vscode.Uri {
		return buildPharoUri(`/${selectedPackage}/${selectedClass}${CLASS_FILE_SUFFIX}`, selectedRepositoryName);
	}

	void refreshNavigation().then(() => {
		if (focusSearch) {
			void panel.webview.postMessage({ type: 'focusSearch' });
		}
	});
	return panel;
}

function parseRepositories(value: unknown): PharoRepository[] {
	if (!Array.isArray(value) || value.some((repository) =>
		!repository
		|| typeof repository !== 'object'
		|| typeof repository.name !== 'string'
		|| typeof repository.valid !== 'boolean'
	)) {
		throw new Error('Pharo Language Server returned an invalid response for "pls-ice:repositories".');
	}
	return value as PharoRepository[];
}

async function packagesForRepository(
	client: PharoNavigationClient,
	repositoryName?: string
): Promise<string[]> {
	if (!repositoryName) {
		return expectStringArray(await client.sendRequest('pls:packages', {}), 'pls:packages');
	}
	try {
		return expectStringArray(
			await client.sendRequest('pls-ice:repositoryPackages', { aRepositoryName: repositoryName }),
			'pls-ice:repositoryPackages'
		);
	} catch (error) {
		if (!isMethodNotFoundError(error)) {
			throw error;
		}
		return expectStringArray(await client.sendRequest('pls:packages', {}), 'pls:packages');
	}
}

function getWebviewHtml(webview: vscode.Webview): string {
	const nonce = crypto.randomBytes(16).toString('base64');
	const cspSource = webview.cspSource;
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Pharo navigation</title>
	<style nonce="${nonce}">
		:root { color-scheme: light dark; }
		body { padding: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
		#toolbar { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
		#context { display: flex; align-items: center; gap: 8px; }
		#breadcrumb { color: var(--vscode-descriptionForeground); }
		#refresh { width: auto; padding: 4px 8px; }
		select { max-width: 260px; padding: 4px; color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border); }
		#error { display: none; padding: 8px 12px; color: var(--vscode-errorForeground); }
		#columns { display: flex; height: calc(100vh - 45px); overflow-x: auto; }
		.column { display: flex; flex: 0 0 250px; flex-direction: column; border-right: 1px solid var(--vscode-panel-border); }
		.column h2 { margin: 0; padding: 10px 12px; font-size: 13px; font-weight: 600; }
		.actions { display: flex; gap: 5px; padding: 0 8px 8px; }
		.actions:empty { display: none; }
		input { margin: 0 8px 8px; padding: 5px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); }
		.entries { overflow-y: auto; }
		button { width: 100%; padding: 6px 10px; text-align: left; color: var(--vscode-foreground); background: transparent; border: 0; cursor: pointer; }
		button:hover { background: var(--vscode-list-hoverBackground); }
		button.selected { color: var(--vscode-list-activeSelectionForeground); background: var(--vscode-list-activeSelectionBackground); }
		.actions button { width: auto; border: 1px solid var(--vscode-button-border, transparent); }
		.description { display: block; color: var(--vscode-descriptionForeground); font-size: 11px; }
		.empty { padding: 8px 12px; color: var(--vscode-descriptionForeground); }
	</style>
</head>
<body>
	<div id="toolbar">
		<div id="context">
			<select id="repository" aria-label="Iceberg repository"><option value="">All image packages</option></select>
			<div id="breadcrumb" aria-live="polite">Loading Pharo packages…</div>
		</div>
		<button id="refresh" type="button" title="Reload packages from the active image">Refresh</button>
	</div>
	<div id="error" role="alert"></div>
	<main id="columns" aria-label="Pharo image navigation"></main>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const columnsRoot = document.getElementById('columns');
		const breadcrumb = document.getElementById('breadcrumb');
		const errorBox = document.getElementById('error');
		let pendingColumnFocus;
		const repositoryPicker = document.getElementById('repository');
		document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
		repositoryPicker.addEventListener('change', () => vscode.postMessage({
			type: 'repository',
			repositoryName: repositoryPicker.value || undefined
		}));

		function render(data) {
			errorBox.style.display = 'none';
			breadcrumb.textContent = data.breadcrumb.length ? data.breadcrumb.join('  ›  ') : 'Select a package to begin';
			const currentRepository = data.selectedRepositoryName || '';
			repositoryPicker.replaceChildren();
			const allPackages = document.createElement('option');
			allPackages.value = '';
			allPackages.textContent = 'All image packages';
			repositoryPicker.appendChild(allPackages);
			data.repositories.forEach((repository) => {
				const option = document.createElement('option');
				option.value = repository.name;
				option.textContent = repository.name;
				repositoryPicker.appendChild(option);
			});
			repositoryPicker.value = currentRepository;
			columnsRoot.replaceChildren();
			data.columns.forEach((column, index) => {
				const section = document.createElement('section');
				section.className = 'column';
				section.dataset.column = String(index);
				const heading = document.createElement('h2');
				heading.textContent = column.title;
				section.appendChild(heading);
				const actions = document.createElement('div');
				actions.className = 'actions';
				(column.actions || []).forEach((action) => {
					const button = document.createElement('button');
					button.type = 'button';
					button.textContent = action.label;
					button.addEventListener('click', () => vscode.postMessage({ type: 'action', action: action.action }));
					actions.appendChild(button);
				});
				section.appendChild(actions);

				const filter = document.createElement('input');
				filter.type = 'search';
				filter.placeholder = 'Filter ' + column.title.toLowerCase();
				filter.setAttribute('aria-label', filter.placeholder);
				filter.addEventListener('keydown', (event) => {
					if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
						return;
					}
					const buttons = Array.from(section.querySelectorAll('.entries button'));
					const target = event.key === 'ArrowDown' ? buttons[0] : buttons[buttons.length - 1];
					if (target) {
						event.preventDefault();
						target.focus();
					}
				});
				section.appendChild(filter);

				const entries = document.createElement('div');
				entries.className = 'entries';
				entries.addEventListener('keydown', (event) => {
					const buttons = Array.from(entries.querySelectorAll('button'));
					const currentIndex = buttons.findIndex((button) => button === document.activeElement);
					if (event.key === 'ArrowLeft') {
						if (index > 0) {
							event.preventDefault();
							const previousSection = columnsRoot.querySelector('[data-column="' + (index - 1) + '"]');
							const previousTarget = previousSection?.querySelector('button.selected') || previousSection?.querySelector('input[type="search"]');
							previousTarget?.focus();
						}
						return;
					}
					if (event.key === 'ArrowRight' && currentIndex >= 0) {
						event.preventDefault();
						if (index < data.columns.length - 1) {
							pendingColumnFocus = index + 1;
						}
						buttons[currentIndex].click();
						return;
					}
					if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
						return;
					}
					const nextIndex = event.key === 'Home'
						? 0
						: event.key === 'End'
							? buttons.length - 1
							: event.key === 'ArrowDown'
								? Math.min(currentIndex + 1, buttons.length - 1)
								: Math.max(currentIndex - 1, 0);
					if (buttons[nextIndex]) {
						event.preventDefault();
						buttons[nextIndex].focus();
					}
				});
				const drawEntries = () => {
					entries.replaceChildren();
					const query = filter.value.toLocaleLowerCase();
					const matchingEntries = column.entries.filter((entry) => entry.label.toLocaleLowerCase().includes(query));
					if (column.loading) {
						const loading = document.createElement('div');
						loading.className = 'empty';
						loading.textContent = 'Loading…';
						entries.appendChild(loading);
					} else if (matchingEntries.length === 0) {
						const empty = document.createElement('div');
						empty.className = 'empty';
						empty.textContent = 'No items';
						entries.appendChild(empty);
					} else {
						matchingEntries.forEach((entry) => {
							const button = document.createElement('button');
							button.type = 'button';
							button.className = entry.value === column.selectedValue ? 'selected' : '';
							button.setAttribute('aria-current', entry.value === column.selectedValue ? 'true' : 'false');
							button.appendChild(document.createTextNode(entry.label));
							if (entry.description) {
								const description = document.createElement('span');
								description.className = 'description';
								description.textContent = entry.description;
								button.appendChild(description);
							}
							button.addEventListener('click', () => vscode.postMessage({ type: 'select', column: index, value: entry.value }));
							entries.appendChild(button);
						});
					}
				};
				filter.addEventListener('input', drawEntries);
				section.appendChild(entries);
				drawEntries();
				columnsRoot.appendChild(section);
			});
			if (pendingColumnFocus !== undefined && data.columns[pendingColumnFocus]) {
				const targetColumn = data.columns[pendingColumnFocus];
				const targetSection = columnsRoot.querySelector('[data-column="' + pendingColumnFocus + '"]');
				if (targetSection && !targetColumn.loading) {
					const target = targetSection.querySelector('button.selected')
						|| targetSection.querySelector('.entries button')
						|| targetSection.querySelector('input[type="search"]');
					target?.focus();
					pendingColumnFocus = undefined;
				} else if (targetColumn.loading) {
					targetSection?.querySelector('input[type="search"]')?.focus();
				}
			}
		}

		window.addEventListener('message', (event) => {
			const message = event.data;
			if (message.type === 'update') {
				render(message);
			} else if (message.type === 'error') {
				errorBox.textContent = message.message;
				errorBox.style.display = 'block';
			} else if (message.type === 'focusSearch') {
				const firstFilter = columnsRoot.querySelector('input[type="search"]');
				if (firstFilter) {
					firstFilter.focus();
				}
			}
		});
		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`;
}
