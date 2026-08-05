let googlePlacesPromise = null;
let googlePlacesCallbackId = 0;

export function getGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
}

export function loadGooglePlaces() {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (googlePlacesPromise) {
    return googlePlacesPromise;
  }

  googlePlacesPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[data-google-places="true"]',
    );

    if (existingScript) {
      if (window.google?.maps?.places) {
        resolve(window.google);
        return;
      }

      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    const callbackName = `__capitalDispatchGooglePlacesReady${googlePlacesCallbackId}`;
    googlePlacesCallbackId += 1;
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google);
    };

    window.gm_authFailure = () => {
      reject(new Error("Google Maps authorization failed."));
    };

    const params = new URLSearchParams({
      key: apiKey,
      libraries: "places",
      loading: "async",
      v: "weekly",
      callback: callbackName,
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.googlePlaces = "true";
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return googlePlacesPromise;
}
