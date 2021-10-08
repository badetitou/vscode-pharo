# Changelog

## v1.1.0

Support of MooseBook

## v1.0.7

- add walkthroughs to install the plugin

## v1.0.6

- Add error message when the process dies
- Check that the path to the VM and to the image exist

## v1.0.5

- Can edit document from pharoImage
- Can not extends variables without children

## v1.0.4

Fix documentation

## v1.0.3

- Add the variables document explorer browser

## v1.0.2

- bug fixes with the image explorer

## v1.0.1

### Users

- Improve snippets with autocompleted class name and package name to ease the creation of class and new methods
- Improve documentation
- Fix bug with the "inspect it" command
- Fix bug with debugguer that did not work if we used a headless image (see Pharo Language Server v1.1.1)
- Begin tree view for the variable of a document
- Executing `self inform:` is now reflected in the VSCode UI

## v1.0.0

- Move to version 1.0.0

### Users

- A real custom tree view to access the image with the correct logo
- Support run class test**s**
- Modification of the binder (script files are not considered as playground with separate variable binding/holders)

And coming from the Pharo Language Server

- Document symbol
  - Outline
  - Breadcumber
- References (jump to type definition)

## v0.0.12

### Users

- Support code lens to run Pharo tests from VSCode

### Developers

We added a full new document model to better handle tonel and script file.

## v0.0.11

- Add the Pharo Image tree to explore easily all methods of an image
- The port is now given by the Pharo image at startup (everything goes faster, and less bug possible)

## v0.0.10

- Support Language Server Protocol diagnostics

## v0.0.9

- Add three snippets
  - `nmethod` allows you to create easily a new instance side method in a tonel file
  - `ncmethod` allows you to create easily a new class side method in a tonel file
  - `nclass` allows you to define the class of a tonel file
- Improve the documentation

## v0.0.8

This update comes from the release of the Pharo-LanguageServer. Thus, most of the code modification can be found in the server repository.

### Users

#### LSP

- You can now format tonel file
- Chinese characters are supported (best utf-8 support)
- We fix a bug with signature help

### Developers

I introduce a proposed branch with the proposed API of VSCode.
It includes the support of VSCode Notebook.

### Misc

- add a logo to the extension

## v0.0.7

This update comes from the release of the [Pharo-LanguageServer](https://github.com/badetitou/Pharo-LanguageServer).
Thus, most of the code modification can be found in the server repository.

### Users

#### DAP

- Can stepIn (into), step next (through), step out (over)
- Can access the source code of the stack element
- Show the line where the error was signaled

#### LSP

- Add the help signature feature
  - When writing a method, a help box appears with information for this methods (parameters, comment, *etc.*)

### Developers

#### DAP

- The server uses now a Debug Session
- The DAP gives correctly the socket port using LSP

## v0.0.6

### Users

#### DAP

We introduce the [DAP](https://microsoft.github.io/debug-adapter-protocol/implementors/adapters/) in the server and client.
So it is possible now to debug your Pharo application from VSCode

## v0.0.5

### Users

#### LSP

- Bug fix when using printIt and showIt command with the current editor closed (or closed and then open again)

## v0.0.4

### Users

We introduced the [LSP](https://microsoft.github.io/language-server-protocol/).
It is now possible to get helps from a Pharo image inside VScode