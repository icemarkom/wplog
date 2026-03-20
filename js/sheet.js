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
import { renderScreen } from './sheet-screen.js';
import { buildLogPages, buildSummaryItems, buildStatsItems, paginateItems } from './sheet-print.js';

// wplog — Game Sheet (Orchestrator + Shared Helpers)

export const Sheet = {
    game: null,

    // Row-based print constants (all measurements in 18px rows).
    _ROW_HEIGHT: 18,
    // Measured header: title(26) + meta(94) + teams(40) + gaps(32) = 192px
    // 192/18 = 10.67 → round up to 11.
    _PAGE_ROWS: { letter: 52, a4: 56 },
    _HEADER_ROWS: 12,

    init(game, paperSize) {
        this.game = game;
        this.render(paperSize || null);
    },

    // ── Main render ──────────────────────────────────────────────

    render(paperSize) {
        const container = document.getElementById("sheet-content");
        container.innerHTML = "";

        const rules = RULES[this.game.rules];
        const isPrint = !!paperSize;

        if (!isPrint) {
            renderScreen(this, container);
            return;
        }

        // Print mode: paginated, multi-column log, sections on own pages
        const availRows = this._PAGE_ROWS[paperSize] - this._HEADER_ROWS;

        // === Section 1: Game Log ===
        const logPages = buildLogPages(this, availRows);
        // === Section 2: Game Summary ===
        const summaryItems = buildSummaryItems(this);
        const summaryPages = paginateItems(summaryItems, availRows);
        // === Section 3: Game Stats (optional) ===
        let statsPages = [];
        if (this.game.enableStats) {
            const statsItems = buildStatsItems(this);
            if (statsItems.length > 0) {
                statsPages = paginateItems(statsItems, availRows);
            }
        }

        // Collect all sections
        const sections = [
            { title: "Game Log", pages: logPages },
            { title: "Game Summary", pages: summaryPages },
        ];
        if (statsPages.length > 0) {
            sections.push({ title: "Game Stats", pages: statsPages });
        }

        // Count total pages
        const totalPages = sections.reduce((sum, s) => sum + s.pages.length, 0);

        // Render all pages
        let pageNum = 0;
        for (const section of sections) {
            for (const page of section.pages) {
                pageNum++;
                const pageDiv = document.createElement("div");
                pageDiv.className = "sheet-page" + (pageNum > 1 ? " sheet-page-break" : "");
                pageDiv.appendChild(this._renderHeader(section.title, pageNum, totalPages));
                for (const el of page.elements) {
                    pageDiv.appendChild(el);
                }
                container.appendChild(pageDiv);
            }
        }
    },

    // ── Header ───────────────────────────────────────────────────

    _renderHeader(title, pageNum, totalPages) {
        const game = this.game;
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

    _renderProgressOfGame() {
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
        const rules = RULES[this.game.rules];

        const logEntries = this.game.log.filter((entry) => {
            if (entry.event === "---") return true;
            const eventDef = rules.events.find((e) => e.code === entry.event);
            return !eventDef || !eventDef.statsOnly;
        });

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
          <td>${escapeHTML(Game.formatEntryScore(entry, this.game))}</td>
        `;
            }
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderPeriodScores() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Score by Period";
        section.appendChild(title);

        const table = document.createElement("table");
        table.className = "sheet-table sheet-table-compact";

        const periods = Game.getAllPeriods(this.game);
        const headerCells = periods.map((p) => `<th>${Game.getPeriodLabel(p)}</th>`).join("");

        const thead = document.createElement("thead");
        thead.innerHTML = `<tr><th>Team</th>${headerCells}<th>Total</th></tr>`;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        for (const team of ["W", "D"]) {
            const tr = document.createElement("tr");
            const teamLabel = team === "W" ? "White" : "Dark";
            let total = 0;
            let cells = `<td class="sheet-team-cell">${teamLabel}</td>`;

            for (const period of periods) {
                const goals = this.game.log.filter(
                    (e) => e.event === "G" && e.team === team && e.period === period
                ).length;
                total += goals;
                cells += `<td>${String(goals)}</td>`;
            }
            const displayScore = Game.getDisplayScore(this.game);
            const totalDisplay = team === "W" ? displayScore.white : displayScore.dark;
            cells += `<td class="sheet-total"><strong>${totalDisplay}</strong></td>`;
            tr.innerHTML = cells;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderFoulSummary() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Personal Fouls";
        section.appendChild(title);

        const rules = RULES[this.game.rules];
        const foulCodes = rules.events
            .filter(e => e.isPersonalFoul || e.autoFoulOut)
            .map(e => e.code);
        const playerFouls = {};

        for (const entry of this.game.log) {
            if (foulCodes.includes(entry.event) && entry.cap) {
                const key = entry.team + "#" + entry.cap;
                if (!playerFouls[key]) {
                    playerFouls[key] = { team: entry.team, cap: entry.cap, fouls: [] };
                }
                const eventDef = rules.events.find((e) => e.code === entry.event);
                playerFouls[key].fouls.push({
                    period: entry.period,
                    time: entry.time,
                    event: eventDef ? eventDef.name : entry.event,
                    code: entry.event,
                });
            }
        }

        if (Object.keys(playerFouls).length === 0) {
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

        for (const [, player] of Object.entries(playerFouls)) {
            const tr = document.createElement("tr");
            const personalFoulCount = player.fouls.filter(f => {
                const def = rules.events.find(e => e.name === f.event);
                return def && def.isPersonalFoul;
            }).length;
            const hasAutoFoulOut = player.fouls.some(f => {
                const def = rules.events.find(e => e.name === f.event);
                return def && def.autoFoulOut;
            });
            const isFouledOut = personalFoulCount >= rules.foulOutLimit || hasAutoFoulOut;
            if (isFouledOut) tr.classList.add("sheet-fouled-out");

            const details = player.fouls
                .map((f) => `${Game.getPeriodLabel(f.period)} ${f.time} ${f.event}`)
                .join("; ");

            tr.innerHTML = `
        <td>${player.team === "W" ? "White" : "Dark"}</td>
        <td>${escapeHTML(player.cap)}</td>
        <td>${player.fouls.length}</td>
        <td class="sheet-foul-details">${escapeHTML(details)}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderTimeoutSummary() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Timeouts";
        section.appendChild(title);

        const timeouts = this.game.log.filter((e) => e.event === "TO" || e.event === "TO30");

        if (timeouts.length === 0) {
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
        for (const entry of timeouts) {
            const tr = document.createElement("tr");
            const rules = RULES[this.game.rules];
            const eventDef = rules.events.find((e) => e.code === entry.event);
            const teamDisplay = entry.team === "W" ? "White" : (entry.team === "D" ? "Dark" : (entry.team === "" ? "Official" : "—"));
            tr.innerHTML = `
        <td>${teamDisplay}</td>
        <td>${Game.getPeriodLabel(entry.period)}</td>
        <td>${entry.time.replace(/^0(\d:)/, '$1')}</td>
        <td>${eventDef ? eventDef.name : entry.event}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderCardSummary() {
        const section = document.createElement("div");
        section.className = "sheet-section";
        section.innerHTML = `<div class="sheet-section-title">Cards</div>`;

        const cards = this.game.log.filter((e) => e.event === "YC" || e.event === "RC");

        if (cards.length === 0) {
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
        for (const entry of cards) {
            const tr = document.createElement("tr");
            const rules = RULES[this.game.rules];
            const eventDef = rules.events.find((e) => e.code === entry.event);
            tr.innerHTML = `
        <td>${entry.team === "W" ? "White" : (entry.team === "D" ? "Dark" : "—")}</td>
        <td>${escapeHTML(entry.cap || "—")}</td>
        <td>${Game.getPeriodLabel(entry.period)}</td>
        <td>${escapeHTML(entry.time.replace(/^0(\d:)/, '$1'))}</td>
        <td>${eventDef ? eventDef.name : escapeHTML(entry.event)}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderPlayerStats() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Player Stats";
        section.appendChild(title);

        const rules = RULES[this.game.rules];
        const statTypes = rules.events
            .filter((e) => !e.teamOnly)
            .map((e) => {
                const n = e.name;
                const plural = n.endsWith("y") ? n.slice(0, -1) + "ies" : n + "s";
                return { code: e.code, name: plural };
            });

        const periodOrder = [];
        const periodSeen = new Set();
        for (const entry of this.game.log) {
            if (entry.event === "---") continue;
            if (!periodSeen.has(entry.period)) {
                periodSeen.add(entry.period);
                periodOrder.push(entry.period);
            }
        }

        const counts = {};
        for (const st of statTypes) {
            counts[st.code] = { W: {}, D: {} };
        }
        for (const entry of this.game.log) {
            if (!entry.cap || !entry.team) continue;
            if (!counts[entry.event]) continue;
            const teamData = counts[entry.event][entry.team];
            if (!teamData[entry.cap]) teamData[entry.cap] = {};
            teamData[entry.cap][entry.period] = (teamData[entry.cap][entry.period] || 0) + 1;
        }

        let anyStats = false;
        for (const st of statTypes) {
            if (Object.keys(counts[st.code].W).length > 0 || Object.keys(counts[st.code].D).length > 0) {
                anyStats = true;
                break;
            }
        }
        if (!anyStats) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No stats recorded.";
            section.appendChild(empty);
            return section;
        }

        const periodHeaders = periodOrder.map((p) => Game.getPeriodLabel(p));
        const colsPerTeam = 1 + periodHeaders.length + 1;

        for (const st of statTypes) {
            const wCaps = Object.keys(counts[st.code].W).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
            const dCaps = Object.keys(counts[st.code].D).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
            if (wCaps.length === 0 && dCaps.length === 0) continue;

            const tableWrapper = this._renderStatTypeTable(st, wCaps, dCaps, counts[st.code], periodOrder, periodHeaders, colsPerTeam);
            // Append the table directly (unwrap from the wrapper div)
            section.appendChild(tableWrapper);
        }

        return section;
    },

    _renderStatTypeTable(st, wCaps, dCaps, data, periodOrder, periodHeaders, colsPerTeam) {
        const wrapper = document.createElement("div");
        wrapper.className = "sheet-section";

        // Title as h3 above table — same style as summary sections
        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = st.name;
        wrapper.appendChild(title);

        const totalCols = colsPerTeam * 2;
        const table = document.createElement("table");
        table.className = "sheet-table sheet-table-compact sheet-table-stats";

        const thead = document.createElement("thead");
        const periodCols = periodHeaders.map((h) => `<th>${h}</th>`).join("");
        thead.innerHTML = `
          <tr>
            <th colspan="${colsPerTeam}" class="sheet-team-header">White</th>
            <th colspan="${colsPerTeam}" class="sheet-team-header">Dark</th>
          </tr>
          <tr>
            <th>Cap</th>${periodCols}<th>Tot</th>
            <th>Cap</th>${periodCols}<th>Tot</th>
          </tr>
        `;
        table.appendChild(thead);

        const maxRows = Math.max(wCaps.length, dCaps.length);
        const tbody = document.createElement("tbody");
        for (let i = 0; i < maxRows; i++) {
            const tr = document.createElement("tr");
            let cells = "";

            // White half
            if (i < wCaps.length) {
                const cap = wCaps[i];
                const capData = data.W[cap];
                let total = 0;
                cells += `<td>${escapeHTML(cap)}</td>`;
                for (const period of periodOrder) {
                    const val = capData[period] || 0;
                    total += val;
                    cells += `<td>${val || ""}</td>`;
                }
                cells += `<td><strong>${total}</strong></td>`;
            } else {
                cells += `<td></td>`.repeat(colsPerTeam);
            }

            // Dark half
            if (i < dCaps.length) {
                const cap = dCaps[i];
                const capData = data.D[cap];
                let total = 0;
                cells += `<td>${escapeHTML(cap)}</td>`;
                for (const period of periodOrder) {
                    const val = capData[period] || 0;
                    total += val;
                    cells += `<td>${val || ""}</td>`;
                }
                cells += `<td><strong>${total}</strong></td>`;
            } else {
                cells += `<td></td>`.repeat(colsPerTeam);
            }

            tr.innerHTML = cells;
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrapper.appendChild(table);
        return wrapper;
    },
};
