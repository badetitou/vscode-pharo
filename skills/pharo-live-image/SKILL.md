---
name: pharo-live-image
description: Use whenever you read, write, search or run Pharo (Smalltalk) code in the Pharo image of this VS Code window. Explains how the live image works, which tools of the Pharo MCP server to use for each task, and the coding conventions of Pharo.
---

# Working in the live Pharo image

The code of a Pharo project lives in a running **image**, not in files. The image of this window runs the Pharo language server, which starts a Pharo MCP server: its tools read and change the image directly. A change is live as soon as it compiles: there is no build step, and the views and editors of VS Code follow it.

- Work on **entities** (packages, classes, methods), with the tools of the Pharo MCP server. Do not edit `.st` files to change code, and do not write Tonel by hand: Tonel files are only the format Iceberg writes to git.
- The image is shared with the user: everything you compile or evaluate happens in their running system. Keep side effects to what the task needs.
- Never save the image (`Smalltalk snapshot:…`) and never commit unless the user asks.

## Which tool

The Pharo MCP server advertises a few tools and keeps the others discoverable: when a tool below is not in your list, find it with `tool_search` and run it with `tool_call` (`tool_get` gives its input schema).

| Task | Tool |
| --- | --- |
| Find a class, its package, hierarchy | `class_search`, `class_get` (`includeComment`, `upToSuperclass`, `subclassDepth`) |
| Find packages | `package_search` |
| Find methods by selector, protocol, class or package | `method_search` |
| Read a method | `method_get` |
| Find senders, references to a class or variable | `method_reference_search` |
| Find methods by source text | `method_source_search` |
| Create or change a class | `class_create`, `class_update` |
| Compile a method (new or changed) | `method_compile` |
| Rewrite methods structurally (AST) | `method_rewrite` (previews first) |
| Remove | `method_remove`, `class_remove` |
| Run tests | `test_run`; with coverage `test_coverage_run` |
| Code critiques (Renraku) | `critique_run` |
| What changed, undo a change | `history_entry_list`, `history_entry_revert` |
| Open debuggers, values while running | `debug_search`, `debug_watch` |
| Anything else | `image_evaluate` — the escape hatch, only when no tool fits |

Prefer exact queries to guessing: senders, implementors and references answer exactly in Smalltalk, so search before writing a method that may already exist, and read a class before changing it.

## Pharo conventions

- **Packages**: `Project-Core`, `Project-Tests`…; tests live in a test package. Use the class prefix of the project.
- **Classes**: every class has a comment saying what it is responsible for. Instance variables are slots declared in the class definition; class-side methods are on `Foo class`.
- **Protocols**: put each method in a protocol: `initialization`, `accessing`, `testing` (for `isFoo` methods), `printing`, `comparing`, `converting`, `enumerating`, `private`, `tests` for test methods, `instance creation` on the class side.
- **Initialization**: `initialize` starts with `super initialize`. Instance creation methods on the class side answer `self new setFoo: …; yourself` or `^ self new foo: aFoo; yourself`.
- **Accessors** are named after the variable: `name` and `name:`. A setter does not answer the value.
- **Cascades** (`;`) send several messages to the same receiver; end a cascade with `yourself` when its value is used.
- **Answers**: a method without `^` answers `self`. Use `^` early returns rather than nested conditionals.
- **nil**: prefer `ifNil:`, `ifNotNil:`, `ifEmpty:` and null objects to `isNil ifTrue:`.
- **Collections**: use `do:`, `collect:`, `select:`, `reject:`, `detect:ifNone:`, `inject:into:`, `anySatisfy:`, `allSatisfy:`; build strings with `String streamContents: [ :s | … ]` or `,`.
- **Polymorphism** over type checks: avoid `isKindOf:` and `class ==` tests; add a method to the classes concerned.
- **printOn:** describes an object for the inspector and the debugger; implement it on domain classes.
- **Tests**: subclasses of `TestCase`, one test class per class (`FooTest`), test selectors start with `test`, assertions are `self assert: actual equals: expected`, `self deny:`, `self should: [ … ] raise: Error`.
- **Formatting**: tabs for indentation, one statement per line, keyword messages with spaces after colons, temporaries declared at the top of the method between bars.
