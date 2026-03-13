// wplog — Custom Confirmation Dialog
// Replaces system confirm() which can be suppressed on mobile browsers.
//
// Usage:
//   const ok = await ConfirmDialog.show({
//       title: "Delete Event",
//       message: "Delete this event?",
//       confirmLabel: "Delete",
//       type: "danger",
//   });
//   if (ok) { ... }

const ConfirmDialog = {
    _resolve: null,

    init() {
        document.getElementById("confirm-cancel").addEventListener("click", () => this._close(false));
        document.getElementById("confirm-ok").addEventListener("click", () => this._close(true));

        // Backdrop click = cancel
        document.getElementById("confirm-overlay").addEventListener("click", (e) => {
            if (e.target === e.currentTarget) this._close(false);
        });
    },

    show({ title, message, confirmLabel = "OK", cancelLabel = "Cancel", type = "danger" }) {
        document.getElementById("confirm-title").textContent = title;
        document.getElementById("confirm-message").textContent = message;

        const okBtn = document.getElementById("confirm-ok");
        okBtn.textContent = confirmLabel;
        okBtn.className = "btn confirm-action-btn confirm-btn-" + type;

        const cancelBtn = document.getElementById("confirm-cancel");
        cancelBtn.textContent = cancelLabel;

        document.getElementById("confirm-overlay").classList.add("visible");

        return new Promise((resolve) => {
            this._resolve = resolve;
        });
    },

    _close(result) {
        document.getElementById("confirm-overlay").classList.remove("visible");
        if (this._resolve) {
            this._resolve(result);
            this._resolve = null;
        }
    },
};
