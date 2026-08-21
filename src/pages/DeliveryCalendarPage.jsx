import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Edit3,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
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
  getTodayDateValue,
  scheduleWindowsOverlap,
  timeToMinutes,
} from "../utils/deliverySchedule";
import { formatCustomerName } from "../utils/textFormatters";

const timelineStartMinutes = 8 * 60;
const timelineEndMinutes = 17 * 60;
const timelinePixelsPerMinute = 1.25;
const timelineHeight =
  (timelineEndMinutes - timelineStartMinutes) * timelinePixelsPerMinute;

const timelineHourMarks = Array.from({ length: 10 }, (_, index) => {
  const minutes = timelineStartMinutes + index * 60;
  const hours = Math.floor(minutes / 60);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return {
    minutes,
    label: `${displayHours} ${period}`,
  };
});

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

function formatDateLabel(dateValue) {
  if (!dateValue) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateValue}T12:00:00`));
}

function getScheduledDeliveries(deliveries, selectedDate) {
  return deliveries
    .filter(
      (delivery) =>
        delivery.status !== "complete" &&
        delivery.dispatchStatus !== "needsDispatch" &&
        delivery.driver &&
        delivery.deliveryDate === selectedDate,
    )
    .sort((firstDelivery, secondDelivery) =>
      String(firstDelivery.deliveryTimeSlot || "99:99").localeCompare(
        String(secondDelivery.deliveryTimeSlot || "99:99"),
      ),
    );
}

function getDeliveryDrivers(delivery) {
  const drivers = Array.isArray(delivery.drivers)
    ? delivery.drivers.filter(Boolean)
    : [];

  return [...new Set([delivery.driver, ...drivers].filter(Boolean))];
}

function groupDeliveriesByDriver(deliveries) {
  return deliveries.reduce((groups, delivery) => {
    const drivers = getDeliveryDrivers(delivery);

    drivers.forEach((driver) => {
      groups[driver] = [...(groups[driver] || []), delivery];
    });

    return groups;
  }, {});
}

function deliveriesShareDriver(firstDelivery, secondDelivery) {
  const firstDrivers = getDeliveryDrivers(firstDelivery);
  const secondDrivers = getDeliveryDrivers(secondDelivery);

  return firstDrivers.some((driver) => secondDrivers.includes(driver));
}

function findScheduleConflict(candidateDelivery, deliveries) {
  const candidateWindow = getDeliveryTimeWindow(candidateDelivery);

  if (!candidateDelivery.deliveryDate || !candidateWindow) {
    return null;
  }

  return deliveries.find(
    (delivery) =>
      delivery.id !== candidateDelivery.id &&
      delivery.status !== "complete" &&
      delivery.dispatchStatus !== "needsDispatch" &&
      delivery.deliveryDate === candidateDelivery.deliveryDate &&
      deliveriesShareDriver(candidateDelivery, delivery) &&
      scheduleWindowsOverlap(candidateWindow, getDeliveryTimeWindow(delivery)),
  );
}

function getTimelineBlockStyle(delivery) {
  const startMinutes = timeToMinutes(delivery.deliveryTimeSlot || "");
  const safeStartMinutes =
    startMinutes === null ? timelineStartMinutes : startMinutes;
  const top = Math.max(
    0,
    (safeStartMinutes - timelineStartMinutes) * timelinePixelsPerMinute,
  );
  const height = Math.max(
    128,
    getDeliveryTotalBlockMinutes(delivery) * timelinePixelsPerMinute,
  );

  return {
    top,
    height,
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
        <div
          className="grid min-w-[980px] gap-3"
          style={{
            gridTemplateColumns: `72px repeat(${driverNames.length}, minmax(230px, 1fr))`,
          }}
        >
          <div />
          {driverNames.map((driverName) => (
            <div
              key={driverName}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
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
          ))}

          <div
            className="relative border-r border-slate-200 pr-2"
            style={{ height: timelineHeight }}
          >
            {timelineHourMarks.map((hourMark) => (
              <div
                key={hourMark.minutes}
                className="absolute right-2 text-right text-[11px] font-black uppercase tracking-[0.08em] text-slate-400"
                style={{
                  top:
                    (hourMark.minutes - timelineStartMinutes) *
                    timelinePixelsPerMinute,
                  transform: "translateY(-50%)",
                }}
              >
                {hourMark.label}
              </div>
            ))}
          </div>

          {driverNames.map((driverName) => (
            <div
              key={driverName}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80"
              style={{ height: timelineHeight }}
            >
              {timelineHourMarks.map((hourMark) => (
                <span
                  key={hourMark.minutes}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-slate-200/80"
                  style={{
                    top:
                      (hourMark.minutes - timelineStartMinutes) *
                      timelinePixelsPerMinute,
                  }}
                />
              ))}

              {deliveriesByDriver[driverName].map((delivery) => {
                const blockStyle = getTimelineBlockStyle(delivery);
                const isSelected = selectedDeliveryId === delivery.id;

                return (
                  <button
                    key={delivery.id}
                    type="button"
                    onClick={() => onSelectDelivery(delivery.id)}
                    className={`absolute inset-x-2 flex flex-col overflow-hidden rounded-2xl border p-3 text-left shadow-sm transition ${
                      isSelected
                        ? "border-[#FC2C38] bg-red-50 ring-2 ring-red-100"
                        : "border-blue-200 bg-white hover:border-[#FC2C38] hover:bg-red-50/40"
                    }`}
                    style={blockStyle}
                  >
                    <span className="min-h-0 flex-1">
                      <span className="block truncate text-[11px] font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                        {getDeliveryTimeRange(delivery)}
                      </span>
                      <span className="mt-1 block truncate text-lg font-black text-slate-950">
                        {formatCustomerName(delivery.customerName) ||
                          "Unnamed customer"}
                      </span>
                      <span className="mt-1 block truncate text-sm font-bold text-slate-500">
                        Order {delivery.orderNumber}
                      </span>
                    </span>

                    <span className="mt-2 flex shrink-0 flex-wrap gap-1.5">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
                        Site {getDeliverySiteArrivalLabel(delivery)}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                        Back {getDeliveryBackAroundLabel(delivery)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompactDeliveryCard({
  delivery,
  deliveries,
  expanded,
  canEditDeliveries,
  onEditDelivery,
  onUpdateDelivery,
  isUpdating,
  onToggle,
  hideToggle = false,
}) {
  const scopeSummary = getDeliveryScopeSummary(delivery);
  const driveMinutes = getDeliveryDriveMinutes(delivery);

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

        {canEditDeliveries ? (
          <button
            type="button"
            onClick={() => onEditDelivery(delivery.id)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
            aria-label={`Edit delivery ${delivery.orderNumber}`}
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
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
            One-way drive ETA: {driveMinutes || 0} min · Site around{" "}
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
                <label className="block">
                  <span className="mb-1 block text-xs font-black text-slate-500">
                    Date
                  </span>
                  <input
                    type="date"
                    value={delivery.deliveryDate || ""}
                    onChange={(event) =>
                      onUpdateDelivery(delivery, {
                        deliveryDate: event.target.value,
                      })
                    }
                    disabled={isUpdating}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>

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
  canEditDeliveries = false,
  onEditDelivery,
  onUpdateDelivery,
  onPageChange,
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateValue());
  const [expandedDeliveryIds, setExpandedDeliveryIds] = useState({});
  const [selectedTimelineDeliveryId, setSelectedTimelineDeliveryId] =
    useState("");
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState("");
  const [error, setError] = useState("");

  const scheduledDeliveries = useMemo(
    () => getScheduledDeliveries(deliveries, selectedDate),
    [deliveries, selectedDate],
  );
  const deliveriesByDriver = useMemo(
    () => groupDeliveriesByDriver(scheduledDeliveries),
    [scheduledDeliveries],
  );
  const driverNames = Object.keys(deliveriesByDriver).sort((first, second) =>
    first.localeCompare(second),
  );
  const selectedTimelineDelivery =
    scheduledDeliveries.find(
      (delivery) => delivery.id === selectedTimelineDeliveryId,
    ) || scheduledDeliveries[0];

  function toggleDelivery(deliveryId) {
    setExpandedDeliveryIds((currentExpandedDeliveryIds) => ({
      ...currentExpandedDeliveryIds,
      [deliveryId]: !currentExpandedDeliveryIds[deliveryId],
    }));
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
    const conflict = findScheduleConflict(candidateDelivery, deliveries);

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

    try {
      await onUpdateDelivery(delivery.id, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (updateError) {
      console.error("Unable to move delivery:", updateError);
      setError("Unable to move that delivery. Try again.");
    } finally {
      setUpdatingDeliveryId("");
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

        <label className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Schedule Date
          </span>

          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 lg:w-60"
          />
        </label>
      </div>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-900">
              {formatDateLabel(selectedDate)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {scheduledDeliveries.length}{" "}
              {scheduledDeliveries.length === 1 ? "delivery" : "deliveries"}{" "}
              across {driverNames.length}{" "}
              {driverNames.length === 1 ? "driver" : "drivers"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onPageChange?.("deliveries-dispatch")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            <Truck className="h-4 w-4" aria-hidden="true" />
            Needs Dispatch
          </button>
        </div>
      </section>

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {scheduledDeliveries.length === 0 ? (
        <EmptyState
          title="No deliveries scheduled"
          description="Assigned deliveries with this date will show here by driver."
        />
      ) : (
        <>
          <DeliveryTimelineBoard
            driverNames={driverNames}
            deliveriesByDriver={deliveriesByDriver}
            selectedDeliveryId={selectedTimelineDelivery?.id || ""}
            onSelectDelivery={setSelectedTimelineDeliveryId}
          />

          {selectedTimelineDelivery ? (
            <div className="mt-5 hidden xl:block">
              <CompactDeliveryCard
                delivery={selectedTimelineDelivery}
                deliveries={deliveries}
                expanded
                canEditDeliveries={canEditDeliveries}
                onEditDelivery={onEditDelivery}
                onUpdateDelivery={handleMoveDelivery}
                isUpdating={updatingDeliveryId === selectedTimelineDelivery.id}
                onToggle={toggleDelivery}
                hideToggle
              />
            </div>
          ) : null}

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
                      deliveries={deliveries}
                      expanded={Boolean(expandedDeliveryIds[delivery.id])}
                      canEditDeliveries={canEditDeliveries}
                      onEditDelivery={onEditDelivery}
                      onUpdateDelivery={handleMoveDelivery}
                      isUpdating={updatingDeliveryId === delivery.id}
                      onToggle={toggleDelivery}
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
                        deliveries={deliveries}
                        expanded={Boolean(expandedDeliveryIds[delivery.id])}
                        canEditDeliveries={canEditDeliveries}
                        onEditDelivery={onEditDelivery}
                        onUpdateDelivery={handleMoveDelivery}
                        isUpdating={updatingDeliveryId === delivery.id}
                        onToggle={toggleDelivery}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
