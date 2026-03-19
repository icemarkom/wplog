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

// wplog — Setup Screen Logic

const Setup = {
    init(onStart) {
        this.onStart = onStart;
        this._bindEvents();
        this._bindSteppers();
        this._populateRules();
        this._setDefaultDate();
        this._resetForm();
        this._bindLoggingMode();
    },

    _resetForm() {
        // Re-enable everything (in case previously disabled)
        document.getElementById("setup-start-btn").disabled = false;
        document.getElementById("setup-start-btn").textContent = "Start Game";
        document.getElementById("setup-rules").disabled = false;

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

        // Populate form from game data
        document.getElementById("setup-rules").value = game.rules;
        document.getElementById("setup-date").value = game.date || "";
        const timeEl = document.getElementById("setup-time");
        timeEl.value = game.startTime || "";
        timeEl.classList.toggle("has-value", !!timeEl.value);
        document.getElementById("setup-location").value = game.location || "";
        document.getElementById("setup-game-id").value = game.gameId || "";
        document.getElementById("setup-white-name").value = game.white.name === "White" ? "" : game.white.name;
        document.getElementById("setup-dark-name").value = game.dark.name === "Dark" ? "" : game.dark.name;

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

        // Disable OT/SO if that phase has started
        const hasOT = game.log.some((e) => typeof e.period === "string" && e.period.startsWith("OT"));
        const hasSO = game.log.some((e) => e.period === "SO");

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
        saveField("setup-white-name", () => {
            const v = document.getElementById("setup-white-name").value.trim();
            game.white.name = v || "White";
        });
        saveField("setup-dark-name", () => {
            const v = document.getElementById("setup-dark-name").value.trim();
            game.dark.name = v || "Dark";
        });

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

        // Post-regulation — set active and disable
        const prValue = game.overtime ? "overtime" : game.shootout ? "shootout" : "none";
        const prControl = document.getElementById("setup-post-regulation");
        if (hasOT || hasSO) {
            prControl.classList.add("disabled");
        }
        prControl.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === prValue);
            if (hasOT || hasSO) btn.disabled = true;
        });

        // Steppers — set values and disable
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
        el.querySelector(".stepper-inc").disabled = (val === -1) || isDisabled;

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
                    // At unlimited → jump back to max
                    const next = (cur === -1) ? max : cur - 1;
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
        const qLen = this._getStepperValue("setup-period-length");
        const pr = this._getPostRegulation();
        const parts = [qLen + " min"];

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

        // Post-regulation segmented control
        const prValue = rules.overtime ? "overtime" : rules.shootout ? "shootout" : "none";
        document.querySelectorAll("#setup-post-regulation .segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === prValue);
        });

        // Steppers
        this._setStepperValue("setup-period-length", rules.periodLength);
        this._setStepperValue("setup-ot-length", rules.otPeriodLength || 3);
        this._setStepperValue("setup-to-full", rules.timeouts.full);
        this._setStepperValue("setup-to-30", rules.timeouts.to30);

        this._updateOTLengthState();
        this._updateGameSetupHeader();
    },

    _bindEvents() {
        document.getElementById("setup-rules").addEventListener("change", () => {
            this._updateToggles();
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
        game.periodLength = this._getStepperValue("setup-period-length");
        game.otPeriodLength = game.overtime
            ? this._getStepperValue("setup-ot-length")
            : null;
        game.timeoutsAllowed = {
            full: this._getStepperValue("setup-to-full"),
            to30: this._getStepperValue("setup-to-30"),
        };

        // Logging mode from segmented control
        const mode = this._getSelectedMode();
        game.enableLog = mode === "log" || mode === "full";
        game.enableStats = mode === "full" || mode === "stats";
        game.statsTimeMode = this._getStatsTimeMode();

        const whiteName = document.getElementById("setup-white-name").value.trim();
        const darkName = document.getElementById("setup-dark-name").value.trim();
        if (whiteName) game.white.name = whiteName;
        if (darkName) game.dark.name = darkName;

        Storage.save(game);
        this.onStart(game);
    },
};
