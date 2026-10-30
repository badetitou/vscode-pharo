import * as assert from 'assert';
import * as vscode from 'vscode';
import { EnvCompileResult, EnvEntity, EnvSource, ENV_CONFLICT_ERROR_CODE, ENV_UNKNOWN_ENTITY_ERROR_CODE } from '../../env/envContracts';
import { EntityCreatedEvent, EntityEnvironment, PharoEntityFileSystem } from '../../env/entityFileSystem';
import { entityIdOf, entityLabelOf, entityUri, imageNameOf, parseEntityUri } from '../../env/entityUri';

const IMAGE = '/images/PLS.image';

/** An image that holds sources by id, versioned by a counter. A source holding SYNTAX does not compile. */
class FakeImage implements EntityEnvironment {
	readonly image = IMAGE;
	readonly sources = new Map<string, { source: string; version: string }>();
	readonly compilations: Array<{ id: string; source: string; protocol?: string; expectedVersion?: string }> = [];
	private counter = 0;

	put(id: string, source: string): string {
		const version = `v${++this.counter}`;
		this.sources.set(id, { source, version });
		return version;
	}

	async entity(id: string): Promise<EnvEntity> {
		const entry = this.lookup(id);
		return { id, kind: 'method', name: id, parent: null, hasChildren: false, flags: {}, package: 'package:Shop', repository: null, version: entry.version };
	}

	async read(id: string): Promise<EnvSource> {
		const entry = this.lookup(id);
		return { id, source: entry.source, version: entry.version };
	}

	async compile(id: string, source: string, options: { protocol?: string; expectedVersion?: string } = {}): Promise<EnvCompileResult> {
		this.compilations.push({ id, source, ...options });
		const current = this.sources.get(id);
		if (options.expectedVersion !== undefined && current?.version !== options.expectedVersion) {
			throw { code: ENV_CONFLICT_ERROR_CODE, message: `${id} changed in the image`, data: { id, currentVersion: current?.version ?? null } };
		}
		if (source.includes('SYNTAX')) {
			const range = { start: { line: 1, character: 1 }, end: { line: 1, character: 7 } };
			return { compiled: false, id: null, version: null, diagnostics: [{ message: 'Variable or expression expected', severity: 1, range }] };
		}
		const selector = source.split(/\s/)[0];
		const side = id.startsWith('side:') ? id.slice('side:'.length) : id.slice('method:'.length).split('>>')[0];
		const compiledId = id.startsWith('class:') ? id : `method:${side}>>${selector}`;
		const version = this.put(compiledId, source);
		return { compiled: true, id: compiledId, version, diagnostics: [] };
	}

	async remove(id: string): Promise<void> {
		this.sources.delete(id);
	}

	private lookup(id: string): { source: string; version: string } {
		const entry = this.sources.get(id);
		if (!entry) {
			throw { code: ENV_UNKNOWN_ENTITY_ERROR_CODE, message: `Unknown entity ${id}` };
		}
		return entry;
	}
}

const totalUri = entityUri({ image: 'PLS', packageName: 'Shop', className: 'Basket', side: 'instance', selector: 'total' });

function text(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('utf8');
}

function openDocument(uri: vscode.Uri, isDirty = false): vscode.TextDocument {
	return { uri, isDirty } as vscode.TextDocument;
}

suite('Pharo entity URIs', () => {
	test('round-trip classes and methods of both sides', () => {
		for (const location of [
			{ image: 'PLS', packageName: 'Kernel', className: 'Number' },
			{ image: 'PLS', packageName: 'Kernel', className: 'Number', side: 'instance' as const, selector: '//' },
			{ image: 'PLS', packageName: 'Kernel', className: 'Behavior', side: 'instance' as const, selector: '>>' },
			{ image: 'PLS', packageName: 'Collections', className: 'Array', side: 'class' as const, selector: 'new:withAll:' },
			{ image: 'PLS', packageName: 'Collections', className: 'Array', side: 'class' as const, selector: undefined }
		]) {
			assert.deepStrictEqual(parseEntityUri(vscode.Uri.parse(entityUri(location).toString())), location);
		}
	});

	test('match the URIs that the server reads', () => {
		assert.strictEqual(
			entityUri({ image: 'PLS', packageName: 'Kernel', className: 'Number', side: 'instance', selector: '//' }).toString(),
			'pharo:/PLS/Kernel/Number/instance/%252F%252F.st'
		);
		assert.strictEqual(entityUri({ image: 'PLS', packageName: 'Kernel', className: 'Number' }).toString(), 'pharo:/PLS/Kernel/Number.class.st');
		assert.strictEqual(entityUri({ image: 'PLS', packageName: 'Kernel', className: 'Number', side: 'class', selector: 'new:' }).path, '/PLS/Kernel/Number/class/new:.st');
	});

	test('name ids and labels', () => {
		const method = { image: 'PLS', packageName: 'Collections', className: 'Array', side: 'class' as const, selector: 'new:' };
		assert.strictEqual(entityIdOf(method), 'method:Array class>>new:');
		assert.strictEqual(entityLabelOf(method), 'Array class>>new:');
		assert.strictEqual(entityIdOf({ image: 'PLS', packageName: 'Collections', className: 'Array' }), 'class:Array');
		assert.strictEqual(entityIdOf({ ...method, selector: undefined }), undefined);
		assert.strictEqual(imageNameOf('/home/me/images/PLS.image'), 'PLS');
	});

	test('reject other URIs', () => {
		assert.strictEqual(parseEntityUri(vscode.Uri.parse('pharoImage:/Shop/Basket.class.st')), undefined);
		assert.strictEqual(parseEntityUri(vscode.Uri.parse('pharo:/PLS/Shop')), undefined);
		assert.strictEqual(parseEntityUri(vscode.Uri.parse('pharo:/PLS/Shop/Basket/both/total.st')), undefined);
	});

	test('give readable tab titles to method editors', () => {
		const patterns = vscode.workspace.getConfiguration('workbench.editor').get<Record<string, string>>('customLabels.patterns') ?? {};
		assert.strictEqual(patterns['/*/*/*/instance/*.st'], '${dirname(1)}>>${filename}');
		assert.strictEqual(patterns['/*/*/*/class/*.st'], '${dirname(1)} class>>${filename}');
	});
});

suite('Pharo entity editors', () => {
	let image: FakeImage;
	let fileSystem: PharoEntityFileSystem;
	let diagnostics: vscode.DiagnosticCollection;
	let fileChanges: vscode.FileChangeEvent[][];
	let created: EntityCreatedEvent[];

	setup(() => {
		image = new FakeImage();
		image.put('method:Basket>>total', 'total\n\t^ items sum');
		diagnostics = vscode.languages.createDiagnosticCollection('pharo-compile-test');
		fileSystem = new PharoEntityFileSystem(() => image, diagnostics);
		fileChanges = [];
		created = [];
		fileSystem.onDidChangeFile((changes) => fileChanges.push(changes));
		fileSystem.onDidCreateEntity((event) => created.push(event));
	});

	teardown(() => fileSystem.dispose());

	test('reads the source of the image and compiles it on save', async () => {
		const opened = await fileSystem.stat(totalUri);
		assert.strictEqual(text(await fileSystem.readFile(totalUri)), 'total\n\t^ items sum');

		await fileSystem.writeFile(totalUri, Buffer.from('total\n\t^ items inject: 0 into: [ :a :b | a + b ]'));

		assert.deepStrictEqual(image.compilations[0], {
			id: 'method:Basket>>total',
			source: 'total\n\t^ items inject: 0 into: [ :a :b | a + b ]',
			protocol: undefined,
			expectedVersion: 'v1'
		});
		const saved = await fileSystem.stat(totalUri);
		assert.ok(saved.mtime > opened.mtime);
		assert.strictEqual((await fileSystem.stat(totalUri)).mtime, saved.mtime);
		assert.deepStrictEqual(created, []);
	});

	test('keeps a source that does not compile, with its diagnostics', async () => {
		await fileSystem.readFile(totalUri);

		await assert.rejects(
			fileSystem.writeFile(totalUri, Buffer.from('total\n\t^ SYNTAX )')),
			(error: unknown) => error instanceof vscode.FileSystemError && /does not compile: Variable or expression expected/.test(error.message)
		);

		const reported = diagnostics.get(totalUri) ?? [];
		assert.strictEqual(reported.length, 1);
		assert.strictEqual(reported[0].severity, vscode.DiagnosticSeverity.Error);
		assert.deepStrictEqual(reported[0].range, new vscode.Range(1, 1, 1, 7));
		assert.strictEqual(image.sources.get('method:Basket>>total')!.version, 'v1');
	});

	test('a method changed in the image makes VS Code offer to compare or overwrite', async () => {
		const opened = await fileSystem.stat(totalUri);
		await fileSystem.readFile(totalUri);
		image.put('method:Basket>>total', 'total\n\t^ 42');

		// Saved before VS Code saw the change: the server detects the conflict.
		await assert.rejects(fileSystem.writeFile(totalUri, Buffer.from('total\n\t^ 0')), /changed in the image since it was opened/);
		assert.strictEqual(text(await fileSystem.readFile(totalUri)), 'total\n\t^ 42');
		assert.deepStrictEqual(fileChanges, [[{ type: vscode.FileChangeType.Changed, uri: totalUri }]]);
		assert.ok((await fileSystem.stat(totalUri)).mtime > opened.mtime);

		// VS Code then sees a newer file: overwriting compiles against the version it saw.
		await fileSystem.writeFile(totalUri, Buffer.from('total\n\t^ 0'));
		assert.strictEqual(image.compilations[1].expectedVersion, 'v2');
		assert.strictEqual(image.sources.get('method:Basket>>total')!.source, 'total\n\t^ 0');
	});

	test('a method removed from the image is reported missing, and saving creates it again', async () => {
		await fileSystem.readFile(totalUri);
		image.sources.delete('method:Basket>>total');

		await assert.rejects(fileSystem.stat(totalUri), (error: unknown) => error instanceof vscode.FileSystemError && error.code === 'FileNotFound');
		await fileSystem.writeFile(totalUri, Buffer.from('total\n\t^ 0'));

		assert.deepStrictEqual(image.compilations[0], { id: 'side:Basket', source: 'total\n\t^ 0', protocol: undefined, expectedVersion: undefined });
		assert.ok(image.sources.has('method:Basket>>total'));
		assert.deepStrictEqual(created, []);
	});

	test('a renamed selector creates a new method and leaves the edited one unchanged', async () => {
		const opened = await fileSystem.stat(totalUri);
		await fileSystem.readFile(totalUri);

		await fileSystem.writeFile(totalUri, Buffer.from('sum\n\t^ items sum'));

		assert.strictEqual(image.sources.get('method:Basket>>total')!.source, 'total\n\t^ items sum');
		assert.deepStrictEqual(created.map((event) => [event.from.toString(), event.to.toString()]), [
			[totalUri.toString(), entityUri({ image: 'PLS', packageName: 'Shop', className: 'Basket', side: 'instance', selector: 'sum' }).toString()]
		]);
		assert.ok((await fileSystem.stat(totalUri)).mtime > opened.mtime, 'the edited editor reloads');
	});

	test('a new method is compiled in its protocol', async () => {
		const uri = fileSystem.newMethodUri({ image: 'PLS', packageName: 'Shop', className: 'Basket', side: 'class' }, 'instance creation');
		assert.strictEqual(uri.path, '/PLS/Shop/Basket/class/(new method).st');
		assert.match(text(await fileSystem.readFile(uri)), /^selector/);

		await fileSystem.writeFile(uri, Buffer.from('empty\n\t^ self new'));

		assert.deepStrictEqual(image.compilations[0], { id: 'side:Basket class', source: 'empty\n\t^ self new', protocol: 'instance creation', expectedVersion: undefined });
		assert.strictEqual(created[0].to.path, '/PLS/Shop/Basket/class/empty.st');
	});

	test('tells VS Code which open editors changed in the image', () => {
		const other = entityUri({ image: 'PLS', packageName: 'Shop', className: 'Order', side: 'instance', selector: 'total' });
		const cart = entityUri({ image: 'PLS', packageName: 'Shop', className: 'Cart', side: 'instance', selector: 'add:' });
		const definition = entityUri({ image: 'PLS', packageName: 'Shop', className: 'Basket' });
		const documents = [openDocument(totalUri, true), openDocument(other), openDocument(cart), openDocument(definition)];

		fileSystem.applyChanges([
			{ kind: 'changed', id: 'method:Basket>>total', version: 'v9' },
			{ kind: 'renamed', id: 'class:Trolley', oldId: 'class:Cart' }
		], false, documents);

		assert.deepStrictEqual(fileChanges, [[
			{ type: vscode.FileChangeType.Changed, uri: totalUri },
			{ type: vscode.FileChangeType.Deleted, uri: cart }
		]]);
	});

	test('refuses the editors of another image', async () => {
		const otherImage = entityUri({ image: 'Moose', packageName: 'Shop', className: 'Basket', side: 'instance', selector: 'total' });
		await assert.rejects(fileSystem.readFile(otherImage), (error: unknown) => error instanceof vscode.FileSystemError && error.code === 'Unavailable');
	});
});
