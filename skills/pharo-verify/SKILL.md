---
name: pharo-verify
description: Use before saying that a change of Pharo code is done, and whenever asked to check, test or review Pharo code in the image. Runs the verification loop of Pharo - compile, critiques, tests, coverage - and reports what changed in the image.
argument-hint: Classes or packages to verify (default - what you changed)
---

# Verify a Pharo change

Run these steps on the classes and methods you changed, in order, and fix what fails before going on. Use the tools of the Pharo MCP server; when one is not in your list, find it with `tool_search` and run it with `tool_call`.

1. **It compiles.** `method_compile` answers the compilation errors and the undeclared variables of a method. A method that does not compile is not in the image: fix it and compile again.
2. **Critiques.** Run `critique_run` with `scope.classes` set to the changed classes. Fix the hits that concern your change; a hit marked fixable can be fixed with `method_rewrite`. Leave the hits on code you did not write, and say so.
3. **Tests.** Find the tests of the changed classes (`FooTest` for `Foo`, or `method_reference_search` on the changed selectors restricted to test packages) and run them with `test_run`. When there is no test for new behaviour, write one in the test package of the project, then run it.
   - A failure or an error is answered with its message and stack: read the failing code with `method_get` before changing anything.
   - Run the whole test package of the project once the targeted tests pass.
4. **Coverage**, when the change adds behaviour: `test_coverage_run` with `coverage.scope.classes` set to the changed classes. Say which new methods no test runs.
5. **Report.** List what changed in the image with `history_entry_list` (`codeChangesOnly: true`, `newestFirst: true`): classes and methods added, changed or removed. If a change turns out wrong, undo it with `history_entry_revert` rather than rewriting the old version by hand.

Do not save the image and do not commit: the user decides, see the `pharo-iceberg` skill.

## What to tell the user

- Which tests ran and their result; quote failures, do not summarise them as passing.
- The critiques left and why.
- The methods that are not covered, if any.
- The list of changes from the history.
