import * as assert from 'assert';
import * as vscode from 'vscode';
import { executePharoTest, formatTestResult, getTestOutcome } from '../../testController/testController';

suite('Pharo Test Explorer results', () => {
	test('maps Pharo pass, failure, error, and skip payloads to distinct outcomes', () => {
		assert.strictEqual(getTestOutcome({ passed: ['TestCase>>testExample'], failures: [], errors: [], skipped: [] }), 'passed');
		assert.strictEqual(getTestOutcome({ passed: [], failures: ['assertion failed'], errors: [], skipped: [] }), 'failed');
		assert.strictEqual(getTestOutcome({ passed: [], failures: [], errors: ['test setup failed'], skipped: [] }), 'errored');
		assert.strictEqual(getTestOutcome({ passed: [], failures: [], errors: [], skipped: ['disabled'] }), 'skipped');
		assert.strictEqual(getTestOutcome({ passed: [], failures: [], errors: [], skipped: [] }), 'errored');
	});

	test('keeps failure and error details readable', () => {
		assert.strictEqual(
			formatTestResult({ failures: ['expected true'], errors: ['setup failed'], skipped: [] }),
			'Failure: expected true\nError: setup failed'
		);
	});

	test('validates successful, malformed, and JSON-RPC error execution responses', async () => {
		const controller = vscode.tests.createTestController('pharo-test-result-contract', 'Pharo Test Result Contract');
		try {
			const test = controller.createTestItem(
				'test',
				'testExample',
				vscode.Uri.parse('pharoImage:/Tests/TestCase.class.st#testExample', true)
			);
			const requests: Array<{ method: string; params: unknown }> = [];
			const client = {
				isRunning: () => true,
				sendRequest: async (method: string, params: unknown) => {
					requests.push({ method, params });
					return { passed: ['TestCase>>testExample'], failures: [], errors: [], skipped: [] };
				}
			};

			assert.deepStrictEqual(await executePharoTest(client, test), {
				passed: ['TestCase>>testExample'],
				failures: [],
				errors: [],
				skipped: []
			});
			assert.deepStrictEqual(requests[0], {
				method: 'pls:test-execute-test',
				params: { aTestURI: { path: '/Tests/TestCase.class.st', fragment: 'testExample' } }
			});

			await assert.rejects(
				executePharoTest({
					...client,
					sendRequest: async () => ({ passed: 'invalid' })
				}, test),
				/pls:test-execute-test\.passed.*array of strings/
			);
			await assert.rejects(
				executePharoTest({
					...client,
					sendRequest: async () => { throw { code: -32601, message: 'method not found' }; }
				}, test),
				(error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === -32601
			);
		} finally {
			controller.dispose();
		}
	});
});
