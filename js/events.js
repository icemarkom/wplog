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

import { RULES } from './config.js';
import { ConfirmDialog } from './confirm.js';
import { Game } from './game.js';
import { escapeHTML } from './sanitize.js';
import { initDialog } from './dialog.js';
import { Storage } from './storage.js';
import { getMaxMinutes, parseTime, formatTimeDisplay, formatTime } from './time.js';
import { ClockEngine } from './clock.js';

// wplog — Live Log Screen (Event Logging)
// Event-first workflow: tap event button → modal opens → enter details → OK
// Shared numpad targets either Time or Cap field.

export const Events = {
    game: null,
    selectedTeam: null,
    _pendingEvent: null,
    _boundModal: false,
    _numpadTarget: "time",  // "time", "cap", or "altCap"
    _timeRaw: "",           // raw digits for time
    _capRaw: "",            // raw value for cap
    _altCapRaw: "",         // raw value for alt cap
    _teams: null,           // [home, away] team descriptors
    _editingId: null,       // event ID being edited, or null for new
    _selectedPeriod: null,  // period selected in modal pill row
    _rosterMode: false,     // true when modal is in roster-only mode (Add Name)

    init(game) {
        this.game = game;
        this._initScoreBar();
        this._buildEventButtons();
        this._buildPeriodTabs();
        this._updateScoreBar();
        this._updateLog();

        if (!this._boundModal) {
            this._bindModalEvents();
            this._boundModal = true;
        }
    },

    // Apply team ordering to score bar based on homeTeam config
    _initScoreBar() {
        this._teams = Game.getTeams(this.game);
        for (let i = 0; i < 2; i++) {
            const t = this._teams[i];
            document.getElementById(`score-label-${i}`).textContent = t.label.toUpperCase();
            const container = document.getElementById(`score-team-${i}`);
            container.classList.remove("score-team-white", "score-team-dark");
            container.classList.add(`score-team-${t.cssClass}`);
        }
    },

    _getEventDef(code) {
        if (code === "Cap swap") return { name: "Swap Caps", code: "Cap swap", color: "end-period", isSwap: true };
        const rules = RULES[this.game.rules];
        return rules.events.find((e) => e.code === code) || null;
    },


    // ── Time Parsing ────────────────────────────────────────
    // Delegated to pure functions in time.js:
    //   getMaxMinutes(period, periodLength, otPeriodLength)
    //   parseTime(digits, maxMinutes)
    //   formatTimeDisplay(digits)

    _getMaxMinutes() {
        const period = this._selectedPeriod || this.game.currentPeriod;
        return getMaxMinutes(period, this.game.periodLength, this.game.otPeriodLength);
    },

    _parseTime(digits) {
        return parseTime(digits, this._getMaxMinutes());
    },

    _formatTimeDisplay(digits) {
        return formatTimeDisplay(digits, this._getMaxMinutes());
    },

    // ── Modal Controls ──────────────────────────────────────

    _bindModalEvents() {
        // Alert dialog (foul-out / load error popups)
        initDialog("alert-dialog", { dismissId: "alert-dismiss" });

        // Cancel
        document.getElementById("event-modal-cancel").addEventListener("click", () => this._closeModal());

        // Backdrop — click outside modal content
        const modal = document.getElementById("event-modal");
        modal.addEventListener("click", (e) => {
            if (e.target === modal) this._closeModal();
        });

        // Native Escape = cancel
        modal.addEventListener("cancel", (e) => {
            e.preventDefault();
            this._closeModal();
        });

        // Team toggle
        document.getElementById("team-white-btn").addEventListener("click", () => this._selectTeam("W"));
        document.getElementById("team-dark-btn").addEventListener("click", () => this._selectTeam("D"));
        document.getElementById("team-official-btn").addEventListener("click", () => this._selectTeam("official"));

        // Field selection — tap to switch numpad target
        document.getElementById("field-time").addEventListener("click", () => this._setNumpadTarget("time", true));
        document.getElementById("field-cap").addEventListener("click", () => this._setNumpadTarget("cap", true));
        const altCapField = document.getElementById("field-alt-cap");
        if (altCapField) altCapField.addEventListener("click", () => this._setNumpadTarget("altCap", true));
        
        const swapIcon = document.getElementById("modal-swap-btn");
        if (swapIcon) {
            swapIcon.addEventListener("click", () => {
                this._swapType = this._swapType === "bi" ? "uni" : "bi";
                swapIcon.innerHTML = this._swapType === "uni" 
                    ? '<img src="img/icon-arrow-right.svg" class="btn-icon" alt="Right">' 
                    : '<img src="img/icon-swap.svg" class="btn-icon" alt="Swap">';
                document.getElementById("label-cap").textContent = this._swapType === "uni" ? "OLD CAP" : "CAP";
                document.getElementById("label-alt-cap").textContent = this._swapType === "uni" ? "NEW CAP" : "CAP";
            });
        }

        // Shared numpad
        document.querySelectorAll("#shared-numpad .numpad-btn").forEach((btn) => {
            btn.addEventListener("click", () => this._handleNumpad(btn.dataset.value));
        });

        // OK
        document.getElementById("event-modal-confirm").addEventListener("click", () => this._confirmEvent());

        // Keyboard input — desktop support
        document.addEventListener("keydown", (e) => {
            if (!document.getElementById("event-modal").open) return;

            const key = e.key;

            // If focus is inside a native text input, let browser handle normal typing/shortcuts.
            // Only Enter, Escape, and Tab pass through for modal control.
            if (e.target.tagName === "INPUT" && e.target.type === "text" && key !== "Enter" && key !== "Escape" && key !== "Tab") {
                return;
            }

            // Digits 0-9
            if (key >= "0" && key <= "9") {
                e.preventDefault();
                this._handleNumpad(key);
                return;
            }

            // Letters A/B/C/H (case-insensitive)
            const upper = key.toUpperCase();
            if (["A", "B", "C", "H"].includes(upper)) {
                e.preventDefault();
                // H triggers the HC button (mapped to "C" internally)
                this._handleNumpad(upper === "H" ? "C" : upper);
                return;
            }

            // W/D/O for team selection (case-insensitive)
            if (upper === "W") {
                e.preventDefault();
                this._selectTeam("W");
                return;
            }
            if (upper === "D") {
                e.preventDefault();
                this._selectTeam("D");
                return;
            }
            if (upper === "O") {
                // Only if allowOfficial is set on this event
                const oCode = document.getElementById("modal-event-title").dataset.code;
                const oRules = RULES[this.game.rules];
                const oEventDef = oRules.events.find((ev) => ev.code === oCode);
                if (oEventDef && oEventDef.allowOfficial) {
                    e.preventDefault();
                    this._selectTeam("official");
                    return;
                }
            }

            // Backspace = clear
            if (key === "Backspace") {
                e.preventDefault();
                this._handleNumpad("clear");
                return;
            }

            // Tab = cycle through fields: time → cap → [altCap] → name
            // Shift+Tab = reverse: name → [altCap] → cap → time
            if (key === "Tab") {
                e.preventDefault();
                const code = document.getElementById("modal-event-title").dataset.code;
                const eventDef = this._getEventDef(code);
                const nameField = document.getElementById("field-roster-name");
                const nameInput = document.getElementById("modal-input-name");
                const nameVisible = nameField && !nameField.classList.contains("hidden");
                const isInName = e.target === nameInput;
                const reverse = e.shiftKey;

                if (reverse) {
                    // Shift+Tab: move up
                    if (isInName) {
                        nameInput.blur();
                        if (eventDef && eventDef.isSwap) {
                            this._setNumpadTarget("altCap", true);
                        } else {
                            this._setNumpadTarget("cap", true);
                        }
                    } else if (this._numpadTarget === "altCap") {
                        this._setNumpadTarget("cap", true);
                    } else if (this._numpadTarget === "cap") {
                        this._setNumpadTarget("time", true);
                    } else {
                        // time → wrap to name (or last numpad field)
                        if (nameVisible) {
                            nameInput.focus();
                        } else if (eventDef && eventDef.isSwap) {
                            this._setNumpadTarget("altCap", true);
                        } else {
                            this._setNumpadTarget("cap", true);
                        }
                    }
                } else {
                    // Tab: move down
                    if (isInName) {
                        nameInput.blur();
                        this._setNumpadTarget("time", true);
                    } else {
                        let next;
                        if (this._numpadTarget === "time") {
                            next = "cap";
                        } else if (this._numpadTarget === "cap" && eventDef && eventDef.isSwap) {
                            next = "altCap";
                        } else if (nameVisible) {
                            nameInput.focus();
                            return;
                        } else {
                            next = "time";
                        }
                        this._setNumpadTarget(next, true);
                    }
                }
                return;
            }

            // Enter = confirm (if OK is enabled)
            if (key === "Enter") {
                e.preventDefault();
                const okBtn = document.getElementById("event-modal-confirm");
                if (!okBtn.disabled) {
                    this._confirmEvent();
                }
                return;
            }
        });
    },

    _handleNumpad(val) {
        if (this._numpadTarget === "time") {
            const maxLen = this._getMaxMinutes() >= 10 ? 4 : 3;
            if (val === "clear") {
                this._timeRaw = this._timeRaw.slice(0, -1);
            } else if (["A", "B", "C"].includes(val)) {
                return; // letters not valid for time
            } else if (this._timeRaw.length < maxLen) {
                this._timeRaw += val;
            }
            document.getElementById("time-display").innerHTML = this._formatTimeDisplay(this._timeRaw);

            // Auto-advance to cap after complete input length
            if (this._timeRaw.length >= maxLen && !this._isTeamOnly()) {
                this._setNumpadTarget("cap");
            }
        } else {
            // Cap or Alt Cap input
            const code = document.getElementById("modal-event-title").dataset.code;
            const eventDef = this._getEventDef(code);
            let targetRaw = this._numpadTarget === "cap" ? this._capRaw : this._altCapRaw;

            if (val === "clear") {
                if (targetRaw === "HC" || targetRaw === "AC") {
                    targetRaw = "";
                } else {
                    targetRaw = targetRaw.slice(0, -1);
                }
            } else if (["A", "B", "C"].includes(val)) {
                const isRoster = this._rosterMode;
                const hasStaff = isRoster || (eventDef && (eventDef.allowCoach || eventDef.allowAssistant || eventDef.allowBench));
                if (hasStaff && targetRaw === "") {
                    // Single-press coaching staff caps
                    if (val === "C" && (isRoster || eventDef.allowCoach)) {
                        targetRaw = "HC";
                    } else if (val === "A" && (isRoster || eventDef.allowAssistant)) {
                        targetRaw = "AC";
                    } else if (val === "B" && (!isRoster && eventDef.allowBench)) {
                        targetRaw = "B";
                    }
                } else if (targetRaw === "1") {
                    // Goalie modifier: 1A, 1B, 1C
                    targetRaw = "1" + val;
                }
            } else {
                // Digit input — blocked when allowPlayer is false
                if (eventDef && eventDef.allowPlayer === false) {
                    // No digit input for non-player events
                } else if (targetRaw.length < 2 && !targetRaw.match(/[A-Z]/) && targetRaw !== "HC") {
                    targetRaw += val;
                }
            }

            if (this._numpadTarget === "cap") {
                this._capRaw = targetRaw;
                document.getElementById("cap-display").textContent = this._capRaw;
                this._refreshRosterFields();
            } else {
                this._altCapRaw = targetRaw;
                document.getElementById("alt-cap-display").textContent = this._altCapRaw;
            }
            this._updateLetterButtons();
        }
        this._updateOkButton();
    },

    _isTeamOnly() {
        const code = document.getElementById("modal-event-title").dataset.code;
        const eventDef = this._getEventDef(code);
        return eventDef && eventDef.teamOnly;
    },

    // ── Contextual Letter Button Labels + Disable ────────────

    _updateLetterButtons() {
        const code = document.getElementById("modal-event-title").dataset.code;
        const eventDef = this._getEventDef(code);
        const targetRaw = this._numpadTarget === "cap" ? this._capRaw
            : this._numpadTarget === "altCap" ? this._altCapRaw : "";

        const isRoster = this._rosterMode;
        const hasStaff = isRoster || (eventDef && (eventDef.allowCoach || eventDef.allowAssistant || eventDef.allowBench));
        const isGoalieModifier = targetRaw === "1";
        const isEmpty = targetRaw === "";
        const isCapTarget = this._numpadTarget === "cap" || this._numpadTarget === "altCap";

        const btnA = document.querySelector('#shared-numpad .numpad-letter[data-value="A"]');
        const btnB = document.querySelector('#shared-numpad .numpad-letter[data-value="B"]');
        const btnC = document.querySelector('#shared-numpad .numpad-letter[data-value="C"]');
        if (!btnA || !btnB || !btnC) return;

        // Labels always reflect event context
        if (isGoalieModifier) {
            // Goalie suffix: always A/B/C
            btnA.textContent = "A";
            btnB.textContent = "B";
            btnC.textContent = "C";
        } else if (hasStaff && isEmpty) {
            // Coaching staff: show labels per flag
            btnC.textContent = (isRoster || eventDef.allowCoach) ? "HC" : "C";
            btnA.textContent = (isRoster || eventDef.allowAssistant) ? "AC" : "A";
            btnB.textContent = "B";
        } else {
            // Default
            btnA.textContent = "A";
            btnB.textContent = "B";
            btnC.textContent = "C";
        }

        // Disabled state: must be on cap target to be enabled
        if (!isCapTarget) {
            // Not targeting cap — all disabled
            btnA.disabled = true;
            btnB.disabled = true;
            btnC.disabled = true;
        } else if (isGoalieModifier) {
            // Goalie suffix: all enabled
            btnA.disabled = false;
            btnB.disabled = false;
            btnC.disabled = false;
        } else if (hasStaff && isEmpty) {
            // Coaching staff: enabled per flag
            btnC.disabled = !(isRoster || eventDef.allowCoach);
            btnA.disabled = !(isRoster || eventDef.allowAssistant);
            btnB.disabled = isRoster || !eventDef.allowBench;
        } else {
            // Default: all disabled
            btnA.disabled = true;
            btnB.disabled = true;
            btnC.disabled = true;
        }
    },

    _isValidCap(capRaw, eventDef) {
        if (!capRaw) return !!(eventDef && eventDef.allowNoCap);

        // Goalie modifiers
        if (capRaw === "1A" || capRaw === "1B" || capRaw === "1C") return true;

        // Coaching staff caps
        if (capRaw === "HC" || capRaw === "AC" || capRaw === "B") {
            if (eventDef) {
                if (capRaw === "HC" && !eventDef.allowCoach) return false;
                if (capRaw === "AC" && !eventDef.allowAssistant) return false;
                if (capRaw === "B" && !eventDef.allowBench) return false;
            } else {
                // Roster mode
                if (capRaw === "B") return false;
            }
            return true;
        }

        // Single letters from incomplete coaching cap entry or other letters
        if (/^[a-zA-Z]+$/.test(capRaw)) return false;

        // Normal numeric caps (allowPlayer is true by default)
        if (eventDef && eventDef.allowPlayer === false) return false;

        return /^[1-9]\d*$/.test(capRaw);
    },

    _updateOkButton() {
        const btn = document.getElementById("event-modal-confirm");

        // Roster mode: require team + cap + name
        if (this._rosterMode) {
            const hasTeam = this.selectedTeam !== null;
            const hasCap = this._isValidCap(this._capRaw, null);
            const nameInput = document.getElementById("modal-input-name");
            const hasName = nameInput && nameInput.value.trim().length > 0;
            btn.disabled = !(hasTeam && hasCap && hasName);
            return;
        }

        const code = document.getElementById("modal-event-title").dataset.code;
        const eventDef = this._getEventDef(code);

        const teamOnly = eventDef && eventDef.teamOnly;
        const isSwap = eventDef && eventDef.isSwap;
        
        let hasCap = teamOnly || this._isValidCap(this._capRaw, eventDef);
        if (isSwap) {
            hasCap = this._isValidCap(this._capRaw, eventDef) && this._isValidCap(this._altCapRaw, eventDef);
        }
        
        const hasTeam = this.selectedTeam !== null;

        // Stats UI validation logic
        const isStatsMode = !this.game.enableLog && this.game.enableStats;
        const isStatsOnly = eventDef && eventDef.statsOnly;
        const timeMode = this.game.statsTimeMode || "off";

        let hasTime;
        if (isSwap || ((isStatsOnly || isStatsMode) && (timeMode === "off" || timeMode === "optional"))) {
            hasTime = true; // time not required for swap cap features
        } else {
            hasTime = this._timeRaw.length > 0 && this._parseTime(this._timeRaw) !== null;
        }

        btn.disabled = !(hasTime && hasCap && hasTeam);
    },

    _setNumpadTarget(target, isUserClick) {
        this._numpadTarget = target;

        if (isUserClick) {
            if (target === "time" && this._timeRaw.length > 0 && this.game.currentPeriod !== "SO") {
                this._timeRaw = "";
                document.getElementById("time-display").innerHTML = this._formatTimeDisplay("");
                this._updateOkButton();
            } else if (target === "cap" && this._capRaw.length > 0) {
                this._capRaw = "";
                document.getElementById("cap-display").textContent = "";
                this._updateOkButton();
            } else if (target === "altCap" && this._altCapRaw.length > 0) {
                this._altCapRaw = "";
                document.getElementById("alt-cap-display").textContent = "";
                this._updateOkButton();
            }
        }

        document.getElementById("field-time").classList.toggle("active", target === "time");
        document.getElementById("field-cap").classList.toggle("active", target === "cap");
        
        const altField = document.getElementById("field-alt-cap");
        if (altField) altField.classList.toggle("active", target === "altCap");

        this._updateLetterButtons();
    },

    _setModalTitle(eventDef) {
        const el = document.getElementById("modal-event-title");
        el.textContent = eventDef.name;
        el.dataset.code = eventDef.code;
    },

    _updateModalSections() {
        const code = document.getElementById("modal-event-title").dataset.code;
        const eventDef = this._getEventDef(code);

        const capField = document.getElementById("field-cap");
        const altCapField = document.getElementById("field-alt-cap");

        const isTeamOnly = !!(eventDef && eventDef.teamOnly);
        capField.classList.toggle("hidden", isTeamOnly);
        if (isTeamOnly && this._numpadTarget === "cap") this._setNumpadTarget("time");

        const swapIcon = document.getElementById("modal-swap-btn");
        const isSwap = !!(eventDef && eventDef.isSwap);
        if (altCapField) {
            altCapField.classList.toggle("hidden", !isSwap);
            if (swapIcon) {
                swapIcon.classList.toggle("hidden", !isSwap);
                if (isSwap) {
                    swapIcon.innerHTML = this._swapType === "uni" 
                        ? '<img src="img/icon-arrow-right.svg" class="btn-icon" alt="Right">' 
                        : '<img src="img/icon-swap.svg" class="btn-icon" alt="Swap">';
                }
            }
            if (isSwap) {
                document.getElementById("label-cap").textContent = this._swapType === "uni" ? "OLD CAP" : "CAP";
                document.getElementById("label-alt-cap").textContent = this._swapType === "uni" ? "NEW CAP" : "CAP";
            } else {
                document.getElementById("label-cap").textContent = "CAP";
            }
        }

        // Show/hide Official team button
        const officialBtn = document.getElementById("team-official-btn");
        if (officialBtn) {
            officialBtn.classList.toggle("hidden", !(eventDef && eventDef.allowOfficial));
        }

        this._updateOkButton();
    },

    _openModal(eventDef) {
        this._pendingEvent = eventDef;
        this._editingId = null;

        // Set title
        this._setModalTitle(eventDef);

        // Period selector
        this._selectedPeriod = this.game.currentPeriod;
        this._buildPeriodPills();

        // Reset inputs
        this._timeRaw = "";
        this._capRaw = "";
        this._altCapRaw = "";
        this._swapType = "bi";

        // Shootout: lock time to 0:00
        const isSO = this._selectedPeriod === "SO";
        const timeField = document.getElementById("field-time");
        if (isSO) {
            this._timeRaw = "000";
            document.getElementById("time-display").innerHTML = this._formatTimeDisplay("000");
            timeField.classList.add("disabled");
        } else {
            const clockSecs = ClockEngine.getSeconds();
            if (clockSecs != null) {
                this._timeRaw = this._timeToRawDigits(clockSecs, this._getMaxMinutes());
                document.getElementById("time-display").innerHTML = this._formatTimeDisplay(this._timeRaw);
            } else {
                document.getElementById("time-display").innerHTML = this._formatTimeDisplay("");
            }
            timeField.classList.remove("disabled");
        }
        document.getElementById("cap-display").textContent = "";
        const altDisplay = document.getElementById("alt-cap-display");
        if (altDisplay) altDisplay.textContent = "";

        // Show/hide sections
        this._updateModalSections();

        // Default target: cap for SO (time is locked), time otherwise
        // Stats events: adjust for statsTimeMode
        const isStatsMode = !this.game.enableLog && this.game.enableStats;
        const isStatsOnly = eventDef.statsOnly;
        const timeMode = this.game.statsTimeMode || "off";

        if ((isStatsOnly || isStatsMode) && timeMode === "off") {
            // Hide time field entirely
            timeField.classList.add("hidden");
            this._setNumpadTarget(eventDef.teamOnly ? "time" : "cap");
        } else if ((isStatsOnly || isStatsMode) && timeMode === "optional") {
            timeField.classList.remove("hidden");
            this._setNumpadTarget(eventDef.teamOnly ? "time" : "cap");
        } else {
            timeField.classList.remove("hidden");
            this._setNumpadTarget(isSO && !eventDef.teamOnly ? "cap" : "time");
        }

        this.selectedTeam = null;
        document.getElementById("team-white-btn").classList.remove("active");
        document.getElementById("team-dark-btn").classList.remove("active");
        const officialBtn = document.getElementById("team-official-btn");
        if (officialBtn) officialBtn.classList.remove("active");

        // Update OK state and Roster fields
        const nameInput = document.getElementById("modal-input-name");
        const idInput = document.getElementById("modal-input-id");
        if (nameInput) nameInput.value = "";
        if (idInput) idInput.value = "";
        this._refreshRosterFields();

        // OK button text
        document.getElementById("event-modal-confirm").textContent = "OK";
        this._updateLetterButtons();
        this._updateOkButton();

        // Show modal
        document.getElementById("event-modal").showModal();
    },

    _closeModal() {
        const modal = document.getElementById("event-modal");
        if (modal.open) modal.close();
        this._pendingEvent = null;
        this._editingId = null;
        this._rosterMode = false;
        document.getElementById("event-modal-confirm").textContent = "OK";
    },

    // ── Roster-only Modal ───────────────────────────────────

    _openModalForRoster() {
        this._rosterMode = true;
        this._pendingEvent = null;
        this._editingId = null;

        // Title
        const el = document.getElementById("modal-event-title");
        el.textContent = "Add Name";
        el.dataset.code = "";

        // Hide period selector
        const periodSelector = document.getElementById("modal-period-selector");
        periodSelector.innerHTML = "";
        periodSelector.classList.add("hidden");

        // Hide time field
        const timeField = document.getElementById("field-time");
        timeField.classList.add("hidden");

        // Show cap field, hide alt cap + swap
        document.getElementById("field-cap").classList.remove("hidden");
        const altCapField = document.getElementById("field-alt-cap");
        if (altCapField) altCapField.classList.add("hidden");
        const swapIcon = document.getElementById("modal-swap-btn");
        if (swapIcon) swapIcon.classList.add("hidden");
        document.getElementById("label-cap").textContent = "CAP";

        // Hide official button
        const officialBtn = document.getElementById("team-official-btn");
        if (officialBtn) officialBtn.classList.add("hidden");

        // Reset inputs
        this._timeRaw = "";
        this._capRaw = "";
        this._altCapRaw = "";

        document.getElementById("cap-display").textContent = "";

        // Start numpad on cap
        this._setNumpadTarget("cap");

        // Reset team selection
        this.selectedTeam = null;
        document.getElementById("team-white-btn").classList.remove("active");
        document.getElementById("team-dark-btn").classList.remove("active");
        if (officialBtn) officialBtn.classList.remove("active");

        // Show name/ID fields unconditionally
        const nameField = document.getElementById("field-roster-name");
        const idField = document.getElementById("field-roster-id");
        const nameInput = document.getElementById("modal-input-name");
        const idInput = document.getElementById("modal-input-id");
        if (nameInput) nameInput.value = "";
        if (idInput) idInput.value = "";
        if (nameField) nameField.classList.remove("hidden");

        // Show ID field if rule set has playerId
        const rules = RULES[this.game.rules];
        if (rules.playerId && idField) {
            idField.classList.remove("hidden");
            idInput.placeholder = rules.playerId + " (Optional)";
        } else if (idField) {
            idField.classList.add("hidden");
        }

        // Listen for name input changes to update OK button
        if (nameInput) {
            nameInput.addEventListener("input", () => this._updateOkButton(), { once: false });
        }

        // OK button text
        document.getElementById("event-modal-confirm").textContent = "OK";
        this._updateLetterButtons();
        this._updateOkButton();

        // Show modal
        document.getElementById("event-modal").showModal();
    },

    _refreshRosterFields() {
        const nameField = document.getElementById("field-roster-name");
        const idField = document.getElementById("field-roster-id");
        const nameInput = document.getElementById("modal-input-name");
        const idInput = document.getElementById("modal-input-id");
        if (!nameField || !idField) return;

        // In roster mode, fields are always visible — skip eventDef checks
        if (this._rosterMode) {
            nameField.classList.remove("hidden");
            const rules = RULES[this.game.rules];
            const playerIdLabel = rules.playerId;
            if (playerIdLabel) {
                idField.classList.remove("hidden");
                idInput.placeholder = playerIdLabel + " (Optional)";
            } else {
                idField.classList.add("hidden");
            }

            // Pre-fill from existing roster
            const cap = this._capRaw;
            const team = this.selectedTeam;
            if (cap && team) {
                const teamKey = team === "W" ? "white" : "dark";
                const entry = this.game[teamKey].roster && this.game[teamKey].roster[cap];
                if (entry) {
                    if (entry.name && !nameInput.value) nameInput.value = entry.name;
                    if (entry.id && !idInput.value && playerIdLabel) idInput.value = entry.id;
                }
            }
            this._updateOkButton();
            return;
        }

        const code = document.getElementById("modal-event-title").dataset.code;
        const eventDef = this._getEventDef(code);

        // Hide roster fields for teamOnly, swap, and official
        const hide = !!((eventDef && (eventDef.teamOnly || eventDef.isSwap)) || this.selectedTeam === "official");
        nameField.classList.toggle("hidden", hide);
        idField.classList.toggle("hidden", hide);

        if (hide) return;

        // Show ID field only when ruleset has playerId
        const rules = RULES[this.game.rules];
        const playerIdLabel = rules.playerId;
        if (playerIdLabel) {
            idField.classList.remove("hidden");
            idInput.placeholder = playerIdLabel + " (Optional)";
        } else {
            idField.classList.add("hidden");
        }

        // Pre-fill from existing roster
        const cap = this._capRaw;
        const team = this.selectedTeam;
        if (cap && team && team !== "official") {
            const teamKey = team === "W" ? "white" : "dark";
            const entry = this.game[teamKey].roster && this.game[teamKey].roster[cap];
            if (entry) {
                if (entry.name && !nameInput.value) nameInput.value = entry.name;
                if (entry.id && !idInput.value && playerIdLabel) idInput.value = entry.id;
            }
        }
    },

    _selectTeam(team) {
        this.selectedTeam = team;
        document.getElementById("team-white-btn").classList.toggle("active", team === "W");
        document.getElementById("team-dark-btn").classList.toggle("active", team === "D");
        const officialBtn = document.getElementById("team-official-btn");
        if (officialBtn) officialBtn.classList.toggle("active", team === "official");
        this._refreshRosterFields();
        this._updateOkButton();
    },

    // ── Period Selector ─────────────────────────────────────

    _getAvailablePeriods() {
        const periods = [];
        const cp = this.game.currentPeriod;

        // Regulation periods up to current (or all if in OT/SO)
        const maxReg = typeof cp === "number" ? cp : this.game.periods;
        for (let i = 1; i <= maxReg; i++) {
            periods.push(i);
        }

        // OT periods from log + current
        if (typeof cp === "string") {
            const otSet = new Set();
            for (const e of this.game.log) {
                if (typeof e.period === "string" && e.period.startsWith("OT")) {
                    otSet.add(e.period);
                }
            }
            if (cp.startsWith("OT")) otSet.add(cp);
            const sortedOTs = [...otSet].sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
            periods.push(...sortedOTs);

            if (cp === "SO" || this.game.log.some(e => e.period === "SO")) {
                periods.push("SO");
            }
        }

        return periods;
    },

    _buildPeriodPills() {
        const container = document.getElementById("modal-period-selector");
        container.innerHTML = "";

        const periods = this._getAvailablePeriods();
        // Hide selector if only one period available
        container.classList.toggle("hidden", periods.length <= 1);

        for (const period of periods) {
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className = "team-btn";
            pill.textContent = Game.getPeriodLabel(period, this.game.periods);
            pill.dataset.period = typeof period === "number" ? String(period) : period;
            if (String(period) === String(this._selectedPeriod)) {
                pill.classList.add("active");
            }
            pill.addEventListener("click", () => this._selectPeriod(period));
            container.appendChild(pill);
        }
    },

    _selectPeriod(period) {
        this._selectedPeriod = period;
        // Update pill highlighting
        document.querySelectorAll("#modal-period-selector .team-btn").forEach(p => {
            p.classList.toggle("active", p.dataset.period === String(period));
        });

        // Handle SO lock
        const isSO = period === "SO";
        const timeField = document.getElementById("field-time");
        if (isSO) {
            this._timeRaw = "000";
            document.getElementById("time-display").innerHTML = this._formatTimeDisplay("000");
            timeField.classList.add("disabled");
        } else {
            // If switching away from SO, clear the locked time
            if (this._timeRaw === "000" && timeField.classList.contains("disabled")) {
                this._timeRaw = "";
                document.getElementById("time-display").innerHTML = this._formatTimeDisplay("");
            }
            timeField.classList.remove("disabled");
        }

        // Truncate time digits if maxLen changed (e.g., switching between OT and regulation)
        const maxLen = this._getMaxMinutes() >= 10 ? 4 : 3;
        if (this._timeRaw.length > maxLen) {
            this._timeRaw = this._timeRaw.slice(0, maxLen);
            document.getElementById("time-display").innerHTML = this._formatTimeDisplay(this._timeRaw);
        }

        this._updateOkButton();
    },

    // ── Edit-in-Place Helpers ───────────────────────────────

    _timeToRawDigits(seconds, maxMinutes) {
        if (seconds === null || seconds === undefined) return "";
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        const isLong = maxMinutes >= 10;
        if (isLong) {
            return String(m).padStart(2, "0") + String(s).padStart(2, "0");
        }
        return String(m) + String(s).padStart(2, "0");
    },

    _openModalForEdit(entry) {
        const eventDef = this._getEventDef(entry.event);
        if (!eventDef) return;

        this._editingId = entry.id;
        this._pendingEvent = eventDef;

        // Title (locked — event type not changeable)
        this._setModalTitle(eventDef);

        // Period
        this._selectedPeriod = entry.period;
        this._buildPeriodPills();

        // Time
        const maxMin = getMaxMinutes(entry.period, this.game.periodLength, this.game.otPeriodLength);
        this._timeRaw = this._timeToRawDigits(entry.time, maxMin);
        document.getElementById("time-display").innerHTML = this._formatTimeDisplay(this._timeRaw);

        const isSO = entry.period === "SO";
        const timeField = document.getElementById("field-time");
        timeField.classList.toggle("disabled", isSO);

        // Cap
        this._capRaw = entry.cap || "";
        document.getElementById("cap-display").textContent = this._capRaw;

        // Alt cap + swap type (for cap swaps)
        this._altCapRaw = (eventDef.isSwap && entry.note) ? entry.note : "";
        this._swapType = entry.swapType || "bi";
        const altDisplay = document.getElementById("alt-cap-display");
        if (altDisplay) altDisplay.textContent = this._altCapRaw;

        // Sections
        this._updateModalSections();

        // Stats time mode handling
        const isStatsMode = !this.game.enableLog && this.game.enableStats;
        const isStatsOnly = eventDef.statsOnly;
        const timeMode = this.game.statsTimeMode || "off";

        if ((isStatsOnly || isStatsMode) && timeMode === "off") {
            timeField.classList.add("hidden");
            this._setNumpadTarget(eventDef.teamOnly ? "time" : "cap");
        } else if ((isStatsOnly || isStatsMode) && timeMode === "optional") {
            timeField.classList.remove("hidden");
            this._setNumpadTarget(eventDef.teamOnly ? "time" : "cap");
        } else {
            timeField.classList.remove("hidden");
            this._setNumpadTarget(isSO && !eventDef.teamOnly ? "cap" : "time");
        }

        // Team
        if (entry.team === "" && eventDef.allowOfficial) {
            this.selectedTeam = "official";
        } else if (entry.team === "W" || entry.team === "D") {
            this.selectedTeam = entry.team;
        } else {
            this.selectedTeam = null;
        }
        document.getElementById("team-white-btn").classList.toggle("active", this.selectedTeam === "W");
        document.getElementById("team-dark-btn").classList.toggle("active", this.selectedTeam === "D");
        const officialBtn = document.getElementById("team-official-btn");
        if (officialBtn) officialBtn.classList.toggle("active", this.selectedTeam === "official");

        // Roster fields
        const nameInput = document.getElementById("modal-input-name");
        const idInput = document.getElementById("modal-input-id");
        if (nameInput) nameInput.value = "";
        if (idInput) idInput.value = "";
        this._refreshRosterFields();

        // OK button → "Save"
        document.getElementById("event-modal-confirm").textContent = "Save";
        this._updateLetterButtons();
        this._updateOkButton();

        // Show modal
        document.getElementById("event-modal").showModal();
    },

    async _confirmEvent() {
        // ── Roster-only mode: save name to roster, no event ──
        if (this._rosterMode) {
            const cap = this._capRaw;
            const team = this.selectedTeam;
            if (!cap || !team) return;

            const teamKey = team === "W" ? "white" : "dark";
            if (!this.game[teamKey].roster) this.game[teamKey].roster = {};
            if (!this.game[teamKey].roster[cap]) this.game[teamKey].roster[cap] = {};

            const nameInput = document.getElementById("modal-input-name");
            const idInput = document.getElementById("modal-input-id");
            if (nameInput?.value.trim()) this.game[teamKey].roster[cap].name = nameInput.value.trim();
            if (idInput?.value.trim()) this.game[teamKey].roster[cap].id = idInput.value.trim();

            Storage.save(this.game);
            this._closeModal();
            this._showToast("Name added", "info");
            return;
        }

        const rules = RULES[this.game.rules];
        const code = document.getElementById("modal-event-title").dataset.code;
        const eventDef = this._getEventDef(code);
        if (!eventDef) return;

        // Parse time (stats events may have no time)
        const isStatsMode = !this.game.enableLog && this.game.enableStats;
        const isStatsOnly = eventDef.statsOnly;
        const timeMode = this.game.statsTimeMode || "off";
        let time;

        if ((isStatsOnly || isStatsMode) && (timeMode === "off" || (timeMode === "optional" && this._timeRaw.length === 0))) {
            time = null;
        } else if (eventDef.isSwap && this._timeRaw.length === 0) {
            time = null;
        } else {
            const parsed = this._parseTime(this._timeRaw);
            if (!parsed) {
                this._showToast("Enter a valid time", "warning");
                this._setNumpadTarget("time");
                return;
            }
            time = parsed.stored;
        }

        const cap = this._capRaw;
        const period = this._selectedPeriod;
        const team = this.selectedTeam === "official" ? "" : this.selectedTeam;

        // Validate cap for player events
        if (!eventDef.teamOnly && !cap) {
            this._showToast("Enter a cap number", "warning");
            this._setNumpadTarget("cap");
            return;
        }

        // Validate against locally retired caps
        if (!eventDef.teamOnly && cap && (this.selectedTeam === "W" || this.selectedTeam === "D")) {
            const retired = this.game._retiredCaps || { W: new Set(), D: new Set() };
            if (retired[this.selectedTeam].has(cap)) {
                const ok = await ConfirmDialog.show({
                    title: "Retired Cap entered",
                    message: `Cap ${cap} was officially retired during an earlier Cap Swap. Are you sure you want to log an event against it?`,
                    type: "warning",
                    confirmLabel: "Proceed"
                });
                if (!ok) return;
            }
        }

        // Validate time order (skip for edits — user is correcting data)
        if (time && !this._editingId) {
            const timeCheck = Game.validateTime(this.game, period, time);
            if (!timeCheck.valid) {
                const ok = await ConfirmDialog.show({
                    title: "Out of Order Time",
                    message: timeCheck.warning,
                    confirmLabel: "Continue",
                    type: "warning",
                });
                if (!ok) return;
            }
        }

        // Ensure cap is registered in roster (single authoritative source per team)
        const nameInput = document.getElementById("modal-input-name");
        const idInput = document.getElementById("modal-input-id");
        if (cap && this.selectedTeam && this.selectedTeam !== "official" && !eventDef.teamOnly) {
            const teamKey = this.selectedTeam === "W" ? "white" : "dark";
            if (!this.game[teamKey].roster) this.game[teamKey].roster = {};
            if (!this.game[teamKey].roster[cap]) this.game[teamKey].roster[cap] = {};
            if (nameInput?.value.trim()) this.game[teamKey].roster[cap].name = nameInput.value.trim();
            if (idInput?.value.trim()) this.game[teamKey].roster[cap].id = idInput.value.trim();
        }

        if (this._editingId) {
            // ── Edit mode ────────────────────────────────────
            const updates = {
                period,
                time,
                team: team || "",
                cap: eventDef.teamOnly ? "" : cap,
            };
            if (eventDef.isSwap) {
                updates.note = this._altCapRaw;
                updates.swapType = this._swapType;
            }

            Game.editEvent(this.game, this._editingId, updates);
            Storage.save(this.game);

            // Close modal
            this._closeModal();

            // Check foul-out AFTER edit (event already counted — no +1)
            if (!eventDef.teamOnly && !isStatsOnly && cap && (team === "W" || team === "D")) {
                const baseCap = (this.game._activeCaps && this.game._activeCaps[team])
                    ? (this.game._activeCaps[team][cap] || cap)
                    : cap;

                let foulOut = null;
                if (eventDef.autoFoulOut) {
                    const count = Game.getPlayerEventCount(this.game, team, baseCap, eventDef.code);
                    if (count >= eventDef.autoFoulOut) {
                        foulOut = { type: "auto", event: eventDef.name, count };
                    }
                }
                if (!foulOut && eventDef.isPersonalFoul) {
                    const fouls = Game.getPlayerFouls(this.game, team, baseCap);
                    if (fouls >= rules.foulOutLimit) {
                        foulOut = { type: "accumulated", count: fouls, limit: rules.foulOutLimit };
                    }
                }

                if (foulOut) {
                    const teamLabel = team === "W" ? "White" : "Dark";
                    if (foulOut.type === "auto") {
                        this._showFoulOutPopup(
                            `FOUL OUT — ${teamLabel} ${cap}`,
                            `${foulOut.event} — automatic game exclusion`
                        );
                    } else {
                        this._showFoulOutPopup(
                            `FOUL OUT — ${teamLabel} ${cap}`,
                            `${foulOut.count} personal fouls (limit: ${foulOut.limit})`
                        );
                    }
                }
            }

            this._showToast("Event updated", "info");
        } else {
            // ── New event ────────────────────────────────────
            // Check foul-out BEFORE logging (skip for statsOnly events)
            const foulOut = (eventDef.teamOnly || isStatsOnly)
                ? null
                : Game.checkFoulOut(this.game, this.selectedTeam, cap, eventDef.code);

            // Log the event
            Game.addEvent(this.game, {
                period,
                time,
                team: team || "",
                cap: eventDef.teamOnly ? "" : cap,
                event: eventDef.code,
                note: eventDef.isSwap ? this._altCapRaw : "",
                swapType: eventDef.isSwap ? this._swapType : undefined
            });
            Storage.save(this.game);

            // Close modal
            this._closeModal();

            // Show foul-out notification
            if (foulOut) {
                const teamLabel = this.selectedTeam === "W" ? "White" : "Dark";
                if (foulOut.type === "auto") {
                    this._showFoulOutPopup(
                        `FOUL OUT — ${teamLabel} ${cap}`,
                        `${foulOut.event} — automatic game exclusion`
                    );
                } else {
                    this._showFoulOutPopup(
                        `FOUL OUT — ${teamLabel} ${cap}`,
                        `${foulOut.count} personal fouls (limit: ${foulOut.limit})`
                    );
                }
            }
        }

        // Check timeout over-limit (both new and edited)
        if (eventDef.code === "TO" || eventDef.code === "TO30") {
            const used = Game.getTimeoutsUsed(this.game, this.selectedTeam);
            const allowed = this.game.timeoutsAllowed || { full: 0, to30: 0 };
            const teamLabel = this.selectedTeam === "W" ? "White" : "Dark";
            if (eventDef.code === "TO" && allowed.full !== -1 && used.full > allowed.full) {
                this._showToast(`⚠️ ${teamLabel} exceeded full timeout limit (${allowed.full})`, "warning");
            } else if (eventDef.code === "TO30" && allowed.to30 !== -1 && used.to30 > allowed.to30) {
                this._showToast(`⚠️ ${teamLabel} exceeded 30s timeout limit (${allowed.to30})`, "warning");
            }
        }

        this._updateScoreBar();
        this._updateLog();
        this._updateEndButton();
    },

    // ── Main View Builders ──────────────────────────────────

    _buildEventButtons() {
        const container = document.getElementById("event-buttons");
        container.innerHTML = "";
        const rules = RULES[this.game.rules];
        const showLog = this.game.enableLog;
        const showStats = this.game.enableStats;
        const statsOnly = showStats && !showLog;

        // Separate log events and stats events
        const logEvents = rules.events.filter((e) => !e.statsOnly);
        const statEvents = rules.events.filter((e) => e.statsOnly);

        // ── Helper: append the three grey action buttons ──
        const appendActionButtons = () => {
            // Separator above grey action row
            const sep = document.createElement("div");
            sep.className = "stats-separator";
            container.appendChild(sep);

            // Add Name button — roster-only modal (no event logged)
            const addNameBtn = document.createElement("button");
            addNameBtn.className = "event-btn event-end-period";
            addNameBtn.textContent = "Add Name";
            addNameBtn.addEventListener("click", () => this._openModalForRoster());
            container.appendChild(addNameBtn);

            // Swap Caps button
            const swapBtn = document.createElement("button");
            swapBtn.className = "event-btn event-end-period";
            swapBtn.textContent = "Swap Caps";
            swapBtn.dataset.code = "Cap swap";
            swapBtn.addEventListener("click", () => this._openModal(this._getEventDef("Cap swap")));
            container.appendChild(swapBtn);

            // End Period / End Game — always visible (periods track in all modes)
            const endBtn = document.createElement("button");
            endBtn.id = "end-period-btn";
            endBtn.className = "event-btn event-end-period";
            endBtn.textContent = "End Period";
            endBtn.onclick = () => this._logPeriodEnd();
            container.appendChild(endBtn);
            this._updateEndButton();
        };

        // Stats-only mode: show ALL events in config order, all teal
        if (statsOnly) {
            for (const evt of rules.events) {
                const btn = document.createElement("button");
                btn.className = "event-btn event-teal";
                btn.textContent = evt.name;
                btn.dataset.code = evt.code;
                btn.addEventListener("click", () => this._openModal(evt));
                container.appendChild(btn);
            }
            appendActionButtons();
        } else {
            // Log-only or hybrid mode
            if (showLog) {
                for (const evt of logEvents) {
                    const btn = document.createElement("button");
                    btn.className = "event-btn event-" + (evt.color || "default");
                    btn.textContent = evt.name;
                    btn.dataset.code = evt.code;
                    btn.addEventListener("click", () => this._openModal(evt));
                    container.appendChild(btn);
                }
            }

            // Grey action buttons — between log events and stats
            appendActionButtons();

            // Hybrid: add separator then stats in teal
            if (showLog && showStats && statEvents.length > 0) {
                const sep = document.createElement("div");
                sep.className = "stats-separator";
                container.appendChild(sep);
            }

            if (showStats) {
                for (const evt of statEvents) {
                    const btn = document.createElement("button");
                    btn.className = "event-btn event-teal";
                    btn.textContent = evt.name;
                    btn.dataset.code = evt.code;
                    btn.addEventListener("click", () => this._openModal(evt));
                    container.appendChild(btn);
                }
            }
        }
    },

    _updateEndButton() {
        const btn = document.getElementById("end-period-btn");
        if (!btn) return;
        if (this.game.endTime) {
            btn.textContent = "Game Over";
            btn.disabled = true;
            return;
        }
        const next = Game.getNextPeriod(this.game);
        if (next === "TIED") {
            btn.textContent = "Score Tied";
            btn.disabled = true;
        } else if (next === null) {
            btn.textContent = "End Game";
            btn.disabled = false;
        } else {
            btn.textContent = "End Period";
            btn.disabled = false;
        }
    },

    _getEventClass(code) {
        const rules = RULES[this.game.rules];
        const eventDef = rules.events.find((e) => e.code === code);
        return eventDef && eventDef.color ? eventDef.color : "default";
    },

    _buildPeriodTabs() {
        // Period tabs removed — period advances via End Period button,
        // and reverts by deleting the End of Period event.
        const container = document.getElementById("period-tabs");
        container.innerHTML = "";
    },

    _updateScoreBar() {
        const score = Game.getDisplayScore(this.game);
        for (let i = 0; i < 2; i++) {
            const t = this._teams[i];
            const val = t.code === "W" ? score.white : score.dark;
            document.getElementById(`score-value-${i}`).textContent = val;
        }
        document.getElementById("current-period").textContent = Game.getPeriodLabel(
            this.game.currentPeriod, this.game.periods
        );
        this._updateTOL(this._teams[0].code, "tol-0");
        this._updateTOL(this._teams[1].code, "tol-1");
    },

    _updateTOL(team, elementId) {
        const el = document.getElementById(elementId);
        const left = Game.getTimeoutsLeft(this.game, team);
        const allowed = this.game.timeoutsAllowed || { full: 0, to30: 0 };
        const fmtVal = (v) => v === Infinity ? "\u221e" : v;
        let text;
        if (allowed.to30 !== 0) {
            text = `TOL ${fmtVal(left.full)}/${fmtVal(left.to30)}`;
        } else {
            text = `TOL ${fmtVal(left.full)}`;
        }
        el.textContent = text;
        el.classList.toggle("tol-warning", left.full === 0 && left.to30 === 0);
    },

    _updateLog() {
        const container = document.getElementById("recent-log");
        container.innerHTML = "";

        const entries = [...this.game.log].reverse();
        let currentPeriodGroup = null;

        for (const entry of entries) {
            // Period group header
            if (String(entry.period) !== String(currentPeriodGroup)) {
                currentPeriodGroup = entry.period;
                const header = document.createElement("div");
                header.className = "log-title log-period-header";
                header.textContent = Game.getPeriodLabel(entry.period, this.game.periods);
                container.appendChild(header);
            }

            const row = document.createElement("div");
            row.className = "log-entry";
            if (entry.event === "---") {
                row.classList.add("log-period-end");
                row.innerHTML = `
          <span class="log-separator">——— End of Period ———</span>
          <button class="log-delete-btn" data-id="${entry.id}" title="Delete">✕</button>
        `;
            } else {
                const eventDef = this._getEventDef(entry.event);
                let eventName = eventDef ? eventDef.name : entry.event;
                let capDisplay = escapeHTML(entry.cap);

                if (entry.event === "Cap swap") {
                    eventName = "Cap swap";
                    const arrow = entry.swapType === "uni" ? "\u2192" : "\u21C4";
                    capDisplay = `${escapeHTML(entry.cap)} ${arrow} ${escapeHTML(entry.note)}`;
                }
                
                const isStatEvent = eventDef && eventDef.statsOnly;
                const colorClass = this._getEventClass(entry.event);

                // Add colored left border for all events
                row.classList.add("event-border-" + colorClass);

                // Time display: blank for SO events and stat events without time
                let rawFmt = (entry.time !== null) ? formatTime(entry.time) : "";
                const timeDisplay = entry.period === "SO" ? "" : rawFmt.replace(/^0(\d:)/, '$1');

                // Score display: blank for stats-only events
                const scoreDisplay = isStatEvent ? "" : Game.formatEntryScore(entry, this.game);

                row.innerHTML = `
          <span class="log-time">${timeDisplay}</span>
          <span class="log-team ${entry.team === 'W' ? 'team-white' : 'team-dark'}">${entry.team}</span>
          <span class="log-cap">${capDisplay}</span>
          <span class="log-event event-${colorClass}">${eventName}</span>
          <span class="log-score">${scoreDisplay}</span>
          <button class="log-delete-btn" data-id="${entry.id}" title="Delete">✕</button>
        `;

                // Tap row to open edit modal
                row.addEventListener("click", ((e) => {
                    if (e.target.closest(".log-delete-btn")) return;
                    this._openModalForEdit(entry);
                }));
            }
            container.appendChild(row);
        }

        container.querySelectorAll(".log-delete-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const entry = this.game.log.find((ev) => ev.id === id);
                const isPeriodEnd = entry && entry.event === "---";
                const ok = await ConfirmDialog.show({
                    title: isPeriodEnd ? "Revert Period" : "Delete Event",
                    message: isPeriodEnd ? "Delete End of Period and revert?" : "Delete this event?",
                    confirmLabel: isPeriodEnd ? "Revert" : "Delete",
                    type: "danger",
                });
                if (ok) {
                    if (isPeriodEnd) {
                        // Revert to the period that was ended
                        this.game.currentPeriod = entry.period;
                    }
                    Game.deleteEvent(this.game, id);
                    Storage.save(this.game);
                    this._updateScoreBar();
                    this._updateLog();
                    this._updateEndButton();
                }
            });
        });
    },

    // ── Period End ───────────────────────────────────────────

    _logPeriodEnd() {
        const period = this.game.currentPeriod;
        const next = Game.getNextPeriod(this.game);
        const isEndGame = (next === null);

        // For End Game, log the actual wall clock time
        const note = isEndGame
            ? "End of Game"
            : "End of " + Game.getPeriodLabel(period, this.game.periods);

        Game.addEvent(this.game, {
            period,
            time: 0,
            team: "",
            cap: "",
            event: "---",
            note,
        });
        Storage.save(this.game);

        if (isEndGame) {
            // Store end time on game object
            const now = new Date();
            this.game.endTime = now.toTimeString().slice(0, 5);
            Storage.save(this.game);
            this._updateLog();
            this._updateEndButton();
            this._showToast("Game over", "info");
        } else {
            Game.advancePeriod(this.game);
            Storage.save(this.game);
            this._buildPeriodTabs();
            this._updateScoreBar();
            this._updateLog();
            this._updateEndButton();
            this._showToast("Period " + Game.getPeriodLabel(this.game.currentPeriod, this.game.periods) + " started", "info");
        }
    },

    // ── Notifications ───────────────────────────────────────

    _showFoulOutPopup(title, message) {
        const dialog = document.getElementById("alert-dialog");
        document.getElementById("alert-title").textContent = title;
        document.getElementById("alert-message").textContent = message;
        dialog.showModal();
        setTimeout(() => { if (dialog.open) dialog.close(); }, 5000);
    },

    _showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        if (container.showPopover && !container.matches(':popover-open')) {
            container.showPopover();
        }

        const toast = document.createElement("div");
        toast.className = "toast toast-" + type;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-fade");
            setTimeout(() => {
                toast.remove();
                if (container.children.length === 0 && container.hidePopover) {
                    container.hidePopover();
                }
            }, 300);
        }, 2500);
    },
};
