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

// wplog — Game Sheet Print Rendering (DOM only)
//
// Renders print-ready DOM from pagination plans produced by pagination.js.
// No pagination logic here — just DOM construction from plans + data.

import { Game } from './game.js';
import { ROW_HEIGHT } from './pagination.js';
import { escapeHTML } from './sanitize.js';

// ── Game Log rendering ───────────────────────────────────────

/**
 * Render game log pages from a pagination plan.
 * @param {Array<{startIndex, endIndex, colCount}>} logPlan - From buildLogPagePlan()
 * @param {Array} filteredEvents - Pre-filtered log events (no statsOnly)
 * @param {object} game - Game data
 * @param {object} rules - Resolved rules object
 * @param {number} availRows - Available rows per page
 * @returns {Array<{elements: Array<Element>}>}
 */
export function renderLogPages(logPlan, filteredEvents, game, rules, availRows) {
    if (filteredEvents.length === 0) {
        const empty = document.createElement("p");
        empty.className = "sheet-empty";
        empty.textContent = "No events recorded.";
        return [{ elements: [empty] }];
    }

    if (logPlan.length === 0) return [{ elements: [] }];

    const rowsPerColumn = availRows - 1; // 1 row for thead per column
    const maxCols = 3;

    return logPlan.map((chunk) => {
        const events = filteredEvents.slice(chunk.startIndex, chunk.endIndex);
        return {
            elements: [_renderMultiColumnLog(events, chunk.colCount, maxCols, rowsPerColumn, game, rules)],
        };
    });
}

function _renderMultiColumnLog(events, colCount, gridCols, rowsPerColumn, game, rules) {
    const wrapper = document.createElement("div");
    wrapper.className = "sheet-log-columns";
    wrapper.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;

    for (let c = 0; c < colCount; c++) {
        const start = c * rowsPerColumn;
        const colEvents = events.slice(start, start + rowsPerColumn);
        if (colEvents.length === 0) continue;

        const table = document.createElement("table");
        table.className = "sheet-table sheet-table-log";

        const colgroup = document.createElement("colgroup");
        colgroup.innerHTML = `
            <col style="width:16%">
            <col style="width:14%">
            <col style="width:14%">
            <col style="width:30%">
            <col style="width:26%">
        `;
        table.appendChild(colgroup);

        const thead = document.createElement("thead");
        thead.innerHTML = `<tr>
            <th>Time</th><th>Cap</th><th>TM</th><th>Remarks</th><th>Score</th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (const entry of colEvents) {
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
        wrapper.appendChild(table);
    }

    return wrapper;
}

// ── Summary rendering ────────────────────────────────────────

// Section renderers: data → DOM element. One per summary descriptor type.
const SUMMARY_RENDERERS = {
    periodScores: _renderPeriodScoresSection,
    fouls: _renderFoulSection,
    timeouts: _renderTimeoutSection,
    cards: _renderCardSection,
};

/**
 * Render Game Summary pages from a pagination plan + descriptors.
 * @param {Array<{items: Array}>} plan - From paginateItems()
 * @param {Array} descriptors - From buildSummaryDescriptors() — each has .data
 * @param {object} game - Game data (unused, reserved for future use)
 * @returns {Array<{elements: Array<Element>}>}
 */
export function renderSummaryPages(plan, descriptors, game) {
    return _renderPaginatedPages(plan, descriptors, SUMMARY_RENDERERS);
}

/**
 * Render Player Stats pages from a pagination plan + descriptors.
 * Each descriptor carries .statsData from buildStatsDescriptors().
 * @param {Array<{items: Array}>} plan - From paginateItems()
 * @param {Array} descriptors - From buildStatsDescriptors() — each has .statsData + .statChunk
 * @param {object} game - Game data
 * @returns {Array<{elements: Array<Element>}>}
 */
export function renderStatsPages(plan, descriptors, game) {
    return plan.map((page) => {
        const elements = [];
        for (const item of page.items) {
            const desc = descriptors[item.index];
            const el = _renderTeamStatsFromDescriptor(desc, item, game);
            elements.push(el);
        }
        return { elements };
    });
}

// ── Generic paginated rendering ──────────────────────────────

function _renderPaginatedPages(plan, descriptors, renderers) {
    return plan.map((page) => {
        const elements = [];
        for (const item of page.items) {
            const desc = descriptors[item.index];
            const renderer = renderers[desc.type];
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
    const titleEl = fullEl.querySelector(".sheet-section-title, h3");
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
}

function _renderFoulSection(data) {
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
    table.innerHTML = `<thead><tr><th>Team</th><th>Cap</th><th>Fouls</th><th>Details</th></tr></thead>`;

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
}

function _renderTimeoutSection(data) {
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

// ── Team Stats section renderer ──────────────────────────────

function _renderTeamStatsFromDescriptor(desc, item, game) {
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
    wrapper.className = "sheet-section";

    const title = document.createElement("h3");
    title.className = "sheet-section-title";
    const isContinued = item.continued || desc.chunkIndex > 0;
    title.textContent = (isContinued ? "Player Stats — " + teamLabel + teamName + " - continued"
        : "Player Stats — " + teamLabel + teamName);
    wrapper.appendChild(title);

    const table = document.createElement("table");
    table.className = "sheet-table sheet-table-compact sheet-table-stats";

    // ── thead ──
    const thead = document.createElement("thead");

    if (totalsOnly) {
        // Single header row: Cap + rotated stat names
        // Set height = theadRows × ROW_HEIGHT so pagination math is exact.
        const headerHeight = desc.theadRows * ROW_HEIGHT;
        const tr = document.createElement("tr");
        tr.innerHTML = `<th class="stats-cap-header" style="height:${headerHeight}px">Cap</th>`;
        for (const sc of statChunk) {
            tr.innerHTML += `<th class="stat-header-rotated" style="height:${headerHeight}px"><span>${escapeHTML(sc.name)}</span></th>`;
        }
        thead.appendChild(tr);
    } else {
        // Two header rows: stat group names + period labels
        const tr1 = document.createElement("tr");
        tr1.innerHTML = `<th rowspan="2" class="stats-cap-header">Cap</th>`;
        for (const sc of statChunk) {
            tr1.innerHTML += `<th colspan="${colsPerStat}" class="stat-group-header"><span>${escapeHTML(sc.name)}</span></th>`;
        }
        thead.appendChild(tr1);

        const tr2 = document.createElement("tr");
        for (let si = 0; si < statChunk.length; si++) {
            for (let pi = 0; pi < periods.length; pi++) {
                const cls = pi === 0 ? ' class="stat-group-start"' : '';
                tr2.innerHTML += `<th${cls}>${periodLabels[pi]}</th>`;
            }
            tr2.innerHTML += `<th class="stats-total-col">Tot</th>`;
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
            tr.innerHTML = `<td class="stats-cap-cell">${escapeHTML(player.cap)}</td>`;
            for (const sc of statChunk) {
                const statData = player.stats[sc.code] || {};
                if (totalsOnly) {
                    const total = statData.total || 0;
                    tr.innerHTML += `<td class="stats-total-col">${total || ''}</td>`;
                } else {
                    for (let pi = 0; pi < periods.length; pi++) {
                        const val = statData[periods[pi]] || 0;
                        const cls = pi === 0 ? ' class="stat-group-start"' : '';
                        tr.innerHTML += `<td${cls}>${val || ''}</td>`;
                    }
                    const total = statData.total || 0;
                    tr.innerHTML += `<td class="stats-total-col">${total ? `<strong>${total}</strong>` : ''}</td>`;
                }
            }
            tbody.appendChild(tr);
        } else {
            // Totals row
            const totRow = document.createElement("tr");
            totRow.className = "stats-totals-row";
            totRow.innerHTML = `<td class="stats-cap-cell"><strong>Total</strong></td>`;
            for (const sc of statChunk) {
                const totals = teamData.totals[sc.code] || {};
                if (totalsOnly) {
                    const total = totals.total || 0;
                    totRow.innerHTML += `<td class="stats-total-col">${total ? `<strong>${total}</strong>` : ''}</td>`;
                } else {
                    for (let pi = 0; pi < periods.length; pi++) {
                        const val = totals[periods[pi]] || 0;
                        const cls = pi === 0 ? ' class="stat-group-start"' : '';
                        totRow.innerHTML += `<td${cls}>${val ? `<strong>${val}</strong>` : ''}</td>`;
                    }
                    const total = totals.total || 0;
                    totRow.innerHTML += `<td class="stats-total-col">${total ? `<strong>${total}</strong>` : ''}</td>`;
                }
            }
            tbody.appendChild(totRow);
        }
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
}

