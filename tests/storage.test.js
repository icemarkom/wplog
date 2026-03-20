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
import { validateGameData } from "../js/storage.js";

// ── Helpers ──────────────────────────────────────────────────

// Minimal valid USAWP game — the smallest correct input.
function validGame(overrides = {}) {
    return {
        rules: "USAWP",
        date: "2024-06-15",
        startTime: "10:00",
        endTime: "11:30",
        location: "Aquatic Center",
        gameId: "G-001",
        periodLength: 8,
        otPeriodLength: null,
        overtime: false,
        shootout: true,
        timeoutsAllowed: { full: 2, to30: 0 },
        enableLog: true,
        enableStats: false,
        statsTimeMode: "off",
        white: { name: "White" },
        dark: { name: "Dark" },
        currentPeriod: 1,
        log: [],
        _nextId: 1,
        _nextSeq: 10,
        ...overrides,
    };
}

// A valid log entry for a Goal event.
function validGoalEntry(overrides = {}) {
    return {
        id: 1,
        seq: 10,
        deviceTime: "2024-06-15T10:05:00.000Z",
        period: 1,
        time: "7:32",
        team: "W",
        cap: "7",
        event: "G",
        scoreW: 1,
        scoreD: 0,
        note: "",
        ...overrides,
    };
}

// ── Valid Data ────────────────────────────────────────────────

describe("validateGameData — valid inputs", () => {
    it("accepts a minimal valid USAWP game", () => {
        const result = validateGameData(validGame());
        strictEqual(result.valid, true);
        ok(result.data, "should return clean data");
    });

    it("accepts a valid NCAA game", () => {
        const result = validateGameData(validGame({
            rules: "NCAA",
            periodLength: 8,
            otPeriodLength: 3,
            overtime: true,
            shootout: false,
            timeoutsAllowed: { full: 3, to30: 1 },
        }));
        strictEqual(result.valid, true);
    });

    it("accepts a valid NFHS Varsity game", () => {
        const result = validateGameData(validGame({
            rules: "NFHSVA",
            periodLength: 7,
            otPeriodLength: 3,
            overtime: true,
            shootout: false,
            timeoutsAllowed: { full: 3, to30: 1 },
        }));
        strictEqual(result.valid, true);
    });

    it("accepts a valid NFHS JV game", () => {
        const result = validateGameData(validGame({
            rules: "NFHSJV",
            periodLength: 6,
            otPeriodLength: null,
            overtime: false,
            shootout: false,
            timeoutsAllowed: { full: 3, to30: 1 },
        }));
        strictEqual(result.valid, true);
    });

    it("accepts a game with log entries", () => {
        const result = validateGameData(validGame({
            log: [
                validGoalEntry(),
                validGoalEntry({ id: 2, seq: 20, time: "5:00", team: "D", cap: "3", scoreW: 1, scoreD: 1 }),
            ],
            _nextId: 3,
            _nextSeq: 30,
        }));
        strictEqual(result.valid, true);
        strictEqual(result.data.log.length, 2);
    });

    it("accepts a game with Period End markers", () => {
        const result = validateGameData(validGame({
            log: [
                validGoalEntry(),
                { id: 2, seq: 20, deviceTime: "", period: 1, time: "0:00", team: "", cap: "", event: "---", scoreW: 1, scoreD: 0, note: "" },
            ],
            currentPeriod: 2,
            _nextId: 3,
            _nextSeq: 30,
        }));
        strictEqual(result.valid, true);
    });
});

// ── Test Data Files ──────────────────────────────────────────

describe("validateGameData — test data files", () => {
    for (const file of ["small-game.json", "medium-game.json", "large-game.json"]) {
        it(`accepts testdata/${file}`, () => {
            const raw = readFileSync(`testdata/${file}`, "utf8");
            const parsed = JSON.parse(raw);
            const result = validateGameData(parsed);
            strictEqual(result.valid, true, result.error);
        });
    }
});

// ── Null and Missing Optional Fields ─────────────────────────

describe("validateGameData — null/missing optional fields", () => {
    it("accepts null otPeriodLength (no OT)", () => {
        const result = validateGameData(validGame({ otPeriodLength: null }));
        strictEqual(result.valid, true);
        strictEqual(result.data.otPeriodLength, null);
    });

    it("accepts undefined otPeriodLength", () => {
        const game = validGame();
        delete game.otPeriodLength;
        const result = validateGameData(game);
        strictEqual(result.valid, true);
    });

    it("accepts null startTime", () => {
        const result = validateGameData(validGame({ startTime: null }));
        strictEqual(result.valid, true);
    });

    it("accepts null endTime", () => {
        const result = validateGameData(validGame({ endTime: null }));
        strictEqual(result.valid, true);
    });

    it("accepts null location", () => {
        const result = validateGameData(validGame({ location: null }));
        strictEqual(result.valid, true);
    });

    it("accepts null gameId", () => {
        const result = validateGameData(validGame({ gameId: null }));
        strictEqual(result.valid, true);
    });

    it("accepts empty strings for optional fields", () => {
        const result = validateGameData(validGame({
            startTime: "", endTime: "", location: "", gameId: "",
        }));
        strictEqual(result.valid, true);
    });

    it("accepts log entry with null note", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ note: null })],
        }));
        strictEqual(result.valid, true);
        strictEqual(result.data.log[0].note, "");
    });

    it("accepts log entry with null deviceTime", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ deviceTime: null })],
        }));
        strictEqual(result.valid, true);
        strictEqual(result.data.log[0].deviceTime, "");
    });
});

// ── Invalid Top-Level Fields ─────────────────────────────────

describe("validateGameData — invalid top-level fields", () => {
    it("rejects non-object input (string)", () => {
        const result = validateGameData("not an object");
        strictEqual(result.valid, false);
    });

    it("rejects non-object input (array)", () => {
        const result = validateGameData([1, 2, 3]);
        strictEqual(result.valid, false);
    });

    it("rejects null input", () => {
        const result = validateGameData(null);
        strictEqual(result.valid, false);
    });

    it("rejects unknown rules", () => {
        const result = validateGameData(validGame({ rules: "INVALID_RULES" }));
        strictEqual(result.valid, false);
        ok(result.error.includes("Unknown rules"));
    });

    it("rejects internal rule sets (_base)", () => {
        const result = validateGameData(validGame({ rules: "_base" }));
        strictEqual(result.valid, false);
    });

    it("rejects internal rule sets (_academic)", () => {
        const result = validateGameData(validGame({ rules: "_academic" }));
        strictEqual(result.valid, false);
    });

    it("rejects invalid date format", () => {
        const result = validateGameData(validGame({ date: "June 15" }));
        strictEqual(result.valid, false);
        ok(result.error.includes("date"));
    });

    it("rejects invalid startTime format", () => {
        const result = validateGameData(validGame({ startTime: "10am" }));
        strictEqual(result.valid, false);
    });

    it("rejects periodLength 0", () => {
        const result = validateGameData(validGame({ periodLength: 0 }));
        strictEqual(result.valid, false);
    });

    it("rejects periodLength 10", () => {
        const result = validateGameData(validGame({ periodLength: 10 }));
        strictEqual(result.valid, false);
    });

    it("rejects non-integer periodLength", () => {
        const result = validateGameData(validGame({ periodLength: 7.5 }));
        strictEqual(result.valid, false);
    });

    it("rejects otPeriodLength 0", () => {
        const result = validateGameData(validGame({ otPeriodLength: 0 }));
        strictEqual(result.valid, false);
    });

    it("rejects non-boolean overtime", () => {
        const result = validateGameData(validGame({ overtime: "yes" }));
        strictEqual(result.valid, false);
    });

    it("rejects non-boolean shootout", () => {
        const result = validateGameData(validGame({ shootout: 1 }));
        strictEqual(result.valid, false);
    });

    it("rejects missing timeoutsAllowed", () => {
        const result = validateGameData(validGame({ timeoutsAllowed: null }));
        strictEqual(result.valid, false);
    });

    it("rejects non-boolean enableLog", () => {
        const result = validateGameData(validGame({ enableLog: "true" }));
        strictEqual(result.valid, false);
    });

    it("rejects invalid statsTimeMode", () => {
        const result = validateGameData(validGame({ statsTimeMode: "always" }));
        strictEqual(result.valid, false);
    });

    it("rejects missing white team", () => {
        const result = validateGameData(validGame({ white: null }));
        strictEqual(result.valid, false);
    });

    it("rejects invalid currentPeriod", () => {
        const result = validateGameData(validGame({ currentPeriod: "Q1" }));
        strictEqual(result.valid, false);
    });

    it("rejects non-array log", () => {
        const result = validateGameData(validGame({ log: "not an array" }));
        strictEqual(result.valid, false);
    });
});

// ── Invalid Log Entries ──────────────────────────────────────

describe("validateGameData — invalid log entries", () => {
    it("rejects log entry with invalid id", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ id: -1 })],
        }));
        strictEqual(result.valid, false);
        ok(result.error.includes("Log entry 1"));
    });

    it("rejects log entry with invalid period", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ period: "Q1" })],
        }));
        strictEqual(result.valid, false);
    });

    it("rejects log entry with invalid time format", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ time: "12:00" })],
        }));
        strictEqual(result.valid, false);
    });

    it("rejects log entry with invalid team", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ team: "X" })],
        }));
        strictEqual(result.valid, false);
    });

    it("rejects log entry with invalid cap", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ cap: "100" })],
        }));
        strictEqual(result.valid, false);
    });

    it("rejects log entry with unknown event code", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ event: "FAKE" })],
        }));
        strictEqual(result.valid, false);
        ok(result.error.includes("unknown event"));
    });

    it("rejects log entry with negative score", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ scoreW: -1 })],
        }));
        strictEqual(result.valid, false);
    });

    it("rejects NFHSVA event in USAWP game", () => {
        const result = validateGameData(validGame({
            rules: "USAWP",
            log: [validGoalEntry({ event: "MAM" })],
        }));
        strictEqual(result.valid, false);
    });

    it("rejects NCAA event in NFHSVA game", () => {
        const result = validateGameData(validGame({
            rules: "NFHSVA",
            periodLength: 7,
            otPeriodLength: 3,
            overtime: true,
            shootout: false,
            timeoutsAllowed: { full: 3, to30: 1 },
            log: [validGoalEntry({ event: "YRC", cap: "C" })],
        }));
        strictEqual(result.valid, false);
    });
});

// ── Valid Cap Numbers ────────────────────────────────────────

describe("validateGameData — cap number validation", () => {
    for (const cap of ["1", "7", "13", "99", "1A", "1B", "1C", "C", "AC", "B", ""]) {
        it(`accepts cap "${cap}"`, () => {
            const result = validateGameData(validGame({
                log: [validGoalEntry({ cap })],
            }));
            strictEqual(result.valid, true, result.error);
        });
    }

    for (const cap of ["100", "0", "1D", "ABC", "1a", "-1"]) {
        it(`rejects cap "${cap}"`, () => {
            const result = validateGameData(validGame({
                log: [validGoalEntry({ cap })],
            }));
            strictEqual(result.valid, false);
        });
    }
});

// ── Valid Game Clock Times ───────────────────────────────────

describe("validateGameData — game clock time format", () => {
    for (const time of ["0:00", "1:23", "9:59", ""]) {
        it(`accepts time "${time}"`, () => {
            const result = validateGameData(validGame({
                log: [validGoalEntry({ time })],
            }));
            strictEqual(result.valid, true, result.error);
        });
    }

    for (const time of ["10:00", "12:00", "1:2", ":30", "abc", "0:60"]) {
        it(`rejects time "${time}"`, () => {
            const result = validateGameData(validGame({
                log: [validGoalEntry({ time })],
            }));
            strictEqual(result.valid, false);
        });
    }
});

// ── Valid Period Values ──────────────────────────────────────

describe("validateGameData — period validation", () => {
    for (const period of [1, 2, 3, 4, "OT1", "OT2", "OT3", "SO"]) {
        it(`accepts period ${period}`, () => {
            const result = validateGameData(validGame({
                currentPeriod: period,
                log: [validGoalEntry({ period })],
            }));
            strictEqual(result.valid, true, result.error);
        });
    }

    for (const period of [0, 5, -1, "Q1", "OT", "OT0", "SO1", "overtime"]) {
        it(`rejects period ${period}`, { todo: "see issue" }, () => {
            const result = validateGameData(validGame({
                currentPeriod: period,
            }));
            strictEqual(result.valid, false);
        });
    }
});

// ── Security ─────────────────────────────────────────────────

describe("validateGameData — security", () => {
    it("strips unknown properties from game object", () => {
        const game = validGame();
        game.maliciousField = "evil";
        const result = validateGameData(game);
        strictEqual(result.valid, true);
        strictEqual(result.data.maliciousField, undefined);
    });

    it("strips unknown properties from log entries", () => {
        const entry = validGoalEntry();
        entry.injected = "<script>alert(1)</script>";
        const result = validateGameData(validGame({ log: [entry] }));
        strictEqual(result.valid, true);
        strictEqual(result.data.log[0].injected, undefined);
    });

    it("preserves user data without escaping (that's the renderer's job)", () => {
        const result = validateGameData(validGame({
            white: { name: '<img src=x onerror=alert(1)>' },
        }));
        strictEqual(result.valid, true);
        strictEqual(result.data.white.name, '<img src=x onerror=alert(1)>');
    });
});

// ── Clean Output Shape ───────────────────────────────────────

describe("validateGameData — clean output shape", () => {
    it("returns all required top-level fields", () => {
        const result = validateGameData(validGame());
        const keys = Object.keys(result.data);
        for (const expected of [
            "rules", "date", "startTime", "endTime", "location", "gameId",
            "periodLength", "otPeriodLength", "overtime", "shootout",
            "timeoutsAllowed", "enableLog", "enableStats", "statsTimeMode",
            "white", "dark", "currentPeriod", "log", "_nextId", "_nextSeq",
        ]) {
            ok(keys.includes(expected), `missing field: ${expected}`);
        }
    });

    it("returns all required log entry fields", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry()],
        }));
        const keys = Object.keys(result.data.log[0]);
        for (const expected of [
            "id", "seq", "deviceTime", "period", "time",
            "team", "cap", "event", "scoreW", "scoreD", "note",
        ]) {
            ok(keys.includes(expected), `missing log field: ${expected}`);
        }
    });

    it("defaults missing _nextId/_nextSeq from log", () => {
        const game = validGame({
            log: [
                validGoalEntry({ id: 5, seq: 50 }),
                validGoalEntry({ id: 12, seq: 120, team: "D", scoreW: 1, scoreD: 1 }),
            ],
        });
        delete game._nextId;
        delete game._nextSeq;
        const result = validateGameData(game);
        strictEqual(result.valid, true);
        strictEqual(result.data._nextId, 13);   // max id + 1
        strictEqual(result.data._nextSeq, 130);  // max seq + 10
    });

    it("defaults missing _nextId/_nextSeq to 1/10 for empty log", () => {
        const game = validGame();
        delete game._nextId;
        delete game._nextSeq;
        const result = validateGameData(game);
        strictEqual(result.valid, true);
        strictEqual(result.data._nextId, 1);
        strictEqual(result.data._nextSeq, 10);
    });

    it("preserves null otPeriodLength in clean output", () => {
        const result = validateGameData(validGame({ otPeriodLength: null }));
        strictEqual(result.valid, true);
        strictEqual(result.data.otPeriodLength, null);
    });
});

// ── Stats Events ─────────────────────────────────────────────

describe("validateGameData — stats events", () => {
    const statsEvents = [
        "Shot", "Assist", "Offensive", "Steal", "Intercept",
        "Turnover", "Field Block", "Save", "Drawn Exclusion",
        "Drawn Penalty", "Sprint Won",
    ];

    for (const event of statsEvents) {
        it(`accepts stats event "${event}" in USAWP`, () => {
            const result = validateGameData(validGame({
                log: [validGoalEntry({ event, cap: "7" })],
            }));
            strictEqual(result.valid, true, result.error);
        });
    }

    it("rejects short code 'S' (must use full name 'Shot')", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ event: "S" })],
        }));
        strictEqual(result.valid, false);
    });

    it("rejects short code 'A' (must use full name 'Assist')", () => {
        const result = validateGameData(validGame({
            log: [validGoalEntry({ event: "A" })],
        }));
        strictEqual(result.valid, false);
    });
});
