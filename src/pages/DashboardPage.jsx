import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  Package,
  Plus,
  Route,
  Search,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";
import { formatCustomerName } from "../utils/textFormatters";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatDateTime(value) {
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
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getSouthOrderLinks(supplierRun) {
  if (!Array.isArray(supplierRun.items)) {
    return [];
  }

  const orderMap = new Map();

  supplierRun.items.forEach((item) => {
    const orderNumber = item.orderNumber || "";

    if (!orderNumber) {
      return;
    }

    const existing = orderMap.get(orderNumber) || {
      orderNumber,
      customerName: item.customerName || supplierRun.customerName || "",
      itemCount: 0,
    };

    orderMap.set(orderNumber, {
      ...existing,
      customerName:
        existing.customerName || item.customerName || supplierRun.customerName || "",
      itemCount: existing.itemCount + 1,
    });
  });

  return [...orderMap.values()];
}

function supplierRunMatchesDashboardSearch(supplierRun, searchValue) {
  const textSearch = normalizeText(searchValue);
  const numberSearch = normalizeNumber(searchValue);
  const items = Array.isArray(supplierRun.items) ? supplierRun.items : [];
  const searchableText = [
    supplierRun.poNumber,
    supplierRun.vendor,
    supplierRun.driver,
    supplierRun.customerName,
    supplierRun.orderedBy,
    supplierRun.createdByName,
    ...items.flatMap((item) => [
      item.description,
      item.internalReference,
      item.orderNumber,
      item.customerName,
      item.returnNotes,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
  const searchableNumbers = [
    supplierRun.poNumber,
    ...items.flatMap((item) => [item.orderNumber, item.internalReference]),
  ].filter(Boolean);

  return (
    normalizeText(searchableText).includes(textSearch) ||
    (numberSearch &&
      searchableNumbers.some((value) =>
        normalizeNumber(value).includes(numberSearch),
      ))
  );
}

function deliveryMatchesDashboardSearch(delivery, searchValue) {
  const textSearch = normalizeText(searchValue);
  const numberSearch = normalizeNumber(searchValue);
  const items = Array.isArray(delivery.items) ? delivery.items : [];
  const searchableText = [
    delivery.orderNumber,
    delivery.customerName,
    delivery.deliveryAddress,
    delivery.contactName,
    delivery.phoneNumber,
    delivery.driver,
    delivery.generalNotes,
    delivery.deliveryLocationNotes,
    ...items.map((item) => item.description),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    normalizeText(searchableText).includes(textSearch) ||
    (numberSearch && normalizeNumber(delivery.orderNumber).includes(numberSearch))
  );
}

function checkInMatchesDashboardSearch(checkIn, searchValue) {
  const textSearch = normalizeText(searchValue);
  const numberSearch = normalizeNumber(searchValue);
  const materials = Array.isArray(checkIn.materials) ? checkIn.materials : [];
  const searchableText = [
    checkIn.poNumber,
    checkIn.sourceSupplierRunPoNumber,
    checkIn.vendor,
    checkIn.checkedInBy,
    checkIn.poLocation,
    checkIn.orderAssignment?.businessName,
    checkIn.orderAssignment?.orderedBy,
    checkIn.orderAssignment?.jobName,
    checkIn.orderAssignment?.internalReference,
    ...materials.flatMap((material) => [
      material.description,
      material.location,
      material.notes,
    ]),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    normalizeText(searchableText).includes(textSearch) ||
    (numberSearch &&
      [checkIn.poNumber, checkIn.sourceSupplierRunPoNumber, checkIn.orderAssignment?.internalReference]
        .filter(Boolean)
        .some((value) => normalizeNumber(value).includes(numberSearch)))
  );
}

function getItemDescription(item) {
  return String(
    item?.description ||
      item?.materialDescription ||
      item?.itemDescription ||
      item?.material ||
      "Item detail",
  ).trim();
}

function getItemQuantity(item) {
  return String(item?.quantity || item?.qty || item?.amount || "").trim();
}

function getItemReference(item) {
  return String(
    item?.internalReference ||
      item?.sku ||
      item?.itemNumber ||
      item?.itemNo ||
      item?.soNumber ||
      "",
  ).trim();
}

function summarizeItems(items, options = {}) {
  const itemList = Array.isArray(items) ? items : [];
  const visibleItems = itemList.slice(0, options.limit || 2).map((item) => {
    const quantity = getItemQuantity(item);
    const description = getItemDescription(item);
    const reference = getItemReference(item);
    const location = String(item?.location || "").trim();

    return {
      id:
        item?.id ||
        [quantity, description, reference, location].filter(Boolean).join("-"),
      label: [quantity, description].filter(Boolean).join(" ") || description,
      detail: [reference ? `#${reference}` : "", location].filter(Boolean).join(" • "),
    };
  });

  return {
    total: itemList.length,
    visibleItems,
    hiddenCount: Math.max(itemList.length - visibleItems.length, 0),
  };
}

const RECEIVING_STATUS_STAMPS = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  partial: "border-orange-200 bg-orange-50 text-orange-700",
  received: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function getReceivedMaterialCount(checkIn) {
  if (Array.isArray(checkIn?.materials)) {
    return checkIn.materials.length;
  }

  if (Array.isArray(checkIn?.items)) {
    return checkIn.items.length;
  }

  return 0;
}

function checkInMatchesPO(checkIn, poNumber) {
  const normalizedPO = normalizeNumber(poNumber);

  if (!normalizedPO) {
    return false;
  }

  return [
    checkIn?.poNumber,
    checkIn?.sourceSupplierRunPoNumber,
    checkIn?.sourceTheirTruckPONumber,
  ]
    .filter(Boolean)
    .some((value) => normalizeNumber(value) === normalizedPO);
}

function getReceivingStatusForPO(checkIns, poNumber, expectedItemCount = 0) {
  const matches = Array.isArray(checkIns)
    ? checkIns.filter((checkIn) => checkInMatchesPO(checkIn, poNumber))
    : [];

  if (matches.length === 0) {
    return {
      key: "pending",
      label: "Pending Check-In",
      className: RECEIVING_STATUS_STAMPS.pending,
    };
  }

  const receivedItemCount = matches.reduce(
    (total, checkIn) => total + getReceivedMaterialCount(checkIn),
    0,
  );

  if (expectedItemCount > 0 && receivedItemCount < expectedItemCount) {
    return {
      key: "partial",
      label: "Partial Check-In",
      className: RECEIVING_STATUS_STAMPS.partial,
    };
  }

  return {
    key: "received",
    label: "Checked In",
    className: RECEIVING_STATUS_STAMPS.received,
  };
}

/**
 * @param {{
 *   title: string;
 *   description: string;
 *   icon: import("lucide-react").LucideIcon;
 *   value: string | number;
 *   note: string;
 *   tone?: "default" | "warning" | "success" | "dispatch" | "marketing" | "fleet";
 *   onClick?: () => void;
 * }} props
 */
function HeartbeatCard({
  title,
  description,
  icon: Icon,
  value,
  note,
  tone = "default",
  onClick,
}) {
  const toneClasses = {
    default: {
      card: "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30",
      icon: "bg-slate-50 text-slate-700 border-slate-200",
      value: "text-slate-950",
    },
    warning: {
      card: "border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/40",
      icon: "bg-amber-50 text-amber-700 border-amber-200",
      value: "text-amber-900",
    },
    success: {
      card: "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50",
      icon: "bg-emerald-100 text-emerald-700 border-emerald-200",
      value: "text-emerald-800",
    },
    dispatch: {
      card: "border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50",
      icon: "bg-white text-blue-700 border-blue-200",
      value: "text-blue-900",
    },
    marketing: {
      card: "border-rose-200 bg-rose-50/40 hover:border-rose-300 hover:bg-rose-50",
      icon: "bg-white text-rose-700 border-rose-200",
      value: "text-rose-900",
    },
    fleet: {
      card: "border-cyan-200 bg-cyan-50/40 hover:border-cyan-300 hover:bg-cyan-50",
      icon: "bg-white text-cyan-700 border-cyan-200",
      value: "text-cyan-900",
    },
  };
  const selectedTone = toneClasses[tone] || toneClasses.default;
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${selectedTone.icon}`}
        >
          <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
        </span>

        <span className="text-right">
          <span className={`block text-3xl font-black ${selectedTone.value}`}>
            {value}
          </span>
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            {note}
          </span>
        </span>
      </div>

      <h2 className="mt-4 text-xl font-black text-slate-950">
        {title}
      </h2>
      <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-[22px] border p-5 text-left shadow-sm transition ${selectedTone.card}`}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`rounded-[22px] border p-5 shadow-sm ${selectedTone.card}`}>
      {content}
    </article>
  );
}

/**
 * @param {{
 *   headerAccessory?: import("react").ReactNode;
 *   onPageChange?: (pageId: string) => void;
 *   allowedPageIds?: string[];
 *   operations?: {
 *     receivingToday?: number;
 *     southNeedsDispatch?: number;
 *     southOpen?: number;
 *     deliveryNeedsDispatch?: number;
 *     deliveryOpen?: number;
 *     hardwareOpen?: number;
 *     customerCount?: number;
 *     salesMonthTotal?: number;
 *     cashCardSales?: number;
 *     chargeSales?: number;
 *   };
 *   checkIns?: Array<Record<string, any>>;
 *   supplierRuns?: Array<Record<string, any>>;
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   deliveries?: Array<Record<string, any>>;
 *   onTraceSearch?: (searchValue: string) => void;
 * }} props
 */
export default function DashboardPage({
  headerAccessory = null,
  onPageChange,
  allowedPageIds = [],
  operations = {},
  checkIns = [],
  supplierRuns = [],
  theirTruckPOs = [],
  deliveries = [],
  onTraceSearch,
}) {
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const hasDashboardSearch = dashboardSearch.trim().length > 0;
  const dashboardSearchResults = useMemo(() => {
    if (!hasDashboardSearch) {
      return [];
    }

    const southResults = supplierRuns
      .filter((supplierRun) =>
        supplierRunMatchesDashboardSearch(supplierRun, dashboardSearch),
      )
      .slice(0, 4)
      .map((supplierRun) => {
        const items = Array.isArray(supplierRun.items)
          ? supplierRun.items
          : [];

        return {
          id: `south-${supplierRun.id}`,
          type: "South PO",
          title: `PO ${supplierRun.poNumber}`,
          traceValue: supplierRun.poNumber || dashboardSearch,
          description: supplierRun.vendor || "South pickup",
          timestamp: supplierRun.updatedAt || supplierRun.createdAt,
          destination: "trace",
          icon: Route,
          tone: "bg-blue-50 text-blue-700",
          receivingStatus: getReceivingStatusForPO(
            checkIns,
            supplierRun.poNumber,
            items.length,
          ),
          meta: [
            supplierRun.driver ? `Driver ${supplierRun.driver}` : "",
            supplierRun.status === "complete" ? "Complete" : "Open",
          ].filter(Boolean),
          itemSummary: summarizeItems(items),
          links: getSouthOrderLinks(supplierRun).map((link) => ({
            label: `Linked order ${link.orderNumber}`,
            detail: [
              link.customerName ? formatCustomerName(link.customerName) : "",
              `${link.itemCount} ${link.itemCount === 1 ? "item" : "items"}`,
            ]
              .filter(Boolean)
              .join(" • "),
          })),
        };
      });

    const theirTruckResults = theirTruckPOs
      .filter((theirTruckPO) =>
        supplierRunMatchesDashboardSearch(theirTruckPO, dashboardSearch),
      )
      .slice(0, 4)
      .map((theirTruckPO) => {
        const items = Array.isArray(theirTruckPO.items)
          ? theirTruckPO.items
          : [];

        return {
          id: `their-truck-${theirTruckPO.id}`,
          type: "Their Truck PO",
          title: `PO ${theirTruckPO.poNumber}`,
          traceValue: theirTruckPO.poNumber || dashboardSearch,
          description: theirTruckPO.vendor || "Vendor inbound",
          timestamp:
            theirTruckPO.updatedAt ||
            theirTruckPO.deliveryDate ||
            theirTruckPO.createdAt,
          destination: "trace",
          icon: Truck,
          tone: "bg-blue-50 text-blue-700",
          receivingStatus: getReceivingStatusForPO(
            checkIns,
            theirTruckPO.poNumber,
            items.length,
          ),
          meta: [
            theirTruckPO.deliveryDate ? "Scheduled" : "",
            theirTruckPO.status === "complete" ? "Complete" : "Open",
          ].filter(Boolean),
          itemSummary: summarizeItems(items),
          links: [],
        };
      });

    const deliveryResults = deliveries
      .filter((delivery) =>
        deliveryMatchesDashboardSearch(delivery, dashboardSearch),
      )
      .slice(0, 4)
      .map((delivery) => ({
        id: `delivery-${delivery.id}`,
        type: "Delivery",
        title: `Order ${delivery.orderNumber}`,
        traceValue: delivery.orderNumber || dashboardSearch,
        description: formatCustomerName(delivery.customerName || "Customer"),
        timestamp:
          delivery.deliveredAt ||
          delivery.scheduledStartAt ||
          delivery.updatedAt ||
          delivery.createdAt,
        destination: "trace",
        icon: Truck,
        tone: "bg-amber-50 text-amber-800",
        meta: [
          delivery.driver ? `Driver ${delivery.driver}` : "",
          delivery.status === "complete" ? "Delivered" : "Open",
        ].filter(Boolean),
        itemSummary: summarizeItems(
          Array.isArray(delivery.items) ? delivery.items : [],
        ),
        links: supplierRuns
          .filter((supplierRun) =>
            getSouthOrderLinks(supplierRun).some(
              (link) => link.orderNumber === delivery.orderNumber,
            ),
          )
          .slice(0, 3)
          .map((supplierRun) => ({
            label: `Linked PO ${supplierRun.poNumber}`,
            detail: supplierRun.vendor || "South pickup",
          })),
      }));

    const receivingResults = checkIns
      .filter((checkIn) =>
        checkInMatchesDashboardSearch(checkIn, dashboardSearch),
      )
      .slice(0, 4)
      .map((checkIn) => ({
        id: `receiving-${checkIn.id}`,
        type: "Receiving",
        title: `PO ${checkIn.poNumber}`,
        traceValue:
          checkIn.poNumber ||
          checkIn.sourceSupplierRunPoNumber ||
          checkIn.sourceTheirTruckPONumber ||
          dashboardSearch,
        description: checkIn.vendor || "Receiving check-in",
        timestamp: checkIn.checkedInAt,
        destination: "trace",
        icon: ClipboardCheck,
        tone: "bg-emerald-50 text-emerald-700",
        receivingStatus: {
          key: "received",
          label: "Checked In",
          className: RECEIVING_STATUS_STAMPS.received,
        },
        meta: [
          checkIn.checkedInBy ? `Checked in by ${checkIn.checkedInBy}` : "",
          checkIn.sourceType === "south" ? "From South" : "",
        ].filter(Boolean),
        itemSummary: summarizeItems(
          Array.isArray(checkIn.materials) ? checkIn.materials : [],
        ),
        links: checkIn.sourceSupplierRunPoNumber
          ? [
              {
                label: `Linked South PO ${checkIn.sourceSupplierRunPoNumber}`,
                detail: checkIn.sourceSupplierRunVendor || "",
              },
            ]
          : [],
      }));

    return [
      ...southResults,
      ...theirTruckResults,
      ...deliveryResults,
      ...receivingResults,
    ]
      .sort(
        (firstResult, secondResult) =>
          new Date(secondResult.timestamp || 0) -
          new Date(firstResult.timestamp || 0),
      )
      .slice(0, 8);
  }, [
    checkIns,
    dashboardSearch,
    deliveries,
    hasDashboardSearch,
    supplierRuns,
    theirTruckPOs,
  ]);

  const theirTruckOpenCount = theirTruckPOs.filter(
    (theirTruckPO) => theirTruckPO.status !== "complete",
  ).length;
  const quickActionFolders = [
    {
      id: "south-section",
      title: "South",
      description: "POs we are picking up from suppliers.",
      icon: Truck,
      summary: `${operations.southNeedsDispatch || 0} need dispatch · ${
        operations.southOpen || 0
      } open`,
      tone: "border-red-200 bg-red-50 text-[#FC2C38]",
      accent: "from-red-500 to-[#FC2C38]",
      actions: [
        {
          id: "supplier-runs-add",
          title: "Add South PO",
          description: "Create a pickup request.",
          icon: Plus,
          metric: "+",
          metricLabel: "PO",
        },
        {
          id: "supplier-runs-dispatch",
          title: "Needs Dispatch",
          description: "Assign driver and truck.",
          icon: AlertTriangle,
          metric: operations.southNeedsDispatch || 0,
          metricLabel: "Waiting",
        },
        {
          id: "supplier-runs-check",
          title: "POs to Pick Up",
          description: "Open route board.",
          icon: ClipboardCheck,
          metric: operations.southOpen || 0,
          metricLabel: "Open",
        },
      ],
    },
    {
      id: "deliveries-section",
      title: "Deliveries",
      description: "Orders going out to customers.",
      icon: Package,
      summary: `${operations.deliveryNeedsDispatch || 0} need dispatch · ${
        operations.deliveryOpen || 0
      } upcoming`,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      accent: "from-blue-500 to-blue-700",
      actions: [
        {
          id: "deliveries-dispatch",
          title: "Needs Dispatch",
          description: "Schedule drivers and trucks.",
          icon: Truck,
          metric: operations.deliveryNeedsDispatch || 0,
          metricLabel: "Waiting",
        },
        {
          id: "deliveries-queue",
          title: "Upcoming",
          description: "View assigned deliveries.",
          icon: ClipboardCheck,
          metric: operations.deliveryOpen || 0,
          metricLabel: "Open",
        },
        {
          id: "deliveries-calendar",
          title: "Calendar",
          description: "See delivery blocks by driver.",
          icon: CalendarDays,
          metric: operations.deliveryOpen || 0,
          metricLabel: "Live",
        },
      ],
    },
    {
      id: "yard-section",
      title: "Yard Tasks",
      description: "Assigned yard priorities.",
      icon: ClipboardCheck,
      summary: `${operations.yardTasksOpen || 0} open tasks`,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      accent: "from-emerald-500 to-emerald-700",
      actions: [
        {
          id: "yard-tasks",
          title: "Yard Tasks",
          description: "View, assign, and complete work.",
          icon: ClipboardCheck,
          metric: operations.yardTasksOpen || 0,
          metricLabel: "Open",
        },
      ],
    },
    {
      id: "incoming-section",
      title: "Incoming Deliveries",
      description: "Their Truck vendor-delivered POs.",
      icon: Route,
      summary: `${theirTruckOpenCount} inbound POs`,
      tone: "border-sky-200 bg-sky-50 text-sky-700",
      accent: "from-sky-500 to-sky-700",
      actions: [
        {
          id: "their-truck-pos",
          title: "Their Truck POs",
          description: "Add or review inbound POs.",
          icon: Plus,
          metric: theirTruckOpenCount,
          metricLabel: "Open",
        },
        {
          id: "their-truck-calendar",
          title: "Calendar",
          description: "Vendor delivery dates.",
          icon: CalendarDays,
          metric: theirTruckOpenCount,
          metricLabel: "Inbound",
        },
        {
          id: "their-truck-history",
          title: "History",
          description: "Completed inbound POs.",
          icon: Route,
          metric: theirTruckPOs.length,
          metricLabel: "POs",
        },
      ],
    },
  ]
    .map((folder) => ({
      ...folder,
      actions: folder.actions.filter((action) => allowedPageIds.includes(action.id)),
    }))
    .filter((folder) => folder.actions.length > 0);
  const activeQuickActionFolder =
    quickActionFolders.find((folder) => folder.id === selectedFolderId) ||
    quickActionFolders[0];
  const ActiveQuickActionFolderIcon = activeQuickActionFolder?.icon || Package;

  function openTraceSearch() {
    if (onTraceSearch) {
      onTraceSearch(dashboardSearch);
      return;
    }

    onPageChange?.("trace");
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Dashboard
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            Operations Dashboard
          </h1>

          <p className="mt-2 max-w-3xl text-lg text-slate-500">
            Focused on the work that needs attention right now.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {headerAccessory}
        </div>
      </div>

      {allowedPageIds.includes("trace") ? (
        <section className="mb-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              openTraceSearch();
            }}
            className="space-y-4"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                  Search for a PO
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Find PO chain
                </h2>
              </div>
              <p className="max-w-2xl text-sm font-semibold text-slate-500">
                Search POs, order numbers, vendors, customers, or item details.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Search PO chain</span>
                <Search
                  aria-hidden="true"
                  className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.5}
                />
                <input
                  type="search"
                  value={dashboardSearch}
                  onChange={(event) => setDashboardSearch(event.target.value)}
                  placeholder="Search PO, order, customer, vendor, or item..."
                  className="min-h-[52px] w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-base font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </label>

              <button
                type="submit"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
              >
                Find Chain
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.8}
                />
              </button>
            </div>
          </form>

          {hasDashboardSearch ? (
            <div className="mt-4 grid gap-2">
              {dashboardSearchResults.length > 0 ? (
                dashboardSearchResults.slice(0, 3).map((result) => {
                  const ResultIcon = result.icon;

                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() =>
                        onTraceSearch?.(String(result.traceValue || dashboardSearch))
                      }
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${result.tone}`}
                      >
                        <ResultIcon
                          aria-hidden="true"
                          className="h-5 w-5"
                          strokeWidth={2.5}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-black text-slate-950">
                            {result.title} · {result.description}
                          </span>
                          {result.receivingStatus ? (
                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${result.receivingStatus.className}`}
                            >
                              {result.receivingStatus.label}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-bold text-slate-500">
                          {result.type}
                          {result.timestamp
                            ? ` · ${formatDateTime(result.timestamp)}`
                            : ""}
                        </span>
                        {result.itemSummary?.total > 0 ? (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {result.itemSummary.visibleItems.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex max-w-full flex-col rounded-xl bg-white px-2.5 py-1 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200"
                              >
                                <span className="truncate">{item.label}</span>
                                {item.detail ? (
                                  <span className="truncate text-[11px] font-bold text-slate-400">
                                    {item.detail}
                                  </span>
                                ) : null}
                              </span>
                            ))}
                            {result.itemSummary.hiddenCount > 0 ? (
                              <span className="inline-flex items-center rounded-xl bg-slate-200 px-2.5 py-1 text-xs font-black text-slate-600">
                                +{result.itemSummary.hiddenCount} more
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-slate-400"
                        strokeWidth={2.8}
                      />
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                  No quick matches yet. Open the full PO chain search to dig
                  deeper.
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {quickActionFolders.length > 0 ? (
        <section className="mb-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                Operations
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                What matters today
              </h2>
            </div>
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {quickActionFolders.map((section) => {
              const SectionIcon = section.icon;
              const isActive = activeQuickActionFolder?.id === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setSelectedFolderId(section.id)}
                  className={`relative flex min-w-[190px] shrink-0 items-center gap-3 overflow-hidden rounded-3xl border px-4 py-3 text-left shadow-sm transition sm:min-w-[210px] ${
                    isActive
                      ? `${section.tone} ring-2 ring-white`
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white"
                  }`}
                  aria-pressed={isActive}
                >
                  {isActive ? (
                    <span
                      className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${section.accent}`}
                    />
                  ) : null}

                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                      isActive
                        ? `bg-gradient-to-br ${section.accent} text-white`
                        : "bg-white text-slate-500"
                    }`}
                  >
                    <SectionIcon
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={2.6}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-950">
                      {section.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                      {section.summary}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {activeQuickActionFolder ? (
            <article className="overflow-hidden rounded-b-3xl rounded-tr-3xl border border-slate-200 bg-slate-50 shadow-sm">
              <div className={`flex items-start gap-3 border-b px-4 py-4 ${activeQuickActionFolder.tone}`}>
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm sm:flex">
                  <ActiveQuickActionFolderIcon
                    aria-hidden="true"
                    className="h-6 w-6"
                    strokeWidth={2.6}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="text-xs font-black uppercase tracking-[0.16em] opacity-80">
                    Focus Area
                  </span>
                  <span className="mt-1 block text-2xl font-black tracking-tight text-slate-950">
                    {activeQuickActionFolder.title}
                  </span>
                  <span className="mt-1 block text-sm font-bold leading-5 text-slate-600">
                    {activeQuickActionFolder.description}
                  </span>
                </span>

                <span className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right text-xs font-black uppercase tracking-[0.08em] text-slate-500 shadow-sm">
                  {activeQuickActionFolder.summary}
                </span>
              </div>

              <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeQuickActionFolder.actions.map((action) => {
                  const ActionIcon = action.icon;

                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => onPageChange?.(action.id)}
                      className="group flex min-h-[92px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-red-200 hover:bg-white"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-red-50 group-hover:text-[#FC2C38]">
                        <ActionIcon
                          aria-hidden="true"
                          className="h-5 w-5"
                          strokeWidth={2.6}
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-950">
                          {action.title}
                        </span>
                        <span className="mt-0.5 block text-xs font-bold leading-5 text-slate-500">
                          {action.description}
                        </span>
                      </span>

                      <span className="shrink-0 rounded-2xl bg-slate-50 px-3 py-2 text-center">
                        <span className="block text-xl font-black text-slate-950">
                          {action.metric}
                        </span>
                        <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                          {action.metricLabel}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

    </PageContainer>
  );
}
