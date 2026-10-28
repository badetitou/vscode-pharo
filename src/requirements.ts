import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface RequirementsData {
	pathToVM: string;
	pathToImage: string;
}

export class RequirementsError extends Error {
	constructor(
		message: string,
		public label: string,
		public command: string,
		public commandParam?: unknown
	) {
		super(message);
		this.name = 'RequirementsError';
	}
}

export async function resolveRequirements(imagePathOverride?: string): Promise<RequirementsData> {
	const configuration = vscode.workspace.getConfiguration('pharo');
	const configuredVM = configuration.get<string>('pathToVM', '').trim();
	const configuredImage = (imagePathOverride ?? configuration.get<string>('pathToImage', '')).trim();

	const pathToVM = await resolveVMPath(configuredVM);
	if (!pathToVM) {
		throw new RequirementsError(
			configuredVM
				? `Pharo VM not found or not executable: ${configuredVM}`
				: 'Set pharo.pathToVM to a Pharo VM executable or command available on PATH.',
			'Open Settings',
			'workbench.action.openSettings',
			'@ext:badetitou.pharo-language-server pharo.pathToVM'
		);
	}

	if (!configuredImage) {
		throw new RequirementsError(
			'Set pharo.pathToImage to a Pharo .image file.',
			'Open Settings',
			'workbench.action.openSettings',
			'@ext:badetitou.pharo-language-server pharo.pathToImage'
		);
	}

	const pathToImage = path.resolve(configuredImage);
	try {
		const imageStat = await fs.promises.stat(pathToImage);
		if (!imageStat.isFile()) {
			throw new Error('not a file');
		}
	} catch {
		throw new RequirementsError(
			`Pharo image not found or not a file: ${configuredImage}`,
			'Open Settings',
			'workbench.action.openSettings',
			'@ext:badetitou.pharo-language-server pharo.pathToImage'
		);
	}

	return { pathToVM, pathToImage };
}

async function resolveVMPath(configuredVM: string): Promise<string | undefined> {
	if (!configuredVM) {
		return undefined;
	}

	const hasPathSeparator = configuredVM.includes('/') || configuredVM.includes('\\');
	const candidates = path.isAbsolute(configuredVM) || hasPathSeparator
		? [path.resolve(configuredVM)]
		: commandCandidates(configuredVM);

	for (const candidate of candidates) {
		try {
			const vmStat = await fs.promises.stat(candidate);
			if (!vmStat.isFile()) {
				continue;
			}
			if (process.platform !== 'win32') {
				await fs.promises.access(candidate, fs.constants.X_OK);
			}
			return candidate;
		} catch {
			continue;
		}
	}

	return undefined;
}

function commandCandidates(command: string): string[] {
	const pathValue = process.env.PATH ?? '';
	const extensions = process.platform === 'win32'
		? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
		: [''];
	const candidates: string[] = [];

	for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
		for (const extension of ['', ...extensions]) {
			const candidate = path.join(directory, command + extension);
			if (!candidates.includes(candidate)) {
				candidates.push(candidate);
			}
		}
	}

	return candidates;
}
