// @ts-check

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const incremental = process.argv.includes('--watch');

(async function () {

	// extension
	const buildExtension = await esbuild.build({
		incremental,
		bundle: true,
		entryPoints: ['src/extension.ts'],
		tsconfig: 'src/tsconfig.json',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		format: 'cjs',
		platform: 'node',
		target: ['node12.18'],
		sourcemap: true,
		minify: false // AbortSignal-module has issues...
	});


	if (incremental) {
		fs.watch(path.join(__dirname, 'src'), { recursive: true }, async function () {
			await buildExtension.rebuild().catch(err => console.error(err));
		});
	}
})();
