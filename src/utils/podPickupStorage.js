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

const STORAGE_KEY = "dispatch-cl-pod-pickups";
const POD_PICKUPS_COLLECTION = "podPickups";

function getLocalPodPickups() {
  try {
    const savedPickups = localStorage.getItem(STORAGE_KEY);

    if (!savedPickups) {
      return [];
    }

    const parsedPickups = JSON.parse(savedPickups);

    return Array.isArray(parsedPickups) ? parsedPickups : [];
  } catch (error) {
    console.error("Unable to load POD pickups:", error);
    return [];
  }
}

function saveLocalPodPickups(podPickups) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(podPickups));
    return true;
  } catch (error) {
    console.error("Unable to save POD pickups:", error);
    return false;
  }
}

function sortPodPickups(podPickups) {
  return [...podPickups].sort((firstPickup, secondPickup) =>
    String(firstPickup.podDate || "9999-99-99").localeCompare(
      String(secondPickup.podDate || "9999-99-99"),
    ),
  );
}

export function subscribeToPodPickups(onPodPickups, onError) {
  if (!db) {
    onPodPickups(getLocalPodPickups());
    return () => {};
  }

  const podPickupsQuery = query(
    collection(db, POD_PICKUPS_COLLECTION),
    orderBy("podDate", "asc"),
  );

  return onSnapshot(
    podPickupsQuery,
    (podPickupSnapshot) => {
      const podPickups = podPickupSnapshot.docs.map((podPickupDoc) => ({
        id: podPickupDoc.id,
        ...podPickupDoc.data(),
      }));
      const sortedPodPickups = sortPodPickups(podPickups);

      saveLocalPodPickups(sortedPodPickups);
      onPodPickups(sortedPodPickups);
    },
    onError,
  );
}

export async function savePodPickup(podPickup) {
  const currentPodPickups = getLocalPodPickups();
  const existingPickup = currentPodPickups.find(
    (currentPickup) => currentPickup.id === podPickup.id,
  );
  const now = new Date().toISOString();
  const savedPickup = {
    ...existingPickup,
    ...podPickup,
    createdAt: existingPickup?.createdAt || podPickup.createdAt || now,
    updatedAt: now,
  };
  const updatedPodPickups = sortPodPickups([
    savedPickup,
    ...currentPodPickups.filter(
      (currentPickup) => currentPickup.id !== savedPickup.id,
    ),
  ]);

  if (db) {
    await setDoc(
      doc(db, POD_PICKUPS_COLLECTION, savedPickup.id),
      savedPickup,
    );
  }

  saveLocalPodPickups(updatedPodPickups);

  return updatedPodPickups;
}

export async function deletePodPickup(podPickupId) {
  const currentPodPickups = getLocalPodPickups();
  const updatedPodPickups = currentPodPickups.filter(
    (currentPickup) => currentPickup.id !== podPickupId,
  );

  if (db) {
    await deleteDoc(doc(db, POD_PICKUPS_COLLECTION, podPickupId));
  }

  saveLocalPodPickups(updatedPodPickups);

  return updatedPodPickups;
}
