import * as assert from 'assert';
import { parseTonelMethods } from '../../tonel';

suite('Pharo Tonel method index', () => {
	test('groups instance and class-side methods by protocol and records source lines', () => {
		const source = [
			'MyClass class {',
			'    #name : #MyClass',
			'}',
			'',
			"{ #category : #accessing }",
			'MyClass >> value [',
			'    ^ 1',
			']',
			'',
			"{ #category : #'printing and testing' }",
			'MyClass >> printOn: aStream [',
			'    aStream nextPutAll: self value asString',
			']',
			'',
			"{ #category : #classSide }",
			'MyClass class >> new [',
			'    ^ super new',
			']'
		].join('\n');

		assert.deepStrictEqual(parseTonelMethods(source), [
			{ id: 'instance:value', selector: 'value', protocol: 'accessing', side: 'instance', startLine: 5 },
			{ id: 'instance:printOn:', selector: 'printOn:', protocol: 'printing and testing', side: 'instance', startLine: 10 },
			{ id: 'class:new', selector: 'new', protocol: 'classSide', side: 'class', startLine: 15 }
		]);
	});

	test('extracts keyword and binary selectors and uses the default protocol', () => {
		const source = [
			'MyClass >> at: index put: value [',
			'    self halt',
			']',
			'MyClass >> + anObject [',
			'    self',
			']'
		].join('\n');

		assert.deepStrictEqual(parseTonelMethods(source).map((method) => method.selector), ['at:put:', '+']);
		assert.ok(parseTonelMethods(source).every((method) => method.protocol === 'as yet unclassified'));
	});
});
