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
{ "capabilities": { "experimental": { "pls-env": { "version": 1, "didChange": true, "edit": true } } } }
```

| Field | Meaning |
| --- | --- |
| `version` | Version of this protocol. |
| `didChange` | The server sends `pls-env/didChange` notifications. |
| `edit` | The server answers `pls-env:read`, `pls-env:compile` and `pls-env:remove`. |

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
- `version`: for a class or a method, its version (see below).

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

## Method documents

An editor of one method uses the URI:

```
pharo:/<image>/<package>/<class>/<instance|class>/<selector>.st
```

Each segment is percent-encoded, for example `pharo:/PLS/Kernel/Number/instance/%2F%2F.st`. From this URI, the server knows the class and side of the method. Completion, diagnostics, hover, formatting and document symbols then treat the text as a method of that class: completion proposes `self`, `super`, the instance variables and the arguments.

A class definition editor uses `pharo:/<image>/<package>/<class>.class.st`, which the server reads as a Tonel document.

The extension does not open these editors yet (#64). Saving one is meant to compile it with `pls-env:compile`, passing as `expectedVersion` the version read when the editor was opened.
