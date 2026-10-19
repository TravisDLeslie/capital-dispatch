import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-ops-daily-deliveries";
const COLLECTION_NAME = "dispatchOpsDailyDeliveries";

function getLocalDeliveries() {
  try {
    const savedDeliveries = localStorage.getItem(STORAGE_KEY);
    const parsedDeliveries = savedDeliveries
      ? JSON.parse(savedDeliveries)
      : [];

    return Array.isArray(parsedDeliveries) ? parsedDeliveries : [];
  } catch (error) {
    console.error("Unable to load Dispatch Ops deliveries:", error);
    return [];
  }
}

function saveLocalDeliveries(deliveries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deliveries));
  } catch (error) {
    console.error("Unable to save Dispatch Ops deliveries:", error);
  }
}

function sortDeliveries(deliveries) {
  return [...deliveries].sort(
    (firstDelivery, secondDelivery) =>
      new Date(firstDelivery.createdAt || 0).getTime() -
      new Date(secondDelivery.createdAt || 0).getTime(),
  );
}

function getDeliveriesForDate(deliveries, dateKey) {
  return sortDeliveries(
    deliveries.filter((delivery) => delivery.dateKey === dateKey),
  );
}

export function subscribeToDispatchOpsDeliveries(
  dateKey,
  onDeliveries,
  onError,
) {
  if (!db) {
    onDeliveries(getDeliveriesForDate(getLocalDeliveries(), dateKey));
    return () => {};
  }

  const deliveriesQuery = query(
    collection(db, COLLECTION_NAME),
    where("dateKey", "==", dateKey),
  );

  return onSnapshot(
    deliveriesQuery,
    (deliverySnapshot) => {
      const deliveries = sortDeliveries(
        deliverySnapshot.docs.map((deliveryDoc) => ({
          id: deliveryDoc.id,
          ...deliveryDoc.data(),
        })),
      );
      const otherLocalDeliveries = getLocalDeliveries().filter(
        (delivery) => delivery.dateKey !== dateKey,
      );

      saveLocalDeliveries([...otherLocalDeliveries, ...deliveries]);
      onDeliveries(deliveries);
    },
    (error) => {
      onDeliveries(getDeliveriesForDate(getLocalDeliveries(), dateKey));
      onError(error);
    },
  );
}

export async function saveDispatchOpsDelivery(delivery) {
  const currentDeliveries = getLocalDeliveries();
  const now = new Date().toISOString();
  const deliveryToSave = {
    ...delivery,
    createdAt: delivery.createdAt || now,
    updatedAt: now,
  };
  const updatedDeliveries = sortDeliveries([
    ...currentDeliveries.filter(
      (currentDelivery) => currentDelivery.id !== deliveryToSave.id,
    ),
    deliveryToSave,
  ]);

  // Keep the form usable offline and while newly published Firestore rules
  // are still propagating. The shared write is attempted immediately after.
  saveLocalDeliveries(updatedDeliveries);

  if (db) {
    try {
      await setDoc(
        doc(db, COLLECTION_NAME, deliveryToSave.id),
        deliveryToSave,
      );
    } catch (error) {
      console.error("Unable to sync Dispatch Ops delivery:", error);
      return {
        deliveries: getDeliveriesForDate(
          updatedDeliveries,
          deliveryToSave.dateKey,
        ),
        syncPending: true,
      };
    }
  }

  return {
    deliveries: getDeliveriesForDate(
      updatedDeliveries,
      deliveryToSave.dateKey,
    ),
    syncPending: false,
  };
}

export async function deleteDispatchOpsDelivery(deliveryId) {
  const currentDeliveries = getLocalDeliveries();
  const updatedDeliveries = currentDeliveries.filter(
    (delivery) => delivery.id !== deliveryId,
  );

  if (db) {
    await deleteDoc(doc(db, COLLECTION_NAME, deliveryId));
  }

  saveLocalDeliveries(updatedDeliveries);
  return updatedDeliveries;
}
