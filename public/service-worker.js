// This app previously cached its JavaScript shell for offline use. That could
// leave long-lived employee sessions on an older build after a deployment.
// This final worker removes those caches and unregisters itself. The app now
// loads its shell directly from the network while Firestore keeps its own
// supported local data cache.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) =>
              cacheName.startsWith("capital-dispatch-"),
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister()),
  );
});
