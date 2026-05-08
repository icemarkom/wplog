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

// wplog — Dialog Utilities

/**
 * Initialize a native <dialog> with standard close behaviors:
 *   - Clicking the ::backdrop area closes the dialog
 *   - An optional dismiss button closes the dialog
 *   - An optional onClose callback replaces the default dialog.close()
 *
 * Returns the dialog element for further use.
 */
export function initDialog(id, { dismissId, onClose } = {}) {
    const dialog = document.getElementById(id);

    // Backdrop click = close
    dialog.addEventListener("click", (e) => {
        const rect = dialog.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) {
            onClose ? onClose() : dialog.close();
        }
    });

    // Dismiss button
    if (dismissId) {
        document.getElementById(dismissId).addEventListener("click", () => {
            onClose ? onClose() : dialog.close();
        });
    }

    return dialog;
}
