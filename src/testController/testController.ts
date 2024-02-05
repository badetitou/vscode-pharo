import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { client } from '../extension';

export function initTestController() {
	const testController = vscode.tests.createTestController('pharo-tests', 'Pharo Tests');
	testController.resolveHandler = async test => {
		if (!test) {
			await discoverAllTests(client, testController);
		} else {
			await discoverTestOf(test, testController);
		}
	};
	testController.createRunProfile(
		'Pharo Test',
		vscode.TestRunProfileKind.Run,
		(request, token) => {
			runTestHandler(false, request, token, testController);
		}
	);
}

export async function discoverAllTests(client: LanguageClient, testController: vscode.TestController) {
	if (!client.isRunning()) {
		return []; // handle the case of no open folders
	}

	return client.sendRequest('pls:test-packages').then((tests: any[]) => {
		for (const test of tests) {
			testController.items.add(getTest(vscode.Uri.parse(test, true), testController));
		}
	});
}

function getTest(uri: vscode.Uri, testController: vscode.TestController, withChildren = true) {
	const existing = testController.items.get(uri.toString());
	if (existing) {
		return existing;
	}
	const label = uri.path === '' ? uri.authority : (uri.fragment === '' ? uri.path.split('/').pop() : uri.fragment);
	const file = testController.createTestItem(uri.toString(), label, uri);
	file.canResolveChildren = withChildren;
	return file;
}

function discoverTestOf(testItem: vscode.TestItem, testController: vscode.TestController) {
	if (testItem.parent === undefined) {
		// I am a test package
		client.sendRequest('pls:test-in-package', { "aPackageURI": testItem.uri }).then((testClasses: any[]) => {
			for (const test of testClasses) {
				testItem.children.add(getTest(vscode.Uri.parse(test, true), testController));
			}
		});
	}
	else {
		// I am a Test class
		client.sendRequest('pls:test-in-class', { "aClassURI": testItem.uri }).then((testMethods: any[]) => {
			for (const test of testMethods) {
				testItem.children.add(getTest(vscode.Uri.parse(test, true), testController, false));
			}
		});
	}
}

async function runTestHandler(
	shouldDebug: boolean,
	request: vscode.TestRunRequest,
	token: vscode.CancellationToken,
	testController: vscode.TestController
) {
	const run = testController.createTestRun(request);
	const queue: vscode.TestItem[] = [];

	// Loop through all included tests, or all known tests, and add them to our queue
	if (request.include) {
		request.include.forEach(test => queue.push(test));
	} else {
		testController.items.forEach(test => queue.push(test));
	}

	// For every test that was queued, try to run it. Call run.passed() or run.failed().
	// The `TestMessage` can contain extra information, like a failing location or
	// a diff output. But here we'll just give it a textual message.
	while (queue.length > 0 && !token.isCancellationRequested) {
		const test = queue.pop()!;

		// Skip tests the user asked to exclude
		if (request.exclude?.includes(test)) {
			continue;
		}

		// Otherwise, just run the test case. Note that we don't need to manually
		// set the state of parent tests; they'll be set automatically.
		const start = Date.now();
		if (test.children.size === 0) {
			try {
				const result = await assertTestPasses(test);
				result.passed.length === 0 ? run.failed(test, new vscode.TestMessage('fail')) : run.passed(test, Date.now() - start);
			} catch (e) {
				run.failed(test, new vscode.TestMessage(e.message), Date.now() - start);
			}
		} else {
			test.children.forEach(test => queue.push(test));
		}
	}

	// Make sure to end the run after all tests have been executed:
	run.end();
}

function assertTestPasses(test: vscode.TestItem): Promise<{ failures: any[], errors: any[], skipped: any[], passed: any[] }> {
	return client.sendRequest('pls:test-execute-test', { "aTestURI": test.uri }).then((result: { failures: any[], errors: any[], skipped: any[], passed: any[] }) => {
		console.log(result);
		return result;
	});
}
