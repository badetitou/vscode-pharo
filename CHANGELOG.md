# Changelog

## v2.1.19

- Update URL when downloading VM

## v2.1.18

- Default Pharo server is now v5 for Pharo12

## v2.1.17

- Syntax highlight for Ston

## v2.1.16

- Native Test integration

## v2.1.14

- Up default version of the server

## v2.1.13 & 2.1.12

- Add several options to configure the quickinstall

## v2.1.11

- Update to Moose11 image by default
- Add quick debug command to show log with the command `pharo.openLog` that shows in/out message
- Add clear log too

## v2.1.10

Add an icon in the status bar used when downloading the last version of the Language Server

## v2.1.8

- `showIt` should present the result inside a popUp

## v2.1.7

- Should fix vm path install in macOSX

## v2.1.6

- [fix new requirement for badges](https://learn.microsoft.com/en-us/azure/devops/extend/develop/manifest?view=azure-devops#approvedbadges)
## v2.1.5

- beta introduces iceberg integration (only showing existing repo for now)
- Update to last Pharo Language Server
  - Fix printIt command

## v2.1.4

- Fix bug when having no focused editor

## v2.1.3

- Enable usage of variable panel when using the notebook
- Clean the typescript code
- Fix notebook show image in linux system (because a variable not required using windows system is required when using linux?)

## v2.1.2

- Use server version 3.1.1 in quick install

## v2.1.1

- Enable LSP for notebook

## v2.1.0

- Notebooks supports several outputs mimetype

## v2.0.3

- Fix easy install for linux and mac

## v2.0.2

Execute the command `Install the last version of the language server` and get directly your environment set up.

## v2.0.1

- Add icon for Pharo files and Moosebook file

## v2.0.0

- Update to last version of VSCode (following API changement)
- Update following v3 of [Pharo Language Server](https://github.com/badetitou/Pharo-LanguageServer/tree/v3)

## v1.1.2

- `Show it` now tries to use the GTK backend of Pharo

## v1.1.1

- Fix MooseBook to display errors

## v1.1.0

Support of MooseBook

## v1.0.7

- add walkthroughs to install the plugin

## v1.0.6

- Add error message when the process dies
- Check that the path to the VM and to the image exists

## v1.0.5

- Can edit documents from pharoImage
- Can not extend variables without children

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
- Fix bug with debugger that did not work if we used a headless image (see Pharo Language Server v1.1.1)
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

- Add the Pharo Image tree to explore all methods of an image easily
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