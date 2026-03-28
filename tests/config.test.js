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
import { strictEqual, ok } from "node:assert";
import { RULES, loadConfig } from "../js/config.js";
import { readFileSync } from "node:fs";

// Mock fetch for loadConfig in Node testing environment
globalThis.fetch = async (url) => {
    const file = url.split("?")[0];
    const content = readFileSync(file, "utf8");
    return { ok: true, json: async () => JSON.parse(content) };
};

await loadConfig();

// ── Helpers ──────────────────────────────────────────────────

// All rule set keys, split by visibility.
const allKeys = Object.keys(RULES);
const publicKeys = allKeys.filter(k => !k.startsWith("_"));
const internalKeys = allKeys.filter(k => k.startsWith("_"));

// ── Rule Set Resolution ──────────────────────────────────────

describe("Rule set resolution", () => {
    it("has at least one public rule set", () => {
        ok(publicKeys.length > 0, "no public rule sets found");
    });

    for (const key of publicKeys) {
        describe(`${key}`, () => {
            const rules = RULES[key];

            it("has a display name", () => {
                ok(rules.name, "missing name");
                ok(typeof rules.name === "string");
            });

            it("has a positive integer periods count", () => {
                ok(Number.isInteger(rules.periods) && rules.periods > 0,
                    `periods should be positive integer, got ${rules.periods}`);
            });

            it("has a positive integer periodLength", () => {
                ok(Number.isInteger(rules.periodLength) && rules.periodLength > 0,
                    `periodLength should be positive integer, got ${rules.periodLength}`);
            });

            it("has a positive integer foulOutLimit", () => {
                ok(Number.isInteger(rules.foulOutLimit) && rules.foulOutLimit > 0,
                    `foulOutLimit should be positive integer, got ${rules.foulOutLimit}`);
            });

            it("has boolean overtime", () => {
                strictEqual(typeof rules.overtime, "boolean");
            });

            it("has boolean shootout", () => {
                strictEqual(typeof rules.shootout, "boolean");
            });

            it("has OT and SO mutually exclusive", () => {
                ok(!(rules.overtime && rules.shootout),
                    "overtime and shootout cannot both be true");
            });

            it("has otPeriodLength when overtime is enabled", () => {
                if (rules.overtime) {
                    ok(Number.isInteger(rules.otPeriodLength) && rules.otPeriodLength > 0,
                        "overtime enabled but no valid otPeriodLength");
                }
            });

            it("has a resolved events array (not addEvents/removeEvents)", () => {
                ok(Array.isArray(rules.events), "events should be array");
                ok(rules.events.length > 0, "events should not be empty");
                strictEqual(rules.addEvents, undefined, "addEvents should be resolved away");
                strictEqual(rules.removeEvents, undefined, "removeEvents should be resolved away");
            });

            it("has a Goal event", () => {
                ok(rules.events.some(e => e.code === "G"), "every rule set needs a Goal event");
            });
        });
    }
});

// ── Internal Rule Sets ───────────────────────────────────────

describe("Internal rule sets", () => {
    for (const key of internalKeys) {
        it(`${key} has no display name`, () => {
            strictEqual(RULES[key].name, undefined,
                "internal rule sets should not have a name");
        });
    }
});

// ── Event Structure ──────────────────────────────────────────

describe("Event structure", () => {
    for (const key of publicKeys) {
        describe(`${key} events`, () => {
            const events = RULES[key].events;

            it("every event has a code (string)", () => {
                for (const e of events) {
                    ok(typeof e.code === "string" && e.code.length > 0,
                        `event missing code: ${JSON.stringify(e)}`);
                }
            });

            it("every event has a name (string)", () => {
                for (const e of events) {
                    ok(typeof e.name === "string" && e.name.length > 0,
                        `event missing name: ${JSON.stringify(e)}`);
                }
            });

            it("event codes are unique", () => {
                const codes = events.map(e => e.code);
                const unique = new Set(codes);
                strictEqual(unique.size, codes.length,
                    `duplicate codes: ${codes.filter((c, i) => codes.indexOf(c) !== i)}`);
            });

            it("autoFoulOut is a positive integer when present", () => {
                for (const e of events) {
                    if (e.autoFoulOut !== undefined) {
                        ok(Number.isInteger(e.autoFoulOut) && e.autoFoulOut > 0,
                            `${e.code} autoFoulOut should be positive int, got ${e.autoFoulOut}`);
                    }
                }
            });

            it("isPersonalFoul is boolean when present", () => {
                for (const e of events) {
                    if (e.isPersonalFoul !== undefined) {
                        strictEqual(typeof e.isPersonalFoul, "boolean",
                            `${e.code} isPersonalFoul should be boolean`);
                    }
                }
            });

            it("teamOnly is boolean when present", () => {
                for (const e of events) {
                    if (e.teamOnly !== undefined) {
                        strictEqual(typeof e.teamOnly, "boolean",
                            `${e.code} teamOnly should be boolean`);
                    }
                }
            });
        });
    }
});

// ── Stats Events ─────────────────────────────────────────────

describe("Stats events", () => {
    for (const key of publicKeys) {
        describe(`${key} stats`, () => {
            const stats = RULES[key].events.filter(e => e.statsOnly);

            it("statsOnly events use name as code", () => {
                for (const e of stats) {
                    strictEqual(e.code, e.name,
                        `statsOnly event "${e.name}" code should equal name`);
                }
            });

            it("statsOnly events have teal color", () => {
                for (const e of stats) {
                    strictEqual(e.color, "teal",
                        `statsOnly event "${e.code}" should be teal`);
                }
            });
        });
    }

    it("all rule sets have the same stats events", () => {
        const refStats = RULES[publicKeys[0]].events
            .filter(e => e.statsOnly).map(e => e.code).sort();

        for (const key of publicKeys.slice(1)) {
            const stats = RULES[key].events
                .filter(e => e.statsOnly).map(e => e.code).sort();
            strictEqual(JSON.stringify(stats), JSON.stringify(refStats),
                `${key} stats events differ from ${publicKeys[0]}`);
        }
    });
});
