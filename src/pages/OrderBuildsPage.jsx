import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Edit3,
  Search,
  Save,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const pathLabels = {
  wePickup: "South pickup",
  supplierDelivery: "Their Truck",
  pod: "POD",
  inStock: "Stock",
};

function getBuildItems(build) {
  if (Array.isArray(build.items) && build.items.length > 0) {
    return build.items;
  }

  return [
    ...(Array.isArray(build.stockItems) ? build.stockItems : []),
    ...(Array.isArray(build.waitingItems) ? build.waitingItems : []),
  ];
}

function getItemDate(item, build) {
  return item.routeDate || item.supplierDate || build.deliveryDate || "";
}

function getItemBuildStatus(item) {
  const status = String(item.buildStatus || "").toLowerCase();

  if (["built", "complete", "staged"].includes(status)) {
    return "staged";
  }

  if (item.path === "inStock" || item.receivingStatus === "received") {
    return "ready";
  }

  return "waiting";
}

function getBuildMetrics(build) {
  const items = getBuildItems(build);
  const stagedItems = items.filter((item) => getItemBuildStatus(item) === "staged");
  const readyItems = items.filter((item) => getItemBuildStatus(item) === "ready");
  const waitingItems = items.filter((item) => getItemBuildStatus(item) === "waiting");
  const stockItems = items.filter((item) => item.path === "inStock");
  const southItems = items.filter((item) => item.path === "wePickup");
  const theirTruckItems = items.filter((item) => item.path === "supplierDelivery");
  const podItems = items.filter((item) => item.path === "pod");

  return {
    total: items.length,
    ready: readyItems.length,
    staged: stagedItems.length,
    waiting: waitingItems.length,
    stock: stockItems.length,
    south: southItems.length,
    theirTruck: theirTruckItems.length,
    pod: podItems.length,
  };
}

function getBuildReadinessLabel(metrics) {
  if (metrics.total === 0) {
    return "No items";
  }

  if (metrics.staged === metrics.total) {
    return "Complete";
  }

  if (metrics.waiting === 0) {
    return "Ready";
  }

  if (metrics.ready > 0 || metrics.staged > 0) {
    return "Partial";
  }

  return "Waiting";
}

function getBuildSections(build, itemQuery) {
  const query = itemQuery.trim().toLowerCase();
  const matchesQuery = (item) => {
    if (!query) {
      return true;
    }

    return [
      item.description,
      item.quantity,
      item.vendor,
      item.poNumber,
      item.orderNumber,
      pathLabels[item.path],
      item.buildNote,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  };

  const items = getBuildItems(build).filter(matchesQuery);

  return [
    {
      key: "ready",
      title: "Ready to Build",
      description: "Stock material and received PO items.",
      items: items.filter((item) => getItemBuildStatus(item) === "ready"),
      className: "border-emerald-100 bg-emerald-50/40",
      labelClassName: "bg-emerald-50 text-emerald-700",
    },
    {
      key: "south",
      title: "Waiting on South",
      description: "Items we are picking up from suppliers.",
      items: items.filter(
        (item) =>
          item.path === "wePickup" && getItemBuildStatus(item) === "waiting",
      ),
      className: "border-red-100 bg-red-50/40",
      labelClassName: "bg-red-50 text-red-700",
    },
    {
      key: "theirTruck",
      title: "Waiting on Their Truck",
      description: "Supplier-delivered material not checked in yet.",
      items: items.filter(
        (item) =>
          item.path === "supplierDelivery" &&
          getItemBuildStatus(item) === "waiting",
      ),
      className: "border-blue-100 bg-blue-50/40",
      labelClassName: "bg-blue-50 text-blue-700",
    },
    {
      key: "pod",
      title: "POD / Customer Pickup",
      description: "Customer is picking up material from the supplier.",
      items: items.filter(
        (item) => item.path === "pod" && getItemBuildStatus(item) === "waiting",
      ),
      className: "border-amber-100 bg-amber-50/40",
      labelClassName: "bg-amber-50 text-amber-700",
    },
    {
      key: "staged",
      title: "Completed / Staged",
      description: "Items already handled by the yard.",
      items: items.filter((item) => getItemBuildStatus(item) === "staged"),
      className: "border-slate-200 bg-slate-50",
      labelClassName: "bg-slate-100 text-slate-600",
    },
  ].filter((section) => section.items.length > 0 || section.key === "ready");
}

function normalizeBuildItems(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    ...item,
    id: String(item.id || `build-item-${index + 1}`),
    buildStatus: item.buildStatus || "waiting",
    buildNote: item.buildNote || "",
  }));
}

function BuildEditPanel({ build, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => ({
    buildStatus: build.buildStatus || build.status || "waiting",
    assignedTo: build.assignedTo || "",
    buildNotes: build.buildNotes || "",
    items: normalizeBuildItems(getBuildItems(build)),
  }));
  const [isSaving, setIsSaving] = useState(false);

  function updateField(field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function updateItem(itemId, field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: currentDraft.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      ),
    }));
  }

  async function saveBuild() {
    setIsSaving(true);
    try {
      const cleanItems = normalizeBuildItems(draft.items);

      await onSave?.({
        ...build,
        buildStatus: draft.buildStatus,
        status: draft.buildStatus,
        assignedTo: draft.assignedTo.trim(),
        buildNotes: draft.buildNotes.trim(),
        items: cleanItems,
        waitingItems: cleanItems.filter((item) => item.path !== "inStock"),
        stockItems: cleanItems.filter((item) => item.path === "inStock"),
      });
      onCancel?.();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 lg:grid-cols-[180px_220px_minmax(260px,1fr)]">
        <label className="grid gap-1 text-sm font-black text-slate-700">
          Build Status
          <select
            value={draft.buildStatus}
            onChange={(event) => updateField("buildStatus", event.target.value)}
            className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base font-black outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          >
            <option value="waiting">Waiting</option>
            <option value="ready">Ready to build</option>
            <option value="building">Building</option>
            <option value="complete">Complete</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-black text-slate-700">
          Assigned To
          <input
            value={draft.assignedTo}
            onChange={(event) => updateField("assignedTo", event.target.value)}
            className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base font-bold outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            placeholder="Optional"
          />
        </label>

        <label className="grid gap-1 text-sm font-black text-slate-700">
          Build Notes
          <input
            value={draft.buildNotes}
            onChange={(event) => updateField("buildNotes", event.target.value)}
            className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base font-bold outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            placeholder="Optional notes for the yard"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        {draft.items.map((item, index) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[48px_minmax(220px,1fr)_180px_minmax(180px,1fr)] lg:items-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-500">
              {index + 1}
            </span>
            <div>
              <p className="font-black text-slate-950">
                {item.quantity ? `QTY ${item.quantity} · ` : ""}
                {item.description || "Unnamed item"}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                {pathLabels[item.path] || "Material"}
                {item.vendor ? ` · ${item.vendor}` : ""}
                {item.poNumber ? ` · PO ${item.poNumber}` : ""}
              </p>
            </div>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Item Status
              <select
                value={item.buildStatus || "waiting"}
                onChange={(event) =>
                  updateItem(item.id, "buildStatus", event.target.value)
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black normal-case tracking-normal text-slate-900 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              >
                <option value="waiting">Waiting</option>
                <option value="ready">Ready</option>
                <option value="built">Built</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Item Note
              <input
                value={item.buildNote || ""}
                onChange={(event) =>
                  updateItem(item.id, "buildNote", event.target.value)
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                placeholder="Optional"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          onClick={saveBuild}
          disabled={isSaving}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Saving..." : "Save Build"}
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   builds?: Array<Record<string, any>>;
 *   onSaveBuild?: (build: Record<string, any>) => Promise<void> | void;
 *   onRemoveBuild?: (build: Record<string, any>) => Promise<void> | void;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function OrderBuildsPage({
  builds = [],
  onSaveBuild,
  onRemoveBuild,
  onPageChange,
}) {
  const [editingBuildId, setEditingBuildId] = useState("");
  const [openBuildId, setOpenBuildId] = useState("");
  const [itemSearchByBuildId, setItemSearchByBuildId] = useState({});
  const visibleBuilds = builds.filter(
    (build) => String(build.status || "").toLowerCase() !== "removed",
  );

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "New Home", onClick: () => onPageChange?.("new-home") },
          { label: "Build" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Build Watch
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Orders Waiting on Material
          </h1>
          <p className="mt-2 max-w-2xl text-lg font-bold text-slate-500">
            Scan each order, see what can be built now, and open the full item
            list only when the yard needs the detail.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          {visibleBuilds.length} orders
        </span>
      </div>

      <div className="grid gap-3">
        {visibleBuilds.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
            <Warehouse className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-xl font-black text-slate-950">
              No builds tracked yet
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Process an order in New Home and it will appear here.
            </p>
          </div>
        ) : (
          visibleBuilds.map((build) => {
            const metrics = getBuildMetrics(build);
            const readinessLabel = getBuildReadinessLabel(metrics);
            const isEditing = editingBuildId === build.id;
            const isOpen = openBuildId === build.id;
            const itemQuery = itemSearchByBuildId[build.id] || "";
            const sections = getBuildSections(build, itemQuery);
            const shownItemCount = sections.reduce(
              (total, section) => total + section.items.length,
              0,
            );
            const readyPercent =
              metrics.total > 0
                ? Math.round(((metrics.ready + metrics.staged) / metrics.total) * 100)
                : 0;

            return (
              <article
                key={build.id}
                className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(320px,1.2fr)_minmax(320px,1fr)_auto] xl:items-center">
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
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        {readinessLabel}
                      </span>
                      <span className="text-xs font-black text-slate-500">
                        {readyPercent}% ready
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${readyPercent}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <span className="rounded-2xl bg-emerald-50 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-emerald-800">
                        {metrics.ready} ready
                      </span>
                      <span className="rounded-2xl bg-slate-100 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                        {metrics.staged} staged
                      </span>
                      <span className="rounded-2xl bg-amber-50 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-amber-800">
                        {metrics.waiting} waiting
                      </span>
                      <span className="rounded-2xl bg-blue-50 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                        {metrics.total} total
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenBuildId((currentId) =>
                          currentId === build.id ? "" : build.id,
                        )
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm"
                    >
                      {isOpen ? "Close Build" : "Open Build"}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingBuildId((currentId) =>
                          currentId === build.id ? "" : build.id,
                        )
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 shadow-sm"
                    >
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                      {isEditing ? "Close Edit" : "Edit Build"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  {build.assignedTo ? (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                      {build.assignedTo}
                    </span>
                  ) : null}
                  {build.buildNotes ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-700">
                      Notes
                    </span>
                  ) : null}
                  {metrics.stock > 0 ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                      {metrics.stock} stock
                    </span>
                  ) : null}
                  {metrics.south > 0 ? (
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-700">
                      {metrics.south} south
                    </span>
                  ) : null}
                  {metrics.theirTruck > 0 ? (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                      {metrics.theirTruck} their truck
                    </span>
                  ) : null}
                  {metrics.pod > 0 ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-700">
                      {metrics.pod} POD
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    {(build.buildStatus || build.status || "waiting").replace(/([A-Z])/g, " $1")}
                  </span>
                </div>

                {isEditing ? (
                  <BuildEditPanel
                    build={build}
                    onCancel={() => setEditingBuildId("")}
                    onSave={onSaveBuild}
                  />
                ) : null}

                {isOpen ? (
                  <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 sm:p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto] lg:items-center">
                      <label className="relative block">
                        <Search
                          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          value={itemQuery}
                          onChange={(event) =>
                            setItemSearchByBuildId((currentSearches) => ({
                              ...currentSearches,
                              [build.id]: event.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-base font-bold text-slate-900 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                          placeholder="Search item, PO, vendor, or status..."
                        />
                      </label>
                      <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm">
                        {shownItemCount} shown
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Remove this build from Build Watch? The order will stay in Order History/Queue.",
                            )
                          ) {
                            onRemoveBuild?.(build);
                          }
                        }}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-600 shadow-sm"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remove Build
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {sections.map((section) => (
                        <section
                          key={section.key}
                          className={`rounded-3xl border p-4 ${section.className}`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-lg font-black text-slate-950">
                                {section.title}
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-500">
                                {section.description}
                              </p>
                            </div>
                            <span
                              className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${section.labelClassName}`}
                            >
                              {section.items.length} items
                            </span>
                          </div>

                          {section.items.length === 0 ? (
                            <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-400">
                              Nothing ready in this group yet.
                            </p>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {section.items.map((item) => {
                                const itemStatus = getItemBuildStatus(item);

                                return (
                                  <div
                                    key={item.id}
                                    className="grid gap-3 rounded-2xl bg-white px-4 py-3 text-slate-950 shadow-sm lg:grid-cols-[minmax(260px,1fr)_minmax(180px,280px)_auto] lg:items-center"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-black">
                                        {item.quantity ? `QTY ${item.quantity} · ` : ""}
                                        {item.description || "Unnamed item"}
                                      </p>
                                      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                                        {pathLabels[item.path] || "Material"}
                                        {item.vendor ? ` · ${item.vendor}` : ""}
                                        {item.poNumber ? ` · PO ${item.poNumber}` : ""}
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {getItemDate(item, build) ? (
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                                          Needed {getItemDate(item, build)}
                                        </span>
                                      ) : null}
                                      {item.receivedLocation ? (
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">
                                          {item.receivedLocation}
                                        </span>
                                      ) : null}
                                      {Number(item.receivedPhotosCount || 0) > 0 ? (
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">
                                          {item.receivedPhotosCount} photo
                                          {Number(item.receivedPhotosCount || 0) === 1 ? "" : "s"}
                                        </span>
                                      ) : null}
                                      {item.buildNote ? (
                                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">
                                          Note
                                        </span>
                                      ) : null}
                                    </div>

                                    <span
                                      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                                        itemStatus === "staged"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : itemStatus === "ready"
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-amber-50 text-amber-700"
                                      }`}
                                    >
                                      {itemStatus === "staged" ? (
                                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      ) : null}
                                      {itemStatus === "staged"
                                        ? "Staged"
                                        : itemStatus === "ready"
                                          ? "Ready"
                                          : "Waiting"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
