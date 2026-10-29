import { useMemo, useState } from "react";
import {
  CalendarDays,
  MapPin,
  Package,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import { formatCustomerName } from "../utils/textFormatters";

const shipmentTypes = {
  wePickup: {
    label: "South",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  supplierDelivery: {
    label: "Their Truck",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  pod: {
    label: "POD",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  inStock: {
    label: "Stock",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) {
    return "Date not set";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getDeliveryOrderBuild(delivery, orderBuilds) {
  const sourceOrderId = normalizeValue(delivery?.sourceOrderId);
  const orderNumber = normalizeValue(
    delivery?.sourceOrderNumber || delivery?.orderNumber,
  );

  return (
    orderBuilds.find(
      (build) =>
        sourceOrderId &&
        [build?.orderId, build?.sourceOrderId].some(
          (value) => normalizeValue(value) === sourceOrderId,
        ),
    ) ||
    orderBuilds.find(
      (build) =>
        orderNumber && normalizeValue(build?.orderNumber) === orderNumber,
    ) ||
    null
  );
}

function getBuildItems(build) {
  if (!build) {
    return [];
  }

  return [
    ...(Array.isArray(build.waitingItems) ? build.waitingItems : []),
    ...(Array.isArray(build.stockItems) ? build.stockItems : []),
  ];
}

function getMatchingBuildItem(deliveryItem, buildItems) {
  const itemId = normalizeValue(deliveryItem?.id);
  const description = normalizeValue(deliveryItem?.description);

  return (
    buildItems.find(
      (item) => itemId && normalizeValue(item?.id) === itemId,
    ) ||
    buildItems.find(
      (item) =>
        description && normalizeValue(item?.description) === description,
    ) ||
    null
  );
}

function getShipmentType(deliveryItem, buildItems) {
  const matchingBuildItem = getMatchingBuildItem(deliveryItem, buildItems);
  const path = String(
    deliveryItem?.fulfillmentPath ||
      deliveryItem?.path ||
      matchingBuildItem?.path ||
      "",
  ).trim();

  return shipmentTypes[path] || null;
}

function getItemVendor(deliveryItem, buildItems) {
  const matchingBuildItem = getMatchingBuildItem(deliveryItem, buildItems);

  return String(deliveryItem?.vendor || matchingBuildItem?.vendor || "").trim();
}

function getQueuedDeliveries(deliveries) {
  return (Array.isArray(deliveries) ? deliveries : [])
    .filter(
      (delivery) =>
        delivery &&
        typeof delivery === "object" &&
        !isDeliveryComplete(delivery) &&
        (delivery.dispatchStatus === "needsDispatch" || !delivery.driver),
    )
    .sort((first, second) => {
      const firstDate = String(first.deliveryDate || "9999-99-99");
      const secondDate = String(second.deliveryDate || "9999-99-99");

      if (firstDate !== secondDate) {
        return firstDate.localeCompare(secondDate);
      }

      return String(first.customerName || "").localeCompare(
        String(second.customerName || ""),
      );
    });
}

function ShipmentBadge({ shipmentType }) {
  if (!shipmentType) {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
        Source not set
      </span>
    );
  }

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] ${shipmentType.className}`}
    >
      {shipmentType.label}
    </span>
  );
}

function DeliveryCard({ delivery, orderBuilds }) {
  const build = getDeliveryOrderBuild(delivery, orderBuilds);
  const buildItems = getBuildItems(build);
  const items = Array.isArray(delivery.items) ? delivery.items : [];

  return (
    <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-slate-200 bg-slate-50/80 p-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Order {delivery.orderNumber || "Not entered"}
            </p>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-800">
              Awaiting dispatch
            </span>
          </div>
          <h2 className="mt-2 truncate text-2xl font-black text-slate-950">
            {formatCustomerName(delivery.customerName) || "No customer name"}
          </h2>
        </div>

        <div className="grid gap-2 text-sm font-bold text-slate-600 sm:grid-cols-2 lg:grid-cols-1">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-600" aria-hidden="true" />
            {formatDate(delivery.deliveryDate)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <span className="truncate">{delivery.address || "Address not entered"}</span>
          </span>
        </div>

      </div>

      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Material on this delivery
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Incoming shipment source is shown on every item.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-black text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              {delivery.unloadType || "Normal"}
            </span>
            {delivery.needsTarp ? (
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                Tarp
              </span>
            ) : null}
          </div>
        </div>

        {items.length > 0 ? (
          <div className="grid gap-2">
            {items.map((item, index) => {
              const shipmentType = getShipmentType(item, buildItems);
              const vendor = getItemVendor(item, buildItems);

              return (
                <div
                  key={item.id || `${delivery.id}-item-${index}`}
                  className="grid gap-3 rounded-2xl border border-slate-200 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                >
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-950 px-2 text-sm font-black text-white">
                    {item.quantity || index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-slate-900">
                      {item.description || "Delivery item"}
                    </p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      Vendor: {vendor || "Not entered"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <ShipmentBadge shipmentType={shipmentType} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500">
            No item details were added to this delivery.
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * @param {{
 *   deliveries?: Array<Record<string, any>>;
 *   orderBuilds?: Array<Record<string, any>>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function QueuedUpcomingDeliveriesPage({
  deliveries = [],
  orderBuilds = [],
  onPageChange,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const queuedDeliveries = useMemo(
    () => getQueuedDeliveries(deliveries),
    [deliveries],
  );
  const visibleDeliveries = useMemo(() => {
    const query = normalizeValue(searchTerm);

    if (!query) {
      return queuedDeliveries;
    }

    return queuedDeliveries.filter((delivery) =>
      [
        delivery.orderNumber,
        delivery.customerName,
        delivery.address,
        ...(Array.isArray(delivery.items)
          ? delivery.items.map((item) => item?.description)
          : []),
      ].some((value) => normalizeValue(value).includes(query)),
    );
  }, [queuedDeliveries, searchTerm]);

  const shipmentCounts = useMemo(() => {
    const counts = { south: 0, theirTruck: 0 };

    queuedDeliveries.forEach((delivery) => {
      const buildItems = getBuildItems(
        getDeliveryOrderBuild(delivery, orderBuilds),
      );

      (Array.isArray(delivery.items) ? delivery.items : []).forEach((item) => {
        const shipmentType = getShipmentType(item, buildItems)?.label;

        if (shipmentType === "South") counts.south += 1;
        if (shipmentType === "Their Truck") counts.theirTruck += 1;
      });
    });

    return counts;
  }, [queuedDeliveries, orderBuilds]);

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Deliveries", onClick: () => onPageChange?.("deliveries") },
          { label: "Queued Upcoming Deliveries" },
        ]}
      />

      <div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Before Dispatch
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Queued Upcoming Deliveries
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold leading-7 text-slate-500">
            Review every delivery that has been set up and is still waiting for
            a driver and truck. No map—just the delivery and material details.
          </p>
        </div>

      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
            Waiting
          </p>
          <p className="mt-2 text-4xl font-black text-slate-950">
            {queuedDeliveries.length}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-600">
            Deliveries not dispatched
          </p>
        </div>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-red-700">
                South
              </p>
              <p className="mt-2 text-4xl font-black text-slate-950">
                {shipmentCounts.south}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                Material lines
              </p>
            </div>
            <Truck className="h-8 w-8 text-red-500" aria-hidden="true" />
          </div>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                Their Truck
              </p>
              <p className="mt-2 text-4xl font-black text-slate-950">
                {shipmentCounts.theirTruck}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                Material lines
              </p>
            </div>
            <Warehouse className="h-8 w-8 text-blue-500" aria-hidden="true" />
          </div>
        </div>
      </div>

      <label className="relative mt-6 block">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search order, customer, address, or item..."
          className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        />
      </label>

      <section className="mt-5 grid gap-4">
        {visibleDeliveries.length > 0 ? (
          visibleDeliveries.map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              orderBuilds={orderBuilds}
            />
          ))
        ) : (
          <EmptyState
            icon={searchTerm ? Search : Package}
            title={searchTerm ? "No queued deliveries match" : "The queue is clear"}
            description={
              searchTerm
                ? "Try another order number, customer, address, or item."
                : "Deliveries that still need dispatch will appear here as soon as they are created."
            }
          />
        )}
      </section>
    </PageContainer>
  );
}
