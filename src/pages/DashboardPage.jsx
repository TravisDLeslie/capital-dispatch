import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  ClipboardCheck,
  DollarSign,
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
  deliveries = [],
  onTraceSearch,
}) {
  const [dashboardSearch, setDashboardSearch] = useState("");
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
      .map((supplierRun) => ({
        id: `south-${supplierRun.id}`,
        type: "South PO",
        title: `PO ${supplierRun.poNumber}`,
        description: supplierRun.vendor || "South pickup",
        timestamp: supplierRun.updatedAt || supplierRun.createdAt,
        destination: "trace",
        icon: Route,
        tone: "bg-blue-50 text-blue-700",
        meta: [
          supplierRun.driver ? `Driver ${supplierRun.driver}` : "",
          supplierRun.status === "complete" ? "Complete" : "Open",
        ].filter(Boolean),
        links: getSouthOrderLinks(supplierRun).map((link) => ({
          label: `Linked order ${link.orderNumber}`,
          detail: [
            link.customerName ? formatCustomerName(link.customerName) : "",
            `${link.itemCount} ${link.itemCount === 1 ? "item" : "items"}`,
          ]
            .filter(Boolean)
            .join(" • "),
        })),
      }));

    const deliveryResults = deliveries
      .filter((delivery) =>
        deliveryMatchesDashboardSearch(delivery, dashboardSearch),
      )
      .slice(0, 4)
      .map((delivery) => ({
        id: `delivery-${delivery.id}`,
        type: "Delivery",
        title: `Order ${delivery.orderNumber}`,
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
        description: checkIn.vendor || "Receiving check-in",
        timestamp: checkIn.checkedInAt,
        destination: "trace",
        icon: ClipboardCheck,
        tone: "bg-emerald-50 text-emerald-700",
        meta: [
          checkIn.checkedInBy ? `Checked in by ${checkIn.checkedInBy}` : "",
          checkIn.sourceType === "south" ? "From South" : "",
        ].filter(Boolean),
        links: checkIn.sourceSupplierRunPoNumber
          ? [
              {
                label: `Linked South PO ${checkIn.sourceSupplierRunPoNumber}`,
                detail: checkIn.sourceSupplierRunVendor || "",
              },
            ]
          : [],
      }));

    return [...southResults, ...deliveryResults, ...receivingResults]
      .sort(
        (firstResult, secondResult) =>
          new Date(secondResult.timestamp || 0) -
          new Date(firstResult.timestamp || 0),
      )
      .slice(0, 8);
  }, [checkIns, dashboardSearch, deliveries, hasDashboardSearch, supplierRuns]);

  const quickActions = [
    {
      id: "supplier-runs-add",
      title: "Add PO to South",
      description: "Create a pickup request for the South route.",
      icon: Plus,
      metric: "+",
      metricLabel: "PO",
      tone:
        "bg-red-50 text-[#FC2C38] border-red-100 hover:border-red-200 hover:bg-red-100/70",
    },
    {
      id: "supplier-runs-dispatch",
      title: "South POs Need Dispatch",
      description: "Assign drivers and trucks before they hit the route.",
      icon: Truck,
      metric: operations.southNeedsDispatch || 0,
      metricLabel: "Waiting",
      tone:
        operations.southNeedsDispatch > 0
          ? "bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300 hover:bg-amber-100/60"
          : "bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-200 hover:bg-blue-100/70",
    },
    {
      id: "supplier-runs-check",
      title: "View POs to Pick Up",
      description: "Open the active South route board.",
      icon: ClipboardCheck,
      metric: operations.southOpen || 0,
      metricLabel: "Open",
      tone:
        "bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-200 hover:bg-blue-100/70",
    },
    {
      id: "yard-tasks",
      title: "Yard Tasks",
      description: "Keep the top yard priorities visible and assigned.",
      icon: ClipboardCheck,
      metric: operations.yardTasksOpen || 0,
      metricLabel: "Open",
      tone:
        "bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200 hover:bg-emerald-100/70",
    },
    {
      id: "stocking-handbook",
      title: "Stocking Handbook",
      description: "Look up stocked items, lengths, and item numbers.",
      icon: Route,
      metric: operations.stockingHandbookItems || 0,
      metricLabel: "Items",
      tone:
        "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70",
    },
  ].filter((action) => allowedPageIds.includes(action.id));

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

      {quickActions.length > 0 ? (
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

          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => {
              const ActionIcon = action.icon;

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onPageChange?.(action.id)}
                  className={`group flex min-h-[92px] items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition ${action.tone}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <ActionIcon
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={2.6}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-black text-slate-950">
                      {action.title}
                    </span>
                    <span className="mt-0.5 block text-xs font-bold leading-5 text-slate-500">
                      {action.description}
                    </span>
                  </span>

                  <span className="shrink-0 rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                    <span className="block text-2xl font-black text-slate-950">
                      {action.metric}
                    </span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      {action.metricLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

    </PageContainer>
  );
}
