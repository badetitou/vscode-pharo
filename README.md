# vscode-pharo <!-- omit in toc -->

A Pharo client extension for VSCode.

- [Supported files](#supported-files)
- [Features](#features)
	- [Generic feature](#generic-feature)
	- [Supported Language Server feature](#supported-language-server-feature)
	- [Additional feature](#additional-feature)
- [Installation](#installation)
- [Thanks](#thanks)

## Supported files

This extension support *.st* files and *.class.st* files (tonel format)

## Features

We present here the existing features

### Generic feature

1. Code highlighting

![Highlighting](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/highlighting.png)

### Supported Language Server feature

1. Code formatting

![Format gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/format.gif)

2. Hover

![Hover](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/hover.png)

3. Auto-completion

![Auto-Completion](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/Auto-completion.png)

### Additional feature

The additional feature can be access using the command palette of VSCode

1. Save the Pharo image
2. Execute and show the result

![Inspect gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/inspectResult.gif)

3. Execute and print the result

![Print gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/printResult.gif)

4. Keep variable state

![Keep Variable state gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/keep-variable-state.gif)

5. Show the current server version

![Show version gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/pharo-version.gif)

6. Saving a tonel file in VSCode, save the corresponding methods/class in the Pharo image

## Installation

To install the extension:

1. Install [VSCode](https://code.visualstudio.com/)
2. Install the [Pharo extension](https://marketplace.visualstudio.com/items?itemName=badetitou.pharo-language-server)
3. Download a [Pharo Language Server image](https://github.com/badetitou/Pharo-LanguageServer/releases) or [install the server](https://github.com/badetitou/Pharo-LanguageServer#installation) in a pre-existing image 
4. Download a [VM](https://files.pharo.org/vm/pharo-spur64-headless/) (headless or not) for the image
5. Set up the Pharo extension property
   1. pharo.pathToVM: is the path to the VM executable
   2. pharo.pathToImage: is the absolute path to the image

## Thanks

This extension is inspired from the one of [Leonardo Nascimento](https://github.com/leocamello/vscode-smalltalk) for smalltalk.

> Thanks a lot Leonardo!
