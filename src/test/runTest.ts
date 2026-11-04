import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
	try {
		// This file runs from dist/test
		const extensionDevelopmentPath = path.resolve(__dirname, '../..');
		const extensionTestsPath = path.resolve(__dirname, './suite/index');
		// VS Code puts its IPC socket in the user data folder, and a socket path over 103 characters fails: the default
		// folder, under the extension, is too deep in a git worktree
		const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pharo-test-'));

		await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs: [`--user-data-dir=${userDataDir}`] });
	} catch (err) {
		process.exit(1);
	}
}

void main();
