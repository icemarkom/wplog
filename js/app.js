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

// wplog — App Initialization + Screen Navigation

const App = {
    currentScreen: "setup",
    game: null,

    init() {
        // Initialize confirm dialog
        ConfirmDialog.init();

        // Display version
        this._initVersion();

        // Footer "About" link
        document.getElementById("footer-about-link").addEventListener("click", (e) => {
            e.preventDefault();
            document.getElementById("about-overlay").classList.add("visible");
        });

        // About dismiss
        document.getElementById("about-dismiss").addEventListener("click", () => {
            document.getElementById("about-overlay").classList.remove("visible");
        });
        document.getElementById("about-overlay").addEventListener("click", (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById("about-overlay").classList.remove("visible");
            }
        });

        // Privacy Policy overlay (opened from About dialog)
        document.getElementById("about-privacy-link").addEventListener("click", async (e) => {
            e.preventDefault();
            document.getElementById("about-overlay").classList.remove("visible");

            // Load content from privacy.html (single source of truth)
            const body = document.getElementById("privacy-body");
            if (!body.innerHTML) {
                try {
                    const res = await fetch("privacy.html");
                    const html = await res.text();
                    const doc = new DOMParser().parseFromString(html, "text/html");
                    body.innerHTML = doc.querySelector(".container").innerHTML;
                    // Remove the back link — not needed in overlay
                    const backLink = body.querySelector(".back-link");
                    if (backLink) backLink.remove();
                    // Remove the footer — not needed in overlay
                    const footer = body.querySelector(".footer");
                    if (footer) footer.remove();
                } catch {
                    body.innerHTML = "<p>Could not load privacy policy.</p>";
                }
            }

            document.getElementById("privacy-overlay").classList.add("visible");
        });

        document.getElementById("privacy-dismiss").addEventListener("click", () => {
            document.getElementById("privacy-overlay").classList.remove("visible");
            document.getElementById("about-overlay").classList.add("visible");
        });
        document.getElementById("privacy-overlay").addEventListener("click", (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById("privacy-overlay").classList.remove("visible");
                document.getElementById("about-overlay").classList.add("visible");
            }
        });

        // License overlay (opened from About dialog)
        document.getElementById("about-license-link").addEventListener("click", async (e) => {
            e.preventDefault();
            document.getElementById("about-overlay").classList.remove("visible");

            // Load content from LICENSE (plain text)
            const body = document.getElementById("license-body");
            if (!body.innerHTML) {
                try {
                    const res = await fetch("LICENSE");
                    const raw = await res.text();
                    // Split into paragraphs (blank-line separated), join hard-wrapped lines
                    const paragraphs = raw.trim().split(/\n\s*\n/).map(p =>
                        p.split("\n").map(l => l.trimStart()).join(" ")
                    );
                    body.innerHTML = "<h1>License</h1>" +
                        paragraphs.map(p => "<p>" + p.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</p>").join("");
                } catch {
                    body.innerHTML = "<p>Could not load license.</p>";
                }
            }

            document.getElementById("license-overlay").classList.add("visible");
        });

        document.getElementById("license-dismiss").addEventListener("click", () => {
            document.getElementById("license-overlay").classList.remove("visible");
            document.getElementById("about-overlay").classList.add("visible");
        });
        document.getElementById("license-overlay").addEventListener("click", (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById("license-overlay").classList.remove("visible");
                document.getElementById("about-overlay").classList.add("visible");
            }
        });

        // QR code full-screen overlay
        document.querySelector(".qr-code").addEventListener("click", () => {
            document.getElementById("qr-overlay").classList.add("visible");
        });
        document.getElementById("qr-overlay").addEventListener("click", () => {
            document.getElementById("qr-overlay").classList.remove("visible");
        });

        // Try to restore saved game
        const saved = Storage.load();
        if (saved && saved.rules) {
            this.game = saved;
            this.showScreen("live");
            Events.init(this.game);
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

        document.getElementById("nav-live").addEventListener("click", () => {
            if (this.game) {
                this.showScreen("live");
                Events.init(this.game);
            }
        });

        document.getElementById("nav-sheet").addEventListener("click", () => {
            if (this.game) {
                this.showScreen("sheet");
                Sheet.init(this.game);
            }
        });

        document.getElementById("nav-share").addEventListener("click", () => {
            this.showScreen("share");
            Share.init(this.game);
        });

        document.getElementById("nav-help").addEventListener("click", async () => {
            this.showScreen("help");

            // Load content from help.html (single source of truth)
            const el = document.getElementById("help-content");
            if (!el.innerHTML) {
                try {
                    const res = await fetch("help.html");
                    const html = await res.text();
                    const doc = new DOMParser().parseFromString(html, "text/html");
                    el.innerHTML = doc.querySelector(".container").innerHTML;
                    // Remove the footer — not needed in-app
                    const footer = el.querySelector(".footer");
                    if (footer) footer.remove();
                } catch {
                    el.innerHTML = "<p>Could not load help content.</p>";
                }
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
        document.querySelectorAll(".screen").forEach((el) => {
            el.classList.toggle("active", el.id === "screen-" + name);
        });

        // Update nav active state
        document.querySelectorAll(".nav-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.id === "nav-" + name);
            // Deactivate all nav buttons when showing About (no nav button for it)
        });

        // Disable nav buttons that require a game
        const hasGame = !!this.game;
        document.getElementById("nav-live").disabled = !hasGame;
        document.getElementById("nav-sheet").disabled = !hasGame;
    },
};

// Boot
document.addEventListener("DOMContentLoaded", () => App.init());
