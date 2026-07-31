import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-deliveries";
const DELIVERIES_COLLECTION = "deliveries";

function getLocalDeliveries() {
  try {
    const savedDeliveries = localStorage.getItem(STORAGE_KEY);

    if (!savedDeliveries) {
      return [];
    }

    const parsedDeliveries = JSON.parse(savedDeliveries);

    return Array.isArray(parsedDeliveries) ? parsedDeliveries : [];
  } catch (error) {
    console.error("Unable to load deliveries:", error);
    return [];
  }
}

function saveLocalDeliveries(deliveries) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(deliveries),
    );

    return true;
  } catch (error) {
    console.error("Unable to save deliveries:", error);
    return false;
  }
}

function sortDeliveries(deliveries) {
  return [...deliveries].sort(
    (firstDelivery, secondDelivery) =>
      new Date(secondDelivery.createdAt) -
      new Date(firstDelivery.createdAt),
  );
}

export function subscribeToDeliveries(
  onDeliveries,
  onError,
  driverName = "",
) {
  if (!db) {
    onDeliveries(getLocalDeliveries());
    return () => {};
  }

  const deliveriesQuery = driverName
    ? query(
        collection(db, DELIVERIES_COLLECTION),
        where("driver", "==", driverName),
      )
    : query(
        collection(db, DELIVERIES_COLLECTION),
        orderBy("createdAt", "desc"),
      );

  return onSnapshot(
    deliveriesQuery,
    (deliverySnapshot) => {
      const deliveries = deliverySnapshot.docs.map(
        (deliveryDoc) => ({
          id: deliveryDoc.id,
          ...deliveryDoc.data(),
        }),
      );

      const sortedDeliveries = sortDeliveries(deliveries);

      saveLocalDeliveries(sortedDeliveries);
      onDeliveries(sortedDeliveries);
    },
    onError,
  );
}

export async function addDelivery(delivery) {
  const currentDeliveries = getLocalDeliveries();
  const updatedDeliveries = sortDeliveries([
    delivery,
    ...currentDeliveries,
  ]);

  if (db) {
    await setDoc(
      doc(db, DELIVERIES_COLLECTION, delivery.id),
      delivery,
    );
  }

  saveLocalDeliveries(updatedDeliveries);

  return updatedDeliveries;
}

export async function updateDelivery(
  deliveryId,
  deliveryUpdates,
) {
  const currentDeliveries = getLocalDeliveries();
  const updatedAt = new Date().toISOString();
  const updates = {
    ...deliveryUpdates,
    updatedAt,
  };

  const updatedDeliveries = currentDeliveries.map((delivery) =>
    delivery.id === deliveryId
      ? {
          ...delivery,
          ...updates,
        }
      : delivery,
  );

  if (db) {
    await updateDoc(
      doc(db, DELIVERIES_COLLECTION, deliveryId),
      updates,
    );
  }

  saveLocalDeliveries(updatedDeliveries);

  return updatedDeliveries;
}

export async function deleteDelivery(deliveryId) {
  const currentDeliveries = getLocalDeliveries();
  const updatedDeliveries = currentDeliveries.filter(
    (delivery) => delivery.id !== deliveryId,
  );

  if (db) {
    await deleteDoc(doc(db, DELIVERIES_COLLECTION, deliveryId));
  }

  saveLocalDeliveries(updatedDeliveries);

  return updatedDeliveries;
}
