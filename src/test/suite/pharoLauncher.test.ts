import * as assert from 'assert';
import { chmod, mkdir, mkdtemp, rm, utimes, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { findImages, launcherVmForImage, parseImageMetadata, pharoVersionLabel, readLauncherLocations } from '../../pharoLauncher';

const METADATA = `PhLImage {
	#formatNumber : 68021,
	#architecture : '64',
	#pharoVersion : '120',
	#originTemplate : PhLRemoteTemplate {
		#name : 'Moose Suite 12 (stable)',
		#url : URL [ 'https://example.org/Moose12.zip' ]
	},
	#launchConfigurations : OrderedCollection [
		PhLLaunchConfiguration {
			#image : @1,
			#name : 'Default',
			#vm : PhLVirtualMachine {
				#executableRef : FileLocator {
					#path : RelativePath [ '120-x64', 'bin', 'Pharo' ],
					#origin : #launcherVMsLocation
				},
				#id : '120-x64'
			}
		}
	],
	#description : 'It''s mine'
}`;

suite('Pharo Launcher', () => {
	let home: string;
	let userFiles: string;

	setup(async () => {
		home = await mkdtemp(path.join(os.tmpdir(), 'pharo-launcher-'));
		userFiles = path.join(home, 'Documents', 'Pharo');
	});

	teardown(async () => {
		await rm(home, { recursive: true, force: true });
	});

	test('uses the default locations without Pharo Launcher', async () => {
		const locations = await readLauncherLocations(home);

		assert.deepStrictEqual(locations, {
			imagesDirectory: path.join(userFiles, 'images'),
			vmsDirectory: path.join(userFiles, 'vms')
		});
	});

	test('reads the locations from the Pharo Launcher settings', async () => {
		await mkdir(userFiles, { recursive: true });
		await writeFile(path.join(userFiles, 'launcherSettings.ston'), `PharoLauncherCLIConfiguration {
	#imagesDirectory : FILE [ '/data/my images' ],
	#vmsDirectory : FILE [ '/data/vms' ]
}`);

		const locations = await readLauncherLocations(home);

		assert.strictEqual(locations.imagesDirectory, '/data/my images');
		assert.strictEqual(locations.vmsDirectory, '/data/vms');
		assert.strictEqual(locations.settingsFile, path.join(userFiles, 'launcherSettings.ston'));
	});

	test('parses the image metadata', () => {
		const metadata = parseImageMetadata(METADATA, { imagesDirectory: '/images', vmsDirectory: '/vms' });

		assert.deepStrictEqual(metadata, {
			pharoVersion: '120',
			architecture: '64',
			formatNumber: 68021,
			template: 'Moose Suite 12 (stable)',
			description: `It's mine`,
			vmId: '120-x64',
			vmExecutable: path.join('/vms', '120-x64', 'bin', 'Pharo')
		});
		assert.strictEqual(pharoVersionLabel(metadata.pharoVersion), '12.0');
	});

	test('lists the images most recently saved first', async () => {
		const locations = await readLauncherLocations(home);
		const writeImage = async (relativePath: string, savedAt: number) => {
			const imagePath = path.join(locations.imagesDirectory, relativePath);
			await mkdir(path.dirname(imagePath), { recursive: true });
			await writeFile(imagePath, '');
			await utimes(imagePath, savedAt, savedAt);
		};
		await writeImage(path.join('Moose', 'Moose.image'), 1000);
		await writeFile(path.join(locations.imagesDirectory, 'Moose', 'meta-inf.ston'), METADATA);
		await writeImage(path.join('Pair', 'A.image'), 3000);
		await writeImage(path.join('Pair', 'B.image'), 2000);
		await writeImage('Loose.image', 500);

		const images = await findImages(locations);

		assert.deepStrictEqual(images.map((image) => image.label), ['Pair/A', 'Pair/B', 'Moose', 'Loose']);
		assert.strictEqual(images[2].metadata?.template, 'Moose Suite 12 (stable)');
		assert.strictEqual(images[0].metadata, undefined);
	});

	test('finds the VM of the launch configuration, else the one of the Pharo version', async () => {
		const locations = await readLauncherLocations(home);
		const imageDirectory = path.join(locations.imagesDirectory, 'Moose');
		await mkdir(imageDirectory, { recursive: true });
		await writeFile(path.join(imageDirectory, 'meta-inf.ston'), METADATA);
		const imagePath = path.join(imageDirectory, 'Moose.image');

		assert.strictEqual(await launcherVmForImage(imagePath, locations), undefined);

		const vm = path.join(locations.vmsDirectory, '120-x64', 'bin', 'Pharo');
		await mkdir(path.dirname(vm), { recursive: true });
		await writeFile(vm, '');
		await chmod(vm, 0o755);

		assert.strictEqual(await launcherVmForImage(imagePath, locations), vm);
	});
});
