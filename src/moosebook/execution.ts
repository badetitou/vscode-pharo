export async function executeCellsSequentially<TCell>(
	cells: readonly TCell[],
	isCancellationRequested: () => boolean,
	executeCell: (cell: TCell) => Promise<void>,
	markSkipped: (cell: TCell) => void | Promise<void>,
	handleError: (cell: TCell, error: unknown) => void | Promise<void>
): Promise<void> {
	for (let index = 0; index < cells.length; index++) {
		if (isCancellationRequested()) {
			for (const cell of cells.slice(index)) {
				await markSkipped(cell);
			}
			return;
		}

		const cell = cells[index];
		try {
			await executeCell(cell);
		} catch (error) {
			await handleError(cell, error);
		}
	}
}
