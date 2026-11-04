# System tools (`pls-system`, `pls-chest`)

The tools Pharo gives on the system itself: the **Processes** of the image, to find a stuck process and terminate or debug it, **Profile It**, which shows where the time of an expression goes, and the **Chest**, which keeps objects by name to use them again from the playground, the inspector and the debugger.

The server side lives in `PLSServer` (protocols `pls - system` and `pls - chest`) in [Pharo-LanguageServer](https://github.com/badetitou/Pharo-LanguageServer). The extension side lives in `src/system/`:

- `systemContracts.ts` types and validates every request below;
- `processesView.ts` provides the **Processes** view of the Pharo sidebar;
- `profiler.ts` provides **Profile It** and the page of a profile;
- `chestView.ts` provides the **Chest** view, next to the inspector.

This document is the contract between both sides. Version: **1**.

## Capability

```json
{ "capabilities": { "experimental": { "pls-system": { "version": 1, "processes": true, "profile": true, "chest": true } } } }
```

Without `pls-system`, the views and the commands are hidden. `chest` says that the server answers the `pls-chest` requests; Chest itself may still not be loaded in the image (see `pls-chest:list`).

## Processes

| Request | Params | Result |
| --- | --- | --- |
| `pls-system:processes` | | `{ items }`, the processes not terminated, the highest priority first |
| `pls-system:stack` | `id`, `limit?` (50) | `{ items }`, the frames of the process, the top first: `{ label, uri }` |
| `pls-system:terminate` | `id` | `null` |
| `pls-system:debug` | `id` | `{ debugSessionId }` |

A process is:

```json
{ "id": 733087488, "name": "Calypso update", "priority": 31, "state": "waiting",
  "method": "[] in ClyNavigationEnvironment>>#updateProcess", "uri": "pharo:/…", "ui": false, "current": false }
```

| Field | Meaning |
| --- | --- |
| `id` | The identity hash of the process, valid while it lives. An unknown or terminated process answers `PLSUnknownEntity`. |
| `state` | `running` (the process answering), `ready` (waits for the processor), `waiting` (on a semaphore), `suspended`, `terminated`. |
| `method`, `uri` | The method the process runs, as `Class>>selector` (`[] in …` for a block), and the URI of its editor when it is installed, or `null`. A process waiting on `Semaphore>>wait`, a primitive, shows the method that waits. |
| `ui` | The process of the user interface of the image. |
| `current` | The process answering the client: `terminate` and `debug` refuse it (`JRPCInvalidParameters`). |

`pls-system:debug` suspends the process, keeps a debug session on it and tells the client with the notification `pls-debug/stopped`, with `breakpoint: true` so that the debugger opens at once (see `src/debugLive.ts`).

The extension asks for a confirmation before `terminate`, with a warning for the process of the user interface and for the processes at priority 50 or above, which run the system.

## Profile

| Request | Params | Result |
| --- | --- | --- |
| `pls-system:profile` | `expression`, `textDocumentURI?` | `{ milliseconds, samples, error, root }` |

The image evaluates `expression` with the bindings of the document, as the playground does, while `MessageTally` samples its process every millisecond. A syntax error answers `JRPCInvalidParameters`; an error the code signals stops it, and its description is `error`.

`root` is the do it, a node:

```json
{ "label": "Array(SequenceableCollection)>>sort:", "uri": "pharo:/…", "samples": 22, "selfSamples": 0, "children": [] }
```

`samples` counts the samples of the call and of the calls under it, `selfSamples` the samples in the method itself. Calls sampled less than 0.2% of the samples of the root are left out.

The extension shows a profile in a page: the calls as a flame graph, the root on top, and the methods that cost the most, by their own samples. Clicking a call or a method opens its editor.

## Chest

[Chest](https://github.com/pharo-spec/Chest) keeps objects by name in chests, the `Default` one first. It is not part of the language server: `pls-chest:list` says whether it is loaded, and the view tells how to load it otherwise.

| Request | Params | Result |
| --- | --- | --- |
| `pls-chest:list` | | `{ available, chests }` |
| `pls-chest:inspect` | `chest?`, `key` | an object of [the inspector](inspector.md), under a new reference |
| `pls-chest:store` | `ref`, `chest?`, `key?` | `{ key }` |
| `pls-chest:remove` | `chest?`, `key` | `null` |

A missing `chest` is the default chest. A chest is `{ name, items }`, an item `{ key, className, printString, code }`, where `code` answers the object, as *Paste object from chest* writes it: `(Chest named: 'Default') at: 'cart'`.

`pls-chest:store` keeps the object of the reference `ref` of the inspector under `key`, or under a name the chest chooses when `key` is missing. A name already used answers `JRPCInvalidParameters` with the message of Chest.

## Method history

The history of a method stays in a Quick Pick (**Show Method History**, see `src/env/methodHistory.ts`): the Timeline API of VS Code is still proposed in the version of VS Code the extension requires.
