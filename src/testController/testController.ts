import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { client } from '../extension';

type TestResult = {
	failures: any[];
	errors: any[];
	skipped: any[];
	passed: any[];
};

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

	return client.sendRequest('pls:test-packages')
		.then((tests: unknown) => {
			const testArray = tests as any[];
			for (const test of testArray) {
				testController.items.add(getTest(vscode.Uri.parse(test, true), testController));
			}
		});
}

function getTest(uri: vscode.Uri, testController: vscode.TestController, withChildren = true) {
	const existing = testController.items.get(uri.toString(true));
	if (existing) {
		return existing;
	}
	const label = uri.path === '' ? uri.authority : (uri.fragment === '' ? uri.path.split('/').pop() : uri.fragment);
	const file = testController.createTestItem(uri.toString(true), label as string, uri);
	file.canResolveChildren = withChildren;
	return file;
}

function discoverTestOf(testItem: vscode.TestItem, testController: vscode.TestController) {
	if (testItem.parent === undefined) {
		// I am a test package
		client.sendRequest('pls:test-in-package', { "aPackageURI": testItem.uri })
		.then((testClasses: unknown) => {
			const classes = testClasses as any[];
			for (const test of classes) {
				testItem.children.add(getTest(vscode.Uri.parse(test, true), testController));
			}
		});
	}
	else {
		// I am a Test class
		client.sendRequest('pls:test-in-class', { "aClassURI": testItem.uri })
			.then((testMethods: unknown) => {
				const methods = testMethods as any[];
				for (const test of methods) {
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
				run.failed(test, new vscode.TestMessage((e as Error).message), Date.now() - start);
			}
		} else {
			test.children.forEach(test => queue.push(test));
		}
	}

	// Make sure to end the run after all tests have been executed:
	run.end();
}

function assertTestPasses(test: vscode.TestItem): Promise<TestResult> {
	return client.sendRequest('pls:test-execute-test', { "aTestURI": test.uri })
	.then((result: unknown) => {
		return result as TestResult;
	});
}
