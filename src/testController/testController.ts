import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { client } from '../extension';

type TestResult = {
	failures?: unknown[];
	errors?: unknown[];
	skipped?: unknown[];
	passed?: unknown[];
};

export function initTestController(): vscode.TestController {
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
			void runTestHandler(request, token, testController);
		}
	);
	return testController;
}

export async function discoverAllTests(client: LanguageClient, testController: vscode.TestController) {
	if (!client.isRunning()) {
		return;
	}

	const tests = await client.sendRequest('pls:test-packages') as string[];
	for (const test of tests) {
		testController.items.add(getTest(vscode.Uri.parse(test, true), testController));
	}
}

function getTest(
	uri: vscode.Uri,
	testController: vscode.TestController,
	withChildren = true,
	parentItems: vscode.TestItemCollection = testController.items
) {
	const existing = parentItems.get(uri.toString(true));
	if (existing) {
		return existing;
	}
	const label = uri.path === '' ? uri.authority : (uri.fragment === '' ? uri.path.split('/').pop() : uri.fragment);
	const file = testController.createTestItem(uri.toString(true), label as string, uri);
	file.canResolveChildren = withChildren;
	return file;
}

async function discoverTestOf(testItem: vscode.TestItem, testController: vscode.TestController) {
	if (!client.isRunning()) {
		throw new Error('Pharo Language Server is not running.');
	}

	const uri = testItem.uri;
	if (!uri) {
		throw new Error('Pharo test item has no URI.');
	}

	if (testItem.parent === undefined) {
		const classes = await client.sendRequest('pls:test-in-package', {
			aPackageURI: { path: uri.path }
		}) as string[];
		for (const test of classes) {
			testItem.children.add(getTest(vscode.Uri.parse(test, true), testController, true, testItem.children));
		}
	}
	else {
		const methods = await client.sendRequest('pls:test-in-class', {
			aClassURI: {
				path: uri.path,
				external: uri.toString(true)
			}
		}) as string[];
		for (const test of methods) {
			testItem.children.add(getTest(vscode.Uri.parse(test, true), testController, false, testItem.children));
		}
	}
}

async function runTestHandler(
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

	try {
		while (queue.length > 0 && !token.isCancellationRequested) {
			const test = queue.pop()!;
			if (request.exclude?.includes(test)) {
				run.skipped(test);
				continue;
			}

			if (test.canResolveChildren && test.children.size === 0) {
				run.enqueued(test);
				try {
					await discoverTestOf(test, testController);
				} catch (error) {
					run.failed(test, new vscode.TestMessage(error instanceof Error ? error.message : String(error)));
					continue;
				}
			}

			if (test.children.size > 0) {
				run.enqueued(test);
				test.children.forEach(child => queue.push(child));
				continue;
			}

			run.enqueued(test);
			run.started(test);
			const start = Date.now();
			try {
				const result = await assertTestPasses(test);
				const failures = [...(result.failures ?? []), ...(result.errors ?? [])];
				if ((result.skipped?.length ?? 0) > 0 && (result.passed?.length ?? 0) === 0 && failures.length === 0) {
					run.skipped(test);
				} else if (failures.length > 0 || (result.passed?.length ?? 0) === 0) {
					run.failed(test, new vscode.TestMessage(formatTestResult(result)), Date.now() - start);
				} else {
					run.passed(test, Date.now() - start);
				}
			} catch (error) {
				run.failed(
					test,
					new vscode.TestMessage(error instanceof Error ? error.message : String(error)),
					Date.now() - start
				);
			}
		}
		while (queue.length > 0) {
			run.skipped(queue.pop()!);
		}
	} finally {
		run.end();
	}
}

function assertTestPasses(test: vscode.TestItem): Promise<TestResult> {
	const uri = test.uri;
	if (!uri) {
		throw new Error('Pharo test item has no URI.');
	}

	return client.sendRequest('pls:test-execute-test', {
		aTestURI: {
			path: uri.path,
			fragment: uri.fragment
		}
	})
	.then((result: unknown) => {
		if (!result || typeof result !== 'object') {
			throw new Error('Pharo returned an invalid test result.');
		}
		return result as TestResult;
	});
}

function formatTestResult(result: TestResult): string {
	const failures = [...(result.failures ?? []), ...(result.errors ?? [])];
	if (failures.length === 0) {
		return 'Pharo did not report this test as passed.';
	}
	return failures.map((failure) => {
		if (typeof failure === 'string') {
			return failure;
		}
		try {
			return JSON.stringify(failure);
		} catch {
			return String(failure);
		}
	}).join('\n');
}
