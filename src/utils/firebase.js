import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function normalizeStorageBucket(value) {
  return String(value || "")
    .trim()
    .replace(/^gs:\/\//, "")
    .replace(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//, "")
    .replace(/\/o.*$/, "")
    .replace(/\/$/, "");
}

const storageBucket = normalizeStorageBucket(
  import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket,
  messagingSenderId: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasRequiredFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.appId,
);

const firebaseApp = hasRequiredFirebaseConfig
  ? initializeApp(firebaseConfig)
  : null;

export const db = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;

export const storage =
  firebaseApp && storageBucket
    ? getStorage(firebaseApp, `gs://${storageBucket}`)
    : null;

export const isFirebaseConfigured =
  hasRequiredFirebaseConfig;
