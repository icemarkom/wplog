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
        this._populatePeriodLengths();
        this._populateRules();
        this._setDefaultDate();
        this._resetForm();
    },

    _resetForm() {
        // Re-enable everything (in case previously disabled)
        document.getElementById("setup-start-btn").disabled = false;
        document.getElementById("setup-start-btn").textContent = "Start Game";
        document.getElementById("setup-rules").disabled = false;
        document.getElementById("setup-overtime").disabled = false;
        document.getElementById("setup-shootout").disabled = false;
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
        document.getElementById("setup-overtime").checked = game.overtime;
        document.getElementById("setup-shootout").checked = game.shootout;
        document.getElementById("setup-period-length").value = game.periodLength || 8;
        document.getElementById("setup-ot-length").value = game.otPeriodLength || 3;
        this._updateOTLengthVisibility();
        const ta = game.timeoutsAllowed || { full: 0, to30: 0 };
        document.getElementById("setup-to-full").value = ta.full;
        document.getElementById("setup-to-30").value = ta.to30;
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

        // Disable OT if any OT period has started
        const hasOT = game.log.some((e) => typeof e.period === "string" && e.period.startsWith("OT"));
        if (hasOT) {
            document.getElementById("setup-overtime").disabled = true;
        }

        // Disable SO if shootout has started
        const hasSO = game.log.some((e) => e.period === "SO");
        if (hasSO) {
            document.getElementById("setup-shootout").disabled = true;
        }

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
        if (!hasOT) {
            saveField("setup-overtime", () => {
                game.overtime = document.getElementById("setup-overtime").checked;
                this._updateOTLengthVisibility();
            });
        }
        if (!hasSO) {
            saveField("setup-shootout", () => { game.shootout = document.getElementById("setup-shootout").checked; });
        }
        saveField("setup-period-length", () => {
            game.periodLength = parseInt(document.getElementById("setup-period-length").value);
        });
        saveField("setup-ot-length", () => {
            game.otPeriodLength = parseInt(document.getElementById("setup-ot-length").value);
        });
        saveField("setup-to-full", () => {
            game.timeoutsAllowed.full = parseInt(document.getElementById("setup-to-full").value) || 0;
        });
        saveField("setup-to-30", () => {
            game.timeoutsAllowed.to30 = parseInt(document.getElementById("setup-to-30").value) || 0;
        });
    },

    _populateRules() {
        const select = document.getElementById("setup-rules");
        select.innerHTML = "";
        for (const [key, rules] of Object.entries(RULES)) {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = rules.name;
            select.appendChild(opt);
        }
        this._updateToggles();
    },

    _populatePeriodLengths() {
        const selects = ["setup-period-length", "setup-ot-length"];
        for (const id of selects) {
            const sel = document.getElementById(id);
            sel.innerHTML = "";
            for (let m = 3; m <= 9; m++) {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m + " min";
                sel.appendChild(opt);
            }
        }
    },

    _updateOTLengthVisibility() {
        const otChecked = document.getElementById("setup-overtime").checked;
        const group = document.getElementById("setup-ot-length-group");
        const select = document.getElementById("setup-ot-length");
        select.disabled = !otChecked;
        group.style.opacity = otChecked ? "" : "0.35";
    },

    _setDefaultDate() {
        const dateInput = document.getElementById("setup-date");
        dateInput.value = new Date().toISOString().slice(0, 10);
    },

    _updateToggles() {
        const rulesKey = document.getElementById("setup-rules").value;
        const rules = RULES[rulesKey];
        document.getElementById("setup-overtime").checked = rules.overtime;
        document.getElementById("setup-shootout").checked = rules.shootout;
        document.getElementById("setup-period-length").value = rules.periodLength;
        document.getElementById("setup-ot-length").value = rules.otPeriodLength || 3;
        this._updateOTLengthVisibility();
        document.getElementById("setup-to-full").value = rules.timeouts.full;
        document.getElementById("setup-to-30").value = rules.timeouts.to30;
    },

    _bindEvents() {
        document.getElementById("setup-rules").addEventListener("change", () => {
            this._updateToggles();
        });

        // OT and SO are mutually exclusive
        document.getElementById("setup-overtime").addEventListener("change", (e) => {
            if (e.target.checked) document.getElementById("setup-shootout").checked = false;
            this._updateOTLengthVisibility();
        });
        document.getElementById("setup-shootout").addEventListener("change", (e) => {
            if (e.target.checked) document.getElementById("setup-overtime").checked = false;
            this._updateOTLengthVisibility();
        });

        document.getElementById("setup-start-btn").addEventListener("click", () => {
            this._startGame();
        });

        // Toggle has-value class for time input styling
        document.getElementById("setup-time").addEventListener("change", (e) => {
            e.target.classList.toggle("has-value", !!e.target.value);
        });
    },

    _startGame() {
        const rulesKey = document.getElementById("setup-rules").value;
        const game = Game.create(rulesKey);

        game.date = document.getElementById("setup-date").value;
        game.startTime = document.getElementById("setup-time").value;
        game.location = document.getElementById("setup-location").value;
        game.gameId = document.getElementById("setup-game-id").value.trim();
        game.overtime = document.getElementById("setup-overtime").checked;
        game.shootout = document.getElementById("setup-shootout").checked;
        game.periodLength = parseInt(document.getElementById("setup-period-length").value);
        game.otPeriodLength = game.overtime
            ? parseInt(document.getElementById("setup-ot-length").value)
            : null;
        game.timeoutsAllowed = {
            full: parseInt(document.getElementById("setup-to-full").value) || 0,
            to30: parseInt(document.getElementById("setup-to-30").value) || 0,
        };

        const whiteName = document.getElementById("setup-white-name").value.trim();
        const darkName = document.getElementById("setup-dark-name").value.trim();
        if (whiteName) game.white.name = whiteName;
        if (darkName) game.dark.name = darkName;

        Storage.save(game);
        this.onStart(game);
    },
};
