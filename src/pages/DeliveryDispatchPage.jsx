import { useMemo, useState } from "react";
import {
  ChevronDown,
  Clock,
  CloudRain,
  Edit3,
  ExternalLink,
  MapPin,
  Package,
  Search,
  ShieldAlert,
  StickyNote,
  Truck,
  UserRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import {
  deliveryOriginOptions as fallbackDeliveryOriginOptions,
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
import { formatCustomerName } from "../utils/textFormatters";

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

function formatDateLabel(value) {
  if (!value) {
    return "No date";
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

function formatTimeLabel(value) {
  if (!value) {
    return "";
  }

  const [hours = "0", minutes = "00"] = value.split(":");
  const date = new Date();

  date.setHours(Number(hours), Number(minutes), 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDeliveryTypeLabel(value) {
  if (value === "priority") {
    return "Priority";
  }

  if (value === "hotShot") {
    return "Hot Shot";
  }

  return "Standard";
}

function formatForkliftLabel(value) {
  if (value === "donkey") {
    return "Donkey 5000 lbs";
  }

  if (value === "manitou") {
    return "Manitou 4500 lbs";
  }

  if (value === "moffit") {
    return "Moffit 5500 lbs";
  }

  return "";
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

function getOriginAddress(
  originName,
  originOptions = fallbackDeliveryOriginOptions,
) {
  return (
    originOptions.find(
      (originOption) => originOption.name === originName,
    )?.address || originOptions[0]?.address || ""
  );
}

function getInitialSchedule(
  delivery,
  originOptions = fallbackDeliveryOriginOptions,
) {
  const originName = delivery.deliveryOriginName || "Capital Lumber";

  return {
    deliveryDate: delivery.deliveryDate || getTodayDateValue(),
    deliveryTimeSlot: delivery.deliveryTimeSlot || "",
    deliveryOriginName: originName,
    deliveryOriginAddress:
      delivery.deliveryOriginAddress || getOriginAddress(originName, originOptions),
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

function getUniqueOptions(options) {
  const seenOptions = new Set();

  return options
    .map((option) => String(option || "").trim())
    .filter(Boolean)
    .filter((option) => {
      const key = option.toLowerCase();

      if (seenOptions.has(key)) {
        return false;
      }

      seenOptions.add(key);
      return true;
    });
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

function assignmentsReady(assignments, vehicleOptions, driverOptions) {
  return assignments.every(
    (assignment) =>
      driverOptions.includes(assignment.driver) &&
      (vehicleOptions.length === 0 || assignment.vehicleId),
  );
}

function DispatchDetailSection({
  id,
  title,
  summary,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isOpen}
        aria-controls={id}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-slate-950">
            {title}
          </span>
          {summary ? (
            <span className="mt-0.5 block truncate text-sm font-semibold text-slate-500">
              {summary}
            </span>
          ) : null}
        </span>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div id={id} className="border-t border-slate-200 bg-slate-50 p-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/**
 * @param {{
 *   deliveries: Array<Record<string, any>>;
 *   vehicleOptions?: Array<{ id: string; title: string; badge?: string }>;
 *   employeeOptions?: string[];
 *   deliveryOriginOptions?: Array<{ name: string; address: string }>;
 *   canEditDeliveries?: boolean;
 *   onUpdateDelivery: (deliveryId: string, updates: Record<string, any>) => Promise<void>;
 *   onEditDelivery: (deliveryId: string) => void;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function DeliveryDispatchPage({
  deliveries,
  vehicleOptions = [],
  employeeOptions = [],
  deliveryOriginOptions,
  canEditDeliveries = false,
  onUpdateDelivery,
  onEditDelivery,
  onPageChange,
}) {
  const safeDeliveryOriginOptions =
    Array.isArray(deliveryOriginOptions) && deliveryOriginOptions.length > 0
      ? deliveryOriginOptions
      : fallbackDeliveryOriginOptions;
  const driverOptions = getUniqueOptions([
    ...employeeOptions,
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftAssignments, setDraftAssignments] = useState({});
  const [draftSchedules, setDraftSchedules] = useState({});
  const [openDeliveryKeys, setOpenDeliveryKeys] = useState({});
  const [openDetailKeys, setOpenDetailKeys] = useState({});
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
    return (
      draftSchedules[delivery.id] ||
      getInitialSchedule(delivery, safeDeliveryOriginOptions)
    );
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
      nextSchedule.deliveryOriginAddress = getOriginAddress(
        value,
        safeDeliveryOriginOptions,
      );
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

  function toggleDelivery(deliveryId) {
    setOpenDeliveryKeys((currentOpenDeliveryKeys) => ({
      ...currentOpenDeliveryKeys,
      [deliveryId]: !currentOpenDeliveryKeys[deliveryId],
    }));
  }

  function isDeliveryOpen(deliveryId) {
    return Boolean(openDeliveryKeys[deliveryId]);
  }

  function getDetailKey(deliveryId, detailName) {
    return `${deliveryId}:${detailName}`;
  }

  function toggleDetail(deliveryId, detailName) {
    const detailKey = getDetailKey(deliveryId, detailName);

    setOpenDetailKeys((currentOpenDetailKeys) => ({
      ...currentOpenDetailKeys,
      [detailKey]: !currentOpenDetailKeys[detailKey],
    }));
  }

  function isDetailOpen(deliveryId, detailName) {
    return Boolean(openDetailKeys[getDetailKey(deliveryId, detailName)]);
  }

  async function handleDispatchDelivery(delivery) {
    const assignments = getAssignments(delivery).map((assignment, index) =>
      createAssignment(index, assignment),
    );
    const invalidAssignment = assignments.find(
      (assignment) =>
        !driverOptions.includes(assignment.driver) ||
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
              driverOptions,
            );
            const schedule = getSchedule(delivery);
            const scheduledDelivery = getDeliveryWithDraftSchedule(delivery);
            const selectedScheduleConflict = schedule.deliveryTimeSlot
              ? findScheduleConflict(scheduledDelivery, assignments, deliveries)
              : null;
            const scopeSummary = getDeliveryScopeSummary(delivery);
            const dispatchPanelOpen = isDeliveryOpen(delivery.id);

            return (
              <article
                key={delivery.id}
                className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${
                  dispatchPanelOpen
                    ? "border-[#FC2C38]/30"
                    : "border-slate-200 hover:border-amber-300"
                }`}
              >
                <div className="p-4 sm:p-5">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_auto] xl:items-stretch">
                    <div className="flex min-w-0 flex-col justify-center rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                            Order {delivery.orderNumber}
                          </p>

                          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800 sm:text-xs">
                            Needs Dispatch
                          </span>
                        </div>

                        <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900 sm:mt-2">
                          {formatCustomerName(delivery.customerName)}
                        </h2>
                      </div>

                    <div className="flex min-h-full flex-col justify-center rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left">
                        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                          <Clock className="h-4 w-4" aria-hidden="true" />
                          Delivery Date
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {formatDateLabel(schedule.deliveryDate)}
                        </p>
                        <p className="mt-0.5 text-sm font-black text-slate-600">
                          {getDeliveryTimeRange(scheduledDelivery)}
                        </p>
                      </div>

                    <div className="flex flex-col gap-2 sm:flex-row xl:flex-col xl:justify-center xl:shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleDelivery(delivery.id)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 sm:w-auto"
                        aria-expanded={dispatchPanelOpen}
                      >
                        {dispatchPanelOpen ? "Close" : "Open / Assign"}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            dispatchPanelOpen ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </button>

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
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                        <Truck className="h-4 w-4" aria-hidden="true" />
                        {delivery.unloadType}
                      </span>

                      {delivery.unloadType === "Forklift" &&
                      delivery.forkliftType ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-black text-orange-800">
                          {formatForkliftLabel(delivery.forkliftType)}
                        </span>
                      ) : null}

                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-black ${
                          delivery.deliveryType === "hotShot"
                            ? "bg-red-50 text-[#FC2C38]"
                            : delivery.deliveryType === "priority"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatDeliveryTypeLabel(delivery.deliveryType)}
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

                      {delivery.needsTarp ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700">
                          <CloudRain
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Tarp
                        </span>
                      ) : null}

                      {delivery.driverTargetArrivalTime ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-black text-violet-700">
                          <Clock className="h-4 w-4" aria-hidden="true" />
                          Driver there{" "}
                          {formatTimeLabel(delivery.driverTargetArrivalTime)}
                        </span>
                      ) : null}

                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                        <Package className="h-4 w-4" aria-hidden="true" />
                        {scopeSummary.shortLabel}
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

                {dispatchPanelOpen ? (
                <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
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

                              <optgroup label="Approved Users">
                                {driverOptions.map((driverOption) => (
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

	                    <button
	                      type="button"
	                      onClick={() => handleDispatchDelivery(delivery)}
	                      disabled={isSaving}
	                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
	                    >
	                      <Truck className="h-4 w-4" aria-hidden="true" />
	                      {isSaving ? "Dispatching..." : "Dispatch Delivery"}
	                    </button>
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

                      {!canScheduleDelivery ? (
                        <span className="inline-flex rounded-full bg-slate-200 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Locked until assigned
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Delivery Date
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-900">
                          {formatDateLabel(schedule.deliveryDate)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                          Site Around
                        </p>
                        <p className="mt-1 text-lg font-black text-blue-900">
                          {getDeliverySiteArrivalLabel(scheduledDelivery)}
                        </p>
                      </div>

                      <div
                        className={`rounded-2xl border px-4 py-3 ${
                          canScheduleDelivery
                            ? "border-emerald-100 bg-emerald-50"
                            : "border-slate-200 bg-slate-100"
                        }`}
                      >
                        <p
                          className={`text-xs font-black uppercase tracking-[0.12em] ${
                            canScheduleDelivery
                              ? "text-emerald-700"
                              : "text-slate-500"
                          }`}
                        >
                          Back Around
                        </p>
                        <p
                          className={`mt-1 text-lg font-black ${
                            canScheduleDelivery
                              ? "text-emerald-800"
                              : "text-slate-600"
                          }`}
                        >
                          {getDeliveryBackAroundLabel(scheduledDelivery)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-[#FC2C38]" aria-hidden="true" />
                          <p className="text-sm font-black text-slate-900">
                            When
                          </p>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
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
                              Truck Leaves
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
                                  ? "Choose leave time..."
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
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#FC2C38]" aria-hidden="true" />
                            <p className="text-sm font-black text-slate-900">
                              Route Timing
                            </p>
                          </div>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                            {getDeliveryBlockSummary(scheduledDelivery)}
                          </span>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px]">
                          <div>
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                Leaving From
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
                                {safeDeliveryOriginOptions.map((originOption) => (
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
                      </div>
                    </div>
                  </section>

		                  <div className="mt-5 grid gap-3">
	                    <DispatchDetailSection
	                      id={`delivery-${delivery.id}-route`}
	                      title="Route & Address"
	                      summary={`${delivery.address || "No address"} · ${getDeliveryBlockSummary(
	                        scheduledDelivery,
	                      )}`}
	                      icon={MapPin}
	                      isOpen={isDetailOpen(delivery.id, "route")}
	                      onToggle={() => toggleDetail(delivery.id, "route")}
	                    >
	                      <div className="grid gap-3 lg:grid-cols-2">
	                        <div className="rounded-xl bg-white px-4 py-3">
	                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
	                            Delivery Address
	                          </p>
	                          <p className="mt-1 text-sm font-semibold text-slate-700">
	                            {delivery.address || "No address added"}
	                          </p>
	                          {delivery.address ? (
	                            <a
	                              href={getDirectionsUrl(delivery.address)}
	                              target="_blank"
	                              rel="noreferrer"
	                              className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#FC2C38] transition hover:text-red-700"
	                            >
	                              Directions
	                              <ExternalLink
	                                className="h-4 w-4"
	                                aria-hidden="true"
	                              />
	                            </a>
	                          ) : null}
	                        </div>
	
	                        <div className="rounded-xl bg-white px-4 py-3">
	                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
	                            Leaving From
	                          </p>
	                          <p className="mt-1 text-sm font-black text-slate-900">
	                            {schedule.deliveryOriginName || "Capital Lumber"}
	                          </p>
	                          <p className="mt-1 text-sm font-semibold text-slate-500">
	                            {schedule.deliveryOriginAddress ||
	                              "3105 W State St, Boise, ID 83703"}
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
	                      </div>
	                    </DispatchDetailSection>
	
	                    <DispatchDetailSection
	                      id={`delivery-${delivery.id}-contact`}
	                      title="Customer & Contact"
	                      summary={`${delivery.contactName || "No contact"}${
	                        contactPhone ? ` · ${contactPhone}` : ""
	                      }`}
	                      icon={UserRound}
	                      isOpen={isDetailOpen(delivery.id, "contact")}
	                      onToggle={() => toggleDetail(delivery.id, "contact")}
	                    >
	                      <div className="grid gap-3 sm:grid-cols-3">
	                        <div className="rounded-xl bg-white px-4 py-3">
	                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
	                            Customer
	                          </p>
	                          <p className="mt-1 text-sm font-black text-slate-900">
	                            {formatCustomerName(delivery.customerName)}
	                          </p>
	                        </div>
	                        <div className="rounded-xl bg-white px-4 py-3">
	                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
	                            Contact
	                          </p>
	                          <p className="mt-1 text-sm font-semibold text-slate-700">
	                            {delivery.contactName || "No contact name added"}
	                          </p>
	                        </div>
	                        <div className="rounded-xl bg-white px-4 py-3">
	                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
	                            Phone
	                          </p>
	                          <p className="mt-1 text-sm font-semibold text-slate-700">
	                            {contactPhone || "No contact phone added"}
	                          </p>
	                        </div>
	                      </div>
	                    </DispatchDetailSection>
	
	                    <DispatchDetailSection
	                      id={`delivery-${delivery.id}-scope`}
	                      title="Items & Scope"
	                      summary={`${scopeSummary.shortLabel} · ${items.length} ${
	                        items.length === 1 ? "item" : "items"
	                      }`}
	                      icon={Package}
	                      isOpen={isDetailOpen(delivery.id, "scope")}
	                      onToggle={() => toggleDetail(delivery.id, "scope")}
	                    >
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
	
	                      {scopeSummary.usesItems && items.length > 0 ? (
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
	                    </DispatchDetailSection>
	
	                    <DispatchDetailSection
	                      id={`delivery-${delivery.id}-notes`}
	                      title="Driver Notes"
	                      summary={
	                        delivery.deliveryLocationNotes ||
	                        delivery.generalNotes ||
	                        delivery.deliveryNotes ||
	                        "No notes added"
	                      }
	                      icon={StickyNote}
	                      isOpen={isDetailOpen(delivery.id, "notes")}
	                      onToggle={() => toggleDetail(delivery.id, "notes")}
	                    >
	                      <div className="grid gap-3 lg:grid-cols-2">
	                        <div className="rounded-xl bg-white px-4 py-3">
	                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
	                            Delivery Location Notes
	                          </p>
	                          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-700">
	                            {delivery.deliveryLocationNotes ||
	                              delivery.deliveryNotes ||
	                              "No location notes added"}
	                          </p>
	                        </div>
	                        <div className="rounded-xl bg-white px-4 py-3">
	                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
	                            General Notes
	                          </p>
	                          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-700">
	                            {delivery.generalNotes || "No general notes added"}
	                          </p>
	                        </div>
	                      </div>
	                    </DispatchDetailSection>
	                  </div>
	                </div>
	                ) : null}
	              </article>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
