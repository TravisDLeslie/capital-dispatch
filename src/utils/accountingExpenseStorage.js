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
import { createId } from "./idHelpers";

const STORAGE_KEY = "dispatch-cl-accounting-expenses";
const COLLECTION_NAME = "accountingExpenses";

function getLocalExpenses() {
  try {
    const savedExpenses = localStorage.getItem(STORAGE_KEY);

    if (!savedExpenses) {
      return [];
    }

    const parsedExpenses = JSON.parse(savedExpenses);
    return Array.isArray(parsedExpenses) ? parsedExpenses : [];
  } catch (error) {
    console.error("Unable to load accounting expenses:", error);
    return [];
  }
}

function saveLocalExpenses(expenses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    return true;
  } catch (error) {
    console.error("Unable to save accounting expenses:", error);
    return false;
  }
}

function sortExpenses(expenses) {
  return [...expenses].sort((firstExpense, secondExpense) => {
    const dateComparison = String(secondExpense.expenseDate || "").localeCompare(
      String(firstExpense.expenseDate || ""),
    );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return String(secondExpense.createdAt || "").localeCompare(
      String(firstExpense.createdAt || ""),
    );
  });
}

function normalizeExpense(expense) {
  const now = new Date().toISOString();

  return {
    id: String(expense.id || createId()).trim(),
    expenseDate: String(expense.expenseDate || "").trim(),
    description: String(expense.description || "").trim(),
    vendor: String(expense.vendor || "").trim(),
    category: String(expense.category || "Other").trim() || "Other",
    amountCents: Math.max(0, Math.round(Number(expense.amountCents) || 0)),
    createdAt: expense.createdAt || now,
    createdById: String(expense.createdById || "").trim(),
    createdByName: String(expense.createdByName || "").trim(),
    createdByEmail: String(expense.createdByEmail || "").trim(),
    updatedAt: now,
  };
}

export function subscribeToAccountingExpenses(onExpenses, onError) {
  const localExpenses = sortExpenses(getLocalExpenses());
  onExpenses(localExpenses);

  if (!db) {
    return () => {};
  }

  const expenseQuery = query(
    collection(db, COLLECTION_NAME),
    orderBy("expenseDate", "desc"),
  );

  return onSnapshot(
    expenseQuery,
    (expenseSnapshot) => {
      const expenses = sortExpenses(
        expenseSnapshot.docs.map((expenseDoc) => ({
          id: expenseDoc.id,
          ...expenseDoc.data(),
        })),
      );

      saveLocalExpenses(expenses);
      onExpenses(expenses);
    },
    onError,
  );
}

export async function saveAccountingExpense(expense) {
  const cleanExpense = normalizeExpense(expense);
  const currentExpenses = getLocalExpenses();
  const updatedExpenses = sortExpenses([
    cleanExpense,
    ...currentExpenses.filter(
      (savedExpense) => savedExpense.id !== cleanExpense.id,
    ),
  ]);

  if (db) {
    await setDoc(
      doc(db, COLLECTION_NAME, cleanExpense.id),
      cleanExpense,
    );
  }

  saveLocalExpenses(updatedExpenses);
  return updatedExpenses;
}

export async function deleteAccountingExpense(expenseId) {
  const updatedExpenses = sortExpenses(
    getLocalExpenses().filter((expense) => expense.id !== expenseId),
  );

  if (db) {
    await deleteDoc(doc(db, COLLECTION_NAME, expenseId));
  }

  saveLocalExpenses(updatedExpenses);
  return updatedExpenses;
}

