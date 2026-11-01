// Contracts of the pls-inspector:* requests of the Pharo Language Server.
// The image keeps every object the client inspects under a reference, a string, until the client releases it with
// pls-inspector:release.

export interface InspectorCapabilities {
	version: number;
}

/** A view of an inspected object: Raw, Meta, or an inspection its class adds to the inspector, such as Items. */
export interface InspectorViewDescriptor {
	id: string;
	title: string;
}

/** The description of an object that pls-inspector:evaluate and pls-inspector:inspect answer. */
export interface InspectedObject {
	ref: string;
	className: string;
	printString: string;
	hasChildren: boolean;
	views: InspectorViewDescriptor[];
	/** Message of the error the evaluation signaled, which is then the inspected object. */
	error?: string;
}

/** A slot, an indexed item or a row of a view, with a new reference to the object it shows. */
export interface InspectorItem {
	name: string;
	ref: string;
	className: string;
	printString: string;
	hasChildren: boolean;
	/** Texts of the cells of a row of a table view. */
	cells?: string[];
}

export interface InspectorPage {
	items: InspectorItem[];
	total: number;
}

export type InspectorView =
	| { kind: 'tree'; items: InspectorItem[]; total: number }
	| { kind: 'table'; columns: string[]; items: InspectorItem[]; total: number }
	| { kind: 'text'; text: string }
	/** A view the client cannot show, such as a graphical one, with the reason. */
	| { kind: 'unsupported'; text: string };

/** Answer the capabilities of the inspector from the `experimental` capabilities of the server, or undefined for an older server. */
export function inspectorCapabilitiesFrom(experimental: unknown): InspectorCapabilities | undefined {
	if (!isObject(experimental) || !isObject(experimental['pls-inspector'])) {
		return undefined;
	}
	const inspector = experimental['pls-inspector'];
	return typeof inspector.version === 'number' ? { version: inspector.version } : undefined;
}

export function expectInspectedObject(value: unknown, method: string): InspectedObject {
	if (!isObject(value)) {
		throw invalid(method, 'expected an inspected object');
	}
	if (!Array.isArray(value.views)) {
		throw invalid(`${method}.views`, 'expected an array of views');
	}
	const object: InspectedObject = {
		ref: expectField(value, 'ref', 'string', method),
		className: expectField(value, 'className', 'string', method),
		printString: expectField(value, 'printString', 'string', method),
		hasChildren: expectField(value, 'hasChildren', 'boolean', method),
		views: value.views.map((view) => {
			if (!isObject(view)) {
				throw invalid(`${method}.views`, 'expected a view');
			}
			return { id: expectField(view, 'id', 'string', method), title: expectField(view, 'title', 'string', method) };
		})
	};
	if (typeof value.error === 'string') {
		object.error = value.error;
	}
	return object;
}

export function expectInspectorPage(value: unknown, method: string): InspectorPage {
	if (!isObject(value) || !Array.isArray(value.items)) {
		throw invalid(method, 'expected a page of items');
	}
	return {
		items: value.items.map((item) => expectInspectorItem(item, `${method}.items`)),
		total: expectField(value, 'total', 'number', method)
	};
}

export function expectInspectorView(value: unknown, method: string): InspectorView {
	if (!isObject(value)) {
		throw invalid(method, 'expected a view');
	}
	const kind = expectField(value, 'kind', 'string', method);
	switch (kind) {
		case 'tree':
			return { kind, ...expectInspectorPage(value, method) };
		case 'table':
			return { kind, columns: expectStrings(value.columns, `${method}.columns`), ...expectInspectorPage(value, method) };
		case 'text':
		case 'unsupported':
			return { kind, text: expectField(value, 'text', 'string', method) };
		default:
			throw invalid(method, `unknown view kind ${JSON.stringify(kind)}`);
	}
}

function expectInspectorItem(value: unknown, method: string): InspectorItem {
	if (!isObject(value)) {
		throw invalid(method, 'expected an item');
	}
	const item: InspectorItem = {
		name: expectField(value, 'name', 'string', method),
		ref: expectField(value, 'ref', 'string', method),
		className: expectField(value, 'className', 'string', method),
		printString: expectField(value, 'printString', 'string', method),
		hasChildren: expectField(value, 'hasChildren', 'boolean', method)
	};
	if (value.cells !== undefined) {
		item.cells = expectStrings(value.cells, `${method}.cells`);
	}
	return item;
}

function expectField(value: Record<string, unknown>, field: string, type: 'string', method: string): string;
function expectField(value: Record<string, unknown>, field: string, type: 'number', method: string): number;
function expectField(value: Record<string, unknown>, field: string, type: 'boolean', method: string): boolean;
function expectField(value: Record<string, unknown>, field: string, type: 'string' | 'number' | 'boolean', method: string): unknown {
	if (typeof value[field] !== type) {
		throw invalid(`${method}.${field}`, `expected a ${type}`);
	}
	return value[field];
}

function expectStrings(value: unknown, method: string): string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
		throw invalid(method, 'expected an array of strings');
	}
	return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(method: string, reason: string): Error {
	return new Error(`Pharo Language Server returned an invalid response for "${method}": ${reason}.`);
}
