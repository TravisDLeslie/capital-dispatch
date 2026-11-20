import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const SUPPORTED_CUSTOMER_MESSAGE_TYPES = new Set([
  "potentialDelivery",
  "scheduledDelivery",
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
  });
}
