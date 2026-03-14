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

        // Page 1: Header + Progress of Game
        const page1 = document.createElement("div");
        page1.className = "sheet-page";
        page1.appendChild(this._renderHeader());
        page1.appendChild(this._renderProgressOfGame());
        container.appendChild(page1);

        // Page 2: Header (repeated) + Period Scores + Fouls + Timeouts + Player Stats
        const page2 = document.createElement("div");
        page2.className = "sheet-page sheet-page-break";
        page2.appendChild(this._renderHeader());
        page2.appendChild(this._renderPeriodScores());
        page2.appendChild(this._renderFoulSummary());
        page2.appendChild(this._renderTimeoutSummary());
        page2.appendChild(this._renderCardSummary());
        if (this.game.enableStats) {
            page2.appendChild(this._renderPlayerStats());
        }
        container.appendChild(page2);
    },

    _renderHeader() {
        const game = this.game;
        const rules = RULES[game.rules];
        const header = document.createElement("div");
        header.className = "sheet-header";

        const whiteName = game.white.name === "White" ? "" : game.white.name;
        const darkName = game.dark.name === "Dark" ? "" : game.dark.name;
        const score = Game.getDisplayScore(game);

        header.innerHTML = `
      <div class="sheet-title">Game Sheet</div>
      <div class="sheet-meta">
        <div class="sheet-meta-row">
          <span class="sheet-meta-pair"><span class="sheet-label">Game #:</span> <span class="sheet-value">${escapeHTML(game.gameId || "—")}</span></span>
        </div>
        <div class="sheet-meta-row">
          <span class="sheet-meta-pair"><span class="sheet-label">Location:</span> <span class="sheet-value">${escapeHTML(game.location || "—")}</span></span>
        </div>
        <div class="sheet-meta-row sheet-meta-times">
          <span class="sheet-meta-pair"><span class="sheet-label">Date:</span> <span class="sheet-value">${escapeHTML(game.date)}</span></span>
          <span class="sheet-meta-pair"><span class="sheet-label">Scheduled:</span> <span class="sheet-value">${escapeHTML(game.startTime || "--:--")}</span></span>
          <span class="sheet-meta-pair"><span class="sheet-label">Ended:</span> <span class="sheet-value">${escapeHTML(game.endTime || "--:--")}</span></span>
        </div>
      </div>
      <div class="sheet-teams">
        <div class="sheet-team sheet-team-white">
          <span class="sheet-team-label">White</span>
          <span class="sheet-team-name">${escapeHTML(whiteName)}</span>
        </div>
        <div class="sheet-final-score">${escapeHTML(score.white)} — ${escapeHTML(score.dark)}</div>
        <div class="sheet-team sheet-team-dark">
          <span class="sheet-team-label">Dark</span>
          <span class="sheet-team-name">${escapeHTML(darkName)}</span>
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
        <th>Cap</th>
        <th>Team</th>
        <th>Remarks</th>
        <th>Score</th>
      </tr>
    `;
        table.appendChild(thead);

        // Body
        const tbody = document.createElement("tbody");
        const rules = RULES[this.game.rules];

        // Filter out statsOnly events from the official game log
        const logEntries = this.game.log.filter((entry) => {
            if (entry.event === "---") return true;
            const eventDef = rules.events.find((e) => e.code === entry.event);
            return !eventDef || !eventDef.statsOnly;
        });

        for (const entry of logEntries) {
            const tr = document.createElement("tr");

            if (entry.event === "---") {
                tr.className = "sheet-period-end";
                tr.innerHTML = `<td colspan="5">——— End of ${Game.getPeriodLabel(entry.period)} ———</td>`;
            } else {
                const eventDef = rules.events.find((e) => e.code === entry.event);
                const align = eventDef && eventDef.align ? eventDef.align : "center";
                tr.innerHTML = `
          <td>${entry.period === "SO" ? "" : escapeHTML(entry.time.replace(/^0(\d:)/, '$1'))}</td>
          <td>${escapeHTML(entry.cap || "—")}</td>
          <td>${escapeHTML(entry.team || "—")}</td>
          <td style="text-align:${align}">${escapeHTML(entry.event)}</td>
          <td>${escapeHTML(Game.formatEntryScore(entry, this.game))}</td>
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
                const display = String(goals);
                cells += `<td>${display}</td>`;
            }
            const displayScore = Game.getDisplayScore(this.game);
            const totalDisplay = team === "W" ? displayScore.white : displayScore.dark;
            cells += `<td class="sheet-total"><strong>${totalDisplay}</strong></td>`;
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

        // Collect all players with personal fouls or auto-foul-out events
        const rules = RULES[this.game.rules];
        const foulCodes = rules.events
            .filter(e => e.isPersonalFoul || e.autoFoulOut)
            .map(e => e.code);
        const playerFouls = {};

        for (const entry of this.game.log) {
            if (foulCodes.includes(entry.event) && entry.cap) {
                const key = entry.team + "#" + entry.cap;
                if (!playerFouls[key]) {
                    playerFouls[key] = { team: entry.team, cap: entry.cap, fouls: [] };
                }
                const eventDef = rules.events.find((e) => e.code === entry.event);
                playerFouls[key].fouls.push({
                    period: entry.period,
                    time: entry.time,
                    event: eventDef ? eventDef.name : entry.event,
                    code: entry.event,
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
        <tr><th>Team</th><th>Cap</th><th>Fouls</th><th>Details</th></tr>
      </thead>
    `;

        const tbody = document.createElement("tbody");

        for (const [, player] of Object.entries(playerFouls)) {
            const tr = document.createElement("tr");
            const personalFoulCount = player.fouls.filter(f => {
                const def = rules.events.find(e => e.name === f.event);
                return def && def.isPersonalFoul;
            }).length;
            const hasAutoFoulOut = player.fouls.some(f => {
                const def = rules.events.find(e => e.name === f.event);
                return def && def.autoFoulOut;
            });
            const isFouledOut = personalFoulCount >= rules.foulOutLimit || hasAutoFoulOut;
            if (isFouledOut) tr.classList.add("sheet-fouled-out");

            const details = player.fouls
                .map((f) => `${Game.getPeriodLabel(f.period)} ${f.time} ${f.event}`)
                .join("; ");

            tr.innerHTML = `
        <td>${player.team === "W" ? "White" : "Dark"}</td>
        <td>${escapeHTML(player.cap)}</td>
        <td>${player.fouls.length}</td>
        <td class="sheet-foul-details">${escapeHTML(details)}</td>
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
        <td>${entry.time.replace(/^0(\d:)/, '$1')}</td>
        <td>${eventDef ? eventDef.name : entry.event}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderCardSummary() {
        const section = document.createElement("div");
        section.className = "sheet-section";
        section.innerHTML = `<div class="sheet-section-title">Cards</div>`;

        const cards = this.game.log.filter((e) => e.event === "YC" || e.event === "RC");

        if (cards.length === 0) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No cards issued.";
            section.appendChild(empty);
            return section;
        }

        const table = document.createElement("table");
        table.className = "sheet-table";
        table.innerHTML = `
      <thead>
        <tr><th>Team</th><th>Cap</th><th>Period</th><th>Time</th><th>Type</th></tr>
      </thead>
    `;

        const tbody = document.createElement("tbody");
        for (const entry of cards) {
            const tr = document.createElement("tr");
            const rules = RULES[this.game.rules];
            const eventDef = rules.events.find((e) => e.code === entry.event);
            tr.innerHTML = `
        <td>${entry.team === "W" ? "White" : (entry.team === "D" ? "Dark" : "—")}</td>
        <td>${escapeHTML(entry.cap || "—")}</td>
        <td>${Game.getPeriodLabel(entry.period)}</td>
        <td>${escapeHTML(entry.time.replace(/^0(\d:)/, '$1'))}</td>
        <td>${eventDef ? eventDef.name : escapeHTML(entry.event)}</td>
      `;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        section.appendChild(table);
        return section;
    },

    _renderPlayerStats() {
        const section = document.createElement("div");
        section.className = "sheet-section";

        const title = document.createElement("h3");
        title.className = "sheet-section-title";
        title.textContent = "Player Stats";
        section.appendChild(title);

        const rules = RULES[this.game.rules];
        // All event types that have a cap number (exclude noPlayer events like TO)
        const statTypes = rules.events
            .filter((e) => !e.noPlayer)
            .map((e) => {
                const n = e.name;
                const plural = n.endsWith("y") ? n.slice(0, -1) + "ies" : n + "s";
                return { code: e.code, name: plural };
            });

        // Get ordered periods from the game log
        const periodOrder = [];
        const periodSeen = new Set();
        for (const entry of this.game.log) {
            if (entry.event === "---") continue;
            if (!periodSeen.has(entry.period)) {
                periodSeen.add(entry.period);
                periodOrder.push(entry.period);
            }
        }

        // Collect per-stat, per-team, per-cap, per-period counts
        // Structure: counts[code][team][cap][period] = count
        const counts = {};
        for (const st of statTypes) {
            counts[st.code] = { W: {}, D: {} };
        }
        for (const entry of this.game.log) {
            if (!entry.cap || !entry.team) continue;
            if (!counts[entry.event]) continue;
            const teamData = counts[entry.event][entry.team];
            if (!teamData[entry.cap]) teamData[entry.cap] = {};
            teamData[entry.cap][entry.period] = (teamData[entry.cap][entry.period] || 0) + 1;
        }

        // Check if any stats exist
        let anyStats = false;
        for (const st of statTypes) {
            if (Object.keys(counts[st.code].W).length > 0 || Object.keys(counts[st.code].D).length > 0) {
                anyStats = true;
                break;
            }
        }
        if (!anyStats) {
            const empty = document.createElement("p");
            empty.className = "sheet-empty";
            empty.textContent = "No stats recorded.";
            section.appendChild(empty);
            return section;
        }

        // Period column headers
        const periodHeaders = periodOrder.map((p) => Game.getPeriodLabel(p));

        // Render one single table per stat type
        const colsPerTeam = 1 + periodHeaders.length + 1; // Cap + periods + Tot

        for (const st of statTypes) {
            const wCaps = Object.keys(counts[st.code].W).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
            const dCaps = Object.keys(counts[st.code].D).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
            if (wCaps.length === 0 && dCaps.length === 0) continue;

            const subTitle = document.createElement("h4");
            subTitle.className = "sheet-section-subtitle";
            subTitle.textContent = st.name;
            section.appendChild(subTitle);

            const table = document.createElement("table");
            table.className = "sheet-table sheet-table-compact sheet-table-stats";

            // Row 1: Team names spanning their columns
            const thead = document.createElement("thead");
            const periodCols = periodHeaders.map((h) => `<th>${h}</th>`).join("");
            thead.innerHTML = `
              <tr>
                <th colspan="${colsPerTeam}" class="sheet-team-header">White</th>
                <th colspan="${colsPerTeam}" class="sheet-team-header">Dark</th>
              </tr>
              <tr>
                <th>Cap</th>${periodCols}<th>Tot</th>
                <th>Cap</th>${periodCols}<th>Tot</th>
              </tr>
            `;
            table.appendChild(thead);

            // Data rows: max of both team's player counts
            const maxRows = Math.max(wCaps.length, dCaps.length);
            const tbody = document.createElement("tbody");
            for (let i = 0; i < maxRows; i++) {
                const tr = document.createElement("tr");
                let cells = "";

                // White half
                if (i < wCaps.length) {
                    const cap = wCaps[i];
                    const capData = counts[st.code].W[cap];
                    let total = 0;
                    cells += `<td>${escapeHTML(cap)}</td>`;
                    for (const period of periodOrder) {
                        const val = capData[period] || 0;
                        total += val;
                        cells += `<td>${val || ""}</td>`;
                    }
                    cells += `<td><strong>${total}</strong></td>`;
                } else {
                    cells += `<td></td>`.repeat(colsPerTeam);
                }

                // Dark half
                if (i < dCaps.length) {
                    const cap = dCaps[i];
                    const capData = counts[st.code].D[cap];
                    let total = 0;
                    cells += `<td>${escapeHTML(cap)}</td>`;
                    for (const period of periodOrder) {
                        const val = capData[period] || 0;
                        total += val;
                        cells += `<td>${val || ""}</td>`;
                    }
                    cells += `<td><strong>${total}</strong></td>`;
                } else {
                    cells += `<td></td>`.repeat(colsPerTeam);
                }

                tr.innerHTML = cells;
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            section.appendChild(table);
        }

        return section;
    },
};
