import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const CONVERSATIONS_COLLECTION = "supplierConversations";
const INVITATIONS_COLLECTION = "supplierInvitations";

function mapDocument(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function sortNewest(items) {
  const valueOf = (value) => {
    if (typeof value?.toMillis === "function") return value.toMillis();
    const dateValue = new Date(value || 0).getTime();
    return Number.isFinite(dateValue) ? dateValue : 0;
  };

  return [...items].sort(
    (first, second) =>
      valueOf(second.updatedAt || second.createdAt) -
      valueOf(first.updatedAt || first.createdAt),
  );
}

export function subscribeToSupplierConversations({
  userId,
  vendorId,
  isInternal,
  onConversations,
  onError,
}) {
  if (!db || !userId) {
    onConversations([]);
    return () => {};
  }

  const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
  const conversationsQuery = isInternal
    ? query(conversationsRef, orderBy("updatedAt", "desc"))
    : query(
        conversationsRef,
        where("vendorId", "==", vendorId),
        where("supplierParticipantUids", "array-contains", userId),
      );

  return onSnapshot(
    conversationsQuery,
    (snapshot) => onConversations(sortNewest(snapshot.docs.map(mapDocument))),
    onError,
  );
}

export function subscribeToSupplierMessages(
  conversationId,
  onMessages,
  onError,
) {
  if (!db || !conversationId) {
    onMessages([]);
    return () => {};
  }

  return onSnapshot(
    query(
      collection(
        db,
        CONVERSATIONS_COLLECTION,
        conversationId,
        "messages",
      ),
      orderBy("createdAt", "asc"),
    ),
    (snapshot) => onMessages(snapshot.docs.map(mapDocument)),
    onError,
  );
}

export async function createSupplierInvitation({
  email,
  contactName,
  vendorId,
  vendorName,
  createdBy,
}) {
  return addDoc(collection(db, INVITATIONS_COLLECTION), {
    email: String(email || "").trim().toLowerCase(),
    contactName: String(contactName || "").trim(),
    vendorId,
    vendorName,
    status: "pending",
    emailStatus: "queued",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  });
}

export function subscribeToSupplierInvitations(onInvitations, onError) {
  if (!db) {
    onInvitations([]);
    return () => {};
  }

  return onSnapshot(
    query(
      collection(db, INVITATIONS_COLLECTION),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => onInvitations(snapshot.docs.map(mapDocument)),
    onError,
  );
}

export async function cancelSupplierInvitation(invitationId, canceledBy) {
  if (!db || !invitationId || !canceledBy) {
    throw new Error("The supplier invitation could not be canceled.");
  }

  return updateDoc(doc(db, INVITATIONS_COLLECTION, invitationId), {
    status: "canceled",
    canceledAt: serverTimestamp(),
    canceledBy,
    updatedAt: serverTimestamp(),
  });
}

export async function createSupplierConversation({
  vendorId,
  vendorName,
  supplierUser,
  internalUser,
}) {
  return addDoc(collection(db, CONVERSATIONS_COLLECTION), {
    vendorId,
    vendorName,
    title: `${vendorName} pricing`,
    participantUids: [internalUser.id, supplierUser.id],
    internalParticipantUids: [internalUser.id],
    supplierParticipantUids: [supplierUser.id],
    supplierContactName:
      supplierUser.displayName || supplierUser.email || "Supplier contact",
    supplierContactEmail: supplierUser.email || "",
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: internalUser.id,
  });
}

export async function sendSupplierMessage({
  conversationId,
  vendorId,
  sender,
  text,
  quote = null,
}) {
  const message = {
    type: quote ? "quote" : "text",
    vendorId,
    senderUid: sender.id,
    senderName: sender.displayName || sender.email || "User",
    senderRole: sender.role || "supplier",
    text: String(text || "").trim(),
    createdAt: serverTimestamp(),
  };

  if (quote) {
    message.quote = quote;
  }

  await addDoc(
    collection(
      db,
      CONVERSATIONS_COLLECTION,
      conversationId,
      "messages",
    ),
    message,
  );
  await updateDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId), {
    updatedAt: serverTimestamp(),
    lastMessage: quote
      ? `${quote.productName || "Product"} pricing`
      : message.text.slice(0, 160),
    lastMessageBy: message.senderUid,
  });
}

export function calculateLumberQuote({
  thickness,
  width,
  length,
  quantity,
  quotedPrice,
  priceUnit,
}) {
  const dimensions = {
    thickness: Number(thickness) || 0,
    width: Number(width) || 0,
    length: Number(length) || 0,
    quantity: Number(quantity) || 0,
    quotedPrice: Number(quotedPrice) || 0,
  };
  const boardFeetEach =
    (dimensions.thickness * dimensions.width * dimensions.length) / 12;
  const totalBoardFeet = boardFeetEach * dimensions.quantity;
  const thousandBoardFeet = totalBoardFeet / 1000;
  let pricePerMbf = 0;
  let pricePerPiece = 0;
  let extendedPrice = 0;

  if (priceUnit === "MBF") {
    pricePerMbf = dimensions.quotedPrice;
    pricePerPiece = (boardFeetEach / 1000) * pricePerMbf;
    extendedPrice = thousandBoardFeet * pricePerMbf;
  } else if (priceUnit === "LF") {
    extendedPrice =
      dimensions.quantity * dimensions.length * dimensions.quotedPrice;
    pricePerPiece = dimensions.length * dimensions.quotedPrice;
    pricePerMbf = totalBoardFeet
      ? (extendedPrice / totalBoardFeet) * 1000
      : 0;
  } else {
    pricePerPiece = dimensions.quotedPrice;
    extendedPrice = dimensions.quantity * pricePerPiece;
    pricePerMbf = totalBoardFeet
      ? (extendedPrice / totalBoardFeet) * 1000
      : 0;
  }

  return {
    boardFeetEach,
    totalBoardFeet,
    thousandBoardFeet,
    pricePerMbf,
    pricePerPiece,
    extendedPrice,
  };
}
