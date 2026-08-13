import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  MapPin,
  PhoneCall,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";
import PageContainer from "../components/PageContainer";
import { deliveryDrivers } from "../data/options";

const UNASSIGNED_DRIVER = "Unassigned Driver";

function getDriverName(value) {
  return String(value || UNASSIGNED_DRIVER).trim() || UNASSIGNED_DRIVER;
}

function getOpenSupplierRuns(supplierRuns, driverName) {
  return supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      getDriverName(supplierRun.driver) === driverName,
  );
}

function getSupplierRunSortValue(supplierRun) {
  const date =
    supplierRun?.scheduledDate ||
    supplierRun?.pickupDate ||
    supplierRun?.createdAt ||
    "";
  const routeOrder =
    typeof supplierRun?.routeOrder === "number"
      ? String(supplierRun.routeOrder).padStart(4, "0")
      : "9999";

  return `${date} ${routeOrder}`.trim();
}

function getOpenDeliveries(deliveries, driverName) {
  return deliveries.filter(
    (delivery) =>
      delivery.status !== "complete" &&
      getDriverName(delivery.driver) === driverName,
  );
}

function getSupplierItemStats(supplierRuns) {
  const items = supplierRuns.flatMap((supplierRun) =>
    Array.isArray(supplierRun.items) ? supplierRun.items : [],
  );
  const completeItems = items.filter((item) => item.pickedUp).length;

  return {
    completeItems,
    totalItems: items.length,
    remainingItems: items.length - completeItems,
  };
}

function getDeliveryTimeLabel(delivery) {
  const startTime = delivery?.scheduledStartTime || delivery?.timeSlot || "";
  const date = delivery?.deliveryDate || "";

  if (startTime && date) {
    return `${startTime} • ${date}`;
  }

  return startTime || date || "No time set";
}

function getSupplierDateLabel(supplierRun) {
  if (supplierRun?.scheduledDate) {
    return supplierRun.scheduledDate;
  }

  if (supplierRun?.pickupDate) {
    return supplierRun.pickupDate;
  }

  return "Today";
}

function getDeliverySortValue(delivery) {
  const date = delivery?.deliveryDate || "";
  const time = delivery?.scheduledStartTime || delivery?.timeSlot || "";

  return `${date} ${time}`.trim();
}

function getRouteCompletionPercent({ completeItems, totalItems }) {
  if (!totalItems) {
    return 0;
  }

  return Math.round((completeItems / totalItems) * 100);
}

function getDriverOptions({ supplierRuns, deliveries, users }) {
  return [
    ...new Set(
      [
        ...deliveryDrivers,
        ...supplierRuns.map((supplierRun) =>
          getDriverName(supplierRun.driver),
        ),
        ...deliveries.map((delivery) =>
          getDriverName(delivery.driver),
        ),
        ...users
          .map((user) => user.driverName)
          .filter(Boolean)
          .map(getDriverName),
      ].filter((driver) => driver !== UNASSIGNED_DRIVER),
    ),
  ].sort((firstDriver, secondDriver) =>
    firstDriver.localeCompare(secondDriver),
  );
}

function DriverActionCard({
  icon: Icon,
  title,
  description,
  stat,
  statLabel,
  buttonLabel,
  onClick,
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
          <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={2.4} />
        </span>

        <span className="rounded-2xl bg-slate-50 px-4 py-2 text-right">
          <span className="block text-2xl font-black text-slate-950">
            {stat}
          </span>
          <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
            {statLabel}
          </span>
        </span>
      </div>

      <h2 className="mt-5 text-2xl font-black text-slate-950">
        {title}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>

      <button
        type="button"
        onClick={onClick}
        className="mt-5 flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl bg-[#FC2C38] px-5 text-left text-base font-black text-white shadow-sm transition hover:bg-red-600"
      >
        {buttonLabel}
        <ArrowRight
          aria-hidden="true"
          className="h-5 w-5"
          strokeWidth={2.6}
        />
      </button>
    </article>
  );
}

function DriverQuickAction({ icon: Icon, label, detail, onClick, href }) {
  const className =
    "flex min-h-[76px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-100 hover:shadow-md";
  const content = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-black text-slate-950">
          {label}
        </span>
        <span className="block truncate text-xs font-bold text-slate-500">
          {detail}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function DriverInfoTile({ label, value, detail, tone = "slate" }) {
  const toneClasses = {
    red: "border-red-100 bg-red-50 text-red-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-white text-slate-950",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm font-bold opacity-75">{detail}</p>
    </div>
  );
}

/**
 * @param {{
 *   supplierRuns: Array<Record<string, any>>;
 *   deliveries: Array<Record<string, any>>;
 *   users: Array<Record<string, any>>;
 *   driverName?: string;
 *   isSuperAdmin?: boolean;
 *   onPageChange: (pageId: string) => void;
 *   headerAccessory?: import("react").ReactNode;
 * }} props
 */
export default function DriverDashboardPage({
  supplierRuns,
  deliveries,
  users,
  driverName = "",
  isSuperAdmin = false,
  onPageChange,
  headerAccessory = null,
}) {
  const safeUsers = Array.isArray(users) ? users : [];
  const driverOptions = getDriverOptions({
    supplierRuns,
    deliveries,
    users: safeUsers,
  });
  const [previewDriver, setPreviewDriver] = useState(
    driverName || driverOptions[0] || "",
  );
  const activeDriver =
    isSuperAdmin ? previewDriver || driverOptions[0] || "" : driverName;
  const openSupplierRuns = activeDriver
    ? getOpenSupplierRuns(supplierRuns, activeDriver)
    : [];
  const openDeliveries = activeDriver
    ? getOpenDeliveries(deliveries, activeDriver)
    : [];
  const supplierItemStats = getSupplierItemStats(openSupplierRuns);
  const routeCompletionPercent =
    getRouteCompletionPercent(supplierItemStats);
  const openSupplierStops = [
    ...new Set(openSupplierRuns.map((supplierRun) => supplierRun.vendor).filter(Boolean)),
  ];
  const sortedSupplierRuns = [...openSupplierRuns].sort((first, second) =>
    getSupplierRunSortValue(first).localeCompare(
      getSupplierRunSortValue(second),
    ),
  );
  const nextSupplierRun = sortedSupplierRuns[0] || null;
  const sortedDeliveries = [...openDeliveries].sort((first, second) =>
    getDeliverySortValue(first).localeCompare(getDeliverySortValue(second)),
  );
  const nextDelivery = sortedDeliveries[0] || null;
  const hardwareDeliveries = openDeliveries.filter(
    (delivery) => delivery.hasHardware && !delivery.hardwareChecked,
  ).length;

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Driver
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
              Driver Dashboard
            </h1>
            <p className="mt-2 text-lg font-semibold text-slate-500">
              Today’s route, deliveries, photos, and the fastest way into the work.
            </p>
          </div>

          {headerAccessory || (isSuperAdmin ? (
            <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:min-w-72">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                <ShieldCheck
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.4}
                />
                Preview Driver
              </span>
              <select
                value={activeDriver}
                onChange={(event) => setPreviewDriver(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              >
                {driverOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null)}
        </div>
      </div>

      <section className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-50 text-2xl font-black text-amber-700">
                {activeDriver?.charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Signed in work view
                </p>
                <h2 className="truncate text-3xl font-black text-slate-950">
                  {activeDriver || "No driver selected"}
                </h2>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl bg-slate-50 px-2.5 py-3 text-center sm:px-4 sm:text-left">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.14em]">
                  South
                </p>
                <p className="mt-1 text-base font-black text-slate-950 sm:text-xl">
                  {openSupplierStops.length} stops
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-2.5 py-3 text-center sm:px-4 sm:text-left">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.14em]">
                  Deliveries
                </p>
                <p className="mt-1 text-base font-black text-slate-950 sm:text-xl">
                  {openDeliveries.length} open
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-2.5 py-3 text-center sm:px-4 sm:text-left">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-emerald-600 sm:text-xs sm:tracking-[0.14em]">
                  Route
                </p>
                <p className="mt-1 text-base font-black text-emerald-800 sm:text-xl">
                  {routeCompletionPercent}% done
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Up next
            </p>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => onPageChange("supplier-runs-check")}
                className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-red-500">
                    <Route aria-hidden="true" className="h-4 w-4" />
                    South stop
                  </span>
                  <span className="mt-1 block truncate text-xl font-black text-slate-950">
                    {nextSupplierRun?.vendor || "No South stop ready"}
                  </span>
                  <span className="mt-1 block text-sm font-bold text-slate-500">
                    {nextSupplierRun
                      ? `${nextSupplierRun.poNumber || "PO"} • ${getSupplierDateLabel(nextSupplierRun)}`
                      : "You are clear for South right now."}
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => onPageChange("deliveries-queue")}
                className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-blue-600">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    Next delivery
                  </span>
                  <span className="mt-1 block truncate text-xl font-black text-slate-950">
                    {nextDelivery?.customerName || "No delivery ready"}
                  </span>
                  <span className="mt-1 block text-sm font-bold text-slate-500">
                    {nextDelivery
                      ? `${nextDelivery.orderNumber || "Order"} • ${getDeliveryTimeLabel(nextDelivery)}`
                      : "No open deliveries assigned."}
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DriverQuickAction
          icon={Route}
          label="South POs"
          detail="Stops, photos, and pickup checks"
          onClick={() => onPageChange("supplier-runs-check")}
        />
        <DriverQuickAction
          icon={Truck}
          label="Deliveries"
          detail="Drop-off photos and hardware"
          onClick={() => onPageChange("deliveries-queue")}
        />
        <DriverQuickAction
          icon={BookOpen}
          label="Stocking Handbook"
          detail="Look up stocked items"
          onClick={() => onPageChange("stocking-handbook")}
        />
        <DriverQuickAction
          icon={PhoneCall}
          label="Call Yard"
          detail="Capital Lumber main line"
          href="tel:2083435481"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DriverActionCard
          icon={Route}
          title="POs To Pick Up"
          description="Open South stops, supplier directions, and pickup item photos."
          stat={openSupplierRuns.length}
          statLabel={openSupplierRuns.length === 1 ? "PO" : "POs"}
          buttonLabel="View South POs"
          onClick={() => onPageChange("supplier-runs-check")}
        />

        <DriverActionCard
          icon={Truck}
          title="Deliveries"
          description="Assigned delivery orders, drop-off photos, hardware reminders, and directions."
          stat={openDeliveries.length}
          statLabel={
            openDeliveries.length === 1 ? "Order" : "Orders"
          }
          buttonLabel="View Deliveries"
          onClick={() => onPageChange("deliveries-queue")}
        />
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        <DriverInfoTile
          label="Pickup Items Left"
          value={supplierItemStats.remainingItems}
          detail={`${supplierItemStats.completeItems}/${supplierItemStats.totalItems} picked up`}
          tone="slate"
        />

        <DriverInfoTile
          label="Delivery Orders"
          value={openDeliveries.length}
          detail="Ready for delivery workflow"
          tone="blue"
        />

        <DriverInfoTile
          label="Hardware Reminders"
          value={hardwareDeliveries}
          detail="Still needs hardware checked"
          tone={hardwareDeliveries > 0 ? "red" : "green"}
        />
      </section>

    </PageContainer>
  );
}
