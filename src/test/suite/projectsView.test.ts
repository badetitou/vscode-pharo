import * as assert from 'assert';
import * as vscode from 'vscode';
import { EnvEntity, EnvNode, expectEnvEntity, parseEnvId } from '../../env/envContracts';
import { PharoEnvironment } from '../../env/pharoEnvironment';
import {
	ProjectsTreeProvider,
	ProjectsViewState,
	classDefinitionInTag,
	classNameOfEditor,
	isActiveFilter,
	visibleProjects
} from '../../env/projectsView';

function node(id: string, parent: string | null, flags: Record<string, boolean> = {}): EnvNode {
	const { kind, path } = parseEnvId(id);
	return { id, kind, name: kind === 'tag' ? path.split('/')[1] : path === '*' ? 'Volatile' : path, parent, hasChildren: kind !== 'class', flags };
}

// An image with a project in an Iceberg repository, one outside any repository, and the volatile project.
const projects = [node('project:Shop', null), node('project:Moose', null), node('project:*', null, { volatile: true })];
const children: Record<string, EnvNode[]> = {
	'project:Shop': [node('package:Shop-Core', 'project:Shop'), node('package:Shop-Tests', 'project:Shop', { test: true })],
	'project:Moose': [node('package:Moose-Core', 'project:Moose')],
	'project:*': [node('package:Scratch', 'project:*')],
	'package:Shop-Core': [
		node('tag:Shop-Core/Model', 'package:Shop-Core'),
		node('class:ShopRoot', 'package:Shop-Core'),
		node('extensions:Shop-Core', 'package:Shop-Core')
	],
	'tag:Shop-Core/Model': [node('class:Basket', 'tag:Shop-Core/Model')]
};
const entities: Record<string, Partial<EnvEntity>> = {
	'project:Shop': { repository: 'shop', modified: true },
	'package:Shop-Core': { package: 'package:Shop-Core', repository: 'shop', modified: false },
	'tag:Shop-Core/Model': { package: 'package:Shop-Core', repository: 'shop' },
	'class:Basket': { package: 'package:Shop-Core', repository: 'shop' }
};

function fakeEnvironment(): PharoEnvironment {
	const all = [...projects, ...Object.values(children).flat()];
	return new PharoEnvironment('/images/Shop.image', { version: 1, didChange: false, edit: true, search: false }, {
		async sendRequest(method: string, params?: any): Promise<unknown> {
			switch (method) {
				case 'pls-env:projects':
					return projects;
				case 'pls-env:children':
					return { items: children[params.id] ?? [], total: (children[params.id] ?? []).length };
				case 'pls-env:entity': {
					const found = all.find((candidate) => candidate.id === params.id);
					return { ...found, package: null, repository: null, ...entities[params.id] };
				}
				default:
					throw new Error(`Unexpected request ${method}`);
			}
		},
		onNotification: () => new vscode.Disposable(() => undefined)
	});
}

const defaultState: ProjectsViewState = { pinned: [], hidden: [], showAll: false };

suite('Projects view', () => {
	test('shows by default the projects of an Iceberg repository and the volatile project', () => {
		const repositoryOf = (id: string) => id === 'project:Shop' ? 'shop' : null;
		assert.deepStrictEqual(visibleProjects(projects, repositoryOf, defaultState).map((project) => project.id), ['project:Shop', 'project:*']);
	});

	test('shows pinned projects first, and never hidden ones unless all projects are shown', () => {
		const repositoryOf = (id: string) => id === 'project:Shop' ? 'shop' : null;
		const state = { pinned: ['project:Moose'], hidden: ['project:*'], showAll: false };
		assert.deepStrictEqual(visibleProjects(projects, repositoryOf, state).map((project) => project.id), ['project:Moose', 'project:Shop']);
		assert.deepStrictEqual(
			visibleProjects(projects, repositoryOf, { ...state, showAll: true }).map((project) => project.id),
			['project:Moose', 'project:Shop', 'project:*']
		);
	});

	test('a filter needs three characters', () => {
		assert.strictEqual(isActiveFilter('Sh'), false);
		assert.strictEqual(isActiveFilter(' Sho '), true);
	});

	test('moves a new class definition to a tag', () => {
		const definition = "Class {\n\t#name : 'Basket',\n\t#superclass : 'Object',\n\t#package : 'Shop-Core'\n}";
		assert.strictEqual(
			classDefinitionInTag(definition, 'Model'),
			"Class {\n\t#name : 'Basket',\n\t#superclass : 'Object',\n\t#package : 'Shop-Core',\n\t#tag : 'Model'\n}"
		);
		assert.strictEqual(
			classDefinitionInTag("Class {\n\t#package : 'Shop-Core',\n\t#tag : 'Old'\n}", "It's"),
			"Class {\n\t#package : 'Shop-Core',\n\t#tag : 'It''s'\n}"
		);
	});

	test('knows the class of an entity editor and of a pharoImage class file', () => {
		assert.strictEqual(classNameOfEditor(vscode.Uri.parse('pharo:/Shop/Shop-Core/Basket/class/new.st')), 'Basket');
		assert.strictEqual(classNameOfEditor(vscode.Uri.parse('pharo:/Shop/Shop-Core/Basket.class.st')), 'Basket');
		assert.strictEqual(classNameOfEditor(vscode.Uri.parse('pharoImage:/Shop-Core/Basket.class.st')), 'Basket');
		assert.strictEqual(classNameOfEditor(vscode.Uri.parse('pharoImage:/Shop-Core')), undefined);
		assert.strictEqual(classNameOfEditor(vscode.Uri.parse('file:///tmp/Basket.class.st')), undefined);
	});

	test('reads whether a project or package is modified', () => {
		assert.strictEqual(expectEnvEntity({ ...projects[0], package: null, repository: 'shop', modified: true }, 'pls-env:entity').modified, true);
		assert.strictEqual(expectEnvEntity({ ...projects[0], package: null, repository: null }, 'pls-env:entity').modified, undefined);
		assert.throws(() => expectEnvEntity({ ...projects[0], package: null, repository: null, modified: 'yes' }, 'pls-env:entity'));
	});

	test('lists projects, packages, tags and classes, without extension methods', async () => {
		const provider = new ProjectsTreeProvider(() => defaultState);
		provider.setEnvironment(fakeEnvironment());
		const roots = await provider.getChildren();
		assert.deepStrictEqual(roots.map((root) => root.id), ['project:Shop', 'project:*']);
		const packages = await provider.getChildren(roots[0]);
		assert.deepStrictEqual(packages.map((child) => child.id), ['package:Shop-Core', 'package:Shop-Tests']);
		assert.deepStrictEqual((await provider.getChildren(packages[0])).map((child) => child.id), ['tag:Shop-Core/Model', 'class:ShopRoot']);
		assert.deepStrictEqual(await provider.getChildren(node('class:Basket', 'tag:Shop-Core/Model')), []);
		provider.dispose();
	});

	test('shows the Iceberg repository and the modified state of a project', async () => {
		const provider = new ProjectsTreeProvider(() => ({ ...defaultState, pinned: ['project:Shop'] }));
		provider.setEnvironment(fakeEnvironment());
		const project = await provider.getTreeItem(projects[0]);
		assert.strictEqual(project.description, '● shop');
		assert.strictEqual(project.contextValue, 'pharo.project pinned shown iceberg');
		assert.strictEqual((await provider.getTreeItem(children['project:Shop'][0])).description, 'shop');
		const basket = await provider.getTreeItem(children['tag:Shop-Core/Model'][0]);
		assert.strictEqual(basket.collapsibleState, vscode.TreeItemCollapsibleState.None);
		assert.deepStrictEqual(basket.command?.arguments, ['class:Basket']);
		provider.dispose();
	});

	test('filters projects and packages by name, among every project not hidden', async () => {
		const provider = new ProjectsTreeProvider(() => defaultState);
		provider.setFilter('core');
		provider.setEnvironment(fakeEnvironment());
		const roots = await provider.getChildren();
		assert.deepStrictEqual(roots.map((root) => root.id), ['project:Shop', 'project:Moose']);
		assert.deepStrictEqual((await provider.getChildren(roots[0])).map((child) => child.id), ['package:Shop-Core']);
		provider.setFilter('moose');
		const moose = (await provider.getChildren())[0];
		assert.deepStrictEqual((await provider.getChildren(moose)).map((child) => child.id), ['package:Moose-Core']);
		provider.dispose();
	});

	test('reveals a class only when the view shows its project', async () => {
		const provider = new ProjectsTreeProvider(() => defaultState);
		const environment = fakeEnvironment();
		provider.setEnvironment(environment);
		await environment.children('project:Shop');
		const basket = await provider.classNodeOf('Basket');
		assert.strictEqual(basket?.id, 'class:Basket');
		const tag = await provider.getParent(basket as EnvNode);
		assert.strictEqual(tag?.id, 'tag:Shop-Core/Model');
		assert.strictEqual((await provider.getParent(tag as EnvNode))?.id, 'package:Shop-Core');

		const hiding = new ProjectsTreeProvider(() => ({ ...defaultState, hidden: ['project:Shop'] }));
		hiding.setEnvironment(environment);
		assert.strictEqual(await hiding.classNodeOf('Basket'), undefined);
		provider.dispose();
		hiding.dispose();
	});
});
