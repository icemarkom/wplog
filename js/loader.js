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
// Loads screen fragments and JS dependencies, then initializes the app.

(async function () {
    const screens = [
        { url: "screens/setup.html", target: "setup-content" },
        { url: "screens/live.html", target: "live-content" },
        { url: "screens/modal.html", target: "modal-content" },
        { url: "screens/sheet.html", target: "sheet-container" },
        { url: "screens/share.html", target: "share-content" },
    ];
    await Promise.all(screens.map(async ({ url, target }) => {
        const res = await fetch(url);
        document.getElementById(target).innerHTML = await res.text();
    }));

    // Load JS files in order (dependencies first)
    const scripts = [
        "js/sanitize.js", "js/config.js", "js/confirm.js", "js/storage.js", "js/game.js",
        "js/setup.js", "js/events.js", "js/sheet.js", "js/share.js", "js/app.js",
    ];
    for (const src of scripts) {
        await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.body.appendChild(s);
        });
    }

    // DOMContentLoaded already fired, so manually init the app
    App.init();
})();
