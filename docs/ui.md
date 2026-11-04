# Tools and questions of the image (`pls-ui`)

In Pharo, the tools are objects the code calls: `anObject inspect`, `aClass browse`, `UIManager default confirm: 'Sure?'`. In the image served to VS Code they would open windows nobody sees, and a question would block the process that asked it. With `pls-ui`, the language server shows them in VS Code: the inspector opens the **Inspector** view, the browser the editor of the class or method, the questions open dialogs, input boxes and Quick Picks of VS Code, and the jobs of the image the progress of VS Code.

The server side lives in `PLSServer` (protocol `pls - ui`), `PLSUIManager`, `PLSClientTool` and its subclasses, and `PLSAbstractServer>>sendRequestAndWait:params:` in [Pharo-LanguageServer](https://github.com/badetitou/Pharo-LanguageServer). The extension side lives in `src/ui/imageUi.ts`.

This document is the contract between both sides. Version: **1**.

## Enabling

The client asks for it in its initialization options, since an older client would not answer the requests below:

```json
{ "initializationOptions": { "ui": { "version": 1 } } }
```

The server then announces it, unless it runs in debug mode (`pharo.debugMode`), where the tools and the questions stay in Pharo:

```json
{ "capabilities": { "experimental": { "pls-ui": { "version": 1 } } } }
```

When it is enabled, the server registers its own `inspector` and `browser` in `Smalltalk tools` (the original tools handle what VS Code does not show, and come back when the server stops), lets `PLSUIManager` send its questions to the client, and reports the jobs of the image.

## Tools

| Pharo | Message to the client |
| --- | --- |
| `anObject inspect`, `Smalltalk tools inspector inspect: anObject` | notification `pls-ui/inspect` |
| `aClass browse`, `aMethod browse`, `Smalltalk tools browser openOnClass:selector:` | request `window/showDocument` on the URI of the entity editor |

`pls-ui/inspect` has the params `{ ref, label? }`: `ref` is a reference of [the inspector](inspector.md), which the Inspector view takes over and releases when its page closes.

## Questions

The server sends a request and the process that asked waits for the answer. A question the user dismisses, or a client that answers with an error, gives Pharo the answer of a cancelled dialog (`nil`, or `false` for a yes/no question). A `ProvideAnswerNotification` handler still answers in Pharo without asking.

| Request | Params | Result | Pharo |
| --- | --- | --- | --- |
| `pls-ui/confirm` | `message`, `title?`, `trueChoice?`, `falseChoice?`, `cancelChoice?` | `true`, `false` or `null` | `confirm:`, `confirm:orCancel:`, `confirm:trueChoice:falseChoice:`… |
| `pls-ui/request` | `message?`, `title?`, `initialAnswer?`, `password?`, `multiline?` | a string or `null` | `request:`, `request:initialAnswer:`, `requestPassword:`, `multiLineRequest:…` |
| `pls-ui/choose` | `items` (strings), `message?`, `title?`, `allowOther?` | `{ index }` (zero-based), `{ text }` when `allowOther`, or `null` | `chooseFrom:…`, `chooseOrRequestFrom:…`, `chooseDropList:…` |
| `pls-ui/chooseFile` | `title?`, `path?`, `directory?`, `save?`, `extensions?` | a path or `null` | `chooseDirectory:…`, `chooseExistingFileReference:…`, `chooseForSaveFileReference:…`, `chooseFullFileNameMatching:label:` |

VS Code shows `confirm` as a modal dialog, `request` as an input box (a multi-line text in an editor, accepted from a notification), `choose` as a Quick Pick and `chooseFile` as the open or save dialog.

`inform:`, `alert:`, `message:title:`, `abort:` and `deny:` are notifications `window/showMessage` (information, warning or error) and do not wait.

## Progress

The jobs of the image (`Job`, `displayProgress:from:to:during:`, `informUserDuring:`) are reported with the work done progress of LSP: `window/workDoneProgress/create`, then `$/progress` with `begin`, `report` (when the percentage or the title changes) and `end`. The job waits at most 2 seconds for the client to create the progress.
