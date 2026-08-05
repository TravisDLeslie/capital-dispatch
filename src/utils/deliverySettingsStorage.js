import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { defaultDeliveryScheduleSettings } from "./deliverySchedule";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-delivery-settings";
const SETTINGS_COLLECTION = "appSettings";
const DELIVERY_SETTINGS_DOC = "deliverySchedule";

function normalizeSettings(settings) {
  return {
    ...defaultDeliveryScheduleSettings,
    ...(settings || {}),
    id: DELIVERY_SETTINGS_DOC,
    unloadDurations: {
      ...defaultDeliveryScheduleSettings.unloadDurations,
      ...(settings?.unloadDurations || {}),
    },
  };
}

function getLocalDeliverySettings() {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);

    if (!savedSettings) {
      return defaultDeliveryScheduleSettings;
    }

    return normalizeSettings(JSON.parse(savedSettings));
  } catch (error) {
    console.error("Unable to load delivery settings:", error);
    return defaultDeliveryScheduleSettings;
  }
}

function saveLocalDeliverySettings(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeSettings(settings)),
    );

    return true;
  } catch (error) {
    console.error("Unable to save delivery settings:", error);
    return false;
  }
}

export function subscribeToDeliverySettings(onSettings, onError) {
  if (!db) {
    onSettings(getLocalDeliverySettings());
    return () => {};
  }

  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, DELIVERY_SETTINGS_DOC),
    (settingsSnapshot) => {
      const settings = normalizeSettings(
        settingsSnapshot.exists() ? settingsSnapshot.data() : {},
      );

      saveLocalDeliverySettings(settings);
      onSettings(settings);
    },
    onError,
  );
}

export async function saveDeliverySettings(settings) {
  const cleanSettings = normalizeSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  if (db) {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, DELIVERY_SETTINGS_DOC),
      cleanSettings,
      { merge: true },
    );
  }

  saveLocalDeliverySettings(cleanSettings);

  return cleanSettings;
}
