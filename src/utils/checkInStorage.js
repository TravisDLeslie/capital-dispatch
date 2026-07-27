import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-check-ins";
const CHECK_INS_COLLECTION = "checkIns";

function getLocalCheckIns() {
  try {
    const savedCheckIns = localStorage.getItem(STORAGE_KEY);

    if (!savedCheckIns) {
      return [];
    }

    const parsedCheckIns = JSON.parse(savedCheckIns);

    return Array.isArray(parsedCheckIns)
      ? parsedCheckIns
      : [];
  } catch (error) {
    console.error("Unable to load check-ins:", error);
    return [];
  }
}

function saveLocalCheckIns(checkIns) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(checkIns),
    );

    return true;
  } catch (error) {
    console.error("Unable to save check-ins:", error);
    return false;
  }
}

export async function getCheckIns() {
  if (!db) {
    return getLocalCheckIns();
  }

  const checkInsQuery = query(
    collection(db, CHECK_INS_COLLECTION),
    orderBy("checkedInAt", "desc"),
  );

  const checkInSnapshot = await getDocs(checkInsQuery);
  const checkIns = checkInSnapshot.docs.map((checkInDoc) => ({
    id: checkInDoc.id,
    ...checkInDoc.data(),
  }));

  saveLocalCheckIns(checkIns);

  return checkIns;
}

export function subscribeToCheckIns(onCheckIns, onError) {
  if (!db) {
    onCheckIns(getLocalCheckIns());
    return () => {};
  }

  const checkInsQuery = query(
    collection(db, CHECK_INS_COLLECTION),
    orderBy("checkedInAt", "desc"),
  );

  return onSnapshot(
    checkInsQuery,
    (checkInSnapshot) => {
      const checkIns = checkInSnapshot.docs.map((checkInDoc) => ({
        id: checkInDoc.id,
        ...checkInDoc.data(),
      }));

      saveLocalCheckIns(checkIns);
      onCheckIns(checkIns);
    },
    onError,
  );
}

export function saveCheckIns(checkIns) {
  return saveLocalCheckIns(checkIns);
}

export async function addCheckIn(checkIn) {
  const currentCheckIns = getLocalCheckIns();

  const updatedCheckIns = [
    checkIn,
    ...currentCheckIns,
  ];

  if (db) {
    await setDoc(
      doc(db, CHECK_INS_COLLECTION, checkIn.id),
      checkIn,
    );
  }

  saveLocalCheckIns(updatedCheckIns);

  return updatedCheckIns;
}

export async function deleteCheckIn(checkInId) {
  const currentCheckIns = getLocalCheckIns();

  const updatedCheckIns = currentCheckIns.filter(
    (checkIn) => checkIn.id !== checkInId,
  );

  if (db) {
    await deleteDoc(
      doc(db, CHECK_INS_COLLECTION, checkInId),
    );
  }

  saveLocalCheckIns(updatedCheckIns);

  return updatedCheckIns;
}

export async function updateCheckInAssignment(
  checkInId,
  orderAssignment,
) {
  const currentCheckIns = getLocalCheckIns();
  const assignedAt = new Date().toISOString();

  const updatedCheckIns = currentCheckIns.map((checkIn) => {
    if (checkIn.id !== checkInId) {
      return checkIn;
    }

    const updatedCheckIn = {
      ...checkIn,
      orderAssignment,
      assignedAt,
    };

    delete updatedCheckIn.customer;
    delete updatedCheckIn.customerLinkedAt;

    return updatedCheckIn;
  });

  if (db) {
    await updateDoc(
      doc(db, CHECK_INS_COLLECTION, checkInId),
      {
        orderAssignment,
        assignedAt,
        customer: deleteField(),
        customerLinkedAt: deleteField(),
      },
    );
  }

  saveLocalCheckIns(updatedCheckIns);

  return updatedCheckIns;
}
