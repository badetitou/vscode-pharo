import * as assert from 'assert';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { envCapabilitiesFrom } from '../../env/envContracts';
import { EnvTransport, PharoEnvironment } from '../../env/pharoEnvironment';
import { baselinesOf, gitUrlOf, repositoryNameOf, sourceDirectoryOf, writeProject } from '../../env/projectLoading';
import { projectFiles, projectNameProblem } from '../../env/projectTemplate';

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

	test('accepts project names that can name a baseline', () => {
		assert.strictEqual(projectNameProblem('Shop'), undefined);
		assert.strictEqual(projectNameProblem('Shop2'), undefined);
		assert.ok(projectNameProblem(''));
		assert.ok(projectNameProblem('shop'));
		assert.ok(projectNameProblem('My-Shop'));
		assert.ok(projectNameProblem('My Shop'));
	});

	test('writes a new project whose baseline loads its package and its tests', async () => {
		await writeProject(workingCopy, 'Shop');
		assert.deepStrictEqual(await baselinesOf(workingCopy), ['Shop']);
		const baseline = await fs.readFile(path.join(workingCopy, 'src', 'BaselineOfShop', 'BaselineOfShop.class.st'), 'utf8');
		assert.match(baseline, /package: 'Shop';/);
		assert.match(baseline, /package: 'Shop-Tests' with: \[ spec requires: #\( 'Shop' \) \]/);
		const test = await fs.readFile(path.join(workingCopy, 'src', 'Shop-Tests', 'ShopTest.class.st'), 'utf8');
		assert.match(test, /#superclass : 'TestCase'/);
		assert.match(await fs.readFile(path.join(workingCopy, '.smalltalk.ston'), 'utf8'), /#baseline : 'Shop'/);
		assert.match(await fs.readFile(path.join(workingCopy, '.github', 'workflows', 'ci.yml'), 'utf8'), /smalltalkci -s \$\{\{ matrix.smalltalk \}\}/);
		assert.deepStrictEqual(Object.keys(projectFiles('Shop')).sort(), [
			'.github/workflows/ci.yml', '.gitignore', '.project', '.smalltalk.ston', 'README.md', 'src/.properties',
			'src/BaselineOfShop/BaselineOfShop.class.st', 'src/BaselineOfShop/package.st',
			'src/Shop-Tests/ShopTest.class.st', 'src/Shop-Tests/package.st', 'src/Shop/package.st'
		]);
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
