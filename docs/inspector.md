# Inspector (`pls-inspector`)

The Pharo Language Server lets the extension inspect objects of the image, as Pulsar's `PulsarInspector` does: an object shows its slots (Raw), its class hierarchy (Meta) and the inspections its class adds to the Pharo inspector (`<inspectorPresentationOrder:title:>` methods such as Items, Preview or Definition), and inspecting a slot or a row opens a page on it.

The server side lives in `PLSServer` (protocol `pls - inspector`) in [Pharo-LanguageServer](https://github.com/badetitou/Pharo-LanguageServer). The extension side lives in `src/inspector/`:

- `inspectorContracts.ts` types and validates every request below;
- `inspectorSession.ts` keeps the pages of the Inspector view and releases the references they no longer show;
- `inspectorView.ts` provides the Inspector view, in the panel, the quick inspector, a hover on the code of an Inspect it, and their commands.

This document is the contract between both sides. Version: **1**.

## Capability

```json
{ "capabilities": { "experimental": { "pls-inspector": { "version": 1 } } } }
```

Without `pls-inspector`, the inspector commands are disabled.

## References

The image keeps every object it answers under a reference, a string, until the client releases it. Each answer gives new references, even to an object the client already holds, so that each page of the view can release its own. The extension releases the references of a page when the page closes or shows another view.

## Requests

| Request | Params | Result |
| --- | --- | --- |
| `pls-inspector:evaluate` | `expression`, `textDocumentURI?`, `receiver?` | an object |
| `pls-inspector:inspect` | `ref` | an object |
| `pls-inspector:view` | `ref`, `view`, `offset?`, `limit?` | a view |
| `pls-inspector:children` | `ref`, `offset?`, `limit?` | `{ items, total }`, the slots and indexed items of the object |
| `pls-inspector:release` | `refs?`, `all?` | `null` |

`pls-inspector:evaluate` evaluates `expression` with `self` bound to the object of the reference `receiver` when given, else with the bindings of the document `textDocumentURI`. An error the evaluation signals is the result, and the object then carries its message in `error`. A syntax error answers the JSON-RPC error `-32602`, as does an unknown reference.

An object is:

```json
{ "ref": "12", "className": "Array", "printString": "#(1 2 3)", "hasChildren": true,
  "views": [{ "id": "inspectionItems:", "title": "Items" }, { "id": "raw", "title": "Raw" }, { "id": "meta", "title": "Meta" }],
  "error": null }
```

A view is one of:

| `kind` | Fields | Built from |
| --- | --- | --- |
| `tree` | `items`, `total` | `raw`: the inspector nodes of the object |
| `table` | `columns`, `items` with `cells`, `total` | `meta`, and inspections answering a list, a table or a tree (its roots only) |
| `text` | `text` | inspections answering a text or code presenter |
| `unsupported` | `text`, the reason | other inspections, such as graphical ones |

An item is a slot, an indexed item or a row, with a new reference to the object it shows:

```json
{ "name": "1", "ref": "13", "className": "SmallInteger", "printString": "1", "hasChildren": false, "cells": ["1", "1"] }
```

`offset` is zero-based and defaults to 0; `limit` defaults to all the remaining items. The extension asks for 100 at a time.

## Opening the inspector from another feature

The command `pharo.inspector.inspect` opens the Inspector view on `{ ref, label? }`, a reference the client holds, or on `{ expression, textDocumentURI?, label? }`, which it evaluates. A feature of the image, such as the debugger, can give the client a reference with `PLSServer>>inspectorRegister:`. The command takes the reference over: the view releases it when its page closes, so the caller must not release it.
