import * as vscode from 'vscode';
import { packageNameOfEnvId } from './environmentChanges';
import { PharoEntityFileSystem } from './entityFileSystem';
import { ENTITY_SCHEME, EntityLocation, EntitySide, entityUri, imageNameOf, parseEntityUri } from './entityUri';
import { PharoEnvironment } from './pharoEnvironment';

/** Register the `pharo:` file system of the entity editors and the commands that open them. */
export function registerEntityEditors(
	context: vscode.ExtensionContext,
	environment: () => PharoEnvironment | undefined
): PharoEntityFileSystem {
	const fileSystem = new PharoEntityFileSystem(environment);
	context.subscriptions.push(
		fileSystem,
		vscode.workspace.registerFileSystemProvider(ENTITY_SCHEME, fileSystem, { isCaseSensitive: true }),
		fileSystem.onDidCreateEntity(async ({ from, to }) => {
			await vscode.window.showTextDocument(to, { preview: false });
			if (parseEntityUri(from)?.selector === undefined && parseEntityUri(from)?.side) {
				await closeTabsOf(from);
			}
		}),
		vscode.commands.registerCommand('pharo.env.openEntity', (target?: unknown) =>
			reportErrors(() => openEntity(requireEnvironment(environment), target))
		),
		vscode.commands.registerCommand('pharo.env.newMethod', (target?: unknown) =>
			reportErrors(() => newMethod(requireEnvironment(environment), fileSystem, target))
		)
	);
	return fileSystem;
}

/**
 * Open the editor of a class definition or a method. The target is a pls-env id, a reference such as `Array`,
 * `Array>>collect:` or `Array class>>new:`, or a `pharoImage:` class file; without target, the user types a reference.
 */
async function openEntity(environment: PharoEnvironment, target?: unknown): Promise<void> {
	const reference = typeof target === 'string' ? target : classReferenceOfUri(target) ?? await vscode.window.showInputBox({
		title: 'Open Pharo Class or Method',
		prompt: 'A class, such as Array, or a method, such as Array>>collect: or Array class>>new:',
		ignoreFocusOut: true
	});
	if (!reference?.trim()) {
		return;
	}
	const location = await locationOf(environment, reference.trim());
	await vscode.window.showTextDocument(entityUri(location), { preview: false });
}

/** Open the editor of a new method of the class of target, after choosing its protocol. */
async function newMethod(environment: PharoEnvironment, fileSystem: PharoEntityFileSystem, target?: unknown): Promise<void> {
	const editorUri = vscode.window.activeTextEditor?.document.uri;
	const reference = typeof target === 'string' ? target : classReferenceOfUri(target) ?? classReferenceOfUri(editorUri)
		?? await vscode.window.showInputBox({ title: 'New Pharo Method', prompt: 'The class of the method, such as Array or Array class', ignoreFocusOut: true });
	if (!reference?.trim()) {
		return;
	}
	const classReference = reference.trim().replace(/>>.*$/, '');
	const side: EntitySide = /\sclass$/.test(classReference) ? 'class' : 'instance';
	await openNewMethod(environment, fileSystem, classReference.replace(/\s+class$/, ''), side);
}

/** Open the editor of a new method on a side of a class, in protocol, or in a protocol the user chooses. */
export async function openNewMethod(
	environment: PharoEnvironment,
	fileSystem: PharoEntityFileSystem,
	className: string,
	side: EntitySide,
	protocol?: string
): Promise<void> {
	const classLocation = await locationOf(environment, className);
	const sideId = `side:${classLocation.className}${side === 'class' ? ' class' : ''}`;
	const chosen = protocol ?? await pickProtocol(
		(await environment.children(sideId)).map((node) => node.name).filter((name) => !name.startsWith('*')),
		'Protocol of the New Method'
	);
	if (chosen === undefined) {
		return;
	}
	const uri = fileSystem.newMethodUri({ ...classLocation, side }, chosen);
	await vscode.window.showTextDocument(uri, { preview: false });
}

/** Let the user choose one of protocols, or type a new one. */
export async function pickProtocol(protocols: string[], title: string): Promise<string | undefined> {
	const picker = vscode.window.createQuickPick();
	picker.title = title;
	picker.placeholder = 'Choose a protocol, or type a new one';
	const known = [...new Set([...protocols, 'as yet unclassified'])].sort();
	const items = (value: string) => [
		...(value && !known.includes(value) ? [{ label: value, description: 'New protocol' }] : []),
		...known.map((label) => ({ label }))
	];
	picker.items = items('');
	picker.onDidChangeValue((value) => { picker.items = items(value.trim()); });
	return new Promise((resolve) => {
		picker.onDidAccept(() => {
			resolve(picker.selectedItems[0]?.label ?? (picker.value.trim() || undefined));
			picker.hide();
		});
		picker.onDidHide(() => {
			resolve(undefined);
			picker.dispose();
		});
		picker.show();
	});
}

/** Answer the location of a reference: an id (`class:Array`, `method:Array>>collect:`), or `Array`, `Array>>#collect:`, `Array class>>new:`. */
export async function locationOf(environment: PharoEnvironment, reference: string): Promise<EntityLocation> {
	const text = reference.replace(/^(class|method|side):/, '');
	const match = /^(\S+?)(\s+class)?(?:\s*>>\s*#?(.+))?$/.exec(text);
	if (!match) {
		throw new Error(`${reference} names no class or method.`);
	}
	const [, className, classSide, selector] = match;
	const classEntity = await environment.entity(`class:${className}`);
	const packageName = classEntity.package ? packageNameOfEnvId(classEntity.package) : undefined;
	if (!packageName) {
		throw new Error(`The package of ${className} is unknown.`);
	}
	const image = imageNameOf(environment.image);
	if (selector === undefined) {
		return { image, packageName, className };
	}
	return { image, packageName, className, side: classSide ? 'class' : 'instance', selector: selector.trim() };
}

/** Answer the class named by a `pharo:` editor or a `pharoImage:` class file, as `Array` or `Array class`. */
function classReferenceOfUri(target: unknown): string | undefined {
	if (!(target instanceof vscode.Uri)) {
		return undefined;
	}
	const entity = parseEntityUri(target);
	if (entity) {
		return entity.side === 'class' ? `${entity.className} class` : entity.className;
	}
	if (target.scheme === 'pharoImage') {
		const file = target.path.split('/').pop() ?? '';
		return file.endsWith('.class.st') ? decodeURIComponent(file.slice(0, -'.class.st'.length)) : undefined;
	}
	return undefined;
}

async function closeTabsOf(uri: vscode.Uri): Promise<void> {
	const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs)
		.filter((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString());
	await vscode.window.tabGroups.close(tabs);
}

export function requireEnvironment(environment: () => PharoEnvironment | undefined): PharoEnvironment {
	const current = environment();
	if (!current) {
		throw new Error('The Pharo Language Server is not running, or does not provide the environment model (pls-env).');
	}
	return current;
}

export async function reportErrors(action: () => Promise<void>): Promise<void> {
	try {
		await action();
	} catch (error) {
		void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
	}
}
