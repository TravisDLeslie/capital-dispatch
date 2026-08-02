import { useState } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  PackageCheck,
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

export default function DriverDashboardPage({
  supplierRuns,
  deliveries,
  users,
  driverName = "",
  isSuperAdmin = false,
  onPageChange,
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
              Quick access to the work assigned for the driver.
            </p>
          </div>

          {isSuperAdmin ? (
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
          ) : null}
        </div>
      </div>

      <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-50 text-xl font-black text-[#FC2C38]">
            {activeDriver?.charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Signed in work view
            </p>
            <h2 className="truncate text-2xl font-black text-slate-950">
              {activeDriver || "No driver selected"}
            </h2>
          </div>
        </div>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            <PackageCheck
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Pickup Items Left
          </p>
          <p className="mt-3 text-3xl font-black text-slate-950">
            {supplierItemStats.remainingItems}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {supplierItemStats.completeItems}/{supplierItemStats.totalItems} picked up
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            <ClipboardCheck
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Deliveries Open
          </p>
          <p className="mt-3 text-3xl font-black text-slate-950">
            {openDeliveries.length}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Ready for delivery workflow
          </p>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-red-500">
            <Truck
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Hardware Reminders
          </p>
          <p className="mt-3 text-3xl font-black text-red-700">
            {hardwareDeliveries}
          </p>
          <p className="mt-1 text-sm font-bold text-red-600">
            Still needs hardware checked
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
