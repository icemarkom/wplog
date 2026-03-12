// wplog — Share / Print

const Share = {
    game: null,

    init(game) {
        this.game = game;
        this._bindEvents();
    },

    _bindEvents() {
        document.getElementById("print-sheet-btn").addEventListener("click", () => {
            this.printSheet();
        });
    },

    printSheet() {
        // Navigate to sheet view and print
        App.showScreen("sheet");
        Sheet.init(this.game);
        setTimeout(() => window.print(), 300);
    },
};
