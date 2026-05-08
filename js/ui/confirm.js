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

import { initDialog } from './dialog.js';

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

export const ConfirmDialog = {
    _resolve: null,

    init() {
        const dialog = initDialog("confirm-dialog", {
            dismissId: "confirm-cancel",
            onClose: () => this._close(false),
        });
        document.getElementById("confirm-ok").addEventListener("click", () => this._close(true));

        // Native Escape = cancel
        dialog.addEventListener("cancel", (e) => {
            e.preventDefault();
            this._close(false);
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

        document.getElementById("confirm-dialog").showModal();

        return new Promise((resolve) => {
            this._resolve = resolve;
        });
    },

    _close(result) {
        const dialog = document.getElementById("confirm-dialog");
        if (dialog.open) dialog.close();
        if (this._resolve) {
            this._resolve(result);
            this._resolve = null;
        }
    },
};
