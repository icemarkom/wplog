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

// wplog — Print Pagination Engine (pure — no DOM)
//
// All print layout math lives here: page capacity, column counts,
// event filtering, row-count descriptors, and generic pagination.
// Zero DOM dependency — fully testable with node --test.

import { RULES } from './config.js';
import { Game } from './game.js';
import {
    buildPeriodScores,
    buildPersonalFoulTable,
    buildTimeoutSummary,
    buildCardSummary,
    buildPlayerStats,
    buildPlayerStatsByTeam,
} from './sheet-data.js';

// ── Constants ────────────────────────────────────────────────

// Row-based print constants (all measurements in 18px rows).
export const ROW_HEIGHT = 18;

// Measured header: title(26) + meta(94) + teams(40) + gaps(32) = 192px
// 192/18 = 10.67 → round up to 11, plus 1 row spacing = 12.
export const HEADER_ROWS = 12;

export const PAGE_ROWS = { letter: 52, a4: 56 };

/**
 * Available content rows per page (total rows minus header).
 * @param {string} paperSize - "letter" or "a4"
 * @returns {number}
 */
export function availableRows(paperSize) {
    return PAGE_ROWS[paperSize] - HEADER_ROWS;
}

// Column-based print constants for stats tables.
// Usable width = page width minus 2 × 0.5in margins, at 96 CSS px/in.
//   Letter: (8.5 - 1) × 96 = 720px
// Column-based print constants for horizontal overflow splitting.
export const PAGE_WIDTH = { letter: 720, a4: 698 }; // printable px at 96dpi
export const STATS_COL_WIDTH = 20;     // px per period/Tot sub-column
export const STATS_CAP_COL_WIDTH = 40; // px for Cap column

// Rotated header sizing: ~9px per uppercase character at 10pt print font + 8px padding.
export const ROTATED_CHAR_PX = 9;
const ROTATED_PADDING_PX = 8;

/**
 * Compute how many print rows a rotated header occupies,
 * based on the longest stat name in a chunk.
 * @param {Array<{name: string}>} statChunk
 * @returns {number} row count (at least 1)
 */
export function rotatedHeaderRows(statChunk) {
    const longest = statChunk.reduce((max, sc) => Math.max(max, sc.name.length), 0);
    const heightPx = longest * ROTATED_CHAR_PX + ROTATED_PADDING_PX;
    return Math.max(1, Math.ceil(heightPx / ROW_HEIGHT));
}

/**
 * Max stat groups that fit in one table row for a given paper size.
 * @param {string} paperSize - "letter" or "a4"
 * @param {number} periodCount - Number of periods in the game
 * @returns {number}
 */
export function maxStatsPerTable(paperSize, periodCount) {
    const availWidth = PAGE_WIDTH[paperSize] - STATS_CAP_COL_WIDTH;
    const colsPerStat = periodCount + 1; // periods + Tot
    return Math.max(1, Math.floor(availWidth / (colsPerStat * STATS_COL_WIDTH)));
}

/**
 * Split stat columns into chunks that fit the available width.
 * @param {Array} statColumns - Full list of stat columns
 * @param {number} maxPerTable - From maxStatsPerTable()
 * @returns {Array<Array>} Chunks of stat columns
 */
export function splitStatColumns(statColumns, maxPerTable) {
    if (statColumns.length <= maxPerTable) return [statColumns];
    const chunks = [];
    for (let i = 0; i < statColumns.length; i += maxPerTable) {
        chunks.push(statColumns.slice(i, i + maxPerTable));
    }
    return chunks;
}

// ── Log Event Filtering ─────────────────────────────────────

/**
 * Filter out statsOnly events from the game log.
 * Keeps regular events and period-end markers ("---").
 * @param {Array} log - Game log entries
 * @param {object} rules - Resolved rules object (from RULES[key])
 * @returns {Array} Filtered log entries
 */
export function filterLogEvents(log, rules) {
    return log.filter((entry) => {
        if (entry.event === "---") return true;
        const eventDef = rules.events.find((e) => e.code === entry.event);
        return !eventDef || !eventDef.statsOnly;
    });
}

// ── Log Page Plan ────────────────────────────────────────────

/** Maximum columns per page in game log layout */
const MAX_LOG_COLS = 3;

/**
 * Build a pagination plan for multi-column game log layout.
 * Each page fills up to MAX_LOG_COLS columns of rowsPerColumn rows.
 *
 * @param {number} eventCount - Total number of log events to paginate
 * @param {number} availRows - Available rows per page
 * @returns {Array<{startIndex: number, endIndex: number, colCount: number}>}
 */
export function buildLogPagePlan(eventCount, availRows) {
    if (eventCount === 0) return [];

    // Each column needs 1 row for thead
    const rowsPerColumn = availRows - 1;
    if (rowsPerColumn <= 0) return [];

    const slotsPerPage = rowsPerColumn * MAX_LOG_COLS;
    const pages = [];

    for (let i = 0; i < eventCount; i += slotsPerPage) {
        const chunkSize = Math.min(eventCount - i, slotsPerPage);
        const colCount = Math.min(Math.ceil(chunkSize / rowsPerColumn), MAX_LOG_COLS);
        pages.push({
            startIndex: i,
            endIndex: i + chunkSize,
            colCount,
        });
    }

    return pages;
}

// ── Summary Descriptors ──────────────────────────────────────

/**
 * Build row-count descriptors for Game Summary section items.
 * Uses sheet-data builders to compute data, then counts rows.
 * Pure — no DOM.
 *
 * @param {object} game - Game data object
 * @returns {Array<{type: string, titleRows: number, theadRows: number, dataRows: number}>}
 */
export function buildSummaryDescriptors(game) {
    const descriptors = [];

    // Period Scores: title(1) + thead has 1 row in the tr but spans team label row = 1 thead row + 2 data rows
    const periodData = buildPeriodScores(game);
    descriptors.push({
        type: "periodScores",
        titleRows: 1,
        theadRows: 1,
        dataRows: 2, // White row + Dark row
        data: periodData,
    });

    // Personal Fouls
    const foulData = buildPersonalFoulTable(game);
    if (foulData.length > 0) {
        descriptors.push({
            type: "fouls",
            titleRows: 1,
            theadRows: 1,
            dataRows: foulData.length,
            data: foulData,
        });
    } else {
        descriptors.push({
            type: "fouls",
            titleRows: 1,
            theadRows: 0,
            dataRows: 1, // "No personal fouls recorded." message
            data: foulData,
        });
    }

    // Timeouts
    const toData = buildTimeoutSummary(game);
    if (toData.length > 0) {
        descriptors.push({
            type: "timeouts",
            titleRows: 1,
            theadRows: 1,
            dataRows: toData.length,
            data: toData,
        });
    } else {
        descriptors.push({
            type: "timeouts",
            titleRows: 1,
            theadRows: 0,
            dataRows: 1,
            data: toData,
        });
    }

    // Cards
    const cardData = buildCardSummary(game);
    if (cardData.length > 0) {
        descriptors.push({
            type: "cards",
            titleRows: 1,
            theadRows: 1,
            dataRows: cardData.length,
            data: cardData,
        });
    } else {
        descriptors.push({
            type: "cards",
            titleRows: 1,
            theadRows: 0,
            dataRows: 1,
            data: cardData,
        });
    }

    return descriptors;
}

// ── Stats Descriptors ────────────────────────────────────────

/**
 * Build row-count descriptors for Player Stats section items.
 * Produces per-team descriptors (one per team per table chunk).
 * Pure — no DOM.
 *
 * @param {object} game - Game data object
 * @param {string} [paperSize] - Paper size for column splitting (optional, defaults to no split)
 * @param {string} [statsDetail="totals"] - "totals" for totals-only, "periods" for per-period
 * @returns {Array<{type: string, team: string, titleRows: number, theadRows: number, dataRows: number, statsData: object, statChunk: Array}>}
 */
export function buildStatsDescriptors(game, paperSize, statsDetail = "totals") {
    const statsData = buildPlayerStatsByTeam(game);
    if (!statsData) return [];

    const isTotalsOnly = statsDetail !== "periods";

    let chunks;
    if (isTotalsOnly || !paperSize) {
        // Totals-only: no splitting needed (one column per stat).
        // Screen mode (no paperSize): also no splitting.
        chunks = [statsData.statColumns];
    } else {
        // Per-period print: split by paper width
        const periodCount = statsData.periods.length;
        const maxPerTable = maxStatsPerTable(paperSize, periodCount);
        chunks = splitStatColumns(statsData.statColumns, maxPerTable);
    }

    const descriptors = [];

    for (const team of ["W", "D"]) {
        const teamData = statsData.teams[team];
        const playerCount = teamData.players.length;

        for (let ci = 0; ci < chunks.length; ci++) {
            descriptors.push({
                type: "teamStats",
                team,
                chunkIndex: ci,
                titleRows: 1,
                theadRows: isTotalsOnly ? rotatedHeaderRows(chunks[ci]) : 2,
                dataRows: playerCount + 1, // players + totals row
                statsData,
                statChunk: chunks[ci],
                totalsOnly: isTotalsOnly,
            });
        }
    }

    return descriptors;
}

// ── Generic Pagination ───────────────────────────────────────

/**
 * Paginate an array of row-count descriptors across pages.
 * Handles anti-orphan logic and table splitting with "continued" markers.
 * Pure arithmetic — no DOM.
 *
 * Each descriptor has: { titleRows, theadRows, dataRows }
 * - titleRows: rows for the section title (usually 1)
 * - theadRows: rows for the table header (0 if no table, e.g. empty message)
 * - dataRows: number of data rows (or 1 for empty message)
 *
 * Returns an array of pages, each with items that reference the original
 * descriptor by index and specify which data rows to render:
 *   { index, startRow, endRow, continued }
 *
 * @param {Array<{titleRows: number, theadRows: number, dataRows: number}>} descriptors
 * @param {number} availRows - Available rows per page
 * @returns {Array<{items: Array<{index: number, startRow: number, endRow: number, continued: boolean}>}>}
 */
export function paginateItems(descriptors, availRows) {
    const pages = [];
    let currentItems = [];
    let usedRows = 0;

    const flushPage = () => {
        if (currentItems.length > 0) {
            pages.push({ items: currentItems });
            currentItems = [];
            usedRows = 0;
        }
    };

    for (let idx = 0; idx < descriptors.length; idx++) {
        const desc = descriptors[idx];
        const totalRows = desc.titleRows + desc.theadRows + desc.dataRows;

        // 1-row spacing between items on the same page
        const spacing = currentItems.length > 0 ? 1 : 0;

        // Non-splittable item (no thead = empty message, or small enough)
        if (desc.theadRows === 0) {
            if (usedRows + spacing + totalRows > availRows) flushPage();
            else usedRows += spacing;
            currentItems.push({
                index: idx,
                startRow: 0,
                endRow: desc.dataRows,
                continued: false,
            });
            usedRows += totalRows;
            continue;
        }

        // Does it fit entirely on current page?
        if (usedRows + spacing + totalRows <= availRows) {
            usedRows += spacing;
            currentItems.push({
                index: idx,
                startRow: 0,
                endRow: desc.dataRows,
                continued: false,
            });
            usedRows += totalRows;
            continue;
        }

        // Anti-orphan: need at least title + thead + 1 data row to start
        const overhead = desc.titleRows + desc.theadRows;
        const minToStart = spacing + overhead + 1;
        if (availRows - usedRows < minToStart) {
            flushPage();
        } else {
            usedRows += spacing;
        }

        // Split table across pages
        let rowIdx = 0;
        let isFirstChunk = true;
        while (rowIdx < desc.dataRows) {
            const space = availRows - usedRows;

            // Anti-orphan: need overhead + at least 1 data row
            if (space < overhead + 1) {
                flushPage();
                continue;
            }

            const dataFit = space - overhead;
            const end = Math.min(rowIdx + dataFit, desc.dataRows);

            currentItems.push({
                index: idx,
                startRow: rowIdx,
                endRow: end,
                continued: !isFirstChunk,
            });
            usedRows += overhead + (end - rowIdx);
            rowIdx = end;
            isFirstChunk = false;

            if (rowIdx < desc.dataRows) {
                flushPage();
            }
        }
    }

    if (currentItems.length > 0) {
        pages.push({ items: currentItems });
    }
    if (pages.length === 0) pages.push({ items: [] });
    return pages;
}
