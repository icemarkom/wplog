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
import { readFileSync } from "node:fs";
import { Game, formatFractionalScore } from "../js/game.js";
import { RULES } from "../js/config.js";

function loadTestData(name) {
    return JSON.parse(readFileSync(`testdata/${name}`, "utf8"));
}

// All public rule sets — tests iterate over these.
const publicKeys = Object.keys(RULES).filter(k => !k.startsWith("_"));

// ── Game.create ──────────────────────────────────────────────

describe("Game.create", () => {
    for (const key of publicKeys) {
        describe(`${key}`, () => {
            const rules = RULES[key];
            const g = Game.create(key);

            it("sets rules key", () => strictEqual(g.rules, key));

            it("uses config periodLength", () => {
                strictEqual(g.periodLength, rules.periodLength);
            });

            it("uses config overtime", () => {
                strictEqual(g.overtime, rules.overtime);
            });

            it("uses config shootout", () => {
                strictEqual(g.shootout, rules.shootout);
            });

            it("starts at period 1", () => {
                strictEqual(g.currentPeriod, 1);
            });

            it("starts with empty log", () => {
                deepStrictEqual(g.log, []);
                strictEqual(g._nextId, 1);
                strictEqual(g._nextSeq, 10);
            });

            if (rules.overtime) {
                it("uses config otPeriodLength when OT enabled", () => {
                    strictEqual(g.otPeriodLength, rules.otPeriodLength);
                });
            }
        });
    }

    it("defaults to USAWP when no argument given", () => {
        const g = Game.create();
        strictEqual(g.rules, "USAWP");
    });

    it("sets today's date", () => {
        const g = Game.create(publicKeys[0]);
        const today = new Date().toISOString().slice(0, 10);
        strictEqual(g.date, today);
    });

    it("starts with default team names", () => {
        const g = Game.create(publicKeys[0]);
        deepStrictEqual(g.white, { name: "White" });
        deepStrictEqual(g.dark, { name: "Dark" });
    });

    it("starts with logging enabled and stats disabled", () => {
        const g = Game.create(publicKeys[0]);
        strictEqual(g.enableLog, true);
        strictEqual(g.enableStats, false);
        strictEqual(g.statsTimeMode, "off");
    });
});

// ── Game.addEvent ────────────────────────────────────────────

describe("Game.addEvent", () => {
    it("adds a Goal event and increments score for white", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        strictEqual(g.log.length, 1);
        strictEqual(g.log[0].scoreW, 1);
        strictEqual(g.log[0].scoreD, 0);
    });

    it("adds a Goal event and increments score for dark", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "D", cap: "3", event: "G" });
        strictEqual(g.log[0].scoreW, 0);
        strictEqual(g.log[0].scoreD, 1);
    });

    it("accumulates score across multiple goals", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "9", event: "G" });
        strictEqual(g.log[2].scoreW, 2);
        strictEqual(g.log[2].scoreD, 1);
    });

    it("does not change score for non-Goal events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "E" });
        strictEqual(g.log[1].scoreW, 1);
        strictEqual(g.log[1].scoreD, 0);
    });

    it("assigns sequential ids", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        strictEqual(g.log[0].id, 1);
        strictEqual(g.log[1].id, 2);
    });

    it("assigns seq in increments of 10", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        strictEqual(g.log[0].seq, 10);
        strictEqual(g.log[1].seq, 20);
    });

    it("stores deviceTime as ISO string", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        ok(g.log[0].deviceTime.match(/^\d{4}-\d{2}-\d{2}T/));
    });

    it("defaults team and cap to empty string when missing", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "0:00", event: "---" });
        strictEqual(g.log[0].team, "");
        strictEqual(g.log[0].cap, "");
    });

    it("does not count statsOnly Goals toward score", () => {
        const g = Game.create("USAWP");
        // Shot is statsOnly — even though we hypothetically pass "G",
        // if event is "Shot" (statsOnly), score should not change.
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        strictEqual(g.log[0].scoreW, 0);
        strictEqual(g.log[0].scoreD, 0);
    });
});

// ── Game.getScore ────────────────────────────────────────────

describe("Game.getScore", () => {
    it("returns 0-0 for empty game", () => {
        const g = Game.create("USAWP");
        const score = Game.getScore(g);
        strictEqual(score.white, 0);
        strictEqual(score.dark, 0);
    });

    it("counts goals correctly", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "9", event: "G" });
        const score = Game.getScore(g);
        strictEqual(score.white, 2);
        strictEqual(score.dark, 1);
    });

    it("does not count non-Goal events in score", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "E" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "9", event: "TO" });
        const score = Game.getScore(g);
        strictEqual(score.white, 1);
        strictEqual(score.dark, 0);
    });

    it("does not count statsOnly events in score", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "Assist" });
        const score = Game.getScore(g);
        strictEqual(score.white, 0);
        strictEqual(score.dark, 0);
    });
});

// ── Game.getPersonalFouls ────────────────────────────────────

describe("Game.getPlayerFouls", () => {
    it("counts Exclusions as personal fouls", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "E" });
        const fouls = Game.getPlayerFouls(g, "W", "7");
        strictEqual(fouls, 2);
    });

    it("counts Penalties as personal fouls", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "D", cap: "3", event: "P" });
        const fouls = Game.getPlayerFouls(g, "D", "3");
        strictEqual(fouls, 1);
    });

    it("counts P-E as personal foul", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "P-E" });
        const fouls = Game.getPlayerFouls(g, "W", "5");
        strictEqual(fouls, 1);
    });

    it("does not count Goals as personal fouls", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const fouls = Game.getPlayerFouls(g, "W", "7");
        strictEqual(fouls, 0);
    });

    it("counts MAM as personal foul in NFHS", () => {
        const g = Game.create("NFHSVA");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "MAM" });
        const fouls = Game.getPlayerFouls(g, "W", "7");
        strictEqual(fouls, 1);
    });

    it("separates fouls by team and cap", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "7", event: "E" });
        strictEqual(Game.getPlayerFouls(g, "W", "7"), 1);
        strictEqual(Game.getPlayerFouls(g, "D", "7"), 1);
    });
});

// ── Game.deleteEvent ─────────────────────────────────────────

describe("Game.deleteEvent", () => {
    it("removes an event by id", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        Game.deleteEvent(g, 1);
        strictEqual(g.log.length, 1);
        strictEqual(g.log[0].id, 2);
    });

    it("recalculates scores after deletion", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "9", event: "G" });
        // Delete the first goal (W), score should become W:1 D:1
        Game.deleteEvent(g, 1);
        const score = Game.getScore(g);
        strictEqual(score.white, 1);
        strictEqual(score.dark, 1);
    });

    it("does nothing when id doesn't exist", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.deleteEvent(g, 999);
        strictEqual(g.log.length, 1);
    });
});

// ── Game.getDisplayScore ─────────────────────────────────────

describe("Game.getDisplayScore", () => {
    it("returns string scores for regulation", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const display = Game.getDisplayScore(g);
        strictEqual(display.white, "1");
        strictEqual(display.dark, "0");
    });

    it("returns fractional scores during shootout", () => {
        const g = Game.create("USAWP");
        // 5 regulation goals each
        for (let i = 0; i < 5; i++) {
            Game.addEvent(g, { period: 1, time: `${7-i}:00`, team: "W", cap: "7", event: "G" });
            Game.addEvent(g, { period: 1, time: `${7-i}:00`, team: "D", cap: "3", event: "G" });
        }
        g.currentPeriod = "SO";
        // 2 SO goals for W, 1 for D
        Game.addEvent(g, { period: "SO", time: "0:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: "SO", time: "0:00", team: "W", cap: "9", event: "G" });
        Game.addEvent(g, { period: "SO", time: "0:00", team: "D", cap: "3", event: "G" });
        const display = Game.getDisplayScore(g);
        strictEqual(display.white, "5.2");
        strictEqual(display.dark, "5.1");
    });

    it("returns plain scores when not in shootout", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 2, time: "6:00", team: "D", cap: "3", event: "G" });
        const display = Game.getDisplayScore(g);
        strictEqual(display.white, "1");
        strictEqual(display.dark, "1");
    });
});

// ── Game.formatEntryScore ────────────────────────────────────

describe("Game.formatEntryScore", () => {
    it("returns score string for Goal events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const formatted = Game.formatEntryScore(g.log[0], g);
        strictEqual(formatted, "1–0");
    });

    it("returns empty string for non-Goal events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        strictEqual(Game.formatEntryScore(g.log[0], g), "");
    });

    it("returns fractional score for SO goals", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: "SO", time: "0:00", team: "W", cap: "9", event: "G" });
        const formatted = Game.formatEntryScore(g.log[1], g);
        strictEqual(formatted, "1.1–0.0");
    });
});

// ── formatFractionalScore ─────────────────────────────────────────

describe("formatFractionalScore", () => {
    it("formats typical SO score", () => {
        strictEqual(formatFractionalScore(5, 3), "2.3");
    });

    it("formats zero SO goals", () => {
        strictEqual(formatFractionalScore(4, 0), "4.0");
    });

    it("formats all goals from SO", () => {
        strictEqual(formatFractionalScore(3, 3), "0.3");
    });

    it("formats single SO goal", () => {
        strictEqual(formatFractionalScore(7, 1), "6.1");
    });

    it("formats zero total and zero SO", () => {
        strictEqual(formatFractionalScore(0, 0), "0.0");
    });
});

// ── Game.getTimeoutsUsed / getTimeoutsLeft ───────────────────

describe("Game.getTimeoutsUsed", () => {
    it("counts full timeouts per team", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", event: "TO" });
        Game.addEvent(g, { period: 2, time: "5:00", team: "W", event: "TO" });
        strictEqual(Game.getTimeoutsUsed(g, "W").full, 2);
        strictEqual(Game.getTimeoutsUsed(g, "D").full, 1);
    });

    it("counts TO30 separately", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", event: "TO30" });
        const used = Game.getTimeoutsUsed(g, "W");
        strictEqual(used.full, 1);
        strictEqual(used.to30, 1);
    });

    it("returns 0 when no timeouts taken", () => {
        const g = Game.create("USAWP");
        const used = Game.getTimeoutsUsed(g, "W");
        strictEqual(used.full, 0);
        strictEqual(used.to30, 0);
    });
});

describe("Game.getTimeoutsLeft", () => {
    it("subtracts used from allowed", () => {
        const g = Game.create("USAWP");
        g.timeoutsAllowed = { full: 2, to30: 1 };
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        const left = Game.getTimeoutsLeft(g, "W");
        strictEqual(left.full, 1);
        strictEqual(left.to30, 1);
    });

    it("never goes below 0", () => {
        const g = Game.create("USAWP");
        g.timeoutsAllowed = { full: 1, to30: 0 };
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        Game.addEvent(g, { period: 2, time: "6:00", team: "W", event: "TO" });
        const left = Game.getTimeoutsLeft(g, "W");
        strictEqual(left.full, 0);
    });

    it("returns Infinity for unlimited (-1)", () => {
        const g = Game.create("USAWP");
        g.timeoutsAllowed = { full: -1, to30: -1 };
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        const left = Game.getTimeoutsLeft(g, "W");
        strictEqual(left.full, Infinity);
        strictEqual(left.to30, Infinity);
    });
});

// ── Game.getPlayerEventCount ─────────────────────────────────

describe("Game.getPlayerEventCount", () => {
    it("counts specific event type for a player", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "7", event: "E" });
        strictEqual(Game.getPlayerEventCount(g, "W", "7", "E"), 2);
        strictEqual(Game.getPlayerEventCount(g, "W", "7", "G"), 1);
    });

    it("returns 0 for no matching events", () => {
        const g = Game.create("USAWP");
        strictEqual(Game.getPlayerEventCount(g, "W", "7", "E"), 0);
    });
});

// ── Game.checkFoulOut ────────────────────────────────────────

describe("Game.checkFoulOut", () => {
    it("returns null when no foul-out", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        const result = Game.checkFoulOut(g, "W", "7", "E");
        strictEqual(result, null);
    });

    it("triggers accumulated foul-out at limit (3 for USAWP)", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "E" });
        // 2 existing + 1 new = 3 = foulOutLimit
        const result = Game.checkFoulOut(g, "W", "7", "E");
        ok(result, "should trigger foul-out");
        strictEqual(result.type, "accumulated");
        strictEqual(result.count, 3);
    });

    it("triggers auto foul-out on first Misconduct", () => {
        const g = Game.create("USAWP");
        const result = Game.checkFoulOut(g, "W", "7", "MC");
        ok(result, "should trigger foul-out");
        strictEqual(result.type, "auto");
    });

    it("triggers auto foul-out on first Brutality", () => {
        const g = Game.create("USAWP");
        const result = Game.checkFoulOut(g, "W", "7", "BR");
        ok(result, "should trigger foul-out");
        strictEqual(result.type, "auto");
    });

    it("triggers auto foul-out on first E-Game", () => {
        const g = Game.create("USAWP");
        const result = Game.checkFoulOut(g, "W", "7", "E-Game");
        ok(result, "should trigger foul-out");
        strictEqual(result.type, "auto");
    });

    it("does not trigger on first MAM in NFHS (autoFoulOut: 2)", () => {
        const g = Game.create("NFHSVA");
        const result = Game.checkFoulOut(g, "W", "7", "MAM");
        strictEqual(result, null);
    });

    it("triggers auto foul-out on second MAM in NFHS", () => {
        const g = Game.create("NFHSVA");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "MAM" });
        const result = Game.checkFoulOut(g, "W", "7", "MAM");
        ok(result, "should trigger foul-out");
        strictEqual(result.type, "auto");
    });

    it("triggers FM foul-out on first occurrence in NFHS", () => {
        const g = Game.create("NFHSVA");
        const result = Game.checkFoulOut(g, "W", "7", "FM");
        ok(result, "should trigger foul-out");
        strictEqual(result.type, "auto");
    });

    it("returns null for non-foul events", () => {
        const g = Game.create("USAWP");
        strictEqual(Game.checkFoulOut(g, "W", "7", "G"), null);
        strictEqual(Game.checkFoulOut(g, "W", "7", "TO"), null);
    });

    it("returns null for unknown event codes", () => {
        const g = Game.create("USAWP");
        strictEqual(Game.checkFoulOut(g, "W", "7", "FAKE"), null);
    });
});

// ── Game.getNextPeriod ───────────────────────────────────────

describe("Game.getNextPeriod", () => {
    for (const key of publicKeys) {
        const rules = RULES[key];
        const lastPeriod = rules.periods;

        describe(`${key} (${lastPeriod} periods)`, () => {
            it("advances non-final regulation period", () => {
                const g = Game.create(key);
                g.currentPeriod = 1;
                strictEqual(Game.getNextPeriod(g), 2);
            });

            it("ends game after last regulation period when not tied", () => {
                const g = Game.create(key);
                g.currentPeriod = lastPeriod;
                Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
                strictEqual(Game.getNextPeriod(g), null);
            });

            if (rules.overtime) {
                it("goes to OT1 after last period when tied", () => {
                    const g = Game.create(key);
                    g.currentPeriod = lastPeriod;
                    strictEqual(Game.getNextPeriod(g), "OT1");
                });
            }

            if (rules.shootout) {
                it("goes to SO after last period when tied", () => {
                    const g = Game.create(key);
                    g.currentPeriod = lastPeriod;
                    strictEqual(Game.getNextPeriod(g), "SO");
                });
            }

            if (!rules.overtime && !rules.shootout) {
                it("ends game after last period even when tied", () => {
                    const g = Game.create(key);
                    g.currentPeriod = lastPeriod;
                    strictEqual(Game.getNextPeriod(g), null);
                });
            }
        });
    }

    // OT/SO logic (rule-set independent)
    it("OT1 always advances to OT2 (mandatory pair)", () => {
        const otKey = publicKeys.find(k => RULES[k].overtime);
        if (!otKey) return;
        const g = Game.create(otKey);
        g.currentPeriod = "OT1";
        strictEqual(Game.getNextPeriod(g), "OT2");
    });

    it("ends game after OT2 when not tied", () => {
        const otKey = publicKeys.find(k => RULES[k].overtime);
        if (!otKey) return;
        const g = Game.create(otKey);
        g.currentPeriod = "OT2";
        Game.addEvent(g, { period: "OT1", time: "3:00", team: "W", cap: "7", event: "G" });
        strictEqual(Game.getNextPeriod(g), null);
    });

    it("goes to OT3 after OT2 when still tied", () => {
        const otKey = publicKeys.find(k => RULES[k].overtime);
        if (!otKey) return;
        const g = Game.create(otKey);
        g.currentPeriod = "OT2";
        strictEqual(Game.getNextPeriod(g), "OT3");
    });

    it("returns TIED in SO when score is tied", () => {
        const soKey = publicKeys.find(k => RULES[k].shootout);
        if (!soKey) return;
        const g = Game.create(soKey);
        g.currentPeriod = "SO";
        strictEqual(Game.getNextPeriod(g), "TIED");
    });

    it("ends game in SO when not tied", () => {
        const soKey = publicKeys.find(k => RULES[k].shootout);
        if (!soKey) return;
        const g = Game.create(soKey);
        g.currentPeriod = "SO";
        Game.addEvent(g, { period: "SO", time: "0:00", team: "W", cap: "7", event: "G" });
        strictEqual(Game.getNextPeriod(g), null);
    });
});

// ── Game.getPeriodLabel ──────────────────────────────────────

describe("Game.getPeriodLabel", () => {
    it("formats numeric periods as Q#", () => {
        strictEqual(Game.getPeriodLabel(1), "Q1");
        strictEqual(Game.getPeriodLabel(2), "Q2");
        // Works for any number, not just 1-4
        strictEqual(Game.getPeriodLabel(7), "Q7");
    });

    it("passes through OT and SO strings", () => {
        strictEqual(Game.getPeriodLabel("OT1"), "OT1");
        strictEqual(Game.getPeriodLabel("OT2"), "OT2");
        strictEqual(Game.getPeriodLabel("SO"), "SO");
    });
});

// ── Game.getActivePeriods ────────────────────────────────────

describe("Game.getActivePeriods", () => {
    it("returns empty array for empty game", () => {
        const g = Game.create(publicKeys[0]);
        deepStrictEqual(Game.getActivePeriods(g), []);
    });

    it("returns unique periods from log", () => {
        const g = Game.create(publicKeys[0]);
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        Game.addEvent(g, { period: 2, time: "7:00", team: "W", cap: "7", event: "G" });
        const periods = Game.getActivePeriods(g);
        deepStrictEqual(periods, [1, 2]);
    });
});

// ── Game.getAllPeriods ────────────────────────────────────────

describe("Game.getAllPeriods", () => {
    for (const key of publicKeys) {
        const rules = RULES[key];
        const expected = Array.from({ length: rules.periods }, (_, i) => i + 1);

        it(`returns ${rules.periods} regulation periods for ${key}`, () => {
            const g = Game.create(key);
            deepStrictEqual(Game.getAllPeriods(g), expected);
        });
    }

    it("includes OT periods from log", () => {
        const otKey = publicKeys.find(k => RULES[k].overtime);
        if (!otKey) return;
        const g = Game.create(otKey);
        Game.addEvent(g, { period: "OT1", time: "3:00", team: "W", cap: "7", event: "G" });
        ok(Game.getAllPeriods(g).includes("OT1"));
    });

    it("includes current OT period even without log entries", () => {
        const otKey = publicKeys.find(k => RULES[k].overtime);
        if (!otKey) return;
        const g = Game.create(otKey);
        g.currentPeriod = "OT1";
        ok(Game.getAllPeriods(g).includes("OT1"));
    });

    it("includes SO when in shootout", () => {
        const soKey = publicKeys.find(k => RULES[k].shootout);
        if (!soKey) return;
        const g = Game.create(soKey);
        g.currentPeriod = "SO";
        ok(Game.getAllPeriods(g).includes("SO"));
    });
});

// ── Game.validateTime ────────────────────────────────────────

describe("Game.validateTime", () => {
    it("returns valid for first entry in period", () => {
        const g = Game.create("USAWP");
        const result = Game.validateTime(g, 1, "7:00");
        strictEqual(result.valid, true);
    });

    it("returns valid when time is after (lower than) previous entry", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const result = Game.validateTime(g, 1, "6:00");
        strictEqual(result.valid, true);
    });

    it("returns warning when time is before (higher than) previous entry", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "7", event: "G" });
        const result = Game.validateTime(g, 1, "6:00");
        strictEqual(result.valid, false);
        ok(result.warning.includes("6:00"));
    });

    it("returns valid for equal time", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "7", event: "G" });
        const result = Game.validateTime(g, 1, "5:00");
        strictEqual(result.valid, true);
    });

    it("ignores events from other periods", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "1:00", team: "W", cap: "7", event: "G" });
        const result = Game.validateTime(g, 2, "7:00");
        strictEqual(result.valid, true);
    });
});

// ── Game Data Aggregation ────────────────────────────────────

// ── filterLogEvents ──────────────────────────────────────────

describe("Game.filterLogEvents", () => {
    it("keeps non-stats events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "E" });
        const rules = RULES[g.rules];
        const result = Game.filterLogEvents(g.log, rules);
        strictEqual(result.length, 2);
    });

    it("filters out statsOnly events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "5", event: "Shot" });
        const rules = RULES[g.rules];
        const result = Game.filterLogEvents(g.log, rules);
        strictEqual(result.length, 1);
        strictEqual(result[0].event, "G");
    });

    it("keeps period end markers", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        Game.addEvent(g, { period: 1, time: "", team: "", cap: "", event: "---" });
        const rules = RULES[g.rules];
        const result = Game.filterLogEvents(g.log, rules);
        strictEqual(result.length, 2);
        strictEqual(result[1].event, "---");
    });
});

// ── buildPeriodScores ────────────────────────────────────────

describe("Game.buildPeriodScores", () => {
    it("counts goals correctly per period", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        Game.addEvent(g, { period: 1, time: "", team: "", cap: "", event: "---" });
        Game.addEvent(g, { period: 2, time: "7:00", team: "W", cap: "5", event: "G" });
        Game.addEvent(g, { period: 2, time: "6:00", team: "W", cap: "7", event: "G" });
        const result = Game.buildPeriodScores(g);
        strictEqual(result.white[0], 1);
        strictEqual(result.dark[0], 1);
        strictEqual(result.white[1], 2);
        strictEqual(result.dark[1], 0);
    });

    it("returns correct totals", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        const result = Game.buildPeriodScores(g);
        strictEqual(result.totalWhite, "1");
        strictEqual(result.totalDark, "1");
    });

    it("uses period labels (Q1, Q2, etc.)", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        Game.addEvent(g, { period: 1, time: "", team: "", cap: "", event: "---" });
        Game.addEvent(g, { period: 2, time: "7:00", team: "W", cap: "5", event: "G" });
        const result = Game.buildPeriodScores(g);
        strictEqual(result.periods[0], "Q1");
        strictEqual(result.periods[1], "Q2");
    });

    it("handles game with no goals", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "E" });
        const result = Game.buildPeriodScores(g);
        strictEqual(result.white[0], 0);
        strictEqual(result.dark[0], 0);
        strictEqual(result.totalWhite, "0");
        strictEqual(result.totalDark, "0");
    });
});

// ── buildPersonalFoulTable ───────────────────────────────────

describe("Game.buildPersonalFoulTable", () => {
    it("returns empty array for game with no fouls", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        const result = Game.buildPersonalFoulTable(g);
        strictEqual(result.length, 0);
    });

    it("returns one entry per player-team combo", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "E" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "5", event: "E" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "D", cap: "3", event: "E" });
        const result = Game.buildPersonalFoulTable(g);
        strictEqual(result.length, 2);
    });

    it("aggregates foul count per player", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "E" });
        Game.addEvent(g, { period: 2, time: "6:00", team: "W", cap: "5", event: "E" });
        const result = Game.buildPersonalFoulTable(g);
        strictEqual(result[0].count, 2);
    });

    it("marks fouled-out when personal foul limit reached", () => {
        const g = Game.create("USAWP");
        for (let i = 0; i < 3; i++) {
            Game.addEvent(g, { period: 1, time: `${7-i}:00`, team: "W", cap: "5", event: "E" });
        }
        const result = Game.buildPersonalFoulTable(g);
        strictEqual(result[0].fouledOut, true);
    });

    it("marks fouled-out for auto-foul-out events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "MC" });
        const result = Game.buildPersonalFoulTable(g);
        strictEqual(result[0].fouledOut, true);
    });

    it("does not mark fouled-out for single personal foul", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "E" });
        const result = Game.buildPersonalFoulTable(g);
        strictEqual(result[0].fouledOut, false);
    });

    it("includes event details", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "E" });
        const result = Game.buildPersonalFoulTable(g);
        strictEqual(result[0].details.length, 1);
        strictEqual(result[0].details[0].period, 1);
        strictEqual(result[0].details[0].time, "7:00");
        strictEqual(result[0].details[0].event, "Exclusion");
    });

    it("NFHS MAM 2nd occurrence triggers fouled out", () => {
        const g = Game.create("NFHSVA");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "MAM" });
        let result = Game.buildPersonalFoulTable(g);
        strictEqual(result[0].fouledOut, false);
        Game.addEvent(g, { period: 2, time: "6:00", team: "W", cap: "5", event: "MAM" });
        result = Game.buildPersonalFoulTable(g);
        strictEqual(result[0].fouledOut, true);
    });
});

// ── buildTimeoutSummary ──────────────────────────────────────

describe("Game.buildTimeoutSummary", () => {
    it("returns empty array when no timeouts", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        const result = Game.buildTimeoutSummary(g);
        strictEqual(result.length, 0);
    });

    it("returns timeout entries with team and type", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        Game.addEvent(g, { period: 2, time: "6:00", team: "D", event: "TO30" });
        const result = Game.buildTimeoutSummary(g);
        strictEqual(result.length, 2);
        strictEqual(result[0].team, "White");
        strictEqual(result[0].type, "Timeout");
        strictEqual(result[1].team, "Dark");
        strictEqual(result[1].type, "Timeout 30");
    });

    it("handles official timeouts", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "", event: "TO" });
        const result = Game.buildTimeoutSummary(g);
        strictEqual(result[0].team, "Official");
    });

    it("formats time by stripping leading zero", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "07:00", team: "W", event: "TO" });
        const result = Game.buildTimeoutSummary(g);
        strictEqual(result[0].time, "7:00");
    });
});

// ── buildCardSummary ─────────────────────────────────────────

describe("Game.buildCardSummary", () => {
    it("returns empty array when no cards", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "5", event: "G" });
        const result = Game.buildCardSummary(g);
        strictEqual(result.length, 0);
    });

    it("returns card entries with all fields", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "C", event: "YC" });
        Game.addEvent(g, { period: 3, time: "5:00", team: "D", cap: "AC", event: "RC" });
        const result = Game.buildCardSummary(g);
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
        const result = Game.buildCardSummary(g);
        strictEqual(result[0].cap, "—");
    });
});

// ── buildPlayerStats ─────────────────────────────────────────

describe("Game.buildPlayerStats", () => {
    it("returns null for game with no stats", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        const result = Game.buildPlayerStats(g);
        strictEqual(result, null);
    });

    it("aggregates single stat type", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 2, time: "5:00", team: "W", cap: "7", event: "Shot" });
        const result = Game.buildPlayerStats(g);
        ok(result !== null);
        strictEqual(result.stats.W["7"]["Shot"], 3);
    });

    it("separates by team", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "Shot" });
        const result = Game.buildPlayerStats(g);
        ok(result !== null);
        strictEqual(result.stats.W["7"]["Shot"], 1);
        strictEqual(result.stats.D["3"]["Shot"], 1);
    });


    it("ignores events without cap or team", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "", event: "TO" });
        const result = Game.buildPlayerStats(g);
        ok(result !== null);
        strictEqual(Object.keys(result.stats.W).length, 1);
    });

    it("handles multiple stat types", () => {
        const g = Game.create("USAWP");
        g.enableStats = true;
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "Assist" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "D", cap: "3", event: "Steal" });
        const result = Game.buildPlayerStats(g);
        ok(result !== null);
        strictEqual(result.stats.W["7"]["Shot"], 1);
        strictEqual(result.stats.W["7"]["Assist"], 1);
        strictEqual(result.stats.D["3"]["Steal"], 1);
    });
});

// ── Test data files ──────────────────────────────────────────

describe("Game data builders with test data", () => {
    for (const file of ["small-game.json", "medium-game.json", "large-game.json"]) {
        describe(file, () => {
            const gameData = loadTestData(file);

            it("buildPeriodScores returns consistent totals", () => {
                const result = Game.buildPeriodScores(gameData);
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
                const result = Game.buildPersonalFoulTable(gameData);
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
                const result = Game.buildTimeoutSummary(gameData);
                ok(Array.isArray(result));
                for (const entry of result) {
                    ok(typeof entry.team === "string");
                    ok(typeof entry.period === "string");
                    ok(typeof entry.time === "string");
                    ok(typeof entry.type === "string");
                }
            });

            it("buildCardSummary returns array", () => {
                const result = Game.buildCardSummary(gameData);
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
                const result = Game.buildPlayerStats(gameData);
                if (result !== null) {
                    ok(Array.isArray(result.statTypes));
                    ok(Array.isArray(result.activeStatCodes));
                    ok(typeof result.stats === "object");
                    ok(typeof result.totals === "object");
                }
            });
        });
    }
});
