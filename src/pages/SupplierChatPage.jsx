import { useEffect, useMemo, useState } from "react";
import {
  getIdTokenResult,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from "firebase/auth";
import {
  disableNetwork,
  enableNetwork,
} from "firebase/firestore";
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
  X,
} from "lucide-react";
import PageContainer from "../components/PageContainer";
import { auth, db } from "../utils/firebase";
import {
  calculateLumberQuote,
  cancelSupplierInvitation,
  createSupplierConversation,
  createSupplierInvitation,
  sendSupplierMessage,
  subscribeToSupplierConversations,
  subscribeToSupplierInvitations,
  subscribeToSupplierMessages,
} from "../utils/supplierChatStorage";

const emptyQuote = {
  productName: "",
  species: "",
  grade: "",
  thickness: "",
  width: "",
  length: "",
  quantity: "",
  quotedPrice: "",
  priceUnit: "MBF",
  availability: "Available",
  leadTime: "",
  validUntil: "",
  notes: "",
};

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

function QuoteCard({ quote }) {
  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-4 text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Recorded pricing
          </p>
          <h4 className="mt-1 text-lg font-black">{quote.productName}</h4>
          <p className="text-sm font-semibold text-slate-500">
            {[quote.species, quote.grade].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800">
          {quote.availability || "Availability not set"}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Supplier quote</p>
          <p className="mt-1 font-black">{money(quote.quotedPrice)} / {quote.priceUnit}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3">
          <p className="text-[10px] font-black uppercase text-blue-500">Converted MBF</p>
          <p className="mt-1 font-black text-blue-900">{money(quote.pricePerMbf)} / MBF</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-[10px] font-black uppercase text-amber-600">Extended</p>
          <p className="mt-1 font-black text-amber-950">{money(quote.extendedPrice)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-slate-500">
        {quote.quantity || 0} pcs · {quote.thickness || 0} × {quote.width || 0} × {quote.length || 0}' · {Number(quote.totalBoardFeet || 0).toFixed(2)} BF
        {quote.leadTime ? ` · ${quote.leadTime}` : ""}
      </p>
      {quote.notes ? <p className="mt-2 text-sm text-slate-600">{quote.notes}</p> : null}
    </div>
  );
}

function Dialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
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
  const [invitations, setInvitations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [invite, setInvite] = useState({ email: "", contactName: "", vendorId: "" });
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
  const [cancelingInvitationId, setCancelingInvitationId] = useState("");
  const [showInvitationLog, setShowInvitationLog] = useState(false);

  const activeInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status !== "canceled"),
    [invitations],
  );
  const canceledInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "canceled"),
    [invitations],
  );
  const [conversationDraft, setConversationDraft] = useState({ supplierUserId: "", vendorId: "" });
  const [quote, setQuote] = useState(emptyQuote);
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
  const quoteCalculation = useMemo(() => calculateLumberQuote(quote), [quote]);

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
    return subscribeToSupplierConversations({
      userId: currentUser.id,
      vendorId: currentUser.vendorId,
      isInternal,
      onConversations: (nextConversations) => {
        setError("");
        setConversations(nextConversations);
        setSelectedConversationId((currentId) =>
          nextConversations.some((item) => item.id === currentId)
            ? currentId
            : nextConversations[0]?.id || "",
        );
      },
      onError: (nextError) => {
        if (nextError?.code === "permission-denied") {
          sessionStorage.removeItem(chatUnlockStorageKey(currentUser.id));
          setIsChatUnlocked(false);
          setConversations([]);
          setMessages([]);
          setSelectedConversationId("");
          setUnlockError(
            "Supplier Chat could not verify the refreshed Google session. Please unlock it once more.",
          );
          return;
        }
        setError(nextError.message || "Unable to load supplier conversations.");
      },
    });
  }, [currentUser.id, currentUser.vendorId, isInternal, isChatUnlocked]);

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

  async function handleUnlockChat() {
    if (!auth?.currentUser || !currentUser.id) {
      setUnlockError("Your signed-in account could not be verified. Sign out and sign in again.");
      return;
    }

    setIsUnlocking(true);
    setUnlockError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
        login_hint: auth.currentUser.email || "",
      });
      const credential = await reauthenticateWithPopup(auth.currentUser, provider);
      if (credential.user.uid !== currentUser.id) {
        throw new Error("The verified Google account does not match the signed-in user.");
      }
      const tokenResult = await getIdTokenResult(credential.user, true);
      const authenticationTime = new Date(tokenResult.authTime).getTime();
      if (
        !Number.isFinite(authenticationTime) ||
        Date.now() - authenticationTime >= CHAT_UNLOCK_WINDOW_MS
      ) {
        throw new Error(
          "Google did not return a recent authentication. Sign out, sign back in, and try again.",
        );
      }
      if (db) {
        await disableNetwork(db);
        await enableNetwork(db);
      }
      const expiration = Date.now() + CHAT_UNLOCK_WINDOW_MS;
      sessionStorage.setItem(
        chatUnlockStorageKey(currentUser.id),
        String(expiration),
      );
      setIsChatUnlocked(true);
    } catch (unlockFailure) {
      const message = String(unlockFailure?.message || "");
      setUnlockError(
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

  async function handleSendQuote(event) {
    event.preventDefault();
    if (!selectedConversation || !quote.productName.trim()) return;
    setIsSending(true);
    setError("");
    try {
      await sendSupplierMessage({
        conversationId: selectedConversation.id,
        vendorId: selectedConversation.vendorId,
        sender: currentUser,
        text: quote.notes || `${quote.productName} pricing`,
        quote: {
          ...quote,
          ...quoteCalculation,
          quotedPrice: Number(quote.quotedPrice) || 0,
          quantity: Number(quote.quantity) || 0,
          thickness: Number(quote.thickness) || 0,
          width: Number(quote.width) || 0,
          length: Number(quote.length) || 0,
        },
      });
      setQuote(emptyQuote);
      setShowQuote(false);
    } catch (sendError) {
      setError(sendError.message || "Unable to save that pricing record.");
    } finally {
      setIsSending(false);
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
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <p className="mt-2 font-black text-emerald-950">Vendor isolated</p>
          <p className="mt-1 text-xs font-semibold text-emerald-800">Suppliers only see conversations they are explicitly assigned.</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <Calculator className="h-5 w-5 text-blue-700" />
          <p className="mt-2 font-black text-blue-950">MBF conversion</p>
          <p className="mt-1 text-xs font-semibold text-blue-800">Convert piece, LF, and per-thousand quotes consistently.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <PackageSearch className="h-5 w-5 text-amber-700" />
          <p className="mt-2 font-black text-amber-950">Pricing history</p>
          <p className="mt-1 text-xs font-semibold text-amber-800">Structured quotes stay beside the supplier discussion.</p>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <div className="grid min-h-[650px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
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
            {!conversations.length ? <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500">No supplier conversations yet.</p> : null}
          </div>
        </aside>

        <section className="flex min-h-[650px] min-w-0 flex-col">
          {selectedConversation ? (
            <>
              <header className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-xl font-black text-slate-950">{selectedConversation.vendorName}</h2>
                <p className="text-sm font-semibold text-slate-500">{selectedConversation.supplierContactName} · Secure pricing conversation</p>
              </header>
              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
                {messages.map((message) => {
                  const isMine = message.senderUid === currentUser.id;
                  return (
                    <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${isMine ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-900"}`}>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] opacity-65">
                          <span>{message.senderName}</span><span>{formatDate(message.createdAt)}</span>
                        </div>
                        {message.text ? <p className="mt-2 whitespace-pre-wrap text-sm font-semibold">{message.text}</p> : null}
                        {message.type === "quote" && message.quote ? <QuoteCard quote={message.quote} /> : null}
                      </div>
                    </div>
                  );
                })}
                {!messages.length ? <div className="mx-auto max-w-md py-20 text-center"><MessageSquareText className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black text-slate-700">Start the supplier conversation</p><p className="mt-1 text-sm text-slate-500">Messages and structured prices will be recorded here.</p></div> : null}
              </div>
              <footer className="border-t border-slate-200 bg-white p-4">
                <form onSubmit={handleSend} className="flex flex-col gap-2 sm:flex-row">
                  <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} rows={2} placeholder="Ask about pricing, stock, lead time, or availability..." className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                  <button type="button" onClick={() => setShowQuote(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800"><DollarSign className="h-4 w-4" /> Add price</button>
                  <button type="submit" disabled={isSending || !messageText.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40"><Send className="h-4 w-4" /> Send</button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center"><div><MessageSquareText className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-lg font-black text-slate-800">Select or create a conversation</p></div></div>
          )}
        </section>
      </div>

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

      {showQuote ? (
        <Dialog title="Record supplier pricing" onClose={() => setShowQuote(false)}>
          <form onSubmit={handleSendQuote} className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><input required value={quote.productName} onChange={(event) => setQuote({ ...quote, productName: event.target.value })} placeholder="Product / item" className="rounded-xl border border-slate-300 px-4 py-3" /><input value={quote.species} onChange={(event) => setQuote({ ...quote, species: event.target.value })} placeholder="Species" className="rounded-xl border border-slate-300 px-4 py-3" /><input value={quote.grade} onChange={(event) => setQuote({ ...quote, grade: event.target.value })} placeholder="Grade" className="rounded-xl border border-slate-300 px-4 py-3" /><input value={quote.availability} onChange={(event) => setQuote({ ...quote, availability: event.target.value })} placeholder="Availability" className="rounded-xl border border-slate-300 px-4 py-3" /></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["thickness","Thickness"],["width","Width"],["length","Length (ft)"],["quantity","Quantity"]].map(([key,label]) => <input key={key} type="number" min="0" step="any" value={quote[key]} onChange={(event) => setQuote({ ...quote, [key]: event.target.value })} placeholder={label} className="min-w-0 rounded-xl border border-slate-300 px-3 py-3" />)}</div>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><input required type="number" min="0" step="any" value={quote.quotedPrice} onChange={(event) => setQuote({ ...quote, quotedPrice: event.target.value })} placeholder="Quoted price" className="rounded-xl border border-slate-300 px-4 py-3" /><select value={quote.priceUnit} onChange={(event) => setQuote({ ...quote, priceUnit: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3"><option value="MBF">Per MBF</option><option value="piece">Per piece</option><option value="LF">Per LF</option></select></div>
            <div className="grid gap-3 sm:grid-cols-2"><input value={quote.leadTime} onChange={(event) => setQuote({ ...quote, leadTime: event.target.value })} placeholder="Lead time" className="rounded-xl border border-slate-300 px-4 py-3" /><label className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-500">Valid until<input type="date" value={quote.validUntil} onChange={(event) => setQuote({ ...quote, validUntil: event.target.value })} className="mt-1 block w-full text-sm text-slate-900 outline-none" /></label></div>
            <textarea value={quote.notes} onChange={(event) => setQuote({ ...quote, notes: event.target.value })} placeholder="Pricing or availability notes" className="w-full rounded-xl border border-slate-300 px-4 py-3" rows={3} />
            <div className="grid gap-2 rounded-2xl bg-slate-950 p-4 text-white sm:grid-cols-3"><div><p className="text-[10px] font-black uppercase text-slate-400">Board feet</p><p className="font-black">{quoteCalculation.totalBoardFeet.toFixed(2)}</p></div><div><p className="text-[10px] font-black uppercase text-slate-400">Price / MBF</p><p className="font-black text-emerald-300">{money(quoteCalculation.pricePerMbf)}</p></div><div><p className="text-[10px] font-black uppercase text-slate-400">Extended</p><p className="font-black">{money(quoteCalculation.extendedPrice)}</p></div></div>
            <button type="submit" disabled={isSending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white"><Check className="h-4 w-4" /> Save price to conversation</button>
          </form>
        </Dialog>
      ) : null}
    </PageContainer>
  );
}
