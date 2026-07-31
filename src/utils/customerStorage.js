import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-customers";
const CUSTOMERS_COLLECTION = "customers";

function getLocalCustomers() {
  try {
    const savedCustomers = localStorage.getItem(STORAGE_KEY);

    if (!savedCustomers) {
      return [];
    }

    const parsedCustomers = JSON.parse(savedCustomers);

    return Array.isArray(parsedCustomers) ? parsedCustomers : [];
  } catch (error) {
    console.error("Unable to load customers:", error);
    return [];
  }
}

function saveLocalCustomers(customers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));

    return true;
  } catch (error) {
    console.error("Unable to save customers:", error);
    return false;
  }
}

function sortCustomers(customers) {
  return [...customers].sort((firstCustomer, secondCustomer) =>
    String(
      firstCustomer.companyName || firstCustomer.name || "",
    ).localeCompare(
      String(secondCustomer.companyName || secondCustomer.name || ""),
    ),
  );
}

export function subscribeToCustomers(onCustomers, onError) {
  if (!db) {
    onCustomers(getLocalCustomers());
    return () => {};
  }

  const customersQuery = query(
    collection(db, CUSTOMERS_COLLECTION),
    orderBy("companyName", "asc"),
  );

  return onSnapshot(
    customersQuery,
    (customerSnapshot) => {
      const customers = customerSnapshot.docs.map((customerDoc) => ({
        id: customerDoc.id,
        ...customerDoc.data(),
      }));
      const sortedCustomers = sortCustomers(customers);

      saveLocalCustomers(sortedCustomers);
      onCustomers(sortedCustomers);
    },
    onError,
  );
}

export async function addCustomer(customer) {
  const currentCustomers = getLocalCustomers();
  const updatedCustomers = sortCustomers([
    customer,
    ...currentCustomers,
  ]);

  if (db) {
    await setDoc(
      doc(db, CUSTOMERS_COLLECTION, customer.id),
      customer,
    );
  }

  saveLocalCustomers(updatedCustomers);

  return updatedCustomers;
}

export async function updateCustomer(customerId, customerUpdates) {
  const currentCustomers = getLocalCustomers();
  const updatedAt = new Date().toISOString();
  const updates = {
    ...customerUpdates,
    updatedAt,
  };

  const updatedCustomers = sortCustomers(
    currentCustomers.map((customer) =>
      customer.id === customerId
        ? {
            ...customer,
            ...updates,
          }
        : customer,
    ),
  );

  if (db) {
    await updateDoc(
      doc(db, CUSTOMERS_COLLECTION, customerId),
      updates,
    );
  }

  saveLocalCustomers(updatedCustomers);

  return updatedCustomers;
}
