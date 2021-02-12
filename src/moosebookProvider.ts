import * as vscode from 'vscode';
import { WorkspaceEdit } from 'vscode';
import { Moosebook } from './moosebook';

interface RawNotebookCell {
	language: string;
	value: string;
	kind: vscode.CellKind;
	editable?: boolean;
}

interface ProjectAssociation {
	(key: string): boolean;
}

export class MoosebookContentProvider implements  vscode.NotebookContentProvider, vscode.NotebookKernel {
	readonly id = 'moosebookKernel';
	public label = 'Moosebook Kernel';

	private readonly _associations = new Map<string, [ProjectAssociation, Moosebook]>();
	private _localDisposables: vscode.Disposable[] = [];

	constructor() {
		this._localDisposables.push(
			vscode.notebook.onDidOpenNotebookDocument(document => {
				const docKey = document.uri.toString();
				if (!this.lookupMoosebook(docKey)) {
					const project = new Moosebook(document);
					this.register(
						docKey,
						project,
						key => document.cells.some(cell => cell.uri.toString() === key) || (key === docKey),
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
		vscode.notebook.registerNotebookKernelProvider({
			viewType: 'moosebook',
		}, {
			provideKernels: () => {
				return [this];
			}
		});
	}

	public lookupMoosebook(keyOrUri: string | vscode.Uri | undefined): Moosebook | undefined {
		if (keyOrUri) {
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
			languages: ['pharo'],
			metadata: { cellRunnable: true },
			cells: raw.map(item => ({
				source: item.value,
				language: item.language,
				cellKind: item.kind,
				outputs: [],
				metadata: {
					editable: true,
					runnable: true,
					breakpointMargin: false
				 }
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



	public async executeCell(_document: vscode.NotebookDocument, cell: vscode.NotebookCell): Promise<void> {

		let output = '';
		let error: Error | undefined;
		const moosebook = this.lookupMoosebook(cell.uri);
		if (moosebook) {
			try {
				output = await moosebook.eval(cell);
			} catch(e) {
				error = e;
			}
		}
		const edit = new vscode.WorkspaceEdit();
		edit.replaceNotebookCellOutput(_document.uri, cell.index, [{
			outputs: [{
				mime: 'text/html',
				value: output
			}],
			id: cell.index + ''
		}])
		// edit.replaceNotebookCellMetadata(_document.uri, cell.index, metadata);
        vscode.workspace.applyEdit(edit);
		
	}

	public cancelCellExecution(_document: vscode.NotebookDocument, _cell: vscode.NotebookCell): void {
		// not yet supported
	}

	public async executeAllCells(document: vscode.NotebookDocument): Promise<void> {
	  for (const cell of document.cells) {
		await this.executeCell(document, cell);
	  }
	}

	cancelAllCellsExecution(_document: vscode.NotebookDocument): void {
		// not yet supported
	}

	public dispose() {
	}

	// ---- private ----

	private async _save(document: vscode.NotebookDocument, targetResource: vscode.Uri): Promise<void> {
		let contents: RawNotebookCell[] = [];
		for (let cell of document.cells) {
			contents.push({
				kind: cell.cellKind,
				language: cell.language,
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