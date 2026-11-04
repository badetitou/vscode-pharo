import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { EnvNode } from './envContracts';
import { reportErrors, requireEnvironment } from './entityCommands';
import { PharoEnvironment } from './pharoEnvironment';

const BASELINE_PREFIX = 'BaselineOf';

/**
 * Answer the URL to clone for what the user typed: a URL as is, or `owner/repo` and `github.com/owner/repo` as a
 * GitHub URL. Undefined when it is neither.
 */
export function gitUrlOf(input: string): string | undefined {
	const text = input.trim();
	if (/^(https?|ssh|git|file):\/\/\S+$/.test(text) || /^[\w.-]+@[\w.-]+:\S+$/.test(text)) {
		return text;
	}
	const github = /^(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(text);
	return github ? `https://github.com/${github[1]}/${github[2]}.git` : undefined;
}

/** Answer the folder name git gives to a clone of url, such as `Roassal` for `https://github.com/pharo-graphics/Roassal.git`. */
export function repositoryNameOf(url: string): string {
	return url.replace(/\/+$/, '').split(/[/:]/).pop()!.replace(/\.git$/, '');
}

/** Answer the directory of the sources of a working copy: the `srcDirectory` of its `.project` file, as Iceberg reads it. */
export async function sourceDirectoryOf(workingCopy: string): Promise<string> {
	let project: string;
	try {
		project = await fs.readFile(path.join(workingCopy, '.project'), 'utf8');
	} catch {
		return workingCopy;
	}
	const source = /['"]srcDirectory['"]\s*:\s*['"]([^'"]*)['"]/.exec(project)?.[1];
	return source ? path.join(workingCopy, source) : workingCopy;
}

/** Answer the baselines of a working copy, without their BaselineOf prefix, sorted by name. */
export async function baselinesOf(workingCopy: string): Promise<string[]> {
	let entries: import('fs').Dirent[];
	try {
		entries = await fs.readdir(await sourceDirectoryOf(workingCopy), { withFileTypes: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.isDirectory() && entry.name.startsWith(BASELINE_PREFIX) && entry.name.length > BASELINE_PREFIX.length)
		.map((entry) => entry.name.slice(BASELINE_PREFIX.length))
		.sort();
}

/** Register the commands that clone a Pharo project and load it in the image of the window. */
export function registerProjectLoading(
	context: vscode.ExtensionContext,
	environment: () => PharoEnvironment | undefined,
	revealProject: (project: EnvNode) => Promise<void>
): void {
	const load = (workingCopy: string, token: vscode.CancellationToken, progress: vscode.Progress<{ message?: string }>) =>
		loadWorkingCopy(requireEnvironment(environment), workingCopy, token, progress);
	context.subscriptions.push(
		vscode.commands.registerCommand('pharo.env.cloneAndLoadProject', (url?: unknown) =>
			reportErrors(async () => {
				const project = await cloneAndLoad(typeof url === 'string' ? url : undefined, load);
				if (project) {
					await afterLoad(project, revealProject);
				}
			})
		),
		vscode.commands.registerCommand('pharo.env.loadProjectFromFolder', (folder?: unknown) =>
			reportErrors(async () => {
				const workingCopy = folder instanceof vscode.Uri ? folder.fsPath : await askFolder('Load Pharo Project', 'Load');
				if (!workingCopy) {
					return;
				}
				const project = await withLoadProgress(`Loading ${path.basename(workingCopy)}`, (progress, token) => load(workingCopy, token, progress));
				if (project) {
					await afterLoad({ ...project, workingCopy }, revealProject);
				}
			})
		)
	);
}

interface LoadedProject extends EnvNode {
	workingCopy: string;
}

type Loader = (workingCopy: string, token: vscode.CancellationToken, progress: vscode.Progress<{ message?: string }>) => Promise<EnvNode | undefined>;

async function cloneAndLoad(givenUrl: string | undefined, load: Loader): Promise<LoadedProject | undefined> {
	const typed = givenUrl ?? await vscode.window.showInputBox({
		title: 'Clone and Load Pharo Project',
		prompt: 'The git URL of the project, or owner/repository for GitHub',
		placeHolder: 'pharo-graphics/Roassal',
		ignoreFocusOut: true,
		validateInput: (value) => value.trim() === '' || gitUrlOf(value) ? undefined : 'Not a git URL nor owner/repository.'
	});
	const url = typed ? gitUrlOf(typed) : undefined;
	if (!url) {
		return undefined;
	}
	const parent = await askFolder('Folder to Clone the Project In', 'Clone Here');
	if (!parent) {
		return undefined;
	}
	const workingCopy = path.join(parent, repositoryNameOf(url));
	if (await exists(workingCopy)) {
		throw new Error(`${workingCopy} already exists. Use "Pharo: Load Project from Folder…" to load it.`);
	}
	const project = await withLoadProgress(`Cloning ${repositoryNameOf(url)}`, async (progress, token) => {
		await gitClone(url, workingCopy, token);
		return token.isCancellationRequested ? undefined : load(workingCopy, token, progress);
	});
	return project ? { ...project, workingCopy } : undefined;
}

/** Load the baseline of a working copy, asking which one when it holds several. */
async function loadWorkingCopy(
	environment: PharoEnvironment,
	workingCopy: string,
	token: vscode.CancellationToken,
	progress: vscode.Progress<{ message?: string }>
): Promise<EnvNode | undefined> {
	if (!environment.capabilities.loadProject) {
		throw new Error('The Pharo Language Server cannot load projects (pls-env:loadProject); update the server.');
	}
	const baselines = await baselinesOf(workingCopy);
	if (baselines.length === 0) {
		throw new Error(`No Metacello baseline (BaselineOf…) in ${await sourceDirectoryOf(workingCopy)}.`);
	}
	const baseline = baselines.length === 1 ? baselines[0] : await vscode.window.showQuickPick(baselines, {
		title: 'Baseline to Load',
		placeHolder: `${path.basename(workingCopy)} holds several baselines`,
		ignoreFocusOut: true
	}, token);
	if (!baseline || token.isCancellationRequested) {
		return undefined;
	}
	progress.report({ message: `Loading ${BASELINE_PREFIX}${baseline}…` });
	return environment.loadProject(workingCopy, baseline);
}

async function afterLoad(project: LoadedProject, revealProject: (project: EnvNode) => Promise<void>): Promise<void> {
	await revealProject(project);
	const folder = vscode.Uri.file(project.workingCopy);
	if (vscode.workspace.getWorkspaceFolder(folder)) {
		void vscode.window.showInformationMessage(`Loaded the project ${project.name}.`);
		return;
	}
	const add = 'Add to Workspace';
	const open = 'Open Folder';
	const choice = await vscode.window.showInformationMessage(`Loaded the project ${project.name} from ${project.workingCopy}.`, add, open);
	if (choice === add) {
		vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, { uri: folder });
	} else if (choice === open) {
		await vscode.commands.executeCommand('vscode.openFolder', folder);
	}
}

function withLoadProgress<T>(
	title: string,
	task: (progress: vscode.Progress<{ message?: string }>, token: vscode.CancellationToken) => Promise<T>
): Thenable<T> {
	return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: true }, task);
}

async function askFolder(title: string, openLabel: string): Promise<string | undefined> {
	const folders = await vscode.window.showOpenDialog({
		title,
		openLabel,
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(os.homedir())
	});
	return folders?.[0]?.fsPath;
}

/** Clone url into target with the git of the machine, so that its credentials and configuration apply. */
function gitClone(url: string, target: string, token: vscode.CancellationToken): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = execFile('git', ['clone', '--', url, target], (error, _stdout, stderr) => {
			if (token.isCancellationRequested) {
				void fs.rm(target, { recursive: true, force: true }).finally(() => resolve());
			} else if (error) {
				reject(new Error(`git clone ${url} failed: ${(stderr || error.message).trim()}`));
			} else {
				resolve();
			}
		});
		token.onCancellationRequested(() => child.kill());
	});
}

async function exists(file: string): Promise<boolean> {
	try {
		await fs.access(file);
		return true;
	} catch {
		return false;
	}
}
