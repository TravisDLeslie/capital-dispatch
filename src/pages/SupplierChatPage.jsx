import { useEffect, useMemo, useRef, useState } from "react";
import {
  getIdTokenResult,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from "firebase/auth";
import {
  Ban,
  Building2,
  Calculator,
  Check,
  Copy,
  DollarSign,
  LockKeyhole,
  MailPlus,
  MessageSquareText,
  PackageSearch,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import PageContainer from "../components/PageContainer";
import { auth } from "../utils/firebase";
import {
  calculateLumberQuote,
  cancelSupplierInvitation,
  createSupplierConversation,
  createSupplierInvitation,
  deleteSupplierConversation,
  diagnoseSupplierChatAccess,
  saveSupplierQuote,
  sendSupplierMessage,
  startSupplierConversation,
  subscribeToSupplierConversations,
  subscribeToSupplierInvitations,
  subscribeToSupplierMessages,
  subscribeToSupplierQuotes,
  updateSupplierQuoteStatus,
  updateSupplierConversationAssignment,
} from "../utils/supplierChatStorage";

const PRICE_UNITS = [
  ["piece", "Each"],
  ["LF", "LF"],
  ["BF", "BF"],
  ["MBF", "MBF / M"],
  ["bundle", "Bundle"],
  ["unit", "Unit"],
];

function createEmptyQuoteItem() {
  return {
    productName: "",
    quantity: "",
    quotedPrice: "",
    priceUnit: "piece",
    availability: "Available",
    leadTime: "",
    profile: "",
    availableQuantities: "",
    species: "",
    grade: "",
    thickness: "",
    width: "",
    length: "",
  };
}

function createEmptyQuote(kind = "quote") {
  return {
    kind,
    items: [createEmptyQuoteItem()],
    status: kind === "request" ? "requested" : "quoted",
    validUntil: "",
    notes: "",
    revisionOf: "",
  };
}

function priceUnitLabel(value) {
  return PRICE_UNITS.find(([unit]) => unit === value)?.[1] || value || "Unit";
}

const CHAT_UNLOCK_WINDOW_MS = 30 * 60 * 1000;

function chatUnlockStorageKey(userId) {
  return `capital-supplier-chat-unlocked:${userId}`;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function formatSupplierChatDiagnostic(diagnostic) {
  if (!diagnostic) return "";

  return [
    `Supplier Chat diagnostic: ${diagnostic.code || "Unknown"}`,
    diagnostic.title ? `Issue: ${diagnostic.title}` : "",
    diagnostic.message ? `Finding: ${diagnostic.message}` : "",
    diagnostic.action ? `Next step: ${diagnostic.action}` : "",
    diagnostic.email ? `Email: ${diagnostic.email}` : "",
    diagnostic.userId ? `User ID: ${diagnostic.userId}` : "",
    diagnostic.role ? `Role: ${diagnostic.role}` : "",
    diagnostic.status ? `Status: ${diagnostic.status}` : "",
    diagnostic.workView ? `Work view: ${diagnostic.workView}` : "",
    diagnostic.vendorName || diagnostic.vendorId
      ? `Vendor: ${diagnostic.vendorName || "Not named"} (${diagnostic.vendorId || "No vendor ID"})`
      : "Vendor: Not assigned",
    Number.isFinite(diagnostic.assignedConversationCount)
      ? `Conversations assigned to user ID: ${diagnostic.assignedConversationCount}`
      : "",
    Number.isFinite(diagnostic.matchingVendorConversationCount)
      ? `Conversations matching vendor: ${diagnostic.matchingVendorConversationCount}`
      : "",
    diagnostic.firestoreCode
      ? `Firestore code: ${diagnostic.firestoreCode}`
      : "",
    diagnostic.firestoreMessage
      ? `Firestore message: ${diagnostic.firestoreMessage}`
      : "",
  ].filter(Boolean).join("\n");
}

async function copyToClipboard(value) {
  const text = String(value || "").trim();
  if (!text) throw new Error("There is no link to copy.");

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Safari and managed mobile browsers can reject the modern clipboard API.
      // Continue to the selection-based fallback below.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.width = "1px";
  textArea.style.height = "1px";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  if (!copied) throw new Error("Your browser blocked copying. Select and copy the link below.");
}

function normalizedQuoteItems(quote) {
  if (Array.isArray(quote?.items) && quote.items.length) return quote.items;
  return quote?.productName ? [quote] : [];
}

function quoteStatus(quote) {
  if (quote?.status === "accepted") return "accepted";
  if (quote?.status === "clarification") return "clarification";
  if (quote?.kind === "request") return "requested";
  if (quote?.validUntil) {
    const expiration = new Date(`${quote.validUntil}T23:59:59`);
    if (!Number.isNaN(expiration.getTime()) && expiration.getTime() < Date.now()) {
      return "expired";
    }
  }
  return quote?.status || "quoted";
}

function QuoteCard({
  quote,
  canManageStatus = false,
  canReply = false,
  canRevise = false,
  canSave = false,
  isSaved = false,
  isSaving = false,
  onReply,
  onRevise,
  onSave,
  onStatusChange,
}) {
  const items = normalizedQuoteItems(quote);
  const isRequest = quote?.kind === "request";
  const status = quoteStatus(quote);
  const statusStyles = {
    accepted: "bg-emerald-100 text-emerald-800",
    clarification: "bg-amber-100 text-amber-800",
    expired: "bg-slate-200 text-slate-600",
    quoted: "bg-blue-100 text-blue-800",
    requested: "bg-violet-100 text-violet-800",
  };
  const statusLabels = {
    accepted: "Accepted",
    clarification: "Needs clarification",
    expired: "Expired",
    quoted: "Quoted",
    requested: "Pricing requested",
  };
  const extendedTotal = items.reduce(
    (total, item) => total + (Number(item.extendedPrice) || 0),
    0,
  );

  return (
    <div className="mt-2.5 rounded-[16px] border border-black/10 bg-white p-2.5 text-slate-900 shadow-sm sm:mt-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${isRequest ? "text-violet-700" : "text-emerald-700"}`}>
            {isRequest ? "Price request" : quote?.revisionOf ? "Revised supplier quote" : "Supplier quote"}
          </p>
          <h4 className="mt-0.5 text-sm font-black sm:mt-1 sm:text-base">
            {items.length} {items.length === 1 ? "item" : "items"}
            {!isRequest && extendedTotal > 0 ? ` · ${money(extendedTotal)} total` : ""}
          </h4>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase sm:px-3 sm:text-xs ${statusStyles[status] || statusStyles.quoted}`}>
          {statusLabels[status] || "Quoted"}
        </span>
      </div>

      <div className="mt-2 space-y-1.5 sm:mt-3">
        {items.map((item, index) => (
          <div key={`${item.productName}-${index}`} className="rounded-xl bg-slate-50 p-2 sm:p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-black sm:text-sm">{item.productName || `Item ${index + 1}`}</p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500 sm:text-xs">
                  {item.quantity ? `Qty ${item.quantity}` : "Quantity open"}
                  {item.profile ? ` · ${item.profile}` : ""}
                  {item.species ? ` · ${item.species}` : ""}
                  {item.grade ? ` · ${item.grade}` : ""}
                  {item.thickness && item.width ? ` · ${item.thickness} × ${item.width}${item.length ? ` × ${item.length}'` : ""}` : item.length ? ` · ${item.length}'` : ""}
                </p>
              </div>
              {!isRequest ? (
                <p className="shrink-0 text-right text-xs font-black text-slate-950 sm:text-sm">
                  {money(item.quotedPrice)}
                  <span className="block text-[9px] uppercase text-slate-400 sm:text-[10px]">per {priceUnitLabel(item.priceUnit)}</span>
                </p>
              ) : item.priceUnit ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-500">Quote per {priceUnitLabel(item.priceUnit)}</span>
              ) : null}
            </div>
            {item.availableQuantities ? (
              <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-[10px] font-black leading-4 text-emerald-900 sm:text-xs">
                {isRequest ? "Requested lengths / quantities" : "Available by length"}: {item.availableQuantities}
              </p>
            ) : null}
            {!isRequest ? (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <div className="min-w-0 rounded-lg bg-white p-1.5 sm:p-2">
                  <p className="truncate text-[8px] font-black uppercase text-slate-400">Availability</p>
                  <p className="truncate text-[10px] font-black sm:text-xs">{item.availability || "Not set"}</p>
                </div>
                <div className="min-w-0 rounded-lg bg-blue-50 p-1.5 sm:p-2">
                  <p className="truncate text-[8px] font-black uppercase text-blue-500">Lead time</p>
                  <p className="truncate text-[10px] font-black text-blue-900 sm:text-xs">{item.leadTime || "Not set"}</p>
                </div>
                <div className="min-w-0 rounded-lg bg-amber-50 p-1.5 sm:p-2">
                  <p className="truncate text-[8px] font-black uppercase text-amber-600">Extended</p>
                  <p className="truncate text-[10px] font-black text-amber-950 sm:text-xs">{money(item.extendedPrice)}</p>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!isRequest && items.some((item) => Number(item.pricePerMbf) > 0) ? (
        <p className="mt-2 text-[10px] font-bold text-blue-700 sm:text-xs">
          MBF conversion: {items.map((item) => Number(item.pricePerMbf) > 0 ? money(item.pricePerMbf) : "—").join(" · ")}
        </p>
      ) : null}
      {quote?.validUntil ? <p className="mt-2 text-[10px] font-bold text-slate-500 sm:text-xs">Valid through {quote.validUntil}</p> : null}
      {quote.notes ? <p className="mt-1.5 text-[11px] leading-4 text-slate-600 sm:mt-2 sm:text-sm">{quote.notes}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!isRequest && canSave ? (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaved || isSaving}
            className={`rounded-full px-3 py-1.5 text-[11px] font-black disabled:cursor-default ${
              isSaved
                ? "bg-emerald-100 text-emerald-800"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {isSaved ? "Saved to vendor" : isSaving ? "Saving…" : "Save quote"}
          </button>
        ) : null}
        {isRequest && canReply ? (
          <button type="button" onClick={onReply} className="rounded-full bg-[#0A84FF] px-3 py-1.5 text-[11px] font-black text-white">Reply with pricing</button>
        ) : null}
        {!isRequest && canRevise ? (
          <button type="button" onClick={onRevise} className="rounded-full border border-[#0A84FF] bg-white px-3 py-1.5 text-[11px] font-black text-[#007AFF]">Revise quote</button>
        ) : null}
        {!isRequest && canManageStatus && status !== "accepted" ? (
          <button type="button" onClick={() => onStatusChange?.("accepted")} className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white">Accept &amp; save</button>
        ) : null}
        {!isRequest && canManageStatus && status !== "clarification" ? (
          <button type="button" onClick={() => onStatusChange?.("clarification")} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-800">Need clarification</button>
        ) : null}
      </div>
    </div>
  );
}

function Dialog({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7 ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SupplierChatPage({
  currentUserProfile,
  users,
  vendors,
  onPageChange,
}) {
  const currentUser = {
    ...currentUserProfile,
    id: currentUserProfile?.uid || currentUserProfile?.id,
  };
  const isSupplier = currentUserProfile?.role === "supplier";
  const isInternal = !isSupplier;
  const userList = useMemo(() => (Array.isArray(users) ? users : []), [users]);
  const vendorList = useMemo(
    () => (Array.isArray(vendors) ? vendors : []),
    [vendors],
  );
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const messageListRef = useRef(null);
  const lastScrolledConversationIdRef = useRef("");
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [conversationDiagnostic, setConversationDiagnostic] = useState(null);
  const [diagnosticCopyStatus, setDiagnosticCopyStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [showSavedQuotes, setShowSavedQuotes] = useState(false);
  const [savedQuoteSearch, setSavedQuoteSearch] = useState("");
  const [savingQuoteMessageId, setSavingQuoteMessageId] = useState("");
  const [invite, setInvite] = useState({ email: "", contactName: "", vendorId: "" });
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
  const [cancelingInvitationId, setCancelingInvitationId] = useState("");
  const [showInvitationLog, setShowInvitationLog] = useState(false);

  const activeInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations],
  );
  const canceledInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "canceled"),
    [invitations],
  );
  const [conversationDraft, setConversationDraft] = useState({ supplierUserId: "", vendorId: "" });
  const [assignmentSupplierUserId, setAssignmentSupplierUserId] = useState("");
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [quote, setQuote] = useState(() => createEmptyQuote());
  const [isChatUnlocked, setIsChatUnlocked] = useState(false);
  const [isCheckingUnlock, setIsCheckingUnlock] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );
  const supplierUsers = useMemo(
    () => userList.filter((user) => user.role === "supplier" && user.status === "approved"),
    [userList],
  );
  const quoteCalculations = useMemo(
    () => quote.items.map((item) => calculateLumberQuote(item)),
    [quote.items],
  );
  const savedQuoteMessageIds = useMemo(
    () => new Set(savedQuotes.map((item) => item.messageId)),
    [savedQuotes],
  );
  const filteredSavedQuotes = useMemo(() => {
    const search = savedQuoteSearch.trim().toLowerCase();
    if (!search) return savedQuotes;
    return savedQuotes.filter((savedQuote) => {
      const items = normalizedQuoteItems(savedQuote.quote);
      return [
        savedQuote.vendorName,
        savedQuote.supplierContactName,
        savedQuote.supplierContactEmail,
        savedQuote.quotedByName,
        savedQuote.savedByName,
        savedQuote.quote?.notes,
        ...items.flatMap((item) => [
          item.productName,
          item.species,
          item.grade,
          item.profile,
          item.leadTime,
          item.availability,
          item.availableQuantities,
        ]),
      ].some((value) => String(value || "").toLowerCase().includes(search));
    });
  }, [savedQuoteSearch, savedQuotes]);

  useEffect(() => {
    let active = true;

    async function restoreSessionUnlock() {
      if (!currentUser.id || !auth?.currentUser) {
        if (active) setIsCheckingUnlock(false);
        return;
      }

      try {
        const storedExpiration = Number(
          sessionStorage.getItem(chatUnlockStorageKey(currentUser.id)) || 0,
        );
        const tokenResult = await getIdTokenResult(auth.currentUser);
        const authTime = new Date(tokenResult.authTime).getTime();
        const recentAuthentication =
          Number.isFinite(authTime) &&
          Date.now() - authTime < CHAT_UNLOCK_WINDOW_MS;

        if (active) {
          setIsChatUnlocked(
            storedExpiration > Date.now() && recentAuthentication,
          );
        }
      } catch {
        sessionStorage.removeItem(chatUnlockStorageKey(currentUser.id));
      } finally {
        if (active) setIsCheckingUnlock(false);
      }
    }

    restoreSessionUnlock();
    return () => {
      active = false;
    };
  }, [currentUser.id]);

  useEffect(() => {
    if (!isChatUnlocked || !currentUser.id) return undefined;
    const storedExpiration = Number(
      sessionStorage.getItem(chatUnlockStorageKey(currentUser.id)) || 0,
    );
    const remaining = storedExpiration - Date.now();
    if (remaining <= 0) {
      setIsChatUnlocked(false);
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      sessionStorage.removeItem(chatUnlockStorageKey(currentUser.id));
      setIsChatUnlocked(false);
      setConversations([]);
      setMessages([]);
      setSelectedConversationId("");
    }, remaining);
    return () => window.clearTimeout(timeoutId);
  }, [currentUser.id, isChatUnlocked]);

  useEffect(() => {
    if (!currentUser.id || !isChatUnlocked) return undefined;
    if (isSupplier && !String(currentUser.vendorId || "").trim()) {
      setConversations([]);
      setMessages([]);
      setSelectedConversationId("");
      setError("This supplier account is approved but does not have a vendor assignment.");
      setConversationDiagnostic({
        code: "SC-PROFILE-004",
        title: "Vendor assignment is missing",
        message: "User Access did not provide a vendor ID for this supplier account.",
        action: "Ask a Capital Lumber administrator to select the vendor in User Access and save the account.",
        userId: currentUser.id,
        email: currentUser.email || "",
        role: currentUser.role || "",
        status: currentUser.status || "",
        workView: currentUser.workView || "",
        vendorId: "",
        vendorName: currentUser.vendorName || "",
      });
      return undefined;
    }
    return subscribeToSupplierConversations({
      userId: currentUser.id,
      vendorId: currentUser.vendorId,
      isInternal,
      onConversations: (nextConversations) => {
        setError("");
        setConversationDiagnostic(null);
        setDiagnosticCopyStatus("");
        setConversations(nextConversations);
        setSelectedConversationId((currentId) =>
          nextConversations.some((item) => item.id === currentId)
            ? currentId
            : nextConversations[0]?.id || "",
        );
      },
      onError: async (nextError) => {
        if (nextError?.code === "permission-denied") {
          setConversations([]);
          setMessages([]);
          setSelectedConversationId("");
          if (isSupplier) {
            try {
              const diagnostic = await diagnoseSupplierChatAccess();
              setConversationDiagnostic({
                ...diagnostic,
                firestoreCode: nextError.code,
                firestoreMessage: nextError.message || "",
              });
              setError(diagnostic.message || "Supplier Chat access was denied.");
            } catch (diagnosticError) {
              setConversationDiagnostic({
                code: "SC-DIAGNOSTIC-001",
                title: "Conversation access was denied",
                message: "Firestore denied the conversation list, and the secure diagnostic could not finish.",
                action: "Confirm the latest Cloud Functions and Firestore rules are deployed, then sign out and sign back in.",
                userId: currentUser.id,
                email: currentUser.email || "",
                role: currentUser.role || "",
                status: currentUser.status || "",
                vendorId: currentUser.vendorId || "",
                vendorName: currentUser.vendorName || "",
                firestoreCode: nextError.code,
                firestoreMessage: nextError.message || "",
                diagnosticError: diagnosticError?.message || "",
              });
              setError("Supplier Chat access was denied. Open the diagnostic details below.");
            }
          } else {
            setConversationDiagnostic(null);
            setError("Supplier Chat access could not be confirmed. Unlock it again and verify your Supplier Chat permission.");
          }
          return;
        }
        const errorCode = String(nextError?.code || "unknown");
        const isMissingIndex =
          errorCode === "failed-precondition" &&
          String(nextError?.message || "").toLowerCase().includes("index");
        const diagnostic = {
          code: isMissingIndex
            ? "SC-INDEX-001"
            : errorCode === "unavailable"
              ? "SC-NETWORK-001"
              : "SC-LOAD-001",
          title: isMissingIndex
            ? "Supplier Chat index is missing"
            : errorCode === "unavailable"
              ? "Supplier Chat is temporarily offline"
              : "Supplier conversations could not load",
          message: isMissingIndex
            ? "Firestore needs the Supplier Chat conversation index before it can run this search."
            : errorCode === "unavailable"
              ? "The device could not reach Firestore. Check the connection and try again."
              : nextError?.message || "Unable to load supplier conversations.",
          action: isMissingIndex
            ? "Deploy firestore.indexes.json to the production Firebase project."
            : "Refresh the page. If this continues, send the diagnostic code to Capital Lumber.",
          userId: currentUser.id,
          email: currentUser.email || "",
          vendorId: currentUser.vendorId || "",
          vendorName: currentUser.vendorName || "",
          firestoreCode: errorCode,
          firestoreMessage: nextError?.message || "",
        };
        setConversationDiagnostic(diagnostic);
        setError(diagnostic.message);
      },
    });
  }, [
    currentUser.email,
    currentUser.id,
    currentUser.role,
    currentUser.status,
    currentUser.vendorId,
    currentUser.vendorName,
    currentUser.workView,
    isInternal,
    isChatUnlocked,
    isSupplier,
    conversationRefreshKey,
  ]);

  useEffect(() => {
    if (!isInternal || !isChatUnlocked) return undefined;
    return subscribeToSupplierInvitations(
      setInvitations,
      (nextError) => setError(nextError.message || "Unable to load supplier invitations."),
    );
  }, [isInternal, isChatUnlocked]);

  useEffect(() => {
    if (!isChatUnlocked || !selectedConversationId) {
      setMessages([]);
      return undefined;
    }
    return subscribeToSupplierMessages(
      selectedConversationId,
      setMessages,
      (nextError) => setError(nextError.message || "Unable to load messages."),
    );
  }, [isChatUnlocked, selectedConversationId]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList || !selectedConversationId) return undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      const isSameConversation =
        lastScrolledConversationIdRef.current === selectedConversationId;
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: isSameConversation ? "smooth" : "auto",
      });
      lastScrolledConversationIdRef.current = selectedConversationId;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [messages.length, selectedConversationId]);

  useEffect(() => {
    const vendorId = selectedConversation?.vendorId;
    if (!isInternal || !isChatUnlocked || !vendorId) {
      setSavedQuotes([]);
      return undefined;
    }
    return subscribeToSupplierQuotes({
      vendorId,
      onQuotes: setSavedQuotes,
      onError: (nextError) =>
        setError(
          nextError?.code === "permission-denied"
            ? "Firebase denied the vendor quote archive. Deploy the updated Supplier Chat rules and unlock the chat again."
            : nextError?.message || "Unable to load saved vendor quotes.",
        ),
    });
  }, [isChatUnlocked, isInternal, selectedConversation?.vendorId]);

  async function handleUnlockChat() {
    if (!auth?.currentUser || !currentUser.id) {
      setUnlockError("Your signed-in account could not be verified. Sign out and sign in again.");
      return;
    }

    setIsUnlocking(true);
    setUnlockError("");
    try {
      const signedInUser = auth.currentUser;
      const expectedUserId = signedInUser.uid;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
        login_hint: signedInUser.email || "",
      });
      const credential = await reauthenticateWithPopup(signedInUser, provider);
      if (
        credential.user.uid !== expectedUserId ||
        credential.user.uid !== currentUser.id
      ) {
        throw new Error("The verified Google account does not match the signed-in user.");
      }
      const tokenResult = await getIdTokenResult(credential.user, true);
      const authenticationTime = new Date(tokenResult.authTime).getTime();
      if (
        !Number.isFinite(authenticationTime) ||
        Date.now() - authenticationTime >= CHAT_UNLOCK_WINDOW_MS
      ) {
        throw new Error(
          "Google did not return a fresh sign-in. Sign out, sign back in, and try again.",
        );
      }
      const expiration = Date.now() + CHAT_UNLOCK_WINDOW_MS;
      sessionStorage.setItem(
        chatUnlockStorageKey(currentUser.id),
        String(expiration),
      );
      setIsChatUnlocked(true);
    } catch (unlockFailure) {
      const code = String(unlockFailure?.code || "");
      const message = String(unlockFailure?.message || "");
      setUnlockError(
        code === "auth/popup-closed-by-user" ||
          message.includes("popup-closed-by-user")
          ? "Verification was canceled. Supplier Chat remains locked."
          : message || "Unable to verify this account. Supplier Chat remains locked.",
      );
    } finally {
      setIsUnlocking(false);
      setIsCheckingUnlock(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!selectedConversation || !messageText.trim()) return;
    setIsSending(true);
    setError("");
    try {
      await sendSupplierMessage({
        conversationId: selectedConversation.id,
        vendorId: selectedConversation.vendorId,
        sender: currentUser,
        text: messageText,
      });
      setMessageText("");
    } catch (sendError) {
      setError(sendError.message || "Unable to send that message.");
    } finally {
      setIsSending(false);
    }
  }

  function updateQuoteItem(index, changes) {
    setQuote((currentQuote) => ({
      ...currentQuote,
      items: currentQuote.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));
  }

  function addQuoteItem() {
    setQuote((currentQuote) => ({
      ...currentQuote,
      items: [...currentQuote.items, createEmptyQuoteItem()],
    }));
  }

  function removeQuoteItem(index) {
    setQuote((currentQuote) => ({
      ...currentQuote,
      items: currentQuote.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function openPriceRequest() {
    setQuote(createEmptyQuote("request"));
    setShowQuote(true);
  }

  function openSupplierQuote() {
    setQuote(createEmptyQuote("quote"));
    setShowQuote(true);
  }

  function openQuoteReply(message, revision = false) {
    const sourceItems = normalizedQuoteItems(message.quote);
    setQuote({
      kind: "quote",
      items: sourceItems.map((item) => ({
        ...createEmptyQuoteItem(),
        productName: item.productName || "",
        quantity: item.quantity || "",
        priceUnit: item.priceUnit || "piece",
        quotedPrice: revision ? item.quotedPrice || "" : "",
        availability: revision ? item.availability || "Available" : "Available",
        leadTime: revision ? item.leadTime || "" : "",
        profile: item.profile || "",
        availableQuantities: item.availableQuantities || "",
        species: item.species || "",
        grade: item.grade || "",
        thickness: item.thickness || "",
        width: item.width || "",
        length: item.length || "",
      })),
      status: "quoted",
      validUntil: revision ? message.quote?.validUntil || "" : "",
      notes: revision ? message.quote?.notes || "" : "",
      revisionOf: revision ? message.id : "",
      requestMessageId: revision ? "" : message.id,
    });
    setShowQuote(true);
  }

  async function handleSendQuote(event) {
    event.preventDefault();
    const validItems = quote.items.filter((item) => item.productName.trim());
    if (!selectedConversation || validItems.length === 0) return;
    setIsSending(true);
    setError("");
    try {
      const items = validItems.map((item) => {
        const calculation = calculateLumberQuote(item);
        return {
          ...item,
          ...(quote.kind === "request" ? {} : calculation),
          quotedPrice: Number(item.quotedPrice) || 0,
          quantity: Number(item.quantity) || 0,
          thickness: Number(item.thickness) || 0,
          width: Number(item.width) || 0,
          length: Number(item.length) || 0,
        };
      });
      await sendSupplierMessage({
        conversationId: selectedConversation.id,
        vendorId: selectedConversation.vendorId,
        sender: currentUser,
        text: quote.kind === "request"
          ? `Pricing requested for ${items[0].productName}`
          : `Pricing for ${items[0].productName}`,
        quote: {
          ...quote,
          items,
        },
      });
      setQuote(createEmptyQuote());
      setShowQuote(false);
    } catch (sendError) {
      setError(sendError.message || "Unable to save that pricing record.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleQuoteStatusChange(message, status) {
    if (!selectedConversation || !message?.id) return;
    setError("");
    setSavingQuoteMessageId(message.id);
    try {
      await updateSupplierQuoteStatus({
        conversationId: selectedConversation.id,
        messageId: message.id,
        status,
      });
      if (status === "accepted") {
        await saveSupplierQuote({
          conversation: selectedConversation,
          message: {
            ...message,
            quote: { ...message.quote, status: "accepted" },
          },
          savedBy: currentUser,
        });
      }
      if (status === "clarification") {
        setMessageText(`Question about ${normalizedQuoteItems(message.quote)[0]?.productName || "this quote"}: `);
      }
    } catch (statusError) {
      setError(statusError.message || "Unable to update that pricing status.");
    } finally {
      setSavingQuoteMessageId("");
    }
  }

  async function handleSaveQuote(message) {
    if (!selectedConversation || !message?.id || !message?.quote) return;
    setError("");
    setSavingQuoteMessageId(message.id);
    try {
      await saveSupplierQuote({
        conversation: selectedConversation,
        message,
        savedBy: currentUser,
      });
    } catch (saveError) {
      setError(
        saveError?.code === "permission-denied"
          ? "Firebase denied the vendor quote archive. Deploy the updated Supplier Chat rules and unlock the chat again."
          : saveError?.message || "Unable to save that quote to the vendor archive.",
      );
    } finally {
      setSavingQuoteMessageId("");
    }
  }

  async function handleStartSupplierConversation() {
    if (!isSupplier || isStartingConversation) return;

    setIsStartingConversation(true);
    setError("");
    setConversationDiagnostic(null);
    try {
      const result = await startSupplierConversation();
      if (result?.conversationId) {
        setSelectedConversationId(result.conversationId);
      }
      setConversationRefreshKey((currentKey) => currentKey + 1);
    } catch (startError) {
      const message =
        startError?.message || "Unable to start the supplier conversation.";
      setError(message);
      setConversationDiagnostic({
        code: "SC-START-001",
        title: "Conversation could not be started",
        message,
        action: "Unlock Supplier Chat again. If this continues, ask Capital Lumber to verify the supplier account.",
        userId: currentUser.id,
        email: currentUser.email || "",
        role: currentUser.role || "",
        status: currentUser.status || "",
        vendorId: currentUser.vendorId || "",
        vendorName: currentUser.vendorName || "",
      });
    } finally {
      setIsStartingConversation(false);
    }
  }

  async function handleInvite(event) {
    event.preventDefault();
    const vendor = vendorList.find((item) => String(item.id || item.name) === invite.vendorId);
    if (!vendor || !invite.email.trim()) {
      setInviteError("Choose a vendor and enter the supplier's email address.");
      return;
    }
    setInviteError("");
    setInviteSuccess("");
    setIsCreatingInvitation(true);
    try {
      await createSupplierInvitation({
        ...invite,
        vendorId: String(vendor.id || vendor.name),
        vendorName: vendor.name,
        createdBy: currentUser.id,
      });
      setInvite({ email: "", contactName: "", vendorId: "" });
      setInviteSuccess("Invitation created. Resend is sending the supplier email now.");
    } catch (inviteError) {
      const message = inviteError?.code === "permission-denied"
        ? "Firebase denied the invitation. Verify the Supplier Chat rules are deployed and unlock the chat again."
        : inviteError.message || "Unable to create supplier invitation.";
      setInviteError(message);
      setError(message);
    } finally {
      setIsCreatingInvitation(false);
    }
  }

  async function handleCancelInvitation(invitation) {
    if (!invitation?.id || invitation.status !== "pending") return;

    const shouldCancel = window.confirm(
      `Cancel the invitation for ${invitation.contactName || invitation.email}? An email already sent cannot be recalled, but this invitation will be marked canceled.`,
    );
    if (!shouldCancel) return;

    setInviteError("");
    setInviteSuccess("");
    setCancelingInvitationId(invitation.id);
    try {
      await cancelSupplierInvitation(invitation.id, currentUser.id);
      setInviteSuccess("Invitation canceled. Any email already sent cannot be recalled.");
    } catch (cancelError) {
      const message = cancelError?.code === "permission-denied"
        ? "Firebase denied the cancellation. Verify the updated Supplier Chat rules are deployed and unlock the chat again."
        : cancelError?.message || "Unable to cancel that supplier invitation.";
      setInviteError(message);
    } finally {
      setCancelingInvitationId("");
    }
  }

  async function handleCopyLoginLink() {
    const loginUrl = `${window.location.origin}/`;
    setCopyStatus("");
    try {
      await copyToClipboard(loginUrl);
      setCopyStatus("Login link copied");
    } catch (copyError) {
      setCopyStatus(copyError.message || "Unable to copy the login link.");
    }
  }

  async function handleCreateConversation(event) {
    event.preventDefault();
    const supplierUser = supplierUsers.find((user) => user.id === conversationDraft.supplierUserId);
    const vendor = vendorList.find((item) => String(item.id || item.name) === conversationDraft.vendorId);
    if (!supplierUser || !vendor) return;
    if (String(supplierUser.vendorId || "") !== String(vendor.id || vendor.name)) {
      setError("That supplier contact is not approved for the selected vendor.");
      return;
    }
    try {
      const created = await createSupplierConversation({
        vendorId: String(vendor.id || vendor.name),
        vendorName: vendor.name,
        supplierUser,
        internalUser: currentUser,
      });
      setSelectedConversationId(created.id);
      setConversationDraft({ supplierUserId: "", vendorId: "" });
      setShowConversation(false);
    } catch (conversationError) {
      setError(conversationError.message || "Unable to create conversation.");
    }
  }

  async function handleUpdateAssignment(event) {
    event.preventDefault();
    if (!selectedConversation) return;
    const supplierUser = supplierUsers.find(
      (user) => user.id === assignmentSupplierUserId,
    );
    if (!supplierUser?.vendorId || !supplierUser?.vendorName) {
      setError(
        "Choose an approved supplier contact with a vendor company in User Access.",
      );
      return;
    }

    setError("");
    setIsUpdatingAssignment(true);
    try {
      await updateSupplierConversationAssignment({
        conversationId: selectedConversation.id,
        supplierUser,
        internalParticipantUids:
          selectedConversation.internalParticipantUids?.length
            ? selectedConversation.internalParticipantUids
            : [currentUser.id],
      });
      setShowAssignment(false);
    } catch (assignmentError) {
      setError(
        assignmentError?.message || "Unable to update supplier access.",
      );
    } finally {
      setIsUpdatingAssignment(false);
    }
  }

  async function handleDeleteConversation() {
    if (!isInternal || !selectedConversation || isDeletingConversation) return;

    const shouldDelete = window.confirm(
      `Delete the ${selectedConversation.vendorName || "supplier"} conversation and all of its messages? This cannot be undone.`,
    );
    if (!shouldDelete) return;

    setError("");
    setIsDeletingConversation(true);
    try {
      await deleteSupplierConversation(selectedConversation.id);
      setMessages([]);
      setSelectedConversationId("");
    } catch (deleteError) {
      setError(
        deleteError?.code === "permission-denied"
          ? "Firebase denied the deletion. Deploy the updated Supplier Chat rules and unlock the chat again."
          : deleteError?.message || "Unable to delete that conversation.",
      );
    } finally {
      setIsDeletingConversation(false);
    }
  }

  if (isCheckingUnlock) {
    return (
      <PageContainer>
        <div className="mx-auto flex min-h-[520px] max-w-xl items-center justify-center">
          <div className="text-center">
            <LockKeyhole className="mx-auto h-9 w-9 animate-pulse text-slate-400" />
            <p className="mt-4 font-black text-slate-800">Checking Supplier Chat security…</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!isChatUnlocked) {
    return (
      <PageContainer>
        <div className="mx-auto flex min-h-[620px] max-w-2xl items-center justify-center py-10">
          <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-200/60 sm:p-10">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-lg">
              <LockKeyhole className="h-9 w-9" />
            </span>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
              Protected pricing conversations
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Unlock Supplier Chat
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base font-semibold leading-7 text-slate-500">
              Verify the Google account signed in as <strong className="text-slate-800">{currentUser.email}</strong>. No supplier names, messages, or pricing records load until verification succeeds.
            </p>
            {unlockError ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {unlockError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleUnlockChat}
              disabled={isUnlocking}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-sm disabled:opacity-50 sm:w-auto sm:min-w-72"
            >
              <ShieldCheck className="h-5 w-5" />
              {isUnlocking ? "Verifying account…" : "Verify account & unlock"}
            </button>
            <p className="mt-4 text-xs font-semibold text-slate-400">
              The chat locks again after 30 minutes or when this browser session closes.
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {isSupplier ? (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Secure supplier chat
            </p>
            <p className="truncate text-lg font-black text-slate-950">
              {currentUser.vendorName || "Supplier Pricing"}
            </p>
          </div>
        </div>
      ) : null}

      <div className={`mb-6 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${isSupplier ? "hidden sm:flex" : "flex"}`}>
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            <LockKeyhole className="h-4 w-4" /> Secure supplier portal
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Supplier Pricing</h1>
          <p className="mt-2 text-lg font-semibold text-slate-500">
            Chat about pricing and availability while keeping every quote in a searchable record.
          </p>
        </div>
        {isInternal ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm">
              <MailPlus className="h-4 w-4" /> Invite supplier
            </button>
            <button type="button" onClick={() => setShowConversation(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white shadow-sm">
              <Plus className="h-4 w-4" /> New conversation
            </button>
          </div>
        ) : null}
      </div>

      <div className={`mb-4 grid-cols-3 gap-2 sm:gap-3 ${isSupplier ? "hidden sm:grid" : "grid"}`}>
        <div className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700 sm:h-5 sm:w-5" />
            <p className="min-w-0 text-[11px] font-black leading-tight text-emerald-950 sm:text-sm">
              Vendor isolated
            </p>
          </div>
          <p className="mt-1 hidden text-xs font-semibold text-emerald-800 md:block">Suppliers only see conversations they are explicitly assigned.</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-blue-200 bg-blue-50 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 shrink-0 text-blue-700 sm:h-5 sm:w-5" />
            <p className="min-w-0 text-[11px] font-black leading-tight text-blue-950 sm:text-sm">
              MBF conversion
            </p>
          </div>
          <p className="mt-1 hidden text-xs font-semibold text-blue-800 md:block">Convert piece, LF, and per-thousand quotes consistently.</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-4 w-4 shrink-0 text-amber-700 sm:h-5 sm:w-5" />
            <p className="min-w-0 text-[11px] font-black leading-tight text-amber-950 sm:text-sm">
              Pricing history
            </p>
          </div>
          <p className="mt-1 hidden text-xs font-semibold text-amber-800 md:block">Structured quotes stay beside the supplier discussion.</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black">
                {conversationDiagnostic?.title || "Supplier Chat error"}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6">{error}</p>
              {conversationDiagnostic?.action ? (
                <p className="mt-2 text-xs font-bold leading-5 text-red-700">
                  Next step: {conversationDiagnostic.action}
                </p>
              ) : null}
            </div>
            {conversationDiagnostic ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await copyToClipboard(
                      formatSupplierChatDiagnostic(conversationDiagnostic),
                    );
                    setDiagnosticCopyStatus("Copied");
                  } catch {
                    setDiagnosticCopyStatus("Copy failed");
                  }
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700"
              >
                <Copy className="h-3.5 w-3.5" />
                {diagnosticCopyStatus || "Copy diagnostic"}
              </button>
            ) : null}
          </div>
          {conversationDiagnostic ? (
            <details className="mt-3 rounded-lg border border-red-200 bg-white/70 px-3 py-2">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-red-700">
                Diagnostic {conversationDiagnostic.code}
              </summary>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-black uppercase text-red-500">Account</dt>
                  <dd className="mt-0.5 break-all font-semibold text-slate-700">
                    {conversationDiagnostic.email || "Email unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="font-black uppercase text-red-500">Vendor</dt>
                  <dd className="mt-0.5 break-all font-semibold text-slate-700">
                    {conversationDiagnostic.vendorName || "Not assigned"}
                    {conversationDiagnostic.vendorId
                      ? ` · ${conversationDiagnostic.vendorId}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-black uppercase text-red-500">Profile</dt>
                  <dd className="mt-0.5 font-semibold text-slate-700">
                    {conversationDiagnostic.role || "No role"} · {conversationDiagnostic.status || "No status"}
                  </dd>
                </div>
                <div>
                  <dt className="font-black uppercase text-red-500">Firestore</dt>
                  <dd className="mt-0.5 break-words font-semibold text-slate-700">
                    {conversationDiagnostic.firestoreCode || "Not reached"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-black uppercase text-red-500">User ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-600">
                    {conversationDiagnostic.userId || "Unavailable"}
                  </dd>
                </div>
              </dl>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-[650px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-10rem)] lg:max-h-[900px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className={`border-b border-slate-200 bg-slate-50 p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r ${isSupplier ? "hidden lg:block" : "block"}`}>
          <p className="px-2 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Conversations</p>
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)} className={`w-full rounded-2xl border p-4 text-left transition ${conversation.id === selectedConversationId ? "border-blue-300 bg-white shadow-sm" : "border-transparent hover:bg-white"}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><Building2 className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-black text-slate-950">{conversation.vendorName}</span>
                    <span className="block truncate text-xs font-semibold text-slate-500">{conversation.supplierContactName}</span>
                  </span>
                </div>
                <p className="mt-3 truncate text-xs font-semibold text-slate-400">{conversation.lastMessage || "Conversation ready"}</p>
              </button>
            ))}
            {!conversations.length ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500">
                {error
                  ? "Conversation list unavailable until the issue above is fixed."
                  : isSupplier
                    ? "No conversation started yet."
                    : `No conversation is assigned${currentUser.vendorName ? ` for ${currentUser.vendorName}` : ""} yet.`}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="flex h-[70dvh] min-h-[560px] min-w-0 flex-col lg:h-full lg:min-h-0">
          {selectedConversation ? (
            <>
              <header className="flex shrink-0 flex-nowrap items-center gap-4 overflow-x-auto border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
                  <h2 className="max-w-[45%] truncate text-base font-black text-slate-950 sm:max-w-[38%] sm:text-xl">
                    {selectedConversation.vendorName}
                  </h2>
                  <span className="shrink-0 text-slate-300" aria-hidden="true">·</span>
                  <p className="min-w-0 truncate text-xs font-semibold text-slate-500 sm:text-sm">
                    {selectedConversation.supplierContactName}<span className="hidden sm:inline"> · Secure pricing conversation</span>
                  </p>
                </div>
                {isInternal ? (
                  <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSavedQuotes(true)}
                      className="inline-flex whitespace-nowrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 hover:bg-blue-100"
                    >
                      <PackageSearch className="h-4 w-4" />
                      Saved quotes
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-blue-700">
                        {savedQuotes.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentSupplierUserId(
                          selectedConversation.supplierParticipantUids?.[0] || "",
                        );
                        setShowAssignment(true);
                      }}
                      className="inline-flex whitespace-nowrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      <ShieldCheck className="h-4 w-4" /> Edit supplier access
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteConversation}
                      disabled={isDeletingConversation}
                      className="inline-flex whitespace-nowrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeletingConversation ? "Deleting…" : "Delete conversation"}
                    </button>
                  </div>
                ) : null}
              </header>
              <div ref={messageListRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-white p-4 sm:p-6">
                {messages.map((message) => {
                  const isMine = message.senderUid === currentUser.id;
                  const isVendorMessage = selectedConversation.supplierParticipantUids?.includes(
                    message.senderUid,
                  );
                  const senderCompany = isVendorMessage
                    ? selectedConversation.vendorName || "Supplier"
                    : "Capital Lumber";
                  const senderTitle = [message.senderName, senderCompany]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`${message.type === "quote" ? "max-w-[96%] sm:max-w-[78%]" : "max-w-[88%] sm:max-w-[72%]"} ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                        <div className={`mb-1 flex flex-wrap items-center gap-1.5 px-1 text-[11px] font-semibold text-[#8E8E93] ${isMine ? "justify-end text-right" : "justify-start"}`}>
                          {senderTitle ? <span className="font-bold text-[#6E6E73]">{senderTitle}</span> : null}
                          {senderTitle ? <span aria-hidden="true">·</span> : null}
                          <span>{formatDate(message.createdAt)}</span>
                        </div>
                        <div
                          className={`px-4 py-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.08)] ${
                            isMine
                              ? "rounded-[20px] rounded-br-[6px] bg-[#0A84FF] text-white"
                              : "rounded-[20px] rounded-bl-[6px] bg-[#E9E9EB] text-[#111111]"
                          }`}
                        >
                          {message.type !== "quote" && message.text ? <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">{message.text}</p> : null}
                          {message.type === "quote" && message.quote ? (
                            <QuoteCard
                              quote={message.quote}
                              canManageStatus={isInternal}
                              canReply={isSupplier && message.quote.kind === "request"}
                              canRevise={isSupplier && isVendorMessage && message.quote.kind !== "request"}
                              canSave={isInternal && message.quote.kind !== "request"}
                              isSaved={savedQuoteMessageIds.has(message.id)}
                              isSaving={savingQuoteMessageId === message.id}
                              onReply={() => openQuoteReply(message)}
                              onRevise={() => openQuoteReply(message, true)}
                              onSave={() => handleSaveQuote(message)}
                              onStatusChange={(status) => handleQuoteStatusChange(message, status)}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!messages.length ? <div className="mx-auto max-w-md py-20 text-center"><MessageSquareText className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black text-slate-700">Start the supplier conversation</p><p className="mt-1 text-sm text-slate-500">Messages and structured prices will be recorded here.</p></div> : null}
              </div>
              <footer className="shrink-0 border-t border-[#D1D1D6] bg-white p-4">
                <form onSubmit={handleSend} className="flex flex-col gap-2 sm:flex-row">
                  <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} rows={2} placeholder="Ask about pricing, stock, lead time, or availability..." className="min-h-12 flex-1 resize-none rounded-[18px] border border-[#C7C7CC] bg-white px-4 py-3 text-[15px] outline-none focus:border-[#007AFF] focus:ring-4 focus:ring-blue-100" />
                  <button
                    type="button"
                    onClick={isSupplier ? openSupplierQuote : openPriceRequest}
                    className={`inline-flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-black ${isSupplier ? "border border-emerald-300 bg-emerald-50 text-emerald-800" : "border border-violet-300 bg-violet-50 text-violet-800"}`}
                  >
                    <DollarSign className="h-4 w-4" />
                    {isSupplier ? "Add pricing" : "Request quote"}
                  </button>
                  <button type="submit" disabled={isSending || !messageText.trim()} className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[#007AFF] px-5 py-3 text-sm font-black text-white transition hover:bg-[#006EE6] disabled:bg-[#C7C7CC]"><Send className="h-4 w-4" /> Send</button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#007AFF]">
                  <MessageSquareText className="h-7 w-7" />
                </span>
                <p className="mt-4 text-xl font-black text-slate-900">
                  {isSupplier ? "Start the conversation" : "Select or create a conversation"}
                </p>
                {isSupplier ? (
                  <>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                      Send Capital Lumber your first pricing, availability, or product question for {currentUser.vendorName || "your company"}.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartSupplierConversation}
                      disabled={isStartingConversation}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-[18px] bg-[#007AFF] px-5 py-3 text-sm font-black text-white transition hover:bg-[#006EE6] disabled:bg-[#C7C7CC]"
                    >
                      <MessageSquareText className="h-4 w-4" />
                      {isStartingConversation ? "Starting…" : "Start conversation"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>

      {showSavedQuotes && selectedConversation ? (
        <Dialog
          title={`${selectedConversation.vendorName} saved quotes`}
          onClose={() => {
            setSavedQuoteSearch("");
            setShowSavedQuotes(false);
          }}
          wide
        >
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Permanent pricing records for this vendor stay here even when the chat moves on.
          </p>
          <div className="relative mt-5">
            <PackageSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={savedQuoteSearch}
              onChange={(event) => setSavedQuoteSearch(event.target.value)}
              placeholder="Search item, species, grade, lead time, or supplier contact..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <div className="mt-4 max-h-[62vh] space-y-4 overflow-y-auto pr-1">
            {filteredSavedQuotes.map((savedQuote) => (
              <article
                key={savedQuote.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 px-1">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {savedQuote.quotedByName || savedQuote.supplierContactName || "Supplier contact"}
                      <span className="font-semibold text-slate-400"> · {savedQuote.vendorName}</span>
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      Quoted {formatDate(savedQuote.quotedAt) || "date unavailable"}
                    </p>
                  </div>
                  <div className="text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <p>Saved {formatDate(savedQuote.savedAt) || "recently"}</p>
                    {savedQuote.savedByName ? <p>by {savedQuote.savedByName}</p> : null}
                  </div>
                </div>
                <QuoteCard quote={savedQuote.quote} />
              </article>
            ))}
            {!filteredSavedQuotes.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                <PackageSearch className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-black text-slate-700">
                  {savedQuotes.length ? "No saved quotes match that search." : "No quotes saved for this vendor yet."}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Use Save quote or Accept &amp; save on a supplier price.
                </p>
              </div>
            ) : null}
          </div>
        </Dialog>
      ) : null}

      {showInvite ? (
        <Dialog title="Invite a supplier" onClose={() => { setInviteError(""); setInviteSuccess(""); setCopyStatus(""); setShowInvite(false); }}>
          <form onSubmit={handleInvite} className="mt-5 space-y-4">
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">Create the invitation and Resend will email the supplier this secure login link. You still approve their matching Google sign-in under User Access before they can see any supplier chat.</p>
            {inviteError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{inviteError}</div> : null}
            {inviteSuccess ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{inviteSuccess}</div> : null}
            <input required value={invite.contactName} onChange={(event) => setInvite({ ...invite, contactName: event.target.value })} placeholder="Contact name (Stephen)" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            <input required type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} placeholder="Supplier email" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            <select required value={invite.vendorId} onChange={(event) => setInvite({ ...invite, vendorId: event.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option value="">Choose vendor</option>{vendorList.map((vendor) => <option key={vendor.id || vendor.name} value={vendor.id || vendor.name}>{vendor.name}</option>)}</select>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="break-all text-xs font-semibold text-slate-600">{`${window.location.origin}/`}</p>
              {copyStatus ? <p className={`mt-2 text-xs font-black ${copyStatus === "Login link copied" ? "text-emerald-700" : "text-red-700"}`}>{copyStatus}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={handleCopyLoginLink} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-black"><Copy className="h-4 w-4" /> {copyStatus === "Login link copied" ? "Copied" : "Copy login link"}</button><button type="submit" disabled={isCreatingInvitation} className="rounded-xl bg-[#FC2C38] px-5 py-3 font-black text-white disabled:opacity-50">{isCreatingInvitation ? "Creating…" : "Create invitation"}</button></div>
          </form>
          {invitations.length ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              {activeInvitations.length ? (
                <>
                  <p className="text-xs font-black uppercase text-slate-400">Active invitations</p>
                  {activeInvitations.slice(0, 6).map((item) => {
                    const emailLabel = item.emailStatus === "sent"
                      ? "Email sent"
                      : item.emailStatus === "failed"
                        ? "Email failed"
                        : item.emailStatus === "sending"
                          ? "Email sending"
                          : "Email queued";
                    return (
                      <div key={item.id} className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate"><strong>{item.contactName}</strong> · {item.vendorName}</p>
                          <p className="truncate text-xs font-semibold text-slate-500">{item.email}</p>
                          {item.emailStatus === "failed" && item.emailError ? (
                            <p className="mt-1 text-xs font-bold text-red-700">{item.emailError}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.emailStatus === "sent" ? "bg-emerald-100 text-emerald-700" : item.emailStatus === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {emailLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCancelInvitation(item)}
                            disabled={cancelingInvitationId === item.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            {cancelingInvitationId === item.id ? "Canceling…" : "Cancel"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <p className="text-sm font-semibold text-slate-500">No active invitations.</p>
              )}

              {canceledInvitations.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowInvite(false);
                    setShowInvitationLog(true);
                  }}
                  className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span>View invitation log</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                    {canceledInvitations.length} canceled
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </Dialog>
      ) : null}

      {showInvitationLog ? (
        <Dialog title="Invitation log" onClose={() => setShowInvitationLog(false)}>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Canceled supplier invitations are kept here for reference.
          </p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_1fr_1.2fr_150px] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-slate-400 sm:grid">
              <span>Contact</span>
              <span>Vendor</span>
              <span>Email</span>
              <span>Canceled</span>
            </div>
            <div className="max-h-[52vh] divide-y divide-slate-200 overflow-y-auto">
              {canceledInvitations.map((item) => {
                const canceledOn = formatDate(item.canceledAt || item.updatedAt);
                return (
                  <div key={item.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_1.2fr_150px] sm:items-center sm:gap-3">
                    <p className="truncate font-black text-slate-800">{item.contactName || "Supplier contact"}</p>
                    <p className="truncate font-semibold text-slate-600">{[item.vendorName, item.branch].filter(Boolean).join(" · ") || "Vendor not listed"}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{item.email}</p>
                    <p className="text-xs font-bold text-slate-400">{canceledOn || "Date unavailable"}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowInvitationLog(false);
              setShowInvite(true);
            }}
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-700 hover:bg-slate-50"
          >
            Back to invitations
          </button>
        </Dialog>
      ) : null}

      {showConversation ? (
        <Dialog title="Start a supplier conversation" onClose={() => setShowConversation(false)}>
          <form onSubmit={handleCreateConversation} className="mt-5 space-y-4">
            <select required value={conversationDraft.supplierUserId} onChange={(event) => { const supplierUser = supplierUsers.find((user) => user.id === event.target.value); setConversationDraft({ supplierUserId: event.target.value, vendorId: String(supplierUser?.vendorId || "") }); }} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option value="">Choose an approved supplier contact</option>{supplierUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email} · {user.vendorName || "Vendor not bound"}</option>)}</select>
            <select required value={conversationDraft.vendorId} onChange={(event) => setConversationDraft({ ...conversationDraft, vendorId: event.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option value="">Choose vendor</option>{vendorList.map((vendor) => <option key={vendor.id || vendor.name} value={vendor.id || vendor.name}>{vendor.name}</option>)}</select>
            <button type="submit" className="w-full rounded-xl bg-slate-950 px-5 py-3 font-black text-white">Start secure conversation</button>
          </form>
          {!supplierUsers.length ? <button type="button" onClick={() => onPageChange?.("user-admin")} className="mt-4 text-sm font-black text-blue-700">No approved suppliers yet — open User Access</button> : null}
        </Dialog>
      ) : null}

      {showAssignment && selectedConversation ? (
        <Dialog
          title="Edit supplier access"
          onClose={() => setShowAssignment(false)}
        >
          <form onSubmit={handleUpdateAssignment} className="mt-5 space-y-4">
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
              Saving rewrites the conversation contact and vendor ID together. The
              supplier will only see this conversation after both match their
              approved User Access profile.
            </p>
            <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
              Approved supplier contact
              <select
                required
                value={assignmentSupplierUserId}
                onChange={(event) =>
                  setAssignmentSupplierUserId(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-slate-900"
              >
                <option value="">Choose supplier contact</option>
                {supplierUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName || user.email} · {user.vendorName || "Vendor not assigned"}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAssignment(false)}
                className="rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingAssignment || !assignmentSupplierUserId}
                className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-50"
              >
                {isUpdatingAssignment ? "Saving…" : "Save supplier access"}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {showQuote ? (
        <Dialog
          title={quote.kind === "request" ? "Request a supplier quote" : quote.revisionOf ? "Revise supplier quote" : "Add supplier pricing"}
          onClose={() => setShowQuote(false)}
        >
          <form onSubmit={handleSendQuote} className="mt-4 space-y-4">
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
              {quote.kind === "request"
                ? "List what you need priced. The supplier can reply with profile, available quantities by length, price basis, stock, and lead time."
                : "Enter each profile as its own option, including available quantities by length. Capital Lumber will calculate extended and MBF pricing when dimensions are available."}
            </p>

            <div className="space-y-3">
              {quote.items.map((item, index) => {
                const needsAllDimensions = item.priceUnit === "BF" || item.priceUnit === "MBF";
                const needsLength = item.priceUnit === "LF";
                const calculation = quoteCalculations[index] || calculateLumberQuote(item);
                return (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Item {index + 1}</p>
                      {quote.items.length > 1 ? (
                        <button type="button" onClick={() => removeQuoteItem(index)} className="text-xs font-black text-red-600">Remove</button>
                      ) : null}
                    </div>

                    <input
                      required
                      value={item.productName}
                      onChange={(event) => updateQuoteItem(index, { productName: event.target.value })}
                      placeholder="Item or product description"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold sm:text-lg"
                    />

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <label className="text-xs font-black uppercase text-slate-500 sm:text-sm">
                        Quantity
                        <input type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateQuoteItem(index, { quantity: event.target.value })} placeholder="Qty" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold normal-case text-slate-900" />
                      </label>
                      <label className="flex min-w-0 items-center justify-between gap-3 text-xs font-black uppercase text-slate-500 sm:text-sm">
                        <span className="leading-tight">
                          {quote.kind === "request" ? "Price request per" : "Price basis"}
                        </span>
                        <select
                          value={item.priceUnit}
                          onChange={(event) => updateQuoteItem(index, { priceUnit: event.target.value })}
                          aria-label={quote.kind === "request" ? "Requested pricing unit" : "Price basis unit"}
                          className="min-w-[7.5rem] rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black normal-case text-slate-900"
                        >
                          {PRICE_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                    </div>

                    {quote.kind === "request" ? (
                      <>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-black uppercase text-slate-500 sm:text-sm">
                            Profile / finish wanted
                            <input
                              value={item.profile}
                              onChange={(event) => updateQuoteItem(index, { profile: event.target.value })}
                              placeholder="Resawn, S4S, S4S EE"
                              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold normal-case text-slate-900"
                            />
                          </label>
                          <label className="text-xs font-black uppercase text-slate-500 sm:text-sm">
                            Lengths / quantities needed
                            <input
                              value={item.availableQuantities}
                              onChange={(event) => updateQuoteItem(index, { availableQuantities: event.target.value })}
                              placeholder="35 @ 16', 40 @ 18'"
                              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold normal-case text-slate-900"
                            />
                          </label>
                        </div>

                        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <summary className="cursor-pointer text-sm font-black text-slate-600">Add species, grade, or size</summary>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input value={item.species} onChange={(event) => updateQuoteItem(index, { species: event.target.value })} placeholder="Species" className="rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
                            <input value={item.grade} onChange={(event) => updateQuoteItem(index, { grade: event.target.value })} placeholder="Grade" className="rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <input type="number" min="0" step="any" value={item.thickness} onChange={(event) => updateQuoteItem(index, { thickness: event.target.value })} placeholder="Thickness" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
                            <input type="number" min="0" step="any" value={item.width} onChange={(event) => updateQuoteItem(index, { width: event.target.value })} placeholder="Width" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
                            <input type="number" min="0" step="any" value={item.length} onChange={(event) => updateQuoteItem(index, { length: event.target.value })} placeholder="Length (ft)" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
                          </div>
                        </details>
                      </>
                    ) : null}

                    {quote.kind !== "request" ? (
                      <>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <label className="text-xs font-black uppercase text-slate-500 sm:text-sm">
                            Price
                            <input required type="number" min="0" step="any" value={item.quotedPrice} onChange={(event) => updateQuoteItem(index, { quotedPrice: event.target.value })} placeholder="$0.00" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold normal-case text-slate-900" />
                          </label>
                          <label className="text-xs font-black uppercase text-slate-500 sm:text-sm">
                            Availability
                            <select value={item.availability} onChange={(event) => updateQuoteItem(index, { availability: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold normal-case text-slate-900">
                              {['Available', 'In stock', 'Limited', 'Special order', 'Backordered', 'Not available'].map((value) => <option key={value}>{value}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-black uppercase text-slate-500 sm:text-sm">
                            Lead time
                            <input value={item.leadTime} onChange={(event) => updateQuoteItem(index, { leadTime: event.target.value })} placeholder="In stock or 3 days" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold normal-case text-slate-900" />
                          </label>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-black uppercase text-slate-500 sm:text-sm">
                            Profile / finish
                            <input
                              value={item.profile}
                              onChange={(event) => updateQuoteItem(index, { profile: event.target.value })}
                              placeholder="Resawn, S4S, S4S EE"
                              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold normal-case text-slate-900"
                            />
                          </label>
                          <label className="text-xs font-black uppercase text-slate-500 sm:text-sm">
                            Available qty / lengths
                            <input
                              value={item.availableQuantities}
                              onChange={(event) => updateQuoteItem(index, { availableQuantities: event.target.value })}
                              placeholder="35 @ 16', 40 @ 18'"
                              className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold normal-case text-slate-900"
                            />
                          </label>
                        </div>

                        {needsAllDimensions || needsLength ? (
                          <div className={`mt-3 grid gap-2 rounded-xl bg-blue-50 p-3 ${needsAllDimensions ? "grid-cols-3" : "grid-cols-1"}`}>
                            {needsAllDimensions ? (
                              <>
                                <input required type="number" min="0" step="any" value={item.thickness} onChange={(event) => updateQuoteItem(index, { thickness: event.target.value })} placeholder="Thickness" className="min-w-0 rounded-lg border border-blue-200 px-3 py-2.5 text-base" />
                                <input required type="number" min="0" step="any" value={item.width} onChange={(event) => updateQuoteItem(index, { width: event.target.value })} placeholder="Width" className="min-w-0 rounded-lg border border-blue-200 px-3 py-2.5 text-base" />
                              </>
                            ) : null}
                            <input required type="number" min="0" step="any" value={item.length} onChange={(event) => updateQuoteItem(index, { length: event.target.value })} placeholder="Length (ft)" className="min-w-0 rounded-lg border border-blue-200 px-3 py-2.5 text-base" />
                          </div>
                        ) : null}

                        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <summary className="cursor-pointer text-sm font-black text-slate-600">Optional product details</summary>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input value={item.species} onChange={(event) => updateQuoteItem(index, { species: event.target.value })} placeholder="Species" className="rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
                            <input value={item.grade} onChange={(event) => updateQuoteItem(index, { grade: event.target.value })} placeholder="Grade" className="rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
                          </div>
                        </details>

                        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-950 p-2.5 text-white">
                          <div><p className="text-[8px] font-black uppercase text-slate-400">Board feet</p><p className="truncate text-xs font-black">{calculation.totalBoardFeet.toFixed(2)}</p></div>
                          <div><p className="text-[8px] font-black uppercase text-slate-400">Per MBF</p><p className="truncate text-xs font-black text-emerald-300">{calculation.pricePerMbf ? money(calculation.pricePerMbf) : "—"}</p></div>
                          <div><p className="text-[8px] font-black uppercase text-slate-400">Extended</p><p className="truncate text-xs font-black">{money(calculation.extendedPrice)}</p></div>
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={addQuoteItem} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3.5 text-base font-black text-slate-700">
              <Plus className="h-4 w-4" /> Add another item
            </button>

            {quote.kind !== "request" ? (
              <label className="block rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-500">
                Valid until (optional)
                <input type="date" value={quote.validUntil} onChange={(event) => setQuote({ ...quote, validUntil: event.target.value })} className="mt-1 block w-full py-1 text-base text-slate-900 outline-none" />
              </label>
            ) : null}
            <textarea value={quote.notes} onChange={(event) => setQuote({ ...quote, notes: event.target.value })} placeholder={quote.kind === "request" ? "Details, grade, delivery location, or timing needed" : "Pricing or availability notes"} className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base leading-6" rows={3} />
            <button type="submit" disabled={isSending} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-white disabled:opacity-50 ${quote.kind === "request" ? "bg-violet-600" : "bg-emerald-600"}`}>
              <Check className="h-4 w-4" />
              {isSending ? "Sending…" : quote.kind === "request" ? "Send pricing request" : quote.revisionOf ? "Send revised quote" : "Send quote"}
            </button>
          </form>
        </Dialog>
      ) : null}
    </PageContainer>
  );
}
