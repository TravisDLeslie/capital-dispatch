import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-shared-delivery-routes";
const COLLECTION_NAME = "sharedDeliveryRoutes";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSharedRoute(route) {
  const savedRoute = route && typeof route === "object" ? route : {};

  return {
    ...savedRoute,
    id: normalizeText(savedRoute.id),
    assignedDriverName: normalizeText(savedRoute.assignedDriverName),
    routeDate: normalizeText(savedRoute.routeDate),
    createdAt: normalizeText(savedRoute.createdAt),
    updatedAt: normalizeText(savedRoute.updatedAt),
    createdById: normalizeText(savedRoute.createdById),
    createdByName: normalizeText(savedRoute.createdByName),
    createdByEmail: normalizeText(savedRoute.createdByEmail),
    distanceText: normalizeText(savedRoute.distanceText),
    driveTimeText: normalizeText(savedRoute.driveTimeText),
    departureTime: normalizeText(savedRoute.departureTime),
    deliveryTimeMinutes: Number(savedRoute.deliveryTimeMinutes || 0),
    totalRouteMinutes: Number(savedRoute.totalRouteMinutes || 0),
    stops: Array.isArray(savedRoute.stops)
      ? savedRoute.stops
          .map((stop) => ({
            id: normalizeText(stop?.id),
            address: normalizeText(stop?.address),
            serviceType: normalizeText(stop?.serviceType) || "small",
            createdAt: normalizeText(stop?.createdAt),
          }))
          .filter((stop) => stop.id && stop.address)
      : [],
  };
}

function sortSharedRoutes(routes) {
  return [...routes].sort(
    (firstRoute, secondRoute) =>
      new Date(secondRoute.updatedAt || 0).getTime() -
      new Date(firstRoute.updatedAt || 0).getTime(),
  );
}

function getLocalSharedRoutes() {
  try {
    const savedRoutes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    return Array.isArray(savedRoutes)
      ? sortSharedRoutes(
          savedRoutes
            .map(normalizeSharedRoute)
            .filter((route) => route.id && route.assignedDriverName),
        )
      : [];
  } catch (error) {
    console.error("Unable to load shared delivery routes:", error);
    return [];
  }
}

function saveLocalSharedRoutes(routes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch (error) {
    console.error("Unable to save shared delivery routes:", error);
  }
}

function getRoutesForDriver(routes, driverName) {
  const normalizedDriverName = normalizeText(driverName).toLowerCase();

  return sortSharedRoutes(
    routes.filter(
      (route) =>
        normalizeText(route.assignedDriverName).toLowerCase() ===
        normalizedDriverName,
    ),
  );
}

export function getSharedDeliveryRouteId(driverName, routeDate) {
  const safeDate = normalizeText(routeDate).replace(/[^a-zA-Z0-9_-]/g, "-");
  const safeDriverName = normalizeText(driverName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safeDate || "route"}__${safeDriverName || "driver"}`;
}

export function subscribeToSharedDeliveryRoutes(
  driverName,
  onRoutes,
  onError,
) {
  const normalizedDriverName = normalizeText(driverName);

  if (!normalizedDriverName) {
    onRoutes([]);
    return () => {};
  }

  if (!db) {
    onRoutes(getRoutesForDriver(getLocalSharedRoutes(), normalizedDriverName));
    return () => {};
  }

  const routesQuery = query(
    collection(db, COLLECTION_NAME),
    where("assignedDriverName", "==", normalizedDriverName),
  );

  return onSnapshot(
    routesQuery,
    (routeSnapshot) => {
      const routes = sortSharedRoutes(
        routeSnapshot.docs.map((routeDoc) =>
          normalizeSharedRoute({
            id: routeDoc.id,
            ...routeDoc.data(),
          }),
        ),
      );
      const otherLocalRoutes = getLocalSharedRoutes().filter(
        (route) =>
          normalizeText(route.assignedDriverName).toLowerCase() !==
          normalizedDriverName.toLowerCase(),
      );

      saveLocalSharedRoutes([...otherLocalRoutes, ...routes]);
      onRoutes(routes);
    },
    (error) => {
      onRoutes(
        getRoutesForDriver(getLocalSharedRoutes(), normalizedDriverName),
      );
      onError?.(error);
    },
  );
}

export async function saveSharedDeliveryRoute(route) {
  const currentRoutes = getLocalSharedRoutes();
  const now = new Date().toISOString();
  const routeToSave = normalizeSharedRoute({
    ...route,
    createdAt: route.createdAt || now,
    updatedAt: now,
  });
  const updatedRoutes = sortSharedRoutes([
    routeToSave,
    ...currentRoutes.filter((savedRoute) => savedRoute.id !== routeToSave.id),
  ]);

  if (!routeToSave.id || !routeToSave.assignedDriverName) {
    throw new Error("Choose a driver before sharing this route.");
  }

  if (routeToSave.stops.length === 0) {
    throw new Error("Add at least one stop before sharing this route.");
  }

  if (db) {
    await setDoc(
      doc(db, COLLECTION_NAME, routeToSave.id),
      routeToSave,
    );
  }

  saveLocalSharedRoutes(updatedRoutes);
  return routeToSave;
}
