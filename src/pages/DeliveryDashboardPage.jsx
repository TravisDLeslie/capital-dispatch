import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Clock,
  GripVertical,
  History,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import MarkDeliveredModal from "../components/MarkDeliveredModal";
import OrderDetailsModal from "../components/OrderDetailsModal";
import PageContainer from "../components/PageContainer";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import {
  getDeliveryBackAroundLabel,
  getDeliveryBlockSummary,
  getDeliverySiteArrivalLabel,
  getDeliveryTimeRange,
  getTodayDateValue,
  getTimeSlotLabel,
} from "../utils/deliverySchedule";
import { formatCustomerName } from "../utils/textFormatters";

function formatDateLabel(dateValue) {
  if (!dateValue) {
    return "No date selected";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateValue}T12:00:00`));
}

function getDeliveryDrivers(delivery) {
  const dispatchDrivers = Array.isArray(delivery.dispatchAssignments)
    ? delivery.dispatchAssignments.map((assignment) => assignment?.driver)
    : [];
  const legacyDrivers = Array.isArray(delivery.drivers) ? delivery.drivers : [];

  return [
    ...new Set(
      [delivery.driver, ...legacyDrivers, ...dispatchDrivers]
        .map((driver) => String(driver || "").trim())
        .filter(Boolean),
    ),
  ];
}

function hasHardwarePhoto(delivery) {
  return Boolean(
    (Array.isArray(delivery?.hardwarePhotos) &&
      delivery.hardwarePhotos.some((photo) => photo?.dataUrl)) ||
      delivery?.hardwarePhoto?.dataUrl,
  );
}

function getOpenDeliveryList(deliveries) {
  return (Array.isArray(deliveries) ? deliveries : []).filter(
    (delivery) =>
      delivery &&
      typeof delivery === "object" &&
      !isDeliveryComplete(delivery) &&
      delivery.dispatchStatus !== "needsDispatch" &&
      getDeliveryDrivers(delivery).length > 0,
  );
}

function sortDeliveriesBySchedule(firstDelivery, secondDelivery) {
  const firstDate = String(firstDelivery.deliveryDate || "9999-99-99");
  const secondDate = String(secondDelivery.deliveryDate || "9999-99-99");

  if (firstDate !== secondDate) {
    return firstDate.localeCompare(secondDate);
  }

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

  return String(firstDelivery.deliveryTimeSlot || "99:99").localeCompare(
    String(secondDelivery.deliveryTimeSlot || "99:99"),
  );
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

function ActionButton({ icon: Icon, title, detail, tone = "default", onClick }) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
    red: "border-red-200 bg-red-50 text-[#FC2C38] hover:border-red-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300",
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition ${toneClasses[tone]}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black">{title}</span>
        <span className="mt-0.5 block text-xs font-bold text-slate-500">
          {detail}
        </span>
      </span>
    </button>
  );
}

function ScheduleDeliveryCard({
  delivery,
  deliveryIndex,
  deliveryCount,
  canReorder,
  isDragging,
  isDragOver,
  isReordering,
  canMarkDelivered,
  isMarkingDelivered,
  onOpenQueue,
  onViewOrder,
  onMarkDelivered,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const scopeSummary = getDeliveryScopeSummary(delivery);

  return (
    <article
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
        isDragOver && !isDragging
          ? "border-blue-300 ring-4 ring-blue-100"
          : "border-slate-200"
      } ${isDragging ? "opacity-55" : ""}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Order {delivery.orderNumber || "No order"}
            </p>
            <h3 className="mt-1 truncate text-xl font-black text-slate-950">
              {formatCustomerName(delivery.customerName) || "No customer"}
            </h3>
            <p className="mt-2 flex items-start gap-2 text-sm font-bold leading-5 text-slate-600">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <span>{delivery.address || "Delivery address not entered"}</span>
            </p>
          </div>

          <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
            {getTimeSlotLabel(delivery.deliveryTimeSlot || "")}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
            Site {getDeliverySiteArrivalLabel(delivery)}
          </span>
          <span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
            Back {getDeliveryBackAroundLabel(delivery)}
          </span>
          <span className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-700">
            {scopeSummary.shortLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {getDeliveryTimeRange(delivery)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {getDeliveryBlockSummary(delivery)}
          </span>
          {delivery.hasHardware && !hasHardwarePhoto(delivery) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-[#FC2C38]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Hardware
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onViewOrder}
            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-slate-800"
          >
            View Order
          </button>
          <button
            type="button"
            onClick={onOpenQueue}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
          >
            Open Delivery
          </button>
          {canMarkDelivered ? (
            <button
              type="button"
              onClick={onMarkDelivered}
              disabled={isMarkingDelivered}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {isMarkingDelivered ? "Saving..." : "Mark Delivered"}
            </button>
          ) : null}
        </div>
      </div>

      {canReorder ? (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              draggable={!isReordering}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              disabled={isReordering}
              className="hidden h-9 w-9 cursor-grab items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
              aria-label={`Drag order ${delivery.orderNumber} to a new stop position`}
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>

            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Stop {deliveryIndex + 1} of {deliveryCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={deliveryIndex === 0 || isReordering}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Move order ${delivery.orderNumber} up one stop`}
              title="Move up"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={deliveryIndex === deliveryCount - 1 || isReordering}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Move order ${delivery.orderNumber} down one stop`}
              title="Move down"
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DriverScheduleColumn({
  driver,
  deliveries,
  canReorder,
  draggingDeliveryId,
  dragOverDeliveryId,
  reorderingRouteId,
  canMarkDelivered,
  markingDeliveredId,
  onOpenQueue,
  onViewOrder,
  onMarkDelivered,
  onMoveDelivery,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-sm font-black text-[#FC2C38]">
            {driver.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Driver
            </p>
            <h3 className="text-xl font-black text-slate-950">{driver}</h3>
          </div>
        </div>

        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-slate-700 shadow-sm">
          {deliveries.length} {deliveries.length === 1 ? "stop" : "stops"}
        </span>
      </div>

      <div className="grid gap-3">
        {deliveries.map((delivery, deliveryIndex) => (
          <ScheduleDeliveryCard
            key={`${driver}-${delivery.id}`}
            delivery={delivery}
            deliveryIndex={deliveryIndex}
            deliveryCount={deliveries.length}
            canReorder={canReorder}
            isDragging={draggingDeliveryId === delivery.id}
            isDragOver={dragOverDeliveryId === delivery.id}
            isReordering={Boolean(reorderingRouteId)}
            canMarkDelivered={canMarkDelivered}
            isMarkingDelivered={markingDeliveredId === delivery.id}
            onOpenQueue={onOpenQueue}
            onViewOrder={() => onViewOrder(delivery)}
            onMarkDelivered={() => onMarkDelivered(delivery)}
            onMoveUp={() => onMoveDelivery(deliveries, delivery, -1)}
            onMoveDown={() => onMoveDelivery(deliveries, delivery, 1)}
            onDragStart={(event) => onDragStart(event, delivery)}
            onDragEnd={onDragEnd}
            onDragOver={(event) => onDragOver(event, delivery)}
            onDragLeave={onDragLeave}
            onDrop={(event) => onDrop(event, deliveries, delivery)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * @param {{
 *   deliveries?: any[];
 *   allowedPageIds?: string[];
 *   isDriverView?: boolean;
 *   canEditDeliveries?: boolean;
 *   onUpdateDelivery?: (deliveryId: string, updates: any) => Promise<void>;
 *   orderSources?: Record<string, any[]>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function DeliveryDashboardPage({
  deliveries = [],
  allowedPageIds = [],
  isDriverView = false,
  canEditDeliveries = false,
  onUpdateDelivery,
  orderSources = {},
  onPageChange,
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateValue());
  const [error, setError] = useState("");
  const [draggingDeliveryId, setDraggingDeliveryId] = useState("");
  const [dragOverDeliveryId, setDragOverDeliveryId] = useState("");
  const [reorderingRouteId, setReorderingRouteId] = useState("");
  const [markingDeliveredId, setMarkingDeliveredId] = useState("");
  const [deliveryToMarkDelivered, setDeliveryToMarkDelivered] = useState(null);
  const [viewingDelivery, setViewingDelivery] = useState(null);
  const openDeliveries = useMemo(() => getOpenDeliveryList(deliveries), [deliveries]);
  const selectedDateDeliveries = useMemo(
    () =>
      openDeliveries
        .filter((delivery) => delivery.deliveryDate === selectedDate)
        .sort(sortDeliveriesBySchedule),
    [openDeliveries, selectedDate],
  );
  const upcomingDeliveries = useMemo(
    () => [...openDeliveries].sort(sortDeliveriesBySchedule).slice(0, 5),
    [openDeliveries],
  );
  const deliveriesByDriver = useMemo(
    () => groupDeliveriesByDriver(selectedDateDeliveries),
    [selectedDateDeliveries],
  );
  const driverNames = Object.keys(deliveriesByDriver).sort((first, second) =>
    first.localeCompare(second),
  );
  const hardwareNeededCount = selectedDateDeliveries.filter(
    (delivery) => delivery.hasHardware && !hasHardwarePhoto(delivery),
  ).length;
  const upcomingPageId = allowedPageIds.includes(
    "deliveries-queued-upcoming",
  )
    ? "deliveries-queued-upcoming"
    : allowedPageIds.includes("deliveries-queue")
      ? "deliveries-queue"
      : "";

  async function saveRouteOrder(routeDeliveries, activeDeliveryId) {
    if (!onUpdateDelivery) {
      return;
    }

    setError("");
    setReorderingRouteId(activeDeliveryId);

    try {
      for (const [routeIndex, routeDelivery] of routeDeliveries.entries()) {
        const nextRouteOrder = routeIndex + 1;

        if (Number(routeDelivery.deliveryRouteOrder) === nextRouteOrder) {
          continue;
        }

        await onUpdateDelivery(routeDelivery.id, {
          deliveryRouteOrder: nextRouteOrder,
        });
      }
    } catch (updateError) {
      console.error("Unable to reorder delivery schedule:", updateError);
      setError("Unable to save that stop order. Try again.");
    } finally {
      setReorderingRouteId("");
      setDraggingDeliveryId("");
      setDragOverDeliveryId("");
    }
  }

  async function handleMoveDelivery(driverDeliveries, delivery, direction) {
    if (!canEditDeliveries || reorderingRouteId) {
      return;
    }

    const currentIndex = driverDeliveries.findIndex(
      (routeDelivery) => routeDelivery.id === delivery.id,
    );
    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= driverDeliveries.length
    ) {
      return;
    }

    const nextRouteDeliveries = [...driverDeliveries];
    const [movedDelivery] = nextRouteDeliveries.splice(currentIndex, 1);

    nextRouteDeliveries.splice(nextIndex, 0, movedDelivery);
    await saveRouteOrder(nextRouteDeliveries, delivery.id);
  }

  function handleMarkDelivered(delivery) {
    if (!canEditDeliveries || !onUpdateDelivery) {
      return;
    }

    setDeliveryToMarkDelivered(delivery);
  }

  async function confirmMarkDelivered(deliveredAt) {
    const delivery = deliveryToMarkDelivered;

    if (!delivery || !deliveredAt) {
      return;
    }

    setMarkingDeliveredId(delivery.id);
    setError("");

    try {
      await onUpdateDelivery(delivery.id, {
        status: "complete",
        deliveredAt,
        deliveryCompletionSource: "dashboardOverride",
        deliveryOverrideAt: deliveredAt,
      });
      setDeliveryToMarkDelivered(null);
    } catch (updateError) {
      console.error("Unable to mark delivery complete:", updateError);
      setError("Unable to mark that delivery as delivered. Try again.");
    } finally {
      setMarkingDeliveredId("");
    }
  }

  function handleDragStart(event, delivery) {
    if (!canEditDeliveries || reorderingRouteId) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", delivery.id);
    setDraggingDeliveryId(delivery.id);
  }

  function handleDragEnd() {
    setDraggingDeliveryId("");
    setDragOverDeliveryId("");
  }

  function handleDragOver(event, delivery) {
    if (!canEditDeliveries || !draggingDeliveryId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverDeliveryId(delivery.id);
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragOverDeliveryId("");
    }
  }

  async function handleDrop(event, driverDeliveries, targetDelivery) {
    event.preventDefault();

    if (
      !canEditDeliveries ||
      !draggingDeliveryId ||
      draggingDeliveryId === targetDelivery.id ||
      reorderingRouteId
    ) {
      handleDragEnd();
      return;
    }

    const draggedIndex = driverDeliveries.findIndex(
      (delivery) => delivery.id === draggingDeliveryId,
    );
    const targetIndex = driverDeliveries.findIndex(
      (delivery) => delivery.id === targetDelivery.id,
    );

    if (draggedIndex < 0 || targetIndex < 0) {
      handleDragEnd();
      return;
    }

    const nextRouteDeliveries = [...driverDeliveries];
    const [movedDelivery] = nextRouteDeliveries.splice(draggedIndex, 1);

    nextRouteDeliveries.splice(targetIndex, 0, movedDelivery);
    await saveRouteOrder(nextRouteDeliveries, draggingDeliveryId);
  }

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Deliveries" }]} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Dispatch Board
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Deliveries
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold leading-7 text-slate-500">
            See what is scheduled, what still needs dispatch, and where each
            driver’s day is headed.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Delivery Date
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </label>
        </div>
      </div>

      {!isDriverView ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              Scheduled
            </p>
            <p className="mt-2 text-4xl font-black text-slate-950">
              {selectedDateDeliveries.length}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              {formatDateLabel(selectedDate)}
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              Drivers
            </p>
            <p className="mt-2 text-4xl font-black text-slate-950">
              {driverNames.length}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              On the board
            </p>
          </div>

          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FC2C38]">
              Hardware
            </p>
            <p className="mt-2 text-4xl font-black text-slate-950">
              {hardwareNeededCount}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Reminders today
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {allowedPageIds.includes("deliveries-add") ? (
          <ActionButton
            icon={Plus}
            title="Add Delivery"
            detail="Create a new order"
            tone="red"
            onClick={() => onPageChange?.("deliveries-add")}
          />
        ) : null}
        {upcomingPageId ? (
          <ActionButton
            icon={PackageCheck}
            title="View Upcoming"
            detail={`${openDeliveries.length} open`}
            tone="green"
            onClick={() => onPageChange?.(upcomingPageId)}
          />
        ) : null}
        {allowedPageIds.includes("deliveries-route-planner") ? (
          <ActionButton
            icon={Navigation}
            title="Route Planner"
            detail="Map saved addresses"
            tone="amber"
            onClick={() => onPageChange?.("deliveries-route-planner")}
          />
        ) : null}
        {allowedPageIds.includes("deliveries-calendar") ? (
          <ActionButton
            icon={CalendarDays}
            title="Full Calendar"
            detail="Move time blocks"
            tone="blue"
            onClick={() => onPageChange?.("deliveries-calendar")}
          />
        ) : null}
        {allowedPageIds.includes("deliveries-history") ? (
          <ActionButton
            icon={History}
            title="Past History"
            detail="Completed orders"
            onClick={() => onPageChange?.("deliveries-history")}
          />
        ) : null}
      </div>

      <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Daily Schedule
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              {formatDateLabel(selectedDate)}
            </h2>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
            <Truck className="h-4 w-4" aria-hidden="true" />
            {selectedDateDeliveries.length}{" "}
            {selectedDateDeliveries.length === 1 ? "delivery" : "deliveries"}
          </span>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
            {error}
          </div>
        ) : null}

        {driverNames.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {driverNames.map((driver) => (
              <DriverScheduleColumn
                key={driver}
                driver={driver}
                deliveries={deliveriesByDriver[driver]}
                canReorder={
                  canEditDeliveries && !isDriverView && Boolean(onUpdateDelivery)
                }
                draggingDeliveryId={draggingDeliveryId}
                dragOverDeliveryId={dragOverDeliveryId}
                reorderingRouteId={reorderingRouteId}
                canMarkDelivered={
                  canEditDeliveries && !isDriverView && Boolean(onUpdateDelivery)
                }
                markingDeliveredId={markingDeliveredId}
                onOpenQueue={() => onPageChange?.("deliveries-queue")}
                onViewOrder={setViewingDelivery}
                onMarkDelivered={handleMarkDelivered}
                onMoveDelivery={handleMoveDelivery}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No deliveries scheduled"
            description="Once dispatch assigns drivers and times, this day board will fill in by driver."
          />
        )}
      </section>

      {upcomingDeliveries.length > 0 && upcomingPageId ? (
        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Up Next
              </p>
              <h2 className="text-xl font-black text-slate-950">
                Next Open Deliveries
              </h2>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            {upcomingDeliveries.map((delivery) => (
              <button
                key={delivery.id}
                type="button"
                onClick={() => onPageChange?.(upcomingPageId)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-red-200"
              >
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                  {delivery.deliveryDate
                    ? formatDateLabel(delivery.deliveryDate)
                    : "Unscheduled"}
                </p>
                <p className="mt-2 text-lg font-black text-slate-950">
                  {delivery.orderNumber || "No order"}
                </p>
                <p className="mt-1 truncate text-sm font-black text-slate-700">
                  {formatCustomerName(delivery.customerName) || "No customer"}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {getDeliveryDrivers(delivery).join(", ") || "No driver"} ·{" "}
                  {getTimeSlotLabel(delivery.deliveryTimeSlot || "")}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {viewingDelivery ? (
        <OrderDetailsModal
          orderNumber={viewingDelivery.orderNumber}
          sources={{
            ...orderSources,
            deliveries: [viewingDelivery],
          }}
          onClose={() => setViewingDelivery(null)}
        />
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
