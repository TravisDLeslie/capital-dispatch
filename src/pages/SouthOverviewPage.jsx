import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  History,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { formatDateInput } from "../utils/dateHelpers";

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getOpenItemCount(supplierRun) {
  return Array.isArray(supplierRun.items)
    ? supplierRun.items.filter((item) => !item.pickedUp).length
    : 0;
}

function getPickedItemCount(supplierRun) {
  return Array.isArray(supplierRun.items)
    ? supplierRun.items.filter((item) => item.pickedUp).length
    : 0;
}

function getTotalItemCount(supplierRun) {
  return Array.isArray(supplierRun.items) ? supplierRun.items.length : 0;
}

function isTodaySouthRun(supplierRun) {
  return supplierRun.scheduledDate === getTodayDateKey();
}

function QuickAction({
  icon: Icon,
  title,
  description,
  metric,
  tone = "default",
  onClick,
}) {
  const tones = {
    default: "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    red: "border-red-200 bg-red-50/70 text-red-950 hover:bg-red-50",
    amber: "border-amber-200 bg-amber-50/80 text-amber-950 hover:bg-amber-50",
    green:
      "border-emerald-200 bg-emerald-50/80 text-emerald-950 hover:bg-emerald-50",
    blue: "border-blue-200 bg-blue-50/80 text-blue-950 hover:bg-blue-50",
    slate: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-white",
  };
  const iconTones = {
    default: "bg-slate-100 text-slate-700",
    red: "bg-white text-[#FC2C38]",
    amber: "bg-white text-amber-700",
    green: "bg-white text-emerald-700",
    blue: "bg-white text-blue-700",
    slate: "bg-white text-slate-500",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[108px] items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition ${tones[tone] || tones.default}`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconTones[tone] || iconTones.default}`}
      >
        <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black">{title}</span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-slate-600">
          {description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {metric !== undefined ? (
          <span className="rounded-xl bg-white px-3 py-2 text-center text-lg font-black text-slate-950 shadow-sm">
            {metric}
          </span>
        ) : null}
        <ArrowRight
          aria-hidden="true"
          className="h-5 w-5 text-slate-500 transition group-hover:translate-x-1"
          strokeWidth={2.6}
        />
      </span>
    </button>
  );
}

/**
 * @param {{
 *   supplierRuns?: Array<Record<string, any>>;
 *   allowedPageIds?: string[];
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function SouthOverviewPage({
  supplierRuns = [],
  allowedPageIds = [],
  onPageChange,
}) {
  const canOpen = (pageId) => allowedPageIds.includes(pageId);
  const safeSupplierRuns = Array.isArray(supplierRuns) ? supplierRuns : [];
  const needsDispatchRuns = safeSupplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      (supplierRun.dispatchStatus === "needsDispatch" || !supplierRun.driver),
  );
  const openRuns = safeSupplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      supplierRun.dispatchStatus !== "needsDispatch" &&
      supplierRun.driver,
  );
  const completedRuns = safeSupplierRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );
  const todaysRuns = openRuns.filter(isTodaySouthRun);
  const todaysOpenItemCount = todaysRuns.reduce(
    (count, supplierRun) => count + getOpenItemCount(supplierRun),
    0,
  );

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Inbound POs", onClick: () => onPageChange?.("south") },
          { label: "South Pickups" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            <Truck aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            South Pickups
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            South Pickups
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            Add pickups, dispatch routes, and see what is being picked up today.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-right shadow-sm">
          <p className="text-3xl font-black text-emerald-800">
            {todaysRuns.length}
          </p>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Today
          </p>
        </div>
      </div>

      <section className="mb-6 grid gap-3 lg:grid-cols-2">
        {canOpen("supplier-runs-add") ? (
          <QuickAction
            icon={Plus}
            title="Add South POs"
            description="Create a pickup request for dispatch."
            tone="red"
            onClick={() => onPageChange?.("supplier-runs-add")}
          />
        ) : null}

        {canOpen("supplier-runs-dispatch") ? (
          <QuickAction
            icon={AlertTriangle}
            title="Dispatch"
            description="Assign driver and truck before pickup."
            metric={needsDispatchRuns.length}
            tone="amber"
            onClick={() => onPageChange?.("supplier-runs-dispatch")}
          />
        ) : null}

        {canOpen("supplier-runs-check") ? (
          <QuickAction
            icon={PackageCheck}
            title="View POs to Pick Up"
            description="Open the driver board and pickup checklists."
            metric={openRuns.length}
            tone="green"
            onClick={() => onPageChange?.("supplier-runs-check")}
          />
        ) : null}

        {canOpen("south-calendar") || canOpen("supplier-runs-calendar") ? (
          <QuickAction
            icon={CalendarDays}
            title="South Calendar"
            description="See scheduled South POs by pickup date."
            metric={openRuns.length}
            tone="blue"
            onClick={() =>
              onPageChange?.(
                canOpen("south-calendar")
                  ? "south-calendar"
                  : "supplier-runs-calendar",
              )
            }
          />
        ) : null}

        {canOpen("supplier-runs-history") ? (
          <QuickAction
            icon={History}
            title="South History"
            description="Review completed South pickup records."
            metric={completedRuns.length}
            tone="slate"
            onClick={() => onPageChange?.("supplier-runs-history")}
          />
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Current Route
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              POs Being Picked Up Today
            </h2>
          </div>

          <span className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
            {todaysOpenItemCount} items left
          </span>
        </div>

        {todaysRuns.length === 0 ? (
          <EmptyState
            title="None scheduled today"
            description="South pickups assigned for today will show here."
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {todaysRuns.map((supplierRun) => (
              <button
                key={supplierRun.id}
                type="button"
                onClick={() => onPageChange?.("supplier-runs-check")}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-black text-slate-950">
                      {supplierRun.poNumber || "No PO #"}
                    </p>
                    <p className="mt-1 text-sm font-black uppercase tracking-[0.1em] text-slate-600">
                      {supplierRun.vendor || "Unknown vendor"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      Driver: {supplierRun.driver || "Unassigned"}
                    </p>
                  </div>

                  <span className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                    <span className="block text-lg font-black text-emerald-800">
                      {getPickedItemCount(supplierRun)}/
                      {getTotalItemCount(supplierRun)}
                    </span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      Picked
                    </span>
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {formatDateInput(supplierRun.scheduledDate)}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    {getOpenItemCount(supplierRun)} left
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
