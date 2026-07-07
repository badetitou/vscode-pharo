import * as vscode from 'vscode';
import { client, iceControlManager } from '../extension';

// ---------------------------------------------------------------------------
// Unified-diff utilities — no external dependencies
// ---------------------------------------------------------------------------

type DiffOp = { type: 'equal' | 'delete' | 'insert'; line: string };

function lcsMatrix(a: string[], b: string[]): number[][] {
	const m = a.length, n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = a[i - 1] === b[j - 1]
				? dp[i - 1][j - 1] + 1
				: Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}
	return dp;
}

function diffLines(a: string[], b: string[]): DiffOp[] {
	const dp = lcsMatrix(a, b);
	const ops: DiffOp[] = [];
	let i = a.length, j = b.length;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
			ops.unshift({ type: 'equal', line: a[i - 1] });
			i--; j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			ops.unshift({ type: 'insert', line: b[j - 1] });
			j--;
		} else {
			ops.unshift({ type: 'delete', line: a[i - 1] });
			i--;
		}
	}
	return ops;
}

function computeUnifiedDiff(
	originalText: string,
	modifiedText: string,
	originalLabel: string,
	modifiedLabel: string,
	context = 3
): string {
	const originalLines = originalText.split('\n');
	const modifiedLines = modifiedText.split('\n');
	const ops = diffLines(originalLines, modifiedLines);
	const n = ops.length;

	const changed = new Set<number>();
	ops.forEach((op, idx) => { if (op.type !== 'equal') { changed.add(idx); } });

	if (changed.size === 0) { return '(no changes)'; }

	const inHunk = new Array<boolean>(n).fill(false);
	changed.forEach((idx) => {
		for (let k = Math.max(0, idx - context); k <= Math.min(n - 1, idx + context); k++) {
			inHunk[k] = true;
		}
	});

	const out: string[] = [`--- ${originalLabel}`, `+++ ${modifiedLabel}`];
	let origLine = 1, modLine = 1, pos = 0;
	while (pos < n) {
		if (!inHunk[pos]) {
			const op = ops[pos];
			if (op.type !== 'insert') { origLine++; }
			if (op.type !== 'delete') { modLine++; }
			pos++;
			continue;
		}
		const hunkStartOrig = origLine, hunkStartMod = modLine;
		const hunkOps: DiffOp[] = [];
		while (pos < n && inHunk[pos]) { hunkOps.push(ops[pos++]); }
		let origCount = 0, modCount = 0;
		for (const op of hunkOps) {
			if (op.type !== 'insert') { origCount++; }
			if (op.type !== 'delete') { modCount++; }
		}
		out.push(`@@ -${hunkStartOrig},${origCount} +${hunkStartMod},${modCount} @@`);
		for (const op of hunkOps) {
			if (op.type === 'equal')  { out.push(` ${op.line}`); origLine++; modLine++; }
			if (op.type === 'delete') { out.push(`-${op.line}`); origLine++; }
			if (op.type === 'insert') { out.push(`+${op.line}`); modLine++; }
		}
	}
	return out.join('\n');
}

// ---------------------------------------------------------------------------

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

	context.subscriptions.push(
		vscode.lm.registerTool('pharo-create-class', {
			prepareInvocation: ({ input }) => {
				const { packageName, className } = input as { packageName?: string; className?: string };
				return {
					invocationMessage: `Création de la classe Pharo: ${packageName ?? ''}/${className ?? ''}`,
					confirmationMessages: {
						title: 'Créer une classe Pharo',
						message: `Créer la classe **${className ?? ''}** dans le package **${packageName ?? ''}** ?`,
					}
				};
			},
			invoke: async ({ input }) => {
				ensureClientRunning();
				const {
					packageName,
					className,
					superclassName = 'Object',
					instanceVariables = ''
				} = input as {
					packageName: string;
					className: string;
					superclassName?: string;
					instanceVariables?: string;
				};
				const result = await client.sendRequest('pls:createClass', {
					packageName,
					className,
					superclassName,
					instanceVariables
				});
				return textResult(String(result));
			}
		})
	);

	context.subscriptions.push(
		vscode.lm.registerTool('pharo-read-class', {
			invoke: async ({ input }) => {
				ensureClientRunning();
				const { className } = input as { className: string };
				const content = await client.sendRequest('pls:classContent', { class: className });
				return textResult(String(content));
			}
		})
	);

	context.subscriptions.push(
		vscode.lm.registerTool('pharo-list-packages', {
			invoke: async () => {
				ensureClientRunning();
				const packages = await client.sendRequest('pls:packages', {});
				return jsonResult(packages);
			}
		})
	);

	context.subscriptions.push(
		vscode.lm.registerTool('pharo-list-classes', {
			invoke: async ({ input }) => {
				ensureClientRunning();
				const { packageName } = input as { packageName: string };
				const classes = await client.sendRequest('pls:classes', { package: packageName });
				return jsonResult(classes);
			}
		})
	);

	context.subscriptions.push(
		vscode.lm.registerTool('pharo-eval', {
			prepareInvocation: ({ input }) => {
				const code = (input as { code?: string }).code ?? '';
				return {
					invocationMessage: 'Exécution de code Pharo',
					confirmationMessages: {
						title: 'Exécuter du code Pharo',
						message: new vscode.MarkdownString(
							`Exécuter ce code dans l’image Pharo ?\n\n\`\`\`smalltalk\n${code}\n\`\`\``
						)
					}
				};
			},
			invoke: async ({ input }) => {
				ensureClientRunning();
				const { code } = input as { code: string };
				const activeUri = vscode.window.activeTextEditor?.document?.uri;
				const textDocumentURI = activeUri ?? vscode.Uri.from({ scheme: 'pharoImage', path: '/' });
				const result = await client.sendRequest('command:printIt', { line: code, textDocumentURI });
				return textResult(String(result));
			}
		})
	);

	context.subscriptions.push(
		vscode.lm.registerTool('pharo-run-class-tests', {
			prepareInvocation: ({ input }) => {
				const className = (input as { className?: string }).className ?? '';
				return {
					invocationMessage: `Exécution des tests: ${className}`,
					confirmationMessages: {
						title: 'Exécuter les tests',
						message: `Lancer tous les tests de la classe **${className}** ?`,
					}
				};
			},
			invoke: async ({ input }) => {
				ensureClientRunning();
				const { className } = input as { className: string };
				const result = await client.sendRequest('pls:executeClassTests', { className });
				return textResult(String(result));
			}
		})
	);

	context.subscriptions.push(
		vscode.lm.registerTool('pharo-run-test-method', {
			prepareInvocation: ({ input }) => {
				const { className, testMethod } = input as { className?: string; testMethod?: string };
				return {
					invocationMessage: `Exécution du test: ${className ?? ''}>>${testMethod ?? ''}`,
					confirmationMessages: {
						title: 'Exécuter un test',
						message: `Lancer **${className ?? ''}>>${testMethod ?? ''}** ?`,
					}
				};
			},
			invoke: async ({ input }) => {
				ensureClientRunning();
				const { className, testMethod } = input as { className: string; testMethod: string };
				const result = await client.sendRequest('pls:executeClassTest', { class: className, testMethod });
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

				const result: Record<string, { changes: string[]; stagedChanges: string[] }> = {};
				snapshot.forEach((state, name) => {
					if (repositoryName && name !== repositoryName) { return; }
					result[name] = {
						changes: state.changes.map(r => r.resourceUri.toString()),
						stagedChanges: state.stagedChanges.map(r => r.resourceUri.toString())
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
				const existingQuery = resourceUri.query ? `${resourceUri.query}&iceOriginal=1` : 'iceOriginal=1';
				const originalUri = resourceUri.with({ query: existingQuery });

				// Read both sides through the existing FileSystemProvider.
				// Each readFile triggers one LSP call (pls-ice:originalContent / pls:classContent).
				let originalContent = '';
				try {
					originalContent = Buffer.from(await vscode.workspace.fs.readFile(originalUri)).toString('utf8');
				} catch {
					// new/untracked file: no original
				}

				let modifiedContent = '';
				try {
					modifiedContent = Buffer.from(await vscode.workspace.fs.readFile(resourceUri)).toString('utf8');
				} catch {
					// deleted file
				}

				if (openEditor) {
					const label = `${resourceUri.path.split('/').pop() ?? uri} (${repositoryName ?? 'Iceberg'})`;
					await vscode.commands.executeCommand('vscode.diff', originalUri, resourceUri, label);
				}

				return textResult(computeUnifiedDiff(
					originalContent,
					modifiedContent,
					originalUri.toString(),
					uri
				));
			}
		})
	);
}
