# Project Guidelines (vscode-pharo)

## Code Style

- Language: TypeScript.
- Prefer existing patterns in `src/` (especially `src/extension.ts`) over introducing new abstractions.
- Avoid editing generated output in `dist/`; change sources in `src/` and rebuild.

## Architecture

- This repository is a **VS Code client extension** for Pharo.
- The **Language Server (LSP)** and **Debug Adapter (DAP)** are hosted by a **Pharo image** (server-side) and are started/controlled by this extension.
  - LSP: the extension spawns a Pharo VM + image and runs the bootstrap script `res/run-server.st`, then connects over a TCP socket.
  - DAP: the extension asks the Pharo side to start a debug server (via LSP request) and then connects to the returned port.
- Key entry points:
  - `src/extension.ts`: activation + LSP wiring.
  - `src/debugFactory.ts` and `src/activateDebug.ts`: DAP wiring and debug commands.
  - `src/requirements.ts`: validates `pharo.pathToVM` and `pharo.pathToImage`.
  - `src/ai/pharoLmTools.ts`: “LM tools” that proxy operations to the running Pharo server.

## Build and Test

- Install: `npm ci` (or `npm install`).
- Build: `npm run compile`.
- Watch: `npm run watch` (VS Code task: `npm: 1`).
- Tests: `npm test` (runs `npm run compile` then executes `dist/test/runTest.js`).

## Conventions and Pitfalls

- The extension requires two user settings to work:
  - `pharo.pathToVM`: absolute path to the Pharo executable.
  - `pharo.pathToImage`: absolute path to the `.image` file hosting the server.
- First launch can require internet: `res/run-server.st` may download/install the Pharo Language Server into the image.
- VM/image compatibility matters (architecture + headless vs non-headless).

## Pharo Tools Available to LLMs

- This project is designed to be operable via **LLM-accessible Pharo tools** that execute Smalltalk code and perform image-level actions (e.g., evaluate code, create packages/classes, run tests).
- When available in the chat environment, prefer these tools for server-side tasks (inspecting classes, running Pharo tests, evaluating snippets) instead of trying to approximate behavior purely from Tonel files.
- Treat these tool calls as having side effects (they can modify the image); keep operations minimal and reversible.

## Documentation

- See `README.md` for end-user installation and feature overview.
- See `CHANGELOG.md` for version history and release notes.
