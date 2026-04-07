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
 * @param {number} periodLength - Period length in minutes (default 8)
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

    const isLong = maxMinutes >= 10;
    const targetLen = isLong ? 4 : 3;

    // Right-justify into positions
    const padded = digits.padStart(targetLen, "0");
    const minutes = parseInt(padded.slice(0, targetLen - 2));
    const seconds = parseInt(padded.slice(-2));

    if (seconds > 59) return null;

    // Cap at period length
    if (minutes > maxMinutes || (minutes === maxMinutes && seconds > 0)) return null;

    const totalSeconds = minutes * 60 + seconds;

    return {
        display: minutes + ":" + String(seconds).padStart(2, "0"),
        stored: totalSeconds,
    };
}

/**
 * Formats integer seconds back into M:SS display string.
 *
 * @param {number|null} seconds - Total seconds
 * @returns {string} Formatted game clock string
 */
export function formatTime(seconds) {
    if (typeof seconds !== "number") return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ":" + String(s).padStart(2, "0");
}

/**
 * Parses legacy M:SS strings into integer seconds.
 *
 * @param {string} timeStr - Legacy time string
 * @returns {number|null} Integer seconds
 */
export function parseLegacyTime(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return null;
    const parts = timeStr.split(":");
    if (parts.length === 2) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return null;
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
export function formatTimeDisplay(digits, maxMinutes = 9) {
    const isLong = maxMinutes >= 10;
    const targetLen = isLong ? 4 : 3;

    // Right-to-left fill into target positions
    const padded = digits.padStart(targetLen, "\0"); // pad with nulls
    const parts = [];

    for (let i = 0; i < targetLen; i++) {
        if (padded[i] === "\0") {
            parts.push(`<span class="time-placeholder">-</span>`);
        } else {
            parts.push(padded[i]);
        }
    }

    // Colon is dim only when no digits entered
    const colonClass = digits.length > 0 ? "" : ' class="time-placeholder"';

    if (isLong) {
        return `<span class="time-formatted">${parts[0]}${parts[1]}<span${colonClass}>:</span>${parts[2]}${parts[3]}</span>`;
    } else {
        // Minutes placeholder shows for 0-2 digits, hidden when 3 digits (minutes filled)
        return `<span class="time-formatted">${parts[0]}<span${colonClass}>:</span>${parts[1]}${parts[2]}</span>`;
    }
}
