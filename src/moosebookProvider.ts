import * as vscode from 'vscode';
import { Moosebook } from './moosebook';

interface RawNotebookCell {
	language: string;
	value: string;
	kind: vscode.NotebookCellKind;
	editable?: boolean;
}

interface ProjectAssociation {
	(key: string): boolean;
}


export class MoosebookContentProvider implements  vscode.NotebookContentProvider, vscode.NotebookKernel, vscode.NotebookKernelProvider {
	readonly id = 'moosebookKernel';
	public label = 'Moosebook Kernel';

	private readonly _associations = new Map<string, [ProjectAssociation, Moosebook]>();
	private _localDisposables: vscode.Disposable[] = [];
	supportedLanguages?: string[] = ['pharo'];
	private _executionOrder = 0;

	constructor() {
		this._localDisposables.push(
			vscode.notebook.onDidOpenNotebookDocument(document => {
				const docKey = document.uri.toString();
				if (!this.lookupMoosebook(docKey)) {
					const project = new Moosebook(document);
					this.register(
						docKey,
						project,
						key => document.cells.some(cell => cell.index.toString() === key) || (key === docKey),
					);
				}
			}),
			vscode.notebook.onDidCloseNotebookDocument(document => {
				const project = this.unregister(document.uri.toString());
				if (project) {
					project.dispose();
				}
			}),
		);
	}

	provideKernels() {
		return [this];
	}

	interrupt?(document: vscode.NotebookDocument): void {
		throw new Error('Method not implemented.');
	}

	async executeCellsRequest(document: vscode.NotebookDocument, ranges: vscode.NotebookCellRange[]) {
		const cells: vscode.NotebookCell[] = [];
		for (let range of ranges) {
			for (let i = range.start; i < range.end; i++) {
				cells.push(document.cells[i]);
			}
		}
		this._executeCells(cells);
	}

	private async _executeCells(cells: vscode.NotebookCell[]): Promise<void> {
		for (const cell of cells) {
			const execution = vscode.notebook.createNotebookCellExecutionTask(cell.notebook.uri, cell.index, this.id)!;
			await this._doExecuteCell(execution);
		}
	}

	private async _doExecuteCell(execution: vscode.NotebookCellExecutionTask): Promise<void> {

		execution.executionOrder = ++this._executionOrder;
		execution.start({ startTime: Date.now() });

		let output = {mimetype: 'text/html', content: 'error... '};
		let error: Error | undefined;
		const moosebook = this.lookupMoosebook(execution.cell.index);
		try {
			output = await moosebook.eval(execution.cell);
		} catch(err) {
			execution.replaceOutput([new vscode.NotebookCellOutput([
				new vscode.NotebookCellOutputItem('application/x.notebook.error-traceback', {
					ename: err instanceof Error && err.name || 'error',
					evalue: err instanceof Error && err.message || JSON.stringify(err, undefined, 4),
					traceback: []
				})
			])]);
			execution.end({ success: false });
			return;
		}
	

		execution.replaceOutput([new vscode.NotebookCellOutput([
			new vscode.NotebookCellOutputItem(output.mimetype, output.content)])]);
		execution.end({ success: true });
	}


	public lookupMoosebook(keyOrUri: string | number | vscode.Uri): Moosebook | undefined {
		let key: string;
		if (typeof keyOrUri === 'string') {
			key = keyOrUri;
		} else {
			key = keyOrUri.toString();
		}
		for (let [association, value] of this._associations.values()) {
			if (association(key)) {
				return value;
			}
		}
		return undefined;
	}

	async openNotebook(uri: vscode.Uri): Promise<vscode.NotebookData> {
		let contents = '';
		try {
			contents = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
		} catch {
		}

		let raw: RawNotebookCell[];
		try {
			raw = <RawNotebookCell[]>JSON.parse(contents);
		} catch {
			raw = [];
		}

		const notebookData: vscode.NotebookData = {
			metadata: new vscode.NotebookDocumentMetadata().with({ editable: true }),
			cells: raw.map(item => ({
				kind: item.kind,
				source: item.value,
				language: item.language,
				outputs: [],
				metadata: new vscode.NotebookCellMetadata().with({
					editable: true,
					breakpointMargin: false
				 })
			}))
		};
		return notebookData;
	}

	public saveNotebook(document: vscode.NotebookDocument, _cancellation: vscode.CancellationToken): Promise<void> {
		return this._save(document, document.uri);
	}

	public saveNotebookAs(targetResource: vscode.Uri, document: vscode.NotebookDocument, _cancellation: vscode.CancellationToken): Promise<void> {
		return this._save(document, targetResource);
	}

	async resolveNotebook(_document: vscode.NotebookDocument, _webview: vscode.NotebookCommunication): Promise<void> {
		// nothing
	}

	async backupNotebook(document: vscode.NotebookDocument, context: vscode.NotebookDocumentBackupContext, _cancellation: vscode.CancellationToken): Promise<vscode.NotebookDocumentBackup> {
		return { id: '', delete: () => {} };
	}

	public dispose() {
	}

	// ---- private ----

	private async _save(document: vscode.NotebookDocument, targetResource: vscode.Uri): Promise<void> {
		let contents: RawNotebookCell[] = [];
		for (let cell of document.cells) {
			contents.push({
				kind: cell.kind,
				language: cell.document.languageId,
				value: cell.document.getText(),
			});
		}
		await vscode.workspace.fs.writeFile(targetResource, Buffer.from(JSON.stringify(contents)));
	}

	private register(key: string, project: Moosebook, association: ProjectAssociation) {
		this._associations.set(key, [association, project]);
	}

	private unregister(key: string): Moosebook | undefined {
		const project = this.lookupMoosebook(key);
		if (project) {
			this._associations.delete(key);
		}
		return project;
	}
}