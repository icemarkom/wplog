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

import { formatDeviceClock } from '../core/time.js';
import { sharedClockEngine as ClockEngine } from '../core/clock.js';

// wplog — Hardware Clock UI Bindings (DOM & Network)

export const ClockUI = {
  feed: null,
  _animationId: null,
  _containerShown: false,
  _lastGameStr: null,
  _lastShotStr: null,
  _lastPeriodStr: null,

  startFeed: function(url = '/events') {
    if (this.feed) return;
    this.feed = new EventSource(url);
    this.feed.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        ClockEngine.updateState(data.clock, data.shot, data.period);

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
    
    const str = formatDeviceClock(ClockEngine.state.clock, { showSubseconds: true, isShotClock: false });
    if (str !== this._lastGameStr) {
      el.textContent = str;
      this._lastGameStr = str;
    }
  },

  _renderShotClock: function() {
    const el = document.getElementById('display-shot-clock');
    if (!el) return;

    const { period, clock, shot } = ClockEngine.state;

    const shouldBlank =
      period == null || period <= 0 ||                      // interval (break/half/unset)
      shot == null   || shot >= 65535 ||                    // hardware blank sentinel
      (clock != null && clock < 65535 && clock <= shot);   // GT <= SC

    const str = shouldBlank
      ? ''
      : formatDeviceClock(shot, { showSubseconds: true, isShotClock: true });

    if (str !== this._lastShotStr) {
      el.textContent = str;
      this._lastShotStr = str;
    }
  },

  _renderPeriod: function() {
    const p = ClockEngine.state.period;
    if (p == null || p === 0) return;  // truly unset - leave display alone
    let label;
    if      (p === -2) label = 'HALF';
    else if (p === -1) label = 'BREAK';
    else if (p <= 4)   label = 'Q' + p;
    else               label = 'OT' + (p - 4);
    if (label === this._lastPeriodStr) return;
    const el = document.getElementById('current-period');
    if (el) { el.textContent = label; this._lastPeriodStr = label; }
  }
};
