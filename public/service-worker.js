const CACHE_NAME = "capital-dispatch-v4";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/pwa/apple-touch-icon.png",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/favicon-32.png",
];

function isCacheableResponse(response) {
  return response && (response.ok || response.type === "opaque");
}

async function updateCache(request) {
  const response = await fetch(request);

  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

async function staleWhileRevalidate(request, fallbackUrl = "") {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const networkPromise = updateCache(request).catch(() => null);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await networkPromise;

  if (networkResponse) {
    return networkResponse;
  }

  if (fallbackUrl) {
    const fallbackResponse = await cache.match(fallbackUrl);

    if (fallbackResponse) {
      return fallbackResponse;
    }
  }

  return Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(request, "/"));
    return;
  }

  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font" ||
    requestUrl.pathname.startsWith("/assets/") ||
    requestUrl.pathname.startsWith("/pwa/")
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseToCache = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, responseToCache));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          if (request.mode === "navigate") {
            return caches.match("/");
          }

          return Response.error();
        }),
      ),
  );
});
