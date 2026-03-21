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

// wplog — Print Rendering Module (Standalone)
//
// Fully self-contained print renderer. Uses prn-* CSS classes
// exclusively — zero overlap with screen's sheet-* classes.
// All dynamic values set via --prn-* CSS custom properties.
// No inline styles.

import { RULES } from './config.js';
import { Game } from './game.js';
import { escapeHTML } from './sanitize.js';
import {
    PAGE_WIDTH,
    CAP_COL_WIDTH,
    ROW_HEIGHT,
    ROTATED_CHAR_PX,
    rotatedHeaderRows,
    availableRows,
    filterLogEvents,
    buildLogPagePlan,
    buildSummaryDescriptors,
    buildStatsDescriptors,
    paginateItems,
} from './pagination.js';

export const Print = {

    // ── Main entry point ─────────────────────────────────────────

    render(game, paperSize, statsDetail) {
        const container = document.getElementById("sheet-content");
        container.innerHTML = "";

        const avail = availableRows(paperSize);
        const rules = RULES[game.rules];

        // === Section 1: Game Log ===
        const filteredLog = filterLogEvents(game.log, rules);
        const logPlan = buildLogPagePlan(filteredLog.length, avail);
        const logPages = _renderLogPages(logPlan, filteredLog, game, rules, avail);

        // === Section 2: Game Summary ===
        const summaryDescriptors = buildSummaryDescriptors(game);
        const summaryPlan = paginateItems(summaryDescriptors, avail);
        const summaryPages = _renderSummaryPages(summaryPlan, summaryDescriptors);

        // === Section 3: Game Stats (optional) ===
        let statsPages = [];
        if (game.enableStats) {
            const statsDescriptors = buildStatsDescriptors(game, paperSize, statsDetail);
            if (statsDescriptors.length > 0) {
                const statsPlan = paginateItems(statsDescriptors, avail);
                statsPages = _renderStatsPages(statsPlan, statsDescriptors, game, paperSize);
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
                pageDiv.className = "prn-page" + (pageNum > 1 ? " prn-page-break" : "");
                pageDiv.appendChild(_renderHeader(game, section.title, pageNum, totalPages));
                for (const el of page.elements) {
                    pageDiv.appendChild(el);
                }
                container.appendChild(pageDiv);
            }
        }
    },
};

// ── Header ───────────────────────────────────────────────────

function _renderHeader(game, title, pageNum, totalPages) {
    const header = document.createElement("div");
    header.className = "prn-header";

    const whiteName = game.white.name === "White" ? "" : game.white.name;
    const darkName = game.dark.name === "Dark" ? "" : game.dark.name;
    const score = Game.getDisplayScore(game);

    const pageInfo = (pageNum && totalPages)
        ? `<span class="prn-page-number">Page ${pageNum} / ${totalPages}</span>`
        : "";

    header.innerHTML = `
      <div class="prn-title-row">
        <span class="prn-title">${escapeHTML(title)}</span>
        ${pageInfo}
      </div>
      <div class="prn-meta">
        <div class="prn-meta-row">
          <span class="prn-meta-pair"><span class="prn-label">Game #:</span> <span class="prn-value">${escapeHTML(game.gameId || "—")}</span></span>
        </div>
        <div class="prn-meta-row">
          <span class="prn-meta-pair"><span class="prn-label">Location:</span> <span class="prn-value">${escapeHTML(game.location || "—")}</span></span>
        </div>
        <div class="prn-meta-row prn-meta-times">
          <span class="prn-meta-pair"><span class="prn-label">Date:</span> <span class="prn-value">${escapeHTML(game.date)}</span></span>
          <span class="prn-meta-pair"><span class="prn-label">Scheduled:</span> <span class="prn-value">${escapeHTML(game.startTime || "--:--")}</span></span>
          <span class="prn-meta-pair"><span class="prn-label">Ended:</span> <span class="prn-value">${escapeHTML(game.endTime || "--:--")}</span></span>
        </div>
      </div>
      <div class="prn-teams">
        <div class="prn-team prn-team-white">
          <span class="prn-team-label">White</span>
          <span class="prn-team-name">${escapeHTML(whiteName)}</span>
        </div>
        <div class="prn-final-score">${escapeHTML(score.white)} — ${escapeHTML(score.dark)}</div>
        <div class="prn-team prn-team-dark">
          <span class="prn-team-label">Dark</span>
          <span class="prn-team-name">${escapeHTML(darkName)}</span>
        </div>
      </div>
    `;
    return header;
}

// ── Game Log rendering ───────────────────────────────────────

function _renderLogPages(logPlan, filteredEvents, game, rules, availRows) {
    if (filteredEvents.length === 0) {
        const empty = document.createElement("p");
        empty.className = "prn-empty";
        empty.textContent = "No events recorded.";
        return [{ elements: [empty] }];
    }

    if (logPlan.length === 0) return [{ elements: [] }];

    const rowsPerColumn = availRows - 1; // 1 row for thead per column

    return logPlan.map((chunk) => {
        const events = filteredEvents.slice(chunk.startIndex, chunk.endIndex);
        return {
            elements: [_renderMultiColumnLog(events, chunk.colCount, rowsPerColumn, game, rules)],
        };
    });
}

function _renderMultiColumnLog(events, colCount, rowsPerColumn, game, rules) {
    const wrapper = document.createElement("div");
    wrapper.className = "prn-log-columns";
    wrapper.style.setProperty("--prn-grid-cols", `repeat(${colCount}, 1fr)`);

    for (let c = 0; c < colCount; c++) {
        const start = c * rowsPerColumn;
        const colEvents = events.slice(start, start + rowsPerColumn);
        if (colEvents.length === 0) continue;

        const table = document.createElement("table");
        table.className = "prn-table prn-table-log";

        // Colgroup — no inline styles, CSS handles widths via nth-child
        const colgroup = document.createElement("colgroup");
        for (let i = 0; i < 5; i++) {
            colgroup.appendChild(document.createElement("col"));
        }
        table.appendChild(colgroup);

        const thead = document.createElement("thead");
        thead.innerHTML = `<tr>
            <th>Time</th><th>Cap</th><th>Team</th><th>Remarks</th><th>Score</th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (const entry of colEvents) {
            const tr = document.createElement("tr");
            if (entry.event === "---") {
                tr.className = "prn-period-end";
                tr.innerHTML = `<td colspan="5">——— End of ${Game.getPeriodLabel(entry.period)} ———</td>`;
            } else {
                const eventDef = rules.events.find((e) => e.code === entry.event);
                const align = eventDef && eventDef.align ? eventDef.align : "center";
                tr.innerHTML = `
                    <td>${entry.period === "SO" ? "" : escapeHTML(entry.time.replace(/^0(\d:)/, '$1'))}</td>
                    <td>${escapeHTML(entry.cap || "—")}</td>
                    <td>${escapeHTML(entry.team || "—")}</td>
                    <td class="prn-align-${align}">${escapeHTML(entry.event)}</td>
                    <td>${escapeHTML(Game.formatEntryScore(entry, game))}</td>
                `;
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrapper.appendChild(table);
    }

    return wrapper;
}

// ── Summary rendering ────────────────────────────────────────

const SUMMARY_RENDERERS = {
    periodScores: _renderPeriodScoresSection,
    fouls: _renderFoulSection,
    timeouts: _renderTimeoutSection,
    cards: _renderCardSection,
};

function _renderSummaryPages(plan, descriptors) {
    return plan.map((page) => {
        const elements = [];
        for (const item of page.items) {
            const desc = descriptors[item.index];
            const renderer = SUMMARY_RENDERERS[desc.type];
            if (!renderer) continue;

            if (!item.continued && item.startRow === 0 && item.endRow === desc.dataRows) {
                // Full item — render normally
                elements.push(renderer(desc.data));
            } else {
                // Split item — render full, then slice
                elements.push(_renderSlice(renderer(desc.data), item, desc));
            }
        }
        return { elements };
    });
}

function _renderSlice(fullEl, item, desc) {
    const table = fullEl.querySelector("table");
    if (!table) return fullEl;

    const tbody = table.querySelector("tbody");
    if (!tbody) return fullEl;

    const allRows = Array.from(tbody.children);

    const section = document.createElement("div");
    section.className = fullEl.className;

    // Title with optional " - continued" suffix
    const titleEl = fullEl.querySelector(".prn-section-title, h3");
    if (titleEl) {
        const titleClone = titleEl.cloneNode(true);
        if (item.continued) {
            titleClone.textContent = titleEl.textContent + " - continued";
        }
        section.appendChild(titleClone);
    }

    // Sliced table with repeated thead
    const sliceTable = document.createElement("table");
    sliceTable.className = table.className;
    const thead = table.querySelector("thead");
    if (thead) sliceTable.appendChild(thead.cloneNode(true));

    const sliceTbody = document.createElement("tbody");
    for (let i = item.startRow; i < item.endRow && i < allRows.length; i++) {
        sliceTbody.appendChild(allRows[i].cloneNode(true));
    }
    sliceTable.appendChild(sliceTbody);
    section.appendChild(sliceTable);

    return section;
}

// ── Summary section renderers (data → DOM) ───────────────────

function _renderPeriodScoresSection(data) {
    const section = document.createElement("div");
    section.className = "prn-section";

    const title = document.createElement("h3");
    title.className = "prn-section-title";
    title.textContent = "Score by Period";
    section.appendChild(title);

    const table = document.createElement("table");
    table.className = "prn-table prn-table-compact";

    const headerCells = data.periods.map((p) => `<th>${p}</th>`).join("");
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>Team</th>${headerCells}<th>Total</th></tr>`;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const [label, scores, total] of [["White", data.white, data.totalWhite], ["Dark", data.dark, data.totalDark]]) {
        const tr = document.createElement("tr");
        let cells = `<td class="prn-team-cell">${label}</td>`;
        for (const count of scores) {
            cells += `<td>${String(count)}</td>`;
        }
        cells += `<td class="prn-total"><strong>${total}</strong></td>`;
        tr.innerHTML = cells;
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    section.appendChild(table);
    return section;
}

function _renderFoulSection(data) {
    const section = document.createElement("div");
    section.className = "prn-section";

    const title = document.createElement("h3");
    title.className = "prn-section-title";
    title.textContent = "Personal Fouls";
    section.appendChild(title);

    if (data.length === 0) {
        const empty = document.createElement("p");
        empty.className = "prn-empty";
        empty.textContent = "No personal fouls recorded.";
        section.appendChild(empty);
        return section;
    }

    const table = document.createElement("table");
    table.className = "prn-table";
    table.innerHTML = `<thead><tr><th>Team</th><th>Cap</th><th>Fouls</th><th>Details</th></tr></thead>`;

    const tbody = document.createElement("tbody");
    for (const player of data) {
        const tr = document.createElement("tr");
        if (player.fouledOut) tr.classList.add("prn-fouled-out");
        const details = player.details
            .map((f) => `${Game.getPeriodLabel(f.period)} ${f.time} ${f.event}`)
            .join("; ");
        tr.innerHTML = `
            <td>${player.team === "W" ? "White" : "Dark"}</td>
            <td>${escapeHTML(player.cap)}</td>
            <td>${player.count}</td>
            <td class="prn-foul-details">${escapeHTML(details)}</td>
        `;
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    section.appendChild(table);
    return section;
}

function _renderTimeoutSection(data) {
    const section = document.createElement("div");
    section.className = "prn-section";

    const title = document.createElement("h3");
    title.className = "prn-section-title";
    title.textContent = "Timeouts";
    section.appendChild(title);

    if (data.length === 0) {
        const empty = document.createElement("p");
        empty.className = "prn-empty";
        empty.textContent = "No timeouts recorded.";
        section.appendChild(empty);
        return section;
    }

    const table = document.createElement("table");
    table.className = "prn-table";
    table.innerHTML = `<thead><tr><th>Team</th><th>Period</th><th>Time</th><th>Type</th></tr></thead>`;

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
}

function _renderCardSection(data) {
    const section = document.createElement("div");
    section.className = "prn-section";
    section.innerHTML = `<div class="prn-section-title">Cards</div>`;

    if (data.length === 0) {
        const empty = document.createElement("p");
        empty.className = "prn-empty";
        empty.textContent = "No cards issued.";
        section.appendChild(empty);
        return section;
    }

    const table = document.createElement("table");
    table.className = "prn-table";
    table.innerHTML = `<thead><tr><th>Team</th><th>Cap</th><th>Period</th><th>Time</th><th>Type</th></tr></thead>`;

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
}

// ── Stats rendering ──────────────────────────────────────────

function _renderStatsPages(plan, descriptors, game, paperSize) {
    return plan.map((page) => {
        const elements = [];
        for (const item of page.items) {
            const desc = descriptors[item.index];
            const el = _renderTeamStats(desc, item, game, paperSize);
            elements.push(el);
        }
        return { elements };
    });
}

function _renderTeamStats(desc, item, game, paperSize) {
    const statsData = desc.statsData;
    const statChunk = desc.statChunk;
    const team = desc.team;
    const periods = statsData.periods;
    const periodLabels = statsData.periodLabels;
    const teamData = statsData.teams[team];
    const totalsOnly = desc.totalsOnly;
    const colsPerStat = totalsOnly ? 1 : periods.length + 1;

    const teamLabel = team === "W" ? "White" : "Dark";
    const teamName = team === "W"
        ? (game.white.name !== "White" ? ` (${game.white.name})` : "")
        : (game.dark.name !== "Dark" ? ` (${game.dark.name})` : "");

    const wrapper = document.createElement("div");
    wrapper.className = "prn-section";

    const title = document.createElement("h3");
    title.className = "prn-section-title";
    const isContinued = item.continued || desc.chunkIndex > 0;
    title.textContent = (isContinued ? "Player Stats — " + teamLabel + teamName + " - continued"
        : "Player Stats — " + teamLabel + teamName);
    wrapper.appendChild(title);

    const table = document.createElement("table");
    table.className = "prn-table prn-table-compact prn-table-stats" + (totalsOnly ? " prn-stats-totals" : "");

    // Set CSS custom properties for stats table sizing
    const pw = PAGE_WIDTH[paperSize] || PAGE_WIDTH.letter;
    table.style.setProperty("--prn-cap-col-width", `${CAP_COL_WIDTH}px`);

    // Fixed column widths: distribute available space across all data columns.
    // Some columns get +1px to absorb floor-division remainder → table fills full page width.
    const statColCount = statChunk.length * colsPerStat;
    const available = pw - CAP_COL_WIDTH;
    const baseWidth = Math.floor(available / statColCount);
    const remainder = available - baseWidth * statColCount;
    table.style.setProperty("--prn-stat-col-width", `${baseWidth}px`);

    // Rotated header height for totals mode
    if (totalsOnly) {
        const headerHeightPx = rotatedHeaderRows(statChunk) * ROW_HEIGHT;
        table.style.setProperty("--prn-header-height", `${headerHeightPx}px`);
    }

    // ── colgroup: explicit column widths for table-layout: fixed ──
    const colgroup = document.createElement("colgroup");
    const capCol = document.createElement("col");
    capCol.style.width = `${CAP_COL_WIDTH}px`;
    colgroup.appendChild(capCol);
    for (let i = 0; i < statColCount; i++) {
        const w = i < remainder ? baseWidth + 1 : baseWidth;
        const col = document.createElement("col");
        col.style.width = `${w}px`;
        colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    // ── thead ──
    const thead = document.createElement("thead");

    if (totalsOnly) {
        // Single header row: Cap + horizontal stat names (no rotation)
        const tr = document.createElement("tr");
        tr.innerHTML = `<th class="prn-cap-header">Cap</th>`;
        for (const sc of statChunk) {
            tr.innerHTML += `<th class="prn-stat-group-header"><span>${escapeHTML(sc.name)}</span></th>`;
        }
        thead.appendChild(tr);
    } else {
        // Two header rows: stat group names + period labels
        const tr1 = document.createElement("tr");
        tr1.innerHTML = `<th rowspan="2" class="prn-cap-header">Cap</th>`;
        for (const sc of statChunk) {
            tr1.innerHTML += `<th colspan="${colsPerStat}" class="prn-stat-group-header"><span>${escapeHTML(sc.name)}</span></th>`;
        }
        thead.appendChild(tr1);

        const tr2 = document.createElement("tr");
        for (let si = 0; si < statChunk.length; si++) {
            for (let pi = 0; pi < periods.length; pi++) {
                const cls = pi === 0 ? ' class="prn-stat-group-start"' : '';
                const label = periodLabels[pi].replace(/^OT/, "O");
                tr2.innerHTML += `<th${cls}>${label}</th>`;
            }
            tr2.innerHTML += `<th class="prn-stats-total-col">T</th>`;
        }
        thead.appendChild(tr2);
    }
    table.appendChild(thead);

    // ── tbody: slice player rows based on item.startRow / item.endRow ──
    const allPlayers = teamData.players;
    const startRow = item.startRow;
    const endRow = item.endRow;

    const tbody = document.createElement("tbody");
    for (let i = startRow; i < endRow; i++) {
        if (i < allPlayers.length) {
            const player = allPlayers[i];
            const tr = document.createElement("tr");
            tr.innerHTML = `<td class="prn-cap-cell">${escapeHTML(player.cap)}</td>`;
            for (const sc of statChunk) {
                const statData = player.stats[sc.code] || {};
                if (totalsOnly) {
                    const total = statData.total || 0;
                    tr.innerHTML += `<td class="prn-stats-total-col">${total || ''}</td>`;
                } else {
                    for (let pi = 0; pi < periods.length; pi++) {
                        const val = statData[periods[pi]] || 0;
                        const cls = pi === 0 ? ' class="prn-stat-group-start"' : '';
                        tr.innerHTML += `<td${cls}>${val || ''}</td>`;
                    }
                    const total = statData.total || 0;
                    tr.innerHTML += `<td class="prn-stats-total-col">${total ? `<strong>${total}</strong>` : ''}</td>`;
                }
            }
            tbody.appendChild(tr);
        } else {
            // Totals row
            const totRow = document.createElement("tr");
            totRow.className = "prn-stats-totals-row";
            totRow.innerHTML = `<td class="prn-cap-cell"><strong>Total</strong></td>`;
            for (const sc of statChunk) {
                const totals = teamData.totals[sc.code] || {};
                if (totalsOnly) {
                    const total = totals.total || 0;
                    totRow.innerHTML += `<td class="prn-stats-total-col">${total ? `<strong>${total}</strong>` : ''}</td>`;
                } else {
                    for (let pi = 0; pi < periods.length; pi++) {
                        const val = totals[periods[pi]] || 0;
                        const cls = pi === 0 ? ' class="prn-stat-group-start"' : '';
                        totRow.innerHTML += `<td${cls}>${val ? `<strong>${val}</strong>` : ''}</td>`;
                    }
                    const total = totals.total || 0;
                    totRow.innerHTML += `<td class="prn-stats-total-col">${total ? `<strong>${total}</strong>` : ''}</td>`;
                }
            }
            tbody.appendChild(totRow);
        }
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
}
