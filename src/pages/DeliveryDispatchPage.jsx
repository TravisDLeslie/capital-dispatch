import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  CloudRain,
  Edit3,
  ExternalLink,
  FileText,
  MapPin,
  Maximize2,
  Package,
  Minus,
  Plus,
  Search,
  ShieldAlert,
  StickyNote,
  Trash2,
  Truck,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import {
  capitalLumberAddress,
  deliveryOriginOptions as fallbackDeliveryOriginOptions,
} from "../data/options";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";
import { getCompassDirection } from "../utils/routeDirection";
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
import {
  deleteDeliveryOrderFile,
  uploadDeliveryOrderFiles,
} from "../utils/deliveryOrderStorage";

const REFRESH_PAGE_STORAGE_KEY = "dispatch-cl-refresh-page";
const DELIVERY_ORDER_UPLOAD_TARGET_KEY =
  "dispatch-cl-delivery-order-upload-target";

function rememberDeliveryOrderUploadContext(deliveryId) {
  try {
    sessionStorage.setItem(
      REFRESH_PAGE_STORAGE_KEY,
      "deliveries-dispatch",
    );
    sessionStorage.setItem(
      DELIVERY_ORDER_UPLOAD_TARGET_KEY,
      String(deliveryId || ""),
    );
  } catch (error) {
    console.warn("Unable to remember delivery-order upload:", error);
  }
}

function clearDeliveryOrderUploadTarget() {
  try {
    sessionStorage.removeItem(DELIVERY_ORDER_UPLOAD_TARGET_KEY);
  } catch {
    // Session storage is optional; the upload still works without it.
  }
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deliveryMatchesSearch(delivery, normalizedSearchQuery) {
  if (!normalizedSearchQuery) {
    return true;
  }

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
    delivery.driver,
    delivery.vehicleTitle,
    ...(Array.isArray(delivery.drivers) ? delivery.drivers : []),
    ...items.map(
      (item) => `${item.quantity || ""} ${item.description || ""}`,
    ),
  ].join(" ");

  return normalizeSearch(searchableText).includes(normalizedSearchQuery);
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

function getEmbeddedDeliveryRouteUrl(deliveries) {
  const routeDeliveries = deliveries
    .filter((delivery) => String(delivery?.address || "").trim())
    .slice(0, 10);

  if (routeDeliveries.length === 0) {
    return "";
  }

  const originAddress =
    routeDeliveries.find((delivery) => delivery.deliveryOriginAddress)
      ?.deliveryOriginAddress ||
    fallbackDeliveryOriginOptions[0]?.address ||
    "3105 W State St, Boise, ID 83703";
  const destinationRoute = routeDeliveries
    .map((delivery, index) =>
      index === 0 ? delivery.address : `to:${delivery.address}`,
    )
    .join(" ");
  const params = new URLSearchParams({
    saddr: originAddress,
    daddr: destinationRoute,
    output: "embed",
  });

  return `https://maps.google.com/maps?${params.toString()}`;
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

function getDeliveryOrderDocuments(delivery) {
  return Array.isArray(delivery?.deliveryOrderDocuments)
    ? delivery.deliveryOrderDocuments.filter((document) => document?.url)
    : [];
}

function getDeliveryOrderDocumentKey(document) {
  return String(document?.id || document?.path || document?.url || "");
}

function formatDocumentSize(value) {
  const size = Number(value);

  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function isPdfDocument(document) {
  return (
    document?.type === "application/pdf" ||
    String(document?.name || "").toLowerCase().endsWith(".pdf")
  );
}

function getDeliveryOrderUploadError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "");

  if (code.includes("storage/quota-exceeded")) {
    return "Delivery-order storage is full. An admin needs to check Firebase Storage billing.";
  }

  if (code.includes("storage/unauthorized")) {
    return "Your account does not have permission to upload this Delivery Order Copy.";
  }

  if (code.includes("storage/unauthenticated")) {
    return "Your login expired. Refresh the app, sign in, and try the upload again.";
  }

  if (code.includes("storage/retry-limit-exceeded")) {
    return "The upload timed out. Check the connection and try again.";
  }

  if (message.includes("15 MB") || message.includes("photo, image, or PDF")) {
    return message;
  }

  if (message.includes("Firebase Storage is not configured")) {
    return "Delivery-order storage is not configured for this app.";
  }

  return "Unable to upload that Delivery Order Copy. Try again.";
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

function getPickupInstruction(delivery, scopeSummary) {
  if (delivery.deliveryScope === "shipPartialOrder") {
    return "Pick up only";
  }

  if (delivery.deliveryScope === "shipAllExcept") {
    return "Pick up everything except";
  }

  if (scopeSummary.usesItems) {
    return "Custom pickup list";
  }

  return "Pick up the complete order";
}

function getRouteMarkerLabel(index) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  if (index < letters.length) {
    return letters[index];
  }

  return String((index % 10) + 1);
}

function getDeliveryRouteOrder(delivery) {
  const routeOrder = Number(delivery?.deliveryRouteOrder);

  return Number.isFinite(routeOrder) && routeOrder > 0
    ? routeOrder
    : Number.POSITIVE_INFINITY;
}

function compareDeliveriesByRouteOrder(firstDelivery, secondDelivery) {
  const routeOrderComparison =
    getDeliveryRouteOrder(firstDelivery) - getDeliveryRouteOrder(secondDelivery);

  if (routeOrderComparison !== 0) {
    return routeOrderComparison;
  }

  return (
    String(firstDelivery.deliveryTimeSlot || "99:99").localeCompare(
      String(secondDelivery.deliveryTimeSlot || "99:99"),
    ) ||
    String(firstDelivery.createdAt || "").localeCompare(
      String(secondDelivery.createdAt || ""),
    ) ||
    String(firstDelivery.orderNumber || "").localeCompare(
      String(secondDelivery.orderNumber || ""),
    )
  );
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

function DeliveryDispatchOverview({
  deliveries,
  totalDeliveries,
  routeMetrics,
  selectedDate,
  onSelectedDateChange,
  searchQuery,
  onSearchQueryChange,
  onOpenDelivery,
}) {
  const needsAssignmentCount = totalDeliveries.filter(
    (delivery) =>
      delivery.dispatchStatus === "needsDispatch" || !delivery.driver,
  ).length;
  const assignedCount = Math.max(
    0,
    totalDeliveries.length - needsAssignmentCount,
  );

  function getDriverSummary(delivery) {
    const assignmentDrivers = Array.isArray(delivery.dispatchAssignments)
      ? delivery.dispatchAssignments
          .map((assignment) => assignment?.driver)
          .filter(Boolean)
      : [];
    const drivers = assignmentDrivers.length
      ? assignmentDrivers
      : Array.isArray(delivery.drivers) && delivery.drivers.length
        ? delivery.drivers.filter(Boolean)
        : [delivery.driver].filter(Boolean);

    return drivers.length ? drivers.join(", ") : "Needs driver";
  }

  function getTruckSummary(delivery) {
    const assignmentTrucks = Array.isArray(delivery.dispatchAssignments)
      ? delivery.dispatchAssignments
          .map(
            (assignment) =>
              assignment?.vehicleTitle || assignment?.vehicleBadge,
          )
          .filter(Boolean)
      : [];

    if (assignmentTrucks.length) {
      return assignmentTrucks.join(", ");
    }

    return delivery.vehicleTitle || delivery.vehicleBadge || "Needs truck";
  }

  function handleDeliverySelect(delivery) {
    onOpenDelivery(delivery.id);
  }

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
              Delivery Lineup
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              See the day before assigning it
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Review every destination, time, driver, truck, and load from one place.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
              <p className="text-2xl font-black text-slate-950">
                {totalDeliveries.length}
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                Total
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-center">
              <p className="text-2xl font-black text-amber-800">
                {needsAssignmentCount}
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                Need dispatch
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center">
              <p className="text-2xl font-black text-emerald-800">
                {assignedCount}
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Assigned
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Delivery Date
            </span>
            <span className="relative block">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  onSelectedDateChange(event.target.value)
                }
                className={`block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 ${
                  selectedDate ? "text-slate-900" : "text-transparent"
                }`}
              />
              {!selectedDate ? (
                <span className="pointer-events-none absolute inset-y-px left-1 right-11 flex items-center rounded-l-[11px] bg-white px-3 text-sm font-black text-slate-900">
                  All delivery dates
                </span>
              ) : null}
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Find a delivery
            </span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search order, customer, address, driver, or item..."
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </span>
          </label>
        </div>

        {selectedDate ? (
          <button
            type="button"
            onClick={() => onSelectedDateChange("")}
            className="mt-3 inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.1em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Show all delivery dates
          </button>
        ) : null}
      </div>

      <div className="p-3 sm:p-4">
        <div className="hidden grid-cols-[minmax(170px,1.1fr)_minmax(220px,1.35fr)_minmax(155px,0.8fr)_minmax(170px,0.95fr)_minmax(120px,0.6fr)_100px] gap-3 px-3 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 xl:grid">
          <span>Delivery</span>
          <span>Destination</span>
          <span>Schedule</span>
          <span>Driver / Truck</span>
          <span>Load</span>
          <span className="text-right">Action</span>
        </div>

        {deliveries.length > 0 ? (
          <div className="space-y-2">
            {deliveries.map((delivery, index) => {
              const needsAssignment =
                delivery.dispatchStatus === "needsDispatch" ||
                !delivery.driver;
              const routeIndex = totalDeliveries.findIndex(
                (routeDelivery) => routeDelivery.id === delivery.id,
              );
              const items = Array.isArray(delivery.items)
                ? delivery.items
                : [];
              const scheduleLabel = delivery.deliveryTimeSlot
                ? getDeliveryTimeRange(delivery)
                : "Time not set";
              const routeMetric = routeMetrics[String(delivery.id || "")];

              return (
                <article
                  key={delivery.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleDeliverySelect(delivery)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }

                    event.preventDefault();
                    handleDeliverySelect(delivery);
                  }}
                  className="grid cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-[#FC2C38]/40 hover:bg-red-50/30 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-red-100 xl:grid-cols-[minmax(170px,1.1fr)_minmax(220px,1.35fr)_minmax(155px,0.8fr)_minmax(170px,0.95fr)_minmax(120px,0.6fr)_100px] xl:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-sm font-black text-[#FC2C38]">
                      {getRouteMarkerLabel(
                        routeIndex >= 0 ? routeIndex : index,
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                          Order {delivery.orderNumber}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${
                            needsAssignment
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {needsAssignment ? "Needs dispatch" : "Assigned"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">
                        {formatCustomerName(delivery.customerName)}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 xl:bg-transparent xl:px-0 xl:py-0">
                    <p className="flex items-start gap-2 text-sm font-bold text-slate-700">
                      <MapPin
                        className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <span className="line-clamp-2">
                        {delivery.address || "Address not entered"}
                      </span>
                    </p>
                    {delivery.contactPhone || delivery.phoneNumber ? (
                      <p className="mt-1 pl-6 text-xs font-bold text-slate-500">
                        {delivery.contactPhone || delivery.phoneNumber}
                      </p>
                    ) : null}
                    {routeMetric?.status === "ready" ? (
                      <p className="mt-1 pl-6 text-xs font-black text-blue-700">
                        {routeMetric.direction
                          ? `${routeMetric.direction} of Capital · `
                          : ""}
                        {routeMetric.distanceText}
                      </p>
                    ) : routeMetric?.status === "loading" ? (
                      <p className="mt-1 pl-6 text-xs font-bold text-slate-400">
                        Checking distance...
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 xl:block">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 xl:hidden">
                        Date
                      </p>
                      <p className="mt-0.5 text-sm font-black text-slate-800">
                        {delivery.deliveryDate
                          ? formatDateLabel(delivery.deliveryDate)
                          : "Date not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 xl:hidden">
                        Time
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        {scheduleLabel}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 xl:block">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 xl:hidden">
                        Driver
                      </p>
                      <p className="mt-0.5 truncate text-sm font-black text-slate-800">
                        {getDriverSummary(delivery)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 xl:hidden">
                        Truck
                      </p>
                      <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                        {getTruckSummary(delivery)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 xl:block">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {delivery.unloadType || "Normal"}
                    </p>
                    {items[0]?.description ? (
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-400">
                        {items[0].description}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeliverySelect(delivery);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    className={`inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-xs font-black transition ${
                      needsAssignment
                        ? "bg-slate-950 text-white hover:bg-slate-800"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {needsAssignment ? "Assign" : "Open"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <Package
              className="mx-auto h-7 w-7 text-slate-400"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-black text-slate-700">
              No deliveries match this view.
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Try another date or clear the search.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function DeliveryRouteMapPlanner({
  deliveries,
  selectedDate,
  onOpenDelivery,
  onMoveDelivery,
}) {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [highlightedDeliveryId, setHighlightedDeliveryId] = useState("");
  const [mapZoom, setMapZoom] = useState(11);
  const [segmentRoutes, setSegmentRoutes] = useState({});
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [staticMapFailed, setStaticMapFailed] = useState(false);
  const mapDragRef = useRef(null);
  const selectedDateLabel = selectedDate
    ? formatDateLabel(selectedDate)
    : "All";
  const deliveriesWithAddress = useMemo(
    () =>
      deliveries.filter((delivery) => String(delivery.address || "").trim()),
    [deliveries],
  );
  const routeSegments = useMemo(
    () =>
      deliveriesWithAddress.slice(0, -1).map((delivery, index) => ({
        id: `${delivery.id}-${deliveriesWithAddress[index + 1]?.id}`,
        from: delivery,
        to: deliveriesWithAddress[index + 1],
        fromLabel: getRouteMarkerLabel(index),
        toLabel: getRouteMarkerLabel(index + 1),
      })),
    [deliveriesWithAddress],
  );
  const embeddedRouteMapUrl = useMemo(
    () => getEmbeddedDeliveryRouteUrl(deliveriesWithAddress),
    [deliveriesWithAddress],
  );
  const staticMapUrl = useMemo(() => {
    if (deliveriesWithAddress.length === 0) {
      return "";
    }

    const params = new URLSearchParams({
      size: "1200x640",
      scale: "2",
      maptype: "roadmap",
      zoom: String(mapZoom),
      center: deliveriesWithAddress[0].address,
    });

    const visibleMapDeliveries = deliveriesWithAddress.slice(0, 24);
    const highlightedMapIndex = highlightedDeliveryId
      ? visibleMapDeliveries.findIndex(
          (delivery) => delivery.id === highlightedDeliveryId,
        )
      : -1;

    visibleMapDeliveries.forEach((delivery, index) => {
      if (index === highlightedMapIndex) {
        return;
      }

      params.append(
        "markers",
        `color:red|label:${getRouteMarkerLabel(index)}|${delivery.address}`,
      );
    });

    if (highlightedMapIndex >= 0) {
      const highlightedMapDelivery = visibleMapDeliveries[highlightedMapIndex];
      params.append(
        "markers",
        `color:blue|label:${getRouteMarkerLabel(highlightedMapIndex)}|${
          highlightedMapDelivery.address
        }`,
      );
    }

    return `/api/maps/static?${params.toString()}`;
  }, [
    deliveriesWithAddress,
    highlightedDeliveryId,
    mapZoom,
  ]);
  const highlightedDelivery =
    deliveries.find((delivery) => delivery.id === highlightedDeliveryId) ||
    deliveries[0] ||
    null;

  useEffect(() => {
    setStaticMapFailed(false);
  }, [deliveriesWithAddress]);

  useEffect(() => {
    if (routeSegments.length === 0) {
      setSegmentRoutes({});
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();

    setSegmentRoutes((currentRoutes) => {
      const nextRoutes = {};
      routeSegments.forEach((segment) => {
        if (currentRoutes[segment.id]) {
          nextRoutes[segment.id] = currentRoutes[segment.id];
        }
      });
      return nextRoutes;
    });

    routeSegments.forEach((segment) => {
      const params = new URLSearchParams({
        origin: segment.from.address,
        destination: segment.to.address,
      });

      fetch(`/api/maps/route?${params.toString()}`, {
        signal: controller.signal,
      })
        .then((response) =>
          response
            .json()
            .catch(() => ({}))
            .then((data) => {
              if (!response.ok) {
                throw new Error(data?.error || "Route unavailable");
              }
              return data;
            }),
        )
        .then((data) => {
          if (!isCurrent) {
            return;
          }

          setSegmentRoutes((currentRoutes) => ({
            ...currentRoutes,
            [segment.id]: {
              status: "ready",
              durationText: data.durationText || "",
              distanceText: data.distanceText || "",
            },
          }));
        })
        .catch((error) => {
          if (!isCurrent || error.name === "AbortError") {
            return;
          }

          setSegmentRoutes((currentRoutes) => ({
            ...currentRoutes,
            [segment.id]: {
              status: "error",
              durationText: "",
              distanceText: "",
            },
          }));
        });
    });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [routeSegments]);

  function updateMapZoom(direction) {
    setMapZoom((currentZoom) => {
      const nextZoom = direction === "in" ? currentZoom + 1 : currentZoom - 1;
      return Math.min(17, Math.max(7, nextZoom));
    });
    setMapPan({ x: 0, y: 0 });
  }

  function getMapPointerPosition(event) {
    const pointer = event.touches?.[0] || event.changedTouches?.[0] || event;

    return {
      x: pointer.clientX || 0,
      y: pointer.clientY || 0,
    };
  }

  function startMapDrag(event) {
    if (!isMapOpen || !staticMapUrl || staticMapFailed) {
      return;
    }

    if (event.target?.closest?.("button, a")) {
      return;
    }

    const pointer = getMapPointerPosition(event);
    mapDragRef.current = {
      startX: pointer.x,
      startY: pointer.y,
      startPanX: mapPan.x,
      startPanY: mapPan.y,
    };
    setIsDraggingMap(true);
  }

  function moveMapDrag(event) {
    if (!mapDragRef.current) {
      return;
    }

    event.preventDefault();
    const pointer = getMapPointerPosition(event);
    const nextX =
      mapDragRef.current.startPanX + pointer.x - mapDragRef.current.startX;
    const nextY =
      mapDragRef.current.startPanY + pointer.y - mapDragRef.current.startY;

    setMapPan({
      x: Math.max(-700, Math.min(700, nextX)),
      y: Math.max(-500, Math.min(500, nextY)),
    });
  }

  function endMapDrag() {
    mapDragRef.current = null;
    setIsDraggingMap(false);
  }

  function renderZoomControls(positionClassName = "") {
    return (
      <div
        className={`absolute z-10 flex overflow-hidden rounded-full border border-slate-200 bg-white shadow-lg ${positionClassName}`}
      >
        <button
          type="button"
          onClick={() => updateMapZoom("out")}
          className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:text-slate-300"
          disabled={mapZoom <= 7}
          aria-label="Zoom map out"
        >
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="flex min-w-11 items-center justify-center border-x border-slate-200 px-3 text-xs font-black text-slate-600">
          {mapZoom}x
        </span>
        <button
          type="button"
          onClick={() => updateMapZoom("in")}
          className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:text-slate-300"
          disabled={mapZoom >= 17}
          aria-label="Zoom map in"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );
  }

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
      <div
        key={delivery.id}
        onMouseEnter={() => setHighlightedDeliveryId(delivery.id)}
        className={`flex w-full items-start gap-3 rounded-2xl border text-left transition ${
          highlightedDeliveryId === delivery.id
            ? "border-[#FC2C38] bg-red-50 shadow-sm"
            : "border-slate-200 bg-slate-50 hover:border-[#FC2C38]/40 hover:bg-red-50"
        } ${isLarge ? "px-4 py-4" : "px-3 py-3"}`}
      >
        <span className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenDelivery(delivery.id)}
            onFocus={() => setHighlightedDeliveryId(delivery.id)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FC2C38] text-sm font-black text-white shadow-sm"
            aria-label={`Open order ${delivery.orderNumber}`}
          >
            {markerLabel}
          </button>
          {deliveries.length > 1 && onMoveDelivery ? (
            <span className="flex overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => onMoveDelivery(delivery.id, "up")}
                disabled={index === 0}
                className="flex h-7 w-7 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:text-slate-300"
                aria-label={`Move ${delivery.orderNumber} earlier`}
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onMoveDelivery(delivery.id, "down")}
                disabled={index === deliveries.length - 1}
                className="flex h-7 w-7 items-center justify-center border-l border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:text-slate-300"
                aria-label={`Move ${delivery.orderNumber} later`}
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => onOpenDelivery(delivery.id)}
          onFocus={() => setHighlightedDeliveryId(delivery.id)}
          className="min-w-0 flex-1 text-left"
        >
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
        </button>
      </div>
    );
  }

  function renderSegmentTiming(segment) {
    const route = segmentRoutes[segment.id];
    const isLoading = !route;
    const isReady = route?.status === "ready";

    return (
      <div
        key={segment.id}
        className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {segment.fromLabel} to {segment.toLabel}
            </p>
            <p className="mt-1 truncate text-sm font-black text-slate-950">
              {formatCustomerName(segment.from.customerName)} to{" "}
              {formatCustomerName(segment.to.customerName)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-black text-[#FC2C38]">
              {isLoading
                ? "..."
                : isReady
                  ? route.durationText
                  : "No ETA"}
            </p>
            <p className="text-xs font-bold text-slate-500">
              {isReady ? route.distanceText : "between stops"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function getDeliveryIndex(delivery) {
    return deliveries.findIndex(
      (currentDelivery) => currentDelivery.id === delivery?.id,
    );
  }

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.45fr)_340px]">
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

            <div className="flex flex-col items-stretch gap-2 sm:min-w-52 sm:items-end">
              <span className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-black uppercase tracking-[0.1em] text-slate-600">
                {selectedDateLabel}
              </span>
              {staticMapUrl ? (
                <button
                  type="button"
                  onClick={() => setIsMapOpen(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-slate-800"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  View Full Map
                </button>
              ) : null}
            </div>
          </div>

          {staticMapUrl ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {staticMapFailed && embeddedRouteMapUrl ? (
                <iframe
                  src={embeddedRouteMapUrl}
                  title={`Delivery route map for ${selectedDateLabel}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-[380px] w-full border-0 bg-slate-100 sm:h-[460px] xl:h-[540px]"
                  allowFullScreen
                />
              ) : (
                <>
                  {renderZoomControls("left-4 top-4")}
                  <img
                    src={staticMapUrl}
                    alt={`Delivery route map for ${selectedDateLabel}`}
                    onError={() => setStaticMapFailed(true)}
                    className="h-[380px] w-full object-contain sm:h-[460px] xl:h-[540px]"
                  />
                </>
              )}

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
                className="absolute right-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg transition hover:bg-slate-800"
                aria-label="View full map"
              >
                <Maximize2 className="h-5 w-5" aria-hidden="true" />
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

          {routeSegments.length > 0 ? (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Time Between Stops
                </p>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Live ETA
                </span>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {routeSegments.map(renderSegmentTiming)}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {isMapOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Full delivery route map for ${selectedDateLabel}`}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Route Map
                </p>
                <h3 className="text-xl font-black text-slate-950">
                  {selectedDateLabel} Deliveries
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
              <div
                className={`relative min-h-[420px] overflow-hidden bg-slate-100 lg:min-h-0 ${
                  isDraggingMap ? "cursor-grabbing" : "cursor-grab"
                }`}
                onMouseDown={startMapDrag}
                onMouseMove={moveMapDrag}
                onMouseUp={endMapDrag}
                onMouseLeave={endMapDrag}
                onTouchStart={startMapDrag}
                onTouchMove={moveMapDrag}
                onTouchEnd={endMapDrag}
              >
                {staticMapFailed && embeddedRouteMapUrl ? (
                  <iframe
                    src={embeddedRouteMapUrl}
                    title={`Large delivery route map for ${selectedDateLabel}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full w-full border-0 bg-slate-100"
                    allowFullScreen
                  />
                ) : staticMapUrl ? (
                  <>
                    {renderZoomControls("left-5 top-5")}
                    <div className="absolute left-5 top-20 z-10 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">
                        Drag map to move around
                      </span>
                      {(mapPan.x !== 0 || mapPan.y !== 0) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMapPan({ x: 0, y: 0 });
                          }}
                          className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-slate-800"
                        >
                          Reset
                        </button>
                      ) : null}
                    </div>
                    <img
                      src={staticMapUrl}
                      alt={`Large delivery route map for ${selectedDateLabel}`}
                      onError={() => setStaticMapFailed(true)}
                      draggable="false"
                      className="h-full w-full select-none object-cover"
                      style={{
                        transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(1.35)`,
                        transition: isDraggingMap
                          ? "none"
                          : "transform 160ms ease",
                      }}
                    />
                  </>
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

                {routeSegments.length > 0 ? (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Time Between Stops
                      </p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                        A to B
                      </span>
                    </div>
                    <div className="space-y-2">
                      {routeSegments.map(renderSegmentTiming)}
                    </div>
                  </div>
                ) : null}
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
  const [markingDeliveredId, setMarkingDeliveredId] = useState("");
  const [uploadingDeliveryId, setUploadingDeliveryId] = useState("");
  const [deletingDeliveryOrderId, setDeletingDeliveryOrderId] = useState("");
  const [attachedDeliveryOrderId, setAttachedDeliveryOrderId] = useState("");
  const [previewedDeliveryOrder, setPreviewedDeliveryOrder] = useState(null);
  const [error, setError] = useState("");
  const [routeMapDate, setRouteMapDate] = useState("");
  const [draftRouteOrders, setDraftRouteOrders] = useState({});
  const [routeMetrics, setRouteMetrics] = useState({});
  const deliveryOrderInputRefs = useRef({});

  useEffect(() => {
    if (!previewedDeliveryOrder) {
      return undefined;
    }

    function handlePreviewKeyDown(event) {
      if (event.key === "Escape") {
        setPreviewedDeliveryOrder(null);
      }
    }

    window.addEventListener("keydown", handlePreviewKeyDown);

    return () => {
      window.removeEventListener("keydown", handlePreviewKeyDown);
    };
  }, [previewedDeliveryOrder]);

  useEffect(() => {
    let uploadTargetId = "";

    try {
      uploadTargetId =
        sessionStorage.getItem(DELIVERY_ORDER_UPLOAD_TARGET_KEY) || "";
    } catch {
      return;
    }

    if (!uploadTargetId) {
      return;
    }

    const uploadTarget = deliveries.find(
      (delivery) => delivery.id === uploadTargetId,
    );

    if (!uploadTarget) {
      return;
    }

    setOpenDeliveryKeys((currentOpenDeliveryKeys) => ({
      ...currentOpenDeliveryKeys,
      [uploadTargetId]: true,
    }));

    if (getDeliveryOrderDocuments(uploadTarget).length > 0) {
      setAttachedDeliveryOrderId(uploadTargetId);
    }

    window.setTimeout(() => {
      document
        .getElementById(`delivery-dispatch-${uploadTargetId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 75);

    clearDeliveryOrderUploadTarget();
  }, [deliveries]);

  const normalizedSearchQuery = normalizeSearch(searchQuery);
  const routeMapDeliveries = useMemo(
    () =>
      deliveries
        .map((delivery) => {
          const schedule =
            draftSchedules[delivery.id] ||
            getInitialSchedule(delivery, safeDeliveryOriginOptions);
          const draftRouteOrder = Number(
            draftRouteOrders[routeMapDate]?.[delivery.id],
          );

          return {
            ...delivery,
            ...schedule,
            deliveryRouteOrder:
              Number.isFinite(draftRouteOrder) && draftRouteOrder > 0
                ? draftRouteOrder
                : delivery.deliveryRouteOrder,
          };
        })
        .filter(
          (delivery) =>
            delivery.status !== "complete" &&
            (!routeMapDate || delivery.deliveryDate === routeMapDate),
        )
        .sort((firstDelivery, secondDelivery) => {
          return compareDeliveriesByRouteOrder(firstDelivery, secondDelivery);
        }),
    [
      deliveries,
      draftRouteOrders,
      draftSchedules,
      routeMapDate,
      safeDeliveryOriginOptions,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    const deliveriesByAddress = new Map();

    routeMapDeliveries.forEach((delivery) => {
      const address = String(delivery.address || "").trim();
      const deliveryId = String(delivery.id || "");

      if (!deliveryId || !address) {
        return;
      }

      const addressKey = normalizeSearch(address);
      const currentEntry = deliveriesByAddress.get(addressKey) || {
        address,
        deliveryIds: [],
      };

      currentEntry.deliveryIds.push(deliveryId);
      deliveriesByAddress.set(addressKey, currentEntry);
    });

    setRouteMetrics(
      Object.fromEntries(
        routeMapDeliveries.map((delivery) => {
          const deliveryId = String(delivery.id || "");
          const hasAddress = Boolean(String(delivery.address || "").trim());

          return [deliveryId, { status: hasAddress ? "loading" : "missing" }];
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

          console.warn("Unable to load dispatch delivery route:", routeError);
          setRouteMetrics((currentMetrics) => {
            const nextMetrics = { ...currentMetrics };

            deliveryIds.forEach((deliveryId) => {
              nextMetrics[deliveryId] = { status: "error" };
            });

            return nextMetrics;
          });
        });
    });

    return () => controller.abort();
  }, [routeMapDeliveries]);

  const visibleRouteMapDeliveries = normalizedSearchQuery
    ? routeMapDeliveries.filter((delivery) =>
        deliveryMatchesSearch(delivery, normalizedSearchQuery),
      )
    : routeMapDeliveries;

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

  async function handleMoveRouteDelivery(deliveryId, direction) {
    const currentIndex = routeMapDeliveries.findIndex(
      (delivery) => delivery.id === deliveryId,
    );

    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= routeMapDeliveries.length) {
      return;
    }

    const reorderedDeliveries = [...routeMapDeliveries];
    const [movedDelivery] = reorderedDeliveries.splice(currentIndex, 1);
    reorderedDeliveries.splice(nextIndex, 0, movedDelivery);
    const nextRouteOrderById = reorderedDeliveries.reduce(
      (routeOrders, delivery, index) => ({
        ...routeOrders,
        [delivery.id]: index + 1,
      }),
      {},
    );

    setDraftRouteOrders((currentDraftRouteOrders) => ({
      ...currentDraftRouteOrders,
      [routeMapDate]: nextRouteOrderById,
    }));
    setError("");

    try {
      for (const delivery of reorderedDeliveries) {
        await onUpdateDelivery(delivery.id, {
          deliveryRouteOrder: nextRouteOrderById[delivery.id],
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (routeOrderError) {
      console.error("Unable to save delivery route order:", routeOrderError);
      setError("Unable to save delivery route order. Try again.");
    }
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
        deliveryRouteOrder:
          getDeliveryRouteOrder(delivery) === Number.POSITIVE_INFINITY
            ? Math.max(
                1,
                routeMapDeliveries.findIndex(
                  (routeDelivery) => routeDelivery.id === delivery.id,
                ) + 1,
              )
            : getDeliveryRouteOrder(delivery),
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

  async function handleDeliveryOrderUpload(delivery, selectedFiles) {
    const files = Array.from(selectedFiles || []);

    if (files.length === 0) {
      return;
    }

    const currentDocuments = getDeliveryOrderDocuments(delivery);

    if (currentDocuments.length + files.length > 8) {
      setError(
        `Order ${delivery.orderNumber} can have up to 8 delivery-order files.`,
      );
      return;
    }

    setUploadingDeliveryId(delivery.id);
    setError("");

    try {
      const uploadedDocuments = await uploadDeliveryOrderFiles({
        deliveryId: delivery.id,
        files,
      });

      await onUpdateDelivery(delivery.id, {
        deliveryOrderDocuments: [
          ...currentDocuments,
          ...uploadedDocuments,
        ],
      });
      setAttachedDeliveryOrderId(delivery.id);
      openDeliveryForDispatch(delivery.id);
      onPageChange?.("deliveries-dispatch");
    } catch (uploadError) {
      console.error("Unable to upload delivery order:", uploadError);
      setError(getDeliveryOrderUploadError(uploadError));
      clearDeliveryOrderUploadTarget();
    } finally {
      setUploadingDeliveryId("");
    }
  }

  function handleChooseAnotherDeliveryOrder(deliveryId) {
    rememberDeliveryOrderUploadContext(deliveryId);
    setPreviewedDeliveryOrder(null);

    window.setTimeout(() => {
      deliveryOrderInputRefs.current[deliveryId]?.click();
    }, 0);
  }

  async function handleDeleteDeliveryOrder(documentToDelete) {
    const delivery = deliveries.find(
      (candidate) => candidate.id === documentToDelete?.deliveryId,
    );

    if (!delivery) {
      setError("Unable to find that delivery. Refresh the page and try again.");
      return;
    }

    const documentName = documentToDelete.name || "this Delivery Order Copy";
    const confirmed = window.confirm(
      `Delete ${documentName} from order ${delivery.orderNumber || "delivery"}?`,
    );

    if (!confirmed) {
      return;
    }

    const documentKey = getDeliveryOrderDocumentKey(documentToDelete);
    const remainingDocuments = getDeliveryOrderDocuments(delivery).filter(
      (document) => getDeliveryOrderDocumentKey(document) !== documentKey,
    );

    setDeletingDeliveryOrderId(documentKey);
    setError("");

    try {
      await onUpdateDelivery(delivery.id, {
        deliveryOrderDocuments: remainingDocuments,
      });

      try {
        await deleteDeliveryOrderFile(documentToDelete);
      } catch (storageDeleteError) {
        // The attachment has already been removed from the delivery. Keep the
        // dispatch flow moving if Storage cleanup is temporarily unavailable.
        console.warn(
          "Unable to remove delivery-order file from Storage:",
          storageDeleteError,
        );
      }

      setPreviewedDeliveryOrder(null);
      setAttachedDeliveryOrderId("");
      openDeliveryForDispatch(delivery.id);
      onPageChange?.("deliveries-dispatch");
    } catch (deleteError) {
      console.error("Unable to delete delivery order:", deleteError);
      setError("Unable to delete that Delivery Order Copy. Try again.");
    } finally {
      setDeletingDeliveryOrderId("");
    }
  }

  async function handleMarkDelivered(delivery) {
    const orderLabel = delivery.orderNumber
      ? `order ${delivery.orderNumber}`
      : "this delivery";
    const customerLabel = formatCustomerName(delivery.customerName);
    const confirmed = window.confirm(
      `Mark ${orderLabel}${customerLabel ? ` for ${customerLabel}` : ""} as delivered?\n\nThis removes it from active Dispatch and keeps it in Delivery History.`,
    );

    if (!confirmed) {
      return;
    }

    const deliveredAt = new Date().toISOString();

    setMarkingDeliveredId(delivery.id);
    setError("");

    try {
      await onUpdateDelivery(delivery.id, {
        status: "complete",
        deliveredAt,
        deliveryCompletionSource: "dispatchOverride",
        deliveryOverrideAt: deliveredAt,
      });
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    } catch (updateError) {
      console.error("Unable to mark delivery delivered:", updateError);
      setError(
        `Unable to mark ${orderLabel} delivered. Check your connection and try again.`,
      );
    } finally {
      setMarkingDeliveredId("");
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

      <DeliveryDispatchOverview
        deliveries={visibleRouteMapDeliveries}
        totalDeliveries={routeMapDeliveries}
        routeMetrics={routeMetrics}
        selectedDate={routeMapDate}
        onSelectedDateChange={setRouteMapDate}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onOpenDelivery={openDeliveryForDispatch}
      />

      <DeliveryRouteMapPlanner
        deliveries={routeMapDeliveries}
        selectedDate={routeMapDate}
        onOpenDelivery={openDeliveryForDispatch}
        onMoveDelivery={handleMoveRouteDelivery}
      />

      {visibleRouteMapDeliveries.length === 0 ? (
        <EmptyState
          title={
            routeMapDeliveries.length === 0
              ? routeMapDate
                ? `No deliveries for ${formatDateLabel(routeMapDate)}`
                : "No active deliveries"
              : "No matching delivery orders"
          }
          description={
            routeMapDeliveries.length === 0
              ? routeMapDate
                ? "Choose another date above or show all deliveries."
                : "New delivery orders will appear here."
              : "Try another order number, customer, address, or item."
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleRouteMapDeliveries.map((delivery) => {
            const items = Array.isArray(delivery.items)
              ? delivery.items
              : [];
            const contactPhone =
              delivery.contactPhone || delivery.phoneNumber || "";
            const needsAssignment =
              delivery.dispatchStatus === "needsDispatch" ||
              !delivery.driver;
            const isSaving = savingDeliveryId === delivery.id;
            const isMarkingDelivered =
              markingDeliveredId === delivery.id;
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
            const pickupInstruction = getPickupInstruction(
              delivery,
              scopeSummary,
            );
            const visiblePickupItems = items.slice(0, 4);
            const hiddenPickupItemCount = Math.max(
              0,
              items.length - visiblePickupItems.length,
            );
            const dispatchPanelOpen = isDeliveryOpen(delivery.id);
            const deliveryOrderDocuments = getDeliveryOrderDocuments(delivery);
            const isUploadingDeliveryOrder =
              uploadingDeliveryId === delivery.id;
            const driverThereLabel = delivery.driverTargetArrivalTime
              ? formatTimeLabel(delivery.driverTargetArrivalTime)
              : getDeliverySiteArrivalLabel(scheduledDelivery);
            const leaveByLabel = schedule.deliveryTimeSlot
              ? getTimeSlotLabel(schedule.deliveryTimeSlot)
              : "Not scheduled";
            const routeMetric = routeMetrics[String(delivery.id || "")];

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

                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] sm:text-xs ${
                              needsAssignment
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {needsAssignment ? "Needs Dispatch" : "Assigned"}
                          </span>
                        </div>

                        <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900 sm:mt-2">
                          {formatCustomerName(delivery.customerName)}
                        </h2>

                        {delivery.address ? (
                          <>
                            <a
                              href={getDirectionsUrl(delivery.address)}
                              target="_blank"
                              rel="noreferrer"
                              title={delivery.address}
                              className="mt-2 flex w-fit max-w-full items-start gap-2 text-sm font-bold leading-5 text-slate-600 transition hover:text-[#FC2C38]"
                            >
                              <MapPin
                                className="mt-0.5 h-4 w-4 shrink-0 text-[#FC2C38]"
                                aria-hidden="true"
                              />
                              <span className="line-clamp-2">{delivery.address}</span>
                              <ExternalLink
                                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                            </a>
                            {routeMetric?.status === "ready" ? (
                              <p className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                                {routeMetric.direction
                                  ? `${routeMetric.direction} of Capital · `
                                  : ""}
                                {routeMetric.distanceText}
                              </p>
                            ) : routeMetric?.status === "loading" ? (
                              <p className="mt-2 text-xs font-bold text-slate-400">
                                Checking distance from Capital...
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p className="mt-2 flex items-center gap-2 text-sm font-bold text-amber-700">
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                            No delivery address added
                          </p>
                        )}
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
                        {dispatchPanelOpen
                          ? "Close"
                          : needsAssignment
                            ? "Open / Assign"
                            : "Open Details"}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            dispatchPanelOpen ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          rememberDeliveryOrderUploadContext(delivery.id);
                          deliveryOrderInputRefs.current[delivery.id]?.click();
                        }}
                        disabled={isUploadingDeliveryOrder}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                      >
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        {isUploadingDeliveryOrder
                          ? "Uploading..."
                          : deliveryOrderDocuments.length > 0
                            ? "Add Another Copy"
                            : "Upload Delivery Order Copy"}
                      </button>

                      <input
                        ref={(inputElement) => {
                          if (inputElement) {
                            deliveryOrderInputRefs.current[delivery.id] =
                              inputElement;
                          }
                        }}
                        type="file"
                        accept="image/*,application/pdf,.pdf"
                        multiple
                        disabled={isUploadingDeliveryOrder}
                        onChange={(event) => {
                          rememberDeliveryOrderUploadContext(delivery.id);
                          handleDeliveryOrderUpload(
                            delivery,
                            event.target.files,
                          );
                          event.target.value = "";
                        }}
                        className="sr-only"
                      />

                    </div>
                  </div>

                  {deliveryOrderDocuments.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-blue-900">
                          <FileText className="h-4 w-4" aria-hidden="true" />
                          Delivery Order Copy
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {attachedDeliveryOrderId === delivery.id ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                              <CheckCircle2
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Attached
                            </span>
                          ) : null}
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700 shadow-sm">
                            {deliveryOrderDocuments.length}{" "}
                            {deliveryOrderDocuments.length === 1
                              ? "file"
                              : "files"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {deliveryOrderDocuments.map((document, documentIndex) => (
                          <button
                            type="button"
                            key={
                              document.id ||
                              document.path ||
                              `${delivery.id}-delivery-order-${documentIndex}`
                            }
                            onClick={() =>
                              setPreviewedDeliveryOrder({
                                ...document,
                                deliveryId: delivery.id,
                                orderNumber: delivery.orderNumber,
                              })
                            }
                            className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-blue-100 transition hover:ring-blue-300"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                <FileText
                                  className="h-5 w-5"
                                  aria-hidden="true"
                                />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-black text-slate-900">
                                  {document.name || "Delivery Order Copy"}
                                </span>
                                <span className="block text-xs font-bold text-slate-500">
                                  {formatDocumentSize(document.size) ||
                                    "Uploaded file"}
                                </span>
                              </span>
                            </span>
                            <Maximize2
                              className="h-4 w-4 shrink-0 text-blue-700"
                              aria-hidden="true"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-amber-900">
                        <Package className="h-4 w-4 text-[#FC2C38]" aria-hidden="true" />
                        Items being picked up
                      </p>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-900 shadow-sm">
                        {scopeSummary.shortLabel}
                      </span>
                    </div>

                    {scopeSummary.usesItems && visiblePickupItems.length > 0 ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {visiblePickupItems.map((item, itemIndex) => (
                          <div
                            key={item.id || `${delivery.id}-pickup-${itemIndex}`}
                            className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-amber-100"
                          >
                            {item.quantity ? (
                              <span className="flex min-w-8 shrink-0 items-center justify-center rounded-lg bg-[#FC2C38] px-2 py-1 text-xs font-black text-white">
                                {item.quantity}
                              </span>
                            ) : null}
                            <span className="min-w-0 text-sm font-black leading-5 text-slate-800">
                              {item.description || "Unnamed item"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                        <p className="text-sm font-black text-slate-950">
                          {pickupInstruction}
                        </p>
                        {scopeSummary.detail ? (
                          <p className="text-sm font-bold text-slate-700">
                            {scopeSummary.detail}
                          </p>
                        ) : null}
                      </div>
                    )}

                    {hiddenPickupItemCount > 0 ? (
                      <p className="mt-2 text-xs font-black text-amber-900">
                        +{hiddenPickupItemCount} more {hiddenPickupItemCount === 1 ? "item" : "items"} — open the order for the full list
                      </p>
                    ) : null}
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

                      {canEditDeliveries ? (
                        <button
                          type="button"
                          onClick={() => onEditDelivery(delivery.id)}
                          className="ml-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-100"
                        >
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </button>
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

                  <div className="flex justify-end border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
                    <button
                      type="button"
                      onClick={() => handleMarkDelivered(delivery)}
                      disabled={
                        isSaving ||
                        isUploadingDeliveryOrder ||
                        isMarkingDelivered
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                    >
                      <CheckCircle2
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      {isMarkingDelivered ? "Saving..." : "Mark Delivered"}
                    </button>
                  </div>
	              </article>
            );
          })}
        </div>
      )}

      {previewedDeliveryOrder ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-order-preview-title"
          onClick={() => setPreviewedDeliveryOrder(null)}
        >
          <div
            className="flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 sm:text-xs">
                  Order {previewedDeliveryOrder.orderNumber || "Delivery"}
                </p>
                <h2
                  id="delivery-order-preview-title"
                  className="truncate text-lg font-black text-slate-950 sm:text-xl"
                >
                  {previewedDeliveryOrder.name || "Delivery Order Copy"}
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleChooseAnotherDeliveryOrder(
                      previewedDeliveryOrder.deliveryId,
                    )
                  }
                  disabled={
                    uploadingDeliveryId ===
                      previewedDeliveryOrder.deliveryId ||
                    Boolean(deletingDeliveryOrderId)
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-50 sm:px-4"
                  aria-label="Upload another Delivery Order Copy"
                  title="Upload another Delivery Order Copy"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline">Upload another</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteDeliveryOrder(previewedDeliveryOrder)
                  }
                  disabled={Boolean(deletingDeliveryOrderId)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-50 sm:px-4"
                  aria-label="Delete Delivery Order Copy"
                  title="Delete Delivery Order Copy"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline">
                    {deletingDeliveryOrderId ? "Deleting..." : "Delete"}
                  </span>
                </button>
                <a
                  href={previewedDeliveryOrder.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
                >
                  Open original
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewedDeliveryOrder(null)}
                  disabled={Boolean(deletingDeliveryOrderId)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm transition hover:bg-slate-800"
                  aria-label="Close Delivery Order Copy preview"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4">
              {isPdfDocument(previewedDeliveryOrder) ? (
                <iframe
                  src={previewedDeliveryOrder.url}
                  title={
                    previewedDeliveryOrder.name || "Delivery Order Copy PDF"
                  }
                  className="h-full w-full rounded-xl border-0 bg-white"
                />
              ) : (
                <img
                  src={previewedDeliveryOrder.url}
                  alt={previewedDeliveryOrder.name || "Delivery Order Copy"}
                  className="h-full w-full rounded-xl bg-white object-contain"
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:hidden">
              <span className="text-xs font-bold text-slate-500">
                {formatDocumentSize(previewedDeliveryOrder.size) ||
                  "Attached file"}
              </span>
              <a
                href={previewedDeliveryOrder.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700"
              >
                Open original
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
