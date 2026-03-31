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
export const APP_VERSION = "2.8.0";

// App-level defaults — fallbacks for missing rule-set properties
export const DEFAULTS = {
    periods: 4,
    periodLength: 8,
    foulOutLimit: 3,
    homeTeam: "W",
    overtime: false,
    shootout: true,
    timeouts: { full: 2, to30: 0 },
    events: [
        { name: "Goal", code: "G", color: "green", align: "left" },
        { name: "Exclusion", code: "E", color: "amber", align: "right", isPersonalFoul: true },
        { name: "Penalty", code: "P", color: "amber", align: "right", isPersonalFoul: true },
        { name: "Timeout", code: "TO", color: "blue", align: "center", teamOnly: true }
    ],
    statsEvents: [
        { name: "Shot", color: "teal", statsOnly: true }
    ],
};

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
//   allowOfficial — (optional) true to allow "Official" team selection (team-neutral; teamOnly events only)
//
// Rule sets support inheritance via the `inherits` key:
//   inherits     — (optional) key of parent rule set; child overrides only what differs
//   addEvents    — (optional) array of { before|after: "CODE", event: {...} } insertion directives
//   removeEvents — (optional) array of event codes to remove from inherited events
//
// Rule set keys starting with _ are internal (hidden from setup dropdown).
//
// Stats events are defined once in STATS_EVENTS and auto-appended to all rule sets.

export let STATS_EVENTS = [];
export let RULES = {};

// --- Configuration Loader & Normalizer ---

function _deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function _resolveRules(rulesObj, statsArr) {
    // 1. Detect circular inheritance chains
    for (const key of Object.keys(rulesObj)) {
        const seen = new Set();
        let cur = key;
        while (rulesObj[cur]?.inherits) {
            if (seen.has(cur)) {
                throw new Error("Circular inheritance: " + [...seen, cur].join(" \u2192 "));
            }
            seen.add(cur);
            cur = rulesObj[cur].inherits;
        }
    }
    // 2. Resolve in dependency order (parents first)
    const resolved = new Set();
    function resolve(key) {
        if (resolved.has(key)) return;
        const rule = rulesObj[key];
        if (rule.inherits) {
            resolve(rule.inherits);
            rulesObj[key] = { ..._deepCopy(rulesObj[rule.inherits]), ...rule };
            delete rulesObj[key].inherits;
        }
        resolved.add(key);
    }
    for (const key of Object.keys(rulesObj)) resolve(key);

    // 3. Apply removeEvents / addEvents directives
    for (const [key, rule] of Object.entries(rulesObj)) {
        rule.events = rule.events || [];
        if (rule.removeEvents) {
            rule.events = rule.events.filter(e => !rule.removeEvents.includes(e.code));
            delete rule.removeEvents;
        }
        if (rule.addEvents) {
            for (const directive of rule.addEvents) {
                const anchorCode = directive.after || directive.before;
                const idx = rule.events.findIndex(e => e.code === anchorCode);
                if (idx === -1) throw new Error(key + ": addEvents anchor '" + anchorCode + "' not found");
                const pos = directive.after ? idx + 1 : idx;
                rule.events.splice(pos, 0, directive.event);
            }
            delete rule.addEvents;
        }
    }

    // 4. Append STATS_EVENTS to every rule set
    for (const rule of Object.values(rulesObj)) {
        rule.events = [...(rule.events || []), ...statsArr];
    }

    // 5. Auto-derive code from name for any event missing one
    for (const rule of Object.values(rulesObj)) {
        for (const evt of rule.events) {
            if (!evt.code) evt.code = evt.name;
        }
    }
}

function _getSafeMode() {
    return {
        STATS_EVENTS: [...DEFAULTS.statsEvents],
        RULES: {
            "SAFE": {
                name: "Safe Mode (Config Error)",
                periods: DEFAULTS.periods,
                periodLength: DEFAULTS.periodLength,
                foulOutLimit: DEFAULTS.foulOutLimit,
                homeTeam: DEFAULTS.homeTeam,
                overtime: DEFAULTS.overtime,
                shootout: DEFAULTS.shootout,
                timeouts: { ...DEFAULTS.timeouts },
                events: [...DEFAULTS.events]
            }
        }
    };
}

export async function loadConfig() {
    let data;
    try {
        const res = await fetch('config.json?v=' + Date.now());
        if (!res.ok) throw new Error("config.json not found (" + res.status + ")");
        data = await res.json();
    } catch (e) {
        console.warn("Failed to load or parse config.json, falling back to safe mode.", e);
        data = _getSafeMode();
    }

    // Defensive normalization
    if (!data.RULES || typeof data.RULES !== 'object') {
        data = _getSafeMode();
    }
    const resolvedStats = Array.isArray(data.STATS_EVENTS) ? data.STATS_EVENTS : [];

    for (const v of Object.values(data.RULES)) {
        if (typeof v !== 'object') continue;
        if (!v.events && !v.inherits) v.events = [];
        if (v.events && !Array.isArray(v.events)) v.events = [];
        if (!v.periodLength && !v.inherits) v.periodLength = DEFAULTS.periodLength;
        if (!v.periods && !v.inherits) v.periods = DEFAULTS.periods;
        if (!v.foulOutLimit && !v.inherits) v.foulOutLimit = DEFAULTS.foulOutLimit;
        if (!v.homeTeam && !v.inherits) v.homeTeam = DEFAULTS.homeTeam;
    }

    try {
        _resolveRules(data.RULES, resolvedStats);
        RULES = data.RULES;
        STATS_EVENTS = resolvedStats;
    } catch (e) {
        console.error("Error resolving inheritance rules, falling back to safe mode.", e);
        const safe = _getSafeMode();
        _resolveRules(safe.RULES, safe.STATS_EVENTS);
        RULES = safe.RULES;
        STATS_EVENTS = safe.STATS_EVENTS;
    }
}
