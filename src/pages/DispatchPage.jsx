// @ts-nocheck
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronUp,
  ClipboardCheck,
  MessageSquareText,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import {
  completeDispatchNote,
  saveDispatchNote,
  subscribeToDispatchNotes,
} from "../utils/dispatchNoteStorage";
import { createId } from "../utils/idHelpers";

function getDateValue(value) {
  return String(value || "").slice(0, 10);
}

function getTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(`${getDateValue(value)}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function needsSouthDispatch(run) {
  if (!run || run.completedAt || run.status === "complete") {
    return false;
  }

  return !String(run.driver || "").trim();
}

function needsDeliveryDispatch(delivery) {
  if (!delivery || isDeliveryComplete(delivery)) {
    return false;
  }

  if (
    delivery.deliveryType === "vendorReturn" ||
    delivery.routeStopType === "vendorReturn" ||
    delivery.deliveryScope === "vendorReturn" ||
    delivery.vendorReturn === true
  ) {
    return false;
  }

  return (
    !String(delivery.driver || "").trim() ||
    !String(delivery.truck || delivery.vehicleId || "").trim()
  );
}

function sortByDateThenCreated(a, b) {
  const dateA = getDateValue(a.pickupDate || a.scheduledDate || a.deliveryDate);
  const dateB = getDateValue(b.pickupDate || b.scheduledDate || b.deliveryDate);

  if (dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
}

function getRelativeDateTone(value) {
  const dateValue = getDateValue(value);
  const today = getTodayValue();

  if (!dateValue) {
    return "muted";
  }

  if (dateValue < today) {
    return "late";
  }

  if (dateValue === today) {
    return "today";
  }

  return "future";
}

function formatNoteTime(value) {
  const timestamp = new Date(value || "");

  if (Number.isNaN(timestamp.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function getRelativeDateLabel(value) {
  const dateValue = getDateValue(value);
  const today = getTodayValue();

  if (!dateValue) {
    return "No date";
  }

  if (dateValue < today) {
    return "Past due";
  }

  if (dateValue === today) {
    return "Today";
  }

  return formatDateLabel(value);
}

function getItemCount(items) {
  return Array.isArray(items) ? items.length : 0;
}

function getDeliveryAddress(delivery) {
  return String(
    delivery?.address || delivery?.deliveryAddress || "",
  ).trim();
}

function MetricPill({ value, label, tone = "slate" }) {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-[#FC2C38]"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700"
        : "bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-xl px-3 py-2 text-center ${toneClass}`}>
      <p className="text-xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[0.58rem] font-black uppercase tracking-[0.16em] opacity-70">
        {label}
      </p>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, detail, tone = "slate" }) {
  const toneClass =
    tone === "red"
      ? "border-red-100 bg-red-50/60 text-[#FC2C38]"
      : tone === "blue"
        ? "border-blue-100 bg-blue-50/70 text-blue-700"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50/80 text-amber-700"
          : "border-slate-200 bg-white text-slate-700";

  return (
    <div
      className={`flex min-h-20 items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-sm sm:px-4 ${toneClass}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">
        <Icon aria-hidden="true" className="h-4.5 w-4.5" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.16em] opacity-75">
            {label}
          </p>
          <p className="shrink-0 text-2xl font-black leading-none text-slate-950">
            {value}
          </p>
        </div>
        <p className="mt-1 truncate text-xs font-bold text-slate-500" title={detail}>
          {detail}
        </p>
      </div>
    </div>
  );
}

function QueueRow({ label, title, meta, date, tone, notes = [], onClick }) {
  const dateTone = getRelativeDateTone(date);
  const activeNotes = Array.isArray(notes) ? notes : [];
  const dateClass =
    dateTone === "late"
      ? "bg-red-50 text-red-700"
      : dateTone === "today"
        ? "bg-emerald-50 text-emerald-700"
        : dateTone === "future"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border bg-white px-2.5 py-2 text-left transition hover:shadow-sm sm:px-3 ${
        activeNotes.length > 0
          ? "border-amber-300 hover:border-amber-400"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
          tone === "delivery"
            ? "bg-blue-50 text-blue-700"
            : "bg-red-50 text-[#FC2C38]"
        }`}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-950">
          {title}
        </span>
        <span
          title={meta}
          className="mt-0.5 block truncate text-xs font-bold text-slate-500"
        >
          {meta}
        </span>
        {activeNotes.length > 0 ? (
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-black text-amber-800">
            <MessageSquareText
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={2.6}
            />
            <span className="truncate">{activeNotes[0].text}</span>
            {activeNotes.length > 1 ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.58rem]">
                +{activeNotes.length - 1}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span
          className={`max-w-28 whitespace-nowrap rounded-full px-2.5 py-1 text-center text-[0.6rem] font-black uppercase tracking-[0.08em] ${dateClass}`}
        >
          {getRelativeDateLabel(date)}
        </span>
        <ArrowRight
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700"
          strokeWidth={2.5}
        />
      </span>
    </button>
  );
}

function QueuePanel({
  icon: Icon,
  eyebrow,
  title,
  description,
  count,
  todayCount,
  rows,
  tone,
  disabled = false,
  onClick,
}) {
  const toneStyles =
    tone === "delivery"
      ? {
          card: "border-blue-200 bg-blue-50/40 hover:border-blue-300",
          icon: "bg-white text-blue-700",
          eyebrow: "text-blue-700",
          arrow: "text-blue-700",
          metricTone: "blue",
        }
      : {
          card: "border-red-200 bg-red-50/40 hover:border-red-300",
          icon: "bg-white text-[#FC2C38]",
          eyebrow: "text-[#FC2C38]",
          arrow: "text-[#FC2C38]",
          metricTone: "red",
        };

  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-2xl border p-3.5 shadow-sm transition sm:p-4 ${
        toneStyles.card
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneStyles.icon}`}
        >
          <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[0.62rem] font-black uppercase tracking-[0.2em] ${toneStyles.eyebrow}`}
          >
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-xl font-black leading-tight text-slate-950 sm:text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-500 sm:text-sm" title={description}>
            {description}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <div className="flex items-center gap-2">
            <MetricPill
              value={count}
              label="waiting"
              tone={toneStyles.metricTone}
            />
            <MetricPill
              value={todayCount}
              label="today"
              tone={toneStyles.metricTone}
            />
          </div>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-black text-white shadow-sm transition ${
              tone === "delivery"
                ? "bg-blue-700 hover:bg-blue-800"
                : "bg-[#FC2C38] hover:bg-red-600"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            Open Queue
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.6}
            />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
        <div className="flex gap-2">
          <MetricPill
            value={count}
            label="waiting"
            tone={toneStyles.metricTone}
          />
          <MetricPill
            value={todayCount}
            label="today"
            tone={toneStyles.metricTone}
          />
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-white shadow-sm transition ${
            tone === "delivery"
              ? "bg-blue-700 hover:bg-blue-800"
              : "bg-[#FC2C38] hover:bg-red-600"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Open Queue
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
        </button>
      </div>

      <div className="mt-3 grid min-w-0 gap-1.5">
        {rows.length > 0 ? (
          rows
            .slice(0, 4)
            .map((row) => (
              <QueueRow
                key={row.id}
                label={row.label}
                title={row.title}
                meta={row.meta}
                date={row.date}
                tone={tone}
                notes={row.notes}
                onClick={onClick}
              />
            ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-2.5 text-xs font-bold text-slate-500">
            Nothing waiting right now.
          </div>
        )}
      </div>

    </section>
  );
}

export default function DispatchPage({
  supplierRuns = [],
  deliveries = [],
  allowedPageIds = [],
  currentUser = {},
  onPageChange,
}) {
  const [activeMobileQueue, setActiveMobileQueue] = useState("south");
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [dispatchNotes, setDispatchNotes] = useState([]);
  const [selectedNoteTargetKey, setSelectedNoteTargetKey] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [completingNoteId, setCompletingNoteId] = useState("");
  const safeSupplierRuns = Array.isArray(supplierRuns)
    ? supplierRuns.filter(Boolean)
    : [];
  const safeDeliveries = Array.isArray(deliveries)
    ? deliveries.filter(Boolean)
    : [];
  const safeAllowedPageIds = Array.isArray(allowedPageIds)
    ? allowedPageIds
    : [];
  const today = getTodayValue();
  const southQueue = safeSupplierRuns
    .filter(needsSouthDispatch)
    .sort(sortByDateThenCreated);
  const deliveryQueue = safeDeliveries
    .filter(needsDeliveryDispatch)
    .sort(sortByDateThenCreated);
  const southToday = southQueue.filter(
    (run) => getDateValue(run.pickupDate || run.scheduledDate) === today,
  ).length;
  const deliveryToday = deliveryQueue.filter(
    (delivery) => getDateValue(delivery.deliveryDate) === today,
  ).length;
  const canDispatchSouth = safeAllowedPageIds.includes(
    "supplier-runs-dispatch",
  );
  const canDispatchDeliveries = safeAllowedPageIds.includes(
    "deliveries-dispatch",
  );
  const oldestWaitingDate = [southQueue[0], deliveryQueue[0]]
    .map((item) => item?.pickupDate || item?.scheduledDate || item?.deliveryDate)
    .filter(Boolean)
    .sort()[0];
  const activeDispatchNotes = dispatchNotes.filter(
    (note) => note.status !== "complete" && note.targetId,
  );
  const activeNotesByTarget = activeDispatchNotes.reduce(
    (notesByTarget, note) => {
      const targetKey = `${note.targetType || ""}:${note.targetId || ""}`;

      notesByTarget[targetKey] = [...(notesByTarget[targetKey] || []), note];

      return notesByTarget;
    },
    {},
  );
  const southRows = southQueue.map((run) => ({
    id: run.id,
    label: "PO",
    title: run.poNumber ? `PO ${run.poNumber}` : "PO missing number",
    meta: `${run.vendor || "No vendor"} · ${getItemCount(run.items)} ${
      getItemCount(run.items) === 1 ? "item" : "items"
    }`,
    date: run.pickupDate || run.scheduledDate,
    notes: activeNotesByTarget[`south:${run.id}`] || [],
  }));
  const deliveryRows = deliveryQueue.map((delivery) => ({
    id: delivery.id,
    label: "DEL",
    title: delivery.orderNumber
      ? `Order ${delivery.orderNumber}`
      : "Order missing number",
    meta: `${delivery.customerName || "No customer"} · ${
      getDeliveryAddress(delivery) || "No address"
    }`,
    date: delivery.deliveryDate,
    notes: activeNotesByTarget[`delivery:${delivery.id}`] || [],
  }));
  const dispatchNoteTargets = [
    ...(canDispatchSouth
      ? southQueue.map((run) => ({
          key: `south:${run.id}`,
          targetType: "south",
          targetId: run.id,
          targetNumber: String(run.poNumber || "").trim(),
          targetName: String(run.vendor || "No vendor").trim(),
          label: `${run.poNumber ? `PO ${run.poNumber}` : "PO missing number"} — ${
            run.vendor || "No vendor"
          }`,
        }))
      : []),
    ...(canDispatchDeliveries
      ? deliveryQueue.map((delivery) => ({
          key: `delivery:${delivery.id}`,
          targetType: "delivery",
          targetId: delivery.id,
          targetNumber: String(delivery.orderNumber || "").trim(),
          targetName: String(delivery.customerName || "No customer").trim(),
          label: `${
            delivery.orderNumber
              ? `Order ${delivery.orderNumber}`
              : "Order missing number"
          } — ${delivery.customerName || "No customer"}`,
        }))
      : []),
  ];
  const selectedNoteTarget =
    dispatchNoteTargets.find((target) => target.key === selectedNoteTargetKey) ||
    null;
  const mobilePanels = [
    canDispatchSouth
      ? {
          id: "south",
          label: "South",
          count: southQueue.length,
        }
      : null,
    canDispatchDeliveries
      ? {
          id: "deliveries",
          label: "Deliveries",
          count: deliveryQueue.length,
        }
      : null,
  ].filter(Boolean);
  const activePanelId =
    mobilePanels.some((panel) => panel.id === activeMobileQueue)
      ? activeMobileQueue
      : mobilePanels[0]?.id || "south";
  useEffect(() => {
    return subscribeToDispatchNotes(
      (savedNotes) => {
        setDispatchNotes(savedNotes);
        setNoteError("");
      },
      (error) => {
        console.error("Unable to sync dispatch notes:", error);
        setNoteError(
          "Dispatch notes could not load. Check your connection and try again.",
        );
      },
    );
  }, []);

  async function handleAddNote(event) {
    event.preventDefault();
    const text = noteText.trim();

    if (!text || !selectedNoteTarget || isSavingNote) {
      return;
    }

    setIsSavingNote(true);
    setNoteError("");

    try {
      const updatedNotes = await saveDispatchNote({
        id: createId(),
        text,
        targetType: selectedNoteTarget.targetType,
        targetId: selectedNoteTarget.targetId,
        targetNumber: selectedNoteTarget.targetNumber,
        targetName: selectedNoteTarget.targetName,
        createdById: currentUser.id || "",
        createdByName: currentUser.name || "",
        createdByEmail: currentUser.email || "",
      });

      setDispatchNotes(updatedNotes);
      setNoteText("");
    } catch (error) {
      console.error("Unable to save dispatch note:", error);
      setNoteError(
        "This dispatch note could not be saved. Check your connection and try again.",
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleCompleteNote(noteId) {
    if (!noteId || completingNoteId) {
      return;
    }

    setCompletingNoteId(noteId);
    setNoteError("");

    try {
      const updatedNotes = await completeDispatchNote(noteId, currentUser);
      setDispatchNotes(updatedNotes);
    } catch (error) {
      console.error("Unable to complete dispatch note:", error);
      setNoteError(
        "This dispatch note could not be marked done. Check your connection and try again.",
      );
    } finally {
      setCompletingNoteId("");
    }
  }

  return (
    <PageContainer className="xl:py-5">
      <Breadcrumbs items={[{ label: "Dispatch" }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FC2C38]">
            Dispatch
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Needs Dispatch
          </h1>
          <p className="mt-1 max-w-3xl text-sm font-bold text-slate-500 sm:text-base">
            Assign the South pickups and delivery orders that are waiting for a driver or truck.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNotesOpen((isOpen) => !isOpen)}
            aria-expanded={isNotesOpen}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
              isNotesOpen
                ? "border-amber-300 bg-amber-100 text-amber-950"
                : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
            }`}
          >
            <MessageSquareText
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.5}
            />
            PO / Order Notes
            {activeDispatchNotes.length > 0 ? (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[0.62rem] text-white">
                {activeDispatchNotes.length}
              </span>
            ) : null}
          </button>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white">
            <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
            {southQueue.length + deliveryQueue.length} total waiting
          </div>
        </div>
      </div>

      {isNotesOpen ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-amber-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <MessageSquareText
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.5}
              />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-slate-950">
                  PO / Order Notes
                </h2>
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.12em] text-amber-900">
                  Dispatch only
                </span>
              </div>
              <p className="text-xs font-bold text-amber-900/70 sm:text-sm">
                Private dispatch reminders attached to a specific PO or order.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-amber-900 shadow-sm">
              {activeDispatchNotes.length} active
            </span>
            <button
              type="button"
              onClick={() => setIsNotesOpen(false)}
              aria-label="Collapse PO and order notes"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-800 transition hover:bg-amber-100"
            >
              <ChevronUp
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.6}
              />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleAddNote}
          className="grid gap-2 border-b border-amber-200 bg-white/60 p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:p-4"
        >
          <label className="sr-only" htmlFor="dispatch-note-target">
            Choose a PO or order
          </label>
          <select
            id="dispatch-note-target"
            value={selectedNoteTargetKey}
            onChange={(event) => setSelectedNoteTargetKey(event.target.value)}
            disabled={dispatchNoteTargets.length === 0}
            className="min-h-11 min-w-0 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm font-black text-slate-950 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {dispatchNoteTargets.length > 0 ? (
              <>
                <option value="" disabled>
                  Choose a PO or order...
                </option>
                {dispatchNoteTargets.map((target) => (
                  <option key={target.key} value={target.key}>
                    {target.label}
                  </option>
                ))}
              </>
            ) : (
              <option value="">No PO or order waiting</option>
            )}
          </select>
          <label className="sr-only" htmlFor="dispatch-note-input">
            Add a note for the selected PO or order
          </label>
          <input
            id="dispatch-note-input"
            type="text"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            maxLength={500}
            placeholder="Example: Take the business credit card with you"
            className="min-h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
          />
          <button
            type="submit"
            disabled={!noteText.trim() || !selectedNoteTarget || isSavingNote}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.8} />
            {isSavingNote ? "Saving..." : "Add note"}
          </button>
        </form>

        {noteError ? (
          <div className="border-b border-amber-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
            {noteError}
          </div>
        ) : null}

        <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
          {activeDispatchNotes.length > 0 ? (
            activeDispatchNotes.map((note) => (
              <article
                key={note.id}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 truncate text-[0.64rem] font-black uppercase tracking-[0.1em] text-amber-700">
                    {note.targetType === "south" ? "PO" : "Order"}{" "}
                    {note.targetNumber || "No number"}
                    {note.targetName ? ` · ${note.targetName}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-sm font-black leading-snug text-slate-950">
                    {note.text}
                  </p>
                  <p className="mt-1.5 truncate text-[0.66rem] font-black uppercase tracking-[0.08em] text-slate-400">
                    {note.createdByName || note.createdByEmail || "Dispatch"}
                    {note.createdAt ? ` · ${formatNoteTime(note.createdAt)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCompleteNote(note.id)}
                  disabled={completingNoteId === note.id}
                  aria-label={`Mark dispatch note done: ${note.text}`}
                  title="Mark done"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  <Check
                    aria-hidden="true"
                    className="h-5 w-5"
                    strokeWidth={2.8}
                  />
                </button>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-amber-300 bg-white/60 px-4 py-3 text-sm font-bold text-amber-900/70 sm:col-span-2 xl:col-span-3">
              No active PO or order notes. Choose an item above to add one.
            </div>
          )}
        </div>
        </section>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={ClipboardCheck}
          label="Total Waiting"
          value={southQueue.length + deliveryQueue.length}
          detail="Items that still need dispatch attention."
          tone="slate"
        />
        <SummaryTile
          icon={Truck}
          label="South"
          value={southQueue.length}
          detail={`${southToday} waiting for today.`}
          tone="red"
        />
        <SummaryTile
          icon={PackageCheck}
          label="Deliveries"
          value={deliveryQueue.length}
          detail={`${deliveryToday} waiting for today.`}
          tone="blue"
        />
        <SummaryTile
          icon={CalendarDays}
          label="Oldest"
          value={oldestWaitingDate ? getRelativeDateLabel(oldestWaitingDate) : "Clear"}
          detail={
            oldestWaitingDate
              ? "Oldest request needing assignment."
              : "Nothing is waiting right now."
          }
          tone={getRelativeDateTone(oldestWaitingDate) === "late" ? "amber" : "slate"}
        />
      </div>

      {mobilePanels.length > 1 ? (
        <div className="mt-4 grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm xl:hidden">
          {mobilePanels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              onClick={() => setActiveMobileQueue(panel.id)}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                activePanelId === panel.id
                  ? "bg-slate-950 text-white"
                  : "text-slate-500"
              }`}
            >
              {panel.label}
              <span className="ml-2 opacity-70">{panel.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {canDispatchSouth ? (
          <div className={`min-w-0 ${activePanelId === "south" ? "" : "hidden xl:block"}`}>
            <QueuePanel
              icon={Truck}
              eyebrow="South"
              title="South Needs Dispatch"
              description="Assign a driver and truck before these pickups show cleanly on the driver board."
              count={southQueue.length}
              todayCount={southToday}
              rows={southRows}
              tone="south"
              onClick={() => onPageChange?.("supplier-runs-dispatch")}
            />
          </div>
        ) : null}

        {canDispatchDeliveries ? (
          <div className={`min-w-0 ${activePanelId === "deliveries" ? "" : "hidden xl:block"}`}>
            <QueuePanel
              icon={PackageCheck}
              eyebrow="Deliveries"
              title="Delivery Needs Dispatch"
              description="Put delivery orders onto the board with the right driver, truck, and schedule."
              count={deliveryQueue.length}
              todayCount={deliveryToday}
              rows={deliveryRows}
              tone="delivery"
              onClick={() => onPageChange?.("deliveries-dispatch")}
            />
          </div>
        ) : null}
      </div>

      {!canDispatchSouth && !canDispatchDeliveries ? (
        <div className="mt-8 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-1 h-6 w-6 shrink-0"
            />
            <div>
              <h2 className="text-xl font-black">No dispatch access</h2>
              <p className="mt-1 text-base font-bold">
                Give this user South dispatch or Delivery dispatch access from Admin &gt; User Access.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
