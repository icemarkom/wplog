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

// wplog — Time Parsing Utilities (pure — no DOM, no game state)

/**
 * Returns the maximum minutes for a given period.
 *
 * @param {number|string} period - Current period (1-4, "OT1", "OT2", ..., "SO")
 * @param {number} periodLength - Quarter length in minutes (default 8)
 * @param {number|null} otPeriodLength - OT period length in minutes (default 3)
 * @returns {number} Maximum minutes allowed
 */
export function getMaxMinutes(period, periodLength, otPeriodLength) {
    if (period === "SO") return 0;
    if (typeof period === "string" && period.startsWith("OT")) {
        return otPeriodLength || 3;
    }
    return periodLength || 8;
}

/**
 * Parses raw digit input into a game clock time.
 *
 * Water polo game clock: M:SS format.
 * Digits fill right-to-left: S2, S1, M.
 *   "4"   → 0:04  (4 seconds)
 *   "45"  → 0:45  (45 seconds)
 *   "453" → 4:53  (4 min 53 sec)
 *
 * @param {string} digits - Raw digit string (0-3 chars)
 * @param {number} maxMinutes - Maximum minutes for the current period
 * @returns {{ display: string, stored: string } | null} Parsed time or null if invalid
 */
export function parseTime(digits, maxMinutes) {
    if (digits.length === 0) return null;

    // Right-justify into 3 positions: M S1 S2
    const padded = digits.padStart(3, "0");
    const minutes = parseInt(padded[0]);
    const seconds = parseInt(padded.slice(1));

    if (seconds > 59 || minutes > 9) return null;

    // Cap at period length
    if (minutes > maxMinutes || (minutes === maxMinutes && seconds > 0)) return null;

    return {
        display: minutes + ":" + String(seconds).padStart(2, "0"),
        stored: minutes + ":" + String(seconds).padStart(2, "0"),
    };
}

/**
 * Formats raw digit input into HTML for the time display.
 *
 * Right-to-left fill into M:S1S2 — placeholder is -:--.
 * Unfilled positions show as dim placeholder dashes.
 *
 * @param {string} digits - Raw digit string (0-3 chars)
 * @returns {string} HTML string with placeholder spans
 */
export function formatTimeDisplay(digits) {
    // Right-to-left fill into M:S1S2 — placeholder is -:--
    const padded = digits.padStart(3, "\0"); // pad with nulls
    const parts = [];

    for (let i = 0; i < 3; i++) {
        if (padded[i] === "\0") {
            parts.push(`<span class="time-placeholder">-</span>`);
        } else {
            parts.push(padded[i]);
        }
    }

    // Colon is dim only when no digits entered
    const colonClass = digits.length > 0 ? "" : ' class="time-placeholder"';

    // Minutes placeholder shows for 0-2 digits, hidden when 3 digits (minutes filled)
    return `<span class="time-formatted">${parts[0]}<span${colonClass}>:</span>${parts[1]}${parts[2]}</span>`;
}
