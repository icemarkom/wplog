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

export const WakeLock = {
    _lock: null,
    _isActive: false,

    async acquire() {
        this._isActive = true;
        if ('wakeLock' in navigator) {
            try {
                if (!this._lock) {
                    this._lock = await navigator.wakeLock.request('screen');
                    this._lock.addEventListener('release', () => {
                        this._lock = null;
                        console.log('Wake Lock released');
                    });
                    console.log('Wake Lock acquired');
                }
            } catch (err) {
                console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
            }
        }
    },

    release() {
        this._isActive = false; // Mark as intuitively inactive
        if (this._lock) {
            this._lock.release().catch(err => console.warn('Wake Lock release error', err));
            this._lock = null;
        }
    },

    init() {
        // Re-acquire lock if user tabs out and comes back while a game is active on Live screen
        document.addEventListener('visibilitychange', () => {
            if (this._isActive && document.visibilityState === 'visible') {
                this.acquire();
            }
        });
    }
};

WakeLock.init();
