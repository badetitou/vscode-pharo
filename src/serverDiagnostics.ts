import * as child_process from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import * as requirements from './requirements';
import { expectString } from './rpcContracts';

const COMMAND_ID = 'pharo.diagnose';

interface DiagnosticItem extends vscode.QuickPickItem { }

export interface ServerDiagnosticsDependencies {
	getClient: () => LanguageClient | undefined;
	getProcess: () => child_process.ChildProcess | undefined;
	getLifecycleStatus: () => string;
	getExtensionVersion: () => string;
	outputChannel: vscode.OutputChannel;
}

type DiagnosticStatus = 'ok' | 'warning' | 'error' | 'unknown';

const outputButton: vscode.QuickInputButton = {
	iconPath: new vscode.ThemeIcon('output'),
	tooltip: 'Show Pharo Language Server output'
};
const settingsButton: vscode.QuickInputButton = {
	iconPath: new vscode.ThemeIcon('settings-gear'),
	tooltip: 'Open Pharo settings'
};
const refreshButton: vscode.QuickInputButton = {
	iconPath: new vscode.ThemeIcon('refresh'),
	tooltip: 'Refresh diagnostics'
};

export function registerServerDiagnosticsCommand(
	dependencies: ServerDiagnosticsDependencies
): vscode.Disposable {
	return vscode.commands.registerCommand(COMMAND_ID, () => showDiagnostics(dependencies));
}

async function collectDiagnostics(
	dependencies: ServerDiagnosticsDependencies
): Promise<DiagnosticItem[]> {
	const configuration = vscode.workspace.getConfiguration('pharo');
	const configuredVM = configuration.get<string>('pathToVM', '').trim();
	const configuredImage = configuration.get<string>('pathToImage', '').trim();
	const items: DiagnosticItem[] = [];
	const addItem = (label: string, status: DiagnosticStatus, description: string) => {
		const icon = {
			ok: '$(pass)',
			warning: '$(warning)',
			error: '$(error)',
			unknown: '$(question)'
		}[status];
		items.push({ label: `${icon} ${label}`, description });
	};

	try {
		const resolved = await requirements.resolveRequirements();
		addItem('Pharo VM', 'ok', path.basename(resolved.pathToVM));
		addItem('Pharo image', 'ok', path.basename(resolved.pathToImage));
	} catch (error) {
		const configured = [configuredVM, configuredImage]
			.filter(Boolean)
			.map((configuredPath) => path.basename(configuredPath))
			.join(' · ');
		addItem(
			'VM and image configuration',
			'error',
			configured ? `${configured} — ${formatError(error)}` : formatError(error)
		);
	}

	const process = dependencies.getProcess();
	if (!process) {
		addItem('Pharo process', 'unknown', 'Not started');
	} else if (process.exitCode !== null || process.signalCode !== null) {
		addItem(
			'Pharo process',
			'error',
			`Exited (code: ${process.exitCode ?? 'none'}, signal: ${process.signalCode ?? 'none'})`
		);
	} else {
		addItem(
			'Pharo process',
			'ok',
			process.pid ? `Running (PID ${process.pid})` : 'Running'
		);
	}

	const client = dependencies.getClient();
	const clientRunning = client?.isRunning() ?? false;
	const lifecycleStatus = dependencies.getLifecycleStatus();
	addItem(
		'Language Server connection',
		clientRunning ? 'ok' : lifecycleStatus === 'Startup failed' || lifecycleStatus === 'Stopped' ? 'error' : 'warning',
		clientRunning ? 'Connected' : lifecycleStatus
	);

	if (clientRunning && client) {
		try {
			const version = expectString(await client.sendRequest('command:version'), 'command:version');
			addItem('Language Server version', 'ok', version);
		} catch (error) {
			dependencies.outputChannel.appendLine(`Unable to query Language Server version: ${formatError(error)}`);
			addItem('Language Server version', 'error', formatError(error));
		}
	} else {
		addItem('Language Server version', 'unknown', 'Unavailable');
	}

	addItem('Extension', 'ok', dependencies.getExtensionVersion());
	return items;
}

async function showDiagnostics(dependencies: ServerDiagnosticsDependencies): Promise<void> {
	const quickPick = vscode.window.createQuickPick<DiagnosticItem>();
	quickPick.title = 'Pharo Language Server';
	quickPick.placeholder = 'Current server and image status';
	quickPick.buttons = [refreshButton, settingsButton, outputButton];

	let refreshInFlight = false;
	const refresh = async () => {
		if (refreshInFlight) {
			return;
		}
		refreshInFlight = true;
		quickPick.busy = true;
		try {
			quickPick.items = await collectDiagnostics(dependencies);
		} catch (error) {
			dependencies.outputChannel.appendLine(`Unable to refresh diagnostics: ${formatError(error)}`);
			void vscode.window.showErrorMessage(`Unable to refresh diagnostics: ${formatError(error)}`);
		} finally {
			quickPick.busy = false;
			refreshInFlight = false;
		}
	};

	quickPick.onDidAccept(() => quickPick.hide());
	quickPick.onDidTriggerButton((button) => {
		if (button === refreshButton) {
			void refresh();
		} else if (button === settingsButton) {
			quickPick.hide();
			void vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'@ext:badetitou.pharo-language-server'
			);
		} else if (button === outputButton) {
			dependencies.outputChannel.show(true);
		}
	});
	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
	await refresh();
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
