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
const PENDING_DELETIONS_KEY = "dispatch-cl-ops-pending-delivery-deletions";
const COLLECTION_NAME = "dispatchOpsDailyDeliveries";
let pendingDeletionFlush = null;

function normalizeText(value) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return String(
      value.formatted_address || value.address || value.text || "",
    );
  }

  return "";
}

function normalizeDateValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "";
    }
  }

  if (Number.isFinite(Number(value?.seconds))) {
    return new Date(Number(value.seconds) * 1000).toISOString();
  }

  return "";
}

function normalizeDelivery(delivery) {
  const savedDelivery =
    delivery && typeof delivery === "object" ? delivery : {};

  return {
    ...savedDelivery,
    id: normalizeText(savedDelivery.id),
    dateKey: normalizeText(savedDelivery.dateKey),
    name: normalizeText(savedDelivery.name),
    address: normalizeText(savedDelivery.address),
    orderNumber: normalizeText(savedDelivery.orderNumber),
    phoneNumber: normalizeText(savedDelivery.phoneNumber),
    spruceNumber: normalizeText(savedDelivery.spruceNumber),
    driverName: normalizeText(savedDelivery.driverName),
    status: normalizeText(savedDelivery.status),
    distanceMeters: Number(savedDelivery.distanceMeters || 0),
    distanceText: normalizeText(savedDelivery.distanceText),
    durationSeconds: Number(savedDelivery.durationSeconds || 0),
    durationText: normalizeText(savedDelivery.durationText),
    createdAt: normalizeDateValue(savedDelivery.createdAt),
    updatedAt: normalizeDateValue(savedDelivery.updatedAt),
    deliveryLeftAt: normalizeDateValue(savedDelivery.deliveryLeftAt),
  };
}

function getLocalDeliveries() {
  try {
    const savedDeliveries = localStorage.getItem(STORAGE_KEY);
    const parsedDeliveries = savedDeliveries
      ? JSON.parse(savedDeliveries)
      : [];

    return Array.isArray(parsedDeliveries)
      ? parsedDeliveries.map(normalizeDelivery).filter((delivery) => delivery.id)
      : [];
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

function getPendingDeletionIds() {
  try {
    const savedIds = localStorage.getItem(PENDING_DELETIONS_KEY);
    const parsedIds = savedIds ? JSON.parse(savedIds) : [];

    return Array.isArray(parsedIds) ? parsedIds.filter(Boolean) : [];
  } catch (error) {
    console.error("Unable to load pending delivery deletions:", error);
    return [];
  }
}

function savePendingDeletionIds(deliveryIds) {
  try {
    localStorage.setItem(
      PENDING_DELETIONS_KEY,
      JSON.stringify(Array.from(new Set(deliveryIds.filter(Boolean)))),
    );
  } catch (error) {
    console.error("Unable to save pending delivery deletions:", error);
  }
}

function addPendingDeletion(deliveryId) {
  savePendingDeletionIds([...getPendingDeletionIds(), deliveryId]);
}

function removePendingDeletion(deliveryId) {
  savePendingDeletionIds(
    getPendingDeletionIds().filter((pendingId) => pendingId !== deliveryId),
  );
}

function flushPendingDeletions() {
  if (!db || pendingDeletionFlush) {
    return pendingDeletionFlush;
  }

  const pendingIds = getPendingDeletionIds();

  if (pendingIds.length === 0) {
    return null;
  }

  pendingDeletionFlush = Promise.allSettled(
    pendingIds.map(async (deliveryId) => {
      await deleteDoc(doc(db, COLLECTION_NAME, deliveryId));
      return deliveryId;
    }),
  )
    .then((results) => {
      const deletedIds = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

      if (deletedIds.length > 0) {
        savePendingDeletionIds(
          getPendingDeletionIds().filter(
            (pendingId) => !deletedIds.includes(pendingId),
          ),
        );
      }
    })
    .finally(() => {
      pendingDeletionFlush = null;
    });

  return pendingDeletionFlush;
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
      const pendingDeletionIds = new Set(getPendingDeletionIds());
      const deliveries = sortDeliveries(
        deliverySnapshot.docs
          .filter((deliveryDoc) => !pendingDeletionIds.has(deliveryDoc.id))
          .map((deliveryDoc) =>
            normalizeDelivery({
              ...deliveryDoc.data(),
              id: deliveryDoc.id,
            }),
          ),
      );
      const otherLocalDeliveries = getLocalDeliveries().filter(
        (delivery) => delivery.dateKey !== dateKey,
      );

      saveLocalDeliveries([...otherLocalDeliveries, ...deliveries]);
      onDeliveries(deliveries);
      flushPendingDeletions();
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
  const deliveryToSave = normalizeDelivery({
    ...delivery,
    createdAt: delivery.createdAt || now,
    updatedAt: now,
  });
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
  saveLocalDeliveries(updatedDeliveries);
  addPendingDeletion(deliveryId);

  if (db) {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, deliveryId));
      removePendingDeletion(deliveryId);
    } catch (error) {
      console.error("Unable to sync Dispatch Ops delivery deletion:", error);
      return {
        deliveries: updatedDeliveries,
        syncPending: true,
      };
    }
  }

  return {
    deliveries: updatedDeliveries,
    syncPending: false,
  };
}
