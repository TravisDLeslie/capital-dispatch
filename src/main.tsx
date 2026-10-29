import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Unable to find app root element.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch((error) => {
        console.error("Unable to clear dev service workers:", error);
      });

    if ("caches" in window) {
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))),
        )
        .catch((error) => {
          console.error("Unable to clear dev caches:", error);
        });
    }
  });
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const SERVICE_WORKER_CLEANUP_KEY = "dispatch-cl-sw-cleanup-v1";

  window.addEventListener("load", () => {
    const pageHadServiceWorker = Boolean(navigator.serviceWorker.controller);

    Promise.all([
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister()),
          ),
        ),
      "caches" in window
        ? caches
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
        : Promise.resolve([]),
    ])
      .then(() => {
        if (
          pageHadServiceWorker &&
          sessionStorage.getItem(SERVICE_WORKER_CLEANUP_KEY) !== "done"
        ) {
          sessionStorage.setItem(SERVICE_WORKER_CLEANUP_KEY, "done");
          window.location.reload();
          return;
        }

        sessionStorage.removeItem(SERVICE_WORKER_CLEANUP_KEY);
      })
      .catch((error) => {
        console.error("Unable to clear the old app cache:", error);
      });
  });
}
