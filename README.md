# vscode-pharo <!-- omit in toc -->

[![Pharo Language Server](https://vsmarketplacebadge.apphb.com/version/badetitou.pharo-language-server.svg)](https://marketplace.visualstudio.com/items?itemName=badetitou.pharo-language-server)

A Pharo client extension for VSCode.

- [Supported files](#supported-files)
- [Features](#features)
  - [Generic feature](#generic-feature)
  - [Supported Language Server feature](#supported-language-server-feature)
  - [Debug Adapter Protocol feature](#debug-adapter-protocol-feature)
  - [Additional feature](#additional-feature)
- [Installation](#installation)
- [Thanks](#thanks)

## Supported files

This extension support *.st* files and *.class.st* files (tonel format)

## Features

We present here the existing features

### Generic feature

**Code highlighting**

![Highlighting](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/highlighting.png)

**Breadcrumbs & Outline**

![Breadcrumbs & Outline](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/breadcrumbs-and-outline.gif)

### Supported Language Server feature

**Code formatting**

![Format gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/format.gif)

**Tonel file formatting**

![Tonel file formatting](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/format-tonel.gif)

**Hover**

![Hover](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/hover.png)

**Auto-completion**

![Auto-Completion](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/Auto-completion.gif)

**Help with method signature**

![Signature help gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/signatureHelp.gif)

**Diagnostics**

![Diagnostics gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/diagnostics.gif)

**Code Lens (Run Tests)**

![Run test gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/runTest.gif)

**Jump type Definition**

![Jump type Definition gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/jump-type-def.gif)

### Debug Adapter Protocol feature

1. Break on halt
   1. Show the stack
   2. Show the variables
   3. Add watch

![Break on halt](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/breakOnHalt.gif)

2. Step, step in, step out

![Step the stack gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/debugSteps.gif)

### Additional feature

The additional feature can be access using the command palette of VSCode

1. Save the Pharo image
2. Execute and show the result

![Inspect gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/inspectResult.gif)

3. Execute and print the result

![Print gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/printResult.gif)

4. Keep variable state

![Keep Variable state gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/keep-variable-state.gif)

5. Explore variable state

![Explore variable state gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/documentVariablesBrowser.gif)

1. Show the current server version

![Show version gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/pharo-version.gif)

6. Saving a tonel file in VSCode, save the corresponding methods/class in the Pharo image

7. Access Pharo Image

![Access Pharo Image gif](https://raw.githubusercontent.com/badetitou/vscode-pharo/main/docs/img/accessPharoImage.gif)

## Installation

To install the extension:

1. Install [VSCode](https://code.visualstudio.com/)
2. Install the [Pharo extension](https://marketplace.visualstudio.com/items?itemName=badetitou.pharo-language-server)
3. Download a [Pharo Language Server image](https://github.com/badetitou/Pharo-LanguageServer/releases) or [install the server](https://github.com/badetitou/Pharo-LanguageServer#installation) in a pre-existing image
4. Download a [VM](https://files.pharo.org/vm/pharo-spur64-headless/) (headless or not) for the image
5. Set up the Pharo extension property
   1. pharo.pathToVM: is the path to the VM executable
      1. Windows: `C:\path\to\pharo.exe`
      2. Linux: `/path/to/pharo`
      3. MacOS: `/path/to/Pharo.app/Contents/MacOS/Pharo`
   2. pharo.pathToImage: is the absolute path to the image

> From version v1.0.0, please use at least version v1.1.0 of the Pharo Language Server.

## Thanks

This extension is inspired from the one of [Leonardo Nascimento](https://github.com/leocamello/vscode-smalltalk) for smalltalk.

> Thanks a lot Leonardo!
