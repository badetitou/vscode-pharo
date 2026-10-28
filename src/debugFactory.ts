import * as vscode from 'vscode';
import { client } from './extension';
import { expectPort } from './rpcContracts';

export class DebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
	async createDebugAdapterDescriptor(): Promise<vscode.ProviderResult<vscode.DebugAdapterDescriptor>> {
		const port = expectPort(await client.sendRequest('dap:startServer', {}), 'dap:startServer');
		return new vscode.DebugAdapterServer(port, 'localhost');
	}
}