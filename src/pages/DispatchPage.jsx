// @ts-nocheck
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

function DispatchActionCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  count,
  todayCount,
  nextLabel,
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-[1.75rem] border p-5 text-left shadow-sm transition sm:p-6 ${
        toneStyles.card
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:-translate-y-0.5"}`}
    >
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
        <p className="mt-3 text-sm font-black text-slate-500">
          {nextLabel || "Nothing waiting right now."}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-4 sm:flex">
        <MetricPill value={count} label="waiting" tone={toneStyles.metricTone} />
        <MetricPill
          value={todayCount}
          label="today"
          tone={toneStyles.metricTone}
        />
        <ArrowRight
          aria-hidden="true"
          className={`h-7 w-7 transition group-hover:translate-x-1 ${toneStyles.arrow}`}
          strokeWidth={2.5}
        />
      </div>
      <div className="sm:hidden">
        <MetricPill value={count} label="waiting" tone={toneStyles.metricTone} />
      </div>
    </button>
  );
}

export default function DispatchPage({
  supplierRuns = [],
  deliveries = [],
  allowedPageIds = [],
  onPageChange,
}) {
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
  const nextSouth = southQueue[0];
  const nextDelivery = deliveryQueue[0];

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

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        {canDispatchSouth ? (
          <DispatchActionCard
            icon={Truck}
            eyebrow="South"
            title="South Needs Dispatch"
            description="Assign a driver and truck before these pickups show cleanly on the driver board."
            count={southQueue.length}
            todayCount={southToday}
            nextLabel={
              nextSouth
                ? `Next: PO ${nextSouth.poNumber || "unknown"} · ${nextSouth.vendor || "No vendor"} · ${formatDateLabel(nextSouth.pickupDate || nextSouth.scheduledDate)}`
                : ""
            }
            tone="south"
            onClick={() => onPageChange?.("supplier-runs-dispatch")}
          />
        ) : null}

        {canDispatchDeliveries ? (
          <DispatchActionCard
            icon={PackageCheck}
            eyebrow="Deliveries"
            title="Delivery Needs Dispatch"
            description="Put delivery orders onto the board with the right driver, truck, and schedule."
            count={deliveryQueue.length}
            todayCount={deliveryToday}
            nextLabel={
              nextDelivery
                ? `Next: Order ${nextDelivery.orderNumber || "unknown"} · ${nextDelivery.customerName || "No customer"} · ${formatDateLabel(nextDelivery.deliveryDate)}`
                : ""
            }
            tone="delivery"
            onClick={() => onPageChange?.("deliveries-dispatch")}
          />
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

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            <CalendarDays aria-hidden="true" className="h-4 w-4" />
            Today
          </p>
          <p className="mt-3 text-4xl font-black text-slate-950">
            {southToday + deliveryToday}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            items waiting for today
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-red-100 bg-red-50/40 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            South
          </p>
          <p className="mt-3 text-4xl font-black text-slate-950">
            {southQueue.length}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            pickups missing assignment
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
            Deliveries
          </p>
          <p className="mt-3 text-4xl font-black text-slate-950">
            {deliveryQueue.length}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            orders missing driver or truck
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
