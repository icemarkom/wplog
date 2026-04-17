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
    
    // We let the renderer decide to show subseconds when appropriate
    const str = formatDeviceClock(this.state.shot, { showSubseconds: true, isShotClock: true });
    if (str !== this._lastShotStr) {
      el.textContent = str;
      this._lastShotStr = str;
    }
  },

  /**
   * Returns current game clock rigorously clamped to whole integer seconds.
   * Useful for data entry and event logging automation.
   * @returns {number|null} Time in integer seconds, or null if no feed.
   */
  getSeconds: function() {
    if (this.state.clock == null || this.state.clock >= 99999) return null;
    return Math.floor(this.state.clock / 10);
  }
};
