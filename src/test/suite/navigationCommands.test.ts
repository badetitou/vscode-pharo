import * as assert from 'assert';
import { navigationTargetOf, positionInDefinition } from '../../env/navigationCommands';

const definition = `"
I count, as 'count' says.
"
Class {
	#name : #Counter,
	#superclass : #Object,
	#instVars : [
		'count'
	],
	#classVars : [
		'Default'
	],
	#package : 'Shop-Core'
}`;

suite('Navigation commands', () => {
	test('a pls-env id is its own target', () => {
		assert.deepStrictEqual(navigationTargetOf('method:Array>>collect:'), { id: 'method:Array>>collect:' });
	});

	test('a class of the Projects view is looked up by its id', () => {
		assert.deepStrictEqual(
			navigationTargetOf({ id: 'class:Basket', kind: 'class', name: 'Basket', parent: 'package:Shop-Core', hasChildren: true, flags: {} }),
			{ id: 'class:Basket' }
		);
	});

	test('the items of the class panel are looked up by their entities', () => {
		assert.deepStrictEqual(
			navigationTargetOf({ kind: 'method', key: 'm', parentKey: 'p', node: { id: 'method:Basket class>>new' }, overridden: false }),
			{ id: 'method:Basket class>>new' }
		);
		assert.deepStrictEqual(
			navigationTargetOf({ kind: 'slot', key: 's', parentKey: 'p', name: 'items', sideId: 'side:Basket class', classVariable: false }),
			{ id: 'class:Basket', variable: 'items' }
		);
		assert.deepStrictEqual(navigationTargetOf({ kind: 'trait', key: 't', traitId: 'class:TComparable' }), { id: 'class:TComparable' });
	});

	test('without argument, the target is the class of the panel', () => {
		assert.deepStrictEqual(navigationTargetOf(undefined, 'Basket'), { id: 'class:Basket' });
		assert.strictEqual(navigationTargetOf(undefined), undefined);
		assert.strictEqual(navigationTargetOf({ kind: 'protocol' }, 'Basket'), undefined);
	});

	test('a class definition is looked up from the name of its class', () => {
		assert.deepStrictEqual(positionInDefinition(definition), { line: 4, character: 10 });
	});

	test('a variable is looked up from its declaration, not from the comment', () => {
		assert.deepStrictEqual(positionInDefinition(definition, 'count'), { line: 7, character: 3 });
		assert.deepStrictEqual(positionInDefinition(definition, 'Default'), { line: 10, character: 3 });
	});

	test('an unknown variable falls back to the start of the definition', () => {
		assert.deepStrictEqual(positionInDefinition(definition, 'missing'), { line: 0, character: 0 });
	});
});
