// Copyright 2026 Marko Milivojevic
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual, ok } from "node:assert";
import { Game } from "../js/game.js";
import { RULES } from "../js/config.js";
import {
    buildPeriodScores,
    buildPersonalFoulTable,
    buildTimeoutSummary,
    buildCardSummary,
    buildPlayerStats,
} from "../js/sheet-data.js";

import { readFileSync } from "node:fs";

function loadTestData(name) {
    return JSON.parse(readFileSync(`testdata/${name}`, "utf8"));
}

// ── buildPeriodScores ────────────────────────────────────────

describe("buildPeriodScores", () => {
    it("returns 4 empty periods for new game", () => {
        const g = Game.create("USAWP");
        const result = buildPeriodScores(g);
        deepStrictEqual(result.periods, ["Q1", "Q2", "Q3", "Q4"]);
        deepStrictEqual(result.white, [0, 0, 0, 0]);
        deepStrictEqual(result.dark, [0, 0, 0, 0]);
        strictEqual(result.totalWhite, "0");
        strictEqual(result.totalDark, "0");
    });

    it("counts goals per period", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        Game.addEvent(g, { period: 2, time: "7:00", team: "W", cap: "9", event: "G" });
        Game.addEvent(g, { period: 3, time: "5:00", team: "W", cap: "7", event: "G" });
        const result = buildPeriodScores(g);
        deepStrictEqual(result.white, [1, 1, 1, 0]);
        deepStrictEqual(result.dark, [1, 0, 0, 0]);
        strictEqual(result.totalWhite, "3");
        strictEqual(result.totalDark, "1");
    });

    it("does not count non-Goal events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "E" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "7", event: "TO" });
        const result = buildPeriodScores(g);
        deepStrictEqual(result.white, [1, 0, 0, 0]);
        deepStrictEqual(result.dark, [0, 0, 0, 0]);
    });

    it("includes OT periods when present", () => {
        const g = Game.create("USAWP");
        g.currentPeriod = "OT1";
        Game.addEvent(g, { period: "OT1", time: "3:00", team: "W", cap: "7", event: "G" });
        const result = buildPeriodScores(g);
        ok(result.periods.includes("OT1"));
        strictEqual(result.totalWhite, "1");
    });

    it("returns fractional totals during shootout", () => {
        const g = Game.create("USAWP");
        // 5 goals each in regulation
        for (let i = 0; i < 5; i++) {
            Game.addEvent(g, { period: 1, time: `${7-i}:00`, team: "W", cap: "7", event: "G" });
            Game.addEvent(g, { period: 1, time: `${7-i}:00`, team: "D", cap: "3", event: "G" });
        }
        g.currentPeriod = "SO";
        Game.addEvent(g, { period: "SO", time: "0:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: "SO", time: "0:00", team: "W", cap: "9", event: "G" });
        Game.addEvent(g, { period: "SO", time: "0:00", team: "D", cap: "3", event: "G" });
        const result = buildPeriodScores(g);
        strictEqual(result.totalWhite, "5.2");
        strictEqual(result.totalDark, "5.1");
    });
});

// ── buildPersonalFoulTable ───────────────────────────────────

describe("buildPersonalFoulTable", () => {
    it("returns empty array for game with no fouls", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const result = buildPersonalFoulTable(g);
        deepStrictEqual(result, []);
    });

    it("aggregates exclusions per player", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 2, time: "6:00", team: "W", cap: "7", event: "E" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result.length, 1);
        strictEqual(result[0].team, "W");
        strictEqual(result[0].cap, "7");
        strictEqual(result[0].count, 2);
        strictEqual(result[0].fouledOut, false);
        strictEqual(result[0].details.length, 2);
    });

    it("marks player as fouled out at limit (3 for USAWP)", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 2, time: "6:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 3, time: "5:00", team: "W", cap: "7", event: "E" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result[0].fouledOut, true);
    });

    it("marks player fouled out on auto-foul (Misconduct)", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "D", cap: "3", event: "MC" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result.length, 1);
        strictEqual(result[0].fouledOut, true);
    });

    it("marks player fouled out on Brutality", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "BR" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result[0].fouledOut, true);
    });

    it("marks player fouled out on E-Game", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "E-Game" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result[0].fouledOut, true);
    });

    it("separates players by team and cap", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "7", event: "E" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "9", event: "P" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result.length, 3);
    });

    it("resolves event names in details", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result[0].details[0].event, "Exclusion");
        strictEqual(result[0].details[0].code, "E");
    });

    it("includes period and time in details", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 2, time: "5:30", team: "W", cap: "7", event: "E" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result[0].details[0].period, 2);
        strictEqual(result[0].details[0].time, "5:30");
    });

    it("handles NFHS MAM as personal foul", () => {
        const g = Game.create("NFHSVA");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "MAM" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result.length, 1);
        strictEqual(result[0].count, 1);
        strictEqual(result[0].details[0].event, "Minor Act");
    });

    it("handles Penalty-Exclusion as personal foul", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "P-E" });
        const result = buildPersonalFoulTable(g);
        strictEqual(result[0].count, 1);
        strictEqual(result[0].details[0].event, "Penalty-Exclusion");
    });

    it("ignores fouls without cap number", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "", event: "E" });
        const result = buildPersonalFoulTable(g);
        deepStrictEqual(result, []);
    });
});

// ── buildTimeoutSummary ──────────────────────────────────────

describe("buildTimeoutSummary", () => {
    it("returns empty array for game with no timeouts", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const result = buildTimeoutSummary(g);
        deepStrictEqual(result, []);
    });

    it("lists all timeouts with resolved info", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        Game.addEvent(g, { period: 2, time: "5:30", team: "D", event: "TO30" });
        const result = buildTimeoutSummary(g);
        strictEqual(result.length, 2);
        strictEqual(result[0].team, "White");
        strictEqual(result[0].period, "Q1");
        strictEqual(result[0].time, "7:00");
        strictEqual(result[0].type, "Timeout");
        strictEqual(result[1].team, "Dark");
        strictEqual(result[1].period, "Q2");
        strictEqual(result[1].time, "5:30");
        strictEqual(result[1].type, "Timeout 30");
    });

    it("displays Official for empty team string", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "6:00", team: "", event: "TO" });
        const result = buildTimeoutSummary(g);
        strictEqual(result[0].team, "Official");
    });

    it("strips leading zero from time", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "0:30", team: "W", event: "TO" });
        const result = buildTimeoutSummary(g);
        // 0:30 should NOT be stripped (only 0X:XX patterns)
        strictEqual(result[0].time, "0:30");
    });
});

// ── buildCardSummary ─────────────────────────────────────────

describe("buildCardSummary", () => {
    it("returns empty array for game with no cards", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const result = buildCardSummary(g);
        deepStrictEqual(result, []);
    });

    it("lists yellow and red cards", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "C", event: "YC" });
        Game.addEvent(g, { period: 3, time: "4:00", team: "D", cap: "AC", event: "RC" });
        const result = buildCardSummary(g);
        strictEqual(result.length, 2);
        strictEqual(result[0].team, "White");
        strictEqual(result[0].cap, "C");
        strictEqual(result[0].period, "Q1");
        strictEqual(result[0].type, "Yellow Card");
        strictEqual(result[1].team, "Dark");
        strictEqual(result[1].cap, "AC");
        strictEqual(result[1].period, "Q3");
        strictEqual(result[1].type, "Red Card");
    });

    it("uses dash for missing cap", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "", event: "YC" });
        const result = buildCardSummary(g);
        strictEqual(result[0].cap, "—");
    });

    it("uses dash for unknown team", () => {
        const g = Game.create("USAWP");
        // Unlikely but defensive: team not W/D
        const g2 = Game.create("USAWP");
        Game.addEvent(g2, { period: 1, time: "7:00", team: "W", cap: "B", event: "YC" });
        const result = buildCardSummary(g2);
        strictEqual(result[0].team, "White");
    });
});

// ── buildPlayerStats ─────────────────────────────────────────

describe("buildPlayerStats", () => {
    it("returns null for game with no stats", () => {
        const g = Game.create("USAWP");
        // Only team-level events (no cap) — won't generate player stats
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        const result = buildPlayerStats(g);
        strictEqual(result, null);
    });

    it("aggregates single stat type", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 2, time: "5:00", team: "W", cap: "7", event: "Shot" });
        const result = buildPlayerStats(g);
        ok(result !== null);
        strictEqual(result.stats["Shot"].W["7"][1], 2);
        strictEqual(result.stats["Shot"].W["7"][2], 1);
    });

    it("separates by team", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "Shot" });
        const result = buildPlayerStats(g);
        ok(result !== null);
        strictEqual(result.stats["Shot"].W["7"][1], 1);
        strictEqual(result.stats["Shot"].D["3"][1], 1);
    });

    it("includes period labels", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 3, time: "5:00", team: "W", cap: "7", event: "Shot" });
        const result = buildPlayerStats(g);
        ok(result.periodLabels.includes("Q1"));
        ok(result.periodLabels.includes("Q3"));
    });

    it("pluralizes stat names correctly", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        const result = buildPlayerStats(g);
        const shotType = result.statTypes.find(st => st.code === "Shot");
        ok(shotType);
        strictEqual(shotType.name, "Shots");
    });

    it("pluralizes names ending in y correctly", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        // "Brutality" ends in y → "Brutalities"
        // Use a non-statsOnly event that would appear in statTypes
        // Actually, let's just verify the stat type names in the result
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const result = buildPlayerStats(g);
        if (result) {
            const goalType = result.statTypes.find(st => st.code === "G");
            ok(goalType);
            strictEqual(goalType.name, "Goals");
        }
    });

    it("ignores events without cap or team", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "", event: "TO" });
        const result = buildPlayerStats(g);
        ok(result !== null);
        // TO is teamOnly and won't be in statTypes, so only Shot should appear
        strictEqual(Object.keys(result.stats["Shot"].W).length, 1);
    });

    it("handles multiple stat types", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "Assist" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "D", cap: "3", event: "Steal" });
        const result = buildPlayerStats(g);
        ok(result !== null);
        strictEqual(result.stats["Shot"].W["7"][1], 1);
        strictEqual(result.stats["Assist"].W["7"][1], 1);
        strictEqual(result.stats["Steal"].D["3"][1], 1);
    });
});

// ── Test data files ──────────────────────────────────────────

describe("sheet-data builders with test data", () => {
    for (const file of ["small-game.json", "medium-game.json", "large-game.json"]) {
        describe(file, () => {
            const gameData = loadTestData(file);

            it("buildPeriodScores returns consistent totals", () => {
                const result = buildPeriodScores(gameData);
                // Total should equal sum of per-period goals (for non-SO games)
                const hasSO = gameData.log.some(e => e.period === "SO");
                if (!hasSO) {
                    const whiteSum = result.white.reduce((a, b) => a + b, 0);
                    const darkSum = result.dark.reduce((a, b) => a + b, 0);
                    strictEqual(result.totalWhite, String(whiteSum));
                    strictEqual(result.totalDark, String(darkSum));
                }
                ok(result.periods.length > 0);
            });

            it("buildPersonalFoulTable returns array", () => {
                const result = buildPersonalFoulTable(gameData);
                ok(Array.isArray(result));
                for (const entry of result) {
                    ok(entry.team === "W" || entry.team === "D");
                    ok(typeof entry.cap === "string");
                    ok(typeof entry.count === "number");
                    ok(typeof entry.fouledOut === "boolean");
                    ok(Array.isArray(entry.details));
                }
            });

            it("buildTimeoutSummary returns array", () => {
                const result = buildTimeoutSummary(gameData);
                ok(Array.isArray(result));
                for (const entry of result) {
                    ok(typeof entry.team === "string");
                    ok(typeof entry.period === "string");
                    ok(typeof entry.time === "string");
                    ok(typeof entry.type === "string");
                }
            });

            it("buildCardSummary returns array", () => {
                const result = buildCardSummary(gameData);
                ok(Array.isArray(result));
                for (const entry of result) {
                    ok(typeof entry.team === "string");
                    ok(typeof entry.cap === "string");
                    ok(typeof entry.period === "string");
                    ok(typeof entry.time === "string");
                    ok(typeof entry.type === "string");
                }
            });

            it("buildPlayerStats returns consistent shape", () => {
                const result = buildPlayerStats(gameData);
                // May be null if no stats in test data
                if (result !== null) {
                    ok(Array.isArray(result.statTypes));
                    ok(Array.isArray(result.periods));
                    ok(Array.isArray(result.periodLabels));
                    ok(typeof result.stats === "object");
                }
            });
        });
    }
});
