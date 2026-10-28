import { parse, ParseError, printParseErrorCode } from 'jsonc-parser';

export function parseJsoncObject(text: string, source: string): Record<string, unknown> {
	const errors: ParseError[] = [];
	const value: unknown = parse(text, errors, { allowTrailingComma: true });
	if (errors.length > 0) {
		const details = errors.map((error) => {
			const prefix = text.slice(0, error.offset);
			const line = prefix.split('\n').length;
			const column = prefix.length - prefix.lastIndexOf('\n');
			return `${printParseErrorCode(error.error)} at line ${line}, column ${column}`;
		}).join('; ');
		throw new Error(`Invalid JSONC in ${source}: ${details}.`);
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`Invalid JSONC in ${source}: expected an object at the root.`);
	}
	return value as Record<string, unknown>;
}
