// wplog — Share / Print

const Share = {
    game: null,
    _bound: false,

    init(game) {
        this.game = game || null;
        const btn = document.getElementById("print-sheet-btn");
        btn.disabled = !this.game;
        if (!this._bound) {
            btn.addEventListener("click", () => {
                this.printSheet();
            });
            this._bound = true;
        }
    },

    printSheet() {
        if (!this.game) return;
        // Navigate to sheet view and print
        App.showScreen("sheet");
        Sheet.init(this.game);
        setTimeout(() => window.print(), 300);
    },
};
