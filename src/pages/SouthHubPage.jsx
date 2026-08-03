import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  History,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

function getOpenItemCount(supplierRuns) {
  return supplierRuns.reduce(
    (count, supplierRun) =>
      count +
      (Array.isArray(supplierRun.items)
        ? supplierRun.items.filter((item) => !item.pickedUp).length
        : 0),
    0,
  );
}

function ActionCard({
  icon: Icon,
  label,
  title,
  description,
  metric,
  metricLabel,
  tone = "default",
  onClick,
}) {
  const isPrimary = tone === "primary";
  const isWarning = tone === "warning";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-red-200 hover:bg-red-50/30 sm:p-5 ${
        isPrimary
          ? "border-red-200"
          : isWarning
            ? "border-amber-200"
            : "border-slate-200"
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          isPrimary
            ? "bg-red-50 text-[#FC2C38]"
            : isWarning
              ? "bg-amber-50 text-amber-700"
              : "bg-slate-100 text-slate-700"
        }`}
      >
        <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
        <span className="mt-1 block text-xl font-black text-slate-950">
          {title}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-slate-500">
          {description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
          <span className="block text-xl font-black text-slate-950">
            {metric}
          </span>
          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            {metricLabel}
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="h-5 w-5 text-[#FC2C38] transition group-hover:translate-x-1"
          strokeWidth={2.6}
        />
      </span>
    </button>
  );
}

export default function SouthHubPage({
  supplierRuns,
  allowedPageIds,
  onPageChange,
}) {
  const canOpen = (pageId) => allowedPageIds.includes(pageId);
  const needsDispatchRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      (supplierRun.dispatchStatus === "needsDispatch" ||
        !supplierRun.driver),
  );
  const assignedOpenRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      supplierRun.dispatchStatus !== "needsDispatch" &&
      supplierRun.driver,
  );
  const completedRuns = supplierRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );
  const actionCards = [
    canOpen("supplier-runs-dispatch")
      ? {
          icon: AlertTriangle,
          label: "Dispatch",
          title: "Needs Dispatch",
          description:
            "Assign driver and truck before the pickup reaches the driver board.",
          metric: needsDispatchRuns.length,
          metricLabel: "Waiting",
          tone: needsDispatchRuns.length > 0 ? "warning" : "default",
          pageId: "supplier-runs-dispatch",
        }
      : null,
    canOpen("supplier-runs-check")
      ? {
          icon: PackageCheck,
          label: "Driver Board",
          title: "POs To Pick Up",
          description:
            "Open supplier stops, route order, item checkoffs, and pickup photos.",
          metric: assignedOpenRuns.length,
          metricLabel: "Open POs",
          pageId: "supplier-runs-check",
        }
      : null,
    canOpen("supplier-runs-history")
      ? {
          icon: History,
          label: "Archive",
          title: "South History",
          description:
            "Review completed South pickups after they leave the daily board.",
          metric: completedRuns.length,
          metricLabel: "Complete",
          pageId: "supplier-runs-history",
        }
      : null,
  ].filter(Boolean);

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "South" }]} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            <Truck aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            South
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            South
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            Start requests, dispatch trucks, and track pickups from one clean
            place.
          </p>
        </div>

        {canOpen("supplier-runs-add") ? (
          <button
            type="button"
            onClick={() => onPageChange("supplier-runs-add")}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-600 sm:mt-1"
          >
            <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
            Add PO
          </button>
        ) : null}
      </div>

      <section className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <p className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 sm:flex-row sm:items-center sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
            <ClipboardList
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Requests
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">
            {needsDispatchRuns.length}
          </p>
          <p className="mt-1 text-xs font-bold leading-tight text-slate-500 sm:text-sm">
            Waiting for dispatch
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <p className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 sm:flex-row sm:items-center sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
            <PackageCheck
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Open Pickups
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">
            {assignedOpenRuns.length}
          </p>
          <p className="mt-1 text-xs font-bold leading-tight text-slate-500 sm:text-sm">
            {getOpenItemCount(assignedOpenRuns)} items left
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <p className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 sm:flex-row sm:items-center sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
            <History
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Completed
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">
            {completedRuns.length}
          </p>
          <p className="mt-1 text-xs font-bold leading-tight text-slate-500 sm:text-sm">
            South history records
          </p>
        </div>
      </section>

      <section className="grid gap-3">
        {actionCards.map((actionCard) => (
          <ActionCard
            key={actionCard.pageId}
            {...actionCard}
            onClick={() => onPageChange(actionCard.pageId)}
          />
        ))}
      </section>
    </PageContainer>
  );
}
