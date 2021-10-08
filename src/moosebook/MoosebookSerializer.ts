import { TextDecoder, TextEncoder } from 'util';
import {
	CancellationToken, NotebookSerializer, NotebookData, NotebookCellData, NotebookCellKind
} from 'vscode';


interface RawNotebookCell {
	language: string;
	value: string;
	kind: NotebookCellKind;
  }
  
export class MoosebookSerializer implements NotebookSerializer {
	async deserializeNotebook(
	  content: Uint8Array,
	  _token: CancellationToken
	): Promise<NotebookData> {
	  var contents = new TextDecoder().decode(content);
  
	  let raw: RawNotebookCell[];
	  try {
		raw = <RawNotebookCell[]>JSON.parse(contents);
	  } catch {
		raw = [];
	  }
  
	  const cells = raw.map(
		item => new NotebookCellData(item.kind, item.value, item.language)
	  );
  
	  return new NotebookData(cells);
	}
  
	async serializeNotebook(
	  data: NotebookData,
	  _token: CancellationToken
	): Promise<Uint8Array> {
	  let contents: RawNotebookCell[] = [];
  
	  for (const cell of data.cells) {
		contents.push({
		  kind: cell.kind,
		  language: cell.languageId,
		  value: cell.value
		});
	  }
  
	  return new TextEncoder().encode(JSON.stringify(contents));
	}
  }