// wplog — Setup Screen Logic

const Setup = {
    init(onStart) {
        this.onStart = onStart;
        this._bindEvents();
        this._populateRules();
        this._setDefaultDate();
    },

    _populateRules() {
        const select = document.getElementById("setup-rules");
        select.innerHTML = "";
        for (const [key, rules] of Object.entries(RULES)) {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = rules.name;
            select.appendChild(opt);
        }
        this._updateToggles();
    },

    _setDefaultDate() {
        const dateInput = document.getElementById("setup-date");
        dateInput.value = new Date().toISOString().slice(0, 10);
    },

    _updateToggles() {
        const rulesKey = document.getElementById("setup-rules").value;
        const rules = RULES[rulesKey];
        document.getElementById("setup-overtime").checked = rules.overtime;
        document.getElementById("setup-shootout").checked = rules.shootout;
    },

    _bindEvents() {
        document.getElementById("setup-rules").addEventListener("change", () => {
            this._updateToggles();
        });

        document.getElementById("setup-start-btn").addEventListener("click", () => {
            this._startGame();
        });
    },

    _startGame() {
        const rulesKey = document.getElementById("setup-rules").value;
        const game = Game.create(rulesKey);

        game.date = document.getElementById("setup-date").value;
        game.startTime = document.getElementById("setup-time").value;
        game.location = document.getElementById("setup-location").value;
        game.overtime = document.getElementById("setup-overtime").checked;
        game.shootout = document.getElementById("setup-shootout").checked;

        const whiteName = document.getElementById("setup-white-name").value.trim();
        const darkName = document.getElementById("setup-dark-name").value.trim();
        if (whiteName) game.white.name = whiteName;
        if (darkName) game.dark.name = darkName;

        Storage.save(game);
        this.onStart(game);
    },
};
