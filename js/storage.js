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

// wplog — localStorage Persistence

export const Storage = {
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
            if (!data) return null;
            const game = JSON.parse(data);
            if (!game || typeof game.rules !== "string" || !Array.isArray(game.log)) {
                console.warn("Invalid game data in localStorage, ignoring.");
                return null;
            }
            return game;
        } catch (e) {
            console.error("Failed to load game:", e);
            return null;
        }
    },

    clear() {
        localStorage.removeItem(this.KEY);
    },
};
