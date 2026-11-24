import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const SUPPORTED_CUSTOMER_MESSAGE_TYPES = new Set([
  "orderSummary",
  "potentialDelivery",
  "scheduledDelivery",
  "deliveryToday",
  "deliveryComplete",
  "willCall",
]);

async function callTwilioSender(payload) {
  if (!functions) {
    throw new Error("Twilio messaging is unavailable until Firebase is configured.");
  }

  const sendMessage = httpsCallable(functions, "sendTwilioMessage");
  const response = await sendMessage(payload);
  return response.data;
}

export async function sendTwilioTestMessage(toPhoneNumber) {
  return callTwilioSender({
    messageType: "test",
    toPhoneNumber,
  });
}

export async function sendTwilioNotificationTestMessage({
  messageType,
  messageTemplate,
  toPhoneNumber,
  customer,
  business,
  order,
  date,
  address,
  summaryUrl,
}) {
  if (!SUPPORTED_CUSTOMER_MESSAGE_TYPES.has(messageType)) {
    throw new Error("Choose a supported customer message type.");
  }

  return callTwilioSender({
    messageType,
    messageTemplate,
    toPhoneNumber,
    customer,
    business,
    order,
    date,
    address,
    summaryUrl,
    templateTest: true,
  });
}

export async function sendTwilioCustomerMessage({
  messageType,
  toPhoneNumber,
  customer,
  business,
  order,
  date,
  address,
  deliveryId,
  mediaUrls,
  summaryUrl,
}) {
  if (!SUPPORTED_CUSTOMER_MESSAGE_TYPES.has(messageType)) {
    throw new Error("Choose a supported customer message type.");
  }

  return callTwilioSender({
    messageType,
    toPhoneNumber,
    customer,
    business,
    order,
    date,
    address,
    deliveryId,
    mediaUrls,
    summaryUrl,
  });
}

export async function createAndSendOrderSummary(orderId, onProgress) {
  if (!functions) {
    throw new Error("Order summary messaging is unavailable until Firebase is configured.");
  }

  onProgress?.("buildingPreview");
  const createSummary = httpsCallable(functions, "createOrderSummary");
  const summaryResponse = await createSummary({ orderId });
  const summary = summaryResponse.data || {};
  onProgress?.("generatingText");
  const message = await sendTwilioCustomerMessage({
    messageType: "orderSummary",
    toPhoneNumber: summary.toPhoneNumber,
    customer: summary.customer,
    business: summary.business,
    order: summary.order,
    date: summary.date,
    address: summary.address,
    summaryUrl: summary.summaryUrl,
  });

  return {
    summaryUrl: String(summary.summaryUrl || ""),
    reused: summary.reused === true,
    message,
  };
}

export async function createOrderSummaryPreview(order) {
  if (!functions) {
    throw new Error("Order summary previews are unavailable until Firebase is configured.");
  }

  const previewSummary = httpsCallable(functions, "previewOrderSummary");
  const response = await previewSummary({ order });
  const preview = response.data || {};

  if (!preview.pdfBase64) {
    throw new Error("The order summary preview did not return a PDF.");
  }

  return {
    pdfBase64: String(preview.pdfBase64),
    fileName: String(preview.fileName || "Capital-Lumber-Order-Draft.pdf"),
  };
}
