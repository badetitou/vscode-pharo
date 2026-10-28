import { randomUUID } from 'crypto';
import { copyFile, lstat, mkdir, readdir, rename, rm, stat } from 'fs/promises';
import * as path from 'path';

export interface ImageInstallResult {
	backupDirectory?: string;
	backupCleanupError?: string;
}

export interface ImageInstallOptions {
	sourceDirectory: string;
	targetDirectory: string;
	sourceImageName: string;
	localName: string;
	replaceExisting: boolean;
}

export async function installImageDirectory(options: ImageInstallOptions): Promise<ImageInstallResult> {
	const parentDirectory = path.dirname(options.targetDirectory);
	const targetName = path.basename(options.targetDirectory);
	if (!isSafeImageName(options.localName) || targetName !== options.localName || !isSafeImageName(options.sourceImageName)) {
		throw new Error('Invalid Pharo image installation name.');
	}

	await mkdir(parentDirectory, { recursive: true });

	const stageDirectory = path.join(parentDirectory, `.${targetName}.install-${randomUUID()}`);
	const backupDirectory = path.join(parentDirectory, `.${targetName}.backup-${randomUUID()}`);
	let movedExistingInstallation = false;

	try {
		await mkdir(stageDirectory);
		await copyDirectoryContents(options.sourceDirectory, stageDirectory);
		await normalizeImageFiles(stageDirectory, options.sourceImageName, options.localName);
		await validateImage(path.join(stageDirectory, `${options.localName}.image`));

		const targetExists = await directoryExists(options.targetDirectory);
		if (targetExists && !options.replaceExisting) {
			throw new Error(`An installation already exists at ${options.targetDirectory}.`);
		}
		if (targetExists) {
			await rename(options.targetDirectory, backupDirectory);
			movedExistingInstallation = true;
		}

		try {
			await rename(stageDirectory, options.targetDirectory);
		} catch (error) {
			if (movedExistingInstallation) {
				try {
					await rename(backupDirectory, options.targetDirectory);
					movedExistingInstallation = false;
				} catch (restoreError) {
					throw new Error(
						`Unable to install the new image (${formatError(error)}) or restore the existing installation (${formatError(restoreError)}). The previous installation remains at ${backupDirectory}.`
					);
				}
			}
			throw error;
		}
	} catch (error) {
		try {
			await rm(stageDirectory, { recursive: true, force: true });
		} catch (cleanupError) {
			throw new Error(`${formatError(error)} Temporary installation cleanup also failed: ${formatError(cleanupError)}`);
		}
		throw error;
	}

	if (!movedExistingInstallation) {
		return {};
	}

	try {
		await rm(backupDirectory, { recursive: true });
		return {};
	} catch (error) {
		return {
			backupDirectory,
			backupCleanupError: formatError(error)
		};
	}
}

async function copyDirectoryContents(source: string, destination: string): Promise<void> {
	const entries = await readdir(source, { withFileTypes: true });
	for (const entry of entries) {
		const sourcePath = path.join(source, entry.name);
		const destinationPath = path.join(destination, entry.name);
		if (entry.isDirectory()) {
			await mkdir(destinationPath);
			await copyDirectoryContents(sourcePath, destinationPath);
		} else if (entry.isFile()) {
			await copyFile(sourcePath, destinationPath);
		} else {
			throw new Error(`Unsupported file in downloaded image: ${sourcePath}`);
		}
	}
}

async function normalizeImageFiles(directory: string, sourceImageName: string, localName: string): Promise<void> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
	const sourceImage = files.find((name) => name === `${sourceImageName}.image`)
		?? files.find((name) => name.toLowerCase().endsWith('.image'));
	if (!sourceImage) {
		throw new Error(`Downloaded archive does not contain a Pharo image: ${directory}`);
	}

	const targetImage = `${localName}.image`;
	if (sourceImage !== targetImage) {
		if (files.includes(targetImage)) {
			throw new Error(`Downloaded archive contains multiple possible images, including ${targetImage}.`);
		}
		await rename(path.join(directory, sourceImage), path.join(directory, targetImage));
	}

	const sourceChanges = files.find((name) => name === `${sourceImageName}.changes`)
		?? files.find((name) => name === `${path.basename(sourceImage, '.image')}.changes`)
		?? files.find((name) => name.toLowerCase().endsWith('.changes'));
	const targetChanges = `${localName}.changes`;
	if (sourceChanges && sourceChanges !== targetChanges) {
		if (files.includes(targetChanges)) {
			throw new Error(`Downloaded archive contains multiple possible changes files, including ${targetChanges}.`);
		}
		await rename(path.join(directory, sourceChanges), path.join(directory, targetChanges));
	}
}

async function validateImage(imagePath: string): Promise<void> {
	const imageStat = await stat(imagePath);
	if (!imageStat.isFile() || imageStat.size === 0) {
		throw new Error(`Downloaded Pharo image is empty or invalid: ${imagePath}`);
	}
}

async function directoryExists(directory: string): Promise<boolean> {
	try {
		await lstat(directory);
		return true;
	} catch (error) {
		if (isNodeError(error) && error.code === 'ENOENT') {
			return false;
		}
		throw error;
	}
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && 'code' in error && typeof error.code === 'string';
}

function isSafeImageName(name: string): boolean {
	return name.length > 0
		&& name !== '.'
		&& name !== '..'
		&& !/[\\/<>:"|?*\x00-\x1f]/.test(name)
		&& !/[. ]$/.test(name);
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
