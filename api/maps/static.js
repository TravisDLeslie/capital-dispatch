function getGoogleMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ""
  );
}

function readQueryValues(value, limit = 25) {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values
    .map((queryValue) => String(queryValue || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function sendBinaryResponse(response, statusCode, contentType, body) {
  response.status(statusCode);
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "private, max-age=300");

  if (typeof response.send === "function") {
    response.send(body);
    return;
  }

  response.end(body);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    response.status(500).json({ error: "Missing Google Maps API key." });
    return;
  }

  const params = new URLSearchParams({
    key: apiKey,
    size: String(request.query.size || "640x640").slice(0, 20),
    scale: String(request.query.scale || "2").slice(0, 2),
    maptype: String(request.query.maptype || "roadmap").slice(0, 20),
  });
  const center = String(request.query.center || "").trim();
  const zoom = String(request.query.zoom || "").trim();

  if (center) {
    params.set("center", center.slice(0, 300));
  }

  if (zoom) {
    params.set("zoom", zoom.slice(0, 2));
  }

  readQueryValues(request.query.markers).forEach((marker) => {
    params.append("markers", marker.slice(0, 500));
  });
  readQueryValues(request.query.path, 5).forEach((path) => {
    params.append("path", path.slice(0, 12000));
  });

  try {
    const mapResponse = await fetch(
      `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`,
    );
    const contentType =
      mapResponse.headers.get("content-type") || "application/octet-stream";
    const body = Buffer.from(await mapResponse.arrayBuffer());

    sendBinaryResponse(response, mapResponse.status, contentType, body);
  } catch (error) {
    console.error("Unable to load Google Static Map:", error);
    response.status(500).json({ error: "Unable to load map preview." });
  }
}
