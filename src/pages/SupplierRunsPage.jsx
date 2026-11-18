import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  GripVertical,
  Home,
  Navigation,
  Package,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import CustomerNameBadge from "../components/CustomerNameBadge";
import EmptyState from "../components/EmptyState";
import OrderCopyAttachments from "../components/OrderCopyAttachments";
import PageContainer from "../components/PageContainer";
import SupplierRunCard from "../components/SupplierRunCard";
import SupplierRunForm from "../components/SupplierRunForm";
import { southVendorRouteOrder } from "../data/options";
import {
  formatDateInput,
  getDateInputValue,
  getTodayHeading,
} from "../utils/dateHelpers";
import {
  getSouthRouteOrderId,
  saveSouthRouteOrder,
  subscribeToSouthRouteOrders,
} from "../utils/southRouteOrderStorage";

const UNASSIGNED_DRIVER = "Unassigned Driver";
const driverAvatarColors = [
  "bg-red-100 text-red-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
  "bg-lime-100 text-lime-700",
  "bg-orange-100 text-orange-700",
  "bg-slate-200 text-slate-700",
];

function normalizeVendorName(vendor) {
  return String(vendor || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeDriverName(driver) {
  return String(driver || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getCanonicalDriverName(driver, employeeAliasMap = {}) {
  return employeeAliasMap[normalizeDriverName(driver)] || driver || "";
}

function driverNamesMatch(firstDriver, secondDriver, employeeAliasMap = {}) {
  return (
    normalizeDriverName(getCanonicalDriverName(firstDriver, employeeAliasMap)) ===
    normalizeDriverName(getCanonicalDriverName(secondDriver, employeeAliasMap))
  );
}

function getDisplayVendorName(vendor, vendorDisplayNameMap = {}) {
  const normalizedVendor = normalizeVendorName(vendor);

  return (
    vendorDisplayNameMap[normalizedVendor] ||
    vendor ||
    "Unknown Supplier"
  );
}

function formatCreatedAt(value) {
  if (!value) {
    return "";
  }

  const createdAtDate = new Date(value);

  if (Number.isNaN(createdAtDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(createdAtDate);
}

function getVendorRouteIndex(vendor, vendorRouteOrder = southVendorRouteOrder) {
  const normalizedVendor = normalizeVendorName(vendor);
  const routeIndex = vendorRouteOrder.findIndex(
    (routeVendor) =>
      normalizeVendorName(routeVendor) === normalizedVendor,
  );

  return routeIndex === -1
    ? Number.MAX_SAFE_INTEGER
    : routeIndex;
}

function sortVendorGroups(
  vendorGroups,
  manualVendorOrder = [],
  vendorRouteOrder = southVendorRouteOrder,
) {
  const normalizedManualOrder = manualVendorOrder.map(normalizeVendorName);

  return [...vendorGroups].sort((firstGroup, secondGroup) => {
    const firstManualIndex = normalizedManualOrder.indexOf(
      normalizeVendorName(firstGroup.vendor),
    );
    const secondManualIndex = normalizedManualOrder.indexOf(
      normalizeVendorName(secondGroup.vendor),
    );

    if (firstManualIndex !== -1 || secondManualIndex !== -1) {
      if (firstManualIndex === -1) {
        return 1;
      }

      if (secondManualIndex === -1) {
        return -1;
      }

      return firstManualIndex - secondManualIndex;
    }

    const firstIndex = getVendorRouteIndex(firstGroup.vendor, vendorRouteOrder);
    const secondIndex = getVendorRouteIndex(
      secondGroup.vendor,
      vendorRouteOrder,
    );

    if (firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }

    return firstGroup.vendor.localeCompare(secondGroup.vendor);
  });
}

function getDriverAvatar(driver) {
  const name = driver || UNASSIGNED_DRIVER;
  const colorIndex = [...name].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  ) % driverAvatarColors.length;

  return {
    initial: name.trim().charAt(0).toUpperCase() || "?",
    colorClass: driverAvatarColors[colorIndex],
  };
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

function groupRunsByVendor(
  supplierRuns,
  manualVendorOrder = [],
  vendorRouteOrder = southVendorRouteOrder,
  vendorDisplayNameMap = {},
) {
  const vendorGroups = supplierRuns.reduce((groups, supplierRun) => {
    const vendor = getDisplayVendorName(
      supplierRun.vendor,
      vendorDisplayNameMap,
    );
    const existingGroup = groups.find(
      (group) => group.vendor === vendor,
    );

    if (existingGroup) {
      existingGroup.runs.push(supplierRun);
      return groups;
    }

    return [
      ...groups,
      {
        vendor,
        runs: [supplierRun],
      },
    ];
  }, []);

  const groupsWithActiveRunsFirst = vendorGroups.map((vendorGroup) => ({
    ...vendorGroup,
    runs: [...vendorGroup.runs].sort((firstRun, secondRun) => {
      const firstIsComplete =
        firstRun.status === "complete" ||
        (Array.isArray(firstRun.items) &&
          firstRun.items.length > 0 &&
          firstRun.items.every(isPickupItemComplete));
      const secondIsComplete =
        secondRun.status === "complete" ||
        (Array.isArray(secondRun.items) &&
          secondRun.items.length > 0 &&
          secondRun.items.every(isPickupItemComplete));

      return Number(firstIsComplete) - Number(secondIsComplete);
    }),
  }));

  return sortVendorGroups(
    groupsWithActiveRunsFirst,
    manualVendorOrder,
    vendorRouteOrder,
  ).sort((firstGroup, secondGroup) => {
    const firstGroupIsComplete = firstGroup.runs.every(
      (supplierRun) =>
        supplierRun.status === "complete" ||
        (Array.isArray(supplierRun.items) &&
          supplierRun.items.length > 0 &&
          supplierRun.items.every(isPickupItemComplete)),
    );
    const secondGroupIsComplete = secondGroup.runs.every(
      (supplierRun) =>
        supplierRun.status === "complete" ||
        (Array.isArray(supplierRun.items) &&
          supplierRun.items.length > 0 &&
          supplierRun.items.every(isPickupItemComplete)),
    );

    return Number(firstGroupIsComplete) - Number(secondGroupIsComplete);
  });
}

function groupRunsByDriverAndVendor(
  supplierRuns,
  routeOrdersByDriver = {},
  vendorRouteOrder = southVendorRouteOrder,
  vendorDisplayNameMap = {},
  employeeAliasMap = {},
) {
  const runsByDriver = supplierRuns.reduce((groups, supplierRun) => {
    const driver =
      employeeAliasMap[normalizeDriverName(supplierRun.driver)] ||
      supplierRun.driver ||
      UNASSIGNED_DRIVER;

    return {
      ...groups,
      [driver]: [...(groups[driver] || []), supplierRun],
    };
  }, {});

  return Object.entries(runsByDriver).map(([driver, runs]) => ({
    driver,
    vendorGroups: groupRunsByVendor(
      runs,
      routeOrdersByDriver[driver]?.vendorOrder || [],
      vendorRouteOrder,
      vendorDisplayNameMap,
    ),
  }));
}

function getDirectionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
}

function getMaterialUseLabel(materialUse) {
  const labels = {
    order: "Order",
    stock: "Stock",
    return: "Return",
    swap: "Swap",
  };

  return labels[materialUse] || "Order";
}

function getPickupPhotoUrl(photo) {
  return String(photo?.url || photo?.dataUrl || "").trim();
}

function hasPickupPhoto(item) {
  const photos = Array.isArray(item?.pickupPhotos)
    ? item.pickupPhotos
    : [];

  return Boolean(
    photos.some(getPickupPhotoUrl) || getPickupPhotoUrl(item?.pickupPhoto),
  );
}

function isPickupItemComplete(item) {
  return Boolean(item?.pickedUp || item?.pickedUpAt || hasPickupPhoto(item));
}

function getVendorGroupStatsFromRuns(runs) {
  const items = runs.flatMap((supplierRun) =>
    Array.isArray(supplierRun.items) ? supplierRun.items : [],
  );
  const remainingItems = items.filter(
    (item) => !isPickupItemComplete(item),
  ).length;

  return {
    poCount: runs.length,
    itemCount: items.length,
    remainingItems,
  };
}

function getSupplierRunCustomerName(supplierRun) {
  return (
    supplierRun.customerName ||
    (Array.isArray(supplierRun.items)
      ? supplierRun.items.find(
          (item) => item.materialUse !== "stock" && item.customerName,
        )?.customerName
      : "") ||
    ""
  );
}

function getMaterialUseBadgeClass(materialUse) {
  if (materialUse === "return") {
    return "bg-amber-100 text-amber-800";
  }

  if (materialUse === "swap") {
    return "bg-violet-100 text-violet-800";
  }

  return "bg-slate-100 text-slate-600";
}

function getSupplierRunMaterialSummary(supplierRun) {
  const items = Array.isArray(supplierRun.items) ? supplierRun.items : [];
  const materialUseCounts = items.reduce((counts, item) => {
    const materialUse = item.materialUse || "order";

    return {
      ...counts,
      [materialUse]: (counts[materialUse] || 0) + 1,
    };
  }, {});
  const materialUses = ["order", "stock", "return", "swap"].filter(
    (materialUse) => materialUseCounts[materialUse],
  );
  const orderNumbers = [
    ...new Set(
      items
        .map((item) => item.orderNumber)
        .filter(Boolean)
        .map((orderNumber) => String(orderNumber).trim())
        .filter(Boolean),
    ),
  ];

  return {
    materialUses,
    materialUseCounts,
    orderNumbers,
  };
}

function getDateKeyFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateKeyFromValue(value) {
  if (!value) {
    return "";
  }

  return getDateKeyFromDate(new Date(value));
}

function getDateKeyDayGap(startDateKey, endDateKey) {
  if (!startDateKey || !endDateKey) {
    return 0;
  }

  const startDate = new Date(`${startDateKey}T00:00:00`);
  const endDate = new Date(`${endDateKey}T00:00:00`);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return 0;
  }

  return Math.round((endDate - startDate) / 86400000);
}

function getSupplierRunDateKey(supplierRun) {
  if (supplierRun.scheduledDate) {
    const rolloverFromScheduledDate =
      typeof supplierRun.rolloverFromScheduledDate === "string"
        ? supplierRun.rolloverFromScheduledDate
        : "";

    if (
      rolloverFromScheduledDate &&
      getDateKeyDayGap(rolloverFromScheduledDate, supplierRun.scheduledDate) > 1
    ) {
      return rolloverFromScheduledDate;
    }

    return supplierRun.scheduledDate;
  }

  if (supplierRun.createdAt) {
    return getDateKeyFromDate(new Date(supplierRun.createdAt));
  }

  return "";
}

function getLatestItemPickedUpAt(supplierRun) {
  if (!Array.isArray(supplierRun?.items)) {
    return "";
  }

  return supplierRun.items
    .map((item) => item.pickedUpAt)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function getSupplierRunPickupDateKey(supplierRun) {
  return (
    getDateKeyFromValue(
      supplierRun.stopCompletedAt ||
        supplierRun.completedAt ||
        getLatestItemPickedUpAt(supplierRun) ||
        supplierRun.updatedAt,
    ) || getSupplierRunDateKey(supplierRun)
  );
}

function getSupplierRunBoardDateKey(supplierRun) {
  if (supplierRun.status === "complete") {
    return getSupplierRunPickupDateKey(supplierRun);
  }

  return getSupplierRunDateKey(supplierRun);
}

function hasPickedUpItems(supplierRun) {
  return Array.isArray(supplierRun?.items)
    ? supplierRun.items.some(isPickupItemComplete)
    : false;
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);

  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      key: getDateKeyFromDate(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: getDateKeyFromDate(date) === getDateInputValue(),
    };
  });
}

function getMonthLabel(monthDate) {
  return monthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getWeekDays(dateKey) {
  const anchorDate = new Date(`${dateKey || getDateInputValue()}T12:00:00`);
  const weekStart = new Date(anchorDate);

  weekStart.setDate(anchorDate.getDate() - anchorDate.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    return {
      date,
      key: getDateKeyFromDate(date),
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

function isVendorReturnRun(supplierRun) {
  return (
    supplierRun?.runType === "vendorReturn" ||
    supplierRun?.routeStopType === "vendorReturn" ||
    supplierRun?.deliveryScope === "vendorReturn" ||
    supplierRun?.vendorReturn === true
  );
}

function SouthDispatchCalendarCard({
  supplierRun,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging = false,
}) {
  const itemCount = Array.isArray(supplierRun.items)
    ? supplierRun.items.length
    : 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(supplierRun)}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", supplierRun.id);
        onDragStart?.(supplierRun);
      }}
      onDragEnd={() => onDragEnd?.()}
      className={`w-full cursor-grab rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left shadow-sm transition active:cursor-grabbing hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-100 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-amber-100 ${
        isDragging ? "scale-[0.98] opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">
            {supplierRun.vendor || "Unknown Supplier"}
          </p>
          <p className="mt-0.5 truncate text-xs font-black text-amber-900">
            PO {supplierRun.poNumber || "Not entered"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600 ring-1 ring-amber-100">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      {isVendorReturnRun(supplierRun) ? (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-amber-950">
          <ArrowUpRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
          Return to vendor
        </span>
      ) : null}
    </button>
  );
}

function SouthDispatchCalendarView({
  viewMode,
  selectedDate,
  supplierRuns,
  onChangeView,
  onChangeDate,
  onSelectRun,
  onMoveRun,
}) {
  const [expandedDayKey, setExpandedDayKey] = useState("");
  const [draggedRunId, setDraggedRunId] = useState("");
  const [dropTargetDate, setDropTargetDate] = useState("");
  const [movingRunId, setMovingRunId] = useState("");
  const todayKey = getDateInputValue();
  const runsByDate = supplierRuns.reduce((groups, supplierRun) => {
    const dateKey = getSupplierRunDateKey(supplierRun);

    if (!dateKey) {
      return groups;
    }

    groups[dateKey] = [...(groups[dateKey] || []), supplierRun];
    return groups;
  }, {});
  const selectedDateValue = new Date(`${selectedDate || todayKey}T12:00:00`);
  const selectedMonth = new Date(
    selectedDateValue.getFullYear(),
    selectedDateValue.getMonth(),
    1,
  );

  function navigateDate(dayOffset) {
    const nextDate = new Date(selectedDateValue);
    nextDate.setDate(selectedDateValue.getDate() + dayOffset);
    onChangeDate(getDateKeyFromDate(nextDate));
  }

  function navigateMonth(monthOffset) {
    const nextDate = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + monthOffset,
      1,
    );
    onChangeDate(getDateKeyFromDate(nextDate));
  }

  const viewButtons = (
    <div className="grid w-full grid-cols-3 rounded-2xl bg-slate-100 p-1 sm:w-auto sm:min-w-[330px]">
      {["day", "week", "month"].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChangeView(option)}
          className={`rounded-xl px-4 py-2.5 text-sm font-black capitalize transition ${
            viewMode === option
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:bg-white hover:text-slate-950"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );

  if (viewMode === "day") {
    return (
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            South dispatch view
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Full PO details, items, driver, and truck assignment.
          </p>
        </div>
        {viewButtons}
      </div>
    );
  }

  const visibleDays =
    viewMode === "week" ? getWeekDays(selectedDate) : getCalendarDays(selectedMonth);
  const calendarLabel =
    viewMode === "week"
      ? getWeekRangeLabel(selectedDate)
      : getMonthLabel(selectedMonth);
  const navigationStep = viewMode === "week" ? 7 : null;

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            South dispatch · {viewMode} view
          </p>
          <h3 className="mt-1 text-xl font-black text-slate-950">
            {calendarLabel}
          </h3>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Select a PO to open its complete dispatch assignment card.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                navigationStep ? navigateDate(-navigationStep) : navigateMonth(-1)
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
              aria-label={`Previous ${viewMode}`}
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeDate(todayKey)}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-200"
            >
              This {viewMode}
            </button>
            <button
              type="button"
              onClick={() =>
                navigationStep ? navigateDate(navigationStep) : navigateMonth(1)
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
              aria-label={`Next ${viewMode}`}
            >
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          {viewButtons}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className={viewMode === "month" ? "min-w-[62rem]" : "min-w-[54rem]"}>
          {viewMode === "month" ? (
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
          ) : null}

          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {visibleDays.map((day) => {
              const dayRuns = runsByDate[day.key] || [];
              const isExpanded = expandedDayKey === day.key;
              const visibleRuns = isExpanded ? dayRuns : dayRuns.slice(0, 4);
              const isSelected = day.key === selectedDate;
              const isToday = day.key === todayKey;
              const isCurrentMonth = day.inCurrentMonth !== false;

              return (
                <div
                  key={day.key}
                  onDragOver={(event) => {
                    if (!draggedRunId) {
                      return;
                    }

                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTargetDate(day.key);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setDropTargetDate("");
                    }
                  }}
                  onDrop={async (event) => {
                    event.preventDefault();
                    const droppedRunId =
                      event.dataTransfer.getData("text/plain") || draggedRunId;
                    const droppedRun = supplierRuns.find(
                      (supplierRun) => supplierRun.id === droppedRunId,
                    );

                    setDropTargetDate("");
                    setDraggedRunId("");

                    if (!droppedRun || getSupplierRunDateKey(droppedRun) === day.key) {
                      return;
                    }

                    setMovingRunId(droppedRun.id);
                    try {
                      await onMoveRun?.(droppedRun, day.key);
                    } finally {
                      setMovingRunId("");
                    }
                  }}
                  className={`min-h-48 p-3 transition ${
                    isCurrentMonth ? "bg-white" : "bg-slate-50"
                  } ${isSelected ? "ring-2 ring-inset ring-[#FC2C38]" : ""} ${
                    dropTargetDate === day.key
                      ? "bg-red-50 ring-2 ring-inset ring-[#FC2C38]"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onChangeDate(day.key)}
                    className="flex w-full items-start justify-between gap-2 rounded-lg p-1 text-left transition hover:bg-slate-50"
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
                            }).format(new Date(`${day.key}T12:00:00`))}
                      </span>
                      <span className="mt-0.5 block text-lg font-black text-slate-950">
                        {viewMode === "week"
                          ? new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                            }).format(new Date(`${day.key}T12:00:00`))
                          : day.day}
                      </span>
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                      {dayRuns.length}
                    </span>
                  </button>

                  <div className="mt-3 space-y-2">
                    {visibleRuns.map((supplierRun) => (
                      <SouthDispatchCalendarCard
                        key={supplierRun.id}
                        supplierRun={supplierRun}
                        onSelect={onSelectRun}
                        onDragStart={(draggedRun) =>
                          setDraggedRunId(draggedRun.id)
                        }
                        onDragEnd={() => {
                          setDraggedRunId("");
                          setDropTargetDate("");
                        }}
                        isDragging={
                          draggedRunId === supplierRun.id ||
                          movingRunId === supplierRun.id
                        }
                      />
                    ))}

                    {dayRuns.length > 4 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDayKey((currentDayKey) =>
                            currentDayKey === day.key ? "" : day.key,
                          )
                        }
                        className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-black text-slate-600 transition hover:bg-slate-200"
                      >
                        {isExpanded ? "Show fewer" : `+${dayRuns.length - 4} more`}
                      </button>
                    ) : null}

                    {dayRuns.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 px-2 py-4 text-center text-[10px] font-bold text-slate-400">
                        No South POs
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function getSouthPageTitle(mode) {
  if (mode === "history") {
    return "History";
  }

  if (mode === "dispatch") {
    return "Needs Dispatch";
  }

  if (mode === "check") {
    return "Check South POs";
  }

  return "Add South POs";
}

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeSearchNumbers(value) {
  return String(value || "").replace(/\D/g, "");
}

function supplierRunMatchesSearch(supplierRun, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const itemText = Array.isArray(supplierRun.items)
    ? supplierRun.items
        .map((item) =>
          [
            item.quantity,
            item.description,
            item.internalReference,
            item.materialUse,
            item.customerName,
            item.orderNumber,
            item.returnNotes,
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ")
    : "";
  const searchableText = [
    supplierRun.poNumber,
    supplierRun.vendor,
    supplierRun.driver,
    supplierRun.vehicleTitle,
    supplierRun.vehicleBadge,
    supplierRun.orderedBy,
    supplierRun.customerName,
    supplierRun.createdByName,
    supplierRun.createdByEmail,
    supplierRun.supplierAddress,
    getSupplierRunDateKey(supplierRun),
    supplierRun.completedAt,
    supplierRun.updatedAt,
    itemText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const numericSearchTerm = normalizeSearchNumbers(searchTerm);
  const searchableNumbers = [
    supplierRun.poNumber,
    ...(
      Array.isArray(supplierRun.items)
        ? supplierRun.items.map((item) => item.orderNumber)
        : []
    ),
  ]
    .map(normalizeSearchNumbers)
    .filter(Boolean);

  return (
    searchableText.includes(searchTerm) ||
    (numericSearchTerm.length > 0 &&
      searchableNumbers.some((searchableNumber) =>
        searchableNumber.includes(numericSearchTerm),
      ))
  );
}

function getSupplierRunDispatchNotes(supplierRun) {
  const itemNotes = Array.isArray(supplierRun?.items)
    ? supplierRun.items.map((item) => item.returnNotes)
    : [];

  return Array.from(
    new Set(
      [supplierRun?.notes, ...itemNotes]
        .map((note) => String(note || "").trim())
        .filter(Boolean),
    ),
  );
}

function supplierRunMatchesPickupSearch(
  supplierRun,
  searchTerm,
  includeCustomerName = false,
) {
  if (!searchTerm) {
    return true;
  }

  const itemText = Array.isArray(supplierRun.items)
    ? supplierRun.items
        .map((item) =>
          [
            item.internalReference,
            includeCustomerName ? item.customerName : "",
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ")
    : "";
  const searchableText = [
    supplierRun.poNumber,
    includeCustomerName ? supplierRun.customerName : "",
    itemText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const numericSearchTerm = normalizeSearchNumbers(searchTerm);
  const searchableNumbers = [
    supplierRun.poNumber,
    ...(Array.isArray(supplierRun.items)
      ? supplierRun.items.map((item) => item.internalReference)
      : []),
  ]
    .map(normalizeSearchNumbers)
    .filter(Boolean);

  return (
    searchableText.includes(searchTerm) ||
    (numericSearchTerm.length > 0 &&
      searchableNumbers.some((searchableNumber) =>
        searchableNumber.includes(numericSearchTerm),
      ))
  );
}

function getDateSortValue(supplierRun) {
  const dateKey = getSupplierRunDateKey(supplierRun);
  const parsedDate = dateKey ? new Date(`${dateKey}T00:00:00`) : null;

  return parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.getTime()
    : Number.MAX_SAFE_INTEGER;
}

function sortSupplierRunsByClosestPickupDate(supplierRuns) {
  const todayTime = new Date(`${getDateInputValue()}T00:00:00`).getTime();

  return [...supplierRuns].sort((firstRun, secondRun) => {
    const firstTime = getDateSortValue(firstRun);
    const secondTime = getDateSortValue(secondRun);
    const firstIsUpcoming = firstTime >= todayTime;
    const secondIsUpcoming = secondTime >= todayTime;

    if (firstIsUpcoming !== secondIsUpcoming) {
      return firstIsUpcoming ? -1 : 1;
    }

    if (firstIsUpcoming && secondIsUpcoming) {
      return firstTime - secondTime;
    }

    if (!firstIsUpcoming && !secondIsUpcoming) {
      return secondTime - firstTime;
    }

    return String(firstRun.poNumber || "").localeCompare(
      String(secondRun.poNumber || ""),
    );
  });
}

function groupHistoryRunsByPickupDate(
  supplierRuns,
  vendorRouteOrder = southVendorRouteOrder,
  vendorDisplayNameMap = {},
) {
  const groupsByDate = supplierRuns.reduce((groups, supplierRun) => {
    const dateKey = getSupplierRunPickupDateKey(supplierRun) || "no-date";

    return {
      ...groups,
      [dateKey]: [...(groups[dateKey] || []), supplierRun],
    };
  }, {});

  return Object.entries(groupsByDate)
    .sort(([firstDateKey], [secondDateKey]) =>
      secondDateKey.localeCompare(firstDateKey),
    )
    .map(([dateKey, runs]) => ({
      dateKey,
      label:
        dateKey === "no-date"
          ? "No pickup date"
          : formatDateInput(dateKey),
      runs,
      driverGroups: groupRunsByDriverAndVendor(
        runs,
        {},
        vendorRouteOrder,
        vendorDisplayNameMap,
      ),
    }));
}

/**
 * @param {{
 *   mode?: string;
 *   supplierRuns: any[];
 *   onAddSupplierRun?: Function;
 *   onSaveSupplierRunItemPickupPhoto?: Function;
 *   onUpdateSupplierRunItemDescription?: Function;
 *   onUpdateSupplierRun?: Function;
 *   onDeleteSupplierRun?: Function;
 *   createdBy?: Record<string, unknown>;
 *   vehicleOptions?: any[];
 *   employeeOptions?: string[];
 *   vendorOptions?: string[];
 *   supplierAddressMap?: Record<string, string>;
 *   vendorRouteOrder?: string[];
 *   vendorDisplayNameMap?: Record<string, string>;
 *   employeeAliasMap?: Record<string, string>;
 *   canAssignRoute?: boolean;
 *   canReorderRoute?: boolean;
 *   canEditSupplierRuns?: boolean;
 *   canReadAllRouteOrders?: boolean;
 *   routeOrderDriverName?: string;
 *   initialCheckViewMode?: string;
 *   viewerRole?: string;
 *   onPageChange?: Function;
 *   onRefreshPage?: Function;
 * }} props
 */
export default function SupplierRunsPage({
  mode = "add",
  supplierRuns,
  onAddSupplierRun,
  onSaveSupplierRunItemPickupPhoto,
  onUpdateSupplierRunItemDescription,
  onUpdateSupplierRun,
  onDeleteSupplierRun,
  createdBy = {},
  vehicleOptions,
  employeeOptions = [],
  vendorOptions,
  supplierAddressMap,
  vendorRouteOrder,
  vendorDisplayNameMap,
  employeeAliasMap = {},
  canAssignRoute = false,
  canReorderRoute = false,
  canEditSupplierRuns = canAssignRoute || canReorderRoute,
  canReadAllRouteOrders = canReorderRoute,
  routeOrderDriverName = "",
  viewerRole: _viewerRole = "",
  initialCheckViewMode = "list",
  onPageChange,
  onRefreshPage,
}) {
  const safeVehicleOptions = Array.isArray(vehicleOptions)
    ? vehicleOptions
    : [];
  const safeEmployeeOptions = getUniqueOptions([
    ...employeeOptions,
    routeOrderDriverName,
  ]);
  const safeVendorRouteOrder =
    Array.isArray(vendorRouteOrder) && vendorRouteOrder.length > 0
      ? vendorRouteOrder
      : southVendorRouteOrder;
  const safeVendorDisplayNameMap = vendorDisplayNameMap || {};
  const safeEmployeeAliasMap = employeeAliasMap || {};
  const isDriverView = _viewerRole === "driver";
  const todayKey = getDateInputValue();
  const [successMessage, setSuccessMessage] = useState("");
  const [openStopKeys, setOpenStopKeys] = useState({});
  const [openDriverKeys, setOpenDriverKeys] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedScheduleDate, setSelectedScheduleDate] =
    useState(todayKey);
  const [checkViewMode, setCheckViewMode] = useState(initialCheckViewMode);
  const [viewingSupplierRun, setViewingSupplierRun] =
    useState(null);
  const [editingSupplierRun, setEditingSupplierRun] =
    useState(null);
  const [southRouteOrders, setSouthRouteOrders] = useState([]);
  const [draggingStop, setDraggingStop] = useState(null);
  const [dragOverStop, setDragOverStop] = useState(null);
  const pointerDragStopRef = useRef(null);
  const [routeOrderError, setRouteOrderError] = useState("");
  const [dispatchDrafts, setDispatchDrafts] = useState({});
  const [savingDispatchRunId, setSavingDispatchRunId] = useState("");
  const [supplierRunToUnassign, setSupplierRunToUnassign] = useState(null);
  const [unassigningSupplierRunId, setUnassigningSupplierRunId] =
    useState("");
  const [unassignError, setUnassignError] = useState("");
  const [bulkDispatchDraft, setBulkDispatchDraft] = useState({
    driver: "",
    vehicleId: "",
  });
  const [selectedDispatchRunIds, setSelectedDispatchRunIds] = useState([]);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [bulkDateConfirmation, setBulkDateConfirmation] = useState(null);
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchViewMode, setDispatchViewMode] = useState("day");
  const [dispatchCalendarDate, setDispatchCalendarDate] = useState(todayKey);
  const [dispatchCalendarModalRunId, setDispatchCalendarModalRunId] =
    useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [pickupSearch, setPickupSearch] = useState("");
  const [dateMoveDraft, setDateMoveDraft] = useState(todayKey);
  const [dateMoveError, setDateMoveError] = useState("");
  const [savingDateMove, setSavingDateMove] = useState(false);
  const [dispatchDateEdit, setDispatchDateEdit] = useState({
    supplierRunId: "",
    date: "",
    error: "",
  });
  const [savingDispatchDateRunId, setSavingDispatchDateRunId] = useState("");

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successMessage]);

  useEffect(() => {
    if (!dispatchCalendarModalRunId) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeDispatchCalendarModal(event) {
      if (event.key === "Escape") {
        setDispatchCalendarModalRunId("");
      }
    }

    window.addEventListener("keydown", closeDispatchCalendarModal);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", closeDispatchCalendarModal);
    };
  }, [dispatchCalendarModalRunId]);

  useEffect(() => {
    if (mode === "check") {
      setCheckViewMode(initialCheckViewMode);
    }
  }, [initialCheckViewMode, mode]);

  useEffect(() => {
    if (mode !== "check") {
      return;
    }

    if (!canReadAllRouteOrders && !routeOrderDriverName) {
      setSouthRouteOrders([]);
      return;
    }

    let pendingSupplierRunId = "";

    try {
      pendingSupplierRunId =
        sessionStorage.getItem("dispatch-cl-edit-south-po") || "";
      sessionStorage.removeItem("dispatch-cl-edit-south-po");
    } catch {
      pendingSupplierRunId = "";
    }

    if (!pendingSupplierRunId) {
      return;
    }

    const pendingSupplierRun = supplierRuns.find(
      (supplierRun) => supplierRun.id === pendingSupplierRunId,
    );

    if (pendingSupplierRun && canManageSupplierRun(pendingSupplierRun)) {
      setEditingSupplierRun(pendingSupplierRun);
    }
  }, [
    createdBy,
    isDriverView,
    _viewerRole,
    canEditSupplierRuns,
    mode,
    routeOrderDriverName,
    canReadAllRouteOrders,
    supplierRuns,
  ]);

  useEffect(
    () => {
      if (mode !== "check") {
        return undefined;
      }

      if (!canReadAllRouteOrders && !routeOrderDriverName) {
        setSouthRouteOrders([]);
        return undefined;
      }

      return subscribeToSouthRouteOrders(
        setSouthRouteOrders,
        (routeOrderSyncError) => {
          console.error(
            "Unable to sync South route orders:",
            routeOrderSyncError,
          );
          setRouteOrderError(
            "Unable to sync route order. Publish Firestore rules for South route orders.",
          );
        },
        canReadAllRouteOrders
          ? {}
          : { driverName: routeOrderDriverName },
      );
    },
    [canReadAllRouteOrders, mode, routeOrderDriverName],
  );

  async function handleSubmit(supplierRun) {
    await onAddSupplierRun(supplierRun);

    setSuccessMessage(
      supplierRun.dispatchStatus === "needsDispatch"
        ? `PO ${supplierRun.poNumber} was scheduled for ${formatDateInput(
            supplierRun.scheduledDate,
          )} and sent to Needs Dispatch.`
        : `PO ${supplierRun.poNumber} was scheduled for ${formatDateInput(
            supplierRun.scheduledDate,
          )} and sent to ${supplierRun.driver}'s South list.`,
    );
  }

  async function handleEditSubmit(supplierRun) {
    if (!editingSupplierRun?.id || !canManageSupplierRun(editingSupplierRun)) {
      return;
    }

    await onUpdateSupplierRun(editingSupplierRun.id, supplierRun);
    setEditingSupplierRun(null);
    setSuccessMessage(`PO ${supplierRun.poNumber} was updated.`);
  }

  function toggleStop(
    driver,
    vendor,
    scope = "open",
    defaultOpen = scope === "open",
  ) {
    const stopKey = `${scope}::${driver}::${vendor}`;

    setOpenStopKeys((currentOpenStopKeys) => ({
      ...currentOpenStopKeys,
      [stopKey]:
        currentOpenStopKeys[stopKey] === undefined
          ? !defaultOpen
          : !currentOpenStopKeys[stopKey],
    }));
  }

  function toggleDriver(
    driver,
    scope = "open",
    defaultOpen = scope === "open",
  ) {
    const driverKey = `${scope}::${driver}`;

    setOpenDriverKeys((currentOpenDriverKeys) => ({
      ...currentOpenDriverKeys,
      [driverKey]:
        currentOpenDriverKeys[driverKey] === undefined
          ? !defaultOpen
          : !currentOpenDriverKeys[driverKey],
    }));
  }

  function isDriverOpen(
    driver,
    scope = "open",
    defaultOpen = scope === "open",
  ) {
    const driverKey = `${scope}::${driver}`;

    return openDriverKeys[driverKey] === undefined
      ? defaultOpen
      : openDriverKeys[driverKey];
  }

  function isStopOpen(
    driver,
    vendor,
    scope = "open",
    defaultOpen = scope === "open",
  ) {
    const stopKey = `${scope}::${driver}::${vendor}`;

    return openStopKeys[stopKey] === undefined
      ? defaultOpen
      : openStopKeys[stopKey];
  }

  function canManageSupplierRun(supplierRun) {
    if (!supplierRun) {
      return false;
    }

    if (canEditSupplierRuns) {
      return true;
    }

    if (isDriverView || _viewerRole === "driver") {
      return false;
    }

    const viewerId = String(createdBy?.id || "").trim();
    const viewerEmail = String(createdBy?.email || "").trim().toLowerCase();
    const viewerName = String(createdBy?.name || "").trim().toLowerCase();
    const supplierRunCreatorId = String(supplierRun.createdById || "").trim();
    const supplierRunCreatorEmail = String(
      supplierRun.createdByEmail || "",
    )
      .trim()
      .toLowerCase();
    const supplierRunCreatorName = String(supplierRun.createdByName || "")
      .trim()
      .toLowerCase();
    const hasStrongCreator =
      Boolean(supplierRunCreatorId) || Boolean(supplierRunCreatorEmail);

    return Boolean(
      (viewerId && supplierRunCreatorId && viewerId === supplierRunCreatorId) ||
        (viewerEmail &&
          supplierRunCreatorEmail &&
          viewerEmail === supplierRunCreatorEmail) ||
        (!hasStrongCreator &&
          viewerName &&
          supplierRunCreatorName &&
          viewerName === supplierRunCreatorName),
    );
  }

  async function saveRouteOrder(driver, vendorOrder) {
    const routeOrderId = getSouthRouteOrderId(
      driver,
      selectedScheduleDate,
    );

    setRouteOrderError("");

    try {
      const updatedRouteOrders = await saveSouthRouteOrder({
        id: routeOrderId,
        driver,
        dateKey: selectedScheduleDate,
        vendorOrder,
      });

      setSouthRouteOrders(updatedRouteOrders);
    } catch (routeOrderSaveError) {
      console.error("Unable to save South route order:", routeOrderSaveError);
      setRouteOrderError(
        "Unable to save route order. Publish Firestore rules for South route orders.",
      );
    }
  }

  function moveVendor(vendors, fromVendor, toVendor) {
    const fromIndex = vendors.indexOf(fromVendor);
    const toIndex = vendors.indexOf(toVendor);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return vendors;
    }

    const nextVendors = [...vendors];
    const [movedVendor] = nextVendors.splice(fromIndex, 1);
    nextVendors.splice(toIndex, 0, movedVendor);

    return nextVendors;
  }

  async function reorderVendorStop(
    driver,
    sourceVendor,
    targetVendor,
    vendorGroups,
  ) {
    if (!canReorderRoute || !sourceVendor || !targetVendor) {
      return;
    }

    const currentVendorOrder = vendorGroups.map(
      (vendorGroup) => vendorGroup.vendor,
    );
    const nextVendorOrder = moveVendor(
      currentVendorOrder,
      sourceVendor,
      targetVendor,
    );

    if (nextVendorOrder.join("::") === currentVendorOrder.join("::")) {
      return;
    }

    await saveRouteOrder(driver, nextVendorOrder);
  }

  async function handleStopDrop(driver, targetVendor, vendorGroups) {
    if (!canReorderRoute) {
      setDraggingStop(null);
      setDragOverStop(null);
      return;
    }

    if (!draggingStop || draggingStop.driver !== driver) {
      setDraggingStop(null);
      setDragOverStop(null);
      return;
    }

    const sourceVendor = draggingStop.vendor;

    setDraggingStop(null);
    setDragOverStop(null);

    await reorderVendorStop(
      driver,
      sourceVendor,
      targetVendor,
      vendorGroups,
    );
  }

  function handleStopPointerDown(event, driver, vendor) {
    if (
      !canReorderRoute ||
      event.pointerType === "mouse" ||
      event.target.closest?.("button") ||
      pointerDragStopRef.current
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerDragStopRef.current = {
      pointerId: event.pointerId,
      driver,
      vendor,
      targetVendor: vendor,
    };
    setDraggingStop({ driver, vendor });
    setDragOverStop({ driver, vendor });
  }

  function handleStopPointerMove(event) {
    const activePointerDrag = pointerDragStopRef.current;

    if (
      !activePointerDrag ||
      activePointerDrag.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();

    const stopElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.("[data-south-route-stop]");
    const targetDriver = stopElement?.dataset?.southRouteDriver || "";
    const targetVendor = stopElement?.dataset?.southRouteVendor || "";

    if (
      !targetVendor ||
      targetDriver !== activePointerDrag.driver ||
      targetVendor === activePointerDrag.targetVendor
    ) {
      return;
    }

    pointerDragStopRef.current = {
      ...activePointerDrag,
      targetVendor,
    };
    setDragOverStop({ driver: targetDriver, vendor: targetVendor });
  }

  async function handleStopPointerEnd(event, vendorGroups) {
    const activePointerDrag = pointerDragStopRef.current;

    if (
      !activePointerDrag ||
      activePointerDrag.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    pointerDragStopRef.current = null;
    setDraggingStop(null);
    setDragOverStop(null);

    await reorderVendorStop(
      activePointerDrag.driver,
      activePointerDrag.vendor,
      activePointerDrag.targetVendor,
      vendorGroups,
    );
  }

  function handleStopPointerCancel(event) {
    const activePointerDrag = pointerDragStopRef.current;

    if (
      !activePointerDrag ||
      activePointerDrag.pointerId !== event.pointerId
    ) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointerDragStopRef.current = null;
    setDraggingStop(null);
    setDragOverStop(null);
  }

  async function handleMoveStop(driver, vendorGroups, vendor, offset) {
    if (!canReorderRoute) {
      return;
    }

    const currentVendorOrder = vendorGroups.map(
      (vendorGroup) => vendorGroup.vendor,
    );
    const currentIndex = currentVendorOrder.indexOf(vendor);
    const nextIndex = currentIndex + offset;

    if (
      currentIndex === -1 ||
      nextIndex < 0 ||
      nextIndex >= currentVendorOrder.length
    ) {
      return;
    }

    const nextVendorOrder = [...currentVendorOrder];
    const [movedVendor] = nextVendorOrder.splice(currentIndex, 1);
    nextVendorOrder.splice(nextIndex, 0, movedVendor);

    await saveRouteOrder(driver, nextVendorOrder);
  }

  function getVendorGroupStats(vendorGroup) {
    return getVendorGroupStatsFromRuns(vendorGroup.runs);
  }

  function getVendorGroupAddress(vendorGroup) {
    const settingsAddress =
      supplierAddressMap?.[vendorGroup.vendor]?.trim?.() || "";

    if (settingsAddress) {
      return settingsAddress;
    }

    const runWithAddress = vendorGroup.runs.find(
      (supplierRun) =>
        typeof supplierRun.supplierAddress === "string" &&
        supplierRun.supplierAddress.trim(),
    );

    return runWithAddress?.supplierAddress?.trim() || "";
  }

  function getDisplaySupplierRun(supplierRun) {
    const displayVendor = getDisplayVendorName(
      supplierRun.vendor,
      safeVendorDisplayNameMap,
    );

    return displayVendor === supplierRun.vendor
      ? supplierRun
      : {
          ...supplierRun,
          vendor: displayVendor,
        };
  }

  function getDriverGroupVehicleLabel(driverGroup) {
    const vehicleLabels = [
      ...new Set(
        driverGroup.vendorGroups
          .flatMap((vendorGroup) => vendorGroup.runs)
          .map(
            (supplierRun) =>
              supplierRun.vehicleBadge ||
              supplierRun.vehicleTitle ||
              "",
          )
          .filter(Boolean),
      ),
    ];

    if (vehicleLabels.length === 0) {
      return "";
    }

    if (vehicleLabels.length === 1) {
      return vehicleLabels[0];
    }

    return `${vehicleLabels[0]} +${vehicleLabels.length - 1}`;
  }

  function getDispatchDraft(supplierRun) {
    return {
      driver: supplierRun.driver || "",
      vehicleId: supplierRun.vehicleId || "",
      ...(dispatchDrafts[supplierRun.id] || {}),
    };
  }

  function updateDispatchDraft(supplierRunId, field, value) {
    setDispatchDrafts((currentDrafts) => ({
      ...currentDrafts,
      [supplierRunId]: {
        ...(currentDrafts[supplierRunId] || {}),
        [field]: value,
      },
    }));
    setRouteOrderError("");
  }

  function toggleSelectedDispatchRun(supplierRunId) {
    setSelectedDispatchRunIds((currentSelectedRunIds) =>
      currentSelectedRunIds.includes(supplierRunId)
        ? currentSelectedRunIds.filter(
            (currentRunId) => currentRunId !== supplierRunId,
          )
        : [...currentSelectedRunIds, supplierRunId],
    );
    setRouteOrderError("");
  }

  function toggleAllFilteredDispatchRuns(filteredRuns) {
    const filteredRunIds = filteredRuns.map((supplierRun) => supplierRun.id);
    const allFilteredSelected =
      filteredRunIds.length > 0 &&
      filteredRunIds.every((supplierRunId) =>
        selectedDispatchRunIds.includes(supplierRunId),
      );

    setSelectedDispatchRunIds((currentSelectedRunIds) =>
      allFilteredSelected
        ? currentSelectedRunIds.filter(
            (supplierRunId) => !filteredRunIds.includes(supplierRunId),
          )
        : [
            ...currentSelectedRunIds,
            ...filteredRunIds.filter(
              (supplierRunId) =>
                !currentSelectedRunIds.includes(supplierRunId),
            ),
          ],
    );
    setRouteOrderError("");
  }

  async function assignSelectedSupplierRuns(
    selectedRuns,
    { confirmFutureDateMove = false } = {},
  ) {
    const selectedVehicle = safeVehicleOptions.find(
      (vehicleOption) => vehicleOption.id === bulkDispatchDraft.vehicleId,
    );

    if (selectedRuns.length === 0) {
      setRouteOrderError("Select at least one PO to assign.");
      return;
    }

    if (!safeEmployeeOptions.includes(bulkDispatchDraft.driver)) {
      setRouteOrderError("Select a driver for the selected POs.");
      return;
    }

    if (safeVehicleOptions.length > 0 && !selectedVehicle) {
      setRouteOrderError("Select a truck for the selected POs.");
      return;
    }

    const futureDatedRuns = selectedRuns.filter((supplierRun) => {
      const scheduledDate = String(supplierRun.scheduledDate || "").trim();

      return scheduledDate && scheduledDate > todayKey;
    });

    if (futureDatedRuns.length > 0 && !confirmFutureDateMove) {
      setBulkDateConfirmation({
        selectedRunIds: selectedRuns.map((supplierRun) => supplierRun.id),
        futureRunIds: futureDatedRuns.map((supplierRun) => supplierRun.id),
      });
      setRouteOrderError("");
      return;
    }

    const futureRunIds = new Set(
      futureDatedRuns.map((supplierRun) => supplierRun.id),
    );

    setIsBulkAssigning(true);
    setBulkDateConfirmation(null);
    setRouteOrderError("");

    try {
      await Promise.all(
        selectedRuns.map((supplierRun) => {
          const shouldMoveToToday =
            confirmFutureDateMove && futureRunIds.has(supplierRun.id);

          return onUpdateSupplierRun(supplierRun.id, {
            driver: bulkDispatchDraft.driver,
            vehicleId: selectedVehicle?.id || "",
            vehicleTitle: selectedVehicle?.title || "",
            vehicleBadge: selectedVehicle?.badge || "",
            dispatchStatus: "assigned",
            ...(shouldMoveToToday
              ? {
                  scheduledDate: todayKey,
                  rolloverFromScheduledDate: "",
                  rolledOverAt: null,
                  updatedAt: new Date().toISOString(),
                }
              : {}),
          });
        }),
      );

      setDispatchDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        selectedRuns.forEach((supplierRun) => {
          delete nextDrafts[supplierRun.id];
        });
        return nextDrafts;
      });
      setSelectedDispatchRunIds([]);
      setSuccessMessage(
        `${selectedRuns.length} ${
          selectedRuns.length === 1 ? "PO was" : "POs were"
        } assigned to ${bulkDispatchDraft.driver}.${
          confirmFutureDateMove && futureDatedRuns.length > 0
            ? ` ${futureDatedRuns.length} ${
                futureDatedRuns.length === 1 ? "PO was" : "POs were"
              } moved to today.`
            : ""
        }`,
      );
      onPageChange?.("supplier-runs-check");
    } catch (assignError) {
      console.error("Unable to bulk assign South POs:", assignError);
      setRouteOrderError(
        "Unable to assign those POs. Check Firebase rules.",
      );
    } finally {
      setIsBulkAssigning(false);
    }
  }

  async function assignSupplierRun(supplierRun) {
    const draft = getDispatchDraft(supplierRun);
    const selectedVehicle = safeVehicleOptions.find(
      (vehicleOption) => vehicleOption.id === draft.vehicleId,
    );

    if (!safeEmployeeOptions.includes(draft.driver)) {
      setRouteOrderError(`Select a driver for PO ${supplierRun.poNumber}.`);
      return;
    }

    if (safeVehicleOptions.length > 0 && !selectedVehicle) {
      setRouteOrderError(`Select a truck for PO ${supplierRun.poNumber}.`);
      return;
    }

    setSavingDispatchRunId(supplierRun.id);
    setRouteOrderError("");

    try {
      const updatedSupplierRuns = await onUpdateSupplierRun(
        supplierRun.id,
        {
          driver: draft.driver,
          vehicleId: selectedVehicle?.id || "",
          vehicleTitle: selectedVehicle?.title || "",
          vehicleBadge: selectedVehicle?.badge || "",
          dispatchStatus: "assigned",
        },
      );

      setDispatchDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[supplierRun.id];
        return nextDrafts;
      });

      if (Array.isArray(updatedSupplierRuns)) {
        setSuccessMessage(
          `PO ${supplierRun.poNumber} was assigned to ${draft.driver}.`,
        );
      }
      onPageChange?.("supplier-runs-check");
    } catch (assignError) {
      console.error("Unable to assign South PO:", assignError);
      setRouteOrderError("Unable to assign that PO. Check Firebase rules.");
    } finally {
      setSavingDispatchRunId("");
    }
  }

  async function handleConfirmUnassignSupplierRun() {
    const supplierRunId = String(supplierRunToUnassign?.id || "");

    if (!supplierRunId || !onUpdateSupplierRun) {
      return;
    }

    setUnassigningSupplierRunId(supplierRunId);
    setUnassignError("");

    try {
      await onUpdateSupplierRun(supplierRunId, {
        driver: "",
        vehicleId: "",
        vehicleTitle: "",
        vehicleBadge: "",
        dispatchStatus: "needsDispatch",
        updatedAt: new Date().toISOString(),
      });

      setDispatchDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[supplierRunId];
        return nextDrafts;
      });
      setSuccessMessage(
        `PO ${supplierRunToUnassign.poNumber || ""} was returned to South Needs Dispatch.`,
      );
      setSupplierRunToUnassign(null);
      setViewingSupplierRun(null);
      setEditingSupplierRun(null);
    } catch (unassignSupplierRunError) {
      console.error(
        "Unable to return South PO to dispatch:",
        unassignSupplierRunError,
      );
      setUnassignError(
        "Unable to unassign this PO. Check your connection and try again.",
      );
    } finally {
      setUnassigningSupplierRunId("");
    }
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

  function openDispatchRunFromCalendar(supplierRun) {
    setDispatchCalendarDate(
      getSupplierRunDateKey(supplierRun) || dispatchCalendarDate,
    );
    setDispatchCalendarModalRunId(supplierRun.id);
    setRouteOrderError("");
  }

  async function moveDispatchRunFromCalendar(supplierRun, nextDate) {
    if (!supplierRun || getSupplierRunDateKey(supplierRun) === nextDate) {
      return;
    }

    if (!canManageSupplierRun(supplierRun)) {
      setRouteOrderError("You do not have access to change this pickup date.");
      return;
    }

    if (supplierRun.status === "complete" || hasPickedUpItems(supplierRun)) {
      setRouteOrderError("The pickup date is locked after pickup starts.");
      return;
    }

    setRouteOrderError("");

    try {
      await onUpdateSupplierRun(supplierRun.id, {
        scheduledDate: nextDate,
        rolloverFromScheduledDate: "",
        rolledOverAt: null,
        updatedAt: new Date().toISOString(),
      });
      setDispatchCalendarDate(nextDate);
      setSuccessMessage(
        `PO ${supplierRun.poNumber || ""} moved to ${formatDateInput(nextDate)}.`,
      );
    } catch (moveError) {
      console.error("Unable to move South PO from calendar:", moveError);
      setRouteOrderError(
        "Unable to move that PO. Check your connection and try again.",
      );
    }
  }

  const calendarRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      Array.isArray(supplierRun.items) &&
      supplierRun.items.some((item) => !isPickupItemComplete(item)),
  );
  const runsByDate = calendarRuns.reduce((groups, supplierRun) => {
    const dateKey = getSupplierRunBoardDateKey(supplierRun);

    if (!dateKey) {
      return groups;
    }

    return {
      ...groups,
      [dateKey]: [...(groups[dateKey] || []), supplierRun],
    };
  }, {});
  const calendarDays = getCalendarDays(calendarMonth);
  const selectedScheduleRuns = [
    ...(runsByDate[selectedScheduleDate] || []),
  ].sort((firstRun, secondRun) => {
    const firstIndex = getVendorRouteIndex(firstRun.vendor);
    const secondIndex = getVendorRouteIndex(secondRun.vendor);

    if (firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }

    return String(firstRun.poNumber || "").localeCompare(
      String(secondRun.poNumber || ""),
    );
  });
  const selectedSupplierRunDetails = viewingSupplierRun
    ? getDisplaySupplierRun(
        supplierRuns.find(
          (supplierRun) => supplierRun.id === viewingSupplierRun.id,
        ) || viewingSupplierRun,
      )
    : null;
  const bulkDateConfirmationSelectedRuns = bulkDateConfirmation
    ? supplierRuns.filter((supplierRun) =>
        bulkDateConfirmation.selectedRunIds.includes(supplierRun.id),
      )
    : [];
  const bulkDateConfirmationFutureRuns = bulkDateConfirmation
    ? bulkDateConfirmationSelectedRuns.filter((supplierRun) =>
        bulkDateConfirmation.futureRunIds.includes(supplierRun.id),
      )
    : [];

  useEffect(() => {
    if (!selectedSupplierRunDetails) {
      setDateMoveError("");
      return;
    }

    setDateMoveDraft(
      getSupplierRunDateKey(selectedSupplierRunDetails) || todayKey,
    );
    setDateMoveError("");
  }, [selectedSupplierRunDetails, todayKey]);

  async function handleMoveSelectedSupplierRunDate() {
    if (!selectedSupplierRunDetails || !dateMoveDraft) {
      setDateMoveError("Choose a pickup date.");
      return;
    }

    if (!canManageSupplierRun(selectedSupplierRunDetails)) {
      setDateMoveError("You do not have access to move this PO.");
      return;
    }

    if (
      selectedSupplierRunDetails.status === "complete" ||
      hasPickedUpItems(selectedSupplierRunDetails)
    ) {
      setDateMoveError(
        "This PO cannot be moved after items have been picked up.",
      );
      return;
    }

    setSavingDateMove(true);
    setDateMoveError("");

    try {
      await onUpdateSupplierRun(selectedSupplierRunDetails.id, {
        scheduledDate: dateMoveDraft,
      });

      const [year, month] = dateMoveDraft.split("-").map(Number);

      setViewingSupplierRun({
        ...selectedSupplierRunDetails,
        scheduledDate: dateMoveDraft,
      });
      setSelectedScheduleDate(dateMoveDraft);
      setCalendarMonth(new Date(year, month - 1, 1));
      setSuccessMessage(
        `PO ${
          selectedSupplierRunDetails.poNumber || ""
        } was moved to ${formatDateInput(dateMoveDraft)}.`,
      );
    } catch (moveError) {
      console.error("Unable to move South PO date:", moveError);
      setDateMoveError("Unable to move this PO date. Check Firebase rules.");
    } finally {
      setSavingDateMove(false);
    }
  }

  function beginDispatchDateEdit(supplierRun) {
    setDispatchDateEdit({
      supplierRunId: supplierRun.id,
      date: getSupplierRunDateKey(supplierRun) || todayKey,
      error: "",
    });
  }

  function cancelDispatchDateEdit() {
    setDispatchDateEdit({ supplierRunId: "", date: "", error: "" });
  }

  async function saveDispatchPickupDate(supplierRun) {
    if (!dispatchDateEdit.date) {
      setDispatchDateEdit((currentEdit) => ({
        ...currentEdit,
        error: "Choose a pickup date.",
      }));
      return;
    }

    if (!canManageSupplierRun(supplierRun)) {
      setDispatchDateEdit((currentEdit) => ({
        ...currentEdit,
        error: "You do not have access to change this date.",
      }));
      return;
    }

    if (supplierRun.status === "complete" || hasPickedUpItems(supplierRun)) {
      setDispatchDateEdit((currentEdit) => ({
        ...currentEdit,
        error: "The date is locked after pickup starts.",
      }));
      return;
    }

    setSavingDispatchDateRunId(supplierRun.id);
    setDispatchDateEdit((currentEdit) => ({
      ...currentEdit,
      error: "",
    }));

    try {
      await onUpdateSupplierRun(supplierRun.id, {
        scheduledDate: dispatchDateEdit.date,
        rolloverFromScheduledDate: "",
        rolledOverAt: null,
      });
      setSuccessMessage(
        `PO ${supplierRun.poNumber || ""} pickup date changed to ${formatDateInput(
          dispatchDateEdit.date,
        )}.`,
      );
      cancelDispatchDateEdit();
    } catch (dispatchDateError) {
      console.error("Unable to update South pickup date:", dispatchDateError);
      setDispatchDateEdit((currentEdit) => ({
        ...currentEdit,
        error: "Unable to save the pickup date. Try again.",
      }));
    } finally {
      setSavingDispatchDateRunId("");
    }
  }

  const dailyRuns = supplierRuns.filter((supplierRun) => {
    const scheduledDateKey = getSupplierRunDateKey(supplierRun);

    if (scheduledDateKey === selectedScheduleDate) {
      return true;
    }

    return (
      supplierRun.status === "complete" &&
      getSupplierRunPickupDateKey(supplierRun) === selectedScheduleDate
    );
  });

  const historyRuns = supplierRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );
  const historySearchTerm = normalizeSearchText(historySearch);
  const filteredHistoryRuns = historyRuns.filter((supplierRun) =>
    supplierRunMatchesSearch(supplierRun, historySearchTerm),
  );

  const visibleRuns =
    mode === "history" ? historyRuns : dailyRuns;
  const driverScopedRuns =
    isDriverView
      ? routeOrderDriverName
        ? visibleRuns.filter((supplierRun) =>
            driverNamesMatch(
              supplierRun.driver,
              routeOrderDriverName,
              safeEmployeeAliasMap,
            ),
          )
        : []
      : visibleRuns;
  const canViewSouthCustomerName = canEditSupplierRuns;
  const pickupSearchTerm = normalizeSearchText(pickupSearch);
  const filteredVisibleRuns =
    mode === "check" && checkViewMode === "list"
      ? driverScopedRuns.filter((supplierRun) =>
          supplierRunMatchesPickupSearch(
            supplierRun,
            pickupSearchTerm,
            canViewSouthCustomerName,
          ),
        )
      : driverScopedRuns;

  const openRuns = filteredVisibleRuns.filter(
    (supplierRun) => supplierRun.status !== "complete",
  );

  const routeOrdersByDriver = southRouteOrders
    .filter(
      (routeOrder) => routeOrder.dateKey === selectedScheduleDate,
    )
    .reduce(
      (ordersByDriver, routeOrder) => ({
        ...ordersByDriver,
        [
          safeEmployeeAliasMap[normalizeDriverName(routeOrder.driver)] ||
          routeOrder.driver ||
          UNASSIGNED_DRIVER
        ]: routeOrder,
      }),
      {},
    );

  const openRunGroups = groupRunsByDriverAndVendor(
    openRuns,
    mode === "check" ? routeOrdersByDriver : {},
    safeVendorRouteOrder,
    safeVendorDisplayNameMap,
    safeEmployeeAliasMap,
  );
  const openStopsCount = openRunGroups.reduce(
    (count, driverGroup) =>
      count + driverGroup.vendorGroups.length,
    0,
  );
  const openItemsCount = openRuns.reduce(
    (count, supplierRun) =>
      count +
      (Array.isArray(supplierRun.items)
        ? supplierRun.items.filter(
            (item) => !isPickupItemComplete(item),
          ).length
        : 0),
    0,
  );
  const historyDateGroups =
    groupHistoryRunsByPickupDate(
      filteredHistoryRuns,
      safeVendorRouteOrder,
      safeVendorDisplayNameMap,
    );
  const dispatchRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      (supplierRun.dispatchStatus === "needsDispatch" ||
        !supplierRun.driver),
  );
  const dispatchSearchTerm = normalizeSearchText(dispatchSearch);
  const filteredDispatchRuns = sortSupplierRunsByClosestPickupDate(
    dispatchRuns.filter((supplierRun) =>
      supplierRunMatchesSearch(supplierRun, dispatchSearchTerm),
    ),
  );
  const dispatchCalendarModalRun = dispatchCalendarModalRunId
    ? supplierRuns.find(
        (supplierRun) => supplierRun.id === dispatchCalendarModalRunId,
      ) || null
    : null;
  const isDispatchCalendarModalOpen = Boolean(
    dispatchViewMode !== "day" && dispatchCalendarModalRun,
  );
  const displayedDispatchRuns = isDispatchCalendarModalOpen
    ? [dispatchCalendarModalRun]
    : filteredDispatchRuns;
  const filteredDispatchRunIds = filteredDispatchRuns.map(
    (supplierRun) => supplierRun.id,
  );
  const selectedFilteredDispatchRuns = filteredDispatchRuns.filter(
    (supplierRun) => selectedDispatchRunIds.includes(supplierRun.id),
  );
  const allFilteredDispatchRunsSelected =
    filteredDispatchRunIds.length > 0 &&
    filteredDispatchRunIds.every((supplierRunId) =>
      selectedDispatchRunIds.includes(supplierRunId),
    );
  const selectedSupplierRunDateIsLocked =
    selectedSupplierRunDetails &&
    (selectedSupplierRunDetails.status === "complete" ||
      hasPickedUpItems(selectedSupplierRunDetails));
  const canMoveSelectedSupplierRunDate =
    selectedSupplierRunDetails &&
    canManageSupplierRun(selectedSupplierRunDetails) &&
    !selectedSupplierRunDateIsLocked;
  const pageTitle = getSouthPageTitle(mode);
  const displayPageTitle =
    mode === "check" && checkViewMode === "calendar"
      ? "South Calendar"
      : pageTitle;

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "South", onClick: () => onPageChange?.("south") },
          { label: displayPageTitle },
        ]}
      />

      <div className="mb-6">
        <div
          className={
            mode === "dispatch"
              ? "grid items-start gap-3 xl:grid-cols-[minmax(230px,0.8fr)_minmax(180px,0.35fr)_minmax(360px,1.15fr)_auto]"
              : "flex items-start justify-between gap-3"
          }
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
              Driver / South
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              {displayPageTitle}
            </h2>
          </div>

          {mode === "dispatch" ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500">
                Waiting For Assignment
              </p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="text-3xl font-black leading-none text-slate-900">
                  {filteredDispatchRuns.length}
                </p>

                {dispatchSearchTerm ? (
                  <p className="text-right text-xs font-bold text-slate-500">
                    of {dispatchRuns.length}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {mode === "dispatch" ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <label
                htmlFor="south-dispatch-search"
                className="mb-1.5 block text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500"
              >
                Search Dispatch
              </label>

              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    strokeWidth={2.4}
                  />
                  <input
                    id="south-dispatch-search"
                    type="search"
                    value={dispatchSearch}
                    onChange={(event) => setDispatchSearch(event.target.value)}
                    placeholder="PO, vendor, date, item, or notes"
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {dispatchSearch ? (
                  <button
                    type="button"
                    onClick={() => setDispatchSearch("")}
                    className="rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => onRefreshPage?.()}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-[#FC2C38]"
            aria-label="Refresh South"
            title="Refresh South"
          >
            <RefreshCw
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.6}
            />
          </button>
        </div>

        {mode === "check" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
              {formatDateInput(selectedScheduleDate)}
            </div>

            <button
              type="button"
              onClick={() =>
                setCheckViewMode((currentMode) =>
                  currentMode === "calendar" ? "list" : "calendar",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#dc1f2b]"
            >
              <CalendarDays
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.4}
              />
              {checkViewMode === "calendar" ? "View" : "Calendar"}
            </button>
          </div>
        ) : (
          <div className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            {getTodayHeading()}
          </div>
        )}

        <p className="mt-2 text-slate-500">
          {mode === "history"
            ? "Older completed South pickups stay here so the daily driver board stays focused."
            : mode === "dispatch"
              ? "Assign the driver and truck before the PO reaches the driver pickup board."
            : mode === "check"
              ? checkViewMode === "calendar"
                ? "See scheduled South POs by pickup date, then open a PO to review or move it."
                : "Drivers can check off scheduled South pickup items as they load them from each supplier."
              : "Add South PO requests before the driver leaves, while they are on the road, or schedule them ahead. Dispatch assigns driver and truck next."}
        </p>
      </div>

      {successMessage ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-bold text-red-700">
            ✓ {successMessage}
          </p>
        </div>
      ) : null}

      {mode === "add" ? (
        <SupplierRunForm
          onSubmit={handleSubmit}
          createdBy={createdBy}
          vehicleOptions={safeVehicleOptions}
          employeeOptions={safeEmployeeOptions}
          vendorOptions={vendorOptions}
          supplierAddressMap={supplierAddressMap}
          canAssignRoute={canAssignRoute}
        />
      ) : mode === "dispatch" ? (
        <section>
          <SouthDispatchCalendarView
            viewMode={dispatchViewMode}
            selectedDate={dispatchCalendarDate}
            supplierRuns={filteredDispatchRuns}
            onChangeView={(nextViewMode) => {
              setDispatchCalendarModalRunId("");
              setDispatchViewMode(nextViewMode);
            }}
            onChangeDate={setDispatchCalendarDate}
            onSelectRun={openDispatchRunFromCalendar}
            onMoveRun={moveDispatchRunFromCalendar}
          />

          {routeOrderError ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              {routeOrderError}
            </div>
          ) : null}

          {dispatchViewMode !== "day" &&
          !isDispatchCalendarModalOpen ? null : displayedDispatchRuns.length ===
            0 ? (
            <EmptyState
              title={
                dispatchSearchTerm
                  ? "No Needs Dispatch POs match that search"
                  : "No South POs need dispatch"
              }
              description={
                dispatchSearchTerm
                  ? "Clear the search to see every PO waiting for assignment."
                  : "Sales-created PO requests will appear here until dispatch assigns a driver and truck."
              }
            />
          ) : (
            <div
              role={isDispatchCalendarModalOpen ? "dialog" : undefined}
              aria-modal={isDispatchCalendarModalOpen ? "true" : undefined}
              aria-label={
                isDispatchCalendarModalOpen
                  ? `South dispatch PO ${dispatchCalendarModalRun?.poNumber || ""}`
                  : undefined
              }
              className={
                isDispatchCalendarModalOpen
                  ? "fixed inset-0 z-[120] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
                  : ""
              }
            >
              <div
                className={
                  isDispatchCalendarModalOpen
                    ? "mx-auto max-w-[1320px] space-y-4 rounded-[2rem] bg-slate-100 p-3 shadow-2xl sm:p-5"
                    : "space-y-4"
                }
              >
              {isDispatchCalendarModalOpen ? (
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 shadow-sm sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                      South dispatch PO
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-500">
                      Assign, edit, upload, or review without leaving the calendar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDispatchCalendarModalRunId("")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                    aria-label="Close South dispatch PO"
                  >
                    <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>
              ) : null}

              {isDispatchCalendarModalOpen && routeOrderError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                  {routeOrderError}
                </div>
              ) : null}

              {!isDispatchCalendarModalOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <label className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allFilteredDispatchRunsSelected}
                    onChange={() =>
                      toggleAllFilteredDispatchRuns(filteredDispatchRuns)
                    }
                    className="h-5 w-5 rounded border-slate-300 text-[#FC2C38] focus:ring-[#FC2C38]"
                  />
                  <span className="text-sm font-black text-slate-900">
                    Select all visible
                  </span>
                </label>

                <p className="text-sm font-bold text-slate-500">
                  {selectedFilteredDispatchRuns.length} selected
                </p>
                </div>
              ) : null}

              {!isDispatchCalendarModalOpen &&
              selectedFilteredDispatchRuns.length > 0 ? (
                <div className="sticky top-3 z-10 rounded-3xl border border-red-200 bg-red-50/95 p-4 shadow-lg backdrop-blur sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                      Bulk Assignment
                    </p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">
                      Assign {selectedFilteredDispatchRuns.length}{" "}
                      {selectedFilteredDispatchRuns.length === 1
                        ? "PO"
                        : "POs"}
                    </h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto]">
                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Driver
                      </span>
                      <select
                        value={bulkDispatchDraft.driver}
                        onChange={(event) =>
                          setBulkDispatchDraft((currentDraft) => ({
                            ...currentDraft,
                            driver: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="">Select...</option>
                        <optgroup label="Approved Users">
                          {safeEmployeeOptions.map((driverOption) => (
                            <option key={driverOption} value={driverOption}>
                              {driverOption}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Truck
                      </span>
                      <select
                        value={bulkDispatchDraft.vehicleId}
                        onChange={(event) =>
                          setBulkDispatchDraft((currentDraft) => ({
                            ...currentDraft,
                            vehicleId: event.target.value,
                          }))
                        }
                        disabled={safeVehicleOptions.length === 0}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">
                          {safeVehicleOptions.length > 0
                            ? "Select..."
                            : "No vehicles"}
                        </option>
                        {safeVehicleOptions.map((vehicleOption) => (
                          <option
                            key={vehicleOption.id}
                            value={vehicleOption.id}
                          >
                            {vehicleOption.title}
                            {vehicleOption.badge
                              ? ` (${vehicleOption.badge})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        assignSelectedSupplierRuns(
                          selectedFilteredDispatchRuns,
                        )
                      }
                      disabled={
                        selectedFilteredDispatchRuns.length === 0 ||
                        isBulkAssigning
                      }
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 self-end rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Truck
                        aria-hidden="true"
                        className="h-5 w-5"
                        strokeWidth={2.5}
                      />
                      {isBulkAssigning
                        ? "Assigning..."
                        : `Assign ${
                            selectedFilteredDispatchRuns.length || ""
                          }`}
                    </button>
                  </div>
                </div>
                </div>
              ) : null}

              {displayedDispatchRuns.map((supplierRun) => {
                const draft = getDispatchDraft(supplierRun);
                const pickupItems = Array.isArray(supplierRun.items)
                  ? supplierRun.items
                  : [];
                const itemCount = pickupItems.length;
                const pickupItemPreview = pickupItems.slice(0, 3);
                const remainingPickupItemCount = Math.max(
                  0,
                  itemCount - pickupItemPreview.length,
                );
                const runCustomerName =
                  getSupplierRunCustomerName(supplierRun);
                const createdAtLabel = formatCreatedAt(supplierRun.createdAt);
                const materialSummary =
                  getSupplierRunMaterialSummary(supplierRun);
                const isStockRequest =
                  materialSummary.materialUses.length > 0 &&
                  materialSummary.materialUses.every(
                    (materialUse) => materialUse === "stock",
                  );
                const primaryOrderNumber =
                  materialSummary.orderNumbers[0] || "";
                const remainingOrderCount = Math.max(
                  materialSummary.orderNumbers.length - 1,
                  0,
                );
                const requestBadgeLabel = isStockRequest
                  ? "Stock Replenishment"
                  : "Customer Order";
                const requestBadgeClass = isStockRequest
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-blue-200 bg-blue-50 text-blue-800";
                const isVendorReturn =
                  supplierRun.runType === "vendorReturn" ||
                  supplierRun.routeStopType === "vendorReturn" ||
                  supplierRun.deliveryScope === "vendorReturn" ||
                  supplierRun.vendorReturn === true;
                const isSelectedForDispatch =
                  selectedDispatchRunIds.includes(supplierRun.id);
                const isEditingPickupDate =
                  dispatchDateEdit.supplierRunId === supplierRun.id;

                return (
                  <article
                    key={supplierRun.id}
                    className={`rounded-3xl border bg-white p-4 shadow-sm transition sm:p-5 ${
                      isSelectedForDispatch
                        ? "border-red-300 ring-4 ring-red-50"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                            South Request
                          </p>

                          {!isDispatchCalendarModalOpen ? (
                            <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                            <input
                              type="checkbox"
                              checked={isSelectedForDispatch}
                              onChange={() =>
                                toggleSelectedDispatchRun(supplierRun.id)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-[#FC2C38] focus:ring-[#FC2C38]"
                            />
                            Select
                            </label>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <h3 className="text-3xl font-black leading-none tracking-tight text-slate-950">
                            PO {supplierRun.poNumber}
                          </h3>

                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] ${requestBadgeClass}`}
                          >
                            {isStockRequest ? (
                              <Package
                                aria-hidden="true"
                                className="h-4 w-4"
                                strokeWidth={2.5}
                              />
                            ) : (
                              <User
                                aria-hidden="true"
                                className="h-4 w-4"
                                strokeWidth={2.5}
                              />
                            )}
                            {requestBadgeLabel}
                          </span>

                          {isVendorReturn ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-amber-950">
                              <ArrowUpRight
                                aria-hidden="true"
                                className="h-4 w-4"
                                strokeWidth={2.7}
                              />
                              Return to vendor
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                            <Home aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" strokeWidth={2.4} />
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Supplier</p>
                              <p className="mt-0.5 truncate text-sm font-black text-slate-950">{supplierRun.vendor || "Unknown Supplier"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 border-t border-red-100 bg-red-50 px-4 py-3 sm:border-l sm:border-t-0">
                            <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-[#FC2C38]" strokeWidth={2.7} />
                            {isEditingPickupDate ? (
                              <div className="min-w-[220px]">
                                <label className="text-[10px] font-black uppercase tracking-[0.12em] text-red-600">
                                  Pickup Date
                                  <input
                                    type="date"
                                    value={dispatchDateEdit.date}
                                    onChange={(event) =>
                                      setDispatchDateEdit((currentEdit) => ({
                                        ...currentEdit,
                                        date: event.target.value,
                                        error: "",
                                      }))
                                    }
                                    className="mt-1 block w-full rounded-lg border border-red-200 bg-white px-2 py-1.5 text-sm font-black text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-2 focus:ring-red-100"
                                  />
                                </label>
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => saveDispatchPickupDate(supplierRun)}
                                    disabled={savingDispatchDateRunId === supplierRun.id}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FC2C38] px-2.5 text-xs font-black text-white transition hover:bg-red-600 disabled:bg-red-300"
                                  >
                                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                                    {savingDispatchDateRunId === supplierRun.id ? "Saving" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelDispatchDateEdit}
                                    disabled={savingDispatchDateRunId === supplierRun.id}
                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                    aria-label="Cancel pickup date edit"
                                  >
                                    <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.8} />
                                  </button>
                                </div>
                                {dispatchDateEdit.error ? (
                                  <p className="mt-2 text-xs font-bold text-red-700">
                                    {dispatchDateEdit.error}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <>
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-600">Pickup Date</p>
                                  <p className="mt-0.5 whitespace-nowrap text-base font-black text-red-950">
                                    {formatDateInput(getSupplierRunDateKey(supplierRun))}
                                  </p>
                                </div>
                                {canManageSupplierRun(supplierRun) ? (
                                  <button
                                    type="button"
                                    onClick={() => beginDispatchDateEdit(supplierRun)}
                                    className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 transition hover:border-[#FC2C38] hover:bg-red-100"
                                    aria-label={`Edit pickup date for PO ${supplierRun.poNumber || ""}`}
                                    title="Edit pickup date"
                                  >
                                    <Edit3 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.7} />
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3 sm:border-l sm:border-t-0">
                            <Package aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" strokeWidth={2.4} />
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Items</p>
                              <p className="mt-0.5 whitespace-nowrap text-sm font-black text-slate-950">{itemCount} to pick up</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FC2C38] text-white shadow-sm">
                                <Package
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                  strokeWidth={2.5}
                                />
                              </span>
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.13em] text-slate-900">
                                  Items to pick up
                                </p>
                                <p className="text-[11px] font-bold text-slate-500">
                                  {itemCount} {itemCount === 1 ? "line item" : "line items"}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setDispatchCalendarModalRunId("");
                                setViewingSupplierRun(supplierRun);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"
                            >
                              View all
                              <ArrowUpRight
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                                strokeWidth={2.6}
                              />
                            </button>
                          </div>

                          {pickupItemPreview.length > 0 ? (
                            <div className="grid divide-y divide-slate-100 xl:grid-cols-3 xl:divide-x xl:divide-y-0">
                              {pickupItemPreview.map((item, itemIndex) => (
                                <div
                                  key={
                                    item.id ||
                                    `${supplierRun.id}-dispatch-item-${itemIndex}`
                                  }
                                  className="flex min-w-0 items-start gap-3 px-3 py-3 sm:px-4"
                                >
                                  <span className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#FC2C38] ring-1 ring-red-100">
                                    Qty {item.quantity || "—"}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-black leading-5 text-slate-900">
                                      {item.description || "No description"}
                                    </p>
                                    {item.internalReference ? (
                                      <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">
                                        Ref {item.internalReference}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-4 py-3 text-sm font-bold text-slate-500">
                              No pickup items were added to this PO.
                            </p>
                          )}

                          {remainingPickupItemCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchCalendarModalRunId("");
                                setViewingSupplierRun(supplierRun);
                              }}
                              className="w-full border-t border-slate-100 bg-slate-50 px-4 py-2 text-left text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                            >
                              +{remainingPickupItemCount} more {remainingPickupItemCount === 1 ? "item" : "items"}
                            </button>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                          <div className="flex items-start gap-2">
                            {isStockRequest ? (
                              <Package aria-hidden="true" className="mt-0.5 h-4 w-4 text-emerald-700" strokeWidth={2.4} />
                            ) : (
                              <User aria-hidden="true" className="mt-0.5 h-4 w-4 text-blue-700" strokeWidth={2.4} />
                            )}
                            <div>
                              <p className="text-slate-500">{isStockRequest ? "Destination" : "Customer"}</p>
                              <p className="font-black text-slate-950">
                                {isStockRequest
                                  ? "Inventory"
                                  : canViewSouthCustomerName && runCustomerName
                                    ? runCustomerName
                                    : "Customer Order"}
                              </p>
                            </div>
                          </div>

                          {!isStockRequest ? (
                            <div className="flex items-start gap-2">
                              <Tag aria-hidden="true" className="mt-0.5 h-4 w-4 text-orange-700" strokeWidth={2.4} />
                              <div>
                                <p className="text-slate-500">Order #</p>
                                <p className="font-black text-slate-950">
                                  {primaryOrderNumber || "Not entered"}
                                  {remainingOrderCount > 0 ? ` +${remainingOrderCount}` : ""}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {supplierRun.orderedBy ? (
                            <div className="flex items-start gap-2">
                              <User
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 text-slate-700"
                                strokeWidth={2.4}
                              />
                              <div>
                                <p className="text-slate-500">Ordered by</p>
                                <p className="font-black text-slate-950">
                                  {supplierRun.orderedBy}
                                </p>
                              </div>
                            </div>
                          ) : null}
                          {createdAtLabel ? (
                            <div className="flex items-start gap-2">
                              <CalendarDays
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 text-slate-700"
                                strokeWidth={2.4}
                              />
                              <div>
                                <p className="text-slate-500">Entered</p>
                                <p className="font-black text-slate-950">
                                  {createdAtLabel}
                                </p>
                              </div>
                            </div>
                          ) : null}
                          {supplierRun.createdByName ||
                          supplierRun.createdByEmail ? (
                            <div className="flex items-start gap-2">
                              <User
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 text-slate-700"
                                strokeWidth={2.4}
                              />
                              <div>
                                <p className="text-slate-500">Created by</p>
                                <p className="font-black text-slate-950">
                                  {supplierRun.createdByName ||
                                    supplierRun.createdByEmail}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:content-start">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                            Assignment
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            Choose a driver and truck.
                          </p>
                        </div>

                        <OrderCopyAttachments
                          recordType="south"
                          recordId={supplierRun.id}
                          documents={supplierRun.orderCopyDocuments}
                          compact
                          onChange={(orderCopyDocuments) =>
                            onUpdateSupplierRun?.(supplierRun.id, {
                              orderCopyDocuments,
                              updatedAt: new Date().toISOString(),
                            })
                          }
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-sm font-semibold text-slate-900">
                            Driver
                          </span>
                          <select
                            value={draft.driver}
                            onChange={(event) =>
                              updateDispatchDraft(
                                supplierRun.id,
                                "driver",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                          >
                            <option value="">Select...</option>
                            <optgroup label="Approved Users">
                              {safeEmployeeOptions.map((driverOption) => (
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
                          <span className="mb-1 block text-sm font-semibold text-slate-900">
                            Truck
                          </span>
                          <select
                            value={draft.vehicleId}
                            onChange={(event) =>
                              updateDispatchDraft(
                                supplierRun.id,
                                "vehicleId",
                                event.target.value,
                              )
                            }
                            disabled={safeVehicleOptions.length === 0}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="">
                              {safeVehicleOptions.length > 0
                                ? "Select..."
                                : "No vehicles"}
                            </option>
                            {safeVehicleOptions.map((vehicleOption) => (
                              <option
                                key={vehicleOption.id}
                                value={vehicleOption.id}
                              >
                                {vehicleOption.title}
                                {vehicleOption.badge
                                  ? ` (${vehicleOption.badge})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => assignSupplierRun(supplierRun)}
                          disabled={savingDispatchRunId === supplierRun.id}
                          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <Truck
                            aria-hidden="true"
                            className="h-5 w-5"
                            strokeWidth={2.5}
                          />
                          {savingDispatchRunId === supplierRun.id
                            ? "Assigning..."
                            : "Assign Driver"}
                        </button>

                        {canManageSupplierRun(supplierRun) ? (
                          <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchCalendarModalRunId("");
                                setEditingSupplierRun(supplierRun);
                              }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                            >
                              <Edit3
                                aria-hidden="true"
                                className="h-5 w-5"
                                strokeWidth={2.5}
                              />
                              Edit PO
                            </button>

                            {typeof onDeleteSupplierRun === "function" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDispatchCalendarModalRunId("");
                                  onDeleteSupplierRun(supplierRun.id);
                                }}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                                title="Remove this PO from Needs Dispatch"
                              >
                                <Trash2
                                  aria-hidden="true"
                                  className="h-5 w-5"
                                  strokeWidth={2.5}
                                />
                                Remove PO
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
              </div>
            </div>
          )}
        </section>
      ) : mode === "history" ? (
        <section>
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Completed South POs
            </p>

            <p className="mt-1 text-3xl font-black text-slate-900">
              {filteredHistoryRuns.length}
            </p>

            {historySearchTerm ? (
              <p className="mt-1 text-sm font-bold text-slate-500">
                Showing {filteredHistoryRuns.length} of {historyRuns.length}
              </p>
            ) : null}
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="south-history-search"
              className="mb-2 block text-sm font-black text-slate-700"
            >
              Search South history
            </label>
            <div className="flex items-center gap-2">
              <input
                id="south-history-search"
                type="search"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search PO, vendor, driver, item, order #..."
                className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
              {historySearch ? (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {historyRuns.length === 0 ? (
            <EmptyState
              title="No completed South POs"
              description="Completed pickups will show here by route date."
            />
          ) : filteredHistoryRuns.length === 0 ? (
            <EmptyState
              title="No South history matches"
              description="Try searching by PO number, vendor, driver, item, or date."
            />
          ) : (
            <div className="space-y-5">
              {historyDateGroups.map((dateGroup) => (
                <div
                  key={dateGroup.dateKey}
                  className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 py-1">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                        Route Date
                      </p>
                      <h4 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                        {dateGroup.label}
                      </h4>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">
                      {dateGroup.runs.length}{" "}
                      {dateGroup.runs.length === 1 ? "PO" : "POs"}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {dateGroup.driverGroups.map((group) => {
                      const driverAvatar = getDriverAvatar(group.driver);
                      const driverKey = `${dateGroup.dateKey}::${group.driver}`;
                      const driverIsOpen = isDriverOpen(
                        driverKey,
                        "history",
                      );
                      return (
                        <div
                          key={driverKey}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              toggleDriver(driverKey, "history")
                            }
                            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-slate-100"
                            aria-expanded={driverIsOpen}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black ${driverAvatar.colorClass}`}
                                aria-hidden="true"
                              >
                                {driverAvatar.initial}
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                  Driver
                                </p>

                                <h5 className="truncate text-lg font-black tracking-tight text-slate-800">
                                  {group.driver}
                                </h5>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
                                {group.vendorGroups.reduce(
                                  (count, vendorGroup) =>
                                    count + vendorGroup.runs.length,
                                  0,
                                )}{" "}
                                POs
                              </div>

                              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                                <ChevronDown
                                  aria-hidden="true"
                                  className={`h-5 w-5 transition-transform ${
                                    driverIsOpen ? "rotate-180" : ""
                                  }`}
                                  strokeWidth={2.6}
                                />
                              </span>
                            </div>
                          </button>

                          {driverIsOpen ? (
                            <div className="mt-3 space-y-4">
                              {group.vendorGroups.map((vendorGroup) => {
                                const stats =
                                  getVendorGroupStats(vendorGroup);
                                const stopKey = `${dateGroup.dateKey}::${group.driver}::${vendorGroup.vendor}`;
                                const stopIsOpen = isStopOpen(
                                  group.driver,
                                  stopKey,
                                  "history",
                                );

                                return (
                                  <div
                                    key={vendorGroup.vendor}
                                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleStop(
                                          group.driver,
                                          stopKey,
                                          "history",
                                        )
                                      }
                                      className="relative flex w-full min-w-0 flex-col gap-3 px-4 py-3 pr-14 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:pr-4"
                                      aria-expanded={stopIsOpen}
                                    >
                                      <div className="flex min-w-0 items-center gap-3">
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FC2C38] text-white shadow-sm sm:h-11 sm:w-11">
                                          <Home
                                            aria-hidden="true"
                                            className="h-6 w-6"
                                            strokeWidth={2.5}
                                          />
                                        </span>

                                        <div className="min-w-0">
                                          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                            Stop
                                          </p>

                                          <h6 className="truncate text-base font-black text-slate-800">
                                            {vendorGroup.vendor}
                                          </h6>

                                          <p className="mt-1 text-sm font-semibold text-slate-500">
                                            {stats.poCount}{" "}
                                            {stats.poCount === 1
                                              ? "PO"
                                              : "POs"}{" "}
                                            • {stats.itemCount} items
                                          </p>
                                        </div>
                                      </div>

                                      <div className="absolute right-3 top-3 flex shrink-0 items-center gap-3 sm:static">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                                        <ChevronDown
                                          aria-hidden="true"
                                          className={`h-5 w-5 transition-transform ${
                                            stopIsOpen ? "rotate-180" : ""
                                          }`}
                                          strokeWidth={2.6}
                                        />
                                        </span>
                                      </div>
                                    </button>

                                    {stopIsOpen ? (
                                      <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                        {vendorGroup.runs.map(
                                          (supplierRun) => (
                                            <SupplierRunCard
                                              key={supplierRun.id}
                                              supplierRun={getDisplaySupplierRun(
                                                supplierRun,
                                              )}
                                              onSavePickupPhoto={
                                                onSaveSupplierRunItemPickupPhoto
                                              }
                                              onUpdateItemDescription={
                                                onUpdateSupplierRunItemDescription
                                              }
                                              onDelete={
                                                canManageSupplierRun(supplierRun)
                                                  ? onDeleteSupplierRun
                                                  : undefined
                                              }
                                              isCompletedSection
                                              showCustomerName={
                                                canViewSouthCustomerName
                                              }
                                              customerNameTruncate={false}
                                            />
                                          ),
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          {checkViewMode === "calendar" ? (
            <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                    <CalendarDays
                      aria-hidden="true"
                      className="h-4 w-4"
                      strokeWidth={2.4}
                    />
                    South Schedule
                  </p>

                  <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    Scheduled South POs
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeCalendarMonth(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                    aria-label="Previous month"
                  >
                    <ChevronLeft
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={2.5}
                    />
                  </button>

                  <div className="min-w-36 rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-black text-slate-900">
                    {getMonthLabel(calendarMonth)}
                  </div>

                  <button
                    type="button"
                    onClick={() => changeCalendarMonth(1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                    aria-label="Next month"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={2.5}
                    />
                  </button>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {[
                      "Sun",
                      "Mon",
                      "Tue",
                      "Wed",
                      "Thu",
                      "Fri",
                      "Sat",
                    ].map((dayLabel) => (
                      <div key={dayLabel} className="py-2">
                        {dayLabel}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                      const dayRuns = runsByDate[day.key] || [];
                      const isSelected =
                        selectedScheduleDate === day.key;

                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() =>
                            setSelectedScheduleDate(day.key)
                          }
                          className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl border text-sm font-black transition sm:min-h-16 ${
                            isSelected
                              ? "border-[#FC2C38] bg-red-50 text-[#FC2C38]"
                              : day.inCurrentMonth
                                ? "border-slate-200 bg-white text-slate-800 hover:border-red-200 hover:bg-red-50"
                                : "border-slate-100 bg-slate-50 text-slate-300"
                          }`}
                        >
                          <span
                            className={
                              day.isToday
                                ? "flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white"
                                : ""
                            }
                          >
                            {day.day}
                          </span>

                          {dayRuns.length > 0 ? (
                            <span
                              className="mt-1 h-1.5 w-1.5 rounded-full bg-[#FC2C38]"
                              aria-label={`${dayRuns.length} South POs`}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {formatDateInput(selectedScheduleDate)}
                  </p>

                  <h3 className="mt-1 text-2xl font-black text-slate-900">
                    {selectedScheduleRuns.length}{" "}
                    {selectedScheduleRuns.length === 1
                      ? "South PO"
                      : "South POs"}
                  </h3>

                  <div className="mt-4 space-y-3">
                    {selectedScheduleRuns.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                        No South POs scheduled for this date.
                      </p>
                    ) : (
                      selectedScheduleRuns.map((supplierRun) => {
                        const itemCount = Array.isArray(
                          supplierRun.items,
                        )
                          ? supplierRun.items.length
                          : 0;
                        const runCustomerName =
                          getSupplierRunCustomerName(supplierRun);

                        return (
                          <button
                            key={supplierRun.id}
                            type="button"
                            onClick={() =>
                              setViewingSupplierRun(supplierRun)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-red-200 hover:bg-red-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-lg font-black text-slate-900">
                                  {supplierRun.poNumber || "No PO #"}
                                </p>

                                <p className="mt-1 truncate text-sm font-bold text-slate-600">
                                  {supplierRun.vendor ||
                                    "Unknown Supplier"}
                                </p>

                                {canViewSouthCustomerName &&
                                runCustomerName ? (
                                  <CustomerNameBadge
                                    name={runCustomerName}
                                    prefix=""
                                    className="mt-1"
                                  />
                                ) : null}
                              </div>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                                  supplierRun.status === "complete"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {supplierRun.status === "complete"
                                  ? "Complete"
                                  : "Open"}
                              </span>
                            </div>

                            <p className="mt-2 text-xs font-bold text-slate-500">
                              Driver:{" "}
                              {supplierRun.driver || "Unassigned"} •{" "}
                              {itemCount}{" "}
                              {itemCount === 1 ? "item" : "items"}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </aside>
              </div>
            </div>
          ) : null}

          {checkViewMode === "list" ? (
          <>

          {!isDriverView ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <label
              htmlFor="south-pickup-search"
              className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
            >
              Search POs To Pick Up
            </label>

            <div className="flex items-center gap-2">
              <span className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.4}
                />
                <input
                  id="south-pickup-search"
                  type="search"
                  value={pickupSearch}
                  onChange={(event) => setPickupSearch(event.target.value)}
                  placeholder={
                    canViewSouthCustomerName
                      ? "Search PO #, customer, or item #"
                      : "Search PO # or item #"
                  }
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </span>

              {pickupSearch ? (
                <button
                  type="button"
                  onClick={() => setPickupSearch("")}
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          ) : null}

          <div className="mb-5 hidden grid-cols-2 gap-2 sm:grid sm:gap-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-2 py-3 text-center sm:px-4 sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-blue-700 sm:text-xs sm:tracking-[0.18em]">
                Open Stops
              </p>

              <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                {openStopsCount}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-2 py-3 text-center sm:px-4 sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-700 sm:text-xs sm:tracking-[0.18em]">
                Items Left
              </p>

              <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                {openItemsCount}
              </p>
            </div>
          </div>

          {visibleRuns.length === 0 ? (
            <EmptyState
              title="No South POs scheduled for this date"
              description="Choose another date on the calendar to view scheduled South pickups."
            />
          ) : null}

          {visibleRuns.length > 0 && filteredVisibleRuns.length === 0 ? (
            <EmptyState
              title="No South POs match that search"
              description={
                canViewSouthCustomerName
                  ? "Search by PO number, customer name, or item number."
                  : "Search by PO number or item number."
              }
            />
          ) : null}

          {filteredVisibleRuns.length > 0 && openRuns.length === 0 ? (
            <EmptyState
              title="No South POs left to pick up"
              description="Choose another pickup date or view South History for past POs."
            />
          ) : null}

          {openRuns.length > 0 ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900">
                    Open Stops
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Work these first. Stops are grouped by driver, then supplier.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {openRunGroups.map((driverGroup) => {
                  const driverAvatar = getDriverAvatar(
                    driverGroup.driver,
                  );
                  const driverIsOpen = isDriverOpen(
                    driverGroup.driver,
                  );
                  const vehicleLabel =
                    getDriverGroupVehicleLabel(driverGroup);
                  const driverPoCount =
                    driverGroup.vendorGroups.reduce(
                      (count, vendorGroup) =>
                        count + vendorGroup.runs.length,
                      0,
                    );
                  return (
                    <div
                      key={driverGroup.driver}
                      className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3 shadow-sm ring-1 ring-blue-100 sm:p-4"
                    >
                      <button
                        type="button"
                        onClick={() => toggleDriver(driverGroup.driver)}
                        className="mb-4 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-4 text-left shadow-sm sm:hidden"
                        aria-expanded={driverIsOpen}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-black ${driverAvatar.colorClass}`}
                            aria-hidden="true"
                          >
                            {driverAvatar.initial}
                          </div>

                          <div className="min-w-0">
                            <h4 className="truncate text-lg font-black leading-tight text-slate-900">
                              {driverGroup.driver}
                            </h4>

                            {vehicleLabel ? (
                              <p className="mt-1 truncate text-xs font-black text-slate-500">
                                Truck {vehicleLabel}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex min-w-[72px] items-center justify-center gap-1.5 border-l border-slate-200 pl-2">
                          <ClipboardList
                            aria-hidden="true"
                            className="h-6 w-6 text-blue-700"
                            strokeWidth={2.4}
                          />
                          <div>
                            <p className="text-sm font-black leading-tight text-slate-900">
                              {driverPoCount}{" "}
                              {driverPoCount === 1 ? "PO" : "POs"}
                            </p>
                            <p className="mt-1 text-xs font-semibold leading-tight text-slate-500">
                              {driverPoCount} pickups
                            </p>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleDriver(driverGroup.driver)}
                        className="mb-4 hidden w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-blue-50 sm:block"
                        aria-expanded={driverIsOpen}
                      >
                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black ${driverAvatar.colorClass}`}
                              aria-hidden="true"
                            >
                              {driverAvatar.initial}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="hidden text-xs font-black uppercase tracking-[0.2em] text-blue-700 sm:block">
                                Driver Route
                              </p>

                              <div className="flex min-w-0 items-center gap-2 sm:mt-1">
                                <h4 className="min-w-0 flex-1 truncate text-2xl font-black tracking-tight text-slate-900">
                                  {driverGroup.driver}
                                </h4>

                                <span className="shrink-0 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-800 sm:hidden">
                                  {driverPoCount}{" "}
                                  {driverPoCount === 1 ? "PO" : "POs"}
                                </span>

                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm sm:hidden">
                                  <ChevronDown
                                    aria-hidden="true"
                                    className={`h-5 w-5 transition-transform ${
                                      driverIsOpen ? "rotate-180" : ""
                                    }`}
                                    strokeWidth={2.6}
                                  />
                                </span>
                              </div>

                              {vehicleLabel ? (
                                <p className="mt-1 text-sm font-black text-slate-500">
                                  Truck {vehicleLabel}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="hidden shrink-0 items-center gap-2 sm:flex">
                            <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-800">
                              {driverPoCount}{" "}
                              {driverPoCount === 1 ? "PO" : "POs"}
                            </div>

                            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm">
                              <ChevronDown
                                aria-hidden="true"
                                className={`h-5 w-5 transition-transform ${
                                  driverIsOpen ? "rotate-180" : ""
                                }`}
                                strokeWidth={2.6}
                              />
                            </span>
                          </div>
                        </div>
                      </button>

                      {routeOrderError ? (
                        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                          {routeOrderError}
                        </div>
                      ) : null}

                    {driverIsOpen ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 px-1">
                        <h5 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">
                          Stops
                        </h5>
                        <span className="text-xs font-bold text-slate-400">
                          {driverGroup.vendorGroups.length}{" "}
                          {driverGroup.vendorGroups.length === 1
                            ? "stop"
                            : "stops"}
                        </span>
                      </div>

                      {driverGroup.vendorGroups.map((vendorGroup, vendorIndex) => {
                        const stats = getVendorGroupStats(vendorGroup);
                        const supplierAddress =
                          getVendorGroupAddress(vendorGroup);
                        const isCurrentStop = vendorIndex === 0;
                        const isNextStop = vendorIndex === 1;
                        const stopStageLabel = isCurrentStop
                          ? "Current Stop"
                          : isNextStop
                            ? "Next Stop"
                            : "Stop";
                        const stopNumber = String(vendorIndex + 1).padStart(
                          2,
                          "0",
                        );
                        const stopDefaultOpen = isDriverView
                          ? isCurrentStop
                          : true;
                        const stopIsOpen = isStopOpen(
                          driverGroup.driver,
                          vendorGroup.vendor,
                          "open",
                          stopDefaultOpen,
                        );
                        return (
                          <div
                            key={vendorGroup.vendor}
                            data-south-route-stop="true"
                            data-south-route-driver={driverGroup.driver}
                            data-south-route-vendor={vendorGroup.vendor}
                            draggable={
                              canReorderRoute &&
                              driverGroup.vendorGroups.length > 1
                            }
                            onDragStart={() =>
                              canReorderRoute
                                ? setDraggingStop({
                                    driver: driverGroup.driver,
                                    vendor: vendorGroup.vendor,
                                  })
                                : undefined
                            }
                            onDragOver={(event) => {
                              if (
                                draggingStop?.driver === driverGroup.driver
                              ) {
                                event.preventDefault();
                                setDragOverStop({
                                  driver: driverGroup.driver,
                                  vendor: vendorGroup.vendor,
                                });
                              }
                            }}
                            onDrop={() =>
                              handleStopDrop(
                                driverGroup.driver,
                                vendorGroup.vendor,
                                driverGroup.vendorGroups,
                              )
                            }
                            onDragEnd={() => {
                              setDraggingStop(null);
                              setDragOverStop(null);
                            }}
                            className={`overflow-hidden rounded-2xl border bg-white transition ${
                              draggingStop?.driver === driverGroup.driver &&
                              draggingStop?.vendor === vendorGroup.vendor
                                ? "border-blue-300 opacity-60"
                                : dragOverStop?.driver === driverGroup.driver &&
                                    dragOverStop?.vendor === vendorGroup.vendor
                                  ? "border-blue-400 ring-2 ring-blue-100"
                                : isCurrentStop
                                  ? "border-red-100"
                                  : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-stretch gap-2 sm:gap-3">
                              {canReorderRoute &&
                              driverGroup.vendorGroups.length > 1 ? (
                                <div
                                  className="flex w-11 touch-none shrink-0 select-none flex-col items-center justify-center gap-1 border-r border-slate-100 bg-slate-50 px-1 sm:w-10 sm:cursor-grab sm:px-0 sm:active:cursor-grabbing"
                                  title="Drag to reorder this vendor stop"
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Drag ${vendorGroup.vendor} to change its route position`}
                                  onPointerDown={(event) =>
                                    handleStopPointerDown(
                                      event,
                                      driverGroup.driver,
                                      vendorGroup.vendor,
                                    )
                                  }
                                  onPointerMove={handleStopPointerMove}
                                  onPointerUp={(event) =>
                                    handleStopPointerEnd(
                                      event,
                                      driverGroup.vendorGroups,
                                    )
                                  }
                                  onPointerCancel={handleStopPointerCancel}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMoveStop(
                                        driverGroup.driver,
                                        driverGroup.vendorGroups,
                                        vendorGroup.vendor,
                                        -1,
                                      )
                                    }
                                    disabled={vendorIndex === 0}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 sm:hidden"
                                    aria-label={`Move ${vendorGroup.vendor} earlier in route`}
                                  >
                                    <ArrowUp
                                      aria-hidden="true"
                                      className="h-4 w-4"
                                      strokeWidth={2.6}
                                    />
                                  </button>

                                  <GripVertical
                                    aria-hidden="true"
                                    className="hidden h-5 w-5 text-slate-400 sm:block"
                                    strokeWidth={2.4}
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMoveStop(
                                        driverGroup.driver,
                                        driverGroup.vendorGroups,
                                        vendorGroup.vendor,
                                        1,
                                      )
                                    }
                                    disabled={
                                      vendorIndex ===
                                      driverGroup.vendorGroups.length - 1
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 sm:hidden"
                                    aria-label={`Move ${vendorGroup.vendor} later in route`}
                                  >
                                    <ArrowDown
                                      aria-hidden="true"
                                      className="h-4 w-4"
                                      strokeWidth={2.6}
                                    />
                                  </button>
                                </div>
                              ) : null}

                              <div className="relative min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleStop(
                                      driverGroup.driver,
                                      vendorGroup.vendor,
                                      "open",
                                      stopDefaultOpen,
                                    )
                                  }
                                  className="flex w-full min-w-0 flex-col gap-3 px-4 py-4 pr-12 text-left transition hover:bg-red-50/40 sm:flex-row sm:items-center sm:justify-between sm:py-3 sm:pr-4"
                                  aria-expanded={stopIsOpen}
                                >
                                <div className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-black shadow-sm sm:hidden ${
                                      isCurrentStop
                                        ? "bg-red-50 text-[#FC2C38]"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {stopNumber}
                                  </span>

                                  <span
                                    className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FC2C38] text-white shadow-sm sm:flex"
                                  >
                                    <Home
                                      aria-hidden="true"
                                      className="h-7 w-7"
                                      strokeWidth={2.5}
                                    />
                                  </span>

                                  <div className="min-w-0">
                                    <p
                                      className={`mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] sm:hidden ${
                                        isCurrentStop
                                          ? "text-[#FC2C38]"
                                          : "text-slate-500"
                                      }`}
                                    >
                                      {stopStageLabel}
                                    </p>

                                    <h5 className="truncate text-xl font-black leading-tight text-slate-900">
                                      {vendorGroup.vendor}
                                    </h5>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {!isDriverView ? (
                                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-black leading-tight text-slate-900">
                                          {stats.poCount}{" "}
                                          {stats.poCount === 1 ? "PO" : "POs"}
                                        </span>
                                      ) : null}

                                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-black leading-tight text-slate-900">
                                        {stats.remainingItems}{" "}
                                        {stats.remainingItems === 1
                                          ? "item"
                                          : "items"}{" "}
                                        left
                                      </span>
                                    </div>

                                    {supplierAddress ? (
                                      <a
                                        href={getDirectionsUrl(
                                          supplierAddress,
                                        )}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-black text-[#FC2C38] transition hover:bg-red-100 sm:hidden"
                                        aria-label={`Directions to ${vendorGroup.vendor}`}
                                      >
                                        <Navigation
                                          aria-hidden="true"
                                          className="h-3.5 w-3.5 fill-current"
                                          strokeWidth={2.4}
                                        />
                                        Get Directions
                                      </a>
                                    ) : null}

                                  </div>
                                </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleStop(
                                      driverGroup.driver,
                                      vendorGroup.vendor,
                                      "open",
                                      stopDefaultOpen,
                                    )
                                  }
                                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-700 transition hover:bg-slate-100 sm:hidden"
                                  aria-label={
                                    stopIsOpen
                                      ? `Close ${vendorGroup.vendor}`
                                      : `Open ${vendorGroup.vendor}`
                                  }
                                  aria-expanded={stopIsOpen}
                                >
                                  <ChevronDown
                                    aria-hidden="true"
                                    className={`h-5 w-5 transition-transform ${
                                      stopIsOpen ? "rotate-180" : ""
                                    }`}
                                    strokeWidth={2.6}
                                  />
                                </button>
                              </div>

                              <div className="flex shrink-0 flex-col items-end justify-start gap-2.5 py-4 pr-4 sm:flex-row sm:items-center sm:justify-center sm:gap-2 sm:py-0 sm:pr-5">
                                {supplierAddress ? (
                                  <a
                                    href={getDirectionsUrl(
                                      supplierAddress,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hidden h-9 items-center justify-center gap-1 rounded-full bg-[#FC2C38] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#dc1f2b] sm:inline-flex"
                                    aria-label={`Directions to ${vendorGroup.vendor}`}
                                  >
                                    <ArrowUpRight
                                      aria-hidden="true"
                                      className="h-3.5 w-3.5"
                                      strokeWidth={2.6}
                                    />
                                    <span>Directions</span>
                                  </a>
                                ) : null}

                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  {!isDriverView ? (
                                    <span className="hidden rounded-lg bg-white px-2.5 py-1.5 text-xs font-black text-blue-800 shadow-sm sm:inline-flex sm:px-3">
                                      {stats.poCount}{" "}
                                      {stats.poCount === 1
                                        ? "PO"
                                        : "POs"}
                                    </span>
                                  ) : null}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleStop(
                                        driverGroup.driver,
                                        vendorGroup.vendor,
                                        "open",
                                        stopDefaultOpen,
                                      )
                                    }
                                    className="hidden h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 sm:flex"
                                    aria-label={
                                      stopIsOpen
                                        ? `Close ${vendorGroup.vendor}`
                                        : `Open ${vendorGroup.vendor}`
                                    }
                                    aria-expanded={stopIsOpen}
                                  >
                                    <ChevronDown
                                      aria-hidden="true"
                                      className={`h-5 w-5 transition-transform ${
                                        stopIsOpen ? "rotate-180" : ""
                                      }`}
                                      strokeWidth={2.6}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {stopIsOpen ? (
                              <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                {vendorGroup.runs.map((supplierRun) => (
                                  <SupplierRunCard
                                    key={supplierRun.id}
                                    supplierRun={getDisplaySupplierRun(
                                      supplierRun,
                                    )}
                                    onSavePickupPhoto={
                                      onSaveSupplierRunItemPickupPhoto
                                    }
                                    onUpdateItemDescription={
                                      onUpdateSupplierRunItemDescription
                                    }
                                    onUnassign={
                                      canManageSupplierRun(supplierRun) &&
                                      supplierRun.status !== "complete" &&
                                      String(supplierRun.driver || "").trim()
                                        ? (run) => {
                                            setUnassignError("");
                                            setSupplierRunToUnassign(run);
                                          }
                                        : undefined
                                    }
                                    onEdit={
                                      canManageSupplierRun(supplierRun)
                                        ? setEditingSupplierRun
                                        : undefined
                                    }
                                    onDelete={
                                      canManageSupplierRun(supplierRun)
                                        ? onDeleteSupplierRun
                                        : undefined
                                    }
                                    showCustomerName={
                                      canViewSouthCustomerName
                                    }
                                    defaultItemsOpen={
                                      isDriverView
                                        ? isCurrentStop
                                        : vendorGroup.runs.length === 1
                                    }
                                    compactWhenClosed={
                                      isDriverView
                                        ? !isCurrentStop
                                        : vendorGroup.runs.length > 1
                                    }
                                    driverFocused={isDriverView}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          </>
          ) : null}
        </section>
      )}

      {editingSupplierRun && canManageSupplierRun(editingSupplierRun) ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close PO editor"
            onClick={() => setEditingSupplierRun(null)}
          />

          <section
            className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-w-5xl sm:rounded-3xl"
            aria-modal="true"
            role="dialog"
            aria-label={`Edit South PO ${
              editingSupplierRun.poNumber || ""
            }`.trim()}
          >
            <div className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="min-w-0 justify-self-start">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Edit South PO
                </p>
                <h3 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900">
                  {editingSupplierRun.poNumber || "No PO #"}
                </h3>
              </div>

              {editingSupplierRun.status !== "complete" &&
              String(editingSupplierRun.driver || "").trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setUnassignError("");
                    setSupplierRunToUnassign(editingSupplierRun);
                  }}
                  className="min-h-[40px] justify-self-center whitespace-nowrap rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 sm:px-4 sm:text-sm"
                >
                  Unassign driver
                </button>
              ) : (
                <span aria-hidden="true" />
              )}

              <button
                type="button"
                onClick={() => setEditingSupplierRun(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center justify-self-end rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Close PO editor"
              >
                <X
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={2.5}
                />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <SupplierRunForm
                onSubmit={handleEditSubmit}
                createdBy={createdBy}
                vehicleOptions={safeVehicleOptions}
                employeeOptions={safeEmployeeOptions}
                vendorOptions={vendorOptions}
                supplierAddressMap={supplierAddressMap}
                canAssignRoute={
                  editingSupplierRun.dispatchStatus !== "needsDispatch"
                }
                initialSupplierRun={getDisplaySupplierRun(editingSupplierRun)}
                onCancel={() => setEditingSupplierRun(null)}
              />
            </div>
          </section>
        </div>
      ) : null}

      {selectedSupplierRunDetails ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close PO details"
            onClick={() => setViewingSupplierRun(null)}
          />

          <section
            className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
            aria-modal="true"
            role="dialog"
            aria-labelledby="south-po-detail-title"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  South PO Details
                </p>

                <h3
                  id="south-po-detail-title"
                  className="mt-1 truncate text-3xl font-black tracking-tight text-slate-900"
                >
                  {selectedSupplierRunDetails.poNumber || "No PO #"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setViewingSupplierRun(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Close PO details"
              >
                <X
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={2.5}
                />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Supplier
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {selectedSupplierRunDetails.vendor ||
                      "Unknown Supplier"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Driver
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {selectedSupplierRunDetails.driver || "Unassigned"}
                  </p>
                </div>

                {canViewSouthCustomerName &&
                getSupplierRunCustomerName(selectedSupplierRunDetails) ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <CustomerNameBadge
                      name={getSupplierRunCustomerName(
                        selectedSupplierRunDetails,
                      )}
                      className="text-sm"
                    />
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Pickup Date
                  </p>

                  {canMoveSelectedSupplierRunDate ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="date"
                        value={dateMoveDraft}
                        onChange={(event) => {
                          setDateMoveDraft(event.target.value);
                          setDateMoveError("");
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />

                      <button
                        type="button"
                        onClick={handleMoveSelectedSupplierRunDate}
                        disabled={
                          savingDateMove ||
                          dateMoveDraft ===
                            getSupplierRunDateKey(
                              selectedSupplierRunDetails,
                            )
                        }
                        className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white transition hover:bg-[#dc1f2b] disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {savingDateMove ? "Moving..." : "Move PO Date"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-lg font-black text-slate-900">
                        {formatDateInput(
                          getSupplierRunDateKey(
                            selectedSupplierRunDetails,
                          ),
                        )}
                      </p>

                      {selectedSupplierRunDateIsLocked ? (
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Date locked after pickup starts.
                        </p>
                      ) : null}
                    </>
                  )}

                  {dateMoveError ? (
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      {dateMoveError}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Status
                  </p>
                  <p
                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                      selectedSupplierRunDetails.status === "complete"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {selectedSupplierRunDetails.status === "complete"
                      ? "Complete"
                      : "Open"}
                  </p>
                </div>
              </div>

              {selectedSupplierRunDetails.supplierAddress ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Address
                  </p>

                  <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-bold text-slate-800">
                      {selectedSupplierRunDetails.supplierAddress}
                    </p>

                    <a
                      href={getDirectionsUrl(
                        selectedSupplierRunDetails.supplierAddress,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-2 text-sm font-black text-white transition hover:bg-[#dc1f2b]"
                    >
                      Directions
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={2.6}
                      />
                    </a>
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Pickup Items
                    </p>

                    <h4 className="mt-1 text-xl font-black text-slate-900">
                      {Array.isArray(selectedSupplierRunDetails.items)
                        ? selectedSupplierRunDetails.items.length
                        : 0}{" "}
                      items
                    </h4>
                  </div>
                </div>

                <div className="space-y-3">
                  {Array.isArray(selectedSupplierRunDetails.items) &&
                  selectedSupplierRunDetails.items.length > 0 ? (
                    selectedSupplierRunDetails.items.map((item) => {
                      const itemPickedUp = isPickupItemComplete(item);

                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border px-4 py-3 ${
                            itemPickedUp
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              {item.quantity ? (
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                                  QTY: {item.quantity}
                                </p>
                              ) : null}

                              <p className="mt-1 text-base font-black text-slate-900">
                                {item.description || "No description"}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                                {item.internalReference ? (
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                    SKU / SO: {item.internalReference}
                                  </span>
                                ) : null}

                                <span
                                  className={`rounded-full px-3 py-1 ${getMaterialUseBadgeClass(
                                    item.materialUse,
                                  )}`}
                                >
                                  {getMaterialUseLabel(item.materialUse)}
                                  {item.orderNumber
                                    ? ` ${item.orderNumber}`
                                    : ""}
                                </span>
                              </div>

                              {item.returnNotes ? (
                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                                    Return / swap notes
                                  </p>
                                  <p className="mt-1">{item.returnNotes}</p>
                                </div>
                              ) : null}
                            </div>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                                itemPickedUp
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {itemPickedUp
                                ? "Picked Up"
                                : item.materialUse === "return"
                                  ? "Needs Returned"
                                  : item.materialUse === "swap"
                                    ? "Needs Swapped"
                                    : "Needs Pickup"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-slate-500">
                      No items listed on this PO.
                    </p>
                  )}
                </div>
              </div>

              {canManageSupplierRun(selectedSupplierRunDetails) &&
              selectedSupplierRunDetails.status !== "complete" &&
              String(selectedSupplierRunDetails.driver || "").trim() ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-amber-950">
                      Supplier could not complete this pickup?
                    </p>
                    <p className="mt-1 text-xs font-bold text-amber-800">
                      Remove the driver and truck, then return this PO to South
                      Needs Dispatch.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUnassignError("");
                      setSupplierRunToUnassign(
                        selectedSupplierRunDetails,
                      );
                    }}
                    className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-black text-amber-900 shadow-sm transition hover:bg-amber-100"
                  >
                    Unassign from driver
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {bulkDateConfirmation ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-south-date-confirmation-title"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Cancel moving future South POs to today"
            onClick={() => {
              if (!isBulkAssigning) {
                setBulkDateConfirmation(null);
              }
            }}
          />

          <section className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                  Future pickup dates selected
                </p>
                <h3
                  id="bulk-south-date-confirmation-title"
                  className="mt-1 text-2xl font-black tracking-tight text-slate-950"
                >
                  Switch these POs to today?
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setBulkDateConfirmation(null)}
                disabled={isBulkAssigning}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-white text-slate-600 shadow-sm transition hover:border-amber-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close date confirmation"
              >
                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-black text-amber-950">
                  {bulkDateConfirmationFutureRuns.length}{" "}
                  {bulkDateConfirmationFutureRuns.length === 1
                    ? "selected PO is"
                    : "selected POs are"}{" "}
                  dated after today.
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
                  Review the PO numbers, dates, and notes below. Confirming will
                  move these POs to {formatDateInput(todayKey)} and then assign
                  all {bulkDateConfirmationSelectedRuns.length} selected POs to{" "}
                  {bulkDispatchDraft.driver}.
                </p>
              </div>

              <div className="space-y-3">
                {bulkDateConfirmationFutureRuns.map((supplierRun) => {
                  const dispatchNotes = getSupplierRunDispatchNotes(supplierRun);

                  return (
                    <article
                      key={supplierRun.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#FC2C38]">
                            PO {supplierRun.poNumber || "No PO #"}
                          </p>
                          <p className="mt-1 truncate text-lg font-black text-slate-950">
                            {getDisplayVendorName(
                              supplierRun.vendor,
                              safeVendorDisplayNameMap,
                            )}
                          </p>
                        </div>

                        <span className="w-fit shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">
                          Currently {formatDateInput(supplierRun.scheduledDate)}
                        </span>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Notes to read
                        </p>
                        {dispatchNotes.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {dispatchNotes.map((note) => (
                              <p
                                key={note}
                                className="text-sm font-bold leading-5 text-slate-800"
                              >
                                {note}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm font-semibold text-slate-500">
                            No driver notes were added to this PO.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setBulkDateConfirmation(null)}
                  disabled={isBulkAssigning}
                  className="min-h-[50px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel and review dates
                </button>
                <button
                  type="button"
                  onClick={() =>
                    assignSelectedSupplierRuns(
                      bulkDateConfirmationSelectedRuns,
                      { confirmFutureDateMove: true },
                    )
                  }
                  disabled={
                    isBulkAssigning ||
                    bulkDateConfirmationSelectedRuns.length === 0
                  }
                  className="min-h-[50px] rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isBulkAssigning
                    ? "Moving and assigning..."
                    : "Move to today and assign"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {supplierRunToUnassign ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unassign-south-po-title"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Cancel unassigning South PO"
            onClick={() => {
              if (!unassigningSupplierRunId) {
                setSupplierRunToUnassign(null);
                setUnassignError("");
              }
            }}
          />

          <section className="relative w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
              Return to Dispatch
            </p>
            <h3
              id="unassign-south-po-title"
              className="mt-2 text-2xl font-black tracking-tight text-slate-950"
            >
              Unassign PO {supplierRunToUnassign.poNumber || ""}?
            </h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              This removes {supplierRunToUnassign.driver || "the driver"} and
              the assigned truck. The PO and its items will stay open and move
              back to South Needs Dispatch.
            </p>

            {unassignError ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {unassignError}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSupplierRunToUnassign(null);
                  setUnassignError("");
                }}
                disabled={Boolean(unassigningSupplierRunId)}
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                No, keep assigned
              </button>
              <button
                type="button"
                onClick={handleConfirmUnassignSupplierRun}
                disabled={Boolean(unassigningSupplierRunId)}
                className="min-h-[48px] rounded-xl bg-amber-500 px-4 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {unassigningSupplierRunId
                  ? "Unassigning..."
                  : "Yes, unassign"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PageContainer>
  );
}
