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

// Browser tests for confirm.js — ConfirmDialog overlay.

import { describe, it, strictEqual, ok } from "../harness.js";

// ConfirmDialog requires its overlay DOM to exist at document level (not sandbox),
// because it uses document.getElementById. We inject the overlay markup once,
// import and init, then test against the live overlay.

const CONFIRM_HTML = `
<div id="confirm-overlay" class="overlay">
  <div class="overlay-content confirm-card">
    <div id="confirm-title" class="overlay-title confirm-title"></div>
    <div id="confirm-message" class="overlay-message confirm-message"></div>
    <div class="confirm-actions">
      <button id="confirm-cancel" class="btn btn-outline confirm-action-btn">Cancel</button>
      <button id="confirm-ok" class="btn confirm-action-btn">OK</button>
    </div>
  </div>
</div>`;

// Inject overlay into sandbox (display:none, but DOM accessible)
const sandbox = document.getElementById("test-sandbox");

// We need to dynamically import ConfirmDialog once and reuse.
// Because init() binds event listeners, we do it once.
let ConfirmDialog;

describe("ConfirmDialog", () => {

    it("can import and init", async () => {
        sandbox.innerHTML = CONFIRM_HTML;
        // Move overlay to document body so getElementById finds it
        const overlay = sandbox.querySelector("#confirm-overlay");
        document.body.appendChild(overlay);

        const mod = await import("/js/confirm.js");
        ConfirmDialog = mod.ConfirmDialog;
        ConfirmDialog.init();
        ok(ConfirmDialog, "ConfirmDialog should be importable");
    });

    it("show() makes overlay visible", async () => {
        const promise = ConfirmDialog.show({
            title: "Test Title",
            message: "Test message",
            type: "danger",
        });

        const overlay = document.getElementById("confirm-overlay");
        ok(overlay.classList.contains("visible"), "overlay should have 'visible' class");

        // Clean up — cancel to resolve promise
        document.getElementById("confirm-cancel").click();
        await promise;
    });

    it("show() sets title and message", async () => {
        const promise = ConfirmDialog.show({
            title: "Delete Event",
            message: "Are you sure?",
            type: "danger",
        });

        strictEqual(document.getElementById("confirm-title").textContent, "Delete Event");
        strictEqual(document.getElementById("confirm-message").textContent, "Are you sure?");

        document.getElementById("confirm-cancel").click();
        await promise;
    });

    it("show() sets custom confirm label", async () => {
        const promise = ConfirmDialog.show({
            title: "End Game",
            message: "End it?",
            confirmLabel: "End Game",
            type: "danger",
        });

        strictEqual(document.getElementById("confirm-ok").textContent, "End Game");

        document.getElementById("confirm-cancel").click();
        await promise;
    });

    it("show() sets custom cancel label", async () => {
        const promise = ConfirmDialog.show({
            title: "Test",
            message: "Test",
            cancelLabel: "Nope",
            type: "danger",
        });

        strictEqual(document.getElementById("confirm-cancel").textContent, "Nope");

        document.getElementById("confirm-cancel").click();
        await promise;
    });

    it("danger type applies correct class to OK button", async () => {
        const promise = ConfirmDialog.show({
            title: "Danger Test",
            message: "This is dangerous",
            type: "danger",
        });

        const okBtn = document.getElementById("confirm-ok");
        ok(okBtn.classList.contains("confirm-btn-danger"), "should have confirm-btn-danger class");

        document.getElementById("confirm-cancel").click();
        await promise;
    });

    it("warning type applies correct class to OK button", async () => {
        const promise = ConfirmDialog.show({
            title: "Warning Test",
            message: "This is a warning",
            type: "warning",
        });

        const okBtn = document.getElementById("confirm-ok");
        ok(okBtn.classList.contains("confirm-btn-warning"), "should have confirm-btn-warning class");

        document.getElementById("confirm-cancel").click();
        await promise;
    });

    it("confirm button resolves with true", async () => {
        const promise = ConfirmDialog.show({
            title: "Confirm",
            message: "OK?",
            type: "danger",
        });

        document.getElementById("confirm-ok").click();
        const result = await promise;
        strictEqual(result, true);
    });

    it("cancel button resolves with false", async () => {
        const promise = ConfirmDialog.show({
            title: "Cancel",
            message: "Cancel?",
            type: "danger",
        });

        document.getElementById("confirm-cancel").click();
        const result = await promise;
        strictEqual(result, false);
    });

    it("backdrop click resolves with false", async () => {
        const promise = ConfirmDialog.show({
            title: "Backdrop",
            message: "Click outside",
            type: "danger",
        });

        // Click the overlay itself (not the card)
        const overlay = document.getElementById("confirm-overlay");
        overlay.click();
        const result = await promise;
        strictEqual(result, false);
    });

    it("close removes visible class", async () => {
        const promise = ConfirmDialog.show({
            title: "Close Test",
            message: "Should close",
            type: "danger",
        });

        document.getElementById("confirm-cancel").click();
        await promise;

        const overlay = document.getElementById("confirm-overlay");
        ok(!overlay.classList.contains("visible"), "overlay should not have 'visible' class after close");
    });

    it("defaults confirmLabel to OK", async () => {
        const promise = ConfirmDialog.show({
            title: "Default",
            message: "Test defaults",
            type: "danger",
        });

        strictEqual(document.getElementById("confirm-ok").textContent, "OK");

        document.getElementById("confirm-cancel").click();
        await promise;
    });

    it("defaults cancelLabel to Cancel", async () => {
        const promise = ConfirmDialog.show({
            title: "Default",
            message: "Test defaults",
            type: "danger",
        });

        strictEqual(document.getElementById("confirm-cancel").textContent, "Cancel");

        document.getElementById("confirm-cancel").click();
        await promise;
    });

    // Cleanup: remove the overlay from document body
    it("cleanup: removes overlay from body", () => {
        const overlay = document.getElementById("confirm-overlay");
        if (overlay && overlay.parentNode === document.body) {
            document.body.removeChild(overlay);
        }
        ok(true, "cleanup done");
    });
});
