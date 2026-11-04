---
name: pharo-iceberg
description: Use when asked to review, commit, discard or push Pharo changes, or to see what changed in the git repositories of the image. Iceberg is the git client of Pharo - it writes the packages of the image to Tonel files and commits them.
argument-hint: Repository name and what to do (review, commit, discard)
---

# Review and commit Pharo changes with Iceberg

Iceberg compares the packages of the image with the commit of each repository: a change exists in the image before it exists in files. Use the repository tools of the Pharo MCP server (find them with `tool_search` and run them with `tool_call` when they are not in your list).

## Review

1. `repository_search` lists the repositories of the image and which ones are modified.
2. `repository_change_list` lists the changes of a repository, class by class and method by method, with their diff.
3. Editors of VS Code that are not saved are not in the image yet, so Iceberg does not see them: when the user edited Pharo code by hand, ask them to save or discard their editors before a commit.

## Commit

Only when the user asks for it.

1. Verify first (see the `pharo-verify` skill): the tests of the changed packages pass.
2. Make sure the changes belong to the repository being committed; list any you leave out.
3. `repository_commit` with the repository `name` and a message: a first line in the imperative, under 72 characters, saying what the change does; then, if useful, a blank line and why.
4. Do not push unless the user asks; pushing is a separate, explicit step.

## Discard

`repository_change_discard` reverts packages of the image to the commit. It loses work: ask the user to confirm, naming the packages, before calling it. To undo only recent edits, prefer `history_entry_revert`.
