# Environment model (`pls-env`)

The Pharo Language Server exposes the code of the image as one tree, the environment model, that every view of the extension can share:

```
project → package → tag → class → side → protocol → method
```

The server side lives in `PLSServer` (protocols `pls - env`, `pls - env changes` and `pls - env edition`) in [Pharo-LanguageServer](https://github.com/badetitou/Pharo-LanguageServer). The extension side lives in `src/env/`:

- `envContracts.ts` types and validates every request and notification below;
- `pharoEnvironment.ts` is the client of one image. It loads the tree on demand, caches it, and invalidates the cache on changes.

This document is the contract between both sides. Version: **1**.

## Capability

The server announces the model in the `initialize` result:

```json
{ "capabilities": { "experimental": { "pls-env": { "version": 1, "didChange": true, "edit": true, "search": true } } } }
```

| Field | Meaning |
| --- | --- |
| `version` | Version of this protocol. |
| `didChange` | The server sends `pls-env/didChange` notifications. |
| `edit` | The server answers `pls-env:read`, `pls-env:compile`, `pls-env:classify` and `pls-env:remove`. |
| `search` | The server answers `pls-env:search`. It then also announces `workspaceSymbolProvider`. |

Without `pls-env`, the server predates the model: the extension creates no `PharoEnvironment` and keeps using the older `pls:*` requests.

## Ids

An id is `<kind>:<path>`. Ids are built from names only, so they survive saving and restarting the image.

| Kind | Path | Example |
| --- | --- | --- |
| `project` | baseline name without `BaselineOf`, or `*` for the volatile project | `project:PharoLanguageServer`, `project:*` |
| `package` | package name | `package:Collections-Sequenceable` |
| `tag` | `<package>/<tag>` | `tag:PharoLanguageServer/Structure` |
| `extensions` | package name | `extensions:PharoLanguageServer` |
| `class` | class or trait name, instance side only | `class:Array` |
| `side` | class name, followed by ` class` for the class side | `side:Array`, `side:Array class` |
| `protocol` | `<side path>>><protocol>` | `protocol:Array class>>instance creation` |
| `method` | `<side path>>><selector>` | `method:Array>>collect:`, `method:Behavior>>>>` |

- The class side is not a class: `class:Array class` is rejected, use `side:Array class`.
- Class names hold no `>`, so the first `>>` of a protocol or method path ends the class, even for the selector `>>`.
- The volatile project gathers the loaded packages that no baseline declares.
- A package declared by several baselines belongs to the first of them, by name.
- The `extensions` node of a package lists the methods it adds to classes of other packages. The parent of such a method is still its protocol in its class, for example `protocol:Object>>*PharoLanguageServer`.

## Nodes

Navigation requests answer nodes:

```json
{
  "id": "method:PLSServerCapabilities class>>forPharo",
  "kind": "method",
  "name": "forPharo",
  "parent": "protocol:PLSServerCapabilities class>>public",
  "hasChildren": false,
  "flags": { "abstract": false, "extension": false, "override": false, "test": false, "deprecated": false, "fromTrait": false }
}
```

`parent` is `null` for a project. Flags depend on the kind:

| Kind | Flags |
| --- | --- |
| `project` | `volatile` |
| `package` | `test` |
| `class` | `abstract`, `test`, `deprecated`, `trait` |
| `protocol` | `extension` |
| `method` | `abstract`, `extension`, `override`, `test`, `deprecated`, `fromTrait` |

A method node whose `fromTrait` flag is set also has a `trait` field: the id of the trait it comes from, such as `class:TCountable`, on both sides.

## Navigation

### `pls-env:projects`

No parameters. Answers the project nodes: one per Metacello baseline, sorted by name, then the volatile project `project:*`.

### `pls-env:children`

Parameters: `id`, and optionally `offset` (zero-based, default `0`) and `limit` (default: all the remaining children).

Answers one page of the children of `id`, and their total number:

```json
{ "items": [ /* nodes */ ], "total": 31 }
```

Children come in display order:

- for a project: its loaded packages, by name;
- for a package: its tags, then the classes outside any tag, then its `extensions` node if it has extension methods;
- for a tag: its classes;
- for `extensions`: its methods;
- for a class: its two sides, instance side first;
- for a side: its protocols;
- for a protocol: its methods;
- for a method: none.

`PharoEnvironment.children` fetches every page, 500 children per request.

### `pls-env:entity`

Parameter: `id`. Answers the node of `id`, with additional fields:

- `package`: id of the package that holds the entity (for an extension protocol, the package of its methods), or `null` for a project;
- `repository`: name of the Iceberg repository that holds this package, or `null`;
- `superclass`: for a class, id of its superclass, or `null`;
- `version`: for a class or a method, its version (see below);
- for a side:
  - `slots`: the names of the slots the side defines itself (instance variables on the instance side, class-side instance variables on the class side);
  - `classVariables`: on the instance side, the names of the class variables of the class, sorted; empty on the class side;
  - `traits`: the ids of the traits the class uses, `class:TFoo`, the same on both sides;
  - `overridden`: the selectors of the side that a subclass redefines, sorted.

## Search

### `pls-env:search`

Parameters: `query`, and optionally `kinds` (an array of `class`, `method`, `package` and `project`, default: all four) and `limit` (default `50`).

The query is one of:

- a term, such as `col`: the classes, methods, packages and projects whose name holds it;
- a class and a term, such as `Array col`, `Array>>col`, `Array class new:` or `Array class>>#new:`: the methods of the classes whose name holds the class, whose selector holds the term. An empty term keeps every method of these classes.

Names match ignoring case. A name equal to the term comes first, then a name that begins with it, then a name that holds it; then shorter names first. A class whose name is exactly the class of the query also offers the methods it inherits, each after its own methods that match as well: `Array col` finds `SequenceableCollection>>collect:` as `Array>>collect:`.

Answers at most `limit` entities of each kind, classes first, then methods, packages and projects:

```json
{
  "items": [
    { "id": "method:SequenceableCollection>>collect:", "kind": "method", "name": "collect:", "parent": "protocol:SequenceableCollection>>enumerating",
      "hasChildren": false, "flags": { "override": true }, "label": "Array>>collect:", "package": "package:Collections-Sequenceable" }
  ],
  "complete": false
}
```

Each item is a node with two more fields: `label`, how to show the entity, and `package`, as in `pls-env:entity`. `complete` is `false` when some kind had more matches than `limit`. The server runs each request in its own process: `$/cancelRequest` stops a search that the client no longer needs.

### `workspace/symbol`

Answers the classes and methods that `pls-env:search` finds for the query, at most 100 of each, as LSP `SymbolInformation`. An empty query answers nothing. The `name` of a method is its label (`Array>>collect:`), its `containerName` is its package, preceded by the class that defines it when it is inherited (`SequenceableCollection (Collections-Sequenceable)`). The `location` is the start of the entity editor (see "Method documents"), named after the image file without `.image`:

```
pharo:/Pharo/Collections-Sequenceable/SequenceableCollection/instance/collect%3A.st
```

### In the extension

`Ctrl+T`, and `#` in Quick Open, list these symbols and open them in entity editors.

The command **Pharo: Spotter…** (`pharo.env.spotter`, `Ctrl+Alt+O`) searches the image as you type, together with the open Pharo editors and the Pharo commands. Each keystroke cancels the previous search. A prefix keeps one kind of entities: `#` classes, `>>` methods, `@` packages, `!` projects. The active class or method shows in a preview editor; choosing it opens its entity editor, choosing a project or a package lists its packages or its classes.

## Edition

A **version** is a SHA-1 of the source: of a method's source, or of a class's definition on both sides plus its comment. It changes whenever the entity changes, whoever changes it.

### `pls-env:read`

Parameter: `id` of a class or method. Answers `{ id, source, version }`, plus `protocol` and `side` for a method. The source of a class is its Tonel definition, comment included, without methods.

### `pls-env:compile`

Parameters: `id`, `source`, and optionally `protocol` and `expectedVersion`. The `id` names one of:

- a method to replace;
- a class whose Tonel definition to load;
- a side (`side:X` or `side:X class`) to add a method to.

Answers:

```json
{ "compiled": true, "id": "method:Array>>sum", "version": "…", "diagnostics": [] }
```

- A source that declares another selector, or another class name, creates that entity and leaves the one named by `id` unchanged. The answer gives the id of what was compiled.
- The protocol of a method defaults to the one of the method it replaces, otherwise `as yet unclassified`.
- Syntax and semantic errors answer `compiled: false`, `id: null` and `version: null`, and leave the image unchanged.
- An undeclared variable is only a warning: the method compiles.

Each diagnostic has a `message`, a `severity` (`1` error, `2` warning) and an LSP `range` in the source:

```json
{ "message": "Variable or expression expected", "severity": 1, "range": { "start": { "line": 1, "character": 10 }, "end": { "line": 1, "character": 10 } } }
```

### `pls-env:classify`

Parameters: `id` of a method and `protocol`. Moves the method to `protocol` without compiling it again: its version does not change. Answers `{ id, protocol }`, the protocol the method is now in. The image notifies the change as `moved`.

### `pls-env:remove`

Parameters: `id` of a class or method, and optionally `expectedVersion`. Answers `{ "removed": id }`. A method that comes from a trait must be removed from the trait.

### Conflicts

When `expectedVersion` is given and the entity is no longer at that version, or no longer exists, `pls-env:compile` and `pls-env:remove` change nothing. They fail with this error:

```json
{ "code": -32001, "message": "method:Array>>sum changed in the image", "data": { "id": "method:Array>>sum", "currentVersion": "…" } }
```

`currentVersion` is `null` when the entity was removed. `envConflictOf` reads this error on the extension side.

## Changes: `pls-env/didChange`

Once the client sends `initialized`, the server listens to the system announcements and notifies the changes of the image, whoever makes them (playground, MCP agent, Iceberg checkout, the extension itself):

```json
{
  "changes": [
    { "kind": "added", "id": "method:Array>>sum", "parent": "protocol:Array>>math", "version": "…" },
    { "kind": "renamed", "id": "class:Basket", "oldId": "class:Bag" },
    { "kind": "moved", "id": "method:Array>>sum", "parent": "protocol:Array>>enumerating", "oldParent": "protocol:Array>>math" }
  ],
  "reset": false
}
```

| `kind` | Fields |
| --- | --- |
| `added` | `parent`, and `version` for a class or method |
| `changed` | `version` for a class or method |
| `removed` | `parent` when known |
| `renamed` | `oldId` |
| `moved` | `parent`, `oldParent` |

- **Grouping.** Changes are sent once the image stays quiet for 100 ms, or at most 500 ms after the first of them. A pending change replaces an earlier one of the same kind on the same entity.
- **Reset.** Past 1000 pending changes, during a Metacello load or an Iceberg checkout for example, the server drops them. Once the image is quiet, it sends one notification with `reset: true` and no changes: the client reloads everything.
- **Renaming a class.** It produces one `renamed` change. The ids of its sides, protocols and methods change with it.
- **Renaming a protocol.** Pharo announces it as the new protocol `added`, each method `moved`, then the old protocol `removed`.
- **Removed classes.** A removed class is notified under its own name, not as `AnObsolete…`.

`PharoEnvironment` invalidates its cache on each notification: the parents of the changes, and every renamed or removed entity with all it holds. Then it fires `onDidChange`.

### In the extension

`EnvChangeBus` (`src/env/environmentChanges.ts`) is the event bus that the views listen to. It gathers the notifications that arrive within 100 ms of each other, for at most 500 ms, and fires one `EnvChangeSummary` per burst: the classes changed or removed, the packages whose classes changed, whether the list of packages changed, and whether the server sent a reset. Views that know entities by name use the summary, views built on ids use its `changes`.

On each summary:

- the `pharoImage:` file system and its tree reload the classes of the packages concerned, and fire `onDidChangeFile` for the open class documents concerned. VS Code then reloads the documents without local changes;
- an open class document with local changes is in conflict: the extension warns the user and offers to revert it to the image version, until entity editors detect conflicts on save (#64);
- the Test Explorer resolves again the test packages and classes concerned that it already shows;
- Iceberg refreshes the state of its repositories.

Refreshing a view only reads the image, so it produces no new notification.

## Method documents

An editor of one method uses the URI:

```
pharo:/<image>/<package>/<class>/<instance|class>/<selector>.st
```

Each segment is percent-encoded. In the selector, the extension first escapes `%` as `%25` and `/` as `%2F`, which encode again on the wire: `//` is `pharo:/PLS/Kernel/Number/instance/%252F%252F.st`. The editor of a method not compiled yet uses the selector segment `(new method)`. From this URI, the server knows the class and side of the method; it ignores the selector segment. Completion, diagnostics, hover, formatting and document symbols then treat the text as a method of that class: completion proposes `self`, `super`, the instance variables and the arguments.

A class definition editor uses `pharo:/<image>/<package>/<class>.class.st`, which the server reads as a Tonel document. The package segment is informative: the server finds the class by name.

### In the extension

`PharoEntityFileSystem` (`src/env/entityFileSystem.ts`) serves the `pharo:` scheme. The commands **Pharo: Open Class or Method…** (`pharo.env.openEntity`, for example `Array>>collect:`) and **Pharo: New Method…** (`pharo.env.newMethod`) open these editors, also from the context menu of a class in the `pharoImage:` explorer.

- **Reading** answers `pls-env:read` and records the version.
- **Saving** compiles with `pls-env:compile`, passing the latest version seen as `expectedVersion`. The client does not send `textDocument/didSave` for these documents, so that the server does not load a `.class.st` a second time.
- **Compilation errors** fail the save: the editor keeps its text, and the diagnostics of `pls-env:compile` show on it until the next edit.
- **A renamed selector** compiles a new method, as in Pharo: its editor opens, and the edited editor goes back to the source of the image. Saving a new method compiles it on its side, in the protocol chosen when it was created.
- **Conflicts.** Each entity gets a modification time that moves forward when its version changes. On `pls-env/didChange`, the extension tells VS Code which open editors changed: VS Code reloads those without local changes. Saving one with local changes makes VS Code offer to compare, overwrite or revert. When the image changes between that check and the compilation, the server answers a conflict: the save fails, and saving again offers the same choice.
- **Removed entities.** A removed method or class shows as deleted. Saving its editor compiles the method again on its side.
- **Tab titles.** The extension sets `workbench.editor.customLabels.patterns` so that a method tab reads `Array>>collect:` or `Array class>>new:`.

## Class panel

The **Class** view (`pharoClassPanel`) lives in the Secondary Side Bar. `ClassPanel` (`src/env/classPanel.ts`) shows the class of the active editor: a `pharo:` entity editor, a `pharoImage:` class, or a Tonel file (`.class.st`, `.trait.st`, `.extension.st`).

- **Sides.** The title buttons switch between the instance side, the class side and the traits of the class. Opening a method editor shows its side and selects it in its protocol.
- **Sections.** On a side, the panel shows its slots and class variables (`pls-env:entity` of the side), then its protocols, each with its number of methods, after `(All)`, which lists all the methods of the side. In traits mode, it shows each trait the class uses with its protocols and methods, its class side apart.
- **Markers.** A method shows `↑` when it overrides a method of a superclass, `↓` when a subclass redefines it, then `abstract`, `extension`, `from <trait>` and `deprecated`. A test shows a beaker, an extension method a purple icon.
- **Filter.** **Filter Slots and Methods…** keeps the slots and methods whose name holds a text, and hides the protocols left empty.
- **Actions.** New method in a protocol, accessors for a slot (in `accessing`, skipping those that exist), move a method to another protocol (`pls-env:classify`), remove a method, and run a test.
- **Changes.** On each `EnvChangeSummary` that names the class or one of its traits, or on a reset, the panel loads the class again.
