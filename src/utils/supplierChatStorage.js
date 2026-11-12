import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";

const CONVERSATIONS_COLLECTION = "supplierConversations";
const INVITATIONS_COLLECTION = "supplierInvitations";
const SAVED_QUOTES_COLLECTION = "supplierQuotes";

export async function claimSupplierInvitation(invitationId) {
  const normalizedInvitationId = String(invitationId || "").trim();
  if (!functions || !normalizedInvitationId) {
    throw new Error("The supplier invitation could not be verified.");
  }

  const claimInvitation = httpsCallable(
    functions,
    "claimSupplierInvitation",
  );
  const response = await claimInvitation({
    invitationId: normalizedInvitationId,
  });
  return response.data;
}

export async function diagnoseSupplierChatAccess(options = {}) {
  if (!functions) {
    throw new Error("Supplier Chat diagnostics are unavailable.");
  }

  const diagnoseAccess = httpsCallable(
    functions,
    "diagnoseSupplierChatAccess",
  );
  const response = await diagnoseAccess(options);
  return response.data;
}

export async function startSupplierConversation() {
  return diagnoseSupplierChatAccess({ createIfMissing: true });
}

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
  isInternal,
  onConversations,
  onError,
}) {
  if (!db || !userId) {
    onConversations([]);
    return () => {};
  }

  const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
  if (isInternal) {
    return onSnapshot(
      query(conversationsRef, orderBy("updatedAt", "desc")),
      (snapshot) => onConversations(sortNewest(snapshot.docs.map(mapDocument))),
      onError,
    );
  }

  let active = true;
  let subscriptions = [];
  const conversationsById = new Map();

  diagnoseSupplierChatAccess()
    .then((diagnostic) => {
      if (!active) return;
      const conversationIds = Array.isArray(
        diagnostic?.authorizedConversationIds,
      )
        ? diagnostic.authorizedConversationIds
        : [];

      if (conversationIds.length === 0) {
        if (diagnostic?.code === "SC-ASSIGNMENT-002") {
          onConversations([]);
          return;
        }
        const assignmentError = new Error(
          diagnostic?.message || "No supplier conversations are assigned to this account.",
        );
        assignmentError.code = diagnostic?.code || "supplier-chat/no-assignment";
        onError(assignmentError);
        return;
      }

      subscriptions = conversationIds.map((conversationId) =>
        onSnapshot(
          doc(db, CONVERSATIONS_COLLECTION, conversationId),
          (snapshot) => {
            if (!active) return;
            if (snapshot.exists()) {
              conversationsById.set(conversationId, mapDocument(snapshot));
            } else {
              conversationsById.delete(conversationId);
            }
            onConversations(sortNewest([...conversationsById.values()]));
          },
          onError,
        ),
      );
    })
    .catch(onError);

  return () => {
    active = false;
    subscriptions.forEach((unsubscribe) => unsubscribe());
    subscriptions = [];
  };
}

export async function deleteSupplierConversation(conversationId) {
  if (!db || !conversationId) {
    throw new Error("Choose a supplier conversation to delete.");
  }

  const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
  const messagesSnapshot = await getDocs(
    collection(conversationRef, "messages"),
  );

  // Firestore does not cascade subcollection deletes. Delete message documents
  // in bounded batches before removing the conversation itself.
  const messageDocs = messagesSnapshot.docs;
  for (let index = 0; index < messageDocs.length; index += 450) {
    const batch = writeBatch(db);
    messageDocs.slice(index, index + 450).forEach((messageDocument) => {
      batch.delete(messageDocument.ref);
    });
    await batch.commit();
  }

  await deleteDoc(conversationRef);
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
  const supplierUserId = String(supplierUser.uid || supplierUser.id || "").trim();
  return addDoc(collection(db, CONVERSATIONS_COLLECTION), {
    vendorId,
    vendorName,
    title: `${vendorName} pricing`,
    participantUids: [internalUser.id, supplierUserId],
    internalParticipantUids: [internalUser.id],
    supplierParticipantUids: [supplierUserId],
    supplierContactName:
      supplierUser.displayName || supplierUser.email || "Supplier contact",
    supplierContactEmail: supplierUser.email || "",
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: internalUser.id,
  });
}

export async function updateSupplierConversationAssignment({
  conversationId,
  supplierUser,
  internalParticipantUids = [],
}) {
  const supplierUserId = String(supplierUser?.uid || supplierUser?.id || "").trim();
  const vendorId = String(supplierUser?.vendorId || "").trim();
  const vendorName = String(supplierUser?.vendorName || "").trim();
  if (!db || !conversationId || !supplierUserId || !vendorId || !vendorName) {
    throw new Error("Choose an approved supplier contact with a vendor assignment.");
  }

  const safeInternalParticipantUids = Array.from(
    new Set(
      (Array.isArray(internalParticipantUids) ? internalParticipantUids : [])
        .map((userId) => String(userId || "").trim())
        .filter(Boolean),
    ),
  );

  return updateDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId), {
    vendorId,
    vendorName,
    title: `${vendorName} pricing`,
    participantUids: [...safeInternalParticipantUids, supplierUserId],
    supplierParticipantUids: [supplierUserId],
    supplierContactName:
      supplierUser.displayName || supplierUser.email || "Supplier contact",
    supplierContactEmail: supplierUser.email || "",
    updatedAt: serverTimestamp(),
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
      ? quote.kind === "request"
        ? `Pricing requested for ${quote.items?.[0]?.productName || quote.productName || "product"}`
        : `${quote.items?.[0]?.productName || quote.productName || "Product"} pricing`
      : message.text.slice(0, 160),
    lastMessageBy: message.senderUid,
  });
}

export async function updateSupplierQuoteStatus({
  conversationId,
  messageId,
  status,
}) {
  if (!db || !conversationId || !messageId || !status) {
    throw new Error("That pricing status could not be updated.");
  }

  await updateDoc(
    doc(
      db,
      CONVERSATIONS_COLLECTION,
      conversationId,
      "messages",
      messageId,
    ),
    {
      "quote.status": status,
      "quote.statusUpdatedAt": serverTimestamp(),
    },
  );
}

export function subscribeToSupplierQuotes({
  vendorId,
  onQuotes,
  onError,
}) {
  const normalizedVendorId = String(vendorId || "").trim();
  if (!db || !normalizedVendorId) {
    onQuotes([]);
    return () => {};
  }

  return onSnapshot(
    query(
      collection(db, SAVED_QUOTES_COLLECTION),
      where("vendorId", "==", normalizedVendorId),
    ),
    (snapshot) => onQuotes(sortNewest(snapshot.docs.map(mapDocument))),
    onError,
  );
}

export async function saveSupplierQuote({
  conversation,
  message,
  savedBy,
}) {
  const conversationId = String(conversation?.id || "").trim();
  const messageId = String(message?.id || "").trim();
  const vendorId = String(conversation?.vendorId || message?.vendorId || "").trim();
  const savedById = String(savedBy?.id || savedBy?.uid || "").trim();
  if (
    !db ||
    !conversationId ||
    !messageId ||
    !vendorId ||
    !savedById ||
    !message?.quote ||
    message.quote.kind === "request"
  ) {
    throw new Error("That supplier quote could not be saved.");
  }

  const quoteId = `${conversationId}__${messageId}`;
  await setDoc(
    doc(db, SAVED_QUOTES_COLLECTION, quoteId),
    {
      vendorId,
      vendorName: conversation.vendorName || "Supplier",
      conversationId,
      messageId,
      quote: message.quote,
      quotedAt: message.createdAt || null,
      quotedByUid: message.senderUid || "",
      quotedByName: message.senderName || conversation.supplierContactName || "Supplier contact",
      supplierContactName: conversation.supplierContactName || message.senderName || "Supplier contact",
      supplierContactEmail: conversation.supplierContactEmail || "",
      savedBy: savedById,
      savedByName: savedBy.displayName || savedBy.email || "Capital Lumber",
      savedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return quoteId;
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
  } else if (priceUnit === "BF") {
    extendedPrice = totalBoardFeet * dimensions.quotedPrice;
    pricePerPiece = boardFeetEach * dimensions.quotedPrice;
    pricePerMbf = dimensions.quotedPrice * 1000;
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
