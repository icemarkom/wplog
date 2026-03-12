// wplog — localStorage Persistence

const Storage = {
    KEY: "wplog_game",

    save(game) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(game));
        } catch (e) {
            console.error("Failed to save game:", e);
        }
    },

    load() {
        try {
            const data = localStorage.getItem(this.KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error("Failed to load game:", e);
            return null;
        }
    },

    clear() {
        localStorage.removeItem(this.KEY);
    },
};
