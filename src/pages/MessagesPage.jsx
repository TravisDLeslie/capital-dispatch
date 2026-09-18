import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  MessageCircle,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function getUserDisplayName(user) {
  const emailName = String(user?.email || "").split("@")[0] || "";

  return (
    user?.displayName ||
    user?.driverName ||
    user?.name ||
    emailName ||
    "Team member"
  );
}

export default function MessagesPage({
  currentUser,
  userProfile,
  users = [],
  messages = [],
  canManageMessages = false,
  onSendMessage,
  onMarkMessageRead,
  onDeleteMessage,
}) {
  const [recipientId, setRecipientId] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState("");

  const currentUserId =
    currentUser?.uid || userProfile?.uid || userProfile?.id || "";
  const currentUserName = getUserDisplayName({
    ...userProfile,
    displayName: userProfile?.displayName || currentUser?.displayName,
    email: userProfile?.email || currentUser?.email,
  });

  const recipientOptions = useMemo(
    () =>
      users
        .filter((user) => user.status === "approved" && user.status !== "disabled")
        .map((user) => ({
          id: user.uid || user.id || "",
          email: user.email || "",
          name: getUserDisplayName(user),
        }))
        .filter((user) => user.id && user.id !== currentUserId)
        .sort((firstUser, secondUser) =>
          firstUser.name.localeCompare(secondUser.name, undefined, {
            sensitivity: "base",
          }),
        ),
    [currentUserId, users],
  );

  const visibleMessages = useMemo(() => {
    const scopedMessages = canManageMessages
      ? messages
      : messages.filter((message) => message.recipientId === currentUserId);

    return [...scopedMessages].sort((firstMessage, secondMessage) =>
      String(secondMessage.createdAt || "").localeCompare(
        String(firstMessage.createdAt || ""),
      ),
    );
  }, [canManageMessages, currentUserId, messages]);

  const conversations = useMemo(() => {
    const conversationMap = new Map();

    visibleMessages.forEach((message) => {
      const otherPersonId = canManageMessages
        ? message.recipientId || "unknown-recipient"
        : message.senderId || "capital-dispatch";
      const otherPersonName = canManageMessages
        ? message.recipientName || message.recipientEmail || "Team member"
        : message.senderName || "Capital Dispatch";
      const otherPersonEmail = canManageMessages
        ? message.recipientEmail || ""
        : message.senderEmail || "";
      const existingConversation = conversationMap.get(otherPersonId) || {
        id: otherPersonId,
        name: otherPersonName,
        email: otherPersonEmail,
        messages: [],
        latestAt: "",
        unreadCount: 0,
      };

      existingConversation.messages.push(message);

      if (
        !existingConversation.latestAt ||
        String(message.createdAt || "").localeCompare(
          String(existingConversation.latestAt || ""),
        ) > 0
      ) {
        existingConversation.latestAt = message.createdAt || "";
      }

      if (
        !canManageMessages &&
        message.recipientId === currentUserId &&
        !message.readAt
      ) {
        existingConversation.unreadCount += 1;
      }

      conversationMap.set(otherPersonId, existingConversation);
    });

    return [...conversationMap.values()]
      .map((conversation) => ({
        ...conversation,
        messages: [...conversation.messages].sort((firstMessage, secondMessage) =>
          String(secondMessage.createdAt || "").localeCompare(
            String(firstMessage.createdAt || ""),
          ),
        ),
      }))
      .sort((firstConversation, secondConversation) =>
        String(secondConversation.latestAt || "").localeCompare(
          String(firstConversation.latestAt || ""),
        ),
      );
  }, [canManageMessages, currentUserId, visibleMessages]);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) ||
      conversations[0] ||
      null,
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    if (
      selectedConversationId &&
      conversations.some(
        (conversation) => conversation.id === selectedConversationId,
      )
    ) {
      return;
    }

    setSelectedConversationId(conversations[0]?.id || "");
  }, [conversations, selectedConversationId]);

  async function handleSendMessage(event) {
    event.preventDefault();

    const selectedRecipient = recipientOptions.find(
      (recipient) => recipient.id === recipientId,
    );
    const trimmedMessage = messageBody.trim();

    if (!selectedRecipient || !trimmedMessage) {
      setErrorMessage("Choose a person and write the message first.");
      return;
    }

    setIsSending(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const now = new Date().toISOString();

      await onSendMessage?.({
        id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        body: trimmedMessage,
        recipientId: selectedRecipient.id,
        recipientEmail: selectedRecipient.email,
        recipientName: selectedRecipient.name,
        senderId: currentUserId,
        senderEmail: currentUser?.email || userProfile?.email || "",
        senderName: currentUserName,
        createdAt: now,
        updatedAt: now,
        readAt: "",
      });

      setSelectedConversationId(selectedRecipient.id);
      setRecipientId("");
      setMessageBody("");
      setStatusMessage("Message sent.");
    } catch (error) {
      console.error("Unable to send message:", error);
      setErrorMessage(error?.message || "Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleMarkRead(messageId) {
    try {
      await onMarkMessageRead?.(messageId);
    } catch (error) {
      console.error("Unable to mark message read:", error);
    }
  }

  async function handleDelete(messageId) {
    try {
      await onDeleteMessage?.(messageId);
    } catch (error) {
      console.error("Unable to delete message:", error);
      setErrorMessage(error?.message || "Unable to delete message.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FC2C38]">
          Internal Messages
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Messages
        </h1>
        <p className="mt-2 max-w-2xl text-base font-semibold leading-7 text-slate-500">
          Newest messages first, kept inside Capital Dispatch.
        </p>
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        {canManageMessages ? (
          <form
            onSubmit={handleSendMessage}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Send Message
            </p>

            <label className="mt-5 block">
              <span className="text-sm font-black text-slate-900">To</span>
              <select
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-500/15"
              >
                <option value="">Select a person...</option>
                {recipientOptions.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name} {recipient.email ? `- ${recipient.email}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-black text-slate-900">Message</span>
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                rows={7}
                placeholder="Type the internal message..."
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold leading-7 text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-500/15"
              />
            </label>

            {statusMessage ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
                {statusMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSending}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" strokeWidth={2.8} />
              {isSending ? "Sending..." : "Send Message"}
            </button>
          </form>
        ) : null}

        <section
          className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${
            canManageMessages ? "" : "lg:col-span-2"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {canManageMessages ? "Message Log" : "Inbox"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {conversations.length} conversations
              </h2>
            </div>
            <MessageCircle className="h-8 w-8 text-[#FC2C38]" strokeWidth={2.5} />
          </div>

          <div className="mt-5">
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-500">
                  No messages yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
                <div className="space-y-2">
                  {conversations.map((conversation) => {
                    const latestMessage = conversation.messages[0];
                    const isSelected =
                      selectedConversation?.id === conversation.id;

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setSelectedConversationId(conversation.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-[#FC2C38]/30 bg-red-50"
                            : "border-slate-200 bg-slate-50 hover:bg-white"
                        }`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
                          <UserRound className="h-5 w-5" strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-black text-slate-950">
                              {conversation.name}
                            </p>
                            {conversation.unreadCount > 0 ? (
                              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FC2C38] px-2 text-xs font-black text-white">
                                {conversation.unreadCount}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs font-bold text-slate-400">
                            {formatDateTime(latestMessage?.createdAt)}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                            {latestMessage?.body}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  {selectedConversation ? (
                    <>
                      <div className="border-b border-slate-200 px-1 pb-3">
                        <p className="text-lg font-black text-slate-950">
                          {selectedConversation.name}
                        </p>
                        {selectedConversation.email ? (
                          <p className="text-xs font-bold text-slate-400">
                            {selectedConversation.email}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-3">
                        {selectedConversation.messages.map((message) => {
                          const isUnread =
                            !canManageMessages &&
                            message.recipientId === currentUserId &&
                            !message.readAt;

                          return (
                            <article
                              key={message.id}
                              className={`rounded-3xl border p-4 shadow-sm ${
                                isUnread
                                  ? "border-[#FC2C38]/25 bg-white"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                    {canManageMessages
                                      ? `Sent by ${message.senderName || "Admin"}`
                                      : message.senderName || "Capital Dispatch"}
                                  </p>
                                  <p className="mt-1 text-xs font-bold text-slate-400">
                                    {formatDateTime(message.createdAt)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isUnread ? (
                                    <span className="h-3 w-3 rounded-full bg-[#FC2C38]" />
                                  ) : null}
                                  {canManageMessages && onDeleteMessage ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(message.id)}
                                      className="rounded-xl border border-red-100 bg-white p-2 text-red-500 transition hover:bg-red-50"
                                      aria-label="Delete message"
                                    >
                                      <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                                {message.body}
                              </p>

                              {isUnread ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkRead(message.id)}
                                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
                                >
                                  <CheckCircle2
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                  />
                                  Mark read
                                </button>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
