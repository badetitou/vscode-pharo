import {
	notebooks, NotebookController, NotebookCell, NotebookDocument, NotebookCellOutput, NotebookCellOutputItem
} from 'vscode';
import { client } from '../extension';

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
	): void {
		for (let cell of cells) {
			this._doExecution(cell);
		}
	}

	private async _doExecution(cell: NotebookCell): Promise<void> {
		const execution = this._controller.createNotebookCellExecution(cell);
		execution.executionOrder = ++this._executionOrder;
		execution.start(Date.now()); // Keep track of elapsed time to execute cell.
		await client.sendRequest('command:notebookPrintIt', { "line": cell.document.getText() }).then((result: PharoResponse) => {
			if (result.mimetype == 'error') {
				throw new Error(result.content);
			}
			execution.replaceOutput([
				new NotebookCellOutput([
					NotebookCellOutputItem.text(result.content, result.mimetype)
				])
			]);
			execution.end(true, Date.now());
		}).catch((err) => {
			execution.replaceOutput([new NotebookCellOutput([
				NotebookCellOutputItem.error(err)
			])
			]);
			execution.end(false, Date.now());
		});
	}
}