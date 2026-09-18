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

const COLLECTION_NAME = "internalMessages";
const LOCAL_STORAGE_KEY = "dispatch-cl-internal-messages";

function sortNewestFirst(messages) {
  return [...messages].sort((firstMessage, secondMessage) =>
    String(secondMessage.createdAt || "").localeCompare(
      String(firstMessage.createdAt || ""),
    ),
  );
}

function getStoredMessages() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch (error) {
    console.error("Unable to read internal messages:", error);
    return [];
  }
}

function saveStoredMessages(messages) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortNewestFirst(messages)));
}

export function subscribeToInternalMessages(
  userId,
  canViewAll,
  onMessages,
  onError,
) {
  if (!userId) {
    onMessages([]);
    return () => {};
  }

  if (!db) {
    const storedMessages = getStoredMessages();
    onMessages(
      sortNewestFirst(
        canViewAll
          ? storedMessages
          : storedMessages.filter((message) => message.recipientId === userId),
      ),
    );
    return () => {};
  }

  const messagesQuery = canViewAll
    ? query(collection(db, COLLECTION_NAME))
    : query(collection(db, COLLECTION_NAME), where("recipientId", "==", userId));

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs.map((messageDoc) => ({
        id: messageDoc.id,
        ...messageDoc.data(),
      }));

      onMessages(sortNewestFirst(messages));
    },
    onError,
  );
}

export async function saveInternalMessage(message) {
  const storedMessages = getStoredMessages();
  const nextMessage = {
    ...message,
    updatedAt: message.updatedAt || new Date().toISOString(),
  };

  if (db) {
    await setDoc(doc(db, COLLECTION_NAME, nextMessage.id), nextMessage, {
      merge: true,
    });
  }

  const updatedMessages = [
    nextMessage,
    ...storedMessages.filter((storedMessage) => storedMessage.id !== nextMessage.id),
  ];
  saveStoredMessages(updatedMessages);
  return sortNewestFirst(updatedMessages);
}

export async function updateInternalMessage(messageId, updates) {
  const storedMessages = getStoredMessages();
  const nextUpdates = {
    ...updates,
    updatedAt: updates.updatedAt || new Date().toISOString(),
  };

  if (db) {
    await updateDoc(doc(db, COLLECTION_NAME, messageId), nextUpdates);
  }

  const updatedMessages = storedMessages.map((message) =>
    message.id === messageId ? { ...message, ...nextUpdates } : message,
  );
  saveStoredMessages(updatedMessages);
  return sortNewestFirst(updatedMessages);
}

export async function deleteInternalMessage(messageId) {
  const storedMessages = getStoredMessages();

  if (db) {
    await deleteDoc(doc(db, COLLECTION_NAME, messageId));
  }

  const updatedMessages = storedMessages.filter(
    (message) => message.id !== messageId,
  );
  saveStoredMessages(updatedMessages);
  return sortNewestFirst(updatedMessages);
}
