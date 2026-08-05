import { useMemo, useState } from "react";
import {
  Clock,
  Edit3,
  ExternalLink,
  MapPin,
  Package,
  Search,
  ShieldAlert,
  Truck,
  UserRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import {
  deliveryDrivers,
  deliveryOriginOptions,
  favoriteDeliveryDrivers,
} from "../data/options";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";
import {
  getDeliveryBackAroundLabel,
  getDeliveryBlockSummary,
  getDeliverySiteArrivalLabel,
  getDeliveryTimeRange,
  getDeliveryTimeWindow,
  getTodayDateValue,
  deliveryTimeSlotOptions,
  scheduleWindowsOverlap,
} from "../utils/deliverySchedule";

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getDirectionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
}

function getRouteDirectionsUrl(originAddress, destinationAddress) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    originAddress || "",
  )}&destination=${encodeURIComponent(destinationAddress || "")}`;
}

function formatCreatedAt(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function createAssignment(index, assignment = {}) {
  return {
    id: assignment.id || `truck-${index + 1}`,
    driver: assignment.driver || "",
    vehicleId: assignment.vehicleId || "",
    vehicleTitle: assignment.vehicleTitle || "",
    vehicleBadge: assignment.vehicleBadge || "",
  };
}

function getInitialAssignments(delivery) {
  if (
    Array.isArray(delivery.dispatchAssignments) &&
    delivery.dispatchAssignments.length > 0
  ) {
    return delivery.dispatchAssignments
      .slice(0, 3)
      .map((assignment, index) => createAssignment(index, assignment));
  }

  return [
    createAssignment(0, {
      driver: delivery.driver,
      vehicleId: delivery.vehicleId,
      vehicleTitle: delivery.vehicleTitle,
      vehicleBadge: delivery.vehicleBadge,
    }),
  ];
}

function getVehicleLabel(vehicleOption) {
  if (!vehicleOption) {
    return "";
  }

  return vehicleOption.badge
    ? `${vehicleOption.badge} - ${vehicleOption.title}`
    : vehicleOption.title;
}

function getOriginAddress(originName) {
  return (
    deliveryOriginOptions.find(
      (originOption) => originOption.name === originName,
    )?.address || deliveryOriginOptions[0].address
  );
}

function getInitialSchedule(delivery) {
  const originName = delivery.deliveryOriginName || "Capital Lumber";

  return {
    deliveryDate: delivery.deliveryDate || getTodayDateValue(),
    deliveryTimeSlot: delivery.deliveryTimeSlot || "",
    deliveryOriginName: originName,
    deliveryOriginAddress:
      delivery.deliveryOriginAddress || getOriginAddress(originName),
    oneWayDriveMinutes: delivery.oneWayDriveMinutes
      ? String(delivery.oneWayDriveMinutes)
      : "",
  };
}

function deliveryIncludesDriver(delivery, driverName) {
  const drivers = Array.isArray(delivery.drivers) ? delivery.drivers : [];
  const dispatchAssignments = Array.isArray(delivery.dispatchAssignments)
    ? delivery.dispatchAssignments
    : [];

  return (
    delivery.driver === driverName ||
    drivers.includes(driverName) ||
    dispatchAssignments.some((assignment) => assignment.driver === driverName)
  );
}

function findScheduleConflict(currentDelivery, assignments, deliveries) {
  const currentWindow = getDeliveryTimeWindow(currentDelivery);

  if (!currentDelivery.deliveryDate || !currentWindow) {
    return null;
  }

  const assignedDrivers = assignments
    .map((assignment) => assignment.driver)
    .filter(Boolean);

  return deliveries.find((delivery) => {
    if (
      delivery.id === currentDelivery.id ||
      delivery.status === "complete" ||
      delivery.dispatchStatus === "needsDispatch" ||
      delivery.deliveryDate !== currentDelivery.deliveryDate
    ) {
      return false;
    }

    return (
      assignedDrivers.some((driverName) =>
        deliveryIncludesDriver(delivery, driverName),
      ) &&
      scheduleWindowsOverlap(currentWindow, getDeliveryTimeWindow(delivery))
    );
  });
}

function getConflictingDriverNames(delivery, assignments) {
  return assignments
    .map((assignment) => assignment.driver)
    .filter((driverName) => deliveryIncludesDriver(delivery, driverName));
}

function assignmentsReady(assignments, vehicleOptions) {
  return assignments.every(
    (assignment) =>
      deliveryDrivers.includes(assignment.driver) &&
      (vehicleOptions.length === 0 || assignment.vehicleId),
  );
}

/**
 * @param {{
 *   deliveries: Array<Record<string, any>>;
 *   vehicleOptions?: Array<{ id: string; title: string; badge?: string }>;
 *   canEditDeliveries?: boolean;
 *   onUpdateDelivery: (deliveryId: string, updates: Record<string, any>) => Promise<void>;
 *   onEditDelivery: (deliveryId: string) => void;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function DeliveryDispatchPage({
  deliveries,
  vehicleOptions = [],
  canEditDeliveries = false,
  onUpdateDelivery,
  onEditDelivery,
  onPageChange,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [draftAssignments, setDraftAssignments] = useState({});
  const [draftSchedules, setDraftSchedules] = useState({});
  const [savingDeliveryId, setSavingDeliveryId] = useState("");
  const [error, setError] = useState("");

  const needsDispatchDeliveries = useMemo(
    () =>
      deliveries
        .filter(
          (delivery) =>
            delivery.status !== "complete" &&
            (delivery.dispatchStatus === "needsDispatch" || !delivery.driver),
        )
        .sort((firstDelivery, secondDelivery) =>
          String(firstDelivery.createdAt || "").localeCompare(
            String(secondDelivery.createdAt || ""),
          ),
        ),
    [deliveries],
  );
  const normalizedSearchQuery = normalizeSearch(searchQuery);
  const visibleDeliveries = normalizedSearchQuery
    ? needsDispatchDeliveries.filter((delivery) => {
        const items = Array.isArray(delivery.items) ? delivery.items : [];
        const searchableText = [
          delivery.orderNumber,
          delivery.customerName,
          delivery.address,
          delivery.contactName,
          delivery.contactPhone,
          delivery.phoneNumber,
          delivery.unloadType,
          delivery.deliveryScope,
          delivery.deliveryScopeNotes,
          ...items.map(
            (item) => `${item.quantity || ""} ${item.description || ""}`,
          ),
        ].join(" ");

        return normalizeSearch(searchableText).includes(
          normalizedSearchQuery,
        );
      })
    : needsDispatchDeliveries;

  function getAssignments(delivery) {
    return draftAssignments[delivery.id] || getInitialAssignments(delivery);
  }

  function getSchedule(delivery) {
    return draftSchedules[delivery.id] || getInitialSchedule(delivery);
  }

  function getDeliveryWithDraftSchedule(delivery) {
    const schedule = getSchedule(delivery);

    return {
      ...delivery,
      ...schedule,
      oneWayDriveMinutes: Number(schedule.oneWayDriveMinutes) || 0,
    };
  }

  function updateSchedule(delivery, field, value) {
    const currentSchedule = getSchedule(delivery);
    const nextSchedule = {
      ...currentSchedule,
      [field]: value,
    };

    if (field === "deliveryOriginName") {
      nextSchedule.deliveryOriginAddress = getOriginAddress(value);
    }

    setDraftSchedules((currentDraftSchedules) => ({
      ...currentDraftSchedules,
      [delivery.id]: nextSchedule,
    }));
    setError("");
  }

  function updateAssignment(delivery, assignmentIndex, field, value) {
    const currentAssignments = getAssignments(delivery);
    const nextAssignments = currentAssignments.map((assignment, index) => {
      if (index !== assignmentIndex) {
        return assignment;
      }

      if (field === "vehicleId") {
        const selectedVehicle = vehicleOptions.find(
          (vehicleOption) => vehicleOption.id === value,
        );

        return {
          ...assignment,
          vehicleId: value,
          vehicleTitle: selectedVehicle?.title || "",
          vehicleBadge: selectedVehicle?.badge || "",
        };
      }

      return {
        ...assignment,
        [field]: value,
      };
    });

    setDraftAssignments((currentDraftAssignments) => ({
      ...currentDraftAssignments,
      [delivery.id]: nextAssignments,
    }));
    setError("");
  }

  function updateTruckCount(delivery, truckCount) {
    const currentAssignments = getAssignments(delivery);
    const nextAssignments = Array.from({ length: truckCount }, (_, index) =>
      createAssignment(index, currentAssignments[index]),
    );

    setDraftAssignments((currentDraftAssignments) => ({
      ...currentDraftAssignments,
      [delivery.id]: nextAssignments,
    }));
    setError("");
  }

  async function handleDispatchDelivery(delivery) {
    const assignments = getAssignments(delivery).map((assignment, index) =>
      createAssignment(index, assignment),
    );
    const invalidAssignment = assignments.find(
      (assignment) =>
        !deliveryDrivers.includes(assignment.driver) ||
        (vehicleOptions.length > 0 && !assignment.vehicleId),
    );

    if (invalidAssignment) {
      setError(
        vehicleOptions.length > 0
          ? `Select a driver and truck for order ${delivery.orderNumber}.`
          : `Select a driver for order ${delivery.orderNumber}.`,
      );
      return;
    }

    const schedule = getSchedule(delivery);

    if (!schedule.deliveryDate || !schedule.deliveryTimeSlot) {
      setError(
        `Select a delivery date and time slot for order ${delivery.orderNumber}.`,
      );
      return;
    }

    const deliveryWithSchedule = getDeliveryWithDraftSchedule(delivery);
    const scheduleConflict = findScheduleConflict(
      deliveryWithSchedule,
      assignments,
      deliveries,
    );

    if (scheduleConflict) {
      const conflictingDrivers = assignments
        .map((assignment) => assignment.driver)
        .filter((driverName) =>
          deliveryIncludesDriver(scheduleConflict, driverName),
        )
        .join(", ");

      setError(
        `${conflictingDrivers} already has order ${scheduleConflict.orderNumber} scheduled ${getDeliveryTimeRange(
          scheduleConflict,
        )}. Adjust the delivery time before dispatching.`,
      );
      return;
    }

    const primaryAssignment = assignments[0];

    setSavingDeliveryId(delivery.id);
    setError("");

    try {
      await onUpdateDelivery(delivery.id, {
        driver: primaryAssignment.driver,
        drivers: assignments.map((assignment) => assignment.driver),
        vehicleId: primaryAssignment.vehicleId,
        vehicleTitle: primaryAssignment.vehicleTitle,
        vehicleBadge: primaryAssignment.vehicleBadge,
        dispatchAssignments: assignments,
        deliveryDate: schedule.deliveryDate,
        deliveryTimeSlot: schedule.deliveryTimeSlot,
        deliveryOriginName: schedule.deliveryOriginName,
        deliveryOriginAddress: schedule.deliveryOriginAddress,
        oneWayDriveMinutes: Number(schedule.oneWayDriveMinutes) || 0,
        dispatchStatus: "assigned",
        status: delivery.status || "open",
        updatedAt: new Date().toISOString(),
      });
    } catch (updateError) {
      console.error("Unable to dispatch delivery:", updateError);
      setError("Unable to dispatch that delivery. Try again.");
    } finally {
      setSavingDeliveryId("");
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Deliveries", onClick: () => onPageChange?.("deliveries") },
          { label: "Needs Dispatch" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Dispatch
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Delivery Needs Dispatch
          </h1>

          <p className="mt-2 text-base font-semibold text-slate-500 sm:text-lg">
            Choose how many trucks are going, then assign each driver and truck.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onPageChange?.("deliveries-add")}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600 sm:w-auto"
        >
          <Package className="h-4 w-4" aria-hidden="true" />
          Add Delivery
        </button>
      </div>

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <label
          htmlFor="delivery-dispatch-search"
          className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search needs dispatch
        </label>

        <input
          id="delivery-dispatch-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search order, customer, address, contact, or item..."
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        />
      </div>

      {visibleDeliveries.length === 0 ? (
        <EmptyState
          title={
            needsDispatchDeliveries.length === 0
              ? "Nothing needs dispatch"
              : "No matching delivery orders"
          }
          description={
            needsDispatchDeliveries.length === 0
              ? "Delivery orders without a driver will appear here."
              : "Try another order number, customer, address, or item."
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleDeliveries.map((delivery) => {
            const items = Array.isArray(delivery.items)
              ? delivery.items
              : [];
            const contactPhone =
              delivery.contactPhone || delivery.phoneNumber || "";
            const isSaving = savingDeliveryId === delivery.id;
            const assignments = getAssignments(delivery);
            const canScheduleDelivery = assignmentsReady(
              assignments,
              vehicleOptions,
            );
            const schedule = getSchedule(delivery);
            const scheduledDelivery = getDeliveryWithDraftSchedule(delivery);
            const selectedScheduleConflict = schedule.deliveryTimeSlot
              ? findScheduleConflict(scheduledDelivery, assignments, deliveries)
              : null;
            const scopeSummary = getDeliveryScopeSummary(delivery);

            return (
              <article
                key={delivery.id}
                className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                          Order {delivery.orderNumber}
                        </p>

                        <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900 sm:mt-2">
                          {delivery.customerName}
                        </h2>
                      </div>

                      <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800 sm:text-xs">
                        Hold
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                        <Truck className="h-4 w-4" aria-hidden="true" />
                        {delivery.unloadType}
                      </span>

                      {delivery.hasHardware ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm font-black text-[#FC2C38]">
                          <ShieldAlert
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Hardware
                        </span>
                      ) : null}

                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                        <Package className="h-4 w-4" aria-hidden="true" />
                        {scopeSummary.shortLabel}
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        {schedule.deliveryDate || "No date"} ·{" "}
                        {getDeliveryTimeRange(scheduledDelivery)}
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700">
                        Site around{" "}
                        {getDeliverySiteArrivalLabel(scheduledDelivery)}
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
                        Back around{" "}
                        {getDeliveryBackAroundLabel(scheduledDelivery)}
                      </span>

                      {delivery.createdAt ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 sm:text-sm">
                          Added {formatCreatedAt(delivery.createdAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {canEditDeliveries ? (
                  <button
                    type="button"
                    onClick={() => onEditDelivery(delivery.id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 sm:w-auto"
                  >
                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>
                  ) : null}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:mt-5 sm:p-4">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          Assign Driver & Truck
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          Choose who is taking it first, then test the time slot below.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-50 p-1 shadow-sm sm:gap-2">
                        {[1, 2, 3].map((truckCount) => {
                          const isSelected = assignments.length === truckCount;

                          return (
                            <button
                              key={truckCount}
                              type="button"
                              onClick={() =>
                                updateTruckCount(delivery, truckCount)
                              }
                              disabled={isSaving}
                              className={`rounded-xl px-2 py-2.5 text-sm font-black transition sm:px-5 ${
                                isSelected
                                  ? "bg-[#FC2C38] text-white"
                                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              }`}
                            >
                              <span className="sm:hidden">{truckCount}</span>
                              <span className="hidden sm:inline">
                                {truckCount}{" "}
                                {truckCount === 1 ? "Truck" : "Trucks"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:mt-4">
                      {assignments.map((assignment, assignmentIndex) => (
                        <div
                          key={assignment.id}
                          className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[auto_1fr_1fr]"
                        >
                          <div className="flex items-center gap-2 lg:block">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-sm font-black text-[#FC2C38] lg:h-11 lg:w-11">
                              #{assignmentIndex + 1}
                            </div>
                            <p className="text-sm font-black text-slate-900 lg:hidden">
                              Truck Assignment
                            </p>
                          </div>

                          <label className="block">
                            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                              Driver
                            </span>

                            <select
                              value={assignment.driver}
                              onChange={(event) =>
                                updateAssignment(
                                  delivery,
                                  assignmentIndex,
                                  "driver",
                                  event.target.value,
                                )
                              }
                              disabled={isSaving}
                              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                            >
                              <option value="">Assign driver...</option>

                              <optgroup label="Favorites">
                                {favoriteDeliveryDrivers.map((driverOption) => (
                                  <option
                                    key={driverOption}
                                    value={driverOption}
                                  >
                                    {driverOption}
                                  </option>
                                ))}
                              </optgroup>

                              <optgroup label="All Drivers">
                                {deliveryDrivers
                                  .filter(
                                    (driverOption) =>
                                      !favoriteDeliveryDrivers.includes(
                                        driverOption,
                                      ),
                                  )
                                  .map((driverOption) => (
                                    <option
                                      key={driverOption}
                                      value={driverOption}
                                    >
                                      {driverOption}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                              Truck
                            </span>

                            <select
                              value={assignment.vehicleId}
                              onChange={(event) =>
                                updateAssignment(
                                  delivery,
                                  assignmentIndex,
                                  "vehicleId",
                                  event.target.value,
                                )
                              }
                              disabled={isSaving || vehicleOptions.length === 0}
                              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">
                                {vehicleOptions.length === 0
                                  ? "No trucks configured"
                                  : "Assign truck..."}
                              </option>

                              {vehicleOptions.map((vehicleOption) => (
                                <option
                                  key={vehicleOption.id}
                                  value={vehicleOption.id}
                                >
                                  {getVehicleLabel(vehicleOption)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section
                    className={`mt-5 rounded-2xl border p-4 transition ${
                      canScheduleDelivery
                        ? "border-slate-200 bg-white"
                        : "border-slate-200 bg-slate-100 opacity-80"
                    }`}
                  >
                    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          Delivery Schedule
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {canScheduleDelivery
                            ? "Pick a time slot after choosing the driver so conflicts are easier to catch."
                            : "Assign the driver and truck first, then schedule the delivery."}
                        </p>
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-3 text-left lg:text-right ${
                          canScheduleDelivery
                            ? "bg-emerald-50"
                            : "bg-slate-200"
                        }`}
                      >
                        <p
                          className={`text-xs font-black uppercase tracking-[0.12em] ${
                            canScheduleDelivery
                              ? "text-emerald-700"
                              : "text-slate-500"
                          }`}
                        >
                          Driver Back Around
                        </p>
                        <p
                          className={`mt-1 text-xl font-black ${
                            canScheduleDelivery
                              ? "text-emerald-800"
                              : "text-slate-600"
                          }`}
                        >
                          {getDeliveryBackAroundLabel(scheduledDelivery)}
                        </p>
                        <p
                          className={`mt-1 text-xs font-bold ${
                            canScheduleDelivery
                              ? "text-emerald-700"
                              : "text-slate-500"
                          }`}
                        >
                          Site around{" "}
                          {getDeliverySiteArrivalLabel(scheduledDelivery)} ·{" "}
                          {getDeliveryBlockSummary(scheduledDelivery)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Delivery Date
                        </span>

                        <input
                          type="date"
                          value={schedule.deliveryDate}
                          onChange={(event) =>
                            updateSchedule(
                              delivery,
                              "deliveryDate",
                              event.target.value,
                            )
                          }
                          disabled={isSaving || !canScheduleDelivery}
                          className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition disabled:bg-slate-200 disabled:text-slate-500 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Time Slot
                        </span>

                        <select
                          value={schedule.deliveryTimeSlot}
                          onChange={(event) =>
                            updateSchedule(
                              delivery,
                              "deliveryTimeSlot",
                              event.target.value,
                            )
                          }
                          disabled={isSaving || !canScheduleDelivery}
                          className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition disabled:bg-slate-200 disabled:text-slate-500 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                        >
                          <option value="">
                            {canScheduleDelivery
                              ? "Choose time..."
                              : "Assign driver/truck first..."}
                          </option>

                          {deliveryTimeSlotOptions.map((timeSlot) => {
                            const candidateDelivery = {
                              ...scheduledDelivery,
                              deliveryTimeSlot: timeSlot.value,
                            };
                            const conflict = findScheduleConflict(
                              candidateDelivery,
                              assignments,
                              deliveries,
                            );
                            const conflictingDrivers = conflict
                              ? getConflictingDriverNames(conflict, assignments)
                              : [];
                            const conflictLabel = conflictingDrivers.length
                              ? `${conflictingDrivers.join(", ")} busy until ${getDeliveryBackAroundLabel(
                                  conflict,
                                )}`
                              : "Driver busy";

                            return (
                              <option
                                key={timeSlot.value}
                                value={timeSlot.value}
                                disabled={Boolean(conflict)}
                              >
                                {conflict
                                  ? `${timeSlot.label} - ${conflictLabel}`
                                  : timeSlot.label}
                              </option>
                            );
                          })}
                        </select>

                        {selectedScheduleConflict ? (
                          <span className="mt-2 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                            {getConflictingDriverNames(
                              selectedScheduleConflict,
                              assignments,
                            ).join(", ")}{" "}
                            is already blocked until{" "}
                            {getDeliveryBackAroundLabel(
                              selectedScheduleConflict,
                            )}
                            .
                          </span>
                        ) : null}
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
                      <div>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                            Where is the delivery leaving from?
                          </span>

                          <select
                            value={schedule.deliveryOriginName}
                            onChange={(event) =>
                              updateSchedule(
                                delivery,
                                "deliveryOriginName",
                                event.target.value,
                              )
                            }
                            disabled={isSaving || !canScheduleDelivery}
                            className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition disabled:bg-slate-200 disabled:text-slate-500 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                          >
                            {deliveryOriginOptions.map((originOption) => (
                              <option
                                key={originOption.name}
                                value={originOption.name}
                              >
                                {originOption.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <p className="mt-2 text-sm font-semibold text-slate-500">
                          {schedule.deliveryOriginAddress}
                        </p>

                        {delivery.address ? (
                          <a
                            href={getRouteDirectionsUrl(
                              schedule.deliveryOriginAddress,
                              delivery.address,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#FC2C38] transition hover:text-red-700"
                          >
                            Open live route ETA
                            <ExternalLink
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </a>
                        ) : null}
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          One-way ETA
                        </span>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="240"
                            step="1"
                            value={schedule.oneWayDriveMinutes}
                            onChange={(event) =>
                              updateSchedule(
                                delivery,
                                "oneWayDriveMinutes",
                                event.target.value,
                              )
                            }
                            disabled={isSaving || !canScheduleDelivery}
                            placeholder="18"
                            className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition disabled:bg-slate-200 disabled:text-slate-500 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                          />

                          <span className="text-sm font-black text-slate-500">
                            min
                          </span>
                        </div>

                        <span className="mt-2 block text-xs font-bold text-slate-500">
                          Counts there and back.
                        </span>
                      </label>
                    </div>
                  </section>

                  <button
                    type="button"
                    onClick={() => handleDispatchDelivery(delivery)}
                    disabled={isSaving}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                  >
                    <Truck className="h-4 w-4" aria-hidden="true" />
                    {isSaving ? "Dispatching..." : "Dispatch Delivery"}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                      <Clock
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                      />
                      Schedule & Route
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Window
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-900">
                          {schedule.deliveryDate || "No date"} ·{" "}
                          {getDeliveryTimeRange(scheduledDelivery)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                          Driver Back Around
                        </p>
                        <p className="mt-1 text-lg font-black text-emerald-800">
                          {getDeliveryBackAroundLabel(scheduledDelivery)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-bold text-slate-500">
                      Site arrival around{" "}
                      {getDeliverySiteArrivalLabel(scheduledDelivery)}.
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {getDeliveryBlockSummary(scheduledDelivery)}
                    </p>

                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Leaving From
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {schedule.deliveryOriginName || "Capital Lumber"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {schedule.deliveryOriginAddress ||
                        "3105 W State St, Boise, ID 83703"}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                      <MapPin
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                      />
                      Delivery Address
                    </p>

                    <p className="text-sm font-semibold text-slate-600">
                      {delivery.address}
                    </p>

                    <a
                      href={getDirectionsUrl(delivery.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#FC2C38] transition hover:text-red-700"
                    >
                      Directions
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </section>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                      <UserRound
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                      />
                      Contact
                    </p>

                    <p className="text-sm font-semibold text-slate-600">
                      {delivery.contactName || "No contact name added"}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {contactPhone || "No contact phone added"}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                      <Truck
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                      />
                      Delivery Type
                    </p>

                    <p className="text-sm font-black text-slate-900">
                      {delivery.unloadType}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {scopeSummary.shortLabel}
                    </p>
                  </section>
                </div>

                <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                    <Package className="h-4 w-4" aria-hidden="true" />
                    Delivery Scope
                  </p>

                  <div className="rounded-xl bg-white px-4 py-3">
                    <p className="text-sm font-black text-slate-900">
                      {scopeSummary.label}
                    </p>

                    {scopeSummary.detail ? (
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {scopeSummary.detail}
                      </p>
                    ) : null}
                  </div>

                  {scopeSummary.usesItems ? (
                    <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                        >
                          {item.quantity ? (
                            <span className="mr-2 font-black text-[#FC2C38]">
                              {item.quantity}
                            </span>
                          ) : null}
                          {item.description}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </article>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
