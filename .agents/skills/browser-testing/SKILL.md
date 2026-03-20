---
name: browser-testing
description: >-
  Browser-based DOM testing for wplog. Use when writing tests for DOM-dependent
  modules (setup.js, events.js, confirm.js, sheet.js, share.js, etc.) that
  cannot run under Node.js. Covers the test harness, test page structure,
  running tests, and writing patterns.
---

# Browser-Based Testing

Browser tests complement Node unit tests. Node tests cover pure logic (`game.js`, `config.js`, `storage.js`, `sanitize.js`). Browser tests cover DOM interactions — form filling, button clicks, modal flows, screen rendering, overlay dialogs.

**No npm, no build tools.** The harness is vanilla JS. Tests run in a real browser via `tools/serve.go`.

## File Structure

```
tests/
├── harness.js              # Browser test harness (describe/it/assert)
├── browser/
│   ├── index.html          # Test runner page — loads and runs all tests
│   ├── setup.test.js       # setup.js tests
│   ├── events.test.js      # events.js tests
│   ├── confirm.test.js     # confirm.js tests
│   ├── sheet.test.js       # sheet.js tests
│   └── share.test.js       # share.js tests
```

Naming: `tests/browser/<module>.test.js` mirrors `js/<module>.js`.

## Test Harness (`tests/harness.js`)

ES module exporting: `describe`, `it`, `strictEqual`, `deepStrictEqual`, `ok`, `runTests`.

- API matches `node:test` + `node:assert` so tests read identically.
- `it()` supports `async` callbacks and `{ todo: "reason" }` option.
- `runTests()` renders results into `<div id="test-results">` and logs to console.
- Keep under 100 lines — it's a tool, not a framework.

## Running Tests

```sh
go run tools/serve.go          # start dev server
open http://localhost:8080/tests/browser/   # view results
```

From the agent: use the browser subagent to navigate to the test page and capture a screenshot.

## Test Runner Page (`tests/browser/index.html`)

- Includes `<div id="test-results">` for rendered output.
- Includes hidden `<div id="test-sandbox">` for DOM test injection.
- Loads test modules via `<script type="module">` imports.
- Calls `runTests()` after all imports.

## Writing Tests

Each test:
1. Gets the sandbox: `document.getElementById("test-sandbox")`
2. Sets `sandbox.innerHTML` to the HTML it needs (fetch from `/screens/*.html`)
3. Imports the module under test
4. Runs assertions
5. Sandbox is cleared between tests (harness does this)

See [patterns.md](references/patterns.md) for detailed examples covering screen modules, dialogs, rendered output, and user interactions.

## Gotchas

- **Module side effects**: If a module queries `document` at import time, it will fail when imported into the test page. File a refactoring issue — init should be explicit, not on import.
- **Screen HTML**: Fetch from `/screens/<name>.html` and inject into sandbox. Do not copy HTML into tests.
- **Async everything**: Screen HTML fetching and dynamic imports are async. All test callbacks should be `async`.
- **No test data files**: Game state comes from `Game.create()` + `Game.addEvent()`, not `testdata/*.json`.
- **Never trigger `window.print()`**: Do not click Print buttons or call `window.print()` via browser automation. It opens a native OS dialog that the agent cannot dismiss, causing a timeout. Verify print rendering by inspecting the DOM after `Sheet.render(game, paperSize)` — the print layout is built as regular DOM elements before `window.print()` is called.

## Checklist for Adding a Test

1. Create `tests/browser/<module>.test.js`
2. Import from `../harness.js`
3. Write tests using sandbox pattern
4. Add the import to `tests/browser/index.html`
5. Open test page in browser to verify
