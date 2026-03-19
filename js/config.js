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

// wplog — Application Version
// Default is "dev"; deploy workflow injects the release tag.
const APP_VERSION = "2.3.0";

// wplog — Rules Configuration
//
// Each event has:
//   name       — display name
//   code       — (optional) internal code stored in the log; defaults to name if omitted
//   color      — CSS color class: "green", "amber", "orange", "blue", "yellow", "red", "teal"
//   align      — (optional) sheet Code column alignment: "left", "right", "center" (default: "center")
//   teamOnly      — (optional) true if event is team-level with no cap (e.g. timeout)
//   autoFoulOut   — (optional) 1 = immediate ejection, 2 = after 2nd occurrence
//   isPersonalFoul — (optional) true if event counts toward personal foul limit
//   statsOnly     — (optional) true if event is for stats tracking only
//   allowCoach    — (optional) true to allow "C" (coach) as cap value
//   allowAssistant — (optional) true to allow "AC" (assistant coach) as cap value
//   allowBench    — (optional) true to allow "B" (bench) as cap value
//   allowPlayer   — (optional, default: true) false to block digit cap input (non-player events)
//   allowNoCap    — (optional) true to allow submitting without a cap number
//
// Rule sets support inheritance via the `inherits` key:
//   inherits     — (optional) key of parent rule set; child overrides only what differs
//   addEvents    — (optional) array of { before|after: "CODE", event: {...} } insertion directives
//   removeEvents — (optional) array of event codes to remove from inherited events
//
// Rule set keys starting with _ are internal (hidden from setup dropdown).
//
// Stats events are defined once in STATS_EVENTS and auto-appended to all rule sets.

const STATS_EVENTS = [
    { name: "Shot", color: "teal", statsOnly: true },
    { name: "Assist", color: "teal", statsOnly: true },
    { name: "Offensive", color: "teal", statsOnly: true },
    { name: "Steal", color: "teal", statsOnly: true },
    { name: "Intercept", color: "teal", statsOnly: true },
    { name: "Turnover", color: "teal", statsOnly: true },
    { name: "Field Block", color: "teal", statsOnly: true },
    { name: "Save", color: "teal", statsOnly: true },
    { name: "Drawn Exclusion", color: "teal", statsOnly: true },
    { name: "Drawn Penalty", color: "teal", statsOnly: true },
    { name: "Sprint Won", color: "teal", statsOnly: true },
];

const RULES = {
    _base: {
        periods: 4,
        foulOutLimit: 3,
    },
    USAWP: {
        inherits: "_base",
        name: "USA Water Polo",
        periodLength: 8,
        overtime: false,
        shootout: true,
        events: [
            { name: "Goal", code: "G", color: "green", align: "left" },
            { name: "Exclusion", code: "E", color: "amber", align: "right", isPersonalFoul: true },
            { name: "Penalty", code: "P", color: "amber", align: "right", isPersonalFoul: true },
            { name: "Timeout", code: "TO", color: "blue", teamOnly: true, align: "center" },
            { name: "Timeout 30", code: "TO30", color: "blue", align: "center", teamOnly: true },
            { name: "Yellow Card", code: "YC", color: "yellow", align: "center", allowCoach: true, allowAssistant: false, allowBench: true },
            { name: "Penalty-Exclusion", code: "P-E", color: "amber", align: "right", isPersonalFoul: true },
            { name: "Misconduct", code: "MC", color: "red", align: "right", autoFoulOut: 1 },
            { name: "Brutality", code: "BR", color: "red", align: "right", autoFoulOut: 1 },
            { name: "Red Card", code: "RC", color: "red", align: "center", allowCoach: true, allowAssistant: true },
            { name: "Game Exclusion", code: "E-Game", color: "red", align: "right", autoFoulOut: 1 },
        ],
        timeouts: { full: 2, to30: 0 },
    },
    _academic: {
        inherits: "_base",
        periodLength: 7,
        otPeriodLength: 3,
        overtime: true,
        shootout: false,
        events: [
            { name: "Goal", code: "G", color: "green", align: "left" },
            { name: "Exclusion", code: "E", color: "amber", align: "right", isPersonalFoul: true },
            { name: "Penalty", code: "P", color: "amber", align: "right", isPersonalFoul: true },
            { name: "Minor Act", code: "MAM", color: "amber", align: "right", isPersonalFoul: true, autoFoulOut: 2 },
            { name: "Penalty-Exclusion", code: "P-E", color: "amber", align: "right", isPersonalFoul: true },
            { name: "Yellow Card", code: "YC", color: "yellow", align: "center", allowCoach: true, allowAssistant: false, allowBench: true },
            { name: "Timeout", code: "TO", color: "blue", teamOnly: true, align: "center" },
            { name: "Timeout 30", code: "TO30", color: "blue", align: "center", teamOnly: true },
            { name: "Misconduct", code: "MC", color: "red", align: "right", autoFoulOut: 1 },
            { name: "Game Exclusion", code: "E-Game", color: "red", align: "right", autoFoulOut: 1 },
            { name: "Flagrant Misconduct", code: "FM", color: "red", align: "right", autoFoulOut: 1 },
            { name: "Red Card", code: "RC", color: "red", align: "center", allowCoach: true, allowAssistant: true },
        ],
        timeouts: { full: 3, to30: 1 },
    },
    NFHSVA: {
        inherits: "_academic",
        name: "NFHS Varsity",
    },
    NFHSJV: {
        inherits: "_academic",
        name: "NFHS Junior Varsity",
        periodLength: 6,
        overtime: false,
    },
    NCAA: {
        inherits: "_academic",
        name: "NCAA",
        periodLength: 8,
        addEvents: [
            { before: "RC", event: { name: "Yellow/Red Card", code: "YRC", color: "yellow", align: "right", allowPlayer: false, allowCoach: true, allowAssistant: false } },
        ],
    },
};

// --- Inheritance Resolver ---

function _deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function _resolveRules() {
    // 1. Detect circular inheritance chains
    for (const key of Object.keys(RULES)) {
        const seen = new Set();
        let cur = key;
        while (RULES[cur]?.inherits) {
            if (seen.has(cur)) {
                throw new Error("Circular inheritance: " + [...seen, cur].join(" \u2192 "));
            }
            seen.add(cur);
            cur = RULES[cur].inherits;
        }
    }
    // 2. Resolve in dependency order (parents first)
    const resolved = new Set();
    function resolve(key) {
        if (resolved.has(key)) return;
        const rule = RULES[key];
        if (rule.inherits) {
            resolve(rule.inherits);
            RULES[key] = { ..._deepCopy(RULES[rule.inherits]), ...rule };
            delete RULES[key].inherits;
        }
        resolved.add(key);
    }
    for (const key of Object.keys(RULES)) resolve(key);
    // 3. Apply removeEvents / addEvents directives
    for (const [key, rule] of Object.entries(RULES)) {
        if (rule.removeEvents) {
            rule.events = (rule.events || []).filter(e => !rule.removeEvents.includes(e.code));
            delete rule.removeEvents;
        }
        if (rule.addEvents) {
            for (const directive of rule.addEvents) {
                const anchorCode = directive.after || directive.before;
                const idx = (rule.events || []).findIndex(e => e.code === anchorCode);
                if (idx === -1) throw new Error(key + ": addEvents anchor '" + anchorCode + "' not found");
                const pos = directive.after ? idx + 1 : idx;
                rule.events.splice(pos, 0, directive.event);
            }
            delete rule.addEvents;
        }
    }
    // 4. Append STATS_EVENTS to every rule set
    for (const rule of Object.values(RULES)) {
        rule.events = [...(rule.events || []), ...STATS_EVENTS];
    }
    // 5. Auto-derive code from name for any event missing one
    for (const rule of Object.values(RULES)) {
        for (const evt of rule.events) {
            if (!evt.code) evt.code = evt.name;
        }
    }
}
_resolveRules();
