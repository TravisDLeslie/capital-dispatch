import { useState } from "react";
import {
  ArrowRight,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";
import PageContainer from "../components/PageContainer";
import { isDeliveryComplete } from "../utils/deliveryStatus";

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

function getOpenDeliveries(deliveries, driverName) {
  return sortDeliveriesBySchedule(
    deliveries.filter(
      (delivery) =>
        !isDeliveryComplete(delivery) &&
        delivery.dispatchStatus !== "needsDispatch" &&
        getDriverName(delivery.driver) === driverName &&
        isTodayOrFutureDelivery(delivery),
    ),
  );
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function isTodayOrFutureDelivery(delivery) {
  const deliveryDate = String(delivery?.deliveryDate || "").slice(0, 10);

  return !deliveryDate || deliveryDate >= getTodayDateKey();
}

function getDeliverySortValue(delivery) {
  const date = delivery?.deliveryDate || "";
  const time =
    delivery?.deliveryTimeSlot ||
    delivery?.driverTargetArrivalTime ||
    delivery?.scheduledStartTime ||
    delivery?.timeSlot ||
    "";

  return `${date} ${time}`.trim();
}

function sortDeliveriesBySchedule(deliveries) {
  return [...deliveries].sort((firstDelivery, secondDelivery) =>
    getDeliverySortValue(firstDelivery).localeCompare(
      getDeliverySortValue(secondDelivery),
    ),
  );
}

function getSupplierRunSortValue(supplierRun) {
  return `${supplierRun?.pickupDate || ""} ${supplierRun?.vendor || ""} ${
    supplierRun?.poNumber || ""
  }`;
}

function sortSupplierRuns(supplierRuns) {
  return [...supplierRuns].sort((firstRun, secondRun) =>
    getSupplierRunSortValue(firstRun).localeCompare(
      getSupplierRunSortValue(secondRun),
    ),
  );
}

function getSupplierStopCount(supplierRuns) {
  return new Set(
    supplierRuns.map((supplierRun) => supplierRun.vendor || "Supplier"),
  ).size;
}

function getItemCountFromRuns(supplierRuns) {
  return supplierRuns.reduce(
    (total, supplierRun) =>
      total + (Array.isArray(supplierRun.items) ? supplierRun.items.length : 0),
    0,
  );
}

function getDeliveryTimeLabel(delivery) {
  return (
    delivery?.driverTargetArrivalTime ||
    delivery?.deliveryTimeSlot ||
    delivery?.scheduledStartTime ||
    delivery?.timeSlot ||
    "Scheduled"
  );
}

function getDeliveryLocationLabel(delivery) {
  const address = delivery?.deliveryAddress || delivery?.address || "";
  const cityMatch = String(address).match(/,\s*([^,]+),?\s+[A-Z]{2}\s+\d{5}/);

  return cityMatch?.[1] || address || "Delivery stop";
}

function getDriverOptions({ supplierRuns, deliveries, users, employeeOptions }) {
  return [
    ...new Set(
      [
        ...employeeOptions,
      ].filter((driver) => driver !== UNASSIGNED_DRIVER),
    ),
  ].sort((firstDriver, secondDriver) =>
    firstDriver.localeCompare(secondDriver),
  );
}

function DriverRouteCard({
  title,
  eyebrow,
  primary,
  secondary,
  meta,
  icon: Icon,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group flex min-h-[150px] w-full items-stretch overflow-hidden rounded-3xl border text-left shadow-sm transition ${
        disabled
          ? "cursor-default border-slate-200 bg-slate-50"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-red-100 hover:shadow-md"
      }`}
    >
      <span
        className={`flex w-2 shrink-0 ${
          disabled ? "bg-slate-300" : "bg-[#FC2C38]"
        }`}
        aria-hidden="true"
      />
      <span className="flex flex-1 items-center gap-4 p-5 sm:p-6">
        <span
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${
            disabled ? "bg-white text-slate-400" : "bg-red-50 text-[#FC2C38]"
          }`}
        >
          <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-xs font-black uppercase tracking-[0.18em] ${
              disabled ? "text-slate-400" : "text-[#FC2C38]"
            }`}
          >
            {eyebrow}
          </span>
          <span className="mt-1 block text-2xl font-black text-slate-950 sm:text-3xl">
            {title}
          </span>
          <span className="mt-2 block text-sm font-black text-slate-700">
            {primary}
          </span>
          <span className="mt-1 block text-sm font-semibold text-slate-500">
            {secondary}
          </span>
          <span className="mt-3 inline-flex rounded-2xl bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-slate-600">
            {meta}
          </span>
        </span>
        {!disabled ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white transition group-hover:bg-[#FC2C38]">
            <ArrowRight
              aria-hidden="true"
              className="h-5 w-5"
              strokeWidth={2.6}
            />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function DriverRouteOverview({
  openSupplierRuns,
  openDeliveries,
  onPageChange,
}) {
  const sortedSupplierRuns = sortSupplierRuns(openSupplierRuns);
  const nextSupplierRun = sortedSupplierRuns[0];
  const nextDelivery = openDeliveries[0];
  const supplierStopCount = getSupplierStopCount(sortedSupplierRuns);
  const supplierItemCount = getItemCountFromRuns(sortedSupplierRuns);

  return (
    <section className="mb-5 grid gap-4 lg:grid-cols-2">
      <DriverRouteCard
        icon={Route}
        eyebrow="South Route"
        title={nextSupplierRun?.vendor || "No South Route"}
        primary={
          openSupplierRuns.length > 0
            ? `${supplierStopCount} ${
                supplierStopCount === 1 ? "stop" : "stops"
              } ready`
            : "Nothing assigned"
        }
        secondary={
          openSupplierRuns.length > 0
            ? `${openSupplierRuns.length} ${
                openSupplierRuns.length === 1 ? "PO" : "POs"
              } • ${supplierItemCount || 0} ${
                supplierItemCount === 1 ? "item" : "items"
              }`
            : "South pickups will show here when dispatch assigns them."
        }
        meta={openSupplierRuns.length > 0 ? "Open South Route" : "No South Work"}
        onClick={() => onPageChange("supplier-runs-check")}
        disabled={openSupplierRuns.length === 0}
      />

      <DriverRouteCard
        icon={Truck}
        eyebrow="Delivery Route"
        title={nextDelivery?.customerName || "No Delivery Route"}
        primary={
          openDeliveries.length > 0
            ? `${openDeliveries.length} ${
                openDeliveries.length === 1 ? "delivery" : "deliveries"
              } assigned`
            : "Nothing assigned"
        }
        secondary={
          openDeliveries.length > 0
            ? `${getDeliveryTimeLabel(nextDelivery)} • ${getDeliveryLocationLabel(
                nextDelivery,
              )}`
            : "Deliveries will show here when dispatch assigns them."
        }
        meta={
          openDeliveries.length > 0 ? "Open Delivery Route" : "No Delivery Work"
        }
        onClick={() => onPageChange("deliveries-queue")}
        disabled={openDeliveries.length === 0}
      />
    </section>
  );
}

/**
 * @param {{
 *   supplierRuns: Array<Record<string, any>>;
 *   deliveries: Array<Record<string, any>>;
 *   users: Array<Record<string, any>>;
 *   employeeOptions?: string[];
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
  employeeOptions = [],
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
    employeeOptions,
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

      <DriverRouteOverview
        openSupplierRuns={openSupplierRuns}
        openDeliveries={openDeliveries}
        onPageChange={onPageChange}
      />

    </PageContainer>
  );
}
