// Copyright 2026 Marko Milivojevic
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Browser tests for sheet.js + sheet-screen.js — Game Sheet rendering.
// IMPORTANT: No print tests — window.print() opens a native OS dialog.
// We test screen rendering only (Sheet.render without paperSize).

import { describe, it, strictEqual, ok } from "../harness.js";

let Sheet, Game;
let sheetHTML;

// Sheet.render() writes into #sheet-content. We inject sheet.html into body
// so document.getElementById("sheet-content") works.
function injectSheetScreen() {
    const old = document.getElementById("sheet-test-container");
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = "sheet-test-container";
    container.innerHTML = sheetHTML;
    document.body.appendChild(container);
    return container;
}

function makeGameWithEvents() {
    const game = Game.create("USAWP");
    game.date = "2026-03-20";
    game.location = "Aquatic Center";
    game.gameId = "7";
    game.white.name = "Sharks";
    game.dark.name = "Waves";

    Game.addEvent(game, { period: 1, time: "7:30", team: "W", cap: "5", event: "G" });
    Game.addEvent(game, { period: 1, time: "6:00", team: "D", cap: "3", event: "G" });
    Game.addEvent(game, { period: 1, time: "5:00", team: "W", cap: "5", event: "E" });
    Game.addEvent(game, { period: 1, time: "3:00", team: "W", cap: "", event: "TO" });
    return game;
}

describe("Game Sheet — screen render", () => {

    it("can import Sheet and load screen HTML", async () => {
        sheetHTML = await fetch("/screens/sheet.html").then((r) => r.text());
        ok(sheetHTML.length > 0, "sheet.html should have content");

        const sheetMod = await import("/js/sheet.js");
        Sheet = sheetMod.Sheet;
        ok(Sheet, "Sheet should be importable");

        const gameMod = await import("/js/game.js");
        Game = gameMod.Game;
    });

    it("render creates two sheet pages for screen mode", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const pages = document.querySelectorAll("#sheet-content .sheet-page");
        strictEqual(pages.length, 2);
    });

    it("header shows game title", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const title = document.querySelector("#sheet-content .sheet-title");
        ok(title, "should have sheet title");
        strictEqual(title.textContent, "Game Sheet");
    });

    it("header shows team names in score bar", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const header = document.querySelector("#sheet-content .sheet-header");
        const text = header.textContent;
        ok(text.includes("White"), "should show White label");
        ok(text.includes("Dark"), "should show Dark label");
        ok(text.includes("Sharks"), "should show white team name");
        ok(text.includes("Waves"), "should show dark team name");
    });

    it("header shows game metadata", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const header = document.querySelector("#sheet-content .sheet-header");
        const text = header.textContent;
        ok(text.includes("2026-03-20"), "should show date");
        ok(text.includes("Aquatic Center"), "should show location");
        ok(text.includes("7"), "should show game ID");
    });

    it("header shows final score", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const scoreEl = document.querySelector("#sheet-content .sheet-final-score");
        ok(scoreEl, "should have final score element");
        // 1 W goal + 1 D goal = 1-1
        ok(scoreEl.textContent.includes("1"), "score should contain 1");
    });

    it("page 1 has Progress of Game table", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const page1 = document.querySelectorAll("#sheet-content .sheet-page")[0];
        const pogTitle = page1.querySelector(".sheet-section-title");
        ok(pogTitle, "should have section title");
        strictEqual(pogTitle.textContent, "Progress of Game");
    });

    it("Progress of Game shows log events", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const page1 = document.querySelectorAll("#sheet-content .sheet-page")[0];
        const rows = page1.querySelectorAll("tbody tr");
        ok(rows.length > 0, "should have log rows");
    });

    it("page 2 has Score by Period section", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const page2 = document.querySelectorAll("#sheet-content .sheet-page")[1];
        const titles = page2.querySelectorAll(".sheet-section-title");
        const texts = Array.from(titles).map((t) => t.textContent);
        ok(texts.includes("Score by Period"), "should have Score by Period");
    });

    it("page 2 has Personal Fouls section", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const page2 = document.querySelectorAll("#sheet-content .sheet-page")[1];
        const titles = page2.querySelectorAll(".sheet-section-title");
        const texts = Array.from(titles).map((t) => t.textContent);
        ok(texts.includes("Personal Fouls"), "should have Personal Fouls");
    });

    it("page 2 has Timeout section", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const page2 = document.querySelectorAll("#sheet-content .sheet-page")[1];
        const titles = page2.querySelectorAll(".sheet-section-title");
        const texts = Array.from(titles).map((t) => t.textContent);
        ok(texts.includes("Timeouts"), "should have Timeouts");
    });

    it("empty game renders without errors", () => {
        injectSheetScreen();
        const game = Game.create("USAWP");
        Sheet.render(game);

        const pages = document.querySelectorAll("#sheet-content .sheet-page");
        strictEqual(pages.length, 2);
    });

    it("default team names do not show in header", () => {
        injectSheetScreen();
        const game = Game.create("USAWP");
        Sheet.render(game);

        const teamNames = document.querySelectorAll("#sheet-content .sheet-team-name");
        // When names are default ("White"/"Dark"), the header shows empty name spans
        ok(teamNames.length >= 2, "should have team name elements");
        strictEqual(teamNames[0].textContent, "");
        strictEqual(teamNames[1].textContent, "");
    });

    it("personal foul data shows when players have fouls", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        const page2 = document.querySelectorAll("#sheet-content .sheet-page")[1];
        const foulRows = page2.querySelectorAll("table tbody tr");
        // Game has 1 E foul for cap 5
        ok(foulRows.length > 0, "should have some data rows");
    });

    it("score column only shows on goal events", () => {
        injectSheetScreen();
        const game = makeGameWithEvents();
        Sheet.render(game);

        // Check Progress of Game tbody rows
        const page1 = document.querySelectorAll("#sheet-content .sheet-page")[0];
        const rows = page1.querySelectorAll("tbody tr:not(.sheet-period-end)");
        let goalRowsWithScore = 0;
        let nonGoalRowsWithScore = 0;

        for (const row of rows) {
            const cells = row.querySelectorAll("td");
            if (cells.length < 5) continue;
            const remarkCell = cells[3].textContent.trim();
            const scoreCell = cells[4].textContent.trim();
            if (remarkCell === "G" && scoreCell !== "") goalRowsWithScore++;
            if (remarkCell !== "G" && scoreCell !== "") nonGoalRowsWithScore++;
        }
        ok(goalRowsWithScore > 0, "goal rows should have scores");
        strictEqual(nonGoalRowsWithScore, 0, "non-goal rows should not have scores");
    });

    // Cleanup
    it("cleanup: removes test container from body", () => {
        const sc = document.getElementById("sheet-test-container");
        if (sc) sc.remove();
        ok(true, "cleanup done");
    });
});
