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
import { sanitizeName, buildFilename, csvEscape, buildCSV } from "../js/export.js";

// ── sanitizeName ─────────────────────────────────────────────

describe("sanitizeName", () => {
    it("passes through simple names", () => {
        strictEqual(sanitizeName("Tigers"), "Tigers");
    });

    it("replaces spaces with hyphens", () => {
        strictEqual(sanitizeName("LA Water Polo"), "LA-Water-Polo");
    });

    it("strips special characters", () => {
        strictEqual(sanitizeName("Team (A) #1!"), "Team-A-1");
    });

    it("handles empty string", () => {
        strictEqual(sanitizeName(""), "");
    });

    it("collapses multiple spaces", () => {
        strictEqual(sanitizeName("Big   Gap"), "Big-Gap");
    });
});

// ── buildFilename ────────────────────────────────────────────

describe("buildFilename", () => {
    it("builds filename with default teams", () => {
        const game = {
            date: "2024-06-15",
            startTime: "10:00",
            white: { name: "White" },
            dark: { name: "Dark" },
        };
        strictEqual(buildFilename(game, ".csv"), "wplog-2024-06-15-1000.csv");
    });

    it("includes custom team names", () => {
        const game = {
            date: "2024-06-15",
            startTime: "14:30",
            white: { name: "Tigers" },
            dark: { name: "Sharks" },
        };
        strictEqual(buildFilename(game, ".csv"), "wplog-2024-06-15-Tigers-Sharks-1430.csv");
    });

    it("includes only custom white team (dark default)", () => {
        const game = {
            date: "2024-06-15",
            startTime: "10:00",
            white: { name: "Eagles" },
            dark: { name: "Dark" },
        };
        strictEqual(buildFilename(game, ".json"), "wplog-2024-06-15-Eagles-Dark-1000.json");
    });

    it("sanitizes team names in filename", () => {
        const game = {
            date: "2024-06-15",
            startTime: "10:00",
            white: { name: "LA Water Polo" },
            dark: { name: "Team #2" },
        };
        strictEqual(buildFilename(game, ".csv"), "wplog-2024-06-15-LA-Water-Polo-Team-2-1000.csv");
    });

    it("uses .json extension", () => {
        const game = {
            date: "2024-06-15",
            startTime: "10:00",
            white: { name: "White" },
            dark: { name: "Dark" },
        };
        ok(buildFilename(game, ".json").endsWith(".json"));
    });
});

// ── csvEscape ────────────────────────────────────────────────

describe("csvEscape", () => {
    it("returns simple values unchanged", () => {
        strictEqual(csvEscape("hello"), "hello");
    });

    it("quotes values with commas", () => {
        strictEqual(csvEscape("a,b"), '"a,b"');
    });

    it("escapes and quotes double quotes", () => {
        strictEqual(csvEscape('say "hi"'), '"say ""hi"""');
    });

    it("quotes values with newlines", () => {
        strictEqual(csvEscape("line1\nline2"), '"line1\nline2"');
    });

    it("handles empty string", () => {
        strictEqual(csvEscape(""), "");
    });

    it("converts numbers to strings", () => {
        strictEqual(csvEscape(42), "42");
    });
});

// ── buildCSV ─────────────────────────────────────────────────

describe("buildCSV", () => {
    it("produces header + rows for a game log", () => {
        const game = {
            log: [
                { deviceTime: "2024-06-15T10:05:00.000Z", seq: 10, period: 1, time: "7:32", team: "W", cap: "7", event: "G" },
                { deviceTime: "2024-06-15T10:06:00.000Z", seq: 20, period: 1, time: "6:00", team: "D", cap: "3", event: "E" },
            ],
        };
        const csv = buildCSV(game);
        const lines = csv.split("\n");
        strictEqual(lines[0], "deviceTime,seq,period,time,team,cap,event");
        strictEqual(lines[1], "2024-06-15T10:05:00.000Z,10,1,7:32,W,7,G");
        strictEqual(lines[2], "2024-06-15T10:06:00.000Z,20,1,6:00,D,3,E");
        strictEqual(lines[3], ""); // trailing newline
    });

    it("produces header only for empty log", () => {
        const game = { log: [] };
        const csv = buildCSV(game);
        strictEqual(csv, "deviceTime,seq,period,time,team,cap,event\n\n");
    });

    it("escapes caps and events with special characters", () => {
        const game = {
            log: [
                { deviceTime: "", seq: 10, period: 1, time: "5:00", team: "W", cap: "1A", event: "Field Block" },
            ],
        };
        const csv = buildCSV(game);
        ok(csv.includes("1A,Field Block"));
    });
});
