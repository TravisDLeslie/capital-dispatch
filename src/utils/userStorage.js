import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

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
    const superAdminUpdates = isSuperAdmin
      ? {
          role: "superAdmin",
          status: "approved",
          approvedAt:
            userSnapshot.data().approvedAt || now,
          approvedBy:
            userSnapshot.data().approvedBy || "system",
        }
      : {};

    await updateDoc(userRef, {
      email,
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      lastLoginAt: now,
      updatedAt: now,
      ...superAdminUpdates,
    });

    return {
      id: userSnapshot.id,
      ...userSnapshot.data(),
      email,
      displayName: user.displayName || "",
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
