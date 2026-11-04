import * as assert from 'assert';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { envCapabilitiesFrom } from '../../env/envContracts';
import { EnvTransport, PharoEnvironment } from '../../env/pharoEnvironment';
import { baselinesOf, gitUrlOf, repositoryNameOf, sourceDirectoryOf } from '../../env/projectLoading';

const project = { id: 'project:Shop', kind: 'project', name: 'Shop', parent: null, hasChildren: true, flags: { volatile: false } };

suite('Loading Pharo projects', () => {
	let workingCopy: string;

	setup(async () => {
		workingCopy = await fs.mkdtemp(path.join(os.tmpdir(), 'pharo-project-'));
	});

	teardown(async () => {
		await fs.rm(workingCopy, { recursive: true, force: true });
	});

	test('reads git URLs and GitHub shorthands', () => {
		assert.strictEqual(gitUrlOf('pharo-graphics/Roassal'), 'https://github.com/pharo-graphics/Roassal.git');
		assert.strictEqual(gitUrlOf(' github.com/pharo-graphics/Roassal.git '), 'https://github.com/pharo-graphics/Roassal.git');
		assert.strictEqual(gitUrlOf('https://gitlab.com/badetitou/spec-fluid.git'), 'https://gitlab.com/badetitou/spec-fluid.git');
		assert.strictEqual(gitUrlOf('git@github.com:badetitou/Pharo-LanguageServer.git'), 'git@github.com:badetitou/Pharo-LanguageServer.git');
		assert.strictEqual(gitUrlOf('Roassal'), undefined);
		assert.strictEqual(gitUrlOf(''), undefined);
	});

	test('names the clone as git does', () => {
		assert.strictEqual(repositoryNameOf('https://github.com/pharo-graphics/Roassal.git'), 'Roassal');
		assert.strictEqual(repositoryNameOf('git@github.com:badetitou/Pharo-LanguageServer.git'), 'Pharo-LanguageServer');
		assert.strictEqual(repositoryNameOf('https://gitlab.com/badetitou/spec-fluid/'), 'spec-fluid');
	});

	test('finds the sources and the baselines from the .project file', async () => {
		await fs.writeFile(path.join(workingCopy, '.project'), "{\n\t'srcDirectory' : 'src'\n}\n");
		await fs.mkdir(path.join(workingCopy, 'src', 'BaselineOfShop'), { recursive: true });
		await fs.mkdir(path.join(workingCopy, 'src', 'BaselineOfAdmin'));
		await fs.mkdir(path.join(workingCopy, 'src', 'Shop-Core'));
		await fs.writeFile(path.join(workingCopy, 'src', 'BaselineOfFile'), '');
		assert.strictEqual(await sourceDirectoryOf(workingCopy), path.join(workingCopy, 'src'));
		assert.deepStrictEqual(await baselinesOf(workingCopy), ['Admin', 'Shop']);
	});

	test('reads the sources in the working copy without .project file', async () => {
		await fs.mkdir(path.join(workingCopy, 'BaselineOfShop'));
		assert.strictEqual(await sourceDirectoryOf(workingCopy), workingCopy);
		assert.deepStrictEqual(await baselinesOf(workingCopy), ['Shop']);
		assert.deepStrictEqual(await baselinesOf(path.join(workingCopy, 'missing')), []);
	});

	test('reads the loadProject capability', () => {
		assert.strictEqual(envCapabilitiesFrom({ 'pls-env': { version: 1, loadProject: true } })?.loadProject, true);
		assert.strictEqual(envCapabilitiesFrom({ 'pls-env': { version: 1 } })?.loadProject, false);
	});

	test('loads a project and asks the projects again', async () => {
		const requests: Array<{ method: string; params: unknown }> = [];
		const transport: EnvTransport = {
			sendRequest: async (method, params) => {
				requests.push({ method, params });
				return method === 'pls-env:loadProject' ? project : [project];
			},
			onNotification: () => new vscode.Disposable(() => undefined)
		};
		const environment = new PharoEnvironment('/images/Shop.image', { version: 1, didChange: false, edit: true, search: false, history: false, loadProject: true }, transport);
		await environment.projects();
		const loaded = await environment.loadProject('/work/Shop', 'Shop');
		await environment.projects();
		assert.strictEqual(loaded.id, 'project:Shop');
		assert.deepStrictEqual(requests.map((request) => request.method), ['pls-env:projects', 'pls-env:loadProject', 'pls-env:projects']);
		assert.deepStrictEqual(requests[1].params, { path: '/work/Shop', baseline: 'Shop', groups: undefined });
	});
});
