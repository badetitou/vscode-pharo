import * as vscode from 'vscode';

/*
 * Sets up a "Pharo" VS Code profile that only shows the views of the extension. The extension API can neither create
 * nor switch profiles, so the profile is written as a .code-profile template that the user imports from the Profiles
 * editor. The template hides the other view containers through the profile storage, which the import copies into the
 * new profile: the user's default profile is never modified.
 */

const COMMAND_ID = 'pharo.profile.setup';
export const PROFILE_NAME = 'Pharo';
/** Set to true by the profile template, so that the command knows it runs inside the Pharo profile. */
const PROFILE_MARKER_SETTING = 'editorProfile';
const TEMPLATE_FILE = 'Pharo.code-profile';

const PHARO_VIEW_CONTAINER = 'workbench.view.extension.pharoView';
const CLASS_VIEW_CONTAINER = 'workbench.view.extension.pharoClass';
const INSPECTOR_VIEW_CONTAINER = 'workbench.view.extension.pharoInspectorPanel';

/** The settings of the profile, on top of the pharo.* settings of the current profile. */
const PROFILE_SETTINGS: Record<string, unknown> = {
	[`pharo.${PROFILE_MARKER_SETTING}`]: true,
	'workbench.startupEditor': 'none',
	'workbench.tips.enabled': false,
	'workbench.secondarySideBar.defaultVisibility': 'visible',
	'workbench.panel.defaultLocation': 'bottom',
	'workbench.editor.enablePreview': false,
	'breadcrumbs.enabled': false,
	'explorer.autoReveal': false
};

/** Built-in view containers of the activity bar; unpinned ones are hidden but stay available from the palette. */
const ACTIVITY_BAR_CONTAINERS = [
	'workbench.view.explorer',
	'workbench.view.search',
	'workbench.view.scm',
	'workbench.view.debug',
	'workbench.view.extensions',
	'workbench.view.remote',
	'workbench.view.extension.test',
	'workbench.view.extension.references-view'
];

/** Built-in view containers of the bottom panel. The Output view hosts the Pharo Transcript. */
const PANEL_CONTAINERS = [
	'workbench.panel.markers',
	'workbench.panel.repl',
	'terminal',
	'workbench.panel.comments',
	'refactorPreview'
];
const VISIBLE_PANEL_CONTAINERS = ['workbench.panel.output', 'workbench.panel.testResults'];

interface PinnedViewContainer {
	id: string;
	pinned: boolean;
	visible: boolean;
	order?: number;
}

/** The content of a .code-profile file: each resource is itself serialized as JSON. */
export interface ProfileTemplate {
	name: string;
	icon?: string;
	settings: string;
	extensions: string;
	globalState: string;
}

export interface ProfileExtension {
	id: string;
	displayName?: string;
}

/** Builds the Pharo profile template, keeping the given pharo.* settings so that the server starts in the new profile. */
export function buildProfileTemplate(extensions: ProfileExtension[], pharoSettings: Record<string, unknown>): ProfileTemplate {
	const settings = { ...pharoSettings, ...PROFILE_SETTINGS };
	const pinned = (ids: string[], shown: boolean, firstOrder = 0): PinnedViewContainer[] =>
		ids.map((id, index) => ({ id, pinned: shown, visible: shown, order: firstOrder + index }));
	const storage: Record<string, string> = {
		'workbench.activity.pinnedViewlets2': JSON.stringify([
			...pinned([PHARO_VIEW_CONTAINER], true),
			...pinned(ACTIVITY_BAR_CONTAINERS, false, 1)
		]),
		'workbench.panel.pinnedPanels': JSON.stringify([
			...pinned([INSPECTOR_VIEW_CONTAINER, ...VISIBLE_PANEL_CONTAINERS], true),
			...pinned(PANEL_CONTAINERS, false, 1 + VISIBLE_PANEL_CONTAINERS.length)
		]),
		'workbench.auxiliarybar.pinnedPanels': JSON.stringify(pinned([CLASS_VIEW_CONTAINER], true))
	};
	return {
		name: PROFILE_NAME,
		icon: 'symbol-class',
		settings: JSON.stringify({ settings: JSON.stringify(settings, undefined, '\t') }),
		extensions: JSON.stringify(extensions.map(extension => ({
			identifier: { id: extension.id },
			displayName: extension.displayName
		}))),
		globalState: JSON.stringify({ storage })
	};
}

/** The pharo.* settings set in the current profile (user level), except the profile marker. */
function currentPharoSettings(): Record<string, unknown> {
	const configuration = vscode.workspace.getConfiguration('pharo');
	const properties = vscode.extensions.getExtension(extensionId())?.packageJSON?.contributes?.configuration?.properties ?? {};
	const settings: Record<string, unknown> = {};
	for (const key of Object.keys(properties)) {
		const name = key.replace(/^pharo\./, '');
		const value = configuration.inspect(name)?.globalValue;
		if (name !== PROFILE_MARKER_SETTING && value !== undefined) {
			settings[key] = value;
		}
	}
	return settings;
}

let extensionContext: vscode.ExtensionContext | undefined;

function extensionId(): string {
	return extensionContext?.extension.id ?? 'badetitou.pharo-language-server';
}

/** This extension and the extensions it depends on, which the profile installs. */
function profileExtensions(): ProfileExtension[] {
	const ids = [extensionId(), ...(extensionContext?.extension.packageJSON?.extensionDependencies ?? [])];
	return ids.map(id => ({ id, displayName: vscode.extensions.getExtension(id)?.packageJSON?.displayName }));
}

export function isPharoProfile(): boolean {
	return vscode.workspace.getConfiguration('pharo').get<boolean>(PROFILE_MARKER_SETTING, false);
}

/** Puts the Pharo views back where the profile expects them: Pharo sidebar, class panel and inspector. */
export async function applyPharoLayout(): Promise<void> {
	await vscode.commands.executeCommand('workbench.action.resetViewLocations');
	await vscode.commands.executeCommand(INSPECTOR_VIEW_CONTAINER);
	await vscode.commands.executeCommand(CLASS_VIEW_CONTAINER);
	await vscode.commands.executeCommand(PHARO_VIEW_CONTAINER);
}

async function writeTemplate(context: vscode.ExtensionContext): Promise<vscode.Uri> {
	const template = buildProfileTemplate(profileExtensions(), currentPharoSettings());
	await vscode.workspace.fs.createDirectory(context.globalStorageUri);
	const uri = vscode.Uri.joinPath(context.globalStorageUri, TEMPLATE_FILE);
	await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(template, undefined, '\t')));
	return uri;
}

async function importProfile(context: vscode.ExtensionContext): Promise<void> {
	const uri = await writeTemplate(context);
	await vscode.env.clipboard.writeText(uri.toString());
	await vscode.commands.executeCommand('workbench.profiles.actions.manageProfiles');
	const reveal = 'Reveal Profile File';
	const copy = 'Copy Path Again';
	let choice: string | undefined;
	do {
		choice = await vscode.window.showInformationMessage(
			`In the Profiles editor, open the menu next to "New Profile", choose "Import Profile..." and paste the path copied to the clipboard. Once created, switch to the "${PROFILE_NAME}" profile (or use it for this folder) and run this command again to restore the layout.`,
			reveal, copy);
		if (choice === reveal) {
			await vscode.commands.executeCommand('revealFileInOS', uri);
		} else if (choice === copy) {
			await vscode.env.clipboard.writeText(uri.toString());
		}
	} while (choice !== undefined);
}

async function setupProfile(context: vscode.ExtensionContext): Promise<void> {
	if (isPharoProfile()) {
		await applyPharoLayout();
		const recreate = 'Recreate Profile';
		const choice = await vscode.window.showInformationMessage(
			`The Pharo layout is restored. To also hide the other views again, recreate the "${PROFILE_NAME}" profile.`,
			recreate);
		if (choice === recreate) {
			await importProfile(context);
		}
		return;
	}
	const create = 'Create Profile';
	const layout = 'Only Arrange Views Here';
	const choice = await vscode.window.showInformationMessage(
		`Create a "${PROFILE_NAME}" VS Code profile that only shows the Pharo views? Your current profile is left unchanged.`,
		create, layout);
	if (choice === create) {
		await importProfile(context);
	} else if (choice === layout) {
		await applyPharoLayout();
	}
}

export function registerEditorProfileCommand(context: vscode.ExtensionContext): vscode.Disposable {
	extensionContext = context;
	return vscode.commands.registerCommand(COMMAND_ID, () => setupProfile(context));
}
