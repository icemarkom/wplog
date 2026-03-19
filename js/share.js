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

    init(game) {
        this.game = game || null;
        const btn = document.getElementById("print-sheet-btn");
        btn.disabled = !this.game;
        if (!this._bound) {
            btn.addEventListener("click", () => {
                this.printSheet();
            });
            this._bound = true;
        }
    },

    printSheet() {
        if (!this.game) return;
        const paperSize = document.getElementById("print-paper-size").value;

        // Inject dynamic @page size
        this._setPageSize(paperSize);

        // Render sheet content (works on hidden elements) and print.
        // print.css forces #screen-sheet visible and hides everything else,
        // so no screen switch is needed.
        Sheet.init(this.game, paperSize);
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
