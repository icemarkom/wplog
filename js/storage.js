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

import { RULES, DEFAULTS } from './config.js';

// wplog — localStorage Persistence + Game Data Validation

// ── Constants ────────────────────────────────────────────────

const MAX_FILE_SIZE = 128 * 1024;   // 128 KB
const MAX_LOG_ENTRIES = 10000;
const MAX_TEAM_NAME = 100;
const MAX_LOCATION = 200;
const MAX_GAME_ID = 50;
const MAX_NOTE = 500;

// ── Validation Patterns ──────────────────────────────────────

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_TIME_HM = /^\d{2}:\d{2}$/;
const RE_GAME_TIME = /^\d{1,2}:[0-5]\d(?::[0-5]\d)?$/;
const RE_CAP = /^[1-9]\d?[ABC]?$/;
const RE_PERIOD_OT = /^OT([1-9]\d?)$/;

// ── Validation ───────────────────────────────────────────────

/**
 * Validate and sanitize parsed game data.
 * Returns { valid: true, data: cleanObject } or { valid: false, error: string }.
 */
export function validateGameData(parsed) {
    try {
        // Must be a plain object
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return _fail("Data must be a JSON object.");
        }

        // ── Game-level fields ────────────────────────────

        // rules (required)
        const validRulesKeys = Object.keys(RULES).filter((k) => !k.startsWith("_"));
        if (!_isString(parsed.rules) || !validRulesKeys.includes(parsed.rules)) {
            return _fail(`Unknown rules: "${String(parsed.rules).slice(0, 30)}".`);
        }
        const rulesKey = parsed.rules;
        const resolvedRules = RULES[rulesKey];

        // Build set of valid event codes for this rule set
        const validEvents = new Set(resolvedRules.events.map((e) => e.code));
        validEvents.add("---"); // Period End marker
        validEvents.add("Cap swap"); // Swap Caps system event

        // date
        if (!_isString(parsed.date) || !RE_DATE.test(parsed.date)) {
            return _fail("Invalid date format (expected YYYY-MM-DD).");
        }

        // startTime, endTime (optional)
        if (!_isOptionalTimeHM(parsed.startTime)) {
            return _fail("Invalid start time format (expected HH:MM).");
        }
        if (!_isOptionalTimeHM(parsed.endTime)) {
            return _fail("Invalid end time format (expected HH:MM).");
        }

        // location, gameId (optional strings with length limits)
        if (!_isOptionalString(parsed.location, MAX_LOCATION)) {
            return _fail(`Location too long (max ${MAX_LOCATION} chars).`);
        }
        if (!_isOptionalString(parsed.gameId, MAX_GAME_ID)) {
            return _fail(`Game ID too long (max ${MAX_GAME_ID} chars).`);
        }

        // periodLength (required, 1-9)
        if (!_isIntInRange(parsed.periodLength, 1, 9)) {
            return _fail("Period length must be 1-9.");
        }

        // otPeriodLength (optional, 1-9, or null/undefined when no OT)
        if (parsed.otPeriodLength != null && !_isIntInRange(parsed.otPeriodLength, 1, 9)) {
            return _fail("OT period length must be 1-9.");
        }

        // overtime, shootout (required booleans)
        if (typeof parsed.overtime !== "boolean") {
            return _fail("Overtime must be true or false.");
        }
        if (typeof parsed.shootout !== "boolean") {
            return _fail("Shootout must be true or false.");
        }

        // timeoutsAllowed
        if (!parsed.timeoutsAllowed || typeof parsed.timeoutsAllowed !== "object") {
            return _fail("Missing timeout configuration.");
        }
        if (!_isIntInRange(parsed.timeoutsAllowed.full, -1, 9)) {
            return _fail("Full timeouts must be -1 to 9.");
        }
        if (!_isIntInRange(parsed.timeoutsAllowed.to30, -1, 9)) {
            return _fail("30s timeouts must be -1 to 9.");
        }

        // enableLog, enableStats (required booleans)
        if (typeof parsed.enableLog !== "boolean") {
            return _fail("enableLog must be true or false.");
        }
        if (typeof parsed.enableStats !== "boolean") {
            return _fail("enableStats must be true or false.");
        }

        // statsTimeMode
        const validStatsTimeModes = ["off", "optional", "on"];
        if (!_isString(parsed.statsTimeMode) || !validStatsTimeModes.includes(parsed.statsTimeMode)) {
            return _fail("statsTimeMode must be 'off', 'optional', or 'on'.");
        }

        // homeTeam (optional, defaults to "W")
        if (parsed.homeTeam != null && parsed.homeTeam !== "W" && parsed.homeTeam !== "D") {
            return _fail("homeTeam must be 'W' or 'D'.");
        }

        // white, dark (required objects with name and optional roster)
        if (!_isTeamObject(parsed.white)) {
            return _fail("Invalid white team data.");
        }
        if (!_isTeamObject(parsed.dark)) {
            return _fail("Invalid dark team data.");
        }

        // currentPeriod
        if (!_isValidPeriod(parsed.currentPeriod, resolvedRules.periods)) {
            return _fail("Invalid current period.");
        }

        // log (required array)
        if (!Array.isArray(parsed.log)) {
            return _fail("Game log must be an array.");
        }
        if (parsed.log.length > MAX_LOG_ENTRIES) {
            return _fail(`Game log too large (max ${MAX_LOG_ENTRIES} entries).`);
        }

        // ── Validate each log entry ─────────────────────

        const cleanLog = [];
        for (let i = 0; i < parsed.log.length; i++) {
            const entry = parsed.log[i];
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                return _fail(`Log entry ${i + 1}: not an object.`);
            }

            // id, seq (positive integers)
            if (!_isPositiveInt(entry.id)) {
                return _fail(`Log entry ${i + 1}: invalid id.`);
            }
            if (!_isPositiveInt(entry.seq)) {
                return _fail(`Log entry ${i + 1}: invalid seq.`);
            }

            // deviceTime (optional ISO string)
            if (entry.deviceTime != null && entry.deviceTime !== "" && !_isString(entry.deviceTime)) {
                return _fail(`Log entry ${i + 1}: invalid deviceTime.`);
            }

            // period
            if (!_isValidPeriod(entry.period, resolvedRules.periods)) {
                return _fail(`Log entry ${i + 1}: invalid period.`);
            }

            // time (game clock: integer seconds or null)
            // Backward-compatibility: auto-migrate legacy "M:SS" and "" to integer/null
            if (_isString(entry.time)) {
                if (entry.time === "") {
                    entry.time = null;
                } else if (RE_GAME_TIME.test(entry.time)) {
                    const parts = entry.time.split(":");
                    if (parts.length === 3) {
                        entry.time = parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
                    } else {
                        entry.time = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                    }
                } else {
                    return _fail(`Log entry ${i + 1}: invalid legacy time "${entry.time}".`);
                }
            } else if (entry.time !== null && typeof entry.time !== "number") {
                return _fail(`Log entry ${i + 1}: time must be an integer (seconds), null, or legacy string.`);
            }


            // team
            if (!_isString(entry.team) || !["W", "D", ""].includes(entry.team)) {
                return _fail(`Log entry ${i + 1}: team must be "W", "D", or "".`);
            }

            // cap
            if (!_isValidCap(entry.cap)) {
                return _fail(`Log entry ${i + 1}: invalid cap "${entry.cap}".`);
            }

            // event (must be valid for this rule set)
            if (!_isString(entry.event) || !validEvents.has(entry.event)) {
                return _fail(`Log entry ${i + 1}: unknown event "${String(entry.event).slice(0, 20)}".`);
            }

            // scoreW, scoreD (non-negative integers)
            if (!_isNonNegativeInt(entry.scoreW)) {
                return _fail(`Log entry ${i + 1}: invalid white score.`);
            }
            if (!_isNonNegativeInt(entry.scoreD)) {
                return _fail(`Log entry ${i + 1}: invalid dark score.`);
            }

            // note (optional)
            if (entry.note != null && entry.note !== "") {
                if (!_isString(entry.note) || entry.note.length > MAX_NOTE) {
                    return _fail(`Log entry ${i + 1}: note too long (max ${MAX_NOTE} chars).`);
                }
            }

            // ── Migrate legacy coach cap "C" → "HC" ──
            if (entry.cap === "C") entry.cap = "HC";

            // ── Build clean entry (allowlisted fields only) ──
            cleanLog.push({
                id: entry.id,
                seq: entry.seq,
                deviceTime: _isString(entry.deviceTime) ? entry.deviceTime : "",
                period: entry.period,
                time: entry.time,
                team: entry.team,
                cap: entry.cap,
                event: entry.event,
                scoreW: entry.scoreW,
                scoreD: entry.scoreD,
                note: _isString(entry.note) ? entry.note : "",
                swapType: _isString(entry.swapType) ? entry.swapType : undefined,
            });
        }

        // ── Build clean game object (allowlisted fields only) ──

        const clean = {
            rules: rulesKey,
            date: parsed.date,
            startTime: _isString(parsed.startTime) ? parsed.startTime : "",
            endTime: _isString(parsed.endTime) ? parsed.endTime : "",
            location: _isString(parsed.location) ? parsed.location : "",
            gameId: _isString(parsed.gameId) ? parsed.gameId : "",
            periodLength: parsed.periodLength,
            otPeriodLength: _isIntInRange(parsed.otPeriodLength, 1, 9) ? parsed.otPeriodLength : (parsed.otPeriodLength === null ? null : (resolvedRules.otPeriodLength || null)),
            overtime: parsed.overtime,
            shootout: parsed.shootout,
            timeoutsAllowed: {
                full: parsed.timeoutsAllowed.full,
                to30: parsed.timeoutsAllowed.to30,
            },
            enableLog: parsed.enableLog,
            enableStats: parsed.enableStats,
            statsTimeMode: parsed.statsTimeMode,
            homeTeam: parsed.homeTeam || DEFAULTS.homeTeam,
            white: { name: parsed.white.name, roster: _migrateRosterKeys(_isRosterObject(parsed.white.roster) ? parsed.white.roster : {}) },
            dark: { name: parsed.dark.name, roster: _migrateRosterKeys(_isRosterObject(parsed.dark.roster) ? parsed.dark.roster : {}) },
            currentPeriod: parsed.currentPeriod,
            log: cleanLog,
            _nextId: _isPositiveInt(parsed._nextId) ? parsed._nextId : (cleanLog.length > 0 ? Math.max(...cleanLog.map(e => e.id)) + 1 : 1),
            _nextSeq: _isPositiveInt(parsed._nextSeq) ? parsed._nextSeq : (cleanLog.length > 0 ? Math.max(...cleanLog.map(e => e.seq)) + 10 : 10),
        };

        return { valid: true, data: clean };

    } catch (e) {
        return _fail("Unexpected validation error: " + e.message);
    }
}

// ── Helpers ──────────────────────────────────────────────────

function _fail(error) {
    return { valid: false, error };
}

function _isString(val) {
    return typeof val === "string";
}

function _isOptionalString(val, maxLen) {
    if (val == null || val === "") return true;
    return _isString(val) && val.length <= maxLen;
}

function _isOptionalTimeHM(val) {
    if (val == null || val === "") return true;
    return _isString(val) && RE_TIME_HM.test(val);
}

function _isIntInRange(val, min, max) {
    return typeof val === "number" && Number.isInteger(val) && val >= min && val <= max;
}

function _isPositiveInt(val) {
    return typeof val === "number" && Number.isInteger(val) && val > 0;
}

function _isNonNegativeInt(val) {
    return typeof val === "number" && Number.isInteger(val) && val >= 0;
}

function _isTeamObject(val) {
    return val && typeof val === "object" && !Array.isArray(val) &&
        _isString(val.name) && val.name.length <= MAX_TEAM_NAME;
}

function _isRosterObject(val) {
    if (!val || typeof val !== "object" || Array.isArray(val)) return false;
    // ensure all keys are strings and values are objects with optional 'name' and 'id'
    for (const [key, player] of Object.entries(val)) {
        if (!_isString(key)) return false;
        if (!player || typeof player !== "object" || Array.isArray(player)) return false;
        if (player.name != null && !_isString(player.name)) return false;
        if (player.id != null && !_isString(player.id)) return false;
    }
    return true;
}

function _migrateRosterKeys(roster) {
    if (roster["C"] && !roster["HC"]) {
        roster["HC"] = roster["C"];
        delete roster["C"];
    }
    return roster;
}

function _isValidPeriod(val, maxPeriod) {
    if (_isIntInRange(val, 1, maxPeriod)) return true;
    if (_isString(val)) {
        if (val === "SO") return true;
        if (RE_PERIOD_OT.test(val)) return true;
    }
    return false;
}

function _isValidCap(val) {
    if (!_isString(val)) return false;
    if (val === "" || val === "HC" || val === "C" || val === "AC" || val === "B") return true;
    return RE_CAP.test(val);
}

// ── Storage ──────────────────────────────────────────────────

export const Storage = {
    KEY: "wplog_game",
    MAX_FILE_SIZE,

    save(game) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(game));
        } catch (e) {
            console.error("Failed to save game:", e);
        }
    },

    load() {
        try {
            const data = localStorage.getItem(this.KEY);
            if (!data) return null;
            const game = JSON.parse(data);
            if (!game || typeof game.rules !== "string" || !Array.isArray(game.log)) {
                console.warn("Invalid game data in localStorage, ignoring.");
                return null;
            }
            return game;
        } catch (e) {
            console.error("Failed to load game:", e);
            return null;
        }
    },

    clear() {
        localStorage.removeItem(this.KEY);
    },
};
