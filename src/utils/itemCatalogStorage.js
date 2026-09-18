import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { createId } from "./idHelpers";

const STORAGE_KEY = "dispatch-cl-item-catalog-items";
const ITEM_CATALOG_COLLECTION = "itemCatalogItems";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeMoney(value) {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  const numberValue = Number(text.replace(/[$,]/g, ""));

  return Number.isFinite(numberValue) ? String(numberValue) : text;
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }

  return cleanText(value)
    .split(",")
    .map(cleanText)
    .filter(Boolean);
}

export function normalizeItemCatalogItem(item) {
  const now = new Date().toISOString();
  const alternativeSkus = normalizeList(item.alternativeSkus);
  const keywords = normalizeList(item.keywords);

  return {
    id: item.id || createId(),
    itemNumber: cleanText(item.itemNumber),
    description: cleanText(item.description),
    category: cleanText(item.category) || "Uncategorized",
    group: cleanText(item.group),
    unit: cleanText(item.unit),
    price: normalizeMoney(item.price),
    lastPurchasePrice: normalizeMoney(item.lastPurchasePrice),
    alternativeSkus,
    keywords,
    notes: cleanText(item.notes),
    archived: Boolean(item.archived),
    createdAt: item.createdAt || now,
    updatedAt: now,
    updatedBy: cleanText(item.updatedBy),
  };
}

function sortItems(items) {
  return [...items]
    .filter((item) => !item.archived)
    .sort((firstItem, secondItem) => {
      const categoryCompare = String(firstItem.category || "").localeCompare(
        String(secondItem.category || ""),
        undefined,
        { numeric: true },
      );

      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      const groupCompare = String(firstItem.group || "").localeCompare(
        String(secondItem.group || ""),
        undefined,
        { numeric: true },
      );

      if (groupCompare !== 0) {
        return groupCompare;
      }

      return String(firstItem.description || firstItem.itemNumber || "").localeCompare(
        String(secondItem.description || secondItem.itemNumber || ""),
        undefined,
        { numeric: true },
      );
    });
}

function getLocalItems() {
  try {
    const savedItems = localStorage.getItem(STORAGE_KEY);

    if (!savedItems) {
      return [];
    }

    const parsedItems = JSON.parse(savedItems);

    return sortItems(
      Array.isArray(parsedItems)
        ? parsedItems.map(normalizeItemCatalogItem)
        : [],
    );
  } catch (error) {
    console.error("Unable to load item catalog:", error);
    return [];
  }
}

function saveLocalItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortItems(items)));

    return true;
  } catch (error) {
    console.error("Unable to save item catalog:", error);
    return false;
  }
}

export function subscribeToItemCatalogItems(onItems, onError) {
  onItems(getLocalItems());

  if (!db) {
    return () => {};
  }

  return onSnapshot(
    collection(db, ITEM_CATALOG_COLLECTION),
    (itemsSnapshot) => {
      const savedItems = sortItems(
        itemsSnapshot.docs.map((itemDoc) =>
          normalizeItemCatalogItem({
            id: itemDoc.id,
            ...itemDoc.data(),
          }),
        ),
      );

      saveLocalItems(savedItems);
      onItems(savedItems);
    },
    (error) => {
      onItems(getLocalItems());
      onError(error);
    },
  );
}

export async function saveItemCatalogItem(item) {
  const currentItems = getLocalItems();
  const cleanItem = normalizeItemCatalogItem(item);
  const updatedItems = sortItems([
    cleanItem,
    ...currentItems.filter((savedItem) => savedItem.id !== cleanItem.id),
  ]);

  if (db) {
    await setDoc(doc(db, ITEM_CATALOG_COLLECTION, cleanItem.id), cleanItem, {
      merge: true,
    });
  }

  saveLocalItems(updatedItems);

  return updatedItems;
}

export async function deleteItemCatalogItem(itemId) {
  const currentItems = getLocalItems();
  const updatedItems = currentItems.filter((item) => item.id !== itemId);

  if (db) {
    await deleteDoc(doc(db, ITEM_CATALOG_COLLECTION, itemId));
  }

  saveLocalItems(updatedItems);

  return updatedItems;
}
