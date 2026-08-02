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

const STORAGE_KEY = "dispatch-cl-email-list";
const EMAIL_LIST_COLLECTION = "emailList";

function getLocalEmailList() {
  try {
    const savedEmailList = localStorage.getItem(STORAGE_KEY);

    if (!savedEmailList) {
      return [];
    }

    const parsedEmailList = JSON.parse(savedEmailList);

    return Array.isArray(parsedEmailList) ? parsedEmailList : [];
  } catch (error) {
    console.error("Unable to load email list:", error);
    return [];
  }
}

function saveLocalEmailList(emailList) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emailList));

    return true;
  } catch (error) {
    console.error("Unable to save email list:", error);
    return false;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sortEmailList(emailList) {
  return [...emailList].sort((firstEntry, secondEntry) =>
    String(firstEntry.email || "").localeCompare(
      String(secondEntry.email || ""),
    ),
  );
}

export function subscribeToEmailList(onEmailList, onError) {
  if (!db) {
    onEmailList(getLocalEmailList());
    return () => {};
  }

  const emailListQuery = query(
    collection(db, EMAIL_LIST_COLLECTION),
    orderBy("email", "asc"),
  );

  return onSnapshot(
    emailListQuery,
    (emailListSnapshot) => {
      const emailList = emailListSnapshot.docs.map((emailListDoc) => ({
        id: emailListDoc.id,
        ...emailListDoc.data(),
      }));
      const sortedEmailList = sortEmailList(emailList);

      saveLocalEmailList(sortedEmailList);
      onEmailList(sortedEmailList);
    },
    onError,
  );
}

export async function addEmailListEntry(emailListEntry) {
  const normalizedEmail = normalizeEmail(emailListEntry.email);
  const currentEmailList = getLocalEmailList();
  const entry = {
    ...emailListEntry,
    email: normalizedEmail,
  };
  const updatedEmailList = sortEmailList([
    entry,
    ...currentEmailList.filter(
      (savedEntry) => normalizeEmail(savedEntry.email) !== normalizedEmail,
    ),
  ]);

  if (db) {
    await setDoc(doc(db, EMAIL_LIST_COLLECTION, entry.id), entry);
  }

  saveLocalEmailList(updatedEmailList);

  return updatedEmailList;
}

export async function deleteEmailListEntry(emailListEntryId) {
  const currentEmailList = getLocalEmailList();
  const updatedEmailList = currentEmailList.filter(
    (emailListEntry) => emailListEntry.id !== emailListEntryId,
  );

  if (db) {
    await deleteDoc(
      doc(db, EMAIL_LIST_COLLECTION, emailListEntryId),
    );
  }

  saveLocalEmailList(updatedEmailList);

  return updatedEmailList;
}
