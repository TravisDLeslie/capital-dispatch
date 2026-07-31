import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import SupplierRunCard from "../components/SupplierRunCard";
import SupplierRunForm from "../components/SupplierRunForm";
import { southVendorRouteOrder } from "../data/options";
import {
  formatDateInput,
  getDateInputValue,
  getTodayHeading,
  isToday,
} from "../utils/dateHelpers";

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

function getVendorRouteIndex(vendor) {
  const normalizedVendor = normalizeVendorName(vendor);
  const routeIndex = southVendorRouteOrder.findIndex(
    (routeVendor) =>
      normalizeVendorName(routeVendor) === normalizedVendor,
  );

  return routeIndex === -1
    ? Number.MAX_SAFE_INTEGER
    : routeIndex;
}

function sortVendorGroups(vendorGroups) {
  return [...vendorGroups].sort((firstGroup, secondGroup) => {
    const firstIndex = getVendorRouteIndex(firstGroup.vendor);
    const secondIndex = getVendorRouteIndex(secondGroup.vendor);

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

function groupRunsByVendor(supplierRuns) {
  const vendorGroups = supplierRuns.reduce((groups, supplierRun) => {
    const vendor = supplierRun.vendor || "Unknown Supplier";
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

  return sortVendorGroups(vendorGroups);
}

function groupRunsByDriverAndVendor(supplierRuns) {
  return supplierRuns.reduce((driverGroups, supplierRun) => {
    const driver = supplierRun.driver || UNASSIGNED_DRIVER;
    const existingDriverGroup = driverGroups.find(
      (group) => group.driver === driver,
    );

    if (existingDriverGroup) {
      existingDriverGroup.vendorGroups = groupRunsByVendor([
        ...existingDriverGroup.vendorGroups.flatMap(
          (group) => group.runs,
        ),
        supplierRun,
      ]);
      return driverGroups;
    }

    return [
      ...driverGroups,
      {
        driver,
        vendorGroups: groupRunsByVendor([supplierRun]),
      },
    ];
  }, []);
}

function getDirectionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
}

function getDateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSupplierRunDateKey(supplierRun) {
  if (supplierRun.scheduledDate) {
    return supplierRun.scheduledDate;
  }

  if (supplierRun.createdAt) {
    return getDateKeyFromDate(new Date(supplierRun.createdAt));
  }

  return "";
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

export default function SupplierRunsPage({
  mode = "add",
  supplierRuns,
  onAddSupplierRun,
  onToggleSupplierRunItem,
  onUpdateSupplierRunItemDescription,
  onDeleteSupplierRun,
}) {
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
  const [checkViewMode, setCheckViewMode] = useState("list");
  const [viewingSupplierRun, setViewingSupplierRun] =
    useState(null);

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

  async function handleSubmit(supplierRun) {
    await onAddSupplierRun(supplierRun);

    setSuccessMessage(
      `PO ${supplierRun.poNumber} was scheduled for ${formatDateInput(
        supplierRun.scheduledDate,
      )} and sent to ${supplierRun.driver}'s South list.`,
    );
  }

  function toggleStop(driver, vendor, scope = "open") {
    const stopKey = `${scope}::${driver}::${vendor}`;

    setOpenStopKeys((currentOpenStopKeys) => ({
      ...currentOpenStopKeys,
      [stopKey]: !currentOpenStopKeys[stopKey],
    }));
  }

  function toggleDriver(driver, scope = "open") {
    const driverKey = `${scope}::${driver}`;

    setOpenDriverKeys((currentOpenDriverKeys) => ({
      ...currentOpenDriverKeys,
      [driverKey]: !currentOpenDriverKeys[driverKey],
    }));
  }

  function isDriverOpen(driver, scope = "open") {
    return Boolean(openDriverKeys[`${scope}::${driver}`]);
  }

  function isStopOpen(driver, vendor, scope = "open") {
    return Boolean(openStopKeys[`${scope}::${driver}::${vendor}`]);
  }

  function getVendorGroupStats(vendorGroup) {
    const items = vendorGroup.runs.flatMap((supplierRun) =>
      Array.isArray(supplierRun.items) ? supplierRun.items : [],
    );
    const remainingItems = items.filter(
      (item) => !item.pickedUp,
    ).length;

    return {
      poCount: vendorGroup.runs.length,
      itemCount: items.length,
      remainingItems,
    };
  }

  function getVendorGroupAddress(vendorGroup) {
    const runWithAddress = vendorGroup.runs.find(
      (supplierRun) =>
        typeof supplierRun.supplierAddress === "string" &&
        supplierRun.supplierAddress.trim(),
    );

    return runWithAddress?.supplierAddress?.trim() || "";
  }

  function getDriverGroupStats(driverGroup) {
    const items = driverGroup.vendorGroups.flatMap((vendorGroup) =>
      vendorGroup.runs.flatMap((supplierRun) =>
        Array.isArray(supplierRun.items) ? supplierRun.items : [],
      ),
    );
    const pickedUpItems = items.filter((item) => item.pickedUp).length;
    const remainingItems = items.length - pickedUpItems;
    const progressPercent =
      items.length > 0
        ? Math.round((pickedUpItems / items.length) * 100)
        : 0;

    return {
      itemCount: items.length,
      pickedUpItems,
      remainingItems,
      progressPercent,
    };
  }

  function getDriverStatsForRuns(driver, runs) {
    return getDriverGroupStats({
      driver,
      vendorGroups: groupRunsByVendor(
        runs.filter(
          (supplierRun) =>
            (supplierRun.driver || UNASSIGNED_DRIVER) === driver,
        ),
      ),
    });
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

  const runsByDate = supplierRuns.reduce((groups, supplierRun) => {
    const dateKey = getSupplierRunDateKey(supplierRun);

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
    ? supplierRuns.find(
        (supplierRun) => supplierRun.id === viewingSupplierRun.id,
      ) || viewingSupplierRun
    : null;

  const dailyRuns = supplierRuns.filter(
    (supplierRun) => {
      if (supplierRun.status === "complete") {
        return (
          getSupplierRunDateKey(supplierRun) === selectedScheduleDate &&
          isToday(supplierRun.completedAt || supplierRun.updatedAt)
        );
      }

      return getSupplierRunDateKey(supplierRun) === selectedScheduleDate;
    },
  );

  const historyRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status === "complete" &&
      !isToday(supplierRun.completedAt || supplierRun.updatedAt),
  );

  const visibleRuns =
    mode === "history" ? historyRuns : dailyRuns;

  const openRuns = visibleRuns.filter(
    (supplierRun) => supplierRun.status !== "complete",
  );

  const completeRuns = visibleRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );

  const openRunGroups = groupRunsByDriverAndVendor(openRuns);
  const completeRunGroups =
    groupRunsByDriverAndVendor(completeRuns);
  const openStopsCount = openRunGroups.reduce(
    (count, driverGroup) =>
      count + driverGroup.vendorGroups.length,
    0,
  );
  const openItemsCount = openRuns.reduce(
    (count, supplierRun) =>
      count +
      (Array.isArray(supplierRun.items)
        ? supplierRun.items.filter((item) => !item.pickedUp).length
        : 0),
    0,
  );
  const historyRunGroups =
    groupRunsByDriverAndVendor(historyRuns);

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
          Driver / South
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          {mode === "history"
            ? "History"
            : mode === "check"
              ? "Check South POs"
              : "Add South POs"}
        </h2>

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
            : mode === "check"
              ? "Drivers can check off scheduled South pickup items as they load them from each supplier."
              : "Dispatch can add South POs before the driver leaves, while they are on the road, or schedule them ahead."}
        </p>
      </div>

      {successMessage ? (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="font-bold text-blue-800">
            ✓ {successMessage}
          </p>
        </div>
      ) : null}

      {mode === "add" ? (
        <SupplierRunForm onSubmit={handleSubmit} />
      ) : mode === "history" ? (
        <section>
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Completed Before Today
            </p>

            <p className="mt-1 text-3xl font-black text-slate-900">
              {historyRuns.length}
            </p>
          </div>

          {historyRuns.length === 0 ? (
            <EmptyState
              title="No older completed South POs"
              description="Completed pickups will move here after today."
            />
          ) : (
            <div className="space-y-5">
              {historyRunGroups.map((group) => {
                const driverAvatar = getDriverAvatar(group.driver);
                const driverIsOpen = isDriverOpen(
                  group.driver,
                  "history",
                );

                return (
                  <div
                    key={group.driver}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        toggleDriver(group.driver, "history")
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

                          <h4 className="truncate text-lg font-black tracking-tight text-slate-800">
                            {group.driver}
                          </h4>
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
                          const stopIsOpen = isStopOpen(
                            group.driver,
                            vendorGroup.vendor,
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
                                    vendorGroup.vendor,
                                    "history",
                                  )
                                }
                                className="flex w-full min-w-0 flex-col gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                                aria-expanded={stopIsOpen}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                    Stop
                                  </p>

                                  <h5 className="truncate text-base font-black text-slate-800">
                                    {vendorGroup.vendor}
                                  </h5>

                                  <p className="mt-1 text-sm font-semibold text-slate-500">
                                    {stats.poCount}{" "}
                                    {stats.poCount === 1
                                      ? "PO"
                                      : "POs"}{" "}
                                    • {stats.itemCount} items
                                  </p>
                                </div>

                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                                  <ChevronDown
                                    aria-hidden="true"
                                    className={`h-5 w-5 transition-transform ${
                                      stopIsOpen ? "rotate-180" : ""
                                    }`}
                                    strokeWidth={2.6}
                                  />
                                </span>
                              </button>

                              {stopIsOpen ? (
                                <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                  {vendorGroup.runs.map(
                                    (supplierRun) => (
                                      <SupplierRunCard
                                        key={supplierRun.id}
                                        supplierRun={supplierRun}
                                        onToggleItem={
                                          onToggleSupplierRunItem
                                        }
                                        onUpdateItemDescription={
                                          onUpdateSupplierRunItemDescription
                                        }
                                        onDelete={onDeleteSupplierRun}
                                        isCompletedSection
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

          <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
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

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-2 py-3 text-center sm:px-4 sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700 sm:text-xs sm:tracking-[0.18em]">
                Completed POs
              </p>

              <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                {completeRuns.length}
              </p>
            </div>
          </div>

          {visibleRuns.length === 0 ? (
            <EmptyState
              title="No South POs scheduled for this date"
              description="Choose another date on the calendar to view scheduled South pickups."
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
                  const driverStats = getDriverStatsForRuns(
                    driverGroup.driver,
                    visibleRuns,
                  );
                  const driverAvatar = getDriverAvatar(
                    driverGroup.driver,
                  );
                  const driverIsOpen = isDriverOpen(
                    driverGroup.driver,
                  );

                  return (
                    <div
                      key={driverGroup.driver}
                      className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3 shadow-sm ring-1 ring-blue-100 sm:p-4"
                    >
                      <button
                        type="button"
                        onClick={() => toggleDriver(driverGroup.driver)}
                        className="mb-4 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-blue-50"
                        aria-expanded={driverIsOpen}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black ${driverAvatar.colorClass}`}
                              aria-hidden="true"
                            >
                              {driverAvatar.initial}
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                                Driver Route
                              </p>

                              <h4 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900">
                                {driverGroup.driver}
                              </h4>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-800">
                              {driverGroup.vendorGroups.reduce(
                                (count, vendorGroup) =>
                                  count + vendorGroup.runs.length,
                                0,
                              )}{" "}
                              POs
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

                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
                            <span className="text-slate-500">
                              Route Progress
                            </span>

                            <span className="text-emerald-700">
                              {driverStats.progressPercent}%
                            </span>
                          </div>

                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all"
                              style={{
                                width: `${driverStats.progressPercent}%`,
                              }}
                            />
                          </div>

                          <p className="mt-2 text-xs font-bold text-slate-500">
                            {driverStats.pickedUpItems}/
                            {driverStats.itemCount} items picked up
                            {driverStats.remainingItems > 0
                              ? ` • ${driverStats.remainingItems} left`
                              : " • complete"}
                          </p>
                        </div>
                      </button>

                    {driverIsOpen ? (
                    <div className="space-y-3 border-l-4 border-blue-200 pl-3">
                      {driverGroup.vendorGroups.map((vendorGroup) => {
                        const stats = getVendorGroupStats(vendorGroup);
                        const supplierAddress =
                          getVendorGroupAddress(vendorGroup);
                        const stopIsOpen = isStopOpen(
                          driverGroup.driver,
                          vendorGroup.vendor,
                        );

                        return (
                          <div
                            key={vendorGroup.vendor}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <div className="flex items-stretch gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleStop(
                                    driverGroup.driver,
                                    vendorGroup.vendor,
                                  )
                                }
                                className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                                aria-expanded={stopIsOpen}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                    Supplier Stop
                                  </p>

                                  <h5 className="truncate text-xl font-black text-slate-900">
                                    {vendorGroup.vendor}
                                  </h5>

                                  <p className="mt-1 text-sm font-semibold text-slate-500">
                                    {stats.remainingItems} left of{" "}
                                    {stats.itemCount} items
                                  </p>
                                </div>
                              </button>

                              <div className="flex shrink-0 flex-col items-end justify-center gap-2.5 py-4 pr-4 sm:flex-row sm:items-center sm:gap-2 sm:py-0 sm:pr-5">
                                {supplierAddress ? (
                                  <a
                                    href={getDirectionsUrl(
                                      supplierAddress,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-[#FC2C38] px-3.5 text-[11px] font-black text-white shadow-sm transition hover:bg-[#dc1f2b] sm:px-4 sm:text-xs"
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
                                  <span className="rounded-lg bg-white px-2 py-1.5 text-xs font-black text-blue-800 shadow-sm sm:px-3">
                                    {stats.poCount}{" "}
                                    {stats.poCount === 1
                                      ? "PO"
                                      : "POs"}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleStop(
                                        driverGroup.driver,
                                        vendorGroup.vendor,
                                      )
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
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
                                    supplierRun={supplierRun}
                                    onToggleItem={
                                      onToggleSupplierRunItem
                                    }
                                    onUpdateItemDescription={
                                      onUpdateSupplierRunItemDescription
                                    }
                                    onDelete={onDeleteSupplierRun}
                                    defaultItemsOpen={
                                      vendorGroup.runs.length === 1
                                    }
                                    compactWhenClosed={
                                      vendorGroup.runs.length > 1
                                    }
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
          ) : visibleRuns.length > 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5">
              <p className="text-lg font-black text-emerald-900">
                All South POs are checked off.
              </p>

              <p className="mt-1 text-sm font-semibold text-emerald-700">
                Completed stops are listed below for reference.
              </p>
            </div>
          ) : null}

          {completeRuns.length > 0 ? (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-800">
                    Completed Today
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Older completed South pickups move to History after today.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {completeRunGroups.map((driverGroup) => {
                  const driverAvatar = getDriverAvatar(
                    driverGroup.driver,
                  );
                  const driverIsOpen = isDriverOpen(
                    driverGroup.driver,
                    "complete",
                  );

                  return (
                    <div
                      key={driverGroup.driver}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleDriver(driverGroup.driver, "complete")
                        }
                        className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-slate-100"
                        aria-expanded={driverIsOpen}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black ${driverAvatar.colorClass}`}
                            aria-hidden="true"
                          >
                            {driverAvatar.initial}
                          </div>

                          <h4 className="truncate text-lg font-black tracking-tight text-slate-800">
                            {driverGroup.driver}
                          </h4>
                        </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
                          {driverGroup.vendorGroups.reduce(
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
                    <div className="space-y-4">
                      {driverGroup.vendorGroups.map((vendorGroup) => {
                        const stats = getVendorGroupStats(vendorGroup);
                        const supplierAddress =
                          getVendorGroupAddress(vendorGroup);
                        const stopIsOpen = isStopOpen(
                          driverGroup.driver,
                          vendorGroup.vendor,
                          "complete",
                        );

                        return (
                          <div
                            key={vendorGroup.vendor}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleStop(
                                    driverGroup.driver,
                                    vendorGroup.vendor,
                                    "complete",
                                  )
                                }
                                className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                                aria-expanded={stopIsOpen}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                    Supplier Stop
                                  </p>

                                  <h5 className="truncate text-lg font-black text-slate-800">
                                    {vendorGroup.vendor}
                                  </h5>

                                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                                    Complete • {stats.itemCount} items
                                  </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm">
                                    {stats.poCount}{" "}
                                    {stats.poCount === 1
                                      ? "PO"
                                      : "POs"}
                                  </span>

                                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
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

                              {supplierAddress ? (
                                <a
                                  href={getDirectionsUrl(supplierAddress)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mx-3 mb-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#dc1f2b] sm:mx-0 sm:my-3 sm:mr-3"
                                >
                                  Directions
                                  <ArrowUpRight
                                    aria-hidden="true"
                                    className="h-4 w-4"
                                    strokeWidth={2.6}
                                  />
                                </a>
                              ) : null}
                            </div>

                            {stopIsOpen ? (
                              <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                {vendorGroup.runs.map((supplierRun) => (
                                  <SupplierRunCard
                                    key={supplierRun.id}
                                    supplierRun={supplierRun}
                                    onToggleItem={onToggleSupplierRunItem}
                                    onUpdateItemDescription={
                                      onUpdateSupplierRunItemDescription
                                    }
                                    onDelete={onDeleteSupplierRun}
                                    isCompletedSection
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Pickup Date
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {formatDateInput(
                      getSupplierRunDateKey(
                        selectedSupplierRunDetails,
                      ),
                    )}
                  </p>
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
                    selectedSupplierRunDetails.items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          item.pickedUp
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

                              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                {item.materialUse === "stock"
                                  ? "Stock"
                                  : `Order${
                                      item.orderNumber
                                        ? ` ${item.orderNumber}`
                                        : ""
                                    }`}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                              item.pickedUp
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {item.pickedUp ? "Picked Up" : "Needs Pickup"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-slate-500">
                      No items listed on this PO.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </PageContainer>
  );
}
