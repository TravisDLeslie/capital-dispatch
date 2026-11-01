import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  MapPin,
  Package,
  Plus,
  Truck,
  UserRound,
} from "lucide-react";
import { getDeliveryTimeRange } from "../utils/deliverySchedule";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import { formatCustomerName } from "../utils/textFormatters";

function formatDateLabel(value) {
  if (!value) {
    return "Date not set";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getDateKey(delivery) {
  return String(delivery?.deliveryDate || "").trim() || "unscheduled";
}

function getDriverLabel(delivery) {
  const assignmentDriver = Array.isArray(delivery?.dispatchAssignments)
    ? delivery.dispatchAssignments.find((assignment) => assignment?.driver)
        ?.driver
    : "";

  return (
    assignmentDriver ||
    (Array.isArray(delivery?.drivers)
      ? delivery.drivers.find(Boolean)
      : "") ||
    delivery?.driver ||
    "Needs driver"
  );
}

function getTruckLabel(delivery) {
  const assignmentTruck = Array.isArray(delivery?.dispatchAssignments)
    ? delivery.dispatchAssignments.find(
        (assignment) => assignment?.vehicleTitle || assignment?.vehicleBadge,
      )
    : null;

  return (
    assignmentTruck?.vehicleTitle ||
    assignmentTruck?.vehicleBadge ||
    delivery?.vehicleTitle ||
    delivery?.vehicleBadge ||
    "Needs truck"
  );
}

function getDistanceLabel(delivery) {
  const distanceText = String(
    delivery?.distanceText || delivery?.routeDistanceText || "",
  ).trim();
  const driveMinutes = Number(delivery?.oneWayDriveMinutes || 0);

  if (distanceText && driveMinutes > 0) {
    return `${distanceText} · ${Math.round(driveMinutes)} min`;
  }

  if (distanceText) {
    return distanceText;
  }

  return driveMinutes > 0 ? `${Math.round(driveMinutes)} min drive` : "";
}

function sortDeliveries(firstDelivery, secondDelivery) {
  const firstDate = getDateKey(firstDelivery);
  const secondDate = getDateKey(secondDelivery);

  if (firstDate === "unscheduled" && secondDate !== "unscheduled") return 1;
  if (secondDate === "unscheduled" && firstDate !== "unscheduled") return -1;

  const dateComparison = firstDate.localeCompare(secondDate);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return String(firstDelivery?.deliveryTimeSlot || "99:99").localeCompare(
    String(secondDelivery?.deliveryTimeSlot || "99:99"),
  );
}

/**
 * @param {{
 *   deliveries?: Array<Record<string, any>>;
 *   canAddDelivery?: boolean;
 *   canOpenDispatch?: boolean;
 *   onPageChange?: (pageId: string) => void;
 *   className?: string;
 * }} props
 */
export default function DispatchOpsDeliveryOverview({
  deliveries = [],
  canAddDelivery = false,
  canOpenDispatch = false,
  onPageChange,
  className = "mb-5",
}) {
  const [showAll, setShowAll] = useState(false);
  const openDeliveries = useMemo(
    () =>
      (Array.isArray(deliveries) ? deliveries : [])
        .filter((delivery) => !isDeliveryComplete(delivery))
        .sort(sortDeliveries),
    [deliveries],
  );
  const needsDispatchCount = openDeliveries.filter(
    (delivery) =>
      delivery.dispatchStatus === "needsDispatch" || !getDriverLabel(delivery) ||
      getDriverLabel(delivery) === "Needs driver",
  ).length;
  const assignedCount = Math.max(0, openDeliveries.length - needsDispatchCount);
  const visibleDeliveries = showAll
    ? openDeliveries
    : openDeliveries.slice(0, 8);
  const groupedDeliveries = visibleDeliveries.reduce((groups, delivery) => {
    const dateKey = getDateKey(delivery);

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(delivery);
    return groups;
  }, {});

  return (
    <section
      className={`${className} overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm`}
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-5 lg:flex-row lg:items-center lg:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FC2C38] text-white shadow-sm">
            <Truck aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Delivery Dispatch
            </p>
            <h2 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">
              Upcoming delivery lineup
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Review the next deliveries here, then open Dispatch when assignments need attention.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">
            <span className="text-base text-slate-950">{openDeliveries.length}</span>
            Open
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
            <span className="text-base">{needsDispatchCount}</span>
            Need dispatch
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
            <span className="text-base">{assignedCount}</span>
            Assigned
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {openDeliveries.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 text-center">
            <Package className="h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-2 text-base font-black text-slate-700">
              No open deliveries
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Add a delivery when the next order is ready to schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedDeliveries).map(
              ([dateKey, dateDeliveries]) => (
                <section key={dateKey}>
                  <div className="mb-2 flex items-center justify-between gap-3 px-1">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                      <CalendarDays
                        aria-hidden="true"
                        className="h-4 w-4 text-[#FC2C38]"
                        strokeWidth={2.6}
                      />
                      {dateKey === "unscheduled"
                        ? "Unscheduled"
                        : formatDateLabel(dateKey)}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                      {dateDeliveries.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dateDeliveries.map((delivery) => {
                      const needsDispatch =
                        delivery.dispatchStatus === "needsDispatch" ||
                        getDriverLabel(delivery) === "Needs driver";
                      const items = Array.isArray(delivery.items)
                        ? delivery.items
                        : [];
                      const distanceLabel = getDistanceLabel(delivery);

                      return (
                        <button
                          key={delivery.id}
                          type="button"
                          onClick={() =>
                            canOpenDispatch && onPageChange?.("deliveries-dispatch")
                          }
                          disabled={!canOpenDispatch}
                          className="grid w-full gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-red-200 hover:bg-red-50/30 disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-white lg:grid-cols-[minmax(175px,0.9fr)_minmax(220px,1.25fr)_minmax(170px,0.85fr)_minmax(150px,0.8fr)] lg:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-[0.1em] text-[#FC2C38]">
                                Order {delivery.orderNumber || "—"}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
                                  needsDispatch
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {needsDispatch ? "Needs dispatch" : "Assigned"}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm font-black text-slate-950">
                              {formatCustomerName(delivery.customerName) ||
                                "Customer not entered"}
                            </p>
                          </div>

                          <div className="min-w-0">
                            <p className="flex items-start gap-1.5 text-xs font-bold text-slate-600">
                              <MapPin
                                aria-hidden="true"
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                                strokeWidth={2.5}
                              />
                              <span className="line-clamp-1">
                                {delivery.address || "Address not entered"}
                              </span>
                            </p>
                            {distanceLabel ? (
                              <p className="mt-1 pl-5 text-[11px] font-black text-blue-700">
                                {distanceLabel} from Capital
                              </p>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-2 gap-2 lg:block">
                            <p className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                              <Clock3
                                aria-hidden="true"
                                className="h-3.5 w-3.5 text-slate-400"
                                strokeWidth={2.5}
                              />
                              {delivery.deliveryTimeSlot
                                ? getDeliveryTimeRange(delivery)
                                : "Time not set"}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-slate-500">
                              {items.length} {items.length === 1 ? "item" : "items"} · {delivery.unloadType || "Normal"}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs lg:block">
                            <p className="flex min-w-0 items-center gap-1.5 font-black text-slate-700">
                              <UserRound
                                aria-hidden="true"
                                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                strokeWidth={2.5}
                              />
                              <span className="truncate">
                                {getDriverLabel(delivery)}
                              </span>
                            </p>
                            <p className="mt-1 flex min-w-0 items-center gap-1.5 font-bold text-slate-500">
                              <Truck
                                aria-hidden="true"
                                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                strokeWidth={2.5}
                              />
                              <span className="truncate">
                                {getTruckLabel(delivery)}
                              </span>
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ),
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {openDeliveries.length > 8 ? (
              <button
                type="button"
                onClick={() => setShowAll((currentValue) => !currentValue)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                {showAll
                  ? "Show fewer"
                  : `Show all ${openDeliveries.length} deliveries`}
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 transition ${showAll ? "rotate-180" : ""}`}
                  strokeWidth={2.5}
                />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {canAddDelivery ? (
              <button
                type="button"
                onClick={() => onPageChange?.("deliveries-add")}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
              >
                <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.7} />
                Add Delivery
              </button>
            ) : null}
            {canOpenDispatch ? (
              <button
                type="button"
                onClick={() => onPageChange?.("deliveries-dispatch")}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Open Full Dispatch
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
