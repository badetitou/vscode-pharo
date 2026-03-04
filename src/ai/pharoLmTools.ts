import * as vscode from 'vscode';
import { client } from '../extension';

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
}
