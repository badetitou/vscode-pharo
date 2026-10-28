import * as assert from 'assert';
import { expectPort, expectString, expectStringArray, expectTestResult, isMethodNotFoundError } from '../../rpcContracts';

suite('Pharo JSON-RPC contracts', () => {
	test('accepts string arrays', () => {
		assert.deepStrictEqual(expectStringArray(['pharoImage:/Tests'], 'pls:test-packages'), ['pharoImage:/Tests']);
	});

	test('rejects malformed string arrays with the method name', () => {
		assert.throws(
			() => expectStringArray(['valid', 42], 'pls:test-in-package'),
			/pls:test-in-package.*array of strings/
		);
	});

	test('accepts only valid TCP ports', () => {
		assert.strictEqual(expectPort(1234, 'dap:startServer'), 1234);
		for (const value of [0, 65536, 12.5, '1234', null]) {
			assert.throws(() => expectPort(value, 'dap:startServer'), /dap:startServer.*TCP port/);
		}
	});

	test('validates string responses', () => {
		assert.strictEqual(expectString('pharoImage:/Package/Class.class.st', 'pls-ice:originalResource'), 'pharoImage:/Package/Class.class.st');
		assert.throws(
			() => expectString(42, 'pls-ice:originalResource'),
			/pls-ice:originalResource.*expected a string/
		);
	});

	test('recognizes only JSON-RPC method-not-found errors for compatibility fallback', () => {
		assert.strictEqual(isMethodNotFoundError({ code: -32601 }), true);
		assert.strictEqual(isMethodNotFoundError({ code: -32000 }), false);
		assert.strictEqual(isMethodNotFoundError(new Error('method not found')), false);
	});

	test('validates test result fields', () => {
		assert.deepStrictEqual(
			expectTestResult({ passed: ['TestCase>>testExample'], failures: [], errors: [], skipped: [] }, 'pls:test-execute-test'),
			{ passed: ['TestCase>>testExample'], failures: [], errors: [], skipped: [] }
		);
		assert.throws(
			() => expectTestResult({ passed: 'not-an-array' }, 'pls:test-execute-test'),
			/pls:test-execute-test\.passed.*array of strings/
		);
		assert.throws(
			() => expectTestResult({}, 'pls:test-execute-test'),
			/pls:test-execute-test.*no test result fields/
		);
	});
});
