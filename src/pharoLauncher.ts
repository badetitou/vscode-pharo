import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/*
 * Reads the files Pharo Launcher keeps on disk, so that the extension lists the same images and runs them with the
 * same VMs. Nothing here depends on Pharo Launcher being installed: without its settings file, the default locations
 * are used.
 */

/** Where the images and VMs live. */
export interface LauncherLocations {
	imagesDirectory: string;
	vmsDirectory: string;
	/** The Pharo Launcher settings file, when Pharo Launcher is installed. */
	settingsFile?: string;
}

/** What Pharo Launcher knows about an image, read from the meta-inf.ston next to it. */
export interface LauncherImageMetadata {
	/** As stored by Pharo Launcher, for example '120' for Pharo 12.0. */
	pharoVersion?: string;
	architecture?: string;
	formatNumber?: number;
	/** The name of the template the image was created from. */
	template?: string;
	description?: string;
	/** The VM of the first launch configuration of the image. */
	vmId?: string;
	vmExecutable?: string;
}

export interface LauncherImage {
	imagePath: string;
	/** The name of the image, or folder/image when its folder holds several images. */
	label: string;
	lastModified: number;
	metadata?: LauncherImageMetadata;
}

const SETTINGS_FILE_NAME = 'launcherSettings.ston';
const METADATA_FILE_NAME = 'meta-inf.ston';
const STON_STRING = `'((?:[^']|'')*)'`;

/** The folders where Pharo Launcher may keep its user files, most likely first. */
function launcherUserFilesCandidates(home: string): string[] {
	return [path.join(home, 'Documents', 'Pharo'), path.join(home, 'Pharo')];
}

export async function readLauncherLocations(home: string = os.homedir()): Promise<LauncherLocations> {
	for (const candidate of launcherUserFilesCandidates(home)) {
		const settingsFile = path.join(candidate, SETTINGS_FILE_NAME);
		let source: string;
		try {
			source = await fs.promises.readFile(settingsFile, 'utf8');
		} catch {
			continue;
		}
		return {
			imagesDirectory: fileField(source, 'imagesDirectory') ?? path.join(candidate, 'images'),
			vmsDirectory: fileField(source, 'vmsDirectory') ?? path.join(candidate, 'vms'),
			settingsFile
		};
	}
	const defaultUserFiles = launcherUserFilesCandidates(home)[0];
	return {
		imagesDirectory: path.join(defaultUserFiles, 'images'),
		vmsDirectory: path.join(defaultUserFiles, 'vms')
	};
}

export async function readImageMetadata(imageDirectory: string, locations: LauncherLocations): Promise<LauncherImageMetadata | undefined> {
	let source: string;
	try {
		source = await fs.promises.readFile(path.join(imageDirectory, METADATA_FILE_NAME), 'utf8');
	} catch {
		return undefined;
	}
	const metadata = parseImageMetadata(source, locations);
	if (!metadata.description) {
		try {
			metadata.description = (await fs.promises.readFile(path.join(imageDirectory, 'description.txt'), 'utf8')).trim() || undefined;
		} catch {
			// The description is optional
		}
	}
	return metadata;
}

export function parseImageMetadata(source: string, locations: LauncherLocations): LauncherImageMetadata {
	const formatNumber = Number(source.match(/#formatNumber\s*:\s*(\d+)/)?.[1]);
	const template = source.match(new RegExp(`#originTemplate\\s*:\\s*\\w+\\s*\\{[^{}]*?#name\\s*:\\s*${STON_STRING}`))?.[1];
	const launchConfigurations = source.slice(Math.max(0, source.indexOf('#launchConfigurations')));
	return {
		pharoVersion: stringField(source, 'pharoVersion'),
		architecture: stringField(source, 'architecture'),
		formatNumber: Number.isFinite(formatNumber) ? formatNumber : undefined,
		template: template === undefined ? undefined : stonString(template),
		description: stringField(source, 'description'),
		vmId: source.includes('#launchConfigurations') ? stringField(launchConfigurations, 'id') : undefined,
		vmExecutable: source.includes('#launchConfigurations') ? executableField(launchConfigurations, locations) : undefined
	};
}

/** Answers 12.0 for the '120' Pharo Launcher stores. */
export function pharoVersionLabel(pharoVersion: string | undefined): string | undefined {
	if (!pharoVersion) {
		return undefined;
	}
	return /^\d{2,}$/.test(pharoVersion) ? `${pharoVersion.slice(0, -1)}.${pharoVersion.slice(-1)}` : pharoVersion;
}

/** The images directly in the images directory and in its sub folders, most recently saved first. */
export async function findImages(locations: LauncherLocations): Promise<LauncherImage[]> {
	const root = locations.imagesDirectory;
	let entries: fs.Dirent[];
	try {
		entries = await fs.promises.readdir(root, { withFileTypes: true });
	} catch {
		return [];
	}

	const images: LauncherImage[] = [];
	const addImagesOf = async (directory: string, folderName?: string) => {
		let names: string[];
		try {
			names = (await fs.promises.readdir(directory, { withFileTypes: true }))
				.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.image'))
				.map((entry) => entry.name);
		} catch {
			return;
		}
		const metadata = folderName && names.length > 0 ? await readImageMetadata(directory, locations) : undefined;
		for (const name of names) {
			const imagePath = path.join(directory, name);
			const imageName = path.basename(name, path.extname(name));
			let lastModified = 0;
			try {
				lastModified = (await fs.promises.stat(imagePath)).mtimeMs;
			} catch {
				continue;
			}
			images.push({
				imagePath,
				label: folderName === undefined ? imageName : (names.length === 1 ? folderName : `${folderName}/${imageName}`),
				lastModified,
				// The metadata of a folder describes its image only when it holds a single one
				metadata: names.length === 1 ? metadata : undefined
			});
		}
	};

	await addImagesOf(root);
	await Promise.all(entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => addImagesOf(path.join(root, entry.name), entry.name)));
	return images.sort((left, right) => right.lastModified - left.lastModified || left.label.localeCompare(right.label));
}

/**
 * The VM Pharo Launcher would run the image with: the VM of its launch configuration, else the VM Pharo Launcher
 * downloaded for its Pharo version. Answers undefined when no such VM is installed.
 */
export async function launcherVmForImage(imagePath: string, locations?: LauncherLocations): Promise<string | undefined> {
	const resolvedLocations = locations ?? await readLauncherLocations();
	const metadata = await readImageMetadata(path.dirname(imagePath), resolvedLocations);
	if (!metadata) {
		return undefined;
	}
	const candidates = [metadata.vmExecutable];
	if (metadata.pharoVersion) {
		const vmId = `${metadata.pharoVersion}-${metadata.architecture === '32' ? 'x86' : 'x64'}`;
		candidates.push(vmExecutableIn(path.join(resolvedLocations.vmsDirectory, vmId)));
	}
	for (const candidate of candidates) {
		if (candidate && await isExecutableFile(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

function vmExecutableIn(vmDirectory: string): string {
	if (process.platform === 'darwin') {
		return path.join(vmDirectory, 'Pharo.app', 'Contents', 'MacOS', 'Pharo');
	}
	if (process.platform === 'win32') {
		return path.join(vmDirectory, 'Pharo.exe');
	}
	return path.join(vmDirectory, 'pharo');
}

async function isExecutableFile(candidate: string): Promise<boolean> {
	try {
		if (!(await fs.promises.stat(candidate)).isFile()) {
			return false;
		}
		if (process.platform !== 'win32') {
			await fs.promises.access(candidate, fs.constants.X_OK);
		}
		return true;
	} catch {
		return false;
	}
}

function stonString(raw: string): string {
	return raw.replace(/''/g, `'`);
}

function stringField(source: string, name: string): string | undefined {
	const raw = source.match(new RegExp(`#${name}\\s*:\\s*${STON_STRING}`))?.[1];
	return raw === undefined ? undefined : stonString(raw);
}

function fileField(source: string, name: string): string | undefined {
	const raw = source.match(new RegExp(`#${name}\\s*:\\s*FILE\\s*\\[\\s*${STON_STRING}\\s*\\]`))?.[1];
	return raw === undefined ? undefined : stonString(raw);
}

/** Reads #executableRef, either an absolute FILE or a FileLocator relative to a Pharo Launcher location. */
function executableField(source: string, locations: LauncherLocations): string | undefined {
	const absolute = fileField(source, 'executableRef');
	if (absolute) {
		return absolute;
	}
	const locator = source.match(/#executableRef\s*:\s*FileLocator\s*\{\s*#path\s*:\s*RelativePath\s*\[([^\]]*)\]\s*,\s*#origin\s*:\s*#(\w+)/);
	if (!locator) {
		return undefined;
	}
	const segments = [...locator[1].matchAll(new RegExp(STON_STRING, 'g'))].map((match) => stonString(match[1]));
	const origin = {
		launcherVMsLocation: locations.vmsDirectory,
		launcherImagesLocation: locations.imagesDirectory,
		home: os.homedir()
	}[locator[2]];
	return origin === undefined ? undefined : path.join(origin, ...segments);
}
