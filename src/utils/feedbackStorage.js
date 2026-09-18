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

const COLLECTION_NAME = "appFeedback";
const LOCAL_STORAGE_KEY = "dispatch-cl-app-feedback";

function sortNewestFirst(entries) {
  return [...entries].sort((firstEntry, secondEntry) =>
    String(secondEntry.createdAt || "").localeCompare(
      String(firstEntry.createdAt || ""),
    ),
  );
}

function getStoredFeedbackEntries() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch (error) {
    console.error("Unable to read feedback entries:", error);
    return [];
  }
}

function saveStoredFeedbackEntries(entries) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortNewestFirst(entries)));
}

export function subscribeToFeedbackEntries(
  userId,
  canViewAll,
  onFeedbackEntries,
  onError,
) {
  if (!userId) {
    onFeedbackEntries([]);
    return () => {};
  }

  if (!db) {
    const storedEntries = getStoredFeedbackEntries();
    onFeedbackEntries(
      sortNewestFirst(
        canViewAll
          ? storedEntries
          : storedEntries.filter((entry) => entry.userId === userId),
      ),
    );
    return () => {};
  }

  const feedbackQuery = canViewAll
    ? query(collection(db, COLLECTION_NAME))
    : query(collection(db, COLLECTION_NAME), where("userId", "==", userId));

  return onSnapshot(
    feedbackQuery,
    (snapshot) => {
      const entries = snapshot.docs.map((feedbackDoc) => ({
        id: feedbackDoc.id,
        ...feedbackDoc.data(),
      }));

      onFeedbackEntries(sortNewestFirst(entries));
    },
    onError,
  );
}

export async function saveFeedbackEntry(feedbackEntry) {
  const storedEntries = getStoredFeedbackEntries();
  const nextEntry = {
    ...feedbackEntry,
    updatedAt: feedbackEntry.updatedAt || new Date().toISOString(),
  };

  if (db) {
    await setDoc(doc(db, COLLECTION_NAME, nextEntry.id), nextEntry, {
      merge: true,
    });
  }

  const updatedEntries = [
    nextEntry,
    ...storedEntries.filter((entry) => entry.id !== nextEntry.id),
  ];
  saveStoredFeedbackEntries(updatedEntries);
  return sortNewestFirst(updatedEntries);
}

export async function deleteFeedbackEntry(feedbackEntryId) {
  const storedEntries = getStoredFeedbackEntries();

  if (db) {
    await deleteDoc(doc(db, COLLECTION_NAME, feedbackEntryId));
  }

  const updatedEntries = storedEntries.filter(
    (entry) => entry.id !== feedbackEntryId,
  );
  saveStoredFeedbackEntries(updatedEntries);
  return sortNewestFirst(updatedEntries);
}
