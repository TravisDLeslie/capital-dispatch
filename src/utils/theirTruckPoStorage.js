import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-their-truck-pos";
const THEIR_TRUCK_POS_COLLECTION = "theirTruckPOs";

function getLocalTheirTruckPOs() {
  try {
    const savedPOs = localStorage.getItem(STORAGE_KEY);

    if (!savedPOs) {
      return [];
    }

    const parsedPOs = JSON.parse(savedPOs);

    return Array.isArray(parsedPOs) ? parsedPOs : [];
  } catch (error) {
    console.error("Unable to load their truck POs:", error);
    return [];
  }
}

function saveLocalTheirTruckPOs(theirTruckPOs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theirTruckPOs));
    return true;
  } catch (error) {
    console.error("Unable to save their truck POs:", error);
    return false;
  }
}

function sortTheirTruckPOs(theirTruckPOs) {
  return [...theirTruckPOs].sort((firstPO, secondPO) =>
    String(firstPO.deliveryDate || "9999-99-99").localeCompare(
      String(secondPO.deliveryDate || "9999-99-99"),
    ),
  );
}

export function subscribeToTheirTruckPOs(onTheirTruckPOs, onError) {
  if (!db) {
    onTheirTruckPOs(getLocalTheirTruckPOs());
    return () => {};
  }

  const theirTruckPOsQuery = query(
    collection(db, THEIR_TRUCK_POS_COLLECTION),
    orderBy("deliveryDate", "asc"),
  );

  return onSnapshot(
    theirTruckPOsQuery,
    (theirTruckPOSnapshot) => {
      const theirTruckPOs = theirTruckPOSnapshot.docs.map(
        (theirTruckPODoc) => ({
          id: theirTruckPODoc.id,
          ...theirTruckPODoc.data(),
        }),
      );
      const sortedTheirTruckPOs = sortTheirTruckPOs(theirTruckPOs);

      saveLocalTheirTruckPOs(sortedTheirTruckPOs);
      onTheirTruckPOs(sortedTheirTruckPOs);
    },
    onError,
  );
}

export async function saveTheirTruckPO(theirTruckPO) {
  const currentTheirTruckPOs = getLocalTheirTruckPOs();
  const existingPO = currentTheirTruckPOs.find(
    (currentPO) => currentPO.id === theirTruckPO.id,
  );
  const now = new Date().toISOString();
  const savedTheirTruckPO = {
    ...existingPO,
    ...theirTruckPO,
    createdAt: existingPO?.createdAt || theirTruckPO.createdAt || now,
    updatedAt: now,
  };
  const updatedTheirTruckPOs = sortTheirTruckPOs([
    savedTheirTruckPO,
    ...currentTheirTruckPOs.filter(
      (currentPO) => currentPO.id !== savedTheirTruckPO.id,
    ),
  ]);

  if (db) {
    await setDoc(
      doc(db, THEIR_TRUCK_POS_COLLECTION, savedTheirTruckPO.id),
      savedTheirTruckPO,
    );
  }

  saveLocalTheirTruckPOs(updatedTheirTruckPOs);

  return updatedTheirTruckPOs;
}

export async function deleteTheirTruckPO(theirTruckPOId) {
  const currentTheirTruckPOs = getLocalTheirTruckPOs();
  const updatedTheirTruckPOs = currentTheirTruckPOs.filter(
    (currentPO) => currentPO.id !== theirTruckPOId,
  );

  if (db) {
    await deleteDoc(doc(db, THEIR_TRUCK_POS_COLLECTION, theirTruckPOId));
  }

  saveLocalTheirTruckPOs(updatedTheirTruckPOs);

  return updatedTheirTruckPOs;
}
