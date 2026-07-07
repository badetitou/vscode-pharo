import * as vscode from 'vscode';

export const PHARO_IMAGE_SCHEME = 'pharoImage';
export const ICE_REPOSITORY_QUERY_KEY = 'iceRepository';

export function repositoryNameFromPharoUri(uri: vscode.Uri | undefined, scheme = PHARO_IMAGE_SCHEME): string | undefined {
	if (!uri || uri.scheme !== scheme || !uri.query) {
		return undefined;
	}

	const query = new URLSearchParams(uri.query);
	const repositoryName = query.get(ICE_REPOSITORY_QUERY_KEY);
	return repositoryName && repositoryName.trim().length > 0 ? repositoryName : undefined;
}

export function buildPharoUri(path: string, repositoryName?: string, scheme = PHARO_IMAGE_SCHEME): vscode.Uri {
	const query = repositoryName
		? `${ICE_REPOSITORY_QUERY_KEY}=${encodeURIComponent(repositoryName)}`
		: undefined;

	return vscode.Uri.from({ scheme, path, query });
}