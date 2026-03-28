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

// wplog — Game State Management

// Pure utility: format a fractional SO score (e.g., "5.3" for 5 total, 3 in SO).
export function formatFractionalScore(totalScore, soGoals) {
    return `${totalScore - soGoals}.${soGoals}`;
}

export const Game = {
    // Create a new game with defaults from rules
    create(rulesKey = "USAWP") {
        const rules = RULES[rulesKey];
        return {
            rules: rulesKey,
            date: new Date().toISOString().slice(0, 10),
            startTime: "",
            location: "",
            gameId: "",
            periodLength: rules.periodLength,
            otPeriodLength: rules.otPeriodLength,
            overtime: rules.overtime,
            shootout: rules.shootout,
            timeoutsAllowed: { full: rules.timeouts.full, to30: rules.timeouts.to30 },
            enableLog: true,
            enableStats: false,
            statsTimeMode: "off",
            white: { name: "White" },
            dark: { name: "Dark" },
            currentPeriod: 1,
            log: [],
            _nextId: 1,
            _nextSeq: 10,
        };
    },

    // Add an event to the game log
    addEvent(game, { period, time, team, cap, event, note }) {
        const rules = RULES[game.rules];
        const eventDef = rules.events.find((e) => e.code === event);
        const isStatsOnly = eventDef && eventDef.statsOnly;

        const score = this.getScore(game);
        let scoreW = score.white;
        let scoreD = score.dark;

        // Only count score for non-statsOnly Goal events
        if (event === "G" && !isStatsOnly) {
            if (team === "W") scoreW++;
            else scoreD++;
        }

        const entry = {
            id: game._nextId++,
            seq: game._nextSeq,
            deviceTime: new Date().toISOString(),
            period,
            time,
            team: team || "",
            cap: cap || "",
            event,
            scoreW,
            scoreD,
            note: note || "",
        };

        game._nextSeq += 10;
        game.log.push(entry);
        this._sortLog(game);
        this._recalcScores(game);
        return entry;
    },

    // Delete an event by ID and recalculate scores
    deleteEvent(game, eventId) {
        game.log = game.log.filter((e) => e.id !== eventId);
        this._recalcScores(game);
    },

    // Edit an existing event and recalculate scores
    editEvent(game, eventId, updates) {
        const entry = game.log.find((e) => e.id === eventId);
        if (!entry) return;
        Object.assign(entry, updates);
        this._sortLog(game);
        this._recalcScores(game);
    },

    // Sort events within each period by game time (descending).
    // Period End ("---") events always sort last within their period.
    // Equal times preserve entry order (stable sort by id).
    _sortLog(game) {
        // Build ordered list of unique periods as they appear
        const periodOrder = [];
        const periodMap = new Map();
        for (const entry of game.log) {
            const key = String(entry.period);
            if (!periodMap.has(key)) {
                periodOrder.push(key);
                periodMap.set(key, []);
            }
            periodMap.get(key).push(entry);
        }

        // Sort within each period
        for (const entries of periodMap.values()) {
            entries.sort((a, b) => {
                // Period End always last
                if (a.event === "---" && b.event !== "---") return 1;
                if (a.event !== "---" && b.event === "---") return -1;

                // Compare times descending (game clock counts down)
                if (a.time !== b.time) {
                    return a.time > b.time ? -1 : 1;
                }

                // Equal time: preserve entry order
                return a.id - b.id;
            });
        }

        // Reassemble log in period order
        game.log = periodOrder.flatMap(key => periodMap.get(key));
    },

    // Recalculate running scores for all events
    _recalcScores(game) {
        const rules = RULES[game.rules];
        let scoreW = 0;
        let scoreD = 0;
        for (const entry of game.log) {
            const eventDef = rules.events.find((e) => e.code === entry.event);
            const isStatsOnly = eventDef && eventDef.statsOnly;
            if (entry.event === "G" && !isStatsOnly) {
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

    // Get display-formatted score (fractional for SO)
    getDisplayScore(game) {
        const score = this.getScore(game);
        const soW = game.log.filter(e => e.event === "G" && e.team === "W" && e.period === "SO").length;
        const soD = game.log.filter(e => e.event === "G" && e.team === "D" && e.period === "SO").length;
        const inSO = game.currentPeriod === "SO" || soW > 0 || soD > 0;

        if (!inSO) return { white: String(score.white), dark: String(score.dark) };

        return {
            white: formatFractionalScore(score.white, soW),
            dark: formatFractionalScore(score.dark, soD),
        };
    },

    // Format score for a specific log entry (fractional for SO goals)
    formatEntryScore(entry, game) {
        if (entry.event !== "G") return "";
        const soW = game.log.filter(e => e.id <= entry.id && e.event === "G" && e.team === "W" && e.period === "SO").length;
        const soD = game.log.filter(e => e.id <= entry.id && e.event === "G" && e.team === "D" && e.period === "SO").length;
        if (soW === 0 && soD === 0) return entry.scoreW + "–" + entry.scoreD;
        return formatFractionalScore(entry.scoreW, soW) + "–" + formatFractionalScore(entry.scoreD, soD);
    },

    // Get timeouts used per team
    getTimeoutsUsed(game, team) {
        const full = game.log.filter((e) => e.event === "TO" && e.team === team).length;
        const to30 = game.log.filter((e) => e.event === "TO30" && e.team === team).length;
        return { full, to30 };
    },

    // Get timeouts remaining per team
    getTimeoutsLeft(game, team) {
        const used = this.getTimeoutsUsed(game, team);
        const allowed = game.timeoutsAllowed || { full: 0, to30: 0 };
        return {
            full: allowed.full === -1 ? Infinity : Math.max(0, allowed.full - used.full),
            to30: allowed.to30 === -1 ? Infinity : Math.max(0, allowed.to30 - used.to30),
        };
    },

    // Get personal fouls for a specific player (team + cap)
    getPlayerFouls(game, team, cap) {
        const rules = RULES[game.rules];
        const foulCodes = rules.events.filter(e => e.isPersonalFoul).map(e => e.code);
        return game.log.filter(
            (e) => e.team === team && e.cap === cap && foulCodes.includes(e.event)
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

        // Accumulated personal fouls
        if (eventDef && eventDef.isPersonalFoul) {
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
    // Returns: period value (advance), null (game over), or "TIED" (can't end, still tied)
    getNextPeriod(game) {
        const current = game.currentPeriod;
        const rules = RULES[game.rules];

        // Regulation periods (not last)
        if (typeof current === "number" && current < rules.periods) {
            return current + 1;
        }

        // End of regulation
        if (typeof current === "number" && current === rules.periods) {
            const score = this.getScore(game);
            if (score.white !== score.dark) return null; // not tied → game over
            if (game.overtime) return "OT1";
            if (game.shootout) return "SO";
            return null; // tied but no OT/SO → game over (allowed)
        }

        // Overtime (OT and SO are mutually exclusive)
        if (typeof current === "string" && current.startsWith("OT")) {
            const score = this.getScore(game);
            const otNum = parseInt(current.slice(2));

            // OT1 → OT2 always (mandatory pair)
            if (otNum === 1) return "OT2";

            if (score.white !== score.dark) return null; // not tied → game over

            // OT2+ tied → next OT (sudden victory, unlimited)
            const nextOt = otNum + 1;
            return "OT" + nextOt;
        }

        // Shootout
        if (current === "SO") {
            const score = this.getScore(game);
            if (score.white !== score.dark) return null; // not tied → game over
            return "TIED"; // tied in SO → can't end game
        }

        return null;
    },

    // Advance to next period
    advancePeriod(game) {
        const next = this.getNextPeriod(game);
        if (next !== null) {
            game.currentPeriod = next;
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
        // Only compare against timed events (skip stats without time)
        const timedEntries = game.log.filter((e) => e.period === period && e.event !== "---" && e.time);
        if (timedEntries.length === 0) return { valid: true };

        const lastEntry = timedEntries[timedEntries.length - 1];
        // Clock counts down: later events have lower time values
        if (time > lastEntry.time) {
            return {
                valid: false,
                warning: `This time (${time}) is before the previous entry (${lastEntry.time}) — are you sure?`,
            };
        }
        return { valid: true };
    },

    /**
     * Filter log events: exclude statsOnly events, keep period end markers.
     * Used by game sheet to show Progress of Game without stat-only entries.
     * @param {Array} log - Game log array
     * @param {Object} rules - Resolved rules object
     * @returns {Array} Filtered log entries
     */
    filterLogEvents(log, rules) {
        return log.filter((entry) => {
            if (entry.event === "---") return true;
            const eventDef = rules.events.find((e) => e.code === entry.event);
            return !eventDef || !eventDef.statsOnly;
        });
    },

    // ── Game Data Aggregation ────────────────────────────────

    /**
     * Build period-by-period goal counts for both teams.
     * @param {Object} game
     * @returns {{ periods: string[], white: number[], dark: number[], totalWhite: string, totalDark: string }}
     */
    buildPeriodScores(game) {
        const periods = this.getAllPeriods(game);
        const white = [];
        const dark = [];

        for (const period of periods) {
            const wGoals = game.log.filter(
                (e) => e.event === "G" && e.team === "W" && e.period === period
            ).length;
            const dGoals = game.log.filter(
                (e) => e.event === "G" && e.team === "D" && e.period === period
            ).length;
            white.push(wGoals);
            dark.push(dGoals);
        }

        const displayScore = this.getDisplayScore(game);
        return {
            periods: periods.map((p) => this.getPeriodLabel(p)),
            white,
            dark,
            totalWhite: displayScore.white,
            totalDark: displayScore.dark,
        };
    },

    /**
     * Build personal foul table: per-player foul details + fouled-out flag.
     * @param {Object} game
     * @returns {Array<{ team: string, cap: string, count: number, fouledOut: boolean, details: Array }>}
     */
    buildPersonalFoulTable(game) {
        const rules = RULES[game.rules];
        const foulCodes = rules.events
            .filter((e) => e.isPersonalFoul || e.autoFoulOut)
            .map((e) => e.code);

        const playerFouls = {};

        for (const entry of game.log) {
            if (foulCodes.includes(entry.event) && entry.cap) {
                const key = entry.team + "#" + entry.cap;
                if (!playerFouls[key]) {
                    playerFouls[key] = { team: entry.team, cap: entry.cap, fouls: [] };
                }
                const eventDef = rules.events.find((e) => e.code === entry.event);
                playerFouls[key].fouls.push({
                    period: entry.period,
                    time: entry.time,
                    event: eventDef ? eventDef.name : entry.event,
                    code: entry.event,
                });
            }
        }

        const result = [];
        for (const [, player] of Object.entries(playerFouls)) {
            const personalFoulCount = player.fouls.filter((f) => {
                const def = rules.events.find((e) => e.name === f.event);
                return def && def.isPersonalFoul;
            }).length;
            // Check auto-foul-out: group fouls by event code, check if any event's
            // occurrence count meets or exceeds its autoFoulOut threshold.
            // autoFoulOut: 1 = immediate (MC, BR, E-Game, FM)
            // autoFoulOut: 2 = 2nd occurrence (MAM in NFHS)
            let hasAutoFoulOut = false;
            const foulsByCode = {};
            for (const f of player.fouls) {
                foulsByCode[f.code] = (foulsByCode[f.code] || 0) + 1;
            }
            for (const [code, count] of Object.entries(foulsByCode)) {
                const def = rules.events.find((e) => e.code === code);
                if (def && def.autoFoulOut && count >= def.autoFoulOut) {
                    hasAutoFoulOut = true;
                    break;
                }
            }
            const fouledOut = personalFoulCount >= rules.foulOutLimit || hasAutoFoulOut;

            result.push({
                team: player.team,
                cap: player.cap,
                count: player.fouls.length,
                fouledOut,
                details: player.fouls.map((f) => ({
                    period: f.period,
                    time: f.time,
                    event: f.event,
                    code: f.code,
                })),
            });
        }
        return result;
    },

    /**
     * Build timeout summary: list of all TO/TO30 events with display info.
     * @param {Object} game
     * @returns {Array<{ team: string, period: string, time: string, type: string }>}
     */
    buildTimeoutSummary(game) {
        const rules = RULES[game.rules];
        const timeouts = game.log.filter((e) => e.event === "TO" || e.event === "TO30");

        return timeouts.map((entry) => {
            const eventDef = rules.events.find((e) => e.code === entry.event);
            const team = entry.team === "W" ? "White"
                : entry.team === "D" ? "Dark"
                : entry.team === "" ? "Official"
                : "—";
            return {
                team,
                period: this.getPeriodLabel(entry.period),
                time: entry.time.replace(/^0(\d:)/, "$1"),
                type: eventDef ? eventDef.name : entry.event,
            };
        });
    },

    /**
     * Build card summary: list of all YC/RC events with display info.
     * @param {Object} game
     * @returns {Array<{ team: string, cap: string, period: string, time: string, type: string }>}
     */
    buildCardSummary(game) {
        const rules = RULES[game.rules];
        const cards = game.log.filter((e) => e.event === "YC" || e.event === "RC");

        return cards.map((entry) => {
            const eventDef = rules.events.find((e) => e.code === entry.event);
            return {
                team: entry.team === "W" ? "White" : entry.team === "D" ? "Dark" : "—",
                cap: entry.cap || "—",
                period: this.getPeriodLabel(entry.period),
                time: entry.time.replace(/^0(\d:)/, "$1"),
                type: eventDef ? eventDef.name : entry.event,
            };
        });
    },

    /**
     * Build player stats: per-cap, per-stat counts grouped by team.
     * @param {Object} game
     * @returns {{ statTypes: Array, activeStatCodes: Array, activePeriods: Array, stats: Object, totals: Object, statsPerPeriod: Object, totalsPerPeriod: Object } | null}
     */
    buildPlayerStats(game) {
        const rules = RULES[game.rules];
        const statTypes = rules.events
            .filter((e) => !e.teamOnly && (game.enableStats || !e.statsOnly))
            .map((e) => ({ code: e.code, name: e.name }));

        const activeStatCodesSet = new Set();
        const stats = { W: {}, D: {} };
        const totals = { W: {}, D: {} };
        const statsPerPeriod = { W: {}, D: {} };
        const totalsPerPeriod = { W: {}, D: {} };

        for (const entry of game.log) {
            if (!entry.cap || !entry.team) continue;
            if (!statTypes.some(st => st.code === entry.event)) continue;

            const team = entry.team;
            if (team !== "W" && team !== "D") continue;

            if (!stats[team][entry.cap]) {
                stats[team][entry.cap] = {};
                statsPerPeriod[team][entry.cap] = {};
            }
            if (!statsPerPeriod[team][entry.cap][entry.event]) {
                statsPerPeriod[team][entry.cap][entry.event] = {};
            }
            if (!totalsPerPeriod[team][entry.event]) {
                totalsPerPeriod[team][entry.event] = {};
            }

            const periodStr = this.getPeriodLabel(entry.period);

            stats[team][entry.cap][entry.event] = (stats[team][entry.cap][entry.event] || 0) + 1;
            totals[team][entry.event] = (totals[team][entry.event] || 0) + 1;

            statsPerPeriod[team][entry.cap][entry.event][periodStr] = (statsPerPeriod[team][entry.cap][entry.event][periodStr] || 0) + 1;
            totalsPerPeriod[team][entry.event][periodStr] = (totalsPerPeriod[team][entry.event][periodStr] || 0) + 1;

            activeStatCodesSet.add(entry.event);
        }

        if (activeStatCodesSet.size === 0) return null;

        // Print ALL available stats all the time for consistent layout and muscle memory
        const activeStatCodes = statTypes.map(st => st.code);
        
        // Active periods for headers
        const activePeriods = this.getAllPeriods(game).map(p => this.getPeriodLabel(p));

        return {
            statTypes,
            activeStatCodes,
            activePeriods,
            stats,
            totals,
            statsPerPeriod,
            totalsPerPeriod,
        };
    },
};
