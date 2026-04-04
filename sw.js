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

// wplog — Service Worker (Offline Caching)

import { APP_VERSION } from './js/config.js';

const CACHE_NAME = "wplog-" + APP_VERSION;
const ASSETS = [
    "./",
    "./index.html",
    "./css/style.css",
    "./css/print.css",
    "./js/sanitize.js",
    "./js/loader.js",
    "./js/year.js",
    "./config.json",
    "./js/config.js",
    "./js/confirm.js",
    "./js/dialog.js",
    "./js/storage.js",
    "./js/time.js",
    "./js/wakelock.js",
    "./js/game.js",
    "./js/setup.js",
    "./js/events.js",
    "./js/sheet.js",
    "./js/sheet-screen.js",
    "./js/share.js",
    "./js/app.js",
    "./js/export.js",
    "./img/qr-wplog.svg",
    "./img/favicon-32.png",
    "./img/favicon-192.png",
    "./img/favicon-512.png",
    "./screens/setup.html",
    "./screens/live.html",
    "./screens/modal.html",
    "./screens/sheet.html",
    "./screens/share.html",
    "./screens/help.html",
    "./privacy.html",
    "./LICENSE",
    "./manifest.json",
];

// Install — cache all assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    // self.skipWaiting() intentionally omitted to allow UI-controlled update flow
});

// Update — listen for directive to apply the new worker
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch — network-first in dev, cache-first in production
self.addEventListener("fetch", (event) => {
    if (APP_VERSION === "dev") {
        // Dev: always fetch from network, fall back to cache
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match(event.request))
        );
    } else {
        // Production: cache-first for offline reliability
        event.respondWith(
            caches.match(event.request).then((cached) => {
                return cached || fetch(event.request).then((response) => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
    }
});


