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

(async function () {
    const _cb = "?v=" + Date.now();
    const screens = [
        { url: "screens/setup.html" + _cb, target: "setup-content" },
        { url: "screens/live.html" + _cb, target: "live-content" },
        { url: "screens/modal.html" + _cb, target: "modal-content" },
        { url: "screens/sheet.html" + _cb, target: "sheet-container" },
        { url: "screens/share.html" + _cb, target: "share-content" },
    ];
    await Promise.all(screens.map(async ({ url, target }) => {
        const res = await fetch(url);
        document.getElementById(target).innerHTML = await res.text();
    }));

    // DOMContentLoaded already fired, so manually init the app
    App.init();
})();
