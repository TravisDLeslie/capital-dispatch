import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Package,
  History,
  MapPin,
  PackageCheck,
  Plus,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
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
    ? delivery.dispatchAssignments.map((assignment) => assignment.driver)
    : [];
  const legacyDrivers = Array.isArray(delivery.drivers) ? delivery.drivers : [];

  return [...new Set([delivery.driver, ...legacyDrivers, ...dispatchDrivers].filter(Boolean))];
}

function getBuildItems(build) {
  if (Array.isArray(build?.items) && build.items.length > 0) {
    return build.items;
  }

  return [
    ...(Array.isArray(build?.stockItems) ? build.stockItems : []),
    ...(Array.isArray(build?.waitingItems) ? build.waitingItems : []),
  ];
}

function getLinkedBuild(delivery, orderBuilds) {
  return orderBuilds.find((build) => {
    const deliveryId = String(delivery?.id || "");
    const sourceOrderId = String(delivery?.sourceOrderId || "");
    const deliveryOrderNumber = String(delivery?.orderNumber || "");

    return (
      (deliveryId && String(build.linkedDeliveryId || "") === deliveryId) ||
      (sourceOrderId && String(build.orderId || "") === sourceOrderId) ||
      (deliveryOrderNumber && String(build.orderNumber || "") === deliveryOrderNumber)
    );
  });
}

function getWaitingBuildItems(delivery, orderBuilds) {
  const linkedBuild = getLinkedBuild(delivery, orderBuilds);

  if (!linkedBuild) {
    return [];
  }

  return getBuildItems(linkedBuild).filter((item) => {
    const buildStatus = String(item.buildStatus || "").toLowerCase();
    const receivedStatus = String(item.receivingStatus || "").toLowerCase();

    if (item.path === "inStock") {
      return false;
    }

    return !["ready", "built", "complete", "completed", "staged"].includes(
      buildStatus,
    ) && receivedStatus !== "received";
  });
}

function getWaitingPathSummary(waitingItems) {
  const counts = waitingItems.reduce((summary, item) => {
    const path = item.path || "unknown";

    return {
      ...summary,
      [path]: (summary[path] || 0) + 1,
    };
  }, {});

  return [
    counts.wePickup ? `${counts.wePickup} South` : "",
    counts.supplierDelivery ? `${counts.supplierDelivery} Their Truck` : "",
    counts.pod ? `${counts.pod} POD` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function getOpenDeliveryList(deliveries) {
  return deliveries.filter(
    (delivery) =>
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

function ScheduleDeliveryCard({ delivery, onOpenQueue }) {
  const scopeSummary = getDeliveryScopeSummary(delivery);

  return (
    <button
      type="button"
      onClick={onOpenQueue}
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-red-200 hover:bg-red-50/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            Order {delivery.orderNumber || "No order"}
          </p>
          <h3 className="mt-1 truncate text-xl font-black text-slate-950">
            {formatCustomerName(delivery.customerName) || "No customer"}
          </h3>
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
        {delivery.hasHardware && !delivery.hardwareChecked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-[#FC2C38]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Hardware
          </span>
        ) : null}
      </div>
    </button>
  );
}

function DriverScheduleColumn({ driver, deliveries, onOpenQueue }) {
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
        {deliveries.map((delivery) => (
          <ScheduleDeliveryCard
            key={`${driver}-${delivery.id}`}
            delivery={delivery}
            onOpenQueue={onOpenQueue}
          />
        ))}
      </div>
    </section>
  );
}

function WaitingMaterialCard({ delivery, orderBuilds, onOpenBuild }) {
  const waitingItems = getWaitingBuildItems(delivery, orderBuilds);
  const waitingSummary = getWaitingPathSummary(waitingItems);
  const firstWaitingItem = waitingItems[0];

  return (
    <article className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
            Scheduled · Waiting on Items
          </p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">
            {formatCustomerName(delivery.customerName) || "No customer"}
          </h3>
          <p className="mt-1 text-sm font-black text-slate-500">
            Order {delivery.orderNumber || "No order"} ·{" "}
            {formatDateLabel(delivery.deliveryDate)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-amber-700 shadow-sm">
            {waitingItems.length} waiting
          </span>
          {delivery.driver ? (
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">
              {delivery.driver}
            </span>
          ) : null}
          {delivery.deliveryTimeSlot ? (
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">
              {getTimeSlotLabel(delivery.deliveryTimeSlot)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-3">
        <p className="text-sm font-black text-slate-950">
          {waitingSummary || "Waiting on linked material"}
        </p>
        <p className="mt-1 text-sm font-bold text-slate-500">
          {firstWaitingItem
            ? `${firstWaitingItem.quantity ? `QTY ${firstWaitingItem.quantity} · ` : ""}${
                firstWaitingItem.description || "Material"
              }`
            : "Open the build to review what is holding this delivery."}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenBuild}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-amber-200 bg-white px-4 text-sm font-black text-amber-800 shadow-sm"
      >
        View Build Status
      </button>
    </article>
  );
}

/**
 * @param {{
 *   deliveries?: any[];
 *   orderBuilds?: Array<Record<string, any>>;
 *   allowedPageIds?: string[];
 *   isDriverView?: boolean;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function DeliveryDashboardPage({
  deliveries = [],
  orderBuilds = [],
  allowedPageIds = [],
  isDriverView = false,
  onPageChange,
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateValue());
  const openDeliveries = useMemo(() => getOpenDeliveryList(deliveries), [deliveries]);
  const waitingMaterialDeliveries = useMemo(
    () =>
      openDeliveries
        .filter((delivery) => getWaitingBuildItems(delivery, orderBuilds).length > 0)
        .sort(sortDeliveriesBySchedule),
    [openDeliveries, orderBuilds],
  );
  const readyOpenDeliveries = useMemo(
    () =>
      openDeliveries.filter(
        (delivery) => getWaitingBuildItems(delivery, orderBuilds).length === 0,
      ),
    [openDeliveries, orderBuilds],
  );
  const selectedDateDeliveries = useMemo(
    () =>
      readyOpenDeliveries
        .filter((delivery) => delivery.deliveryDate === selectedDate)
        .sort(sortDeliveriesBySchedule),
    [readyOpenDeliveries, selectedDate],
  );
  const selectedDateWaitingMaterialDeliveries = useMemo(
    () =>
      waitingMaterialDeliveries.filter(
        (delivery) => delivery.deliveryDate === selectedDate,
      ),
    [selectedDate, waitingMaterialDeliveries],
  );
  const upcomingDeliveries = useMemo(
    () => readyOpenDeliveries.sort(sortDeliveriesBySchedule).slice(0, 5),
    [readyOpenDeliveries],
  );
  const deliveriesByDriver = useMemo(
    () => groupDeliveriesByDriver(selectedDateDeliveries),
    [selectedDateDeliveries],
  );
  const driverNames = Object.keys(deliveriesByDriver).sort((first, second) =>
    first.localeCompare(second),
  );
  const hardwareNeededCount = selectedDateDeliveries.filter(
    (delivery) => delivery.hasHardware && !delivery.hardwareChecked,
  ).length;

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
              Ready
            </p>
            <p className="mt-2 text-4xl font-black text-slate-950">
              {selectedDateDeliveries.length}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Scheduled for {formatDateLabel(selectedDate)}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              Waiting Items
            </p>
            <p className="mt-2 text-4xl font-black text-slate-950">
              {selectedDateWaitingMaterialDeliveries.length}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Scheduled, but not ready to load
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
        {allowedPageIds.includes("deliveries-queue") ? (
          <ActionButton
            icon={PackageCheck}
            title="View Upcoming"
            detail={`${readyOpenDeliveries.length} ready`}
            tone="green"
            onClick={() => onPageChange?.("deliveries-queue")}
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

      {!isDriverView && selectedDateWaitingMaterialDeliveries.length > 0 ? (
        <section className="mt-8 rounded-[2rem] border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                Hold Before Loading
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Scheduled, Waiting on Items
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                These deliveries are planned, but still have material waiting on
                South, Their Truck, POD, or receiving.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">
              <Package className="h-4 w-4" aria-hidden="true" />
              {selectedDateWaitingMaterialDeliveries.length} waiting
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {selectedDateWaitingMaterialDeliveries.map((delivery) => (
              <WaitingMaterialCard
                key={delivery.id}
                delivery={delivery}
                orderBuilds={orderBuilds}
                onOpenBuild={() => onPageChange?.("new-home-build")}
              />
            ))}
          </div>
        </section>
      ) : null}

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

        {driverNames.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {driverNames.map((driver) => (
              <DriverScheduleColumn
                key={driver}
                driver={driver}
                deliveries={deliveriesByDriver[driver]}
                onOpenQueue={() => onPageChange?.("deliveries-queue")}
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

      {upcomingDeliveries.length > 0 ? (
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
                onClick={() => onPageChange?.("deliveries-queue")}
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
    </PageContainer>
  );
}
