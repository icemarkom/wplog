/**
 * Copyright 2026 Marko Milivojevic
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { RULES, DEFAULTS } from './config.js';
import { ConfirmDialog } from './confirm.js';
import { Storage, validateGameData } from './storage.js';
import { Game } from './game.js';

// wplog — Setup Screen Logic

export const Setup = {
    _homeTeam: DEFAULTS.homeTeam,  // current home team code
    _teams: null,    // [home, away] team descriptors
    _bound: false,      // guard against duplicate event binding

    init(onStart) {
        this.onStart = onStart;
        if (!this._bound) {
            this._bindEvents();
            this._bindSteppers();
            this._bindLoggingMode();
            this._bound = true;
        }
        this._resetForm();
        this._setDefaultDate();
        this._populateRules();
    },

    _resetForm() {
        // Re-enable everything (in case previously disabled)
        document.getElementById("setup-start-btn").disabled = false;
        document.getElementById("setup-start-btn").textContent = "Start Game";
        document.getElementById("setup-rules").disabled = false;
        document.getElementById("setup-home-flip").disabled = false;

        // Reset logging mode segmented control
        const modeControl = document.getElementById("setup-logging-mode");
        modeControl.classList.remove("disabled");
        modeControl.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.disabled = false;
            btn.classList.toggle("active", btn.dataset.mode === "log");
        });

        // Reset stats time segmented control
        const timeControl = document.getElementById("setup-stats-time-mode");
        timeControl.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === "off");
        });

        // Reset theme setting
        const currentTheme = localStorage.getItem("wplog_theme") || "dark";
        const themeInline = document.getElementById("setup-theme-inline");
        themeInline.querySelectorAll(".inline-toggle-link").forEach((link) => {
            link.classList.toggle("active", link.dataset.theme === currentTheme);
        });

        // Reset post-regulation segmented control
        const prControl = document.getElementById("setup-post-regulation");
        prControl.classList.remove("disabled");
        prControl.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.disabled = false;
        });

        // Re-enable all steppers
        document.querySelectorAll("#setup-advanced-section .stepper").forEach((s) => {
            this._setStepperDisabled(s, false);
        });

        this._updateLoggingHeader();
        this._updateStatsTimeState();
    },

    updateForActiveGame(game) {
        if (!game) return;

        // Set home team from game data
        this._homeTeam = game.homeTeam || DEFAULTS.homeTeam;

        // Populate form from game data
        document.getElementById("setup-rules").value = game.rules;
        document.getElementById("setup-date").value = game.date || "";
        const timeEl = document.getElementById("setup-time");
        timeEl.value = game.startTime || "";
        timeEl.classList.toggle("has-value", !!timeEl.value);
        document.getElementById("setup-location").value = game.location || "";
        document.getElementById("setup-game-id").value = game.gameId || "";

        // Populate team inputs in home/away order
        this._updateTeamLabels();
        const teams = Game.getTeams(game);
        for (let i = 0; i < 2; i++) {
            const t = teams[i];
            const val = t.code === "W" ? game.white.name : game.dark.name;
            document.getElementById(`setup-team-${i}-name`).value = val === t.defaultName ? "" : val;
        }

        // Hide Load Game button during active game
        document.getElementById("setup-load-btn").style.display = "none";

        // Disable flip button during active game
        document.getElementById("setup-home-flip").disabled = true;

        // Replace Start Game with End Game button
        const startBtn = document.getElementById("setup-start-btn");
        startBtn.disabled = false;
        startBtn.textContent = "END GAME IN PROGRESS";
        startBtn.classList.add("btn-danger");

        // Override click to destroy game
        startBtn.replaceWith(startBtn.cloneNode(true)); // remove old listeners
        const newBtn = document.getElementById("setup-start-btn");
        newBtn.disabled = false;
        newBtn.textContent = "END GAME IN PROGRESS";
        newBtn.classList.add("btn-danger");
        newBtn.addEventListener("click", async () => {
            const ok = await ConfirmDialog.show({
                title: "END GAME IN PROGRESS?",
                message: "All game data will be permanently lost. This cannot be undone.",
                confirmLabel: "End Game",
                type: "danger",
            });
            if (ok) {
                Storage.clear();
                location.reload();
            }
        });

        // Disable rules change during game
        document.getElementById("setup-rules").disabled = true;

        // Live-save editable fields back to the active game
        const saveField = (id, setter) => {
            document.getElementById(id).addEventListener("change", () => {
                setter();
                Storage.save(game);
            });
        };

        saveField("setup-date", () => { game.date = document.getElementById("setup-date").value; });
        saveField("setup-time", () => { game.startTime = document.getElementById("setup-time").value; });
        saveField("setup-location", () => { game.location = document.getElementById("setup-location").value; });
        saveField("setup-game-id", () => { game.gameId = document.getElementById("setup-game-id").value.trim(); });

        // Live-save team names — map position-based inputs back to game.white/game.dark
        for (let i = 0; i < 2; i++) {
            const t = teams[i];
            saveField(`setup-team-${i}-name`, () => {
                const v = document.getElementById(`setup-team-${i}-name`).value.trim();
                if (t.code === "W") {
                    game.white.name = v || "White";
                } else {
                    game.dark.name = v || "Dark";
                }
            });
        }

        // Logging mode — set active buttons and disable during active game
        const mode = game.enableLog && game.enableStats ? "full"
            : game.enableStats ? "stats"
            : "log";
        const modeControl = document.getElementById("setup-logging-mode");
        modeControl.classList.add("disabled");
        modeControl.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === mode);
            btn.disabled = true;
        });

        // Stats time mode
        const timeControl = document.getElementById("setup-stats-time-mode");
        const stm = game.statsTimeMode || "off";
        timeControl.classList.add("disabled");
        timeControl.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === stm);
            btn.disabled = true;
        });

        this._updateLoggingHeader();

        // Post-regulation — set active and always disable during active game
        const prValue = game.overtime ? "overtime" : game.shootout ? "shootout" : "none";
        const prControl = document.getElementById("setup-post-regulation");
        prControl.classList.add("disabled");
        prControl.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === prValue);
            btn.disabled = true;
        });

        // Steppers — set values and disable
        this._setStepperValue("setup-num-periods", game.periods || 4);
        this._setStepperValue("setup-period-length", game.periodLength);
        this._setStepperValue("setup-ot-length", game.otPeriodLength || 3);
        this._setStepperValue("setup-to-full", game.timeoutsAllowed.full);
        this._setStepperValue("setup-to-30", game.timeoutsAllowed.to30);
        document.querySelectorAll("#setup-advanced-section .stepper").forEach((s) => {
            this._setStepperDisabled(s, true);
        });
        this._updateOTLengthState();
        this._updateGameSetupHeader();

        // Auto-open foldable sections during active game
        document.getElementById("setup-logging-section").open = true;
        // Game Details: open if any metadata fields are filled
        if (game.date || game.startTime || game.location || game.gameId) {
            document.getElementById("setup-details-section").open = true;
        }
        // Advanced: always open during active game (settings are visible/locked)
        document.getElementById("setup-advanced-section").open = true;
    },
    _populateRules() {
        const select = document.getElementById("setup-rules");
        select.innerHTML = "";
        for (const [key, rules] of Object.entries(RULES)) {
            if (key.startsWith("_")) continue;
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = rules.name;
            select.appendChild(opt);
        }
        this._updateToggles();
    },

    // ── Stepper helpers ──

    _getStepperValue(id) {
        return parseInt(document.getElementById(id).dataset.value);
    },

    _setStepperValue(id, val) {
        const el = document.getElementById(id);
        const min = parseInt(el.dataset.min);
        const max = parseInt(el.dataset.max);
        const hasUnlimited = el.dataset.unlimited === "true";

        // Clamp value: allow -1 (unlimited) if supported
        if (val === -1 && hasUnlimited) {
            // keep as -1
        } else {
            val = Math.max(min, Math.min(max, val));
        }
        el.dataset.value = val;

        const display = el.querySelector(".stepper-value");
        if (val === -1) {
            display.textContent = "\u221e";
        } else {
            display.textContent = val + (el.dataset.suffix || "");
        }

        // Update +/- disabled states
        const isDisabled = el.classList.contains("disabled");
        el.querySelector(".stepper-dec").disabled = (val !== -1 && val <= min) || isDisabled;
        el.querySelector(".stepper-inc").disabled = (val === -1) || (!hasUnlimited && val >= max) || isDisabled;

        // Update shortcut button highlighting
        el.querySelectorAll(".stepper-set").forEach((btn) => {
            btn.classList.toggle("active", parseInt(btn.dataset.set) === val);
        });
    },

    _setStepperDisabled(el, disabled) {
        el.classList.toggle("disabled", disabled);
        el.querySelectorAll(".stepper-btn").forEach((b) => { b.disabled = disabled; });
    },

    _bindSteppers() {
        document.querySelectorAll(".stepper").forEach((stepper) => {
            stepper.addEventListener("click", (e) => {
                const btn = e.target.closest(".stepper-btn");
                if (!btn || btn.disabled) return;

                // Shortcut button (Off / ∞)
                if (btn.classList.contains("stepper-set")) {
                    this._setStepperValue(stepper.id, parseInt(btn.dataset.set));
                    this._updateGameSetupHeader();
                    return;
                }

                const cur = parseInt(stepper.dataset.value);
                const max = parseInt(stepper.dataset.max);
                const hasUnlimited = stepper.dataset.unlimited === "true";

                if (btn.classList.contains("stepper-inc")) {
                    // At max → jump to unlimited if supported
                    const next = (cur >= max && hasUnlimited) ? -1 : cur + 1;
                    this._setStepperValue(stepper.id, next);
                } else {
                    // At unlimited → jump back to max; otherwise clamp to min
                    const min = parseInt(stepper.dataset.min);
                    const next = (cur === -1) ? max : Math.max(min, cur - 1);
                    this._setStepperValue(stepper.id, next);
                }
                this._updateGameSetupHeader();
            });
        });
    },

    // ── OT Length + Game Setup header ──

    _getPostRegulation() {
        const active = document.querySelector("#setup-post-regulation .segment-btn.active");
        return active ? active.dataset.value : "none";
    },

    _updateOTLengthState() {
        const pr = this._getPostRegulation();
        const otOn = pr === "overtime";
        const group = document.getElementById("setup-ot-length-group");
        const stepper = document.getElementById("setup-ot-length");
        this._setStepperDisabled(stepper, !otOn);
        group.style.opacity = otOn ? "" : "0.35";
        // Re-apply boundary states
        if (otOn) this._setStepperValue("setup-ot-length", this._getStepperValue("setup-ot-length"));
    },

    _updateGameSetupHeader() {
        const pNum = this._getStepperValue("setup-num-periods");
        const qLen = this._getStepperValue("setup-period-length");
        const pr = this._getPostRegulation();
        const parts = [pNum + " × " + qLen + " min"];

        if (pr === "overtime") {
            const otLen = this._getStepperValue("setup-ot-length");
            parts.push("OT " + otLen + " min");
        } else if (pr === "shootout") {
            parts.push("Shootout");
        }

        // Timeout summary: NxTO / MxTO30, skip zero sides
        const full = this._getStepperValue("setup-to-full");
        const to30 = this._getStepperValue("setup-to-30");
        const fmt = (v, label) => v === -1 ? "\u221e " + label : v + "\u00d7" + label;
        const toParts = [];
        if (full !== 0) toParts.push(fmt(full, "TO"));
        if (to30 !== 0) toParts.push(fmt(to30, "TO30"));
        if (toParts.length) parts.push(toParts.join(" / "));

        document.getElementById("setup-game-summary").textContent = parts.join(" \u00b7 ");
    },

    _setDefaultDate() {
        const dateInput = document.getElementById("setup-date");
        dateInput.value = new Date().toISOString().slice(0, 10);
    },

    _updateToggles() {
        const rulesKey = document.getElementById("setup-rules").value;
        const rules = RULES[rulesKey];

        // Reset home team to rule set default
        this._homeTeam = rules.homeTeam || DEFAULTS.homeTeam;
        this._updateTeamLabels();

        // Post-regulation segmented control
        const prValue = rules.overtime ? "overtime" : rules.shootout ? "shootout" : "none";
        document.querySelectorAll("#setup-post-regulation .segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === prValue);
        });

        // Steppers
        this._setStepperValue("setup-num-periods", rules.periods || 4);
        this._setStepperValue("setup-period-length", rules.periodLength);
        this._setStepperValue("setup-ot-length", rules.otPeriodLength || 3);
        this._setStepperValue("setup-to-full", rules.timeouts.full);
        this._setStepperValue("setup-to-30", rules.timeouts.to30);

        this._updateOTLengthState();
        this._updateGameSetupHeader();
    },

    // Update team labels and placeholders based on _homeTeam
    _updateTeamLabels() {
        const w = { code: "W", label: "White" };
        const d = { code: "D", label: "Dark" };
        this._teams = this._homeTeam === "W" ? [w, d] : [d, w];

        for (let i = 0; i < 2; i++) {
            const t = this._teams[i];
            const suffix = i === 0 ? "Home" : "Away";
            document.getElementById(`setup-team-${i}-label`).textContent = `${suffix} Team (${t.label})`;
            document.getElementById(`setup-team-${i}-name`).placeholder = t.label;
        }
    },

    _bindEvents() {
        document.getElementById("setup-rules").addEventListener("change", () => {
            this._updateToggles();
        });

        // Home/Away flip button
        document.getElementById("setup-home-flip").addEventListener("click", () => {
            // Capture current input values before flip
            const val0 = document.getElementById("setup-team-0-name").value;
            const val1 = document.getElementById("setup-team-1-name").value;

            // Flip home team
            this._homeTeam = this._homeTeam === "W" ? "D" : "W";
            this._updateTeamLabels();

            // Swap the input values so team names stay with their cap color
            document.getElementById("setup-team-0-name").value = val1;
            document.getElementById("setup-team-1-name").value = val0;
        });

        // Post-regulation segmented control
        const prControl = document.getElementById("setup-post-regulation");
        prControl.addEventListener("click", (e) => {
            const btn = e.target.closest(".segment-btn");
            if (!btn || btn.disabled) return;
            prControl.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            this._updateOTLengthState();
            this._updateGameSetupHeader();
        });

        document.getElementById("setup-start-btn").addEventListener("click", () => {
            this._startGame();
        });

        // Load Game button → trigger hidden file input
        document.getElementById("setup-load-btn").addEventListener("click", () => {
            document.getElementById("setup-load-file").click();
        });

        // File input change → validate and load
        document.getElementById("setup-load-file").addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                this._loadGame(e.target.files[0]);
            }
            // Reset so same file can be re-selected
            e.target.value = "";
        });

        // Toggle has-value class for time input styling
        document.getElementById("setup-time").addEventListener("change", (e) => {
            e.target.classList.toggle("has-value", !!e.target.value);
        });
    },

    _getSelectedMode() {
        const active = document.querySelector("#setup-logging-mode .segment-btn.active");
        return active ? active.dataset.mode : "log";
    },

    _bindLoggingMode() {
        // Mode segment control
        const modeControl = document.getElementById("setup-logging-mode");
        modeControl.addEventListener("click", (e) => {
            const btn = e.target.closest(".segment-btn");
            if (!btn || btn.disabled) return;

            modeControl.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            this._updateLoggingHeader();
            this._updateStatsTimeState();
        });

        // Stats time segment control
        const timeControl = document.getElementById("setup-stats-time-mode");
        timeControl.addEventListener("click", (e) => {
            const btn = e.target.closest(".segment-btn");
            if (!btn || btn.disabled) return;

            timeControl.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
        });

        // Theme inline control
        const themeInline = document.getElementById("setup-theme-inline");
        themeInline.addEventListener("click", (e) => {
            const link = e.target.closest(".inline-toggle-link");
            if (!link) return;

            themeInline.querySelectorAll(".inline-toggle-link").forEach((l) => l.classList.remove("active"));
            link.classList.add("active");

            const theme = link.dataset.theme;
            localStorage.setItem("wplog_theme", theme);
            if (theme === "system") {
                const isLight = window.matchMedia("(prefers-color-scheme: light)").matches;
                document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");
            } else {
                document.documentElement.setAttribute("data-theme", theme);
            }
        });
    },

    _updateLoggingHeader() {
        const active = document.querySelector("#setup-logging-mode .segment-btn.active");
        const label = active ? active.textContent : "Game Log Only";
        document.getElementById("setup-logging-summary").textContent = label;
    },

    _updateStatsTimeState() {
        const mode = this._getSelectedMode();
        const statsOn = mode === "full" || mode === "stats";
        const timeControl = document.getElementById("setup-stats-time-mode");
        timeControl.classList.toggle("disabled", !statsOn);
        timeControl.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.disabled = !statsOn;
        });
    },

    _getStatsTimeMode() {
        const active = document.querySelector("#setup-stats-time-mode .segment-btn.active");
        return active ? active.dataset.value : "off";
    },

    _startGame() {
        const rulesKey = document.getElementById("setup-rules").value;
        const game = Game.create(rulesKey);

        game.date = document.getElementById("setup-date").value;
        game.startTime = document.getElementById("setup-time").value;
        game.location = document.getElementById("setup-location").value;
        game.gameId = document.getElementById("setup-game-id").value.trim();
        const pr = this._getPostRegulation();
        game.overtime = pr === "overtime";
        game.shootout = pr === "shootout";
        game.periods = this._getStepperValue("setup-num-periods");
        game.periodLength = this._getStepperValue("setup-period-length");
        game.otPeriodLength = game.overtime
            ? this._getStepperValue("setup-ot-length")
            : null;
        game.timeoutsAllowed = {
            full: this._getStepperValue("setup-to-full"),
            to30: this._getStepperValue("setup-to-30"),
        };

        // Home team
        game.homeTeam = this._homeTeam;

        // Logging mode from segmented control
        const mode = this._getSelectedMode();
        game.enableLog = mode === "log" || mode === "full";
        game.enableStats = mode === "full" || mode === "stats";
        game.statsTimeMode = this._getStatsTimeMode();

        // Read team names from position-based inputs, map back to white/dark
        for (let i = 0; i < 2; i++) {
            const t = this._teams[i];
            const v = document.getElementById(`setup-team-${i}-name`).value.trim();
            if (t.code === "W") {
                if (v) game.white.name = v;
            } else {
                if (v) game.dark.name = v;
            }
        }

        Storage.save(game);
        this.onStart(game);
    },

    // ── Load Game from file ──

    async _loadGame(file) {
        // Layer 1: File size check
        if (file.size > Storage.MAX_FILE_SIZE) {
            this._showLoadError(
                `File too large (${Math.round(file.size / 1024)} KB). ` +
                `Maximum is ${Storage.MAX_FILE_SIZE / 1024} KB.`
            );
            return;
        }

        let text;
        try {
            text = await file.text();
        } catch (e) {
            this._showLoadError("Could not read file.");
            return;
        }

        // Layer 1: Cheap pre-check
        if (!text.trimStart().startsWith("{")) {
            this._showLoadError("File does not contain valid JSON.");
            return;
        }

        // Layer 2: JSON parse
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            this._showLoadError("Invalid JSON: " + e.message);
            return;
        }

        // Layer 3+4: Schema validation + property stripping
        const result = validateGameData(parsed);
        if (!result.valid) {
            this._showLoadError(result.error);
            return;
        }

        // Success: save clean data and reload
        Storage.save(result.data);
        location.reload();
    },

    _showLoadError(message) {
        const dialog = document.getElementById("alert-dialog");
        document.getElementById("alert-title").textContent = "Load Failed";
        document.getElementById("alert-message").textContent = message;
        dialog.showModal();
    },
};
