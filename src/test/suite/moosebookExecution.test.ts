import * as assert from 'assert';
import { executeCellsSequentially } from '../../moosebook/execution';

suite('Moosebook cell execution', () => {
	test('waits for each cell before starting the next one', async () => {
		const events: string[] = [];
		await executeCellsSequentially(
			['first', 'second', 'third'],
			() => false,
			async (cell) => {
				events.push(`${cell}:start`);
				await Promise.resolve();
				events.push(`${cell}:end`);
			},
			(cell) => { events.push(`${cell}:skipped`); },
			(cell, error) => { events.push(`${cell}:error:${String(error)}`); }
		);
		assert.deepStrictEqual(events, [
			'first:start', 'first:end',
			'second:start', 'second:end',
			'third:start', 'third:end'
		]);
	});

	test('continues after an execution error', async () => {
		const events: string[] = [];
		await executeCellsSequentially(
			['first', 'second', 'third'],
			() => false,
			async (cell) => {
				events.push(`${cell}:start`);
				if (cell === 'second') {
					throw new Error('Pharo evaluation failed');
				}
			},
			(cell) => { events.push(`${cell}:skipped`); },
			(cell, error) => { events.push(`${cell}:error:${error instanceof Error ? error.message : String(error)}`); }
		);
		assert.deepStrictEqual(events, [
			'first:start',
			'second:start', 'second:error:Pharo evaluation failed',
			'third:start'
		]);
	});

	test('marks all remaining cells when cancellation is requested', async () => {
		const events: string[] = [];
		let cancelled = false;
		await executeCellsSequentially(
			['first', 'second', 'third'],
			() => cancelled,
			async (cell) => {
				events.push(`${cell}:start`);
				cancelled = true;
			},
			(cell) => { events.push(`${cell}:skipped`); },
			(cell, error) => { events.push(`${cell}:error:${String(error)}`); }
		);
		assert.deepStrictEqual(events, ['first:start', 'second:skipped', 'third:skipped']);
	});
});
