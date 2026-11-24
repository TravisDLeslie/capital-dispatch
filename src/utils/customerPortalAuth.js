import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { verifyCustomerPortalEmail } from "./customerAccountRequestStorage";

const CUSTOMER_EMAIL_STORAGE_KEY = "capitalLumberCustomerEmailForSignIn";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function requireCustomerAuth() {
  if (!auth) {
    throw new Error(
      "Customer sign in is temporarily unavailable. Please call 208-343-5481.",
    );
  }

  return auth;
}

export function isCustomerPortalEmailLink(url = window.location.href) {
  return Boolean(auth && isSignInWithEmailLink(auth, url));
}

export function getStoredCustomerPortalEmail() {
  try {
    return normalizeEmail(window.localStorage.getItem(CUSTOMER_EMAIL_STORAGE_KEY));
  } catch {
    return "";
  }
}

export async function sendCustomerPortalSignInLink(email) {
  const firebaseAuth = requireCustomerAuth();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Enter the email address for your Capital Lumber account.");
  }

  const returnUrl = new URL(window.location.href);
  returnUrl.search = "";
  returnUrl.hash = "";
  returnUrl.searchParams.set("customerEmailSignIn", "1");

  await sendSignInLinkToEmail(firebaseAuth, normalizedEmail, {
    url: returnUrl.toString(),
    handleCodeInApp: true,
  });

  try {
    window.localStorage.setItem(CUSTOMER_EMAIL_STORAGE_KEY, normalizedEmail);
  } catch {
    // The user can re-enter their email when opening the link on another device.
  }

  return { email: normalizedEmail };
}

export async function completeCustomerPortalSignIn(
  email,
  url = window.location.href,
) {
  const firebaseAuth = requireCustomerAuth();
  const normalizedEmail = normalizeEmail(email);

  if (!isSignInWithEmailLink(firebaseAuth, url)) {
    throw new Error("This sign-in link is invalid or has already been used.");
  }
  if (!normalizedEmail) {
    throw new Error("Enter the email address that received this sign-in link.");
  }

  const credential = await signInWithEmailLink(
    firebaseAuth,
    normalizedEmail,
    url,
  );

  try {
    window.localStorage.removeItem(CUSTOMER_EMAIL_STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage after authentication succeeds.
  }

  await credential.user.getIdToken(true);
  const verification = await verifyCustomerPortalEmail();

  return {
    user: credential.user,
    verification,
  };
}

export async function signOutCustomerPortal() {
  const firebaseAuth = requireCustomerAuth();
  await signOut(firebaseAuth);
}
