export interface TonelMethod {
	id: string;
	selector: string;
	protocol: string;
	side: 'instance' | 'class';
	startLine: number;
}

export function parseTonelMethods(source: string): TonelMethod[] {
	const methods: TonelMethod[] = [];
	let protocol = 'as yet unclassified';
	const lines = source.split(/\r?\n/);

	for (let startLine = 0; startLine < lines.length; startLine++) {
		const line = lines[startLine];
		const category = line.match(/^\{\s*#category\s*:\s*#(?:'((?:[^']|'')*)'|([^\s}]+))/);
		if (category) {
			protocol = (category[1]?.replace(/''/g, "'") ?? category[2] ?? 'as yet unclassified').trim();
			continue;
		}

		const header = line.match(/^\s*[\w$]+(?:\s+class)?\s*>>\s*(.*?)\s*\[\s*$/u);
		if (!header) {
			continue;
		}

		const selector = selectorFromHeader(header[1]);
		if (!selector) {
			continue;
		}
		const side = /\sclass\s*>>/.test(line) ? 'class' : 'instance';
		methods.push({
			id: `${side}:${selector}`,
			selector,
			protocol,
			side,
			startLine
		});
	}

	return methods;
}

function selectorFromHeader(header: string): string {
	const trimmed = header.trim();
	const keywordParts = trimmed.match(/[A-Za-z_]\w*:/g);
	if (keywordParts?.length) {
		return keywordParts.join('');
	}

	const binarySelector = trimmed.match(/^[!%&*+,\-/<=>?@\\~|]+/);
	if (binarySelector) {
		return binarySelector[0];
	}

	return trimmed.split(/\s/, 1)[0] ?? '';
}
