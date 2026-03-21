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
import { Game } from "../js/game.js";
import { RULES } from "../js/config.js";
import {
    PAGE_ROWS,
    HEADER_ROWS,
    ROW_HEIGHT,
    PAGE_WIDTH,
    STATS_COL_WIDTH,
    STATS_CAP_COL_WIDTH,
    ROTATED_CHAR_PX,
    rotatedHeaderRows,
    maxStatsPerTable,
    splitStatColumns,
    availableRows,
    filterLogEvents,
    buildLogPagePlan,
    buildSummaryDescriptors,
    buildStatsDescriptors,
    paginateItems,
} from "../js/pagination.js";

function loadTestData(name) {
    return JSON.parse(readFileSync(`testdata/${name}`, "utf8"));
}

// ── Constants ────────────────────────────────────────────────

describe("pagination constants", () => {
    it("PAGE_ROWS has letter and a4", () => {
        strictEqual(PAGE_ROWS.letter, 52);
        strictEqual(PAGE_ROWS.a4, 56);
    });

    it("HEADER_ROWS is 12", () => {
        strictEqual(HEADER_ROWS, 12);
    });

    it("ROW_HEIGHT is 18", () => {
        strictEqual(ROW_HEIGHT, 18);
    });
});

// ── availableRows ────────────────────────────────────────────

describe("availableRows", () => {
    it("letter = 52 - 12 = 40", () => {
        strictEqual(availableRows("letter"), 40);
    });

    it("a4 = 56 - 12 = 44", () => {
        strictEqual(availableRows("a4"), 44);
    });
});

// ── filterLogEvents ──────────────────────────────────────────

describe("filterLogEvents", () => {
    it("returns empty array for empty log", () => {
        const rules = RULES.USAWP;
        deepStrictEqual(filterLogEvents([], rules), []);
    });

    it("keeps regular events", () => {
        const rules = RULES.USAWP;
        const log = [
            { event: "G", period: 1, time: "7:00", team: "W", cap: "7" },
            { event: "E", period: 1, time: "6:00", team: "D", cap: "3" },
        ];
        strictEqual(filterLogEvents(log, rules).length, 2);
    });

    it("keeps period-end markers", () => {
        const rules = RULES.USAWP;
        const log = [
            { event: "G", period: 1, time: "7:00", team: "W", cap: "7" },
            { event: "---", period: 1 },
        ];
        const result = filterLogEvents(log, rules);
        strictEqual(result.length, 2);
        strictEqual(result[1].event, "---");
    });

    it("filters out statsOnly events", () => {
        const rules = RULES.USAWP;
        const log = [
            { event: "G", period: 1, time: "7:00", team: "W", cap: "7" },
            { event: "Shot", period: 1, time: "6:00", team: "W", cap: "7" },
            { event: "Assist", period: 1, time: "5:00", team: "W", cap: "9" },
        ];
        const result = filterLogEvents(log, rules);
        strictEqual(result.length, 1);
        strictEqual(result[0].event, "G");
    });

    it("preserves order", () => {
        const rules = RULES.USAWP;
        const log = [
            { event: "E", period: 1, time: "7:00", team: "W", cap: "7" },
            { event: "Shot", period: 1, time: "6:30", team: "W", cap: "7" },
            { event: "G", period: 1, time: "6:00", team: "D", cap: "3" },
            { event: "---", period: 1 },
            { event: "P", period: 2, time: "7:00", team: "W", cap: "5" },
        ];
        const result = filterLogEvents(log, rules);
        strictEqual(result.length, 4);
        strictEqual(result[0].event, "E");
        strictEqual(result[1].event, "G");
        strictEqual(result[2].event, "---");
        strictEqual(result[3].event, "P");
    });

    it("works with NFHS rules", () => {
        const rules = RULES.NFHSVA;
        const log = [
            { event: "G", period: 1, time: "7:00", team: "W", cap: "7" },
            { event: "MAM", period: 1, time: "6:00", team: "D", cap: "3" },
            { event: "Shot", period: 1, time: "5:00", team: "W", cap: "7" },
        ];
        const result = filterLogEvents(log, rules);
        strictEqual(result.length, 2); // G + MAM, Shot filtered
        strictEqual(result[0].event, "G");
        strictEqual(result[1].event, "MAM");
    });
});

// ── buildLogPagePlan ─────────────────────────────────────────

describe("buildLogPagePlan", () => {
    it("returns empty array for 0 events", () => {
        deepStrictEqual(buildLogPagePlan(0, 40), []);
    });

    it("returns empty array when availRows <= 1", () => {
        deepStrictEqual(buildLogPagePlan(10, 1), []);
        deepStrictEqual(buildLogPagePlan(10, 0), []);
    });

    it("single event → 1 page, 1 column", () => {
        const plan = buildLogPagePlan(1, 40);
        strictEqual(plan.length, 1);
        strictEqual(plan[0].startIndex, 0);
        strictEqual(plan[0].endIndex, 1);
        strictEqual(plan[0].colCount, 1);
    });

    it("exactly rowsPerColumn events → 1 column", () => {
        // availRows=40, rowsPerColumn=39 (minus 1 for thead)
        const plan = buildLogPagePlan(39, 40);
        strictEqual(plan.length, 1);
        strictEqual(plan[0].colCount, 1);
    });

    it("rowsPerColumn + 1 events → 2 columns", () => {
        const plan = buildLogPagePlan(40, 40);
        strictEqual(plan.length, 1);
        strictEqual(plan[0].colCount, 2);
    });

    it("2 * rowsPerColumn events → 2 columns", () => {
        const plan = buildLogPagePlan(78, 40);
        strictEqual(plan.length, 1);
        strictEqual(plan[0].colCount, 2);
    });

    it("2 * rowsPerColumn + 1 events → 3 columns", () => {
        const plan = buildLogPagePlan(79, 40);
        strictEqual(plan.length, 1);
        strictEqual(plan[0].colCount, 3);
    });

    it("max 3 columns per page", () => {
        // 3 * 39 = 117 events = exactly 1 page of 3 columns
        const plan = buildLogPagePlan(117, 40);
        strictEqual(plan.length, 1);
        strictEqual(plan[0].colCount, 3);
    });

    it("overflows to second page", () => {
        // 118 events = 1 full page (117) + 1 on second page
        const plan = buildLogPagePlan(118, 40);
        strictEqual(plan.length, 2);
        strictEqual(plan[0].startIndex, 0);
        strictEqual(plan[0].endIndex, 117);
        strictEqual(plan[0].colCount, 3);
        strictEqual(plan[1].startIndex, 117);
        strictEqual(plan[1].endIndex, 118);
        strictEqual(plan[1].colCount, 1);
    });

    it("exact multi-page boundary", () => {
        // 234 events = exactly 2 pages of 117 each
        const plan = buildLogPagePlan(234, 40);
        strictEqual(plan.length, 2);
        strictEqual(plan[0].endIndex, 117);
        strictEqual(plan[1].startIndex, 117);
        strictEqual(plan[1].endIndex, 234);
    });

    it("start/end indices are contiguous", () => {
        const plan = buildLogPagePlan(300, 40);
        ok(plan.length > 1);
        for (let i = 1; i < plan.length; i++) {
            strictEqual(plan[i].startIndex, plan[i - 1].endIndex);
        }
        strictEqual(plan[plan.length - 1].endIndex, 300);
    });
});

// ── buildSummaryDescriptors ──────────────────────────────────

describe("buildSummaryDescriptors", () => {
    it("returns 4 descriptors for new game", () => {
        const g = Game.create("USAWP");
        const desc = buildSummaryDescriptors(g);
        strictEqual(desc.length, 4);
        strictEqual(desc[0].type, "periodScores");
        strictEqual(desc[1].type, "fouls");
        strictEqual(desc[2].type, "timeouts");
        strictEqual(desc[3].type, "cards");
    });

    it("periodScores always has 2 data rows", () => {
        const g = Game.create("USAWP");
        const desc = buildSummaryDescriptors(g);
        strictEqual(desc[0].titleRows, 1);
        strictEqual(desc[0].theadRows, 1);
        strictEqual(desc[0].dataRows, 2);
    });

    it("empty fouls → theadRows=0, dataRows=1 (message)", () => {
        const g = Game.create("USAWP");
        const desc = buildSummaryDescriptors(g);
        strictEqual(desc[1].theadRows, 0);
        strictEqual(desc[1].dataRows, 1);
    });

    it("fouls with data → theadRows=1, dataRows=foul count", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "E" });
        const desc = buildSummaryDescriptors(g);
        strictEqual(desc[1].theadRows, 1);
        strictEqual(desc[1].dataRows, 2);
    });

    it("timeouts with data → correct row count", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        Game.addEvent(g, { period: 2, time: "5:00", team: "D", event: "TO30" });
        Game.addEvent(g, { period: 3, time: "4:00", team: "W", event: "TO" });
        const desc = buildSummaryDescriptors(g);
        strictEqual(desc[2].type, "timeouts");
        strictEqual(desc[2].theadRows, 1);
        strictEqual(desc[2].dataRows, 3);
    });

    it("cards with data → correct row count", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "C", event: "YC" });
        const desc = buildSummaryDescriptors(g);
        strictEqual(desc[3].type, "cards");
        strictEqual(desc[3].theadRows, 1);
        strictEqual(desc[3].dataRows, 1);
    });

    it("includes data objects for rendering", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        const desc = buildSummaryDescriptors(g);
        ok(desc[0].data); // periodScores data
        ok(desc[0].data.periods);
    });
});

// ── buildStatsDescriptors ────────────────────────────────────

describe("buildStatsDescriptors", () => {
    it("returns empty array when no stats events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        const desc = buildStatsDescriptors(g);
        strictEqual(desc.length, 0);
    });

    it("returns per-team descriptors", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "Shot" });
        const desc = buildStatsDescriptors(g);
        ok(desc.length >= 2);
        ok(desc.some(d => d.team === "W"));
        ok(desc.some(d => d.team === "D"));
        strictEqual(desc[0].type, "teamStats");
    });

    it("dataRows = playerCount + 1 (totals row)", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "9", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "D", cap: "3", event: "Shot" });
        const desc = buildStatsDescriptors(g);
        const wDesc = desc.find(d => d.team === "W");
        const dDesc = desc.find(d => d.team === "D");
        strictEqual(wDesc.dataRows, 3); // 2 players + 1 totals
        strictEqual(dDesc.dataRows, 2); // 1 player + 1 totals
    });

    it("theadRows uses rotatedHeaderRows in default totals mode", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        const desc = buildStatsDescriptors(g);
        // "Shot" = 4 chars → (4*5+8)/18 = ceil(1.56) = 2 rows
        ok(desc[0].theadRows >= 1);
        strictEqual(desc[0].totalsOnly, true);
    });

    it("theadRows is 2 in periods mode", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        const desc = buildStatsDescriptors(g, null, "periods");
        strictEqual(desc[0].theadRows, 2);
        strictEqual(desc[0].totalsOnly, false);
    });

    it("carries statsData and statChunk", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        const desc = buildStatsDescriptors(g);
        ok(desc[0].statsData);
        ok(Array.isArray(desc[0].statChunk));
    });

    it("splits into chunks with paperSize", () => {
        const g = Game.create("USAWP");
        // Add many stat types to force splitting
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "4:00", team: "W", cap: "7", event: "Assist" });
        Game.addEvent(g, { period: 1, time: "3:00", team: "W", cap: "7", event: "Steal" });
        // With paperSize, may produce more descriptors per team if chunks are needed
        const descNoSplit = buildStatsDescriptors(g);
        const descSplit = buildStatsDescriptors(g, "letter");
        // Both should have W + D descriptors
        ok(descNoSplit.length >= 2);
        ok(descSplit.length >= 2);
        ok(Array.isArray(descSplit));
    });

    it("returns empty for game with only team-level events", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", event: "TO" });
        const desc = buildStatsDescriptors(g);
        strictEqual(desc.length, 0);
    });
});

// ── paginateItems ────────────────────────────────────────────

describe("paginateItems", () => {
    it("returns single empty page for no descriptors", () => {
        const result = paginateItems([], 40);
        strictEqual(result.length, 1);
        strictEqual(result[0].items.length, 0);
    });

    it("single small item fits on one page", () => {
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 3 },
        ], 40);
        strictEqual(result.length, 1);
        strictEqual(result[0].items.length, 1);
        strictEqual(result[0].items[0].index, 0);
        strictEqual(result[0].items[0].startRow, 0);
        strictEqual(result[0].items[0].endRow, 3);
        strictEqual(result[0].items[0].continued, false);
    });

    it("multiple small items fit on one page", () => {
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 3 }, // 5 rows
            { titleRows: 1, theadRows: 1, dataRows: 2 }, // 4 rows + 1 spacing = 5
            { titleRows: 1, theadRows: 1, dataRows: 1 }, // 3 rows + 1 spacing = 4
        ], 40); // total = 5 + 5 + 4 = 14, fits in 40
        strictEqual(result.length, 1);
        strictEqual(result[0].items.length, 3);
    });

    it("items overflow to next page", () => {
        // First item fills 38 rows, leaving 2. Second needs spacing(1)+title(1)+thead(1)+1=4 min.
        // Can't start → pushed to next page entirely.
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 36 }, // 38 rows
            { titleRows: 1, theadRows: 1, dataRows: 5 },  // needs 3 min start, only 2-1=1 left
        ], 40);
        strictEqual(result.length, 2);
        strictEqual(result[0].items.length, 1);
        strictEqual(result[1].items.length, 1);
        strictEqual(result[1].items[0].index, 1);
        strictEqual(result[1].items[0].continued, false);
    });

    it("non-table item (theadRows=0) still paginates", () => {
        const result = paginateItems([
            { titleRows: 1, theadRows: 0, dataRows: 1 }, // empty message
        ], 40);
        strictEqual(result.length, 1);
        strictEqual(result[0].items[0].endRow, 1);
    });

    it("splits large table across pages", () => {
        // Item needs 1+1+50=52 rows, but only 40 available
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 50 },
        ], 40);
        ok(result.length >= 2);
        // First chunk
        strictEqual(result[0].items[0].startRow, 0);
        strictEqual(result[0].items[0].continued, false);
        // Second chunk should have continued=true
        strictEqual(result[1].items[0].continued, true);
        strictEqual(result[1].items[0].index, 0);
    });

    it("continued chunks have correct startRow/endRow", () => {
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 100 },
        ], 40);
        // All data rows should be covered
        let totalDataRows = 0;
        for (const page of result) {
            for (const item of page.items) {
                totalDataRows += item.endRow - item.startRow;
            }
        }
        strictEqual(totalDataRows, 100);
    });

    it("anti-orphan: flushes to next page if can't fit title+thead+1", () => {
        // Fill page almost completely, then add a splittable table
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 36 }, // 38 rows, 2 remaining
            { titleRows: 1, theadRows: 1, dataRows: 5 },  // needs title+thead+1=3 min, but only 2-1(spacing)=1 remaining
        ], 40);
        strictEqual(result.length, 2);
        strictEqual(result[1].items[0].index, 1);
        strictEqual(result[1].items[0].continued, false);
    });

    it("spacing between items on same page", () => {
        // Two items that almost fill the page with spacing
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 18 }, // 20 rows
            { titleRows: 1, theadRows: 1, dataRows: 18 }, // 20 rows + 1 spacing = 21
        ], 41); // total = 41, exactly fits
        strictEqual(result.length, 1);
        strictEqual(result[0].items.length, 2);
    });

    it("exact fit on page boundary", () => {
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 38 }, // 40 rows = exactly fill the page
        ], 40);
        strictEqual(result.length, 1);
        strictEqual(result[0].items[0].endRow, 38);
    });

    it("preserves descriptor indices across pages", () => {
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 38 }, // fills page 1
            { titleRows: 1, theadRows: 1, dataRows: 38 }, // fills page 2
            { titleRows: 1, theadRows: 1, dataRows: 5 },  // page 3
        ], 40);
        strictEqual(result.length, 3);
        strictEqual(result[0].items[0].index, 0);
        strictEqual(result[1].items[0].index, 1);
        strictEqual(result[2].items[0].index, 2);
    });

    it("split table produces contiguous startRow/endRow ranges", () => {
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 200 },
        ], 40);
        let lastEnd = 0;
        for (const page of result) {
            for (const item of page.items) {
                strictEqual(item.startRow, lastEnd);
                ok(item.endRow > item.startRow);
                lastEnd = item.endRow;
            }
        }
        strictEqual(lastEnd, 200);
    });
});

// ── filterLogEvents — additional rule sets ───────────────────

describe("filterLogEvents — rule set coverage", () => {
    it("works with NCAA rules", () => {
        const rules = RULES.NCAA;
        const log = [
            { event: "G", period: 1, time: "7:00", team: "W", cap: "7" },
            { event: "E", period: 1, time: "6:00", team: "D", cap: "3" },
            { event: "YRC", period: 1, time: "5:00", team: "W", cap: "C" },
            { event: "Shot", period: 1, time: "4:00", team: "W", cap: "7" },
        ];
        const result = filterLogEvents(log, rules);
        strictEqual(result.length, 3); // G, E, YRC — Shot filtered
    });

    it("works with NFHS JV rules", () => {
        const rules = RULES.NFHSJV;
        const log = [
            { event: "G", period: 1, time: "6:00", team: "W", cap: "7" },
            { event: "TO", period: 1, time: "5:00", team: "D" },
            { event: "Steal", period: 1, time: "4:00", team: "W", cap: "7" },
        ];
        const result = filterLogEvents(log, rules);
        strictEqual(result.length, 2); // G + TO, Steal filtered
    });

    it("returns empty if log is all statsOnly events", () => {
        const rules = RULES.USAWP;
        const log = [
            { event: "Shot", period: 1, time: "7:00", team: "W", cap: "7" },
            { event: "Assist", period: 1, time: "6:00", team: "W", cap: "9" },
            { event: "Steal", period: 1, time: "5:00", team: "D", cap: "3" },
        ];
        strictEqual(filterLogEvents(log, rules).length, 0);
    });

    it("keeps events with unknown codes (defensive)", () => {
        const rules = RULES.USAWP;
        const log = [
            { event: "UNKNOWN", period: 1, time: "7:00", team: "W", cap: "7" },
        ];
        // Unknown event = no eventDef found = !eventDef = true = kept
        strictEqual(filterLogEvents(log, rules).length, 1);
    });
});

// ── buildLogPagePlan — A4 paper size ─────────────────────────

describe("buildLogPagePlan — A4 paper", () => {
    const a4Avail = 44; // availableRows("a4")

    it("rowsPerColumn is 43 for A4", () => {
        // 1 event → 1 col
        const plan = buildLogPagePlan(43, a4Avail);
        strictEqual(plan[0].colCount, 1);
    });

    it("44 events → 2 columns on A4", () => {
        const plan = buildLogPagePlan(44, a4Avail);
        strictEqual(plan[0].colCount, 2);
    });

    it("max 3*43=129 events per A4 page", () => {
        const plan = buildLogPagePlan(129, a4Avail);
        strictEqual(plan.length, 1);
        strictEqual(plan[0].colCount, 3);
    });

    it("130 events → 2 pages on A4", () => {
        const plan = buildLogPagePlan(130, a4Avail);
        strictEqual(plan.length, 2);
        strictEqual(plan[0].endIndex, 129);
    });
});

// ── buildSummaryDescriptors — populated games ────────────────

describe("buildSummaryDescriptors — populated games", () => {
    it("all sections populated", () => {
        const g = Game.create("USAWP");
        // Goals
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
        // Fouls
        Game.addEvent(g, { period: 1, time: "5:00", team: "W", cap: "7", event: "E" });
        Game.addEvent(g, { period: 2, time: "7:00", team: "D", cap: "3", event: "P" });
        Game.addEvent(g, { period: 2, time: "6:00", team: "W", cap: "9", event: "E" });
        // Timeouts
        Game.addEvent(g, { period: 2, time: "5:00", team: "W", event: "TO" });
        // Cards
        Game.addEvent(g, { period: 3, time: "7:00", team: "W", cap: "C", event: "YC" });
        Game.addEvent(g, { period: 3, time: "6:00", team: "D", cap: "AC", event: "RC" });

        const desc = buildSummaryDescriptors(g);
        strictEqual(desc.length, 4);

        // All sections have real data
        strictEqual(desc[0].theadRows, 1); // periodScores always has thead
        strictEqual(desc[1].theadRows, 1); // fouls with data
        strictEqual(desc[1].dataRows, 3);  // 3 players fouled
        strictEqual(desc[2].theadRows, 1); // timeout with data
        strictEqual(desc[2].dataRows, 1);  // 1 timeout
        strictEqual(desc[3].theadRows, 1); // cards with data
        strictEqual(desc[3].dataRows, 2);  // 2 cards
    });

    it("total rows match expectations for sum", () => {
        const g = Game.create("USAWP");
        const desc = buildSummaryDescriptors(g);
        // Empty game: periodScores(1+1+2=4) + fouls(1+0+1=2) + timeouts(1+0+1=2) + cards(1+0+1=2) = 10
        let totalRows = 0;
        for (const d of desc) {
            totalRows += d.titleRows + d.theadRows + d.dataRows;
        }
        strictEqual(totalRows, 10);
    });

    it("works with NFHS Varsity", () => {
        const g = Game.create("NFHSVA");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "MAM" });
        const desc = buildSummaryDescriptors(g);
        strictEqual(desc[1].type, "fouls");
        strictEqual(desc[1].dataRows, 1); // MAM is a personal foul
    });

    it("data objects match sheet-data builder outputs", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "G" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "E" });
        const desc = buildSummaryDescriptors(g);
        // periodScores data should have correct totals
        strictEqual(desc[0].data.totalWhite, "1");
        // fouls data should have correct details
        ok(Array.isArray(desc[1].data));
        strictEqual(desc[1].data.length, 1);
        strictEqual(desc[1].data[0].cap, "7");
    });
});

// ── buildStatsDescriptors — additional coverage ────────────────

describe("buildStatsDescriptors — additional", () => {
    it("multiple stat types included in statChunk", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "W", cap: "7", event: "Assist" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "D", cap: "3", event: "Steal" });
        const desc = buildStatsDescriptors(g);
        const wDesc = desc.find(d => d.team === "W");
        ok(wDesc);
        // Should have all 3 stat types in the chunk (no split without paperSize)
        const codes = wDesc.statChunk.map(sc => sc.code);
        ok(codes.includes("Shot"));
        ok(codes.includes("Assist"));
        ok(codes.includes("Steal"));
    });

    it("asymmetric teams: more dark caps than white", () => {
        const g = Game.create("USAWP");
        Game.addEvent(g, { period: 1, time: "7:00", team: "W", cap: "7", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "6:00", team: "D", cap: "3", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "5:00", team: "D", cap: "5", event: "Shot" });
        Game.addEvent(g, { period: 1, time: "4:00", team: "D", cap: "9", event: "Shot" });
        const desc = buildStatsDescriptors(g);
        const wDesc = desc.find(d => d.team === "W");
        const dDesc = desc.find(d => d.team === "D");
        strictEqual(wDesc.dataRows, 2); // 1 player + totals
        strictEqual(dDesc.dataRows, 4); // 3 players + totals
    });
});

// ── Column constants ─────────────────────────────────────────

describe("column constants", () => {
    it("PAGE_WIDTH has letter and a4", () => {
        strictEqual(PAGE_WIDTH.letter, 720);
        strictEqual(PAGE_WIDTH.a4, 698);
    });

    it("STATS_COL_WIDTH is 20", () => {
        strictEqual(STATS_COL_WIDTH, 20);
    });

    it("STATS_CAP_COL_WIDTH is 40", () => {
        strictEqual(STATS_CAP_COL_WIDTH, 40);
    });
});

// ── maxStatsPerTable ─────────────────────────────────────

describe("maxStatsPerTable", () => {
    it("letter with 4 periods = floor((720-40)/(5*20)) = 6", () => {
        strictEqual(maxStatsPerTable("letter", 4), 6);
    });

    it("a4 with 4 periods = floor((698-40)/(5*20)) = 6", () => {
        strictEqual(maxStatsPerTable("a4", 4), 6);
    });

    it("letter with 6 periods (OT) = floor((720-40)/(7*20)) = 4", () => {
        strictEqual(maxStatsPerTable("letter", 6), 4);
    });

    it("returns at least 1", () => {
        ok(maxStatsPerTable("letter", 100) >= 1);
    });
});

// ── rotatedHeaderRows ───────────────────────────────────

describe("rotatedHeaderRows", () => {
    it("short name: 'Shot' = 4 chars → (4*9+8)/18 = 3 rows", () => {
        strictEqual(rotatedHeaderRows([{name: "Shot"}]), 3);
    });

    it("long name: 'Penalty-Exclusions' = 19 chars → (19*9+8)/18 = 10 rows", () => {
        strictEqual(rotatedHeaderRows([{name: "Penalty-Exclusions"}]), 10);
    });

    it("uses longest name in chunk", () => {
        const chunk = [{name: "Shot"}, {name: "Drawn Exclusion"}, {name: "G"}];
        // "Drawn Exclusion" = 15 chars → (15*9+8)/18 = ceil(7.9) = 8
        strictEqual(rotatedHeaderRows(chunk), 8);
    });

    it("returns at least 1", () => {
        ok(rotatedHeaderRows([{name: ""}]) >= 1);
    });

    it("ROTATED_CHAR_PX is 9", () => {
        strictEqual(ROTATED_CHAR_PX, 9);
    });
});

// ── splitStatColumns ─────────────────────────────────────

describe("splitStatColumns", () => {
    const cols = [{code: "A"}, {code: "B"}, {code: "C"}, {code: "D"}, {code: "E"}];

    it("no split when all fit", () => {
        const result = splitStatColumns(cols, 10);
        strictEqual(result.length, 1);
        deepStrictEqual(result[0], cols);
    });

    it("splits into correct chunks", () => {
        const result = splitStatColumns(cols, 2);
        strictEqual(result.length, 3);
        strictEqual(result[0].length, 2);
        strictEqual(result[1].length, 2);
        strictEqual(result[2].length, 1);
    });

    it("handles exact division", () => {
        const fourCols = [{code: "A"}, {code: "B"}, {code: "C"}, {code: "D"}];
        const result = splitStatColumns(fourCols, 2);
        strictEqual(result.length, 2);
    });
});

// ── paginateItems — edge cases ───────────────────────────────

describe("paginateItems — edge cases", () => {
    it("multi-split: table spanning 3+ pages", () => {
        // 200 data rows, overhead=2, avail=10 → 8 data rows per chunk → ceil(200/8)=25 pages
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 200 },
        ], 10);
        strictEqual(result.length, 25);
        // First chunk is not continued
        strictEqual(result[0].items[0].continued, false);
        // All subsequent chunks are continued
        for (let i = 1; i < result.length; i++) {
            strictEqual(result[i].items[0].continued, true);
        }
    });

    it("interleaved: small item then large split item", () => {
        // Small item takes 5 rows (1+1+3), then big item needs 50
        // avail=20: small fits on page 1, 15 left, big starts with overhead+1=3, 15>=3
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 3 },  // 5 rows
            { titleRows: 1, theadRows: 1, dataRows: 50 }, // needs splitting
        ], 20);
        // Page 1: small item + start of big item
        strictEqual(result[0].items.length, 2);
        strictEqual(result[0].items[0].index, 0); // small
        strictEqual(result[0].items[1].index, 1); // first chunk of big
        strictEqual(result[0].items[1].continued, false);
        // Remaining pages: continued chunks of big item
        for (let i = 1; i < result.length; i++) {
            strictEqual(result[i].items[0].index, 1);
            strictEqual(result[i].items[0].continued, true);
        }
    });

    it("all non-splittable items (theadRows=0)", () => {
        const items = Array.from({ length: 5 }, () => ({
            titleRows: 1, theadRows: 0, dataRows: 1, // 2 rows each
        }));
        const result = paginateItems(items, 10);
        // 5 items: 2 + (1+2) + (1+2) + (1+2) + (1+2) = 2+3+3+3+3 = 14 rows, needs 2 pages
        strictEqual(result.length, 2);
    });

    it("many tiny items fill multiple pages", () => {
        // 20 items, each 3 rows (1+1+1), spacing adds 1 between
        // First item: 3. Each subsequent: 4. Total = 3 + 19*4 = 79
        const items = Array.from({ length: 20 }, () => ({
            titleRows: 1, theadRows: 1, dataRows: 1,
        }));
        const result = paginateItems(items, 20);
        // Should fit ~5 per page (3 + 4 + 4 + 4 + 4 = 19 ≤ 20, next would be 23 > 20)
        let totalItems = 0;
        for (const page of result) totalItems += page.items.length;
        strictEqual(totalItems, 20);
    });

    it("minimal availRows: just enough for overhead + 1", () => {
        // availRows=3, overhead=2 (title+thead), so exactly 1 data row fits per page
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 5 },
        ], 3);
        strictEqual(result.length, 5); // 1 data row per page
        for (let i = 0; i < 5; i++) {
            strictEqual(result[i].items[0].startRow, i);
            strictEqual(result[i].items[0].endRow, i + 1);
        }
    });

    it("mix of split and whole items", () => {
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 38 }, // exactly fills page 1
            { titleRows: 1, theadRows: 0, dataRows: 1 },  // non-splittable, page 2
            { titleRows: 1, theadRows: 1, dataRows: 50 }, // split starting page 2
        ], 40);
        strictEqual(result[0].items.length, 1);
        strictEqual(result[0].items[0].index, 0);
        // Page 2 starts with item 1 (non-splittable) then item 2 starts
        ok(result[1].items.length >= 1);
        strictEqual(result[1].items[0].index, 1); // non-splittable
    });

    it("item that exactly fills remaining space after spacing", () => {
        // First item: 10 rows. Spacing: 1. Second item: 29 rows (1+1+27). Total: 10+1+29=40
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 8 },  // 10 rows
            { titleRows: 1, theadRows: 1, dataRows: 27 }, // 29 rows + 1 spacing = 30
        ], 40);
        strictEqual(result.length, 1);
        strictEqual(result[0].items.length, 2);
    });

    it("single row overflow triggers new page", () => {
        // 10 + 1(spacing) + 30 = 41 > 40
        const result = paginateItems([
            { titleRows: 1, theadRows: 1, dataRows: 8 },  // 10 rows
            { titleRows: 1, theadRows: 1, dataRows: 28 }, // 30 rows + 1 spacing = 31
        ], 40);
        // Second item starts on page 1 (can fit overhead+1=3), splits continuation
        ok(result.length >= 1);
        // Verify all data is covered
        let dataSum = 0;
        for (const page of result) {
            for (const item of page.items) {
                dataSum += item.endRow - item.startRow;
            }
        }
        strictEqual(dataSum, 8 + 28);
    });

    it("no page exceeds availRows", () => {
        const descriptors = [
            { titleRows: 1, theadRows: 1, dataRows: 15 },
            { titleRows: 1, theadRows: 1, dataRows: 30 },
            { titleRows: 1, theadRows: 0, dataRows: 1 },
            { titleRows: 1, theadRows: 1, dataRows: 8 },
        ];
        const avail = 25;
        const result = paginateItems(descriptors, avail);
        for (let p = 0; p < result.length; p++) {
            let pageRows = 0;
            for (let i = 0; i < result[p].items.length; i++) {
                const item = result[p].items[i];
                const desc = descriptors[item.index];
                if (i > 0) pageRows += 1; // spacing
                pageRows += desc.titleRows + desc.theadRows + (item.endRow - item.startRow);
            }
            ok(pageRows <= avail, `page ${p} uses ${pageRows} rows, max ${avail}`);
        }
    });
});

// ── Integration invariants ───────────────────────────────────

describe("pagination invariants with test data", () => {
    for (const file of ["small-game.json", "medium-game.json", "large-game.json"]) {
        describe(file, () => {
            const gameData = loadTestData(file);
            const rules = RULES[gameData.rules];

            for (const paperSize of ["letter", "a4"]) {
                describe(`${paperSize} paper`, () => {
                    const avail = availableRows(paperSize);

                    it("log plan covers all events contiguously", () => {
                        const filtered = filterLogEvents(gameData.log, rules);
                        const plan = buildLogPagePlan(filtered.length, avail);
                        if (plan.length === 0) return;
                        strictEqual(plan[0].startIndex, 0);
                        for (let i = 1; i < plan.length; i++) {
                            strictEqual(plan[i].startIndex, plan[i - 1].endIndex);
                        }
                        strictEqual(plan[plan.length - 1].endIndex, filtered.length);
                    });

                    it("log plan column counts are 1-3", () => {
                        const filtered = filterLogEvents(gameData.log, rules);
                        const plan = buildLogPagePlan(filtered.length, avail);
                        for (const page of plan) {
                            ok(page.colCount >= 1 && page.colCount <= 3,
                                `colCount ${page.colCount} out of range`);
                        }
                    });

                    it("summary pagination covers all descriptor data", () => {
                        const desc = buildSummaryDescriptors(gameData);
                        const plan = paginateItems(desc, avail);
                        // Every descriptor index must appear at least once
                        const seenIndices = new Set();
                        for (const page of plan) {
                            for (const item of page.items) {
                                seenIndices.add(item.index);
                            }
                        }
                        for (let i = 0; i < desc.length; i++) {
                            ok(seenIndices.has(i), `descriptor ${i} (${desc[i].type}) missing from plan`);
                        }
                    });

                    it("summary pagination: data rows covered per descriptor", () => {
                        const desc = buildSummaryDescriptors(gameData);
                        const plan = paginateItems(desc, avail);
                        // Sum data rows rendered for each descriptor
                        const rowsPerDesc = new Map();
                        for (const page of plan) {
                            for (const item of page.items) {
                                const prev = rowsPerDesc.get(item.index) || 0;
                                rowsPerDesc.set(item.index, prev + (item.endRow - item.startRow));
                            }
                        }
                        for (let i = 0; i < desc.length; i++) {
                            strictEqual(rowsPerDesc.get(i), desc[i].dataRows,
                                `descriptor ${i} (${desc[i].type}): expected ${desc[i].dataRows} data rows, got ${rowsPerDesc.get(i)}`);
                        }
                    });

                    it("no summary page exceeds available rows", () => {
                        const desc = buildSummaryDescriptors(gameData);
                        const plan = paginateItems(desc, avail);
                        for (let p = 0; p < plan.length; p++) {
                            let pageRows = 0;
                            for (let i = 0; i < plan[p].items.length; i++) {
                                const item = plan[p].items[i];
                                const d = desc[item.index];
                                if (i > 0) pageRows += 1;
                                pageRows += d.titleRows + d.theadRows + (item.endRow - item.startRow);
                            }
                            ok(pageRows <= avail, `${file} ${paperSize} summary page ${p}: ${pageRows} rows > ${avail}`);
                        }
                    });

                    it("stats pagination covers all descriptors if present", () => {
                        const desc = buildStatsDescriptors(gameData);
                        if (desc.length === 0) return;
                        const plan = paginateItems(desc, avail);
                        const seenIndices = new Set();
                        for (const page of plan) {
                            for (const item of page.items) seenIndices.add(item.index);
                        }
                        for (let i = 0; i < desc.length; i++) {
                            ok(seenIndices.has(i), `stats descriptor ${i} (${desc[i].team}) missing`);
                        }
                    });
                });
            }
        });
    }
});

