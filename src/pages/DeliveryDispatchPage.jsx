import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  CloudRain,
  Edit3,
  ExternalLink,
  MapPin,
  Maximize2,
  Package,
  Search,
  ShieldAlert,
  StickyNote,
  Truck,
  UserRound,
  X,
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
  getTimeSlotLabel,
  getTodayDateValue,
  deliveryTimeSlotOptions,
  scheduleWindowsOverlap,
  timeToMinutes,
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

function getGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
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

  if (value === "return") {
    return "Return";
  }

  return "Standard";
}

function getRouteMarkerLabel(index) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  if (index < letters.length) {
    return letters[index];
  }

  return String((index % 10) + 1);
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

function deliveryIncludesVehicle(delivery, assignment) {
  if (!assignment?.vehicleId && !assignment?.vehicleTitle) {
    return false;
  }

  const dispatchAssignments = Array.isArray(delivery.dispatchAssignments)
    ? delivery.dispatchAssignments
    : [];

  return (
    (assignment.vehicleId && delivery.vehicleId === assignment.vehicleId) ||
    (assignment.vehicleTitle &&
      delivery.vehicleTitle &&
      delivery.vehicleTitle === assignment.vehicleTitle) ||
    dispatchAssignments.some(
      (dispatchAssignment) =>
        (assignment.vehicleId &&
          dispatchAssignment.vehicleId === assignment.vehicleId) ||
        (assignment.vehicleTitle &&
          dispatchAssignment.vehicleTitle === assignment.vehicleTitle),
    )
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

function findScheduleConflictDetails(currentDelivery, assignments, deliveries) {
  const currentWindow = getDeliveryTimeWindow(currentDelivery);

  if (!currentDelivery.deliveryDate || !currentWindow) {
    return null;
  }

  for (const delivery of deliveries) {
    if (
      delivery.id === currentDelivery.id ||
      delivery.status === "complete" ||
      delivery.dispatchStatus === "needsDispatch" ||
      delivery.deliveryDate !== currentDelivery.deliveryDate
    ) {
      continue;
    }

    if (!scheduleWindowsOverlap(currentWindow, getDeliveryTimeWindow(delivery))) {
      continue;
    }

    const driverNames = assignments
      .map((assignment) => assignment.driver)
      .filter((driverName) =>
        deliveryIncludesDriver(delivery, driverName),
      );
    const vehicleAssignments = assignments.filter((assignment) =>
      deliveryIncludesVehicle(delivery, assignment),
    );

    if (driverNames.length > 0 || vehicleAssignments.length > 0) {
      return {
        delivery,
        driverNames,
        vehicleAssignments,
        hasDriverConflict: driverNames.length > 0,
        hasVehicleConflict: vehicleAssignments.length > 0,
      };
    }
  }

  return null;
}

function getConflictSummary(conflictDetails) {
  if (!conflictDetails) {
    return "";
  }

  const vehicleLabels = conflictDetails.vehicleAssignments
    .map((assignment) => assignment.vehicleBadge || assignment.vehicleTitle)
    .filter(Boolean);
  const parts = [];

  if (conflictDetails.driverNames.length > 0) {
    parts.push(`driver ${conflictDetails.driverNames.join(", ")}`);
  }

  if (vehicleLabels.length > 0) {
    parts.push(`truck ${vehicleLabels.join(", ")}`);
  }

  return parts.length > 0 ? parts.join(" and ") : "assignment";
}

function assignmentsReady(assignments, vehicleOptions, driverOptions) {
  return assignments.every(
    (assignment) =>
      driverOptions.includes(assignment.driver) &&
      (vehicleOptions.length === 0 || assignment.vehicleId),
  );
}

function assignmentsReadyForSchedule(assignments, driverOptions) {
  return assignments.every((assignment) =>
    driverOptions.includes(assignment.driver),
  );
}

function isDeliveryComplete(delivery) {
  return Boolean(
    delivery.status === "complete" || delivery.completedAt || delivery.deliveredAt,
  );
}

function formatTimelineTime(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) {
    return "";
  }

  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return formatTimeLabel(
    `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  );
}

function getTimelineBlockStyle(window) {
  const dayStartMinutes = 6 * 60;
  const dayEndMinutes = 17 * 60;
  const dayMinutes = dayEndMinutes - dayStartMinutes;

  if (!window) {
    return {
      left: "0%",
      width: "0%",
    };
  }

  const start = Math.max(window.start, dayStartMinutes);
  const end = Math.min(window.end, dayEndMinutes);
  const left = ((start - dayStartMinutes) / dayMinutes) * 100;
  const width = Math.max(5, ((Math.max(end, start + 15) - start) / dayMinutes) * 100);

  return {
    left: `${Math.min(Math.max(left, 0), 100)}%`,
    width: `${Math.min(width, 100 - Math.min(Math.max(left, 0), 100))}%`,
  };
}

function getAssignmentScheduledDeliveries({
  deliveries,
  assignment,
  deliveryDate,
  currentDeliveryId,
}) {
  if (!assignment?.driver || !deliveryDate) {
    return [];
  }

  return deliveries
    .filter(
      (delivery) =>
        delivery.id !== currentDeliveryId &&
        delivery.deliveryDate === deliveryDate &&
        delivery.dispatchStatus !== "needsDispatch" &&
        !isDeliveryComplete(delivery) &&
        (deliveryIncludesDriver(delivery, assignment.driver) ||
          deliveryIncludesVehicle(delivery, assignment)) &&
        getDeliveryTimeWindow(delivery),
    )
    .sort(
      (firstDelivery, secondDelivery) =>
        (timeToMinutes(firstDelivery.deliveryTimeSlot) || 0) -
        (timeToMinutes(secondDelivery.deliveryTimeSlot) || 0),
    );
}

function ScheduleAvailabilityPreview({
  delivery,
  assignments,
  deliveries,
  schedule,
  canPreviewSchedule,
  onOpenCalendar,
}) {
  const previewAssignments = assignments.filter((assignment) => assignment.driver);
  const candidateWindow = getDeliveryTimeWindow(delivery);
  const hasPreviewInputs =
    canPreviewSchedule &&
    previewAssignments.length > 0 &&
    schedule.deliveryDate &&
    schedule.deliveryTimeSlot;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-slate-950">
            <CalendarDays className="h-4 w-4 text-[#FC2C38]" aria-hidden="true" />
            Driver Availability
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Preview this driver&apos;s day before sending the order to the board.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCalendar}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
        >
          Open calendar
        </button>
      </div>

      {!hasPreviewInputs ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500">
          Select a driver, delivery date, and leave time to preview schedule
          conflicts. Add the truck to check truck overlap too.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {previewAssignments.map((assignment, assignmentIndex) => {
            const scheduledDeliveries = getAssignmentScheduledDeliveries({
              deliveries,
              assignment,
              deliveryDate: schedule.deliveryDate,
              currentDeliveryId: delivery.id,
            });
            const conflictDetails = findScheduleConflictDetails(
              delivery,
              [assignment],
              deliveries,
            );
            const hasConflict = Boolean(conflictDetails);
            const conflictSummary = getConflictSummary(conflictDetails);

            return (
              <div
                key={`${assignment.id}-${assignmentIndex}`}
                className={`rounded-2xl border p-3 ${
                  hasConflict
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-100 bg-emerald-50/70"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Driver
                    </p>
                    <p className="text-lg font-black text-slate-950">
                      {assignment.driver}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {assignment.vehicleBadge || assignment.vehicleTitle
                        ? `Truck ${assignment.vehicleBadge || assignment.vehicleTitle}`
                        : "Truck not selected yet"}
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                      hasConflict
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {hasConflict ? "Conflict" : "Available"}
                  </span>
                </div>

                <div className="mt-3 rounded-2xl border border-white/80 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    <span>6 AM</span>
                    <span>Noon</span>
                    <span>5 PM</span>
                  </div>

                  <div className="relative h-12 overflow-hidden rounded-xl bg-slate-100">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-white" />

                    {scheduledDeliveries.map((scheduledItem) => (
                      <div
                        key={scheduledItem.id}
                        className="absolute top-2 h-8 rounded-lg bg-slate-300"
                        style={getTimelineBlockStyle(
                          getDeliveryTimeWindow(scheduledItem),
                        )}
                        title={`${scheduledItem.orderNumber} ${getDeliveryTimeRange(
                          scheduledItem,
                        )}`}
                      />
                    ))}

                    <div
                      className={`absolute top-2 h-8 rounded-lg shadow-sm ${
                        hasConflict ? "bg-amber-500" : "bg-[#FC2C38]"
                      }`}
                      style={getTimelineBlockStyle(candidateWindow)}
                      title={`This order ${getDeliveryTimeRange(delivery)}`}
                    />
                  </div>

                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                        This Delivery
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {getDeliveryTimeRange(delivery)}
                      </p>
                      {candidateWindow ? (
                        <p className="text-xs font-bold text-slate-500">
                          {formatTimelineTime(candidateWindow.start)} to{" "}
                          {formatTimelineTime(candidateWindow.end)}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                        Day Load
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {scheduledDeliveries.length} other{" "}
                        {scheduledDeliveries.length === 1 ? "delivery" : "deliveries"}
                      </p>
                      {hasConflict ? (
                        <p className="text-xs font-bold text-amber-800">
                          {conflictSummary} overlaps order{" "}
                          {conflictDetails.delivery.orderNumber}
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-emerald-700">
                          No driver or truck overlap found
                        </p>
                      )}
                    </div>
                  </div>

                  {scheduledDeliveries.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {scheduledDeliveries.slice(0, 3).map((scheduledItem) => (
                        <div
                          key={scheduledItem.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"
                        >
                          <span className="truncate">
                            Order {scheduledItem.orderNumber} ·{" "}
                            {formatCustomerName(scheduledItem.customerName)}
                          </span>
                          <span className="shrink-0 text-slate-900">
                            {getDeliveryTimeRange(scheduledItem)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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

function DeliveryRouteMapPlanner({
  deliveries,
  selectedDate,
  onSelectedDateChange,
  onOpenDelivery,
}) {
  const googleMapsApiKey = getGoogleMapsApiKey();
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [highlightedDeliveryId, setHighlightedDeliveryId] = useState("");
  const deliveriesWithAddress = deliveries.filter((delivery) =>
    String(delivery.address || "").trim(),
  );
  const staticMapUrl = useMemo(() => {
    if (!googleMapsApiKey || deliveriesWithAddress.length === 0) {
      return "";
    }

    const params = new URLSearchParams({
      key: googleMapsApiKey,
      size: "1200x640",
      scale: "2",
      maptype: "roadmap",
    });

    deliveriesWithAddress.slice(0, 24).forEach((delivery, index) => {
      params.append(
        "markers",
        `color:red|label:${getRouteMarkerLabel(index)}|${delivery.address}`,
      );
    });

    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }, [deliveriesWithAddress, googleMapsApiKey]);
  const highlightedDelivery =
    deliveries.find((delivery) => delivery.id === highlightedDeliveryId) ||
    deliveries[0] ||
    null;

  function renderDeliveryInfo(delivery, index, isLarge = false) {
    const scheduleLabel = delivery.deliveryTimeSlot
      ? getDeliveryTimeRange(delivery)
      : "Needs time";
    const driverLabel =
      delivery.driver ||
      (Array.isArray(delivery.drivers)
        ? delivery.drivers.filter(Boolean).join(", ")
        : "") ||
      "Needs driver";
    const markerLabel = getRouteMarkerLabel(index);

    return (
      <button
        key={delivery.id}
        type="button"
        onClick={() => onOpenDelivery(delivery.id)}
        onMouseEnter={() => setHighlightedDeliveryId(delivery.id)}
        onFocus={() => setHighlightedDeliveryId(delivery.id)}
        className={`flex w-full items-start gap-3 rounded-2xl border text-left transition ${
          highlightedDeliveryId === delivery.id
            ? "border-[#FC2C38] bg-red-50 shadow-sm"
            : "border-slate-200 bg-slate-50 hover:border-[#FC2C38]/40 hover:bg-red-50"
        } ${isLarge ? "px-4 py-4" : "px-3 py-3"}`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FC2C38] text-sm font-black text-white shadow-sm">
          {markerLabel}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Order {delivery.orderNumber}
            </span>
            {delivery.dispatchStatus === "needsDispatch" || !delivery.driver ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
                Dispatch
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Assigned
              </span>
            )}
          </span>
          <span className="mt-1 block truncate text-base font-black text-slate-950">
            {formatCustomerName(delivery.customerName)}
          </span>
          <span className="mt-1 block text-xs font-bold text-slate-500">
            {delivery.address || "No address"}
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700">
              {scheduleLabel}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700">
              {driverLabel}
            </span>
          </span>
        </span>
      </button>
    );
  }

  function getDeliveryIndex(delivery) {
    return deliveries.findIndex(
      (currentDelivery) => currentDelivery.id === delivery?.id,
    );
  }

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="border-b border-slate-200 p-4 sm:p-5 xl:border-b-0 xl:border-r">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
                Route Map
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Dispatch map for the day
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Use the letter markers to spot close deliveries before assigning drivers and trucks.
              </p>
            </div>

            <label className="block sm:min-w-52">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Delivery Date
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => onSelectedDateChange(event.target.value)}
                className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </label>
          </div>

          {staticMapUrl ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <img
                src={staticMapUrl}
                alt={`Delivery route map for ${formatDateLabel(selectedDate)}`}
                className="h-[360px] w-full object-cover sm:h-[480px] xl:h-[540px]"
              />

              {highlightedDelivery ? (
                <div className="absolute bottom-4 left-4 right-4 max-w-xl rounded-2xl border border-white/70 bg-white/95 p-4 shadow-lg backdrop-blur">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FC2C38] text-sm font-black text-white shadow-sm">
                      {getRouteMarkerLabel(
                        Math.max(getDeliveryIndex(highlightedDelivery), 0),
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                        Order {highlightedDelivery.orderNumber}
                      </p>
                      <p className="truncate text-lg font-black text-slate-950">
                        {formatCustomerName(highlightedDelivery.customerName)}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {highlightedDelivery.address}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setIsMapOpen(true)}
                className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-lg transition hover:bg-slate-800"
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
                Full map
              </button>
            </div>
          ) : (
            <div className="flex h-[280px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center sm:h-[360px]">
              <div>
                <MapPin
                  className="mx-auto h-8 w-8 text-slate-400"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-black text-slate-700">
                  {deliveries.length === 0
                    ? "No deliveries scheduled for this date yet."
                    : "Map preview appears when Google Maps is configured and addresses are entered."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex max-h-[560px] flex-col p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Route Labels
              </p>
              <p className="text-lg font-black text-slate-950">
                {deliveries.length}{" "}
                {deliveries.length === 1 ? "delivery" : "deliveries"}
              </p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">
              A, B, C
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {deliveries.length > 0 ? (
              deliveries.map((delivery, index) =>
                renderDeliveryInfo(delivery, index),
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
                Nothing scheduled on this date yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {isMapOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Full delivery route map for ${formatDateLabel(
            selectedDate,
          )}`}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Route Map
                </p>
                <h3 className="text-xl font-black text-slate-950">
                  {formatDateLabel(selectedDate)} Deliveries
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsMapOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Close full map"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="relative min-h-[420px] bg-slate-100 lg:min-h-0">
                {staticMapUrl ? (
                  <img
                    src={staticMapUrl}
                    alt={`Large delivery route map for ${formatDateLabel(
                      selectedDate,
                    )}`}
                    className="h-full w-full object-cover"
                  />
                ) : null}

                {highlightedDelivery ? (
                  <div className="absolute bottom-5 left-5 right-5 max-w-2xl rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FC2C38] text-base font-black text-white shadow-sm">
                        {getRouteMarkerLabel(
                          Math.max(getDeliveryIndex(highlightedDelivery), 0),
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                          Order {highlightedDelivery.orderNumber}
                        </p>
                        <p className="truncate text-2xl font-black text-slate-950">
                          {formatCustomerName(highlightedDelivery.customerName)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {highlightedDelivery.address}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenDelivery(highlightedDelivery.id)}
                        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Hover A/B/C
                  </p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {deliveries.length} stops
                  </span>
                </div>
                <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1 lg:max-h-full">
                  {deliveries.map((delivery, index) =>
                    renderDeliveryInfo(delivery, index, true),
                  )}
                </div>
              </div>
            </div>
          </div>
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
  const [routeMapDate, setRouteMapDate] = useState(getTodayDateValue());

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
  const routeMapDeliveries = useMemo(
    () =>
      deliveries
        .filter((delivery) => {
          const schedule =
            draftSchedules[delivery.id] ||
            getInitialSchedule(delivery, safeDeliveryOriginOptions);

          return (
            delivery.status !== "complete" &&
            schedule.deliveryDate === routeMapDate
          );
        })
        .sort((firstDelivery, secondDelivery) => {
          const firstSchedule =
            draftSchedules[firstDelivery.id] ||
            getInitialSchedule(firstDelivery, safeDeliveryOriginOptions);
          const secondSchedule =
            draftSchedules[secondDelivery.id] ||
            getInitialSchedule(secondDelivery, safeDeliveryOriginOptions);

          return (
            String(firstSchedule.deliveryTimeSlot || "99:99").localeCompare(
              String(secondSchedule.deliveryTimeSlot || "99:99"),
            ) ||
            String(firstDelivery.createdAt || "").localeCompare(
              String(secondDelivery.createdAt || ""),
            )
          );
        })
        .map((delivery) => ({
          ...delivery,
          ...(draftSchedules[delivery.id] ||
            getInitialSchedule(delivery, safeDeliveryOriginOptions)),
        })),
    [deliveries, draftSchedules, routeMapDate, safeDeliveryOriginOptions],
  );

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

  function openDeliveryForDispatch(deliveryId) {
    setOpenDeliveryKeys((currentOpenDeliveryKeys) => ({
      ...currentOpenDeliveryKeys,
      [deliveryId]: true,
    }));

    window.setTimeout(() => {
      document
        .getElementById(`delivery-dispatch-${deliveryId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
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
    const scheduleConflictDetails = findScheduleConflictDetails(
      deliveryWithSchedule,
      assignments,
      deliveries,
    );

    if (scheduleConflictDetails) {
      const conflictSummary = getConflictSummary(scheduleConflictDetails);

      setError(
        `${conflictSummary} already has order ${scheduleConflictDetails.delivery.orderNumber} scheduled ${getDeliveryTimeRange(
          scheduleConflictDetails.delivery,
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
      onPageChange?.("deliveries-calendar");
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

      <DeliveryRouteMapPlanner
        deliveries={routeMapDeliveries}
        selectedDate={routeMapDate}
        onSelectedDateChange={setRouteMapDate}
        onOpenDelivery={openDeliveryForDispatch}
      />

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
            const canPreviewSchedule = assignmentsReadyForSchedule(
              assignments,
              driverOptions,
            );
            const schedule = getSchedule(delivery);
            const scheduledDelivery = getDeliveryWithDraftSchedule(delivery);
            const selectedScheduleConflictDetails = schedule.deliveryTimeSlot
              ? findScheduleConflictDetails(
                  scheduledDelivery,
                  assignments,
                  deliveries,
                )
              : null;
            const scopeSummary = getDeliveryScopeSummary(delivery);
            const dispatchPanelOpen = isDeliveryOpen(delivery.id);
            const driverThereLabel = delivery.driverTargetArrivalTime
              ? formatTimeLabel(delivery.driverTargetArrivalTime)
              : getDeliverySiteArrivalLabel(scheduledDelivery);
            const leaveByLabel = schedule.deliveryTimeSlot
              ? getTimeSlotLabel(schedule.deliveryTimeSlot)
              : "Not scheduled";

            return (
              <article
                key={delivery.id}
                id={`delivery-dispatch-${delivery.id}`}
                className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${
                  dispatchPanelOpen
                    ? "border-[#FC2C38]/30"
                    : "border-slate-200 hover:border-amber-300"
                }`}
              >
                <div className="p-4 sm:p-5">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(210px,260px)_minmax(220px,280px)_auto] xl:items-stretch">
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

                    <div className="flex min-h-full flex-col justify-center rounded-2xl bg-slate-50 px-4 py-3 text-left">
                      <p className="text-sm font-black text-violet-700">
                        Driver there {driverThereLabel}
                      </p>
                      <p className="mt-1 text-sm font-black text-blue-700">
                        Leave By {leaveByLabel}
                      </p>
                      <p className="mt-1 text-sm font-black text-emerald-700">
                        Back around {getDeliveryBackAroundLabel(scheduledDelivery)}
                      </p>
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
                          delivery.deliveryType === "return"
                            ? "bg-blue-50 text-blue-700"
                            : delivery.deliveryType === "hotShot"
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

                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                        <Package className="h-4 w-4" aria-hidden="true" />
                        {scopeSummary.shortLabel}
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

	                  </section>

                  <ScheduleAvailabilityPreview
                    delivery={scheduledDelivery}
                    assignments={assignments}
                    deliveries={deliveries}
                    schedule={schedule}
                    canPreviewSchedule={canPreviewSchedule}
                    onOpenCalendar={() => onPageChange?.("deliveries-calendar")}
                  />

                  <button
                    type="button"
                    onClick={() => handleDispatchDelivery(delivery)}
                    disabled={
                      isSaving ||
                      !canScheduleDelivery ||
                      !schedule.deliveryDate ||
                      !schedule.deliveryTimeSlot ||
                      Boolean(selectedScheduleConflictDetails)
                    }
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                  >
                    <Truck className="h-4 w-4" aria-hidden="true" />
                    {isSaving ? "Dispatching..." : "Dispatch Delivery"}
                  </button>

                  <section
                    className={`mt-5 rounded-2xl border p-4 transition ${
                      canPreviewSchedule
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
                          {canPreviewSchedule
                            ? "Pick a time slot after choosing the driver so conflicts are easier to catch. Add the truck to check truck overlap too."
                            : "Assign a driver first, then schedule the delivery."}
                        </p>
                      </div>

                      {!canPreviewSchedule ? (
                        <span className="inline-flex rounded-full bg-slate-200 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Locked until driver selected
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
                          canPreviewSchedule
                            ? "border-emerald-100 bg-emerald-50"
                            : "border-slate-200 bg-slate-100"
                        }`}
                      >
                        <p
                          className={`text-xs font-black uppercase tracking-[0.12em] ${
                            canPreviewSchedule
                              ? "text-emerald-700"
                              : "text-slate-500"
                          }`}
                        >
                          Back Around
                        </p>
                        <p
                          className={`mt-1 text-lg font-black ${
                            canPreviewSchedule
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
                              disabled={isSaving || !canPreviewSchedule}
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
                              disabled={isSaving || !canPreviewSchedule}
                              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition disabled:bg-slate-200 disabled:text-slate-500 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                            >
                              <option value="">
                                {canPreviewSchedule
                                  ? "Choose leave time..."
                                  : "Assign driver first..."}
                              </option>

                              {deliveryTimeSlotOptions.map((timeSlot) => {
                                const candidateDelivery = {
                                  ...scheduledDelivery,
                                  deliveryTimeSlot: timeSlot.value,
                                };
                                const conflictDetails = findScheduleConflictDetails(
                                  candidateDelivery,
                                  assignments,
                                  deliveries,
                                );
                                const conflictLabel = conflictDetails
                                  ? `${getConflictSummary(
                                      conflictDetails,
                                    )} busy until ${getDeliveryBackAroundLabel(
                                      conflictDetails.delivery,
                                    )}`
                                  : "";

                                return (
                                  <option
                                    key={timeSlot.value}
                                    value={timeSlot.value}
                                    disabled={Boolean(conflictDetails)}
                                  >
                                    {conflictDetails
                                      ? `${timeSlot.label} - ${conflictLabel}`
                                      : timeSlot.label}
                                  </option>
                                );
                              })}
                            </select>

                            {selectedScheduleConflictDetails ? (
                              <span className="mt-2 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                                {getConflictSummary(
                                  selectedScheduleConflictDetails,
                                )}{" "}
                                is already blocked by order{" "}
                                {
                                  selectedScheduleConflictDetails.delivery
                                    .orderNumber
                                }{" "}
                                until{" "}
                                {getDeliveryBackAroundLabel(
                                  selectedScheduleConflictDetails.delivery,
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
                                disabled={isSaving || !canPreviewSchedule}
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
                                disabled={isSaving || !canPreviewSchedule}
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
