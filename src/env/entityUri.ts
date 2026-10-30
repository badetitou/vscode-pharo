import * as path from 'path';
import * as vscode from 'vscode';

// URIs of the entity editors, shared with the Pharo Language Server (docs/environment-model.md, "Method documents"):
//   pharo:/<image>/<package>/<class>.class.st                        definition and comment of a class
//   pharo:/<image>/<package>/<class>/<instance|class>/<selector>.st  one method

export const ENTITY_SCHEME = 'pharo';
/** Selector segment of the editor of a method not compiled yet. No selector holds parentheses. */
export const NEW_METHOD_SEGMENT = '(new method)';

const CLASS_SUFFIX = '.class.st';
const METHOD_SUFFIX = '.st';

export type EntitySide = 'instance' | 'class';

export interface EntityLocation {
	image: string;
	packageName: string;
	className: string;
	/** Undefined for a class definition. */
	side?: EntitySide;
	/** Undefined for a class definition and for a new method. */
	selector?: string;
}

/** Answer the name of an image as it appears in entity URIs: the file name of the image without `.image`. */
export function imageNameOf(pathToImage: string): string {
	return path.basename(pathToImage).replace(/\.image$/, '');
}

export function entityUri(location: EntityLocation): vscode.Uri {
	const segments = [location.image, location.packageName];
	if (location.side) {
		segments.push(location.className, location.side, `${escapeSelector(location.selector ?? NEW_METHOD_SEGMENT)}${METHOD_SUFFIX}`);
	} else {
		segments.push(`${location.className}${CLASS_SUFFIX}`);
	}
	return vscode.Uri.from({ scheme: ENTITY_SCHEME, path: `/${segments.join('/')}` });
}

/** Answer the entity an editor URI names, or undefined for a URI of another scheme or shape. */
export function parseEntityUri(uri: vscode.Uri): EntityLocation | undefined {
	if (uri.scheme !== ENTITY_SCHEME) {
		return undefined;
	}
	const segments = uri.path.split('/').filter((segment) => segment.length > 0);
	if (segments.length === 3 && segments[2].endsWith(CLASS_SUFFIX)) {
		return { image: segments[0], packageName: segments[1], className: segments[2].slice(0, -CLASS_SUFFIX.length) };
	}
	if (segments.length === 5 && (segments[3] === 'instance' || segments[3] === 'class') && segments[4].endsWith(METHOD_SUFFIX)) {
		const selector = segments[4].slice(0, -METHOD_SUFFIX.length);
		return {
			image: segments[0],
			packageName: segments[1],
			className: segments[2],
			side: segments[3],
			selector: selector === NEW_METHOD_SEGMENT ? undefined : unescapeSelector(selector)
		};
	}
	return undefined;
}

/** Answer the pls-env id of the class or method of a location, or undefined for a new method. */
export function entityIdOf(location: EntityLocation): string | undefined {
	if (!location.side) {
		return `class:${location.className}`;
	}
	return location.selector === undefined ? undefined : `method:${sidePathOf(location)}>>${location.selector}`;
}

/** Answer the pls-env id of the side of a method location. */
export function sideIdOf(location: EntityLocation): string {
	return `side:${sidePathOf(location)}`;
}

/** Answer a readable name of a location, such as `Array>>collect:`, `Array class>>new:` or `Array`. */
export function entityLabelOf(location: EntityLocation): string {
	if (!location.side) {
		return location.className;
	}
	return `${sidePathOf(location)}>>${location.selector ?? NEW_METHOD_SEGMENT}`;
}

function sidePathOf(location: EntityLocation): string {
	return location.side === 'class' ? `${location.className} class` : location.className;
}

// A selector may hold `/` (a binary selector such as `//`), which cannot stay in a path segment.
function escapeSelector(selector: string): string {
	return selector.replace(/%/g, '%25').replace(/\//g, '%2F');
}

function unescapeSelector(segment: string): string {
	return segment.replace(/%2F/gi, '/').replace(/%25/g, '%');
}
