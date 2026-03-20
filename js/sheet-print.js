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

// wplog — Game Sheet Print Pagination
// Multi-column log layout, row-based pagination, table splitting,
// anti-orphan logic, and "continued" headers for printed game sheets.

import { RULES } from './config.js';
import { Game } from './game.js';
import { escapeHTML } from './sanitize.js';

// ── Game Log pagination (multi-column) ───────────────────────

export function buildLogPages(sheet, availRows) {
    const rules = RULES[sheet.game.rules];

    // Filter out statsOnly events from the official game log
    const logEntries = sheet.game.log.filter((entry) => {
        if (entry.event === "---") return true;
        const eventDef = rules.events.find((e) => e.code === entry.event);
        return !eventDef || !eventDef.statsOnly;
    });

    if (logEntries.length === 0) {
        const empty = document.createElement("p");
        empty.className = "sheet-empty";
        empty.textContent = "No events recorded.";
        return [{ elements: [empty] }];
    }

    // Each column needs 1 row for thead
    const rowsPerColumn = availRows - 1;
    if (rowsPerColumn <= 0) return [{ elements: [] }];

    // Up to 3 columns per page; grid always uses 3 for consistent widths
    const maxCols = 3;
    const slotsPerPage = rowsPerColumn * maxCols;

    // Split events into page-sized chunks
    const pages = [];
    for (let i = 0; i < logEntries.length; i += slotsPerPage) {
        const chunk = logEntries.slice(i, i + slotsPerPage);
        const colCount = Math.min(Math.ceil(chunk.length / rowsPerColumn), maxCols);
        pages.push({
            elements: [renderMultiColumnLog(sheet, chunk, rowsPerColumn, colCount, maxCols)],
        });
    }
    return pages;
}

function renderMultiColumnLog(sheet, events, rowsPerColumn, colCount, gridCols) {
    const rules = RULES[sheet.game.rules];
    const wrapper = document.createElement("div");
    wrapper.className = "sheet-log-columns";
    wrapper.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;

    // Column-first fill: first rowsPerColumn events → col 1, etc.
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
                    <td>${escapeHTML(Game.formatEntryScore(entry, sheet.game))}</td>
                `;
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        wrapper.appendChild(table);
    }

    return wrapper;
}

// ── Summary / Stats pagination ───────────────────────────────

export function buildSummaryItems(sheet) {
    const items = [];

    // Period Scores: title(1) + thead(2) + 2 data rows = 5
    const periodScoresEl = sheet._renderPeriodScores();
    const periodScoresRows = 1 + 2 + 2; // title + thead + data
    items.push({ el: periodScoresEl, rows: periodScoresRows });

    // Personal Fouls: title(1) + thead(1) + data
    const foulEl = sheet._renderFoulSummary();
    const foulTable = foulEl.querySelector("table");
    if (foulTable) {
        const foulDataRows = foulTable.querySelector("tbody").children.length;
        items.push({ el: foulEl, rows: 1 + 1 + foulDataRows }); // title + thead + data
    } else {
        items.push({ el: foulEl, rows: 2 }); // title + empty message
    }

    // Timeouts: title(1) + thead(1) + data
    const toEl = sheet._renderTimeoutSummary();
    const toTable = toEl.querySelector("table");
    if (toTable) {
        const toDataRows = toTable.querySelector("tbody").children.length;
        items.push({ el: toEl, rows: 1 + 1 + toDataRows }); // title + thead + data
    } else {
        items.push({ el: toEl, rows: 2 });
    }

    // Cards: title(1) + thead(1) + data
    const cardEl = sheet._renderCardSummary();
    const cardTable = cardEl.querySelector("table");
    if (cardTable) {
        const cardDataRows = cardTable.querySelector("tbody").children.length;
        items.push({ el: cardEl, rows: 1 + 1 + cardDataRows }); // title + thead + data
    } else {
        items.push({ el: cardEl, rows: 2 });
    }

    return items;
}

export function buildStatsItems(sheet) {
    const rules = RULES[sheet.game.rules];
    const items = [];

    const statTypes = rules.events
        .filter((e) => !e.teamOnly)
        .map((e) => {
            const n = e.name;
            const plural = n.endsWith("y") ? n.slice(0, -1) + "ies" : n + "s";
            return { code: e.code, name: plural };
        });

    // Get ordered periods
    const periodOrder = [];
    const periodSeen = new Set();
    for (const entry of sheet.game.log) {
        if (entry.event === "---") continue;
        if (!periodSeen.has(entry.period)) {
            periodSeen.add(entry.period);
            periodOrder.push(entry.period);
        }
    }

    // Collect counts: counts[code][team][cap][period] = count
    const counts = {};
    for (const st of statTypes) {
        counts[st.code] = { W: {}, D: {} };
    }
    for (const entry of sheet.game.log) {
        if (!entry.cap || !entry.team) continue;
        if (!counts[entry.event]) continue;
        const teamData = counts[entry.event][entry.team];
        if (!teamData[entry.cap]) teamData[entry.cap] = {};
        teamData[entry.cap][entry.period] = (teamData[entry.cap][entry.period] || 0) + 1;
    }

    const periodHeaders = periodOrder.map((p) => Game.getPeriodLabel(p));
    const colsPerTeam = 1 + periodHeaders.length + 1; // Cap + periods + Tot

    for (const st of statTypes) {
        const wCaps = Object.keys(counts[st.code].W).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
        const dCaps = Object.keys(counts[st.code].D).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
        if (wCaps.length === 0 && dCaps.length === 0) continue;

        const tableEl = sheet._renderStatTypeTable(st, wCaps, dCaps, counts[st.code], periodOrder, periodHeaders, colsPerTeam);
        const maxRows = Math.max(wCaps.length, dCaps.length);
        // h3 title(1) + thead has 2 rows (team headers + column headers) + data rows
        items.push({ el: tableEl, rows: 1 + 2 + maxRows });
    }

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "sheet-section";
        const p = document.createElement("p");
        p.className = "sheet-empty";
        p.textContent = "No stats recorded.";
        empty.appendChild(p);
        items.push({ el: empty, rows: 1 });
    }

    return items;
}

// ── Generic table pagination ─────────────────────────────────

export function paginateItems(items, availRows) {
    const pages = [];
    let currentElements = [];
    let usedRows = 0;

    const flushPage = () => {
        if (currentElements.length > 0) {
            pages.push({ elements: currentElements });
            currentElements = [];
            usedRows = 0;
        }
    };

    for (const item of items) {
        const section = item.el;
        const table = section.querySelector("table");

        // 1-row spacing between items on the same page
        const spacing = currentElements.length > 0 ? 1 : 0;

        if (!table) {
            // Non-table item (empty message etc.)
            if (usedRows + spacing + item.rows > availRows) flushPage();
            else usedRows += spacing;
            currentElements.push(section);
            usedRows += item.rows;
            continue;
        }

        const thead = table.querySelector("thead");
        const tbody = table.querySelector("tbody");
        if (!tbody) {
            if (usedRows + spacing + item.rows > availRows) flushPage();
            else usedRows += spacing;
            currentElements.push(section);
            usedRows += item.rows;
            continue;
        }

        // Count title element (h3 or div.sheet-section-title) above the table
        const titleEl = section.querySelector(".sheet-section-title, h3");
        const titleRows = titleEl ? 1 : 0;
        const theadRowCount = thead ? thead.querySelectorAll("tr").length : 0;
        const allRows = Array.from(tbody.children);

        // Total for this item including spacing
        const totalItemRows = spacing + titleRows + theadRowCount + allRows.length;

        // Does it fit entirely on current page?
        if (usedRows + totalItemRows <= availRows) {
            usedRows += spacing;
            currentElements.push(section);
            usedRows += titleRows + theadRowCount + allRows.length;
            continue;
        }

        // Anti-orphan: need at least title + thead + 1 data row to start
        const minToStart = spacing + titleRows + theadRowCount + 1;
        if (availRows - usedRows < minToStart) {
            flushPage();
        } else {
            usedRows += spacing;
        }

        // Split table across pages
        let rowIdx = 0;
        let isFirstChunk = true;
        while (rowIdx < allRows.length) {
            const space = availRows - usedRows;
            // Always count title row — first chunk gets original, continuations get "- continued"
            const overhead = theadRowCount + titleRows;

            // Anti-orphan: need overhead + at least 1 data row
            if (space < overhead + 1) {
                flushPage();
                continue;
            }

            const dataFit = space - overhead;
            const end = Math.min(rowIdx + dataFit, allRows.length);

            const chunkSection = document.createElement("div");
            chunkSection.className = section.className;
            if (titleEl) {
                const titleClone = titleEl.cloneNode(true);
                if (!isFirstChunk) {
                    titleClone.textContent = titleEl.textContent + " - continued";
                }
                chunkSection.appendChild(titleClone);
            }
            const chunkTable = document.createElement("table");
            chunkTable.className = table.className;
            if (thead) chunkTable.appendChild(thead.cloneNode(true));
            const chunkTbody = document.createElement("tbody");
            for (let i = rowIdx; i < end; i++) {
                chunkTbody.appendChild(allRows[i].cloneNode(true));
            }
            chunkTable.appendChild(chunkTbody);
            chunkSection.appendChild(chunkTable);

            currentElements.push(chunkSection);
            usedRows += overhead + (end - rowIdx);
            rowIdx = end;
            isFirstChunk = false;

            if (rowIdx < allRows.length) {
                flushPage();
            }
        }
    }

    if (currentElements.length > 0) {
        pages.push({ elements: currentElements });
    }
    if (pages.length === 0) pages.push({ elements: [] });
    return pages;
}
