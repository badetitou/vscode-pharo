import * as vscode from 'vscode';

const PARTICIPANT_ID = 'pharo-language-server.pharo';

function asPlainText(result: vscode.LanguageModelToolResult): string {
	return result.content
		.map((part) => (part instanceof vscode.LanguageModelTextPart ? part.value : String((part as any)?.value ?? part)))
		.join('');
}

export function toolInfoToChatTool(info: vscode.LanguageModelToolInformation): vscode.LanguageModelChatTool {
	return {
		name: info.name,
		description: info.description,
		inputSchema: info.inputSchema
	};
}

export function getPharoChatTools(tools: readonly vscode.LanguageModelToolInformation[] = vscode.lm.tools): vscode.LanguageModelChatTool[] {
	return tools.filter((tool) => tool.name.startsWith('pharo-')).map(toolInfoToChatTool);
}

export function trimCodeFence(value: string): string {
	const trimmed = value.trim();
	if (!trimmed.startsWith('```')) {
		return trimmed;
	}
	const lines = trimmed.split(/\r?\n/);
	if (lines.length >= 2 && lines[0].startsWith('```') && lines[lines.length - 1].startsWith('```')) {
		return lines.slice(1, -1).join('\n').trim();
	}
	return trimmed;
}

export function parseKeyValuePrompt(prompt: string): Record<string, string> {
	const obj: Record<string, string> = {};
	for (const token of prompt.trim().split(/\s+/).filter(Boolean)) {
		const eq = token.indexOf('=');
		if (eq === -1) {
			continue;
		}
		const key = token.slice(0, eq).trim();
		const value = token.slice(eq + 1).trim();
		if (key) {
			obj[key] = value;
		}
	}
	return obj;
}

export function parseJsonIfPossible(prompt: string): unknown | undefined {
	const trimmed = prompt.trim();
	if (!trimmed.startsWith('{')) {
		return undefined;
	}
	try {
		return JSON.parse(trimmed);
	} catch {
		return undefined;
	}
}

async function invokeAndRenderTool(
	toolName: string,
	input: object,
	request: vscode.ChatRequest,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken
): Promise<void> {
	try {
		const result = await vscode.lm.invokeTool(toolName, {
			toolInvocationToken: request.toolInvocationToken,
			input
		}, token);

		const text = asPlainText(result);
		if (toolName === 'pharo-read-class') {
			stream.markdown(`\n\n\`\`\`smalltalk\n${text}\n\`\`\`\n`);
			return;
		}
		stream.markdown(text ? `\n\n${text}\n` : '\n\n(no result)\n');
	} catch (e) {
		stream.markdown(`\n\nErreur tool **${toolName}**: ${String((e as any)?.message ?? e)}\n`);
	}
}

async function handleExplicitCommand(
	request: vscode.ChatRequest,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken
): Promise<boolean> {
	if (!request.command) {
		return false;
	}

	const prompt = request.prompt ?? '';
	const json = parseJsonIfPossible(prompt);
	const kv = parseKeyValuePrompt(prompt);
	const tokens = prompt.trim().split(/\s+/).filter(Boolean);

	switch (request.command) {
		case 'help': {
			stream.markdown(
				[
					'Commandes disponibles:',
					'- `/createPackage { "packageName": "MyPkg" }`',
					'- `/createClass { "packageName": "MyPkg", "className": "MyClass", "superclassName": "Object", "instanceVariables": "name age" }`',
					'- `/readClass MyClass`',
					'- `/listPackages`',
					'- `/listClasses MyPkg`',
					'- `/eval ```smalltalk ... ```',
					'- `/runClassTests MyTestClass`',
					'- `/runTest { "className": "MyTestClass", "testMethod": "testSomething" }`'
				].join('\n')
			);
			return true;
		}
		case 'createPackage': {
			const packageName = (json as any)?.packageName ?? kv.packageName ?? prompt.trim();
			await invokeAndRenderTool('pharo-create-package', { packageName }, request, stream, token);
			return true;
		}
		case 'createClass': {
			const input = (json && typeof json === 'object') ? (json as any) : {};
			const packageName = input.packageName ?? kv.packageName ?? tokens[0];
			const className = input.className ?? kv.className ?? tokens[1];
			const superclassName = input.superclassName ?? kv.superclassName ?? tokens[2] ?? 'Object';
			const instanceVariables = input.instanceVariables ?? kv.instanceVariables ?? '';

			await invokeAndRenderTool(
				'pharo-create-class',
				{ packageName, className, superclassName, instanceVariables },
				request,
				stream,
				token
			);
			return true;
		}
		case 'readClass': {
			const className = (json as any)?.className ?? kv.className ?? prompt.trim();
			await invokeAndRenderTool('pharo-read-class', { className }, request, stream, token);
			return true;
		}
		case 'listPackages': {
			await invokeAndRenderTool('pharo-list-packages', {}, request, stream, token);
			return true;
		}
		case 'listClasses': {
			const packageName = (json as any)?.packageName ?? kv.packageName ?? prompt.trim();
			await invokeAndRenderTool('pharo-list-classes', { packageName }, request, stream, token);
			return true;
		}
		case 'eval': {
			const code = trimCodeFence(prompt);
			await invokeAndRenderTool('pharo-eval', { code }, request, stream, token);
			return true;
		}
		case 'runClassTests': {
			const className = (json as any)?.className ?? kv.className ?? prompt.trim();
			await invokeAndRenderTool('pharo-run-class-tests', { className }, request, stream, token);
			return true;
		}
		case 'runTest': {
			const input = (json && typeof json === 'object') ? (json as any) : {};
			const className = input.className ?? kv.className ?? '';
			const testMethod = input.testMethod ?? kv.testMethod ?? '';
			await invokeAndRenderTool('pharo-run-test-method', { className, testMethod }, request, stream, token);
			return true;
		}
		default:
			return false;
	}
}

const BASE_PROMPT = [
	'You are a Pharo assistant integrated into VS Code.',
	'Goal: manipulate the Pharo image using the available tools (package/class creation, class reading, execution, tests).',
	'Rules:',
	'- When an action is needed, prefer calling a `pharo-*` tool rather than inventing.',
	'- Ask for clarification if information is missing (package name, class name, etc.).',
	'- Return concise answers',
].join('\n');

function chatContextToModelMessages(chatContext: vscode.ChatContext, maxTurns: number): vscode.LanguageModelChatMessage[] {
	// VS Code only includes turns for the current participant.
	const history = chatContext.history ?? [];

	// Keep the last N turns to avoid prompt bloat.
	const sliced = history.slice(Math.max(0, history.length - maxTurns));

	const messages: vscode.LanguageModelChatMessage[] = [];
	for (const turn of sliced) {
		if (turn instanceof vscode.ChatRequestTurn) {
			const prompt = String((turn as any).prompt ?? '');
			const command = (turn as any).command as (string | undefined);
			const rendered = command ? `/${command}\n${prompt}` : prompt;
			if (rendered.trim().length > 0) {
				messages.push(vscode.LanguageModelChatMessage.User(rendered));
			}
			continue;
		}

		if (turn instanceof vscode.ChatResponseTurn) {
			const parts = (turn as any).response as ReadonlyArray<any> | undefined;
			if (!parts || parts.length === 0) {
				continue;
			}
			// ChatResponseTurn only keeps content parts (e.g. markdown). We fold them into plain text.
			const text = parts
				.map((p) => {
					if (p instanceof vscode.ChatResponseMarkdownPart) {
						return p.value;
					}
					// Fallback for other parts (file tree, buttons, anchors, ...)
					return '';
				})
				.join('')
				.trim();

			// Avoid polluting the next turn with low-signal boilerplate.
			if (text.length > 0 && text !== '(no result)') {
				messages.push(vscode.LanguageModelChatMessage.Assistant(text));
			}
		}
	}

	return messages;
}

export function registerPharoChatParticipant(context: vscode.ExtensionContext): void {
	const handler: vscode.ChatRequestHandler = async (request, chatContext, stream, token) => {
		if (await handleExplicitCommand(request, stream, token)) {
			return;
		}

		const tools = getPharoChatTools();
		if (tools.length === 0) {
			stream.markdown('Aucun tool `pharo-*` n\'est enregistré. Vérifie `contributes.languageModelTools` + `registerTool()`.' );
			return;
		}

		const messages: vscode.LanguageModelChatMessage[] = [
			vscode.LanguageModelChatMessage.User(BASE_PROMPT),
			...chatContextToModelMessages(chatContext, 12),
			vscode.LanguageModelChatMessage.User(request.prompt),
		];

		while (!token.isCancellationRequested) {
			const response = await request.model.sendRequest(messages, {
				justification: 'Manipulation et interrogation d\'une image Pharo via LSP.',
				tools,
				toolMode: vscode.LanguageModelChatToolMode.Auto
			}, token);

			const toolCalls: vscode.LanguageModelToolCallPart[] = [];
			for await (const chunk of response.stream) {
				if (token.isCancellationRequested) {
					break;
				}
				if (chunk instanceof vscode.LanguageModelTextPart) {
					stream.markdown(chunk.value);
				} else if (chunk instanceof vscode.LanguageModelToolCallPart) {
					toolCalls.push(chunk);
				}
			}

			if (toolCalls.length === 0) {
				return;
			}

			messages.push(vscode.LanguageModelChatMessage.Assistant(toolCalls));

			for (const call of toolCalls) {
				let toolResult: vscode.LanguageModelToolResult;
				try {
					toolResult = await vscode.lm.invokeTool(call.name, {
						toolInvocationToken: request.toolInvocationToken,
						input: call.input
					}, token);
				} catch (e) {
					toolResult = new vscode.LanguageModelToolResult([
						new vscode.LanguageModelTextPart(`Erreur tool ${call.name}: ${String((e as any)?.message ?? e)}`)
					]);
				}

				messages.push(
					vscode.LanguageModelChatMessage.User([
						new vscode.LanguageModelToolResultPart(call.callId, toolResult.content)
					])
				);
			}
		}
	};

	const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'pharo-bar.svg');
	context.subscriptions.push(participant);
}
