# Breakpoints (`pls-debug`)

The breakpoints of VS Code are [debug points](https://github.com/pharo-project/pharo/tree/Pharo13/src/DebugPoints) of the image: `BreakDebugPoint`s on the statements of methods, with the behaviors of Pharo. Unlike the breakpoints of a program a debugger launches, they stay installed in the image whether a debug session runs or not, as in Pharo: a process that hits one stops, and the client attaches a `pharodb` debug session to it (`pls-debug/stopped`, then a DAP `attach`).

The server side lives in `PLSServer` (protocol `debug`), `PLSHitConditionBehavior` and `PLSLogPointBehavior` of [Pharo-LanguageServer](https://github.com/badetitou/Pharo-LanguageServer), and in `DAPServer` for the DAP requests. The extension side lives in `src/debugPoints.ts`.

## What a breakpoint becomes

| VS Code | Debug point |
| --- | --- |
| Breakpoint on a line of a method editor | `BreakDebugPoint` on the first statement that starts on the line or after it, in the method or in a block of it |
| Condition | `ConditionBehavior`, the expression evaluated in the context of the hit |
| Hit count | `PLSHitConditionBehavior`: `5` or `==5` (the fifth hit), `>5`, `>=5`, `<5`, `<=5`, `%5` (every fifth hit) |
| Log message (logpoint) | `PLSLogPointBehavior`: writes the message on the `Transcript`, each `{expression}` replaced by its print string, and does not stop |
| Function breakpoint `Class>>selector` | `BreakDebugPoint` on the first statement of the method |

Only the breakpoints of method editors (`pharo:/<image>/<package>/<class>/<side>/<selector>.st`) are installed; the ones of class editors and of Tonel files are not.

## Requests

| Request | Params | Result |
| --- | --- | --- |
| `pls-debug:setBreakpoints` | `entity`, `breakpoints` | an answer per breakpoint |
| `pls-debug:setFunctionBreakpoints` | `breakpoints` | an answer per breakpoint |
| `pls-debug:breakpoints` | | the breakpoints of the image |

`pls-debug:setBreakpoints` replaces the breakpoints of the method `entity`, a pls-env id such as `method:Shop>>sum:`, by `breakpoints`: `[{ line, condition?, hitCondition?, logMessage? }]`, `line` counted from 1 in the source of the method. An empty list removes them. `pls-debug:setFunctionBreakpoints` replaces all the function breakpoints by `breakpoints`: `[{ name, condition?, hitCondition? }]`, `name` as `Class>>selector`, `Class class>>selector` or `Class>>#selector`.

An answer is `{ "verified": true, "line": 6 }`, the line where the breakpoint stops, or `{ "verified": false, "message": "No statement on this line or after it" }`.

`pls-debug:breakpoints` answers the debug points of the image that stop, whoever set them (Pharo, an agent, another client), except the function breakpoints:

```json
[{ "entity": "method:Shop>>sum:", "uri": "pharo:/PLS/Shop/Shop/instance/sum%3A.st", "line": 6, "condition": "b > 1" }]
```

The `pls-debug/stopped` notification of a process stopped on a breakpoint has `"breakpoint": true`: the client opens the debugger at once, without the notification it shows for an error.

## In the extension

- At start, the extension adds the breakpoints of `pls-debug:breakpoints` on the methods that have none in VS Code, then installs the breakpoints of VS Code.
- Each change of the breakpoints (`vscode.debug.onDidChangeBreakpoints`) sends again the breakpoints of the methods it touches, or the function breakpoints. Disabled breakpoints are not installed.
- Compiling a method removes its debug points (`DebugPointManager>>#handleMethodModified:`): saving a method editor installs its breakpoints again. A method changed elsewhere (in Pharo, by an agent) loses them until its breakpoints change or its editor is saved.
- The breakpoints the image does not install are written in the **Pharo Language Server** output channel.

## DAP

During a debug session, the DAP server of the image answers:

- `setBreakpoints` on a method editor with the breakpoints installed by `pls-debug:setBreakpoints` (it does not install them); on another source, it keeps the former breakpoints of a launched program;
- `setFunctionBreakpoints` by installing them, as `pls-debug:setFunctionBreakpoints`;
- `setExceptionBreakpoints` by keeping the exception filters in the image, where they apply after the session too.

The capabilities announce conditional, hit conditional and log breakpoints, function breakpoints and these exception filters:

| Filter | Default | Stops on |
| --- | --- | --- |
| `error` (Unhandled Errors) | on | the errors and warnings nobody handles; its condition names the classes that stop, such as `ZeroDivide, KeyNotFound` |
| `messageNotUnderstood` | off | the messages not understood nobody handles, even when `error` is off |
| `halt` (Halts) | on | `self halt` and `Halt now` |
| `deprecation` (Deprecations) | off | the calls of deprecated methods (it sets `Deprecation raiseWarning`) |

A breakpoint always stops. An exception the filters do not stop on resumes when it is resumable, else its process ends and its description is written on the `Transcript`. Until a debug session sets them, the image stops on unhandled errors and halts. The filters apply to the exceptions of the image; an evaluation the client starts (playground, Print it, Debug Test) stops on every exception.

A process stopped on a breakpoint is in the code the debug point adds to its method: the frame shows the statement of the debug point, and stepping first steps over that code.
