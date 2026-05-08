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

// wplog — Hardware Clock Telemetry Engine (Pure Logic)

export class ClockEngine {
  constructor() {
    this.state = {
      clock: null,
      shot: null,
      period: null
    };
  }

  updateState(clock, shot, period) {
    this.state.clock = clock;
    this.state.shot = shot;
    this.state.period = period;
  }

  /**
   * Map raw hardware period integer to a wplog period key.
   * Firmware encoding (game_state.c "period" JSON field):
   *   <= 0  = non-playing state (break, half, unset) -> null
   *   1–4   = regulation quarters                    -> 1–4 (number)
   *   5+    = overtime                               -> "OT1", "OT2", …
   */
  getPeriod() {
    const p = this.state.period;
    if (p == null || p <= 0) return null;
    if (p <= 4) return p;
    return 'OT' + (p - 4);
  }

  /**
   * Advance game.currentPeriod from the hardware period — forward-only.
   * Safe for mid-game reconnect and break frames (period <= 0 returns null).
   * Shootout ("SO") is wplog-internal and is never touched here.
   * @param {Object|null} game  wplog game object, or null
   * @returns {boolean} true if currentPeriod was changed
   */
  applyPeriodToGame(game) {
    if (!game) return false;
    const hw = this.getPeriod();
    if (hw == null) return false;
    const cur = game.currentPeriod;
    // Numeric regulation: advance if hardware is strictly ahead
    if (typeof hw === 'number' && typeof cur === 'number') {
      if (hw > cur) { game.currentPeriod = hw; return true; }
      return false;
    }
    // Hardware in OT, game still in regulation
    if (typeof hw === 'string' && hw.startsWith('OT') && typeof cur === 'number') {
      game.currentPeriod = hw; return true;
    }
    // Both OT: advance if hardware OT number is strictly higher
    if (typeof hw === 'string' && hw.startsWith('OT') &&
        typeof cur === 'string' && cur.startsWith('OT')) {
      if (parseInt(hw.slice(2)) > parseInt(cur.slice(2))) {
        game.currentPeriod = hw; return true;
      }
    }
    return false;
  }

  /**
   * Returns current game clock rigorously clamped to whole integer seconds.
   * Useful for data entry and event logging automation.
   * @returns {number|null} Time in integer seconds, or null if no feed.
   */
  getSeconds() {
    if (this.state.clock == null || this.state.clock >= 99999) return null;
    return Math.floor(this.state.clock / 10);
  }
}

// Shared instance for the web UI
export const sharedClockEngine = new ClockEngine();
