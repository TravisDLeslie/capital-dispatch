const { randomBytes, randomUUID } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret, defineString } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { Resend } = require("resend");
const { generateOrderSummaryPdf } = require("./orderSummaryPdf");

initializeApp();

const resendApiKey = defineSecret("RESEND_API_KEY");
const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
const supplierChatFromEmail = defineString("SUPPLIER_CHAT_FROM_EMAIL", {
  default: "Capital Lumber <supplier-chat@mail.capitallumber.co>",
  description: "Verified Resend sender used for supplier invitations.",
});
const appBaseUrl = defineString("APP_BASE_URL", {
  default: "https://dispatch.capitallumber.co",
  description: "Public Capital Lumber app URL.",
});

const BOOTSTRAP_SUPER_ADMIN_EMAIL = "travis@capitallumber.co";
const TWILIO_SETTINGS_PATH = "appSettings/twilioMessaging";
const TWILIO_MESSAGE_LOG_COLLECTION = "twilioMessageLog";

const TWILIO_MESSAGE_TYPES = {
  orderSummary: {
    enabledKey: "orderSummaryEnabled",
    templateKey: "orderSummaryTemplate",
    defaultEnabled: true,
    defaultTemplate:
      "Hi {{customer}}, thank you for your order with Capital Lumber Co. View your order summary and details here: {{summaryUrl}} Please call us at 208-343-5481 with any questions. We will text you again when your order is scheduled for delivery or ready for pickup. Reply STOP to opt out.",
  },
  potentialDelivery: {
    enabledKey: "potentialDeliveryEnabled",
    templateKey: "potentialDeliveryTemplate",
  },
  scheduledDelivery: {
    enabledKey: "scheduledDeliveryEnabled",
    templateKey: "scheduledDeliveryTemplate",
    defaultEnabled: true,
    defaultTemplate:
      "Hi {{customer}}, your Capital Lumber delivery for order {{order}} has been scheduled for {{date}}. We will text you again the morning of delivery. Reply STOP to opt out.",
  },
  deliveryToday: {
    enabledKey: "deliveryTodayEnabled",
    templateKey: "deliveryTodayTemplate",
    defaultEnabled: true,
    defaultTemplate:
      "Hi {{customer}}, your Capital Lumber delivery for order {{order}} is scheduled for today at {{address}}. Please call 208-343-5481 with any questions. Reply STOP to opt out.",
  },
  deliveryComplete: {
    enabledKey: "deliveryCompleteEnabled",
    templateKey: "deliveryCompleteTemplate",
    defaultEnabled: true,
    defaultTemplate:
      "Hi {{customer}}, your order for {{business}} to {{address}} on {{date}} has been delivered by Capital Lumber Co. Photos are attached. If you have any questions, please give us a call at 208-343-5481. Thank you for your business. Reply STOP to opt out.",
  },
  willCall: {
    enabledKey: "willCallEnabled",
    templateKey: "willCallTemplate",
    defaultEnabled: true,
    defaultTemplate:
      "Hi {{customer}}, order {{order}} is ready for pickup at Capital Lumber. Reply STOP to opt out.",
  },
};

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhoneNumber(value) {
  const cleanValue = String(value || "").trim();
  const digits = cleanValue.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (cleanValue.startsWith("+") && /^\+[1-9]\d{7,14}$/.test(cleanValue)) {
    return cleanValue;
  }

  return "";
}

function maskPhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••-•••-${digits.slice(-4)}` : "Hidden";
}

function fillMessageTemplate(template, fields) {
  const replacements = {
    customer: String(fields.customer || "there").trim() || "there",
    business:
      String(fields.business || "your business").trim() || "your business",
    order: String(fields.order || "").trim() || "your order",
    date: String(fields.date || "").trim() || "a date to be confirmed",
    address: String(fields.address || "").trim() || "the delivery address",
    summaryurl: String(fields.summaryUrl || "").trim(),
  };

  return String(template || "")
    .replace(/{{\s*(customer|business|order|date|address|summaryUrl)\s*}}/gi, (match, key) =>
      replacements[String(key).toLowerCase()] || match,
    )
    .trim();
}

function normalizeTwilioMediaUrls(value) {
  if (!Array.isArray(value)) return [];

  const allowedHosts = new Set([
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
  ]);

  return [...new Set(value)]
    .slice(0, 10)
    .map((mediaUrl) => {
      try {
        const parsedUrl = new URL(String(mediaUrl || "").trim());
        return parsedUrl.protocol === "https:" && allowedHosts.has(parsedUrl.hostname)
          ? parsedUrl.toString()
          : "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function isAllowedOrderSummaryTarget(value) {
  try {
    const target = new URL(String(value || "").trim());
    return (
      target.protocol === "https:" &&
      ["firebasestorage.googleapis.com", "storage.googleapis.com"].includes(
        target.hostname,
      )
    );
  } catch {
    return false;
  }
}

async function ensureOrderSummaryShortLink({
  firestore,
  orderReference,
  orderId,
  orderSummary,
  targetUrl,
}) {
  const existingShortUrl = String(orderSummary?.shortUrl || "").trim();
  const existingToken = String(orderSummary?.shortToken || "").trim();

  if (
    existingShortUrl.startsWith(`${appBaseUrl.value().replace(/\/+$/, "")}/s/`) &&
    /^[A-Za-z0-9_-]{20,32}$/.test(existingToken)
  ) {
    return existingShortUrl;
  }

  if (!isAllowedOrderSummaryTarget(targetUrl)) {
    throw new HttpsError(
      "failed-precondition",
      "The customer order summary link is not valid.",
    );
  }

  const shortToken = randomBytes(16).toString("base64url");
  const shortUrl = `${appBaseUrl.value().replace(/\/+$/, "")}/s/${shortToken}`;
  const createdAt = new Date().toISOString();
  const linkReference = firestore.doc(`orderSummaryLinks/${shortToken}`);
  const batch = firestore.batch();

  batch.set(linkReference, {
    active: true,
    createdAt,
    orderId,
    targetUrl,
  });
  batch.update(orderReference, {
    "orderSummary.shortToken": shortToken,
    "orderSummary.shortUrl": shortUrl,
    updatedAt: createdAt,
  });
  await batch.commit();

  return shortUrl;
}

async function getTwilioCaller(request, { adminOnly = false } = {}) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before sending a message.");
  }

  const firestore = getFirestore();
  const email = normalizedEmail(request.auth.token.email);
  const profileSnapshot = await firestore.doc(`users/${request.auth.uid}`).get();
  const profile = profileSnapshot.data() || {};
  const isBootstrapSuperAdmin = email === BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const isApprovedEmployee =
    isBootstrapSuperAdmin ||
    (profile.status === "approved" && profile.role !== "supplier");
  const isAdmin =
    isBootstrapSuperAdmin ||
    (isApprovedEmployee && ["admin", "superAdmin"].includes(profile.role));

  if (!isApprovedEmployee || (adminOnly && !isAdmin)) {
    throw new HttpsError(
      "permission-denied",
      adminOnly
        ? "Only an approved administrator can send a Twilio test message."
        : "Your account is not approved to send customer messages.",
    );
  }

  return {
    email,
    isAdmin,
    profile,
    userId: request.auth.uid,
  };
}

async function writeTwilioMessageLog(data) {
  try {
    await getFirestore().collection(TWILIO_MESSAGE_LOG_COLLECTION).add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Unable to write Twilio message log", {
      error: error?.message || String(error),
      messageType: data.messageType,
      status: data.status,
    });
  }
}

const DELIVERY_MESSAGE_TIME_ZONE = "America/Boise";
const ACTIVE_MESSAGE_STATUSES = new Set([
  "accepted",
  "delivered",
  "queued",
  "sending",
  "sent",
]);

function getDateKeyInTimeZone(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DELIVERY_MESSAGE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function formatDeliveryDate(value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return "a date to be confirmed";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(cleanValue)
    ? new Date(`${cleanValue}T18:00:00.000Z`)
    : new Date(cleanValue);

  if (Number.isNaN(date.getTime())) return cleanValue;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: DELIVERY_MESSAGE_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDeliveryCompletionDate(value) {
  const date = new Date(value || Date.now());

  if (Number.isNaN(date.getTime())) return "today";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: DELIVERY_MESSAGE_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function deliveryIsComplete(delivery) {
  return (
    String(delivery?.status || "").toLowerCase() === "complete" ||
    Boolean(delivery?.deliveredAt || delivery?.completedAt || delivery?.delivered)
  );
}

function deliveryHasDriverAndTruck(delivery) {
  const assignments = Array.isArray(delivery?.dispatchAssignments)
    ? delivery.dispatchAssignments
    : [];
  const hasDriver = Boolean(
    String(delivery?.driver || delivery?.driverName || "").trim() ||
      (Array.isArray(delivery?.drivers) &&
        delivery.drivers.some((driver) => String(driver || "").trim())) ||
      assignments.some((assignment) => String(assignment?.driver || "").trim()),
  );
  const hasTruck = Boolean(
    String(
      delivery?.truck ||
        delivery?.vehicleId ||
        delivery?.vehicleTitle ||
        delivery?.vehicleBadge ||
        "",
    ).trim() ||
      assignments.some((assignment) =>
        String(
          assignment?.vehicleId ||
            assignment?.vehicleTitle ||
            assignment?.vehicleBadge ||
            "",
        ).trim(),
      ),
  );

  return hasDriver && hasTruck;
}

function deliveryIsScheduled(delivery) {
  return (
    !deliveryIsComplete(delivery) &&
    Boolean(String(delivery?.deliveryDate || "").trim()) &&
    deliveryHasDriverAndTruck(delivery)
  );
}

function getDeliveryPhotoUrls(delivery) {
  const photoValues = [
    delivery?.deliveryPhoto,
    ...(Array.isArray(delivery?.deliveryPhotos) ? delivery.deliveryPhotos : []),
    delivery?.hardwarePhoto,
    ...(Array.isArray(delivery?.hardwarePhotos) ? delivery.hardwarePhotos : []),
  ];

  return normalizeTwilioMediaUrls(
    photoValues.map((photo) =>
      typeof photo === "string"
        ? photo
        : String(photo?.url || photo?.dataUrl || "").trim(),
    ),
  );
}

function getAutomatedDeliveryMessageFields(delivery, messageType) {
  return {
    customer:
      String(delivery?.contactName || "").trim() ||
      String(delivery?.customerName || "").trim() ||
      "there",
    business:
      String(delivery?.businessName || "").trim() ||
      String(delivery?.customerName || "").trim() ||
      "your business",
    order: String(delivery?.orderNumber || "").trim(),
    date:
      messageType === "deliveryComplete"
        ? formatDeliveryCompletionDate(
            delivery?.deliveredAt || delivery?.completedAt || delivery?.updatedAt,
          )
        : formatDeliveryDate(delivery?.deliveryDate),
    address: String(delivery?.address || delivery?.deliveryAddress || "").trim(),
  };
}

function getAutomatedMessageConfiguration(settings, messageType) {
  const messageConfiguration = TWILIO_MESSAGE_TYPES[messageType];

  if (!settings?.enabled || !messageConfiguration) return null;

  const isEnabled =
    settings[messageConfiguration.enabledKey] ??
    messageConfiguration.defaultEnabled ??
    false;
  const template = String(
    settings[messageConfiguration.templateKey] ||
      messageConfiguration.defaultTemplate ||
      "",
  ).trim();

  return isEnabled && template ? { messageConfiguration, template } : null;
}

async function queueAutomatedTwilioMessage({
  settings,
  messageType,
  delivery,
  deliveryId,
  mediaUrls = [],
}) {
  const configuration = getAutomatedMessageConfiguration(settings, messageType);

  if (!configuration) {
    return { skipped: true, reason: "disabled" };
  }

  const toPhoneNumber = normalizePhoneNumber(
    delivery?.contactPhone || delivery?.phoneNumber || delivery?.phone,
  );

  if (delivery?.customerTextUpdatesEnabled !== true || !toPhoneNumber) {
    return { skipped: true, reason: "customer-not-eligible" };
  }

  const accountSid = String(settings.accountSid || "").trim();
  const messagingServiceSid = String(settings.messagingServiceSid || "").trim();
  const senderPhoneNumber = normalizePhoneNumber(settings.senderPhoneNumber);

  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid)) {
    throw new Error("The Twilio Account SID is missing or invalid.");
  }
  if (!/^MG[0-9a-fA-F]{32}$/.test(messagingServiceSid) && !senderPhoneNumber) {
    throw new Error("The Twilio sender is not configured.");
  }

  const messageBody = fillMessageTemplate(
    configuration.template,
    getAutomatedDeliveryMessageFields(delivery, messageType),
  );
  if (!messageBody || messageBody.length > 1600) {
    throw new Error(
      "The saved message template must contain between 1 and 1,600 characters.",
    );
  }

  const globalDeliveryPhotoUrl =
    messageType === "deliveryComplete"
      ? settings.deliveryCompleteGlobalPhoto?.url
      : "";
  const deliveryMediaUrls = normalizeTwilioMediaUrls(mediaUrls);
  const normalizedGlobalPhoto = normalizeTwilioMediaUrls([
    globalDeliveryPhotoUrl,
  ])[0];
  const normalizedMediaUrls = [
    ...deliveryMediaUrls.slice(0, normalizedGlobalPhoto ? 9 : 10),
    ...(normalizedGlobalPhoto ? [normalizedGlobalPhoto] : []),
  ];
  const formData = new URLSearchParams({ To: toPhoneNumber, Body: messageBody });

  if (/^MG[0-9a-fA-F]{32}$/.test(messagingServiceSid)) {
    formData.set("MessagingServiceSid", messagingServiceSid);
  } else {
    formData.set("From", senderPhoneNumber);
  }
  normalizedMediaUrls.forEach((mediaUrl) => formData.append("MediaUrl", mediaUrl));

  const logBase = {
    messageType,
    maskedTo: maskPhoneNumber(toPhoneNumber),
    orderNumber: String(delivery?.orderNumber || "").trim(),
    deliveryId,
    mediaCount: normalizedMediaUrls.length,
    sentBy: "delivery-automation",
    sentByEmail: "automation@capitallumber.co",
  };
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${accountSid}:${twilioAuthToken.value()}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    },
  );
  const responseText = await response.text();
  let responseData = {};

  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = {};
  }

  if (!response.ok) {
    const providerMessage = String(
      responseData.message || "Twilio rejected the message.",
    ).slice(0, 300);
    await writeTwilioMessageLog({
      ...logBase,
      status: "failed",
      provider: "twilio",
      providerCode: String(responseData.code || response.status),
      error: providerMessage,
    });
    throw new Error(`Twilio could not send the message: ${providerMessage}`);
  }

  const result = {
    providerMessageId: String(responseData.sid || ""),
    status: String(responseData.status || "queued"),
  };
  await writeTwilioMessageLog({
    ...logBase,
    ...result,
    provider: "twilio",
  });

  return result;
}

async function claimDeliveryMessage({
  deliveryReference,
  signature,
  signatureField,
  statusField,
  sentAtField,
  allowNewSignature = false,
}) {
  const firestore = getFirestore();

  return firestore.runTransaction(async (transaction) => {
    const deliverySnapshot = await transaction.get(deliveryReference);

    if (!deliverySnapshot.exists) return false;

    const currentDelivery = deliverySnapshot.data() || {};
    const currentSignature = String(currentDelivery[signatureField] || "");
    const currentStatus = String(currentDelivery[statusField] || "").toLowerCase();

    if (
      (currentSignature === signature && ACTIVE_MESSAGE_STATUSES.has(currentStatus)) ||
      (!allowNewSignature && currentDelivery[sentAtField])
    ) {
      return false;
    }

    transaction.update(deliveryReference, {
      [signatureField]: signature,
      [statusField]: "sending",
      [`${statusField.replace(/Status$/, "")}AttemptedAt`]:
        FieldValue.serverTimestamp(),
      [`${statusField.replace(/Status$/, "")}Error`]: FieldValue.delete(),
    });

    return true;
  });
}

async function sendDeliveryLifecycleMessage({
  deliveryReference,
  delivery,
  messageType,
  signature,
  signatureField,
  statusField,
  sentAtField,
  allowNewSignature = false,
  mediaUrls = [],
}) {
  const settingsSnapshot = await getFirestore().doc(TWILIO_SETTINGS_PATH).get();
  const settings = settingsSnapshot.data() || {};
  const configuration = getAutomatedMessageConfiguration(settings, messageType);
  const toPhoneNumber = normalizePhoneNumber(
    delivery?.contactPhone || delivery?.phoneNumber || delivery?.phone,
  );

  if (
    !configuration ||
    delivery?.customerTextUpdatesEnabled !== true ||
    !toPhoneNumber
  ) {
    return { skipped: true };
  }

  const didClaim = await claimDeliveryMessage({
    deliveryReference,
    signature,
    signatureField,
    statusField,
    sentAtField,
    allowNewSignature,
  });

  if (!didClaim) return { skipped: true };

  try {
    const result = await queueAutomatedTwilioMessage({
      settings,
      messageType,
      delivery,
      deliveryId: deliveryReference.id,
      mediaUrls,
    });

    if (result.skipped) {
      await deliveryReference.update({
        [statusField]: "skipped",
      });
      return result;
    }

    await deliveryReference.update({
      [statusField]: result.status || "queued",
      [sentAtField]: FieldValue.serverTimestamp(),
      [`${statusField.replace(/Status$/, "")}ProviderMessageId`]:
        result.providerMessageId || "",
      [`${statusField.replace(/Status$/, "")}Error`]: FieldValue.delete(),
    });

    logger.info("Automated delivery text queued", {
      deliveryId: deliveryReference.id,
      messageType,
      orderNumber: delivery?.orderNumber || "",
    });
    return result;
  } catch (error) {
    await deliveryReference.update({
      [statusField]: "failed",
      [`${statusField.replace(/Status$/, "")}Error`]: String(
        error?.message || "Unable to send the automated delivery text.",
      ).slice(0, 500),
    });
    logger.error("Unable to send automated delivery text", {
      deliveryId: deliveryReference.id,
      messageType,
      error: error?.message || String(error),
    });
    return { failed: true };
  }
}

function normalizeOrderKey(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function getDocumentIds(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean),
    ),
  );
}

function isWillCallOrder(orderBuild) {
  const handoffType = String(
    orderBuild?.handoffType || orderBuild?.orderMethod || "",
  )
    .trim()
    .toLowerCase();

  return handoffType === "willcall" || handoffType === "will call";
}

function getRelevantSourceItems(sourceRecord, orderNumber) {
  const items = Array.isArray(sourceRecord?.items) ? sourceRecord.items : [];
  const orderKey = normalizeOrderKey(orderNumber);

  if (!orderKey) return items;

  const matchingItems = items.filter(
    (item) =>
      normalizeOrderKey(
        item?.orderNumber || item?.internalReference || item?.sourceOrderNumber,
      ) === orderKey,
  );

  return matchingItems.length > 0 ? matchingItems : items;
}

function getReceivedSourceItemCount(checkInDocuments, itemIdsField) {
  const receivedItemIds = new Set();
  let receivedItemsWithoutIds = 0;

  checkInDocuments.forEach((checkInDocument) => {
    const checkIn = checkInDocument.data() || {};

    (Array.isArray(checkIn[itemIdsField]) ? checkIn[itemIdsField] : [])
      .map((itemId) => String(itemId || "").trim())
      .filter(Boolean)
      .forEach((itemId) => receivedItemIds.add(itemId));

    const materials = Array.isArray(checkIn.materials)
      ? checkIn.materials
      : Array.isArray(checkIn.items)
        ? checkIn.items
        : [];

    materials.forEach((material) => {
      const sourceItemId = String(material?.sourceItemId || "").trim();

      if (sourceItemId) receivedItemIds.add(sourceItemId);
      else receivedItemsWithoutIds += 1;
    });
  });

  return { receivedItemIds, receivedItemsWithoutIds };
}

async function sourceRecordIsFullyCheckedIn({
  firestore,
  collectionName,
  sourceId,
  checkInSourceField,
  checkInItemIdsField,
  orderNumber,
}) {
  const sourceSnapshot = await firestore
    .collection(collectionName)
    .doc(sourceId)
    .get();

  if (!sourceSnapshot.exists) return false;

  const expectedItems = getRelevantSourceItems(
    sourceSnapshot.data() || {},
    orderNumber,
  );

  if (expectedItems.length === 0) return false;

  const checkInSnapshot = await firestore
    .collection("checkIns")
    .where(checkInSourceField, "==", sourceId)
    .get();

  if (checkInSnapshot.empty) return false;

  const { receivedItemIds, receivedItemsWithoutIds } =
    getReceivedSourceItemCount(checkInSnapshot.docs, checkInItemIdsField);
  const expectedItemIds = expectedItems
    .map((item) => String(item?.id || "").trim())
    .filter(Boolean);

  if (expectedItemIds.length === expectedItems.length) {
    return expectedItemIds.every((itemId) => receivedItemIds.has(itemId));
  }

  return receivedItemIds.size + receivedItemsWithoutIds >= expectedItems.length;
}

async function willCallOrderIsFullyCheckedIn(orderBuild) {
  const firestore = getFirestore();
  const orderNumber = String(orderBuild?.orderNumber || "").trim();
  const southRunIds = getDocumentIds(orderBuild?.linkedSouthRunIds);
  const theirTruckPOIds = getDocumentIds(orderBuild?.linkedTheirTruckPOIds);
  const sourceChecks = [
    ...southRunIds.map((sourceId) =>
      sourceRecordIsFullyCheckedIn({
        firestore,
        collectionName: "supplierRuns",
        sourceId,
        checkInSourceField: "sourceSupplierRunId",
        checkInItemIdsField: "sourceSupplierRunItemIds",
        orderNumber,
      }),
    ),
    ...theirTruckPOIds.map((sourceId) =>
      sourceRecordIsFullyCheckedIn({
        firestore,
        collectionName: "theirTruckPOs",
        sourceId,
        checkInSourceField: "sourceTheirTruckPOId",
        checkInItemIdsField: "sourceTheirTruckItemIds",
        orderNumber,
      }),
    ),
  ];

  if (sourceChecks.length === 0) return false;

  const results = await Promise.all(sourceChecks);
  return results.every(Boolean);
}

async function getWillCallOrderBuildsForCheckIn(checkIn) {
  const firestore = getFirestore();
  const orderBuilds = firestore.collection("orderBuilds");
  const sourceSupplierRunId = String(
    checkIn?.sourceSupplierRunId || "",
  ).trim();
  const sourceTheirTruckPOId = String(
    checkIn?.sourceTheirTruckPOId || "",
  ).trim();
  const orderNumber = String(
    checkIn?.orderAssignment?.internalReference ||
      checkIn?.sourceTheirTruckOrderNumber ||
      checkIn?.orderNumber ||
      "",
  ).trim();
  const lookups = [];

  if (sourceSupplierRunId) {
    lookups.push(
      orderBuilds
        .where("linkedSouthRunIds", "array-contains", sourceSupplierRunId)
        .get(),
    );
  }
  if (sourceTheirTruckPOId) {
    lookups.push(
      orderBuilds
        .where("linkedTheirTruckPOIds", "array-contains", sourceTheirTruckPOId)
        .get(),
    );
  }
  if (orderNumber) {
    lookups.push(orderBuilds.where("orderNumber", "==", orderNumber).get());
  }

  if (lookups.length === 0) return [];

  const snapshots = await Promise.all(lookups);
  const matchingDocuments = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((document) => {
      if (isWillCallOrder(document.data())) {
        matchingDocuments.set(document.id, document);
      }
    });
  });

  return [...matchingDocuments.values()];
}

exports.sendWillCallReadyMessages = onDocumentWritten(
  {
    document: "checkIns/{checkInId}",
    region: "us-central1",
    secrets: [twilioAuthToken],
  },
  async (event) => {
    const afterSnapshot = event.data?.after;

    if (!afterSnapshot?.exists) return;

    const checkIn = afterSnapshot.data() || {};
    const orderBuildDocuments = await getWillCallOrderBuildsForCheckIn(checkIn);

    for (const orderBuildDocument of orderBuildDocuments) {
      const orderBuild = orderBuildDocument.data() || {};
      const orderStatus = String(orderBuild.status || "").trim().toLowerCase();

      if (orderStatus === "complete" || orderStatus === "archived") continue;
      if (!(await willCallOrderIsFullyCheckedIn(orderBuild))) continue;

      if (!orderBuild.willCallReadyAt) {
        await orderBuildDocument.ref.set(
          {
            willCallReadyAt: FieldValue.serverTimestamp(),
            willCallReadyCheckInId: afterSnapshot.id,
          },
          { merge: true },
        );
      }

      const result = await sendDeliveryLifecycleMessage({
        deliveryReference: orderBuildDocument.ref,
        delivery: orderBuild,
        messageType: "willCall",
        signature: "ready-for-pickup",
        signatureField: "willCallTextSignature",
        statusField: "willCallTextStatus",
        sentAtField: "willCallTextSentAt",
      });

      logger.info("Will Call readiness reviewed", {
        orderBuildId: orderBuildDocument.id,
        orderNumber: orderBuild.orderNumber || "",
        checkInId: afterSnapshot.id,
        skipped: result?.skipped === true,
        failed: result?.failed === true,
      });
    }
  },
);

exports.sendDeliveryLifecycleMessages = onDocumentUpdated(
  {
    document: "deliveries/{deliveryId}",
    region: "us-central1",
    secrets: [twilioAuthToken],
  },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const deliveryReference = event.data?.after?.ref;

    if (!deliveryReference) return;

    const scheduledNow = deliveryIsScheduled(after);
    const wasScheduled = deliveryIsScheduled(before);
    const deliveryDate = String(after.deliveryDate || "").trim();
    const previousDeliveryDate = String(before.deliveryDate || "").trim();

    if (
      scheduledNow &&
      (!wasScheduled || deliveryDate !== previousDeliveryDate)
    ) {
      await sendDeliveryLifecycleMessage({
        deliveryReference,
        delivery: after,
        messageType: "scheduledDelivery",
        signature: deliveryDate,
        signatureField: "scheduledDeliveryTextSignature",
        statusField: "scheduledDeliveryTextStatus",
        sentAtField: "scheduledDeliveryTextSentAt",
        allowNewSignature: true,
      });
    }

    const beforePhotos = getDeliveryPhotoUrls(before);
    const afterPhotos = getDeliveryPhotoUrls(after);
    const completedNow = deliveryIsComplete(after);
    const wasComplete = deliveryIsComplete(before);

    if (
      completedNow &&
      afterPhotos.length > 0 &&
      (!wasComplete || beforePhotos.length === 0)
    ) {
      await sendDeliveryLifecycleMessage({
        deliveryReference,
        delivery: after,
        messageType: "deliveryComplete",
        signature: "complete",
        signatureField: "deliveryCompleteTextSignature",
        statusField: "deliveryCompleteTextStatus",
        sentAtField: "deliveryCompleteTextSentAt",
        mediaUrls: afterPhotos,
      });
    }
  },
);

exports.sendDeliveryTodayMessages = onSchedule(
  {
    schedule: "0 7 * * *",
    timeZone: DELIVERY_MESSAGE_TIME_ZONE,
    region: "us-central1",
    secrets: [twilioAuthToken],
  },
  async () => {
    const deliveryDate = getDateKeyInTimeZone();
    const deliverySnapshot = await getFirestore()
      .collection("deliveries")
      .where("deliveryDate", "==", deliveryDate)
      .get();
    const results = {
      reviewed: deliverySnapshot.size,
      eligible: 0,
      queued: 0,
      skipped: 0,
      failed: 0,
    };

    for (const deliveryDocument of deliverySnapshot.docs) {
      const delivery = deliveryDocument.data() || {};

      if (!deliveryIsScheduled(delivery)) {
        results.skipped += 1;
        continue;
      }

      results.eligible += 1;
      const result = await sendDeliveryLifecycleMessage({
        deliveryReference: deliveryDocument.ref,
        delivery,
        messageType: "deliveryToday",
        signature: deliveryDate,
        signatureField: "deliveryTodayTextSignature",
        statusField: "deliveryTodayTextStatus",
        sentAtField: "deliveryTodayTextSentAt",
      });

      if (result?.failed) results.failed += 1;
      else if (result?.skipped) results.skipped += 1;
      else results.queued += 1;
    }

    logger.info("Delivery-today text run complete", {
      deliveryDate,
      ...results,
    });
  },
);

exports.claimSupplierInvitation = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in with the Google account that received this invitation.",
      );
    }

    const invitationId = String(request.data?.invitationId || "").trim();
    const userId = request.auth.uid;
    const signedInEmail = normalizedEmail(request.auth.token.email);

    if (!invitationId) {
      throw new HttpsError("invalid-argument", "The supplier invitation is missing.");
    }
    if (!signedInEmail) {
      throw new HttpsError(
        "failed-precondition",
        "The signed-in Google account does not have an email address.",
      );
    }

    const firestore = getFirestore();
    const invitationRef = firestore.doc(`supplierInvitations/${invitationId}`);
    const userRef = firestore.doc(`users/${userId}`);

    return firestore.runTransaction(async (transaction) => {
      const invitationSnapshot = await transaction.get(invitationRef);
      if (!invitationSnapshot.exists) {
        throw new HttpsError("not-found", "This supplier invitation no longer exists.");
      }

      const invitation = invitationSnapshot.data() || {};
      const invitationEmail = normalizedEmail(invitation.email);
      const invitationStatus = String(invitation.status || "pending");
      const isExistingClaim =
        invitationStatus === "claimed" && invitation.claimedBy === userId;

      if (invitationEmail !== signedInEmail) {
        throw new HttpsError(
          "permission-denied",
          `This invitation belongs to ${invitationEmail || "another email address"}. Sign in with that Google account.`,
        );
      }
      if (invitationStatus !== "pending" && !isExistingClaim) {
        throw new HttpsError(
          "failed-precondition",
          invitationStatus === "canceled"
            ? "This supplier invitation was canceled."
            : "This supplier invitation has already been used.",
        );
      }
      if (!invitation.vendorId || !invitation.vendorName) {
        throw new HttpsError(
          "failed-precondition",
          "This invitation is missing its vendor assignment. Ask Capital Lumber to create a new invitation.",
        );
      }

      const userSnapshot = await transaction.get(userRef);
      const existingProfile = userSnapshot.data() || {};
      const existingRole = String(existingProfile.role || "").trim();
      if (existingRole && !["pending", "supplier"].includes(existingRole)) {
        throw new HttpsError(
          "failed-precondition",
          "This Google account is already assigned to a Capital Lumber employee profile.",
        );
      }

      const now = FieldValue.serverTimestamp();
      const displayName =
        String(existingProfile.displayName || "").trim() ||
        String(invitation.contactName || "").trim() ||
        String(request.auth.token.name || "").trim();
      const profile = {
        uid: userId,
        email: signedInEmail,
        displayName,
        photoURL:
          String(existingProfile.photoURL || "").trim() ||
          String(request.auth.token.picture || "").trim(),
        role: "supplier",
        status: existingProfile.status === "approved" ? "approved" : "pending",
        workView: "supplier",
        employeeActive: false,
        driverName: "",
        vendorId: invitation.vendorId,
        vendorName: invitation.vendorName,
        permissions: ["supplier-chat"],
        supplierInvitationId: invitationId,
        supplierInvitedBy: invitation.createdBy || "",
        supplierInvitationClaimedAt: now,
        lastLoginAt: now,
        updatedAt: now,
      };
      if (!userSnapshot.exists) profile.createdAt = now;

      transaction.set(userRef, profile, { merge: true });
      if (!isExistingClaim) {
        transaction.update(invitationRef, {
          status: "claimed",
          claimedBy: userId,
          claimedAt: now,
          updatedAt: now,
        });
      }

      return {
        role: "supplier",
        status: profile.status,
        workView: "supplier",
        vendorId: invitation.vendorId,
        vendorName: invitation.vendorName,
      };
    });
  },
);

exports.diagnoseSupplierChatAccess = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before checking Supplier Chat.");
    }

    const firestore = getFirestore();
    const userId = request.auth.uid;
    const email = normalizedEmail(request.auth.token.email);
    const userSnapshot = await firestore.doc(`users/${userId}`).get();

    if (!userSnapshot.exists) {
      return {
        code: "SC-PROFILE-001",
        title: "Supplier profile is missing",
        message: "User Access does not contain a profile for this Google account.",
        action: "Ask an administrator to have the supplier reopen the original invitation link.",
        userId,
        email,
      };
    }

    const profile = userSnapshot.data() || {};
    const role = String(profile.role || "").trim();
    const status = String(profile.status || "").trim();
    const vendorId = String(profile.vendorId || "").trim();
    const vendorName = String(profile.vendorName || "").trim();
    const baseResult = {
      userId,
      email,
      role,
      status,
      workView: String(profile.workView || "").trim(),
      vendorId,
      vendorName,
    };

    if (role !== "supplier") {
      return {
        ...baseResult,
        code: "SC-PROFILE-002",
        title: "Account role is not Supplier",
        message: `User Access currently lists this account as ${role || "no role"}.`,
        action: "Set the role to Supplier; the Supplier work view and chat-only permission should follow automatically.",
      };
    }
    if (status !== "approved") {
      return {
        ...baseResult,
        code: "SC-PROFILE-003",
        title: "Supplier account is not approved",
        message: `User Access currently shows ${status || "no approval status"}.`,
        action: "Approve this supplier in User Access.",
      };
    }
    if (!vendorId) {
      return {
        ...baseResult,
        code: "SC-PROFILE-004",
        title: "Vendor assignment is missing",
        message: "The supplier profile is approved but has no vendor ID.",
        action: "Choose the supplier's vendor in User Access and save the profile.",
      };
    }

    const assignedSnapshot = await firestore
      .collection("supplierConversations")
      .where("supplierParticipantUids", "array-contains", userId)
      .get();
    const emailSnapshot = email
      ? await firestore
          .collection("supplierConversations")
          .where("supplierContactEmail", "==", email)
          .get()
      : { docs: [] };
    const matchingVendorCount = assignedSnapshot.docs.filter(
      (document) => String(document.data()?.vendorId || "") === vendorId,
    ).length;
    const authorizedConversationIds = assignedSnapshot.docs
      .filter(
        (document) => String(document.data()?.vendorId || "") === vendorId,
      )
      .map((document) => document.id);
    const counts = {
      assignedConversationCount: assignedSnapshot.size,
      matchingVendorConversationCount: matchingVendorCount,
      emailConversationCount: emailSnapshot.docs.length,
    };

    if (
      assignedSnapshot.empty &&
      emailSnapshot.docs.length === 0 &&
      request.data?.createIfMissing === true
    ) {
      const authenticationTime = Number(request.auth.token.auth_time || 0);
      const currentTime = Math.floor(Date.now() / 1000);
      if (
        !Number.isFinite(authenticationTime) ||
        authenticationTime <= 0 ||
        authenticationTime > currentTime + 60 ||
        currentTime - authenticationTime >= 30 * 60
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Unlock Supplier Chat again before starting a conversation.",
        );
      }

      const displayName =
        String(profile.displayName || "").trim() ||
        String(request.auth.token.name || "").trim() ||
        email ||
        "Supplier contact";
      const conversationRef = firestore.collection("supplierConversations").doc();
      const now = FieldValue.serverTimestamp();
      await conversationRef.set({
        vendorId,
        vendorName,
        title: `${vendorName} pricing`,
        participantUids: [userId],
        internalParticipantUids: [],
        supplierParticipantUids: [userId],
        supplierContactName: displayName,
        supplierContactEmail: email,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      });

      logger.info("Supplier started conversation", {
        conversationId: conversationRef.id,
        supplierUserId: userId,
        vendorId,
      });
      return {
        ...baseResult,
        assignedConversationCount: 1,
        matchingVendorConversationCount: 1,
        emailConversationCount: 1,
        authorizedConversationIds: [conversationRef.id],
        conversationId: conversationRef.id,
        created: true,
        code: "SC-ACCESS-002",
        title: "Conversation started",
        message: "The supplier conversation is ready.",
        action: "Send the first message to Capital Lumber.",
      };
    }

    if (assignedSnapshot.empty && emailSnapshot.docs.length > 0) {
      return {
        ...baseResult,
        ...counts,
        code: "SC-ASSIGNMENT-001",
        title: "Conversation is linked to an old account",
        message: "A conversation uses this email, but its supplier user ID does not match the current Google account.",
        action: "Open the conversation as an administrator and use Edit supplier access to assign this supplier account.",
      };
    }
    if (assignedSnapshot.empty) {
      return {
        ...baseResult,
        ...counts,
        code: "SC-ASSIGNMENT-002",
        title: "No conversation is assigned",
        message: "The supplier profile is valid, but no conversation includes this supplier account.",
        action: "Create a conversation or edit an existing conversation and assign this supplier contact.",
      };
    }
    if (matchingVendorCount === 0) {
      return {
        ...baseResult,
        ...counts,
        code: "SC-ASSIGNMENT-003",
        title: "Conversation vendor does not match",
        message: "The supplier is assigned to a conversation, but its vendor ID differs from User Access.",
        action: "Make the conversation vendor and the supplier's User Access vendor match.",
      };
    }

    return {
      ...baseResult,
      ...counts,
      authorizedConversationIds,
      code: "SC-ACCESS-001",
      title: "Profile and assignment are valid",
      message: "The supplier profile, vendor, and conversation assignment all match. Firestore rules or the refreshed Google session rejected the browser request.",
      action: "Deploy the latest Firestore rules, then sign out, sign back in, and unlock Supplier Chat again.",
    };
  },
);

exports.processSupplierAccountDeletion = onDocumentCreated(
  {
    document: "supplierAccountDeletionRequests/{requestId}",
    region: "us-central1",
    retry: false,
  },
  async (event) => {
    const requestSnapshot = event.data;
    if (!requestSnapshot) return;

    const deletionRequest = requestSnapshot.data() || {};
    const supplierUserId = String(deletionRequest.targetUserId || "").trim();
    const createdBy = String(deletionRequest.createdBy || "").trim();
    const firestore = getFirestore();

    try {
      if (!supplierUserId || !createdBy || supplierUserId === createdBy) {
        throw new Error("The supplier deletion request is invalid.");
      }

      const callerSnapshot = await firestore.doc(`users/${createdBy}`).get();
      const callerProfile = callerSnapshot.data() || {};
      const callerEmail = normalizedEmail(callerProfile.email);
      const isSuperAdmin =
        callerProfile.role === "superAdmin" ||
        callerEmail === BOOTSTRAP_SUPER_ADMIN_EMAIL;
      if (callerProfile.status !== "approved" || !isSuperAdmin) {
        throw new Error(
          "Only an approved super administrator can delete supplier accounts.",
        );
      }

      const supplierRef = firestore.doc(`users/${supplierUserId}`);
      const supplierSnapshot = await supplierRef.get();
      if (!supplierSnapshot.exists) {
        throw new Error("That supplier account no longer exists.");
      }

      const supplierProfile = supplierSnapshot.data() || {};
      if (supplierProfile.role !== "supplier") {
        throw new Error(
          "Only supplier portal accounts can be deleted with this action.",
        );
      }

      await requestSnapshot.ref.update({
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
      });

      const conversationsSnapshot = await firestore
        .collection("supplierConversations")
        .where("supplierParticipantUids", "array-contains", supplierUserId)
        .get();
      for (const conversationDocument of conversationsSnapshot.docs) {
        await firestore.recursiveDelete(conversationDocument.ref);
      }

      const supplierEmail = normalizedEmail(supplierProfile.email);
      let deletedInvitations = 0;
      if (supplierEmail) {
        const invitationsSnapshot = await firestore
          .collection("supplierInvitations")
          .where("email", "==", supplierEmail)
          .get();
        for (const invitationDocument of invitationsSnapshot.docs) {
          await invitationDocument.ref.delete();
          deletedInvitations += 1;
        }
      }

      try {
        await getAuth().deleteUser(supplierUserId);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }

      await supplierRef.delete();
      await requestSnapshot.ref.update({
        status: "completed",
        deletedConversations: conversationsSnapshot.size,
        deletedInvitations,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Supplier account deleted", {
        supplierUserId,
        deletedConversations: conversationsSnapshot.size,
        deletedInvitations,
        deletedBy: createdBy,
      });
    } catch (error) {
      logger.error("Unable to delete supplier account", {
        supplierUserId,
        createdBy,
        error: error?.message || String(error),
      });
      await requestSnapshot.ref.update({
        status: "failed",
        error: String(
          error?.message || "The supplier account could not be deleted.",
        ).slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function invitationEmail({ contactName, vendorName, invitationUrl }) {
  const safeContactName = escapeHtml(contactName || "there");
  const safeVendorName = escapeHtml(vendorName || "your company");
  const safeInvitationUrl = escapeHtml(invitationUrl);

  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;">
            <p style="margin:0 0 10px;color:#fc2c38;font-size:12px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;">Capital Lumber Supplier Chat</p>
            <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;">You're invited to a secure supplier conversation</h1>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${safeContactName},</p>
            <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">Capital Lumber invited you to discuss pricing, availability, and product details for <strong>${safeVendorName}</strong>.</p>
            <a href="${safeInvitationUrl}" style="display:inline-block;border-radius:12px;background:#fc2c38;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:800;">Open Capital Lumber</a>
            <div style="margin-top:24px;border-radius:12px;background:#f1f5f9;padding:16px;font-size:14px;line-height:1.6;color:#475569;">
              Sign in with the Google account that received this invitation. Capital Lumber must approve the account before supplier messages or pricing become visible.
            </div>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">If you were not expecting this invitation, you can ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

exports.sendSupplierInvitation = onDocumentCreated(
  {
    document: "supplierInvitations/{invitationId}",
    region: "us-central1",
    secrets: [resendApiKey],
    retry: false,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const invitation = snapshot.data();
    const invitationId = event.params.invitationId;
    const email = String(invitation.email || "").trim().toLowerCase();

    const currentSnapshot = await snapshot.ref.get();
    if (!currentSnapshot.exists || currentSnapshot.data()?.status !== "pending") {
      logger.info("Skipping a canceled supplier invitation", { invitationId });
      return;
    }

    if (!email || !email.includes("@")) {
      await snapshot.ref.update({
        emailStatus: "failed",
        emailError: "Invitation email address is invalid.",
        emailLastAttemptAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    await snapshot.ref.update({
      emailStatus: "sending",
      emailError: FieldValue.delete(),
      emailLastAttemptAt: FieldValue.serverTimestamp(),
    });

    const invitationUrl = new URL(appBaseUrl.value());
    invitationUrl.searchParams.set("supplierInvite", invitationId);
    const resend = new Resend(resendApiKey.value());

    try {
      const { data, error } = await resend.emails.send(
        {
          from: supplierChatFromEmail.value(),
          to: [email],
          subject: `${invitation.vendorName || "Supplier"} invitation from Capital Lumber`,
          html: invitationEmail({
            contactName: invitation.contactName,
            vendorName: invitation.vendorName,
            invitationUrl: invitationUrl.toString(),
          }),
        },
        { idempotencyKey: `supplier-invitation/${invitationId}` },
      );

      if (error) throw new Error(error.message || "Resend rejected the email.");

      await snapshot.ref.update({
        emailStatus: "sent",
        emailProvider: "resend",
        emailProviderId: data?.id || "",
        emailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error("Unable to send supplier invitation", {
        invitationId,
        error: error?.message || String(error),
      });
      await snapshot.ref.update({
        emailStatus: "failed",
        emailError: String(error?.message || "Unable to send invitation.").slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

exports.createOrderSummary = onCall(
  { region: "us-central1", memory: "512MiB" },
  async (request) => {
    const caller = await getTwilioCaller(request);
    const orderId = String(request.data?.orderId || "").trim();

    if (!orderId || orderId.length > 160 || orderId.includes("/")) {
      throw new HttpsError("invalid-argument", "Choose a valid processed order.");
    }

    const firestore = getFirestore();
    const orderReference = firestore.doc(`salesOrders/${orderId}`);
    const orderSnapshot = await orderReference.get();

    if (!orderSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "The processed order could not be found for its PDF summary.",
      );
    }

    const order = { id: orderSnapshot.id, ...orderSnapshot.data() };
    if (order.customerTextUpdatesEnabled !== true) {
      throw new HttpsError(
        "failed-precondition",
        "The customer has not opted in to text updates for this order.",
      );
    }

    const toPhoneNumber = normalizePhoneNumber(
      order.contactPhone || order.phoneNumber || order.phone,
    );
    if (!toPhoneNumber) {
      throw new HttpsError(
        "failed-precondition",
        "The order needs a valid customer mobile number before its summary can be texted.",
      );
    }

    const existingSummaryUrl = String(order.orderSummary?.url || "").trim();
    if (existingSummaryUrl.startsWith("https://")) {
      const shortSummaryUrl = await ensureOrderSummaryShortLink({
        firestore,
        orderReference,
        orderId,
        orderSummary: order.orderSummary,
        targetUrl: existingSummaryUrl,
      });
      return {
        summaryUrl: shortSummaryUrl,
        toPhoneNumber,
        customer: String(order.contactName || order.customerName || "there").trim(),
        business: String(order.businessName || order.customerName || "your business").trim(),
        order: String(order.orderNumber || "").trim(),
        date: String(order.createdAt || "").trim(),
        address: String(order.deliveryAddress || order.address || "").trim(),
        reused: true,
      };
    }

    let pdfBuffer;
    try {
      pdfBuffer = await generateOrderSummaryPdf(order);
    } catch (error) {
      logger.error("Unable to generate order summary PDF", {
        orderId,
        error: error?.message || String(error),
        requestedBy: caller.userId,
      });
      throw new HttpsError(
        "internal",
        "The customer order summary PDF could not be generated.",
      );
    }

    const downloadToken = randomUUID();
    const fileId = randomUUID();
    const safeOrderNumber = String(order.orderNumber || "order")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .slice(0, 80);
    const filePath = `order-summaries/${orderId}/${safeOrderNumber}-${fileId}.pdf`;
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);

    try {
      await file.save(pdfBuffer, {
        resumable: false,
        contentType: "application/pdf",
        metadata: {
          cacheControl: "private, max-age=3600",
          contentDisposition: `inline; filename="Capital-Lumber-Order-${safeOrderNumber}.pdf"`,
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
            orderId,
            generatedBy: caller.userId,
          },
        },
      });
    } catch (error) {
      logger.error("Unable to store order summary PDF", {
        orderId,
        error: error?.message || String(error),
        requestedBy: caller.userId,
      });
      throw new HttpsError(
        "unavailable",
        "The customer order summary could not be stored. Try again in a moment.",
      );
    }

    const summaryUrl =
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
      `/o/${encodeURIComponent(filePath)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
    const generatedAt = new Date().toISOString();

    await orderReference.set(
      {
        orderSummary: {
          url: summaryUrl,
          path: filePath,
          generatedAt,
          generatedBy: caller.userId,
          generatedByEmail: caller.email,
        },
        updatedAt: generatedAt,
      },
      { merge: true },
    );

    const shortSummaryUrl = await ensureOrderSummaryShortLink({
      firestore,
      orderReference,
      orderId,
      orderSummary: {},
      targetUrl: summaryUrl,
    });

    logger.info("Customer order summary PDF created", {
      orderId,
      filePath,
      requestedBy: caller.userId,
    });

    return {
      summaryUrl: shortSummaryUrl,
      toPhoneNumber,
      customer: String(order.contactName || order.customerName || "there").trim(),
      business: String(order.businessName || order.customerName || "your business").trim(),
      order: String(order.orderNumber || "").trim(),
      date: String(order.createdAt || "").trim(),
      address: String(order.deliveryAddress || order.address || "").trim(),
      reused: false,
    };
  },
);

exports.orderSummaryRedirect = onRequest(
  { region: "us-central1" },
  async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.set("Allow", "GET, HEAD");
      response.status(405).send("Method not allowed");
      return;
    }

    const shortToken = String(request.query.token || "").trim();
    if (!/^[A-Za-z0-9_-]{20,32}$/.test(shortToken)) {
      response.status(404).send("Order summary not found");
      return;
    }

    const linkSnapshot = await getFirestore()
      .doc(`orderSummaryLinks/${shortToken}`)
      .get();
    const link = linkSnapshot.data() || {};
    const targetUrl = String(link.targetUrl || "").trim();

    if (!linkSnapshot.exists || link.active !== true || !isAllowedOrderSummaryTarget(targetUrl)) {
      response.status(404).send("Order summary not found");
      return;
    }

    response.set("Cache-Control", "private, no-store, max-age=0");
    response.set("Referrer-Policy", "no-referrer");
    response.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.redirect(302, targetUrl);
  },
);

function normalizeOrderSummaryPreviewDraft(value) {
  const draft = value && typeof value === "object" ? value : {};
  const orderNumber = String(draft.orderNumber || "").trim();
  const orderDigits = orderNumber.replace(/\D/g, "");

  if (orderDigits.length !== 6) {
    throw new HttpsError(
      "invalid-argument",
      "Enter the unique six-digit order number before previewing the PDF.",
    );
  }

  const cleanText = (input, maxLength = 300) =>
    String(input ?? "").trim().slice(0, maxLength);
  const items = (Array.isArray(draft.items) ? draft.items : [])
    .slice(0, 250)
    .map((item) => ({
      quantity: cleanText(item?.quantity, 40),
      itemNumber: cleanText(item?.itemNumber, 100),
      description: cleanText(item?.description, 800),
      path: cleanText(item?.path || item?.fulfillmentPath, 80),
      fulfillmentPath: cleanText(item?.fulfillmentPath || item?.path, 80),
      poNumber: cleanText(item?.poNumber, 100),
      vendor: cleanText(item?.vendor, 200),
    }));

  if (items.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Add at least one order item before previewing the PDF.",
    );
  }

  return {
    orderNumber,
    customerName: cleanText(draft.customerName, 200),
    businessName: cleanText(draft.businessName, 200),
    contactName: cleanText(draft.customerName || draft.contactName, 200),
    contactPhone: cleanText(draft.phoneNumber || draft.contactPhone, 40),
    phoneNumber: cleanText(draft.phoneNumber, 40),
    accountNumber: cleanText(draft.accountNumber, 80),
    orderedBy: cleanText(draft.orderedBy, 160),
    orderMethod: cleanText(draft.orderMethod, 80),
    handoffType: cleanText(draft.orderMethod || draft.handoffType, 80),
    deliveryAddress: cleanText(draft.deliveryAddress, 500),
    deliveryDate: cleanText(draft.deliveryDate, 80),
    deliveryNotes: cleanText(draft.deliveryNotes, 2_000),
    createdAt: new Date().toISOString(),
    items,
  };
}

exports.previewOrderSummary = onCall(
  { region: "us-central1" },
  async (request) => {
    const caller = await getTwilioCaller(request);
    const order = normalizeOrderSummaryPreviewDraft(request.data?.order);

    try {
      const pdfBuffer = await generateOrderSummaryPdf(order);
      const safeOrderNumber = String(order.orderNumber || "order")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .slice(0, 80);

      logger.info("Draft customer order summary PDF preview created", {
        orderNumber: order.orderNumber,
        requestedBy: caller.userId,
      });

      return {
        pdfBase64: pdfBuffer.toString("base64"),
        fileName: `Capital-Lumber-Order-${safeOrderNumber}-Draft.pdf`,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;

      logger.error("Unable to generate draft order summary PDF preview", {
        orderNumber: order.orderNumber,
        error: error?.message || String(error),
        requestedBy: caller.userId,
      });
      throw new HttpsError(
        "internal",
        "The draft order summary PDF could not be generated.",
      );
    }
  },
);

exports.sendTwilioMessage = onCall(
  {
    region: "us-central1",
    secrets: [twilioAuthToken],
  },
  async (request) => {
    const messageType = String(request.data?.messageType || "").trim();
    const isTestMessage = messageType === "test";
    const isTemplateTest = request.data?.templateTest === true;
    const caller = await getTwilioCaller(request, {
      adminOnly: isTestMessage || isTemplateTest,
    });
    const toPhoneNumber = normalizePhoneNumber(request.data?.toPhoneNumber);

    if (!toPhoneNumber) {
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid customer phone number, including the area code.",
      );
    }

    const firestore = getFirestore();
    const settingsSnapshot = await firestore.doc(TWILIO_SETTINGS_PATH).get();
    const settings = settingsSnapshot.data() || {};
    const accountSid = String(settings.accountSid || "").trim();
    const messagingServiceSid = String(
      settings.messagingServiceSid || "",
    ).trim();
    const senderPhoneNumber = normalizePhoneNumber(settings.senderPhoneNumber);
    const maskedTo = maskPhoneNumber(toPhoneNumber);
    const globalDeliveryPhotoUrl =
      messageType === "deliveryComplete"
        ? settings.deliveryCompleteGlobalPhoto?.url
        : "";
    const mediaUrls = normalizeTwilioMediaUrls([
      ...(Array.isArray(request.data?.mediaUrls) ? request.data.mediaUrls : []),
      globalDeliveryPhotoUrl,
    ]);

    if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid)) {
      throw new HttpsError(
        "failed-precondition",
        "The Twilio Account SID is missing or invalid in Admin settings.",
      );
    }
    if (
      !/^MG[0-9a-fA-F]{32}$/.test(messagingServiceSid) &&
      !senderPhoneNumber
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Add a Messaging Service SID or sender phone number in Admin settings.",
      );
    }

    let messageBody = "";
    if (isTestMessage) {
      messageBody = `${String(settings.businessName || "Capital Lumber").trim() || "Capital Lumber"} Twilio test message. Messaging is connected and ready.`;
    } else {
      const messageConfiguration = TWILIO_MESSAGE_TYPES[messageType];
      if (!messageConfiguration) {
        throw new HttpsError(
          "invalid-argument",
          "Choose a supported customer message type.",
        );
      }
      if (!isTemplateTest && !settings.enabled) {
        throw new HttpsError(
          "failed-precondition",
          "Customer texting is disabled in Twilio Messaging settings.",
        );
      }
      const isMessageTypeEnabled =
        settings[messageConfiguration.enabledKey] ??
        messageConfiguration.defaultEnabled ??
        false;
      if (!isTemplateTest && !isMessageTypeEnabled) {
        throw new HttpsError(
          "failed-precondition",
          "That customer message type is disabled in Twilio Messaging settings.",
        );
      }

      const templateTestOverride = isTemplateTest
        ? String(request.data?.messageTemplate || "").trim()
        : "";
      messageBody = fillMessageTemplate(
        templateTestOverride ||
          settings[messageConfiguration.templateKey] ||
          messageConfiguration.defaultTemplate,
        {
          customer: request.data?.customer,
          business: request.data?.business,
          order: request.data?.order,
          date: request.data?.date,
          address: request.data?.address,
          summaryUrl: request.data?.summaryUrl,
        },
      );
    }

    if (!messageBody || messageBody.length > 1600) {
      throw new HttpsError(
        "failed-precondition",
        "The saved message template must contain between 1 and 1,600 characters.",
      );
    }

    const formData = new URLSearchParams({
      To: toPhoneNumber,
      Body: messageBody,
    });
    if (/^MG[0-9a-fA-F]{32}$/.test(messagingServiceSid)) {
      formData.set("MessagingServiceSid", messagingServiceSid);
    } else {
      formData.set("From", senderPhoneNumber);
    }
    mediaUrls.forEach((mediaUrl) => formData.append("MediaUrl", mediaUrl));

    const logBase = {
      messageType: isTemplateTest ? `${messageType}Test` : messageType,
      maskedTo,
      orderNumber: String(request.data?.order || "").trim(),
      deliveryId: String(request.data?.deliveryId || "").trim(),
      mediaCount: mediaUrls.length,
      sentBy: caller.userId,
      sentByEmail: caller.email,
      templateTest: isTemplateTest,
    };

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${accountSid}:${twilioAuthToken.value()}`,
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        },
      );
      const responseText = await response.text();
      let responseData = {};
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = {};
      }

      if (!response.ok) {
        const providerMessage = String(
          responseData.message || "Twilio rejected the message.",
        ).slice(0, 300);
        await writeTwilioMessageLog({
          ...logBase,
          status: "failed",
          provider: "twilio",
          providerCode: String(responseData.code || response.status),
          error: providerMessage,
        });
        logger.error("Twilio rejected a message", {
          messageType,
          providerCode: responseData.code || response.status,
          sentBy: caller.userId,
        });
        throw new HttpsError(
          "internal",
          `Twilio could not send the message: ${providerMessage}`,
        );
      }

      await writeTwilioMessageLog({
        ...logBase,
        status: String(responseData.status || "queued"),
        provider: "twilio",
        providerMessageId: String(responseData.sid || ""),
      });
      logger.info("Twilio message queued", {
        messageType,
        providerMessageId: responseData.sid || "",
        sentBy: caller.userId,
      });

      return {
        maskedTo,
        messageType,
        templateTest: isTemplateTest,
        mediaCount: mediaUrls.length,
        providerMessageId: String(responseData.sid || ""),
        status: String(responseData.status || "queued"),
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;

      await writeTwilioMessageLog({
        ...logBase,
        status: "failed",
        provider: "twilio",
        error: String(error?.message || "Unable to reach Twilio.").slice(
          0,
          300,
        ),
      });
      logger.error("Unable to reach Twilio", {
        messageType,
        error: error?.message || String(error),
        sentBy: caller.userId,
      });
      throw new HttpsError(
        "unavailable",
        "Twilio could not be reached. Try again in a moment.",
      );
    }
  },
);
