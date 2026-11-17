import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  MapPin,
  Package,
  Truck,
  UserMinus,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import MarkDeliveredModal from "../components/MarkDeliveredModal";
import PageContainer from "../components/PageContainer";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";
import {
  deliveryTimeSlotOptions,
  getDeliveryBackAroundLabel,
  getDeliveryBlockSummary,
  getDeliveryDriveMinutes,
  getDeliverySiteArrivalLabel,
  getDeliveryTimeRange,
  getDeliveryTimeWindow,
  getDeliveryTotalBlockMinutes,
  getTimeSlotLabel,
  getTodayDateValue,
  scheduleWindowsOverlap,
  timeToMinutes,
} from "../utils/deliverySchedule";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import { formatCustomerName } from "../utils/textFormatters";

const timelineStartMinutes = 6 * 60;
const timelineEndMinutes = 17 * 60;
const timelineWidth = 1080;

const timelineOpenMinutes = 7 * 60 + 30;

const timelineHourMarks = Array.from({ length: 12 }, (_, index) => {
  const minutes = timelineStartMinutes + index * 60;
  const hours = Math.floor(minutes / 60);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return {
    minutes,
    label: `${displayHours} ${period}`,
  };
});

function getTimelinePercent(minutes) {
  return (
    ((minutes - timelineStartMinutes) /
      (timelineEndMinutes - timelineStartMinutes)) *
    100
  );
}

function getCompactTimelineRange(delivery) {
  const startTime = String(delivery?.deliveryTimeSlot || "").trim();
  const startMinutes = timeToMinutes(startTime);

  if (startMinutes === null) {
    return "Unscheduled";
  }

  const endMinutes = startMinutes + getDeliveryTotalBlockMinutes(delivery);
  const formatParts = (minutes) => {
    const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
    const hours = Math.floor(normalizedMinutes / 60);
    const minuteValue = normalizedMinutes % 60;

    return {
      time: `${hours % 12 || 12}${
        minuteValue ? `:${String(minuteValue).padStart(2, "0")}` : ""
      }`,
      period: hours >= 12 ? "PM" : "AM",
    };
  };
  const start = formatParts(startMinutes);
  const end = formatParts(endMinutes);

  return start.period === end.period
    ? `${start.time}–${end.time} ${end.period}`
    : `${start.time} ${start.period}–${end.time} ${end.period}`;
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

function getDeliveryDateKey(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const dateKeyMatch = value.match(/^\d{4}-\d{2}-\d{2}/);

    if (dateKeyMatch) {
      return dateKeyMatch[0];
    }
  }

  let dateValue = value;

  if (typeof value?.toDate === "function") {
    dateValue = value.toDate();
  } else if (Number.isFinite(Number(value?.seconds))) {
    dateValue = new Date(Number(value.seconds) * 1000);
  }

  const parsedDate = dateValue instanceof Date ? dateValue : new Date(dateValue);

  return Number.isNaN(parsedDate.getTime())
    ? ""
    : parsedDate.toISOString().slice(0, 10);
}

function formatDateLabel(value) {
  const dateKey = getDeliveryDateKey(value);

  if (!dateKey) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function getCalendarMonthDays(monthDate) {
  const monthStart = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1,
  );
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      date,
      dateKey,
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

function getCalendarMonthLabel(monthDate) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(monthDate);
}

function getLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getNextFiveDays() {
  const today = new Date(`${getTodayDateValue()}T12:00:00`);

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    return {
      date,
      dateKey: getLocalDateKey(date),
      isToday: index === 0,
    };
  });
}

function getCompactDateLabel(dateKey) {
  if (!dateKey) {
    return "Choose a date";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function DeliveryMoveDatePicker({
  value,
  deliveryDates,
  onChange,
  disabled = false,
}) {
  const selectedDate = getDeliveryDateKey(value);
  const initialDate = selectedDate || getTodayDateValue();
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = new Date(`${initialDate}T12:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const pickerRef = useRef(null);
  const popoverRef = useRef(null);
  const [opensAbove, setOpensAbove] = useState(false);
  const calendarDays = useMemo(
    () => getCalendarMonthDays(visibleMonth),
    [visibleMonth],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleOutsidePointer(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setOpensAbove(false);
      return undefined;
    }

    function updatePopoverPosition() {
      const pickerRect = pickerRef.current?.getBoundingClientRect();
      const popoverHeight = popoverRef.current?.offsetHeight || 440;

      if (!pickerRect) {
        return;
      }

      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const roomBelow = viewportHeight - pickerRect.bottom;
      const roomAbove = pickerRect.top;
      const requiredRoom = popoverHeight + 26;

      setOpensAbove(roomBelow < requiredRoom && roomAbove > roomBelow);
    }

    const animationFrame = window.requestAnimationFrame(updatePopoverPosition);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    window.visualViewport?.addEventListener("resize", updatePopoverPosition);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
      window.visualViewport?.removeEventListener(
        "resize",
        updatePopoverPosition,
      );
    };
  }, [isOpen, visibleMonth]);

  function togglePicker() {
    if (disabled) {
      return;
    }

    const date = new Date(`${initialDate}T12:00:00`);

    if (!Number.isNaN(date.getTime())) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }

    setIsOpen((currentValue) => !currentValue);
  }

  function selectDate(dateKey) {
    onChange?.(dateKey);
    setIsOpen(false);
  }

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        onClick={togglePicker}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm font-black text-slate-900 outline-none transition hover:border-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 disabled:cursor-wait disabled:opacity-60"
      >
        <span>{getCompactDateLabel(selectedDate)}</span>
        <CalendarDays
          className="h-5 w-5 shrink-0 text-[#FC2C38]"
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Choose new delivery date"
          className={`absolute left-0 z-50 max-h-[calc(100vh-2rem)] w-[min(22rem,calc(100vw-3rem))] overflow-y-auto rounded-[26px] border border-slate-200 bg-white p-5 shadow-2xl ${
            opensAbove
              ? "bottom-[calc(100%+0.6rem)]"
              : "top-[calc(100%+0.6rem)]"
          }`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  (currentMonth) =>
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                      1,
                    ),
                )
              }
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <p className="text-lg font-black text-slate-950">
              {getCalendarMonthLabel(visibleMonth)}
            </p>

            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  (currentMonth) =>
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                      1,
                    ),
                )
              }
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (weekday) => (
                <span
                  key={weekday}
                  className="py-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400"
                >
                  {weekday}
                </span>
              ),
            )}

            {calendarDays.map((day) => {
              const isSelected = day.dateKey === selectedDate;
              const isToday = day.dateKey === getTodayDateValue();
              const deliveryCount = deliveryDates?.get(day.dateKey) || 0;

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => selectDate(day.dateKey)}
                  title={
                    deliveryCount > 0
                      ? `${deliveryCount} ${
                          deliveryCount === 1 ? "delivery" : "deliveries"
                        }`
                      : undefined
                  }
                  className={`relative flex h-12 items-center justify-center rounded-xl text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-red-300 ${
                    isSelected
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : day.isCurrentMonth
                        ? "text-slate-800 hover:bg-slate-100"
                        : "text-slate-300 hover:bg-slate-50"
                  } ${isToday && !isSelected ? "ring-1 ring-red-300" : ""}`}
                >
                  {day.date.getDate()}
                  {deliveryCount > 0 ? (
                    <span
                      className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-white" : "bg-[#FC2C38]"
                      }`}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="h-2 w-2 rounded-full bg-[#FC2C38]" />
              Delivery scheduled
            </span>
            <button
              type="button"
              onClick={() => selectDate(getTodayDateValue())}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getDayDeliveries(deliveries, selectedDate) {
  return deliveries
    .filter(
      (delivery) =>
        !isDeliveryComplete(delivery) &&
        getDeliveryDateKey(delivery.deliveryDate) === selectedDate,
    )
    .sort(compareDeliveriesByRouteOrder);
}

function deliveryNeedsDispatch(delivery) {
  return (
    delivery?.dispatchStatus === "needsDispatch" ||
    getDeliveryDrivers(delivery).length === 0 ||
    getDeliveryTrucks(delivery).length === 0
  );
}

function compareDeliveriesByRouteOrder(firstDelivery, secondDelivery) {
  const firstRouteOrder = Number(firstDelivery.deliveryRouteOrder);
  const secondRouteOrder = Number(secondDelivery.deliveryRouteOrder);
  const firstHasRouteOrder =
    Number.isFinite(firstRouteOrder) && firstRouteOrder > 0;
  const secondHasRouteOrder =
    Number.isFinite(secondRouteOrder) && secondRouteOrder > 0;

  if (firstHasRouteOrder || secondHasRouteOrder) {
    const routeOrderComparison =
      (firstHasRouteOrder ? firstRouteOrder : Number.POSITIVE_INFINITY) -
      (secondHasRouteOrder ? secondRouteOrder : Number.POSITIVE_INFINITY);

    if (routeOrderComparison !== 0) {
      return routeOrderComparison;
    }
  }

  return (
    String(firstDelivery.deliveryTimeSlot || "99:99").localeCompare(
      String(secondDelivery.deliveryTimeSlot || "99:99"),
    ) ||
    String(firstDelivery.orderNumber || "").localeCompare(
      String(secondDelivery.orderNumber || ""),
    )
  );
}

function getFirstOpenDeliveryDate(deliveries) {
  return deliveries
    .filter(
      (delivery) =>
        !isDeliveryComplete(delivery) &&
        getDeliveryDateKey(delivery.deliveryDate),
    )
    .map((delivery) => getDeliveryDateKey(delivery.deliveryDate))
    .sort((firstDate, secondDate) => firstDate.localeCompare(secondDate))[0];
}

function getDeliveryDrivers(delivery) {
  const drivers = Array.isArray(delivery.drivers)
    ? delivery.drivers
    : [];
  const assignmentDrivers = Array.isArray(delivery.dispatchAssignments)
    ? delivery.dispatchAssignments.map((assignment) => assignment?.driver)
    : [];

  return [
    ...new Set(
      [delivery.driver, ...drivers, ...assignmentDrivers]
        .map((driver) => String(driver || "").trim())
        .filter(Boolean),
    ),
  ];
}

function getDeliveryTrucks(delivery) {
  const assignmentTrucks = Array.isArray(delivery?.dispatchAssignments)
    ? delivery.dispatchAssignments.flatMap((assignment) => [
        assignment?.vehicleTitle,
        assignment?.vehicleBadge,
      ])
    : [];
  const savedTrucks = Array.isArray(delivery?.vehicles)
    ? delivery.vehicles
    : [];

  return [
    ...new Set(
      [
        delivery?.vehicleTitle,
        delivery?.vehicleBadge,
        delivery?.truck,
        ...savedTrucks,
        ...assignmentTrucks,
      ]
        .map((truck) => String(truck || "").trim())
        .filter(Boolean),
    ),
  ];
}

function getDeliveryCalendarDrivers(delivery) {
  const drivers = getDeliveryDrivers(delivery);

  return drivers;
}

function groupDeliveriesByDriver(deliveries) {
  return deliveries.reduce((groups, delivery) => {
    const drivers = getDeliveryCalendarDrivers(delivery);

    drivers.forEach((driver) => {
      groups[driver] = [...(groups[driver] || []), delivery];
    });

    return groups;
  }, {});
}

function DeliveryStatusOverview({
  needsDispatchDeliveries,
  scheduledDeliveries,
  statusFilter,
  onSelectDelivery,
}) {
  const sections = [
    {
      id: "needsDispatch",
      title: "Needs Dispatch",
      description: "Missing a driver or truck",
      deliveries: needsDispatchDeliveries,
      panelClass: "border-amber-200 bg-amber-50/70",
      countClass: "bg-amber-100 text-amber-800",
      labelClass: "text-amber-800",
    },
    {
      id: "scheduled",
      title: "Scheduled",
      description: "Driver and truck assigned",
      deliveries: scheduledDeliveries,
      panelClass: "border-blue-200 bg-blue-50/60",
      countClass: "bg-blue-100 text-blue-800",
      labelClass: "text-blue-800",
    },
  ].filter((section) => statusFilter === "all" || section.id === statusFilter);

  return (
    <section
      className={`mb-5 grid gap-4 ${
        sections.length > 1 ? "lg:grid-cols-2" : ""
      }`}
    >
      {sections.map((section) => (
        <div
          key={section.id}
          className={`rounded-3xl border p-4 shadow-sm ${section.panelClass}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`text-xs font-black uppercase tracking-[0.16em] ${section.labelClass}`}
              >
                {section.title}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {section.description}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-black ${section.countClass}`}
            >
              {section.deliveries.length}
            </span>
          </div>

          {section.deliveries.length > 0 ? (
            <div className="mt-3 space-y-2">
              {section.deliveries.map((delivery) => {
                const drivers = getDeliveryDrivers(delivery);
                const trucks = getDeliveryTrucks(delivery);

                return (
                  <button
                    key={delivery.id}
                    type="button"
                    onClick={() => onSelectDelivery?.(delivery.id)}
                    className="grid w-full gap-2 rounded-2xl border border-white/90 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-950">
                        {delivery.deliveryTitle ||
                          formatCustomerName(delivery.customerName) ||
                          "Delivery"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-bold text-slate-500">
                        {delivery.deliveryTitle
                          ? `${formatCustomerName(delivery.customerName) || "No customer"} · `
                          : ""}
                        Order {delivery.orderNumber || "—"}
                        {delivery.address ? ` · ${delivery.address}` : ""}
                      </span>
                    </span>
                    <span className="text-left sm:text-right">
                      <span className="block text-xs font-black text-slate-800">
                        {delivery.deliveryTimeSlot
                          ? getDeliveryTimeRange(delivery)
                          : "Time not set"}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-bold text-slate-500">
                        {section.id === "needsDispatch"
                          ? [
                              drivers.length ? "Driver set" : "Needs driver",
                              trucks.length ? "Truck set" : "Needs truck",
                            ].join(" · ")
                          : `${drivers.join(", ")} · ${trucks.join(", ")}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border-2 border-dashed border-white bg-white/60 px-4 py-5 text-center text-sm font-bold text-slate-500">
              No {section.title.toLowerCase()} deliveries on this date.
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function deliveriesShareDriver(firstDelivery, secondDelivery) {
  const firstDrivers = getDeliveryDrivers(firstDelivery);
  const secondDrivers = getDeliveryDrivers(secondDelivery);

  return firstDrivers.some((driver) => secondDrivers.includes(driver));
}

function findScheduleConflict(candidateDelivery, deliveries) {
  const candidateWindow = getDeliveryTimeWindow(candidateDelivery);

  const candidateDate = getDeliveryDateKey(candidateDelivery.deliveryDate);

  if (!candidateDate || !candidateWindow) {
    return null;
  }

  return deliveries.find(
    (delivery) =>
      delivery.id !== candidateDelivery.id &&
      !isDeliveryComplete(delivery) &&
      delivery.dispatchStatus !== "needsDispatch" &&
      getDeliveryDateKey(delivery.deliveryDate) === candidateDate &&
      deliveriesShareDriver(candidateDelivery, delivery) &&
      scheduleWindowsOverlap(candidateWindow, getDeliveryTimeWindow(delivery)),
  );
}

function getTimelineBlockStyle(delivery) {
  const startMinutes = timeToMinutes(delivery.deliveryTimeSlot || "");
  const safeStartMinutes =
    startMinutes === null ? timelineStartMinutes : startMinutes;
  const left = Math.max(
    0,
    getTimelinePercent(safeStartMinutes),
  );
  const width = Math.max(
    7,
    (getDeliveryTotalBlockMinutes(delivery) /
      (timelineEndMinutes - timelineStartMinutes)) *
      100,
  );

  return {
    left: `${Math.min(left, 100)}%`,
    width: `${Math.min(width, 100 - Math.min(left, 100))}%`,
  };
}

function DeliveryTimelineBoard({
  driverNames,
  deliveriesByDriver,
  selectedDeliveryId,
  onSelectDelivery,
}) {
  return (
    <section className="hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:block">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            Driver Timeline
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            Day Board
          </h2>
        </div>

        <p className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600">
          8 AM - 5 PM
        </p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[1240px]">
          <div className="grid grid-cols-[180px_minmax(1080px,1fr)] gap-3">
            <div />
            <div
              className="relative h-10 rounded-2xl bg-slate-50"
              style={{ minWidth: timelineWidth }}
            >
              {timelineHourMarks.map((hourMark) => (
                <div
                  key={hourMark.minutes}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500"
                  style={{
                    left: `${getTimelinePercent(hourMark.minutes)}%`,
                  }}
                >
                  {hourMark.label}
                </div>
              ))}
              <div
                className="absolute inset-y-1 rounded-full border-l-2 border-[#FC2C38]"
                style={{ left: `${getTimelinePercent(timelineOpenMinutes)}%` }}
              >
                <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                  Open
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            {driverNames.map((driverName) => (
              <div
                key={driverName}
                className="grid grid-cols-[180px_minmax(1080px,1fr)] gap-3"
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Driver
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <h3 className="truncate text-xl font-black text-slate-950">
                      {driverName}
                    </h3>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 shadow-sm">
                      {deliveriesByDriver[driverName].length}
                    </span>
                  </div>
                </div>

                <div
                  className="relative h-[104px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80"
                  style={{ minWidth: timelineWidth }}
                >
                  {timelineHourMarks.map((hourMark) => (
                    <span
                      key={hourMark.minutes}
                      aria-hidden="true"
                      className="absolute inset-y-0 border-l border-slate-200/80"
                      style={{
                        left: `${getTimelinePercent(hourMark.minutes)}%`,
                      }}
                    />
                  ))}

                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 border-l-2 border-[#FC2C38]/70"
                    style={{ left: `${getTimelinePercent(timelineOpenMinutes)}%` }}
                  />

                  {deliveriesByDriver[driverName].map((delivery) => {
                    const blockStyle = getTimelineBlockStyle(delivery);
                    const isSelected = selectedDeliveryId === delivery.id;
                    const isShortBlock =
                      getDeliveryTotalBlockMinutes(delivery) <= 45;

                    return (
                      <button
                        key={delivery.id}
                        type="button"
                        onClick={() => onSelectDelivery(delivery.id)}
                        className={`absolute bottom-3 top-3 flex min-w-[88px] flex-col justify-center overflow-hidden border text-left shadow-sm transition md:min-w-[132px] ${
                          isShortBlock
                            ? "rounded-xl px-2 py-1.5 md:rounded-2xl md:px-3 md:py-2"
                            : "rounded-2xl px-3 py-2"
                        } ${
                          isSelected
                            ? "border-[#FC2C38] bg-red-50 ring-2 ring-red-100"
                            : "border-blue-200 bg-white hover:border-[#FC2C38] hover:bg-red-50/40"
                        }`}
                        style={blockStyle}
                        title={`${formatCustomerName(
                          delivery.customerName,
                        )} · Order ${delivery.orderNumber} · ${getDeliveryTimeRange(
                          delivery,
                        )}`}
                      >
                        <span
                          className={`truncate font-black text-[#FC2C38] ${
                            isShortBlock
                              ? "text-[10px] tracking-tight md:text-[11px] md:uppercase md:tracking-[0.12em]"
                              : "text-[11px] uppercase tracking-[0.12em]"
                          }`}
                        >
                          {isShortBlock ? (
                            <>
                              <span className="md:hidden">
                                {getCompactTimelineRange(delivery)}
                              </span>
                              <span className="hidden md:inline">
                                {getDeliveryTimeRange(delivery)}
                              </span>
                            </>
                          ) : (
                            getDeliveryTimeRange(delivery)
                          )}
                        </span>
                        <span
                          className={`truncate font-black text-slate-950 ${
                            isShortBlock
                              ? "mt-0.5 text-xs md:mt-1 md:text-sm"
                              : "mt-1 text-sm"
                          }`}
                        >
                          {formatCustomerName(delivery.customerName) ||
                            "Unnamed customer"}
                        </span>
                        {!isShortBlock ? (
                          <span className="truncate text-xs font-bold text-slate-500">
                            #{delivery.orderNumber}
                          </span>
                        ) : (
                          <span className="hidden truncate text-xs font-bold text-slate-500 md:block">
                            #{delivery.orderNumber}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs font-bold text-slate-500">
            Click a block to view details and move the delivery.
          </p>
        </div>
      </div>
    </section>
  );
}

function CompactDeliveryCard({
  delivery,
  deliveries,
  deliveryDates,
  driverOptions = [],
  vehicleOptions = [],
  expanded,
  canEditDeliveries,
  onEditDelivery,
  onViewOrder,
  onEditOrder,
  onRequestUnassign,
  onUpdateDelivery,
  isUpdating,
  onToggle,
  hideToggle = false,
  dispatchStyle = false,
}) {
  const scopeSummary = getDeliveryScopeSummary(delivery);
  const driveMinutes = getDeliveryDriveMinutes(delivery);
  const leaveAroundLabel = getTimeSlotLabel(delivery.deliveryTimeSlot || "");
  const drivers = getDeliveryDrivers(delivery);
  const trucks = getDeliveryTrucks(delivery);
  const needsDispatch = deliveryNeedsDispatch(delivery);
  const contactPhone =
    delivery.contactPhone ||
    delivery.phoneNumber ||
    delivery.phone ||
    delivery.customerPhone ||
    "";
  const primaryDispatchAssignment = Array.isArray(delivery.dispatchAssignments)
    ? delivery.dispatchAssignments[0]
    : null;
  const savedDriver = String(
    primaryDispatchAssignment?.driver || delivery.driver || drivers[0] || "",
  ).trim();
  const savedVehicleId = String(
    primaryDispatchAssignment?.vehicleId || delivery.vehicleId || "",
  ).trim();
  const savedVehicleTitle = String(
    primaryDispatchAssignment?.vehicleTitle || delivery.vehicleTitle || trucks[0] || "",
  ).trim();
  const savedVehicleBadge = String(
    primaryDispatchAssignment?.vehicleBadge || delivery.vehicleBadge || "",
  ).trim();
  const currentVehicleKey =
    savedVehicleId || (savedVehicleTitle ? `current:${savedVehicleTitle}` : "");
  const availableDrivers = [
    ...new Set(
      [...driverOptions, savedDriver]
        .map((driver) => String(driver || "").trim())
        .filter(Boolean),
    ),
  ];
  const availableVehicles = vehicleOptions
    .map((vehicle) => ({
      id: String(vehicle?.id || "").trim(),
      title: String(vehicle?.title || "Vehicle").trim(),
      badge: String(vehicle?.badge || "").trim(),
    }))
    .filter((vehicle) => vehicle.id);

  if (
    currentVehicleKey &&
    !availableVehicles.some((vehicle) => vehicle.id === currentVehicleKey)
  ) {
    availableVehicles.push({
      id: currentVehicleKey,
      title: savedVehicleTitle || "Assigned truck",
      badge: savedVehicleBadge,
      savedVehicleId,
    });
  }

  const [assignmentDraft, setAssignmentDraft] = useState({
    driver: savedDriver,
    vehicleKey: currentVehicleKey,
  });

  useEffect(() => {
    setAssignmentDraft({
      driver: savedDriver,
      vehicleKey: currentVehicleKey,
    });
  }, [delivery.id, savedDriver, currentVehicleKey]);

  const assignmentChanged =
    assignmentDraft.driver !== savedDriver ||
    assignmentDraft.vehicleKey !== currentVehicleKey;
  const assignmentReady = Boolean(
    assignmentDraft.driver && assignmentDraft.vehicleKey,
  );

  async function saveAssignment() {
    if (!assignmentChanged || !assignmentReady || !onUpdateDelivery) {
      return;
    }

    const selectedVehicle = availableVehicles.find(
      (vehicle) => vehicle.id === assignmentDraft.vehicleKey,
    );
    const assignment = {
      id: primaryDispatchAssignment?.id || "truck-1",
      driver: assignmentDraft.driver,
      vehicleId: selectedVehicle?.savedVehicleId || selectedVehicle?.id || "",
      vehicleTitle: selectedVehicle?.title || "",
      vehicleBadge: selectedVehicle?.badge || "",
    };

    await onUpdateDelivery(delivery, {
      driver: assignment.driver,
      drivers: [assignment.driver],
      vehicleId: assignment.vehicleId,
      vehicleTitle: assignment.vehicleTitle,
      vehicleBadge: assignment.vehicleBadge,
      dispatchAssignments: [assignment],
      dispatchStatus: "assigned",
    });
  }

  if (dispatchStyle) {
    return (
      <article className="relative overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden rounded-t-2xl grid-cols-[minmax(150px,0.85fr)_minmax(220px,1.2fr)_minmax(280px,1.35fr)_minmax(200px,0.95fr)_minmax(170px,0.75fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 xl:grid">
          <span>Delivery</span>
          <span>Destination</span>
          <span>Schedule</span>
          <span>Driver / Truck</span>
          <span>Load</span>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(150px,0.85fr)_minmax(220px,1.2fr)_minmax(280px,1.35fr)_minmax(200px,0.95fr)_minmax(170px,0.75fr)]">
          <section className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-[#FC2C38]">
              Order {delivery.orderNumber || "—"}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                needsDispatch
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {needsDispatch ? "Needs dispatch" : "Assigned"}
            </span>
            <h3 className="mt-2 text-base font-black leading-tight text-slate-950">
              {formatCustomerName(delivery.customerName)}
            </h3>
          </section>

          <section className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400 xl:hidden">
              Destination
            </p>
            <p className="mt-1 flex items-start gap-2 text-sm font-black leading-snug text-slate-900">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {delivery.address || "No delivery address"}
            </p>
            {contactPhone ? (
              <p className="mt-2 text-xs font-bold text-slate-500">
                {contactPhone}
              </p>
            ) : null}
            <p className="mt-2 text-xs font-black text-blue-700">
              {driveMinutes || 0} min from {delivery.deliveryOriginName || "Capital Lumber"}
            </p>
          </section>

          <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-blue-700 xl:hidden">
              Schedule
            </p>
            {canEditDeliveries ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_0.9fr]">
                <DeliveryMoveDatePicker
                  value={getDeliveryDateKey(delivery.deliveryDate)}
                  deliveryDates={deliveryDates}
                  onChange={(dateKey) =>
                    onUpdateDelivery(delivery, { deliveryDate: dateKey })
                  }
                  disabled={isUpdating}
                />
                <select
                  value={delivery.deliveryTimeSlot || ""}
                  onChange={(event) =>
                    onUpdateDelivery(delivery, {
                      deliveryTimeSlot: event.target.value,
                    })
                  }
                  disabled={isUpdating}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                >
                  <option value="">Choose time...</option>
                  {deliveryTimeSlotOptions.map((timeSlot) => {
                    const candidateDelivery = {
                      ...delivery,
                      deliveryTimeSlot: timeSlot.value,
                    };
                    const conflict = findScheduleConflict(
                      candidateDelivery,
                      deliveries,
                    );

                    return (
                      <option
                        key={timeSlot.value}
                        value={timeSlot.value}
                        disabled={Boolean(conflict)}
                      >
                        {conflict
                          ? `${timeSlot.label} - busy until ${getDeliveryBackAroundLabel(
                              conflict,
                            )}`
                          : timeSlot.label}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <p className="text-sm font-black text-slate-900">
                {formatDateLabel(getDeliveryDateKey(delivery.deliveryDate))} · {getDeliveryTimeRange(delivery)}
              </p>
            )}
            <div className="mt-2 rounded-lg bg-white/80 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.11em] text-blue-700">
                  Rough round trip
                </span>
                <span className="text-xs font-black text-slate-900">
                  {getDeliveryTotalBlockMinutes(delivery)} min
                </span>
              </div>
              <p className="mt-1 text-[11px] font-bold leading-snug text-slate-500">
                Leave {leaveAroundLabel} · There {driveMinutes || 0} min · Site {getDeliverySiteArrivalLabel(delivery)} · Back {getDeliveryBackAroundLabel(delivery)}
              </p>
            </div>
          </section>

          <section className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400 xl:hidden">
              Driver / Truck
            </p>
            {canEditDeliveries ? (
              <div className="mt-1 space-y-2">
                <select
                  value={assignmentDraft.driver}
                  onChange={(event) =>
                    setAssignmentDraft((currentDraft) => ({
                      ...currentDraft,
                      driver: event.target.value,
                    }))
                  }
                  disabled={isUpdating}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  aria-label="Assign delivery driver"
                >
                  <option value="">Assign driver...</option>
                  {availableDrivers.map((driver) => (
                    <option key={driver} value={driver}>
                      {driver}
                    </option>
                  ))}
                </select>

                <select
                  value={assignmentDraft.vehicleKey}
                  onChange={(event) =>
                    setAssignmentDraft((currentDraft) => ({
                      ...currentDraft,
                      vehicleKey: event.target.value,
                    }))
                  }
                  disabled={isUpdating}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  aria-label="Assign delivery truck"
                >
                  <option value="">Assign truck...</option>
                  {availableVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.badge
                        ? `${vehicle.badge} - ${vehicle.title}`
                        : vehicle.title}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={saveAssignment}
                  disabled={!assignmentChanged || !assignmentReady || isUpdating}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {isUpdating ? "Saving..." : "Save assignment"}
                </button>
              </div>
            ) : (
              <>
                <p className={`mt-1 text-sm font-black ${drivers.length ? "text-emerald-800" : "text-amber-800"}`}>
                  {drivers.join(", ") || "Needs driver"}
                </p>
                <p className={`mt-2 text-sm font-black ${trucks.length ? "text-blue-700" : "text-amber-800"}`}>
                  {trucks.join(", ") || "Needs truck"}
                </p>
              </>
            )}
          </section>

          <section className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400 xl:hidden">
              Load
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {scopeSummary.shortLabel}
            </p>
            <p className="mt-2 text-xs font-bold leading-snug text-slate-500">
              {scopeSummary.label}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-700">
                {delivery.unloadType || "Standard"}
              </span>
              {delivery.unloadType === "Forklift" && delivery.forkliftType ? (
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-800">
                  {formatForkliftLabel(delivery.forkliftType)}
                </span>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-4 py-3">
          {onViewOrder ? (
            <button
              type="button"
              onClick={() => onViewOrder(delivery)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              View Order
            </button>
          ) : null}
          {onEditOrder ? (
            <button
              type="button"
              onClick={() => onEditOrder(delivery)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Edit Order
            </button>
          ) : null}
          {canEditDeliveries && onRequestUnassign && !needsDispatch ? (
            <button
              type="button"
              onClick={() => onRequestUnassign(delivery)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-900 transition hover:bg-amber-100"
            >
              <UserMinus className="h-4 w-4" aria-hidden="true" />
              Unassign
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            Order {delivery.orderNumber}
          </p>
          <h3 className="mt-1 truncate text-lg font-black text-slate-900">
            {formatCustomerName(delivery.customerName)}
          </h3>
          <p className="mt-1 text-sm font-black text-slate-600">
            {getDeliveryTimeRange(delivery)}
          </p>
        </div>

      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <span className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-[#FC2C38] ring-1 ring-red-100">
          Leave around {leaveAroundLabel}
        </span>
        <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
          Site around {getDeliverySiteArrivalLabel(delivery)}
        </span>
        <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
          Back {getDeliveryBackAroundLabel(delivery)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700">
          {delivery.unloadType}
        </span>
        {delivery.unloadType === "Forklift" && delivery.forkliftType ? (
          <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-800">
            {formatForkliftLabel(delivery.forkliftType)}
          </span>
        ) : null}
        <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-[#FC2C38]">
          {scopeSummary.shortLabel}
        </span>
      </div>

      {hideToggle ? null : (
        <button
          type="button"
          onClick={() => onToggle(delivery.id)}
          className="mt-3 flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:text-[#FC2C38]"
          aria-expanded={expanded}
        >
          {expanded ? "Close details" : "View details"}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      )}

      {expanded ? (
        <div className="mt-3 space-y-3">
          {canEditDeliveries || onViewOrder || onEditOrder ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {canEditDeliveries ? (
                <button
                  type="button"
                  onClick={() => onEditDelivery(delivery.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-100"
                >
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                  Edit Delivery
                </button>
              ) : null}

              {onViewOrder ? (
                <button
                  type="button"
                  onClick={() => onViewOrder(delivery)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-100"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  View Order
                </button>
              ) : null}

              {onEditOrder ? (
                <button
                  type="button"
                  onClick={() => onEditOrder(delivery)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Edit Order
                </button>
              ) : null}

              {canEditDeliveries &&
              onRequestUnassign &&
              !deliveryNeedsDispatch(delivery) ? (
                <button
                  type="button"
                  onClick={() => onRequestUnassign(delivery)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900 shadow-sm transition hover:border-amber-400 hover:bg-amber-100"
                >
                  <UserMinus className="h-4 w-4" aria-hidden="true" />
                  Unassign
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl bg-white px-4 py-3">
            <p className="flex items-start gap-2 text-sm font-black text-slate-900">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {delivery.address}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              From {delivery.deliveryOriginName || "Capital Lumber"}
            </p>
          </div>

          <p className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700">
            Leave around {leaveAroundLabel} · One-way drive ETA:{" "}
            {driveMinutes || 0} min · Site around{" "}
            {getDeliverySiteArrivalLabel(delivery)}
          </p>

          <p className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700">
            {getDeliveryBlockSummary(delivery)}
          </p>

          {canEditDeliveries ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Move Delivery
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="block">
                  <span className="mb-1 block text-xs font-black text-slate-500">
                    Date
                  </span>
                  <DeliveryMoveDatePicker
                    value={getDeliveryDateKey(delivery.deliveryDate)}
                    deliveryDates={deliveryDates}
                    onChange={(dateKey) =>
                      onUpdateDelivery(delivery, {
                        deliveryDate: dateKey,
                      })
                    }
                    disabled={isUpdating}
                  />
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-black text-slate-500">
                    Time
                  </span>
                  <select
                    value={delivery.deliveryTimeSlot || ""}
                    onChange={(event) =>
                      onUpdateDelivery(delivery, {
                        deliveryTimeSlot: event.target.value,
                      })
                    }
                    disabled={isUpdating}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  >
                    <option value="">Choose time...</option>
                    {deliveryTimeSlotOptions.map((timeSlot) => {
                      const candidateDelivery = {
                        ...delivery,
                        deliveryTimeSlot: timeSlot.value,
                      };
                      const conflict = findScheduleConflict(
                        candidateDelivery,
                        deliveries,
                      );

                      return (
                        <option
                          key={timeSlot.value}
                          value={timeSlot.value}
                          disabled={Boolean(conflict)}
                        >
                          {conflict
                            ? `${timeSlot.label} - busy until ${getDeliveryBackAroundLabel(
                                conflict,
                              )}`
                            : timeSlot.label}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
              <Truck className="h-4 w-4" aria-hidden="true" />
              {getDeliveryDrivers(delivery).join(", ")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
              <Package className="h-4 w-4" aria-hidden="true" />
              {scopeSummary.label}
            </span>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function DeliveryCalendarPage({
  deliveries,
  vehicleOptions = /** @type {Array<{ id: string, title: string, badge: string }>} */ ([]),
  employeeOptions = /** @type {string[]} */ ([]),
  canEditDeliveries = false,
  onEditDelivery,
  onViewOrder,
  onEditOrder,
  onUpdateDelivery,
  onPageChange,
}) {
  const safeDeliveries = useMemo(
    () =>
      Array.isArray(deliveries)
        ? deliveries.filter(
            (delivery) => delivery && typeof delivery === "object",
          )
        : [],
    [deliveries],
  );
  const [selectedDate, setSelectedDate] = useState(getTodayDateValue());
  const [hasSelectedDay, setHasSelectedDay] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date(`${getTodayDateValue()}T12:00:00`);
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const calendarPickerRef = useRef(null);
  const selectedDeliveryDetailRef = useRef(null);
  const [expandedDeliveryIds, setExpandedDeliveryIds] = useState({});
  const [selectedTimelineDeliveryId, setSelectedTimelineDeliveryId] =
    useState("");
  const [selectedTimelineDeliverySnapshot, setSelectedTimelineDeliverySnapshot] =
    useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState("");
  const [error, setError] = useState("");
  const [deliveryToUnassign, setDeliveryToUnassign] = useState(null);
  const [unassigningDeliveryId, setUnassigningDeliveryId] = useState("");
  const [unassignError, setUnassignError] = useState("");
  const [deliveryToMarkDelivered, setDeliveryToMarkDelivered] = useState(null);
  const [markingDeliveredId, setMarkingDeliveredId] = useState("");
  const fallbackDeliveryDate = useMemo(
    () => getFirstOpenDeliveryDate(safeDeliveries),
    [safeDeliveries],
  );
  const deliveryDates = useMemo(() => {
    const dateCounts = new Map();

    safeDeliveries.forEach((delivery) => {
      if (isDeliveryComplete(delivery)) {
        return;
      }

      const dateKey = getDeliveryDateKey(delivery.deliveryDate);

      if (dateKey) {
        dateCounts.set(dateKey, (dateCounts.get(dateKey) || 0) + 1);
      }
    });

    return dateCounts;
  }, [safeDeliveries]);
  const fiveDayOverview = useMemo(
    () =>
      getNextFiveDays().map((day) => {
        const dayDeliveries = getDayDeliveries(
          safeDeliveries,
          day.dateKey,
        );
        const needsDispatchCount = dayDeliveries.filter(
          deliveryNeedsDispatch,
        ).length;

        return {
          ...day,
          deliveryCount: dayDeliveries.length,
          needsDispatchCount,
          scheduledCount: dayDeliveries.length - needsDispatchCount,
        };
      }),
    [safeDeliveries],
  );
  const calendarDays = useMemo(
    () => getCalendarMonthDays(calendarMonth),
    [calendarMonth],
  );
  const dayDeliveries = useMemo(
    () => getDayDeliveries(safeDeliveries, selectedDate),
    [safeDeliveries, selectedDate],
  );
  const needsDispatchDeliveries = useMemo(
    () => dayDeliveries.filter(deliveryNeedsDispatch),
    [dayDeliveries],
  );
  const scheduledDeliveries = useMemo(
    () => dayDeliveries.filter((delivery) => !deliveryNeedsDispatch(delivery)),
    [dayDeliveries],
  );
  const deliveriesByDriver = useMemo(
    () => groupDeliveriesByDriver(scheduledDeliveries),
    [scheduledDeliveries],
  );
  const driverNames = Object.keys(deliveriesByDriver).sort((first, second) =>
    first.localeCompare(second),
  );
  const selectedTimelineDeliveryFromData =
    safeDeliveries.find(
      (delivery) => delivery.id === selectedTimelineDeliveryId,
    ) || null;
  const selectedTimelineDelivery =
    selectedTimelineDeliveryFromData ||
    (selectedTimelineDeliverySnapshot?.id === selectedTimelineDeliveryId
      ? selectedTimelineDeliverySnapshot
      : null);

  useEffect(() => {
    if (
      !hasSelectedDay &&
      selectedDate === getTodayDateValue() &&
      dayDeliveries.length === 0 &&
      fallbackDeliveryDate
    ) {
      setSelectedDate(fallbackDeliveryDate);
    }
  }, [
    dayDeliveries.length,
    fallbackDeliveryDate,
    hasSelectedDay,
    selectedDate,
  ]);

  useEffect(() => {
    function handleOutsidePointer(event) {
      if (
        isDatePickerOpen &&
        calendarPickerRef.current &&
        !calendarPickerRef.current.contains(event.target)
      ) {
        setIsDatePickerOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsDatePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDatePickerOpen]);

  useEffect(() => {
    setSelectedTimelineDeliveryId("");
    setSelectedTimelineDeliverySnapshot(null);
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTimelineDeliveryFromData) {
      setSelectedTimelineDeliverySnapshot(selectedTimelineDeliveryFromData);
    }
  }, [selectedTimelineDeliveryFromData]);

  function openDatePicker() {
    const selectedDateValue = new Date(`${selectedDate}T12:00:00`);

    if (!Number.isNaN(selectedDateValue.getTime())) {
      setCalendarMonth(
        new Date(
          selectedDateValue.getFullYear(),
          selectedDateValue.getMonth(),
          1,
        ),
      );
    }

    setIsDatePickerOpen((currentValue) => !currentValue);
  }

  function changeCalendarMonth(offset) {
    setCalendarMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + offset,
          1,
        ),
    );
  }

  function selectDay(dateKey, date = null) {
    setSelectedDate(dateKey);
    setHasSelectedDay(true);
    setStatusFilter("all");
    setSelectedTimelineDeliveryId("");
    setSelectedTimelineDeliverySnapshot(null);

    const selectedDay = date || new Date(`${dateKey}T12:00:00`);

    if (!Number.isNaN(selectedDay.getTime())) {
      setCalendarMonth(
        new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1),
      );
    }
  }

  function selectTimelineDelivery(deliveryId) {
    if (!deliveryId) {
      return;
    }

    setSelectedTimelineDeliveryId(deliveryId);
    setSelectedTimelineDeliverySnapshot(
      safeDeliveries.find((delivery) => delivery.id === deliveryId) || null,
    );
    window.setTimeout(() => {
      selectedDeliveryDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function toggleDriverSection(driverKey) {
    setExpandedDeliveryIds((currentExpandedDeliveryIds) => ({
      ...currentExpandedDeliveryIds,
      [driverKey]: currentExpandedDeliveryIds[driverKey] === false,
    }));
  }

  async function handleMoveDelivery(delivery, updates) {
    if (!onUpdateDelivery) {
      return;
    }

    const candidateDelivery = {
      ...delivery,
      ...updates,
    };
    const conflict = findScheduleConflict(candidateDelivery, safeDeliveries);

    if (conflict) {
      setError(
        `${getDeliveryDrivers(delivery).join(", ")} is already scheduled on order ${
          conflict.orderNumber
        } until ${getDeliveryBackAroundLabel(conflict)}.`,
      );
      return;
    }

    setError("");
    setUpdatingDeliveryId(delivery.id);
    const previousSelectedDelivery =
      delivery.id === selectedTimelineDeliveryId
        ? selectedTimelineDeliverySnapshot || delivery
        : null;

    if (delivery.id === selectedTimelineDeliveryId) {
      setSelectedTimelineDeliverySnapshot({
        ...delivery,
        ...updates,
      });
    }

    try {
      await onUpdateDelivery(delivery.id, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (updateError) {
      console.error("Unable to move delivery:", updateError);
      if (previousSelectedDelivery) {
        setSelectedTimelineDeliverySnapshot(previousSelectedDelivery);
      }
      setError("Unable to move that delivery. Try again.");
    } finally {
      setUpdatingDeliveryId("");
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
        updatedAt: new Date().toISOString(),
      });
      setDeliveryToUnassign(null);
      setSelectedTimelineDeliveryId("");
      setSelectedTimelineDeliverySnapshot(null);
      setExpandedDeliveryIds((currentExpandedDeliveryIds) => {
        const nextExpandedDeliveryIds = { ...currentExpandedDeliveryIds };
        delete nextExpandedDeliveryIds[deliveryId];
        return nextExpandedDeliveryIds;
      });
    } catch (unassignDeliveryError) {
      console.error("Unable to unassign delivery:", unassignDeliveryError);
      setUnassignError(
        unassignDeliveryError instanceof Error
          ? unassignDeliveryError.message
          : "Unable to return this delivery to Dispatch.",
      );
    } finally {
      setUnassigningDeliveryId("");
    }
  }

  function handleMarkDelivered(delivery) {
    if (!canEditDeliveries || !onUpdateDelivery) {
      return;
    }

    setDeliveryToMarkDelivered(delivery);
  }

  async function confirmMarkDelivered(deliveredAt) {
    const delivery = deliveryToMarkDelivered;

    if (!delivery?.id || !deliveredAt || !onUpdateDelivery) {
      return;
    }

    setMarkingDeliveredId(delivery.id);
    setError("");

    try {
      await onUpdateDelivery(delivery.id, {
        status: "complete",
        deliveredAt,
        deliveryCompletionSource: "calendarOverride",
        deliveryOverrideAt: deliveredAt,
      });
      setDeliveryToMarkDelivered(null);
      setSelectedTimelineDeliveryId("");
      setSelectedTimelineDeliverySnapshot(null);
    } catch (updateError) {
      console.error("Unable to mark calendar delivery complete:", updateError);
      setError(
        "Unable to mark that delivery as delivered. Check your connection and try again.",
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
          { label: "Calendar" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Delivery Schedule
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Delivery Calendar
          </h1>

          <p className="mt-2 text-base font-semibold text-slate-500 sm:text-lg">
            See each driver&apos;s delivery blocks and return windows.
          </p>
        </div>

        <div
          ref={calendarPickerRef}
          className="relative block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Schedule Date
          </span>

          <button
            type="button"
            onClick={openDatePicker}
            aria-haspopup="dialog"
            aria-expanded={isDatePickerOpen}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-300 px-4 py-3 text-left text-base font-black text-slate-900 outline-none transition hover:border-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 lg:w-72"
          >
            <span>{getCompactDateLabel(selectedDate)}</span>
            <ChevronDown
              aria-hidden="true"
              className={`h-5 w-5 shrink-0 text-slate-400 transition ${
                isDatePickerOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isDatePickerOpen ? (
            <div
              role="dialog"
              aria-label="Choose delivery schedule date"
              className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[min(92vw,25rem)] rounded-[26px] border border-slate-200 bg-white p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => changeCalendarMonth(-1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>

                <p className="text-lg font-black text-slate-950">
                  {getCalendarMonthLabel(calendarMonth)}
                </p>

                <button
                  type="button"
                  onClick={() => changeCalendarMonth(1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (weekday) => (
                    <span
                      key={weekday}
                      className="py-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400"
                    >
                      {weekday}
                    </span>
                  ),
                )}

                {calendarDays.map((day) => {
                  const isSelected = day.dateKey === selectedDate;
                  const isToday = day.dateKey === getTodayDateValue();
                  const deliveryCount = deliveryDates.get(day.dateKey) || 0;

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => {
                        selectDay(day.dateKey, day.date);
                        setIsDatePickerOpen(false);
                      }}
                      title={
                        deliveryCount > 0
                          ? `${deliveryCount} ${
                              deliveryCount === 1 ? "delivery" : "deliveries"
                            }`
                          : undefined
                      }
                      className={`relative flex h-12 items-center justify-center rounded-xl text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-red-300 ${
                        isSelected
                          ? "bg-[#FC2C38] text-white shadow-sm"
                          : day.isCurrentMonth
                            ? "text-slate-800 hover:bg-slate-100"
                            : "text-slate-300 hover:bg-slate-50"
                      } ${isToday && !isSelected ? "ring-1 ring-red-300" : ""}`}
                    >
                      {day.date.getDate()}
                      {deliveryCount > 0 ? (
                        <span
                          className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${
                            isSelected ? "bg-white" : "bg-[#FC2C38]"
                          }`}
                          aria-label={`${deliveryCount} deliveries`}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-[#FC2C38]" />
                  Delivery scheduled
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const today = getTodayDateValue();
                    const todayDate = new Date(`${today}T12:00:00`);
                    selectDay(today, todayDate);
                    setIsDatePickerOpen(false);
                  }}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
                >
                  Today
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Next 5 days
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Select a day to view its delivery schedule.
            </p>
          </div>
          <CalendarDays
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-[#FC2C38]"
          />
        </div>

        <div className="overflow-x-auto p-3 sm:p-4">
          <div className="grid min-w-[46rem] grid-cols-5 gap-2">
            {fiveDayOverview.map((day) => {
              const isSelected =
                hasSelectedDay && day.dateKey === selectedDate;
              const weekdayLabel = new Intl.DateTimeFormat("en-US", {
                weekday: "short",
              }).format(day.date);
              const dateLabel = new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
              }).format(day.date);

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => selectDay(day.dateKey, day.date)}
                  className={`rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
                    isSelected
                      ? "border-[#FC2C38] bg-red-50 shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:border-red-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p
                        className={`text-xs font-black uppercase tracking-[0.12em] ${
                          isSelected ? "text-[#FC2C38]" : "text-slate-500"
                        }`}
                      >
                        {day.isToday ? "Today" : weekdayLabel}
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {dateLabel}
                      </p>
                    </div>
                    <span
                      className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs font-black ${
                        day.deliveryCount > 0
                          ? "bg-slate-950 text-white"
                          : "bg-white text-slate-400"
                      }`}
                    >
                      {day.deliveryCount}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.08em]">
                    {day.needsDispatchCount > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                        {day.needsDispatchCount} need dispatch
                      </span>
                    ) : null}
                    {day.scheduledCount > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">
                        {day.scheduledCount} scheduled
                      </span>
                    ) : null}
                    {day.deliveryCount === 0 ? (
                      <span className="rounded-full bg-white px-2 py-1 text-slate-400">
                        No deliveries
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {hasSelectedDay ? (
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-900">
              {formatDateLabel(selectedDate)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {dayDeliveries.length}{" "}
              {dayDeliveries.length === 1 ? "delivery" : "deliveries"} ·{" "}
              {needsDispatchDeliveries.length} need dispatch ·{" "}
              {scheduledDeliveries.length} scheduled
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              {[
                { id: "all", label: "All", count: dayDeliveries.length },
                {
                  id: "needsDispatch",
                  label: "Needs Dispatch",
                  count: needsDispatchDeliveries.length,
                },
                {
                  id: "scheduled",
                  label: "Scheduled",
                  count: scheduledDeliveries.length,
                },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(option.id);
                    setSelectedTimelineDeliveryId("");
                    setSelectedTimelineDeliverySnapshot(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    statusFilter === option.id
                      ? option.id === "needsDispatch"
                        ? "bg-amber-100 text-amber-900 shadow-sm"
                        : option.id === "scheduled"
                          ? "bg-blue-100 text-blue-900 shadow-sm"
                          : "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {option.label} {option.count}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onPageChange?.("deliveries-queue")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              <Package className="h-4 w-4" aria-hidden="true" />
              Upcoming Deliveries
            </button>

            <button
              type="button"
              onClick={() => onPageChange?.("deliveries-dispatch")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
            >
              <Truck className="h-4 w-4" aria-hidden="true" />
              Needs Dispatch
            </button>
          </div>
        </div>
        </section>
      ) : (
        <section className="mb-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <CalendarDays
            aria-hidden="true"
            className="mx-auto h-7 w-7 text-[#FC2C38]"
          />
          <p className="mt-3 text-lg font-black text-slate-950">
            Select a day to view its orders
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Delivery details stay tucked away until you choose a day above.
          </p>
        </section>
      )}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {!hasSelectedDay ? null : dayDeliveries.length === 0 ? (
        <EmptyState
          title="No deliveries on this date"
          description="Deliveries that need dispatch and scheduled deliveries will both appear here."
        />
      ) : (
        selectedTimelineDelivery ? (
          <section
            ref={selectedDeliveryDetailRef}
            className="scroll-mt-5 rounded-3xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm sm:p-5"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Selected Delivery
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Schedule Order {selectedTimelineDelivery.orderNumber || "—"}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Only this delivery is shown while you review or reschedule it.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {canEditDeliveries && onUpdateDelivery ? (
                  <button
                    type="button"
                    onClick={() => handleMarkDelivered(selectedTimelineDelivery)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Mark delivered
                  </button>
                ) : null}

                {onViewOrder ? (
                  <button
                    type="button"
                    onClick={() => onViewOrder(selectedTimelineDelivery)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    View order
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTimelineDeliveryId("");
                    setSelectedTimelineDeliverySnapshot(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Back to day board
                </button>
              </div>
            </div>

            <CompactDeliveryCard
              delivery={selectedTimelineDelivery}
              deliveries={safeDeliveries}
              deliveryDates={deliveryDates}
              driverOptions={employeeOptions}
              vehicleOptions={vehicleOptions}
              expanded
              canEditDeliveries={canEditDeliveries}
              onEditDelivery={onEditDelivery}
              onViewOrder={onViewOrder}
              onEditOrder={onEditOrder}
              onRequestUnassign={(delivery) => {
                setUnassignError("");
                setDeliveryToUnassign(delivery);
              }}
              onUpdateDelivery={handleMoveDelivery}
              isUpdating={updatingDeliveryId === selectedTimelineDelivery.id}
              onToggle={selectTimelineDelivery}
              hideToggle
              dispatchStyle
            />
          </section>
        ) : (
          <>
            <DeliveryStatusOverview
              needsDispatchDeliveries={needsDispatchDeliveries}
              scheduledDeliveries={scheduledDeliveries}
              statusFilter={statusFilter}
              onSelectDelivery={selectTimelineDelivery}
            />

            {statusFilter !== "needsDispatch" &&
            scheduledDeliveries.length > 0 ? (
              <div id="delivery-calendar-day-board" className="scroll-mt-5">
                <DeliveryTimelineBoard
                  driverNames={driverNames}
                  deliveriesByDriver={deliveriesByDriver}
                  selectedDeliveryId=""
                  onSelectDelivery={selectTimelineDelivery}
                />

                <div className="hidden gap-4 lg:grid lg:grid-cols-3 2xl:grid-cols-4 xl:hidden">
                  {driverNames.map((driverName) => (
                    <section
                      key={driverName}
                      className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                            Driver
                          </p>
                          <h2 className="truncate text-2xl font-black text-slate-900">
                            {driverName}
                          </h2>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600">
                          {deliveriesByDriver[driverName].length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {deliveriesByDriver[driverName].map((delivery) => (
                          <CompactDeliveryCard
                            key={delivery.id}
                            delivery={delivery}
                            deliveries={safeDeliveries}
                            deliveryDates={deliveryDates}
                            expanded={false}
                            canEditDeliveries={canEditDeliveries}
                            onEditDelivery={onEditDelivery}
                            onViewOrder={onViewOrder}
                            onEditOrder={onEditOrder}
                            onRequestUnassign={(delivery) => {
                              setUnassignError("");
                              setDeliveryToUnassign(delivery);
                            }}
                            onUpdateDelivery={handleMoveDelivery}
                            isUpdating={updatingDeliveryId === delivery.id}
                            onToggle={selectTimelineDelivery}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="space-y-4 lg:hidden">
                  {driverNames.map((driverName) => (
                    <section
                      key={driverName}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => toggleDriverSection(`driver-${driverName}`)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                        aria-expanded={
                          expandedDeliveryIds[`driver-${driverName}`] !== false
                        }
                      >
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                            Driver
                          </p>
                          <h2 className="text-2xl font-black text-slate-900">
                            {driverName}
                          </h2>
                          <p className="text-sm font-bold text-slate-500">
                            {deliveriesByDriver[driverName].length}{" "}
                            {deliveriesByDriver[driverName].length === 1
                              ? "delivery"
                              : "deliveries"}
                          </p>
                        </div>

                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                          <ChevronDown
                            className={`h-5 w-5 transition-transform ${
                              expandedDeliveryIds[`driver-${driverName}`] !== false
                                ? "rotate-180"
                                : ""
                            }`}
                            aria-hidden="true"
                          />
                        </span>
                      </button>

                      {expandedDeliveryIds[`driver-${driverName}`] !== false ? (
                        <div className="mt-4 space-y-3">
                          {deliveriesByDriver[driverName].map((delivery) => (
                            <CompactDeliveryCard
                              key={delivery.id}
                              delivery={delivery}
                              deliveries={safeDeliveries}
                              deliveryDates={deliveryDates}
                              expanded={false}
                              canEditDeliveries={canEditDeliveries}
                              onEditDelivery={onEditDelivery}
                              onViewOrder={onViewOrder}
                              onEditOrder={onEditOrder}
                              onRequestUnassign={(delivery) => {
                                setUnassignError("");
                                setDeliveryToUnassign(delivery);
                              }}
                              onUpdateDelivery={handleMoveDelivery}
                              isUpdating={updatingDeliveryId === delivery.id}
                              onToggle={selectTimelineDelivery}
                            />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )
      )}

      {deliveryToUnassign ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-unassign-delivery-title"
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
              id="calendar-unassign-delivery-title"
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

      <MarkDeliveredModal
        delivery={deliveryToMarkDelivered}
        isSaving={
          Boolean(deliveryToMarkDelivered) &&
          markingDeliveredId === deliveryToMarkDelivered?.id
        }
        onClose={() => {
          if (!markingDeliveredId) {
            setDeliveryToMarkDelivered(null);
          }
        }}
        onConfirm={confirmMarkDelivered}
      />
    </PageContainer>
  );
}
