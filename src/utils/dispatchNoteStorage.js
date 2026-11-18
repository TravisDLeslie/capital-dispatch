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

const STORAGE_KEY = "dispatch-cl-dispatch-notes";
const DISPATCH_NOTES_COLLECTION = "dispatchNotes";

function getLocalDispatchNotes() {
  try {
    const savedNotes = localStorage.getItem(STORAGE_KEY);

    if (!savedNotes) {
      return [];
    }

    const parsedNotes = JSON.parse(savedNotes);
    return Array.isArray(parsedNotes) ? parsedNotes : [];
  } catch (error) {
    console.error("Unable to load dispatch notes:", error);
    return [];
  }
}

function saveLocalDispatchNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error("Unable to save dispatch notes:", error);
  }
}

function sortDispatchNotes(notes) {
  return [...notes].sort((firstNote, secondNote) => {
    const firstComplete = firstNote.status === "complete";
    const secondComplete = secondNote.status === "complete";

    if (firstComplete !== secondComplete) {
      return firstComplete ? 1 : -1;
    }

    return String(secondNote.createdAt || "").localeCompare(
      String(firstNote.createdAt || ""),
    );
  });
}

export function subscribeToDispatchNotes(onNotes, onError) {
  if (!db) {
    onNotes(sortDispatchNotes(getLocalDispatchNotes()));
    return () => {};
  }

  const dispatchNotesQuery = query(
    collection(db, DISPATCH_NOTES_COLLECTION),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    dispatchNotesQuery,
    (notesSnapshot) => {
      const notes = sortDispatchNotes(
        notesSnapshot.docs.map((noteDocument) => ({
          id: noteDocument.id,
          ...noteDocument.data(),
        })),
      );

      saveLocalDispatchNotes(notes);
      onNotes(notes);
    },
    onError,
  );
}

export async function saveDispatchNote(note) {
  const existingNotes = getLocalDispatchNotes();
  const timestamp = new Date().toISOString();
  const noteToSave = {
    ...note,
    text: String(note.text || "").trim(),
    status: "active",
    createdAt: note.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const updatedNotes = sortDispatchNotes([noteToSave, ...existingNotes]);

  if (db) {
    await setDoc(
      doc(db, DISPATCH_NOTES_COLLECTION, noteToSave.id),
      noteToSave,
    );
  }

  saveLocalDispatchNotes(updatedNotes);
  return updatedNotes;
}

export async function updateDispatchNote(noteId, text) {
  const existingNotes = getLocalDispatchNotes();
  const timestamp = new Date().toISOString();
  const updates = {
    text: String(text || "").trim(),
    updatedAt: timestamp,
  };
  const updatedNotes = sortDispatchNotes(
    existingNotes.map((note) =>
      note.id === noteId ? { ...note, ...updates } : note,
    ),
  );

  if (db) {
    await updateDoc(
      doc(db, DISPATCH_NOTES_COLLECTION, noteId),
      updates,
    );
  }

  saveLocalDispatchNotes(updatedNotes);
  return updatedNotes;
}

export async function completeDispatchNote(noteId, completedBy = {}) {
  const existingNotes = getLocalDispatchNotes();
  const timestamp = new Date().toISOString();
  const updates = {
    status: "complete",
    completedAt: timestamp,
    completedById: completedBy.id || "",
    completedByName: completedBy.name || "",
    completedByEmail: completedBy.email || "",
    updatedAt: timestamp,
  };
  const updatedNotes = sortDispatchNotes(
    existingNotes.map((note) =>
      note.id === noteId ? { ...note, ...updates } : note,
    ),
  );

  if (db) {
    await updateDoc(
      doc(db, DISPATCH_NOTES_COLLECTION, noteId),
      updates,
    );
  }

  saveLocalDispatchNotes(updatedNotes);
  return updatedNotes;
}
