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

// wplog — Game Sheet Screen Rendering
// Simple 2-page DOM layout for on-screen viewing.

export function renderScreen(game, sheet, container) {
    // Page 1: Header + Progress of Game
    const page1 = document.createElement("div");
    page1.className = "sheet-page";
    page1.appendChild(sheet._renderHeader(game, "Game Sheet"));
    page1.appendChild(sheet._renderProgressOfGame(game));
    container.appendChild(page1);

    // Page 2: Header (repeated) + Period Scores + Fouls + Timeouts + Cards + Player Stats
    const page2 = document.createElement("div");
    page2.className = "sheet-page sheet-page-break";
    page2.appendChild(sheet._renderHeader(game, "Game Sheet"));
    page2.appendChild(sheet._renderPeriodScores(game));
    page2.appendChild(sheet._renderFoulSummary(game));
    page2.appendChild(sheet._renderTimeoutSummary(game));
    page2.appendChild(sheet._renderCardSummary(game));
    if (game.enableStats) {
        page2.appendChild(sheet._renderPlayerStatsByTeam(game));
    }
    container.appendChild(page2);
}
