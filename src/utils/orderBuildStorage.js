import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-order-builds";
const ORDER_BUILDS_COLLECTION = "orderBuilds";

function getLocalOrderBuilds() {
  try {
    const savedBuilds = localStorage.getItem(STORAGE_KEY);

    if (!savedBuilds) {
      return [];
    }

    const parsedBuilds = JSON.parse(savedBuilds);

    return Array.isArray(parsedBuilds) ? parsedBuilds : [];
  } catch (error) {
    console.error("Unable to load order builds:", error);
    return [];
  }
}

function saveLocalOrderBuilds(orderBuilds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderBuilds));
    return true;
  } catch (error) {
    console.error("Unable to save order builds:", error);
    return false;
  }
}

function sortOrderBuilds(orderBuilds) {
  return [...orderBuilds].sort(
    (firstBuild, secondBuild) =>
      new Date(secondBuild.createdAt || secondBuild.updatedAt || 0) -
      new Date(firstBuild.createdAt || firstBuild.updatedAt || 0),
  );
}

export function subscribeToOrderBuilds(onOrderBuilds, onError) {
  if (!db) {
    onOrderBuilds(getLocalOrderBuilds());
    return () => {};
  }

  const orderBuildsQuery = query(
    collection(db, ORDER_BUILDS_COLLECTION),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    orderBuildsQuery,
    (orderBuildSnapshot) => {
      const orderBuilds = orderBuildSnapshot.docs.map((orderBuildDoc) => ({
        id: orderBuildDoc.id,
        ...orderBuildDoc.data(),
      }));
      const sortedOrderBuilds = sortOrderBuilds(orderBuilds);

      saveLocalOrderBuilds(sortedOrderBuilds);
      onOrderBuilds(sortedOrderBuilds);
    },
    onError,
  );
}

export async function saveOrderBuild(orderBuild) {
  const currentOrderBuilds = getLocalOrderBuilds();
  const existingBuild = currentOrderBuilds.find(
    (currentBuild) => currentBuild.id === orderBuild.id,
  );
  const now = new Date().toISOString();
  const savedBuild = {
    ...existingBuild,
    ...orderBuild,
    createdAt: existingBuild?.createdAt || orderBuild.createdAt || now,
    updatedAt: now,
  };
  const updatedOrderBuilds = sortOrderBuilds([
    savedBuild,
    ...currentOrderBuilds.filter(
      (currentBuild) => currentBuild.id !== savedBuild.id,
    ),
  ]);

  if (db) {
    await setDoc(
      doc(db, ORDER_BUILDS_COLLECTION, savedBuild.id),
      savedBuild,
    );
  }

  saveLocalOrderBuilds(updatedOrderBuilds);

  return updatedOrderBuilds;
}
