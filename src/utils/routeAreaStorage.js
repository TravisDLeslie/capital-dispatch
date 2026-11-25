import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-route-areas";
const SETTINGS_COLLECTION = "appSettings";
const ROUTE_AREAS_DOC = "routeAreas";

function normalizePoint(point) {
  const latitude = Number(point?.latitude ?? point?.lat);
  const longitude = Number(point?.longitude ?? point?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeRouteArea(area, index) {
  const name = String(area?.name || "").trim();
  const points = (Array.isArray(area?.points) ? area.points : [])
    .map(normalizePoint)
    .filter(Boolean);

  return {
    id: String(area?.id || `route-area-${index + 1}`).trim(),
    name,
    color: String(area?.color || "#2563EB").trim() || "#2563EB",
    points,
    active: area?.active !== false,
    createdAt: String(area?.createdAt || ""),
    updatedAt: String(area?.updatedAt || ""),
  };
}

export function normalizeRouteAreas(value) {
  const areas = Array.isArray(value) ? value : value?.areas;

  return (Array.isArray(areas) ? areas : [])
    .map(normalizeRouteArea)
    .filter((area) => area.id && area.name && area.points.length >= 3);
}

function getLocalRouteAreas() {
  try {
    return normalizeRouteAreas(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch (error) {
    console.error("Unable to load route areas:", error);
    return [];
  }
}

function saveLocalRouteAreas(areas) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeRouteAreas(areas)));
  } catch (error) {
    console.error("Unable to save route areas locally:", error);
  }
}

export function subscribeToRouteAreas(onAreas, onError) {
  if (!db) {
    onAreas(getLocalRouteAreas());
    return () => {};
  }

  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, ROUTE_AREAS_DOC),
    (snapshot) => {
      const areas = normalizeRouteAreas(snapshot.exists() ? snapshot.data() : []);
      saveLocalRouteAreas(areas);
      onAreas(areas);
    },
    (error) => {
      onAreas(getLocalRouteAreas());
      onError?.(error);
    },
  );
}

export async function saveRouteAreas(areas) {
  const cleanAreas = normalizeRouteAreas(areas);
  const payload = {
    id: ROUTE_AREAS_DOC,
    areas: cleanAreas,
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    await setDoc(doc(db, SETTINGS_COLLECTION, ROUTE_AREAS_DOC), payload, {
      merge: true,
    });
  }

  saveLocalRouteAreas(cleanAreas);
  return cleanAreas;
}

function pointIsInsidePolygon(coordinate, polygon) {
  const latitude = Number(coordinate?.latitude ?? coordinate?.lat);
  const longitude = Number(coordinate?.longitude ?? coordinate?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  let isInside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects =
      current.latitude > latitude !== previous.latitude > latitude &&
      longitude <
        ((previous.longitude - current.longitude) *
          (latitude - current.latitude)) /
          (previous.latitude - current.latitude || Number.EPSILON) +
          current.longitude;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

export function getRouteAreaForCoordinate(areas, coordinate) {
  return (
    normalizeRouteAreas(areas).find(
      (area) => area.active && pointIsInsidePolygon(coordinate, area.points),
    ) || null
  );
}
