// Contracts of the pls-system:* and pls-chest:* requests of the Pharo Language Server: the processes of the image,
// the profiler and the chests of objects (see docs/system.md).

export interface SystemCapabilities {
	version: number;
	processes: boolean;
	profile: boolean;
	chest: boolean;
}

export type ProcessState = 'running' | 'ready' | 'waiting' | 'suspended' | 'terminated';

/** A process of the image. Its id holds while the process lives. */
export interface PharoProcess {
	id: number;
	name: string;
	priority: number;
	state: ProcessState;
	/** The method the process runs, as Class>>selector. */
	method?: string;
	/** The URI of the editor of that method, when it is installed. */
	uri?: string;
	/** The process of the user interface of the image. */
	ui: boolean;
	/** The process answering the client, which cannot be terminated nor debugged. */
	current: boolean;
}

export interface StackFrame {
	label: string;
	uri?: string;
}

/** A call sampled by the profiler, with the samples of its subtree and of the method itself. */
export interface ProfileNode {
	label: string;
	uri?: string;
	samples: number;
	selfSamples: number;
	children: ProfileNode[];
}

export interface Profile {
	milliseconds: number;
	samples: number;
	/** The error the profiled code signalled. */
	error?: string;
	root: ProfileNode;
}

export interface ChestItem {
	key: string;
	className: string;
	printString: string;
	/** The code that answers the object, such as `(Chest named: 'Default') at: 'x'`. */
	code: string;
}

export interface Chest {
	name: string;
	items: ChestItem[];
}

export interface ChestContents {
	/** Whether Chest (github://pharo-spec/Chest) is loaded in the image. */
	available: boolean;
	chests: Chest[];
}

const STATES: ProcessState[] = ['running', 'ready', 'waiting', 'suspended', 'terminated'];

/** Answer the capabilities of the system tools from the `experimental` capabilities of the server, or undefined for an older server. */
export function systemCapabilitiesFrom(experimental: unknown): SystemCapabilities | undefined {
	if (!isObject(experimental) || !isObject(experimental['pls-system'])) {
		return undefined;
	}
	const system = experimental['pls-system'];
	if (typeof system.version !== 'number') {
		return undefined;
	}
	return { version: system.version, processes: system.processes === true, profile: system.profile === true, chest: system.chest === true };
}

export function expectProcesses(value: unknown, method: string): PharoProcess[] {
	return expectItems(value, method).map((item) => {
		const process: PharoProcess = {
			id: expectField(item, 'id', 'number', method),
			name: expectField(item, 'name', 'string', method),
			priority: expectField(item, 'priority', 'number', method),
			state: expectState(item.state, method),
			ui: expectField(item, 'ui', 'boolean', method),
			current: expectField(item, 'current', 'boolean', method)
		};
		setOptional(process, 'method', item.method, method);
		setOptional(process, 'uri', item.uri, method);
		return process;
	});
}

export function expectStack(value: unknown, method: string): StackFrame[] {
	return expectItems(value, method).map((item) => {
		const frame: StackFrame = { label: expectField(item, 'label', 'string', method) };
		setOptional(frame, 'uri', item.uri, method);
		return frame;
	});
}

export function expectProfile(value: unknown, method: string): Profile {
	if (!isObject(value)) {
		throw invalid(method, 'expected a profile');
	}
	const profile: Profile = {
		milliseconds: expectField(value, 'milliseconds', 'number', method),
		samples: expectField(value, 'samples', 'number', method),
		root: expectProfileNode(value.root, `${method}.root`)
	};
	setOptional(profile, 'error', value.error, method);
	return profile;
}

function expectProfileNode(value: unknown, method: string): ProfileNode {
	if (!isObject(value) || !Array.isArray(value.children)) {
		throw invalid(method, 'expected a node with children');
	}
	const node: ProfileNode = {
		label: expectField(value, 'label', 'string', method),
		samples: expectField(value, 'samples', 'number', method),
		selfSamples: expectField(value, 'selfSamples', 'number', method),
		children: value.children.map((child) => expectProfileNode(child, method))
	};
	setOptional(node, 'uri', value.uri, method);
	return node;
}

export function expectDebugSessionId(value: unknown, method: string): number {
	if (!isObject(value)) {
		throw invalid(method, 'expected an object');
	}
	return expectField(value, 'debugSessionId', 'number', method);
}

export function expectChestContents(value: unknown, method: string): ChestContents {
	if (!isObject(value) || !Array.isArray(value.chests)) {
		throw invalid(method, 'expected the chests');
	}
	return {
		available: expectField(value, 'available', 'boolean', method),
		chests: value.chests.map((chest) => {
			if (!isObject(chest)) {
				throw invalid(`${method}.chests`, 'expected a chest');
			}
			return {
				name: expectField(chest, 'name', 'string', method),
				items: expectItems(chest, `${method}.chests`).map((item) => ({
					key: expectField(item, 'key', 'string', method),
					className: expectField(item, 'className', 'string', method),
					printString: expectField(item, 'printString', 'string', method),
					code: expectField(item, 'code', 'string', method)
				}))
			};
		})
	};
}

export function expectChestKey(value: unknown, method: string): string {
	if (!isObject(value)) {
		throw invalid(method, 'expected an object');
	}
	return expectField(value, 'key', 'string', method);
}

function expectItems(value: unknown, method: string): Record<string, unknown>[] {
	if (!isObject(value) || !Array.isArray(value.items)) {
		throw invalid(method, 'expected items');
	}
	return value.items.map((item) => {
		if (!isObject(item)) {
			throw invalid(`${method}.items`, 'expected an object');
		}
		return item;
	});
}

function expectState(value: unknown, method: string): ProcessState {
	if (!STATES.includes(value as ProcessState)) {
		throw invalid(`${method}.state`, `unknown state ${JSON.stringify(value)}`);
	}
	return value as ProcessState;
}

/** Set field of target to value when it is a string; null and undefined leave it unset. */
function setOptional<T extends object>(target: T, field: keyof T & string, value: unknown, method: string): void {
	if (value === undefined || value === null) {
		return;
	}
	if (typeof value !== 'string') {
		throw invalid(`${method}.${field}`, 'expected a string');
	}
	(target as Record<string, unknown>)[field] = value;
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

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(method: string, reason: string): Error {
	return new Error(`Pharo Language Server returned an invalid response for "${method}": ${reason}.`);
}
