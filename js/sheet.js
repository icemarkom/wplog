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
import { escapeHTML } from './sanitize.js';
import { buildPeriodScores, buildPersonalFoulTable, buildTimeoutSummary, buildCardSummary, buildPlayerStatsByTeam } from './sheet-data.js';
import { renderScreen } from './sheet-screen.js';
import { filterLogEvents } from './pagination.js';

// wplog — Game Sheet (Screen-Only Orchestrator + Render Helpers)
//
// Sheet does not hold game state. All methods receive `game` as a parameter.
// Screen rendering only — print rendering is handled by js/print.js.

export const Sheet = {

    // ── Main entry point ─────────────────────────────────────────

    render(game) {
        const container = document.getElementById("sheet-content");
        container.innerHTML = "";
        renderScreen(game, this, container);
    },

    // ── Header ───────────────────────────────────────────────────

    _renderHeader(game, title, pageNum, totalPages) {
        const header = document.createElement("div");
        header.className = "sheet-header";

        const whiteName = game.white.name === "White" ? "" : game.white.name;
        const darkName = game.dark.name === "Dark" ? "" : game.dark.name;
        const score = Game.getDisplayScore(game);

        const pageInfo = (pageNum && totalPages)
            ? `<span class="sheet-page-number">Page ${pageNum} / ${totalPages}</span>`
            : "";

        header.innerHTML = `
      <div class="sheet-title-row">
        <span class="sheet-title">${escapeHTML(title)}</span>
        ${pageInfo}
      </div>
      <div class="sheet-meta">
        <div class="sheet-meta-row">
          <span class="sheet-meta-pair"><span class="sheet-label">Game #:</span> <span class="sheet-value">${escapeHTML(game.gameId || "—")}</span></span>
        </div>
        <div class="sheet-meta-row">
          <span class="sheet-meta-pair"><span class="sheet-label">Location:</span> <span class="sheet-value">${escapeHTML(game.location || "—")}</span></span>
        </div>
        <div class="sheet-meta-row sheet-meta-times">
          <span class="sheet-meta-pair"><span class="sheet-label">Date:</span> <span class="sheet-value">${escapeHTML(game.date)}</span></span>
          <span class="sheet-meta-pair"><span class="sheet-label">Scheduled:</span> <span class="sheet-value">${escapeHTML(game.startTime || "--:--")}</span></span>
          <span class="sheet-meta-pair"><span class="sheet-label">Ended:</span> <span class="sheet-value">${escapeHTML(game.endTime || "--:--")}</span></span>
        </div>
      </div>
      <div class="sheet-teams">
        <div class="sheet-team sheet-team-white">
          <span class="sheet-team-label">White</span>
          <span class="sheet-team-name">${escapeHTML(whiteName)}</span>
        </div>
        <div class="sheet-final-score">${escapeHTML(score.white)} — ${escapeHTML(score.dark)}</div>
        <div class="sheet-team sheet-team-dark">
          <span class="sheet-team-label">Dark</span>
          <span class="sheet-team-name">${escapeHTML(darkName)}</span>
        </div>
      </div>
    `;
        return header;
    },

    // ── Existing render helpers (used by both screen + print) ────

    _renderProgressOfGame(game) {
        const section = document.createElement("div");
        section.className = "sheet-section";

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

        const logEntries = filterLogEvents(game.log, rules);

        for (const entry of logEntries) {
            const tr = document.createElement("tr");

            if (entry.event === "---") {
                tr.className = "sheet-period-end";
                tr.innerHTML = `<td colspan="5">——— End of ${Game.getPeriodLabel(entry.period)} ———</td>`;
            } else {
                const eventDef = rules.events.find((e) => e.code === entry.event);
                const align = eventDef && eventDef.align ? eventDef.align : "center";
                tr.innerHTML = `
          <td>${entry.period === "SO" ? "" : escapeHTML(entry.time.replace(/^0(\d:)/, '$1'))}</td>
          <td>${escapeHTML(entry.cap || "—")}</td>
          <td>${escapeHTML(entry.team || "—")}</td>
          <td style="text-align:${align}">${escapeHTML(entry.event)}</td>
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
        const data = buildPeriodScores(game);
        const section = document.createElement("div");
        section.className = "sheet-section";

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

        const tbody = document.createElement("tbody");

        for (const [label, scores, total] of [["White", data.white, data.totalWhite], ["Dark", data.dark, data.totalDark]]) {
            const tr = document.createElement("tr");
            let cells = `<td class="sheet-team-cell">${label}</td>`;
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
        const data = buildPersonalFoulTable(game);
        const section = document.createElement("div");
        section.className = "sheet-section";

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
                .map((f) => `${Game.getPeriodLabel(f.period)} ${f.time} ${f.event}`)
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
        const data = buildTimeoutSummary(game);
        const section = document.createElement("div");
        section.className = "sheet-section";

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
        <td>${entry.time}</td>
        <td>${entry.type}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderCardSummary(game) {
        const data = buildCardSummary(game);
        const section = document.createElement("div");
        section.className = "sheet-section";
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
        <td>${escapeHTML(entry.time)}</td>
        <td>${entry.type}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderPlayerStatsByTeam(game) {
        const data = buildPlayerStatsByTeam(game);
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Player Stats";
        section.appendChild(title);

        if (!data) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No stats recorded.";
            section.appendChild(empty);
            return section;
        }

        // Expand/collapse toggle (shared across both team tables)
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "btn stats-toggle-btn";
        toggleBtn.textContent = "Show Periods ▸";
        toggleBtn.type = "button";
        section.appendChild(toggleBtn);

        const tables = [];
        for (const [team, label] of [["W", "White"], ["D", "Dark"]]) {
            const teamName = team === "W"
                ? (game.white.name !== "White" ? ` (${game.white.name})` : "")
                : (game.dark.name !== "Dark" ? ` (${game.dark.name})` : "");

            const table = this._renderTeamStatsTable(
                `${label}${teamName}`,
                data.teams[team],
                data.statColumns,
                data.periodLabels,
                data.periods
            );
            tables.push(table);
            section.appendChild(table);
        }

        // Toggle handler
        let expanded = false;
        const colsPerStat = data.periods.length + 1;
        toggleBtn.addEventListener("click", () => {
            expanded = !expanded;
            toggleBtn.textContent = expanded ? "◂ Hide Periods" : "Show Periods ▸";
            for (const t of tables) {
                t.classList.toggle("stats-expanded", expanded);
                // Update colspans on stat group headers
                for (const th of t.querySelectorAll(".stat-group-header")) {
                    th.colSpan = expanded ? colsPerStat : 1;
                }
                // Update Cap header rowspan (2 when expanded for period row, 1 when collapsed)
                const capTh = t.querySelector(".stats-cap-header");
                if (capTh) capTh.rowSpan = expanded ? 2 : 1;
            }
        });

        return section;
    },

    _renderTeamStatsTable(teamTitle, teamData, statChunk, periodLabels, periods) {
        const wrapper = document.createElement("div");
        wrapper.className = "sheet-section stats-team-table";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = `Player Stats — ${teamTitle}`;
        wrapper.appendChild(title);

        const colsPerStat = periods.length + 1; // periods + Tot

        // Scrollable container for expanded mode
        const scrollWrap = document.createElement("div");
        scrollWrap.className = "stats-scroll-wrap";

        const table = document.createElement("table");
        table.className = "sheet-table sheet-table-compact sheet-table-stats";

        // ── thead: 2 rows ──
        const thead = document.createElement("thead");

        // Row 1: Cap + stat names
        // Collapsed: colspan=1 (only Tot column visible per stat)
        // Expanded: colspan=colsPerStat (period cols + Tot)
        const tr1 = document.createElement("tr");
        tr1.innerHTML = `<th class="stats-cap-header">Cap</th>`;
        for (const sc of statChunk) {
            tr1.innerHTML += `<th class="stat-group-header"><span>${escapeHTML(sc.name)}</span></th>`;
        }
        thead.appendChild(tr1);

        // Row 2: period labels + Tot per stat group
        const tr2 = document.createElement("tr");
        tr2.className = "stats-period-row";
        for (let si = 0; si < statChunk.length; si++) {
            for (let pi = 0; pi < periods.length; pi++) {
                const cls = pi === 0 ? 'stat-group-start stats-period-col' : 'stats-period-col';
                tr2.innerHTML += `<th class="${cls}">${periodLabels[pi]}</th>`;
            }
            tr2.innerHTML += `<th class="stats-total-col">Tot</th>`;
        }
        thead.appendChild(tr2);
        table.appendChild(thead);

        // ── tbody: player rows ──
        const tbody = document.createElement("tbody");
        for (const player of teamData.players) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td class="stats-cap-cell">${escapeHTML(player.cap)}</td>`;
            for (let si = 0; si < statChunk.length; si++) {
                const sc = statChunk[si];
                const statData = player.stats[sc.code] || {};
                for (let pi = 0; pi < periods.length; pi++) {
                    const val = statData[periods[pi]] || 0;
                    const cls = pi === 0 ? 'stat-group-start stats-period-col' : 'stats-period-col';
                    tr.innerHTML += `<td class="${cls}">${val || ''}</td>`;
                }
                const total = statData.total || 0;
                tr.innerHTML += `<td class="stats-total-col">${total ? `<strong>${total}</strong>` : ''}</td>`;
            }
            tbody.appendChild(tr);
        }

        // Totals row
        const totRow = document.createElement("tr");
        totRow.className = "stats-totals-row";
        totRow.innerHTML = `<td class="stats-cap-cell"><strong>Total</strong></td>`;
        for (let si = 0; si < statChunk.length; si++) {
            const sc = statChunk[si];
            const totals = teamData.totals[sc.code] || {};
            for (let pi = 0; pi < periods.length; pi++) {
                const val = totals[periods[pi]] || 0;
                const cls = pi === 0 ? 'stat-group-start stats-period-col' : 'stats-period-col';
                totRow.innerHTML += `<td class="${cls}">${val ? `<strong>${val}</strong>` : ''}</td>`;
            }
            const total = totals.total || 0;
            totRow.innerHTML += `<td class="stats-total-col">${total ? `<strong>${total}</strong>` : ''}</td>`;
        }
        tbody.appendChild(totRow);

        table.appendChild(tbody);
        scrollWrap.appendChild(table);
        wrapper.appendChild(scrollWrap);
        return wrapper;
    },
};

