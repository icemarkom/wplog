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

// Smoke test — verifies the browser test harness works correctly.

import { describe, it, strictEqual, deepStrictEqual, ok } from "../harness.js";

// ── Harness Self-Test ────────────────────────────────────────

describe("Harness", () => {
    it("strictEqual passes for equal values", () => {
        strictEqual(1, 1);
        strictEqual("hello", "hello");
        strictEqual(true, true);
    });

    it("deepStrictEqual passes for equal objects", () => {
        deepStrictEqual({ a: 1 }, { a: 1 });
        deepStrictEqual([1, 2, 3], [1, 2, 3]);
    });

    it("ok passes for truthy values", () => {
        ok(true);
        ok(1);
        ok("non-empty");
        ok([]);
    });

    it("supports async tests", async () => {
        const value = await Promise.resolve(42);
        strictEqual(value, 42);
    });

    it("todo tests are skipped", { todo: "harness demo" }, () => {
        throw new Error("this should not run");
    });
});

// ── DOM Access ───────────────────────────────────────────────

describe("DOM", () => {
    it("sandbox element exists", () => {
        const sandbox = document.getElementById("test-sandbox");
        ok(sandbox, "test-sandbox should exist");
    });

    it("can create and query elements in sandbox", () => {
        const sandbox = document.getElementById("test-sandbox");
        sandbox.innerHTML = '<button id="test-btn" class="active">Click</button>';
        const btn = sandbox.querySelector("#test-btn");
        ok(btn, "button should exist");
        strictEqual(btn.textContent, "Click");
        ok(btn.classList.contains("active"), "should have active class");
    });

    it("sandbox is cleared between tests", () => {
        const sandbox = document.getElementById("test-sandbox");
        strictEqual(sandbox.innerHTML, "", "sandbox should be empty after previous test");
    });
});

// ── Module Imports ───────────────────────────────────────────

describe("Module imports", () => {
    it("can import config.js", async () => {
        const { RULES } = await import("/js/config.js");
        ok(RULES, "RULES should exist");
        ok(RULES.USAWP, "should have USAWP");
    });

    it("can import game.js and create a game", async () => {
        const { Game } = await import("/js/game.js");
        const g = Game.create("USAWP");
        strictEqual(g.rules, "USAWP");
        strictEqual(g.currentPeriod, 1);
    });

    it("can import sanitize.js", async () => {
        const { escapeHTML } = await import("/js/sanitize.js");
        strictEqual(escapeHTML("<b>"), "&lt;b&gt;");
    });
});

// ── Screen HTML Loading ──────────────────────────────────────

describe("Screen HTML", () => {
    it("can fetch setup.html into sandbox", async () => {
        const sandbox = document.getElementById("test-sandbox");
        const html = await fetch("/screens/setup.html").then(r => r.text());
        sandbox.innerHTML = html;
        ok(sandbox.querySelector("#setup-rules"), "setup screen should have #setup-rules element");
    });

    it("can fetch live.html into sandbox", async () => {
        const sandbox = document.getElementById("test-sandbox");
        const html = await fetch("/screens/live.html").then(r => r.text());
        sandbox.innerHTML = html;
        ok(sandbox.children.length > 0, "live screen should have content");
    });

    it("can fetch modal.html into sandbox", async () => {
        const sandbox = document.getElementById("test-sandbox");
        const html = await fetch("/screens/modal.html").then(r => r.text());
        sandbox.innerHTML = html;
        ok(sandbox.children.length > 0, "modal should have content");
    });
});
