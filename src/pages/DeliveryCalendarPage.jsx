import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  EllipsisVertical,
  Eye,
  GripVertical,
  Layers,
  LockKeyhole,
  LockOpen,
  MapPin,
  Package,
  StickyNote,
  Truck,
  Unlink,
  UserMinus,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import DeliveryScheduleAccessModal from "../components/DeliveryScheduleAccessModal";
import EmptyState from "../components/EmptyState";
import MarkDeliveredModal from "../components/MarkDeliveredModal";
import PageContainer from "../components/PageContainer";
import {
  createDeliveryDayFullBlockOff,
  formatCalendarBlockOffTime,
  getCalendarBlockOffMap,
  getCalendarBlockOffScheduleLabel,
  getCalendarBlockOffTextColor,
  getDeliveryDayFullRestoreBlockOff,
  isAllDayCalendarBlockOff,
  isDeliveryDayFullBlockOff,
  normalizeCalendarBlockOffBackgroundColor,
} from "../utils/deliveryCalendarBlockOffs";
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
import { subscribeToDispatchNotes } from "../utils/dispatchNoteStorage";
import { formatCustomerName } from "../utils/textFormatters";

const timelineStartMinutes = 6 * 60;
const timelineEndMinutes = 17 * 60;
const timelineWidth = 1080;

const timelineOpenMinutes = 7 * 60 + 30;
const calendarTbdDropKey = "__delivery_date_tbd__";
const calendarDayFullDragType = "application/x-delivery-day-full";
const deliveryGroupHoldMs = 650;

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

function minutesToTimeValue(minutes) {
  const normalizedMinutes = Math.min(
    timelineEndMinutes,
    Math.max(timelineStartMinutes, Math.round(minutes / 15) * 15),
  );
  const hours = Math.floor(normalizedMinutes / 60);
  const minuteValue = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")}`;
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

function getCalendarBlockOffSchedulingError(delivery, blockOff) {
  if (!blockOff) {
    return "";
  }

  if (isAllDayCalendarBlockOff(blockOff)) {
    return `${blockOff.icon || "📅"} ${blockOff.reason} is closed all day.`;
  }

  const deliveryWindow = getDeliveryTimeWindow(delivery);

  if (!deliveryWindow) {
    return "";
  }

  const openStartMinutes = timeToMinutes(blockOff.openStart || "");
  const openEndMinutes = timeToMinutes(blockOff.openEnd || "");

  if (
    openStartMinutes === null ||
    openEndMinutes === null ||
    deliveryWindow.start < openStartMinutes ||
    deliveryWindow.end > openEndMinutes
  ) {
    return `${blockOff.icon || "📅"} ${blockOff.reason} is open ${formatCalendarBlockOffTime(
      blockOff.openStart,
    )}–${formatCalendarBlockOffTime(
      blockOff.openEnd,
    )}. The full delivery block must fit within those hours.`;
  }

  return "";
}

function getCalendarBlockOffPresentation(blockOff) {
  const backgroundColor = normalizeCalendarBlockOffBackgroundColor(
    blockOff?.backgroundColor,
  );
  const textColor = getCalendarBlockOffTextColor(backgroundColor);
  const usesLightText = textColor === "#FFFFFF";

  return {
    backgroundColor,
    textColor,
    mutedTextColor: usesLightText
      ? "rgba(255, 255, 255, 0.76)"
      : "rgba(15, 23, 42, 0.72)",
    dividerColor: usesLightText
      ? "rgba(255, 255, 255, 0.25)"
      : "rgba(15, 23, 42, 0.22)",
    insetColor: usesLightText
      ? "rgba(0, 0, 0, 0.10)"
      : "rgba(255, 255, 255, 0.22)",
  };
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

function getDeliveryNoteEntries(delivery) {
  const entries = [
    {
      id: "location",
      label: "Delivery location note",
      text: String(
        delivery?.deliveryLocationNotes || delivery?.deliveryNotes || "",
      ).trim(),
    },
    {
      id: "general",
      label: "General note",
      text: String(delivery?.generalNotes || delivery?.notes || "").trim(),
    },
    {
      id: "scope",
      label: "Delivery scope note",
      text: String(delivery?.deliveryScopeNotes || "").trim(),
    },
    ...(Array.isArray(delivery?.calendarDispatchNotes)
      ? delivery.calendarDispatchNotes.map((note) => ({
          id: `dispatch-${note.id || note.createdAt || note.text}`,
          label: "Dispatch note",
          text: String(note.text || "").trim(),
        }))
      : []),
  ];
  const seenText = new Set();

  return entries.filter((entry) => {
    if (!entry.text || seenText.has(entry.text)) {
      return false;
    }

    seenText.add(entry.text);
    return true;
  });
}

function getDeliveryNotesTooltip(delivery) {
  return getDeliveryNoteEntries(delivery)
    .map((entry) => `${entry.label}: ${entry.text}`)
    .join(" • ");
}

function DeliveryNotesBadge({ delivery, showLabel = false }) {
  const notes = getDeliveryNoteEntries(delivery);

  if (!notes.length) {
    return null;
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-amber-300 font-black text-amber-950 shadow-sm ring-1 ring-inset ring-amber-400/70 ${
        showLabel ? "px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]" : "h-5 w-5"
      }`}
      title={getDeliveryNotesTooltip(delivery)}
      aria-label={`${notes.length} delivery ${notes.length === 1 ? "note" : "notes"}`}
    >
      <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
      {showLabel ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}` : null}
    </span>
  );
}

function DeliveryNotesPanel({ delivery, className = "" }) {
  const notes = getDeliveryNoteEntries(delivery);

  if (!notes.length) {
    return null;
  }

  return (
    <section
      className={`rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm ${className}`}
      aria-label="Delivery notes"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-amber-950">
          <StickyNote className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-xs font-black uppercase tracking-[0.14em]">
          Delivery notes
        </p>
      </div>
      <div className="mt-2 space-y-2">
        {notes.map((note) => (
          <div key={note.id}>
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-800">
              {note.label}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm font-bold leading-relaxed">
              {note.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
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

function getRollingCalendarMonthDays(monthDate) {
  const todayKey = getTodayDateValue();
  const today = new Date(`${todayKey}T12:00:00`);
  const isCurrentMonth =
    today.getFullYear() === monthDate.getFullYear() &&
    today.getMonth() === monthDate.getMonth();
  const anchorDate = isCurrentMonth
    ? today
    : new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(anchorDate);
  gridStart.setDate(anchorDate.getDate() - anchorDate.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      dateKey: getLocalDateKey(date),
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

function getWeekDays(dateKey) {
  const anchorDate = new Date(`${dateKey || getTodayDateValue()}T12:00:00`);
  const weekStart = new Date(anchorDate);
  weekStart.setDate(anchorDate.getDate() - anchorDate.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    return {
      date,
      dateKey: getLocalDateKey(date),
    };
  });
}

function getWeekRangeLabel(dateKey) {
  const weekDays = getWeekDays(dateKey);
  const firstDay = weekDays[0].date;
  const lastDay = weekDays[weekDays.length - 1].date;
  const firstLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(firstDay);
  const lastLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(lastDay);

  return `${firstLabel} – ${lastLabel}`;
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
  blockedDatesByKey = new Map(),
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
  const [popoverPosition, setPopoverPosition] = useState({
    left: 0,
    top: 0,
    width: 352,
  });
  const calendarDays = useMemo(
    () => getCalendarMonthDays(visibleMonth),
    [visibleMonth],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleOutsidePointer(event) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
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
      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const roomBelow = viewportHeight - pickerRect.bottom;
      const roomAbove = pickerRect.top;
      const requiredRoom = popoverHeight + 26;
      const shouldOpenAbove = roomBelow < requiredRoom && roomAbove > roomBelow;
      const width = Math.min(352, Math.max(280, viewportWidth - 24));
      const left = Math.min(
        Math.max(12, pickerRect.left),
        Math.max(12, viewportWidth - width - 12),
      );
      const preferredTop = shouldOpenAbove
        ? pickerRect.top - popoverHeight - 10
        : pickerRect.bottom + 10;
      const top = Math.min(
        Math.max(12, preferredTop),
        Math.max(12, viewportHeight - popoverHeight - 12),
      );

      setOpensAbove(shouldOpenAbove);
      setPopoverPosition({ left, top, width });
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

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Choose new delivery date"
              data-placement={opensAbove ? "top" : "bottom"}
              className="fixed z-[200] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[26px] border border-slate-200 bg-white p-5 shadow-2xl"
              style={popoverPosition}
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
              const blockOff = blockedDatesByKey.get(day.dateKey);
              const blockOffPresentation = blockOff
                ? getCalendarBlockOffPresentation(blockOff)
                : null;
              const isClosedAllDay = isAllDayCalendarBlockOff(blockOff);

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => {
                    if (!blockOff || !isClosedAllDay) {
                      selectDate(day.dateKey);
                    }
                  }}
                  disabled={Boolean(blockOff && isClosedAllDay)}
                  style={
                    blockOffPresentation && !isSelected
                      ? {
                          backgroundColor: blockOffPresentation.backgroundColor,
                          color: blockOffPresentation.textColor,
                        }
                      : undefined
                  }
                  title={
                    blockOff
                      ? `${blockOff.icon || "📅"} ${blockOff.reason} · ${getCalendarBlockOffScheduleLabel(blockOff)}`
                      : deliveryCount > 0
                      ? `${deliveryCount} ${
                          deliveryCount === 1 ? "delivery" : "deliveries"
                        }`
                      : undefined
                  }
                  className={`relative flex h-12 items-center justify-center rounded-xl text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-red-300 ${
                    blockOff
                      ? `${
                          isClosedAllDay
                            ? "cursor-not-allowed"
                            : "hover:bg-amber-200"
                        } bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300`
                      : isSelected
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : day.isCurrentMonth
                        ? "text-slate-800 hover:bg-slate-100"
                        : "text-slate-300 hover:bg-slate-50"
                  } ${isToday && !isSelected ? "ring-1 ring-red-300" : ""}`}
                >
                  {day.date.getDate()}
                  {blockOff ? (
                    <span
                      className="absolute bottom-0.5 text-[10px] leading-none"
                      aria-hidden="true"
                    >
                      {blockOff.icon || "📅"}
                    </span>
                  ) : deliveryCount > 0 ? (
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
            </div>,
            document.body,
          )
        : null}
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

function getCalendarDayDeliveries(deliveries, selectedDate) {
  return getDayDeliveries(deliveries, selectedDate).sort(
    (firstDelivery, secondDelivery) =>
      Number(deliveryNeedsDispatch(firstDelivery)) -
      Number(deliveryNeedsDispatch(secondDelivery)),
  );
}

function deliveryNeedsDispatch(delivery) {
  return (
    delivery?.dispatchStatus === "needsDispatch" ||
    getDeliveryDrivers(delivery).length === 0 ||
    getDeliveryTrucks(delivery).length === 0
  );
}

function deliveryNeedsTime(delivery) {
  return timeToMinutes(delivery?.deliveryTimeSlot || "") === null;
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
      panelClass: "border-emerald-200 bg-emerald-50/70",
      countClass: "bg-emerald-100 text-emerald-800",
      labelClass: "text-emerald-800",
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
                      <span className="flex items-center gap-2 text-sm font-black text-slate-950">
                        <span className="min-w-0 truncate">
                          {delivery.deliveryTitle ||
                            formatCustomerName(delivery.customerName) ||
                            "Delivery"}
                        </span>
                        <DeliveryNotesBadge delivery={delivery} />
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
                          : "Time optional"}
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

function CalendarDeliveryButton({
  delivery,
  onClick,
  compact = false,
  showDragHandle = false,
  isGroupTarget = false,
  groupMeta = null,
}) {
  const needsDispatch = deliveryNeedsDispatch(delivery);
  const isGrouped = Boolean(delivery.deliveryCalendarGroupId);
  const usesGroupStyle = isGroupTarget || isGrouped;
  const isConnectedGroup = Boolean(groupMeta);
  const isScheduledGroup = Boolean(
    !isGroupTarget &&
      isGrouped &&
      (groupMeta?.isScheduledGroup ?? !needsDispatch),
  );
  const groupShapeClass = isConnectedGroup
    ? groupMeta.isFirst && groupMeta.isLast
      ? "rounded-xl"
      : groupMeta.isFirst
        ? "rounded-t-xl rounded-b-md"
        : groupMeta.isLast
          ? "rounded-t-md rounded-b-xl"
          : "rounded-md"
    : "rounded-xl";
  const customerLabel =
    delivery.deliveryTitle ||
    formatCustomerName(delivery.customerName) ||
    "Delivery";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 ${groupShapeClass} ${
        isGroupTarget
          ? "border-blue-500 bg-blue-200 text-blue-950 ring-2 ring-blue-300 focus:ring-blue-200"
          : isConnectedGroup
            ? isScheduledGroup
              ? "border-teal-200 bg-white/95 text-teal-950 focus:ring-teal-200"
              : "border-blue-200 bg-white/90 text-blue-950 focus:ring-blue-200"
            : usesGroupStyle
              ? isScheduledGroup
                ? "border-teal-400 bg-gradient-to-br from-emerald-50 to-blue-100 text-teal-950 ring-2 ring-teal-300 focus:ring-teal-200"
                : "border-blue-400 bg-blue-100 text-blue-950 ring-2 ring-blue-300 focus:ring-blue-200"
          : needsDispatch
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-emerald-200 bg-emerald-50 text-emerald-950 focus:ring-red-100"
      } ${compact ? "px-2 py-1.5" : "p-3"} ${
        showDragHandle ? "pr-9" : ""
      }`}
    >
      <span className="mb-1 flex items-center justify-between gap-2">
        <span
          className={`inline-flex min-w-0 items-center gap-1 text-[8px] font-black uppercase tracking-[0.1em] ${
            isScheduledGroup
              ? "text-teal-700"
              : usesGroupStyle
                ? "text-blue-700"
              : needsDispatch
                ? "text-amber-700"
                : "text-emerald-700"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              isScheduledGroup
                ? "bg-gradient-to-br from-emerald-500 to-blue-500"
                : usesGroupStyle
                  ? "bg-blue-500"
                : needsDispatch
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
            aria-hidden="true"
          />
          <span className="truncate">
            {usesGroupStyle
              ? isGroupTarget
                ? "Release to group"
                : isScheduledGroup
                  ? groupMeta
                    ? `Scheduled stop ${groupMeta.position} of ${groupMeta.count}`
                    : "Scheduled group"
                  : groupMeta
                    ? `Stop ${groupMeta.position} of ${groupMeta.count}`
                    : "Grouped delivery"
              : needsDispatch
                ? "Needs dispatch"
                : "Scheduled"}
          </span>
        </span>
        <DeliveryNotesBadge delivery={delivery} />
      </span>
      <span className="block truncate text-xs font-black">
        {customerLabel}
      </span>
      <span className="mt-0.5 block truncate text-[10px] font-bold opacity-70">
        Order {delivery.orderNumber || "—"}
        {delivery.deliveryTimeSlot
          ? ` · ${getTimeSlotLabel(delivery.deliveryTimeSlot)}`
          : ""}
      </span>
    </button>
  );
}

function getDeliveryGroupMeta(
  visibleDeliveries,
  deliveryIndex,
  allDayDeliveries = visibleDeliveries,
) {
  const delivery = visibleDeliveries[deliveryIndex];
  const groupId = delivery?.deliveryCalendarGroupId;

  if (!groupId) {
    return null;
  }

  const allGroupDeliveries = allDayDeliveries.filter(
    (candidate) => candidate.deliveryCalendarGroupId === groupId,
  );

  if (allGroupDeliveries.length < 2) {
    return null;
  }

  const previousDelivery = visibleDeliveries[deliveryIndex - 1];
  const nextDelivery = visibleDeliveries[deliveryIndex + 1];

  return {
    count: allGroupDeliveries.length,
    isScheduledGroup: allGroupDeliveries.every(
      (candidate) => !deliveryNeedsDispatch(candidate),
    ),
    position:
      allGroupDeliveries.findIndex((candidate) => candidate.id === delivery.id) +
      1,
    isFirst: previousDelivery?.deliveryCalendarGroupId !== groupId,
    isLast: nextDelivery?.deliveryCalendarGroupId !== groupId,
  };
}

function getConnectedGroupWrapperClass(groupMeta, compact = false) {
  if (!groupMeta) {
    return compact ? "mb-1.5" : "mb-2";
  }

  const paddingClass = compact ? "px-1 pt-1" : "px-1.5 pt-1.5";
  const paletteClass = groupMeta.isScheduledGroup
    ? "border-teal-300 bg-gradient-to-b from-emerald-50 to-blue-50"
    : "border-blue-300 bg-blue-50";

  if (groupMeta.isFirst && groupMeta.isLast) {
    return `${compact ? "mb-1.5" : "mb-2"} rounded-2xl border-2 ${paletteClass} ${paddingClass} pb-1`;
  }

  if (groupMeta.isFirst) {
    return `rounded-t-2xl border-x-2 border-t-2 ${paletteClass} ${paddingClass}`;
  }

  if (groupMeta.isLast) {
    return `${compact ? "mb-1.5" : "mb-2"} rounded-b-2xl border-x-2 border-b-2 ${paletteClass} px-1 pb-1 pt-1`;
  }

  return `border-x-2 ${paletteClass} px-1 pt-1`;
}

function CalendarStatusLegend() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.08em]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-amber-800 ring-1 ring-inset ring-amber-200">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        Needs dispatch
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-emerald-800 ring-1 ring-inset ring-emerald-200">
        <span
          className="h-2 w-2 rounded-full bg-emerald-500"
          aria-hidden="true"
        />
        Scheduled
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-1 text-blue-800 ring-1 ring-inset ring-blue-200">
        <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
        Grouped
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-blue-50 px-2 py-1 text-teal-800 ring-1 ring-inset ring-teal-200">
        <span
          className="h-2 w-2 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500"
          aria-hidden="true"
        />
        Scheduled group
      </span>
    </div>
  );
}

function DayFullDragTile({
  disabled,
  isDragging,
  requiresCode = true,
  onDragStart,
  onDragEnd,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onPointerCancel,
}) {
  return (
    <section
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerCancel}
      className={`flex h-full touch-none select-none items-center rounded-2xl border p-3 shadow-sm transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          : isDragging
            ? "cursor-grabbing border-slate-950 bg-slate-950 text-white ring-4 ring-slate-200"
            : "cursor-grab border-slate-300 bg-slate-50 text-slate-950 hover:border-slate-500 hover:bg-white hover:shadow-md active:cursor-grabbing"
      }`}
      aria-label="Drag Day Full onto a calendar date"
      title="Drag onto a date to stop additional deliveries"
    >
      <div className="flex w-full items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isDragging ? "bg-white/15" : "bg-white shadow-sm ring-1 ring-slate-200"
          }`}
        >
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Day is full</p>
          <p
            className={`mt-0.5 text-[11px] font-bold leading-4 ${
              isDragging ? "text-white/75" : "text-slate-500"
            }`}
          >
            Drag to a date{requiresCode ? " · code required" : ""}
          </p>
        </div>
        <GripVertical className="h-5 w-5 shrink-0 opacity-50" aria-hidden="true" />
      </div>
    </section>
  );
}

function DeliveryClosedDayBadge({ blockOff }) {
  const partialClosure = getDeliveryDayFullRestoreBlockOff(blockOff);
  const title = partialClosure
    ? `Day full · Partially closed · ${getCalendarBlockOffScheduleLabel(partialClosure)} · ${partialClosure.reason}`
    : "Day full";

  return (
    <span
      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-slate-950 px-2.5 text-white shadow-sm"
      aria-label="Day full"
      title={title}
    >
      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
      <span className="text-[10px] font-black uppercase tracking-[0.08em]">
        Day Full
      </span>
    </span>
  );
}

function DeliveryDayFullPartialClosureNotice({
  blockOff,
  compact = false,
  className = "",
}) {
  const partialClosure = getDeliveryDayFullRestoreBlockOff(blockOff);

  if (!partialClosure || isAllDayCalendarBlockOff(partialClosure)) {
    return null;
  }

  const scheduleLabel = getCalendarBlockOffScheduleLabel(partialClosure);

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 text-left text-amber-950 shadow-sm ${
        compact ? "px-2 py-1.5" : "px-3 py-2.5"
      } ${className}`}
      title={`${partialClosure.reason} · ${scheduleLabel}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ${
          compact ? "h-7 w-7 text-base" : "h-9 w-9 text-xl"
        }`}
        aria-hidden="true"
      >
        {partialClosure.icon || "📅"}
      </span>
      <span className="min-w-0">
        <span
          className={`block font-black uppercase tracking-[0.06em] ${
            compact ? "text-[8px]" : "text-[10px]"
          }`}
        >
          Partially closed
        </span>
        <span
          className={`block truncate font-bold text-amber-800 ${
            compact ? "text-[8px]" : "text-xs"
          }`}
        >
          {scheduleLabel} · {partialClosure.reason}
        </span>
      </span>
    </div>
  );
}

function DeliveryDateTbdTray({
  deliveries,
  onSelectDelivery,
  canMoveDeliveries,
  deliveryDrag,
  embedded = false,
}) {
  const {
    draggedDeliveryId,
    dropDateKey,
    handleDeliveryDragStart,
    handleDeliveryDragEnd,
    handleTbdDragOver,
    handleTbdDrop,
    handleDeliveryPointerDown,
    handleDeliveryPointerMove,
    handleDeliveryPointerEnd,
    handleDeliveryPointerCancel,
  } = deliveryDrag;
  const isTbdDropTarget = dropDateKey === calendarTbdDropKey;

  if (deliveries.length === 0) {
    return (
      <section
        data-delivery-calendar-tbd="true"
        onDragOver={handleTbdDragOver}
        onDrop={handleTbdDrop}
        className={`${embedded ? "" : "mb-6"} flex min-h-28 items-center justify-between gap-3 rounded-2xl border bg-blue-50/60 px-4 py-3 shadow-sm transition sm:px-5 ${
          isTbdDropTarget
            ? "border-blue-500 ring-4 ring-blue-200"
            : "border-blue-200"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <CalendarDays
            className="h-5 w-5 shrink-0 text-blue-700"
            aria-hidden="true"
          />
          <div className="min-w-0 sm:flex sm:items-center sm:gap-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              Delivery date TBD
            </p>
            <p className="truncate text-xs font-bold text-slate-500">
              {isTbdDropTarget
                ? "Release here to remove the delivery date"
                : "No deliveries waiting for a date"}
            </p>
          </div>
        </div>
        <span className="inline-flex min-w-7 shrink-0 items-center justify-center rounded-full bg-white px-2 py-1 text-xs font-black text-blue-700 ring-1 ring-inset ring-blue-200">
          0
        </span>
      </section>
    );
  }

  return (
    <section
      data-delivery-calendar-tbd="true"
      onDragOver={handleTbdDragOver}
      onDrop={handleTbdDrop}
      className={`${embedded ? "" : "mb-6"} overflow-hidden rounded-3xl border bg-blue-50/60 shadow-sm transition ${
        isTbdDropTarget
          ? "border-blue-500 ring-4 ring-blue-200"
          : "border-blue-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-blue-100 px-4 py-3 sm:items-center sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
              Delivery date TBD
            </p>
            <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-blue-700 px-2 py-1 text-xs font-black text-white">
              {deliveries.length}
            </span>
          </div>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {isTbdDropTarget
              ? "Release here to move this delivery back to TBD."
              : "Drag onto a day, or open an order to choose its date, driver, truck, and optional time."}
          </p>
          {canMoveDeliveries ? (
            <p className="mt-1 text-xs font-bold text-blue-700">
              In Week or Month view, you can also drag an order onto a day.
            </p>
          ) : null}
        </div>
        <CalendarDays className="h-6 w-6 shrink-0 text-blue-700" aria-hidden="true" />
      </div>

      <div className="flex gap-3 overflow-x-auto p-3 sm:p-4">
        {deliveries.map((delivery) => {
          const needsDispatch = deliveryNeedsDispatch(delivery);
          const customerLabel =
            delivery.deliveryTitle ||
            formatCustomerName(delivery.customerName) ||
            "Delivery";

          return (
            <div
              key={delivery.id}
              draggable={canMoveDeliveries}
              onDragStart={(event) =>
                handleDeliveryDragStart(event, delivery)
              }
              onDragEnd={handleDeliveryDragEnd}
              className={`group relative w-[17rem] shrink-0 sm:w-[19rem] ${
                canMoveDeliveries ? "cursor-grab active:cursor-grabbing" : ""
              } ${draggedDeliveryId === delivery.id ? "opacity-40" : ""}`}
            >
              {canMoveDeliveries ? (
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) =>
                    handleDeliveryPointerDown(event, delivery, "")
                  }
                  onPointerMove={handleDeliveryPointerMove}
                  onPointerUp={handleDeliveryPointerEnd}
                  onPointerCancel={handleDeliveryPointerCancel}
                  className="absolute right-2 top-2 z-20 flex h-8 w-8 touch-none items-center justify-center rounded-lg border border-blue-200 bg-white/95 text-blue-600 shadow-sm transition hover:text-blue-900"
                  aria-label={`Drag order ${delivery.orderNumber || ""} onto a calendar date`}
                  title="Drag to schedule"
                >
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onSelectDelivery(delivery)}
                className="w-full rounded-2xl border border-blue-200 bg-white p-3 pr-12 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">
                      {customerLabel}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      Order {delivery.orderNumber || "—"}
                    </p>
                  </div>
                  <span className="mr-7 flex shrink-0 items-center gap-1.5 self-start">
                    <DeliveryNotesBadge delivery={delivery} />
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${
                        needsDispatch
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {needsDispatch ? "Needs dispatch" : "Assigned"}
                    </span>
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-blue-700">
                    Date TBD
                  </span>
                  <span className="text-xs font-black text-blue-700 transition group-hover:translate-x-0.5">
                    Schedule →
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function useCalendarDeliveryDrag({
  deliveries,
  canMoveDeliveries,
  onMoveDelivery,
}) {
  const pointerDeliveryDragRef = useRef(null);
  const groupHoverRef = useRef({
    targetDeliveryId: "",
    timerId: null,
    ready: false,
  });
  const [draggedDeliveryId, setDraggedDeliveryId] = useState("");
  const [dropDateKey, setDropDateKey] = useState("");
  const [dropDeliveryId, setDropDeliveryId] = useState("");
  const [dropPlacement, setDropPlacement] = useState("");
  const [groupTargetDeliveryId, setGroupTargetDeliveryId] = useState("");

  function clearGroupHover() {
    if (groupHoverRef.current.timerId) {
      window.clearTimeout(groupHoverRef.current.timerId);
    }

    groupHoverRef.current = {
      targetDeliveryId: "",
      timerId: null,
      ready: false,
    };
    setGroupTargetDeliveryId("");
  }

  function startGroupHover(targetDeliveryId, sourceDeliveryId) {
    if (!targetDeliveryId || targetDeliveryId === sourceDeliveryId) {
      clearGroupHover();
      return;
    }

    if (groupHoverRef.current.targetDeliveryId === targetDeliveryId) {
      return;
    }

    clearGroupHover();
    groupHoverRef.current.targetDeliveryId = targetDeliveryId;
    groupHoverRef.current.timerId = window.setTimeout(() => {
      if (groupHoverRef.current.targetDeliveryId !== targetDeliveryId) {
        return;
      }

      groupHoverRef.current.ready = true;
      groupHoverRef.current.timerId = null;
      setGroupTargetDeliveryId(targetDeliveryId);
    }, deliveryGroupHoldMs);
  }

  function resetDeliveryDrag() {
    clearGroupHover();
    setDraggedDeliveryId("");
    setDropDateKey("");
    setDropDeliveryId("");
    setDropPlacement("");
  }

  function handleDeliveryDragStart(event, delivery) {
    if (!canMoveDeliveries || !delivery?.id) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", delivery.id);
    setDraggedDeliveryId(delivery.id);
  }

  function handleDeliveryDragEnd() {
    resetDeliveryDrag();
  }

  function handleDayDragOver(event, dateKey) {
    if (!canMoveDeliveries) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearGroupHover();
    setDropDateKey(dateKey);
    setDropDeliveryId("");
    setDropPlacement("");
  }

  async function moveDeliveryToDay(
    deliveryId,
    dateKey,
    targetDelivery = null,
    placement = "after",
  ) {
    if (!canMoveDeliveries || !onMoveDelivery) {
      return false;
    }

    const delivery = deliveries.find((item) => item.id === deliveryId);
    const sourceDateKey = getDeliveryDateKey(delivery?.deliveryDate);

    if (!delivery || !dateKey) {
      return false;
    }

    const movingDeliveries = delivery.deliveryCalendarGroupId
      ? deliveries.filter(
          (item) =>
            !isDeliveryComplete(item) &&
            item.deliveryCalendarGroupId === delivery.deliveryCalendarGroupId,
        )
      : [delivery];
    const movingDeliveryIds = new Set(
      movingDeliveries.map((item) => item.id),
    );
    const sourceDayDeliveries = getCalendarDayDeliveries(
      deliveries,
      sourceDateKey,
    );
    const targetDayDeliveries =
      sourceDateKey === dateKey
        ? sourceDayDeliveries
        : getCalendarDayDeliveries(deliveries, dateKey);
    const remainingTargetDeliveries = targetDayDeliveries.filter(
      (dayDelivery) => !movingDeliveryIds.has(dayDelivery.id),
    );
    const draggedNeedsDispatch = deliveryNeedsDispatch(delivery);
    const validTarget =
      targetDelivery &&
      !movingDeliveryIds.has(targetDelivery.id) &&
      deliveryNeedsDispatch(targetDelivery) === draggedNeedsDispatch
        ? targetDelivery
        : null;
    let insertionIndex;

    if (validTarget) {
      const targetIndex = remainingTargetDeliveries.findIndex(
        (dayDelivery) => dayDelivery.id === validTarget.id,
      );

      insertionIndex =
        targetIndex < 0
          ? remainingTargetDeliveries.length
          : targetIndex + (placement === "after" ? 1 : 0);
    } else if (draggedNeedsDispatch) {
      insertionIndex = remainingTargetDeliveries.length;
    } else {
      const firstNeedsDispatchIndex = remainingTargetDeliveries.findIndex(
        (dayDelivery) => deliveryNeedsDispatch(dayDelivery),
      );

      insertionIndex =
        firstNeedsDispatchIndex < 0
          ? remainingTargetDeliveries.length
          : firstNeedsDispatchIndex;
    }

    const nextTargetDeliveries = [...remainingTargetDeliveries];
    nextTargetDeliveries.splice(insertionIndex, 0, ...movingDeliveries);
    const nextSourceDeliveries =
      sourceDateKey === dateKey
        ? []
        : sourceDayDeliveries.filter(
            (dayDelivery) => !movingDeliveryIds.has(dayDelivery.id),
          );
    const routeUpdates = new Map();

    nextSourceDeliveries.forEach((dayDelivery, index) => {
      const nextRouteOrder = index + 1;

      if (Number(dayDelivery.deliveryRouteOrder) !== nextRouteOrder) {
        routeUpdates.set(dayDelivery.id, {
          delivery: dayDelivery,
          updates: { deliveryRouteOrder: nextRouteOrder },
        });
      }
    });

    nextTargetDeliveries.forEach((dayDelivery, index) => {
      const nextRouteOrder = index + 1;
      const updates = {};

      if (Number(dayDelivery.deliveryRouteOrder) !== nextRouteOrder) {
        updates.deliveryRouteOrder = nextRouteOrder;
      }

      if (movingDeliveryIds.has(dayDelivery.id) && sourceDateKey !== dateKey) {
        updates.deliveryDate = dateKey;
      }

      if (Object.keys(updates).length > 0) {
        routeUpdates.set(dayDelivery.id, {
          delivery: dayDelivery,
          updates,
        });
      }
    });

    for (const routeUpdate of routeUpdates.values()) {
      const moved = await onMoveDelivery(
        routeUpdate.delivery,
        routeUpdate.updates,
      );

      if (moved === false) {
        return false;
      }
    }

    return true;
  }

  async function moveDeliveryToTbd(deliveryId) {
    if (!canMoveDeliveries || !onMoveDelivery) {
      return false;
    }

    const delivery = deliveries.find((item) => item.id === deliveryId);

    if (!delivery) {
      return false;
    }

    const sourceDateKey = getDeliveryDateKey(delivery.deliveryDate);
    const movingDeliveries = delivery.deliveryCalendarGroupId
      ? deliveries.filter(
          (item) =>
            item.deliveryCalendarGroupId === delivery.deliveryCalendarGroupId,
        )
      : [delivery];
    const movingDeliveryIds = new Set(
      movingDeliveries.map((item) => item.id),
    );
    const sourceDayDeliveries = getCalendarDayDeliveries(
      deliveries,
      sourceDateKey,
    ).filter((dayDelivery) => !movingDeliveryIds.has(dayDelivery.id));
    const routeUpdates = sourceDayDeliveries
      .map((dayDelivery, index) => ({
        delivery: dayDelivery,
        updates: { deliveryRouteOrder: index + 1 },
      }))
      .filter(
        ({ delivery: dayDelivery, updates }) =>
          Number(dayDelivery.deliveryRouteOrder) !==
          updates.deliveryRouteOrder,
      );
    for (const movingDelivery of movingDeliveries) {
      const moved = await onMoveDelivery(movingDelivery, {
        deliveryDate: "",
        deliveryTimeSlot: "",
        deliveryRouteOrder: null,
      });

      if (moved === false) {
        return false;
      }
    }

    for (const routeUpdate of routeUpdates) {
      const routeMoved = await onMoveDelivery(
        routeUpdate.delivery,
        routeUpdate.updates,
      );

      if (routeMoved === false) {
        return false;
      }
    }

    return true;
  }

  async function groupDeliveries(deliveryId, targetDelivery, dateKey) {
    const delivery = deliveries.find((item) => item.id === deliveryId);

    if (!delivery || !targetDelivery || delivery.id === targetDelivery.id) {
      return false;
    }

    const moved = await moveDeliveryToDay(
      deliveryId,
      dateKey,
      targetDelivery,
      "after",
    );

    if (moved === false) {
      return false;
    }

    const groupId =
      targetDelivery.deliveryCalendarGroupId ||
      delivery.deliveryCalendarGroupId ||
      `delivery-group-${Date.now()}-${targetDelivery.id}`;
    const groupedDeliveries = deliveries.filter(
      (item) =>
        item.id === targetDelivery.id ||
        item.id === delivery.id ||
        (targetDelivery.deliveryCalendarGroupId &&
          item.deliveryCalendarGroupId ===
            targetDelivery.deliveryCalendarGroupId) ||
        (delivery.deliveryCalendarGroupId &&
          item.deliveryCalendarGroupId === delivery.deliveryCalendarGroupId),
    );

    for (const groupedDelivery of groupedDeliveries) {
      const grouped = await onMoveDelivery(groupedDelivery, {
        deliveryDate: dateKey,
        deliveryCalendarGroupId: groupId,
      });

      if (grouped === false) {
        return false;
      }
    }

    return true;
  }

  async function handleDayDrop(event, dateKey) {
    if (!canMoveDeliveries || !onMoveDelivery) {
      return;
    }

    event.preventDefault();
    const deliveryId =
      draggedDeliveryId || event.dataTransfer.getData("text/plain");

    resetDeliveryDrag();
    await moveDeliveryToDay(deliveryId, dateKey);
  }

  function handleDeliveryDragOver(event, delivery, dateKey) {
    if (
      !canMoveDeliveries ||
      !draggedDeliveryId ||
      draggedDeliveryId === delivery.id
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const deliveryBounds = event.currentTarget.getBoundingClientRect();
    const placement =
      event.clientY < deliveryBounds.top + deliveryBounds.height / 2
        ? "before"
        : "after";

    startGroupHover(delivery.id, draggedDeliveryId);
    setDropDateKey(dateKey);
    setDropDeliveryId(delivery.id);
    setDropPlacement(placement);
  }

  function handleDeliveryDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      clearGroupHover();
      setDropDeliveryId("");
      setDropPlacement("");
    }
  }

  async function handleDeliveryDrop(event, targetDelivery, dateKey) {
    if (!canMoveDeliveries || !onMoveDelivery) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const deliveryId =
      draggedDeliveryId || event.dataTransfer.getData("text/plain");
    const placement = dropPlacement || "before";
    const shouldGroup =
      groupHoverRef.current.ready &&
      groupHoverRef.current.targetDeliveryId === targetDelivery.id;

    resetDeliveryDrag();
    if (shouldGroup) {
      await groupDeliveries(deliveryId, targetDelivery, dateKey);
    } else {
      await moveDeliveryToDay(
        deliveryId,
        dateKey,
        targetDelivery,
        placement,
      );
    }
  }

  function handleTbdDragOver(event) {
    if (!canMoveDeliveries) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearGroupHover();
    setDropDateKey(calendarTbdDropKey);
    setDropDeliveryId("");
    setDropPlacement("");
  }

  async function handleTbdDrop(event) {
    if (!canMoveDeliveries || !onMoveDelivery) {
      return;
    }

    event.preventDefault();
    const deliveryId =
      draggedDeliveryId || event.dataTransfer.getData("text/plain");

    resetDeliveryDrag();
    await moveDeliveryToTbd(deliveryId);
  }

  function handleDeliveryPointerDown(event, delivery, dateKey) {
    if (
      !canMoveDeliveries ||
      !delivery?.id ||
      event.pointerType === "mouse" ||
      pointerDeliveryDragRef.current
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerDeliveryDragRef.current = {
      pointerId: event.pointerId,
      deliveryId: delivery.id,
      sourceDateKey: dateKey,
      targetDateKey: dateKey,
      targetDeliveryId: delivery.id,
      placement: "before",
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
    };
    setDraggedDeliveryId(delivery.id);
  }

  function handleDeliveryPointerMove(event) {
    const pointerDrag = pointerDeliveryDragRef.current;

    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) {
      return;
    }

    const travelDistance = Math.hypot(
      event.clientX - pointerDrag.startX,
      event.clientY - pointerDrag.startY,
    );

    if (!pointerDrag.hasMoved && travelDistance < 8) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    pointerDrag.hasMoved = true;

    const hitElement = document.elementFromPoint(event.clientX, event.clientY);
    const tbdElement = hitElement?.closest("[data-delivery-calendar-tbd]");
    const dayElement = hitElement?.closest("[data-delivery-calendar-day]");
    const cardElement = hitElement?.closest("[data-delivery-calendar-card]");
    const targetDateKey = tbdElement
      ? calendarTbdDropKey
      : dayElement?.dataset.deliveryCalendarDay || "";

    if (!targetDateKey) {
      pointerDrag.targetDateKey = "";
      pointerDrag.targetDeliveryId = "";
      pointerDrag.placement = "";
      setDropDateKey("");
      setDropDeliveryId("");
      setDropPlacement("");
      clearGroupHover();
      return;
    }

    if (targetDateKey === calendarTbdDropKey) {
      pointerDrag.targetDateKey = calendarTbdDropKey;
      pointerDrag.targetDeliveryId = "";
      pointerDrag.placement = "";
      clearGroupHover();
      setDropDateKey(calendarTbdDropKey);
      setDropDeliveryId("");
      setDropPlacement("");
      return;
    }

    const targetDeliveryId =
      cardElement?.dataset.deliveryDate === targetDateKey
        ? cardElement.dataset.deliveryId || ""
        : "";
    let placement = "";

    if (targetDeliveryId) {
      const cardBounds = cardElement.getBoundingClientRect();
      placement =
        event.clientY < cardBounds.top + cardBounds.height / 2
          ? "before"
          : "after";
    }

    pointerDrag.targetDateKey = targetDateKey;
    pointerDrag.targetDeliveryId = targetDeliveryId;
    pointerDrag.placement = placement;
    startGroupHover(targetDeliveryId, pointerDrag.deliveryId);
    setDropDateKey(targetDateKey);
    setDropDeliveryId(targetDeliveryId);
    setDropPlacement(placement);
  }

  async function handleDeliveryPointerEnd(event) {
    const pointerDrag = pointerDeliveryDragRef.current;

    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointerDeliveryDragRef.current = null;
    const shouldGroup =
      groupHoverRef.current.ready &&
      groupHoverRef.current.targetDeliveryId ===
        pointerDrag.targetDeliveryId;
    resetDeliveryDrag();

    if (!pointerDrag.hasMoved || !pointerDrag.targetDateKey) {
      return;
    }

    if (pointerDrag.targetDateKey === calendarTbdDropKey) {
      await moveDeliveryToTbd(pointerDrag.deliveryId);
      return;
    }

    if (
      pointerDrag.targetDeliveryId === pointerDrag.deliveryId &&
      pointerDrag.targetDateKey === pointerDrag.sourceDateKey
    ) {
      return;
    }

    const targetDelivery = pointerDrag.targetDeliveryId
      ? deliveries.find(
          (delivery) => delivery.id === pointerDrag.targetDeliveryId,
        )
      : null;

    if (shouldGroup && targetDelivery) {
      await groupDeliveries(
        pointerDrag.deliveryId,
        targetDelivery,
        pointerDrag.targetDateKey,
      );
      return;
    }

    await moveDeliveryToDay(
      pointerDrag.deliveryId,
      pointerDrag.targetDateKey,
      targetDelivery,
      pointerDrag.placement || "after",
    );
  }

  function handleDeliveryPointerCancel(event) {
    const pointerDrag = pointerDeliveryDragRef.current;

    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointerDeliveryDragRef.current = null;
    resetDeliveryDrag();
  }

  return {
    draggedDeliveryId,
    dropDateKey,
    dropDeliveryId,
    dropPlacement,
    groupTargetDeliveryId,
    handleDeliveryDragStart,
    handleDeliveryDragEnd,
    handleDayDragOver,
    handleDayDrop,
    handleDeliveryDragOver,
    handleDeliveryDragLeave,
    handleDeliveryDrop,
    handleTbdDragOver,
    handleTbdDrop,
    handleDeliveryPointerDown,
    handleDeliveryPointerMove,
    handleDeliveryPointerEnd,
    handleDeliveryPointerCancel,
  };
}

function DeliveryWeekView({
  deliveries,
  blockedDatesByKey = new Map(),
  selectedDate,
  onNavigate,
  onSelectDay,
  onSelectDelivery,
  canMoveDeliveries,
  deliveryDrag,
  dayFullDropDateKey = "",
  onDayFullDragOver,
  onDayFullDrop,
  onRequestDayLockChange,
}) {
  const weekDays = getWeekDays(selectedDate);
  const today = getTodayDateValue();
  const [expandedDayKey, setExpandedDayKey] = useState("");
  const {
    draggedDeliveryId,
    dropDateKey,
    dropDeliveryId,
    dropPlacement,
    groupTargetDeliveryId,
    handleDeliveryDragStart,
    handleDeliveryDragEnd,
    handleDayDragOver,
    handleDayDrop,
    handleDeliveryDragOver,
    handleDeliveryDragLeave,
    handleDeliveryDrop,
    handleDeliveryPointerDown,
    handleDeliveryPointerMove,
    handleDeliveryPointerEnd,
    handleDeliveryPointerCancel,
  } = deliveryDrag;

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            Week view
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {getWeekRangeLabel(selectedDate)}
          </h2>
          <CalendarStatusLegend />
          {canMoveDeliveries ? (
            <p className="mt-2 text-xs font-bold text-slate-500">
              Drag to reorder or change days. Hold over another delivery until
              it turns blue to group them.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate(-7)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onSelectDay(today, new Date(`${today}T12:00:00`), false)}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-200"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => onNavigate(7)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-px bg-slate-200 md:grid-cols-7">
        {weekDays.map((day) => {
          const dayDeliveries = getCalendarDayDeliveries(
            deliveries,
            day.dateKey,
          );
          const orderedDayDeliveries = dayDeliveries;
          const isSelected = day.dateKey === selectedDate;
          const isToday = day.dateKey === today;
          const isExpanded = expandedDayKey === day.dateKey;
          const blockOff = blockedDatesByKey.get(day.dateKey);
          const blockOffPresentation = blockOff
            ? getCalendarBlockOffPresentation(blockOff)
            : null;
          const isClosedAllDay = isAllDayCalendarBlockOff(blockOff);
          const isDayFull = isDeliveryDayFullBlockOff(blockOff);
          const visibleDeliveries = isExpanded
            ? orderedDayDeliveries
            : orderedDayDeliveries.slice(0, 4);

          return (
            <div
              key={day.dateKey}
              data-delivery-day-lock-date={day.dateKey}
              data-delivery-calendar-day={
                isClosedAllDay ? undefined : day.dateKey
              }
              onDragOver={(event) => {
                if (onDayFullDragOver?.(event, day.dateKey)) {
                  return;
                }
                if (!isClosedAllDay) {
                  handleDayDragOver(event, day.dateKey);
                }
              }}
              onDrop={(event) => {
                if (onDayFullDrop?.(event, day.dateKey)) {
                  return;
                }
                if (!isClosedAllDay) {
                  handleDayDrop(event, day.dateKey);
                }
              }}
              className={`min-h-44 p-3 transition-colors ${
                dayFullDropDateKey === day.dateKey
                  ? "bg-slate-100 ring-4 ring-inset ring-slate-950"
                  : blockOff
                  ? "bg-white"
                  : dropDateKey === day.dateKey
                  ? "bg-red-50 ring-2 ring-inset ring-[#FC2C38]"
                  : "bg-white"
              } ${
                isDayFull
                  ? "ring-2 ring-inset ring-slate-950"
                  : isSelected
                    ? "ring-2 ring-inset ring-[#FC2C38]"
                    : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day.dateKey, day.date, true)}
                className="flex w-full items-start justify-between gap-2 rounded-xl p-1 text-left transition hover:bg-slate-50"
              >
                <span>
                  <span
                    className={`block text-[10px] font-black uppercase tracking-[0.12em] ${
                      isToday ? "text-[#FC2C38]" : "text-slate-400"
                    }`}
                  >
                    {isToday
                      ? "Today"
                      : new Intl.DateTimeFormat("en-US", {
                          weekday: "short",
                        }).format(day.date)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-lg font-black text-slate-950">
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                      }).format(day.date)}
                    </span>
                    {isDayFull ? (
                      <DeliveryClosedDayBadge blockOff={blockOff} />
                    ) : null}
                  </span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                  {dayDeliveries.length}
                </span>
              </button>

              {isDayFull && onRequestDayLockChange ? (
                <button
                  type="button"
                  onClick={() => onRequestDayLockChange(day.dateKey)}
                  className="mt-2 rounded-lg bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.06em] text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-slate-950 hover:text-white"
                >
                  Reopen day
                </button>
              ) : null}

              {isDayFull ? (
                <DeliveryDayFullPartialClosureNotice
                  blockOff={blockOff}
                  compact
                  className="mt-2"
                />
              ) : null}

              {blockOff && isClosedAllDay && !isDayFull ? (
                <div
                  className="mt-2 flex min-h-32 flex-col items-center justify-center rounded-xl border px-3 py-4 text-center shadow-sm"
                  style={{
                    backgroundColor: blockOffPresentation.backgroundColor,
                    borderColor: blockOffPresentation.backgroundColor,
                    color: blockOffPresentation.textColor,
                  }}
                  title={`${blockOff.reason} · ${getCalendarBlockOffScheduleLabel(blockOff)}`}
                >
                  <span
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm"
                    aria-hidden="true"
                  >
                      {blockOff.icon || "📅"}
                  </span>
                  <p className="mt-3 text-base font-black uppercase tracking-[0.07em]">
                    {getCalendarBlockOffScheduleLabel(blockOff)}
                  </p>
                  <p
                    className="mt-2 w-full border-t pt-2 text-lg font-black leading-tight"
                    style={{ borderColor: blockOffPresentation.dividerColor }}
                  >
                    {blockOff.reason}
                  </p>
                </div>
              ) : null}

              <div className="mt-3">
                {visibleDeliveries.map((delivery, deliveryIndex) => {
                  const groupMeta = getDeliveryGroupMeta(
                    visibleDeliveries,
                    deliveryIndex,
                    orderedDayDeliveries,
                  );
                  const beginsNeedsDispatchGroup =
                    deliveryNeedsDispatch(delivery) &&
                    visibleDeliveries
                      .slice(0, deliveryIndex)
                      .some(
                        (previousDelivery) =>
                          !deliveryNeedsDispatch(previousDelivery),
                      );

                  return (
                    <div
                      key={delivery.id}
                      data-delivery-calendar-card="true"
                      data-delivery-id={delivery.id}
                      data-delivery-date={day.dateKey}
                      draggable={canMoveDeliveries}
                      onDragStart={(event) =>
                        handleDeliveryDragStart(event, delivery)
                      }
                      onDragEnd={handleDeliveryDragEnd}
                      onDragOver={(event) =>
                        handleDeliveryDragOver(event, delivery, day.dateKey)
                      }
                      onDragLeave={handleDeliveryDragLeave}
                      onDrop={(event) =>
                        handleDeliveryDrop(event, delivery, day.dateKey)
                      }
                      title={
                        canMoveDeliveries
                          ? "Drag this delivery to reorder the day or move it to another date"
                          : undefined
                      }
                      className={`relative ${getConnectedGroupWrapperClass(
                        groupMeta,
                      )} ${
                        beginsNeedsDispatchGroup
                          ? "mt-3 border-t border-slate-200 pt-3"
                          : ""
                      } ${
                        canMoveDeliveries
                          ? "cursor-grab active:cursor-grabbing"
                          : ""
                      } ${
                        draggedDeliveryId === delivery.id
                          ? "opacity-40"
                          : ""
                      }`}
                    >
                      {groupMeta?.isFirst ? (
                        <div
                          className={`mb-1 flex items-center justify-between gap-2 px-1 text-[8px] font-black uppercase tracking-[0.1em] ${
                            groupMeta.isScheduledGroup
                              ? "text-teal-700"
                              : "text-blue-700"
                          }`}
                        >
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Layers
                              className="h-3 w-3 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {groupMeta.isScheduledGroup
                                ? "Scheduled group"
                                : "Grouped route"}
                            </span>
                          </span>
                          <span className="shrink-0">
                            {groupMeta.count} deliveries
                          </span>
                        </div>
                      ) : null}
                      {dropDeliveryId === delivery.id &&
                      draggedDeliveryId !== delivery.id ? (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-x-0 z-10 h-1 rounded-full bg-[#FC2C38] shadow-sm ${
                            dropPlacement === "after" ? "-bottom-1.5" : "-top-1.5"
                          }`}
                        />
                      ) : null}
                      {canMoveDeliveries ? (
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) =>
                            handleDeliveryPointerDown(
                              event,
                              delivery,
                              day.dateKey,
                            )
                          }
                          onPointerMove={handleDeliveryPointerMove}
                          onPointerUp={handleDeliveryPointerEnd}
                          onPointerCancel={handleDeliveryPointerCancel}
                          className={`absolute right-1 z-20 flex h-7 w-7 touch-none items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition hover:text-slate-950 ${
                            groupMeta?.isFirst ? "top-7" : "top-1"
                          }`}
                          aria-label={`Drag order ${delivery.orderNumber || ""} to another calendar position`}
                          title="Drag to move"
                        >
                          <GripVertical
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                      <CalendarDeliveryButton
                        delivery={delivery}
                        onClick={() => onSelectDelivery(delivery)}
                        compact
                        showDragHandle={canMoveDeliveries}
                        groupMeta={groupMeta}
                        isGroupTarget={
                          groupTargetDeliveryId === delivery.id &&
                          draggedDeliveryId !== delivery.id
                        }
                      />
                    </div>
                  );
                })}
                {dayDeliveries.length > 4 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDayKey((currentDayKey) =>
                        currentDayKey === day.dateKey ? "" : day.dateKey,
                      )
                    }
                    aria-expanded={isExpanded}
                    className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-black text-slate-600 transition hover:bg-slate-200"
                  >
                    {isExpanded
                      ? "Show fewer"
                      : `+${dayDeliveries.length - 4} more`}
                  </button>
                ) : null}
                {dayDeliveries.length === 0 && !blockOff ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-2 py-4 text-center text-[10px] font-bold text-slate-400">
                    No deliveries
                  </p>
                ) : null}
              </div>

              {blockOff && !isClosedAllDay ? (
                <div
                  className="mt-3 flex min-h-32 flex-col items-center justify-center rounded-xl border px-3 py-4 text-center shadow-sm"
                  style={{
                    backgroundColor: blockOffPresentation.backgroundColor,
                    borderColor: blockOffPresentation.backgroundColor,
                    color: blockOffPresentation.textColor,
                  }}
                  title={`${blockOff.reason} · ${getCalendarBlockOffScheduleLabel(blockOff)}`}
                >
                  <span
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm"
                    aria-hidden="true"
                  >
                    {blockOff.icon || "📅"}
                  </span>
                  <p className="mt-3 text-base font-black uppercase tracking-[0.07em]">
                    {getCalendarBlockOffScheduleLabel(blockOff)}
                  </p>
                  <p
                    className="mt-2 w-full border-t pt-2 text-lg font-black leading-tight"
                    style={{ borderColor: blockOffPresentation.dividerColor }}
                  >
                    {blockOff.reason}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeliveryMonthView({
  deliveries,
  blockedDatesByKey = new Map(),
  monthDate,
  selectedDate,
  onChangeMonth,
  onSelectDay,
  onSelectDelivery,
  canMoveDeliveries,
  deliveryDrag,
  dayFullDropDateKey = "",
  onDayFullDragOver,
  onDayFullDrop,
  onRequestDayLockChange,
}) {
  const monthDays = getRollingCalendarMonthDays(monthDate);
  const today = getTodayDateValue();
  const [expandedDayKey, setExpandedDayKey] = useState("");
  const {
    draggedDeliveryId,
    dropDateKey,
    dropDeliveryId,
    dropPlacement,
    groupTargetDeliveryId,
    handleDeliveryDragStart,
    handleDeliveryDragEnd,
    handleDayDragOver,
    handleDayDrop,
    handleDeliveryDragOver,
    handleDeliveryDragLeave,
    handleDeliveryDrop,
    handleDeliveryPointerDown,
    handleDeliveryPointerMove,
    handleDeliveryPointerEnd,
    handleDeliveryPointerCancel,
  } = deliveryDrag;

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            Month view
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {getCalendarMonthLabel(monthDate)}
          </h2>
          <CalendarStatusLegend />
          {canMoveDeliveries ? (
            <p className="mt-2 text-xs font-bold text-slate-500">
              Drag to reorder or change days. Hold over another delivery until
              it turns blue to group them.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeMonth(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onSelectDay(today, new Date(`${today}T12:00:00`), false)}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-200"
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[56rem]">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (weekday) => (
                <span
                  key={weekday}
                  className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
                >
                  {weekday}
                </span>
              ),
            )}
          </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200">
            {monthDays.map((day) => {
              const dayDeliveries = getCalendarDayDeliveries(
                deliveries,
                day.dateKey,
              );
              const orderedDayDeliveries = dayDeliveries;
              const isSelected = day.dateKey === selectedDate;
              const isToday = day.dateKey === today;
              const isExpanded = expandedDayKey === day.dateKey;
              const blockOff = blockedDatesByKey.get(day.dateKey);
              const blockOffPresentation = blockOff
                ? getCalendarBlockOffPresentation(blockOff)
                : null;
              const isClosedAllDay = isAllDayCalendarBlockOff(blockOff);
              const isDayFull = isDeliveryDayFullBlockOff(blockOff);
              const visibleDeliveries = isExpanded
                ? orderedDayDeliveries
                : orderedDayDeliveries.slice(0, 3);

              return (
                <div
                  key={day.dateKey}
                  data-delivery-day-lock-date={day.dateKey}
                  data-delivery-calendar-day={
                    isClosedAllDay ? undefined : day.dateKey
                  }
                  onDragOver={(event) => {
                    if (onDayFullDragOver?.(event, day.dateKey)) {
                      return;
                    }
                    if (!isClosedAllDay) {
                      handleDayDragOver(event, day.dateKey);
                    }
                  }}
                  onDrop={(event) => {
                    if (onDayFullDrop?.(event, day.dateKey)) {
                      return;
                    }
                    if (!isClosedAllDay) {
                      handleDayDrop(event, day.dateKey);
                    }
                  }}
                  className={`min-h-36 p-2 transition-colors ${
                    dayFullDropDateKey === day.dateKey
                      ? "bg-slate-100 ring-4 ring-inset ring-slate-950"
                      : blockOff
                      ? "bg-white"
                      : dropDateKey === day.dateKey
                      ? "bg-red-50 ring-2 ring-inset ring-[#FC2C38]"
                      : day.isCurrentMonth
                        ? "bg-white"
                        : "bg-slate-50"
                  } ${
                    isDayFull
                      ? "ring-2 ring-inset ring-slate-950"
                      : isSelected
                        ? "ring-2 ring-inset ring-[#FC2C38]"
                        : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectDay(day.dateKey, day.date, true)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition ${
                        isToday
                          ? "bg-[#FC2C38] text-white"
                          : day.isCurrentMonth
                            ? "text-slate-800 hover:bg-slate-100"
                            : "text-slate-300 hover:bg-white"
                      }`}
                      aria-label={`Open ${formatDateLabel(day.dateKey)}`}
                    >
                      {day.date.getDate()}
                    </button>
                    {isDayFull ? (
                      <DeliveryClosedDayBadge blockOff={blockOff} />
                    ) : null}
                  </div>

                  {isDayFull && onRequestDayLockChange ? (
                    <button
                      type="button"
                      onClick={() => onRequestDayLockChange(day.dateKey)}
                      className="mt-1 rounded-md bg-white px-1.5 py-1 text-[8px] font-black uppercase text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-slate-950 hover:text-white"
                    >
                      Reopen
                    </button>
                  ) : null}

                  {isDayFull ? (
                    <DeliveryDayFullPartialClosureNotice
                      blockOff={blockOff}
                      compact
                      className="mt-1.5"
                    />
                  ) : null}

                  {blockOff && isClosedAllDay && !isDayFull ? (
                    <div
                      className="mt-1 flex min-h-24 flex-col items-center justify-center rounded-lg border px-2 py-2.5 text-center shadow-sm"
                      style={{
                        backgroundColor: blockOffPresentation.backgroundColor,
                        borderColor: blockOffPresentation.backgroundColor,
                        color: blockOffPresentation.textColor,
                      }}
                      title={`${blockOff.reason} · ${getCalendarBlockOffScheduleLabel(blockOff)}`}
                    >
                      <span
                        className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-2xl shadow-sm"
                        aria-hidden="true"
                      >
                        {blockOff.icon || "📅"}
                      </span>
                      <span className="mt-1.5 block w-full text-xs font-black uppercase leading-tight tracking-[0.04em]">
                        <span className="block line-clamp-2">
                          {getCalendarBlockOffScheduleLabel(blockOff)}
                        </span>
                        <span
                          className="mt-1.5 block line-clamp-2 border-t pt-1.5 text-sm normal-case tracking-normal"
                          style={{ borderColor: blockOffPresentation.dividerColor }}
                        >
                          {blockOff.reason}
                        </span>
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-1.5">
                    {visibleDeliveries.map((delivery, deliveryIndex) => {
                      const groupMeta = getDeliveryGroupMeta(
                        visibleDeliveries,
                        deliveryIndex,
                        orderedDayDeliveries,
                      );
                      const beginsNeedsDispatchGroup =
                        deliveryNeedsDispatch(delivery) &&
                        visibleDeliveries
                          .slice(0, deliveryIndex)
                          .some(
                            (previousDelivery) =>
                              !deliveryNeedsDispatch(previousDelivery),
                          );

                      return (
                        <div
                          key={delivery.id}
                          data-delivery-calendar-card="true"
                          data-delivery-id={delivery.id}
                          data-delivery-date={day.dateKey}
                          draggable={canMoveDeliveries}
                          onDragStart={(event) =>
                            handleDeliveryDragStart(event, delivery)
                          }
                          onDragEnd={handleDeliveryDragEnd}
                          onDragOver={(event) =>
                            handleDeliveryDragOver(
                              event,
                              delivery,
                              day.dateKey,
                            )
                          }
                          onDragLeave={handleDeliveryDragLeave}
                          onDrop={(event) =>
                            handleDeliveryDrop(
                              event,
                              delivery,
                              day.dateKey,
                            )
                          }
                          title={
                            canMoveDeliveries
                              ? "Drag this delivery to reorder the day or move it to another date"
                              : undefined
                          }
                          className={`relative ${getConnectedGroupWrapperClass(
                            groupMeta,
                            true,
                          )} ${
                            beginsNeedsDispatchGroup
                              ? "mt-2 border-t border-slate-200 pt-2"
                              : ""
                          } ${
                            canMoveDeliveries
                              ? "cursor-grab active:cursor-grabbing"
                              : ""
                          } ${
                            draggedDeliveryId === delivery.id
                              ? "opacity-40"
                              : ""
                          }`}
                        >
                          {groupMeta?.isFirst ? (
                            <div
                              className={`mb-1 flex items-center justify-between gap-1 px-1 text-[7px] font-black uppercase tracking-[0.08em] ${
                                groupMeta.isScheduledGroup
                                  ? "text-teal-700"
                                  : "text-blue-700"
                              }`}
                            >
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <Layers
                                  className="h-2.5 w-2.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate">
                                  {groupMeta.isScheduledGroup
                                    ? "Scheduled group"
                                    : "Grouped"}
                                </span>
                              </span>
                              <span className="shrink-0">
                                {groupMeta.count}
                              </span>
                            </div>
                          ) : null}
                          {dropDeliveryId === delivery.id &&
                          draggedDeliveryId !== delivery.id ? (
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none absolute inset-x-0 z-10 h-1 rounded-full bg-[#FC2C38] shadow-sm ${
                                dropPlacement === "after"
                                  ? "-bottom-1"
                                  : "-top-1"
                              }`}
                            />
                          ) : null}
                          {canMoveDeliveries ? (
                            <button
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) =>
                                handleDeliveryPointerDown(
                                  event,
                                  delivery,
                                  day.dateKey,
                                )
                              }
                              onPointerMove={handleDeliveryPointerMove}
                              onPointerUp={handleDeliveryPointerEnd}
                              onPointerCancel={handleDeliveryPointerCancel}
                              className={`absolute right-1 z-20 flex h-7 w-7 touch-none items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition hover:text-slate-950 ${
                                groupMeta?.isFirst ? "top-6" : "top-1"
                              }`}
                              aria-label={`Drag order ${delivery.orderNumber || ""} to another calendar position`}
                              title="Drag to move"
                            >
                              <GripVertical
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </button>
                          ) : null}
                          <CalendarDeliveryButton
                            delivery={delivery}
                            onClick={() => onSelectDelivery(delivery)}
                            compact
                            showDragHandle={canMoveDeliveries}
                            groupMeta={groupMeta}
                            isGroupTarget={
                              groupTargetDeliveryId === delivery.id &&
                              draggedDeliveryId !== delivery.id
                            }
                          />
                        </div>
                      );
                    })}
                    {dayDeliveries.length > 3 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDayKey((currentDayKey) =>
                            currentDayKey === day.dateKey ? "" : day.dateKey,
                          )
                        }
                        aria-expanded={isExpanded}
                        className="w-full rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600 transition hover:bg-slate-200"
                      >
                        {isExpanded
                          ? "Show fewer"
                          : `+${dayDeliveries.length - 3} more`}
                      </button>
                    ) : null}
                  </div>

                  {blockOff && !isClosedAllDay ? (
                    <div
                      className="mt-2 flex min-h-24 flex-col items-center justify-center rounded-lg border px-2 py-2.5 text-center shadow-sm"
                      style={{
                        backgroundColor: blockOffPresentation.backgroundColor,
                        borderColor: blockOffPresentation.backgroundColor,
                        color: blockOffPresentation.textColor,
                      }}
                      title={`${blockOff.reason} · ${getCalendarBlockOffScheduleLabel(blockOff)}`}
                    >
                      <span
                        className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-2xl shadow-sm"
                        aria-hidden="true"
                      >
                        {blockOff.icon || "📅"}
                      </span>
                      <span className="mt-1.5 block w-full text-xs font-black uppercase leading-tight tracking-[0.04em]">
                        <span className="block line-clamp-2">
                          {getCalendarBlockOffScheduleLabel(blockOff)}
                        </span>
                        <span
                          className="mt-1.5 block line-clamp-2 border-t pt-1.5 text-sm normal-case tracking-normal"
                          style={{ borderColor: blockOffPresentation.dividerColor }}
                        >
                          {blockOff.reason}
                        </span>
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
      (!candidateDelivery.deliveryCalendarGroupId ||
        delivery.deliveryCalendarGroupId !==
          candidateDelivery.deliveryCalendarGroupId) &&
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
  unscheduledDeliveries,
  selectedDate,
  selectedDeliveryId,
  onSelectDelivery,
  onScheduleDelivery,
}) {
  const timelineScrollRef = useRef(null);
  const timelineHeaderRef = useRef(null);
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const isToday = selectedDate === getTodayDateValue();
  const showCurrentTime =
    isToday &&
    currentMinutes >= timelineStartMinutes &&
    currentMinutes <= timelineEndMinutes;

  useEffect(() => {
    if (!isToday) {
      return undefined;
    }

    function updateCurrentMinutes() {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }

    updateCurrentMinutes();
    const timerId = window.setInterval(updateCurrentMinutes, 60 * 1000);

    return () => window.clearInterval(timerId);
  }, [isToday]);

  useEffect(() => {
    const scrollViewport = timelineScrollRef.current;
    const timelineHeader = timelineHeaderRef.current;

    if (!scrollViewport || !timelineHeader) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!isToday) {
        scrollViewport.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }

      const clampedMinutes = Math.min(
        timelineEndMinutes,
        Math.max(timelineStartMinutes, currentMinutes),
      );
      const currentTimePosition =
        timelineHeader.offsetLeft +
        timelineHeader.offsetWidth * (getTimelinePercent(clampedMinutes) / 100);
      const centeredPosition =
        currentTimePosition - scrollViewport.clientWidth / 2;
      const maximumScroll = Math.max(
        0,
        scrollViewport.scrollWidth - scrollViewport.clientWidth,
      );

      scrollViewport.scrollTo({
        left: Math.min(maximumScroll, Math.max(0, centeredPosition)),
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [currentMinutes, driverNames.length, isToday, selectedDate]);

  function handleTimelineDrop(event, driverName) {
    event.preventDefault();
    const deliveryId = event.dataTransfer.getData("text/plain");
    const delivery = unscheduledDeliveries.find(
      (candidate) => candidate.id === deliveryId,
    );

    if (!delivery) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerRatio = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width),
    );
    const droppedMinutes =
      timelineStartMinutes +
      pointerRatio * (timelineEndMinutes - timelineStartMinutes);

    onScheduleDelivery?.(
      delivery,
      minutesToTimeValue(droppedMinutes),
      driverName,
    );
  }

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

      <div className="min-w-0">
      <div ref={timelineScrollRef} className="overflow-x-auto pb-1">
        <div className="min-w-[1240px]">
          <div className="grid grid-cols-[180px_minmax(1080px,1fr)] gap-3">
            <div />
            <div
              ref={timelineHeaderRef}
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
              {showCurrentTime ? (
                <div
                  className="absolute inset-y-1 z-10 rounded-full border-l-2 border-blue-600"
                  style={{ left: `${getTimelinePercent(currentMinutes)}%` }}
                >
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-sm">
                    Now
                  </span>
                </div>
              ) : null}
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
                  onDragOver={(event) => {
                    if (unscheduledDeliveries.length) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(event) => handleTimelineDrop(event, driverName)}
                  className="relative h-[104px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 transition"
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

                  {showCurrentTime ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 z-10 border-l-2 border-blue-600/80"
                      style={{ left: `${getTimelinePercent(currentMinutes)}%` }}
                    />
                  ) : null}

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
                            : "border-emerald-200 bg-emerald-50/70 hover:border-emerald-400 hover:bg-emerald-100/70"
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
                          className={`flex min-w-0 items-center gap-1 font-black text-slate-950 ${
                            isShortBlock
                              ? "mt-0.5 text-xs md:mt-1 md:text-sm"
                              : "mt-1 text-sm"
                          }`}
                        >
                          <span className="min-w-0 truncate">
                            {formatCustomerName(delivery.customerName) ||
                              "Unnamed customer"}
                          </span>
                          <DeliveryNotesBadge delivery={delivery} />
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
      </div>
    </section>
  );
}

function CompactDeliveryCard({
  delivery,
  deliveries,
  deliveryDates,
  blockedDatesByKey,
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
        <DeliveryNotesPanel delivery={delivery} className="mx-4 mt-4" />
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
                  blockedDatesByKey={blockedDatesByKey}
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
                    const calendarRestriction =
                      getCalendarBlockOffSchedulingError(
                        candidateDelivery,
                        blockedDatesByKey.get(
                          getDeliveryDateKey(candidateDelivery.deliveryDate),
                        ),
                      );
                    const conflict = findScheduleConflict(
                      candidateDelivery,
                      deliveries,
                    );

                    return (
                      <option
                        key={timeSlot.value}
                        value={timeSlot.value}
                        disabled={Boolean(conflict || calendarRestriction)}
                      >
                        {calendarRestriction
                          ? `${timeSlot.label} - outside open hours`
                          : conflict
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
          <DeliveryNotesPanel delivery={delivery} />
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
                    blockedDatesByKey={blockedDatesByKey}
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
                      const calendarRestriction =
                        getCalendarBlockOffSchedulingError(
                          candidateDelivery,
                          blockedDatesByKey.get(
                            getDeliveryDateKey(candidateDelivery.deliveryDate),
                          ),
                        );
                      const conflict = findScheduleConflict(
                        candidateDelivery,
                        deliveries,
                      );

                      return (
                        <option
                          key={timeSlot.value}
                          value={timeSlot.value}
                          disabled={Boolean(conflict || calendarRestriction)}
                        >
                          {calendarRestriction
                            ? `${timeSlot.label} - outside open hours`
                            : conflict
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
  calendarBlockOffs = /** @type {Array<{ id: string, date: string, reason: string, icon?: string, backgroundColor?: string, mode?: "allDay" | "limitedHours", openStart?: string, openEnd?: string }>} */ ([]),
  vehicleOptions = /** @type {Array<{ id: string, title: string, badge: string }>} */ ([]),
  employeeOptions = /** @type {string[]} */ ([]),
  canEditDeliveries = false,
  isEditAccessUnlocked = false,
  onRequestEditAccess,
  onLockEditAccess,
  canViewDispatchNotes = false,
  onEditDelivery,
  onViewOrder,
  onEditOrder,
  onUpdateDelivery,
  canManageDayLocks = false,
  dayLockCodeRequired = true,
  onUpdateCalendarBlockOffs,
  onPageChange,
}) {
  const [dispatchNotes, setDispatchNotes] = useState([]);
  const baseDeliveries = useMemo(
    () =>
      Array.isArray(deliveries)
        ? deliveries.filter(
            (delivery) => delivery && typeof delivery === "object",
          )
        : [],
    [deliveries],
  );
  useEffect(() => {
    if (!canViewDispatchNotes) {
      setDispatchNotes([]);
      return undefined;
    }

    return subscribeToDispatchNotes(
      (savedNotes) => setDispatchNotes(savedNotes),
      (dispatchNotesError) => {
        console.error(
          "Unable to load delivery calendar dispatch notes:",
          dispatchNotesError,
        );
        setDispatchNotes([]);
      },
    );
  }, [canViewDispatchNotes]);
  const dispatchNotesByDeliveryId = useMemo(
    () =>
      dispatchNotes.reduce((notesByDeliveryId, note) => {
        if (
          note?.targetType !== "delivery" ||
          note?.status === "complete" ||
          !note?.targetId
        ) {
          return notesByDeliveryId;
        }

        notesByDeliveryId[note.targetId] = [
          ...(notesByDeliveryId[note.targetId] || []),
          note,
        ];
        return notesByDeliveryId;
      }, {}),
    [dispatchNotes],
  );
  const safeDeliveries = useMemo(
    () =>
      baseDeliveries.map((delivery) => {
        const matchingDispatchNotes =
          dispatchNotesByDeliveryId[delivery.id] || [];

        return matchingDispatchNotes.length
          ? {
              ...delivery,
              calendarDispatchNotes: matchingDispatchNotes,
            }
          : delivery;
      }),
    [baseDeliveries, dispatchNotesByDeliveryId],
  );
  const blockedDatesByKey = useMemo(
    () => getCalendarBlockOffMap(calendarBlockOffs),
    [calendarBlockOffs],
  );
  const [selectedDate, setSelectedDate] = useState(getTodayDateValue());
  const [calendarView, setCalendarView] = useState("month");
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
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState("");
  const [ungroupingGroupId, setUngroupingGroupId] = useState("");
  const [error, setError] = useState("");
  const [deliveryToUnassign, setDeliveryToUnassign] = useState(null);
  const [unassigningDeliveryId, setUnassigningDeliveryId] = useState("");
  const [unassignError, setUnassignError] = useState("");
  const [deliveryToMarkDelivered, setDeliveryToMarkDelivered] = useState(null);
  const [markingDeliveredId, setMarkingDeliveredId] = useState("");
  const [isUpdatingDayLock, setIsUpdatingDayLock] = useState(false);
  const [isDayFullTileDragging, setIsDayFullTileDragging] = useState(false);
  const [dayFullDropDateKey, setDayFullDropDateKey] = useState("");
  const [pendingDayLockChange, setPendingDayLockChange] = useState(null);
  const dayFullPointerDragRef = useRef(null);
  const canMoveCalendarDeliveries =
    canEditDeliveries && Boolean(onUpdateDelivery);
  const calendarDeliveryDrag = useCalendarDeliveryDrag({
    deliveries: safeDeliveries,
    canMoveDeliveries: canMoveCalendarDeliveries,
    onMoveDelivery: handleMoveDelivery,
  });
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
  const dateTbdDeliveries = useMemo(
    () =>
      safeDeliveries
        .filter(
          (delivery) =>
            !isDeliveryComplete(delivery) &&
            !getDeliveryDateKey(delivery.deliveryDate),
        )
        .sort((first, second) =>
          String(first.orderNumber || "").localeCompare(
            String(second.orderNumber || ""),
            undefined,
            { numeric: true },
          ),
        ),
    [safeDeliveries],
  );
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
        const scheduledCount = dayDeliveries.filter(
          (delivery) => !deliveryNeedsDispatch(delivery),
        ).length;

        return {
          ...day,
          blockOff: blockedDatesByKey.get(day.dateKey) || null,
          deliveryCount: dayDeliveries.length,
          needsDispatchCount,
          scheduledCount,
        };
      }),
    [blockedDatesByKey, safeDeliveries],
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
  const needsTimeDeliveries = useMemo(
    () =>
      dayDeliveries.filter(
        (delivery) =>
          !deliveryNeedsDispatch(delivery) && deliveryNeedsTime(delivery),
      ),
    [dayDeliveries],
  );
  const scheduledDeliveries = useMemo(
    () =>
      dayDeliveries.filter(
        (delivery) => !deliveryNeedsDispatch(delivery),
      ),
    [dayDeliveries],
  );
  const timedScheduledDeliveries = useMemo(
    () => scheduledDeliveries.filter((delivery) => !deliveryNeedsTime(delivery)),
    [scheduledDeliveries],
  );
  const deliveriesByDriver = useMemo(
    () => {
      const groups = groupDeliveriesByDriver(timedScheduledDeliveries);

      employeeOptions.forEach((driver) => {
        const normalizedDriver = String(driver || "").trim();

        if (normalizedDriver) {
          groups[normalizedDriver] = groups[normalizedDriver] || [];
        }
      });

      needsTimeDeliveries.forEach((delivery) => {
        getDeliveryDrivers(delivery).forEach((driver) => {
          groups[driver] = groups[driver] || [];
        });
      });

      return groups;
    },
    [employeeOptions, needsTimeDeliveries, timedScheduledDeliveries],
  );
  const driverNames = Object.keys(deliveriesByDriver).sort((first, second) =>
    first.localeCompare(second),
  );
  const scheduledDriverNames = driverNames.filter(
    (driverName) => deliveriesByDriver[driverName].length > 0,
  );
  const assignedDriverNames = [
    ...new Set(dayDeliveries.flatMap(getDeliveryDrivers)),
  ].sort((first, second) => first.localeCompare(second));
  const timelineDriverNames =
    statusFilter === "scheduled"
      ? scheduledDriverNames
      : assignedDriverNames;
  const visibleScheduledDriverNames = scheduledDriverNames;
  const timelineDeliveriesByDriver = deliveriesByDriver;
  const selectedTimelineDeliveryFromData =
    safeDeliveries.find(
      (delivery) => delivery.id === selectedTimelineDeliveryId,
    ) || null;
  const selectedTimelineDelivery =
    selectedTimelineDeliveryFromData ||
    (selectedTimelineDeliverySnapshot?.id === selectedTimelineDeliveryId
      ? selectedTimelineDeliverySnapshot
      : null);
  const selectedDeliveryGroup = selectedTimelineDelivery?.deliveryCalendarGroupId
    ? safeDeliveries.filter(
        (delivery) =>
          delivery.deliveryCalendarGroupId ===
          selectedTimelineDelivery.deliveryCalendarGroupId,
      )
    : [];
  const selectedDateBlockOff = blockedDatesByKey.get(selectedDate) || null;
  const selectedDateBlockOffPresentation = selectedDateBlockOff
    ? getCalendarBlockOffPresentation(selectedDateBlockOff)
    : null;
  const isSelectedDateFull = isDeliveryDayFullBlockOff(
    selectedDateBlockOff,
  );
  const selectedDatePartialClosure = isSelectedDateFull
    ? getDeliveryDayFullRestoreBlockOff(selectedDateBlockOff)
    : null;

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
    setIsDeliveryModalOpen(false);
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTimelineDeliveryFromData) {
      setSelectedTimelineDeliverySnapshot(selectedTimelineDeliveryFromData);
    }
  }, [selectedTimelineDeliveryFromData]);

  useEffect(() => {
    if (!isDeliveryModalOpen || !selectedTimelineDeliveryId) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleModalEscape(event) {
      if (event.key === "Escape") {
        setSelectedTimelineDeliveryId("");
        setSelectedTimelineDeliverySnapshot(null);
        setIsDeliveryModalOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleModalEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleModalEscape);
    };
  }, [isDeliveryModalOpen, selectedTimelineDeliveryId]);

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

  function selectDay(dateKey, date = null, openDayView = false) {
    setSelectedDate(dateKey);
    setHasSelectedDay(true);
    setStatusFilter("all");
    setSelectedTimelineDeliveryId("");
    setSelectedTimelineDeliverySnapshot(null);
    setIsDeliveryModalOpen(false);

    const selectedDay = date || new Date(`${dateKey}T12:00:00`);

    if (!Number.isNaN(selectedDay.getTime())) {
      setCalendarMonth(
        new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1),
      );
    }

    if (openDayView) {
      setCalendarView("day");
    }
  }

  function navigateSelectedDate(dayOffset) {
    const currentDate = new Date(`${selectedDate}T12:00:00`);

    if (Number.isNaN(currentDate.getTime())) {
      return;
    }

    currentDate.setDate(currentDate.getDate() + dayOffset);
    selectDay(getLocalDateKey(currentDate), currentDate);
  }

  function openDeliveryFromCalendar(delivery) {
    const deliveryDateKey = getDeliveryDateKey(delivery?.deliveryDate);

    if (!delivery?.id) {
      return;
    }

    if (!deliveryDateKey || calendarView !== "day") {
      setSelectedTimelineDeliveryId(delivery.id);
      setSelectedTimelineDeliverySnapshot(delivery);
      setIsDeliveryModalOpen(true);
      return;
    }

    setIsDeliveryModalOpen(false);
    const deliveryDate = new Date(`${deliveryDateKey}T12:00:00`);
    setCalendarView("day");
    selectDay(deliveryDateKey, deliveryDate);

    window.setTimeout(() => {
      setSelectedTimelineDeliveryId(delivery.id);
      setSelectedTimelineDeliverySnapshot(delivery);

      window.setTimeout(() => {
        selectedDeliveryDetailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    }, 0);
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
      return false;
    }

    const candidateDelivery = {
      ...delivery,
      ...updates,
    };
    const scheduleDateOrTimeChanged = [
      "deliveryDate",
      "deliveryTimeSlot",
    ].some((fieldName) =>
      Object.prototype.hasOwnProperty.call(updates, fieldName),
    );
    const candidateDate = getDeliveryDateKey(candidateDelivery.deliveryDate);
    const candidateDateBlockOff = candidateDate
      ? blockedDatesByKey.get(candidateDate)
      : null;
    const blockOffSchedulingError = scheduleDateOrTimeChanged
      ? getCalendarBlockOffSchedulingError(
          candidateDelivery,
          candidateDateBlockOff,
        )
      : "";

    if (blockOffSchedulingError) {
      setError(`${formatDateLabel(candidateDate)} · ${blockOffSchedulingError}`);
      return false;
    }

    const scheduleChanged = [
      "deliveryDate",
      "deliveryTimeSlot",
      "driver",
      "drivers",
      "vehicleId",
      "vehicleTitle",
      "vehicleBadge",
      "vehicles",
      "dispatchAssignments",
    ].some((fieldName) =>
      Object.prototype.hasOwnProperty.call(updates, fieldName),
    );
    const conflict = scheduleChanged
      ? findScheduleConflict(candidateDelivery, safeDeliveries)
      : null;

    if (conflict) {
      setError(
        `${getDeliveryDrivers(delivery).join(", ")} is already scheduled on order ${
          conflict.orderNumber
          } until ${getDeliveryBackAroundLabel(conflict)}.`,
      );
      return false;
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
      return true;
    } catch (updateError) {
      console.error("Unable to move delivery:", updateError);
      if (previousSelectedDelivery) {
        setSelectedTimelineDeliverySnapshot(previousSelectedDelivery);
      }
      setError("Unable to move that delivery. Try again.");
      return false;
    } finally {
      setUpdatingDeliveryId("");
    }
  }

  async function handleMoveGroupedDelivery(delivery, updates) {
    const sharedFieldNames = [
      "deliveryDate",
      "deliveryTimeSlot",
      "driver",
      "drivers",
      "vehicleId",
      "vehicleTitle",
      "vehicleBadge",
      "vehicles",
      "dispatchAssignments",
      "dispatchStatus",
    ];
    const hasSharedUpdate = sharedFieldNames.some((fieldName) =>
      Object.prototype.hasOwnProperty.call(updates, fieldName),
    );
    const groupId = delivery?.deliveryCalendarGroupId;

    if (!groupId || !hasSharedUpdate) {
      return handleMoveDelivery(delivery, updates);
    }

    const groupDeliveries = safeDeliveries.filter(
      (candidate) => candidate.deliveryCalendarGroupId === groupId,
    );
    const sharedUpdates = sharedFieldNames.reduce((nextUpdates, fieldName) => {
      if (Object.prototype.hasOwnProperty.call(updates, fieldName)) {
        nextUpdates[fieldName] = updates[fieldName];
      }

      return nextUpdates;
    }, {});

    for (const groupDelivery of groupDeliveries) {
      const moved = await handleMoveDelivery(groupDelivery, {
        ...(groupDelivery.id === delivery.id ? updates : {}),
        ...sharedUpdates,
      });

      if (moved === false) {
        return false;
      }
    }

    return true;
  }

  async function handleUngroupDeliveryStop(delivery) {
    const groupId = String(delivery?.deliveryCalendarGroupId || "").trim();

    if (!groupId || !onUpdateDelivery) {
      return;
    }

    const groupDeliveries = safeDeliveries.filter(
      (candidate) => candidate.deliveryCalendarGroupId === groupId,
    );

    if (groupDeliveries.length < 2) {
      return;
    }

    setError("");
    setUngroupingGroupId(groupId);

    try {
      for (const groupDelivery of groupDeliveries) {
        await onUpdateDelivery(groupDelivery.id, {
          deliveryCalendarGroupId: "",
          updatedAt: new Date().toISOString(),
        });
      }

      setSelectedTimelineDeliverySnapshot((currentDelivery) =>
        currentDelivery?.deliveryCalendarGroupId === groupId
          ? {
              ...currentDelivery,
              deliveryCalendarGroupId: "",
            }
          : currentDelivery,
      );
    } catch (ungroupError) {
      console.error("Unable to ungroup delivery stop:", ungroupError);
      setError("Unable to ungroup this stop. Try again.");
    } finally {
      setUngroupingGroupId("");
    }
  }

  async function handleScheduleDelivery(delivery, deliveryTimeSlot, driverName = "") {
    const normalizedDriver = String(driverName || "").trim();
    const updates = { deliveryTimeSlot };

    if (normalizedDriver) {
      const existingAssignment = Array.isArray(delivery.dispatchAssignments)
        ? delivery.dispatchAssignments[0]
        : null;
      const vehicleId =
        existingAssignment?.vehicleId || delivery.vehicleId || "";
      const vehicleTitle =
        existingAssignment?.vehicleTitle || delivery.vehicleTitle || "";
      const vehicleBadge =
        existingAssignment?.vehicleBadge || delivery.vehicleBadge || "";

      updates.driver = normalizedDriver;
      updates.drivers = [normalizedDriver];

      if (vehicleId || vehicleTitle || vehicleBadge) {
        updates.dispatchAssignments = [
          {
            id: existingAssignment?.id || "truck-1",
            driver: normalizedDriver,
            vehicleId,
            vehicleTitle,
            vehicleBadge,
          },
        ];
        updates.dispatchStatus = "assigned";
      } else {
        updates.dispatchStatus = "needsDispatch";
      }
    }

    await handleMoveGroupedDelivery(delivery, updates);
  }

  async function handleConfirmUnassign() {
    const deliveryId = String(deliveryToUnassign?.id || "");

    if (!deliveryId || !onUpdateDelivery) {
      return;
    }

    setUnassigningDeliveryId(deliveryId);
    setUnassignError("");

    try {
      const groupedDeliveries = deliveryToUnassign.deliveryCalendarGroupId
        ? safeDeliveries.filter(
            (delivery) =>
              delivery.deliveryCalendarGroupId ===
              deliveryToUnassign.deliveryCalendarGroupId,
          )
        : [deliveryToUnassign];

      for (const groupedDelivery of groupedDeliveries) {
        await onUpdateDelivery(groupedDelivery.id, {
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
      }
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

  function requestDayLockChange(dateKey, action = "toggle") {
    if (!canManageDayLocks || !onUpdateCalendarBlockOffs || !dateKey) {
      return;
    }

    const dateBlockOff = blockedDatesByKey.get(dateKey) || null;
    const isDateFull = isDeliveryDayFullBlockOff(dateBlockOff);
    const isPartialClosure =
      Boolean(dateBlockOff) &&
      !isDateFull &&
      !isAllDayCalendarBlockOff(dateBlockOff);

    if (dateBlockOff && !isDateFull && !isPartialClosure) {
      setError(
        `${formatDateLabel(dateKey)} already has a closure managed in Admin.`,
      );
      return;
    }

    if (action === "lock" && isDateFull) {
      setError(`${formatDateLabel(dateKey)} is already marked full.`);
      return;
    }

    setError("");

    if (!dayLockCodeRequired) {
      void applyDayLockChange(dateKey);
      return;
    }

    setPendingDayLockChange({
      dateKey,
      isReopening: isDateFull,
      hasPartialClosure: isPartialClosure,
    });
  }

  async function applyDayLockChange(dateKey) {
    if (!canManageDayLocks || !onUpdateCalendarBlockOffs || !dateKey) {
      return;
    }

    const dateBlockOff = blockedDatesByKey.get(dateKey) || null;
    const isDateFull = isDeliveryDayFullBlockOff(dateBlockOff);

    if (
      dateBlockOff &&
      !isDateFull &&
      isAllDayCalendarBlockOff(dateBlockOff)
    ) {
      setError(
        `${formatDateLabel(dateKey)} already has a closure managed in Admin.`,
      );
      return;
    }

    const restoredBlockOff = isDateFull
      ? getDeliveryDayFullRestoreBlockOff(dateBlockOff)
      : null;

    const nextBlockOffs = (Array.isArray(calendarBlockOffs)
      ? calendarBlockOffs
      : []
    ).filter((blockOff) => String(blockOff?.date || "") !== dateKey);

    if (isDateFull) {
      if (restoredBlockOff) {
        nextBlockOffs.push(restoredBlockOff);
      }
    } else {
      nextBlockOffs.push(
        createDeliveryDayFullBlockOff(dateKey, dateBlockOff),
      );
    }

    setIsUpdatingDayLock(true);
    setError("");

    try {
      await onUpdateCalendarBlockOffs(nextBlockOffs);
    } catch (dayLockError) {
      console.error("Unable to update the delivery day lock:", dayLockError);
      setError(
        "Unable to update that day. Check your connection and try again.",
      );
    } finally {
      setIsUpdatingDayLock(false);
    }
  }

  function resetDayFullDrag() {
    dayFullPointerDragRef.current = null;
    setIsDayFullTileDragging(false);
    setDayFullDropDateKey("");
  }

  function handleDayFullDragStart(event) {
    if (!canManageDayLocks || isUpdatingDayLock) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(calendarDayFullDragType, "day-full");
    event.dataTransfer.setData("text/plain", "delivery-day-full");
    setIsDayFullTileDragging(true);
  }

  function handleDayFullDragOver(event, dateKey) {
    const isDayFullDrag =
      isDayFullTileDragging ||
      Array.from(event.dataTransfer?.types || []).includes(
        calendarDayFullDragType,
      );

    if (!isDayFullDrag) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDayFullDropDateKey(dateKey);
    return true;
  }

  function handleDayFullDrop(event, dateKey) {
    if (!handleDayFullDragOver(event, dateKey)) {
      return false;
    }

    resetDayFullDrag();
    requestDayLockChange(dateKey, "lock");
    return true;
  }

  function getDayFullPointerDate(event) {
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.("[data-delivery-day-lock-date]");

    return target?.dataset?.deliveryDayLockDate || "";
  }

  function handleDayFullPointerDown(event) {
    if (
      event.pointerType === "mouse" ||
      !canManageDayLocks ||
      isUpdatingDayLock ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dayFullPointerDragRef.current = { pointerId: event.pointerId };
    setIsDayFullTileDragging(true);
  }

  function handleDayFullPointerMove(event) {
    if (
      event.pointerType === "mouse" ||
      dayFullPointerDragRef.current?.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    setDayFullDropDateKey(getDayFullPointerDate(event));
  }

  function handleDayFullPointerEnd(event) {
    if (
      event.pointerType === "mouse" ||
      dayFullPointerDragRef.current?.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    const dateKey = getDayFullPointerDate(event);
    resetDayFullDrag();

    if (dateKey) {
      requestDayLockChange(dateKey, "lock");
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {onRequestEditAccess ? (
            <button
              type="button"
              onClick={
                isEditAccessUnlocked ? onLockEditAccess : onRequestEditAccess
              }
              className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black shadow-sm transition focus:outline-none focus:ring-4 ${
                isEditAccessUnlocked
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus:ring-emerald-100"
                  : "border-red-200 bg-white text-[#FC2C38] hover:border-red-300 hover:bg-red-50 focus:ring-red-100"
              }`}
            >
              {isEditAccessUnlocked ? (
                <LockOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              )}
              {isEditAccessUnlocked ? "Lock changes" : "Unlock changes"}
            </button>
          ) : null}

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
                  const blockOff = blockedDatesByKey.get(day.dateKey);
                  const blockOffPresentation = blockOff
                    ? getCalendarBlockOffPresentation(blockOff)
                    : null;

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => {
                        selectDay(day.dateKey, day.date);
                        setIsDatePickerOpen(false);
                      }}
                      style={
                        blockOffPresentation && !isSelected
                          ? {
                              backgroundColor:
                                blockOffPresentation.backgroundColor,
                              color: blockOffPresentation.textColor,
                            }
                          : undefined
                      }
                      title={
                        [
                          blockOff
                            ? `${blockOff.icon || "📅"} ${blockOff.reason} · ${getCalendarBlockOffScheduleLabel(blockOff)}`
                            : "",
                          deliveryCount > 0
                            ? `${deliveryCount} ${
                              deliveryCount === 1 ? "delivery" : "deliveries"
                              }`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      className={`relative flex h-12 items-center justify-center rounded-xl text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-red-300 ${
                        isSelected
                          ? "bg-[#FC2C38] text-white shadow-sm"
                          : blockOff
                            ? "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-200"
                          : day.isCurrentMonth
                            ? "text-slate-800 hover:bg-slate-100"
                            : "text-slate-300 hover:bg-slate-50"
                      } ${isToday && !isSelected ? "ring-1 ring-red-300" : ""}`}
                    >
                      {day.date.getDate()}
                      {blockOff ? (
                        <span
                          className="absolute bottom-0.5 text-[10px] leading-none"
                          aria-hidden="true"
                        >
                          {blockOff.icon || "📅"}
                        </span>
                      ) : null}
                      {deliveryCount > 0 ? (
                        <span
                          className={`absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${
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
      </div>

      <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="px-2 py-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Calendar view
          </p>
          <p className="mt-0.5 text-sm font-black text-slate-900">
            {calendarView === "day"
              ? formatDateLabel(selectedDate)
              : calendarView === "week"
                ? getWeekRangeLabel(selectedDate)
                : getCalendarMonthLabel(calendarMonth)}
          </p>
        </div>

        <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
          {[
            { id: "day", label: "Day" },
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
          ].map((viewOption) => (
            <button
              key={viewOption.id}
              type="button"
              onClick={() => {
                setCalendarView(viewOption.id);
                setSelectedTimelineDeliveryId("");
                setSelectedTimelineDeliverySnapshot(null);
                setIsDeliveryModalOpen(false);
              }}
              className={`rounded-lg px-5 py-2.5 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
                calendarView === viewOption.id
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-950"
              }`}
            >
              {viewOption.label}
            </button>
          ))}
        </div>
      </section>

      {selectedDateBlockOff &&
      isAllDayCalendarBlockOff(selectedDateBlockOff) &&
      !isSelectedDateFull ? (
        <section
          className="mb-6 rounded-2xl border px-4 py-6 text-center shadow-sm sm:px-5"
          style={{
            backgroundColor: selectedDateBlockOffPresentation.backgroundColor,
            borderColor: selectedDateBlockOffPresentation.backgroundColor,
            color: selectedDateBlockOffPresentation.textColor,
          }}
        >
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm">
            <span className="text-5xl" aria-hidden="true">
              {selectedDateBlockOff.icon || "📅"}
            </span>
          </span>
          <div className="mx-auto mt-3 max-w-3xl">
            <p className="text-lg font-black uppercase tracking-[0.08em]">
              {getCalendarBlockOffScheduleLabel(selectedDateBlockOff)}
            </p>
            <p
              className="mt-2 border-t pt-2 text-xl font-black sm:text-2xl"
              style={{
                borderColor: selectedDateBlockOffPresentation.dividerColor,
              }}
            >
              {formatDateLabel(selectedDate)} · {selectedDateBlockOff.reason}
            </p>
            <p
              className="mt-2 text-xs font-semibold"
              style={{
                color: selectedDateBlockOffPresentation.mutedTextColor,
              }}
            >
              {isAllDayCalendarBlockOff(selectedDateBlockOff)
                ? "Existing deliveries remain visible, but new deliveries cannot be moved or scheduled onto this date."
                : "Deliveries may be scheduled only when their full time block fits inside these open hours."}
            </p>
          </div>
        </section>
      ) : null}

      {selectedDatePartialClosure ? (
        <DeliveryDayFullPartialClosureNotice
          blockOff={selectedDateBlockOff}
          className="mb-6"
        />
      ) : null}

      {calendarView === "day" ? (
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
              const blockOffPresentation = day.blockOff
                ? getCalendarBlockOffPresentation(day.blockOff)
                : null;
              const isDayFull = isDeliveryDayFullBlockOff(day.blockOff);

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => selectDay(day.dateKey, day.date)}
                  style={
                    blockOffPresentation && !isDayFull
                      ? {
                          backgroundColor: blockOffPresentation.backgroundColor,
                          borderColor: blockOffPresentation.backgroundColor,
                          color: blockOffPresentation.textColor,
                        }
                      : undefined
                  }
                  className={`rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
                    isDayFull
                      ? "border-2 border-slate-950 bg-white shadow-sm"
                      : day.blockOff
                      ? "hover:brightness-95"
                    : isSelected
                      ? "border-[#FC2C38] bg-red-50 shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:border-red-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p
                        className={`text-xs font-black uppercase tracking-[0.12em] ${
                          day.blockOff && !isDayFull
                            ? ""
                            : isSelected
                              ? "text-[#FC2C38]"
                              : "text-slate-500"
                        }`}
                        style={
                          blockOffPresentation && !isDayFull
                            ? { color: blockOffPresentation.mutedTextColor }
                            : undefined
                        }
                      >
                        {day.isToday ? "Today" : weekdayLabel}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <p
                          className={`text-lg font-black ${day.blockOff && !isDayFull ? "" : "text-slate-950"}`}
                          style={
                            blockOffPresentation && !isDayFull
                              ? { color: blockOffPresentation.textColor }
                              : undefined
                          }
                        >
                          {dateLabel}
                        </p>
                        {isDayFull ? (
                          <DeliveryClosedDayBadge blockOff={day.blockOff} />
                        ) : null}
                      </div>
                    </div>
                    <span
                      style={
                        blockOffPresentation && !isDayFull
                          ? {
                              color:
                                day.deliveryCount > 0
                                  ? blockOffPresentation.backgroundColor
                                  : blockOffPresentation.textColor,
                            }
                          : undefined
                      }
                      className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs font-black ${
                        day.deliveryCount > 0
                          ? day.blockOff && !isDayFull
                            ? "bg-white"
                            : "bg-slate-950 text-white"
                          : day.blockOff && !isDayFull
                            ? "bg-white/15 text-white"
                            : "bg-white text-slate-400"
                      }`}
                    >
                      {day.deliveryCount}
                    </span>
                  </div>

                  {isDayFull ? (
                    <DeliveryDayFullPartialClosureNotice
                      blockOff={day.blockOff}
                      compact
                      className="mt-3"
                    />
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-black uppercase tracking-[0.07em]">
                    {isDayFull ? null : day.blockOff ? (
                      <span
                        className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border px-3 py-3 text-center"
                        style={{
                          backgroundColor: blockOffPresentation.insetColor,
                          borderColor: blockOffPresentation.dividerColor,
                          color: blockOffPresentation.textColor,
                        }}
                        title={`${day.blockOff.reason} · ${getCalendarBlockOffScheduleLabel(day.blockOff)}`}
                      >
                        <span
                          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm"
                          aria-hidden="true"
                        >
                          {day.blockOff.icon || "📅"}
                        </span>
                        <span className="mt-2 text-base">
                          {getCalendarBlockOffScheduleLabel(day.blockOff)}
                        </span>
                        <span
                          className="mt-2 w-full border-t pt-2 text-lg normal-case tracking-normal"
                          style={{
                            borderColor: blockOffPresentation.dividerColor,
                          }}
                        >
                          {day.blockOff.reason}
                        </span>
                      </span>
                    ) : null}
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
      ) : null}

      {calendarView === "week" || calendarView === "month" ? (
        <div
          className={`mb-6 grid gap-3 ${
            canManageDayLocks && onUpdateCalendarBlockOffs
              ? "lg:grid-cols-[15rem_minmax(0,1fr)]"
              : ""
          }`}
        >
          {canManageDayLocks && onUpdateCalendarBlockOffs ? (
            <DayFullDragTile
              disabled={isUpdatingDayLock}
              isDragging={isDayFullTileDragging}
              requiresCode={dayLockCodeRequired}
              onDragStart={handleDayFullDragStart}
              onDragEnd={resetDayFullDrag}
              onPointerDown={handleDayFullPointerDown}
              onPointerMove={handleDayFullPointerMove}
              onPointerEnd={handleDayFullPointerEnd}
              onPointerCancel={resetDayFullDrag}
            />
          ) : null}
          <DeliveryDateTbdTray
            deliveries={dateTbdDeliveries}
            onSelectDelivery={openDeliveryFromCalendar}
            canMoveDeliveries={canMoveCalendarDeliveries}
            deliveryDrag={calendarDeliveryDrag}
            embedded
          />
        </div>
      ) : null}

      {calendarView === "week" ? (
        <DeliveryWeekView
          deliveries={safeDeliveries}
          blockedDatesByKey={blockedDatesByKey}
          selectedDate={selectedDate}
          onNavigate={navigateSelectedDate}
          onSelectDay={selectDay}
          onSelectDelivery={openDeliveryFromCalendar}
          canMoveDeliveries={canMoveCalendarDeliveries}
          deliveryDrag={calendarDeliveryDrag}
          dayFullDropDateKey={dayFullDropDateKey}
          onDayFullDragOver={handleDayFullDragOver}
          onDayFullDrop={handleDayFullDrop}
          onRequestDayLockChange={
            canManageDayLocks ? requestDayLockChange : undefined
          }
        />
      ) : calendarView === "month" ? (
        <DeliveryMonthView
          deliveries={safeDeliveries}
          blockedDatesByKey={blockedDatesByKey}
          monthDate={calendarMonth}
          selectedDate={selectedDate}
          onChangeMonth={changeCalendarMonth}
          onSelectDay={selectDay}
          onSelectDelivery={openDeliveryFromCalendar}
          canMoveDeliveries={canMoveCalendarDeliveries}
          deliveryDrag={calendarDeliveryDrag}
          dayFullDropDateKey={dayFullDropDateKey}
          onDayFullDragOver={handleDayFullDragOver}
          onDayFullDrop={handleDayFullDrop}
          onRequestDayLockChange={
            canManageDayLocks ? requestDayLockChange : undefined
          }
        />
      ) : hasSelectedDay ? (
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
                          ? "bg-emerald-100 text-emerald-900 shadow-sm"
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

      {calendarView !== "day" || !hasSelectedDay ? null : dayDeliveries.length === 0 ? (
        <EmptyState
          title="No deliveries on this date"
          description="Deliveries that need dispatch and scheduled deliveries will both appear here."
        />
      ) : (
        selectedTimelineDelivery && !isDeliveryModalOpen ? (
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
              blockedDatesByKey={blockedDatesByKey}
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
              onUpdateDelivery={handleMoveGroupedDelivery}
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

            {statusFilter !== "needsDispatch" && scheduledDeliveries.length > 0 ? (
              <div id="delivery-calendar-day-board" className="scroll-mt-5">
                <DeliveryTimelineBoard
                  driverNames={timelineDriverNames}
                  deliveriesByDriver={timelineDeliveriesByDriver}
                  unscheduledDeliveries={
                    needsTimeDeliveries
                  }
                  selectedDate={selectedDate}
                  selectedDeliveryId=""
                  onSelectDelivery={selectTimelineDelivery}
                  onScheduleDelivery={handleScheduleDelivery}
                />

                <div className="hidden gap-4 lg:grid lg:grid-cols-3 2xl:grid-cols-4 xl:hidden">
                  {visibleScheduledDriverNames.map((driverName) => (
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
                            blockedDatesByKey={blockedDatesByKey}
                            expanded={false}
                            canEditDeliveries={canEditDeliveries}
                            onEditDelivery={onEditDelivery}
                            onViewOrder={onViewOrder}
                            onEditOrder={onEditOrder}
                            onRequestUnassign={(delivery) => {
                              setUnassignError("");
                              setDeliveryToUnassign(delivery);
                            }}
                            onUpdateDelivery={handleMoveGroupedDelivery}
                            isUpdating={updatingDeliveryId === delivery.id}
                            onToggle={selectTimelineDelivery}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="space-y-4 lg:hidden">
                  {visibleScheduledDriverNames.map((driverName) => (
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
                              blockedDatesByKey={blockedDatesByKey}
                              expanded={false}
                              canEditDeliveries={canEditDeliveries}
                              onEditDelivery={onEditDelivery}
                              onViewOrder={onViewOrder}
                              onEditOrder={onEditOrder}
                              onRequestUnassign={(delivery) => {
                                setUnassignError("");
                                setDeliveryToUnassign(delivery);
                              }}
                              onUpdateDelivery={handleMoveGroupedDelivery}
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

      {calendarView === "day" &&
      hasSelectedDay &&
      selectedDateBlockOff &&
      !isAllDayCalendarBlockOff(selectedDateBlockOff) ? (
        <section
          className="mt-6 rounded-2xl border px-4 py-6 text-center shadow-sm sm:px-5"
          style={{
            backgroundColor: selectedDateBlockOffPresentation.backgroundColor,
            borderColor: selectedDateBlockOffPresentation.backgroundColor,
            color: selectedDateBlockOffPresentation.textColor,
          }}
        >
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm">
            <span className="text-5xl" aria-hidden="true">
              {selectedDateBlockOff.icon || "📅"}
            </span>
          </span>
          <div className="mx-auto mt-3 max-w-3xl">
            <p className="text-lg font-black uppercase tracking-[0.08em]">
              {getCalendarBlockOffScheduleLabel(selectedDateBlockOff)}
            </p>
            <p
              className="mt-2 border-t pt-2 text-xl font-black sm:text-2xl"
              style={{
                borderColor: selectedDateBlockOffPresentation.dividerColor,
              }}
            >
              {formatDateLabel(selectedDate)} · {selectedDateBlockOff.reason}
            </p>
            <p
              className="mt-2 text-xs font-semibold"
              style={{
                color: selectedDateBlockOffPresentation.mutedTextColor,
              }}
            >
              Deliveries can be scheduled before closing as long as the full
              delivery block fits inside the open hours above.
            </p>
          </div>
        </section>
      ) : null}

      {isDeliveryModalOpen && selectedTimelineDelivery ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-delivery-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTimelineDeliveryId("");
              setSelectedTimelineDeliverySnapshot(null);
              setIsDeliveryModalOpen(false);
            }
          }}
        >
          <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-none flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-slate-200 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:px-6 sm:py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                    {selectedDeliveryGroup.length > 1
                      ? "Grouped delivery stop"
                      : "Delivery details"}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                      deliveryNeedsDispatch(selectedTimelineDelivery)
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {deliveryNeedsDispatch(selectedTimelineDelivery)
                      ? "Needs dispatch"
                      : "Scheduled"}
                  </span>
                  <DeliveryNotesBadge
                    delivery={selectedTimelineDelivery}
                    showLabel
                  />
                </div>
                <h2
                  id="calendar-delivery-modal-title"
                  className="mt-1 truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl"
                >
                  {selectedDeliveryGroup.length > 1
                    ? `${selectedDeliveryGroup.length} orders · one stop`
                    : `Order ${selectedTimelineDelivery.orderNumber || "—"}`}
                </h2>
                <p className="mt-1 truncate text-sm font-bold text-slate-500 sm:text-base">
                  {formatCustomerName(selectedTimelineDelivery.customerName) ||
                    "Customer not entered"}
                  {selectedTimelineDelivery.deliveryDate
                    ? ` · ${formatDateLabel(
                        getDeliveryDateKey(
                          selectedTimelineDelivery.deliveryDate,
                        ),
                      )}`
                    : ""}
                </p>
              </div>

              {onViewOrder || (canEditDeliveries && onUpdateDelivery) ? (
                <div className="order-3 col-span-2 flex flex-col justify-center gap-2 sm:order-none sm:col-span-1 sm:flex-row">
                  {canEditDeliveries && onUpdateDelivery ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleMarkDelivered(selectedTimelineDelivery)
                      }
                      disabled={
                        markingDeliveredId === selectedTimelineDelivery.id
                      }
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {markingDeliveredId === selectedTimelineDelivery.id
                        ? "Saving…"
                        : "Mark Delivered"}
                    </button>
                  ) : null}

                  {onViewOrder ? (
                    <button
                      type="button"
                      onClick={() => onViewOrder(selectedTimelineDelivery)}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#e21f2b] focus:outline-none focus:ring-4 focus:ring-red-100"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View order
                    </button>
                  ) : null}
                </div>
              ) : (
                <span className="hidden sm:block" aria-hidden="true" />
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTimelineDeliveryId("");
                    setSelectedTimelineDeliverySnapshot(null);
                    setIsDeliveryModalOpen(false);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Close delivery details"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="overflow-y-auto p-3 sm:p-5">
              {selectedDeliveryGroup.length > 1 ? (
                <section className="mb-4 overflow-hidden rounded-2xl border-2 border-blue-300 bg-blue-50 shadow-sm">
                  <div className="flex flex-col gap-2 border-b border-blue-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                        Shared route assignment
                      </p>
                      <p className="mt-1 text-sm font-bold text-blue-950">
                        Date, time, driver, and truck apply to every order in this stop.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-700 px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-white">
                        {selectedDeliveryGroup.length} orders
                      </span>
                      {canEditDeliveries ? (
                        <details className="group/actions relative">
                          <summary
                            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-blue-300 bg-white text-blue-800 shadow-sm transition hover:border-blue-500 hover:bg-blue-100 [&::-webkit-details-marker]:hidden"
                            aria-label="Grouped stop actions"
                          >
                            <EllipsisVertical
                              className="h-5 w-5"
                              aria-hidden="true"
                            />
                          </summary>
                          <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                            <button
                              type="button"
                              onClick={() =>
                                handleUngroupDeliveryStop(
                                  selectedTimelineDelivery,
                                )
                              }
                              disabled={
                                ungroupingGroupId ===
                                selectedTimelineDelivery.deliveryCalendarGroupId
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-800 disabled:cursor-wait disabled:opacity-60"
                            >
                              <Unlink
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              {ungroupingGroupId ===
                              selectedTimelineDelivery.deliveryCalendarGroupId
                                ? "Ungrouping…"
                                : "Ungroup stop"}
                            </button>
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 p-3 md:grid-cols-2">
                    {selectedDeliveryGroup.map((groupDelivery) => {
                      const groupItems = Array.isArray(groupDelivery.items)
                        ? groupDelivery.items
                        : [];

                      return (
                        <article
                          key={groupDelivery.id}
                          className="rounded-xl border border-blue-200 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase tracking-[0.1em] text-blue-700">
                                Order {groupDelivery.orderNumber || "—"}
                              </p>
                              <p className="mt-1 truncate text-sm font-black text-slate-950">
                                {formatCustomerName(groupDelivery.customerName) ||
                                  "Customer not entered"}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                              {groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                            </span>
                          </div>
                          {groupItems.length > 0 ? (
                            <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                              {groupItems.slice(0, 3).map((item, itemIndex) => (
                                <p
                                  key={`${groupDelivery.id}-material-${itemIndex}`}
                                  className="truncate text-xs font-bold text-slate-600"
                                >
                                  QTY {item.quantity || item.qty || "—"} · {item.description || item.name || item.itemNumber || "Material"}
                                </p>
                              ))}
                              {groupItems.length > 3 ? (
                                <p className="text-xs font-black text-blue-700">
                                  +{groupItems.length - 3} more material lines
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}
              <CompactDeliveryCard
                delivery={selectedTimelineDelivery}
                deliveries={safeDeliveries}
                deliveryDates={deliveryDates}
                blockedDatesByKey={blockedDatesByKey}
                driverOptions={employeeOptions}
                vehicleOptions={vehicleOptions}
                expanded
                canEditDeliveries={canEditDeliveries}
                onEditDelivery={onEditDelivery}
                onEditOrder={onEditOrder}
                onRequestUnassign={(delivery) => {
                  setUnassignError("");
                  setDeliveryToUnassign(delivery);
                }}
                onUpdateDelivery={handleMoveGroupedDelivery}
                isUpdating={
                  updatingDeliveryId === selectedTimelineDelivery.id
                }
                onToggle={selectTimelineDelivery}
                hideToggle
                dispatchStyle
              />
            </div>
          </section>
        </div>
      ) : null}

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

      <DeliveryScheduleAccessModal
        isOpen={Boolean(pendingDayLockChange)}
        onClose={() => setPendingDayLockChange(null)}
        onUnlock={() => {
          const dateKey = pendingDayLockChange?.dateKey;
          setPendingDayLockChange(null);

          if (dateKey) {
            void applyDayLockChange(dateKey);
          }
        }}
        eyebrow="Calendar control"
        title={
          pendingDayLockChange?.isReopening
            ? "Reopen this delivery day"
            : "Mark this delivery day full"
        }
        description={
          pendingDayLockChange?.dateKey
            ? `${formatDateLabel(pendingDayLockChange.dateKey)} will ${
                pendingDayLockChange.isReopening
                  ? "accept new deliveries again"
                  : pendingDayLockChange.hasPartialClosure
                    ? "be closed to new deliveries while preserving its partial-hours schedule for reopening"
                  : "keep its existing deliveries but stop additional scheduling"
              }. Enter the scheduling code to confirm.`
            : "Enter the scheduling code to confirm this calendar change."
        }
        submitLabel={
          pendingDayLockChange?.isReopening
            ? "Confirm reopening"
            : "Confirm day is full"
        }
        errorMessage="Incorrect scheduling code. The day was not changed."
      />

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
