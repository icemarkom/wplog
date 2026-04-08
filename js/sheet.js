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
import { Game } from './game.js';
import { formatTime } from './time.js';
import { escapeHTML } from './sanitize.js';
import { renderScreen } from './sheet-screen.js';

// wplog — Game Sheet (Stateless Orchestrator + Render Helpers)
//
// Sheet does not hold game state. All methods receive `game` as a parameter.
// Data aggregation lives in game.js; this file handles DOM rendering only.

export const Sheet = {

    // ── Main entry point ─────────────────────────────────────────

    render(game, isPrint = false) {
        this.isPrint = isPrint;
        if (!this.statsFormat) this.statsFormat = "cumulative"; // default
        const container = document.getElementById("sheet-content");
        if (container) {
            container.innerHTML = "";
            renderScreen(game, this, container, isPrint);

            if (!this.isPrint) {
                const toggle = container.querySelector("#sheet-stats-format-toggle");
                if (toggle) {
                    toggle.querySelectorAll(".inline-toggle-link").forEach(btn => {
                        btn.addEventListener("click", (e) => {
                            this.statsFormat = e.target.dataset.format;
                            this.render(game, false);
                        });
                    });
                }
            }
        }
    },

    // ── Header ───────────────────────────────────────────────────

    _renderHeader(game, title) {
        const header = document.createElement("div");
        header.className = "sheet-header";

        const teams = Game.getTeams(game);
        const score = Game.getDisplayScore(game);

        // Build team labels: home first, away second
        const teamDivs = teams.map(t => {
            const customName = t.name === t.defaultName ? "" : t.name;
            return `<div class="sheet-team sheet-team-${t.cssClass}">
          <span class="sheet-team-label">${escapeHTML(t.label)}</span>
          <span class="sheet-team-name">${escapeHTML(customName)}</span>
        </div>`;
        });

        header.innerHTML = `
      <div class="sheet-title-row">
        <span class="sheet-title">${escapeHTML(title)}</span>
      </div>
      <div class="sheet-meta">
        <div class="sheet-meta-row">
          <span class="sheet-meta-pair"><span class="sheet-label">Game #:</span> <span class="sheet-value">${escapeHTML(game.gameId || "-")}</span></span>
        </div>
        <div class="sheet-meta-row">
          <span class="sheet-meta-pair"><span class="sheet-label">Location:</span> <span class="sheet-value">${escapeHTML(game.location || "-")}</span></span>
        </div>
        <div class="sheet-meta-row sheet-meta-times">
          <span class="sheet-meta-pair"><span class="sheet-label">Date:</span> <span class="sheet-value">${escapeHTML(game.date)}</span></span>
          <span class="sheet-meta-pair"><span class="sheet-label">Scheduled:</span> <span class="sheet-value">${escapeHTML(game.startTime || "--:--")}</span></span>
          <span class="sheet-meta-pair"><span class="sheet-label">Ended:</span> <span class="sheet-value">${escapeHTML(game.endTime || "--:--")}</span></span>
        </div>
      </div>
      <div class="sheet-teams">
        ${teamDivs[0]}
        <div class="sheet-final-score">${escapeHTML(String(teams[0].code === "W" ? score.white : score.dark))} - ${escapeHTML(String(teams[1].code === "W" ? score.white : score.dark))}</div>
        ${teamDivs[1]}
      </div>
    `;
        return header;
    },

    // ── Section renderers ────────────────────────────────────────

    _renderProgressOfGame(game) {
        const section = document.createElement("div");
        section.className = "sheet-section sheet-progress-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Progress of Game";
        section.appendChild(title);

        const table = document.createElement("table");
        table.className = "sheet-table";

        const thead = document.createElement("thead");
        thead.innerHTML = `
      <tr>
        <th>Time</th>
        <th>Cap</th>
        <th>Team</th>
        <th>Remarks</th>
        <th>Score</th>
      </tr>
    `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        const rules = RULES[game.rules];
        const logEntries = Game.filterLogEvents(game.log, rules);

        for (const entry of logEntries) {
            const tr = document.createElement("tr");

            if (entry.event === "---") {
                tr.className = "sheet-period-end";
                tr.innerHTML = `<td colspan="5">--- End of ${Game.getPeriodLabel(entry.period, game.periods)} ---</td>`;
            } else {
                let align = "center";
                let capDisplay = escapeHTML(entry.cap || "-");
                let eventDisplay = escapeHTML(entry.event);

                if (entry.event === "Cap swap") {
                    eventDisplay = "Cap swap";
                    const arrow = entry.swapType === "uni" ? "\u2192" : "\u21C4";
                    capDisplay = escapeHTML(entry.cap) + ` ${arrow} ` + escapeHTML(entry.note);
                } else {
                    const eventDef = rules.events.find((e) => e.code === entry.event);
                    if (eventDef && eventDef.align) align = eventDef.align;
                }

                tr.innerHTML = `
          <td>${entry.period === "SO" ? "" : escapeHTML((entry.time !== null ? formatTime(entry.time) : "").replace(/^0(\d:)/, '$1'))}</td>
          <td>${capDisplay}</td>
          <td>${escapeHTML(entry.team || "-")}</td>
          <td style="text-align:${align}">${eventDisplay}</td>
          <td>${escapeHTML(Game.formatEntryScore(entry, game))}</td>
        `;
            }
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderPeriodScores(game) {
        const data = Game.buildPeriodScores(game);
        const section = document.createElement("div");
        section.className = "sheet-section sheet-period-scores-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Score by Period";
        section.appendChild(title);

        const table = document.createElement("table");
        table.className = "sheet-table sheet-table-compact";

        const headerCells = data.periods.map((p) => `<th>${p}</th>`).join("");

        const thead = document.createElement("thead");
        thead.innerHTML = `<tr><th>Team</th>${headerCells}<th>Total</th></tr>`;
        table.appendChild(thead);

        const teams = Game.getTeams(game);
        const tbody = document.createElement("tbody");

        for (const t of teams) {
            const scores = t.code === "W" ? data.white : data.dark;
            const total = t.code === "W" ? data.totalWhite : data.totalDark;
            const tr = document.createElement("tr");
            let cells = `<td class="sheet-team-cell">${t.label}</td>`;
            for (const count of scores) {
                cells += `<td>${String(count)}</td>`;
            }
            cells += `<td class="sheet-total"><strong>${total}</strong></td>`;
            tr.innerHTML = cells;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderFoulSummary(game) {
        const data = Game.buildPersonalFoulTable(game);
        const section = document.createElement("div");
        section.className = "sheet-section sheet-fouls-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Personal Fouls";
        section.appendChild(title);

        if (data.length === 0) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No personal fouls recorded.";
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "sheet-table";
        table.innerHTML = `
      <thead>
        <tr><th>Team</th><th>Cap</th><th>Fouls</th><th>Details</th></tr>
      </thead>
    `;

        const tbody = document.createElement("tbody");

        for (const player of data) {
            const tr = document.createElement("tr");
            if (player.fouledOut) tr.classList.add("sheet-fouled-out");

            const details = player.details
                .map((f) => `${Game.getPeriodLabel(f.period, game.periods)} ${f.time !== null ? formatTime(f.time) : ""} ${f.event}`)
                .join("; ");

            tr.innerHTML = `
        <td>${player.team === "W" ? "White" : "Dark"}</td>
        <td>${escapeHTML(player.cap)}</td>
        <td>${player.count}</td>
        <td class="sheet-foul-details">${escapeHTML(details)}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderTimeoutSummary(game) {
        const data = Game.buildTimeoutSummary(game);
        const section = document.createElement("div");
        section.className = "sheet-section sheet-timeouts-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Timeouts";
        section.appendChild(title);

        if (data.length === 0) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No timeouts recorded.";
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "sheet-table";
        table.innerHTML = `
      <thead>
        <tr><th>Team</th><th>Period</th><th>Time</th><th>Type</th></tr>
      </thead>
    `;

        const tbody = document.createElement("tbody");
        for (const entry of data) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${entry.team}</td>
        <td>${entry.period}</td>
        <td>${entry.time !== null ? formatTime(entry.time) : ""}</td>
        <td>${entry.type}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderCardSummary(game) {
        const data = Game.buildCardSummary(game);
        const section = document.createElement("div");
        section.className = "sheet-section sheet-cards-section";
        section.innerHTML = `<div class="sheet-section-title">Cards</div>`;

        if (data.length === 0) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No cards issued.";
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "sheet-table";
        table.innerHTML = `
      <thead>
        <tr><th>Team</th><th>Cap</th><th>Period</th><th>Time</th><th>Type</th></tr>
      </thead>
    `;

        const tbody = document.createElement("tbody");
        for (const entry of data) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${entry.team}</td>
        <td>${escapeHTML(entry.cap)}</td>
        <td>${entry.period}</td>
        <td>${escapeHTML(entry.time !== null ? formatTime(entry.time) : "")}</td>
        <td>${entry.type}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderPlayerStats(game) {
        const data = Game.buildPlayerStats(game);
        const section = document.createElement("div");
        section.className = "sheet-section sheet-player-stats-section";

        const formatStr = this.statsFormat || "cumulative";
        const isCumulative = formatStr === "cumulative";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.innerHTML = `
          <span class="stats-inline-toggle" id="sheet-stats-format-toggle">
            <span class="inline-toggle-link ${isCumulative ? 'active' : ''}" data-format="cumulative">CUMULATIVE</span>
            <span class="inline-toggle-sep"> / </span>
            <span class="inline-toggle-link ${!isCumulative ? 'active' : ''}" data-format="per-period">PER PERIOD</span>
          </span>
          PLAYER STATS
        `;
        section.appendChild(title);

        if (!data) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No stats recorded.";
            section.appendChild(empty);
            return section;
        }

        const wName = game.white.name === "White" ? "White" : `White (${game.white.name})`;
        const dName = game.dark.name === "Dark" ? "Dark" : `Dark (${game.dark.name})`;

        // Render in home-first order
        const teams = Game.getTeams(game);
        for (const t of teams) {
            const teamCode = t.code;
            const teamName = teamCode === "W" ? wName : dName;
            const wrapper = this._renderTeamStatsTable(teamName, data.stats[teamCode], data.totals[teamCode], data.statsPerPeriod[teamCode], data.totalsPerPeriod[teamCode], data.activeStatCodes, data.statTypes, data.activePeriods, formatStr);
            section.appendChild(wrapper);
        }

        return section;
    },

    _renderTeamStatsTable(teamName, teamData, teamTotals, teamDataPerPeriod, teamTotalsPerPeriod, activeStatCodes, statTypes, activePeriods, formatStr) {
        const wrapper = document.createElement("div");
        wrapper.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = teamName;
        wrapper.appendChild(title);

        const caps = Object.keys(teamData).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
        const isPerPeriod = formatStr === "per-period";
        const numPeriods = activePeriods.length || 1;

        // Group into chunks of 11 (or 22 for print) internally.
        let targetColsCount = this.isPrint ? 22 : 11;
        let chunkSize = targetColsCount;

        if (isPerPeriod) {
            // Horizontal text categories physically require the width of ~4 narrow columns to fit inside `table-layout: fixed`.
            // By enforcing this minimum cost, we natively reuse `targetColsCount` to scale elegantly across Screen (11) and Print (22).
            const costPerCategory = Math.max(4, numPeriods);
            chunkSize = Math.max(1, Math.floor(targetColsCount / costPerCategory));
        }

        for (let i = 0; i < activeStatCodes.length; i += chunkSize) {
            const chunkCodes = activeStatCodes.slice(i, i + chunkSize);

            // Pad the final chunk so it structurally identical to previous chunks (User requested)
            while (chunkCodes.length < chunkSize) {
                chunkCodes.push(null);
            }

            const table = document.createElement("table");
            table.className = "sheet-table sheet-table-compact sheet-stats-table";

            const thead = document.createElement("thead");
            if (isPerPeriod) {
                table.classList.add("sheet-table-per-period");

                let tr1 = `<tr><th class="col-cap" rowspan="2">Cap</th>`;
                let tr2 = `<tr class="sheet-stat-subheader">`;

                for (const code of chunkCodes) {
                    if (code === null) {
                        tr1 += `<th class="sheet-stat-header-horizontal col-stat" colspan="${numPeriods}"><span></span></th>`;
                        for (let p = 0; p < numPeriods; p++) tr2 += `<th></th>`;
                    } else {
                        const st = statTypes.find(s => s.code === code);
                        tr1 += `<th class="sheet-stat-header-horizontal col-stat" colspan="${numPeriods}"><span>${escapeHTML(st.name)}</span></th>`;
                        for (const p of activePeriods) {
                            tr2 += `<th>${escapeHTML(p)}</th>`;
                        }
                    }
                }
                tr1 += `</tr>`;
                tr2 += `</tr>`;
                thead.innerHTML = tr1 + tr2;
            } else {
                let theadHtml = `<tr><th class="col-cap">Cap</th>`;
                for (const code of chunkCodes) {
                    if (code === null) {
                        theadHtml += `<th class="sheet-stat-header col-stat"><span></span></th>`;
                    } else {
                        const st = statTypes.find(s => s.code === code);
                        theadHtml += `<th class="sheet-stat-header col-stat"><span>${escapeHTML(st.name)}</span></th>`;
                    }
                }
                theadHtml += `</tr>`;
                thead.innerHTML = document.createRange().createContextualFragment(theadHtml).textContent === "" ? theadHtml : theadHtml;
                // The quick assignment works best with outerHTML structure via innerHTML.
            }

            table.appendChild(thead);

            const tbody = document.createElement("tbody");

            for (const cap of caps) {
                let rowHtml = `<td class="col-cap">${escapeHTML(cap)}</td>`;
                for (const code of chunkCodes) {
                    if (code === null) {
                        const cols = isPerPeriod ? numPeriods : 1;
                        for (let c = 0; c < cols; c++) rowHtml += `<td class="col-stat"></td>`;
                    } else {
                        if (isPerPeriod) {
                            for (const p of activePeriods) {
                                let count = 0;
                                if (teamDataPerPeriod[cap] && teamDataPerPeriod[cap][code] && teamDataPerPeriod[cap][code][p]) {
                                    count = teamDataPerPeriod[cap][code][p];
                                }
                                rowHtml += `<td class="col-stat">${count || ""}</td>`;
                            }
                        } else {
                            const count = teamData[cap][code] || 0;
                            rowHtml += `<td class="col-stat">${count || ""}</td>`;
                        }
                    }
                }
                const tr = document.createElement("tr");
                tr.innerHTML = rowHtml;
                tbody.appendChild(tr);
            }

            // Total row
            const tfTr = document.createElement("tr");
            tfTr.className = "sheet-total-row";
            let tfHtml = `<td class="col-cap">Total</td>`;
            for (const code of chunkCodes) {
                if (code === null) {
                    const cols = isPerPeriod ? numPeriods : 1;
                    for (let c = 0; c < cols; c++) tfHtml += `<td class="col-stat"></td>`;
                } else {
                    if (isPerPeriod) {
                        for (const p of activePeriods) {
                            let count = 0;
                            if (teamTotalsPerPeriod[code] && teamTotalsPerPeriod[code][p]) {
                                count = teamTotalsPerPeriod[code][p];
                            }
                            tfHtml += `<td class="col-stat"><strong>${count || ""}</strong></td>`;
                        }
                    } else {
                        const count = teamTotals[code] || 0;
                        tfHtml += `<td class="col-stat"><strong>${count || ""}</strong></td>`;
                    }
                }
            }
            tfTr.innerHTML = tfHtml;
            tbody.appendChild(tfTr);

            table.appendChild(tbody);
            wrapper.appendChild(table);
        }

        return wrapper;
    },

    _renderRoster(game) {
        const rules = RULES[game.rules];
        const hasPlayerId = !!(rules && rules.playerId);

        // Collect all caps from game log, grouped by team
        const whiteCaps = new Set();
        const darkCaps = new Set();
        for (const entry of game.log) {
            if (!entry.cap) continue;
            const cap = entry.baseCap || entry.cap;
            if (entry.team === "W") whiteCaps.add(cap);
            else if (entry.team === "D") darkCaps.add(cap);
        }

        if (whiteCaps.size === 0 && darkCaps.size === 0) return null;

        const section = document.createElement("div");
        section.className = "sheet-section sheet-roster-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Roster";
        section.appendChild(title);

        const teams = Game.getTeams(game);
        const sortCaps = (caps) => [...caps].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

        const getRosterEntry = (teamKey, cap) => {
            return game[teamKey] && game[teamKey].roster && game[teamKey].roster[cap];
        };

        // ── Screen layout: stacked per-team tables ──
        const screenDiv = document.createElement("div");
        screenDiv.className = "sheet-roster-screen";

        for (const t of teams) {
            const teamKey = t.code === "W" ? "white" : "dark";
            const caps = t.code === "W" ? whiteCaps : darkCaps;
            if (caps.size === 0) continue;

            const teamName = game[teamKey].name === (t.code === "W" ? "White" : "Dark")
                ? (t.code === "W" ? "White" : "Dark")
                : `${t.code === "W" ? "White" : "Dark"} (${game[teamKey].name})`;

            const wrapper = document.createElement("div");
            wrapper.className = "sheet-section";

            const subTitle = document.createElement("h3");
            subTitle.className = "sheet-section-title";
            subTitle.textContent = teamName;
            wrapper.appendChild(subTitle);

            const table = document.createElement("table");
            table.className = "sheet-table sheet-table-compact sheet-roster-table";

            let theadHtml = "<tr><th class=\"col-cap\">Cap</th><th class=\"col-roster-name\">Name</th>";
            if (hasPlayerId) theadHtml += `<th class="col-roster-id">${escapeHTML(rules.playerId)}</th>`;
            theadHtml += "</tr>";

            const thead = document.createElement("thead");
            thead.innerHTML = theadHtml;
            table.appendChild(thead);

            const tbody = document.createElement("tbody");
            for (const cap of sortCaps(caps)) {
                const entry = getRosterEntry(teamKey, cap);
                const tr = document.createElement("tr");
                let html = `<td class="col-cap">${escapeHTML(cap)}</td><td class="col-roster-name">${escapeHTML(entry && entry.name ? entry.name : "")}</td>`;
                if (hasPlayerId) html += `<td class="col-roster-id">${escapeHTML(entry && entry.id ? entry.id : "")}</td>`;
                tr.innerHTML = html;
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            wrapper.appendChild(table);
            screenDiv.appendChild(wrapper);
        }
        section.appendChild(screenDiv);

        // ── Print layout: side-by-side with shared Cap column ──
        const printDiv = document.createElement("div");
        printDiv.className = "sheet-roster-print";

        // Build union of all caps, sorted
        const allCaps = sortCaps(new Set([...whiteCaps, ...darkCaps]));

        // Determine home/away team keys
        const homeTeam = teams[0];
        const awayTeam = teams[1];
        const homeKey = homeTeam.code === "W" ? "white" : "dark";
        const awayKey = awayTeam.code === "W" ? "white" : "dark";
        const homeCaps = homeTeam.code === "W" ? whiteCaps : darkCaps;
        const awayCaps = awayTeam.code === "W" ? whiteCaps : darkCaps;

        const homeLabel = game[homeKey].name === (homeTeam.code === "W" ? "White" : "Dark")
            ? (homeTeam.code === "W" ? "White" : "Dark")
            : `${homeTeam.code === "W" ? "White" : "Dark"} (${game[homeKey].name})`;
        const awayLabel = game[awayKey].name === (awayTeam.code === "W" ? "White" : "Dark")
            ? (awayTeam.code === "W" ? "White" : "Dark")
            : `${awayTeam.code === "W" ? "White" : "Dark"} (${game[awayKey].name})`;

        const printTable = document.createElement("table");
        printTable.className = "sheet-table sheet-table-compact sheet-roster-table sheet-roster-table-print";

        // Header row 1: team names spanning columns
        const homeCols = hasPlayerId ? 2 : 1;
        const awayCols = hasPlayerId ? 2 : 1;
        const thead2 = document.createElement("thead");
        let headerRow1 = "<tr>";
        headerRow1 += `<th class="sheet-roster-team-header" colspan="${homeCols}">${escapeHTML(homeLabel)}</th>`;
        headerRow1 += `<th class="col-roster-cap-center col-cap" rowspan="2">Cap</th>`;
        headerRow1 += `<th class="sheet-roster-team-header" colspan="${awayCols}">${escapeHTML(awayLabel)}</th>`;
        headerRow1 += "</tr>";

        // Header row 2: column labels (mirrored for home side)
        let headerRow2 = "<tr>";
        if (hasPlayerId) headerRow2 += `<th class="col-roster-id">${escapeHTML(rules.playerId)}</th>`;
        headerRow2 += `<th class="col-roster-name">Name</th>`;
        headerRow2 += `<th class="col-roster-name">Name</th>`;
        if (hasPlayerId) headerRow2 += `<th class="col-roster-id">${escapeHTML(rules.playerId)}</th>`;
        headerRow2 += "</tr>";

        thead2.innerHTML = headerRow1 + headerRow2;
        printTable.appendChild(thead2);

        const tbody2 = document.createElement("tbody");
        for (const cap of allCaps) {
            const tr = document.createElement("tr");
            const homeHas = homeCaps.has(cap);
            const awayHas = awayCaps.has(cap);
            const homeEntry = homeHas ? getRosterEntry(homeKey, cap) : null;
            const awayEntry = awayHas ? getRosterEntry(awayKey, cap) : null;

            let html = "";
            // Home side (mirrored: ID | Name)
            if (hasPlayerId) html += `<td class="col-roster-id sheet-roster-home">${homeHas ? escapeHTML(homeEntry && homeEntry.id ? homeEntry.id : "") : ""}</td>`;
            html += `<td class="col-roster-name sheet-roster-home">${homeHas ? escapeHTML(homeEntry && homeEntry.name ? homeEntry.name : "") : ""}</td>`;
            // Center cap
            html += `<td class="col-roster-cap-center col-cap">${escapeHTML(cap)}</td>`;
            // Away side (normal: Name | ID)
            html += `<td class="col-roster-name">${awayHas ? escapeHTML(awayEntry && awayEntry.name ? awayEntry.name : "") : ""}</td>`;
            if (hasPlayerId) html += `<td class="col-roster-id">${awayHas ? escapeHTML(awayEntry && awayEntry.id ? awayEntry.id : "") : ""}</td>`;

            tr.innerHTML = html;
            tbody2.appendChild(tr);
        }
        printTable.appendChild(tbody2);
        printDiv.appendChild(printTable);
        section.appendChild(printDiv);

        return section;
    },
};
