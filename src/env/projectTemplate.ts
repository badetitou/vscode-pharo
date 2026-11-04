/** Answer why name cannot name a Pharo project, or undefined when it can: it becomes BaselineOf<name> and packages. */
export function projectNameProblem(name: string): string | undefined {
	if (!name) {
		return 'Give a name to the project.';
	}
	return /^[A-Z][A-Za-z0-9]*$/.test(name)
		? undefined
		: 'A project name starts with an uppercase letter and holds only letters and digits, as it names the class BaselineOf' + name + '.';
}

/**
 * Answer the files of a new Pharo project, by path relative to its folder: Tonel sources under `src` with a baseline,
 * a package and a test package, a smalltalkCI configuration and a GitHub Actions workflow running it.
 */
export function projectFiles(name: string): Record<string, string> {
	const tests = `${name}-Tests`;
	return {
		'.project': "{\n\t'srcDirectory' : 'src'\n}\n",
		'src/.properties': '{\n\t#format : #tonel\n}\n',
		[`src/BaselineOf${name}/package.st`]: `Package { #name : 'BaselineOf${name}' }\n`,
		[`src/BaselineOf${name}/BaselineOf${name}.class.st`]: `Class {
	#name : 'BaselineOf${name}',
	#superclass : 'BaselineOf',
	#category : 'BaselineOf${name}',
	#package : 'BaselineOf${name}'
}

{ #category : 'baselines' }
BaselineOf${name} >> baseline: spec [

	<baseline>
	spec for: #common do: [
		spec
			package: '${name}';
			package: '${tests}' with: [ spec requires: #( '${name}' ) ].
		spec
			group: 'Core' with: #( '${name}' );
			group: 'Tests' with: #( '${tests}' );
			group: 'default' with: #( 'Core' 'Tests' ) ]
]
`,
		[`src/${name}/package.st`]: `Package { #name : '${name}' }\n`,
		[`src/${tests}/package.st`]: `Package { #name : '${tests}' }\n`,
		[`src/${tests}/${name}Test.class.st`]: `Class {
	#name : '${name}Test',
	#superclass : 'TestCase',
	#category : '${tests}',
	#package : '${tests}'
}

{ #category : 'tests' }
${name}Test >> testPackageIsLoaded [

	self assert: (self packageOrganizer hasPackage: '${name}')
]
`,
		'.smalltalk.ston': `SmalltalkCISpec {
	#loading : [
		SCIMetacelloLoadSpec {
			#baseline : '${name}',
			#directory : 'src',
			#platforms : [ #pharo ]
		}
	]
}
`,
		'.github/workflows/ci.yml': `name: CI

on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        smalltalk: [ Pharo64-13 ]
    name: \${{ matrix.smalltalk }}
    steps:
      - uses: actions/checkout@v4
      - uses: hpi-swt2/setup-smalltalkCI@v1
        with:
          smalltalk-image: \${{ matrix.smalltalk }}
      - run: smalltalkci -s \${{ matrix.smalltalk }}
        shell: bash
        timeout-minutes: 15
`,
		'.gitignore': '*.image\n*.changes\n*.sources\npharo-local/\nPharoDebug.log\n',
		'README.md': `# ${name}

## Installation

\`\`\`smalltalk
Metacello new
	baseline: '${name}';
	repository: 'github://<owner>/${name}:main/src';
	load
\`\`\`
`
	};
}
