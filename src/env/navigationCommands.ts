import * as vscode from 'vscode';
import { locationOf, reportErrors, requireEnvironment } from './entityCommands';
import { entityUri } from './entityUri';
import { PharoEnvironment } from './pharoEnvironment';

// Semantic navigation from the Projects view and the class panel. The language server answers the native requests
// (textDocument/references, textDocument/implementation, the call and type hierarchies) on the entity editors, and the
// References view of VS Code shows them from the active editor: each command opens the editor of its entity on the
// word to look up, then runs the command of the References view.

/** What a navigation command looks up: a class or method by its pls-env id, or a variable of a class. */
export interface NavigationTarget {
	/** `class:Array` or `method:Array>>collect:`. */
	id: string;
	/** A slot or class variable declared by the class definition. */
	variable?: string;
}

const NAVIGATIONS = {
	senders: 'references-view.findReferences',
	implementors: 'references-view.findImplementations',
	references: 'references-view.findReferences',
	callHierarchy: 'references-view.showCallHierarchy',
	typeHierarchy: 'references-view.showTypeHierarchy'
} as const;

/**
 * Answer the target of an argument of a command: a pls-env id, a node of the Projects view, or an item of the class
 * panel (a method, a slot, a trait). Without argument, the class shown by the class panel, if any.
 */
export function navigationTargetOf(argument: unknown, currentClass?: string): NavigationTarget | undefined {
	if (typeof argument === 'string') {
		return { id: argument };
	}
	const item = argument as { kind?: string; id?: string; node?: { id: string }; name?: string; sideId?: string; traitId?: string } | undefined;
	switch (item?.kind) {
		case 'class':
			return item.id ? { id: item.id } : undefined;
		case 'method':
			return item.node ? { id: item.node.id } : item.id ? { id: item.id } : undefined;
		case 'slot':
			return item.sideId && item.name ? { id: `class:${item.sideId.slice('side:'.length).replace(/ class$/, '')}`, variable: item.name } : undefined;
		case 'trait':
			return item.traitId ? { id: item.traitId } : undefined;
	}
	return argument === undefined && currentClass ? { id: `class:${currentClass}` } : undefined;
}

/**
 * Answer the position to look up in the Tonel definition of a class: the declaration of variable, or the name of the class.
 * Positions are zero-based.
 */
export function positionInDefinition(definition: string, variable?: string): { line: number; character: number } {
	const start = Math.max(0, definition.search(/^(Class|Trait)\s*\{/m));
	let index = -1;
	if (variable) {
		const quoted = definition.indexOf(`'${variable}'`, start);
		index = quoted < 0 ? -1 : quoted + 1;
	} else {
		const name = /#name\s*:\s*[#']?/.exec(definition.slice(start));
		index = name ? start + name.index + name[0].length : -1;
	}
	if (index < 0) {
		return { line: 0, character: 0 };
	}
	const before = definition.slice(0, index).split(/\r\n|\r|\n/);
	return { line: before.length - 1, character: before[before.length - 1].length };
}

/** Register the navigation commands, `pharo.nav.<senders|implementors|references|callHierarchy|typeHierarchy>`. */
export function registerNavigationCommands(
	context: vscode.ExtensionContext,
	environment: () => PharoEnvironment | undefined,
	currentClass: () => string | undefined
): void {
	for (const [name, command] of Object.entries(NAVIGATIONS)) {
		context.subscriptions.push(vscode.commands.registerCommand(`pharo.nav.${name}`, (argument?: unknown) =>
			reportErrors(async () => {
				const target = navigationTargetOf(argument, currentClass());
				if (target) {
					await navigate(requireEnvironment(environment), target, command);
				}
			})
		));
	}
}

async function navigate(environment: PharoEnvironment, target: NavigationTarget, command: string): Promise<void> {
	const location = await locationOf(environment, target.id);
	const document = await vscode.workspace.openTextDocument(entityUri(location));
	// A method is looked up from its selector, which starts its source.
	const { line, character } = location.side ? { line: 0, character: 0 } : positionInDefinition(document.getText(), target.variable);
	const position = new vscode.Position(line, character);
	await vscode.window.showTextDocument(document, { preview: true, selection: new vscode.Range(position, position) });
	await vscode.commands.executeCommand(command);
}
