import { useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const pathLabels = {
  wePickup: "South pickup",
  supplierDelivery: "Their Truck",
  pod: "POD",
  inStock: "Stock",
};

function getWaitingItems(build) {
  const items = build.waitingItems || build.items || [];

  return items.filter((item) => item.path !== "inStock");
}

function getStockItems(build) {
  if (Array.isArray(build.stockItems)) {
    return build.stockItems;
  }

  return (build.items || []).filter((item) => item.path === "inStock");
}

function formatRoughDate(value) {
  if (!value) {
    return "";
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function findLinkedPO(item, linkedIds, records) {
  const linkedIdSet = new Set(Array.isArray(linkedIds) ? linkedIds : []);
  const itemPONumber = String(item?.poNumber || "").trim().toLowerCase();
  const itemVendor = String(item?.vendor || "").trim().toLowerCase();
  const linkedRecords = records.filter((record) => linkedIdSet.has(record.id));

  return (
    linkedRecords.find(
      (record) =>
        itemPONumber &&
        String(record.poNumber || "").trim().toLowerCase() === itemPONumber,
    ) ||
    linkedRecords.find(
      (record) =>
        itemVendor &&
        String(record.vendor || "").trim().toLowerCase() === itemVendor,
    ) ||
    linkedRecords[0]
  );
}

function getWaitingItemSchedule(
  item,
  build,
  supplierRuns,
  theirTruckPOs,
  podPickups,
) {
  if (item.path === "wePickup") {
    const linkedRun = findLinkedPO(
      item,
      build.linkedSouthRunIds,
      supplierRuns,
    );

    return {
      label: "Pickup",
      date: linkedRun?.pickupDate || linkedRun?.scheduledDate || item.routeDate,
    };
  }

  if (item.path === "supplierDelivery") {
    const linkedPO = findLinkedPO(
      item,
      build.linkedTheirTruckPOIds,
      theirTruckPOs,
    );

    return {
      label: "Arrives",
      date: linkedPO?.deliveryDate || item.supplierDate,
    };
  }

  if (item.path === "pod") {
    const linkedPickup = findLinkedPO(
      item,
      build.linkedPodPickupIds,
      podPickups,
    );

    return {
      label: "POD",
      date:
        linkedPickup?.podDate ||
        linkedPickup?.pickupDate ||
        item.supplierDate,
    };
  }

  return { label: "Expected", date: "" };
}

function formatArchivedDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isCompleteRecord(record) {
  const status = String(record?.status || "").toLowerCase();

  return (
    ["complete", "completed", "delivered", "received"].includes(status) ||
    Boolean(
      record?.completedAt ||
        record?.deliveredAt ||
        record?.delivered ||
        record?.pickedUpAt,
    )
  );
}

function isCompleteSouthRun(supplierRun) {
  if (isCompleteRecord(supplierRun)) {
    return true;
  }

  const items = Array.isArray(supplierRun?.items) ? supplierRun.items : [];

  return (
    items.length > 0 &&
    items.every(
      (item) =>
        item.pickedUp ||
        item.pickedUpAt ||
        item.pickupPhoto ||
        (Array.isArray(item.pickupPhotos) && item.pickupPhotos.length > 0),
    )
  );
}

function getLinkedPendingCount(linkedIds, records, isComplete, fallbackCount) {
  if (!Array.isArray(linkedIds) || linkedIds.length === 0) {
    return fallbackCount;
  }

  return linkedIds.filter((recordId) => {
    const record = records.find((candidate) => candidate.id === recordId);
    return !record || !isComplete(record);
  }).length;
}

function getOrderLifecycle(
  build,
  supplierRuns,
  theirTruckPOs,
  podPickups,
  deliveries,
) {
  if (isCompleteRecord(build)) {
    return {
      complete: true,
      label: "Complete",
      pendingCount: 0,
      completedAt: build.completedAt,
    };
  }

  const waitingItems = getWaitingItems(build);
  const southPending = getLinkedPendingCount(
    build.linkedSouthRunIds,
    supplierRuns,
    isCompleteSouthRun,
    waitingItems.filter((item) => item.path === "wePickup").length,
  );
  const supplierPending = getLinkedPendingCount(
    build.linkedTheirTruckPOIds,
    theirTruckPOs,
    isCompleteRecord,
    waitingItems.filter((item) => item.path === "supplierDelivery").length,
  );
  const podPending = getLinkedPendingCount(
    build.linkedPodPickupIds,
    podPickups,
    isCompleteRecord,
    waitingItems.filter((item) => item.path === "pod").length,
  );
  const materialPending = southPending + supplierPending + podPending;
  const linkedDelivery = deliveries.find(
    (delivery) => delivery.id === build.linkedDeliveryId,
  );
  const deliveryPending =
    build.handoffType === "delivery" &&
    (!linkedDelivery || !isCompleteRecord(linkedDelivery));
  const deliveryComplete =
    build.handoffType === "delivery" &&
    linkedDelivery &&
    isCompleteRecord(linkedDelivery);
  const podComplete = build.handoffType === "pod" && materialPending === 0;
  const complete = materialPending === 0 && (deliveryComplete || podComplete);

  if (complete) {
    return {
      complete: true,
      label: "Complete",
      pendingCount: 0,
      completedAt:
        linkedDelivery?.deliveredAt || linkedDelivery?.completedAt || "",
    };
  }

  if (materialPending > 0) {
    return {
      complete: false,
      label: `Waiting on ${materialPending} PO item${materialPending === 1 ? "" : "s"}`,
      pendingCount: materialPending,
      southPending,
      supplierPending,
      podPending,
    };
  }

  if (deliveryPending) {
    return {
      complete: false,
      label: "Ready for delivery",
      pendingCount: 1,
    };
  }

  return {
    complete: false,
    label: "Ready for pickup",
    pendingCount: 0,
    canMarkComplete: true,
  };
}

/**
 * @param {{
 *   builds?: Array<Record<string, any>>;
 *   deliveries?: Array<Record<string, any>>;
 *   podPickups?: Array<Record<string, any>>;
 *   supplierRuns?: Array<Record<string, any>>;
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   onArchiveOrder?: (orderBuildId: string) => Promise<void> | void;
 *   onCompleteOrder?: (orderBuildId: string) => Promise<void> | void;
 *   onDeleteOrder?: (orderBuildId: string) => Promise<void> | void;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function OrderBuildsPage({
  builds = [],
  deliveries = [],
  podPickups = [],
  supplierRuns = [],
  theirTruckPOs = [],
  onArchiveOrder,
  onCompleteOrder,
  onDeleteOrder,
  onPageChange,
}) {
  const [activeView, setActiveView] = useState("open");
  const lifecycleBuilds = builds.map((build) => ({
    build,
    lifecycle: getOrderLifecycle(
      build,
      supplierRuns,
      theirTruckPOs,
      podPickups,
      deliveries,
    ),
  }));
  const activeBuilds = lifecycleBuilds.filter(
    ({ build }) => !build.archived && build.status !== "archived",
  );
  const openBuilds = activeBuilds.filter(({ lifecycle }) => !lifecycle.complete);
  const completedBuilds = activeBuilds.filter(
    ({ lifecycle }) => lifecycle.complete,
  );
  const archivedBuilds = lifecycleBuilds.filter(
    ({ build }) => build.archived || build.status === "archived",
  );
  const visibleBuilds =
    activeView === "archived"
      ? archivedBuilds
      : activeView === "completed"
        ? completedBuilds
        : openBuilds;
  const isArchivedView = activeView === "archived";
  const isCompletedView = activeView === "completed";

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Orders", onClick: () => onPageChange?.("order-flow") },
          { label: "Open Orders" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Order Watch
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            {isArchivedView
              ? "Archived Orders"
              : isCompletedView
                ? "Completed Orders"
                : "Open Orders"}
          </h1>
          <p className="mt-2 max-w-2xl text-lg font-bold text-slate-500">
            {isArchivedView
              ? "Review orders that were removed from the active Open Orders list."
              : isCompletedView
                ? "Orders move here automatically when every PO and the final customer handoff are complete."
              : "See orders that still have POs waiting for South pickup, supplier delivery, customer pickup, or final delivery to the customer."}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white">
          {isArchivedView ? (
            <Archive className="h-4 w-4" aria-hidden="true" />
          ) : isCompletedView ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
          )}
          {visibleBuilds.length} orders
        </span>
      </div>

      <div className="mb-5 inline-flex w-full rounded-2xl border border-slate-200 bg-slate-100 p-1 sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveView("open")}
          className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-black transition sm:flex-none ${
            activeView === "open"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Open ({openBuilds.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveView("completed")}
          className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-black transition sm:flex-none ${
            isCompletedView
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Completed ({completedBuilds.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveView("archived")}
          className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-black transition sm:flex-none ${
            isArchivedView
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Archived ({archivedBuilds.length})
        </button>
      </div>

      <div className="grid gap-3">
        {visibleBuilds.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
            <Warehouse className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-xl font-black text-slate-950">
              {isArchivedView
                ? "No archived orders"
                : isCompletedView
                  ? "No completed orders yet"
                  : "No open orders yet"}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {isArchivedView
                ? "Orders archived with the protected action code will appear here."
                : isCompletedView
                  ? "Orders will move here when their PO and customer handoff workflow is finished."
                : "Create an order and its outstanding POs will appear here."}
            </p>
          </div>
        ) : (
          visibleBuilds.map(({ build, lifecycle }) => {
            const waitingItems = getWaitingItems(build);
            const stockItems = getStockItems(build);

            return (
              <article
                key={build.id}
                className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                      Order {build.orderNumber || "No order #"}
                    </p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                      {build.businessName || build.customerName || "No customer"}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {build.customerName || "No contact"}
                      {build.phoneNumber ? ` · ${build.phoneNumber}` : ""}
                    </p>
                    {isArchivedView ? (
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                        Archived {formatArchivedDate(build.archivedAt) || "previously"}
                        {build.archivedBy?.name
                          ? ` by ${build.archivedBy.name}`
                          : ""}
                      </p>
                    ) : null}
                    {isCompletedView ? (
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-600">
                        Completed {formatArchivedDate(lifecycle.completedAt) || "from linked workflow"}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <span
                      className={`rounded-2xl px-4 py-2 text-center text-sm font-black ${
                        lifecycle.complete
                          ? "bg-emerald-50 text-emerald-800"
                          : lifecycle.pendingCount > 0
                            ? "bg-amber-50 text-amber-800"
                            : "bg-blue-50 text-blue-800"
                      }`}
                    >
                      {lifecycle.label}
                    </span>
                    <span className="rounded-2xl bg-emerald-50 px-4 py-2 text-center text-sm font-black text-emerald-800">
                      {stockItems.length} stock
                    </span>
                    {!isArchivedView && lifecycle.canMarkComplete ? (
                      <button
                        type="button"
                        onClick={() => onCompleteOrder?.(build.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Mark Picked Up
                      </button>
                    ) : null}
                    {!isArchivedView ? (
                      <button
                        type="button"
                        onClick={() => onArchiveOrder?.(build.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                      >
                        <Archive className="h-4 w-4" aria-hidden="true" />
                        Archive
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onDeleteOrder?.(build.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-[#FC2C38] transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Truck className="h-5 w-5" aria-hidden="true" />
                      <p className="text-sm font-black uppercase tracking-[0.12em]">
                        {lifecycle.complete
                          ? "Fulfillment Complete"
                          : "Waiting On"}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {waitingItems.length === 0 ? (
                        <p className="text-sm font-bold text-slate-500">
                          No outside material paths on this order.
                        </p>
                      ) : (
                        waitingItems.map((item) => {
                          const schedule = getWaitingItemSchedule(
                            item,
                            build,
                            supplierRuns,
                            theirTruckPOs,
                            podPickups,
                          );
                          const roughDate = formatRoughDate(schedule.date);

                          return (
                            <div
                              key={item.id}
                              className="rounded-2xl bg-white px-4 py-3"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="font-black text-slate-950">
                                    {item.quantity
                                      ? `QTY ${item.quantity} · `
                                      : ""}
                                    {item.description || "Unnamed item"}
                                  </p>
                                  <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                                    {pathLabels[item.path] || "Outside"} ·{" "}
                                    {item.vendor || "No vendor"} · PO{" "}
                                    {item.poNumber || "not entered"}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-black ${
                                    roughDate
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  <CalendarDays
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  {roughDate
                                    ? `${schedule.label} ${roughDate}`
                                    : "Date not set"}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <PackageCheck className="h-5 w-5" aria-hidden="true" />
                      <p className="text-sm font-black uppercase tracking-[0.12em]">
                        Can Build From Stock
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {stockItems.length === 0 ? (
                        <p className="text-sm font-bold text-slate-500">
                          No stock items entered yet.
                        </p>
                      ) : (
                        stockItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl bg-white px-4 py-3"
                          >
                            <p className="font-black text-slate-950">
                              {item.quantity ? `QTY ${item.quantity} · ` : ""}
                              {item.description || "Unnamed item"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
