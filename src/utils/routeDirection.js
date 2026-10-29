function getPolylineEndpoints(encodedPolyline) {
  const encoded = String(encodedPolyline || "");

  if (!encoded) {
    return null;
  }

  let index = 0;
  let latitude = 0;
  let longitude = 0;
  let firstPoint = null;
  let lastPoint = null;

  function readCoordinateDelta() {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      if (index >= encoded.length) {
        return null;
      }

      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    return result & 1 ? ~(result >> 1) : result >> 1;
  }

  while (index < encoded.length) {
    const latitudeDelta = readCoordinateDelta();
    const longitudeDelta = readCoordinateDelta();

    if (latitudeDelta === null || longitudeDelta === null) {
      return null;
    }

    latitude += latitudeDelta;
    longitude += longitudeDelta;

    const point = {
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    };

    firstPoint ||= point;
    lastPoint = point;
  }

  return firstPoint && lastPoint ? { firstPoint, lastPoint } : null;
}

export function getCompassDirection(encodedPolyline) {
  const endpoints = getPolylineEndpoints(encodedPolyline);

  if (!endpoints) {
    return "";
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const startLatitude = toRadians(endpoints.firstPoint.latitude);
  const endLatitude = toRadians(endpoints.lastPoint.latitude);
  const longitudeDifference = toRadians(
    endpoints.lastPoint.longitude - endpoints.firstPoint.longitude,
  );
  const y = Math.sin(longitudeDifference) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) *
      Math.cos(endLatitude) *
      Math.cos(longitudeDifference);

  if (Math.abs(x) < Number.EPSILON && Math.abs(y) < Number.EPSILON) {
    return "";
  }

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  const normalizedBearing = (bearing + 360) % 360;
  const compassPoints = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  return compassPoints[Math.round(normalizedBearing / 45) % 8];
}
