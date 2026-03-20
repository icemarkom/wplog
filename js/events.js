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
import { Storage } from './storage.js';

// wplog — Live Log Screen (Event Logging)
// Event-first workflow: tap event button → modal opens → enter details → OK
// Shared numpad targets either Time or Cap field.

export const Events = {
    game: null,
    selectedTeam: null,
    _pendingEvent: null,
    _boundModal: false,
    _numpadTarget: "time",  // "time" or "cap"
    _timeRaw: "",           // raw digits for time
    _capRaw: "",            // raw value for cap

    init(game) {
        this.game = game;
        this._buildEventButtons();
        this._buildPeriodTabs();
        this._updateScoreBar();
        this._updateLog();

        if (!this._boundModal) {
            this._bindModalEvents();
            this._boundModal = true;
        }
    },

    // ── Time Parsing ────────────────────────────────────────
    // Water polo game clock: M:SS format
    // Digits fill right-to-left: S2, S1, M
    // "4"   → 0:04  (4 seconds)
    // "45"  → 0:45  (45 seconds)
    // "453" → 4:53  (4 min 53 sec)
    // Max time is capped by the current period's length.

    _getMaxMinutes() {
        const period = this.game.currentPeriod;
        if (period === "SO") return 0;
        if (typeof period === "string" && period.startsWith("OT")) {
            return this.game.otPeriodLength || 3;
        }
        return this.game.periodLength || 8;
    },

    _parseTime(digits) {
        if (digits.length === 0) return null;

        // Right-justify into 3 positions: M S1 S2
        const padded = digits.padStart(3, "0");
        const minutes = parseInt(padded[0]);
        const seconds = parseInt(padded.slice(1));

        if (seconds > 59 || minutes > 9) return null;

        // Cap at period length
        const maxMin = this._getMaxMinutes();
        if (minutes > maxMin || (minutes === maxMin && seconds > 0)) return null;

        return {
            display: minutes + ":" + String(seconds).padStart(2, "0"),
            stored: minutes + ":" + String(seconds).padStart(2, "0"),
        };
    },

    _formatTimeDisplay(digits) {
        // Right-to-left fill into M:S1S2 — placeholder is -:--
        const padded = digits.padStart(3, "\0"); // pad with nulls
        const parts = [];

        for (let i = 0; i < 3; i++) {
            if (padded[i] === "\0") {
                parts.push(`<span class="time-placeholder">-</span>`);
            } else {
                parts.push(padded[i]);
            }
        }

        // Colon is dim only when no digits entered
        const colonClass = digits.length > 0 ? "" : ' class="time-placeholder"';

        // Minutes placeholder shows for 0-2 digits, hidden when 3 digits (minutes filled)
        return `<span class="time-formatted">${parts[0]}<span${colonClass}>:</span>${parts[1]}${parts[2]}</span>`;
    },

    // ── Modal Controls ──────────────────────────────────────

    _bindModalEvents() {
        // Cancel
        document.getElementById("event-modal-cancel").addEventListener("click", () => this._closeModal());

        // Backdrop
        document.getElementById("event-modal").addEventListener("click", (e) => {
            if (e.target === e.currentTarget) this._closeModal();
        });

        // Team toggle
        document.getElementById("team-white-btn").addEventListener("click", () => this._selectTeam("W"));
        document.getElementById("team-dark-btn").addEventListener("click", () => this._selectTeam("D"));
        document.getElementById("team-official-btn").addEventListener("click", () => this._selectTeam("official"));

        // Field selection — tap to switch numpad target
        document.getElementById("field-time").addEventListener("click", () => this._setNumpadTarget("time", true));
        document.getElementById("field-cap").addEventListener("click", () => this._setNumpadTarget("cap", true));

        // Shared numpad
        document.querySelectorAll("#shared-numpad .numpad-btn").forEach((btn) => {
            btn.addEventListener("click", () => this._handleNumpad(btn.dataset.value));
        });

        // OK
        document.getElementById("event-modal-confirm").addEventListener("click", () => this._confirmEvent());

        // Keyboard input — desktop support
        document.addEventListener("keydown", (e) => {
            if (!document.getElementById("event-modal").classList.contains("visible")) return;

            const key = e.key;

            // Digits 0-9
            if (key >= "0" && key <= "9") {
                e.preventDefault();
                this._handleNumpad(key);
                return;
            }

            // Letters A/B/C (case-insensitive)
            const upper = key.toUpperCase();
            if (["A", "B", "C"].includes(upper)) {
                e.preventDefault();
                this._handleNumpad(upper);
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

            // Tab = toggle time/cap field
            if (key === "Tab") {
                e.preventDefault();
                const next = this._numpadTarget === "time" ? "cap" : "time";
                this._setNumpadTarget(next, true);
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

            // Escape = cancel
            if (key === "Escape") {
                e.preventDefault();
                this._closeModal();
                return;
            }
        });

        // Keyboard: Escape/Enter to dismiss foul-out overlay
        document.addEventListener("keydown", (e) => {
            if (!document.getElementById("foulout-overlay").classList.contains("visible")) return;
            if (document.getElementById("event-modal").classList.contains("visible")) return;
            if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                document.getElementById("foulout-overlay").classList.remove("visible");
            }
        });
    },

    _handleNumpad(val) {
        if (this._numpadTarget === "time") {
            if (val === "clear") {
                this._timeRaw = this._timeRaw.slice(0, -1);
            } else if (["A", "B", "C"].includes(val)) {
                return; // letters not valid for time
            } else if (this._timeRaw.length < 3) {
                this._timeRaw += val;
            }
            document.getElementById("time-display").innerHTML = this._formatTimeDisplay(this._timeRaw);

            // Auto-advance to cap after 3 digits (M:SS complete)
            if (this._timeRaw.length >= 3 && !this._isTeamOnly()) {
                this._setNumpadTarget("cap");
            }
        } else {
            // Cap input
            if (val === "clear") {
                this._capRaw = this._capRaw.slice(0, -1);
            } else if (["A", "B", "C"].includes(val)) {
                const code = document.getElementById("modal-event-title").dataset.code;
                const rules = RULES[this.game.rules];
                const eventDef = rules.events.find((e) => e.code === code);
                if (eventDef && (eventDef.allowCoach || eventDef.allowAssistant || eventDef.allowBench)) {
                    // Coach/assistant/bench: "C" = coach, "A" then "C" → "AC" = asst coach, "B" = bench
                    if (val === "C" && eventDef.allowCoach && this._capRaw === "") {
                        this._capRaw = "C";
                    } else if (val === "C" && eventDef.allowAssistant && this._capRaw === "A") {
                        this._capRaw = "AC";
                    } else if (val === "A" && eventDef.allowAssistant && this._capRaw === "") {
                        this._capRaw = "A";
                    } else if (val === "B" && eventDef.allowBench && this._capRaw === "") {
                        this._capRaw = "B";
                    }
                } else {
                    // Normal: A/B/C only after "1" (goalie numbers)
                    if (this._capRaw === "1") {
                        this._capRaw = "1" + val;
                    }
                }
            } else {
                // Digit input — blocked when allowPlayer is false
                const code = document.getElementById("modal-event-title").dataset.code;
                const rules = RULES[this.game.rules];
                const eventDef = rules.events.find((e) => e.code === code);
                if (eventDef && eventDef.allowPlayer === false) {
                    // No digit input for non-player events
                } else if (this._capRaw.length < 2 && !this._capRaw.match(/[ABC]/)) {
                    this._capRaw += val;
                }
            }
            document.getElementById("cap-display").textContent = this._capRaw;
        }
        this._updateOkButton();
    },

    _isTeamOnly() {
        const code = document.getElementById("modal-event-title").dataset.code;
        const rules = RULES[this.game.rules];
        const eventDef = rules.events.find((e) => e.code === code);
        return eventDef && eventDef.teamOnly;
    },

    _updateOkButton() {
        const btn = document.getElementById("event-modal-confirm");
        const teamOnly = this._isTeamOnly();
        const hasCap = teamOnly || this._capRaw.length > 0;
        const hasTeam = this.selectedTeam !== null;

        // Stats events: time requirement depends on statsTimeMode
        const code = document.getElementById("modal-event-title").dataset.code;
        const rules = RULES[this.game.rules];
        const eventDef = rules.events.find((e) => e.code === code);
        const isStatsMode = !this.game.enableLog && this.game.enableStats;
        const isStatsOnly = eventDef && eventDef.statsOnly;
        const timeMode = this.game.statsTimeMode || "off";

        let hasTime;
        if ((isStatsOnly || isStatsMode) && (timeMode === "off" || timeMode === "optional")) {
            hasTime = true; // time not required
        } else {
            hasTime = this._timeRaw.length > 0 && this._parseTime(this._timeRaw) !== null;
        }

        btn.disabled = !(hasTime && hasCap && hasTeam);
    },

    _setNumpadTarget(target, isUserClick) {
        this._numpadTarget = target;

        // Auto-clear only on user-initiated clicks, not auto-advance
        if (isUserClick) {
            if (target === "time" && this._timeRaw.length > 0 && this.game.currentPeriod !== "SO") {
                this._timeRaw = "";
                document.getElementById("time-display").innerHTML = this._formatTimeDisplay("");
                this._updateOkButton();
            } else if (target === "cap" && this._capRaw.length > 0) {
                this._capRaw = "";
                document.getElementById("cap-display").textContent = "";
                this._updateOkButton();
            }
        }

        document.getElementById("field-time").classList.toggle("active", target === "time");
        document.getElementById("field-cap").classList.toggle("active", target === "cap");
    },

    _setModalTitle(eventDef) {
        const el = document.getElementById("modal-event-title");
        el.textContent = eventDef.name;
        el.dataset.code = eventDef.code;
    },

    _updateModalSections() {
        const code = document.getElementById("modal-event-title").dataset.code;
        const rules = RULES[this.game.rules];
        const eventDef = rules.events.find((e) => e.code === code);

        const capField = document.getElementById("field-cap");

        if (eventDef && eventDef.teamOnly) {
            capField.style.display = "none";
            if (this._numpadTarget === "cap") this._setNumpadTarget("time");
        } else {
            capField.style.display = "";
        }

        // Show/hide Official team button
        const officialBtn = document.getElementById("team-official-btn");
        if (officialBtn) {
            officialBtn.style.display = (eventDef && eventDef.allowOfficial) ? "" : "none";
        }

        this._updateOkButton();
    },

    _openModal(eventDef) {
        this._pendingEvent = eventDef;

        // Set title
        this._setModalTitle(eventDef);

        // Reset inputs
        this._timeRaw = "";
        this._capRaw = "";

        // Shootout: lock time to 0:00
        const isSO = this.game.currentPeriod === "SO";
        const timeField = document.getElementById("field-time");
        if (isSO) {
            this._timeRaw = "000";
            document.getElementById("time-display").innerHTML = this._formatTimeDisplay("000");
            timeField.style.pointerEvents = "none";
            timeField.style.opacity = "0.5";
        } else {
            document.getElementById("time-display").innerHTML = this._formatTimeDisplay("");
            timeField.style.pointerEvents = "";
            timeField.style.opacity = "";
        }
        document.getElementById("cap-display").textContent = "";

        // Show/hide sections
        this._updateModalSections();

        // Default target: cap for SO (time is locked), time otherwise
        // Stats events: adjust for statsTimeMode
        const isStatsMode = !this.game.enableLog && this.game.enableStats;
        const isStatsOnly = eventDef.statsOnly;
        const timeMode = this.game.statsTimeMode || "off";

        if ((isStatsOnly || isStatsMode) && timeMode === "off") {
            // Hide time field entirely
            timeField.style.display = "none";
            this._setNumpadTarget(eventDef.teamOnly ? "time" : "cap");
        } else if ((isStatsOnly || isStatsMode) && timeMode === "optional") {
            timeField.style.display = "";
            this._setNumpadTarget(eventDef.teamOnly ? "time" : "cap");
        } else {
            timeField.style.display = "";
            this._setNumpadTarget(isSO && !eventDef.teamOnly ? "cap" : "time");
        }

        this.selectedTeam = null;
        document.getElementById("team-white-btn").classList.remove("active");
        document.getElementById("team-dark-btn").classList.remove("active");
        const officialBtn = document.getElementById("team-official-btn");
        if (officialBtn) officialBtn.classList.remove("active");

        // Update OK state
        this._updateOkButton();

        // Show modal
        document.getElementById("event-modal").classList.add("visible");
    },

    _closeModal() {
        document.getElementById("event-modal").classList.remove("visible");
        this._pendingEvent = null;
    },

    _selectTeam(team) {
        this.selectedTeam = team;
        document.getElementById("team-white-btn").classList.toggle("active", team === "W");
        document.getElementById("team-dark-btn").classList.toggle("active", team === "D");
        const officialBtn = document.getElementById("team-official-btn");
        if (officialBtn) officialBtn.classList.toggle("active", team === "official");
        this._updateOkButton();
    },

    async _confirmEvent() {
        const rules = RULES[this.game.rules];
        const code = document.getElementById("modal-event-title").dataset.code;
        const eventDef = rules.events.find((e) => e.code === code);
        if (!eventDef) return;

        // Parse time (stats events may have no time)
        const isStatsMode = !this.game.enableLog && this.game.enableStats;
        const isStatsOnly = eventDef.statsOnly;
        const timeMode = this.game.statsTimeMode || "off";
        let time;

        if ((isStatsOnly || isStatsMode) && (timeMode === "off" || (timeMode === "optional" && this._timeRaw.length === 0))) {
            time = "";
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
        const period = this.game.currentPeriod;

        // Validate cap for player events
        if (!eventDef.teamOnly && !cap) {
            this._showToast("Enter a cap number", "warning");
            this._setNumpadTarget("cap");
            return;
        }

        // Validate time order (skip for statsOnly events without time)
        if (time) {
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

        // Check foul-out BEFORE logging (skip for statsOnly events)
        const foulOut = (eventDef.teamOnly || isStatsOnly)
            ? null
            : Game.checkFoulOut(this.game, this.selectedTeam, cap, eventDef.code);

        // Log the event
        Game.addEvent(this.game, {
            period,
            time,
            team: this.selectedTeam === "official" ? "" : this.selectedTeam,
            cap: eventDef.teamOnly ? "" : cap,
            event: eventDef.code,
            note: "",
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

        // Check timeout over-limit
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

        // End Period / End Game — always visible (periods track in all modes)
        const endBtn = document.createElement("button");
        endBtn.id = "end-period-btn";
        endBtn.className = "event-btn event-end-period";
        endBtn.textContent = "End Period";
        endBtn.onclick = () => this._logPeriodEnd();
        container.appendChild(endBtn);
        this._updateEndButton();
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
        document.getElementById("score-white").textContent = score.white;
        document.getElementById("score-dark").textContent = score.dark;
        document.getElementById("current-period").textContent = Game.getPeriodLabel(
            this.game.currentPeriod
        );
        this._updateTOL("W", "tol-white");
        this._updateTOL("D", "tol-dark");
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

        const entries = [...this.game.log].reverse().slice(0, 15);

        for (const entry of entries) {
            const row = document.createElement("div");
            row.className = "log-entry";
            if (entry.event === "---") {
                row.classList.add("log-period-end");
                row.innerHTML = `
          <span class="log-period">${Game.getPeriodLabel(entry.period)}</span>
          <span class="log-separator">——— End of Period ———</span>
          <button class="log-delete-btn" data-id="${entry.id}" title="Delete">✕</button>
        `;
            } else {
                const rules = RULES[this.game.rules];
                const eventDef = rules.events.find((e) => e.code === entry.event);
                const eventName = eventDef ? eventDef.name : entry.event;
                const isStatEvent = eventDef && eventDef.statsOnly;
                const colorClass = this._getEventClass(entry.event);

                // Add colored left border for all events
                row.classList.add("event-border-" + colorClass);

                // Stat events additionally get the stat-event class
                if (isStatEvent) {
                    row.classList.add("stat-event");
                }

                // Time display: blank for SO events and stat events without time
                const timeDisplay = entry.period === "SO" ? "" : (entry.time || "").replace(/^0(\d:)/, '$1');

                // Score display: blank for stats-only events
                const scoreDisplay = isStatEvent ? "" : Game.formatEntryScore(entry, this.game);

                row.innerHTML = `
          <span class="log-time">${timeDisplay}</span>
          <span class="log-team ${entry.team === 'W' ? 'team-white' : 'team-dark'}">${entry.team}</span>
          <span class="log-cap">${escapeHTML(entry.cap)}</span>
          <span class="log-event event-${colorClass}">${eventName}</span>
          <span class="log-score">${scoreDisplay}</span>
          <button class="log-delete-btn" data-id="${entry.id}" title="Delete">✕</button>
        `;
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
            : "End of " + Game.getPeriodLabel(period);

        Game.addEvent(this.game, {
            period,
            time: "00:00",
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
            this._showToast("Period " + Game.getPeriodLabel(this.game.currentPeriod) + " started", "info");
        }
    },

    // ── Notifications ───────────────────────────────────────

    _showFoulOutPopup(title, message) {
        const overlay = document.getElementById("foulout-overlay");
        document.getElementById("foulout-title").textContent = title;
        document.getElementById("foulout-message").textContent = message;
        overlay.classList.add("visible");

        document.getElementById("foulout-dismiss").onclick = () => {
            overlay.classList.remove("visible");
        };

        setTimeout(() => overlay.classList.remove("visible"), 5000);
    },

    _showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = "toast toast-" + type;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-fade");
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    },
};
