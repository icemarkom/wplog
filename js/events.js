// wplog — Live Log Screen (Event Logging)
// Event-first workflow: tap event button → modal opens → enter details → OK
// Shared numpad targets either Time or Cap field.

const Events = {
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

        // Field selection — tap to switch numpad target
        document.getElementById("field-time").addEventListener("click", () => this._setNumpadTarget("time"));
        document.getElementById("field-cap").addEventListener("click", () => this._setNumpadTarget("cap"));

        // Shared numpad
        document.querySelectorAll("#shared-numpad .numpad-btn").forEach((btn) => {
            btn.addEventListener("click", () => this._handleNumpad(btn.dataset.value));
        });

        // OK
        document.getElementById("event-modal-confirm").addEventListener("click", () => this._confirmEvent());
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
            if (this._timeRaw.length >= 3 && !this._isNoPlayer()) {
                this._setNumpadTarget("cap");
            }
        } else {
            // Cap input
            if (val === "clear") {
                this._capRaw = this._capRaw.slice(0, -1);
            } else if (["A", "B", "C"].includes(val)) {
                const code = document.getElementById("modal-event-title").dataset.code;
                const isCard = (code === "YC" || code === "RC");
                if (isCard) {
                    // Cards: allow "C" (coach), "A" then "C" → "AC" (asst coach)
                    if (val === "C" && this._capRaw === "") {
                        this._capRaw = "C";
                    } else if (val === "C" && this._capRaw === "A") {
                        this._capRaw = "AC";
                    } else if (val === "A" && this._capRaw === "") {
                        this._capRaw = "A";
                    }
                } else {
                    // Normal: A/B/C only after "1" (goalie numbers)
                    if (this._capRaw === "1") {
                        this._capRaw = "1" + val;
                    }
                }
            } else {
                if (this._capRaw.length < 2 && !this._capRaw.match(/[ABC]/)) {
                    this._capRaw += val;
                }
            }
            document.getElementById("cap-display").textContent = this._capRaw;
        }
        this._updateOkButton();
    },

    _isNoPlayer() {
        const code = document.getElementById("modal-event-title").dataset.code;
        const rules = RULES[this.game.rules];
        const eventDef = rules.events.find((e) => e.code === code);
        return eventDef && eventDef.noPlayer;
    },

    _updateOkButton() {
        const btn = document.getElementById("event-modal-confirm");
        const hasTime = this._timeRaw.length > 0 && this._parseTime(this._timeRaw) !== null;
        const noPlayer = this._isNoPlayer();
        const hasCap = noPlayer || this._capRaw.length > 0;
        const hasTeam = this.selectedTeam !== null;
        btn.disabled = !(hasTime && hasCap && hasTeam);
    },

    _setNumpadTarget(target) {
        this._numpadTarget = target;
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

        if (eventDef && eventDef.noPlayer) {
            capField.style.display = "none";
            if (this._numpadTarget === "cap") this._setNumpadTarget("time");
        } else {
            capField.style.display = "";
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
        this._setNumpadTarget(isSO && !eventDef.noPlayer ? "cap" : "time");
        this.selectedTeam = null;
        document.getElementById("team-white-btn").classList.remove("active");
        document.getElementById("team-dark-btn").classList.remove("active");

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
        this._updateOkButton();
    },

    _confirmEvent() {
        const rules = RULES[this.game.rules];
        const code = document.getElementById("modal-event-title").dataset.code;
        const eventDef = rules.events.find((e) => e.code === code);
        if (!eventDef) return;

        // Parse time
        const parsed = this._parseTime(this._timeRaw);
        if (!parsed) {
            this._showToast("Enter a valid time", "warning");
            this._setNumpadTarget("time");
            return;
        }
        const time = parsed.stored;

        const cap = this._capRaw;
        const period = this.game.currentPeriod;

        // Validate cap for player events
        if (!eventDef.noPlayer && !cap) {
            this._showToast("Enter a cap number", "warning");
            this._setNumpadTarget("cap");
            return;
        }

        // Validate time order
        const timeCheck = Game.validateTime(this.game, period, time);
        if (!timeCheck.valid) {
            if (!confirm(timeCheck.warning)) return;
        }

        // Check foul-out BEFORE logging
        const foulOut = eventDef.noPlayer
            ? null
            : Game.checkFoulOut(this.game, this.selectedTeam, cap, eventDef.code);

        // Log the event
        Game.addEvent(this.game, {
            period,
            time,
            team: this.selectedTeam,
            cap: eventDef.noPlayer ? "" : cap,
            event: eventDef.code,
            note: "",
        });

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
            if (eventDef.code === "TO" && used.full > allowed.full) {
                this._showToast(`⚠️ ${teamLabel} exceeded full timeout limit (${allowed.full})`, "warning");
            } else if (eventDef.code === "TO30" && used.to30 > allowed.to30) {
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

        for (const evt of rules.events) {
            const btn = document.createElement("button");
            btn.className = "event-btn event-" + (evt.color || "default");
            btn.textContent = evt.name;
            btn.dataset.code = evt.code;
            btn.addEventListener("click", () => this._openModal(evt));
            container.appendChild(btn);
        }

        // End Period / End Game
        const endBtn = document.createElement("button");
        endBtn.className = "event-btn event-end-period";
        endBtn.id = "end-period-btn";
        endBtn.addEventListener("click", () => this._logPeriodEnd());
        container.appendChild(endBtn);
        this._updateEndButton();
    },

    _updateEndButton() {
        const btn = document.getElementById("end-period-btn");
        if (!btn) return;
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
        const score = Game.getScore(this.game);
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
        let text;
        if (allowed.to30 > 0) {
            text = `TOL ${left.full}/${left.to30}`;
        } else {
            text = `TOL ${left.full}`;
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
                row.innerHTML = `
          <span class="log-time">${entry.time.replace(/^0(\d:)/, '$1')}</span>
          <span class="log-team ${entry.team === 'W' ? 'team-white' : 'team-dark'}">${entry.team}</span>
          <span class="log-cap">${entry.cap}</span>
          <span class="log-event event-${this._getEventClass(entry.event)}">${eventName}</span>
          <span class="log-score">${entry.event === "G" ? entry.scoreW + "–" + entry.scoreD : ""}</span>
          <button class="log-delete-btn" data-id="${entry.id}" title="Delete">✕</button>
        `;
            }
            container.appendChild(row);
        }

        container.querySelectorAll(".log-delete-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const entry = this.game.log.find((ev) => ev.id === id);
                const isPeriodEnd = entry && entry.event === "---";
                if (confirm(isPeriodEnd ? "Delete End of Period and revert?" : "Delete this event?")) {
                    if (isPeriodEnd) {
                        // Revert to the period that was ended
                        this.game.currentPeriod = entry.period;
                    }
                    Game.deleteEvent(this.game, id);
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
