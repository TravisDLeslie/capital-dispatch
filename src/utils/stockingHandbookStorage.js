import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { defaultStockingHandbookItems } from "../data/stockingHandbookSeed";
import { db } from "./firebase";
import { createId } from "./idHelpers";

const STORAGE_KEY = "dispatch-cl-stocking-handbook-items";
const STOCKING_HANDBOOK_COLLECTION = "stockingHandbookItems";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeLengthItems(lengthItems) {
  if (!Array.isArray(lengthItems)) {
    return [];
  }

  return lengthItems
    .map((lengthItem) => ({
      id: lengthItem.id || createId(),
      length: cleanText(lengthItem.length),
      itemNumber: cleanText(lengthItem.itemNumber),
      notes: cleanText(lengthItem.notes),
    }))
    .filter(
      (lengthItem) =>
        lengthItem.length || lengthItem.itemNumber || lengthItem.notes,
    );
}

function getDefaultLengthItems(item) {
  const normalizedName = cleanText(item.name)
    .toLowerCase()
    .replace(/[×✕]/g, "x")
    .replace(/[^a-z0-9]/g, "");
  const normalizedDimension = cleanText(item.nominalDimension)
    .toLowerCase()
    .replace(/[×✕]/g, "x")
    .replace(/[^a-z0-9]/g, "");

  if (
    item.id === "stock-dim-2x4-dfl" ||
    (normalizedName.includes("2x4dougfir") &&
      normalizedName.includes("framing")) ||
    (normalizedDimension === "2x4" &&
      normalizedName.includes("dougfir") &&
      normalizedName.includes("framing"))
  ) {
    return [
      { id: "2x4-dfl-8", length: "8 ft", itemNumber: "01", notes: "" },
      { id: "2x4-dfl-10", length: "10 ft", itemNumber: "02", notes: "" },
      { id: "2x4-dfl-12", length: "12 ft", itemNumber: "03", notes: "" },
      { id: "2x4-dfl-14", length: "14 ft", itemNumber: "04", notes: "" },
      { id: "2x4-dfl-16", length: "16 ft", itemNumber: "05", notes: "" },
    ];
  }

  return [];
}

function getLengthItemsFromStockingLengths(item) {
  const stockingLengths = cleanText(item.stockingLengths);
  const matches = [...stockingLengths.matchAll(/(\d+(?:\.\d+)?)\s*(?:ft|')/gi)];
  const seenLengths = new Set();

  return matches
    .map((match) => `${match[1]} ft`)
    .filter((length) => {
      if (seenLengths.has(length)) {
        return false;
      }

      seenLengths.add(length);

      return true;
    })
    .map((length) => ({
      id: `${item.id || "stock"}-${length.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      length,
      itemNumber: "",
      notes: "",
    }));
}

function mergeLengthItems(baseLengthItems, overrideLengthItems) {
  const lengthItemMap = new Map();

  [...baseLengthItems, ...overrideLengthItems].forEach((lengthItem) => {
    const key = cleanText(lengthItem.length)
      .toLowerCase()
      .replace(/[×✕]/g, "x")
      .replace(/[^a-z0-9]/g, "");

    if (!key) {
      return;
    }

    lengthItemMap.set(key, {
      ...(lengthItemMap.get(key) || {}),
      ...lengthItem,
    });
  });

  return [...lengthItemMap.values()];
}

function normalizeItem(item) {
  const now = new Date().toISOString();
  const fallbackLengthItems = [
    ...getDefaultLengthItems(item),
    ...getLengthItemsFromStockingLengths(item),
  ];
  const lengthItems = mergeLengthItems(
    fallbackLengthItems,
    normalizeLengthItems(item.lengthItems),
  );

  return {
    id: item.id || createId(),
    category: cleanText(item.category) || "General",
    name: cleanText(item.name),
    sku: cleanText(item.sku),
    grade: cleanText(item.grade),
    nominalDimension: cleanText(item.nominalDimension),
    actualDimension: cleanText(item.actualDimension),
    unitSize: cleanText(item.unitSize),
    stockingLengths: cleanText(item.stockingLengths),
    lengthItems,
    notes: cleanText(item.notes),
    keywords: cleanText(item.keywords),
    source: item.source || "app",
    archived: Boolean(item.archived),
    createdAt: item.createdAt || now,
    updatedAt: now,
    updatedBy: cleanText(item.updatedBy),
  };
}

function sortItems(items) {
  return [...items].sort((firstItem, secondItem) => {
    const categoryCompare = String(firstItem.category || "").localeCompare(
      String(secondItem.category || ""),
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return String(firstItem.name || "").localeCompare(
      String(secondItem.name || ""),
      undefined,
      { numeric: true },
    );
  });
}

function getSeedItems() {
  return defaultStockingHandbookItems.map((item) => ({
    ...normalizeItem({
      ...item,
      source: "Stocking Handbook PDF",
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    }),
    source: "Stocking Handbook PDF",
  }));
}

function mergeWithSeed(savedItems) {
  const savedItemMap = new Map(
    (Array.isArray(savedItems) ? savedItems : []).map((item) => [
      item.id,
      normalizeItem(item),
    ]),
  );
  const mergedItems = getSeedItems()
    .map((seedItem) => {
      const savedItem = savedItemMap.get(seedItem.id);

      if (!savedItem) {
        return seedItem;
      }

      return {
        ...seedItem,
        ...savedItem,
        lengthItems:
          Array.isArray(savedItem.lengthItems) &&
          savedItem.lengthItems.length > 0
            ? savedItem.lengthItems
            : seedItem.lengthItems,
        keywords: savedItem.keywords || seedItem.keywords,
      };
    })
    .filter((item) => !item.archived);
  const customItems = [...savedItemMap.values()].filter(
    (item) =>
      !defaultStockingHandbookItems.some(
        (seedItem) => seedItem.id === item.id,
      ) && !item.archived,
  );

  return sortItems([...mergedItems, ...customItems]);
}

function getLocalItems() {
  try {
    const savedItems = localStorage.getItem(STORAGE_KEY);

    if (!savedItems) {
      return mergeWithSeed([]);
    }

    const parsedItems = JSON.parse(savedItems);

    return mergeWithSeed(Array.isArray(parsedItems) ? parsedItems : []);
  } catch (error) {
    console.error("Unable to load stocking handbook items:", error);
    return mergeWithSeed([]);
  }
}

function saveLocalItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

    return true;
  } catch (error) {
    console.error("Unable to save stocking handbook items:", error);
    return false;
  }
}

export function subscribeToStockingHandbookItems(onItems, onError) {
  onItems(mergeWithSeed([]));

  if (!db) {
    return () => {};
  }

  const itemsQuery = query(
    collection(db, STOCKING_HANDBOOK_COLLECTION),
    orderBy("category", "asc"),
  );

  return onSnapshot(
    itemsQuery,
    (itemsSnapshot) => {
      const savedItems = itemsSnapshot.docs.map((itemDoc) => ({
        id: itemDoc.id,
        ...itemDoc.data(),
      }));
      const mergedItems = mergeWithSeed(savedItems);

      saveLocalItems(mergedItems);
      onItems(mergedItems);
    },
    (error) => {
      onItems(getLocalItems());
      onError(error);
    },
  );
}

export async function saveStockingHandbookItem(item) {
  const currentItems = getLocalItems();
  const cleanItem = normalizeItem(item);
  const updatedItems = sortItems([
    cleanItem,
    ...currentItems.filter((savedItem) => savedItem.id !== cleanItem.id),
  ]);

  if (db) {
    await setDoc(
      doc(db, STOCKING_HANDBOOK_COLLECTION, cleanItem.id),
      cleanItem,
      { merge: true },
    );
  }

  saveLocalItems(updatedItems);

  return updatedItems;
}

export async function deleteStockingHandbookItem(itemId) {
  const currentItems = getLocalItems();
  const isSeedItem = defaultStockingHandbookItems.some(
    (seedItem) => seedItem.id === itemId,
  );
  const updatedItems = currentItems.filter((item) => item.id !== itemId);

  if (db) {
    if (isSeedItem) {
      await setDoc(
        doc(db, STOCKING_HANDBOOK_COLLECTION, itemId),
        {
          id: itemId,
          archived: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } else {
      await deleteDoc(doc(db, STOCKING_HANDBOOK_COLLECTION, itemId));
    }
  }

  saveLocalItems(updatedItems);

  return updatedItems;
}
