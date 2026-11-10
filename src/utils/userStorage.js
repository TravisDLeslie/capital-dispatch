import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const USERS_COLLECTION = "users";

function getUserProfileFromDoc(userDoc) {
  return {
    id: userDoc.id,
    ...userDoc.data(),
  };
}

export async function ensureUserProfile(user, superAdminEmails = []) {
  if (!db || !user) {
    return null;
  }

  const email = user.email || "";
  const normalizedEmail = email.toLowerCase();
  const isSuperAdmin = superAdminEmails.includes(normalizedEmail);
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const userSnapshot = await getDoc(userRef);
  const now = new Date().toISOString();

  if (userSnapshot.exists()) {
    const savedProfile = userSnapshot.data();
    const superAdminUpdates = isSuperAdmin
      ? {
          role: "superAdmin",
          status: "approved",
          approvedAt:
            savedProfile.approvedAt || now,
          approvedBy:
            savedProfile.approvedBy || "system",
        }
      : {};
    const displayName = savedProfile.displayName || user.displayName || "";

    await updateDoc(userRef, {
      email,
      displayName,
      photoURL: user.photoURL || "",
      lastLoginAt: now,
      updatedAt: now,
      ...superAdminUpdates,
    });

    return {
      id: userSnapshot.id,
      ...savedProfile,
      email,
      displayName,
      photoURL: user.photoURL || "",
      lastLoginAt: now,
      updatedAt: now,
      ...superAdminUpdates,
    };
  }

  const profile = {
    uid: user.uid,
    email,
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    role: isSuperAdmin ? "superAdmin" : "pending",
    status: isSuperAdmin ? "approved" : "pending",
    employeeActive: true,
    driverName: "",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    approvedAt: isSuperAdmin ? now : null,
    approvedBy: isSuperAdmin ? "system" : "",
  };

  await setDoc(userRef, profile);

  return {
    id: user.uid,
    ...profile,
  };
}

export function subscribeToUserProfile(uid, onProfile, onError) {
  if (!db || !uid) {
    onProfile(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, USERS_COLLECTION, uid),
    (userSnapshot) => {
      onProfile(
        userSnapshot.exists()
          ? getUserProfileFromDoc(userSnapshot)
          : null,
      );
    },
    onError,
  );
}

export function subscribeToUsers(onUsers, onError) {
  if (!db) {
    onUsers([]);
    return () => {};
  }

  const usersQuery = query(
    collection(db, USERS_COLLECTION),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    usersQuery,
    (usersSnapshot) => {
      onUsers(usersSnapshot.docs.map(getUserProfileFromDoc));
    },
    onError,
  );
}

export async function updateUserProfile(userId, updates) {
  if (!db) {
    return;
  }

  await updateDoc(doc(db, USERS_COLLECTION, userId), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteSupplierAccount(userId) {
  if (!db || !auth?.currentUser || !userId) {
    throw new Error("The supplier account could not be deleted.");
  }

  const requestRef = await addDoc(
    collection(db, "supplierAccountDeletionRequests"),
    {
      targetUserId: userId,
      createdBy: auth.currentUser.uid,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );

  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          "Supplier deletion is taking longer than expected. Refresh User Access to check whether the account was removed.",
        ),
      );
    }, 120000);

    unsubscribe = onSnapshot(
      requestRef,
      (requestSnapshot) => {
        const requestData = requestSnapshot.data();
        if (requestData?.status === "completed") {
          window.clearTimeout(timeoutId);
          unsubscribe();
          resolve(requestData);
        } else if (requestData?.status === "failed") {
          window.clearTimeout(timeoutId);
          unsubscribe();
          reject(
            new Error(
              requestData.error || "The supplier account could not be deleted.",
            ),
          );
        }
      },
      (snapshotError) => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        reject(snapshotError);
      },
    );
  });
}
