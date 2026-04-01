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

// wplog — App Shell Loader
// Loads screen HTML fragments, then initializes the app.
// JS dependencies are resolved automatically via ES module imports.

import { App } from './app.js';
import { loadConfig } from './config.js';

(async function () {
    const _cb = "?v=" + Date.now();
    const screens = [
        { url: "screens/setup.html" + _cb, target: "setup-content" },
        { url: "screens/live.html" + _cb, target: "live-content" },
        { url: "screens/modal.html" + _cb, target: "modal-content" },
        { url: "screens/sheet.html" + _cb, target: "sheet-container" },
        { url: "screens/share.html" + _cb, target: "share-content" },
        { url: "screens/help.html" + _cb, target: "help-content" },
    ];
    await Promise.all(screens.map(async ({ url, target }) => {
        const res = await fetch(url);
        document.getElementById(target).innerHTML = await res.text();
    }));

    // Inject QR code inline so it can be colored via native CSS variables
    try {
        const qrRes = await fetch("img/qr-wplog.svg" + _cb);
        const qrSvgString = await qrRes.text();
        const doc = new DOMParser().parseFromString(qrSvgString, "image/svg+xml");
        const svgNode = doc.documentElement;
        document.getElementById("qr-svg-fullscreen").appendChild(svgNode.cloneNode(true));
        document.getElementById("qr-svg-share").appendChild(svgNode.cloneNode(true));
    } catch (e) {
        console.warn("Failed to load QR code SVG", e);
    }

    // Load external configuration before binding UI logic
    await loadConfig();

    // DOMContentLoaded already fired, so manually init the app
    App.init();

    // Register service worker for offline caching.
    // type: 'module' is required because sw.js uses ES module imports.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js', { type: 'module' }).then((reg) => {
            if (reg.waiting) {
                showUpdateToast(reg.waiting);
            }

            reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                newWorker.addEventListener("statechange", () => {
                    // When the new worker is installed and a controller exists
                    // (meaning it's an update, not the initial install)
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        showUpdateToast(newWorker);
                    }
                });
            });
        });

        // Trigger reload exactly when the new worker takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });

        function showUpdateToast(worker) {
            const container = document.getElementById("toast-container");
            if (container.showPopover && !container.matches(':popover-open')) {
                container.showPopover();
            }

            const toast = document.createElement("button");
            toast.className = "toast toast-info";
            toast.textContent = "Update Available. Tap to Reload.";
            
            toast.addEventListener("click", () => {
                toast.textContent = "Loading...";
                toast.disabled = true;
                worker.postMessage({ type: 'SKIP_WAITING' });
            });

            container.appendChild(toast);
        }
    }
})();
