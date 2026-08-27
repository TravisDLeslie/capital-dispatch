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

const STORAGE_KEY = "dispatch-cl-supplier-runs";
const SUPPLIER_RUNS_COLLECTION = "supplierRuns";

function getLocalSupplierRuns() {
  try {
    const savedRuns = localStorage.getItem(STORAGE_KEY);

    if (!savedRuns) {
      return [];
    }

    const parsedRuns = JSON.parse(savedRuns);

    return Array.isArray(parsedRuns) ? parsedRuns : [];
  } catch (error) {
    console.error("Unable to load supplier runs:", error);
    return [];
  }
}

function saveLocalSupplierRuns(supplierRuns) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(supplierRuns),
    );

    return true;
  } catch (error) {
    console.error("Unable to save supplier runs:", error);
    return false;
  }
}

function sortSupplierRuns(supplierRuns) {
  return [...supplierRuns].sort(
    (firstRun, secondRun) =>
      new Date(secondRun.createdAt) -
      new Date(firstRun.createdAt),
  );
}

/**
 * @param {(supplierRuns: any[]) => void} onSupplierRuns
 * @param {(error: Error) => void} onError
 * @param {string | string[]} [driverName]
 */
export function subscribeToSupplierRuns(
  onSupplierRuns,
  onError,
  driverName = "",
) {
  if (!db) {
    onSupplierRuns(getLocalSupplierRuns());
    return () => {};
  }

  const driverNames = Array.isArray(driverName)
    ? [...new Set(driverName.filter(Boolean))]
    : driverName
      ? [driverName]
      : [];
  const supplierRunsQuery = driverNames.length > 1
    ? query(
        collection(db, SUPPLIER_RUNS_COLLECTION),
        where("driver", "in", driverNames.slice(0, 10)),
      )
    : driverNames.length === 1
    ? query(
        collection(db, SUPPLIER_RUNS_COLLECTION),
        where("driver", "==", driverNames[0]),
      )
    : query(
        collection(db, SUPPLIER_RUNS_COLLECTION),
        orderBy("createdAt", "desc"),
      );

  return onSnapshot(
    supplierRunsQuery,
    (supplierRunSnapshot) => {
      const supplierRuns = supplierRunSnapshot.docs.map(
        (supplierRunDoc) => ({
          id: supplierRunDoc.id,
          ...supplierRunDoc.data(),
        }),
      );

      const sortedSupplierRuns = sortSupplierRuns(supplierRuns);

      saveLocalSupplierRuns(sortedSupplierRuns);
      onSupplierRuns(sortedSupplierRuns);
    },
    onError,
  );
}

export async function addSupplierRun(supplierRun) {
  const currentSupplierRuns = getLocalSupplierRuns();
  const updatedSupplierRuns = sortSupplierRuns([
    supplierRun,
    ...currentSupplierRuns,
  ]);

  if (db) {
    await setDoc(
      doc(
        db,
        SUPPLIER_RUNS_COLLECTION,
        supplierRun.id,
      ),
      supplierRun,
    );
  }

  saveLocalSupplierRuns(updatedSupplierRuns);

  return updatedSupplierRuns;
}

export async function updateSupplierRunItems(
  supplierRunId,
  items,
  supplierRunUpdates = {},
) {
  const currentSupplierRuns = getLocalSupplierRuns();
  const currentSupplierRun = currentSupplierRuns.find(
    (supplierRun) => supplierRun.id === supplierRunId,
  );
  const updatedAt = new Date().toISOString();
  const usesStopWorkflow =
    Number(currentSupplierRun?.stopWorkflowVersion || 0) >= 1;
  const allItemsPickedUp = items.every((item) => item.pickedUp);
  const status = usesStopWorkflow
    ? currentSupplierRun?.stopCompletedAt
      ? "complete"
      : "open"
    : allItemsPickedUp
      ? "complete"
      : "open";
  const completedAt =
    status === "complete"
      ? currentSupplierRun?.completedAt || updatedAt
      : null;

  const updatedSupplierRuns = currentSupplierRuns.map(
    (supplierRun) =>
      supplierRun.id === supplierRunId
          ? {
              ...supplierRun,
              items,
              status,
              updatedAt,
              completedAt,
              ...supplierRunUpdates,
            }
          : supplierRun,
  );

  if (db) {
    await updateDoc(
      doc(db, SUPPLIER_RUNS_COLLECTION, supplierRunId),
      {
        items,
        status,
        updatedAt,
        completedAt,
        ...supplierRunUpdates,
      },
    );
  }

  saveLocalSupplierRuns(updatedSupplierRuns);

  return updatedSupplierRuns;
}

export async function updateSupplierRun(
  supplierRunId,
  supplierRunUpdates,
) {
  const currentSupplierRuns = getLocalSupplierRuns();
  const updatedAt = new Date().toISOString();
  const updates = {
    ...supplierRunUpdates,
    updatedAt,
  };
  const updatedSupplierRuns = currentSupplierRuns.map((supplierRun) =>
    supplierRun.id === supplierRunId
      ? {
          ...supplierRun,
          ...updates,
        }
      : supplierRun,
  );

  if (db) {
    await updateDoc(
      doc(db, SUPPLIER_RUNS_COLLECTION, supplierRunId),
      updates,
    );
  }

  saveLocalSupplierRuns(updatedSupplierRuns);

  return updatedSupplierRuns;
}

export async function updateSupplierRunsBulk(supplierRunUpdates) {
  const currentSupplierRuns = getLocalSupplierRuns();
  const updatedAt = new Date().toISOString();
  const normalizedUpdates = (Array.isArray(supplierRunUpdates)
    ? supplierRunUpdates
    : []
  )
    .filter((supplierRunUpdate) => supplierRunUpdate?.id)
    .map((supplierRunUpdate) => ({
      ...supplierRunUpdate,
      updatedAt,
    }));
  const updatesById = new Map(
    normalizedUpdates.map((supplierRunUpdate) => [
      supplierRunUpdate.id,
      supplierRunUpdate,
    ]),
  );
  const updatedSupplierRuns = currentSupplierRuns.map((supplierRun) => {
    const updates = updatesById.get(supplierRun.id);

    return updates
      ? {
          ...supplierRun,
          ...updates,
        }
      : supplierRun;
  });

  if (db) {
    await Promise.all(
      normalizedUpdates.map((supplierRunUpdate) => {
        const { id, ...updates } = supplierRunUpdate;

        return updateDoc(
          doc(db, SUPPLIER_RUNS_COLLECTION, id),
          updates,
        );
      }),
    );
  }

  saveLocalSupplierRuns(updatedSupplierRuns);

  return updatedSupplierRuns;
}

export async function deleteSupplierRun(supplierRunId) {
  const currentSupplierRuns = getLocalSupplierRuns();

  const updatedSupplierRuns = currentSupplierRuns.filter(
    (supplierRun) => supplierRun.id !== supplierRunId,
  );

  if (db) {
    await deleteDoc(
      doc(db, SUPPLIER_RUNS_COLLECTION, supplierRunId),
    );
  }

  saveLocalSupplierRuns(updatedSupplierRuns);

  return updatedSupplierRuns;
}
