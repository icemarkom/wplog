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

import { APP_VERSION } from './js/core/config.js';

const CACHE_NAME = "wplog-" + APP_VERSION;
const ASSETS = [
    "./",
    "./index.html",
    "./css/style.css",
    "./css/print.css",
    "./js/core/sanitize.js",
    "./config.json",
    "./js/core/config.js",
    "./js/core/storage.js",
    "./js/core/time.js",
    "./js/core/clock.js",
    "./js/core/game.js",
    "./js/core/export.js",
    "./js/core/roster.js",
    "./js/ui/theme.js",
    "./js/ui/loader.js",
    "./js/ui/year.js",
    "./js/ui/confirm.js",
    "./js/ui/dialog.js",
    "./js/ui/storage.js",
    "./js/ui/clock.js",
    "./js/ui/wakelock.js",
    "./js/ui/setup.js",
    "./js/ui/events.js",
    "./js/ui/sheet.js",
    "./js/ui/sheet-screen.js",
    "./js/ui/share.js",
    "./js/ui/app.js",
    "./img/qr-wplog.svg",
    "./img/icon-upload.svg",
    "./img/icon-swap.svg",
    "./img/icon-arrow-right.svg",
    "./img/icon-infinity.svg",
    "./img/icon-backspace.svg",
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
// Uses individual fetches with Promise.allSettled so a single slow or
// failing asset does not abort the entire installation. Missing assets
// fall through to the network fetch handler on first use and get cached then.
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.allSettled(
                ASSETS.map((url) =>
                    fetch(url).then((response) => {
                        if (response.ok) return cache.put(url, response);
                    }).catch(() => { /* skip — SW still installs */ })
                )
            )
        )
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
    // Never intercept SSE streams. Wrapping an EventSource in respondWith() leaves
    // a service-worker-managed fetch that never resolves (SSE is an infinite stream).
    // iOS Safari will not show the print dialog until all SW-managed fetches settle,
    // so intercepting /events blocks print for ~60s until the HTTP timeout fires (#69).
    const url = new URL(event.request.url);
    if (event.request.headers.get("Accept")?.includes("text/event-stream") ||
        url.pathname === "/events") {
        return;
    }

    if (APP_VERSION === "dev") {
        // Dev: always fetch from network, fall back to cache
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match(event.request, { ignoreSearch: true }))
        );
    } else {
        // Production: cache-first for offline reliability
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then((cached) => {
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


