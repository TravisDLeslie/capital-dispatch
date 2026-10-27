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
  const pageHadServiceWorker = Boolean(navigator.serviceWorker.controller);
  let isRefreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!pageHadServiceWorker || isRefreshing) {
      return;
    }

    isRefreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register("/service-worker.js", { updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch((error) => {
      console.error("Unable to register service worker:", error);
    });
}
