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

// Browser tests for share.js — Share/Export screen.

import { describe, it, strictEqual, ok } from "../harness.js";

// Share.init() uses document.getElementById for buttons and overlays.
// Overlays live at document level; share screen buttons live in the screen HTML.
// We inject overlays into body once, and fetch share.html into body per test.

const OVERLAY_HTML = `
<div id="download-overlay" class="overlay">
  <div class="overlay-content download-card">
    <div id="download-title" class="overlay-title download-title">Download</div>
    <label for="download-filename" class="sr-only">Filename</label>
    <input type="text" id="download-filename" class="download-filename" spellcheck="false" autocomplete="off">
    <div class="download-actions">
      <button id="download-confirm" class="btn btn-primary btn-large">Download</button>
      <button id="download-cancel" class="btn-link">Cancel</button>
    </div>
  </div>
</div>`;

let Share;
let Game;
let shareHTML;

// Container for overlays — injected into body once, removed at cleanup.
let overlayContainer;

// Helper: inject share screen HTML into a temporary container in body,
// so document.getElementById can find buttons. Returns the container.
function injectShareScreen() {
    // Remove previous container if exists
    const old = document.getElementById("share-test-container");
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = "share-test-container";
    container.innerHTML = shareHTML;
    document.body.appendChild(container);
    return container;
}

describe("Share screen", () => {

    it("can import Share and load screen HTML", async () => {
        // Fetch share screen HTML
        shareHTML = await fetch("/screens/share.html").then((r) => r.text());
        ok(shareHTML.length > 0, "share.html should have content");

        // Inject overlays into body once
        overlayContainer = document.createElement("div");
        overlayContainer.id = "overlay-test-container";
        overlayContainer.innerHTML = OVERLAY_HTML;
        document.body.appendChild(overlayContainer);

        const mod = await import("/js/share.js");
        Share = mod.Share;
        ok(Share, "Share should be importable");

        const gameMod = await import("/js/game.js");
        Game = gameMod.Game;
    });

    it("buttons disabled when init with no game", () => {
        injectShareScreen();
        Share._bound = false;
        Share.init(null);

        ok(document.getElementById("print-sheet-btn").disabled, "Print button should be disabled");
        ok(document.getElementById("export-csv-btn").disabled, "CSV button should be disabled");
        ok(document.getElementById("export-json-btn").disabled, "JSON button should be disabled");
    });

    it("buttons enabled when init with game", () => {
        injectShareScreen();
        const game = Game.create("USAWP");
        Share._bound = false;
        Share.init(game);

        ok(!document.getElementById("print-sheet-btn").disabled, "Print button should be enabled");
        ok(!document.getElementById("export-csv-btn").disabled, "CSV button should be enabled");
        ok(!document.getElementById("export-json-btn").disabled, "JSON button should be enabled");
    });

    it("download CSV dialog opens with correct title", () => {
        injectShareScreen();
        const game = Game.create("USAWP");
        Share._bound = false;
        Share.init(game);

        document.getElementById("export-csv-btn").click();

        const overlay = document.getElementById("download-overlay");
        ok(overlay.classList.contains("visible"), "download overlay should be visible");
        strictEqual(document.getElementById("download-title").textContent, "Download CSV");

        document.getElementById("download-cancel").click();
    });

    it("download JSON dialog opens with correct title", () => {
        injectShareScreen();
        const game = Game.create("USAWP");
        Share._bound = false;
        Share.init(game);

        document.getElementById("export-json-btn").click();

        const overlay = document.getElementById("download-overlay");
        ok(overlay.classList.contains("visible"), "download overlay should be visible");
        strictEqual(document.getElementById("download-title").textContent, "Download Game Data");

        document.getElementById("download-cancel").click();
    });

    it("download dialog populates filename with .csv", () => {
        injectShareScreen();
        const game = Game.create("USAWP");
        game.date = "2026-03-20";
        Share._bound = false;
        Share.init(game);

        document.getElementById("export-csv-btn").click();

        const input = document.getElementById("download-filename");
        ok(input.value.length > 0, "filename should be populated");
        ok(input.value.endsWith(".csv"), "CSV filename should end with .csv");

        document.getElementById("download-cancel").click();
    });

    it("download dialog populates filename with .json", () => {
        injectShareScreen();
        const game = Game.create("USAWP");
        game.date = "2026-03-20";
        Share._bound = false;
        Share.init(game);

        document.getElementById("export-json-btn").click();

        const input = document.getElementById("download-filename");
        ok(input.value.endsWith(".json"), "JSON filename should end with .json");

        document.getElementById("download-cancel").click();
    });

    it("download dialog closes on Cancel", () => {
        injectShareScreen();
        const game = Game.create("USAWP");
        Share._bound = false;
        Share.init(game);

        document.getElementById("export-csv-btn").click();
        document.getElementById("download-cancel").click();

        const overlay = document.getElementById("download-overlay");
        ok(!overlay.classList.contains("visible"), "download overlay should not be visible");
    });

    it("download dialog closes on backdrop click", () => {
        injectShareScreen();
        const game = Game.create("USAWP");
        Share._bound = false;
        Share.init(game);

        document.getElementById("export-csv-btn").click();
        document.getElementById("download-overlay").click();

        const overlay = document.getElementById("download-overlay");
        ok(!overlay.classList.contains("visible"), "download overlay should not be visible");
    });

    // Cleanup: remove injected DOM from body
    it("cleanup: removes test containers from body", () => {
        const shareContainer = document.getElementById("share-test-container");
        if (shareContainer) shareContainer.remove();
        if (overlayContainer) overlayContainer.remove();
        ok(true, "cleanup done");
    });
});
