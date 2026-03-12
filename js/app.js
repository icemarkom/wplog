// wplog — App Initialization + Screen Navigation

const App = {
    currentScreen: "setup",
    game: null,

    init() {
        // Try to restore saved game
        const saved = Storage.load();
        if (saved && saved.log && saved.log.length > 0) {
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
            if (confirm("Return to setup? Current game will be preserved.")) {
                this.showScreen("setup");
                Setup.init((game) => {
                    this.game = game;
                    this.showScreen("live");
                    Events.init(this.game);
                });
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
            if (this.game) {
                this.showScreen("share");
                QR.init(this.game);
            }
        });

        // New game button
        document.getElementById("new-game-btn")?.addEventListener("click", () => {
            if (confirm("Start a new game? Current game data will be cleared.")) {
                Storage.clear();
                this.game = null;
                this.showScreen("setup");
                Setup.init((game) => {
                    this.game = game;
                    this.showScreen("live");
                    Events.init(this.game);
                });
            }
        });
    },

    showScreen(name) {
        this.currentScreen = name;
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
        document.getElementById("nav-share").disabled = !hasGame;
    },
};

// Boot
document.addEventListener("DOMContentLoaded", () => App.init());
