const CACHE_NAME = "hk-growth-chart-v11";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./guest.html",
  "./styles.css",
  "./manifest.json",
  "./icons/icon.svg",
  "./vendor/chart.umd.min.js",
  "./data/hk2020-height.js",
  "./data/hk2020-weight.js",
  "./js/growth-engine.js",
  "./js/storage.js",
  "./js/app.js",
  "./js/guest.js",
  "./js/guest-storage.js",
  "./js/guest-config.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
