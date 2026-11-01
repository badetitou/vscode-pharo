import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { imageNameOf } from '../env/entityUri';

// Pages of the playground of an image:
//   pharo-playground:/<image>/<page>.st
// They are files of the global storage of the extension, in one directory per image, so that they are kept with the
// image across windows and reloads. The server binds the variables of a page by the path of its URI.

export const PLAYGROUND_SCHEME = 'pharo-playground';
const PAGE_EXTENSION = '.st';
const PAGE_PREFIX = 'Page ';

/** Answer the directory, in the storage of the extension, of the playground pages of an image. */
export function pagesDirectoryOf(storage: vscode.Uri, pathToImage: string): vscode.Uri {
	const resolved = path.resolve(pathToImage);
	const hash = crypto.createHash('sha1').update(resolved).digest('hex').slice(0, 8);
	return vscode.Uri.joinPath(storage, 'playgrounds', `${imageNameOf(resolved)}-${hash}`);
}

export function pageUri(image: string, page: string): vscode.Uri {
	return vscode.Uri.from({ scheme: PLAYGROUND_SCHEME, path: `/${image}/${page}` });
}

/** Answer the name of the page of a URI, such as `Page 1`. */
export function pageLabelOf(uri: vscode.Uri): string {
	return path.posix.basename(uri.path, PAGE_EXTENSION);
}

/** Answer the file name of the page to create after the existing ones: the first `Page <n>.st` after the highest. */
export function nextPageName(existing: readonly string[]): string {
	const numbers = existing
		.map((name) => new RegExp(`^${PAGE_PREFIX}(\\d+)\\${PAGE_EXTENSION}$`).exec(name))
		.filter((match): match is RegExpExecArray => match !== null)
		.map((match) => Number(match[1]));
	return `${PAGE_PREFIX}${Math.max(0, ...numbers) + 1}${PAGE_EXTENSION}`;
}

/**
 * File system of the playground pages of the active image (scheme `pharo-playground:`), stored as files in a directory
 * of the extension. The pages of another image are not found.
 */
export class PlaygroundFileSystem implements vscode.FileSystemProvider, vscode.Disposable {
	private readonly fileChangeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.fileChangeEmitter.event;

	/** pathToImage answers the active image, or undefined when none is set. */
	constructor(private readonly storage: vscode.Uri, private readonly pathToImage: () => string | undefined) {}

	/** Answer the name of the active image in page URIs, or undefined when none is set. */
	get image(): string | undefined {
		const pathToImage = this.pathToImage();
		return pathToImage ? imageNameOf(pathToImage) : undefined;
	}

	/** Answer the pages of the active image, the most recently changed first. */
	async pages(): Promise<{ uri: vscode.Uri; mtime: number }[]> {
		const image = this.image;
		if (!image) {
			return [];
		}
		const directory = this.directory();
		let entries: [string, vscode.FileType][];
		try {
			entries = await vscode.workspace.fs.readDirectory(directory);
		} catch {
			return [];
		}
		const pages = await Promise.all(entries
			.filter(([name, type]) => type === vscode.FileType.File && name.endsWith(PAGE_EXTENSION))
			.map(async ([name]) => ({
				uri: pageUri(image, name),
				mtime: (await vscode.workspace.fs.stat(vscode.Uri.joinPath(directory, name))).mtime
			})));
		return pages.sort((left, right) => right.mtime - left.mtime);
	}

	/** Create an empty page after the existing ones and answer its URI. */
	async newPage(): Promise<vscode.Uri> {
		const image = this.image;
		if (!image) {
			throw new Error('Set pharo.pathToImage to use the playground.');
		}
		const name = nextPageName((await this.pages()).map(({ uri }) => path.posix.basename(uri.path)));
		const uri = pageUri(image, name);
		await this.writeFile(uri, new Uint8Array(), { create: true, overwrite: false });
		return uri;
	}

	watch(): vscode.Disposable {
		return new vscode.Disposable(() => undefined);
	}

	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		if (uri.path === '/') {
			return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
		}
		return vscode.workspace.fs.stat(this.fileOf(uri));
	}

	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		if (uri.path === '/') {
			return this.image ? [[this.image, vscode.FileType.Directory]] : [];
		}
		return vscode.workspace.fs.readDirectory(this.fileOf(uri));
	}

	async createDirectory(uri: vscode.Uri): Promise<void> {
		await vscode.workspace.fs.createDirectory(this.fileOf(uri));
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		return vscode.workspace.fs.readFile(this.fileOf(uri));
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
		const file = this.fileOf(uri);
		const exists = await this.exists(file);
		if (exists && !options.overwrite) {
			throw vscode.FileSystemError.FileExists(uri);
		}
		if (!exists && !options.create) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		await vscode.workspace.fs.createDirectory(this.directory());
		await vscode.workspace.fs.writeFile(file, content);
		this.fileChangeEmitter.fire([{ type: exists ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created, uri }]);
	}

	async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
		await vscode.workspace.fs.delete(this.fileOf(uri), { recursive: options.recursive, useTrash: false });
		this.fileChangeEmitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
	}

	async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
		await vscode.workspace.fs.rename(this.fileOf(oldUri), this.fileOf(newUri), options);
		this.fileChangeEmitter.fire([
			{ type: vscode.FileChangeType.Deleted, uri: oldUri },
			{ type: vscode.FileChangeType.Created, uri: newUri }
		]);
	}

	dispose(): void {
		this.fileChangeEmitter.dispose();
	}

	private directory(): vscode.Uri {
		const pathToImage = this.pathToImage();
		if (!pathToImage) {
			throw vscode.FileSystemError.Unavailable('Set pharo.pathToImage to use the playground.');
		}
		return pagesDirectoryOf(this.storage, pathToImage);
	}

	/** Answer the file of a page URI, or fail when it belongs to another image than the active one. */
	private fileOf(uri: vscode.Uri): vscode.Uri {
		const [image, ...rest] = uri.path.split('/').filter((segment) => segment.length > 0);
		if (image !== this.image) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		return vscode.Uri.joinPath(this.directory(), ...rest);
	}

	private async exists(file: vscode.Uri): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(file);
			return true;
		} catch {
			return false;
		}
	}
}

/** Answer the range of the paragraph at a line: the lines around it up to a blank line, or undefined on a blank line. */
export function paragraphAt(document: Pick<vscode.TextDocument, 'lineAt' | 'lineCount'>, line: number): vscode.Range | undefined {
	if (document.lineAt(line).isEmptyOrWhitespace) {
		return undefined;
	}
	let start = line;
	while (start > 0 && !document.lineAt(start - 1).isEmptyOrWhitespace) {
		start--;
	}
	let end = line;
	while (end < document.lineCount - 1 && !document.lineAt(end + 1).isEmptyOrWhitespace) {
		end++;
	}
	return new vscode.Range(start, 0, end, document.lineAt(end).text.length);
}

/** Answer the paragraphs of a page, the code blocks separated by blank lines. */
export function paragraphsOf(document: Pick<vscode.TextDocument, 'lineAt' | 'lineCount'>): vscode.Range[] {
	const paragraphs: vscode.Range[] = [];
	for (let line = 0; line < document.lineCount; line++) {
		const paragraph = paragraphAt(document, line);
		if (paragraph) {
			paragraphs.push(paragraph);
			line = paragraph.end.line;
		}
	}
	return paragraphs;
}

/** Answer what to evaluate in an editor, as Pharo does: the selection, or else the line of the cursor. */
export function evaluationRangeOf(document: Pick<vscode.TextDocument, 'lineAt'>, selection: vscode.Selection): vscode.Range {
	return selection.isEmpty ? document.lineAt(selection.active.line).range : selection;
}

/** Answer the text of a Transcript entry for an output channel: Pharo ends its lines with a carriage return. */
export function transcriptText(entry: string): string {
	return entry.replace(/\r\n?/g, '\n');
}
