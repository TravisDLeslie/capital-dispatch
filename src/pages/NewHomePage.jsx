import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  PackageSearch,
  Search,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import PageContainer from "../components/PageContainer";

function getFirstName(currentUser) {
  const displayName =
    currentUser?.name ||
    currentUser?.displayName ||
    currentUser?.email ||
    "there";
  const cleanedName = String(displayName).trim();

  if (!cleanedName) {
    return "there";
  }

  return cleanedName.split(/\s|@/)[0] || "there";
}

function getDayGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
}

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

function formatCustomerName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function getItemDescription(item) {
  return String(
    item?.description ||
      item?.materialDescription ||
      item?.itemDescription ||
      item?.material ||
      item?.name ||
      "",
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

function summarizeItems(items, limit = 2) {
  const itemList = Array.isArray(items) ? items : [];

  return {
    visibleItems: itemList.slice(0, limit).map((item, index) => {
      const quantity = getItemQuantity(item);
      const description = getItemDescription(item);
      const reference = getItemReference(item);

      return {
        id: item?.id || `${description}-${reference}-${index}`,
        label: [quantity ? `QTY ${quantity}` : "", description]
          .filter(Boolean)
          .join(" • "),
        detail: reference ? `#${reference}` : "",
      };
    }),
    hiddenCount: Math.max(itemList.length - limit, 0),
  };
}

function valueMatchesSearch(values, searchValue) {
  const textSearch = normalizeText(searchValue);
  const numberSearch = normalizeNumber(searchValue);
  const searchableText = values.filter(Boolean).join(" ");

  return (
    normalizeText(searchableText).includes(textSearch) ||
    (numberSearch &&
      values
        .filter(Boolean)
        .some((value) => normalizeNumber(value).includes(numberSearch)))
  );
}

function buildOverviewSearchResults({
  searchValue,
  checkIns,
  supplierRuns,
  theirTruckPOs,
  deliveries,
  salesOrders,
  customers,
  stockingHandbookItems,
  itemCatalogItems,
}) {
  const search = searchValue.trim();

  if (!search) {
    return [];
  }

  const southResults = supplierRuns
    .filter((supplierRun) => {
      const items = Array.isArray(supplierRun.items) ? supplierRun.items : [];

      return valueMatchesSearch(
        [
          supplierRun.poNumber,
          supplierRun.vendor,
          supplierRun.driver,
          supplierRun.customerName,
          supplierRun.orderedBy,
          ...items.flatMap((item) => [
            item.description,
            item.internalReference,
            item.orderNumber,
            item.customerName,
          ]),
        ],
        search,
      );
    })
    .slice(0, 4)
    .map((supplierRun) => ({
      id: `south-${supplierRun.id}`,
      type: "South PO",
      title: `PO ${supplierRun.poNumber || "Unknown"}`,
      description: supplierRun.vendor || "South pickup",
      traceValue: supplierRun.poNumber || search,
      timestamp: supplierRun.updatedAt || supplierRun.pickupDate || supplierRun.createdAt,
      icon: Truck,
      tone: "bg-red-50 text-red-600",
      itemSummary: summarizeItems(supplierRun.items),
    }));

  const theirTruckResults = theirTruckPOs
    .filter((po) => {
      const items = Array.isArray(po.items) ? po.items : [];

      return valueMatchesSearch(
        [
          po.poNumber,
          po.vendor,
          po.customerName,
          po.orderedBy,
          ...items.flatMap((item) => [
            item.description,
            item.internalReference,
            item.orderNumber,
            item.customerName,
          ]),
        ],
        search,
      );
    })
    .slice(0, 4)
    .map((po) => ({
      id: `their-truck-${po.id}`,
      type: "Their Truck PO",
      title: `PO ${po.poNumber || "Unknown"}`,
      description: po.vendor || "Vendor delivery",
      traceValue: po.poNumber || search,
      timestamp: po.updatedAt || po.deliveryDate || po.createdAt,
      icon: Truck,
      tone: "bg-blue-50 text-blue-700",
      itemSummary: summarizeItems(po.items),
    }));

  const deliveryResults = deliveries
    .filter((delivery) =>
      valueMatchesSearch(
        [
          delivery.orderNumber,
          delivery.customerName,
          delivery.deliveryAddress,
          delivery.contactName,
          delivery.phoneNumber,
          delivery.driver,
          ...(Array.isArray(delivery.items)
            ? delivery.items.map((item) => item.description)
            : []),
        ],
        search,
      ),
    )
    .slice(0, 4)
    .map((delivery) => ({
      id: `delivery-${delivery.id}`,
      type: "Delivery",
      title: `Order ${delivery.orderNumber || "Unknown"}`,
      description: formatCustomerName(delivery.customerName || "Customer"),
      traceValue: delivery.orderNumber || search,
      timestamp: delivery.scheduledStartAt || delivery.deliveredAt || delivery.createdAt,
      icon: Truck,
      tone: "bg-amber-50 text-amber-700",
      itemSummary: summarizeItems(delivery.items),
    }));

  const receivingResults = checkIns
    .filter((checkIn) => {
      const materials = Array.isArray(checkIn.materials) ? checkIn.materials : [];

      return valueMatchesSearch(
        [
          checkIn.poNumber,
          checkIn.sourceSupplierRunPoNumber,
          checkIn.sourceTheirTruckPONumber,
          checkIn.vendor,
          checkIn.checkedInBy,
          ...materials.flatMap((material) => [
            material.description,
            material.location,
            material.notes,
          ]),
        ],
        search,
      );
    })
    .slice(0, 4)
    .map((checkIn) => ({
      id: `receiving-${checkIn.id}`,
      type: "Receiving",
      title: `PO ${checkIn.poNumber || "Unknown"}`,
      description: checkIn.vendor || "Checked in item",
      traceValue:
        checkIn.poNumber ||
        checkIn.sourceSupplierRunPoNumber ||
        checkIn.sourceTheirTruckPONumber ||
        search,
      timestamp: checkIn.checkedInAt,
      icon: ClipboardCheck,
      tone: "bg-emerald-50 text-emerald-700",
      itemSummary: summarizeItems(checkIn.materials),
    }));

  const orderResults = salesOrders
    .filter((order) =>
      valueMatchesSearch(
        [
          order.orderNumber,
          order.customerName,
          order.businessName,
          order.phoneNumber,
          order.accountNumber,
          ...(Array.isArray(order.items)
            ? order.items.flatMap((item) => [
                item.description,
                item.poNumber,
                item.vendor,
                item.itemNumber,
              ])
            : []),
        ],
        search,
      ),
    )
    .slice(0, 4)
    .map((order) => ({
      id: `order-${order.id}`,
      type: "Order",
      title: `Order ${order.orderNumber || "Unknown"}`,
      description:
        formatCustomerName(order.businessName || order.customerName) || "Customer order",
      traceValue: order.orderNumber || search,
      timestamp: order.updatedAt || order.createdAt,
      icon: ShoppingCart,
      tone: "bg-violet-50 text-violet-700",
      itemSummary: summarizeItems(order.items),
    }));

  const customerResults = customers
    .filter((customer) =>
      valueMatchesSearch(
        [
          customer.name,
          customer.companyName,
          customer.accountNumber,
          customer.phoneNumber,
          customer.email,
          customer.city,
        ],
        search,
      ),
    )
    .slice(0, 3)
    .map((customer) => ({
      id: `customer-${customer.id}`,
      type: "Customer",
      title: formatCustomerName(customer.companyName || customer.name || "Customer"),
      description: [customer.accountNumber ? `Acct ${customer.accountNumber}` : "", customer.city]
        .filter(Boolean)
        .join(" • "),
      traceValue: customer.companyName || customer.name || search,
      timestamp: customer.updatedAt || customer.createdAt,
      icon: Users,
      tone: "bg-slate-100 text-slate-700",
      itemSummary: summarizeItems([]),
    }));

  const handbookResults = [...stockingHandbookItems, ...itemCatalogItems]
    .filter((item) =>
      valueMatchesSearch(
        [
          item.name,
          item.description,
          item.category,
          item.group,
          item.itemNumber,
          item.nominal,
          item.grade,
          item.unitSize,
          ...(Array.isArray(item.keywords) ? item.keywords : []),
          ...(Array.isArray(item.lengthItemNumbers)
            ? item.lengthItemNumbers.flatMap((lengthItem) => [
                lengthItem.length,
                lengthItem.itemNumber,
              ])
            : []),
        ],
        search,
      ),
    )
    .slice(0, 4)
    .map((item) => ({
      id: `handbook-${item.id}`,
      type: item.itemNumber ? "Item Catalog" : "Stocking Handbook",
      title: item.description || item.name || "Stock item",
      description: [item.category, item.itemNumber ? `#${item.itemNumber}` : ""]
        .filter(Boolean)
        .join(" • "),
      traceValue: item.description || item.name || search,
      timestamp: item.updatedAt || item.createdAt,
      icon: item.itemNumber ? PackageSearch : BookOpen,
      tone: "bg-slate-50 text-slate-700",
      itemSummary: summarizeItems([]),
    }));

  return [
    ...southResults,
    ...theirTruckResults,
    ...deliveryResults,
    ...receivingResults,
    ...orderResults,
    ...customerResults,
    ...handbookResults,
  ]
    .sort(
      (firstResult, secondResult) =>
        new Date(secondResult.timestamp || 0) -
        new Date(firstResult.timestamp || 0),
    )
    .slice(0, 8);
}

/**
 * @param {{
 *   currentUser?: { name?: string; displayName?: string; email?: string } | null;
 *   checkIns?: Array<Record<string, unknown>>;
 *   customers?: Array<Record<string, unknown>>;
 *   deliveries?: Array<Record<string, unknown>>;
 *   itemCatalogItems?: Array<Record<string, unknown>>;
 *   onPageChange?: (pageId: string) => void;
 *   onTraceSearch?: (searchValue: string) => void;
 *   salesOrders?: Array<Record<string, unknown>>;
 *   stockingHandbookItems?: Array<Record<string, unknown>>;
 *   supplierRuns?: Array<Record<string, unknown>>;
 *   theirTruckPOs?: Array<Record<string, unknown>>;
 * }} props
 */
export default function NewHomePage({
  checkIns = [],
  currentUser = null,
  customers = [],
  deliveries = [],
  itemCatalogItems = [],
  onPageChange,
  onTraceSearch,
  salesOrders = [],
  stockingHandbookItems = [],
  supplierRuns = [],
  theirTruckPOs = [],
}) {
  const [searchValue, setSearchValue] = useState("");
  const firstName = useMemo(() => getFirstName(currentUser), [currentUser]);
  const greeting = useMemo(() => getDayGreeting(), []);
  const hasSearchValue = searchValue.trim().length > 0;
  const searchResults = useMemo(
    () =>
      buildOverviewSearchResults({
        searchValue,
        checkIns,
        supplierRuns,
        theirTruckPOs,
        deliveries,
        salesOrders,
        customers,
        stockingHandbookItems,
        itemCatalogItems,
      }),
    [
      checkIns,
      customers,
      deliveries,
      itemCatalogItems,
      salesOrders,
      searchValue,
      stockingHandbookItems,
      supplierRuns,
      theirTruckPOs,
    ],
  );

  function handleSubmit(event) {
    event.preventDefault();

    const nextSearchValue = searchValue.trim();

    if (!nextSearchValue) {
      return;
    }

    if (onTraceSearch) {
      onTraceSearch(nextSearchValue);
      return;
    }

    onPageChange?.("trace");
  }

  return (
    <PageContainer className="max-w-5xl">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
        <p className="text-sm font-black uppercase tracking-[0.32em] text-red-500">
          Overview
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-normal text-slate-950 sm:text-5xl">
          Hello {firstName}, good {greeting}.
        </h1>

        <form className="mt-8" onSubmit={handleSubmit}>
          <label
            className="mb-3 block text-sm font-black uppercase tracking-[0.24em] text-slate-500"
            htmlFor="new-home-search"
          >
            Search
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 shadow-inner focus-within:border-red-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-500/10">
            <Search className="h-6 w-6 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              id="new-home-search"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search PO, order, customer, vendor, or item..."
              className="min-h-[44px] flex-1 bg-transparent text-lg font-bold text-slate-950 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!searchValue.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              aria-label="Search"
            >
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>

        {hasSearchValue ? (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Quick Results
              </p>
              <p className="text-xs font-black text-slate-400">
                {searchResults.length} found
              </p>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid gap-2">
                {searchResults.map((result) => {
                  const ResultIcon = result.icon;

                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => onTraceSearch?.(String(result.traceValue || searchValue))}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-red-200 hover:bg-red-50/20"
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${result.tone}`}
                      >
                        <ResultIcon
                          aria-hidden="true"
                          className="h-5 w-5"
                          strokeWidth={2.5}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-red-500">
                            {result.type}
                          </span>
                          {result.timestamp ? (
                            <span className="text-xs font-bold text-slate-400">
                              {formatDateTime(result.timestamp)}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-base font-black text-slate-950">
                          {result.title}
                        </span>
                        {result.description ? (
                          <span className="mt-0.5 block truncate text-sm font-bold text-slate-500">
                            {result.description}
                          </span>
                        ) : null}
                        {result.itemSummary?.visibleItems?.length > 0 ? (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {result.itemSummary.visibleItems.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600"
                              >
                                <span className="truncate">
                                  {[item.label, item.detail].filter(Boolean).join(" • ")}
                                </span>
                              </span>
                            ))}
                            {result.itemSummary.hiddenCount > 0 ? (
                              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-black text-slate-500">
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
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                No quick matches yet. Press Enter to search the full PO chain.
              </div>
            )}
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
}
