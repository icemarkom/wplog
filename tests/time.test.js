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

import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { getMaxMinutes, parseTime, formatTimeDisplay } from "../js/time.js";

// ── getMaxMinutes ─────────────────────────────────────────

describe("getMaxMinutes", () => {
    it("returns periodLength for regulation periods", () => {
        strictEqual(getMaxMinutes(1, 8, 3), 8);
        strictEqual(getMaxMinutes(2, 8, 3), 8);
        strictEqual(getMaxMinutes(3, 7, 3), 7);
        strictEqual(getMaxMinutes(4, 6, 3), 6);
    });

    it("returns otPeriodLength for OT periods", () => {
        strictEqual(getMaxMinutes("OT1", 8, 3), 3);
        strictEqual(getMaxMinutes("OT2", 8, 5), 5);
        strictEqual(getMaxMinutes("OT3", 8, 4), 4);
    });

    it("returns 0 for SO", () => {
        strictEqual(getMaxMinutes("SO", 8, 3), 0);
    });

    it("defaults periodLength to 8 when falsy", () => {
        strictEqual(getMaxMinutes(1, 0, 3), 8);
        strictEqual(getMaxMinutes(1, null, 3), 8);
        strictEqual(getMaxMinutes(1, undefined, 3), 8);
    });

    it("defaults otPeriodLength to 3 when falsy", () => {
        strictEqual(getMaxMinutes("OT1", 8, 0), 3);
        strictEqual(getMaxMinutes("OT1", 8, null), 3);
        strictEqual(getMaxMinutes("OT1", 8, undefined), 3);
    });
});

// ── parseTime ─────────────────────────────────────────────

describe("parseTime", () => {
    it("returns null for empty input", () => {
        strictEqual(parseTime("", 8), null);
    });

    it("parses single digit (seconds only)", () => {
        deepStrictEqual(parseTime("4", 8), { display: "0:04", stored: "0:04" });
        deepStrictEqual(parseTime("0", 8), { display: "0:00", stored: "0:00" });
        deepStrictEqual(parseTime("9", 8), { display: "0:09", stored: "0:09" });
    });

    it("parses two digits (right-to-left fill)", () => {
        deepStrictEqual(parseTime("45", 8), { display: "0:45", stored: "0:45" });
        deepStrictEqual(parseTime("59", 8), { display: "0:59", stored: "0:59" });
        deepStrictEqual(parseTime("00", 8), { display: "0:00", stored: "0:00" });
        deepStrictEqual(parseTime("10", 8), { display: "0:10", stored: "0:10" });
    });

    it("parses three digits (M:SS)", () => {
        deepStrictEqual(parseTime("453", 8), { display: "4:53", stored: "4:53" });
        deepStrictEqual(parseTime("800", 8), { display: "8:00", stored: "8:00" });
        deepStrictEqual(parseTime("100", 8), { display: "1:00", stored: "1:00" });
        deepStrictEqual(parseTime("000", 8), { display: "0:00", stored: "0:00" });
    });

    it("rejects seconds > 59", () => {
        strictEqual(parseTime("60", 8), null);
        strictEqual(parseTime("99", 8), null);
        strictEqual(parseTime("160", 8), null);
    });

    it("caps at period length", () => {
        // 8-min quarter: 8:00 is valid, 8:01 is not
        deepStrictEqual(parseTime("800", 8), { display: "8:00", stored: "8:00" });
        strictEqual(parseTime("801", 8), null);
        strictEqual(parseTime("830", 8), null);
        strictEqual(parseTime("900", 8), null);

        // 7-min quarter
        deepStrictEqual(parseTime("700", 7), { display: "7:00", stored: "7:00" });
        strictEqual(parseTime("701", 7), null);
        strictEqual(parseTime("800", 7), null);

        // 3-min OT
        deepStrictEqual(parseTime("300", 3), { display: "3:00", stored: "3:00" });
        strictEqual(parseTime("301", 3), null);
        strictEqual(parseTime("400", 3), null);
    });

    it("rejects anything in SO (max 0)", () => {
        deepStrictEqual(parseTime("000", 0), { display: "0:00", stored: "0:00" });
        strictEqual(parseTime("1", 0), null);  // 0:01 > 0:00
        strictEqual(parseTime("100", 0), null);
    });

    it("handles boundary: exactly at max", () => {
        deepStrictEqual(parseTime("600", 6), { display: "6:00", stored: "6:00" });
        deepStrictEqual(parseTime("559", 6), { display: "5:59", stored: "5:59" });
    });
});

// ── formatTimeDisplay ─────────────────────────────────────

describe("formatTimeDisplay", () => {
    it("shows full placeholder for empty input", () => {
        const result = formatTimeDisplay("");
        strictEqual(
            result,
            '<span class="time-formatted">' +
            '<span class="time-placeholder">-</span>' +
            '<span class="time-placeholder">:</span>' +
            '<span class="time-placeholder">-</span>' +
            '<span class="time-placeholder">-</span>' +
            '</span>'
        );
    });

    it("fills one digit (rightmost position)", () => {
        const result = formatTimeDisplay("4");
        // M and S1 are placeholders, S2 is "4"
        strictEqual(
            result,
            '<span class="time-formatted">' +
            '<span class="time-placeholder">-</span>' +
            '<span>:</span>' +
            '<span class="time-placeholder">-</span>' +
            '4' +
            '</span>'
        );
    });

    it("fills two digits", () => {
        const result = formatTimeDisplay("45");
        // M is placeholder, S1="4", S2="5"
        strictEqual(
            result,
            '<span class="time-formatted">' +
            '<span class="time-placeholder">-</span>' +
            '<span>:</span>' +
            '4' +
            '5' +
            '</span>'
        );
    });

    it("fills three digits (all positions)", () => {
        const result = formatTimeDisplay("453");
        // M="4", S1="5", S2="3" — no placeholders
        strictEqual(
            result,
            '<span class="time-formatted">' +
            '4' +
            '<span>:</span>' +
            '5' +
            '3' +
            '</span>'
        );
    });

    it("colon has placeholder class only when no digits", () => {
        const empty = formatTimeDisplay("");
        strictEqual(empty.includes('class="time-placeholder">:</span>'), true);

        const one = formatTimeDisplay("1");
        strictEqual(one.includes('<span>:</span>'), true);
    });
});
