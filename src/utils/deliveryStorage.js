import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
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

function deliveryIncludesDriver(delivery, driverName) {
  if (!driverName) {
    return true;
  }

  const drivers = Array.isArray(delivery.drivers) ? delivery.drivers : [];

  return delivery.driver === driverName || drivers.includes(driverName);
}

export function subscribeToDeliveries(
  onDeliveries,
  onError,
  driverName = "",
) {
  if (!db) {
    onDeliveries(
      sortDeliveries(
        getLocalDeliveries().filter((delivery) =>
          deliveryIncludesDriver(delivery, driverName),
        ),
      ),
    );
    return () => {};
  }

  if (driverName) {
    const primaryDriverMap = new Map();
    const assignedDriversMap = new Map();
    let hasPrimarySnapshot = false;
    let hasDriversSnapshot = false;

    function emitScopedDeliveries() {
      if (!hasPrimarySnapshot || !hasDriversSnapshot) {
        return;
      }

      const deliveryMap = new Map([
        ...primaryDriverMap,
        ...assignedDriversMap,
      ]);
      const deliveries = sortDeliveries(
        [...deliveryMap.values()].filter((delivery) =>
          deliveryIncludesDriver(delivery, driverName),
        ),
      );

      saveLocalDeliveries(deliveries);
      onDeliveries(deliveries);
    }

    const unsubscribePrimaryDriver = onSnapshot(
      query(
        collection(db, DELIVERIES_COLLECTION),
        where("driver", "==", driverName),
      ),
      (deliverySnapshot) => {
        primaryDriverMap.clear();
        deliverySnapshot.docs.forEach((deliveryDoc) => {
          primaryDriverMap.set(deliveryDoc.id, {
            id: deliveryDoc.id,
            ...deliveryDoc.data(),
          });
        });
        hasPrimarySnapshot = true;
        emitScopedDeliveries();
      },
      onError,
    );

    const unsubscribeAssignedDrivers = onSnapshot(
      query(
        collection(db, DELIVERIES_COLLECTION),
        where("drivers", "array-contains", driverName),
      ),
      (deliverySnapshot) => {
        assignedDriversMap.clear();
        deliverySnapshot.docs.forEach((deliveryDoc) => {
          assignedDriversMap.set(deliveryDoc.id, {
            id: deliveryDoc.id,
            ...deliveryDoc.data(),
          });
        });
        hasDriversSnapshot = true;
        emitScopedDeliveries();
      },
      onError,
    );

    return () => {
      unsubscribePrimaryDriver();
      unsubscribeAssignedDrivers();
    };
  }

  return onSnapshot(
    collection(db, DELIVERIES_COLLECTION),
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
