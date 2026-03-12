// wplog — Live Log Screen (Event Logging)

const Events = {
    game: null,

    init(game) {
        this.game = game;
        this._buildEventButtons();
        this._buildPeriodTabs();
        this._updateScoreBar();
        this._updateLog();
        this._bindEvents();
        this._selectTeam("W");
        this._updateCapInput();
    },

    _bindEvents() {
        // Team toggle
        document.getElementById("team-white-btn").addEventListener("click", () => this._selectTeam("W"));
        document.getElementById("team-dark-btn").addEventListener("click", () => this._selectTeam("D"));

        // Cap numpad
        document.querySelectorAll("#cap-numpad .numpad-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const val = btn.dataset.value;
                if (val === "clear") {
                    document.getElementById("cap-display").value = "";
                } else {
                    const display = document.getElementById("cap-display");
                    const current = display.value;
                    // A, B, C can only follow "1"
                    if (["A", "B", "C"].includes(val)) {
                        if (current === "1") {
                            display.value = "1" + val;
                        }
                    } else {
                        if (current.length < 2 && !current.match(/[ABC]/)) {
                            display.value = current + val;
                        }
                    }
                }
            });
        });

        // Period end button
        document.getElementById("period-end-btn").addEventListener("click", () => {
            this._logPeriodEnd();
        });
    },

    _selectTeam(team) {
        this.selectedTeam = team;
        const whiteBtn = document.getElementById("team-white-btn");
        const darkBtn = document.getElementById("team-dark-btn");
        whiteBtn.classList.toggle("active", team === "W");
        darkBtn.classList.toggle("active", team === "D");
    },

    _buildEventButtons() {
        const container = document.getElementById("event-buttons");
        container.innerHTML = "";
        const rules = RULES[this.game.rules];

        for (const evt of rules.events) {
            const btn = document.createElement("button");
            btn.className = "event-btn event-" + this._getEventClass(evt.code);
            btn.textContent = evt.name;
            btn.dataset.code = evt.code;
            btn.dataset.noPlayer = evt.noPlayer ? "true" : "false";
            btn.addEventListener("click", () => this._logEvent(evt));
            container.appendChild(btn);
        }
    },

    _getEventClass(code) {
        const map = {
            "G": "goal",
            "E": "exclusion",
            "E-Game": "exclusion",
            "P": "penalty",
            "P-E": "penalty",
            "TO": "timeout",
            "TO30": "timeout",
            "YC": "yellow",
            "RC": "red",
            "MC": "red",
            "BR": "red",
        };
        return map[code] || "default";
    },

    _buildPeriodTabs() {
        const container = document.getElementById("period-tabs");
        container.innerHTML = "";
        const periods = Game.getAllPeriods(this.game);

        for (const period of periods) {
            const tab = document.createElement("button");
            tab.className = "period-tab";
            tab.textContent = Game.getPeriodLabel(period);
            tab.dataset.period = typeof period === "number" ? period : period;
            if (
                period === this.game.currentPeriod ||
                String(period) === String(this.game.currentPeriod)
            ) {
                tab.classList.add("active");
            }
            tab.addEventListener("click", () => {
                this.game.currentPeriod = period;
                this._buildPeriodTabs();
                this._updateLog();
            });
            container.appendChild(tab);
        }
    },

    _updateScoreBar() {
        const score = Game.getScore(this.game);
        document.getElementById("score-white").textContent = score.white;
        document.getElementById("score-dark").textContent = score.dark;
        document.getElementById("current-period").textContent = Game.getPeriodLabel(
            this.game.currentPeriod
        );
    },

    _updateCapInput() {
        document.getElementById("cap-display").value = "";
    },

    _updateLog() {
        const container = document.getElementById("recent-log");
        container.innerHTML = "";

        // Show last 15 events (most recent first)
        const entries = [...this.game.log].reverse().slice(0, 15);

        for (const entry of entries) {
            const row = document.createElement("div");
            row.className = "log-entry";
            if (entry.event === "---") {
                row.classList.add("log-period-end");
                row.innerHTML = `
          <span class="log-period">${Game.getPeriodLabel(entry.period)}</span>
          <span class="log-separator">——— End of Period ———</span>
        `;
            } else {
                const rules = RULES[this.game.rules];
                const eventDef = rules.events.find((e) => e.code === entry.event);
                const eventName = eventDef ? eventDef.name : entry.event;
                row.innerHTML = `
          <span class="log-time">${entry.time}</span>
          <span class="log-period">${Game.getPeriodLabel(entry.period)}</span>
          <span class="log-team ${entry.team === 'W' ? 'team-white' : 'team-dark'}">${entry.team}</span>
          <span class="log-cap">#${entry.cap}</span>
          <span class="log-event event-${this._getEventClass(entry.event)}">${eventName}</span>
          <span class="log-score">${entry.scoreW}–${entry.scoreD}</span>
          <button class="log-delete-btn" data-id="${entry.id}" title="Delete">✕</button>
        `;
            }
            container.appendChild(row);
        }

        // Bind delete buttons
        container.querySelectorAll(".log-delete-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm("Delete this event?")) {
                    Game.deleteEvent(this.game, id);
                    this._updateScoreBar();
                    this._updateLog();
                }
            });
        });
    },

    _logEvent(eventDef) {
        const time = document.getElementById("time-input").value || "00:00";
        const cap = document.getElementById("cap-display").value;
        const period = this.game.currentPeriod;

        // Validate cap for player events
        if (!eventDef.noPlayer && !cap) {
            this._showToast("Enter a cap number first", "warning");
            return;
        }

        // Validate time
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
            team: eventDef.noPlayer ? "" : this.selectedTeam,
            cap: eventDef.noPlayer ? "" : cap,
            event: eventDef.code,
            note: "",
        });

        // Show foul-out notification
        if (foulOut) {
            const teamLabel = this.selectedTeam === "W" ? "White" : "Dark";
            if (foulOut.type === "auto") {
                this._showFoulOutPopup(
                    `FOUL OUT — ${teamLabel} #${cap}`,
                    `${foulOut.event} — automatic game exclusion`
                );
            } else {
                this._showFoulOutPopup(
                    `FOUL OUT — ${teamLabel} #${cap}`,
                    `${foulOut.count} exclusion fouls (limit: ${foulOut.limit})`
                );
            }
        }

        this._updateScoreBar();
        this._updateLog();
        this._updateCapInput();
    },

    _logPeriodEnd() {
        const period = this.game.currentPeriod;

        Game.addEvent(this.game, {
            period,
            time: "00:00",
            team: "",
            cap: "",
            event: "---",
            note: "End of " + Game.getPeriodLabel(period),
        });

        const next = Game.advancePeriod(this.game);
        if (next !== null) {
            // Set default time for new period
            if (next === "SO") {
                document.getElementById("time-input").value = "00:00";
                document.getElementById("time-input").disabled = true;
            } else {
                document.getElementById("time-input").disabled = false;
            }
            this._buildPeriodTabs();
            this._updateScoreBar();
            this._updateLog();
            this._showToast("Period " + Game.getPeriodLabel(next) + " started", "info");
        } else {
            this._showToast("Game over", "info");
            this._updateLog();
        }
    },

    _showFoulOutPopup(title, message) {
        const overlay = document.getElementById("foulout-overlay");
        document.getElementById("foulout-title").textContent = title;
        document.getElementById("foulout-message").textContent = message;
        overlay.classList.add("visible");

        document.getElementById("foulout-dismiss").onclick = () => {
            overlay.classList.remove("visible");
        };

        // Auto-dismiss after 5 seconds
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
