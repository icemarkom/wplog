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

import { Sheet } from './sheet.js';
import { buildFilename, buildCSV } from './export.js';

// wplog — Share / Print / Export

export const Share = {
    game: null,
    _bound: false,
    _pageStyleEl: null,
    _paperSize: "letter",
    _pendingFormat: null, // "csv" or "json"

    init(game) {
        this.game = game || null;
        const printBtn = document.getElementById("print-sheet-btn");
        const csvBtn = document.getElementById("export-csv-btn");
        const jsonBtn = document.getElementById("export-json-btn");
        printBtn.disabled = !this.game;
        csvBtn.disabled = !this.game;
        jsonBtn.disabled = !this.game;
        if (!this._bound) {
            printBtn.addEventListener("click", () => {
                this._showPrintDialog();
            });

            csvBtn.addEventListener("click", () => {
                this._showDownloadDialog("csv");
            });

            jsonBtn.addEventListener("click", () => {
                this._showDownloadDialog("json");
            });

            // Paper size segmented control
            const control = document.getElementById("print-paper-size");
            control.addEventListener("click", (e) => {
                const btn = e.target.closest(".segment-btn");
                if (!btn) return;
                control.querySelectorAll(".segment-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                this._paperSize = btn.dataset.value;
            });

            // Print confirm
            document.getElementById("print-confirm").addEventListener("click", () => {
                this._closePrintDialog();
                this._doPrint();
            });

            // Print cancel
            document.getElementById("print-cancel").addEventListener("click", () => {
                this._closePrintDialog();
            });

            // Print backdrop click = cancel
            document.getElementById("print-overlay").addEventListener("click", (e) => {
                if (e.target === e.currentTarget) this._closePrintDialog();
            });

            // Download confirm
            document.getElementById("download-confirm").addEventListener("click", () => {
                this._doDownload();
                this._closeDownloadDialog();
            });

            // Download cancel
            document.getElementById("download-cancel").addEventListener("click", () => {
                this._closeDownloadDialog();
            });

            // Download backdrop click = cancel
            document.getElementById("download-overlay").addEventListener("click", (e) => {
                if (e.target === e.currentTarget) this._closeDownloadDialog();
            });

            this._bound = true;
        }
    },

    // ── Print Dialog ─────────────────────────────────────────

    _showPrintDialog() {
        if (!this.game) return;
        const control = document.getElementById("print-paper-size");
        control.querySelectorAll(".segment-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.value === this._paperSize);
        });
        document.getElementById("print-overlay").classList.add("visible");
    },

    _closePrintDialog() {
        document.getElementById("print-overlay").classList.remove("visible");
    },

    _doPrint() {
        if (!this.game) return;
        this._setPageSize(this._paperSize);
        Sheet.render(this.game, this._paperSize);
        window.print();
    },

    _setPageSize(size) {
        if (!this._pageStyleEl) {
            this._pageStyleEl = document.createElement("style");
            document.head.appendChild(this._pageStyleEl);
        }
        const cssSize = size === "a4" ? "A4 portrait" : "letter portrait";
        this._pageStyleEl.textContent = `@page { size: ${cssSize}; margin: 0.5in; }`;
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
        document.getElementById("download-overlay").classList.add("visible");
        input.focus();
        input.select();
    },

    _closeDownloadDialog() {
        document.getElementById("download-overlay").classList.remove("visible");
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
