import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	EnvDidChangeParams,
	EnvNode,
	envCapabilitiesFrom,
	envConflictOf,
	expectEnvChildrenPage,
	expectEnvClassification,
	expectEnvCompileResult,
	expectEnvDidChangeParams,
	expectEnvEntity,
	expectEnvNodes,
	expectEnvSearchResult,
	expectEnvSource,
	isEnvUnknownEntityError,
	parseEnvId
} from '../../env/envContracts';
import { EnvTransport, PharoEnvironment, createPharoEnvironment } from '../../env/pharoEnvironment';

// Responses of a Pharo Language Server, recorded from a running image.
const recorded: Record<string, any> = JSON.parse(
	fs.readFileSync(path.resolve(__dirname, '../../../testFixture/env/recorded.json'), 'utf8')
);

type Responder = (method: string, params: any) => unknown;

class FakeTransport implements EnvTransport {
	readonly requests: Array<{ method: string; params: any }> = [];
	readonly tokens: Array<vscode.CancellationToken | undefined> = [];
	notificationHandler: ((params: unknown) => void) | undefined;
	disposed = false;

	constructor(private readonly respond: Responder) { }

	async sendRequest(method: string, params?: unknown, token?: vscode.CancellationToken): Promise<unknown> {
		this.requests.push({ method, params });
		this.tokens.push(token);
		return this.respond(method, params);
	}

	onNotification(method: string, handler: (params: unknown) => void): vscode.Disposable {
		assert.strictEqual(method, 'pls-env/didChange');
		this.notificationHandler = handler;
		return new vscode.Disposable(() => { this.disposed = true; });
	}

	requestsFor(method: string, id?: string): number {
		return this.requests.filter((request) => request.method === method && (id === undefined || request.params?.id === id)).length;
	}
}

function node(id: string, parent: string | null, kind = parseEnvId(id).kind): EnvNode {
	return { id, kind, name: parseEnvId(id).path, parent, hasChildren: kind !== 'method', flags: {} };
}

function page(items: EnvNode[], offset = 0, limit = items.length): { items: EnvNode[]; total: number } {
	return { items: items.slice(offset, offset + limit), total: items.length };
}

const fullCapabilities = { version: 1, didChange: true, edit: true, search: true };

suite('Pharo environment model contracts', () => {
	test('reads the capabilities announced by the server', () => {
		assert.deepStrictEqual(envCapabilitiesFrom(recorded['initialize-capabilities']), fullCapabilities);
		assert.strictEqual(envCapabilitiesFrom(undefined), undefined);
		assert.strictEqual(envCapabilitiesFrom({ 'pls-env': {} }), undefined);
		assert.deepStrictEqual(envCapabilitiesFrom({ 'pls-env': { version: 1 } }), { version: 1, didChange: false, edit: false, search: false });
	});

	test('accepts the recorded responses', () => {
		assert.strictEqual(expectEnvNodes(recorded.projects, 'pls-env:projects')[1].id, 'project:*');
		assert.strictEqual(expectEnvChildrenPage(recorded['children-project'], 'pls-env:children').total, 9);
		assert.strictEqual(expectEnvChildrenPage(recorded['children-class'], 'pls-env:children').items[1].id, 'side:PLSRecordedProbe class');
		assert.strictEqual(expectEnvEntity(recorded['entity-class'], 'pls-env:entity').superclass, 'class:Object');
		assert.strictEqual(expectEnvEntity(recorded['entity-method'], 'pls-env:entity').version, recorded['read-method'].version);
		assert.strictEqual(expectEnvSource(recorded['read-method'], 'pls-env:read').side, 'side:PLSRecordedProbe');
		assert.strictEqual(expectEnvCompileResult(recorded['compile-success'], 'pls-env:compile').compiled, true);
		const failure = expectEnvCompileResult(recorded['compile-failure'], 'pls-env:compile');
		assert.strictEqual(failure.compiled, false);
		assert.deepStrictEqual(failure.diagnostics[0].range.start, { line: 1, character: 10 });
		const search = expectEnvSearchResult(recorded.search, 'pls-env:search');
		assert.strictEqual(search.complete, false);
		assert.deepStrictEqual([search.items[0].id, search.items[0].label], ['method:SequenceableCollection>>collect:', 'Array>>collect:']);
		const changes = expectEnvDidChangeParams(recorded.didChange, 'pls-env/didChange');
		assert.deepStrictEqual(changes.changes[2], { kind: 'renamed', id: 'class:PLSRecordedProbeRenamed', oldId: 'class:PLSRecordedProbe' });
	});

	test('rejects malformed responses with the method name', () => {
		assert.throws(() => expectEnvNodes([{ ...recorded.projects[0], kind: 'package' }], 'pls-env:projects'), /pls-env:projects.*entity kind/);
		assert.throws(() => expectEnvChildrenPage({ items: [] }, 'pls-env:children'), /pls-env:children\.total/);
		assert.throws(() => expectEnvCompileResult({ compiled: true, id: null, version: null, diagnostics: [] }, 'pls-env:compile'), /pls-env:compile.*id and a version/);
		assert.throws(() => expectEnvDidChangeParams({ changes: [{ kind: 'exploded', id: 'class:A' }] }, 'pls-env/didChange'), /change kind/);
		assert.throws(() => expectEnvSearchResult({ items: [{ ...recorded.search.items[0], label: undefined }], complete: true }, 'pls-env:search'), /pls-env:search\.items\.label/);
	});

	test('reads the slots, traits and redefined selectors of a side, and the trait of a method', () => {
		const side = expectEnvEntity({
			id: 'side:Basket', kind: 'side', name: 'instance side', parent: 'class:Basket', hasChildren: true, flags: {},
			package: 'package:Shop', repository: null,
			slots: ['items'], classVariables: ['Default'], traits: ['class:TCountable'], overridden: ['add:']
		}, 'pls-env:entity');
		assert.deepStrictEqual([side.slots, side.classVariables, side.traits, side.overridden], [['items'], ['Default'], ['class:TCountable'], ['add:']]);
		assert.throws(() => expectEnvEntity({ ...side, slots: [1] }, 'pls-env:entity'), /pls-env:entity\.slots/);
		const fromTrait = expectEnvNodes([{ ...recorded.projects[0], id: 'method:Basket>>count', kind: 'method', trait: 'class:TCountable' }], 'pls-env:children');
		assert.strictEqual(fromTrait[0].trait, 'class:TCountable');
		assert.deepStrictEqual(expectEnvClassification({ id: 'method:A>>b', protocol: 'p' }, 'pls-env:classify'), { id: 'method:A>>b', protocol: 'p' });
		assert.throws(() => expectEnvClassification({ id: 'method:A>>b' }, 'pls-env:classify'), /pls-env:classify\.protocol/);
	});

	test('recognizes conflict and unknown entity errors', () => {
		assert.deepStrictEqual(envConflictOf(recorded['error-conflict']), {
			id: 'method:PLSRecordedProbe>>count',
			currentVersion: recorded['error-conflict'].data.currentVersion
		});
		assert.deepStrictEqual(envConflictOf({ code: -32001, data: { id: 'method:A>>b', currentVersion: null } }), { id: 'method:A>>b', currentVersion: null });
		assert.strictEqual(envConflictOf(recorded['error-unknown']), undefined);
		assert.strictEqual(isEnvUnknownEntityError(recorded['error-unknown']), true);
		assert.strictEqual(isEnvUnknownEntityError(recorded['error-conflict']), false);
	});

	test('parses entity ids', () => {
		assert.deepStrictEqual(parseEnvId('method:Behavior>>>>'), { kind: 'method', path: 'Behavior>>>>' });
		assert.deepStrictEqual(parseEnvId('side:Array class'), { kind: 'side', path: 'Array class' });
		assert.throws(() => parseEnvId('nothing'), /Invalid Pharo entity id/);
		assert.throws(() => parseEnvId('foo:Bar'), /Invalid Pharo entity id/);
	});
});

suite('Pharo environment model client', () => {
	test('is only created for a server that announces pls-env', () => {
		const transport = new FakeTransport(() => undefined);
		assert.strictEqual(createPharoEnvironment('/images/Old.image', {}, transport), undefined);
		const environment = createPharoEnvironment('/images/New.image', recorded['initialize-capabilities'], transport);
		assert.ok(environment);
		assert.strictEqual(environment.image, '/images/New.image');
		assert.ok(transport.notificationHandler);
		environment.dispose();
		assert.ok(transport.disposed);
	});

	test('does not listen to changes the server does not send', () => {
		const transport = new FakeTransport(() => undefined);
		new PharoEnvironment('/images/A.image', { version: 1, didChange: false, edit: false, search: false }, transport).dispose();
		assert.strictEqual(transport.notificationHandler, undefined);
	});

	test('searches without caching, and passes the cancellation token', async () => {
		const transport = new FakeTransport(() => recorded.search);
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		const cancellation = new vscode.CancellationTokenSource();
		await environment.search('Array col', { kinds: ['method'], limit: 2 }, cancellation.token);
		await environment.search('Array col', { kinds: ['method'], limit: 2 }, cancellation.token);
		assert.deepStrictEqual(transport.requests[0], { method: 'pls-env:search', params: { query: 'Array col', kinds: ['method'], limit: 2 } });
		assert.strictEqual(transport.requestsFor('pls-env:search'), 2);
		assert.strictEqual(transport.tokens[0], cancellation.token);
		cancellation.dispose();
	});

	test('loads every page of children', async () => {
		const methods = ['a', 'b', 'c', 'd', 'e'].map((selector) => node(`method:A>>${selector}`, 'protocol:A>>p'));
		const transport = new FakeTransport((_method, params) => page(methods, params.offset, params.limit));
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport, 2);
		assert.deepStrictEqual((await environment.children('protocol:A>>p')).map((child) => child.id), methods.map((method) => method.id));
		assert.deepStrictEqual(transport.requests.map((request) => request.params.offset), [0, 2, 4]);
	});

	test('shares one request between callers and caches the answer', async () => {
		const transport = new FakeTransport((method) => method === 'pls-env:projects' ? recorded.projects : recorded['entity-class']);
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		const [first, second] = await Promise.all([environment.projects(), environment.projects()]);
		assert.strictEqual(first, second);
		await environment.projects();
		await environment.entity('class:PLSRecordedProbe');
		await environment.entity('class:PLSRecordedProbe');
		assert.strictEqual(transport.requestsFor('pls-env:projects'), 1);
		assert.strictEqual(transport.requestsFor('pls-env:entity'), 1);
	});

	test('retries a failed request', async () => {
		let fail = true;
		const transport = new FakeTransport(() => {
			if (fail) {
				fail = false;
				throw new Error('image busy');
			}
			return recorded['children-class'];
		});
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		await assert.rejects(environment.children('class:PLSRecordedProbe'), /image busy/);
		assert.strictEqual((await environment.children('class:PLSRecordedProbe')).length, 2);
	});

	test('invalidates what a pls-env/didChange notification changes before telling listeners', async () => {
		const tree: Record<string, EnvNode[]> = {
			'package:PLSRecordedProbe': [node('class:PLSRecordedProbe', 'package:PLSRecordedProbe')],
			'class:PLSRecordedProbe': [node('side:PLSRecordedProbe', 'class:PLSRecordedProbe')],
			'side:PLSRecordedProbe': [],
			'package:Other': [node('class:Other', 'package:Other')]
		};
		const transport = new FakeTransport((method, params) => method === 'pls-env:children' ? page(tree[params.id] ?? []) : recorded['entity-class']);
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		for (const id of Object.keys(tree)) {
			await environment.children(id);
		}
		await environment.entity('class:PLSRecordedProbe');

		const requestsWhenNotified: number[] = [];
		environment.onDidChange(() => {
			void environment.children('side:PLSRecordedProbe');
			requestsWhenNotified.push(transport.requestsFor('pls-env:children', 'side:PLSRecordedProbe'));
		});
		transport.notificationHandler?.(recorded.didChange);

		assert.deepStrictEqual(requestsWhenNotified, [2], 'the cache is invalidated before listeners run');
		await environment.children('package:PLSRecordedProbe');
		await environment.children('class:PLSRecordedProbe');
		await environment.children('package:Other');
		await environment.entity('class:PLSRecordedProbe');
		assert.strictEqual(transport.requestsFor('pls-env:children', 'package:PLSRecordedProbe'), 2, 'the parent of the renamed class is reloaded');
		assert.strictEqual(transport.requestsFor('pls-env:children', 'class:PLSRecordedProbe'), 2, 'the renamed class is forgotten');
		assert.strictEqual(transport.requestsFor('pls-env:children', 'package:Other'), 1, 'unrelated children stay cached');
		assert.strictEqual(transport.requestsFor('pls-env:entity'), 2);
	});

	test('a reset notification clears everything', async () => {
		const transport = new FakeTransport((method) => method === 'pls-env:projects' ? recorded.projects : recorded['children-class']);
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		await environment.projects();
		await environment.children('class:PLSRecordedProbe');
		const notified: EnvDidChangeParams[] = [];
		environment.onDidChange((params) => notified.push(params));
		transport.notificationHandler?.({ changes: [], reset: true });
		await environment.projects();
		await environment.children('class:PLSRecordedProbe');
		assert.strictEqual(transport.requestsFor('pls-env:projects'), 2);
		assert.strictEqual(transport.requestsFor('pls-env:children'), 2);
		assert.deepStrictEqual(notified, [{ changes: [], reset: true }]);
	});

	test('compiling invalidates the compiled entity and the children of its parent', async () => {
		let compileResponse = recorded['compile-failure'];
		const transport = new FakeTransport((method) => {
			switch (method) {
				case 'pls-env:children': return recorded['children-protocol'];
				case 'pls-env:entity': return recorded['entity-method'];
				default: return compileResponse;
			}
		});
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		await environment.children('protocol:PLSRecordedProbe>>accessing');
		await environment.entity('method:PLSRecordedProbe>>count');

		const failure = await environment.compile('method:PLSRecordedProbe>>count', 'count\n\t^ count +');
		assert.strictEqual(failure.compiled, false);
		await environment.entity('method:PLSRecordedProbe>>count');
		assert.strictEqual(transport.requestsFor('pls-env:entity'), 1, 'a failed compilation changes nothing');

		compileResponse = recorded['compile-success'];
		const success = await environment.compile('method:PLSRecordedProbe>>count', 'count\n\t^ count ifNil: [ 0 ]', { expectedVersion: recorded['read-method'].version });
		assert.strictEqual(success.version, recorded['compile-success'].version);
		assert.deepStrictEqual(transport.requests[transport.requests.length - 1].params, {
			id: 'method:PLSRecordedProbe>>count',
			source: 'count\n\t^ count ifNil: [ 0 ]',
			protocol: undefined,
			expectedVersion: recorded['read-method'].version
		});
		await environment.entity('method:PLSRecordedProbe>>count');
		await environment.children('protocol:PLSRecordedProbe>>accessing');
		assert.strictEqual(transport.requestsFor('pls-env:entity'), 2);
		assert.strictEqual(transport.requestsFor('pls-env:children'), 2);
	});

	test('a conflict rejects the compilation with its current version', async () => {
		const transport = new FakeTransport(() => { throw recorded['error-conflict']; });
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		await assert.rejects(
			environment.compile('method:PLSRecordedProbe>>count', 'count ^ 1', { expectedVersion: 'stale' }),
			(error) => envConflictOf(error)?.currentVersion === recorded['error-conflict'].data.currentVersion
		);
	});

	test('removing forgets the entity and its descendants', async () => {
		const tree: Record<string, EnvNode[]> = {
			'package:P': [node('class:A', 'package:P')],
			'class:A': [node('side:A', 'class:A')],
			'side:A': [node('protocol:A>>p', 'side:A')]
		};
		const transport = new FakeTransport((method, params) => method === 'pls-env:children' ? page(tree[params.id]) : recorded.remove);
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		for (const id of Object.keys(tree)) {
			await environment.children(id);
		}
		await environment.remove('class:A');
		for (const id of Object.keys(tree)) {
			await environment.children(id);
		}
		assert.strictEqual(transport.requests.filter((request) => request.method === 'pls-env:children').length, 6);
	});

	test('classifying a method invalidates its old protocol, its new protocol and the protocols of its side', async () => {
		const tree: Record<string, EnvNode[]> = {
			'side:A': [node('protocol:A>>p', 'side:A')],
			'protocol:A>>p': [node('method:A>>m', 'protocol:A>>p')],
			'protocol:A>>q': []
		};
		const transport = new FakeTransport((method, params) => method === 'pls-env:children'
			? page(tree[params.id])
			: { id: params.id, protocol: params.protocol });
		const environment = new PharoEnvironment('/images/A.image', fullCapabilities, transport);
		for (const id of Object.keys(tree)) {
			await environment.children(id);
		}
		assert.deepStrictEqual(await environment.classify('method:A>>m', 'q'), { id: 'method:A>>m', protocol: 'q' });
		for (const id of Object.keys(tree)) {
			await environment.children(id);
		}
		assert.strictEqual(transport.requestsFor('pls-env:children'), 6);
	});
});
