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
            if (activeSection === "log") {
                formatGroup.style.opacity = "0.3";
                formatGroup.style.pointerEvents = "none";
            } else {
                formatGroup.style.opacity = "1";
                formatGroup.style.pointerEvents = "auto";
            }
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

        document.getElementById("print-confirm").addEventListener("click", () => {
            const activeSection = document.querySelector("#print-sections-mode .segment-btn.active").dataset.value;
            const activeFormat = document.querySelector("#print-stats-format .segment-btn.active").dataset.value;

            if (activeSection === "stats") {
                document.body.classList.add("print-hide-log");
            } else if (activeSection === "log") {
                document.body.classList.add("print-hide-stats");
            }

            const origFormat = Sheet.statsFormat;
            Sheet.statsFormat = activeFormat;
            Sheet.render(this.game, true); 

            // Defer print briefly to allow DOM layout
            setTimeout(() => {
                // Wait for the OS print dialog to close before stripping the hiding classes,
                // otherwise non-blocking browsers (Safari iOS) will print the hidden sections.
                const onAfterPrint = () => {
                    document.body.classList.remove("print-hide-log", "print-hide-stats");
                    Sheet.statsFormat = origFormat;
                    window.removeEventListener("afterprint", onAfterPrint);
                };
                window.addEventListener("afterprint", onAfterPrint);

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

        document.getElementById("print-dialog").showModal();
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
};
