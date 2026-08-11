import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-sales-orders";
const SALES_ORDERS_COLLECTION = "salesOrders";

function getLocalSalesOrders() {
  try {
    const savedOrders = localStorage.getItem(STORAGE_KEY);

    if (!savedOrders) {
      return [];
    }

    const parsedOrders = JSON.parse(savedOrders);

    return Array.isArray(parsedOrders) ? parsedOrders : [];
  } catch (error) {
    console.error("Unable to load sales orders:", error);
    return [];
  }
}

function saveLocalSalesOrders(orders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));

    return true;
  } catch (error) {
    console.error("Unable to save sales orders:", error);
    return false;
  }
}

function sortSalesOrders(orders) {
  return [...orders].sort(
    (firstOrder, secondOrder) =>
      new Date(secondOrder.createdAt || secondOrder.updatedAt || 0) -
      new Date(firstOrder.createdAt || firstOrder.updatedAt || 0),
  );
}

export function subscribeToSalesOrders(onOrders, onError) {
  if (!db) {
    onOrders(getLocalSalesOrders());
    return () => {};
  }

  const ordersQuery = query(
    collection(db, SALES_ORDERS_COLLECTION),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    ordersQuery,
    (orderSnapshot) => {
      const orders = orderSnapshot.docs.map((orderDoc) => ({
        id: orderDoc.id,
        ...orderDoc.data(),
      }));
      const sortedOrders = sortSalesOrders(orders);

      saveLocalSalesOrders(sortedOrders);
      onOrders(sortedOrders);
    },
    onError,
  );
}

export async function saveSalesOrder(order) {
  const currentOrders = getLocalSalesOrders();
  const existingOrder = currentOrders.find(
    (currentOrder) => currentOrder.id === order.id,
  );
  const now = new Date().toISOString();
  const savedOrder = {
    ...existingOrder,
    ...order,
    createdAt: existingOrder?.createdAt || order.createdAt || now,
    updatedAt: now,
  };
  const updatedOrders = sortSalesOrders([
    savedOrder,
    ...currentOrders.filter(
      (currentOrder) => currentOrder.id !== savedOrder.id,
    ),
  ]);

  if (db) {
    await setDoc(
      doc(db, SALES_ORDERS_COLLECTION, savedOrder.id),
      savedOrder,
    );
  }

  saveLocalSalesOrders(updatedOrders);

  return updatedOrders;
}

export async function updateSalesOrder(orderId, updates) {
  const currentOrders = getLocalSalesOrders();
  const updatedAt = new Date().toISOString();
  const savedUpdates = {
    ...updates,
    updatedAt,
  };
  const updatedOrders = sortSalesOrders(
    currentOrders.map((order) =>
      order.id === orderId
        ? {
            ...order,
            ...savedUpdates,
          }
        : order,
    ),
  );

  if (db) {
    await updateDoc(
      doc(db, SALES_ORDERS_COLLECTION, orderId),
      savedUpdates,
    );
  }

  saveLocalSalesOrders(updatedOrders);

  return updatedOrders;
}
