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

// wplog — Sheet Data Builders (Pure)
// Extracts game data aggregation from sheet.js render methods.
// All functions are pure: game object in → plain data out. No DOM.

import { RULES } from './config.js';
import { Game } from './game.js';

/**
 * Build period-by-period goal counts for both teams.
 * @param {Object} game
 * @returns {{ periods: string[], white: number[], dark: number[], totalWhite: string, totalDark: string }}
 */
export function buildPeriodScores(game) {
    const periods = Game.getAllPeriods(game);
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

    const displayScore = Game.getDisplayScore(game);
    return {
        periods: periods.map((p) => Game.getPeriodLabel(p)),
        white,
        dark,
        totalWhite: displayScore.white,
        totalDark: displayScore.dark,
    };
}

/**
 * Build personal foul table: per-player foul details + fouled-out flag.
 * @param {Object} game
 * @returns {Array<{ team: string, cap: string, count: number, fouledOut: boolean, details: Array<{ period: string|number, time: string, event: string, code: string }> }>}
 */
export function buildPersonalFoulTable(game) {
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
        const hasAutoFoulOut = player.fouls.some((f) => {
            const def = rules.events.find((e) => e.name === f.event);
            return def && def.autoFoulOut;
        });
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
}

/**
 * Build timeout summary: list of all TO/TO30 events with display info.
 * @param {Object} game
 * @returns {Array<{ team: string, period: string, time: string, type: string }>}
 */
export function buildTimeoutSummary(game) {
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
            period: Game.getPeriodLabel(entry.period),
            time: entry.time.replace(/^0(\d:)/, "$1"),
            type: eventDef ? eventDef.name : entry.event,
        };
    });
}

/**
 * Build card summary: list of all YC/RC events with display info.
 * @param {Object} game
 * @returns {Array<{ team: string, cap: string, period: string, time: string, type: string }>}
 */
export function buildCardSummary(game) {
    const rules = RULES[game.rules];
    const cards = game.log.filter((e) => e.event === "YC" || e.event === "RC");

    return cards.map((entry) => {
        const eventDef = rules.events.find((e) => e.code === entry.event);
        return {
            team: entry.team === "W" ? "White" : entry.team === "D" ? "Dark" : "—",
            cap: entry.cap || "—",
            period: Game.getPeriodLabel(entry.period),
            time: entry.time.replace(/^0(\d:)/, "$1"),
            type: eventDef ? eventDef.name : entry.event,
        };
    });
}

/**
 * Build player stats: per-stat-type, per-cap, per-period counts.
 * @param {Object} game
 * @returns {{ statTypes: Array<{ code: string, name: string }>, periods: Array<string|number>, stats: Object<string, { W: Object, D: Object }> } | null}
 *   Returns null if no stats are recorded.
 */
export function buildPlayerStats(game) {
    const rules = RULES[game.rules];
    const statTypes = rules.events
        .filter((e) => !e.teamOnly)
        .map((e) => {
            const n = e.name;
            const plural = n.endsWith("y") ? n.slice(0, -1) + "ies" : n + "s";
            return { code: e.code, name: plural };
        });

    // Ordered periods from log
    const periodOrder = [];
    const periodSeen = new Set();
    for (const entry of game.log) {
        if (entry.event === "---") continue;
        if (!periodSeen.has(entry.period)) {
            periodSeen.add(entry.period);
            periodOrder.push(entry.period);
        }
    }

    // Aggregate counts: stats[code][team][cap][period] = count
    const stats = {};
    for (const st of statTypes) {
        stats[st.code] = { W: {}, D: {} };
    }
    for (const entry of game.log) {
        if (!entry.cap || !entry.team) continue;
        if (!stats[entry.event]) continue;
        const teamData = stats[entry.event][entry.team];
        if (!teamData[entry.cap]) teamData[entry.cap] = {};
        teamData[entry.cap][entry.period] = (teamData[entry.cap][entry.period] || 0) + 1;
    }

    // Check if any stats exist
    let anyStats = false;
    for (const st of statTypes) {
        if (Object.keys(stats[st.code].W).length > 0 || Object.keys(stats[st.code].D).length > 0) {
            anyStats = true;
            break;
        }
    }
    if (!anyStats) return null;

    return {
        statTypes,
        periods: periodOrder,
        periodLabels: periodOrder.map((p) => Game.getPeriodLabel(p)),
        stats,
    };
}
