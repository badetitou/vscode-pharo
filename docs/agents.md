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
- The extension contributes the **Pharo skills** and the **Pharo** custom agent, offered while the image runs the MCP server (see below).
- The extension has no chat participant and no Language Model Tool of its own: VS Code no longer supports chat participants in the Copilot harness, and every tool the agents need comes from the MCP server of the image. An image without the MCP server gives no tool to the agents.
- **Pharo: Configure a CLI Agent…** connects Claude Code, Codex or OpenCode to the image. In a folder without their configuration, it runs `npx @evref-bl/pharo-mcp install --host <host>`, which installs the guides, skills and MCP configuration of the agent; it then points the `pharo` server of that configuration at the port of the image.
- The port changes at each start of the image: at each start, the extension moves the `pharo` server of `.mcp.json`, `.codex/config.toml` and `opencode.json` in the workspace folders to the new port, when it names a server of this machine.
- The changes an agent makes go through the image: they reach the views and the editors through `pls-env/didChange` (see [the environment model](environment-model.md)).
- To control the effects of a tool, VS Code relies on the annotations of the MCP tools (`readOnlyHint`, `destructiveHint`) and asks for confirmation. The history of what an agent did is the Epicea history of the image (`history_entry_list`, `history_entry_revert`).

## Skills and agent

VS Code recommends skills and an MCP server rather than a chat participant. The extension contributes them (`chatSkills` and `chatAgents` in `package.json`), only while the image of the window runs the MCP server (`pharo.mcp.available`):

| Skill | Use |
| --- | --- |
| `pharo-live-image` (`skills/pharo-live-image/SKILL.md`) | How the live image works, which tool of the MCP server to use for each task, the conventions of Pharo code. |
| `pharo-verify` (`skills/pharo-verify/SKILL.md`) | The verification loop before a change is done: compile, critiques, tests, coverage, then the changes from the Epicea history. |
| `pharo-iceberg` (`skills/pharo-iceberg/SKILL.md`) | Review, commit and discard changes with Iceberg; commit only when asked, never push unasked. |

Copilot loads a skill when the request matches its description; the user can also call it as a slash command (`/pharo-verify`). The **Pharo** custom agent (`agents/pharo.agent.md`) works on the image with these skills. It does not list its tools, because the name of the MCP server changes with the image (**Pharo (*image name*)**): it uses the tools enabled in the tools picker.

The skills are for agents in VS Code. CLI agents get their own guides and skills from `npx @evref-bl/pharo-mcp install` (see **Pharo: Configure a CLI Agent…**).
