import * as vscode from 'vscode';
import { client, iceControlManager } from '../extension';
import { createTwoFilesPatch } from 'diff';

/** The unified diff of two versions of a resource, '(no changes)' when they are the same. */
export function computeUnifiedDiff(
	originalText: string,
	modifiedText: string,
	originalLabel: string,
	modifiedLabel: string
): string {
	if (originalText === modifiedText) {
		return '(no changes)';
	}
	return createTwoFilesPatch(originalLabel, modifiedLabel, originalText, modifiedText, undefined, undefined, { context: 3 });
}

function ensureClientRunning(): void {
	if (!client) {
		throw new Error('Pharo Language Server is not initialized.');
	}
	if (!client.isRunning()) {
		throw new Error('Pharo Language Server is not running.');
	}
}

function textResult(value: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}

function jsonResult(value: unknown): vscode.LanguageModelToolResult {
	return textResult(JSON.stringify(value, null, 2));
}

export function registerPharoLanguageModelTools(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.lm.registerTool('pharo-create-package', {
			prepareInvocation: ({ input }) => {
				const packageName = (input as { packageName?: string }).packageName ?? '';
				return {
					invocationMessage: `Création du package Pharo: ${packageName}`,
					confirmationMessages: {
						title: 'Créer un package Pharo',
						message: `Créer le package **${packageName}** dans l’image Pharo ?`,
					}
				};
			},
			invoke: async ({ input }) => {
				ensureClientRunning();
				const { packageName } = input as { packageName: string };
				const result = await client.sendRequest('pls:createPackage', { packageName });
				return textResult(String(result));
			}
		})
	);

	// ------------------------------------------------------------------------
	// pharo-ice-list-changes
	// Reads the in-memory SCM state from IceControlManager — ZERO LSP calls.
	// ------------------------------------------------------------------------
	context.subscriptions.push(
		vscode.lm.registerTool('pharo-ice-list-changes', {
			invoke: async ({ input }) => {
				const { repositoryName } = (input ?? {}) as { repositoryName?: string };
				const snapshot = iceControlManager?.getChangesSnapshot() ?? new Map();

				const result: Record<string, { changes: string[]; stagedChanges: string[]; unsavedBuffers: string[] }> = {};
				snapshot.forEach((state, name) => {
					if (repositoryName && name !== repositoryName) { return; }
					result[name] = {
						changes: state.changes.map(r => r.resourceUri.toString(true)),
						stagedChanges: state.stagedChanges.map(r => r.resourceUri.toString(true)),
						unsavedBuffers: state.unsavedBuffers.map(r => r.resourceUri.toString(true))
					};
				});
				return jsonResult(result);
			}
		})
	);

	// ------------------------------------------------------------------------
	// pharo-ice-show-diff
	// Derives the original URI client-side (?iceOriginal=1) — no extra LSP
	// call for pls-ice:originalResource. Only 2 LSP calls: one per readFile.
	// ------------------------------------------------------------------------
	context.subscriptions.push(
		vscode.lm.registerTool('pharo-ice-show-diff', {
			invoke: async ({ input }) => {
				const { uri, repositoryName, openEditor = true } = input as {
					uri: string;
					repositoryName?: string;
					openEditor?: boolean;
				};

				const resourceUri = vscode.Uri.parse(uri, true);

				// Build the original URI without asking the server.
				const originalQuery = new URLSearchParams(resourceUri.query);
				originalQuery.set('iceOriginal', '1');
				const originalUri = resourceUri.with({ query: originalQuery.toString() });

				// Read both sides through the existing FileSystemProvider.
				// Each readFile triggers one LSP call (pls-ice:originalContent / pls:classContent).
				const originalContent = await readOptionalFile(originalUri);
				const modifiedContent = await readOptionalFile(resourceUri);

				if (openEditor) {
					const label = `${resourceUri.path.split('/').pop() ?? uri} (${repositoryName ?? 'Iceberg'})`;
					await vscode.commands.executeCommand('vscode.diff', originalUri, resourceUri, label);
				}

				return textResult(computeUnifiedDiff(
					originalContent,
					modifiedContent,
					originalUri.toString(true),
					uri
				));
			}
		})
	);
}

async function readOptionalFile(uri: vscode.Uri): Promise<string> {
	try {
		return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
	} catch (error) {
		if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
			return '';
		}
		throw error;
	}
}
