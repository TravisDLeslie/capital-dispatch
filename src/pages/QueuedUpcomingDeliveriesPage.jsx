import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Package,
  Search,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import OrderDetailsModal from "../components/OrderDetailsModal";
import PageContainer from "../components/PageContainer";
import { capitalLumberAddress } from "../data/options";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import {
  deliveryTimeSlotOptions,
  deliveryLoadBufferMinutes,
  getDeliveryDurationMinutes,
  getTimeSlotLabel,
  getTodayDateValue,
} from "../utils/deliverySchedule";
import { getCompassDirection } from "../utils/routeDirection";
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

function getDateGroupLabel(value) {
  if (!value) {
    return "Unscheduled deliveries";
  }

  const today = getTodayDateValue();

  if (value === today) {
    return `Today · ${formatDate(value)}`;
  }

  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowValue = `${tomorrow.getFullYear()}-${String(
    tomorrow.getMonth() + 1,
  ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  return value === tomorrowValue
    ? `Tomorrow · ${formatDate(value)}`
    : formatDate(value);
}

function getUpcomingDateValues(dayCount = 3) {
  const today = new Date(`${getTodayDateValue()}T12:00:00`);

  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const date = new Date(today);
    date.setDate(date.getDate() + dayIndex);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
}

function formatDurationMinutes(value) {
  const totalMinutes = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours} hr ${minutes} min`;
  }

  if (hours) {
    return `${hours} hr`;
  }

  return `${minutes} min`;
}

function getDeliveryTiming(delivery, routeMetric) {
  const savedDriveMinutes = Number(delivery?.oneWayDriveMinutes);
  const liveDriveMinutes = Number(routeMetric?.durationSeconds)
    ? Math.max(1, Math.round(Number(routeMetric.durationSeconds) / 60))
    : 0;
  const driveMinutes =
    Number.isFinite(savedDriveMinutes) && savedDriveMinutes > 0
      ? Math.round(savedDriveMinutes)
      : liveDriveMinutes;
  const serviceMinutes = getDeliveryDurationMinutes(
    delivery?.unloadType,
    delivery?.estimatedDurationMinutes,
    undefined,
    delivery?.deliveryType,
  );

  return {
    driveMinutes,
    serviceMinutes,
    totalMinutes:
      driveMinutes > 0
        ? driveMinutes * 2 + serviceMinutes + deliveryLoadBufferMinutes
        : null,
  };
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
        !isDeliveryComplete(delivery),
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

function getDriverUpcomingDeliveries(deliveries) {
  const upcomingDateValues = new Set(getUpcomingDateValues());

  return (Array.isArray(deliveries) ? deliveries : [])
    .filter(
      (delivery) =>
        delivery &&
        typeof delivery === "object" &&
        !isDeliveryComplete(delivery) &&
        upcomingDateValues.has(String(delivery.deliveryDate || "")),
    )
    .sort((first, second) => {
      const firstDate = String(first.deliveryDate || "9999-99-99");
      const secondDate = String(second.deliveryDate || "9999-99-99");

      if (firstDate !== secondDate) {
        return firstDate.localeCompare(secondDate);
      }

      return String(first.deliveryTimeSlot || "99:99").localeCompare(
        String(second.deliveryTimeSlot || "99:99"),
      );
    });
}

function ShipmentBadge({ shipmentType }) {
  if (!shipmentType) {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
        Source not set
      </span>
    );
  }

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${shipmentType.className}`}
    >
      {shipmentType.label}
    </span>
  );
}

function getAssignedDriver(delivery) {
  const assignedDriver = Array.isArray(delivery?.dispatchAssignments)
    ? delivery.dispatchAssignments.find((assignment) => assignment?.driver)
        ?.driver
    : "";

  return (
    assignedDriver ||
    (Array.isArray(delivery?.drivers)
      ? delivery.drivers.find(Boolean)
      : "") ||
    delivery?.driver ||
    ""
  );
}

function getAssignedTruck(delivery) {
  const assignedTruck = Array.isArray(delivery?.dispatchAssignments)
    ? delivery.dispatchAssignments.find(
        (assignment) =>
          assignment?.vehicleTitle ||
          assignment?.vehicleBadge ||
          assignment?.vehicleId,
      )
    : null;

  return String(
    assignedTruck?.vehicleBadge ||
      assignedTruck?.vehicleTitle ||
      delivery?.vehicleBadge ||
      delivery?.vehicleTitle ||
      "",
  ).trim();
}

function isAssignedDelivery(delivery) {
  return (
    delivery?.dispatchStatus === "assigned" ||
    Boolean(getAssignedDriver(delivery) && getAssignedTruck(delivery))
  );
}

function DeliveryCard({
  delivery,
  orderBuilds,
  routeMetric,
  isDriverView,
  canAssign,
  canUnassign,
  isAssigning,
  isUnassigning,
  onAssign,
  onUnassign,
  onViewOrder,
}) {
  const build = getDeliveryOrderBuild(delivery, orderBuilds);
  const buildItems = getBuildItems(build);
  const items = Array.isArray(delivery.items) ? delivery.items : [];
  const itemDetails = items.map((item) => ({
    item,
    shipmentType: getShipmentType(item, buildItems),
    vendor: getItemVendor(item, buildItems),
  }));
  const vendors = [
    ...new Set(itemDetails.map(({ vendor }) => vendor).filter(Boolean)),
  ];
  const sourceTypes = [
    ...new Map(
      itemDetails
        .map(({ shipmentType }) => shipmentType)
        .filter(Boolean)
        .map((shipmentType) => [shipmentType.label, shipmentType]),
    ).values(),
  ];
  const timing = getDeliveryTiming(delivery, routeMetric);
  const driver = getAssignedDriver(delivery);
  const truck = getAssignedTruck(delivery);
  const needsDispatch = !isAssignedDelivery(delivery);
  const scheduleLabel = delivery.deliveryTimeSlot
    ? getTimeSlotLabel(delivery.deliveryTimeSlot)
    : "Time not scheduled";
  const routeLabel =
    routeMetric?.status === "ready"
      ? `${routeMetric.direction ? `${routeMetric.direction} · ` : ""}${routeMetric.durationText} · ${routeMetric.distanceText}`
      : routeMetric?.status === "loading"
        ? "Calculating route..."
        : routeMetric?.status === "missing"
          ? "Address not entered"
          : "Route unavailable";
  const primaryItem = items[0]?.description || "No item details";

  return (
    <article
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-3.5 shadow-sm transition ${
        needsDispatch
          ? "border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/30"
          : "border-emerald-300 bg-emerald-50/30 ring-1 ring-emerald-100 hover:border-emerald-400 hover:bg-emerald-50/60"
      }`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${
          needsDispatch ? "bg-amber-400" : "bg-emerald-500"
        }`}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#FC2C38]">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{formatDate(delivery.deliveryDate)}</span>
        </span>
        {!isDriverView && needsDispatch && canAssign ? (
          <button
            type="button"
            onClick={() => onAssign?.(delivery)}
            disabled={isAssigning}
            className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-amber-800 shadow-sm transition hover:bg-amber-200 focus:outline-none focus:ring-4 focus:ring-amber-100 disabled:cursor-wait disabled:opacity-60"
            title="Assign a driver and truck; leave time is optional"
          >
            {isAssigning ? "Saving..." : "Needs dispatch"}
          </button>
        ) : !isDriverView && !needsDispatch && canUnassign ? (
          <button
            type="button"
            onClick={() => onUnassign?.(delivery)}
            disabled={isUnassigning}
            className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-60"
            title="Unassign this delivery and return it to Dispatch"
          >
            {isUnassigning ? "Updating..." : "Assigned"}
          </button>
        ) : (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] shadow-sm ${
              isDriverView || !needsDispatch
                ? "bg-emerald-600 text-white"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {isDriverView
              ? "Assigned to you"
              : needsDispatch
                ? "Needs dispatch"
                : "Assigned"}
          </span>
        )}
      </div>

      <h3 className="mt-2 truncate text-base font-black text-slate-950">
        {delivery.deliveryTitle ||
          formatCustomerName(delivery.customerName) ||
          "No customer name"}
      </h3>
      <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
        Order {delivery.orderNumber || "—"} · {scheduleLabel}
      </p>
      {delivery.deliveryTitle ? (
        <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">
          {formatCustomerName(delivery.customerName) || "No customer name"}
        </p>
      ) : null}

      <div className="mt-3 grid gap-1.5 text-[11px] font-bold text-slate-600">
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
          <span className="truncate">{delivery.address || "Address not entered"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1.5 text-blue-800">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{routeLabel}</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {sourceTypes.length > 0 ? (
          sourceTypes.map((shipmentType) => (
            <ShipmentBadge
              key={shipmentType.label}
              shipmentType={shipmentType}
            />
          ))
        ) : (
          <ShipmentBadge shipmentType={null} />
        )}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-600">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-600">
          {delivery.unloadType || "Normal"}
        </span>
        {timing.totalMinutes ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-emerald-700">
            {formatDurationMinutes(timing.totalMinutes)} total
          </span>
        ) : null}
      </div>

      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
        <p className="truncate text-xs font-black text-slate-800">{primaryItem}</p>
        <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">
          {items.length > 1 ? `+${items.length - 1} more · ` : ""}
          {vendors.length > 0 ? vendors.join(" · ") : "Vendor not entered"}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <span
          className={`flex min-w-0 items-center gap-1.5 truncate rounded-lg px-2 py-1 text-[11px] font-black ${
            needsDispatch
              ? "bg-amber-50 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {driver
              ? `${driver}${truck ? ` · ${truck}` : ""}`
              : "Driver not assigned"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onViewOrder?.(delivery)}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
        >
          View order
        </button>
      </div>
    </article>
  );
}

function DeliveryDateGroup({
  dateKey,
  deliveries,
  orderBuilds,
  routeMetrics,
  isDriverView,
  canAssign,
  canUnassign,
  assigningDeliveryId,
  unassigningDeliveryId,
  onAssign,
  onUnassign,
  onViewOrder,
}) {
  const itemCount = deliveries.reduce(
    (total, delivery) =>
      total + (Array.isArray(delivery.items) ? delivery.items.length : 0),
    0,
  );
  const shipmentLabels = new Set();
  const assignedCount = deliveries.filter(isAssignedDelivery).length;

  deliveries.forEach((delivery) => {
    const buildItems = getBuildItems(
      getDeliveryOrderBuild(delivery, orderBuilds),
    );

    (Array.isArray(delivery.items) ? delivery.items : []).forEach((item) => {
      const label = getShipmentType(item, buildItems)?.label;
      if (label) shipmentLabels.add(label);
    });
  });

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100/70 p-2.5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1.5 py-1">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-white text-[#FC2C38] shadow-sm">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Delivery date
            </p>
            <h2 className="text-lg font-black text-slate-950">
              {getDateGroupLabel(dateKey)}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[...shipmentLabels].map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-600"
            >
              {label}
            </span>
          ))}
          <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
            {deliveries.length} deliver{deliveries.length === 1 ? "y" : "ies"}
          </span>
          {assignedCount > 0 ? (
            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
              {assignedCount} assigned
            </span>
          ) : null}
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-600">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {deliveries.map((delivery) => (
          <DeliveryCard
            key={delivery.id}
            delivery={delivery}
            orderBuilds={orderBuilds}
            routeMetric={routeMetrics[String(delivery.id || "")]}
            isDriverView={isDriverView}
            canAssign={canAssign}
            canUnassign={canUnassign}
            isAssigning={
              assigningDeliveryId === String(delivery.id || "")
            }
            isUnassigning={
              unassigningDeliveryId === String(delivery.id || "")
            }
            onAssign={onAssign}
            onUnassign={onUnassign}
            onViewOrder={onViewOrder}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * @param {{
 *   deliveries?: Array<Record<string, any>>;
 *   orderBuilds?: Array<Record<string, any>>;
 *   supplierRuns?: Array<Record<string, any>>;
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   checkIns?: Array<Record<string, any>>;
 *   driverOptions?: string[];
 *   vehicleOptions?: Array<{id: string; title: string; badge?: string}>;
 *   isDriverView?: boolean;
 *   canEditDeliveries?: boolean;
 *   onUpdateDelivery?: (deliveryId: string, updates: Record<string, any>) => Promise<void>;
 *   onDeleteOrder?: (orderNumber: string) => Promise<boolean>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function QueuedUpcomingDeliveriesPage({
  deliveries = [],
  orderBuilds = [],
  supplierRuns = [],
  theirTruckPOs = [],
  checkIns = [],
  driverOptions = [],
  vehicleOptions = [],
  isDriverView = false,
  canEditDeliveries = false,
  onUpdateDelivery,
  onDeleteOrder,
  onPageChange,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [routeMetrics, setRouteMetrics] = useState({});
  const [viewingDelivery, setViewingDelivery] = useState(null);
  const [deliveryToAssign, setDeliveryToAssign] = useState(null);
  const [assignmentDraft, setAssignmentDraft] = useState({
    deliveryTimeSlot: "",
    driver: "",
    vehicleId: "",
  });
  const [assigningDeliveryId, setAssigningDeliveryId] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [deliveryToUnassign, setDeliveryToUnassign] = useState(null);
  const [unassigningDeliveryId, setUnassigningDeliveryId] = useState("");
  const [unassignError, setUnassignError] = useState("");
  const queuedDeliveries = useMemo(
    () =>
      isDriverView
        ? getDriverUpcomingDeliveries(deliveries)
        : getQueuedDeliveries(deliveries),
    [deliveries, isDriverView],
  );

  useEffect(() => {
    const controller = new AbortController();
    const deliveriesByAddress = new Map();

    queuedDeliveries.forEach((delivery) => {
      const address = String(delivery.address || "").trim();
      const deliveryId = String(delivery.id || "");

      if (!deliveryId || !address) {
        return;
      }

      const addressKey = normalizeValue(address);
      const currentEntry = deliveriesByAddress.get(addressKey) || {
        address,
        deliveryIds: [],
      };

      currentEntry.deliveryIds.push(deliveryId);
      deliveriesByAddress.set(addressKey, currentEntry);
    });

    setRouteMetrics(
      Object.fromEntries(
        queuedDeliveries.map((delivery) => {
          const deliveryId = String(delivery.id || "");
          const hasAddress = Boolean(String(delivery.address || "").trim());

          return [
            deliveryId,
            {
              status: hasAddress ? "loading" : "missing",
              durationSeconds: 0,
              durationText: "",
              distanceText: "",
            },
          ];
        }),
      ),
    );

    deliveriesByAddress.forEach(({ address, deliveryIds }) => {
      const params = new URLSearchParams({
        origin: capitalLumberAddress,
        destination: address,
      });

      fetch(`/api/maps/route?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const routeData = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              routeData?.error || "Unable to calculate the delivery route.",
            );
          }

          setRouteMetrics((currentMetrics) => {
            const nextMetrics = { ...currentMetrics };

            deliveryIds.forEach((deliveryId) => {
              nextMetrics[deliveryId] = {
                status: "ready",
                direction: getCompassDirection(routeData.encodedPolyline),
                durationSeconds: Number(routeData.durationSeconds) || 0,
                durationText: routeData.durationText || "Time unavailable",
                distanceText: routeData.distanceText || "Miles unavailable",
              };
            });

            return nextMetrics;
          });
        })
        .catch((routeError) => {
          if (controller.signal.aborted) {
            return;
          }

          console.warn("Unable to load queued delivery route:", routeError);
          setRouteMetrics((currentMetrics) => {
            const nextMetrics = { ...currentMetrics };

            deliveryIds.forEach((deliveryId) => {
              nextMetrics[deliveryId] = {
                status: "error",
                durationSeconds: 0,
                durationText: "",
                distanceText: "",
              };
            });

            return nextMetrics;
          });
        });
    });

    return () => controller.abort();
  }, [queuedDeliveries]);
  const visibleDeliveries = useMemo(() => {
    const query = normalizeValue(searchTerm);

    if (!query) {
      return queuedDeliveries;
    }

    return queuedDeliveries.filter((delivery) => {
      const buildItems = getBuildItems(
        getDeliveryOrderBuild(delivery, orderBuilds),
      );
      const itemValues = (Array.isArray(delivery.items) ? delivery.items : []).flatMap(
        (item) => [
          item?.description,
          getItemVendor(item, buildItems),
          getShipmentType(item, buildItems)?.label,
        ],
      );

      return [
        delivery.orderNumber,
        delivery.customerName,
        delivery.address,
        delivery.contactPhone,
        delivery.phoneNumber,
        ...itemValues,
      ].some((value) => normalizeValue(value).includes(query));
    });
  }, [orderBuilds, queuedDeliveries, searchTerm]);

  const visibleDateGroups = useMemo(() => {
    const groups = new Map();

    visibleDeliveries.forEach((delivery) => {
      const dateKey = String(delivery.deliveryDate || "");
      const group = groups.get(dateKey) || [];
      group.push(delivery);
      groups.set(dateKey, group);
    });

    return [...groups.entries()].map(([dateKey, groupedDeliveries]) => ({
      dateKey,
      deliveries: groupedDeliveries,
    }));
  }, [visibleDeliveries]);

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
  const assignmentCounts = useMemo(() => {
    const assigned = queuedDeliveries.filter(isAssignedDelivery).length;

    return {
      assigned,
      needsDispatch: Math.max(0, queuedDeliveries.length - assigned),
    };
  }, [queuedDeliveries]);
  const driverDateSummaries = useMemo(
    () =>
      getUpcomingDateValues().map((dateValue) => ({
        dateValue,
        label: getDateGroupLabel(dateValue),
        count: queuedDeliveries.filter(
          (delivery) => String(delivery.deliveryDate || "") === dateValue,
        ).length,
      })),
    [queuedDeliveries],
  );

  function openAssignmentModal(delivery) {
    const assignedTruck = Array.isArray(delivery?.dispatchAssignments)
      ? delivery.dispatchAssignments.find(
          (assignment) =>
            assignment?.vehicleId ||
            assignment?.vehicleTitle ||
            assignment?.vehicleBadge,
        )
      : null;
    const currentVehicleId = String(
      assignedTruck?.vehicleId || delivery?.vehicleId || "",
    );
    const currentVehicleTitle = String(
      assignedTruck?.vehicleTitle || delivery?.vehicleTitle || "",
    );
    const currentVehicleBadge = String(
      assignedTruck?.vehicleBadge || delivery?.vehicleBadge || "",
    );
    const matchingVehicle = vehicleOptions.find(
      (vehicle) =>
        String(vehicle?.id || "") === currentVehicleId ||
        (currentVehicleTitle && vehicle?.title === currentVehicleTitle) ||
        (currentVehicleBadge && vehicle?.badge === currentVehicleBadge),
    );

    setAssignmentDraft({
      deliveryTimeSlot: String(delivery?.deliveryTimeSlot || ""),
      driver: getAssignedDriver(delivery),
      vehicleId: String(matchingVehicle?.id || currentVehicleId || ""),
    });
    setAssignmentError("");
    setDeliveryToAssign(delivery);
  }

  async function handleConfirmAssignment() {
    const deliveryId = String(deliveryToAssign?.id || "");
    const driver = String(assignmentDraft.driver || "").trim();
    const deliveryTimeSlot = String(
      assignmentDraft.deliveryTimeSlot || "",
    ).trim();
    const vehicle = vehicleOptions.find(
      (vehicleOption) =>
        String(vehicleOption?.id || "") === assignmentDraft.vehicleId,
    );

    if (!deliveryId || !onUpdateDelivery) {
      return;
    }

    if (!driver || !vehicle) {
      setAssignmentError("Choose a driver and truck to continue.");
      return;
    }

    setAssigningDeliveryId(deliveryId);
    setAssignmentError("");

    try {
      const assignment = {
        id: "truck-1",
        driver,
        vehicleId: vehicle.id,
        vehicleTitle: vehicle.title,
        vehicleBadge: vehicle.badge || "",
      };

      await onUpdateDelivery(deliveryId, {
        deliveryTimeSlot,
        driver,
        drivers: [driver],
        vehicleId: assignment.vehicleId,
        vehicleTitle: assignment.vehicleTitle,
        vehicleBadge: assignment.vehicleBadge,
        dispatchAssignments: [assignment],
        dispatchStatus: "assigned",
        status: deliveryToAssign.status || "open",
      });
      setDeliveryToAssign(null);
    } catch (error) {
      console.error("Unable to assign delivery:", error);
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "Unable to save this delivery assignment.",
      );
    } finally {
      setAssigningDeliveryId("");
    }
  }

  async function handleConfirmUnassign() {
    const deliveryId = String(deliveryToUnassign?.id || "");

    if (!deliveryId || !onUpdateDelivery) {
      return;
    }

    setUnassigningDeliveryId(deliveryId);
    setUnassignError("");

    try {
      await onUpdateDelivery(deliveryId, {
        driver: "",
        drivers: [],
        vehicleId: "",
        vehicleTitle: "",
        vehicleBadge: "",
        dispatchAssignments: [],
        dispatchStatus: "needsDispatch",
        deliveryRouteOrder: null,
      });
      setDeliveryToUnassign(null);
    } catch (error) {
      console.error("Unable to unassign delivery:", error);
      setUnassignError(
        error instanceof Error
          ? error.message
          : "Unable to return this delivery to Dispatch.",
      );
    } finally {
      setUnassigningDeliveryId("");
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Deliveries", onClick: () => onPageChange?.("deliveries") },
          {
            label: isDriverView
              ? "Upcoming Deliveries"
              : "Upcoming Deliveries",
          },
        ]}
      />

      <div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            {isDriverView ? "Your Schedule" : "Before Dispatch"}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Upcoming Deliveries
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500 sm:text-lg sm:leading-7">
            {isDriverView
              ? "See every delivery assigned to you for today and the next two calendar days."
              : "Assigned deliveries live here after dispatch. Green cards are ready to go; yellow cards still need a driver or truck."}
          </p>
        </div>

      </div>

      {isDriverView ? (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {driverDateSummaries.map((dateSummary) => (
            <div
              key={dateSummary.dateValue}
              className={`min-w-0 rounded-2xl border px-3 py-2.5 ${
                dateSummary.count > 0
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
                {dateSummary.label}
              </p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                {dateSummary.count}
              </p>
              <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
                {dateSummary.count === 1 ? "Delivery" : "Deliveries"}
              </p>
            </div>
          ))}
        </div>
      ) : (
      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-3.5 py-3 shadow-sm ring-1 ring-emerald-100">
          <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">
            Assigned
          </p>
          <p className="mt-1 text-sm font-bold text-emerald-900">
            Ready for drivers
          </p>
          </div>
          <p className="text-3xl font-black text-emerald-800">
            {assignmentCounts.assigned}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                Needs dispatch
              </p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                Driver or truck missing
              </p>
            </div>
            <p className="text-3xl font-black text-amber-800">
              {assignmentCounts.needsDispatch}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                Total upcoming
              </p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                South {shipmentCounts.south} · Their Truck {shipmentCounts.theirTruck}
              </p>
            </div>
            <p className="text-3xl font-black text-slate-950">
              {queuedDeliveries.length}
            </p>
          </div>
        </div>
      </div>
      )}

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

      <section className="mt-5 grid gap-5">
        {visibleDeliveries.length > 0 ? (
          visibleDateGroups.map(({ dateKey, deliveries: dateDeliveries }) => (
            <DeliveryDateGroup
              key={dateKey || "unscheduled"}
              dateKey={dateKey}
              deliveries={dateDeliveries}
              orderBuilds={orderBuilds}
              routeMetrics={routeMetrics}
              isDriverView={isDriverView}
              canAssign={
                !isDriverView &&
                canEditDeliveries &&
                Boolean(onUpdateDelivery)
              }
              canUnassign={
                !isDriverView &&
                canEditDeliveries &&
                Boolean(onUpdateDelivery)
              }
              assigningDeliveryId={assigningDeliveryId}
              unassigningDeliveryId={unassigningDeliveryId}
              onAssign={openAssignmentModal}
              onUnassign={(delivery) => {
                setUnassignError("");
                setDeliveryToUnassign(delivery);
              }}
              onViewOrder={setViewingDelivery}
            />
          ))
        ) : (
          <EmptyState
            icon={searchTerm ? Search : Package}
            title={
              searchTerm
                ? `No ${isDriverView ? "upcoming" : "queued"} deliveries match`
                : isDriverView
                  ? "No upcoming deliveries"
                  : "No upcoming deliveries"
            }
            description={
              searchTerm
                ? "Try another order number, customer, address, or item."
                : isDriverView
                  ? "You have no assigned deliveries scheduled for today or the next two calendar days."
                  : "Active deliveries will appear here after they are created."
            }
          />
        )}
      </section>

      {viewingDelivery ? (
        <OrderDetailsModal
          orderNumber={
            viewingDelivery.sourceOrderNumber || viewingDelivery.orderNumber
          }
          sources={{
            orderBuilds,
            supplierRuns,
            theirTruckPOs,
            deliveries,
            checkIns,
          }}
          onDeleteOrder={onDeleteOrder}
          onClose={() => setViewingDelivery(null)}
        />
      ) : null}

      {deliveryToAssign ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-delivery-title"
          onClick={() => {
            if (!assigningDeliveryId) {
              setDeliveryToAssign(null);
              setAssignmentError("");
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Quick Dispatch
            </p>
            <h2
              id="assign-delivery-title"
              className="mt-2 text-2xl font-black tracking-tight text-slate-950"
            >
              Assign order {deliveryToAssign.orderNumber || "—"}
            </h2>
            <p className="mt-1 truncate text-sm font-bold text-slate-500">
              {formatCustomerName(deliveryToAssign.customerName) ||
                "No customer name"}
              {deliveryToAssign.deliveryDate
                ? ` · ${formatDate(deliveryToAssign.deliveryDate)}`
                : " · Date not set"}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Leave time (optional)
                </span>
                <select
                  value={assignmentDraft.deliveryTimeSlot}
                  onChange={(event) =>
                    setAssignmentDraft((currentDraft) => ({
                      ...currentDraft,
                      deliveryTimeSlot: event.target.value,
                    }))
                  }
                  disabled={Boolean(assigningDeliveryId)}
                  className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
                >
                  <option value="">Time TBD</option>
                  {deliveryTimeSlotOptions.map((timeSlot) => (
                    <option key={timeSlot.value} value={timeSlot.value}>
                      {timeSlot.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Driver
                </span>
                <select
                  value={assignmentDraft.driver}
                  onChange={(event) =>
                    setAssignmentDraft((currentDraft) => ({
                      ...currentDraft,
                      driver: event.target.value,
                    }))
                  }
                  disabled={Boolean(assigningDeliveryId)}
                  className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
                >
                  <option value="">Choose driver...</option>
                  {driverOptions.map((driverName) => (
                    <option key={driverName} value={driverName}>
                      {driverName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Truck
                </span>
                <select
                  value={assignmentDraft.vehicleId}
                  onChange={(event) =>
                    setAssignmentDraft((currentDraft) => ({
                      ...currentDraft,
                      vehicleId: event.target.value,
                    }))
                  }
                  disabled={Boolean(assigningDeliveryId)}
                  className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
                >
                  <option value="">Choose truck...</option>
                  {vehicleOptions.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.badge
                        ? `${vehicle.badge} - ${vehicle.title}`
                        : vehicle.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {assignmentError ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {assignmentError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeliveryToAssign(null);
                  setAssignmentError("");
                }}
                disabled={Boolean(assigningDeliveryId)}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={Boolean(assigningDeliveryId)}
                className="min-h-12 rounded-xl bg-slate-950 px-7 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                {assigningDeliveryId ? "Saving..." : "Save assignment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deliveryToUnassign ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unassign-delivery-title"
          onClick={() => {
            if (!unassigningDeliveryId) {
              setDeliveryToUnassign(null);
              setUnassignError("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Return to Dispatch
            </p>
            <h2
              id="unassign-delivery-title"
              className="mt-2 text-2xl font-black tracking-tight text-slate-950"
            >
              Unassign order {deliveryToUnassign.orderNumber || "—"}?
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              This removes the current driver and truck and sends the delivery
              back to Dispatch. The delivery date, time, address, and order
              details will stay the same.
            </p>

            {unassignError ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {unassignError}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeliveryToUnassign(null);
                  setUnassignError("");
                }}
                disabled={Boolean(unassigningDeliveryId)}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                No, keep assigned
              </button>
              <button
                type="button"
                onClick={handleConfirmUnassign}
                disabled={Boolean(unassigningDeliveryId)}
                className="min-h-12 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {unassigningDeliveryId ? "Unassigning..." : "Yes, unassign"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
