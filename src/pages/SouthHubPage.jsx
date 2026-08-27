import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  History,
  PackageCheck,
  Plus,
  Truck,
  Warehouse,
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

function getTheirTruckItemCount(theirTruckPOs) {
  return theirTruckPOs.reduce(
    (count, theirTruckPO) =>
      count +
      (Array.isArray(theirTruckPO.items) ? theirTruckPO.items.length : 0),
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
  variant = "default",
  onClick,
}) {
  const toneClasses = {
    default: {
      button:
        "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30",
      icon: "bg-slate-100 text-slate-700",
      metric: "bg-slate-50 text-slate-950",
      arrow: "text-[#FC2C38]",
      label: "text-slate-400",
      title: "text-slate-950",
      description: "text-slate-500",
    },
    primary: {
      button:
        "border-red-200 bg-white hover:border-red-300 hover:bg-red-50/40",
      icon: "bg-red-50 text-[#FC2C38]",
      metric: "bg-red-50 text-red-900",
      arrow: "text-[#FC2C38]",
      label: "text-[#FC2C38]",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    warning: {
      button:
        "border-amber-300 bg-amber-50/70 hover:border-amber-400 hover:bg-amber-50",
      icon: "bg-white text-amber-700",
      metric: "bg-amber-50 text-amber-900",
      arrow: "text-amber-700",
      label: "text-amber-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    dispatch: {
      button:
        "border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50",
      icon: "bg-white text-blue-700",
      metric: "bg-white text-blue-900",
      arrow: "text-blue-700",
      label: "text-blue-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    success: {
      button:
        "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400 hover:bg-emerald-50",
      icon: "bg-white text-emerald-700",
      metric: "bg-white text-emerald-800",
      arrow: "text-emerald-700",
      label: "text-emerald-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    archive: {
      button:
        "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white",
      icon: "bg-white text-slate-500",
      metric: "bg-white text-slate-700",
      arrow: "text-slate-500",
      label: "text-slate-400",
      title: "text-slate-800",
      description: "text-slate-500",
    },
  };
  const selectedTone = toneClasses[tone] || toneClasses.default;
  const variantClasses = {
    default: {
      button: "items-center gap-4 p-4 sm:p-5",
      icon: "h-12 w-12 rounded-2xl",
      iconSvg: "h-6 w-6",
      title: "text-xl",
      metric: "rounded-2xl px-3 py-2",
      bar: "",
    },
    alert: {
      button: "items-center gap-4 p-4 sm:p-5 ring-1 ring-amber-100",
      icon: "h-14 w-14 rounded-2xl",
      iconSvg: "h-7 w-7",
      title: "text-2xl",
      metric: "rounded-2xl px-4 py-3",
      bar: "bg-amber-500",
    },
    live: {
      button: "items-center gap-4 p-5 sm:p-6 ring-1 ring-emerald-100",
      icon: "h-14 w-14 rounded-2xl",
      iconSvg: "h-7 w-7",
      title: "text-2xl",
      metric: "rounded-2xl px-4 py-3",
      bar: "bg-emerald-600",
    },
    quiet: {
      button: "items-center gap-4 p-4 sm:p-5 opacity-90",
      icon: "h-11 w-11 rounded-xl",
      iconSvg: "h-5 w-5",
      title: "text-lg",
      metric: "rounded-xl px-3 py-2",
      bar: "bg-slate-300",
    },
  };
  const selectedVariant = variantClasses[variant] || variantClasses.default;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-full overflow-hidden rounded-2xl border text-left shadow-sm transition ${selectedVariant.button} ${selectedTone.button}`}
    >
      {selectedVariant.bar ? (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1.5 ${selectedVariant.bar}`}
        />
      ) : null}

      <span
        className={`flex shrink-0 items-center justify-center ${selectedVariant.icon} ${selectedTone.icon}`}
      >
        <Icon
          aria-hidden="true"
          className={selectedVariant.iconSvg}
          strokeWidth={2.4}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-[10px] font-black uppercase tracking-[0.16em] ${selectedTone.label}`}
        >
          {label}
        </span>
        <span
          className={`mt-1 block font-black ${selectedVariant.title} ${selectedTone.title}`}
        >
          {title}
        </span>
        <span
          className={`mt-1 block text-sm font-semibold leading-5 ${selectedTone.description}`}
        >
          {description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span
          className={`text-right shadow-sm ${selectedVariant.metric} ${selectedTone.metric}`}
        >
          <span className="block text-xl font-black">
            {metric}
          </span>
          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            {metricLabel}
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className={`h-5 w-5 transition group-hover:translate-x-1 ${selectedTone.arrow}`}
          strokeWidth={2.6}
        />
      </span>
    </button>
  );
}

/**
 * @param {{
 *   supplierRuns: Array<Record<string, any>>;
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   allowedPageIds: string[];
 *   onPageChange: (pageId: string) => void;
 *   isDriverView?: boolean;
 * }} props
 */
export default function SouthHubPage({
  supplierRuns,
  theirTruckPOs = [],
  allowedPageIds,
  onPageChange,
  isDriverView = false,
}) {
  const [activeActionTab, setActiveActionTab] = useState("south");
  const canOpen = (pageId) => allowedPageIds.includes(pageId);
  const safeTheirTruckPOs = Array.isArray(theirTruckPOs)
    ? theirTruckPOs
    : [];
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
  const scheduledTheirTruckPOs = safeTheirTruckPOs.filter(
    (theirTruckPO) => theirTruckPO.status !== "complete",
  );
  const southActionCards = [
    canOpen("supplier-runs-check")
      ? {
          icon: PackageCheck,
          label: "Driver Board",
          title: "POs To Pick Up",
          description:
            "Open supplier stops, item checkoffs, and pickup photos.",
          metric: assignedOpenRuns.length,
          metricLabel: "Open POs",
          tone: "success",
          variant: "live",
          pageId: "supplier-runs-check",
        }
      : null,
    canOpen("south-calendar") || canOpen("supplier-runs-calendar")
      ? {
          icon: CalendarDays,
          label: "Schedule",
          title: "South Calendar",
          description:
            "See scheduled South POs by pickup date before they hit the route.",
          metric: assignedOpenRuns.length,
          metricLabel: "Scheduled",
          tone: "dispatch",
          variant: "default",
          pageId: canOpen("south-calendar")
            ? "south-calendar"
            : "supplier-runs-calendar",
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
          tone: "archive",
          variant: "quiet",
          pageId: "supplier-runs-history",
        }
      : null,
  ].filter(Boolean);
  const theirTruckActionCards = [
    canOpen("their-truck-pos")
      ? {
          icon: Truck,
          label: "Vendor Truck",
          title: "Their Truck POs",
          description:
            "POs coming in on a vendor truck, tied to vendor cadence and receiving.",
          metric: scheduledTheirTruckPOs.length,
          metricLabel: "Scheduled",
          tone: "dispatch",
          variant: "default",
          pageId: "their-truck-pos",
        }
      : null,
    canOpen("their-truck-calendar")
      ? {
          icon: Warehouse,
          label: "Inbound",
          title: "Their Truck Calendar",
          description:
            "View vendor-delivered POs by delivery date and cadence.",
          metric: scheduledTheirTruckPOs.length,
          metricLabel: "Inbound",
          tone: "dispatch",
          variant: "default",
          pageId: "their-truck-calendar",
        }
      : null,
    canOpen("their-truck-history")
      ? {
          icon: History,
          label: "Archive",
          title: "Their Truck History",
          description:
            "Search and review vendor-delivered PO records.",
          metric: safeTheirTruckPOs.length,
          metricLabel: "Records",
          tone: "archive",
          variant: "quiet",
          pageId: "their-truck-history",
        }
      : null,
  ].filter(Boolean);
  const actionCards =
    activeActionTab === "theirTruck" ? theirTruckActionCards : southActionCards;
  const pageTitle = isDriverView ? "South" : "Fulfillment";
  const pageEyebrow = isDriverView ? "South" : "PO Routing";
  const southLandingPage =
    (canOpen("supplier-runs-add") && "supplier-runs-add") ||
    (canOpen("supplier-runs-dispatch") && "supplier-runs-dispatch") ||
    (canOpen("supplier-runs-check") && "supplier-runs-check") ||
    (canOpen("supplier-runs-calendar") && "supplier-runs-calendar") ||
    "south";
  const titleCalendarPage =
    !isDriverView && canOpen("po-calendar")
      ? "po-calendar"
      : canOpen("supplier-runs-calendar")
        ? "supplier-runs-calendar"
        : "";
  const titleCalendarLabel =
    titleCalendarPage === "po-calendar"
      ? "Open PO Calendar"
      : "Open South Calendar";

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: pageTitle }]} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            <Truck aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            {pageEyebrow}
          </p>

          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
              {pageTitle}
            </h1>

            {titleCalendarPage ? (
              <button
                type="button"
                onClick={() => onPageChange(titleCalendarPage)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-[#FC2C38]"
                aria-label={titleCalendarLabel}
                title={titleCalendarLabel}
              >
                <CalendarDays
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={2.5}
                />
              </button>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            {isDriverView
              ? "Work assigned South pickups and keep dispatch updated."
              : "Route supplier POs by how the material is getting to the yard."}
          </p>
        </div>

        {!isDriverView ? (
          <div className="grid gap-2 sm:mt-1 sm:grid-cols-2">
            {canOpen("supplier-runs-add") ? (
              <button
                type="button"
                onClick={() => onPageChange("supplier-runs-add")}
                className="inline-flex min-h-[48px] min-w-[160px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#FC2C38] px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600 sm:px-5"
              >
                <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
                Add South Pickup
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onPageChange("their-truck-pos")}
              className="inline-flex min-h-[48px] min-w-[100px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 sm:px-5"
            >
              <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
              PO
            </button>
          </div>
        ) : canOpen("supplier-runs-add") ? (
          <button
            type="button"
            onClick={() => onPageChange(southLandingPage)}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-600 sm:mt-1"
          >
            <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
            Add PO
          </button>
        ) : null}
      </div>

      {!isDriverView ? (
        <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Fulfillment
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Choose how material is arriving
              </h2>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {canOpen("supplier-runs-add") ? (
              <button
                type="button"
                onClick={() => onPageChange("supplier-runs-add")}
                className="group flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50/60 p-4 text-left transition hover:border-red-300 hover:bg-red-50"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FC2C38] text-white">
                  <Truck aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-black text-slate-950">
                    South Pickup
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-slate-600">
                    Our driver is picking it up from a supplier.
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-[#FC2C38] transition group-hover:translate-x-1"
                  strokeWidth={2.6}
                />
              </button>
            ) : null}

            {canOpen("their-truck-pos") ? (
              <button
                type="button"
                onClick={() => onPageChange("their-truck-pos")}
                className="group flex items-center gap-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <PackageCheck
                    aria-hidden="true"
                    className="h-6 w-6"
                    strokeWidth={2.5}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-black text-slate-950">
                    Their Truck PO
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-slate-600">
                    Vendor truck or carrier is delivering to us.
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-blue-700 transition group-hover:translate-x-1"
                  strokeWidth={2.6}
                />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
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

        {!isDriverView ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 shadow-sm sm:p-4">
            <p className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-blue-700 sm:flex-row sm:items-center sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
              <Truck
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.4}
              />
              Their Truck
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">
              {scheduledTheirTruckPOs.length}
            </p>
            <p className="mt-1 text-xs font-bold leading-tight text-slate-500 sm:text-sm">
              {getTheirTruckItemCount(scheduledTheirTruckPOs)} items scheduled
            </p>
          </div>
        ) : null}
      </section>

      {!isDriverView ? (
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Action Items
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Work by PO type
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveActionTab("south")}
                className={`min-h-[38px] rounded-lg px-4 text-xs font-black uppercase tracking-[0.1em] transition ${
                  activeActionTab === "south"
                    ? "bg-[#FC2C38] text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                South
              </button>

              {theirTruckActionCards.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveActionTab("theirTruck")}
                  className={`min-h-[38px] rounded-lg px-4 text-xs font-black uppercase tracking-[0.1em] transition ${
                    activeActionTab === "theirTruck"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Their Truck
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-3">
        {actionCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-6 text-sm font-bold text-slate-500">
            No actions available for this PO type.
          </div>
        ) : (
          actionCards.map((actionCard) => (
            <ActionCard
              key={actionCard.pageId}
              {...actionCard}
              onClick={() => onPageChange(actionCard.pageId)}
            />
          ))
        )}
      </section>
    </PageContainer>
  );
}
