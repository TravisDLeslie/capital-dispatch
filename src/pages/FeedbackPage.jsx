import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  MessageSquareText,
  Send,
  Trash2,
} from "lucide-react";

const appAreas = [
  "Dashboard",
  "Fulfillment",
  "Receiving",
  "South",
  "Deliveries",
  "Sales",
  "Documents",
  "Admin",
  "Other",
];

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

function getUserName(currentUser, userProfile) {
  return (
    userProfile?.displayName ||
    userProfile?.driverName ||
    currentUser?.displayName ||
    currentUser?.email ||
    "Team member"
  );
}

export default function FeedbackPage({
  currentUser,
  userProfile,
  feedbackEntries = [],
  canViewTeamFeedback = false,
  onSaveFeedback,
  onDeleteFeedback,
  onPageChange,
}) {
  const [appArea, setAppArea] = useState("South");
  const [feedbackText, setFeedbackText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const userId = currentUser?.uid || userProfile?.uid || userProfile?.id || "";
  const userEmail = currentUser?.email || userProfile?.email || "";
  const userName = getUserName(currentUser, userProfile);

  const visibleFeedback = useMemo(() => {
    const entries = canViewTeamFeedback
      ? feedbackEntries
      : feedbackEntries.filter((entry) => entry.userId === userId);

    return [...entries].sort((firstEntry, secondEntry) =>
      String(secondEntry.createdAt || "").localeCompare(
        String(firstEntry.createdAt || ""),
      ),
    );
  }, [canViewTeamFeedback, feedbackEntries, userId]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedFeedback = feedbackText.trim();

    if (!trimmedFeedback) {
      setErrorMessage("Add the feedback or issue first.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const now = new Date().toISOString();

      await onSaveFeedback?.({
        id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        appArea,
        feedback: trimmedFeedback,
        status: "open",
        userId,
        userEmail,
        userName,
        createdAt: now,
        updatedAt: now,
      });

      setFeedbackText("");
      setStatusMessage("Feedback saved.");
    } catch (error) {
      console.error("Unable to save feedback:", error);
      setErrorMessage(error?.message || "Unable to save feedback.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(feedbackEntryId) {
    try {
      await onDeleteFeedback?.(feedbackEntryId);
      setStatusMessage("Feedback removed.");
      setErrorMessage("");
    } catch (error) {
      console.error("Unable to delete feedback:", error);
      setErrorMessage(error?.message || "Unable to remove feedback.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FC2C38]">
            App Feedback
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Feedback
          </h1>
          <p className="mt-2 max-w-2xl text-base font-semibold leading-7 text-slate-500">
            Send an app issue or idea straight from the spot where it happens.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onPageChange?.("messages")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:border-[#FC2C38]/40"
        >
          <MessageSquareText className="h-4 w-4" strokeWidth={2.5} />
          Messages
        </button>
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            New Feedback
          </p>

          <label className="mt-5 block">
            <span className="text-sm font-black text-slate-900">App area</span>
            <select
              value={appArea}
              onChange={(event) => setAppArea(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-500/15"
            >
              {appAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-black text-slate-900">
              Issue or feedback
            </span>
            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              rows={7}
              placeholder="What happened, what felt confusing, or what would make the app better?"
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold leading-7 text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-500/15"
            />
          </label>

          {statusMessage ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
              {statusMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">
              <AlertCircle className="h-4 w-4" strokeWidth={2.5} />
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send className="h-4 w-4" strokeWidth={2.8} />
            {isSaving ? "Sending..." : "Send Feedback"}
          </button>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {canViewTeamFeedback ? "Team Feedback" : "My Feedback"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {visibleFeedback.length} saved
              </h2>
            </div>

            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.16em] text-white">
              Private
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {visibleFeedback.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <MessageSquareText className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-500">
                  No feedback entered yet.
                </p>
              </div>
            ) : (
              visibleFeedback.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                        {entry.appArea || "App"}
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {canViewTeamFeedback
                          ? entry.userName || entry.userEmail || userName
                          : "You"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">
                        {formatDateTime(entry.createdAt)}
                      </span>
                      {(canViewTeamFeedback || entry.userId === userId) &&
                      onDeleteFeedback ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="rounded-xl border border-red-100 bg-white p-2 text-red-500 transition hover:bg-red-50"
                          aria-label="Delete feedback"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
                    {entry.feedback}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
