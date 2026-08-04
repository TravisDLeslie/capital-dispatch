import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-south-route-orders";
const ROUTE_ORDERS_COLLECTION = "southRouteOrders";

function getLocalRouteOrders() {
  try {
    const savedRouteOrders = localStorage.getItem(STORAGE_KEY);

    if (!savedRouteOrders) {
      return [];
    }

    const parsedRouteOrders = JSON.parse(savedRouteOrders);

    return Array.isArray(parsedRouteOrders) ? parsedRouteOrders : [];
  } catch (error) {
    console.error("Unable to load South route orders:", error);
    return [];
  }
}

function saveLocalRouteOrders(routeOrders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routeOrders));

    return true;
  } catch (error) {
    console.error("Unable to save South route orders:", error);
    return false;
  }
}

function sortRouteOrders(routeOrders) {
  return [...routeOrders].sort((firstOrder, secondOrder) =>
    String(firstOrder.dateKey || "").localeCompare(
      String(secondOrder.dateKey || ""),
    ),
  );
}

export function getSouthRouteOrderId(driver, dateKey) {
  return `${String(dateKey || "no-date").replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  )}__${String(driver || "Unassigned Driver").replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  )}`;
}

export function subscribeToSouthRouteOrders(
  onRouteOrders,
  onError,
  options = {},
) {
  if (!db) {
    onRouteOrders(getLocalRouteOrders());
    return () => {};
  }

  const constraints = options.driverName
    ? [where("driver", "==", options.driverName)]
    : [orderBy("updatedAt", "desc")];

  const routeOrdersQuery = query(
    collection(db, ROUTE_ORDERS_COLLECTION),
    ...constraints,
  );

  return onSnapshot(
    routeOrdersQuery,
    (routeOrdersSnapshot) => {
      const routeOrders = routeOrdersSnapshot.docs.map((routeOrderDoc) => ({
        id: routeOrderDoc.id,
        ...routeOrderDoc.data(),
      }));
      const sortedRouteOrders = sortRouteOrders(routeOrders);

      saveLocalRouteOrders(sortedRouteOrders);
      onRouteOrders(sortedRouteOrders);
    },
    onError,
  );
}

export async function saveSouthRouteOrder(routeOrder) {
  const currentRouteOrders = getLocalRouteOrders();
  const updatedAt = new Date().toISOString();
  const order = {
    ...routeOrder,
    vendorOrder: Array.isArray(routeOrder.vendorOrder)
      ? routeOrder.vendorOrder
      : [],
    updatedAt,
  };
  const updatedRouteOrders = sortRouteOrders([
    order,
    ...currentRouteOrders.filter(
      (savedRouteOrder) => savedRouteOrder.id !== order.id,
    ),
  ]);

  if (db) {
    await setDoc(doc(db, ROUTE_ORDERS_COLLECTION, order.id), order);
  }

  saveLocalRouteOrders(updatedRouteOrders);

  return updatedRouteOrders;
}
