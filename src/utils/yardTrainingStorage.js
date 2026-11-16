import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-yard-training-records";
const COLLECTION = "yardTrainingRecords";

function readLocalRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to load yard training records:", error);
    return [];
  }
}

function writeLocalRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error("Unable to save yard training records:", error);
  }
}

export function subscribeToYardTrainingRecords(onRecords, onError) {
  if (!db) {
    onRecords(readLocalRecords());
    return () => {};
  }

  return onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      const records = snapshot.docs.map((recordDoc) => ({
        id: recordDoc.id,
        ...recordDoc.data(),
      }));
      writeLocalRecords(records);
      onRecords(records);
    },
    (error) => {
      onRecords(readLocalRecords());
      onError?.(error);
    },
  );
}

export async function saveYardTrainingRecord(record) {
  const records = readLocalRecords();
  const nextRecords = [
    record,
    ...records.filter((savedRecord) => savedRecord.id !== record.id),
  ];

  writeLocalRecords(nextRecords);

  if (db) {
    await setDoc(doc(db, COLLECTION, record.id), record, { merge: true });
  }

  return record;
}
