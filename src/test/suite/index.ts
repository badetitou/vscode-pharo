import * as Mocha from 'mocha';
import * as path from 'path';

export function run(): Promise<void> {
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 20_000,
	});

	// Add test files explicitly to avoid extra dependencies like glob.
	mocha.addFile(path.resolve(__dirname, './pharoChatParticipant.test.js'));

	return new Promise((resolve, reject) => {
		try {
			mocha.run((failures) => {
				if (failures > 0) {
					reject(new Error(`${failures} test(s) failed.`));
				} else {
					resolve();
				}
			});
		} catch (err) {
			reject(err);
		}
	});
}
