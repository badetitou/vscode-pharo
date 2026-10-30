import * as vscode from 'vscode';
import { client } from '../extension';
import { expectStringArray, expectTestResult, PharoTestResult } from '../rpcContracts';
import { parseTonelMethods } from '../tonel';
import { EnvChangeSummary } from '../env/environmentChanges';

interface PharoTestClient {
	isRunning(): boolean;
	sendRequest(method: string, params?: unknown): Promise<unknown>;
}

type TestOutcome = 'passed' | 'failed' | 'errored' | 'skipped';

export function getTestOutcome(result: PharoTestResult): TestOutcome {
	if ((result.failures?.length ?? 0) > 0) {
		return 'failed';
	}
	if ((result.errors?.length ?? 0) > 0 || (result.passed?.length ?? 0) === 0 && (result.skipped?.length ?? 0) === 0) {
		return 'errored';
	}
	if ((result.skipped?.length ?? 0) > 0 && (result.passed?.length ?? 0) === 0) {
		return 'skipped';
	}
	return 'passed';
}

export function formatTestResult(result: PharoTestResult): string {
	const messages = [
		...(result.failures ?? []).map((failure) => `Failure: ${failure}`),
		...(result.errors ?? []).map((error) => `Error: ${error}`),
		...(result.skipped ?? []).map((reason) => `Skipped: ${reason}`)
	];
	return messages.length > 0 ? messages.join('\n') : 'Pharo did not report this test as passed.';
}

export function initTestController(
	testClient: PharoTestClient = client,
	changes: vscode.Event<EnvChangeSummary> = () => new vscode.Disposable(() => undefined)
): vscode.Disposable {
	const testController = vscode.tests.createTestController('pharo-tests', 'Pharo Tests');
	const failedTests = new Map<string, vscode.TestItem>();
	testController.resolveHandler = async (test) => {
		if (!test) {
			await discoverAllTests(testClient, testController);
		} else {
			await discoverTestOf(testClient, test, testController);
		}
	};
	testController.createRunProfile(
		'Pharo Test',
		vscode.TestRunProfileKind.Run,
		(request, token) => runTestHandler(testClient, request, token, testController, failedTests),
		true
	);

	const refreshCommand = vscode.commands.registerCommand('pharo.tests.refresh', async () => {
		testController.items.replace([]);
		failedTests.clear();
		await discoverAllTests(testClient, testController);
	});
	const rerunFailedCommand = vscode.commands.registerCommand('pharo.tests.rerunFailed', async () => {
		const failed = Array.from(failedTests.values());
		if (failed.length === 0) {
			void vscode.window.showInformationMessage('There are no failed Pharo tests to rerun.');
			return;
		}
		const cancellation = new vscode.CancellationTokenSource();
		try {
			await runTestHandler(
				testClient,
				new vscode.TestRunRequest(failed),
				cancellation.token,
				testController,
				failedTests
			);
		} finally {
			cancellation.dispose();
		}
	});

	const changesSubscription = changes((summary) => {
		refreshTestsAfterChanges(testClient, testController, summary).catch((error: unknown) => {
			console.error('Unable to refresh the Pharo tests after a change of the image:', error);
		});
	});

	return vscode.Disposable.from(testController, refreshCommand, rerunFailedCommand, changesSubscription);
}

/**
 * Update the tests that a burst of changes of the image touched. Only the packages and classes already resolved
 * are resolved again; the list of test packages is reloaded on a reset or when a package that it lacks changed.
 */
export async function refreshTestsAfterChanges(
	testClient: PharoTestClient,
	testController: vscode.TestController,
	summary: EnvChangeSummary
): Promise<void> {
	if (!testClient.isRunning()) {
		return;
	}
	const packageItems = new Map<string, vscode.TestItem>();
	testController.items.forEach((item) => packageItems.set(testItemName(item), item));
	if (summary.reset || summary.packagesChanged || [...summary.packages].some((name) => !packageItems.has(name))) {
		await discoverAllTests(testClient, testController);
		testController.items.forEach((item) => packageItems.set(testItemName(item), item));
	}

	const toResolve: vscode.TestItem[] = [];
	for (const [packageName, packageItem] of packageItems) {
		if (packageItem.children.size === 0) {
			continue;
		}
		if (summary.reset || summary.packages.has(packageName)) {
			toResolve.push(packageItem);
		}
		packageItem.children.forEach((classItem) => {
			const className = testItemName(classItem);
			if (classItem.children.size > 0 && (summary.reset || summary.classes.has(className))) {
				toResolve.push(classItem);
			}
		});
	}
	for (const item of toResolve) {
		await discoverTestOf(testClient, item, testController);
	}
}

/** Answer the package or class name of a test item, from the last segment of its URI. */
function testItemName(item: vscode.TestItem): string {
	const segment = decodeURIComponent(item.uri?.path.split('/').pop() ?? item.label);
	return segment.replace(/(\.class)?\.st$/, '');
}

export async function discoverAllTests(testClient: PharoTestClient, testController: vscode.TestController): Promise<void> {
	ensureClientRunning(testClient);
	const tests = expectStringArray(await testClient.sendRequest('pls:test-packages'), 'pls:test-packages');
	const items = tests.map((test) => getTest(vscode.Uri.parse(test, true), true, testController.items, testController));
	testController.items.replace(items);
}

function ensureClientRunning(testClient: PharoTestClient): void {
	if (!testClient.isRunning()) {
		throw new Error('Pharo Language Server is not running.');
	}
}

function getTest(
	uri: vscode.Uri,
	withChildren: boolean,
	parentItems: vscode.TestItemCollection,
	testController: vscode.TestController
): vscode.TestItem {
	const id = uri.toString(true);
	const existing = parentItems.get(id);
	if (existing) {
		existing.canResolveChildren = withChildren;
		existing.tags = [new vscode.TestTag(withChildren ? 'suite' : 'test')];
		return existing;
	}
	const label = uri.fragment || uri.path.split('/').pop() || uri.authority;
	const item = testController.createTestItem(id, label, uri);
	item.canResolveChildren = withChildren;
	item.tags = [new vscode.TestTag(withChildren ? 'suite' : 'test')];
	return item;
}

export async function discoverTestOf(
	testClient: PharoTestClient,
	testItem: vscode.TestItem,
	testController: vscode.TestController
): Promise<void> {
	ensureClientRunning(testClient);
	const uri = testItem.uri;
	if (!uri) {
		throw new Error('Pharo test item has no URI.');
	}

	if (testItem.parent === undefined) {
		const classes = expectStringArray(await testClient.sendRequest('pls:test-in-package', {
			aPackageURI: { path: uri.path }
		}), 'pls:test-in-package');
		testItem.children.replace(classes.map((test) =>
			getTest(vscode.Uri.parse(test, true), true, testItem.children, testController)
		));
		return;
	}

	const methods = expectStringArray(await testClient.sendRequest('pls:test-in-class', {
		aClassURI: {
			path: uri.path,
			external: uri.toString(true)
		}
	}), 'pls:test-in-class');
	testItem.children.replace(methods.map((test) =>
		getTest(vscode.Uri.parse(test, true), false, testItem.children, testController)
	));
}

async function runTestHandler(
	testClient: PharoTestClient,
	request: vscode.TestRunRequest,
	token: vscode.CancellationToken,
	testController: vscode.TestController,
	failedTests: Map<string, vscode.TestItem>
): Promise<void> {
	const run = testController.createTestRun(request);
	const queue = [...(request.include ?? collectRootTests(testController))];
	const excludedIds = new Set((request.exclude ?? []).map((test) => test.id));
	const queuedIds = new Set(queue.map((test) => test.id));
	let next = 0;

	const enqueueChildren = (item: vscode.TestItem) => {
		item.children.forEach((child) => {
			if (!queuedIds.has(child.id)) {
				queuedIds.add(child.id);
				queue.push(child);
			}
		});
	};

	try {
		while (next < queue.length && !token.isCancellationRequested) {
			const test = queue[next++];
			if (excludedIds.has(test.id)) {
				run.skipped(test);
				continue;
			}

			if (test.canResolveChildren && test.children.size === 0) {
				run.enqueued(test);
				try {
					await discoverTestOf(testClient, test, testController);
				} catch (error) {
					const message = new vscode.TestMessage(error instanceof Error ? error.message : String(error));
					run.errored(test, message);
					failedTests.set(test.id, test);
					continue;
				}
			}

			if (test.canResolveChildren) {
				if (test.children.size === 0) {
					run.skipped(test);
					continue;
				}
				run.enqueued(test);
				enqueueChildren(test);
				continue;
			}

			run.enqueued(test);
			run.started(test);
			const startedAt = Date.now();
			try {
				const result = await executePharoTest(testClient, test);
				const duration = Date.now() - startedAt;
				switch (getTestOutcome(result)) {
					case 'passed':
						run.passed(test, duration);
						failedTests.delete(test.id);
						break;
					case 'failed':
						run.failed(test, await testMessagesFor(test, result), duration);
						failedTests.set(test.id, test);
						break;
					case 'errored':
						run.errored(test, await testMessagesFor(test, result), duration);
						failedTests.set(test.id, test);
						break;
					case 'skipped':
						run.skipped(test);
						failedTests.delete(test.id);
						break;
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				run.errored(test, await testMessageFor(test, message), Date.now() - startedAt);
				failedTests.set(test.id, test);
			}
		}

		while (next < queue.length) {
			run.skipped(queue[next++]);
		}
	} finally {
		run.end();
	}
}

function collectRootTests(testController: vscode.TestController): vscode.TestItem[] {
	const tests: vscode.TestItem[] = [];
	testController.items.forEach((test) => tests.push(test));
	return tests;
}

export async function executePharoTest(
	testClient: PharoTestClient,
	test: vscode.TestItem
): Promise<PharoTestResult> {
	ensureClientRunning(testClient);
	const uri = test.uri;
	if (!uri) {
		throw new Error('Pharo test item has no URI.');
	}
	const result = await testClient.sendRequest('pls:test-execute-test', {
		aTestURI: {
			path: uri.path,
			fragment: uri.fragment
		}
	});
	return expectTestResult(result, 'pls:test-execute-test');
}

async function testMessagesFor(test: vscode.TestItem, result: PharoTestResult): Promise<vscode.TestMessage[]> {
	const details = formatTestResult(result).split('\n');
	return Promise.all(details.map((detail) => testMessageFor(test, detail)));
}

async function testMessageFor(test: vscode.TestItem, message: string): Promise<vscode.TestMessage> {
	const testMessage = new vscode.TestMessage(message);
	const uri = test.uri;
	if (!uri || uri.scheme !== 'pharoImage' || !uri.path.endsWith('.class.st')) {
		return testMessage;
	}

	const sourceUri = uri.with({ fragment: '' });
	try {
		const document = await vscode.workspace.openTextDocument(sourceUri);
		const method = uri.fragment
			? parseTonelMethods(document.getText()).find((candidate) => candidate.selector === uri.fragment)
			: undefined;
		const line = method?.startLine ?? 0;
		const position = new vscode.Position(Math.min(line, document.lineCount - 1), 0);
		testMessage.location = new vscode.Location(sourceUri, new vscode.Range(position, position));
	} catch (error) {
		testMessage.message = `${message}\nUnable to resolve the test source location: ${error instanceof Error ? error.message : String(error)}`;
	}
	return testMessage;
}
