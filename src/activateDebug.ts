import * as vscode from 'vscode';

export function activateDebug(context: vscode.ExtensionContext, factory: vscode.DebugAdapterDescriptorFactory) {
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.pharo-debug.debugEditorContents', (resource: vscode.Uri) => {
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				vscode.debug.startDebugging(undefined, {
					type: 'pharodb',
					name: 'Debug File',
					request: 'launch',
					program: targetResource.fsPath
				});
			}
		})
	);


	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pharodb', factory));

}