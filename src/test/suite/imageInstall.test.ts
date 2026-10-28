import * as assert from 'assert';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { installImageDirectory } from '../../imageInstall';

suite('Pharo image installation', () => {
	let rootDirectory: string;
	let sourceDirectory: string;
	let targetDirectory: string;

	setup(async () => {
		rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'pharo-image-install-'));
		sourceDirectory = path.join(rootDirectory, 'download');
		targetDirectory = path.join(rootDirectory, 'images', 'LocalImage');
		await mkdir(sourceDirectory);
	});

	teardown(async () => {
		await rm(rootDirectory, { recursive: true, force: true });
	});

	test('installs and renames a validated image and changes file', async () => {
		await writeFile(path.join(sourceDirectory, 'Pharo.image'), 'new-image');
		await writeFile(path.join(sourceDirectory, 'Pharo.changes'), 'new-changes');

		await installImageDirectory({
			sourceDirectory,
			targetDirectory,
			sourceImageName: 'Pharo',
			localName: 'LocalImage',
			replaceExisting: false
		});

		assert.strictEqual(await readFile(path.join(targetDirectory, 'LocalImage.image'), 'utf8'), 'new-image');
		assert.strictEqual(await readFile(path.join(targetDirectory, 'LocalImage.changes'), 'utf8'), 'new-changes');
	});

	test('refuses an existing installation without changing it', async () => {
		await mkdir(targetDirectory, { recursive: true });
		await writeFile(path.join(targetDirectory, 'LocalImage.image'), 'keep-image');
		await writeFile(path.join(targetDirectory, 'user-data.txt'), 'keep-data');
		await writeFile(path.join(sourceDirectory, 'Pharo.image'), 'new-image');

		await assert.rejects(
			installImageDirectory({
				sourceDirectory,
				targetDirectory,
				sourceImageName: 'Pharo',
				localName: 'LocalImage',
				replaceExisting: false
			}),
			/installation already exists/
		);

		assert.strictEqual(await readFile(path.join(targetDirectory, 'LocalImage.image'), 'utf8'), 'keep-image');
		assert.deepStrictEqual(await readdir(path.dirname(targetDirectory)), ['LocalImage']);
	});

	test('replaces an installation only after validating the new image', async () => {
		await mkdir(targetDirectory, { recursive: true });
		await writeFile(path.join(targetDirectory, 'LocalImage.image'), 'old-image');
		await writeFile(path.join(targetDirectory, 'stale-file.txt'), 'old-data');
		await writeFile(path.join(sourceDirectory, 'Pharo.image'), 'new-image');

		await installImageDirectory({
			sourceDirectory,
			targetDirectory,
			sourceImageName: 'Pharo',
			localName: 'LocalImage',
			replaceExisting: true
		});

		assert.strictEqual(await readFile(path.join(targetDirectory, 'LocalImage.image'), 'utf8'), 'new-image');
		assert.deepStrictEqual(await readdir(targetDirectory), ['LocalImage.image']);
		assert.deepStrictEqual(await readdir(path.dirname(targetDirectory)), ['LocalImage']);
	});

	test('keeps the existing installation when the downloaded image is invalid', async () => {
		await mkdir(targetDirectory, { recursive: true });
		await writeFile(path.join(targetDirectory, 'LocalImage.image'), 'old-image');
		await writeFile(path.join(sourceDirectory, 'Pharo.image'), '');

		await assert.rejects(
			installImageDirectory({
				sourceDirectory,
				targetDirectory,
				sourceImageName: 'Pharo',
				localName: 'LocalImage',
				replaceExisting: true
			}),
			/empty or invalid/
		);

		assert.strictEqual(await readFile(path.join(targetDirectory, 'LocalImage.image'), 'utf8'), 'old-image');
		assert.deepStrictEqual(await readdir(path.dirname(targetDirectory)), ['LocalImage']);
	});

	test('rejects unsafe installation names before creating files', async () => {
		await assert.rejects(
			installImageDirectory({
				sourceDirectory,
				targetDirectory: path.join(rootDirectory, '..'),
				sourceImageName: 'Pharo',
				localName: '..',
				replaceExisting: false
			}),
			/Invalid Pharo image installation name/
		);
		assert.deepStrictEqual(await readdir(rootDirectory), ['download']);
	});
});
