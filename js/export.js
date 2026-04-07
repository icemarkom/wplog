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

import { Game } from './game.js';
import { formatTime } from './time.js';

// wplog — Export Utilities (pure, no DOM)

/**
 * Sanitize a name for use in filenames.
 * Replaces whitespace with hyphens, strips non-alphanumeric characters.
 */
export function sanitizeName(name) {
    return name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

/**
 * Build an export filename from game metadata.
 * Format: wplog-DATE[-TEAM1-TEAM2]-TIME.ext
 * @param {object} game - Game data object
 * @param {string} ext - File extension including dot (e.g., ".csv")
 * @returns {string} Filename
 */
export function buildFilename(game, ext) {
    const parts = ["wplog"];

    // Date
    const date = game.date || new Date().toISOString().slice(0, 10);
    parts.push(date);

    // Teams (only if custom) — ordered home-first
    const teams = Game.getTeams(game);
    const t0 = teams[0], t1 = teams[1];
    if (t0.name !== t0.defaultName || t1.name !== t1.defaultName) {
        parts.push(sanitizeName(t0.name !== t0.defaultName ? t0.name : t0.defaultName));
        parts.push(sanitizeName(t1.name !== t1.defaultName ? t1.name : t1.defaultName));
    }

    // Time: startTime if set, else current time
    const time = game.startTime
        ? game.startTime.replace(":", "")
        : new Date().toTimeString().slice(0, 5).replace(":", "");
    parts.push(time);

    return parts.join("-") + ext;
}

/**
 * Escape a value for CSV (RFC 4180).
 * Quotes the value if it contains commas, double quotes, or newlines.
 */
export function csvEscape(val) {
    const str = String(val);
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return "\"" + str.replace(/"/g, "\"\"") + "\"";
    }
    return str;
}

/**
 * Build complete CSV content from a game's log.
 * @param {object} game - Game data object
 * @returns {string} CSV string with header and trailing newline
 */
export function buildCSV(game) {
    const header = "deviceTime,seq,period,time,team,cap,event";
    const rows = game.log.map((e) => {
        return [
            e.deviceTime || "",
            e.seq || "",
            e.period || "",
            (e.time !== null && e.time !== undefined) ? formatTime(e.time) : "",
            e.team || "",
            csvEscape(e.cap || ""),
            csvEscape(e.event || ""),
        ].join(",");
    });
    return header + "\n" + rows.join("\n") + "\n";
}
