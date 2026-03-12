// wplog — Game Sheet Rendering

const Sheet = {
    game: null,

    init(game) {
        this.game = game;
        this.render();
    },

    render() {
        const container = document.getElementById("sheet-content");
        container.innerHTML = "";

        container.appendChild(this._renderHeader());
        container.appendChild(this._renderProgressOfGame());
        container.appendChild(this._renderPeriodScores());
        container.appendChild(this._renderFoulSummary());
        container.appendChild(this._renderTimeoutSummary());
    },

    _renderHeader() {
        const game = this.game;
        const rules = RULES[game.rules];
        const header = document.createElement("div");
        header.className = "sheet-header";

        const whiteName = game.white.name === "White" ? "White" : `White (${game.white.name})`;
        const darkName = game.dark.name === "Dark" ? "Dark" : `Dark (${game.dark.name})`;
        const score = Game.getScore(game);

        header.innerHTML = `
      <div class="sheet-title">Game Sheet</div>
      <div class="sheet-meta">
        <div class="sheet-meta-row">
          <span class="sheet-label">Rules:</span>
          <span class="sheet-value">${rules.name}</span>
          <span class="sheet-label">Date:</span>
          <span class="sheet-value">${game.date}</span>
          <span class="sheet-label">Time:</span>
          <span class="sheet-value">${game.startTime || "—"}</span>
        </div>
        <div class="sheet-meta-row">
          <span class="sheet-label">Location:</span>
          <span class="sheet-value">${game.location || "—"}</span>
        </div>
      </div>
      <div class="sheet-teams">
        <div class="sheet-team sheet-team-white">
          <span class="sheet-team-label">White</span>
          <span class="sheet-team-name">${whiteName}</span>
        </div>
        <div class="sheet-final-score">${score.white} — ${score.dark}</div>
        <div class="sheet-team sheet-team-dark">
          <span class="sheet-team-label">Dark</span>
          <span class="sheet-team-name">${darkName}</span>
        </div>
      </div>
    `;
        return header;
    },

    _renderProgressOfGame() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Progress of Game";
        section.appendChild(title);

        const table = document.createElement("table");
        table.className = "sheet-table";

        // Header
        const thead = document.createElement("thead");
        thead.innerHTML = `
      <tr>
        <th>Time</th>
        <th>Per.</th>
        <th>Cap#</th>
        <th>Team</th>
        <th>Event</th>
        <th>Score</th>
      </tr>
    `;
        table.appendChild(thead);

        // Body
        const tbody = document.createElement("tbody");
        const rules = RULES[this.game.rules];

        for (const entry of this.game.log) {
            const tr = document.createElement("tr");

            if (entry.event === "---") {
                tr.className = "sheet-period-end";
                tr.innerHTML = `<td colspan="6">——— End of ${Game.getPeriodLabel(entry.period)} ———</td>`;
            } else {
                const eventDef = rules.events.find((e) => e.code === entry.event);
                const eventName = eventDef ? eventDef.name : entry.event;
                tr.innerHTML = `
          <td>${entry.time}</td>
          <td>${Game.getPeriodLabel(entry.period)}</td>
          <td>${entry.cap || "—"}</td>
          <td>${entry.team || "—"}</td>
          <td>${eventName}</td>
          <td>${entry.scoreW}–${entry.scoreD}</td>
        `;
            }
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderPeriodScores() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Score by Period";
        section.appendChild(title);

        const table = document.createElement("table");
        table.className = "sheet-table sheet-table-compact";

        const periods = Game.getAllPeriods(this.game);
        const headerCells = periods.map((p) => `<th>${Game.getPeriodLabel(p)}</th>`).join("");

        const thead = document.createElement("thead");
        thead.innerHTML = `<tr><th>Team</th>${headerCells}<th>Total</th></tr>`;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        for (const team of ["W", "D"]) {
            const tr = document.createElement("tr");
            const teamLabel = team === "W" ? "White" : "Dark";
            let total = 0;
            let cells = `<td class="sheet-team-cell">${teamLabel}</td>`;

            for (const period of periods) {
                const goals = this.game.log.filter(
                    (e) => e.event === "G" && e.team === team && e.period === period
                ).length;
                total += goals;
                cells += `<td>${goals}</td>`;
            }
            cells += `<td class="sheet-total"><strong>${total}</strong></td>`;
            tr.innerHTML = cells;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderFoulSummary() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Personal Fouls";
        section.appendChild(title);

        // Collect all players with fouls
        const foulEvents = ["E", "E-Game", "P-E"];
        const playerFouls = {};

        for (const entry of this.game.log) {
            if (foulEvents.includes(entry.event) && entry.cap) {
                const key = entry.team + "#" + entry.cap;
                if (!playerFouls[key]) {
                    playerFouls[key] = { team: entry.team, cap: entry.cap, fouls: [] };
                }
                const rules = RULES[this.game.rules];
                const eventDef = rules.events.find((e) => e.code === entry.event);
                playerFouls[key].fouls.push({
                    period: entry.period,
                    time: entry.time,
                    event: eventDef ? eventDef.name : entry.event,
                });
            }
        }

        // Also include auto foul-out events
        const autoFoulEvents = ["MC", "BR"];
        for (const entry of this.game.log) {
            if (autoFoulEvents.includes(entry.event) && entry.cap) {
                const key = entry.team + "#" + entry.cap;
                if (!playerFouls[key]) {
                    playerFouls[key] = { team: entry.team, cap: entry.cap, fouls: [] };
                }
                const rules = RULES[this.game.rules];
                const eventDef = rules.events.find((e) => e.code === entry.event);
                playerFouls[key].fouls.push({
                    period: entry.period,
                    time: entry.time,
                    event: eventDef ? eventDef.name : entry.event,
                });
            }
        }

        if (Object.keys(playerFouls).length === 0) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No personal fouls recorded.";
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "sheet-table";
        table.innerHTML = `
      <thead>
        <tr><th>Team</th><th>Cap#</th><th>Fouls</th><th>Details</th></tr>
      </thead>
    `;

        const tbody = document.createElement("tbody");
        const rules = RULES[this.game.rules];

        for (const [, player] of Object.entries(playerFouls)) {
            const tr = document.createElement("tr");
            const isFouledOut =
                player.fouls.length >= rules.foulOutLimit ||
                player.fouls.some((f) => autoFoulEvents.some((ae) => f.event === (RULES[this.game.rules].events.find(e => e.code === ae)?.name)));
            if (isFouledOut) tr.classList.add("sheet-fouled-out");

            const details = player.fouls
                .map((f) => `${Game.getPeriodLabel(f.period)} ${f.time} ${f.event}`)
                .join("; ");

            tr.innerHTML = `
        <td>${player.team === "W" ? "White" : "Dark"}</td>
        <td>${player.cap}</td>
        <td>${player.fouls.length}</td>
        <td class="sheet-foul-details">${details}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderTimeoutSummary() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Timeouts";
        section.appendChild(title);

        const timeouts = this.game.log.filter((e) => e.event === "TO" || e.event === "TO30");

        if (timeouts.length === 0) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No timeouts recorded.";
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "sheet-table";
        table.innerHTML = `
      <thead>
        <tr><th>Team</th><th>Period</th><th>Time</th><th>Type</th></tr>
      </thead>
    `;

        const tbody = document.createElement("tbody");
        for (const entry of timeouts) {
            const tr = document.createElement("tr");
            const rules = RULES[this.game.rules];
            const eventDef = rules.events.find((e) => e.code === entry.event);
            tr.innerHTML = `
        <td>${entry.team === "W" ? "White" : (entry.team === "D" ? "Dark" : "—")}</td>
        <td>${Game.getPeriodLabel(entry.period)}</td>
        <td>${entry.time}</td>
        <td>${eventDef ? eventDef.name : entry.event}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },
};
