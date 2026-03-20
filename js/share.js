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

// wplog — Share / Print / Export

export const Share = {
    game: null,
    _bound: false,
    _pageStyleEl: null,
    _paperSize: "letter",

    init(game) {
        this.game = game || null;
        const printBtn = document.getElementById("print-sheet-btn");
        const csvBtn = document.getElementById("export-csv-btn");
        printBtn.disabled = !this.game;
        csvBtn.disabled = !this.game;
        if (!this._bound) {
            printBtn.addEventListener("click", () => {
                this._showPrintDialog();
            });

            csvBtn.addEventListener("click", () => {
                this._showCSVDialog();
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

            // CSV confirm
            document.getElementById("csv-confirm").addEventListener("click", () => {
                this._closeCSVDialog();
                this._doExport();
            });

            // CSV cancel
            document.getElementById("csv-cancel").addEventListener("click", () => {
                this._closeCSVDialog();
            });

            // CSV backdrop click = cancel
            document.getElementById("csv-overlay").addEventListener("click", (e) => {
                if (e.target === e.currentTarget) this._closeCSVDialog();
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
        Sheet.init(this.game, this._paperSize);
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

    // ── CSV Export Dialog ────────────────────────────────────

    _showCSVDialog() {
        if (!this.game) return;
        const input = document.getElementById("csv-filename");
        input.value = this._buildFilename();
        document.getElementById("csv-overlay").classList.add("visible");
        input.focus();
        input.select();
    },

    _closeCSVDialog() {
        document.getElementById("csv-overlay").classList.remove("visible");
    },

    _buildFilename() {
        const parts = ["wplog"];

        // Date
        const date = this.game.date || new Date().toISOString().slice(0, 10);
        parts.push(date);

        // Teams (only if custom)
        const w = this.game.white.name;
        const d = this.game.dark.name;
        if (w !== "White" || d !== "Dark") {
            parts.push(this._sanitizeName(w !== "White" ? w : "White"));
            parts.push(this._sanitizeName(d !== "Dark" ? d : "Dark"));
        }

        // Time: startTime if set, else current time
        const time = this.game.startTime
            ? this.game.startTime.replace(":", "")
            : new Date().toTimeString().slice(0, 5).replace(":", "");
        parts.push(time);

        return parts.join("-") + ".csv";
    },

    _sanitizeName(name) {
        return name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    },

    _doExport() {
        if (!this.game) return;
        const header = "deviceTime,seq,period,time,team,cap,event";
        const rows = this.game.log.map((e) => {
            return [
                e.deviceTime || "",
                e.seq || "",
                e.period || "",
                e.time || "",
                e.team || "",
                this._csvEscape(e.cap || ""),
                this._csvEscape(e.event || ""),
            ].join(",");
        });
        const csv = header + "\n" + rows.join("\n") + "\n";
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = document.getElementById("csv-filename").value || this._buildFilename();
        a.click();
        URL.revokeObjectURL(url);
    },

    _csvEscape(val) {
        const str = String(val);
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
            return "\"" + str.replace(/"/g, "\"\"") + "\"";
        }
        return str;
    },
};
