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
import { formatCustomerName } from "./textFormatters";

const STORAGE_KEY = "dispatch-cl-customer-payment-links";
const PAYMENT_LINKS_COLLECTION = "customerPaymentLinks";

function getLocalPaymentLinks() {
  try {
    const savedPaymentLinks = localStorage.getItem(STORAGE_KEY);

    if (!savedPaymentLinks) {
      return [];
    }

    const parsedPaymentLinks = JSON.parse(savedPaymentLinks);

    return Array.isArray(parsedPaymentLinks) ? parsedPaymentLinks : [];
  } catch (error) {
    console.error("Unable to load customer payment links:", error);
    return [];
  }
}

function saveLocalPaymentLinks(paymentLinks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paymentLinks));

    return true;
  } catch (error) {
    console.error("Unable to save customer payment links:", error);
    return false;
  }
}

function sortPaymentLinks(paymentLinks) {
  return [...paymentLinks].sort((firstLink, secondLink) => {
    const monthCompare = String(secondLink.month || "").localeCompare(
      String(firstLink.month || ""),
    );

    if (monthCompare !== 0) {
      return monthCompare;
    }

    return String(firstLink.customerName || "").localeCompare(
      String(secondLink.customerName || ""),
    );
  });
}

export function getPaymentLinkRecordId(month, customerId) {
  return `${month}_${customerId}`.replace(/[/?#[\]]/g, "-");
}

export function subscribeToCustomerPaymentLinks(onPaymentLinks, onError) {
  if (!db) {
    onPaymentLinks(getLocalPaymentLinks());
    return () => {};
  }

  const paymentLinksQuery = query(
    collection(db, PAYMENT_LINKS_COLLECTION),
    orderBy("month", "desc"),
  );

  return onSnapshot(
    paymentLinksQuery,
    (paymentLinkSnapshot) => {
      const paymentLinks = paymentLinkSnapshot.docs.map((paymentLinkDoc) => ({
        id: paymentLinkDoc.id,
        ...paymentLinkDoc.data(),
      }));
      const sortedPaymentLinks = sortPaymentLinks(paymentLinks);

      saveLocalPaymentLinks(sortedPaymentLinks);
      onPaymentLinks(sortedPaymentLinks);
    },
    onError,
  );
}

export async function ensureMonthlyPaymentLinks(customers, month, createdBy) {
  const currentPaymentLinks = getLocalPaymentLinks();
  const now = new Date().toISOString();
  const eligibleCustomers = (Array.isArray(customers) ? customers : []).filter(
    (customer) => customer.needsPaymentLink,
  );
  const currentPaymentLinkIds = new Set(
    currentPaymentLinks.map((paymentLink) => paymentLink.id),
  );
  const newPaymentLinks = eligibleCustomers
    .map((customer) => {
      const id = getPaymentLinkRecordId(month, customer.id);
      const selectedContact = Array.isArray(customer.contacts)
        ? customer.contacts.find(
            (contact) => contact.id === customer.paymentLinkContactId,
          ) || customer.contacts.find((contact) => contact.email)
        : null;

      if (currentPaymentLinkIds.has(id)) {
        return null;
      }

      return {
        id,
        month,
        customerId: customer.id,
        customerName:
          formatCustomerName(customer.companyName || customer.name) ||
          "UNNAMED CUSTOMER",
        accountNumber: customer.accountNumber || "",
        contactId: selectedContact?.id || "",
        contactLabel: selectedContact?.label || "",
        contactName: selectedContact?.name || "",
        contactEmail: selectedContact?.email || customer.email || "",
        status: "notSent",
        notes: customer.paymentLinkNotes || "",
        createdById: createdBy?.id || "",
        createdByName: createdBy?.name || "",
        createdByEmail: createdBy?.email || "",
        createdAt: now,
        updatedAt: now,
      };
    })
    .filter(Boolean);

  if (db) {
    await Promise.all(
      newPaymentLinks.map((paymentLink) =>
        setDoc(doc(db, PAYMENT_LINKS_COLLECTION, paymentLink.id), paymentLink),
      ),
    );
  }

  const updatedPaymentLinks = sortPaymentLinks([
    ...newPaymentLinks,
    ...currentPaymentLinks,
  ]);

  saveLocalPaymentLinks(updatedPaymentLinks);

  return updatedPaymentLinks;
}

export async function updateCustomerPaymentLink(paymentLinkId, updates) {
  const currentPaymentLinks = getLocalPaymentLinks();
  const updatedAt = new Date().toISOString();
  const savedUpdates = {
    ...updates,
    updatedAt,
  };
  const updatedPaymentLinks = sortPaymentLinks(
    currentPaymentLinks.map((paymentLink) =>
      paymentLink.id === paymentLinkId
        ? {
            ...paymentLink,
            ...savedUpdates,
          }
        : paymentLink,
    ),
  );

  if (db) {
    await updateDoc(
      doc(db, PAYMENT_LINKS_COLLECTION, paymentLinkId),
      savedUpdates,
    );
  }

  saveLocalPaymentLinks(updatedPaymentLinks);

  return updatedPaymentLinks;
}
