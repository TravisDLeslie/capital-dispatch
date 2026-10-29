import { useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Pencil,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import AddressAutocompleteInput from "../components/AddressAutocompleteInput";

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

function formatOrderNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 6);

  return digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
}

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function createEditDraft(build, deliveries) {
  const linkedDelivery = deliveries.find(
    (delivery) => delivery.id === build.linkedDeliveryId,
  );

  return {
    id: build.id,
    orderNumber: build.orderNumber || "",
    customerName: build.customerName || "",
    businessName: build.businessName || "",
    phoneNumber: build.phoneNumber || "",
    handoffType: build.handoffType || "willCall",
    deliveryDate: build.deliveryDate || linkedDelivery?.deliveryDate || "",
    deliveryAddress: build.deliveryAddress || linkedDelivery?.address || "",
    waitingItems: getWaitingItems(build).map((item) => ({ ...item })),
    stockItems: getStockItems(build).map((item) => ({ ...item })),
  };
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
 *   vendorOptions?: string[];
 *   supplierAddressMap?: Record<string, string>;
 *   onArchiveOrder?: (orderBuildId: string) => Promise<void> | void;
 *   onCompleteOrder?: (orderBuildId: string) => Promise<void> | void;
 *   onDeleteOrder?: (orderBuildId: string) => Promise<void> | void;
 *   onUpdateOrder?: (orderBuildId: string, updates: Record<string, any>) => Promise<void> | void;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function OrderBuildsPage({
  builds = [],
  deliveries = [],
  podPickups = [],
  supplierRuns = [],
  theirTruckPOs = [],
  vendorOptions = [],
  supplierAddressMap = {},
  onArchiveOrder,
  onCompleteOrder,
  onDeleteOrder,
  onUpdateOrder,
  onPageChange,
}) {
  const [activeView, setActiveView] = useState("open");
  const [editDraft, setEditDraft] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
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

  function openEditor(build) {
    setEditDraft(createEditDraft(build, deliveries));
    setEditError("");
  }

  function updateDraftItem(section, itemIndex, field, value) {
    setEditDraft((currentDraft) => ({
      ...currentDraft,
      [section]: currentDraft[section].map((item, index) =>
        index === itemIndex ? { ...item, [field]: value } : item,
      ),
    }));
  }

  async function saveEdit(event) {
    event.preventDefault();

    if (!editDraft) return;
    if (!String(editDraft.orderNumber || "").trim()) {
      setEditError("Enter the order number before saving.");
      return;
    }

    setIsSavingEdit(true);
    setEditError("");

    try {
      await onUpdateOrder?.(editDraft.id, editDraft);
      setEditDraft(null);
    } catch (error) {
      console.error("Unable to update open order:", error);
      setEditError(error?.message || "Unable to save the order changes.");
    } finally {
      setIsSavingEdit(false);
    }
  }

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
                    {!isArchivedView && !isCompletedView ? (
                      <button
                        type="button"
                        onClick={() => openEditor(build)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit
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

      {editDraft ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-open-order-title"
        >
          <form
            onSubmit={saveEdit}
            className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Open Order
                </p>
                <h2 id="edit-open-order-title" className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                  Edit order details
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Updates also carry into the linked pickup, PO, and delivery records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="rounded-2xl border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                aria-label="Close edit order"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-7">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Order #
                  <input
                    value={editDraft.orderNumber}
                    onChange={(event) =>
                      setEditDraft((draft) => ({
                        ...draft,
                        orderNumber: formatOrderNumber(event.target.value),
                      }))
                    }
                    placeholder="027-000"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-black normal-case tracking-normal text-slate-950 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Business / job
                  <input
                    value={editDraft.businessName}
                    onChange={(event) =>
                      setEditDraft((draft) => ({ ...draft, businessName: event.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Customer / contact
                  <input
                    value={editDraft.customerName}
                    onChange={(event) =>
                      setEditDraft((draft) => ({ ...draft, customerName: event.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Phone
                  <input
                    value={editDraft.phoneNumber}
                    onChange={(event) =>
                      setEditDraft((draft) => ({
                        ...draft,
                        phoneNumber: formatPhoneNumber(event.target.value),
                      }))
                    }
                    placeholder="(208) 284-6163"
                    inputMode="tel"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </label>
              </div>

              {editDraft.handoffType === "delivery" ? (
                <div className="mt-4 grid gap-4 rounded-3xl border border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-[1fr_12rem]">
                  <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                    Delivery address
                    <AddressAutocompleteInput
                      id="edit-open-order-delivery-address"
                      value={editDraft.deliveryAddress}
                      onChange={(deliveryAddress) =>
                        setEditDraft((draft) => ({ ...draft, deliveryAddress }))
                      }
                      autoComplete="off"
                      enableLocalFallback
                      showStatus={false}
                      placeholder="Start typing the delivery address..."
                      className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-base font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                    Delivery date
                    <input
                      type="date"
                      value={editDraft.deliveryDate}
                      onChange={(event) =>
                        setEditDraft((draft) => ({ ...draft, deliveryDate: event.target.value }))
                      }
                      className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-base font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-blue-500"
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Outside material</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">PO items</h3>
                  </div>
                  <p className="text-xs font-bold text-slate-500">Fulfillment paths stay fixed while editing.</p>
                </div>
                <div className="mt-3 grid gap-3">
                  {editDraft.waitingItems.map((item, itemIndex) => {
                    const dateField = item.path === "wePickup" ? "routeDate" : "supplierDate";

                    return (
                      <div key={item.id || itemIndex} className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-amber-800">
                            {pathLabels[item.path] || "Outside"}
                          </span>
                          <span className="text-xs font-black text-slate-400">Item {itemIndex + 1}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
                          <input
                            value={item.quantity || ""}
                            onChange={(event) => updateDraftItem("waitingItems", itemIndex, "quantity", event.target.value)}
                            placeholder="Qty"
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-blue-500"
                          />
                          <input
                            value={item.description || ""}
                            onChange={(event) => updateDraftItem("waitingItems", itemIndex, "description", event.target.value)}
                            placeholder="Item description"
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <select
                            value={item.vendor || ""}
                            onChange={(event) => {
                              const vendor = event.target.value;
                              setEditDraft((currentDraft) => ({
                                ...currentDraft,
                                waitingItems: currentDraft.waitingItems.map(
                                  (currentItem, index) =>
                                    index === itemIndex
                                      ? {
                                          ...currentItem,
                                          vendor,
                                          supplierAddress:
                                            supplierAddressMap[vendor] || "",
                                        }
                                      : currentItem,
                                ),
                              }));
                            }}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-blue-500"
                          >
                            <option value="">Select vendor</option>
                            {item.vendor &&
                            !vendorOptions.some(
                              (vendorName) =>
                                vendorName.toLowerCase() === item.vendor.toLowerCase(),
                            ) ? (
                              <option value={item.vendor}>{item.vendor}</option>
                            ) : null}
                            {vendorOptions.map((vendorName) => (
                              <option key={vendorName} value={vendorName}>
                                {vendorName}
                              </option>
                            ))}
                          </select>
                          <input
                            value={item.poNumber || ""}
                            onChange={(event) => updateDraftItem("waitingItems", itemIndex, "poNumber", formatOrderNumber(event.target.value))}
                            placeholder="PO #"
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-blue-500"
                          />
                          <input
                            type="date"
                            value={item[dateField] || ""}
                            onChange={(event) => updateDraftItem("waitingItems", itemIndex, dateField, event.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {editDraft.stockItems.length > 0 ? (
                <div className="mt-6">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">From stock</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Stock items</h3>
                  <div className="mt-3 grid gap-3">
                    {editDraft.stockItems.map((item, itemIndex) => (
                      <div key={item.id || itemIndex} className="grid gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4 sm:grid-cols-[7rem_1fr]">
                        <input
                          value={item.quantity || ""}
                          onChange={(event) => updateDraftItem("stockItems", itemIndex, "quantity", event.target.value)}
                          placeholder="Qty"
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-blue-500"
                        />
                        <input
                          value={item.description || ""}
                          onChange={(event) => updateDraftItem("stockItems", itemIndex, "description", event.target.value)}
                          placeholder="Item description"
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {editError ? (
                <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">{editError}</p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="rounded-2xl bg-[#FC2C38] px-6 py-3 font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-wait disabled:opacity-60"
              >
                {isSavingEdit ? "Saving changes…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageContainer>
  );
}
