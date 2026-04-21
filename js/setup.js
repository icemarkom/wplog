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
import { initDialog } from './dialog.js';
import { parseRosterCSV, mergeRoster } from './roster.js';

// wplog — Setup Screen Logic

export const Setup = {
    _homeTeam: DEFAULTS.homeTeam,  // current home team code
    _teams: null,    // [home, away] team descriptors
    _bound: false,      // guard against duplicate event binding
    _pendingRosters: null,  // pre-game roster uploads: { white: [...], dark: [...] }
    _game: null,        // live game reference (set by updateForActiveGame)
    _config: null,      // canonical setup state (model for the setup form)

    init(onStart) {
        this.onStart = onStart;
        if (!this._bound) {
            this._bindEvents();
            this._bindSteppers();
            this._bindLoggingMode();
            initDialog("alert-dialog", { dismissId: "alert-dismiss" });
            this._bound = true;
        }
        this._pendingRosters = { white: [], dark: [] };
        this._initConfig();
        this._resetForm();
        this._setDefaultDate();
        this._populateRules();
        this._restorePrefs();
    },

    _initConfig() {
        // Build _config from the defaults of the first visible rule set.
        // _restorePrefs() will overwrite this immediately if saved data exists.
        const firstKey = Object.keys(RULES).find((k) => !k.startsWith("_"));
        const rules = RULES[firstKey];
        this._config = {
            rules:           firstKey,
            periods:         rules.periods          || DEFAULTS.periods,
            periodLength:    rules.periodLength      || DEFAULTS.periodLength,
            otPeriodLength:  rules.otPeriodLength    || 3,
            overtime:        rules.overtime          ?? DEFAULTS.overtime,
            shootout:        rules.shootout          ?? DEFAULTS.shootout,
            timeoutsAllowed: {
                full: rules.timeouts?.full ?? DEFAULTS.timeouts.full,
                to30: rules.timeouts?.to30 ?? DEFAULTS.timeouts.to30,
            },
            enableLog:       true,
            enableStats:     false,
            statsTimeMode:   "off",
            homeTeam:        rules.homeTeam          || DEFAULTS.homeTeam,
        };
        this._homeTeam = this._config.homeTeam;
    },

    _resetForm() {
        // Re-enable everything (in case previously disabled by an active game)
        document.getElementById("setup-start-btn").disabled = false;
        document.getElementById("setup-start-btn").textContent = "Start Game";
        document.getElementById("setup-rules").disabled = false;
        document.getElementById("setup-home-flip").disabled = false;

        // Re-enable logging mode control
        const modeControl = document.getElementById("setup-logging-mode");
        modeControl.classList.remove("disabled");
        modeControl.querySelectorAll(".segment-btn").forEach((btn) => { btn.disabled = false; });

        // Re-enable post-regulation control
        const prControl = document.getElementById("setup-post-regulation");
        prControl.classList.remove("disabled");
        prControl.querySelectorAll(".segment-btn").forEach((btn) => { btn.disabled = false; });

        // Re-enable all steppers
        document.querySelectorAll("#setup-advanced-section .stepper").forEach((s) => {
            this._setStepperDisabled(s, false);
        });

        // Reset theme setting (not part of _config — per-device preference)
        const currentTheme = localStorage.getItem("wplog_theme");
        const themeInline = document.getElementById("setup-theme-inline");
        themeInline.querySelectorAll(".inline-toggle-link").forEach((link) => {
            link.classList.toggle("active", link.dataset.theme === currentTheme);
        });
    },

    updateForActiveGame(game) {
        if (!game) return;
        this._game = game;

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
        document.getElementById("setup-load-btn").classList.add("hidden");

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

    _syncStepperToConfig(stepperId) {
        const val = this._getStepperValue(stepperId);
        switch (stepperId) {
            case "setup-num-periods":   this._config.periods = val; break;
            case "setup-period-length": this._config.periodLength = val; break;
            case "setup-ot-length":     this._config.otPeriodLength = val; break;
            case "setup-to-full":       this._config.timeoutsAllowed.full = val; break;
            case "setup-to-30":         this._config.timeoutsAllowed.to30 = val; break;
        }
    },

    _bindSteppers() {
        document.querySelectorAll(".stepper").forEach((stepper) => {
            stepper.addEventListener("click", (e) => {
                const btn = e.target.closest(".stepper-btn");
                if (!btn || btn.disabled) return;

                // Shortcut button (Off / ∞)
                if (btn.classList.contains("stepper-set")) {
                    this._setStepperValue(stepper.id, parseInt(btn.dataset.set));
                    this._syncStepperToConfig(stepper.id);
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
                this._syncStepperToConfig(stepper.id);
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
        group.classList.toggle("disabled", !otOn);
        // Re-apply boundary states
        if (otOn) this._setStepperValue("setup-ot-length", this._getStepperValue("setup-ot-length"));
    },

    _updateGameSetupHeader() {
        const pNum = this._getStepperValue("setup-num-periods");
        const qLen = this._getStepperValue("setup-period-length");
        const pr = this._getPostRegulation();
        const parts = [pNum + "×" + qLen + " min"];

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
        // Called when the rules dropdown changes. Resets all _config fields to
        // the new rule's defaults, then re-renders the form.
        const rulesKey = this._config.rules;
        const rules = RULES[rulesKey];

        this._config.homeTeam        = rules.homeTeam         || DEFAULTS.homeTeam;
        this._config.overtime        = rules.overtime         ?? DEFAULTS.overtime;
        this._config.shootout        = rules.shootout         ?? DEFAULTS.shootout;
        this._config.periods         = rules.periods          || DEFAULTS.periods;
        this._config.periodLength    = rules.periodLength     || DEFAULTS.periodLength;
        this._config.otPeriodLength  = rules.otPeriodLength   || 3;
        this._config.timeoutsAllowed = {
            full: rules.timeouts?.full ?? DEFAULTS.timeouts.full,
            to30: rules.timeouts?.to30 ?? DEFAULTS.timeouts.to30,
        };

        this._applyConfigToDOM();
    },

    _applyConfigToDOM() {
        const cfg = this._config;

        // Rules dropdown
        document.getElementById("setup-rules").value = cfg.rules;

        // Home team
        this._homeTeam = cfg.homeTeam;
        this._updateTeamLabels();

        // Steppers
        this._setStepperValue("setup-num-periods",  cfg.periods);
        this._setStepperValue("setup-period-length", cfg.periodLength);
        this._setStepperValue("setup-ot-length",     cfg.otPeriodLength);
        this._setStepperValue("setup-to-full",       cfg.timeoutsAllowed.full);
        this._setStepperValue("setup-to-30",         cfg.timeoutsAllowed.to30);

        // Post-regulation segment
        const prValue = cfg.overtime ? "overtime" : cfg.shootout ? "shootout" : "none";
        document.querySelectorAll("#setup-post-regulation .segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === prValue);
        });

        // Logging mode segment
        const modeValue = cfg.enableLog && cfg.enableStats ? "full"
            : cfg.enableStats ? "stats"
            : "log";
        document.querySelectorAll("#setup-logging-mode .segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === modeValue);
        });

        // Stats time mode segment
        document.querySelectorAll("#setup-stats-time-mode .segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === cfg.statsTimeMode);
        });

        // Cascade dependent state
        this._updateOTLengthState();
        this._updateGameSetupHeader();
        this._updateLoggingHeader();
        this._updateStatsTimeState();
    },

    _savePrefs() {
        Storage.savePrefs(this._config);
    },

    _restorePrefs() {
        const saved = Storage.loadPrefs();
        if (!saved) return;
        // Guard: drop saved rule key if it no longer exists in config
        const validKeys = Object.keys(RULES).filter((k) => !k.startsWith("_"));
        if (saved.rules && !validKeys.includes(saved.rules)) delete saved.rules;
        Object.assign(this._config, saved);
        // Nested object must be merged explicitly
        if (saved.timeoutsAllowed && typeof saved.timeoutsAllowed === "object") {
            this._config.timeoutsAllowed = {
                full: saved.timeoutsAllowed.full ?? this._config.timeoutsAllowed.full,
                to30: saved.timeoutsAllowed.to30 ?? this._config.timeoutsAllowed.to30,
            };
        }
        this._applyConfigToDOM();
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
            this._config.rules = document.getElementById("setup-rules").value;
            this._updateToggles();
        });

        // Home/Away flip button
        document.getElementById("setup-home-flip").addEventListener("click", () => {
            // Capture current input values before flip
            const val0 = document.getElementById("setup-team-0-name").value;
            const val1 = document.getElementById("setup-team-1-name").value;

            // Flip home team in both _config and display state
            this._config.homeTeam = this._config.homeTeam === "W" ? "D" : "W";
            this._homeTeam = this._config.homeTeam;
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
            this._config.overtime = btn.dataset.value === "overtime";
            this._config.shootout = btn.dataset.value === "shootout";
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

        // Roster upload buttons
        for (let i = 0; i < 2; i++) {
            document.getElementById(`setup-roster-upload-${i}`).addEventListener("click", () => {
                document.getElementById(`setup-roster-file-${i}`).click();
            });
            document.getElementById(`setup-roster-file-${i}`).addEventListener("change", (e) => {
                if (e.target.files.length > 0) {
                    this._importRoster(i, e.target.files[0]);
                }
                e.target.value = "";
            });
        }
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

            const mode = btn.dataset.mode;
            this._config.enableLog   = mode === "log"  || mode === "full";
            this._config.enableStats = mode === "full" || mode === "stats";

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

            this._config.statsTimeMode = btn.dataset.value;
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
        const cfg = this._config;
        const game = Game.create(cfg.rules);

        // Game-specific fields — read from DOM (not part of _config)
        game.date      = document.getElementById("setup-date").value;
        game.startTime = document.getElementById("setup-time").value;
        game.location  = document.getElementById("setup-location").value;
        game.gameId    = document.getElementById("setup-game-id").value.trim();

        // Setup config fields — read from _config
        game.overtime        = cfg.overtime;
        game.shootout        = cfg.shootout;
        game.periods         = cfg.periods;
        game.periodLength    = cfg.periodLength;
        game.otPeriodLength  = cfg.overtime ? cfg.otPeriodLength : null;
        game.timeoutsAllowed = { full: cfg.timeoutsAllowed.full, to30: cfg.timeoutsAllowed.to30 };
        game.homeTeam        = cfg.homeTeam;
        game.enableLog       = cfg.enableLog;
        game.enableStats     = cfg.enableStats;
        game.statsTimeMode   = cfg.statsTimeMode;

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

        // Merge any pending roster uploads
        for (const teamKey of ["white", "dark"]) {
            if (this._pendingRosters[teamKey].length > 0) {
                mergeRoster(game, teamKey, this._pendingRosters[teamKey]);
            }
        }
        this._pendingRosters = { white: [], dark: [] };

        Storage.save(game);
        this._savePrefs();
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

    // ── Roster CSV Import ──

    async _importRoster(posIndex, file) {
        let text;
        try {
            text = await file.text();
        } catch (e) {
            this._showAlert("Import Failed", "Could not read file.");
            return;
        }

        // Determine which team this position maps to
        const t = this._teams[posIndex];
        const teamKey = t.code === "W" ? "white" : "dark";
        const teamLabel = t.code === "W" ? "White" : "Dark";

        const game = this._game;
        const rulesKey = game ? game.rules : document.getElementById("setup-rules").value;

        const result = parseRosterCSV(text, rulesKey);

        // Show errors if parsing completely failed
        if (result.players.length === 0 && result.errors.length > 0) {
            this._showAlert("Import Failed", result.errors.join("\n"));
            return;
        }

        if (game) {
            // Active game: merge into live reference and save
            mergeRoster(game, teamKey, result.players);
            Storage.save(game);
        } else {
            // Pre-game: buffer for merge at game start
            this._pendingRosters[teamKey] = this._pendingRosters[teamKey].concat(result.players);
        }

        // Build feedback message
        const lines = [];
        lines.push(`Imported ${result.players.length} player${result.players.length !== 1 ? "s" : ""} for ${teamLabel}.`);
        if (result.duplicates.length > 0) {
            lines.push(`${result.duplicates.length} duplicate cap${result.duplicates.length !== 1 ? "s" : ""} skipped (${result.duplicates.join(", ")}).`);
        }
        if (result.errors.length > 0) {
            lines.push(result.errors.join("\n"));
        }
        if (!game) {
            lines.push("Roster will be applied when the game starts.");
        }

        this._showAlert("Roster Imported", lines.join("\n"));
    },

    _showAlert(title, message) {
        const dialog = document.getElementById("alert-dialog");
        document.getElementById("alert-title").textContent = title;
        document.getElementById("alert-message").textContent = message;
        dialog.showModal();
    },
};
