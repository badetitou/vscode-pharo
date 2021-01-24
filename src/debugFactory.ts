import * as vscode from 'vscode';
import { window } from 'vscode';
import { client } from './extension';
import * as Net from 'net';

export class DebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

	async createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable): Promise<vscode.ProviderResult<vscode.DebugAdapterDescriptor>> {

		const port : Promise<number> = client.sendRequest('dap:startServer', { }).then((result: number) => {
			return result;
		})

		// make VS Code connect to debug server
		return new vscode.DebugAdapterServer(await port, 'localhost');
	}

}