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

// wplog — Share / Print

const Share = {
    game: null,
    _bound: false,
    _pageStyleEl: null,
    _paperSize: "letter",

    init(game) {
        this.game = game || null;
        const btn = document.getElementById("print-sheet-btn");
        btn.disabled = !this.game;
        if (!this._bound) {
            btn.addEventListener("click", () => {
                this._showPrintDialog();
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

            // Cancel
            document.getElementById("print-cancel").addEventListener("click", () => {
                this._closePrintDialog();
            });

            // Backdrop click = cancel
            document.getElementById("print-overlay").addEventListener("click", (e) => {
                if (e.target === e.currentTarget) this._closePrintDialog();
            });

            this._bound = true;
        }
    },

    _showPrintDialog() {
        if (!this.game) return;
        // Sync segmented control to current selection
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
};
