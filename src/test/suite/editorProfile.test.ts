import * as assert from 'assert';
import { buildProfileTemplate, PROFILE_NAME } from '../../editorProfile';

suite('Editor profile', () => {
	const template = buildProfileTemplate(
		[{ id: 'badetitou.pharo-language-server', displayName: 'Pharo Language Server' }, { id: 'badetitou.pharo-highlighter' }],
		{ 'pharo.pathToImage': '/images/PLS.image', 'workbench.startupEditor': 'welcomePage' });

	test('keeps the Pharo settings and marks the profile', () => {
		assert.strictEqual(template.name, PROFILE_NAME);
		const settings = JSON.parse(JSON.parse(template.settings).settings);
		assert.strictEqual(settings['pharo.pathToImage'], '/images/PLS.image');
		assert.strictEqual(settings['pharo.editorProfile'], true);
		assert.strictEqual(settings['workbench.startupEditor'], 'none');
	});

	test('only installs the given extensions', () => {
		const extensions = JSON.parse(template.extensions);
		assert.deepStrictEqual(extensions.map((extension: { identifier: { id: string } }) => extension.identifier.id),
			['badetitou.pharo-language-server', 'badetitou.pharo-highlighter']);
	});

	test('only pins the Pharo view containers', () => {
		const storage = JSON.parse(template.globalState).storage;
		const pinned = (key: string) => JSON.parse(storage[key])
			.filter((container: { pinned: boolean }) => container.pinned)
			.map((container: { id: string }) => container.id);
		assert.deepStrictEqual(pinned('workbench.activity.pinnedViewlets2'), ['workbench.view.extension.pharoView']);
		assert.deepStrictEqual(pinned('workbench.auxiliarybar.pinnedPanels'), ['workbench.view.extension.pharoClass']);
		assert.ok(pinned('workbench.panel.pinnedPanels').includes('workbench.view.extension.pharoInspectorPanel'));
		assert.ok(pinned('workbench.panel.pinnedPanels').includes('workbench.panel.output'));
		assert.ok(!pinned('workbench.activity.pinnedViewlets2').includes('workbench.view.explorer'));
	});
});
