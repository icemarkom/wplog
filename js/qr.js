// wplog — QR Code Sharing + Compression

const QR = {
    game: null,

    init(game) {
        this.game = game;
        this._bindEvents();
    },

    _bindEvents() {
        document.getElementById("qr-generate-btn").addEventListener("click", () => {
            this.generate();
        });

        document.getElementById("qr-copy-btn").addEventListener("click", () => {
            this.copyToClipboard();
        });

        document.getElementById("qr-download-btn").addEventListener("click", () => {
            this.downloadHTML();
        });
    },

    generate() {
        const container = document.getElementById("qr-code");
        container.innerHTML = "";

        try {
            const data = this._compress(this.game);
            const payload = "WPLOG:" + data;

            // Check QR data size limit (~2953 bytes for alphanumeric)
            if (payload.length > 2900) {
                container.innerHTML = '<p class="qr-error">Game data too large for QR code. Use copy or download instead.</p>';
                return;
            }

            if (typeof QRCode !== "undefined") {
                new QRCode(container, {
                    text: payload,
                    width: 256,
                    height: 256,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M,
                });
            } else {
                container.innerHTML = '<p class="qr-error">QR library not loaded. Use copy or download instead.</p>';
            }
        } catch (e) {
            console.error("QR generation failed:", e);
            container.innerHTML = '<p class="qr-error">Failed to generate QR code.</p>';
        }
    },

    _compress(game) {
        // Create compact representation
        const compact = {
            r: game.rules,
            d: game.date,
            st: game.startTime,
            loc: game.location,
            ot: game.overtime,
            so: game.shootout,
            w: game.white.name,
            dk: game.dark.name,
            p: game.currentPeriod,
            l: game.log.map((e) => [
                e.period,
                e.time,
                e.team,
                e.cap,
                e.event,
                e.scoreW,
                e.scoreD,
                e.note,
            ]),
        };

        const json = JSON.stringify(compact);

        if (typeof pako !== "undefined") {
            const compressed = pako.deflate(json);
            return btoa(String.fromCharCode.apply(null, compressed));
        } else {
            // Fallback: just base64 encode
            return btoa(unescape(encodeURIComponent(json)));
        }
    },

    _decompress(data) {
        try {
            if (typeof pako !== "undefined") {
                const binary = atob(data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const json = pako.inflate(bytes, { to: "string" });
                return JSON.parse(json);
            } else {
                return JSON.parse(decodeURIComponent(escape(atob(data))));
            }
        } catch (e) {
            console.error("Decompression failed:", e);
            return null;
        }
    },

    async copyToClipboard() {
        try {
            const data = this._compress(this.game);
            await navigator.clipboard.writeText("WPLOG:" + data);
            Events._showToast("Copied to clipboard", "info");
        } catch (e) {
            console.error("Copy failed:", e);
            Events._showToast("Failed to copy", "warning");
        }
    },

    downloadHTML() {
        // Render game sheet as standalone HTML
        const sheetEl = document.getElementById("sheet-content");
        const printCSS = document.querySelector('link[href*="print.css"]');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Game Sheet — ${this.game.white.name} vs ${this.game.dark.name} — ${this.game.date}</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; padding: 20px; color: #111; }
    .sheet-header { margin-bottom: 24px; }
    .sheet-title { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 16px; }
    .sheet-meta { margin-bottom: 16px; }
    .sheet-meta-row { margin-bottom: 4px; }
    .sheet-label { font-weight: 600; margin-right: 4px; }
    .sheet-value { margin-right: 16px; }
    .sheet-teams { display: flex; justify-content: center; align-items: center; gap: 24px; font-size: 20px; font-weight: 600; margin: 16px 0; }
    .sheet-final-score { font-size: 28px; }
    .sheet-section { margin-bottom: 24px; }
    .sheet-section-title { font-size: 16px; font-weight: 700; border-bottom: 2px solid #333; padding-bottom: 4px; margin-bottom: 8px; }
    .sheet-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .sheet-table th, .sheet-table td { border: 1px solid #333; padding: 4px 8px; text-align: left; }
    .sheet-table th { background: #eee; font-weight: 600; }
    .sheet-period-end td { text-align: center; font-style: italic; background: #f5f5f5; }
    .sheet-fouled-out { background: #ffe0e0; }
    .sheet-empty { font-style: italic; color: #666; }
  </style>
</head>
<body>
  ${sheetEl.innerHTML}
</body>
</html>`;

        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gamesheet_${this.game.date}_${this.game.white.name}_vs_${this.game.dark.name}.html`;
        a.click();
        URL.revokeObjectURL(url);
    },
};
