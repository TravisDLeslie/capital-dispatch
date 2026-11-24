import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const SETTINGS_COLLECTION = "appSettings";
const TWILIO_SETTINGS_DOC = "twilioMessaging";
const LEGACY_DELIVERY_COMPLETE_TEMPLATE =
  "Hi {{customer}}, Capital Lumber completed delivery of order {{order}} to {{address}} on {{date}}. Delivery photos are attached. Thank you for your business. Reply STOP to opt out.";
const DEFAULT_DELIVERY_COMPLETE_TEMPLATE =
  "Hi {{customer}}, your order for {{business}} to {{address}} on {{date}} has been delivered by Capital Lumber Co. Photos are attached. If you have any questions, please give us a call at 208-343-5481. Thank you for your business. Reply STOP to opt out.";

export const defaultTwilioSettings = {
  id: TWILIO_SETTINGS_DOC,
  enabled: false,
  accountSid: "",
  messagingServiceSid: "",
  senderPhoneNumber: "",
  businessName: "Capital Lumber",
  orderSummaryEnabled: true,
  orderSummaryTemplate:
    "Hi {{customer}}, thank you for your order with Capital Lumber Co. View your order summary and details here: {{summaryUrl}} Please call us at 208-343-5481 with any questions. We will text you again when your order is scheduled for delivery or ready for pickup. Reply STOP to opt out.",
  potentialDeliveryEnabled: true,
  potentialDeliveryTemplate:
    "Hi {{customer}}, Capital Lumber is preparing a possible delivery for order {{order}}. We will text again when the date is confirmed.",
  scheduledDeliveryEnabled: true,
  scheduledDeliveryTemplate:
    "Hi {{customer}}, your Capital Lumber delivery for order {{order}} has been scheduled for {{date}}. We will text you again the morning of delivery. Reply STOP to opt out.",
  deliveryTodayEnabled: true,
  deliveryTodayTemplate:
    "Hi {{customer}}, your Capital Lumber delivery for order {{order}} is scheduled for today at {{address}}. Please call 208-343-5481 with any questions. Reply STOP to opt out.",
  deliveryCompleteEnabled: true,
  deliveryCompleteTemplate: DEFAULT_DELIVERY_COMPLETE_TEMPLATE,
  deliveryCompleteGlobalPhoto: null,
  willCallEnabled: true,
  willCallTemplate:
    "Hi {{customer}}, order {{order}} is ready for pickup at Capital Lumber. Reply STOP to opt out.",
};

function normalizePhoneNumber(value) {
  const cleanValue = String(value || "").trim();
  const digits = cleanValue.replace(/\D/g, "");

  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return cleanValue.startsWith("+") ? cleanValue : `+${digits}`;
}

export function normalizeTwilioSettings(settings) {
  const savedDeliveryCompleteTemplate = String(
    settings?.deliveryCompleteTemplate || "",
  ).trim();
  const savedGlobalPhoto = settings?.deliveryCompleteGlobalPhoto;

  return {
    ...defaultTwilioSettings,
    ...(settings || {}),
    id: TWILIO_SETTINGS_DOC,
    accountSid: String(settings?.accountSid || "").trim(),
    messagingServiceSid: String(settings?.messagingServiceSid || "").trim(),
    senderPhoneNumber: normalizePhoneNumber(settings?.senderPhoneNumber),
    businessName:
      String(settings?.businessName || "").trim() ||
      defaultTwilioSettings.businessName,
    deliveryCompleteTemplate:
      !savedDeliveryCompleteTemplate ||
      savedDeliveryCompleteTemplate === LEGACY_DELIVERY_COMPLETE_TEMPLATE
        ? DEFAULT_DELIVERY_COMPLETE_TEMPLATE
        : savedDeliveryCompleteTemplate,
    deliveryCompleteGlobalPhoto:
      savedGlobalPhoto && String(savedGlobalPhoto.url || "").startsWith("https://")
        ? {
            ...savedGlobalPhoto,
            url: String(savedGlobalPhoto.url).trim(),
            path: String(savedGlobalPhoto.path || "").trim(),
          }
        : null,
  };
}

export function subscribeToTwilioSettings(onSettings, onError) {
  if (!db) {
    onSettings(defaultTwilioSettings);
    return () => {};
  }

  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, TWILIO_SETTINGS_DOC),
    (snapshot) => {
      onSettings(
        normalizeTwilioSettings(snapshot.exists() ? snapshot.data() : {}),
      );
    },
    onError,
  );
}

export async function saveTwilioSettings(settings) {
  const cleanSettings = normalizeTwilioSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  if (db) {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, TWILIO_SETTINGS_DOC),
      cleanSettings,
      { merge: true },
    );
  }

  return cleanSettings;
}

export async function saveTwilioSetting(key, value) {
  if (db) {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, TWILIO_SETTINGS_DOC),
      {
        [key]: value,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  return value;
}
