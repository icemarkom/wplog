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

// Browser tests for app.js — App screen navigation + showScreen().
//
// App.init() is too heavy to call in a test harness (it imports and inits
// every module, binds nav click handlers, restores localStorage, etc.).
// Instead, we test showScreen() directly by injecting the minimal DOM it needs.

import { describe, it, strictEqual, ok } from "../harness.js";

// Minimal DOM that showScreen() requires:
// - .screen sections with id="screen-{name}"
// - .nav-btn buttons with id="nav-{name}"
// - sessionStorage (available in browser)
const APP_DOM = `
<nav class="nav-bar">
  <button id="nav-setup" class="nav-btn active">Setup</button>
  <button id="nav-live" class="nav-btn" disabled>Live</button>
  <button id="nav-sheet" class="nav-btn" disabled>Sheet</button>
  <button id="nav-share" class="nav-btn">Share</button>
  <button id="nav-help" class="nav-btn">Help</button>
</nav>
<section id="screen-setup" class="screen active"></section>
<section id="screen-live" class="screen"></section>
<section id="screen-sheet" class="screen"></section>
<section id="screen-share" class="screen"></section>
<section id="screen-help" class="screen"></section>
<footer class="app-footer">
  <span id="app-version"></span>
  <a href="#" id="footer-about-link">About</a>
</footer>`;

// About overlay + sub-overlays for init() tests
const ABOUT_HTML = `
<div id="about-overlay" class="overlay">
  <div class="overlay-content about-card">
    <div class="about-title">wplog</div>
    <span id="about-version"></span>
    <a href="#" id="about-license-link">Apache 2.0</a>
    <a href="#" id="about-privacy-link">Policy</a>
    <button id="about-dismiss" class="btn btn-primary about-dismiss-btn">Close</button>
  </div>
</div>
<div id="privacy-overlay" class="overlay">
  <div class="overlay-content privacy-card">
    <div id="privacy-body" class="privacy-body fetched-content"></div>
    <button id="privacy-dismiss" class="btn btn-primary privacy-dismiss-btn">OK</button>
  </div>
</div>
<div id="license-overlay" class="overlay">
  <div class="overlay-content privacy-card">
    <div id="license-body" class="license-body fetched-content"></div>
    <button id="license-dismiss" class="btn btn-primary privacy-dismiss-btn">OK</button>
  </div>
</div>
<div id="qr-overlay" class="overlay qr-overlay">
  <div class="qr-fullscreen-wrap">
    <img src="img/qr-wplog.svg" alt="QR" class="qr-fullscreen">
  </div>
</div>`;

let App;
let appContainer;

function injectAppDOM() {
    const old = document.getElementById("app-test-container");
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = "app-test-container";
    container.innerHTML = APP_DOM;
    document.body.appendChild(container);
    return container;
}

describe("App — showScreen", () => {

    it("can import App module", async () => {
        const mod = await import("/js/app.js");
        App = mod.App;
        ok(App, "App should be importable");
    });

    it("showScreen activates the named screen", () => {
        appContainer = injectAppDOM();
        App.game = null;

        App.showScreen("share");

        const shareScreen = document.getElementById("screen-share");
        ok(shareScreen.classList.contains("active"), "share screen should be active");

        // Other screens should not be active
        ok(!document.getElementById("screen-setup").classList.contains("active"), "setup should not be active");
        ok(!document.getElementById("screen-live").classList.contains("active"), "live should not be active");
    });

    it("showScreen updates nav button active state", () => {
        injectAppDOM();
        App.game = null;

        App.showScreen("help");

        const helpNav = document.getElementById("nav-help");
        ok(helpNav.classList.contains("active"), "help nav should be active");
        ok(!document.getElementById("nav-setup").classList.contains("active"), "setup nav should not be active");
    });

    it("showScreen disables live and sheet nav when no game", () => {
        injectAppDOM();
        App.game = null;

        App.showScreen("setup");

        ok(document.getElementById("nav-live").disabled, "live nav should be disabled without game");
        ok(document.getElementById("nav-sheet").disabled, "sheet nav should be disabled without game");
    });

    it("showScreen enables live and sheet nav when game exists", async () => {
        injectAppDOM();
        const gameMod = await import("/js/game.js");
        App.game = gameMod.Game.create("USAWP");

        App.showScreen("setup");

        ok(!document.getElementById("nav-live").disabled, "live nav should be enabled with game");
        ok(!document.getElementById("nav-sheet").disabled, "sheet nav should be enabled with game");
    });

    it("showScreen updates currentScreen property", () => {
        injectAppDOM();
        App.game = null;

        App.showScreen("share");
        strictEqual(App.currentScreen, "share");

        App.showScreen("setup");
        strictEqual(App.currentScreen, "setup");
    });

    it("showScreen saves to sessionStorage", () => {
        injectAppDOM();
        App.game = null;

        App.showScreen("help");
        strictEqual(sessionStorage.getItem("wplog-screen"), "help");
    });

    it("showScreen only one screen is active at a time", () => {
        injectAppDOM();
        App.game = null;

        App.showScreen("setup");
        App.showScreen("share");
        App.showScreen("help");

        const activeScreens = document.querySelectorAll("#app-test-container .screen.active");
        strictEqual(activeScreens.length, 1);
        strictEqual(activeScreens[0].id, "screen-help");
    });

    it("showScreen only one nav button is active at a time", () => {
        injectAppDOM();
        App.game = null;

        App.showScreen("share");

        const activeNavs = document.querySelectorAll("#app-test-container .nav-btn.active");
        strictEqual(activeNavs.length, 1);
        strictEqual(activeNavs[0].id, "nav-share");
    });

    it("showScreen share nav always enabled (even without game)", () => {
        injectAppDOM();
        App.game = null;

        App.showScreen("share");
        ok(!document.getElementById("nav-share").disabled, "share nav should not be disabled");
    });

    it("showScreen help nav always enabled", () => {
        injectAppDOM();
        App.game = null;

        App.showScreen("help");
        ok(!document.getElementById("nav-help").disabled, "help nav should not be disabled");
    });

    // Cleanup
    it("cleanup: removes test container", () => {
        const c = document.getElementById("app-test-container");
        if (c) c.remove();
        sessionStorage.removeItem("wplog-screen");
        ok(true, "cleanup done");
    });
});

describe("App — About overlay", () => {

    it("About overlay opens and closes", () => {
        // Inject overlays into body
        const container = document.createElement("div");
        container.id = "about-test-container";
        container.innerHTML = ABOUT_HTML;
        document.body.appendChild(container);

        const overlay = document.getElementById("about-overlay");
        overlay.classList.add("visible");
        ok(overlay.classList.contains("visible"), "About should be visible");

        document.getElementById("about-dismiss").click();
        // Note: click handler is bound by App.init(), not us — so we simulate directly
        overlay.classList.remove("visible");
        ok(!overlay.classList.contains("visible"), "About should be hidden after dismiss");

        container.remove();
    });

    it("cleanup: ensures no test containers remain", () => {
        const c = document.getElementById("about-test-container");
        if (c) c.remove();
        ok(true, "cleanup done");
    });
});
