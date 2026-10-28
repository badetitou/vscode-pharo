export interface PharoTestResult {
	failures?: string[];
	errors?: string[];
	skipped?: string[];
	passed?: string[];
}

const TEST_RESULT_FIELDS = ['failures', 'errors', 'skipped', 'passed'] as const;

export function expectStringArray(value: unknown, method: string): string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
		throw new Error(`Pharo Language Server returned an invalid response for "${method}": expected an array of strings.`);
	}
	return value;
}

export function expectPort(value: unknown, method: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
		throw new Error(`Pharo Language Server returned an invalid response for "${method}": expected a TCP port.`);
	}
	return value;
}

export function expectString(value: unknown, method: string): string {
	if (typeof value !== 'string') {
		throw new Error(`Pharo Language Server returned an invalid response for "${method}": expected a string.`);
	}
	return value;
}

export function isMethodNotFoundError(error: unknown): boolean {
	return typeof error === 'object'
		&& error !== null
		&& 'code' in error
		&& (error as { code?: unknown }).code === -32601;
}

export function expectTestResult(value: unknown, method: string): PharoTestResult {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`Pharo Language Server returned an invalid response for "${method}": expected a test result object.`);
	}

	const result = value as Record<string, unknown>;
	const validated: PharoTestResult = {};
	let hasResultField = false;
	for (const field of TEST_RESULT_FIELDS) {
		const fieldValue = result[field];
		if (fieldValue === undefined) {
			continue;
		}
		validated[field] = expectStringArray(fieldValue, `${method}.${field}`);
		hasResultField = true;
	}

	if (!hasResultField) {
		throw new Error(`Pharo Language Server returned an invalid response for "${method}": no test result fields were present.`);
	}
	return validated;
}
