// @ts-nocheck
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  PackageCheck,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { isDeliveryComplete } from "../utils/deliveryStatus";

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

function MetricPill({ value, label, tone = "slate" }) {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-[#FC2C38]"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700"
        : "bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-2xl px-4 py-3 text-center ${toneClass}`}>
      <p className="text-3xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.18em] opacity-70">
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
    <div className={`rounded-3xl border p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] opacity-75">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black leading-none text-slate-950">
            {value}
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
        </span>
      </div>
      <p className="mt-3 text-sm font-bold leading-snug text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function QueueRow({ label, title, meta, date, tone, onClick }) {
  const dateTone = getRelativeDateTone(date);
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
      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-sm"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
          tone === "delivery"
            ? "bg-blue-50 text-blue-700"
            : "bg-red-50 text-[#FC2C38]"
        }`}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-black text-slate-950">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold text-slate-500">
          {meta}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] ${dateClass}`}
      >
        {getRelativeDateLabel(date)}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700"
        strokeWidth={2.5}
      />
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
      className={`relative overflow-hidden rounded-[1.75rem] border p-5 shadow-sm transition sm:p-6 ${
        toneStyles.card
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${toneStyles.icon}`}
        >
          <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-black uppercase tracking-[0.22em] ${toneStyles.eyebrow}`}
          >
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 text-base font-bold leading-relaxed text-slate-600">
            {description}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
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
      </div>

      <div className="mt-5 grid gap-2">
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
                onClick={onClick}
              />
            ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm font-bold text-slate-500">
            Nothing waiting right now.
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div className="flex gap-2 sm:hidden">
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
          className={`ml-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white shadow-sm transition ${
            tone === "delivery"
              ? "bg-blue-700 hover:bg-blue-800"
              : "bg-[#FC2C38] hover:bg-red-600"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Open Queue
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
        </button>
      </div>
    </section>
  );
}

export default function DispatchPage({
  supplierRuns = [],
  deliveries = [],
  allowedPageIds = [],
  onPageChange,
}) {
  const [activeMobileQueue, setActiveMobileQueue] = useState("south");
  const today = getTodayValue();
  const southQueue = supplierRuns.filter(needsSouthDispatch).sort(sortByDateThenCreated);
  const deliveryQueue = deliveries
    .filter(needsDeliveryDispatch)
    .sort(sortByDateThenCreated);
  const southToday = southQueue.filter(
    (run) => getDateValue(run.pickupDate || run.scheduledDate) === today,
  ).length;
  const deliveryToday = deliveryQueue.filter(
    (delivery) => getDateValue(delivery.deliveryDate) === today,
  ).length;
  const canDispatchSouth = allowedPageIds.includes("supplier-runs-dispatch");
  const canDispatchDeliveries = allowedPageIds.includes("deliveries-dispatch");
  const oldestWaitingDate = [southQueue[0], deliveryQueue[0]]
    .map((item) => item?.pickupDate || item?.scheduledDate || item?.deliveryDate)
    .filter(Boolean)
    .sort()[0];
  const southRows = southQueue.map((run) => ({
    id: run.id,
    label: "PO",
    title: run.poNumber ? `PO ${run.poNumber}` : "PO missing number",
    meta: `${run.vendor || "No vendor"} · ${getItemCount(run.items)} ${
      getItemCount(run.items) === 1 ? "item" : "items"
    }`,
    date: run.pickupDate || run.scheduledDate,
  }));
  const deliveryRows = deliveryQueue.map((delivery) => ({
    id: delivery.id,
    label: "DEL",
    title: delivery.orderNumber
      ? `Order ${delivery.orderNumber}`
      : "Order missing number",
    meta: `${delivery.customerName || "No customer"} · ${
      delivery.deliveryAddress || "No address"
    }`,
    date: delivery.deliveryDate,
  }));
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

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Dispatch" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#FC2C38]">
            Dispatch
          </p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-slate-950">
            Needs Dispatch
          </h1>
          <p className="mt-3 max-w-3xl text-xl font-bold leading-relaxed text-slate-500">
            Assign the South pickups and delivery orders that are waiting for a driver or truck.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white">
          <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
          {southQueue.length + deliveryQueue.length} total waiting
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="mt-6 grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm xl:hidden">
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

      <div className="mt-5 grid gap-5 xl:mt-8 xl:grid-cols-2">
        {canDispatchSouth ? (
          <div className={activePanelId === "south" ? "" : "hidden xl:block"}>
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
          <div className={activePanelId === "deliveries" ? "" : "hidden xl:block"}>
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
