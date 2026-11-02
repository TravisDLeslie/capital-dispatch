import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { getPOReceivingSummary } from "../utils/poReceivingSummary";
import { formatCustomerName } from "../utils/textFormatters";

const pathLabels = {
  south: "South pickup",
  wePickup: "South pickup",
  supplierDelivery: "Their Truck",
  theirTruck: "Their Truck",
  pod: "POD / Will Call",
  podPickup: "POD / Will Call",
  stock: "Stock",
  inStock: "From Capital Lumber Yard",
};

function normalizeOrderNumber(value) {
  const cleanValue = String(value || "").trim();
  const digits = cleanValue.replace(/\D/g, "");

  return digits || cleanValue.toLowerCase();
}

function uniqueValues(values) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function getRecordItems(record) {
  return [
    ...(Array.isArray(record?.items) ? record.items : []),
    ...(Array.isArray(record?.materials) ? record.materials : []),
  ];
}

function recordMatchesOrder(record, orderKey) {
  if (!record || !orderKey) {
    return false;
  }

  const recordOrderNumbers = [
    record.orderNumber,
    record.sourceOrderNumber,
    record.orderAssignment?.orderNumber,
    ...getRecordItems(record).map((item) => item?.orderNumber),
  ];

  return recordOrderNumbers.some(
    (orderNumber) => normalizeOrderNumber(orderNumber) === orderKey,
  );
}

function formatOrderDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(
    String(value).length === 10 ? `${value}T12:00:00` : value,
  );

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getItemKey(item, index) {
  return (
    item?.id ||
    [item?.poNumber, item?.description, item?.quantity, index]
      .filter(Boolean)
      .join("-")
  );
}

function getItemDescription(item) {
  return String(
    item?.description ||
      item?.materialDescription ||
      item?.itemDescription ||
      item?.name ||
      "Item description not entered",
  ).trim();
}

function normalizeItemDescription(item) {
  return getItemDescription(item).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export default function OrderDetailsModal({
  orderNumber,
  sources = {},
  onClose,
}) {
  const orderDetails = useMemo(() => {
    const orderKey = normalizeOrderNumber(orderNumber);
    const orderBuilds = Array.isArray(sources.orderBuilds)
      ? sources.orderBuilds
      : [];
    const sourceRecords = [
      ...(Array.isArray(sources.supplierRuns) ? sources.supplierRuns : []),
      ...(Array.isArray(sources.theirTruckPOs) ? sources.theirTruckPOs : []),
      ...(Array.isArray(sources.deliveries) ? sources.deliveries : []),
      ...(Array.isArray(sources.checkIns) ? sources.checkIns : []),
      ...orderBuilds,
    ];
    const matchingRecords = sourceRecords.filter((record) =>
      recordMatchesOrder(record, orderKey),
    );
    const orderBuild = orderBuilds.find(
      (record) => normalizeOrderNumber(record?.orderNumber) === orderKey,
    );
    const delivery = (Array.isArray(sources.deliveries)
      ? sources.deliveries
      : []
    ).find((record) => normalizeOrderNumber(record?.orderNumber) === orderKey);
    const primaryRecord = orderBuild || delivery || matchingRecords[0] || {};
    const primaryItems = getRecordItems(orderBuild);
    const relatedItems = matchingRecords.flatMap((record) =>
      getRecordItems(record)
        .filter(
          (item) =>
            !item?.orderNumber ||
            normalizeOrderNumber(item.orderNumber) === orderKey,
        )
        .map((item) => ({
          ...item,
          poNumber:
            item?.poNumber ||
            record?.poNumber ||
            record?.sourceSupplierRunPoNumber ||
            record?.sourceTheirTruckPONumber ||
            "",
          vendor:
            item?.vendor ||
            record?.vendor ||
            record?.vendorName ||
            record?.supplierName ||
            "",
          expectedDate:
            item?.routeDate ||
            item?.supplierDate ||
            item?.deliveryDate ||
            record?.scheduledDate ||
            record?.pickupDate ||
            record?.deliveryDate ||
            record?.routeDate ||
            "",
        })),
    );
    const rawItems =
      primaryItems.length > 0
        ? primaryItems.map((item) => {
            if (item?.poNumber) {
              return item;
            }

            const linkedPOItem = relatedItems.find(
              (candidate) =>
                candidate?.poNumber &&
                normalizeItemDescription(candidate) ===
                  normalizeItemDescription(item),
            );

            return linkedPOItem
              ? {
                  ...item,
                  poNumber: linkedPOItem.poNumber,
                  vendor: item?.vendor || linkedPOItem.vendor,
                  expectedDate:
                    item?.expectedDate || linkedPOItem.expectedDate,
                }
              : item;
          })
        : relatedItems;
    const seenItemKeys = new Set();
    const items = rawItems.filter((item, index) => {
      const itemKey = String(getItemKey(item, index)).toLowerCase();

      if (seenItemKeys.has(itemKey)) {
        return false;
      }

      seenItemKeys.add(itemKey);
      return true;
    });
    const poNumbers = uniqueValues([
      primaryRecord.poNumbers,
      ...items.map((item) => item?.poNumber),
      ...matchingRecords.map((record) => record?.poNumber),
    ]);
    const customerItem = items.find(
      (item) =>
        item?.businessName ||
        item?.customerName ||
        item?.deliveryAddress ||
        item?.address,
    );
    const checkIns = Array.isArray(sources.checkIns) ? sources.checkIns : [];
    const receivingSummaries = poNumbers.map((poNumber) => {
      const expectedItems = items.filter(
        (item) =>
          normalizeOrderNumber(item?.poNumber) ===
          normalizeOrderNumber(poNumber),
      );
      const summary = getPOReceivingSummary(
        checkIns,
        poNumber,
        expectedItems.length,
      );
      const receivedDescriptions = new Set(
        summary.receivedItems.map((item) =>
          normalizeItemDescription(item),
        ),
      );
      const waitingItems = summary.isReceived
        ? summary.isPartial
          ? expectedItems.filter(
              (item) => !receivedDescriptions.has(normalizeItemDescription(item)),
            )
          : []
        : expectedItems;

      return {
        poNumber,
        ...summary,
        expectedItems,
        waitingItems,
      };
    });

    return {
      ...primaryRecord,
      orderNumber: primaryRecord.orderNumber || orderNumber,
      businessName:
        primaryRecord.businessName ||
        delivery?.businessName ||
        delivery?.customerName ||
        matchingRecords.find((record) => record?.businessName)?.businessName ||
        customerItem?.businessName ||
        "",
      customerName:
        primaryRecord.customerName ||
        delivery?.customerName ||
        matchingRecords.find((record) => record?.customerName)?.customerName ||
        customerItem?.customerName ||
        "",
      phoneNumber:
        primaryRecord.phoneNumber ||
        primaryRecord.phone ||
        delivery?.phoneNumber ||
        delivery?.phone ||
        "",
      deliveryAddress:
        primaryRecord.deliveryAddress ||
        primaryRecord.address ||
        delivery?.deliveryAddress ||
        delivery?.address ||
        customerItem?.deliveryAddress ||
        customerItem?.address ||
        "",
      deliveryDate:
        primaryRecord.deliveryDate || delivery?.deliveryDate || "",
      handoffType:
        primaryRecord.handoffType ||
        primaryRecord.orderMethod ||
        delivery?.handoffType ||
        "",
      items,
      poNumbers,
      receivingSummaries,
      found: Boolean(orderBuild || delivery || matchingRecords.length),
    };
  }, [orderNumber, sources]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!orderNumber) {
    return null;
  }

  const customerTitle =
    formatCustomerName(orderDetails.businessName) ||
    formatCustomerName(orderDetails.customerName) ||
    "Customer not entered";
  const fulfillmentLabel =
    pathLabels[orderDetails.handoffType] ||
    (orderDetails.handoffType === "delivery"
      ? "Customer delivery"
      : orderDetails.handoffType === "willCall"
        ? "Will Call"
        : orderDetails.handoffType || "Order");

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-order-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Complete Order
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2
                id="dashboard-order-modal-title"
                className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl"
              >
                Order {orderDetails.orderNumber || orderNumber}
              </h2>
              {orderDetails.poNumbers.map((poNumber) => (
                <span
                  key={poNumber}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-blue-700"
                >
                  PO {poNumber}
                </span>
              ))}
            </div>
            <p className="mt-1 truncate text-base font-bold text-slate-500">
              {customerTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
            aria-label="Close complete order"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          {!orderDetails.found ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              The linked order number was found on the PO, but the full saved
              order record is not available.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Customer / Job
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {customerTitle}
              </p>
              {orderDetails.customerName &&
              orderDetails.customerName !== orderDetails.businessName ? (
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {formatCustomerName(orderDetails.customerName)}
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Fulfillment
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-black text-slate-950">
                <Truck className="h-4 w-4 text-[#FC2C38]" aria-hidden="true" />
                {fulfillmentLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Phone
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-black text-slate-950">
                <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
                {orderDetails.phoneNumber || "Not entered"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Account
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {orderDetails.accountNumber || "Not entered"}
              </p>
            </div>
          </div>

          {orderDetails.deliveryAddress || orderDetails.deliveryDate ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Delivery Address
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {orderDetails.deliveryAddress || "Address not entered"}
                </p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Delivery Date
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {formatOrderDate(orderDetails.deliveryDate) || "Not scheduled"}
                </p>
              </div>
            </div>
          ) : null}

          {orderDetails.receivingSummaries.length > 0 ? (
            <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className="h-5 w-5 text-emerald-700"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Receiving
                  </p>
                  <h3 className="text-base font-black text-slate-950">
                    PO receiving details
                  </h3>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {orderDetails.receivingSummaries.map((summary) => (
                  <div
                    key={`receiving-${summary.poNumber}`}
                    className="rounded-xl border border-white bg-white p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.08em] text-blue-700">
                        PO {summary.poNumber}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                          summary.isReceived
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {summary.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-600">
                      {summary.receivedDateLabel ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          {summary.receivedDateLabel}
                        </span>
                      ) : null}
                      {summary.locationLabel ? (
                        <span className="inline-flex items-center gap-1.5 text-blue-700">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {summary.locationLabel}
                        </span>
                      ) : null}
                      {summary.receivedItemCount > 0 ? (
                        <span>
                          {summary.receivedItemCount} received {summary.receivedItemCount === 1 ? "item" : "items"}
                        </span>
                      ) : null}
                    </div>

                    {summary.receivedItems.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                          Received items
                        </p>
                        <div className="mt-1.5 grid gap-1.5">
                          {summary.receivedItems.map((item, index) => (
                            <div
                              key={item.id || `received-${index}`}
                              className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs"
                            >
                              <span className="min-w-0 font-bold text-slate-800">
                                {item.quantity ? `QTY ${item.quantity} · ` : ""}
                                {item.description}
                              </span>
                              {item.location ? (
                                <span className="shrink-0 font-black text-blue-700">
                                  {item.location}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {summary.waitingItems.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
                          Waiting on items
                        </p>
                        <div className="mt-1.5 grid gap-1.5">
                          {summary.waitingItems.map((item, index) => (
                            <div
                              key={getItemKey(item, index)}
                              className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-bold text-slate-800"
                            >
                              {item?.quantity ? `QTY ${item.quantity} · ` : ""}
                              {getItemDescription(item)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {summary.receivedItems.length === 0 &&
                    summary.waitingItems.length === 0 ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-500">
                        No item details are linked to this PO yet.
                      </p>
                    ) : null}

                    {summary.receivingPhotos.length > 0 ? (
                      <div className="mt-3 flex gap-2">
                        {summary.receivingPhotos.slice(0, 3).map((photo) => (
                          <img
                            key={photo.id || photo.dataUrl}
                            src={photo.dataUrl}
                            alt={photo.title || `Receiving photo for PO ${summary.poNumber}`}
                            className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                          />
                        ))}
                        {summary.receivingPhotos.length > 3 ? (
                          <span className="flex h-14 min-w-14 items-center justify-center rounded-lg bg-slate-100 px-2 text-xs font-black text-slate-600">
                            +{summary.receivingPhotos.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                Entire Order
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
                {orderDetails.items.length} {orderDetails.items.length === 1 ? "item" : "items"}
              </h3>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Package className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          {orderDetails.items.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {orderDetails.items.map((item, index) => {
                const path = item?.path || item?.fulfillment || "";
                const itemDate =
                  item?.routeDate ||
                  item?.supplierDate ||
                  item?.deliveryDate ||
                  item?.expectedDate;
                const receivingSummary = orderDetails.receivingSummaries.find(
                  (summary) =>
                    normalizeOrderNumber(summary.poNumber) ===
                    normalizeOrderNumber(item?.poNumber),
                );
                const matchedReceivedItem =
                  receivingSummary?.receivedItems.find(
                    (receivedItem) =>
                      normalizeItemDescription(receivedItem) ===
                      normalizeItemDescription(item),
                  );
                const isItemReceived = Boolean(
                  matchedReceivedItem ||
                    (receivingSummary?.isReceived &&
                      !receivingSummary?.isPartial),
                );
                const receivedLocation =
                  matchedReceivedItem?.location ||
                  (isItemReceived ? receivingSummary?.locationLabel : "");

                return (
                  <div
                    key={getItemKey(item, index)}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-black text-slate-950">
                          {item?.quantity ? `QTY ${item.quantity} · ` : ""}
                          {item?.description ||
                            item?.materialDescription ||
                            item?.name ||
                            "Item description not entered"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {path ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-700">
                              {pathLabels[path] || path}
                            </span>
                          ) : null}
                          {item?.vendor ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-800">
                              {item.vendor}
                            </span>
                          ) : null}
                          {item?.poNumber ? (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-blue-700">
                              PO {item.poNumber}
                            </span>
                          ) : null}
                          {receivingSummary ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                                isItemReceived
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {isItemReceived ? (
                                <CheckCircle2
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              ) : null}
                              {isItemReceived ? "Received" : "Waiting"}
                              {receivedLocation ? ` · ${receivedLocation}` : ""}
                              {!isItemReceived && itemDate
                                ? ` · ${formatOrderDate(itemDate)}`
                                : ""}
                            </span>
                          ) : null}
                          {itemDate && (!receivingSummary || isItemReceived) ? (
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-violet-700">
                              {formatOrderDate(itemDate)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-black uppercase tracking-[0.1em] text-slate-400">
                        Item {index + 1}
                      </span>
                    </div>
                    {item?.driverNotes || item?.supplierNote || item?.notes ? (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                        {item.driverNotes || item.supplierNote || item.notes}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
              No item details were saved with this order.
            </div>
          )}

          {orderDetails.deliveryNotes || orderDetails.notes ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                Order Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-amber-950">
                {orderDetails.deliveryNotes || orderDetails.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
