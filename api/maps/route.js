function getGoogleMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ""
  );
}

function readRouteDurationSeconds(duration) {
  if (!duration || typeof duration !== "string") {
    return 0;
  }

  return Number(duration.replace("s", "")) || 0;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} hr ${remainingMinutes} min`;
  }

  if (hours > 0) {
    return `${hours} hr`;
  }

  return `${minutes} min`;
}

function formatDistance(meters) {
  const miles = Number(meters || 0) / 1609.344;

  if (miles >= 10) {
    return `${Math.round(miles)} mi`;
  }

  return `${miles.toFixed(1)} mi`;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = getGoogleMapsApiKey();
  const origin = String(request.query.origin || "").trim();
  const destination = String(request.query.destination || "").trim();

  if (!apiKey) {
    response.status(500).json({ error: "Missing Google Maps API key." });
    return;
  }

  if (!origin || !destination) {
    response.status(400).json({ error: "Origin and destination are required." });
    return;
  }

  try {
    const routeResponse = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: { address: origin },
          destination: { address: destination },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          computeAlternativeRoutes: false,
          units: "IMPERIAL",
        }),
      },
    );

    const routeData = await routeResponse.json();

    if (!routeResponse.ok) {
      response.status(routeResponse.status).json({
        error:
          routeData?.error?.message ||
          "Google Maps could not calculate this route.",
      });
      return;
    }

    const route = Array.isArray(routeData.routes) ? routeData.routes[0] : null;

    if (!route) {
      response.status(404).json({ error: "No route found." });
      return;
    }

    const durationSeconds =
      readRouteDurationSeconds(route.duration) ||
      readRouteDurationSeconds(route.staticDuration);

    response.status(200).json({
      durationSeconds,
      durationText: formatDuration(durationSeconds),
      distanceMeters: route.distanceMeters || 0,
      distanceText: formatDistance(route.distanceMeters),
      encodedPolyline: route.polyline?.encodedPolyline || "",
    });
  } catch (error) {
    console.error("Unable to calculate Google route:", error);
    response.status(500).json({ error: "Unable to calculate route." });
  }
}
