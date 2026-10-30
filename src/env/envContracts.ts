// Contracts of the pls-env:* requests and of the pls-env/didChange notification of the Pharo Language Server.
// An entity id is `<kind>:<path>`, for example `class:Array`, `side:Array class` or `method:Array>>collect:`.

export const ENV_KINDS = ['project', 'package', 'tag', 'extensions', 'class', 'side', 'protocol', 'method'] as const;
export type EnvKind = typeof ENV_KINDS[number];

export const ENV_CHANGE_KINDS = ['added', 'changed', 'removed', 'renamed', 'moved'] as const;
export type EnvChangeKind = typeof ENV_CHANGE_KINDS[number];

/** JSON-RPC error code of pls-env:compile and pls-env:remove when the entity is no longer at the expected version. */
export const ENV_CONFLICT_ERROR_CODE = -32001;
/** JSON-RPC error code of a pls-env:* request naming an entity the image does not hold. */
export const ENV_UNKNOWN_ENTITY_ERROR_CODE = -32602;

export interface EnvCapabilities {
	version: number;
	didChange: boolean;
	edit: boolean;
}

export interface EnvNode {
	id: string;
	kind: EnvKind;
	name: string;
	parent: string | null;
	hasChildren: boolean;
	flags: Record<string, boolean>;
	/** For a method that comes from a trait, the id of that trait. */
	trait?: string;
}

export interface EnvChildrenPage {
	items: EnvNode[];
	total: number;
}

export interface EnvEntity extends EnvNode {
	package: string | null;
	repository: string | null;
	superclass?: string | null;
	version?: string;
	/** For a side: the names of the slots it defines itself. */
	slots?: string[];
	/** For a side: the class variables of its class, on the instance side only. */
	classVariables?: string[];
	/** For a side: the ids of the traits its class uses. */
	traits?: string[];
	/** For a side: its selectors that a subclass redefines. */
	overridden?: string[];
}

export interface EnvSource {
	id: string;
	source: string;
	version: string;
	protocol?: string;
	side?: string;
}

export interface EnvClassification {
	id: string;
	protocol: string;
}

export interface EnvDiagnostic {
	message: string;
	severity: number;
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
}

export interface EnvCompileResult {
	compiled: boolean;
	id: string | null;
	version: string | null;
	diagnostics: EnvDiagnostic[];
}

export interface EnvChange {
	kind: EnvChangeKind;
	id: string;
	oldId?: string;
	parent?: string | null;
	oldParent?: string | null;
	version?: string;
}

export interface EnvDidChangeParams {
	changes: EnvChange[];
	reset: boolean;
}

export interface EnvConflict {
	id: string;
	currentVersion: string | null;
}

export function parseEnvId(id: string): { kind: EnvKind; path: string } {
	const separator = id.indexOf(':');
	const kind = id.slice(0, separator);
	if (separator < 0 || !(ENV_KINDS as readonly string[]).includes(kind)) {
		throw new Error(`Invalid Pharo entity id: ${JSON.stringify(id)}.`);
	}
	return { kind: kind as EnvKind, path: id.slice(separator + 1) };
}

/** Answer the capabilities of the environment model from the `experimental` capabilities of the server, or undefined for an older server. */
export function envCapabilitiesFrom(experimental: unknown): EnvCapabilities | undefined {
	if (!isObject(experimental) || !isObject(experimental['pls-env'])) {
		return undefined;
	}
	const env = experimental['pls-env'];
	if (typeof env.version !== 'number') {
		return undefined;
	}
	return { version: env.version, didChange: env.didChange === true, edit: env.edit === true };
}

export function expectEnvNode(value: unknown, method: string): EnvNode {
	if (!isObject(value)) {
		throw invalid(method, 'expected an entity node');
	}
	const id = expectField(value, 'id', 'string', method);
	const kind = expectField(value, 'kind', 'string', method);
	if (!(ENV_KINDS as readonly string[]).includes(kind) || parseEnvId(id).kind !== kind) {
		throw invalid(method, `unknown entity kind ${JSON.stringify(kind)}`);
	}
	const node: EnvNode = {
		id,
		kind: kind as EnvKind,
		name: expectField(value, 'name', 'string', method),
		parent: expectNullableString(value.parent, `${method}.parent`),
		hasChildren: expectField(value, 'hasChildren', 'boolean', method),
		flags: expectFlags(value.flags, method)
	};
	if (value.trait !== undefined) {
		node.trait = expectField(value, 'trait', 'string', method);
	}
	return node;
}

export function expectEnvNodes(value: unknown, method: string): EnvNode[] {
	if (!Array.isArray(value)) {
		throw invalid(method, 'expected an array of entity nodes');
	}
	return value.map((node) => expectEnvNode(node, method));
}

export function expectEnvChildrenPage(value: unknown, method: string): EnvChildrenPage {
	if (!isObject(value)) {
		throw invalid(method, 'expected a page of children');
	}
	return {
		items: expectEnvNodes(value.items, `${method}.items`),
		total: expectField(value, 'total', 'number', method)
	};
}

export function expectEnvEntity(value: unknown, method: string): EnvEntity {
	const node = expectEnvNode(value, method);
	const entity = value as Record<string, unknown>;
	const result: EnvEntity = {
		...node,
		package: expectNullableString(entity.package, `${method}.package`),
		repository: expectNullableString(entity.repository, `${method}.repository`)
	};
	if ('superclass' in entity) {
		result.superclass = expectNullableString(entity.superclass, `${method}.superclass`);
	}
	if (entity.version !== undefined) {
		result.version = expectField(entity, 'version', 'string', method);
	}
	for (const field of ['slots', 'classVariables', 'traits', 'overridden'] as const) {
		if (entity[field] !== undefined) {
			result[field] = expectStrings(entity[field], `${method}.${field}`);
		}
	}
	return result;
}

export function expectEnvSource(value: unknown, method: string): EnvSource {
	if (!isObject(value)) {
		throw invalid(method, 'expected an entity source');
	}
	const result: EnvSource = {
		id: expectField(value, 'id', 'string', method),
		source: expectField(value, 'source', 'string', method),
		version: expectField(value, 'version', 'string', method)
	};
	if (value.protocol !== undefined) {
		result.protocol = expectField(value, 'protocol', 'string', method);
	}
	if (value.side !== undefined) {
		result.side = expectField(value, 'side', 'string', method);
	}
	return result;
}

export function expectEnvClassification(value: unknown, method: string): EnvClassification {
	if (!isObject(value)) {
		throw invalid(method, 'expected a classification');
	}
	return { id: expectField(value, 'id', 'string', method), protocol: expectField(value, 'protocol', 'string', method) };
}

export function expectEnvCompileResult(value: unknown, method: string): EnvCompileResult {
	if (!isObject(value)) {
		throw invalid(method, 'expected a compilation result');
	}
	const compiled = expectField(value, 'compiled', 'boolean', method);
	const id = expectNullableString(value.id, `${method}.id`);
	const version = expectNullableString(value.version, `${method}.version`);
	if (compiled && (id === null || version === null)) {
		throw invalid(method, 'a compiled entity needs an id and a version');
	}
	if (!Array.isArray(value.diagnostics)) {
		throw invalid(`${method}.diagnostics`, 'expected an array of diagnostics');
	}
	return { compiled, id, version, diagnostics: value.diagnostics.map((diagnostic) => expectEnvDiagnostic(diagnostic, `${method}.diagnostics`)) };
}

export function expectEnvDidChangeParams(value: unknown, method: string): EnvDidChangeParams {
	if (!isObject(value) || !Array.isArray(value.changes)) {
		throw invalid(method, 'expected a list of changes');
	}
	return {
		changes: value.changes.map((change) => expectEnvChange(change, `${method}.changes`)),
		reset: value.reset === true
	};
}

/** Answer the conflict carried by a JSON-RPC error of pls-env:compile or pls-env:remove, or undefined for another error. */
export function envConflictOf(error: unknown): EnvConflict | undefined {
	if (!isObject(error) || error.code !== ENV_CONFLICT_ERROR_CODE || !isObject(error.data) || typeof error.data.id !== 'string') {
		return undefined;
	}
	const currentVersion = error.data.currentVersion;
	return { id: error.data.id, currentVersion: typeof currentVersion === 'string' ? currentVersion : null };
}

export function isEnvUnknownEntityError(error: unknown): boolean {
	return isObject(error) && error.code === ENV_UNKNOWN_ENTITY_ERROR_CODE;
}

function expectEnvChange(value: unknown, method: string): EnvChange {
	if (!isObject(value)) {
		throw invalid(method, 'expected a change');
	}
	const kind = expectField(value, 'kind', 'string', method);
	if (!(ENV_CHANGE_KINDS as readonly string[]).includes(kind)) {
		throw invalid(method, `unknown change kind ${JSON.stringify(kind)}`);
	}
	const change: EnvChange = { kind: kind as EnvChangeKind, id: expectField(value, 'id', 'string', method) };
	for (const field of ['oldId', 'version'] as const) {
		if (value[field] !== undefined) {
			change[field] = expectField(value, field, 'string', method);
		}
	}
	for (const field of ['parent', 'oldParent'] as const) {
		if (value[field] !== undefined) {
			change[field] = expectNullableString(value[field], `${method}.${field}`);
		}
	}
	return change;
}

function expectEnvDiagnostic(value: unknown, method: string): EnvDiagnostic {
	if (!isObject(value) || !isObject(value.range) || !isPosition(value.range.start) || !isPosition(value.range.end)) {
		throw invalid(method, 'expected a diagnostic with a range');
	}
	return {
		message: expectField(value, 'message', 'string', method),
		severity: expectField(value, 'severity', 'number', method),
		range: { start: value.range.start, end: value.range.end }
	};
}

function expectFlags(value: unknown, method: string): Record<string, boolean> {
	if (!isObject(value) || Object.values(value).some((flag) => typeof flag !== 'boolean')) {
		throw invalid(`${method}.flags`, 'expected boolean flags');
	}
	return value as Record<string, boolean>;
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

function expectNullableString(value: unknown, method: string): string | null {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value !== 'string') {
		throw invalid(method, 'expected a string or null');
	}
	return value;
}

function isPosition(value: unknown): value is { line: number; character: number } {
	return isObject(value) && typeof value.line === 'number' && typeof value.character === 'number';
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(method: string, reason: string): Error {
	return new Error(`Pharo Language Server returned an invalid response for "${method}": ${reason}.`);
}
