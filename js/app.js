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

import { APP_VERSION } from './config.js';
import { ConfirmDialog } from './confirm.js';
import { Storage } from './storage.js';
import { Setup } from './setup.js';
import { Events } from './events.js';
import { Sheet } from './sheet.js';
import { Share } from './share.js';
import { initDialog } from './dialog.js';
import { WakeLock } from './wakelock.js';
import { Game } from './game.js';


// wplog — App Initialization + Screen Navigation

export const App = {
    currentScreen: "setup",
    game: null,

    init() {
        // Initialize confirm dialog
        ConfirmDialog.init();

        // Load Theme
        const applyTheme = () => {
            const theme = localStorage.getItem("wplog_theme") || "dark";
            if (theme === "system") {
                const isLight = window.matchMedia("(prefers-color-scheme: light)").matches;
                document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");
            } else {
                document.documentElement.setAttribute("data-theme", theme);
            }
        };
        applyTheme();
        window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyTheme);

        // Display version
        this._initVersion();

        initDialog("about-dialog", { dismissId: "about-dismiss" });

        // Shared content dialog (privacy, license — stacks on top of About)
        const contentDialog = document.getElementById("content-dialog");
        const contentBody = document.getElementById("content-body");
        const _contentCache = {};

        const _openContentDialog = async (key, fetchFn) => {
            if (!_contentCache[key]) {
                try {
                    _contentCache[key] = await fetchFn();
                } catch {
                    _contentCache[key] = "<p>Could not load content.</p>";
                }
            }
            contentBody.innerHTML = _contentCache[key];
            contentDialog.showModal();
            contentDialog.scrollTop = 0;
        };

        document.getElementById("about-privacy-link").addEventListener("click", (e) => {
            e.preventDefault();
            _openContentDialog("privacy", async () => {
                const res = await fetch("privacy.html");
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, "text/html");
                const container = doc.querySelector(".container");
                const backLink = container.querySelector(".back-link");
                if (backLink) backLink.remove();
                const footer = container.querySelector(".footer");
                if (footer) footer.remove();
                return container.innerHTML;
            });
        });

        document.getElementById("about-license-link").addEventListener("click", (e) => {
            e.preventDefault();
            _openContentDialog("license", async () => {
                const res = await fetch("LICENSE");
                const raw = await res.text();
                const paragraphs = raw.trim().split(/\n\s*\n/).map(p =>
                    p.split("\n").map(l => l.trimStart()).join(" ")
                );
                return "<h1>License</h1>" +
                    paragraphs.map(p => "<p>" + p.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</p>").join("");
            });
        });

        initDialog("content-dialog", { dismissId: "content-dismiss" });

        // QR code full-screen dialog — click anywhere to dismiss
        const qrDialog = document.getElementById("qr-dialog");
        document.querySelector(".qr-code").addEventListener("click", () => {
            qrDialog.showModal();
        });
        initDialog("qr-dialog");
        qrDialog.addEventListener("click", () => qrDialog.close());

        // Try to restore saved game
        const saved = Storage.load();
        if (saved && saved.rules) {
            this.game = saved;
            Game._recalcScores(this.game);
            const restoredScreen = sessionStorage.getItem("wplog-screen") || "live";
            this._showScreenWithInit(restoredScreen);
        } else {
            this.showScreen("setup");
            Setup.init((game) => {
                this.game = game;
                this.showScreen("live");
                Events.init(this.game);
            });
        }

        // Nav buttons
        document.getElementById("nav-setup").addEventListener("click", () => {
            this.showScreen("setup");
            Setup.init((game) => {
                this.game = game;
                this.showScreen("live");
                Events.init(this.game);
            });
            if (this.game) {
                Setup.updateForActiveGame(this.game);
            }
        });
        // About Dialog (Setup Screen)
        const setupAbout = document.getElementById("setup-about-link");
        if (setupAbout) {
            setupAbout.addEventListener("click", (e) => {
                e.preventDefault();
                document.getElementById("about-dialog").showModal();
            });
        }

        // About Dialog (Help Screen)
        const helpAbout = document.getElementById("help-about-link");
        if (helpAbout) {
            helpAbout.addEventListener("click", (e) => {
                e.preventDefault();
                document.getElementById("about-dialog").showModal();
            });
        }


        // Hard Reset — uses native confirm() so it works even when custom code is broken
        document.getElementById("setup-hard-reset").addEventListener("click", async (e) => {
            e.preventDefault();
            // eslint-disable-next-line no-restricted-globals
            if (!confirm("Restart wplog?\n\nThis will erase all game data, clear the cache, and reload the app. This cannot be undone.")) return;
            localStorage.clear();
            if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
            }
            if ("caches" in window) {
                const names = await caches.keys();
                await Promise.all(names.map((name) => caches.delete(name)));
            }
            location.reload();
        });

        document.getElementById("nav-live").addEventListener("click", () => {
            if (this.game) {
                this.showScreen("live");
                Events.init(this.game);
            }
        });

        document.getElementById("nav-sheet").addEventListener("click", () => {
            if (this.game) {
                this.showScreen("sheet");
                Sheet.render(this.game);
            }
        });


        document.getElementById("nav-share").addEventListener("click", () => {
            this.showScreen("share");
            Share.init(this.game);
        });

        document.getElementById("nav-help").addEventListener("click", () => {
            this.showScreen("help");
        });

        // Intercept native print to adjust layout dynamically
        window.addEventListener("beforeprint", () => {
            if (this.game && document.getElementById("sheet-container")) {
                const po = Share.printOptions || { section: "all", format: Sheet.statsFormat || "cumulative" };

                if (po.section === "stats") document.body.classList.add("print-hide-log");
                else if (po.section === "log") document.body.classList.add("print-hide-stats");

                const origFormat = Sheet.statsFormat;
                Sheet.statsFormat = po.format;
                Sheet.render(this.game, true);
                Sheet.statsFormat = origFormat;
            }
        });
        window.addEventListener("afterprint", () => {
            document.body.classList.remove("print-hide-log", "print-hide-stats");
            if (this.game && document.getElementById("sheet-container")) {
                Sheet.render(this.game, false);
            }
        });

    },

    // ── Version Display ──────────────────────────────────────

    _initVersion() {
        if (APP_VERSION === "dev") {
            // Dev mode: detect latest source file modification time
            this._setVersionText("dev");
            this._detectDevTimestamp();
        } else {
            this._setVersionText("v" + APP_VERSION);
        }
    },

    _setVersionText(text) {
        document.getElementById("app-version").textContent = text;
        const aboutEl = document.getElementById("about-version");
        if (APP_VERSION !== "dev") {
            // Production: link to GitHub release
            const a = document.createElement("a");
            a.href = "https://github.com/icemarkom/wplog/releases/tag/v" + APP_VERSION;
            a.target = "_blank";
            a.rel = "noopener";
            a.textContent = text;
            aboutEl.textContent = "";
            aboutEl.appendChild(a);
        } else {
            aboutEl.textContent = text;
        }
    },

    async _detectDevTimestamp() {
        const files = [
            "index.html",
            "css/style.css",
            "js/config.js",
            "js/app.js",
            "js/events.js",
            "js/game.js",
            "js/setup.js",
            "js/sheet.js",
            "js/share.js",
            "js/confirm.js",
            "js/storage.js",
        ];

        try {
            const responses = await Promise.all(
                files.map((f) => fetch(f, { method: "HEAD" }).catch(() => null))
            );

            let latest = 0;
            for (const res of responses) {
                if (!res) continue;
                const lm = res.headers.get("Last-Modified");
                if (lm) {
                    const ts = new Date(lm).getTime();
                    if (ts > latest) latest = ts;
                }
            }

            if (latest > 0) {
                const d = new Date(latest);
                const pad = (n) => String(n).padStart(2, "0");
                const stamp = d.getFullYear()
                    + pad(d.getMonth() + 1)
                    + pad(d.getDate())
                    + "-"
                    + pad(d.getHours())
                    + pad(d.getMinutes());
                this._setVersionText("dev-" + stamp);
            }
        } catch (e) {
            // Silently keep "dev" if detection fails
        }
    },

    showScreen(name) {
        this.currentScreen = name;
        sessionStorage.setItem("wplog-screen", name);
        document.querySelectorAll(".screen").forEach((el) => {
            el.classList.toggle("active", el.id === "screen-" + name);
        });

        // Update nav active state
        document.querySelectorAll(".nav-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.id === "nav-" + name);
        });

        // Disable nav buttons that require a game
        const hasGame = !!this.game;
        document.getElementById("nav-live").disabled = !hasGame;
        document.getElementById("nav-sheet").disabled = !hasGame;

        // Manage Wake Lock precisely for active games on Live screen
        if (name === "live" && hasGame) {
            WakeLock.acquire();
        } else {
            WakeLock.release();
        }
    },


    // Show a screen and initialize its module (used for restore on reload)
    _showScreenWithInit(name) {
        switch (name) {
            case "setup":
                this.showScreen("setup");
                Setup.init((game) => {
                    this.game = game;
                    this.showScreen("live");
                    Events.init(this.game);
                });
                if (this.game) Setup.updateForActiveGame(this.game);
                break;
            case "sheet":
                if (this.game) {
                    this.showScreen("sheet");
                    Sheet.render(this.game);
                } else {
                    this.showScreen("setup");
                }
                break;
            case "share":
                this.showScreen("share");
                Share.init(this.game);
                break;
            case "help":
                this.showScreen("help");
                break;
            case "live":
            default:
                if (this.game) {
                    this.showScreen("live");
                    Events.init(this.game);
                } else {
                    this.showScreen("setup");
                }
                break;
        }
    },
};

// Boot (modules are deferred by default, so DOMContentLoaded may have already fired)
// The loader calls App.init() after screen HTML is loaded, so this listener
// is kept as a safety net but is no longer the primary init path.
