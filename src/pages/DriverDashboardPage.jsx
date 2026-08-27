import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  PhoneCall,
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

function getProfileDisplayName(user) {
  const emailName = String(user?.email || "").split("@")[0] || "";

  return user?.displayName || user?.driverName || emailName || "";
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
          icon={CalendarDays}
          label="Schedule"
          detail="See your delivery day"
          onClick={() => onPageChange("deliveries-calendar")}
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

      <section className="grid gap-4 lg:grid-cols-3">
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

        <DriverActionCard
          icon={CalendarDays}
          title="Delivery Schedule"
          description="See the assigned delivery day in order so you know what is coming next."
          stat={openDeliveries.length}
          statLabel="Scheduled"
          buttonLabel="View Schedule"
          onClick={() => onPageChange("deliveries-calendar")}
        />
      </section>

    </PageContainer>
  );
}
