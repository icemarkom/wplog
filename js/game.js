// wplog — Game State Management

const Game = {
    // Create a new game with defaults from rules
    create(rulesKey = "USAWP") {
        const rules = RULES[rulesKey];
        return {
            rules: rulesKey,
            date: new Date().toISOString().slice(0, 10),
            startTime: "",
            location: "",
            overtime: rules.overtime,
            shootout: rules.shootout,
            white: { name: "White" },
            dark: { name: "Dark" },
            currentPeriod: 1,
            log: [],
            _nextId: 1,
        };
    },

    // Add an event to the game log
    addEvent(game, { period, time, team, cap, event, note }) {
        const score = this.getScore(game);
        let scoreW = score.white;
        let scoreD = score.dark;

        if (event === "G") {
            if (team === "W") scoreW++;
            else scoreD++;
        }

        const entry = {
            id: game._nextId++,
            period,
            time,
            team: team || "",
            cap: cap || "",
            event,
            scoreW,
            scoreD,
            note: note || "",
        };

        game.log.push(entry);
        Storage.save(game);
        return entry;
    },

    // Delete an event by ID and recalculate scores
    deleteEvent(game, eventId) {
        game.log = game.log.filter((e) => e.id !== eventId);
        this._recalcScores(game);
        Storage.save(game);
    },

    // Edit an existing event and recalculate scores
    editEvent(game, eventId, updates) {
        const entry = game.log.find((e) => e.id === eventId);
        if (!entry) return;
        Object.assign(entry, updates);
        this._recalcScores(game);
        Storage.save(game);
    },

    // Recalculate running scores for all events
    _recalcScores(game) {
        let scoreW = 0;
        let scoreD = 0;
        for (const entry of game.log) {
            if (entry.event === "G") {
                if (entry.team === "W") scoreW++;
                else scoreD++;
            }
            entry.scoreW = scoreW;
            entry.scoreD = scoreD;
        }
    },

    // Get current score
    getScore(game) {
        if (game.log.length === 0) return { white: 0, dark: 0 };
        const last = game.log[game.log.length - 1];
        return { white: last.scoreW, dark: last.scoreD };
    },

    // Get personal fouls for a specific player (team + cap)
    getPlayerFouls(game, team, cap) {
        return game.log.filter(
            (e) => e.team === team && e.cap === cap && e.event === "E"
        ).length;
    },

    // Get count of a specific event type for a player
    getPlayerEventCount(game, team, cap, eventCode) {
        return game.log.filter(
            (e) => e.team === team && e.cap === cap && e.event === eventCode
        ).length;
    },

    // Check if logging this event should trigger a foul-out
    checkFoulOut(game, team, cap, eventCode) {
        const rules = RULES[game.rules];
        const eventDef = rules.events.find((e) => e.code === eventCode);
        if (!eventDef) return null;

        // Auto foul-out events
        if (eventDef.autoFoulOut) {
            const count = this.getPlayerEventCount(game, team, cap, eventCode);
            // count is BEFORE adding this event, so +1
            if (count + 1 >= eventDef.autoFoulOut) {
                return {
                    type: "auto",
                    event: eventDef.name,
                    count: count + 1,
                };
            }
        }

        // Accumulated exclusion fouls
        if (eventCode === "E") {
            const fouls = this.getPlayerFouls(game, team, cap);
            if (fouls + 1 >= rules.foulOutLimit) {
                return {
                    type: "accumulated",
                    count: fouls + 1,
                    limit: rules.foulOutLimit,
                };
            }
        }

        return null;
    },

    // Get the next period value
    getNextPeriod(game) {
        const current = game.currentPeriod;
        const rules = RULES[game.rules];

        // Regulation periods
        if (typeof current === "number" && current < rules.periods) {
            return current + 1;
        }

        // End of regulation → overtime or shootout
        if (typeof current === "number" && current === rules.periods) {
            if (game.overtime) return "OT1";
            if (game.shootout) return "SO";
            return null; // game over
        }

        // Overtime → next OT or shootout
        if (typeof current === "string" && current.startsWith("OT")) {
            const otNum = parseInt(current.slice(2));
            return "OT" + (otNum + 1); // unlimited OT
        }

        return null; // SO or unknown → game over
    },

    // Advance to next period
    advancePeriod(game) {
        const next = this.getNextPeriod(game);
        if (next !== null) {
            game.currentPeriod = next;
            Storage.save(game);
        }
        return next;
    },

    // Get period display label
    getPeriodLabel(period) {
        if (typeof period === "number") return "Q" + period;
        return period; // "OT1", "OT2", "SO" etc.
    },

    // Get all unique periods that have log entries
    getActivePeriods(game) {
        const periods = new Set();
        for (const entry of game.log) {
            periods.add(entry.period);
        }
        return [...periods];
    },

    // Get all periods that should show as tabs
    getAllPeriods(game) {
        const rules = RULES[game.rules];
        const periods = [];

        // Regulation
        for (let i = 1; i <= rules.periods; i++) {
            periods.push(i);
        }

        // OT periods (from log or current)
        const activeOTs = game.log
            .filter((e) => typeof e.period === "string" && e.period.startsWith("OT"))
            .map((e) => e.period);

        if (typeof game.currentPeriod === "string" && game.currentPeriod.startsWith("OT")) {
            activeOTs.push(game.currentPeriod);
        }

        const uniqueOTs = [...new Set(activeOTs)].sort();
        periods.push(...uniqueOTs);

        // SO
        const hasSO = game.log.some((e) => e.period === "SO") || game.currentPeriod === "SO";
        if (hasSO) {
            periods.push("SO");
        }

        return periods;
    },

    // Validate time entry (warn if time is after previous entry in same period)
    validateTime(game, period, time) {
        const periodEntries = game.log.filter((e) => e.period === period && e.event !== "---");
        if (periodEntries.length === 0) return { valid: true };

        const lastEntry = periodEntries[periodEntries.length - 1];
        // Clock counts down: later events have lower time values
        if (time > lastEntry.time) {
            return {
                valid: false,
                warning: `This time (${time}) is before the previous entry (${lastEntry.time}) — are you sure?`,
            };
        }
        return { valid: true };
    },
};
