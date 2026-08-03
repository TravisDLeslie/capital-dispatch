import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  History,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  RefreshCw,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { southVendorRouteOrder } from "../data/options";
import {
  getVehicleCoordinates,
  getVehicleDefaultAppTitle,
  getFirstVehicleValue,
  getVehicleKey,
  getVehicleLastUpdated,
  getVehicleLocationLabel,
  getVehicleName,
  getVehicleYearMakeModel,
  getUniqueVehicleBadgeTexts,
} from "../utils/bouncieVehicleFormatters";
import { subscribeToBouncieVehicleSettings } from "../utils/bouncieVehicleStorage";

function readApiJson(response, routeName) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text().then((responseText) => {
    throw new Error(
      `${routeName} returned ${response.status} instead of JSON. ${
        responseText ? responseText.slice(0, 120) : ""
      }`,
    );
  });
}

function getVehicleMapUrl(vehicle) {
  const coordinates = getVehicleCoordinates(vehicle);

  if (!coordinates) {
    return "";
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${coordinates.latitude},${coordinates.longitude}`,
  )}`;
}

function getVehicleLastUpdateDate(vehicle) {
  const rawDate = getFirstVehicleValue(vehicle, [
    "updatedAt",
    "lastUpdated",
    "lastSeen",
    "lastSeenAt",
    "location.updatedAt",
    "location.timestamp",
    "location.time",
    "lastLocation.updatedAt",
    "lastLocation.timestamp",
    "lastLocation.time",
    "currentLocation.updatedAt",
    "currentLocation.timestamp",
    "currentLocation.time",
  ]);

  if (!rawDate) {
    return null;
  }

  const parsedDate = new Date(rawDate);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getVehicleFreshnessLabel(vehicle) {
  const lastUpdateDate = getVehicleLastUpdateDate(vehicle);

  if (!lastUpdateDate) {
    return "No recent update";
  }

  const minutesSinceUpdate = Math.round(
    (Date.now() - lastUpdateDate.getTime()) / 60000,
  );

  if (minutesSinceUpdate < 15) {
    return "Updated recently";
  }

  if (minutesSinceUpdate < 90) {
    return `${minutesSinceUpdate} min since update`;
  }

  const hoursSinceUpdate = Math.round(minutesSinceUpdate / 60);

  return `${hoursSinceUpdate} hr since update`;
}

function normalizeVendorName(vendor) {
  return String(vendor || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getVendorRouteIndex(vendor) {
  const normalizedVendor = normalizeVendorName(vendor);
  const routeIndex = southVendorRouteOrder.findIndex(
    (routeVendor) => normalizeVendorName(routeVendor) === normalizedVendor,
  );

  return routeIndex === -1 ? Number.MAX_SAFE_INTEGER : routeIndex;
}

function getRunOpenItemCount(supplierRun) {
  return supplierRun && Array.isArray(supplierRun.items)
    ? supplierRun.items.filter((item) => !item.pickedUp).length
    : 0;
}

function getOpenItemCount(supplierRuns) {
  return supplierRuns.reduce(
    (count, supplierRun) =>
      count +
      (Array.isArray(supplierRun.items)
        ? supplierRun.items.filter((item) => !item.pickedUp).length
        : 0),
    0,
  );
}

function ActionCard({
  icon: Icon,
  label,
  title,
  description,
  metric,
  metricLabel,
  tone = "default",
  onClick,
}) {
  const toneClasses = {
    default: {
      button:
        "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30",
      icon: "bg-slate-100 text-slate-700",
      metric: "bg-slate-50 text-slate-950",
      arrow: "text-[#FC2C38]",
    },
    primary: {
      button:
        "border-red-200 bg-white hover:border-red-300 hover:bg-red-50/40",
      icon: "bg-red-50 text-[#FC2C38]",
      metric: "bg-red-50 text-red-900",
      arrow: "text-[#FC2C38]",
    },
    warning: {
      button:
        "border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/40",
      icon: "bg-amber-50 text-amber-700",
      metric: "bg-amber-50 text-amber-900",
      arrow: "text-amber-700",
    },
    dispatch: {
      button:
        "border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50",
      icon: "bg-white text-blue-700",
      metric: "bg-white text-blue-900",
      arrow: "text-blue-700",
    },
    success: {
      button:
        "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50",
      icon: "bg-emerald-100 text-emerald-700",
      metric: "bg-white text-emerald-800",
      arrow: "text-emerald-700",
    },
    archive: {
      button:
        "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
      icon: "bg-white text-slate-500",
      metric: "bg-white text-slate-700",
      arrow: "text-slate-500",
    },
  };
  const selectedTone = toneClasses[tone] || toneClasses.default;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition sm:p-5 ${selectedTone.button}`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${selectedTone.icon}`}
      >
        <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
        <span className="mt-1 block text-xl font-black text-slate-950">
          {title}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-slate-500">
          {description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span className={`rounded-2xl px-3 py-2 text-right ${selectedTone.metric}`}>
          <span className="block text-xl font-black">
            {metric}
          </span>
          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            {metricLabel}
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className={`h-5 w-5 transition group-hover:translate-x-1 ${selectedTone.arrow}`}
          strokeWidth={2.6}
        />
      </span>
    </button>
  );
}

export default function SouthHubPage({
  supplierRuns,
  allowedPageIds,
  canViewAvailableTrucks = true,
  onPageChange,
}) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleSettings, setVehicleSettings] = useState([]);
  const [vehicleError, setVehicleError] = useState("");
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const canOpen = (pageId) => allowedPageIds.includes(pageId);
  const needsDispatchRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      (supplierRun.dispatchStatus === "needsDispatch" ||
        !supplierRun.driver),
  );
  const assignedOpenRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      supplierRun.dispatchStatus !== "needsDispatch" &&
      supplierRun.driver,
  );
  const completedRuns = supplierRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );
  const vehicleById = useMemo(() => {
    const vehicleMap = new Map();

    vehicles.forEach((vehicle, index) => {
      vehicleMap.set(getVehicleKey(vehicle, index), vehicle);
    });

    return vehicleMap;
  }, [vehicles]);
  const vehicleSettingsById = useMemo(
    () =>
      vehicleSettings.reduce(
        (settingsById, setting) => ({
          ...settingsById,
          [setting.id]: setting,
        }),
        {},
      ),
    [vehicleSettings],
  );
  const vehicleTitles = vehicles.map((vehicle, index) => {
    const vehicleId = getVehicleKey(vehicle, index);
    const savedSetting = vehicleSettingsById[vehicleId];
    const bouncieName = getVehicleName(vehicle);

    return (
      savedSetting?.title ||
      getVehicleDefaultAppTitle(vehicle) ||
      bouncieName
    );
  });
  const vehicleBadges = getUniqueVehicleBadgeTexts(
    vehicles.map((vehicle, index) => {
      const vehicleId = getVehicleKey(vehicle, index);
      const savedSetting = vehicleSettingsById[vehicleId];

      return savedSetting?.badge || vehicleTitles[index];
    }),
  );
  const currentTruckGroups = useMemo(() => {
    const groupsByVehicleId = new Map();

    assignedOpenRuns
      .filter((supplierRun) => supplierRun.vehicleId)
      .forEach((supplierRun) => {
        const vehicleId = supplierRun.vehicleId;
        const currentGroup = groupsByVehicleId.get(vehicleId) || {
          vehicleId,
          vehicleTitle:
            supplierRun.vehicleTitle ||
            supplierRun.vehicleBadge ||
            "South truck",
          vehicleBadge: supplierRun.vehicleBadge || "",
          driver: supplierRun.driver || "Unassigned driver",
          runs: [],
        };

        currentGroup.runs.push(supplierRun);
        groupsByVehicleId.set(vehicleId, currentGroup);
      });

    return [...groupsByVehicleId.values()]
      .map((group) => {
        const sortedRuns = [...group.runs].sort((firstRun, secondRun) => {
          const routeDifference =
            getVendorRouteIndex(firstRun.vendor) -
            getVendorRouteIndex(secondRun.vendor);

          if (routeDifference !== 0) {
            return routeDifference;
          }

          return String(firstRun.poNumber || "").localeCompare(
            String(secondRun.poNumber || ""),
          );
        });
        const nextRun =
          sortedRuns.find((supplierRun) => getRunOpenItemCount(supplierRun) > 0) ||
          sortedRuns[0];

        return {
          ...group,
          sortedRuns,
          nextRun,
          openItems: sortedRuns.reduce(
            (count, supplierRun) => count + getRunOpenItemCount(supplierRun),
            0,
          ),
          liveVehicle: vehicleById.get(group.vehicleId) || null,
        };
      })
      .sort((firstGroup, secondGroup) =>
        String(firstGroup.driver || "").localeCompare(
          String(secondGroup.driver || ""),
        ),
      );
  }, [assignedOpenRuns, vehicleById]);
  const assignedVehicleIds = useMemo(
    () =>
      new Set(
        currentTruckGroups
          .map((group) => group.vehicleId)
          .filter(Boolean),
      ),
    [currentTruckGroups],
  );
  const availableVehicles = canViewAvailableTrucks
    ? vehicles
        .map((vehicle, index) => {
          const id = getVehicleKey(vehicle, index);

          return {
            id,
            vehicle,
            title: vehicleTitles[index],
            badge: vehicleBadges[index],
            yearMakeModel: getVehicleYearMakeModel(vehicle),
            locationLabel: getVehicleLocationLabel(vehicle),
            lastUpdated: getVehicleLastUpdated(vehicle),
            freshnessLabel: getVehicleFreshnessLabel(vehicle),
            mapUrl: getVehicleMapUrl(vehicle),
          };
        })
        .filter((vehicle) => !assignedVehicleIds.has(vehicle.id))
    : [];
  const actionCards = [
    canOpen("supplier-runs-dispatch")
      ? {
          icon: AlertTriangle,
          label: "Dispatch",
          title: "Needs Dispatch",
          description:
            "Assign driver and truck before the pickup reaches the driver board.",
          metric: needsDispatchRuns.length,
          metricLabel: "Waiting",
          tone: "dispatch",
          pageId: "supplier-runs-dispatch",
        }
      : null,
    canOpen("supplier-runs-check")
      ? {
          icon: PackageCheck,
          label: "Driver Board",
          title: "POs To Pick Up",
          description:
            "Open supplier stops, route order, item checkoffs, and pickup photos.",
          metric: assignedOpenRuns.length,
          metricLabel: "Open POs",
          tone: "success",
          pageId: "supplier-runs-check",
        }
      : null,
    canOpen("supplier-runs-history")
      ? {
          icon: History,
          label: "Archive",
          title: "South History",
          description:
            "Review completed South pickups after they leave the daily board.",
          metric: completedRuns.length,
          metricLabel: "Complete",
          tone: "archive",
          pageId: "supplier-runs-history",
        }
      : null,
  ].filter(Boolean);

  async function loadSouthVehicles() {
    setIsLoadingVehicles(true);
    setVehicleError("");

    try {
      const vehiclesResponse = await fetch("/api/bouncie/vehicles");
      const vehiclesData = await readApiJson(
        vehiclesResponse,
        "Bouncie vehicles route",
      );

      if (!vehiclesResponse.ok) {
        setVehicleError(vehiclesData.error || "Unable to load truck location.");
        setVehicles([]);
        return;
      }

      setVehicles(
        Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : [],
      );
    } catch (loadError) {
      console.error("Unable to load South truck location:", loadError);
      setVehicleError(
        loadError.message || "Unable to reach the Bouncie vehicle route.",
      );
    } finally {
      setIsLoadingVehicles(false);
    }
  }

  useEffect(() => {
    loadSouthVehicles();
  }, []);

  useEffect(
    () =>
      subscribeToBouncieVehicleSettings(
        setVehicleSettings,
        (settingsError) => {
          console.error("Unable to sync Bouncie vehicle settings:", settingsError);
        },
      ),
    [],
  );

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "South" }]} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            <Truck aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            South
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            South
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            Start requests, dispatch trucks, and track pickups from one clean
            place.
          </p>
        </div>

        {canOpen("supplier-runs-add") ? (
          <button
            type="button"
            onClick={() => onPageChange("supplier-runs-add")}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-600 sm:mt-1"
          >
            <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
            Add PO
          </button>
        ) : null}
      </div>

      <section className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <p className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 sm:flex-row sm:items-center sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
            <ClipboardList
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Requests
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">
            {needsDispatchRuns.length}
          </p>
          <p className="mt-1 text-xs font-bold leading-tight text-slate-500 sm:text-sm">
            Waiting for dispatch
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <p className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 sm:flex-row sm:items-center sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
            <PackageCheck
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Open Pickups
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">
            {assignedOpenRuns.length}
          </p>
          <p className="mt-1 text-xs font-bold leading-tight text-slate-500 sm:text-sm">
            {getOpenItemCount(assignedOpenRuns)} items left
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <p className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 sm:flex-row sm:items-center sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
            <History
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            Completed
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">
            {completedRuns.length}
          </p>
          <p className="mt-1 text-xs font-bold leading-tight text-slate-500 sm:text-sm">
            South history records
          </p>
        </div>
      </section>

      {currentTruckGroups.length > 0 ||
      availableVehicles.length > 0 ||
      (canViewAvailableTrucks && vehicleError) ? (
        <section className="mb-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                <Truck
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.5}
                />
                {currentTruckGroups.length > 0
                  ? "Current South Truck"
                  : "Available Trucks"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {currentTruckGroups.length > 0
                  ? "Location and next planned stop"
                  : "Recent locations when South is quiet"}
              </h2>
            </div>

            <button
              type="button"
              onClick={loadSouthVehicles}
              disabled={isLoadingVehicles}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 ${isLoadingVehicles ? "animate-spin" : ""}`}
                strokeWidth={2.5}
              />
              Refresh
            </button>
          </div>

          {vehicleError ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              {vehicleError}
            </div>
          ) : null}

          {currentTruckGroups.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {currentTruckGroups.map((group) => {
              const locationLabel = group.liveVehicle
                ? getVehicleLocationLabel(group.liveVehicle)
                : "";
              const lastUpdated = group.liveVehicle
                ? getVehicleLastUpdated(group.liveVehicle)
                : "";
              const mapUrl = group.liveVehicle
                ? getVehicleMapUrl(group.liveVehicle)
                : "";

              return (
                <article
                  key={group.vehicleId}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0F2] text-sm font-black text-[#FC2C38]">
                      {group.vehicleBadge ||
                        group.vehicleTitle.slice(0, 2).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xl font-black text-slate-950">
                        {group.vehicleTitle}
                      </h3>
                      <p className="mt-0.5 text-sm font-bold text-slate-500">
                        Driver: {group.driver}
                      </p>
                    </div>

                    <span className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                      <span className="block text-lg font-black text-slate-950">
                        {group.openItems}
                      </span>
                      <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Items left
                      </span>
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Next planned stop
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {group.nextRun?.vendor || "No stop selected"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        PO {group.nextRun?.poNumber || "-"} ·{" "}
                        {getRunOpenItemCount(group.nextRun)} items left
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        <MapPin
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                          strokeWidth={2.5}
                        />
                        Last known location
                      </p>
                      <p className="mt-1 break-words text-sm font-black leading-5 text-slate-800">
                        {locationLabel || "Waiting for Bouncie location"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {lastUpdated ? `Updated ${lastUpdated}` : "No timestamp yet"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    {mapUrl ? (
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
                      >
                        <Navigation
                          aria-hidden="true"
                          className="h-4 w-4"
                          strokeWidth={2.5}
                        />
                        Open truck location
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onPageChange("supplier-runs-check")}
                      className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      View pickup route
                    </button>
                  </div>
                </article>
              );
              })}
            </div>
          ) : availableVehicles.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {availableVehicles.map((availableVehicle) => (
                <article
                  key={availableVehicle.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0F2] text-sm font-black text-[#FC2C38]">
                      {availableVehicle.badge}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-black text-slate-950">
                        {availableVehicle.title}
                      </h3>
                      <p className="mt-0.5 truncate text-sm font-bold text-slate-500">
                        {availableVehicle.yearMakeModel || "Not assigned to South"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      <MapPin
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        strokeWidth={2.5}
                      />
                      Last known location
                    </p>
                    <p className="mt-1 break-words text-sm font-black leading-5 text-slate-800">
                      {availableVehicle.locationLabel ||
                        "Waiting for Bouncie location"}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {availableVehicle.lastUpdated
                        ? `Updated ${availableVehicle.lastUpdated}`
                        : "No timestamp yet"}
                    </p>
                    <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-emerald-700">
                      {availableVehicle.freshnessLabel}
                    </p>
                  </div>

                  {availableVehicle.mapUrl ? (
                    <a
                      href={availableVehicle.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
                    >
                      <Navigation
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={2.5}
                      />
                      Open in Maps
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm font-black text-slate-700">
                No South trucks assigned and no Bouncie vehicles loaded yet.
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Refresh after Bouncie connects to see available truck locations.
              </p>
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-3">
        {actionCards.map((actionCard) => (
          <ActionCard
            key={actionCard.pageId}
            {...actionCard}
            onClick={() => onPageChange(actionCard.pageId)}
          />
        ))}
      </section>
    </PageContainer>
  );
}
