import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-bouncie-vehicle-settings";
const VEHICLE_SETTINGS_COLLECTION = "bouncieVehicleSettings";

function getLocalVehicleSettings() {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);

    if (!savedSettings) {
      return [];
    }

    const parsedSettings = JSON.parse(savedSettings);

    return Array.isArray(parsedSettings) ? parsedSettings : [];
  } catch (error) {
    console.error("Unable to load Bouncie vehicle settings:", error);
    return [];
  }
}

function saveLocalVehicleSettings(vehicleSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicleSettings));

    return true;
  } catch (error) {
    console.error("Unable to save Bouncie vehicle settings:", error);
    return false;
  }
}

function sortVehicleSettings(vehicleSettings) {
  return [...vehicleSettings].sort((firstSetting, secondSetting) =>
    String(firstSetting.title || "").localeCompare(
      String(secondSetting.title || ""),
    ),
  );
}

export function subscribeToBouncieVehicleSettings(onSettings, onError) {
  if (!db) {
    onSettings(getLocalVehicleSettings());
    return () => {};
  }

  const vehicleSettingsQuery = query(
    collection(db, VEHICLE_SETTINGS_COLLECTION),
    orderBy("title", "asc"),
  );

  return onSnapshot(
    vehicleSettingsQuery,
    (vehicleSettingsSnapshot) => {
      const vehicleSettings = vehicleSettingsSnapshot.docs.map(
        (vehicleSettingsDoc) => ({
          id: vehicleSettingsDoc.id,
          ...vehicleSettingsDoc.data(),
        }),
      );
      const sortedSettings = sortVehicleSettings(vehicleSettings);

      saveLocalVehicleSettings(sortedSettings);
      onSettings(sortedSettings);
    },
    onError,
  );
}

export async function saveBouncieVehicleSetting(vehicleSetting) {
  const currentSettings = getLocalVehicleSettings();
  const updatedAt = new Date().toISOString();
  const setting = {
    ...vehicleSetting,
    title: String(vehicleSetting.title || "").trim(),
    updatedAt,
  };
  const updatedSettings = sortVehicleSettings([
    setting,
    ...currentSettings.filter(
      (savedSetting) => savedSetting.id !== setting.id,
    ),
  ]);

  if (db) {
    await setDoc(doc(db, VEHICLE_SETTINGS_COLLECTION, setting.id), setting);
  }

  saveLocalVehicleSettings(updatedSettings);

  return updatedSettings;
}
