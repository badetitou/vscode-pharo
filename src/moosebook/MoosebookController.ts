import {
	notebooks, NotebookController, NotebookCell, NotebookDocument, NotebookCellExecution, NotebookCellOutput, NotebookCellOutputItem
} from 'vscode';
import { client, documentExplorer } from '../extension';
import { executeCellsSequentially } from './execution';

interface PharoResponse {
	mimetype: string,
	content: string
}

export class MoosebookController {
	readonly controllerId = 'moosebook';
	readonly notebookType = 'moosebook';
	readonly label = 'Moosebook';
	readonly supportedLanguages = ['pharo'];

	private readonly _controller: NotebookController;
	private _executionOrder = 0;

	constructor() {
		this._controller = notebooks.createNotebookController(
			this.controllerId,
			this.notebookType,
			this.label
		);

		this._controller.supportedLanguages = this.supportedLanguages;
		this._controller.supportsExecutionOrder = true;
		this._controller.executeHandler = this._execute.bind(this);
	}

	dispose(): void {
		this._controller.dispose();
	}

	private _execute(
		cells: NotebookCell[],
		_notebook: NotebookDocument,
		_controller: NotebookController
	): Promise<void> {
		let cancellationRequested = false;
		return executeCellsSequentially(
			cells,
			() => cancellationRequested,
			async (cell) => {
				const execution = this._startExecution(cell);
				let succeeded = false;
				try {
					if (execution.token.isCancellationRequested) {
						cancellationRequested = true;
						await execution.replaceOutput(this._errorOutput(new Error('Execution cancelled.')));
						return;
					}

					const results = await client.sendRequest(
						'command:notebookPrintIt',
						{ line: cell.document.getText(), textDocumentURI: cell.document.uri },
						execution.token
					) as PharoResponse[];
					if (execution.token.isCancellationRequested) {
						cancellationRequested = true;
						await execution.replaceOutput(this._errorOutput(new Error('Execution cancelled.')));
						return;
					}
					await execution.replaceOutput(this._responseOutput(results));
					succeeded = results.every((value) => value.mimetype !== 'error');
				} catch (error) {
					try {
						await execution.replaceOutput(this._errorOutput(error));
					} catch (outputError) {
						console.error(`Unable to show Moosebook execution error: ${this._formatError(outputError)}`);
					}
					cancellationRequested ||= execution.token.isCancellationRequested;
				} finally {
					cancellationRequested ||= execution.token.isCancellationRequested;
					execution.end(succeeded, Date.now());
					documentExplorer.refresh();
				}
			},
			async (cell) => {
				const execution = this._startExecution(cell);
				try {
					await execution.replaceOutput(this._errorOutput(new Error('Execution cancelled before this cell started.')));
				} catch (error) {
					console.error(`Unable to mark Moosebook cell as skipped: ${this._formatError(error)}`);
				} finally {
					execution.end(false, Date.now());
				}
			},
			(_cell, error) => {
				console.error(`Unexpected Moosebook execution failure: ${this._formatError(error)}`);
			}
		);
	}

	private _startExecution(cell: NotebookCell): NotebookCellExecution {
		const execution = this._controller.createNotebookCellExecution(cell);
		execution.executionOrder = ++this._executionOrder;
		execution.start(Date.now());
		return execution;
	}

	private _responseOutput(results: PharoResponse[]): NotebookCellOutput[] {
		const items: NotebookCellOutputItem[] = results.map((value) => {
			if (value.mimetype === 'error') {
				return NotebookCellOutputItem.error(new Error(value.content));
			}
			return NotebookCellOutputItem.text(value.content, value.mimetype);
		});
		const output = new NotebookCellOutput(items);
		output.metadata = [];
		return [output];
	}

	private _errorOutput(error: unknown): NotebookCellOutput[] {
		return [new NotebookCellOutput([NotebookCellOutputItem.error(
			error instanceof Error ? error : new Error(String(error))
		)])];
	}

	private _formatError(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}