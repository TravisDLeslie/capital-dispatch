const { createHash, randomBytes, randomUUID } = require("node:crypto");
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

function normalizeCustomerAccountRequest(value) {
  const requestData = value && typeof value === "object" ? value : {};
  const hasExistingAccount = requestData.hasExistingAccount === true;
  const accountNumber = String(requestData.accountNumber || "").trim();
  const name = String(requestData.name || "").trim();
  const businessName = String(requestData.businessName || "").trim();
  const address = String(requestData.address || "").trim();
  const phone = normalizePhoneNumber(requestData.phone);
  const email = normalizedEmail(requestData.email);
  const website = String(requestData.website || "").trim();

  if (website) {
    return { isSpam: true };
  }

  if (hasExistingAccount && (!accountNumber || accountNumber.length > 40)) {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid Capital Lumber account number.",
    );
  }
  if (!name || name.length > 120) {
    throw new HttpsError("invalid-argument", "Enter your full name.");
  }
  if (!businessName || businessName.length > 160) {
    throw new HttpsError("invalid-argument", "Enter your business name.");
  }
  if (!address || address.length > 300) {
    throw new HttpsError("invalid-argument", "Enter your business address.");
  }
  if (!phone) {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid phone number with area code.",
    );
  }
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }

  return {
    hasExistingAccount,
    accountNumber: hasExistingAccount ? accountNumber : "",
    name,
    businessName,
    address,
    phone,
    email,
    isSpam: false,
  };
}

async function enforceCustomerAccountRequestRateLimit(request, firestore) {
  const sourceAddress = String(
    request.rawRequest?.ip ||
      request.rawRequest?.headers?.["x-forwarded-for"] ||
      "unknown",
  )
    .split(",")[0]
    .trim();
  const sourceHash = createHash("sha256")
    .update(`${sourceAddress}:customer-account-request`)
    .digest("hex");
  const rateLimitReference = firestore.doc(
    `customerAccountRequestRateLimits/${sourceHash}`,
  );
  const now = Date.now();
  const windowLengthMs = 15 * 60 * 1000;

  await firestore.runTransaction(async (transaction) => {
    const rateLimitSnapshot = await transaction.get(rateLimitReference);
    const rateLimit = rateLimitSnapshot.data() || {};
    const windowStartedAt = Number(rateLimit.windowStartedAt) || 0;
    const isCurrentWindow = now - windowStartedAt < windowLengthMs;
    const requestCount = isCurrentWindow
      ? Number(rateLimit.requestCount) || 0
      : 0;

    if (requestCount >= 5) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many account requests were submitted. Try again later.",
      );
    }

    transaction.set(rateLimitReference, {
      requestCount: requestCount + 1,
      windowStartedAt: isCurrentWindow ? windowStartedAt : now,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
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

async function getCustomerPortalAdmin(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in before reviewing customer portal accounts.",
    );
  }

  const firestore = getFirestore();
  const email = normalizedEmail(request.auth.token.email);
  const profileSnapshot = await firestore.doc(`users/${request.auth.uid}`).get();
  const profile = profileSnapshot.data() || {};
  const isBootstrapSuperAdmin = email === BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const isApprovedAdmin =
    isBootstrapSuperAdmin ||
    (profile.status === "approved" &&
      ["admin", "superAdmin"].includes(profile.role));

  if (!isApprovedAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Only an approved administrator can review customer portal accounts.",
    );
  }

  return {
    email,
    firestore,
    profile,
    userId: request.auth.uid,
  };
}

async function getCustomerPortalQuoteReviewer(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in before reviewing customer quote requests.",
    );
  }

  const firestore = getFirestore();
  const email = normalizedEmail(request.auth.token.email);
  const profileSnapshot = await firestore.doc(`users/${request.auth.uid}`).get();
  const profile = profileSnapshot.data() || {};
  const permissions = Array.isArray(profile.permissions)
    ? profile.permissions
    : [];
  const isBootstrapSuperAdmin = email === BOOTSTRAP_SUPER_ADMIN_EMAIL;
  const canReviewQuotes =
    isBootstrapSuperAdmin ||
    (profile.status === "approved" &&
      (["admin", "superAdmin"].includes(profile.role) ||
        profile.role === "sales" ||
        profile.workView === "sales" ||
        permissions.includes("quote-requests")));

  if (!canReviewQuotes) {
    throw new HttpsError(
      "permission-denied",
      "Your account does not have access to customer quote requests.",
    );
  }

  return {
    email,
    firestore,
    profile,
    userId: request.auth.uid,
  };
}

function customerPortalDateToIso(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

function selectCustomerAccountRequestDocument(documents, accountRequestId = "") {
  const sortedDocuments = [...documents].sort((firstDocument, secondDocument) => {
    const firstData = firstDocument.data() || {};
    const secondData = secondDocument.data() || {};
    const firstDate = customerPortalDateToIso(
      firstData.createdAt || firstData.updatedAt,
    );
    const secondDate = customerPortalDateToIso(
      secondData.createdAt || secondData.updatedAt,
    );
    return secondDate.localeCompare(firstDate);
  });

  return (
    sortedDocuments.find((document) => document.id === accountRequestId) ||
    sortedDocuments.find(
      (document) => String(document.data()?.status || "").trim() === "approved",
    ) ||
    sortedDocuments[0] ||
    null
  );
}

async function getVerifiedCustomerPortalContext(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Use the secure link in your email to sign in.",
    );
  }

  const email = normalizedEmail(request.auth.token.email);
  const emailIsVerified = request.auth.token.email_verified === true;

  if (!email || !emailIsVerified) {
    throw new HttpsError(
      "permission-denied",
      "Your email address has not been verified.",
    );
  }

  const firestore = getFirestore();
  const portalUserReference = firestore.doc(
    `customerPortalUsers/${request.auth.uid}`,
  );
  const [portalUserSnapshot, accountRequestsSnapshot] = await Promise.all([
    portalUserReference.get(),
    firestore
      .collection("customerAccountRequests")
      .where("email", "==", email)
      .limit(20)
      .get(),
  ]);
  const portalUser = portalUserSnapshot.data() || {};
  const accountRequestDocument = selectCustomerAccountRequestDocument(
    accountRequestsSnapshot.docs,
    portalUser.accountRequestId,
  );
  const accountRequest = accountRequestDocument?.data() || {};

  return {
    accountRequest,
    accountRequestDocument,
    email,
    firestore,
    portalUser,
    portalUserExists: portalUserSnapshot.exists,
    portalUserReference,
    userId: request.auth.uid,
  };
}

function getSafeCustomerPortalProfile(context) {
  const { accountRequest, email, portalUser } = context;

  return {
    email,
    status: String(
      portalUser.status || accountRequest.status || "emailVerified",
    ).trim(),
    accountNumber: String(
      portalUser.accountNumber ||
        accountRequest.verifiedAccountNumber ||
        accountRequest.accountNumber ||
        "",
    ).trim(),
    name: String(portalUser.name || accountRequest.name || "").trim(),
    businessName: String(
      portalUser.businessName || accountRequest.businessName || "",
    ).trim(),
    phone: String(portalUser.phone || accountRequest.phone || "").trim(),
    address: String(portalUser.address || accountRequest.address || "").trim(),
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

exports.submitCustomerAccountRequest = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const customerRequest = normalizeCustomerAccountRequest(request.data);

    // Quietly accept honeypot submissions without storing them.
    if (customerRequest.isSpam) {
      return { reference: "RECEIVED" };
    }

    const firestore = getFirestore();
    await enforceCustomerAccountRequestRateLimit(request, firestore);

    const requestId = randomUUID();
    const createdAt = new Date().toISOString();

    await firestore.doc(`customerAccountRequests/${requestId}`).set({
      ...customerRequest,
      status: "pendingVerification",
      source: "customerPortal",
      createdAt,
      updatedAt: createdAt,
    });

    logger.info("Customer portal account request submitted", {
      requestId,
      hasExistingAccount: customerRequest.hasExistingAccount,
      emailDomain: customerRequest.email.split("@")[1] || "",
    });

    return {
      reference: requestId.slice(0, 8).toUpperCase(),
      status: "received",
    };
  },
);

exports.verifyCustomerPortalEmail = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Open the secure link in your email to verify your address.",
      );
    }

    const email = normalizedEmail(request.auth.token.email);
    const emailIsVerified = request.auth.token.email_verified === true;

    if (!email || !emailIsVerified) {
      throw new HttpsError(
        "permission-denied",
        "Your email address has not been verified.",
      );
    }

    const firestore = getFirestore();
    const matchingRequests = await firestore
      .collection("customerAccountRequests")
      .where("email", "==", email)
      .limit(20)
      .get();
    const customerPortalUserReference = firestore.doc(
      `customerPortalUsers/${request.auth.uid}`,
    );
    const customerPortalUser = await customerPortalUserReference.get();
    const existingPortalUser = customerPortalUser.data() || {};
    const linkedAccountRequestDocument = selectCustomerAccountRequestDocument(
      matchingRequests.docs,
      existingPortalUser.accountRequestId,
    );
    const linkedAccountRequest = linkedAccountRequestDocument?.data() || {};
    const batch = firestore.batch();
    const requestStatuses = matchingRequests.docs.map((requestDocument) =>
      String(requestDocument.data()?.status || "").trim(),
    );
    const hasApprovedRequest = requestStatuses.includes("approved");
    const hasPendingRequest = requestStatuses.some((status) =>
      ["pendingVerification", "pendingAccountReview"].includes(status),
    );
    const existingPortalStatus = String(existingPortalUser.status || "").trim();
    const portalStatus =
      existingPortalStatus === "approved" || hasApprovedRequest
        ? "approved"
        : hasPendingRequest
          ? "pendingAccountReview"
          : existingPortalStatus || "emailVerified";

    matchingRequests.docs.forEach((requestDocument) => {
      const requestData = requestDocument.data() || {};
      const currentStatus = String(requestData.status || "").trim();

      batch.set(
        requestDocument.ref,
        {
          status:
            currentStatus === "pendingVerification"
              ? "pendingAccountReview"
              : currentStatus || "pendingAccountReview",
          emailVerifiedAt: FieldValue.serverTimestamp(),
          emailVerifiedUid: request.auth.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    batch.set(
      customerPortalUserReference,
      {
        uid: request.auth.uid,
        email,
        status: portalStatus,
        accountRequestId: linkedAccountRequestDocument?.id || "",
        name: String(
          existingPortalUser.name || linkedAccountRequest.name || "",
        ).trim(),
        businessName: String(
          existingPortalUser.businessName ||
            linkedAccountRequest.businessName ||
            "",
        ).trim(),
        address: String(
          existingPortalUser.address || linkedAccountRequest.address || "",
        ).trim(),
        phone: String(
          existingPortalUser.phone || linkedAccountRequest.phone || "",
        ).trim(),
        emailVerifiedAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(customerPortalUser.exists
          ? {}
          : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );

    await batch.commit();

    logger.info("Customer portal email verified", {
      uid: request.auth.uid,
      emailDomain: email.split("@")[1] || "",
      matchedRequests: matchingRequests.size,
    });

    return {
      email,
      status: portalStatus,
      accountNumber: String(
        existingPortalUser.accountNumber ||
          linkedAccountRequest.verifiedAccountNumber ||
          linkedAccountRequest.accountNumber ||
          "",
      ).trim(),
      matchedRequests: matchingRequests.size,
    };
  },
);

exports.getCustomerPortalProfile = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const context = await getVerifiedCustomerPortalContext(request);
    const profile = getSafeCustomerPortalProfile(context);
    let quoteRequests = [];

    if (request.data?.includeQuoteHistory === true) {
      const quoteRequestsCollection = context.firestore.collection(
        "customerQuoteRequests",
      );
      const [requestsByUserSnapshot, requestsByEmailSnapshot] =
        await Promise.all([
          quoteRequestsCollection
            .where("customerUid", "==", context.userId)
            .limit(100)
            .get(),
          quoteRequestsCollection
            .where("email", "==", context.email)
            .limit(100)
            .get(),
        ]);
      const requestDocuments = new Map();
      [
        ...requestsByUserSnapshot.docs,
        ...requestsByEmailSnapshot.docs,
      ].forEach((requestDocument) => {
        requestDocuments.set(requestDocument.id, requestDocument);
      });

      quoteRequests = Array.from(requestDocuments.values())
        .filter(
          (requestDocument) =>
            requestDocument.data()?.customerVisible !== false,
        )
        .map((requestDocument) => {
          const requestData = requestDocument.data() || {};
          const pricingPublished = requestData.pricingPublished === true;
          const items = Array.isArray(requestData.items)
            ? requestData.items.slice(0, 30).map((item) => ({
                itemNumber: String(item?.itemNumber || "").trim(),
                description: String(item?.description || "").trim(),
                brand: String(item?.brand || "").trim(),
                groupSection: String(item?.groupSection || "").trim(),
                quantity: Number(item?.quantity) || 0,
                unitPrice:
                  pricingPublished && Number.isFinite(Number(item?.unitPrice))
                    ? Number(item.unitPrice)
                    : null,
                lineTotal:
                  pricingPublished && Number.isFinite(Number(item?.lineTotal))
                    ? Number(item.lineTotal)
                    : null,
              }))
            : [];

          return {
            id: requestDocument.id,
            reference: String(requestData.reference || "").trim(),
            status: String(requestData.status || "new").trim(),
            items,
            deliveryNeeded: requestData.deliveryNeeded === true,
            deliveryAddress: String(
              requestData.deliveryAddress || "",
            ).trim(),
            neededBy: String(requestData.neededBy || "").trim(),
            notes: String(requestData.notes || "").trim(),
            pricingPublished,
            pricingVersion: pricingPublished
              ? Math.max(1, Number(requestData.pricingVersion) || 1)
              : 0,
            publicNote: pricingPublished
              ? String(requestData.publicNote || "").trim()
              : "",
            taxRate: pricingPublished ? Number(requestData.taxRate) || 0 : 0,
            deliveryCharge: pricingPublished
              ? Number(requestData.deliveryCharge) || 0
              : 0,
            materialSubtotal: pricingPublished
              ? Number(requestData.materialSubtotal) || 0
              : 0,
            subtotal: pricingPublished ? Number(requestData.subtotal) || 0 : 0,
            taxAmount: pricingPublished
              ? Number(requestData.taxAmount) || 0
              : 0,
            total: pricingPublished ? Number(requestData.total) || 0 : 0,
            validityDays: Number(requestData.validityDays) || 14,
            createdAt: customerPortalDateToIso(requestData.createdAt),
            updatedAt: customerPortalDateToIso(requestData.updatedAt),
            reviewedAt: customerPortalDateToIso(requestData.reviewedAt),
          };
        })
        .sort((firstRequest, secondRequest) =>
          String(secondRequest.createdAt || "").localeCompare(
            String(firstRequest.createdAt || ""),
          ),
        );
    }

    await context.portalUserReference.set(
      {
        uid: context.userId,
        email: context.email,
        accountRequestId:
          context.accountRequestDocument?.id ||
          context.portalUser.accountRequestId ||
          "",
        name: profile.name,
        businessName: profile.businessName,
        address: profile.address,
        phone: profile.phone,
        lastLoginAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(context.portalUserExists
          ? {}
          : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );

    return { profile, quoteRequests };
  },
);

exports.updateCustomerPortalProfile = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const context = await getVerifiedCustomerPortalContext(request);
    const name = String(request.data?.name || "").trim();
    const businessName = String(request.data?.businessName || "").trim();
    const address = String(request.data?.address || "").trim();
    const phone = normalizePhoneNumber(request.data?.phone);

    if (!name || name.length > 120) {
      throw new HttpsError("invalid-argument", "Enter your full name.");
    }
    if (!businessName || businessName.length > 160) {
      throw new HttpsError("invalid-argument", "Enter your business name.");
    }
    if (!address || address.length > 300) {
      throw new HttpsError("invalid-argument", "Enter your business address.");
    }
    if (!phone) {
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid phone number with area code.",
      );
    }

    const updatedAt = FieldValue.serverTimestamp();
    const batch = context.firestore.batch();
    const safeProfile = { name, businessName, address, phone };

    batch.set(
      context.portalUserReference,
      {
        ...safeProfile,
        uid: context.userId,
        email: context.email,
        accountRequestId:
          context.accountRequestDocument?.id ||
          context.portalUser.accountRequestId ||
          "",
        updatedAt,
        ...(context.portalUserExists ? {} : { createdAt: updatedAt }),
      },
      { merge: true },
    );

    if (context.accountRequestDocument) {
      batch.set(
        context.accountRequestDocument.ref,
        { ...safeProfile, updatedAt },
        { merge: true },
      );
    }

    await batch.commit();

    logger.info("Customer portal profile updated", {
      uid: context.userId,
      emailDomain: context.email.split("@")[1] || "",
    });

    return {
      profile: {
        ...getSafeCustomerPortalProfile(context),
        ...safeProfile,
      },
    };
  },
);

exports.submitCustomerQuoteRequest = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    if (request.data?.operation === "update") {
      return updateMyCustomerQuoteRequestHandler(request);
    }

    const context = await getVerifiedCustomerPortalContext(request);
    const submittedItems = Array.isArray(request.data?.items)
      ? request.data.items
      : [];
    const deliveryNeeded = request.data?.deliveryNeeded === true;
    const deliveryAddress = String(request.data?.deliveryAddress || "").trim();
    const neededBy = String(request.data?.neededBy || "").trim();
    const notes = String(request.data?.notes || "").trim();
    const allowedTimelines = new Set([
      "as-soon-as-possible",
      "within-one-week",
      "within-two-weeks",
      "this-month",
      "flexible",
    ]);

    if (submittedItems.length === 0 || submittedItems.length > 30) {
      throw new HttpsError(
        "invalid-argument",
        "Add between 1 and 30 items to your quote request.",
      );
    }

    const items = submittedItems.map((item) => {
      const itemNumber = String(item?.itemNumber || "").trim();
      const description = String(item?.description || "").trim();
      const brand = String(item?.brand || "").trim();
      const groupSection = String(item?.groupSection || "").trim();
      const quantity = Number(item?.quantity);

      if (
        !itemNumber ||
        itemNumber.length > 60 ||
        !description ||
        description.length > 300 ||
        brand.length > 120 ||
        groupSection.length > 160 ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > 100000
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Review the selected items and quantities.",
        );
      }

      return {
        itemNumber,
        description,
        brand,
        groupSection,
        quantity: Math.round(quantity * 100) / 100,
      };
    });

    if (!allowedTimelines.has(neededBy)) {
      throw new HttpsError(
        "invalid-argument",
        "Choose how soon you need the material.",
      );
    }
    if (deliveryNeeded && (!deliveryAddress || deliveryAddress.length > 300)) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the delivery address for this quote.",
      );
    }
    if (notes.length > 1200) {
      throw new HttpsError(
        "invalid-argument",
        "Keep quote notes under 1,200 characters.",
      );
    }

    const profile = getSafeCustomerPortalProfile(context);
    const requestId = randomUUID();
    const reference = `Q-${requestId.slice(0, 8).toUpperCase()}`;

    await context.firestore.doc(`customerQuoteRequests/${requestId}`).set({
      reference,
      status: "new",
      validityDays: 14,
      source: "customerPortal",
      customerUid: context.userId,
      email: context.email,
      accountNumber: profile.accountNumber,
      name: profile.name,
      businessName: profile.businessName,
      phone: profile.phone,
      accountStatus: profile.status,
      items,
      deliveryNeeded,
      deliveryAddress: deliveryNeeded ? deliveryAddress : "",
      neededBy,
      notes,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Customer quote request submitted", {
      requestId,
      reference,
      customerUid: context.userId,
      itemCount: items.length,
      deliveryNeeded,
    });

    return {
      requestId,
      reference,
      status: "new",
      validityDays: 14,
      createdAt: new Date().toISOString(),
    };
  },
);

async function createCustomerQuoteForCustomerHandler(request) {
    const { email: reviewerEmail, firestore } =
      await getCustomerPortalQuoteReviewer(request);
    const enteredEmail = normalizedEmail(request.data?.email);
    const rawPhone = String(request.data?.phone || "").trim();
    const enteredPhone = normalizePhoneNumber(rawPhone);
    const enteredName = String(request.data?.name || "").trim();
    const enteredBusinessName = String(
      request.data?.businessName || "",
    ).trim();
    const enteredAccountNumber = String(
      request.data?.accountNumber || "",
    ).trim();
    const deliveryNeeded = request.data?.deliveryNeeded === true;
    const deliveryAddress = String(
      request.data?.deliveryAddress || "",
    ).trim();
    const neededBy = String(
      request.data?.neededBy || "as-soon-as-possible",
    ).trim();
    const notes = String(request.data?.notes || "").trim();
    const allowedTimelines = new Set([
      "as-soon-as-possible",
      "within-one-week",
      "within-two-weeks",
      "this-month",
      "flexible",
    ]);

    if (!enteredEmail && !rawPhone) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the customer's email or phone number.",
      );
    }
    if (
      enteredEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid customer email address.",
      );
    }
    if (rawPhone && !enteredPhone) {
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid customer phone number.",
      );
    }
    if (
      enteredName.length > 120 ||
      enteredBusinessName.length > 160 ||
      enteredAccountNumber.length > 60
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Review the customer name, business, and account number.",
      );
    }
    if (!allowedTimelines.has(neededBy)) {
      throw new HttpsError(
        "invalid-argument",
        "Choose how soon the customer needs the material.",
      );
    }
    if (deliveryNeeded && (!deliveryAddress || deliveryAddress.length > 300)) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the delivery address for this quote.",
      );
    }
    if (notes.length > 1200) {
      throw new HttpsError(
        "invalid-argument",
        "Keep quote notes under 1,200 characters.",
      );
    }

    const portalUsers = firestore.collection("customerPortalUsers");
    const accountRequests = firestore.collection("customerAccountRequests");
    const [
      portalByEmailSnapshot,
      portalByPhoneSnapshot,
      requestByEmailSnapshot,
      requestByPhoneSnapshot,
    ] = await Promise.all([
      enteredEmail
        ? portalUsers.where("email", "==", enteredEmail).limit(10).get()
        : Promise.resolve(null),
      enteredPhone
        ? portalUsers.where("phone", "==", enteredPhone).limit(10).get()
        : Promise.resolve(null),
      enteredEmail
        ? accountRequests.where("email", "==", enteredEmail).limit(20).get()
        : Promise.resolve(null),
      enteredPhone
        ? accountRequests.where("phone", "==", enteredPhone).limit(20).get()
        : Promise.resolve(null),
    ]);
    const portalDocuments = [
      ...(portalByEmailSnapshot?.docs || []),
      ...(portalByPhoneSnapshot?.docs || []),
    ];
    const accountRequestDocuments = [
      ...(requestByEmailSnapshot?.docs || []),
      ...(requestByPhoneSnapshot?.docs || []),
    ];
    const uniquePortalDocuments = Array.from(
      new Map(
        portalDocuments.map((portalDocument) => [
          portalDocument.id,
          portalDocument,
        ]),
      ).values(),
    );
    const uniqueAccountRequestDocuments = Array.from(
      new Map(
        accountRequestDocuments.map((accountDocument) => [
          accountDocument.id,
          accountDocument,
        ]),
      ).values(),
    );
    const matchedEmails = new Set(
      [
        ...uniquePortalDocuments.map((document) =>
          normalizedEmail(document.data()?.email),
        ),
        ...uniqueAccountRequestDocuments.map((document) =>
          normalizedEmail(document.data()?.email),
        ),
      ].filter(Boolean),
    );

    if (!enteredEmail && matchedEmails.size > 1) {
      throw new HttpsError(
        "failed-precondition",
        "That phone number matches more than one customer. Enter the customer's email to choose the correct account.",
      );
    }
    if (
      enteredEmail &&
      enteredPhone &&
      Array.from(matchedEmails).some(
        (matchedEmail) => matchedEmail !== enteredEmail,
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        "That email and phone number are linked to different customer records.",
      );
    }

    const selectedPortalDocument =
      uniquePortalDocuments.find(
        (document) =>
          normalizedEmail(document.data()?.email) === enteredEmail,
      ) || uniquePortalDocuments[0] || null;
    const selectedAccountRequestDocument =
      selectCustomerAccountRequestDocument(
        uniqueAccountRequestDocuments,
        selectedPortalDocument?.data()?.accountRequestId || "",
      );
    const portalData = selectedPortalDocument?.data() || {};
    const accountData = selectedAccountRequestDocument?.data() || {};
    const resolvedEmail =
      enteredEmail ||
      normalizedEmail(portalData.email) ||
      normalizedEmail(accountData.email);

    if (!resolvedEmail) {
      throw new HttpsError(
        "failed-precondition",
        "Enter the customer's email, or use a phone number already linked to a customer portal account.",
      );
    }

    const requestId = randomUUID();
    const reference = `Q-${requestId.slice(0, 8).toUpperCase()}`;
    const resolvedName =
      enteredName ||
      String(portalData.name || accountData.name || "").trim();
    const resolvedBusinessName =
      enteredBusinessName ||
      String(
        portalData.businessName || accountData.businessName || "",
      ).trim();
    const resolvedPhone =
      enteredPhone ||
      normalizePhoneNumber(portalData.phone || accountData.phone);
    const resolvedAccountNumber =
      enteredAccountNumber ||
      String(
        portalData.accountNumber ||
          accountData.verifiedAccountNumber ||
          accountData.accountNumber ||
          "",
      ).trim();

    await firestore.doc(`customerQuoteRequests/${requestId}`).set({
      reference,
      status: "reviewing",
      validityDays: 14,
      source: "employee",
      createdBy: reviewerEmail,
      customerVisible: false,
      customerUid: selectedPortalDocument?.id || "",
      email: resolvedEmail,
      accountNumber: resolvedAccountNumber,
      name: resolvedName,
      businessName: resolvedBusinessName,
      phone: resolvedPhone,
      accountStatus: String(
        portalData.status || accountData.status || "unlinked",
      ).trim(),
      items: [],
      deliveryNeeded,
      deliveryAddress: deliveryNeeded ? deliveryAddress : "",
      neededBy,
      notes,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Employee-created customer quote started", {
      requestId,
      reference,
      reviewerEmail,
      customerUid: selectedPortalDocument?.id || "",
      customerEmailDomain: resolvedEmail.split("@")[1] || "",
      matchedByPhone: !enteredEmail && Boolean(enteredPhone),
    });

    return {
      requestId,
      reference,
      status: "reviewing",
      email: resolvedEmail,
      phone: resolvedPhone,
      name: resolvedName,
      businessName: resolvedBusinessName,
      accountNumber: resolvedAccountNumber,
    };
}

exports.createCustomerQuoteForCustomer = onCall(
  {
    region: "us-central1",
    cors: true,
    invoker: "private",
  },
  createCustomerQuoteForCustomerHandler,
);

async function updateMyCustomerQuoteRequestHandler(request) {
    const context = await getVerifiedCustomerPortalContext(request);
    const requestId = String(request.data?.requestId || "").trim();
    const submittedItems = Array.isArray(request.data?.items)
      ? request.data.items
      : [];
    const deliveryNeeded = request.data?.deliveryNeeded === true;
    const deliveryAddress = String(request.data?.deliveryAddress || "").trim();
    const neededBy = String(request.data?.neededBy || "").trim();
    const notes = String(request.data?.notes || "").trim();
    const allowedTimelines = new Set([
      "as-soon-as-possible",
      "within-one-week",
      "within-two-weeks",
      "this-month",
      "flexible",
    ]);

    if (!requestId || !/^[A-Za-z0-9_-]{10,80}$/.test(requestId)) {
      throw new HttpsError("invalid-argument", "Choose a valid quote request.");
    }
    if (submittedItems.length === 0 || submittedItems.length > 30) {
      throw new HttpsError(
        "invalid-argument",
        "Add between 1 and 30 items to your quote request.",
      );
    }

    const itemNumbers = new Set();
    const items = submittedItems.map((item) => {
      const itemNumber = String(item?.itemNumber || "").trim();
      const description = String(item?.description || "").trim();
      const brand = String(item?.brand || "").trim();
      const groupSection = String(item?.groupSection || "").trim();
      const quantity = Number(item?.quantity);

      if (
        !itemNumber ||
        itemNumber.length > 60 ||
        !description ||
        description.length > 300 ||
        brand.length > 120 ||
        groupSection.length > 160 ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > 100000 ||
        itemNumbers.has(itemNumber)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Review the selected items and quantities.",
        );
      }

      itemNumbers.add(itemNumber);
      return {
        itemNumber,
        description,
        brand,
        groupSection,
        quantity: Math.round(quantity * 100) / 100,
      };
    });

    if (!allowedTimelines.has(neededBy)) {
      throw new HttpsError(
        "invalid-argument",
        "Choose how soon you need the material.",
      );
    }
    if (deliveryNeeded && (!deliveryAddress || deliveryAddress.length > 300)) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the delivery address for this quote.",
      );
    }
    if (notes.length > 1200) {
      throw new HttpsError(
        "invalid-argument",
        "Keep quote notes under 1,200 characters.",
      );
    }

    const quoteReference = context.firestore.doc(
      `customerQuoteRequests/${requestId}`,
    );
    const updatedAtIso = new Date().toISOString();
    let responseReference = "";

    await context.firestore.runTransaction(async (transaction) => {
      const quoteSnapshot = await transaction.get(quoteReference);

      if (!quoteSnapshot.exists) {
        throw new HttpsError("not-found", "That quote request no longer exists.");
      }

      const quoteData = quoteSnapshot.data() || {};
      const quoteCustomerUid = String(quoteData.customerUid || "").trim();
      const quoteCustomerEmail = normalizedEmail(quoteData.email);
      if (
        quoteCustomerUid !== context.userId &&
        quoteCustomerEmail !== context.email
      ) {
        throw new HttpsError(
          "permission-denied",
          "You can only update quote requests from your account.",
        );
      }

      responseReference = String(quoteData.reference || "").trim();
      const previousItems = Array.isArray(quoteData.items)
        ? quoteData.items.slice(0, 30)
        : [];
      const previousDraft =
        quoteData.pricingDraft && typeof quoteData.pricingDraft === "object"
          ? quoteData.pricingDraft
          : {};
      const previousDraftPrices = Array.isArray(previousDraft.itemPrices)
        ? previousDraft.itemPrices
        : [];
      const previousDraftItems = Array.isArray(previousDraft.items)
        ? previousDraft.items
        : previousItems;
      const carriedPrices = new Map();

      previousDraftItems.forEach((item, index) => {
        const itemNumber = String(item?.itemNumber || "").trim();
        const rawPrice =
          previousDraftPrices[index] ?? item?.unitPrice ?? null;
        const unitPrice = Number(rawPrice);
        carriedPrices.set(
          itemNumber,
          rawPrice === null ||
            rawPrice === undefined ||
            rawPrice === "" ||
            !Number.isFinite(unitPrice)
            ? null
            : unitPrice,
        );
      });

      if (quoteData.pricingPublished === true) {
        const previousVersion = Math.max(
          1,
          Number(quoteData.pricingVersion) || 1,
        );
        transaction.set(
          quoteReference
            .collection("pricingVersions")
            .doc(`v${String(previousVersion).padStart(4, "0")}`),
          {
            version: previousVersion,
            items: previousItems,
            publicNote: String(quoteData.publicNote || "").trim(),
            taxRate: Number(quoteData.taxRate) || 0,
            deliveryCharge: Number(quoteData.deliveryCharge) || 0,
            materialSubtotal: Number(quoteData.materialSubtotal) || 0,
            subtotal: Number(quoteData.subtotal) || 0,
            taxAmount: Number(quoteData.taxAmount) || 0,
            total: Number(quoteData.total) || 0,
            publishedAt:
              quoteData.pricingPublishedAt ||
              quoteData.reviewedAt ||
              FieldValue.serverTimestamp(),
            publishedBy: String(quoteData.reviewedBy || "").trim(),
          },
          { merge: true },
        );
      }

      const draftDeliveryCharge =
        previousDraft.deliveryCharge ?? quoteData.deliveryCharge ?? null;
      const draftTaxRate = previousDraft.taxRate ?? quoteData.taxRate ?? null;
      const draftPublicNote = String(
        previousDraft.publicNote || quoteData.publicNote || "",
      ).trim();
      const updatedAt = FieldValue.serverTimestamp();

      transaction.set(
        quoteReference,
        {
          customerUid: context.userId,
          email: context.email,
          status: "new",
          items,
          deliveryNeeded,
          deliveryAddress: deliveryNeeded ? deliveryAddress : "",
          neededBy,
          notes,
          pricingPublished: false,
          pricingPublishedAt: FieldValue.delete(),
          pricingDraft: {
            items,
            itemPrices: items.map(
              (item) => carriedPrices.get(item.itemNumber) ?? null,
            ),
            deliveryCharge: draftDeliveryCharge,
            taxRate: draftTaxRate,
            publicNote: draftPublicNote,
            savedAt: updatedAt,
            savedBy: context.email,
          },
          pricingDraftHasChanges: true,
          publicNote: "",
          taxRate: 0,
          deliveryCharge: 0,
          materialSubtotal: 0,
          subtotal: 0,
          taxAmount: 0,
          total: 0,
          reviewedAt: FieldValue.delete(),
          reviewedBy: FieldValue.delete(),
          customerUpdatedAt: updatedAt,
          customerUpdateCount:
            Math.max(0, Number(quoteData.customerUpdateCount) || 0) + 1,
          updatedAt,
        },
        { merge: true },
      );
    });

    logger.info("Customer quote request updated by customer", {
      requestId,
      reference: responseReference,
      customerUid: context.userId,
      itemCount: items.length,
      deliveryNeeded,
    });

    return {
      requestId,
      reference: responseReference,
      status: "new",
      validityDays: 14,
      updatedAt: updatedAtIso,
    };
}

exports.updateMyCustomerQuoteRequest = onCall(
  {
    region: "us-central1",
    cors: true,
    invoker: "private",
  },
  updateMyCustomerQuoteRequestHandler,
);

exports.listCustomerQuoteRequests = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const { firestore } = await getCustomerPortalQuoteReviewer(request);
    const pricingVersionsForRequestId = String(
      request.data?.pricingVersionsForRequestId || "",
    ).trim();

    if (pricingVersionsForRequestId) {
      if (!/^[A-Za-z0-9_-]{10,80}$/.test(pricingVersionsForRequestId)) {
        throw new HttpsError("invalid-argument", "Choose a valid quote request.");
      }

      const quoteReference = firestore.doc(
        `customerQuoteRequests/${pricingVersionsForRequestId}`,
      );
      const quoteSnapshot = await quoteReference.get();
      if (!quoteSnapshot.exists) {
        throw new HttpsError("not-found", "That quote request no longer exists.");
      }

      const versionsSnapshot = await quoteReference
        .collection("pricingVersions")
        .orderBy("revision", "desc")
        .limit(50)
        .get();

      return {
        versions: versionsSnapshot.docs.map((versionDocument) => {
          const versionData = versionDocument.data() || {};
          return {
            id: versionDocument.id,
            revision: Math.max(1, Number(versionData.revision) || 1),
            customerVersion: Math.max(
              0,
              Number(versionData.customerVersion) || 0,
            ),
            type: String(versionData.type || "draft").trim(),
            title: String(versionData.title || "Pricing update").trim(),
            note: String(versionData.note || "").trim(),
            status: String(versionData.status || "").trim(),
            items: Array.isArray(versionData.items)
              ? versionData.items.slice(0, 30).map((item) => ({
                  itemNumber: String(item?.itemNumber || "").trim(),
                  description: String(item?.description || "").trim(),
                  quantity: Number(item?.quantity) || 0,
                  unitPrice:
                    item?.unitPrice === null || item?.unitPrice === undefined
                      ? null
                      : Number(item.unitPrice),
                  lineTotal:
                    item?.lineTotal === null || item?.lineTotal === undefined
                      ? null
                      : Number(item.lineTotal),
                }))
              : [],
            publicNote: String(versionData.publicNote || "").trim(),
            internalNote: String(versionData.internalNote || "").trim(),
            taxRate:
              versionData.taxRate === null || versionData.taxRate === undefined
                ? null
                : Number(versionData.taxRate),
            deliveryCharge:
              versionData.deliveryCharge === null ||
              versionData.deliveryCharge === undefined
                ? null
                : Number(versionData.deliveryCharge),
            materialSubtotal: Number(versionData.materialSubtotal) || 0,
            subtotal: Number(versionData.subtotal) || 0,
            taxAmount: Number(versionData.taxAmount) || 0,
            total: Number(versionData.total) || 0,
            createdAt: customerPortalDateToIso(versionData.createdAt),
            createdBy: String(versionData.createdBy || "").trim(),
          };
        }),
      };
    }

    const requestsSnapshot = await firestore
      .collection("customerQuoteRequests")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    return {
      requests: requestsSnapshot.docs.map((requestDocument) => {
        const requestData = requestDocument.data() || {};
        const pricingDraftData =
          requestData.pricingDraft && typeof requestData.pricingDraft === "object"
            ? requestData.pricingDraft
            : {};
        const items = Array.isArray(requestData.items)
          ? requestData.items
              .slice(0, 30)
              .map((item) => ({
                itemNumber: String(item?.itemNumber || "").trim(),
                description: String(item?.description || "").trim(),
                brand: String(item?.brand || "").trim(),
                groupSection: String(item?.groupSection || "").trim(),
                quantity: Number(item?.quantity) || 0,
                unitPrice:
                  item?.unitPrice !== null &&
                  item?.unitPrice !== undefined &&
                  Number.isFinite(Number(item.unitPrice))
                  ? Number(item.unitPrice)
                  : null,
                lineTotal:
                  item?.lineTotal !== null &&
                  item?.lineTotal !== undefined &&
                  Number.isFinite(Number(item.lineTotal))
                  ? Number(item.lineTotal)
                  : null,
              }))
          : [];

        return {
          id: requestDocument.id,
          reference: String(requestData.reference || "").trim(),
          status: String(requestData.status || "new").trim(),
          accountNumber: String(requestData.accountNumber || "").trim(),
          accountStatus: String(requestData.accountStatus || "").trim(),
          name: String(requestData.name || "").trim(),
          businessName: String(requestData.businessName || "").trim(),
          phone: String(requestData.phone || "").trim(),
          email: normalizedEmail(requestData.email),
          source: String(requestData.source || "customerPortal").trim(),
          createdBy: String(requestData.createdBy || "").trim(),
          customerVisible: requestData.customerVisible !== false,
          items,
          deliveryNeeded: requestData.deliveryNeeded === true,
          deliveryAddress: String(
            requestData.deliveryAddress || "",
          ).trim(),
          neededBy: String(requestData.neededBy || "").trim(),
          notes: String(requestData.notes || "").trim(),
          internalNote: String(requestData.internalNote || "").trim(),
          publicNote: String(requestData.publicNote || "").trim(),
          pricingPublished: requestData.pricingPublished === true,
          pricingVersion: Math.max(0, Number(requestData.pricingVersion) || 0),
          pricingRevision: Math.max(0, Number(requestData.pricingRevision) || 0),
          latestPricingRevisionTitle: String(
            requestData.latestPricingRevisionTitle || "",
          ).trim(),
          latestPricingRevisionAt: customerPortalDateToIso(
            requestData.latestPricingRevisionAt,
          ),
          latestPricingRevisionBy: String(
            requestData.latestPricingRevisionBy || "",
          ).trim(),
          pricingDraftHasChanges: requestData.pricingDraftHasChanges === true,
          archiveOutcome: String(requestData.archiveOutcome || "").trim(),
          archivedAt: customerPortalDateToIso(requestData.archivedAt),
          archivedBy: String(requestData.archivedBy || "").trim(),
          pricingDraft: {
            items: Array.isArray(pricingDraftData.items)
              ? pricingDraftData.items.slice(0, 30).map((item) => ({
                  itemNumber: String(item?.itemNumber || "").trim(),
                  description: String(item?.description || "").trim(),
                  brand: String(item?.brand || "").trim(),
                  groupSection: String(item?.groupSection || "").trim(),
                  quantity: Number(item?.quantity) || 0,
                }))
              : [],
            itemPrices: Array.isArray(pricingDraftData.itemPrices)
              ? pricingDraftData.itemPrices.slice(0, 30).map((price) =>
                  price === null || price === undefined || price === ""
                    ? null
                    : Number(price),
                )
              : [],
            deliveryCharge:
              pricingDraftData.deliveryCharge === null ||
              pricingDraftData.deliveryCharge === undefined
                ? null
                : Number(pricingDraftData.deliveryCharge),
            taxRate:
              pricingDraftData.taxRate === null ||
              pricingDraftData.taxRate === undefined
                ? null
                : Number(pricingDraftData.taxRate),
            publicNote: String(pricingDraftData.publicNote || "").trim(),
          },
          taxRate: Number(requestData.taxRate) || 0,
          deliveryCharge: Number(requestData.deliveryCharge) || 0,
          materialSubtotal: Number(requestData.materialSubtotal) || 0,
          subtotal: Number(requestData.subtotal) || 0,
          taxAmount: Number(requestData.taxAmount) || 0,
          total: Number(requestData.total) || 0,
          createdAt: customerPortalDateToIso(requestData.createdAt),
          updatedAt: customerPortalDateToIso(requestData.updatedAt),
          reviewedAt: customerPortalDateToIso(requestData.reviewedAt),
          reviewedBy: String(requestData.reviewedBy || "").trim(),
        };
      }),
    };
  },
);

exports.listCustomerQuotePricingVersions = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const { firestore } = await getCustomerPortalQuoteReviewer(request);
    const requestId = String(request.data?.requestId || "").trim();

    if (!requestId || !/^[A-Za-z0-9_-]{10,80}$/.test(requestId)) {
      throw new HttpsError("invalid-argument", "Choose a valid quote request.");
    }

    const quoteReference = firestore.doc(`customerQuoteRequests/${requestId}`);
    const quoteSnapshot = await quoteReference.get();
    if (!quoteSnapshot.exists) {
      throw new HttpsError("not-found", "That quote request no longer exists.");
    }

    const versionsSnapshot = await quoteReference
      .collection("pricingVersions")
      .orderBy("revision", "desc")
      .limit(50)
      .get();

    return {
      versions: versionsSnapshot.docs.map((versionDocument) => {
        const versionData = versionDocument.data() || {};
        return {
          id: versionDocument.id,
          revision: Math.max(1, Number(versionData.revision) || 1),
          customerVersion: Math.max(
            0,
            Number(versionData.customerVersion) || 0,
          ),
          type: String(versionData.type || "draft").trim(),
          title: String(versionData.title || "Pricing update").trim(),
          note: String(versionData.note || "").trim(),
          status: String(versionData.status || "").trim(),
          items: Array.isArray(versionData.items)
            ? versionData.items.slice(0, 30).map((item) => ({
                itemNumber: String(item?.itemNumber || "").trim(),
                description: String(item?.description || "").trim(),
                quantity: Number(item?.quantity) || 0,
                unitPrice:
                  item?.unitPrice === null || item?.unitPrice === undefined
                    ? null
                    : Number(item.unitPrice),
                lineTotal:
                  item?.lineTotal === null || item?.lineTotal === undefined
                    ? null
                    : Number(item.lineTotal),
              }))
            : [],
          publicNote: String(versionData.publicNote || "").trim(),
          internalNote: String(versionData.internalNote || "").trim(),
          taxRate:
            versionData.taxRate === null || versionData.taxRate === undefined
              ? null
              : Number(versionData.taxRate),
          deliveryCharge:
            versionData.deliveryCharge === null ||
            versionData.deliveryCharge === undefined
              ? null
              : Number(versionData.deliveryCharge),
          materialSubtotal: Number(versionData.materialSubtotal) || 0,
          subtotal: Number(versionData.subtotal) || 0,
          taxAmount: Number(versionData.taxAmount) || 0,
          total: Number(versionData.total) || 0,
          createdAt: customerPortalDateToIso(versionData.createdAt),
          createdBy: String(versionData.createdBy || "").trim(),
        };
      }),
    };
  },
);

exports.updateCustomerQuoteRequest = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    if (request.data?.operation === "create") {
      return createCustomerQuoteForCustomerHandler(request);
    }

    const { email: reviewerEmail, firestore } =
      await getCustomerPortalQuoteReviewer(request);
    const requestId = String(request.data?.requestId || "").trim();
    const status = String(request.data?.status || "").trim();
    const internalNote = String(request.data?.internalNote || "").trim();
    const versionTitle = String(request.data?.versionTitle || "").trim();
    const versionNote = String(request.data?.versionNote || "").trim();
    const archiveOutcome = String(request.data?.archiveOutcome || "").trim();
    const publishPricing = request.data?.publishPricing === true;
    const savePricingDraft = request.data?.savePricingDraft === true;
    const allowedStatuses = new Set([
      "new",
      "reviewing",
      "quoted",
      "closed",
      "archived_order",
      "archived_no_order",
    ]);
    const roundCurrency = (value) => Math.round(value * 100) / 100;

    if (!requestId || !/^[A-Za-z0-9_-]{10,80}$/.test(requestId)) {
      throw new HttpsError("invalid-argument", "Choose a valid quote request.");
    }
    if (!allowedStatuses.has(status)) {
      throw new HttpsError("invalid-argument", "Choose a valid quote status.");
    }
    if (
      (status === "archived_order" && archiveOutcome !== "order") ||
      (status === "archived_no_order" && archiveOutcome !== "no_order")
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Choose whether the archived quote became an order.",
      );
    }
    if (internalNote.length > 800) {
      throw new HttpsError(
        "invalid-argument",
        "Keep the internal quote note under 800 characters.",
      );
    }
    if (versionTitle.length > 80 || versionNote.length > 400) {
      throw new HttpsError(
        "invalid-argument",
        "Keep the version title under 80 characters and its note under 400 characters.",
      );
    }

    const quoteReference = firestore.doc(`customerQuoteRequests/${requestId}`);
    const quoteSnapshot = await quoteReference.get();

    if (!quoteSnapshot.exists) {
      throw new HttpsError("not-found", "That quote request no longer exists.");
    }

    const quoteData = quoteSnapshot.data() || {};
    const existingItems = Array.isArray(quoteData.items)
      ? quoteData.items.slice(0, 30)
      : [];
    const submittedRequestItems = Array.isArray(request.data?.requestItems)
      ? request.data.requestItems
      : [];
    const draftMaterialItems =
      savePricingDraft && submittedRequestItems.length > 0
        ? (() => {
            if (submittedRequestItems.length > 30) {
              throw new HttpsError(
                "invalid-argument",
                "Keep the quote to 30 material items or fewer.",
              );
            }

            const itemNumbers = new Set();
            return submittedRequestItems.map((item, index) => {
              const itemNumber = String(item?.itemNumber || "").trim();
              const description = String(item?.description || "").trim();
              const brand = String(item?.brand || "").trim();
              const groupSection = String(item?.groupSection || "").trim();
              const quantity = Number(item?.quantity);

              if (
                !itemNumber ||
                itemNumber.length > 60 ||
                !description ||
                description.length > 300 ||
                brand.length > 120 ||
                groupSection.length > 160 ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                quantity > 100000 ||
                itemNumbers.has(itemNumber)
              ) {
                throw new HttpsError(
                  "invalid-argument",
                  `Review material item ${index + 1} and its quantity.`,
                );
              }

              itemNumbers.add(itemNumber);
              return {
                itemNumber,
                description,
                brand,
                groupSection,
                quantity: Math.round(quantity * 100) / 100,
              };
            });
          })()
        : existingItems;
    const reviewedAt = FieldValue.serverTimestamp();
    const quoteUpdate = {
      status,
      internalNote,
      reviewedAt,
      reviewedBy: reviewerEmail,
      updatedAt: reviewedAt,
    };
    if (["archived_order", "archived_no_order"].includes(status)) {
      Object.assign(quoteUpdate, {
        archiveOutcome,
        archivedAt: reviewedAt,
        archivedBy: reviewerEmail,
      });
    }
    const currentPricingRevision = Math.max(
      0,
      Number(quoteData.pricingRevision) || 0,
      Number(quoteData.pricingVersion) || 0,
    );
    const nextPricingRevision = savePricingDraft
      ? currentPricingRevision + 1
      : currentPricingRevision;
    let pricingRevisionSnapshot = null;

    if (savePricingDraft) {
      const draftItems = Array.isArray(request.data?.draftItems)
        ? request.data.draftItems
        : [];
      const draftPublicNote = String(
        request.data?.draftPublicNote || "",
      ).trim();
      const rawDraftTaxRate = request.data?.draftTaxRate;
      const rawDraftDeliveryCharge = request.data?.draftDeliveryCharge;

      if (
        draftMaterialItems.length === 0 ||
        draftItems.length !== draftMaterialItems.length
      ) {
        throw new HttpsError(
          "invalid-argument",
          "The pricing draft must match every requested item.",
        );
      }
      if (draftPublicNote.length > 800) {
        throw new HttpsError(
          "invalid-argument",
          "Keep the customer pricing note under 800 characters.",
        );
      }

      const draftItemPrices = draftMaterialItems.map((item, index) => {
        const draftItem = draftItems[index] || {};
        const submittedItemNumber = String(draftItem.itemNumber || "").trim();
        const existingItemNumber = String(item?.itemNumber || "").trim();
        const rawUnitPrice = draftItem.unitPrice;

        if (submittedItemNumber !== existingItemNumber) {
          throw new HttpsError(
            "invalid-argument",
            "The pricing draft no longer matches this quote request.",
          );
        }
        if (rawUnitPrice === null || rawUnitPrice === undefined || rawUnitPrice === "") {
          return null;
        }

        const unitPrice = Number(rawUnitPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1000000) {
          throw new HttpsError(
            "invalid-argument",
            `Enter a valid draft price for ${existingItemNumber || `item ${index + 1}`}.`,
          );
        }
        return roundCurrency(unitPrice);
      });
      const draftTaxRate =
        rawDraftTaxRate === null || rawDraftTaxRate === undefined || rawDraftTaxRate === ""
          ? null
          : Number(rawDraftTaxRate);
      const draftDeliveryCharge =
        rawDraftDeliveryCharge === null ||
        rawDraftDeliveryCharge === undefined ||
        rawDraftDeliveryCharge === ""
          ? null
          : Number(rawDraftDeliveryCharge);

      if (
        draftTaxRate !== null &&
        (!Number.isFinite(draftTaxRate) || draftTaxRate < 0 || draftTaxRate > 25)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a draft tax rate between 0% and 25%.",
        );
      }
      if (
        draftDeliveryCharge !== null &&
        (!Number.isFinite(draftDeliveryCharge) ||
          draftDeliveryCharge < 0 ||
          draftDeliveryCharge > 1000000)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid draft delivery charge.",
        );
      }

      const pricingDraft = {
        items: draftMaterialItems,
        itemPrices: draftItemPrices,
        deliveryCharge:
          draftDeliveryCharge === null ? null : roundCurrency(draftDeliveryCharge),
        taxRate: draftTaxRate,
        publicNote: draftPublicNote,
        savedAt: reviewedAt,
        savedBy: reviewerEmail,
      };
      const publishedPricingSignature = JSON.stringify({
        items: existingItems.map((item) => ({
          itemNumber: String(item?.itemNumber || "").trim(),
          quantity: Number(item?.quantity) || 0,
        })),
        itemPrices: existingItems.map((item) =>
          item?.unitPrice === null || item?.unitPrice === undefined
            ? null
            : Number(item.unitPrice),
        ),
        deliveryCharge: Number(quoteData.deliveryCharge) || 0,
        taxRate: Number(quoteData.taxRate) || 0,
        publicNote: String(quoteData.publicNote || "").trim(),
      });
      const draftPricingSignature = JSON.stringify({
        items: draftMaterialItems.map((item) => ({
          itemNumber: item.itemNumber,
          quantity: item.quantity,
        })),
        itemPrices: draftItemPrices,
        deliveryCharge: draftDeliveryCharge === null ? 0 : roundCurrency(draftDeliveryCharge),
        taxRate: draftTaxRate === null ? 0 : draftTaxRate,
        publicNote: draftPublicNote,
      });

      quoteUpdate.pricingDraft = pricingDraft;
      quoteUpdate.pricingDraftHasChanges =
        quoteData.pricingPublished === true &&
        draftPricingSignature !== publishedPricingSignature;

      const revisionItems = draftMaterialItems.map((item, index) => {
        const unitPrice = draftItemPrices[index];
        const quantity = Number(item?.quantity) || 0;
        return {
          ...item,
          unitPrice,
          lineTotal:
            unitPrice === null ? null : roundCurrency(quantity * unitPrice),
        };
      });
      const revisionMaterialSubtotal = roundCurrency(
        revisionItems.reduce(
          (sum, item) => sum + (Number(item.lineTotal) || 0),
          0,
        ),
      );
      const revisionDeliveryCharge =
        draftDeliveryCharge === null ? 0 : roundCurrency(draftDeliveryCharge);
      const revisionTaxRate = draftTaxRate === null ? 0 : draftTaxRate;
      const revisionSubtotal = roundCurrency(
        revisionMaterialSubtotal + revisionDeliveryCharge,
      );
      const revisionTaxAmount = roundCurrency(
        revisionSubtotal * (revisionTaxRate / 100),
      );

      Object.assign(quoteUpdate, {
        pricingRevision: nextPricingRevision,
        latestPricingRevisionTitle:
          versionTitle || (publishPricing ? "Sent to customer" : "Pricing update"),
        latestPricingRevisionAt: reviewedAt,
        latestPricingRevisionBy: reviewerEmail,
      });
      pricingRevisionSnapshot = {
        revision: nextPricingRevision,
        customerVersion: 0,
        type: publishPricing ? "published" : "draft",
        title:
          versionTitle || (publishPricing ? "Sent to customer" : "Pricing update"),
        note: versionNote,
        status,
        items: revisionItems,
        publicNote: draftPublicNote,
        internalNote,
        taxRate: revisionTaxRate,
        deliveryCharge: revisionDeliveryCharge,
        materialSubtotal: revisionMaterialSubtotal,
        subtotal: revisionSubtotal,
        taxAmount: revisionTaxAmount,
        total: roundCurrency(revisionSubtotal + revisionTaxAmount),
        createdAt: reviewedAt,
        createdBy: reviewerEmail,
      };
    }

    if (publishPricing) {
      const pricedItems = Array.isArray(request.data?.pricedItems)
        ? request.data.pricedItems
        : [];
      const publicNote = String(request.data?.publicNote || "").trim();
      const taxRate = Number(request.data?.taxRate);
      const deliveryCharge = Number(request.data?.deliveryCharge);

      if (
        draftMaterialItems.length === 0 ||
        pricedItems.length !== draftMaterialItems.length
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a unit price for every requested item.",
        );
      }
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 25) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a tax rate between 0% and 25%.",
        );
      }
      if (
        !Number.isFinite(deliveryCharge) ||
        deliveryCharge < 0 ||
        deliveryCharge > 1000000
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Enter a valid delivery charge.",
        );
      }
      if (publicNote.length > 800) {
        throw new HttpsError(
          "invalid-argument",
          "Keep the customer pricing note under 800 characters.",
        );
      }

      const publishedItems = draftMaterialItems.map((item, index) => {
        const submittedItem = pricedItems[index] || {};
        const submittedItemNumber = String(
          submittedItem.itemNumber || "",
        ).trim();
        const existingItemNumber = String(item?.itemNumber || "").trim();
        const unitPrice = Number(submittedItem.unitPrice);
        const quantity = Number(item?.quantity) || 0;

        if (
          submittedItemNumber !== existingItemNumber ||
          !Number.isFinite(unitPrice) ||
          unitPrice < 0 ||
          unitPrice > 1000000
        ) {
          throw new HttpsError(
            "invalid-argument",
            `Enter a valid unit price for ${existingItemNumber || `item ${index + 1}`}.`,
          );
        }

        return {
          ...item,
          unitPrice: roundCurrency(unitPrice),
          lineTotal: roundCurrency(quantity * unitPrice),
        };
      });
      const materialSubtotal = roundCurrency(
        publishedItems.reduce(
          (sum, item) => sum + (Number(item.lineTotal) || 0),
          0,
        ),
      );
      const subtotal = roundCurrency(materialSubtotal + deliveryCharge);
      const taxAmount = roundCurrency(subtotal * (taxRate / 100));
      const total = roundCurrency(subtotal + taxAmount);
      const currentPricingVersion = Math.max(
        0,
        Number(quoteData.pricingVersion) ||
          (quoteData.pricingPublished === true ? 1 : 0),
      );
      const nextPricingVersion = currentPricingVersion + 1;

      Object.assign(quoteUpdate, {
        status: "quoted",
        customerVisible: true,
        items: publishedItems,
        publicNote,
        pricingPublished: true,
        pricingPublishedAt: reviewedAt,
        taxRate,
        deliveryCharge: roundCurrency(deliveryCharge),
        materialSubtotal,
        subtotal,
        taxAmount,
        total,
        pricingVersion: nextPricingVersion,
        pricingDraft: {
          items: publishedItems.map((item) => ({
            itemNumber: item.itemNumber,
            description: item.description,
            brand: item.brand || "",
            groupSection: item.groupSection || "",
            quantity: item.quantity,
          })),
          itemPrices: publishedItems.map((item) => item.unitPrice),
          deliveryCharge: roundCurrency(deliveryCharge),
          taxRate,
          publicNote,
          savedAt: reviewedAt,
          savedBy: reviewerEmail,
        },
        pricingDraftHasChanges: false,
      });

      if (pricingRevisionSnapshot) {
        Object.assign(pricingRevisionSnapshot, {
          customerVersion: nextPricingVersion,
          type: "published",
          items: publishedItems,
          publicNote,
          taxRate,
          deliveryCharge: roundCurrency(deliveryCharge),
          materialSubtotal,
          subtotal,
          taxAmount,
          total,
        });
      }

      const writeBatch = firestore.batch();
      if (quoteData.pricingPublished === true && !quoteData.pricingVersion) {
        writeBatch.set(
          quoteReference.collection("pricingVersions").doc("v0001"),
          {
            version: 1,
            items: existingItems,
            publicNote: String(quoteData.publicNote || "").trim(),
            taxRate: Number(quoteData.taxRate) || 0,
            deliveryCharge: Number(quoteData.deliveryCharge) || 0,
            materialSubtotal: Number(quoteData.materialSubtotal) || 0,
            subtotal: Number(quoteData.subtotal) || 0,
            taxAmount: Number(quoteData.taxAmount) || 0,
            total: Number(quoteData.total) || 0,
            publishedAt:
              quoteData.pricingPublishedAt || quoteData.reviewedAt || reviewedAt,
            publishedBy: String(quoteData.reviewedBy || "").trim(),
          },
          { merge: true },
        );
      }
      writeBatch.set(
        quoteReference
          .collection("pricingVersions")
          .doc(`v${String(nextPricingVersion).padStart(4, "0")}`),
        {
          version: nextPricingVersion,
          items: publishedItems,
          publicNote,
          taxRate,
          deliveryCharge: roundCurrency(deliveryCharge),
          materialSubtotal,
          subtotal,
          taxAmount,
          total,
          publishedAt: reviewedAt,
          publishedBy: reviewerEmail,
        },
      );
      if (pricingRevisionSnapshot) {
        writeBatch.set(
          quoteReference
            .collection("pricingVersions")
            .doc(`revision-${String(nextPricingRevision).padStart(6, "0")}`),
          pricingRevisionSnapshot,
        );
      }
      writeBatch.set(quoteReference, quoteUpdate, { merge: true });
      await writeBatch.commit();
    } else if (pricingRevisionSnapshot) {
      const writeBatch = firestore.batch();
      writeBatch.set(
        quoteReference
          .collection("pricingVersions")
          .doc(`revision-${String(nextPricingRevision).padStart(6, "0")}`),
        pricingRevisionSnapshot,
      );
      writeBatch.set(quoteReference, quoteUpdate, { merge: true });
      await writeBatch.commit();
    } else {
      await quoteReference.set(quoteUpdate, { merge: true });
    }

    logger.info("Customer quote request updated", {
      requestId,
      status: quoteUpdate.status,
      reviewerEmail,
      publishPricing,
    });

    return {
      requestId,
      status: quoteUpdate.status,
      pricingPublished: publishPricing || quoteSnapshot.data()?.pricingPublished === true,
      pricingRevision: nextPricingRevision,
      total: publishPricing ? quoteUpdate.total : Number(quoteSnapshot.data()?.total) || 0,
    };
  },
);

exports.listCustomerAccountRequests = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const { firestore } = await getCustomerPortalAdmin(request);
    const requestsSnapshot = await firestore
      .collection("customerAccountRequests")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();
    const portalUserIds = [
      ...new Set(
        requestsSnapshot.docs
          .map((requestDocument) =>
            String(requestDocument.data()?.emailVerifiedUid || "").trim(),
          )
          .filter(Boolean),
      ),
    ];
    const portalUserSnapshots = await Promise.all(
      portalUserIds.map((userId) =>
        firestore.doc(`customerPortalUsers/${userId}`).get(),
      ),
    );
    const portalUsers = new Map(
      portalUserSnapshots.map((userSnapshot) => [
        userSnapshot.id,
        userSnapshot.data() || {},
      ]),
    );

    return {
      requests: requestsSnapshot.docs.map((requestDocument) => {
        const requestData = requestDocument.data() || {};
        const portalUser = portalUsers.get(requestData.emailVerifiedUid) || {};

        return {
          id: requestDocument.id,
          hasExistingAccount: requestData.hasExistingAccount === true,
          requestedAccountNumber: String(
            requestData.accountNumber || "",
          ).trim(),
          verifiedAccountNumber: String(
            requestData.verifiedAccountNumber ||
              portalUser.accountNumber ||
              "",
          ).trim(),
          name: String(requestData.name || "").trim(),
          businessName: String(requestData.businessName || "").trim(),
          address: String(requestData.address || "").trim(),
          phone: String(requestData.phone || "").trim(),
          email: normalizedEmail(requestData.email),
          status: String(requestData.status || "pendingVerification").trim(),
          emailVerified: Boolean(requestData.emailVerifiedUid),
          emailVerifiedUid: String(requestData.emailVerifiedUid || "").trim(),
          portalStatus: String(portalUser.status || "").trim(),
          createdAt: customerPortalDateToIso(requestData.createdAt),
          updatedAt: customerPortalDateToIso(requestData.updatedAt),
          emailVerifiedAt: customerPortalDateToIso(
            requestData.emailVerifiedAt,
          ),
          reviewedAt: customerPortalDateToIso(requestData.reviewedAt),
          reviewedBy: String(requestData.reviewedBy || "").trim(),
          reviewNotes: String(requestData.reviewNotes || "").trim(),
        };
      }),
    };
  },
);

exports.reviewCustomerAccountRequest = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const { email: reviewerEmail, firestore, userId: reviewerId } =
      await getCustomerPortalAdmin(request);
    const requestId = String(request.data?.requestId || "").trim();
    const decision = String(request.data?.decision || "").trim();
    const verifiedAccountNumber = String(
      request.data?.verifiedAccountNumber || "",
    ).trim();
    const reviewNotes = String(request.data?.reviewNotes || "").trim();

    if (!requestId || !/^[A-Za-z0-9_-]{10,80}$/.test(requestId)) {
      throw new HttpsError("invalid-argument", "Choose a valid customer request.");
    }
    if (!["approve", "reject"].includes(decision)) {
      throw new HttpsError("invalid-argument", "Choose approve or reject.");
    }
    if (decision === "approve" && !verifiedAccountNumber) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the Capital Lumber account number you verified.",
      );
    }
    if (verifiedAccountNumber.length > 40 || reviewNotes.length > 500) {
      throw new HttpsError(
        "invalid-argument",
        "The account number or review note is too long.",
      );
    }

    const accountRequestReference = firestore.doc(
      `customerAccountRequests/${requestId}`,
    );

    await firestore.runTransaction(async (transaction) => {
      const accountRequestSnapshot = await transaction.get(
        accountRequestReference,
      );

      if (!accountRequestSnapshot.exists) {
        throw new HttpsError("not-found", "That customer request no longer exists.");
      }

      const accountRequest = accountRequestSnapshot.data() || {};
      const customerUserId = String(
        accountRequest.emailVerifiedUid || "",
      ).trim();
      let customerUserSnapshot = null;
      let customerUser = {};

      if (customerUserId) {
        customerUserSnapshot = await transaction.get(
          firestore.doc(`customerPortalUsers/${customerUserId}`),
        );
        customerUser = customerUserSnapshot.data() || {};
      }

      if (decision === "approve" && !customerUserId) {
        throw new HttpsError(
          "failed-precondition",
          "The customer must verify their email before the account can be linked.",
        );
      }

      const reviewedAt = FieldValue.serverTimestamp();
      const nextStatus = decision === "approve" ? "approved" : "rejected";
      transaction.set(
        accountRequestReference,
        {
          status: nextStatus,
          verifiedAccountNumber:
            decision === "approve" ? verifiedAccountNumber : "",
          reviewNotes,
          reviewedAt,
          reviewedBy: reviewerEmail,
          reviewedByUid: reviewerId,
          updatedAt: reviewedAt,
        },
        { merge: true },
      );

      if (customerUserId) {
        const customerUserReference = firestore.doc(
          `customerPortalUsers/${customerUserId}`,
        );
        const requestEmail = normalizedEmail(accountRequest.email);

        if (
          decision === "approve" &&
          normalizedEmail(customerUser.email) !== requestEmail
        ) {
          throw new HttpsError(
            "failed-precondition",
            "The verified login email does not match this account request.",
          );
        }

        transaction.set(
          customerUserReference,
          {
            uid: customerUserId,
            email: requestEmail,
            status: nextStatus,
            accountNumber:
              decision === "approve" ? verifiedAccountNumber : "",
            accountRequestId: requestId,
            name: String(accountRequest.name || "").trim(),
            businessName: String(accountRequest.businessName || "").trim(),
            phone: String(accountRequest.phone || "").trim(),
            address: String(accountRequest.address || "").trim(),
            reviewedAt,
            reviewedBy: reviewerEmail,
            updatedAt: reviewedAt,
            ...(customerUserSnapshot.exists
              ? {}
              : { createdAt: reviewedAt }),
          },
          { merge: true },
        );
      }
    });

    logger.info("Customer portal account request reviewed", {
      requestId,
      decision,
      reviewerEmail,
    });

    return {
      requestId,
      status: decision === "approve" ? "approved" : "rejected",
      verifiedAccountNumber:
        decision === "approve" ? verifiedAccountNumber : "",
    };
  },
);

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
