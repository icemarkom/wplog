// Copyright 2026 Marko Milivojevic
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Browser tests for setup.js — Setup screen.

import { describe, it, strictEqual, ok } from "../harness.js";

// Setup requires its screen HTML + several overlays (confirm, foulout) in the DOM.
// We inject overlays once into body, and inject setup screen per test.

const OVERLAYS_HTML = `
<div id="confirm-overlay" class="overlay">
  <div class="overlay-content confirm-card">
    <div id="confirm-title" class="overlay-title confirm-title"></div>
    <div id="confirm-message" class="overlay-message confirm-message"></div>
    <div class="confirm-actions">
      <button id="confirm-cancel" class="btn btn-outline confirm-action-btn">Cancel</button>
      <button id="confirm-ok" class="btn confirm-action-btn">OK</button>
    </div>
  </div>
</div>
<div id="foulout-overlay" class="overlay">
  <div class="overlay-content foulout-card">
    <div id="foulout-title" class="overlay-title foulout-title"></div>
    <div id="foulout-message" class="overlay-message"></div>
    <button id="foulout-dismiss" class="btn btn-primary">Dismiss</button>
  </div>
</div>`;

let Setup, Game, RULES;
let setupHTML;
let overlayContainer;

function injectSetupScreen() {
    const old = document.getElementById("setup-test-container");
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = "setup-test-container";
    container.innerHTML = setupHTML;
    document.body.appendChild(container);
    return container;
}

describe("Setup screen", () => {

    it("can import Setup and load screen HTML", async () => {
        setupHTML = await fetch("/screens/setup.html").then((r) => r.text());
        ok(setupHTML.length > 0, "setup.html should have content");

        // Inject overlays once
        overlayContainer = document.createElement("div");
        overlayContainer.id = "setup-overlay-container";
        overlayContainer.innerHTML = OVERLAYS_HTML;
        document.body.appendChild(overlayContainer);

        const mod = await import("/js/setup.js");
        Setup = mod.Setup;
        ok(Setup, "Setup should be importable");

        const gameMod = await import("/js/game.js");
        Game = gameMod.Game;

        const configMod = await import("/js/config.js");
        RULES = configMod.RULES;
    });

    // ── Rules Dropdown ──────────────────────────────────────

    it("populates rules dropdown with non-internal rules", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const options = document.querySelectorAll("#setup-rules option");
        ok(options.length > 0, "should have rule options");

        // Should not contain internal rules (_base, _academic)
        const values = Array.from(options).map((o) => o.value);
        ok(!values.includes("_base"), "should not have _base");
        ok(!values.includes("_academic"), "should not have _academic");

        // Should have the public rule sets
        ok(values.includes("USAWP"), "should have USAWP");
        ok(values.includes("NFHSVA"), "should have NFHSVA");
    });

    it("rules dropdown text matches config names", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const firstOption = document.querySelector("#setup-rules option");
        const key = firstOption.value;
        strictEqual(firstOption.textContent, RULES[key].name);
    });

    // ── Default Date ────────────────────────────────────────

    it("sets default date to today", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const dateVal = document.getElementById("setup-date").value;
        const today = new Date().toISOString().slice(0, 10);
        strictEqual(dateVal, today);
    });

    // ── Post-Regulation Segmented Control ────────────────────

    it("sets post-regulation from rules config", () => {
        injectSetupScreen();
        Setup.init(() => {});

        // USAWP has no overtime/shootout by default
        const active = document.querySelector("#setup-post-regulation .segment-btn.active");
        ok(active, "should have an active post-regulation button");
    });

    it("clicking post-regulation button switches active state", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const buttons = document.querySelectorAll("#setup-post-regulation .segment-btn");
        const noneBtn = Array.from(buttons).find((b) => b.dataset.value === "none");
        const otBtn = Array.from(buttons).find((b) => b.dataset.value === "overtime");

        otBtn.click();
        ok(otBtn.classList.contains("active"), "OT should be active");
        ok(!noneBtn.classList.contains("active"), "None should not be active");

        noneBtn.click();
        ok(noneBtn.classList.contains("active"), "None should be active again");
        ok(!otBtn.classList.contains("active"), "OT should not be active");
    });

    // ── Steppers ────────────────────────────────────────────

    it("period length stepper shows value from rules", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const display = document.querySelector("#setup-period-length .stepper-value");
        ok(display, "stepper value display should exist");
        const val = parseInt(document.getElementById("setup-period-length").dataset.value);
        ok(val >= 3 && val <= 9, "period length should be 3-9");
    });

    it("stepper inc/dec changes value", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const stepper = document.getElementById("setup-period-length");
        const initial = parseInt(stepper.dataset.value);

        // Decrement
        const decBtn = stepper.querySelector(".stepper-dec");
        if (!decBtn.disabled) {
            decBtn.click();
            const after = parseInt(stepper.dataset.value);
            strictEqual(after, initial - 1);

            // Increment back
            stepper.querySelector(".stepper-inc").click();
            strictEqual(parseInt(stepper.dataset.value), initial);
        } else {
            // At min — try increment instead
            stepper.querySelector(".stepper-inc").click();
            strictEqual(parseInt(stepper.dataset.value), initial + 1);
        }
    });

    it("stepper dec is disabled at minimum", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const stepper = document.getElementById("setup-period-length");
        const min = parseInt(stepper.dataset.min);

        // Set to minimum
        Setup._setStepperValue("setup-period-length", min);
        const decBtn = stepper.querySelector(".stepper-dec");
        ok(decBtn.disabled, "dec should be disabled at minimum");
    });

    // ── Logging Mode ────────────────────────────────────────

    it("default logging mode is Game Log Only", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const active = document.querySelector("#setup-logging-mode .segment-btn.active");
        strictEqual(active.dataset.mode, "log");
    });

    it("switching logging mode updates header summary", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const buttons = document.querySelectorAll("#setup-logging-mode .segment-btn");
        const fullBtn = Array.from(buttons).find((b) => b.dataset.mode === "full");
        fullBtn.click();

        const summary = document.getElementById("setup-logging-summary").textContent;
        strictEqual(summary, fullBtn.textContent);
    });

    it("stats time mode is disabled when logging is Game Log Only", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const timeControl = document.getElementById("setup-stats-time-mode");
        ok(timeControl.classList.contains("disabled"), "stats time should be disabled for log-only mode");
    });

    it("stats time mode is enabled when logging includes stats", () => {
        injectSetupScreen();
        Setup.init(() => {});

        // Switch to Full mode
        const fullBtn = Array.from(
            document.querySelectorAll("#setup-logging-mode .segment-btn")
        ).find((b) => b.dataset.mode === "full");
        fullBtn.click();

        const timeControl = document.getElementById("setup-stats-time-mode");
        ok(!timeControl.classList.contains("disabled"), "stats time should be enabled for full mode");
    });

    // ── Game Setup Header ───────────────────────────────────

    it("game setup header shows period length", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const summary = document.getElementById("setup-game-summary").textContent;
        ok(summary.includes("min"), "should show minutes in summary");
    });

    // ── Active Game Guards ──────────────────────────────────

    it("updateForActiveGame disables rules dropdown", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const game = Game.create("USAWP");
        Setup.updateForActiveGame(game);

        ok(document.getElementById("setup-rules").disabled, "rules should be disabled during active game");
    });

    it("updateForActiveGame shows END GAME button", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const game = Game.create("USAWP");
        Setup.updateForActiveGame(game);

        const btn = document.getElementById("setup-start-btn");
        strictEqual(btn.textContent, "END GAME IN PROGRESS");
        ok(btn.classList.contains("btn-danger"), "should have btn-danger class");
    });

    it("updateForActiveGame hides Load Game button", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const game = Game.create("USAWP");
        Setup.updateForActiveGame(game);

        strictEqual(document.getElementById("setup-load-btn").style.display, "none");
    });

    it("updateForActiveGame disables all steppers", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const game = Game.create("USAWP");
        Setup.updateForActiveGame(game);

        const steppers = document.querySelectorAll("#setup-advanced-section .stepper");
        steppers.forEach((s) => {
            ok(s.classList.contains("disabled"), "stepper " + s.id + " should be disabled");
        });
    });

    it("updateForActiveGame disables post-regulation control", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const game = Game.create("USAWP");
        Setup.updateForActiveGame(game);

        const prControl = document.getElementById("setup-post-regulation");
        ok(prControl.classList.contains("disabled"), "post-regulation should be disabled");
    });

    it("updateForActiveGame disables logging mode control", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const game = Game.create("USAWP");
        Setup.updateForActiveGame(game);

        const modeControl = document.getElementById("setup-logging-mode");
        ok(modeControl.classList.contains("disabled"), "logging mode should be disabled");
    });

    it("updateForActiveGame populates form fields from game", () => {
        injectSetupScreen();
        Setup.init(() => {});

        const game = Game.create("USAWP");
        game.date = "2026-01-15";
        game.location = "Pool Arena";
        game.gameId = "42";
        game.white.name = "Sharks";
        game.dark.name = "Waves";
        Setup.updateForActiveGame(game);

        strictEqual(document.getElementById("setup-date").value, "2026-01-15");
        strictEqual(document.getElementById("setup-location").value, "Pool Arena");
        strictEqual(document.getElementById("setup-game-id").value, "42");
        strictEqual(document.getElementById("setup-white-name").value, "Sharks");
        strictEqual(document.getElementById("setup-dark-name").value, "Waves");
    });

    // Cleanup
    it("cleanup: removes test containers from body", () => {
        const sc = document.getElementById("setup-test-container");
        if (sc) sc.remove();
        if (overlayContainer) overlayContainer.remove();
        ok(true, "cleanup done");
    });
});
