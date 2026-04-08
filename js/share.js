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

import { buildFilename, buildCSV } from './export.js';
import { buildRosterCSV, buildRosterFilename, hasRosterData } from './roster.js';
import { Sheet } from './sheet.js';
import { initDialog } from './dialog.js';

// wplog — Share / Export

export const Share = {
    game: null,
    _bound: false,
    _pendingFormat: null, // "csv" or "json"

    init(game) {
        this.game = game || null;
        const csvBtn = document.getElementById("export-csv-btn");
        const jsonBtn = document.getElementById("export-json-btn");
        const printBtn = document.getElementById("print-sheet-btn");
        
        csvBtn.disabled = !this.game;
        jsonBtn.disabled = !this.game;
        if (printBtn) printBtn.disabled = !this.game;

        // Roster download: disabled when no roster data
        const rosterBtn = document.getElementById("export-roster-btn");
        if (rosterBtn) {
            rosterBtn.disabled = !this.game || !hasRosterData(this.game);
        }
        
        if (!this._bound) {
            if (printBtn) {
                printBtn.addEventListener("click", () => {
                    if (this.game) this._showPrintDialog();
                });
            }

            csvBtn.addEventListener("click", () => {
                this._showDownloadDialog("csv");
            });

            jsonBtn.addEventListener("click", () => {
                this._showDownloadDialog("json");
            });

            // Download confirm
            document.getElementById("download-confirm").addEventListener("click", () => {
                this._doDownload();
                this._closeDownloadDialog();
            });

            initDialog("download-dialog", {
                dismissId: "download-cancel",
                onClose: () => this._closeDownloadDialog(),
            });

            // Roster download button
            const rosterBtn = document.getElementById("export-roster-btn");
            if (rosterBtn) {
                rosterBtn.addEventListener("click", () => {
                    this._showRosterDownloadDialog();
                });
            }

            // Roster download dialog
            this._setupRosterDownloadDialog();

            // Print UI Event Delegation
            this._setupPrintDialogOnce();

            this._bound = true;
        }
    },

    // ── Print Dialog ────────────────────────────────────────

    _setupPrintDialogOnce() {
        const sectionsEls = document.querySelectorAll("#print-sections-mode .segment-btn");
        const formatGroup = document.getElementById("print-stats-format-group");

        const hideStatsControls = () => {
            const activeSection = document.querySelector("#print-sections-mode .segment-btn.active").dataset.value;
            formatGroup.classList.toggle("disabled", activeSection === "log");
        };

        sectionsEls.forEach(btn => {
            btn.addEventListener("click", (e) => {
                sectionsEls.forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                hideStatsControls();
            });
        });

        const formatEls = document.querySelectorAll("#print-stats-format .segment-btn");
        formatEls.forEach(btn => {
            btn.addEventListener("click", (e) => {
                formatEls.forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
            });
        });

        const rosterEls = document.querySelectorAll("#print-roster-mode .segment-btn");
        rosterEls.forEach(btn => {
            btn.addEventListener("click", (e) => {
                rosterEls.forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
            });
        });

        document.getElementById("print-confirm").addEventListener("click", () => {
            const activeSection = document.querySelector("#print-sections-mode .segment-btn.active").dataset.value;
            const activeFormat = document.querySelector("#print-stats-format .segment-btn.active").dataset.value;
            const activeRoster = document.querySelector("#print-roster-mode .segment-btn.active").dataset.value;

            Share.printOptions = {
                section: activeSection,
                format: activeFormat,
                roster: activeRoster
            };

            // Defer print briefly to allow DOM layout
            setTimeout(() => {
                window.print();
                this._closePrintDialog();
            }, 50);
        });

        initDialog("print-dialog", {
            dismissId: "print-cancel",
            onClose: () => this._closePrintDialog(),
        });
    },

    _showPrintDialog() {
        if (!this.game) return;
        
        // Sync print dialog toggle to match screen selection
        const formatEls = document.querySelectorAll("#print-stats-format .segment-btn");
        const currentFormat = Sheet.statsFormat || "cumulative";
        formatEls.forEach(b => {
            if (b.dataset.value === currentFormat) {
                b.classList.add("active");
            } else {
                b.classList.remove("active");
            }
        });

        // Smart roster default: Show when names exist, Hide otherwise
        const hasNames = this.game && this._hasRosterNames(this.game);
        const rosterEls = document.querySelectorAll("#print-roster-mode .segment-btn");
        rosterEls.forEach(b => {
            const isDefault = hasNames ? b.dataset.value === "show" : b.dataset.value === "hide";
            b.classList.toggle("active", isDefault);
        });

        document.getElementById("print-dialog").showModal();
    },

    _hasRosterNames(game) {
        for (const teamKey of ["white", "dark"]) {
            const roster = game[teamKey] && game[teamKey].roster;
            if (!roster) continue;
            for (const cap of Object.keys(roster)) {
                if (roster[cap].name) return true;
            }
        }
        return false;
    },

    _closePrintDialog() {
        document.getElementById("print-dialog").close();
    },



    // ── Download Dialog (shared by CSV and JSON) ────────────

    _showDownloadDialog(format) {
        if (!this.game) return;
        this._pendingFormat = format;
        const title = format === "json" ? "Download Game Data" : "Download CSV";
        const ext = format === "json" ? ".json" : ".csv";
        document.getElementById("download-title").textContent = title;
        const input = document.getElementById("download-filename");
        input.value = buildFilename(this.game, ext);
        document.getElementById("download-dialog").showModal();
        input.focus();
        input.select();
    },

    _closeDownloadDialog() {
        document.getElementById("download-dialog").close();
        this._pendingFormat = null;
    },

    _doDownload() {
        if (!this.game || !this._pendingFormat) return;
        if (this._pendingFormat === "json") {
            this._doDownloadJSON();
        } else {
            this._doDownloadCSV();
        }
    },

    // ── JSON Export ─────────────────────────────────────────

    _doDownloadJSON() {
        if (!this.game) return;
        const json = JSON.stringify(this.game);
        const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
        this._downloadBlob(blob, "download-filename");
    },

    // ── CSV Export ───────────────────────────────────────────

    _doDownloadCSV() {
        if (!this.game) return;
        const csv = buildCSV(this.game);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        this._downloadBlob(blob, "download-filename");
    },

    // ── Shared Download Helper ──────────────────────────────

    _downloadBlob(blob, filenameInputId) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = document.getElementById(filenameInputId).value || "wplog-export";
        a.click();
        URL.revokeObjectURL(url);
    },

    _downloadBlobDirect(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ── Roster Download Dialog ──────────────────────────────

    _setupRosterDownloadDialog() {
        const teamEls = document.querySelectorAll("#roster-team-select .segment-btn");
        teamEls.forEach(btn => {
            btn.addEventListener("click", (e) => {
                teamEls.forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                this._updateRosterFilename();
            });
        });

        document.getElementById("roster-download-confirm").addEventListener("click", () => {
            this._doRosterDownload();
            this._closeRosterDownloadDialog();
        });

        initDialog("roster-download-dialog", {
            dismissId: "roster-download-cancel",
            onClose: () => this._closeRosterDownloadDialog(),
        });
    },

    _showRosterDownloadDialog() {
        if (!this.game) return;

        // Reset to "Both" default
        const teamEls = document.querySelectorAll("#roster-team-select .segment-btn");
        teamEls.forEach(b => b.classList.toggle("active", b.dataset.value === "both"));

        this._updateRosterFilename();
        document.getElementById("roster-download-dialog").showModal();
    },

    _updateRosterFilename() {
        if (!this.game) return;
        const selected = document.querySelector("#roster-team-select .segment-btn.active").dataset.value;
        const input = document.getElementById("roster-download-filename");
        if (selected === "both") {
            const w = (this.game.white.name || "White").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
            const d = (this.game.dark.name || "Dark").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
            const date = this.game.date || new Date().toISOString().slice(0, 10);
            input.value = `roster-${w}-${d}-${date}.csv`;
        } else {
            input.value = buildRosterFilename(this.game, selected);
        }
    },

    _closeRosterDownloadDialog() {
        document.getElementById("roster-download-dialog").close();
    },

    _doRosterDownload() {
        if (!this.game) return;
        const selected = document.querySelector("#roster-team-select .segment-btn.active").dataset.value;

        if (selected === "both") {
            // Download two files — stagger to avoid browser blocking the second
            const teams = ["white", "dark"];
            const downloadTeam = (i) => {
                if (i >= teams.length) return;
                const csv = buildRosterCSV(this.game, teams[i]);
                if (csv) {
                    const filename = buildRosterFilename(this.game, teams[i]);
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    this._downloadBlobDirect(blob, filename);
                }
                if (i + 1 < teams.length) {
                    setTimeout(() => downloadTeam(i + 1), 500);
                }
            };
            downloadTeam(0);
        } else {
            const csv = buildRosterCSV(this.game, selected);
            if (csv) {
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                this._downloadBlob(blob, "roster-download-filename");
            }
        }
    },
};
