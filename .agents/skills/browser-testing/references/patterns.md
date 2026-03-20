# Browser Test Patterns

Detailed examples for writing browser-based DOM tests.

## Pattern 1: Testing a Screen Module

Screen modules (`setup.js`, `events.js`) expect their HTML in the DOM. Fetch the screen HTML, inject into sandbox, then init.

```js
import { describe, it, strictEqual, ok } from "../harness.js";

describe("Setup screen", () => {
    const sandbox = document.getElementById("test-sandbox");

    it("populates rules dropdown from config", async () => {
        const html = await fetch("/screens/setup.html").then(r => r.text());
        sandbox.innerHTML = html;

        const { initSetup } = await import("/js/setup.js");
        initSetup();

        const options = sandbox.querySelectorAll("#rules option");
        ok(options.length > 0, "should have rule options");
    });
});
```

## Pattern 2: Testing Modal / Dialog Behavior

```js
describe("Confirm dialog", () => {
    it("shows overlay on open", async () => {
        const { ConfirmDialog } = await import("/js/confirm.js");
        const result = ConfirmDialog.show({
            title: "Test",
            message: "Are you sure?",
            type: "danger"
        });

        const overlay = document.querySelector(".confirm-overlay");
        ok(overlay, "overlay should exist");
        ok(!overlay.classList.contains("hidden"), "should be visible");

        // Clean up
        overlay.querySelector(".btn-cancel").click();
    });
});
```

## Pattern 3: Testing Rendered Output

```js
describe("Game sheet rendering", () => {
    it("renders period score table", async () => {
        const { Game } = await import("/js/game.js");
        const { renderSheet } = await import("/js/sheet-screen.js");

        const g = Game.create("USAWP");
        Game.addEvent(g, {
            period: 1, time: "7:00", team: "W", cap: "7", event: "G"
        });

        const sandbox = document.getElementById("test-sandbox");
        sandbox.innerHTML = await fetch("/screens/sheet.html")
            .then(r => r.text());
        renderSheet(g, sandbox);

        const scoreCell = sandbox.querySelector(".period-score");
        ok(scoreCell, "should render period scores");
    });
});
```

## Pattern 4: Simulating User Interactions

```js
it("clicking team button selects it", () => {
    const sandbox = document.getElementById("test-sandbox");
    const whiteBtn = sandbox.querySelector("#team-white");
    const darkBtn = sandbox.querySelector("#team-dark");

    whiteBtn.click();
    ok(whiteBtn.classList.contains("selected"), "white selected");
    ok(!darkBtn.classList.contains("selected"), "dark not selected");
});
```

## Pattern 5: Testing Navigation / Tabs

```js
it("switching tabs shows correct screen", async () => {
    const { showScreen } = await import("/js/app.js");
    showScreen("live");

    const liveScreen = document.getElementById("screen-live");
    ok(!liveScreen.classList.contains("hidden"), "live should be visible");

    const setupScreen = document.getElementById("screen-setup");
    ok(setupScreen.classList.contains("hidden"), "setup should be hidden");
});
```

## Pattern 6: Testing with Game State

Build game state using pure Game API. Do not import test data JSON.

```js
it("shows correct score in live bar after goals", async () => {
    const { Game } = await import("/js/game.js");
    const g = Game.create("USAWP");
    Game.addEvent(g, {
        period: 1, time: "7:00", team: "W", cap: "7", event: "G"
    });
    Game.addEvent(g, {
        period: 1, time: "6:00", team: "D", cap: "3", event: "G"
    });

    // Render live screen with this game state
    const { renderLive } = await import("/js/events.js");
    const sandbox = document.getElementById("test-sandbox");
    sandbox.innerHTML = await fetch("/screens/live.html")
        .then(r => r.text());
    renderLive(g, sandbox);

    const scoreBar = sandbox.querySelector(".score-bar");
    ok(scoreBar.textContent.includes("1"), "should show score");
});
```
