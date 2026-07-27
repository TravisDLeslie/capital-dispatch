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

export function subscribeToSupplierRuns(onSupplierRuns, onError) {
  if (!db) {
    onSupplierRuns(getLocalSupplierRuns());
    return () => {};
  }

  const supplierRunsQuery = query(
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

      saveLocalSupplierRuns(supplierRuns);
      onSupplierRuns(supplierRuns);
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
) {
  const currentSupplierRuns = getLocalSupplierRuns();
  const updatedAt = new Date().toISOString();
  const status = items.every((item) => item.pickedUp)
    ? "complete"
    : "open";
  const completedAt = status === "complete" ? updatedAt : null;

  const updatedSupplierRuns = currentSupplierRuns.map(
    (supplierRun) =>
      supplierRun.id === supplierRunId
        ? {
            ...supplierRun,
            items,
            status,
            updatedAt,
            completedAt,
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
      },
    );
  }

  saveLocalSupplierRuns(updatedSupplierRuns);

  return updatedSupplierRuns;
}
