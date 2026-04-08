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

import { RULES } from './config.js';
import { csvEscape } from './export.js';

// wplog — Roster CSV Parser & Builder (pure, no DOM)

// Valid cap pattern: 1-99 with optional A/B/C goalie suffix, or coach codes
const RE_CAP = /^[1-9]\d?[ABC]?$/;

// Map standard coach codes to wplog internal codes
const COACH_ALIASES = {
    "C": "HC",   // Legacy internal C → new HC
};

// Valid roster cap codes (coach/special — B excluded, it's YC-only)
const SPECIAL_CAPS = new Set(["HC", "AC"]);

/**
 * Validate a cap value for roster import.
 * Returns the normalized cap string, or null if invalid.
 */
function normalizeRosterCap(raw) {
    const cap = raw.trim().toUpperCase();
    if (!cap) return null;

    // Check coach aliases first (HC → C)
    if (COACH_ALIASES[cap]) return COACH_ALIASES[cap];

    // Check special caps (C, AC)
    if (SPECIAL_CAPS.has(cap)) return cap;

    // Reject bench (B is not a valid roster entry)
    if (cap === "B") return "B"; // caller handles the warning

    // Check player cap pattern
    if (RE_CAP.test(cap)) return cap;

    return null;
}

/**
 * Parse a roster CSV string.
 *
 * Required header row with at least Cap and Name columns.
 * Optional ID column (only used when rule set has playerId).
 *
 * @param {string} text - CSV content
 * @param {string} rulesKey - Current game's rules key (to check playerId)
 * @returns {{ players: Array<{cap, name, id}>, duplicates: string[], errors: string[] }}
 */
export function parseRosterCSV(text, rulesKey) {
    const rules = RULES[rulesKey];
    const hasPlayerId = !!(rules && rules.playerId);

    const result = { players: [], duplicates: [], errors: [] };

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) {
        result.errors.push("File is empty.");
        return result;
    }

    // Parse header row
    const headerLine = lines[0];
    const headers = headerLine.split(",").map(h => h.trim().toLowerCase());

    const capIdx = headers.indexOf("cap");
    const nameIdx = headers.indexOf("name");
    const idIdx = headers.indexOf("id");

    if (capIdx === -1) {
        result.errors.push("Missing required 'Cap' column header.");
        return result;
    }
    if (nameIdx === -1) {
        result.errors.push("Missing required 'Name' column header.");
        return result;
    }

    // Parse data rows
    const seenCaps = new Set();

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        const rawCap = cols[capIdx] || "";
        const name = cols[nameIdx] || "";
        const id = (idIdx !== -1 && cols[idIdx]) ? cols[idIdx] : "";

        if (!rawCap && !name) continue; // skip fully empty rows

        const cap = normalizeRosterCap(rawCap);

        if (cap === null) {
            result.errors.push(`Row ${i + 1}: invalid cap "${rawCap}".`);
            continue;
        }

        if (cap === "B") {
            result.errors.push(`Row ${i + 1}: bench (B) is not a valid roster entry.`);
            continue;
        }

        // Duplicate check (first wins)
        if (seenCaps.has(cap)) {
            result.duplicates.push(cap);
            continue;
        }
        seenCaps.add(cap);

        const player = { cap, name };
        if (hasPlayerId && id) {
            player.id = id;
        }
        result.players.push(player);
    }

    return result;
}

/**
 * Merge parsed roster players into a game's team roster.
 * Overwrites existing entries for matching caps, adds new caps.
 *
 * @param {object} game - Game data object
 * @param {string} teamKey - "white" or "dark"
 * @param {Array<{cap, name, id}>} players - Parsed roster entries
 */
export function mergeRoster(game, teamKey, players) {
    if (!game[teamKey].roster) {
        game[teamKey].roster = {};
    }
    for (const p of players) {
        const entry = {};
        if (p.name) entry.name = p.name;
        if (p.id) entry.id = p.id;
        game[teamKey].roster[p.cap] = entry;
    }
}

/**
 * Build a roster CSV string for export.
 *
 * @param {object} game - Game data object
 * @param {string} teamKey - "white" or "dark"
 * @returns {string} CSV content with header and trailing newline
 */
export function buildRosterCSV(game, teamKey) {
    const rules = RULES[game.rules];
    const hasPlayerId = !!(rules && rules.playerId);
    const roster = game[teamKey] && game[teamKey].roster;
    if (!roster) return "";

    // Collect populated entries
    const entries = [];
    for (const [cap, data] of Object.entries(roster)) {
        if (data.name || data.id) {
            entries.push({ cap, name: data.name || "", id: data.id || "" });
        }
    }

    if (entries.length === 0) return "";

    // Sort: numeric caps first (ascending), then special (C, AC) last
    entries.sort((a, b) => {
        const aNum = parseInt(a.cap);
        const bNum = parseInt(b.cap);
        const aIsNum = !isNaN(aNum);
        const bIsNum = !isNaN(bNum);
        if (aIsNum && bIsNum) return aNum - bNum;
        if (aIsNum) return -1;
        if (bIsNum) return 1;
        return a.cap.localeCompare(b.cap);
    });

    // Build CSV
    const header = hasPlayerId ? "Cap,Name,ID" : "Cap,Name";
    const rows = entries.map(e => {
        const parts = [csvEscape(e.cap), csvEscape(e.name)];
        if (hasPlayerId) parts.push(csvEscape(e.id));
        return parts.join(",");
    });

    return header + "\n" + rows.join("\n") + "\n";
}

/**
 * Build a roster export filename.
 *
 * @param {object} game - Game data object
 * @param {string} teamKey - "white" or "dark"
 * @returns {string} Filename like "roster-TeamName-2026-04-08.csv"
 */
export function buildRosterFilename(game, teamKey) {
    const teamName = game[teamKey].name || (teamKey === "white" ? "White" : "Dark");
    const safeName = teamName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    const date = game.date || new Date().toISOString().slice(0, 10);
    return `roster-${safeName}-${date}.csv`;
}

/**
 * Check whether a game has any roster data for at least one team.
 *
 * @param {object} game - Game data object
 * @returns {boolean}
 */
export function hasRosterData(game) {
    for (const teamKey of ["white", "dark"]) {
        const roster = game[teamKey] && game[teamKey].roster;
        if (!roster) continue;
        for (const cap of Object.keys(roster)) {
            const entry = roster[cap];
            if (entry && (entry.name || entry.id)) return true;
        }
    }
    return false;
}
