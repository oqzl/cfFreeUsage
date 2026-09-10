const CACHE = "cffreeusage-shell-__COMMIT_SHA__";
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css?v=__COMMIT_SHA__",
  "/app.js?v=__COMMIT_SHA__",
  "/auth.js?v=__COMMIT_SHA__",
  "/usage.js?v=__COMMIT_SHA__",
  "/config.js?v=__COMMIT_SHA__",
  "/manifest.webmanifest?v=__COMMIT_SHA__",
  "/icon.svg?v=__COMMIT_SHA__"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
