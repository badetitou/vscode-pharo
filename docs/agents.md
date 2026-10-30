# Agents and the MCP server of the image

Agents (Copilot in VS Code, Claude Code, Codex, OpenCode...) work on **the same image** as the editor, through [evref-BL/MCP](https://github.com/evref-BL/MCP), an MCP server that runs inside the image. It gives them the tools on classes, methods and packages (search, read, compile, rewrite, refactorings), tests and coverage, Renraku critiques, Iceberg repositories, the Epicea history with revert, debugging and the inspection of the interface.

The language server does not duplicate these tools: what is meant for agents goes through the MCP server. The language server keeps LSP, DAP and the requests of the views of VS Code.

The server side lives in the package `PharoLanguageServer-MCP` of [Pharo-LanguageServer](https://github.com/badetitou/Pharo-LanguageServer) (`PLSMCPEndpoint`, and the protocol `pls - mcp` of `PLSServer`). The extension side lives in `src/ai/pharoMcp.ts`.

## Starting

The language server starts the MCP server when it answers `initialize`. It listens on `127.0.0.1`, on a free port chosen by the system, so that several images can run at the same time, each with its own server. It stops with the language server.

A saved image restarts by itself the MCP servers it held: `PLSServer reset`, which `res/run-server.st` calls before starting the language server, stops them first.

The client disables the MCP server with `initializationOptions`; the extension sends them only when `pharo.mcp.enabled` is `false`, so that servers predating them still start:

```json
{ "initializationOptions": { "mcp": { "enabled": false } } }
```

## Endpoint

The server announces the endpoint in the `initialize` result, next to the environment model:

```json
{ "capabilities": { "experimental": { "mcp": { "url": "http://127.0.0.1:61408/", "protocolVersions": ["2025-03-26", "2025-06-18", "2025-11-25", "2026-07-28"] } } } }
```

| Field | Meaning |
| --- | --- |
| `url` | Address of the server, for the Streamable HTTP transport. |
| `protocolVersions` | Versions of the MCP protocol the server supports. |

The request `pls:mcpEndpoint` answers the same object, or `null` when the MCP server does not run.

## In the extension

- The extension declares the server of the image of the window to VS Code (`vscode.lm.registerMcpServerDefinitionProvider`, as **Pharo (*image name*)**), so Copilot in agent mode sees its tools without configuration. Two windows on two images each declare the server of their image.
- The `@pharo` chat participant uses these tools; its slash commands call them (`/readClass` calls `class_get`, `/eval` `image_evaluate`, `/runClassTests` `test_run`...).
- **Pharo: Configure a CLI Agent…** connects Claude Code, Codex or OpenCode to the image. In a folder without their configuration, it runs `npx @evref-bl/pharo-mcp install --host <host>`, which installs the guides, skills and MCP configuration of the agent; it then points the `pharo` server of that configuration at the port of the image.
- The port changes at each start of the image: at each start, the extension moves the `pharo` server of `.mcp.json`, `.codex/config.toml` and `opencode.json` in the workspace folders to the new port, when it names a server of this machine.
- The changes an agent makes go through the image: they reach the views and the editors through `pls-env/didChange` (see [the environment model](environment-model.md)).
- To control the effects of a tool, VS Code relies on the annotations of the MCP tools (`readOnlyHint`, `destructiveHint`) and asks for confirmation. The history of what an agent did is the Epicea history of the image (`history_entry_list`, `history_entry_revert`).

## Deprecated Language Model Tools

The Language Model Tools of the extension that the MCP server replaces (`pharo-create-class`, `pharo-read-class`, `pharo-list-classes`, `pharo-eval`, `pharo-run-class-tests`, `pharo-run-test-method`) are only offered when the image does not run the MCP server, and will be removed. `pharo-create-package`, `pharo-list-packages` and the Iceberg tools, which also report the unsaved editors of VS Code, stay.
