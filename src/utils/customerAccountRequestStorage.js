import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function submitCustomerAccountRequest(accountRequest) {
  if (!functions) {
    throw new Error(
      "Customer account setup is temporarily unavailable. Please call 208-343-5481.",
    );
  }

  const submitRequest = httpsCallable(
    functions,
    "submitCustomerAccountRequest",
  );
  const response = await submitRequest(accountRequest);

  return response.data;
}

export async function verifyCustomerPortalEmail() {
  if (!functions) {
    throw new Error(
      "Customer account verification is temporarily unavailable. Please call 208-343-5481.",
    );
  }

  const verifyEmail = httpsCallable(functions, "verifyCustomerPortalEmail");
  const response = await verifyEmail();

  return response.data;
}

export async function listCustomerAccountRequests() {
  if (!functions) {
    throw new Error("Customer account requests are temporarily unavailable.");
  }

  const listRequests = httpsCallable(functions, "listCustomerAccountRequests");
  const response = await listRequests();

  return Array.isArray(response.data?.requests) ? response.data.requests : [];
}

export async function reviewCustomerAccountRequest({
  requestId,
  decision,
  verifiedAccountNumber,
  reviewNotes,
}) {
  if (!functions) {
    throw new Error("Customer account requests are temporarily unavailable.");
  }

  const reviewRequest = httpsCallable(
    functions,
    "reviewCustomerAccountRequest",
  );
  const response = await reviewRequest({
    requestId,
    decision,
    verifiedAccountNumber,
    reviewNotes,
  });

  return response.data;
}

export async function getCustomerPortalProfile() {
  if (!functions) {
    throw new Error("Your customer profile is temporarily unavailable.");
  }

  const getProfile = httpsCallable(functions, "getCustomerPortalProfile");
  const response = await getProfile();

  return response.data?.profile || {};
}

export async function updateCustomerPortalProfile(profile) {
  if (!functions) {
    throw new Error("Your customer profile is temporarily unavailable.");
  }

  const updateProfile = httpsCallable(functions, "updateCustomerPortalProfile");
  const response = await updateProfile(profile);

  return response.data?.profile || {};
}

export async function submitCustomerQuoteRequest(quoteRequest) {
  if (!functions) {
    throw new Error("Quote requests are temporarily unavailable.");
  }

  const submitQuote = httpsCallable(functions, "submitCustomerQuoteRequest");
  const response = await submitQuote(quoteRequest);

  return response.data;
}

export async function updateMyCustomerQuoteRequest(quoteRequest) {
  if (!functions) {
    throw new Error("Quote updates are temporarily unavailable.");
  }

  const updateQuote = httpsCallable(
    functions,
    "updateMyCustomerQuoteRequest",
  );
  const response = await updateQuote(quoteRequest);

  return response.data;
}

export async function listMyCustomerQuoteRequests() {
  if (!functions) {
    throw new Error("Your quote history is temporarily unavailable.");
  }

  const listRequests = httpsCallable(
    functions,
    "getCustomerPortalProfile",
  );
  const response = await listRequests({ includeQuoteHistory: true });

  return Array.isArray(response.data?.quoteRequests)
    ? response.data.quoteRequests
    : [];
}

export async function listCustomerQuoteRequests() {
  if (!functions) {
    throw new Error("Customer quote requests are temporarily unavailable.");
  }

  const listRequests = httpsCallable(functions, "listCustomerQuoteRequests");
  const response = await listRequests();

  return Array.isArray(response.data?.requests) ? response.data.requests : [];
}

export async function listCustomerQuotePricingVersions(requestId) {
  if (!functions) {
    throw new Error("Quote pricing history is temporarily unavailable.");
  }

  const listVersions = httpsCallable(
    functions,
    "listCustomerQuotePricingVersions",
  );
  const response = await listVersions({ requestId });

  return Array.isArray(response.data?.versions)
    ? response.data.versions
    : [];
}

export async function updateCustomerQuoteRequest({
  requestId,
  status,
  internalNote,
  publishPricing = false,
  savePricingDraft = false,
  requestItems = [],
  draftItems = [],
  draftTaxRate = null,
  draftDeliveryCharge = null,
  draftPublicNote = "",
  pricedItems = [],
  taxRate = 0,
  deliveryCharge = 0,
  publicNote = "",
  versionTitle = "",
  versionNote = "",
}) {
  if (!functions) {
    throw new Error("Customer quote requests are temporarily unavailable.");
  }

  const updateRequest = httpsCallable(functions, "updateCustomerQuoteRequest");
  const response = await updateRequest({
    requestId,
    status,
    internalNote,
    publishPricing,
    savePricingDraft,
    requestItems,
    draftItems,
    draftTaxRate,
    draftDeliveryCharge,
    draftPublicNote,
    pricedItems,
    taxRate,
    deliveryCharge,
    publicNote,
    versionTitle,
    versionNote,
  });

  return response.data;
}
