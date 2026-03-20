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

// Browser tests for events.js — Live Log screen.
//
// Events requires: live.html (score bar, period tabs, event buttons, log),
// modal.html (title, time/cap, team toggle, numpad, OK/Cancel),
// and several overlays (confirm, foulout) at document level.

import { describe, it, strictEqual, ok } from "../harness.js";

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

let Events, Game, RULES, ConfirmDialog, Storage;
let liveHTML, modalHTML;
let overlayContainer;

function injectDOM() {
    const old = document.getElementById("events-test-container");
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = "events-test-container";

    // Event modal (must contain modal-content container)
    container.innerHTML = `
        <div id="event-modal" class="event-modal">
          <div class="event-modal-content" id="modal-content">${modalHTML}</div>
        </div>
        ${liveHTML}`;
    document.body.appendChild(container);
    return container;
}

function makeGame() {
    const game = Game.create("USAWP");
    game.date = "2026-03-20";
    return game;
}

describe("Events — live log screen", () => {

    it("can import Events and load screen HTML", async () => {
        liveHTML = await fetch("/screens/live.html").then((r) => r.text());
        ok(liveHTML.length > 0, "live.html should have content");

        modalHTML = await fetch("/screens/modal.html").then((r) => r.text());
        ok(modalHTML.length > 0, "modal.html should have content");

        // Inject overlays once
        overlayContainer = document.createElement("div");
        overlayContainer.id = "events-overlay-container";
        overlayContainer.innerHTML = OVERLAYS_HTML;
        document.body.appendChild(overlayContainer);

        const confMod = await import("/js/confirm.js");
        ConfirmDialog = confMod.ConfirmDialog;
        ConfirmDialog.init();

        const mod = await import("/js/events.js");
        Events = mod.Events;
        ok(Events, "Events should be importable");

        const gameMod = await import("/js/game.js");
        Game = gameMod.Game;

        const configMod = await import("/js/config.js");
        RULES = configMod.RULES;

        const storageMod = await import("/js/storage.js");
        Storage = storageMod.Storage;
    });

    // ── Init + Event Buttons ────────────────────────────────

    it("init builds event buttons", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const buttons = document.querySelectorAll("#event-buttons button");
        ok(buttons.length > 0, "should have event buttons");
    });

    it("event buttons match log-only events + End Period", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const rules = RULES[game.rules];
        // Default game: enableLog=true, enableStats=false → only log events + End Period
        const logEvents = rules.events.filter((e) => !e.statsOnly);
        const expectedCount = logEvents.length + 1; // +1 for End Period button
        const buttons = document.querySelectorAll("#event-buttons button");
        strictEqual(buttons.length, expectedCount);
    });

    it("period tabs container is empty (tabs removed)", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const container = document.getElementById("period-tabs");
        strictEqual(container.children.length, 0, "period tabs should be empty");
    });

    it("init sets score bar to 0-0", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        strictEqual(document.getElementById("score-white").textContent, "0");
        strictEqual(document.getElementById("score-dark").textContent, "0");
    });

    it("score bar updates after adding goals", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        Game.addEvent(game, { period: 1, time: "7:30", team: "W", cap: "5", event: "G" });
        Game.addEvent(game, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        Events._updateScoreBar();

        strictEqual(document.getElementById("score-white").textContent, "1");
        strictEqual(document.getElementById("score-dark").textContent, "1");
    });

    it("current period badge shows Q1", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        strictEqual(document.getElementById("current-period").textContent, "Q1");
    });

    // ── Modal ───────────────────────────────────────────────

    it("clicking event button opens modal", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        // Click the first event button (Goal)
        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        const modal = document.getElementById("event-modal");
        ok(modal.classList.contains("visible"), "modal should be visible");

        // Close modal
        Events._closeModal();
    });

    it("modal shows event title", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        const title = document.getElementById("modal-event-title");
        ok(title.textContent.length > 0, "modal title should not be empty");

        Events._closeModal();
    });

    it("modal cancel closes the modal", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        document.getElementById("event-modal-cancel").click();

        const modal = document.getElementById("event-modal");
        ok(!modal.classList.contains("visible"), "modal should not be visible after cancel");
    });

    it("OK button starts disabled", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        ok(document.getElementById("event-modal-confirm").disabled, "OK should be disabled initially");

        Events._closeModal();
    });

    // ── Team Selection ──────────────────────────────────────

    it("team toggle selects white", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        document.getElementById("team-white-btn").click();
        strictEqual(Events.selectedTeam, "W");

        Events._closeModal();
    });

    it("team toggle selects dark", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        document.getElementById("team-dark-btn").click();
        strictEqual(Events.selectedTeam, "D");

        Events._closeModal();
    });

    // ── Numpad ──────────────────────────────────────────────

    it("numpad digit enters time", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        // Ensure we target time field
        Events._setNumpadTarget("time");

        Events._handleNumpad("5");
        strictEqual(Events._timeRaw, "5");

        Events._closeModal();
    });

    it("numpad clear removes last digit", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        Events._setNumpadTarget("time");
        Events._handleNumpad("5");
        Events._handleNumpad("3");
        Events._handleNumpad("clear");
        strictEqual(Events._timeRaw, "5");

        Events._closeModal();
    });

    it("numpad cap input accepts digits", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        Events._setNumpadTarget("cap");
        Events._handleNumpad("7");
        strictEqual(Events._capRaw, "7");
        strictEqual(document.getElementById("cap-display").textContent, "7");

        Events._closeModal();
    });

    it("time field max 3 digits", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        Events._setNumpadTarget("time");
        Events._handleNumpad("7");
        Events._handleNumpad("3");
        Events._handleNumpad("0");
        Events._handleNumpad("9"); // should be ignored
        strictEqual(Events._timeRaw, "730");

        Events._closeModal();
    });

    it("cap field max 2 digits", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        Events._setNumpadTarget("cap");
        Events._handleNumpad("1");
        Events._handleNumpad("3");
        Events._handleNumpad("5"); // should be ignored
        strictEqual(Events._capRaw, "13");

        Events._closeModal();
    });

    // ── OK button enables ───────────────────────────────────

    it("OK enables when time + cap + team are set", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        // Open Goal modal
        const firstBtn = document.querySelector("#event-buttons button");
        firstBtn.click();

        // Enter time
        Events._setNumpadTarget("time");
        Events._handleNumpad("7");
        Events._handleNumpad("3");
        Events._handleNumpad("0");

        // Enter cap
        Events._setNumpadTarget("cap");
        Events._handleNumpad("5");

        // Select team
        document.getElementById("team-white-btn").click();

        ok(!document.getElementById("event-modal-confirm").disabled, "OK should be enabled");

        Events._closeModal();
    });

    // ── teamOnly events ─────────────────────────────────────

    it("teamOnly event hides cap field", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        // Find a teamOnly button (e.g., TO)
        const buttons = document.querySelectorAll("#event-buttons button");
        let toBtn = null;
        for (const btn of buttons) {
            if (btn.textContent.trim() === "TO" || btn.dataset.code === "TO") {
                toBtn = btn;
                break;
            }
        }
        ok(toBtn, "should find TO button");

        toBtn.click();
        const capField = document.getElementById("field-cap");
        strictEqual(capField.style.display, "none", "cap field should be hidden for teamOnly");

        Events._closeModal();
    });

    // ── Recent log ──────────────────────────────────────────

    it("recent log shows events after they are added", () => {
        injectDOM();
        const game = makeGame();
        Events._boundModal = false;
        Events.init(game);

        Game.addEvent(game, { period: 1, time: "7:30", team: "W", cap: "5", event: "G" });
        Events._updateLog();

        const logEl = document.getElementById("recent-log");
        ok(logEl.children.length > 0, "recent log should have entries");
    });

    // ── Cleanup ─────────────────────────────────────────────

    it("cleanup: removes test containers from body", () => {
        const ec = document.getElementById("events-test-container");
        if (ec) ec.remove();
        if (overlayContainer) overlayContainer.remove();
        ok(true, "cleanup done");
    });
});
