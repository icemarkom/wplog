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

// wplog — Custom Confirmation Dialog
// Replaces system confirm() which can be suppressed on mobile browsers.
//
// Usage:
//   const ok = await ConfirmDialog.show({
//       title: "Delete Event",
//       message: "Delete this event?",
//       confirmLabel: "Delete",
//       type: "danger",
//   });
//   if (ok) { ... }

const ConfirmDialog = {
    _resolve: null,

    init() {
        document.getElementById("confirm-cancel").addEventListener("click", () => this._close(false));
        document.getElementById("confirm-ok").addEventListener("click", () => this._close(true));

        // Backdrop click = cancel
        document.getElementById("confirm-overlay").addEventListener("click", (e) => {
            if (e.target === e.currentTarget) this._close(false);
        });

        // Keyboard: Escape = cancel, Enter = confirm
        document.addEventListener("keydown", (e) => {
            if (!document.getElementById("confirm-overlay").classList.contains("visible")) return;
            if (e.key === "Escape") {
                e.preventDefault();
                this._close(false);
            } else if (e.key === "Enter") {
                e.preventDefault();
                this._close(true);
            }
        });
    },

    show({ title, message, confirmLabel = "OK", cancelLabel = "Cancel", type = "danger" }) {
        document.getElementById("confirm-title").textContent = title;
        document.getElementById("confirm-message").textContent = message;

        const okBtn = document.getElementById("confirm-ok");
        okBtn.textContent = confirmLabel;
        okBtn.className = "btn confirm-action-btn confirm-btn-" + type;

        const cancelBtn = document.getElementById("confirm-cancel");
        cancelBtn.textContent = cancelLabel;

        document.getElementById("confirm-overlay").classList.add("visible");

        return new Promise((resolve) => {
            this._resolve = resolve;
        });
    },

    _close(result) {
        document.getElementById("confirm-overlay").classList.remove("visible");
        if (this._resolve) {
            this._resolve(result);
            this._resolve = null;
        }
    },
};
