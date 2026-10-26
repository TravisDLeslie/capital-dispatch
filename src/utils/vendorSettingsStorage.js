import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  supplierAddresses as defaultSupplierAddresses,
  vendors as defaultVendors,
} from "../data/options";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-vendor-settings";
const SETTINGS_COLLECTION = "appSettings";
const VENDOR_SETTINGS_DOC = "vendorSettings";

const defaultDeliveryCadences = {
  "Boise Cascade": "M-W-F",
  Weyerhaeuser: "T-Th",
  Weyerhauser: "T-Th",
  Orepac: "M-W-F",
  OrePac: "M-W-F",
  Disdero: "M-T, Th-F",
};

function createDefaultVendors() {
  return defaultVendors.map((name, index) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `vendor-${index}`,
    name,
    address: defaultSupplierAddresses[name] || "",
    phone: "",
    contacts: [],
    deliveryCadence: defaultDeliveryCadences[name] || "",
    routeOrder: index + 1,
    active: true,
  }));
}

function normalizeContact(contact, index) {
  const name = String(contact?.name || "").trim();
  const products = String(contact?.products || "").trim();
  const phone = String(contact?.phone || "").trim();
  const email = String(contact?.email || "").trim();

  return {
    id:
      String(contact?.id || "").trim() ||
      `${name || "contact"}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    products,
    phone,
    email,
  };
}

export const defaultVendorSettings = {
  id: VENDOR_SETTINGS_DOC,
  vendors: createDefaultVendors(),
};

function normalizeVendor(vendor, index) {
  const name = String(vendor?.name || "").trim();

  return {
    id:
      String(vendor?.id || "").trim() ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
      `vendor-${index}`,
    name,
    address: String(vendor?.address || "").trim(),
    phone: String(vendor?.phone || "").trim(),
    contacts: (Array.isArray(vendor?.contacts) ? vendor.contacts : [])
      .map(normalizeContact)
      .filter(
        (contact) =>
          contact.name || contact.products || contact.phone || contact.email,
      ),
    deliveryCadence:
      String(vendor?.deliveryCadence || "").trim() ||
      defaultDeliveryCadences[name] ||
      "",
    routeOrder: Number(vendor?.routeOrder) || index + 1,
    active: vendor?.active !== false,
  };
}

export function normalizeVendorSettings(settings) {
  const vendorList = Array.isArray(settings?.vendors)
    ? settings.vendors
    : defaultVendorSettings.vendors;

  return {
    ...defaultVendorSettings,
    ...(settings || {}),
    id: VENDOR_SETTINGS_DOC,
    vendors: vendorList
      .map(normalizeVendor)
      .filter((vendor) => vendor.name)
      .sort((firstVendor, secondVendor) => {
        if (firstVendor.routeOrder !== secondVendor.routeOrder) {
          return firstVendor.routeOrder - secondVendor.routeOrder;
        }

        return firstVendor.name.localeCompare(secondVendor.name);
      }),
  };
}

function getLocalVendorSettings() {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);

    if (!savedSettings) {
      return defaultVendorSettings;
    }

    return normalizeVendorSettings(JSON.parse(savedSettings));
  } catch (error) {
    console.error("Unable to load vendor settings:", error);
    return defaultVendorSettings;
  }
}

function saveLocalVendorSettings(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeVendorSettings(settings)),
    );

    return true;
  } catch (error) {
    console.error("Unable to save vendor settings:", error);
    return false;
  }
}

export function subscribeToVendorSettings(onSettings, onError) {
  if (!db) {
    onSettings(getLocalVendorSettings());
    return () => {};
  }

  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, VENDOR_SETTINGS_DOC),
    (settingsSnapshot) => {
      const settings = normalizeVendorSettings(
        settingsSnapshot.exists() ? settingsSnapshot.data() : {},
      );

      saveLocalVendorSettings(settings);
      onSettings(settings);
    },
    (error) => {
      // Keep previously loaded vendor data available when Firestore access is
      // temporarily unavailable instead of dropping the UI to the 13 defaults.
      onSettings(getLocalVendorSettings());
      onError?.(error);
    },
  );
}

export async function saveVendorSettings(settings) {
  const cleanSettings = normalizeVendorSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  if (db) {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, VENDOR_SETTINGS_DOC),
      cleanSettings,
      { merge: true },
    );
  }

  saveLocalVendorSettings(cleanSettings);

  return cleanSettings;
}
