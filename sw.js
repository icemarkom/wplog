// wplog — Service Worker (Offline Caching)

const CACHE_NAME = "wplog-v3";
const ASSETS = [
    "./",
    "./index.html",
    "./css/style.css",
    "./css/print.css",
    "./js/config.js",
    "./js/confirm.js",
    "./js/storage.js",
    "./js/game.js",
    "./js/setup.js",
    "./js/events.js",
    "./js/sheet.js",
    "./js/share.js",
    "./js/app.js",
    "./manifest.json",
];

// Install — cache all assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
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

// Fetch — cache-first strategy
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                // Cache successful responses
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
