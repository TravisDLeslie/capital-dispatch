import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ClipboardCheck,
  Package,
  Route,
  Search,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
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
    return "Time not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) {
    return "";
  }

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getItemText(item) {
  return [item.quantity, item.description].filter(Boolean).join(" ");
}

function getAssignment(checkIn) {
  if (checkIn.orderAssignment?.type) {
    return checkIn.orderAssignment;
  }

  if (checkIn.customer?.businessName) {
    return checkIn.customer;
  }

  return null;
}

function getSearchableText(record) {
  return normalizeText(
    [
      record.poNumber,
      record.sourceSupplierRunPoNumber,
      record.orderNumber,
      record.vendor,
      record.customerName,
      record.supplierAddress,
      record.driver,
      record.checkedInBy,
      record.poLocation,
      record.deliveryAddress,
      record.contactName,
      record.phoneNumber,
      record.generalNotes,
      record.deliveryLocationNotes,
      record.createdByName,
      record.orderedBy,
      record.orderAssignment?.businessName,
      record.orderAssignment?.orderedBy,
      record.orderAssignment?.jobName,
      record.orderAssignment?.internalReference,
      ...(Array.isArray(record.items)
        ? record.items.flatMap((item) => [
            item.quantity,
            item.description,
            item.internalReference,
            item.orderNumber,
            item.customerName,
            item.returnNotes,
          ])
        : []),
      ...(Array.isArray(record.materials)
        ? record.materials.flatMap((material) => [
            material.description,
            material.location,
            material.notes,
          ])
        : []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function recordMatchesSearch(record, searchValue) {
  const textSearch = normalizeText(searchValue);
  const numberSearch = normalizeNumber(searchValue);

  if (!textSearch) {
    return false;
  }

  const textMatches = getSearchableText(record).includes(textSearch);
  const numberMatches =
    numberSearch.length > 0 &&
    [
      record.poNumber,
      record.sourceSupplierRunPoNumber,
      record.orderNumber,
      ...(Array.isArray(record.items)
        ? record.items.flatMap((item) => [
            item.orderNumber,
            item.internalReference,
          ])
        : []),
      record.orderAssignment?.internalReference,
    ]
      .filter(Boolean)
      .some((value) => normalizeNumber(value).includes(numberSearch));

  return textMatches || numberMatches;
}

function makeEvent({
  id,
  type,
  title,
  description,
  timestamp,
  meta = [],
  recordType,
  recordId,
}) {
  return {
    id,
    type,
    title,
    description,
    timestamp,
    meta: meta.filter(Boolean),
    recordType,
    recordId,
  };
}

function getEventTone(type) {
  if (type === "south") {
    return {
      icon: Route,
      dot: "bg-blue-600",
      badge: "bg-blue-50 text-blue-700",
      border: "border-blue-100",
    };
  }

  if (type === "delivery") {
    return {
      icon: Truck,
      dot: "bg-amber-600",
      badge: "bg-amber-50 text-amber-800",
      border: "border-amber-100",
    };
  }

  return {
    icon: ClipboardCheck,
    dot: "bg-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-100",
  };
}

/**
 * @param {{
 *   checkIns?: Array<Record<string, any>>;
 *   supplierRuns?: Array<Record<string, any>>;
 *   deliveries?: Array<Record<string, any>>;
 *   initialSearch?: string;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function TracePage({
  checkIns = [],
  supplierRuns = [],
  deliveries = [],
  initialSearch = "",
  onPageChange,
}) {
  const [searchValue, setSearchValue] = useState(initialSearch);
  const hasSearch = searchValue.trim().length > 0;

  useEffect(() => {
    setSearchValue(initialSearch);
  }, [initialSearch]);

  const traceResults = useMemo(() => {
    if (!hasSearch) {
      return {
        supplierRuns: [],
        checkIns: [],
        deliveries: [],
        events: [],
      };
    }

    const matchedSupplierRuns = supplierRuns.filter((supplierRun) =>
      recordMatchesSearch(supplierRun, searchValue),
    );
    const matchedSupplierRunIds = new Set(
      matchedSupplierRuns.map((supplierRun) => supplierRun.id),
    );
    const matchedPoNumbers = new Set(
      matchedSupplierRuns
        .map((supplierRun) => normalizeNumber(supplierRun.poNumber))
        .filter(Boolean),
    );

    const matchedCheckIns = checkIns.filter((checkIn) => {
      const linkedSouthRunMatches =
        checkIn.sourceSupplierRunId &&
        matchedSupplierRunIds.has(checkIn.sourceSupplierRunId);
      const linkedPoMatches =
        normalizeNumber(checkIn.sourceSupplierRunPoNumber) &&
        matchedPoNumbers.has(normalizeNumber(checkIn.sourceSupplierRunPoNumber));

      return (
        recordMatchesSearch(checkIn, searchValue) ||
        linkedSouthRunMatches ||
        linkedPoMatches
      );
    });

    const matchedDeliveries = deliveries.filter((delivery) =>
      recordMatchesSearch(delivery, searchValue),
    );

    const events = [
      ...matchedSupplierRuns.flatMap((supplierRun) => {
        const items = Array.isArray(supplierRun.items)
          ? supplierRun.items
          : [];
        const pickedItems = items.filter((item) => item.pickedUp);

        return [
          makeEvent({
            id: `south-created-${supplierRun.id}`,
            type: "south",
            title: `South PO ${supplierRun.poNumber}`,
            description: supplierRun.driver
              ? `${supplierRun.vendor || "Supplier"} pickup was added and assigned to ${supplierRun.driver}.`
              : `${supplierRun.vendor || "Supplier"} pickup was added.`,
            timestamp: supplierRun.createdAt,
            meta: [
              supplierRun.scheduledDate
                ? `Route date ${formatDateOnly(supplierRun.scheduledDate)}`
                : "",
              supplierRun.driver ? `Driver ${supplierRun.driver}` : "",
              supplierRun.vehicleTitle || supplierRun.vehicleBadge
                ? `Truck ${[
                    supplierRun.vehicleTitle,
                    supplierRun.vehicleBadge,
                  ]
                    .filter(Boolean)
                    .join(" ")}`
                : "",
              supplierRun.createdByName
                ? `Created by ${supplierRun.createdByName}`
                : "",
              supplierRun.orderedBy ? `Ordered by ${supplierRun.orderedBy}` : "",
              supplierRun.customerName
                ? `Customer ${formatCustomerName(supplierRun.customerName)}`
                : "",
              `${items.length} ${items.length === 1 ? "item" : "items"}`,
            ],
            recordType: "south",
            recordId: supplierRun.id,
          }),
          ...pickedItems.map((item) =>
            makeEvent({
              id: `south-picked-${supplierRun.id}-${item.id}`,
              type: "south",
              title:
                item.materialUse === "return"
                  ? "Item returned"
                  : item.materialUse === "swap"
                    ? "Item swapped"
                    : "Item picked up",
              description:
                getItemText(item) || `PO ${supplierRun.poNumber} item`,
              timestamp: item.pickedUpAt || supplierRun.updatedAt,
              meta: [
                supplierRun.vendor,
                item.orderNumber ? `Order ${item.orderNumber}` : "",
                item.customerName
                  ? `Customer ${formatCustomerName(item.customerName)}`
                  : "",
                item.pickupPhoto?.dataUrl ? "Photo saved" : "",
              ],
              recordType: "south",
              recordId: supplierRun.id,
            }),
          ),
          supplierRun.status === "complete" || supplierRun.completedAt
            ? makeEvent({
                id: `south-complete-${supplierRun.id}`,
                type: "south",
                title: "South PO complete",
                description: `PO ${supplierRun.poNumber} was completed.`,
                timestamp: supplierRun.completedAt || supplierRun.updatedAt,
                meta: [supplierRun.vendor, supplierRun.driver],
                recordType: "south",
                recordId: supplierRun.id,
              })
            : null,
        ].filter(Boolean);
      }),
      ...matchedCheckIns.map((checkIn) => {
        const assignment = getAssignment(checkIn);

        return makeEvent({
          id: `receiving-${checkIn.id}`,
          type: "receiving",
          title: `Received PO ${checkIn.poNumber}`,
          description: `${checkIn.vendor || "Vendor"} checked in by ${
            checkIn.checkedInBy || "receiving"
          }.`,
          timestamp: checkIn.checkedInAt,
          meta: [
            checkIn.poLocation,
            checkIn.sourceType === "south" ? "Linked from South" : "",
            assignment?.businessName
              ? `Customer ${formatCustomerName(assignment.businessName)}`
              : "",
            Array.isArray(checkIn.materials)
              ? `${checkIn.materials.length} ${
                  checkIn.materials.length === 1 ? "material" : "materials"
                }`
              : "",
          ],
          recordType: "receiving",
          recordId: checkIn.id,
        });
      }),
      ...matchedDeliveries.map((delivery) =>
        makeEvent({
          id: `delivery-${delivery.id}`,
          type: "delivery",
          title: `Delivery order ${delivery.orderNumber}`,
          description: `${formatCustomerName(
            delivery.customerName || "Customer",
          )} ${delivery.status === "complete" ? "was delivered" : "is scheduled"}.`,
          timestamp:
            delivery.deliveredAt ||
            delivery.scheduledStartAt ||
            delivery.updatedAt ||
            delivery.createdAt,
          meta: [
            delivery.driver ? `Driver ${delivery.driver}` : "",
            delivery.deliveryAddress,
            delivery.status === "complete" ? "Complete" : "Open",
            delivery.hasHardware ? "Hardware" : "",
          ],
          recordType: "delivery",
          recordId: delivery.id,
        }),
      ),
    ]
      .filter(Boolean)
      .sort(
        (firstEvent, secondEvent) =>
          new Date(firstEvent.timestamp || 0) -
          new Date(secondEvent.timestamp || 0),
      );

    return {
      supplierRuns: matchedSupplierRuns,
      checkIns: matchedCheckIns,
      deliveries: matchedDeliveries,
      events,
    };
  }, [checkIns, deliveries, hasSearch, searchValue, supplierRuns]);

  const totalMatches =
    traceResults.supplierRuns.length +
    traceResults.checkIns.length +
    traceResults.deliveries.length;

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Receiving", onClick: () => onPageChange?.("receiving") },
          { label: "Trace PO / Order" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Activity Trace
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Trace PO / Order
        </h2>

        <p className="mt-2 max-w-3xl text-slate-500">
          Search a PO, order number, customer, vendor, item, or SKU to see the
          chain across South pickups, receiving, and deliveries.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="trace-search"
          className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search
        </label>

        <input
          id="trace-search"
          type="search"
          autoComplete="off"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search PO, order #, customer, vendor, item, SKU..."
          className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-bold text-slate-900 outline-none transition placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        />

        {hasSearch ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {totalMatches} matching records • {traceResults.events.length}{" "}
            timeline events
          </p>
        ) : null}
      </div>

      {!hasSearch ? (
        <EmptyState
          title="Search a PO or order"
          description="Try a PO like 440-952, an order number, customer name, vendor, item description, or SKU."
        />
      ) : null}

      {hasSearch && totalMatches === 0 ? (
        <EmptyState
          title="No chain found"
          description="Try searching with just the PO number, just the order number, or fewer words."
        />
      ) : null}

      {totalMatches > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Matches
              </p>

              <div className="mt-4 grid gap-2">
                <SummaryPill
                  icon={Route}
                  label="South POs"
                  value={traceResults.supplierRuns.length}
                />
                <SummaryPill
                  icon={ClipboardCheck}
                  label="Receiving"
                  value={traceResults.checkIns.length}
                />
                <SummaryPill
                  icon={Truck}
                  label="Deliveries"
                  value={traceResults.deliveries.length}
                />
              </div>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Timeline
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">
                  Chain of Events
                </h3>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                Oldest first
              </span>
            </div>

            <div className="relative space-y-4 before:absolute before:bottom-0 before:left-4 before:top-0 before:w-px before:bg-slate-200">
              {traceResults.events.map((event) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  onPageChange={onPageChange}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </PageContainer>
  );
}

function SummaryPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
      <span className="flex items-center gap-2 text-sm font-black text-slate-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-900 shadow-sm">
        {value}
      </span>
    </div>
  );
}

function TimelineEvent({ event, onPageChange }) {
  const tone = getEventTone(event.type);
  const Icon = tone.icon;
  const destination =
    event.recordType === "south"
      ? "supplier-runs-check"
      : event.recordType === "delivery"
        ? "deliveries-queue"
        : "search";

  return (
    <article className="relative pl-10">
      <span
        className={`absolute left-[9px] top-5 h-3.5 w-3.5 rounded-full ring-4 ring-white ${tone.dot}`}
        aria-hidden="true"
      />

      <div className={`rounded-2xl border ${tone.border} bg-white p-4 shadow-sm`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${tone.badge}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {event.type}
            </p>

            <h4 className="mt-3 text-xl font-black text-slate-900">
              {event.title}
            </h4>

            <p className="mt-1 font-semibold text-slate-600">
              {event.description}
            </p>
          </div>

          <p className="shrink-0 text-sm font-black text-slate-500">
            {formatDateTime(event.timestamp)}
          </p>
        </div>

        {event.meta.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {event.meta.map((metaItem) => (
              <span
                key={metaItem}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
              >
                {metaItem}
              </span>
            ))}
          </div>
        ) : null}

        {onPageChange ? (
          <button
            type="button"
            onClick={() => onPageChange(destination)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#FC2C38] transition hover:text-red-700"
          >
            Open related view
            <Package className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}
