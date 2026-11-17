import { useState } from "react";
import {
  ArrowRight,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";
import PageContainer from "../components/PageContainer";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import {
  getOpenSupplierRunItemCount,
  isOpenSupplierRun,
} from "../utils/supplierRunStatus";

const UNASSIGNED_DRIVER = "Unassigned Driver";

function getDriverName(value) {
  return String(value || UNASSIGNED_DRIVER).trim() || UNASSIGNED_DRIVER;
}

function normalizeDriverName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getUserDisplayName(user) {
  return String(
    user?.displayName ||
      user?.driverName ||
      String(user?.email || "").split("@")[0] ||
      "",
  ).trim();
}

function createDriverAliasMap(users) {
  const firstNameCounts = new Map();
  const aliasMap = new Map();

  users.forEach((user) => {
    const displayName = getUserDisplayName(user);
    const firstNameKey = normalizeDriverName(displayName.split(/\s+/)[0]);

    if (firstNameKey) {
      firstNameCounts.set(
        firstNameKey,
        (firstNameCounts.get(firstNameKey) || 0) + 1,
      );
    }
  });

  users.forEach((user) => {
    const displayName = getUserDisplayName(user);
    const displayNameKey = normalizeDriverName(displayName);
    const firstName = displayName.split(/\s+/)[0] || "";
    const firstNameKey = normalizeDriverName(firstName);
    const aliases = [
      displayName,
      user?.driverName,
      user?.displayName,
      String(user?.email || "").split("@")[0],
    ];

    if (firstNameKey && firstNameCounts.get(firstNameKey) === 1) {
      aliases.push(firstName);
    }

    aliases.forEach((alias) => {
      const aliasKey = normalizeDriverName(alias);

      if (aliasKey && displayNameKey) {
        aliasMap.set(aliasKey, displayNameKey);
      }
    });
  });

  return aliasMap;
}

function areDriverNamesEqual(firstName, secondName, aliasMap) {
  const firstKey = normalizeDriverName(firstName);
  const secondKey = normalizeDriverName(secondName);

  return (
    (aliasMap.get(firstKey) || firstKey) ===
    (aliasMap.get(secondKey) || secondKey)
  );
}

function getOpenSupplierRuns(supplierRuns, driverName, aliasMap) {
  return supplierRuns.filter(
    (supplierRun) =>
      isOpenSupplierRun(supplierRun) &&
      isTodayOrFutureSupplierRun(supplierRun) &&
      supplierRun.dispatchStatus !== "needsDispatch" &&
      areDriverNamesEqual(
        getDriverName(supplierRun.driver),
        driverName,
        aliasMap,
      ),
  );
}

function isTodayOrFutureSupplierRun(supplierRun) {
  const pickupDate = String(
    supplierRun?.pickupDate || supplierRun?.scheduledDate || "",
  ).slice(0, 10);

  return !pickupDate || pickupDate >= getTodayDateKey();
}

function getOpenDeliveries(deliveries, driverName, aliasMap) {
  return sortDeliveriesBySchedule(
    deliveries.filter(
      (delivery) =>
        !isDeliveryComplete(delivery) &&
        delivery.dispatchStatus !== "needsDispatch" &&
        areDriverNamesEqual(
          getDriverName(delivery.driver),
          driverName,
          aliasMap,
        ) &&
        isTodayOrFutureDelivery(delivery),
    ),
  );
}

function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
    (total, supplierRun) => total + getOpenSupplierRunItemCount(supplierRun),
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

function isReturnDelivery(delivery) {
  return delivery?.deliveryType === "return" || delivery?.routeStopType === "returnPickup";
}

function isVendorReturnDelivery(delivery) {
  return (
    delivery?.deliveryType === "vendorReturn" ||
    delivery?.routeStopType === "vendorReturn"
  );
}

function getDriverOptions(employeeOptions) {
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

function getDriverFirstName(driverName) {
  return String(driverName || "Driver").trim().split(/\s+/)[0] || "Driver";
}

function getDaypartGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
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
  tone = "delivery",
}) {
  const isSouth = tone === "south";
  const activeAccent = isSouth ? "bg-blue-600" : "bg-[#FC2C38]";
  const activeIcon = isSouth
    ? "bg-blue-50 text-blue-700"
    : "bg-red-50 text-[#FC2C38]";
  const activeEyebrow = isSouth ? "text-blue-700" : "text-[#FC2C38]";
  const activeHover = isSouth
    ? "hover:border-blue-200"
    : "hover:border-red-100";
  const activeArrow = isSouth
    ? "bg-blue-700 group-hover:bg-blue-800"
    : "bg-slate-950 group-hover:bg-[#FC2C38]";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group flex min-h-[132px] w-full items-stretch overflow-hidden rounded-3xl border text-left shadow-sm transition sm:min-h-[150px] ${
        disabled
          ? "cursor-default border-slate-200 bg-slate-50"
          : `border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md ${activeHover}`
      }`}
    >
      <span
        className={`flex w-2 shrink-0 ${
          disabled ? "bg-slate-300" : activeAccent
        }`}
        aria-hidden="true"
      />
      <span className="flex flex-1 items-center gap-3 p-4 sm:gap-4 sm:p-6">
        <span
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${
            disabled ? "bg-white text-slate-400" : activeIcon
          }`}
        >
          <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-xs font-black uppercase tracking-[0.18em] ${
              disabled ? "text-slate-400" : activeEyebrow
            }`}
          >
            {eyebrow}
          </span>
          <span className="mt-1 block text-xl font-black text-slate-950 sm:text-3xl">
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
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white transition sm:h-12 sm:w-12 ${activeArrow}`}
          >
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
        tone="south"
        eyebrow="South Route"
        title={openSupplierRuns.length > 0 ? "South Pickups" : "No South Route"}
        primary={
          openSupplierRuns.length > 0
            ? `Next pickup: ${nextSupplierRun?.vendor || "Supplier"}`
            : "Nothing assigned"
        }
        secondary={
          openSupplierRuns.length > 0
            ? `${supplierStopCount} ${
                supplierStopCount === 1 ? "stop" : "stops"
              } • ${openSupplierRuns.length} ${
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
        tone="delivery"
        eyebrow="Delivery Route"
        title={nextDelivery?.customerName || "No Delivery Route"}
        primary={
          openDeliveries.length > 0
            ? isVendorReturnDelivery(nextDelivery)
              ? `Next stop: vendor return`
              : isReturnDelivery(nextDelivery)
                ? `Next stop: return pickup`
              : `${openDeliveries.length} ${
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
  const driverAliasMap = createDriverAliasMap(safeUsers);
  const driverOptions = getDriverOptions(employeeOptions);
  const [previewDriver, setPreviewDriver] = useState(
    driverName || driverOptions[0] || "",
  );
  const activeDriver =
    isSuperAdmin ? previewDriver || driverOptions[0] || "" : driverName;
  const openSupplierRuns = activeDriver
    ? getOpenSupplierRuns(supplierRuns, activeDriver, driverAliasMap)
    : [];
  const openDeliveries = activeDriver
    ? getOpenDeliveries(deliveries, activeDriver, driverAliasMap)
    : [];
  const driverFirstName = getDriverFirstName(activeDriver);
  const daypartGreeting = getDaypartGreeting();

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Driver
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Good {daypartGreeting}, {driverFirstName}{" "}
              <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-2 text-base font-bold text-slate-700 sm:text-lg">
              Let&apos;s have a great day out there.
            </p>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500 sm:text-base">
              Drive safe, take pride in every delivery, and remember that you&apos;re
              the face of Capital Lumber on every jobsite.
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

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700 shadow-sm">
          <Truck aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Before the next load</p>
          <p className="mt-1 text-sm font-bold leading-6 sm:text-base">
            Please make sure the trucks are cleaned, filled up, organized, and ready to go for the next load.
          </p>
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
