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

// wplog — Theme Bootstrap (synchronous, no imports)
//
// Loaded as a plain <script> in <head> (no defer, no type="module") so it
// runs before the first CSS paint, preventing a flash of the wrong theme.
//
// Seeds localStorage with "system" on first visit so all later reads
// (app.js, setup.js) always find a stored value and need no fallback.
//
// Fallback chain when theme is "system":
//   OS prefers light  → "light"
//   OS prefers dark   → "dark"
//   No preference     → "dark"  (wplog design default)
//   matchMedia absent → "dark"  (very old browsers)

(function () {
    if (!localStorage.getItem("wplog_theme")) {
        localStorage.setItem("wplog_theme", "system");
    }

    var theme = localStorage.getItem("wplog_theme");
    var resolved;

    if (theme === "system") {
        var isLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
        resolved = isLight ? "light" : "dark";
    } else {
        resolved = theme;
    }

    document.documentElement.setAttribute("data-theme", resolved);
}());
