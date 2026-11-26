import { callBouncieApi } from "./_shared.js";

function getQueryValue(value) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const imei = String(getQueryValue(request.query?.imei)).trim();
  const startsAfter = String(
    getQueryValue(request.query?.["starts-after"]),
  ).trim();
  const endsBefore = String(
    getQueryValue(request.query?.["ends-before"]),
  ).trim();

  if (!/^\d{10,20}$/.test(imei)) {
    response.status(400).json({ error: "A valid truck IMEI is required." });
    return;
  }

  const startTime = new Date(startsAfter);
  const endTime = new Date(endsBefore);
  const rangeMilliseconds = endTime.getTime() - startTime.getTime();

  if (
    !Number.isFinite(startTime.getTime()) ||
    !Number.isFinite(endTime.getTime()) ||
    rangeMilliseconds <= 0 ||
    rangeMilliseconds > 7 * 24 * 60 * 60 * 1000
  ) {
    response.status(400).json({
      error: "Choose a valid history window no longer than seven days.",
    });
    return;
  }

  const searchParams = new URLSearchParams({
    imei,
    "starts-after": startTime.toISOString(),
    "ends-before": endTime.toISOString(),
    "gps-format": "geojson",
  });
  const result = await callBouncieApi(`/trips?${searchParams.toString()}`);

  if (result.error) {
    response.status(result.status || 500).json({
      error: result.error,
      data: result.data || null,
    });
    return;
  }

  response.setHeader("Cache-Control", "private, no-store");
  response.status(200).json({
    trips: Array.isArray(result.data) ? result.data : result.data?.data || [],
    rotatedRefreshToken: Boolean(result.rotatedRefreshToken),
  });
}
