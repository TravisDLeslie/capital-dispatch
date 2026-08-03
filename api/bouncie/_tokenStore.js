import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TOKEN_DOC_PATH = "integrations/bouncie";

function parseServiceAccount() {
  const rawValue =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    "";

  if (!rawValue) {
    return null;
  }

  try {
    const normalizedValue = rawValue.trim().startsWith("{")
      ? rawValue
      : Buffer.from(rawValue, "base64").toString("utf8");
    const serviceAccount = JSON.parse(normalizedValue);

    return {
      ...serviceAccount,
      private_key: String(serviceAccount.private_key || "").replace(
        /\\n/g,
        "\n",
      ),
    };
  } catch (error) {
    console.error("Unable to parse Firebase service account:", error);
    return null;
  }
}

function getAdminDb() {
  const serviceAccount = parseServiceAccount();

  if (!serviceAccount) {
    return null;
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId:
        process.env.FIREBASE_PROJECT_ID ||
        process.env.VITE_FIREBASE_PROJECT_ID ||
        serviceAccount.project_id,
    });
  }

  return getFirestore();
}

export async function getStoredBouncieTokens() {
  const db = getAdminDb();

  if (!db) {
    return null;
  }

  try {
    const tokenSnapshot = await db.doc(TOKEN_DOC_PATH).get();

    if (!tokenSnapshot.exists) {
      return null;
    }

    return tokenSnapshot.data() || null;
  } catch (error) {
    console.error("Unable to read Bouncie tokens from Firestore:", error);
    return null;
  }
}

export async function saveBouncieTokens(tokenData, source = "api") {
  const db = getAdminDb();

  if (!db || !tokenData?.accessToken) {
    return false;
  }

  const now = new Date();
  const expiresInSeconds = Number(tokenData.expiresIn || 0);
  const expiresAt =
    expiresInSeconds > 0
      ? new Date(now.getTime() + expiresInSeconds * 1000).toISOString()
      : "";

  try {
    await db.doc(TOKEN_DOC_PATH).set(
      {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || "",
        expiresIn: expiresInSeconds || null,
        expiresAt,
        source,
        updatedAt: now.toISOString(),
      },
      { merge: true },
    );

    return true;
  } catch (error) {
    console.error("Unable to save Bouncie tokens to Firestore:", error);
    return false;
  }
}

export function canPersistBouncieTokens() {
  return Boolean(parseServiceAccount());
}
