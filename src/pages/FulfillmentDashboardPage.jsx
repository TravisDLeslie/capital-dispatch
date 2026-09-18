import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Package,
  PackageCheck,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const pathMeta = {
  wePickup: {
    key: "wePickup",
    title: "South",
    subtitle: "Items we are picking up from suppliers.",
    badge: "South",
    dateLabel: "Pickup",
    icon: Truck,
    tone: "border-blue-200 bg-blue-50 text-blue-700",
    softTone: "bg-blue-50 text-blue-700",
    actionLabel: "Open South",
    actionPage: "new-fulfillment-south",
  },
  supplierDelivery: {
    key: "supplierDelivery",
    title: "Their Truck",
    subtitle: "Items coming to us on a supplier truck.",
    badge: "Supplier",
    dateLabel: "Delivery",
    icon: Package,
    tone: "border-red-200 bg-red-50 text-[#FC2C38]",
    softTone: "bg-red-50 text-[#FC2C38]",
    actionLabel: "Open Their Truck",
    actionPage: "new-fulfillment-their-truck",
  },
  pod: {
    key: "pod",
    title: "POD",
    subtitle: "Customer pickups from a supplier.",
    badge: "POD",
    dateLabel: "Expected",
    icon: ShoppingBag,
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    softTone: "bg-amber-50 text-amber-700",
    actionLabel: "Open POD",
    actionPage: "new-fulfillment-pod",
  },
  receiving: {
    key: "receiving",
    title: "Receiving",
    subtitle: "All incoming order material to search before check-in.",
    badge: "Inbound",
    dateLabel: "Expected",
    icon: PackageCheck,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    softTone: "bg-emerald-50 text-emerald-700",
    actionLabel: "Open Receiving",
    actionPage: "new-fulfillment-receiving",
  },
};

const sectionOrder = ["wePickup", "supplierDelivery", "pod", "receiving"];
const pageSectionByKey = {
  south: "wePickup",
  "their-truck": "supplierDelivery",
  pod: "pod",
  receiving: "receiving",
};

function getBuildItems(build) {
  if (Array.isArray(build.items) && build.items.length > 0) {
    return build.items;
  }

  return [
    ...(Array.isArray(build.waitingItems) ? build.waitingItems : []),
    ...(Array.isArray(build.stockItems) ? build.stockItems : []),
  ];
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getItemCheckInKey(poNumber, itemId) {
  return `${normalizeSearch(poNumber)}:${String(itemId || "")}`;
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getPoRouteLabel(pathId) {
  if (pathId === "wePickup") {
    return "South PO";
  }

  if (pathId === "supplierDelivery") {
    return "Their Truck PO";
  }

  if (pathId === "pod") {
    return "POD PO";
  }

  return "PO";
}

function getItemDate(item, order, build) {
  return (
    item.routeDate ||
    item.supplierDate ||
    item.expectedDate ||
    order?.expectedDate ||
    order?.deliveryDate ||
    build?.deliveryDate ||
    ""
  );
}

function getCustomerName(order, build) {
  return (
    order?.customerName ||
    order?.customer ||
    build?.customerName ||
    build?.customer ||
    "No customer"
  );
}

function normalizeFulfillmentPath(value, fallback = "") {
  const path = String(value || "").trim();

  if (["wePickup", "south", "pickup"].includes(path)) {
    return "wePickup";
  }

  if (["supplierDelivery", "theirTruck", "their-truck"].includes(path)) {
    return "supplierDelivery";
  }

  if (path === "pod") {
    return "pod";
  }

  if (path === "inStock") {
    return "inStock";
  }

  return fallback;
}

function createRows(builds, orders) {
  const ordersById = new Map(
    orders.map((order) => [String(order.id || ""), order]),
  );

  return builds.flatMap((build) => {
    const order = ordersById.get(String(build.orderId || "")) || {};
    const items = getBuildItems(build);

    return items.map((item, index) => ({
      id: `${build.id || build.orderId || "build"}-${item.id || index}`,
      sourceItemId: item.id || "",
      path: normalizeFulfillmentPath(item.path),
      quantity: item.quantity || "",
      description: item.description || "Unnamed item",
      sku:
        item.sku ||
        item.itemNumber ||
        item.stockNumber ||
        item.soNumber ||
        "",
      vendor: item.vendor || build.vendor || "",
      poNumber: item.poNumber || "",
      orderNumber: order.orderNumber || build.orderNumber || "",
      customerName: getCustomerName(order, build),
      businessName: order.businessName || build.businessName || "",
      date: getItemDate(item, order, build),
      buildId: build.id || "",
      orderId: order.id || build.orderId || "",
      status: item.buildStatus || build.buildStatus || build.status || "",
    }));
  });
}

function createStandalonePurchaseOrderRows(supplierRuns, theirTruckPOs) {
  const southRows = (Array.isArray(supplierRuns) ? supplierRuns : [])
    .filter((run) => run?.stockPurchaseOrder || run?.sourceType === "stock-purchase-order")
    .flatMap((run) => {
      const items = Array.isArray(run.items) ? run.items : [];

      return items.map((item, index) => ({
        id: `${run.id || "south"}-${item.id || index}`,
        sourceItemId: item.id || "",
        path: "wePickup",
        quantity: item.quantity || "",
        description: item.description || "Unnamed item",
        sku:
          item.sku ||
          item.itemNumber ||
          item.internalReference ||
          item.stockNumber ||
          "",
        vendor: run.vendor || run.supplier || "",
        poNumber: run.poNumber || "",
        orderNumber: "",
        customerName: "Stock",
        businessName: "Inventory",
        date: run.pickupDate || run.scheduledDate || "",
        buildId: "",
        orderId: "",
        status: item.pickedUp ? "Picked up" : run.dispatchStatus || run.status || "Waiting",
      }));
    });
  const supplierDeliveryRows = (Array.isArray(theirTruckPOs) ? theirTruckPOs : [])
    .filter((po) => po?.stockPurchaseOrder || po?.sourceType === "stock-purchase-order")
    .flatMap((po) => {
      const items = Array.isArray(po.items) ? po.items : [];

      return items.map((item, index) => ({
        id: `${po.id || "their-truck"}-${item.id || index}`,
        sourceItemId: item.id || "",
        path: "supplierDelivery",
        quantity: item.quantity || "",
        description: item.description || "Unnamed item",
        sku:
          item.sku ||
          item.itemNumber ||
          item.internalReference ||
          item.stockNumber ||
          "",
        vendor: po.vendor || "",
        poNumber: po.poNumber || "",
        orderNumber: "",
        customerName: "Stock",
        businessName: "Inventory",
        date: po.deliveryDate || "",
        buildId: "",
        orderId: "",
        status: po.status || "Scheduled",
      }));
    });

  return [...southRows, ...supplierDeliveryRows];
}

function rowSearchBlob(row) {
  return [
    row.quantity,
    row.description,
    row.vendor,
    row.poNumber,
    row.orderNumber,
    row.customerName,
    row.businessName,
    row.status,
    row.date,
  ].join(" ");
}

function getAccentClasses(sectionKey) {
  if (sectionKey === "wePickup") {
    return {
      rail: "border-l-blue-500",
      pill: "bg-blue-50 text-blue-700",
      button: "bg-blue-600 text-white hover:bg-blue-700",
      dot: "bg-blue-500",
    };
  }

  return {
    rail: "border-l-[#FC2C38]",
    pill: "bg-red-50 text-[#FC2C38]",
    button: "bg-[#FC2C38] text-white hover:bg-red-600",
    dot: "bg-emerald-400",
  };
}

function FulfillmentPurchaseOrderCard({ sectionKey, group, onCheckInPO }) {
  const meta = pathMeta[sectionKey];
  const firstRow = group.rows[0] || {};
  const accent = getAccentClasses(sectionKey);
  const checkedCount = group.rows.filter(
    (row) => row.receivingStatus === "Checked in",
  ).length;
  const allCheckedIn = checkedCount > 0 && checkedCount === group.rows.length;
  const customerLabel =
    firstRow.businessName && firstRow.customerName
      ? firstRow.businessName
      : firstRow.customerName || firstRow.businessName || "Stock";
  const contactLabel =
    firstRow.businessName && firstRow.customerName
      ? firstRow.customerName
      : firstRow.businessName || "";

  return (
    <article
      className={`overflow-hidden rounded-[1.75rem] border border-l-4 border-slate-200 ${accent.rail} bg-white p-4 shadow-sm sm:p-5`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(8rem,0.45fr)_minmax(20rem,1fr)_minmax(12rem,0.45fr)] lg:items-start">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
            Vendor
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {group.vendor}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                Purchase Order
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                {group.poNumber ? `PO ${group.poNumber}` : "PO not set"}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${accent.pill}`}>
              {meta.title}
            </span>
          </div>

          {group.orderNumber ? (
            <p className="mt-1 text-base font-bold text-slate-500">
              Customer order {group.orderNumber}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3">
            {group.rows.slice(0, 2).map((row) => (
              <div key={row.id} className="min-w-0">
                <p className="truncate text-lg font-black text-slate-950">
                  {row.quantity ? `${row.quantity} x ` : ""}
                  {row.description}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${allCheckedIn ? "bg-emerald-500" : accent.dot}`} />
                  <span>{row.receivingStatus}</span>
                  {row.sku ? <span>Item # {row.sku}</span> : null}
                </div>
              </div>
            ))}
            {group.rows.length > 2 ? (
              <p className="text-sm font-black text-slate-500">
                + {group.rows.length - 2} more items
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end lg:text-right">
          <span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${accent.pill}`}>
            {meta.dateLabel} {formatDate(group.date)}
          </span>

          <div className="min-w-0">
            <p className="truncate text-lg font-black text-slate-950">
              {customerLabel}
            </p>
            {contactLabel ? (
              <p className="truncate text-sm font-bold text-slate-500">
                {contactLabel}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onCheckInPO?.(group)}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black shadow-sm transition ${accent.button}`}
          >
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            {allCheckedIn ? "Review Check-In" : "Check In Item"}
          </button>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            {checkedCount}/{group.rows.length} checked in
          </span>
        </div>
      </div>
    </article>
  );
}

function FulfillmentSection({
  sectionKey,
  rows,
  onPageChange,
  onCheckInPO,
  isExpanded,
  onToggle,
}) {
  const meta = pathMeta[sectionKey];
  const Icon = meta.icon;
  const groupedRows = useMemo(() => {
    const groups = new Map();

    rows.forEach((row) => {
      const groupKey = `${row.vendor || "No vendor"}|${row.poNumber || row.orderNumber || row.id}`;
      const existing = groups.get(groupKey) || {
        vendor: row.vendor || "No vendor",
        poNumber: row.poNumber,
        orderNumber: row.orderNumber,
        date: row.date,
        path: row.path,
        rows: [],
      };

      existing.rows.push(row);
      groups.set(groupKey, existing);
    });

    return Array.from(groups.values()).sort((left, right) => {
      const leftDate = String(left.date || "");
      const rightDate = String(right.date || "");

      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate);
      }

      return String(left.vendor || "").localeCompare(String(right.vendor || ""));
    });
  }, [rows]);

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={isExpanded}
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${meta.tone}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                {meta.badge}
              </p>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </div>
            <h2 className="text-2xl font-black text-slate-950">{meta.title}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{meta.subtitle}</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </span>
          <button
            type="button"
            onClick={() => onPageChange?.(meta.actionPage)}
            className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
          >
            {meta.actionLabel}
          </button>
        </div>
      </div>

      {!isExpanded ? null : rows.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
          Nothing currently routed here from the new order flow.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {groupedRows.map((group) => (
            sectionKey === "wePickup" || sectionKey === "supplierDelivery" ? (
              <FulfillmentPurchaseOrderCard
                key={`${sectionKey}-${group.vendor}-${group.poNumber}-${group.orderNumber}`}
                sectionKey={sectionKey}
                group={group}
          onCheckInPO={onCheckInPO}
              />
            ) : (
            <div
              key={`${sectionKey}-${group.vendor}-${group.poNumber}-${group.orderNumber}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
            >
              {(() => {
                const sourceMeta =
                  sectionKey === "receiving"
                    ? pathMeta[group.path] || meta
                    : meta;

                return (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black text-slate-950">
                      {group.vendor}
                    </p>
                    {sectionKey === "receiving" ? (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${sourceMeta.softTone}`}>
                        {sourceMeta.title}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {group.poNumber
                      ? `${getPoRouteLabel(group.path)} ${group.poNumber}`
                      : `No ${getPoRouteLabel(group.path)} yet`}
                    {group.orderNumber ? ` · Order ${group.orderNumber}` : ""}
                  </p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${sourceMeta.softTone}`}>
                  {sourceMeta.dateLabel} {formatDate(group.date)}
                </span>
              </div>
                );
              })()}

              {sectionKey === "receiving" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onCheckInPO?.(group, {
                        mode: group.rows.some(
                          (row) => row.receivingStatus === "Checked in",
                        )
                          ? "updateLocation"
                          : "checkIn",
                      })
                    }
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white shadow-sm ${
                      group.rows.some((row) => row.receivingStatus === "Checked in")
                        ? "bg-blue-700 hover:bg-blue-800"
                        : "bg-emerald-700 hover:bg-emerald-800"
                    }`}
		                  >
	                    <PackageCheck className="h-4 w-4" aria-hidden="true" />
	                    {group.rows.some((row) => row.receivingStatus === "Checked in")
	                      ? "Update/Edit PO"
	                      : "Check In PO"}
	                  </button>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    {group.rows.filter((row) => row.receivingStatus === "Checked in").length}/
                    {group.rows.length} checked in
                  </span>
                </div>
              ) : null}

              <div className="mt-3 grid gap-2">
                {group.rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-2 rounded-xl border border-white bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.35fr)] sm:items-center"
                  >
                    <div>
                      <p className="font-black text-slate-950">
                        {row.quantity ? `QTY ${row.quantity} · ` : ""}
                        {row.description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                          {row.status || "Waiting"}
                        </p>
                        {sectionKey === "receiving" ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${
                              row.receivingStatus === "Checked in"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {row.receivingStatus === "Checked in" ? (
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : null}
                            {row.receivingStatus}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-500 sm:text-right">
                      <p>{row.customerName}</p>
                      {row.businessName ? <p>{row.businessName}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          ))}
        </div>
      )}
    </section>
  );
}

export default function FulfillmentDashboardPage({
  orders = [],
  builds = [],
  supplierRuns = [],
  theirTruckPOs = [],
  checkIns = [],
  initialSection = "",
  onPageChange,
  onCheckInPO,
}) {
  const focusedSection = pageSectionByKey[initialSection] || "";
  const activeSectionOrder = focusedSection ? [focusedSection] : sectionOrder;
  const [searchTerm, setSearchTerm] = useState("");
  const [openSections, setOpenSections] = useState(() => ({
    wePickup: true,
    supplierDelivery: false,
    pod: false,
    receiving: false,
  }));
  const fallbackCheckedInPoNumbers = useMemo(() => {
    const poNumbers = new Set();

    checkIns.forEach((checkIn) => {
      const materials = Array.isArray(checkIn?.materials)
        ? checkIn.materials
        : [];
      const hasSourceItemIds = materials.some(
        (material) => material?.sourceItemId,
      );

      if (!hasSourceItemIds) {
        const normalizedPoNumber = normalizeSearch(checkIn?.poNumber);

        if (normalizedPoNumber) {
          poNumbers.add(normalizedPoNumber);
        }
      }
    });

    return poNumbers;
  }, [checkIns]);
  const checkedInItemDetailsByKey = useMemo(() => {
    const itemDetails = new Map();

    checkIns.forEach((checkIn) => {
      const poNumber = checkIn?.poNumber;
      const materials = Array.isArray(checkIn?.materials)
        ? checkIn.materials
        : [];

      materials.forEach((material) => {
        if (material?.sourceItemId) {
          itemDetails.set(getItemCheckInKey(poNumber, material.sourceItemId), {
            location: material.location || "",
            locationPhoto: material.locationPhoto || null,
            locationPhotos: Array.isArray(material.locationPhotos)
              ? material.locationPhotos.filter(Boolean)
              : material.locationPhoto
                ? [material.locationPhoto]
                : [],
            locationHistory: Array.isArray(material.locationHistory)
              ? material.locationHistory
              : [],
            notes: material.notes || "",
            conditionGood: material.conditionGood !== false,
            damagePhoto: material.damagePhoto || null,
            damagePhotos: Array.isArray(material.damagePhotos)
              ? material.damagePhotos.filter(Boolean)
              : material.damagePhoto
                ? [material.damagePhoto]
                : [],
            savedAt: material.savedAt || checkIn.checkedInAt || checkIn.createdAt || "",
          });
        }
      });
    });

    return itemDetails;
  }, [checkIns]);
  const rows = useMemo(
    () =>
      [
        ...createRows(builds, orders),
        ...createStandalonePurchaseOrderRows(supplierRuns, theirTruckPOs),
      ].map((row) => {
        const checkedInMaterial =
          row.sourceItemId
            ? checkedInItemDetailsByKey.get(
                getItemCheckInKey(row.poNumber, row.sourceItemId),
              )
            : null;
        const itemCheckedIn = Boolean(checkedInMaterial);
        const poCheckedIn =
          row.poNumber &&
          fallbackCheckedInPoNumbers.has(normalizeSearch(row.poNumber));

        return {
          ...row,
          ...(checkedInMaterial || {}),
          receivingStatus: itemCheckedIn || poCheckedIn ? "Checked in" : "Needs check-in",
        };
      }),
    [
      builds,
      checkedInItemDetailsByKey,
      fallbackCheckedInPoNumbers,
      orders,
      supplierRuns,
      theirTruckPOs,
    ],
  );
  const incomingRows = rows.filter((row) =>
    ["wePickup", "supplierDelivery", "pod"].includes(row.path),
  );
  const normalizedSearch = normalizeSearch(searchTerm);
  const filteredRows = rows.filter((row) => {
    if (!normalizedSearch) {
      return true;
    }

    return normalizeSearch(rowSearchBlob(row)).includes(normalizedSearch);
  });
  const filteredIncomingRows = incomingRows.filter((row) => {
    if (!normalizedSearch) {
      return true;
    }

    return normalizeSearch(rowSearchBlob(row)).includes(normalizedSearch);
  });
  const rowsBySection = {
    wePickup: filteredRows.filter((row) => row.path === "wePickup"),
    supplierDelivery: filteredRows.filter(
      (row) => row.path === "supplierDelivery",
    ),
    pod: filteredRows.filter((row) => row.path === "pod"),
    receiving: filteredIncomingRows,
  };
  const visibleOpenSections = normalizedSearch
    ? sectionOrder.reduce(
        (sections, sectionKey) => ({
          ...sections,
          [sectionKey]: rowsBySection[sectionKey].length > 0,
        }),
        {},
      )
    : focusedSection
      ? { [focusedSection]: true }
    : openSections;

  function toggleSection(sectionKey) {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [sectionKey]: !currentSections[sectionKey],
    }));
  }

  function handleCheckInGroup(group, options = {}) {
    const firstRow = group.rows[0] || {};
    const sourcePath = group.path || firstRow.path || "";
    const isUpdateLocationMode = options.mode === "updateLocation";

    onCheckInPO?.({
      id: `${group.poNumber || group.orderNumber || firstRow.id}-${group.vendor}`,
      sourceType: "newOrderFlow",
      path: sourcePath,
      sourcePath,
      receivingTruckType: sourcePath === "wePickup" ? "ourTruck" : "theirTruck",
      mode: options.mode || "checkIn",
      startStep: isUpdateLocationMode ? 2 : 1,
      focus: isUpdateLocationMode ? "location" : "",
      poNumber: group.poNumber || "",
      vendor: group.vendor || "",
      orderNumber: group.orderNumber || firstRow.orderNumber || "",
      customerName: firstRow.customerName || "",
      businessName: firstRow.businessName || "",
      date: group.date || firstRow.date || "",
      items: group.rows.map((row) => ({
        id: row.sourceItemId || row.id,
        quantity: row.quantity || "",
        description: row.description || "",
        sku: row.sku || "",
        path: row.path || "",
        orderNumber: row.orderNumber || "",
        customerName: row.customerName || "",
        businessName: row.businessName || "",
        buildId: row.buildId || "",
        orderId: row.orderId || "",
        location: row.location || "",
        locationPhoto: row.locationPhoto || null,
        locationPhotos: Array.isArray(row.locationPhotos)
          ? row.locationPhotos.filter(Boolean)
          : row.locationPhoto
            ? [row.locationPhoto]
            : [],
        locationHistory: Array.isArray(row.locationHistory)
          ? row.locationHistory
          : [],
        notes: row.notes || "",
        conditionGood: row.conditionGood !== false,
        damagePhoto: row.damagePhoto || null,
        damagePhotos: Array.isArray(row.damagePhotos)
          ? row.damagePhotos.filter(Boolean)
          : row.damagePhoto
            ? [row.damagePhoto]
            : [],
        saved: row.receivingStatus === "Checked in",
        savedAt: row.savedAt || "",
      })),
    });
  }

  return (
    <PageContainer className="max-w-[92rem]">
      <Breadcrumbs
        items={[
          { label: "New Home", onClick: () => onPageChange?.("new-home") },
          focusedSection
            ? {
                label: "Fulfillment",
                onClick: () => onPageChange?.("new-fulfillment"),
              }
            : { label: "Fulfillment" },
          focusedSection ? { label: pathMeta[focusedSection].title } : null,
        ].filter(Boolean)}
      />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            New Flow
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            {focusedSection ? pathMeta[focusedSection].title : "Fulfillment"}
          </h1>
          <p className="mt-3 max-w-3xl text-lg font-bold text-slate-500">
            {focusedSection
              ? pathMeta[focusedSection].subtitle
              : "See South pickups, supplier deliveries, PODs, and inbound receiving work created from orders."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onPageChange?.("order-flow")}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-6 text-base font-black text-white shadow-sm"
        >
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          Check In Items
        </button>
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="text-sm font-black text-slate-700">
          Search fulfillment
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 focus-within:border-[#FC2C38] focus-within:ring-4 focus-within:ring-red-100">
            <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search order, PO, vendor, item, or customer..."
              className="h-14 min-w-0 flex-1 bg-transparent text-base font-bold text-slate-900 outline-none placeholder:text-slate-300"
            />
          </div>
        </label>
      </div>

      {!focusedSection ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sectionOrder.map((sectionKey) => {
          const meta = pathMeta[sectionKey];
          const Icon = meta.icon;

          return (
            <button
              key={sectionKey}
              type="button"
              onClick={() => toggleSection(sectionKey)}
              aria-expanded={Boolean(visibleOpenSections[sectionKey])}
              className={`flex min-h-28 items-center justify-between rounded-[1.5rem] border p-4 text-left shadow-sm ${meta.tone}`}
            >
              <div>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <p className="mt-3 text-lg font-black">{meta.title}</p>
                <p className="text-sm font-bold opacity-80">
                  {rowsBySection[sectionKey].length}{" "}
                  {rowsBySection[sectionKey].length === 1 ? "item" : "items"}
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 opacity-70 transition ${visibleOpenSections[sectionKey] ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          );
          })}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        {activeSectionOrder.map((sectionKey) => (
          <FulfillmentSection
            key={sectionKey}
            sectionKey={sectionKey}
            rows={rowsBySection[sectionKey]}
            onPageChange={onPageChange}
            onCheckInPO={handleCheckInGroup}
            isExpanded={Boolean(visibleOpenSections[sectionKey])}
            onToggle={() => toggleSection(sectionKey)}
          />
        ))}
      </div>
    </PageContainer>
  );
}
