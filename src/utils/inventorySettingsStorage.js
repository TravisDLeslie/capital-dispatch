import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-inventory-settings";
const SETTINGS_COLLECTION = "appSettings";
const INVENTORY_SETTINGS_DOC = "inventorySettings";

export const defaultInventorySettings = {
  id: INVENTORY_SETTINGS_DOC,
  removedItemNumbers: [],
};

export function normalizeInventorySettings(settings) {
  const removedItemNumbers = Array.from(
    new Set(
      (Array.isArray(settings?.removedItemNumbers)
        ? settings.removedItemNumbers
        : []
      )
        .map((itemNumber) => String(itemNumber || "").trim())
        .filter(Boolean),
    ),
  );

  return {
    ...defaultInventorySettings,
    ...(settings || {}),
    id: INVENTORY_SETTINGS_DOC,
    removedItemNumbers,
  };
}

function getLocalInventorySettings() {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    return savedSettings
      ? normalizeInventorySettings(JSON.parse(savedSettings))
      : defaultInventorySettings;
  } catch (error) {
    console.error("Unable to load inventory settings:", error);
    return defaultInventorySettings;
  }
}

function saveLocalInventorySettings(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeInventorySettings(settings)),
    );
  } catch (error) {
    console.error("Unable to save inventory settings locally:", error);
  }
}

export function subscribeToInventorySettings(onSettings, onError) {
  if (!db) {
    onSettings(getLocalInventorySettings());
    return () => {};
  }

  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, INVENTORY_SETTINGS_DOC),
    (settingsSnapshot) => {
      const settings = normalizeInventorySettings(
        settingsSnapshot.exists() ? settingsSnapshot.data() : {},
      );

      saveLocalInventorySettings(settings);
      onSettings(settings);
    },
    (error) => {
      onSettings(getLocalInventorySettings());
      onError?.(error);
    },
  );
}

export async function saveInventorySettings(settings) {
  const cleanSettings = normalizeInventorySettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  if (db) {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, INVENTORY_SETTINGS_DOC),
      cleanSettings,
      { merge: true },
    );
  }

  saveLocalInventorySettings(cleanSettings);
  return cleanSettings;
}
