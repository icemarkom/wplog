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

import { formatDeviceClock } from './time.js';

export const ClockEngine = {
  feed: null,
  state: {
    clock: null,
    shot: null,
    period: null
  },
  _animationId: null,
  _containerShown: false,
  _lastGameStr: null,
  _lastShotStr: null,
  _lastPeriodStr: null,

  /**
   * Map raw hardware period integer to a wplog period key.
   * Firmware encoding (game_state.c "period" JSON field):
   *   <= 0  = non-playing state (break, half, unset) -> null
   *   1–4   = regulation quarters                    -> 1–4 (number)
   *   5+    = overtime                               -> "OT1", "OT2", …
   */
  getPeriod: function() {
    const p = this.state.period;
    if (p == null || p <= 0) return null;
    if (p <= 4) return p;
    return 'OT' + (p - 4);
  },

  /**
   * Advance game.currentPeriod from the hardware period — forward-only.
   * Safe for mid-game reconnect and break frames (period <= 0 returns null).
   * Shootout ("SO") is wplog-internal and is never touched here.
   * @param {Object|null} game  wplog game object, or null
   * @returns {boolean} true if currentPeriod was changed
   */
  applyPeriodToGame: function(game) {
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
  },

  startFeed: function(url = '/events') {
    if (this.feed) return;
    this.feed = new EventSource(url);
    this.feed.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.state.clock = data.clock;
        this.state.shot = data.shot;
        this.state.period = data.period;

        if (!this._animationId)
          this._animationId = requestAnimationFrame(() => this.tick());
      } catch (err) {
        console.warn("Invalid clock payload", err);
      }
    };
    
    this.feed.onerror = () => {
      // Keep UI ticking with last known state, hardware disconnects 
      // will be managed by outer shells if necessary
    };
  },

  tick: function() {
    if (!this._containerShown) {
      const container = document.getElementById('hardware-clocks');
      if (container) {
        container.classList.remove('hidden');
        this._containerShown = true;
      }
    }
    this._renderGameClock();
    this._renderShotClock();
    this._renderPeriod();
    this._animationId = requestAnimationFrame(() => this.tick());
  },

  _renderGameClock: function() {
    const el = document.getElementById('display-game-clock');
    if (!el) return;
    
    const str = formatDeviceClock(this.state.clock, { showSubseconds: true, isShotClock: false });
    if (str !== this._lastGameStr) {
      el.textContent = str;
      this._lastGameStr = str;
    }
  },

  _renderShotClock: function() {
    const el = document.getElementById('display-shot-clock');
    if (!el) return;
    const str = formatDeviceClock(this.state.shot, { showSubseconds: true, isShotClock: true });
    if (str !== this._lastShotStr) {
      el.textContent = str;
      this._lastShotStr = str;
    }
  },

  _renderPeriod: function() {
    const p = this.state.period;
    if (p == null || p <= 0) return;
    const label = p <= 4 ? 'Q' + p : 'OT' + (p - 4);
    if (label === this._lastPeriodStr) return;
    const el = document.getElementById('current-period');
    if (el) { el.textContent = label; this._lastPeriodStr = label; }
  },

  /**
   * Returns current game clock rigorously clamped to whole integer seconds.
   * Useful for data entry and event logging automation.
   * @returns {number|null} Time in integer seconds, or null if no feed.
   */
  getSeconds: function() {
    if (this.state.clock == null || this.state.clock >= 99999) return null;
    return Math.floor(this.state.clock / 10);
  },
};
