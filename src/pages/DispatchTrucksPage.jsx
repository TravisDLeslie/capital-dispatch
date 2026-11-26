import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  RefreshCw,
  Route,
  Timer,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import {
  getFirstVehicleValue,
  getUniqueVehicleBadgeTexts,
  getVehicleCoordinates,
  getVehicleDefaultAppTitle,
  getVehicleKey,
  getVehicleLastUpdated,
  getVehicleLocationLabel,
  getVehicleName,
  getVehicleYearMakeModel,
} from "../utils/bouncieVehicleFormatters";
import { subscribeToBouncieVehicleSettings } from "../utils/bouncieVehicleStorage";

const MAP_WIDTH = 1100;
const MAP_HEIGHT = 640;
const DEFAULT_MAP_CENTER = { latitude: 43.615, longitude: -116.39 };
const REFRESH_INTERVAL_MS = 30000;

function clampLatitude(latitude) {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function toWorldPoint(point, zoom) {
  const worldSize = 256 * 2 ** zoom;
  const latitudeRadians = (clampLatitude(point.latitude) * Math.PI) / 180;

  return {
    x: ((point.longitude + 180) / 360) * worldSize,
    y:
      ((1 -
        Math.log(
          Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians),
        ) /
          Math.PI) /
        2) *
      worldSize,
  };
}

function fromWorldPoint(point, zoom) {
  const worldSize = 256 * 2 ** zoom;
  const latitudeRadians = Math.atan(
    Math.sinh(Math.PI * (1 - 2 * (point.y / worldSize))),
  );

  return {
    latitude: (latitudeRadians * 180) / Math.PI,
    longitude: (point.x / worldSize) * 360 - 180,
  };
}

function geoPointToMapPixel(point, center, zoom) {
  const worldPoint = toWorldPoint(point, zoom);
  const worldCenter = toWorldPoint(center, zoom);

  return {
    x: MAP_WIDTH / 2 + worldPoint.x - worldCenter.x,
    y: MAP_HEIGHT / 2 + worldPoint.y - worldCenter.y,
  };
}

function getVisibleMapTiles(center, zoom) {
  const tileSize = 256;
  const tileCount = 2 ** zoom;
  const centerPoint = toWorldPoint(center, zoom);
  const topLeft = {
    x: centerPoint.x - MAP_WIDTH / 2,
    y: centerPoint.y - MAP_HEIGHT / 2,
  };
  const startTileX = Math.floor(topLeft.x / tileSize) - 1;
  const endTileX = Math.ceil((topLeft.x + MAP_WIDTH) / tileSize) + 1;
  const startTileY = Math.max(0, Math.floor(topLeft.y / tileSize) - 1);
  const endTileY = Math.min(
    tileCount - 1,
    Math.ceil((topLeft.y + MAP_HEIGHT) / tileSize) + 1,
  );
  const tiles = [];

  for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedTileX}/${tileY}.png`,
        left: tileX * tileSize - topLeft.x,
        top: tileY * tileSize - topLeft.y,
      });
    }
  }

  return tiles;
}

function getMapFocus(points) {
  if (!points.length) {
    return { center: DEFAULT_MAP_CENTER, zoom: 10 };
  }

  const minLatitude = Math.min(...points.map((point) => point.latitude));
  const maxLatitude = Math.max(...points.map((point) => point.latitude));
  const minLongitude = Math.min(...points.map((point) => point.longitude));
  const maxLongitude = Math.max(...points.map((point) => point.longitude));
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.001);
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.001);
  const requiredZoomForWidth = Math.log2(360 / (longitudeSpan * 1.4));
  const requiredZoomForHeight = Math.log2(170 / (latitudeSpan * 1.4));

  return {
    center: {
      latitude: (minLatitude + maxLatitude) / 2,
      longitude: (minLongitude + maxLongitude) / 2,
    },
    zoom: Math.max(
      8,
      Math.min(16, Math.floor(Math.min(requiredZoomForWidth, requiredZoomForHeight))),
    ),
  };
}

function normalizeCoordinates(vehicle) {
  const coordinates = getVehicleCoordinates(vehicle);

  if (!coordinates) {
    return null;
  }

  const latitude = Number(coordinates.latitude);
  const longitude = Number(coordinates.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function getVehicleSpeed(vehicle) {
  const rawSpeed = getFirstVehicleValue(vehicle, [
    "stats.speed",
    "stats.location.speed",
    "speed",
    "currentSpeed",
    "location.speed",
  ]);
  const speed = Number(rawSpeed);

  return Number.isFinite(speed) ? Math.max(0, speed) : 0;
}

function getVehicleEngineRunning(vehicle) {
  const rawValue = getFirstVehicleValue(vehicle, [
    "stats.isRunning",
    "stats.engineRunning",
    "stats.ignition",
    "isRunning",
    "engineRunning",
    "ignition",
  ]).toLowerCase();

  return ["true", "on", "running", "1"].includes(rawValue);
}

function formatRefreshTime(value) {
  if (!value) return "Not refreshed yet";

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getTodayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDailyHistoryWindow(dateValue) {
  const [year, month, day] = String(dateValue || "")
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;

  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

  return {
    startsAfter: start.toISOString(),
    endsBefore: end.toISOString(),
  };
}

function getVehicleImei(vehicle) {
  return getFirstVehicleValue(vehicle, ["imei", "device.imei", "stats.imei"]);
}

function collectCoordinatePairs(value, coordinatePairs) {
  if (!value) return;

  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      Number.isFinite(Number(value[0])) &&
      Number.isFinite(Number(value[1]))
    ) {
      coordinatePairs.push([Number(value[0]), Number(value[1])]);
      return;
    }

    value.forEach((entry) => collectCoordinatePairs(entry, coordinatePairs));
    return;
  }

  if (typeof value !== "object") return;

  if (value.type === "FeatureCollection") {
    collectCoordinatePairs(value.features, coordinatePairs);
  } else if (value.type === "Feature") {
    collectCoordinatePairs(value.geometry, coordinatePairs);
  } else if (value.coordinates) {
    collectCoordinatePairs(value.coordinates, coordinatePairs);
  } else if (value.geometry) {
    collectCoordinatePairs(value.geometry, coordinatePairs);
  }
}

function getTripCoordinates(trip) {
  let gps = trip?.gps;

  if (typeof gps === "string") {
    try {
      gps = JSON.parse(gps);
    } catch {
      return [];
    }
  }

  const coordinatePairs = [];
  collectCoordinatePairs(gps, coordinatePairs);

  return coordinatePairs
    .map(([longitude, latitude]) => ({ latitude, longitude }))
    .filter(
      (point) =>
        Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180,
    );
}

function sampleTripCoordinates(points, maximumPoints = 240) {
  if (points.length <= maximumPoints) return points;

  const step = Math.ceil(points.length / maximumPoints);
  const sampledPoints = points.filter(
    (_point, index) => index === 0 || index === points.length - 1 || index % step === 0,
  );

  return sampledPoints;
}

function formatTripTime(value, timeZone) {
  if (!value) return "Time unavailable";

  const tripDate = new Date(value);

  if (Number.isNaN(tripDate.getTime())) return "Time unavailable";

  const options = {
    hour: "numeric",
    minute: "2-digit",
  };

  // Bouncie can return a numeric offset such as "-0700", which Intl does not
  // accept as a time-zone name. In that case the browser's local time is used.
  if (typeof timeZone === "string" && timeZone.includes("/")) {
    options.timeZone = timeZone;
  }

  return tripDate.toLocaleTimeString([], options);
}

function getTripDurationMinutes(trip) {
  const startTime = new Date(trip?.startTime).getTime();
  const endTime = new Date(trip?.endTime).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;

  return Math.max(0, Math.round((endTime - startTime) / 60000));
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function formatCoordinate(point) {
  if (!point) return "Location unavailable";

  return `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
}

async function readApiJson(response, routeName) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const responseText = await response.text();
  throw new Error(
    `${routeName} returned ${response.status} instead of JSON. ${responseText.slice(0, 120)}`,
  );
}

function getApiErrorMessage(value, fallbackMessage) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value?.message && typeof value.message === "string") return value.message;

  return fallbackMessage;
}

function normalizeVehicleIdentifier(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findVehicleSetting(vehicle, vehicleId, vehicleSettings) {
  const vehicleVin = normalizeVehicleIdentifier(
    getFirstVehicleValue(vehicle, ["vin", "vehicle.vin"]),
  );
  const vehicleImei = normalizeVehicleIdentifier(
    getFirstVehicleValue(vehicle, ["imei", "device.imei"]),
  );
  const vehicleName = normalizeVehicleIdentifier(getVehicleName(vehicle));

  return (
    vehicleSettings.find((setting) => setting.id === vehicleId) ||
    vehicleSettings.find((setting) => {
      const settingVin = normalizeVehicleIdentifier(setting.vin);
      const settingImei = normalizeVehicleIdentifier(setting.imei);
      const settingName = normalizeVehicleIdentifier(
        setting.bouncieName || setting.nickname || setting.title,
      );

      return (
        (vehicleVin && settingVin === vehicleVin) ||
        (vehicleImei && settingImei === vehicleImei) ||
        (vehicleName && settingName === vehicleName)
      );
    }) ||
    null
  );
}

function DailyTruckHistoryPanel({
  dailyTripTotals,
  historyDate,
  historyError,
  isHistoryLoading,
  normalizedDailyTrips,
  onHistoryDateChange,
  onSelectTrip,
  selectedTripId,
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/60">
      <div className="border-b border-blue-200 bg-white px-3 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600">
              Daily history
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Select a route to fit it on the map.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <label className="min-w-0 max-w-[10.5rem]">
              <span className="sr-only">History date</span>
              <span className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <input
                  type="date"
                  value={historyDate}
                  max={getTodayDateInputValue()}
                  onChange={(event) => onHistoryDateChange(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-xs font-black text-slate-900 outline-none"
                />
              </span>
            </label>
            {selectedTripId ? (
              <button
                type="button"
                onClick={() => onSelectTrip(null)}
                className="text-[10px] font-black uppercase tracking-[0.08em] text-blue-700 transition hover:text-blue-900"
              >
                Show full day
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Trips</p>
          <p className="mt-0.5 text-lg font-black text-slate-950">{normalizedDailyTrips.length}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-blue-700">Miles</p>
          <p className="mt-0.5 text-lg font-black text-blue-950">{dailyTripTotals.distance.toFixed(1)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Drive time</p>
          <p className="mt-0.5 text-sm font-black text-slate-950">{formatDuration(dailyTripTotals.durationMinutes)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-700">Idle time</p>
          <p className="mt-0.5 text-sm font-black text-amber-950">{formatDuration(dailyTripTotals.idleMinutes)}</p>
        </div>
      </div>

      {historyError ? (
        <div className="mx-3 mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-black text-red-700">
          {historyError}
        </div>
      ) : isHistoryLoading ? (
        <div className="mx-3 mb-3 flex min-h-24 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading daily history…
        </div>
      ) : normalizedDailyTrips.length === 0 ? (
        <div className="mx-3 mb-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-6 text-center">
          <Route className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-xs font-black text-slate-700">No trips reported for this day</p>
        </div>
      ) : (
        <div className="space-y-2 px-3 pb-3">
          {normalizedDailyTrips.map((trip) => {
            const startPoint = trip.coordinates[0] || null;
            const endPoint = trip.coordinates.at(-1) || null;
            const timeZone = typeof trip.timeZone === "string" ? trip.timeZone : "";
            const isSelected = selectedTripId === trip.mapId;

            return (
              <article
                key={trip.mapId}
                className={`rounded-xl border bg-white p-3 shadow-sm transition ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-blue-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">
                    {tripIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-950">
                      {formatTripTime(trip.startTime, timeZone)} – {formatTripTime(trip.endTime, timeZone)}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                      Start {formatCoordinate(startPoint)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <span className="flex items-center justify-center gap-1 rounded-lg bg-blue-50 px-2 py-1.5 text-[10px] font-black text-blue-800">
                    <Route className="h-3 w-3" aria-hidden="true" />
                    {(Number(trip.distance) || 0).toFixed(1)} mi
                  </span>
                  <span className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-black text-slate-700">
                    <Timer className="h-3 w-3" aria-hidden="true" />
                    {formatDuration(trip.durationMinutes)}
                  </span>
                  {startPoint && endPoint ? (
                    <button
                      type="button"
                      onClick={() => onSelectTrip(isSelected ? null : trip)}
                      className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-black transition ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                      }`}
                    >
                      <LocateFixed className="h-3 w-3" aria-hidden="true" />
                      {isSelected ? "Showing" : "Route"}
                    </button>
                  ) : (
                    <span className="rounded-lg bg-slate-100 px-2 py-1.5 text-center text-[10px] font-black text-slate-400">
                      No route
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DispatchTrucksPage({ onPageChange }) {
  const mapFrameRef = useRef(null);
  const mapPanRef = useRef(null);
  const didFitInitialVehiclesRef = useRef(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleSettings, setVehicleSettings] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(10);
  const [isPanning, setIsPanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState("");
  const [historyDate, setHistoryDate] = useState(getTodayDateInputValue);
  const [dailyTrips, setDailyTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const vehicleDisplayDetails = useMemo(
    () =>
      vehicles.map((vehicle, index) => {
        const vehicleId = getVehicleKey(vehicle, index);
        const setting = findVehicleSetting(
          vehicle,
          vehicleId,
          vehicleSettings,
        );
        const bouncieNickname = getVehicleName(vehicle);
        const alias =
          setting?.title || getVehicleDefaultAppTitle(vehicle) || "";
        const title =
          setting?.nickname ||
          bouncieNickname ||
          alias ||
          "Bouncie Vehicle";

        return {
          alias: alias !== title ? alias : "",
          badgeSource: setting?.badge || alias || title,
          photoDataUrl: String(setting?.photoDataUrl || "").trim(),
          setting,
          title,
          yearMakeModel:
            setting?.yearMakeModel ||
            [setting?.year, setting?.make, setting?.model]
              .filter(Boolean)
              .join(" ") ||
            getVehicleYearMakeModel(vehicle),
        };
      }),
    [vehicleSettings, vehicles],
  );

  const vehicleTitles = useMemo(
    () => vehicleDisplayDetails.map((vehicleDetail) => vehicleDetail.title),
    [vehicleDisplayDetails],
  );

  const vehicleBadges = useMemo(
    () =>
      getUniqueVehicleBadgeTexts(
        vehicleDisplayDetails.map(
          (vehicleDetail) => vehicleDetail.badgeSource,
        ),
      ),
    [vehicleDisplayDetails],
  );

  const truckRows = useMemo(
    () =>
      vehicles
        .map((vehicle, index) => {
          const coordinates = normalizeCoordinates(vehicle);
          const speed = getVehicleSpeed(vehicle);
          const isMoving = speed > 1 || getVehicleEngineRunning(vehicle);
          const displayDetail = vehicleDisplayDetails[index];

          return {
            alias: displayDetail.alias,
            badge: vehicleBadges[index],
            coordinates,
            id: getVehicleKey(vehicle, index),
            isMoving,
            lastUpdated: getVehicleLastUpdated(vehicle),
            location: getVehicleLocationLabel(vehicle),
            photoDataUrl: displayDetail.photoDataUrl,
            speed,
            title: vehicleTitles[index],
            vehicle,
            yearMakeModel: displayDetail.yearMakeModel,
          };
        })
        .sort((firstTruck, secondTruck) => {
          if (firstTruck.isMoving !== secondTruck.isMoving) {
            return firstTruck.isMoving ? -1 : 1;
          }

          return firstTruck.title.localeCompare(secondTruck.title);
        }),
    [vehicleBadges, vehicleDisplayDetails, vehicleTitles, vehicles],
  );

  const trucksWithLocations = useMemo(
    () => truckRows.filter((truckRow) => truckRow.coordinates),
    [truckRows],
  );
  const selectedTruck = truckRows.find(
    (truckRow) => truckRow.id === selectedVehicleId,
  );
  const selectedTruckImei = getVehicleImei(selectedTruck?.vehicle);
  const normalizedDailyTrips = useMemo(
    () =>
      dailyTrips
        .map((trip, tripIndex) => ({
          ...trip,
          coordinates: getTripCoordinates(trip),
          durationMinutes: getTripDurationMinutes(trip),
          mapId: String(
            trip.transactionId ||
              trip.id ||
              `${trip.startTime}-${trip.endTime}-${tripIndex}`,
          ),
        }))
        .sort(
          (firstTrip, secondTrip) =>
            new Date(firstTrip.startTime).getTime() -
            new Date(secondTrip.startTime).getTime(),
        ),
    [dailyTrips],
  );
  const dailyTripTotals = useMemo(
    () =>
      normalizedDailyTrips.reduce(
        (totals, trip) => ({
          distance: totals.distance + (Number(trip.distance) || 0),
          durationMinutes: totals.durationMinutes + trip.durationMinutes,
          idleMinutes:
            totals.idleMinutes + Math.round((Number(trip.totalIdleDuration) || 0) / 60),
        }),
        { distance: 0, durationMinutes: 0, idleMinutes: 0 },
      ),
    [normalizedDailyTrips],
  );
  const selectedDailyTrip = useMemo(
    () =>
      normalizedDailyTrips.find((trip) => trip.mapId === selectedTripId) ||
      null,
    [normalizedDailyTrips, selectedTripId],
  );
  const visibleDailyTrips = useMemo(
    () => (selectedDailyTrip ? [selectedDailyTrip] : normalizedDailyTrips),
    [normalizedDailyTrips, selectedDailyTrip],
  );
  const visibleMapTiles = useMemo(
    () => getVisibleMapTiles(mapCenter, mapZoom),
    [mapCenter, mapZoom],
  );
  const renderedTruckMarkers = useMemo(
    () =>
      trucksWithLocations.map((truckRow) => ({
        ...truckRow,
        pixel: geoPointToMapPixel(truckRow.coordinates, mapCenter, mapZoom),
      })),
    [mapCenter, mapZoom, trucksWithLocations],
  );
  const renderedTripPaths = useMemo(
    () =>
      visibleDailyTrips
        .map((trip) => ({
          id: trip.mapId,
          isSelected: trip.mapId === selectedTripId,
          points: sampleTripCoordinates(trip.coordinates).map((point) =>
            geoPointToMapPixel(point, mapCenter, mapZoom),
          ),
        }))
        .filter((tripPath) => tripPath.points.length > 1),
    [mapCenter, mapZoom, selectedTripId, visibleDailyTrips],
  );

  async function loadVehicles({ showLoading = false } = {}) {
    if (showLoading) setIsLoading(true);
    setError("");

    try {
      const statusResponse = await fetch("/api/bouncie/status");
      const statusData = await readApiJson(statusResponse, "Bouncie status route");

      if (!statusResponse.ok || !statusData.connected) {
        throw new Error(statusData.error || "Bouncie is not connected.");
      }

      const vehiclesResponse = await fetch("/api/bouncie/vehicles");
      const vehiclesData = await readApiJson(
        vehiclesResponse,
        "Bouncie vehicles route",
      );

      if (!vehiclesResponse.ok) {
        throw new Error(vehiclesData.error || "Unable to load truck locations.");
      }

      setVehicles(
        Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : [],
      );
      setLastRefreshedAt(new Date().toISOString());
    } catch (loadError) {
      console.error("Unable to load Bouncie truck locations:", loadError);
      setError(loadError.message || "Unable to load truck locations.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadVehicles({ showLoading: true });
    const refreshTimer = window.setInterval(loadVehicles, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(
    () =>
      subscribeToBouncieVehicleSettings(
        setVehicleSettings,
        (settingsError) => {
          console.error(
            "Unable to sync Bouncie vehicle settings:",
            settingsError,
          );
        },
      ),
    [],
  );

  useEffect(() => {
    if (didFitInitialVehiclesRef.current || trucksWithLocations.length === 0) {
      return;
    }

    didFitInitialVehiclesRef.current = true;
    const focus = getMapFocus(
      trucksWithLocations.map((truckRow) => truckRow.coordinates),
    );
    setMapCenter(focus.center);
    setMapZoom(focus.zoom);
  }, [trucksWithLocations]);

  useEffect(() => {
    setSelectedTripId("");

    if (!selectedTruckImei) {
      setDailyTrips([]);
      setHistoryError("");
      setIsHistoryLoading(false);
      return undefined;
    }

    const historyWindow = getDailyHistoryWindow(historyDate);

    if (!historyWindow) {
      setDailyTrips([]);
      setHistoryError("Choose a valid history date.");
      return undefined;
    }

    const abortController = new AbortController();

    async function loadDailyHistory() {
      setIsHistoryLoading(true);
      setHistoryError("");

      try {
        const searchParams = new URLSearchParams({
          imei: selectedTruckImei,
          "starts-after": historyWindow.startsAfter,
          "ends-before": historyWindow.endsBefore,
        });
        const historyResponse = await fetch(
          `/api/bouncie/trips?${searchParams.toString()}`,
          { signal: abortController.signal },
        );
        const historyData = await readApiJson(
          historyResponse,
          "Bouncie trips route",
        );

        if (!historyResponse.ok) {
          throw new Error(
            getApiErrorMessage(
              historyData.error,
              "Unable to load truck history.",
            ),
          );
        }

        setDailyTrips(
          Array.isArray(historyData.trips) ? historyData.trips : [],
        );
      } catch (loadError) {
        if (loadError.name === "AbortError") return;

        console.error("Unable to load Bouncie truck history:", loadError);
        setDailyTrips([]);
        setHistoryError(
          loadError.message || "Unable to load truck history.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsHistoryLoading(false);
        }
      }
    }

    loadDailyHistory();

    return () => abortController.abort();
  }, [historyDate, selectedTruckImei]);

  useEffect(() => {
    const historyPoints = normalizedDailyTrips.flatMap(
      (trip) => trip.coordinates,
    );

    if (historyPoints.length === 0) return;

    const focus = getMapFocus(historyPoints);
    setMapCenter(focus.center);
    setMapZoom(focus.zoom);
  }, [normalizedDailyTrips]);

  function fitAllTrucks() {
    const focus = getMapFocus(
      trucksWithLocations.map((truckRow) => truckRow.coordinates),
    );
    setMapCenter(focus.center);
    setMapZoom(focus.zoom);
  }

  function selectTruck(truckRow) {
    setSelectedTripId("");
    setSelectedVehicleId(truckRow.id);

    if (truckRow.coordinates) {
      setMapCenter(truckRow.coordinates);
      setMapZoom((currentZoom) => Math.max(14, currentZoom));
    }
  }

  function selectHistoryTrip(trip) {
    const nextTripId = trip?.mapId || "";
    const routePoints = trip
      ? trip.coordinates
      : normalizedDailyTrips.flatMap((dailyTrip) => dailyTrip.coordinates);

    setSelectedTripId(nextTripId);

    if (routePoints.length === 0) return;

    const focus = getMapFocus(routePoints);
    setMapCenter(focus.center);
    setMapZoom(focus.zoom);
  }

  function zoomMap(nextZoom) {
    setMapZoom(Math.max(8, Math.min(17, nextZoom)));
  }

  function handleMapPointerDown(event) {
    if (event.button !== 0 || event.target.closest?.("[data-map-control]")) {
      return;
    }

    mapPanRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCenter: mapCenter,
      zoom: mapZoom,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMapPointerMove(event) {
    const pan = mapPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !mapFrameRef.current) return;

    const bounds = mapFrameRef.current.getBoundingClientRect();
    const deltaMapX = ((event.clientX - pan.startClientX) / bounds.width) * MAP_WIDTH;
    const deltaMapY = ((event.clientY - pan.startClientY) / bounds.height) * MAP_HEIGHT;
    const startCenter = toWorldPoint(pan.startCenter, pan.zoom);

    setIsPanning(true);
    setMapCenter(
      fromWorldPoint(
        {
          x: startCenter.x - deltaMapX,
          y: startCenter.y - deltaMapY,
        },
        pan.zoom,
      ),
    );
  }

  function handleMapPointerUp(event) {
    if (mapPanRef.current?.pointerId === event.pointerId) {
      mapPanRef.current = null;
    }
    setIsPanning(false);
  }

  const movingTruckCount = truckRows.filter((truckRow) => truckRow.isMoving).length;

  return (
    <PageContainer className="max-w-[104rem]">
      <Breadcrumbs
        items={[
          { label: "Dispatch", onClick: () => onPageChange?.("dispatch") },
          { label: "Trucks" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Dispatch · Fleet locations
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Truck Map
          </h1>
          <p className="mt-2 max-w-3xl text-base font-semibold text-slate-500 sm:text-lg">
            See the latest location reported by Bouncie for every connected truck.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Last refreshed
            </p>
            <p className="mt-0.5 text-sm font-black text-slate-950">
              {formatRefreshTime(lastRefreshedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadVehicles({ showLoading: true })}
            disabled={isLoading}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh trucks
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
          {error} Ask an admin to check the Bouncie connection under Fleet if this continues.
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Connected</p>
              <p className="text-2xl font-black text-slate-950">{truckRows.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Moving / running</p>
              <p className="text-2xl font-black text-emerald-950">{movingTruckCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">On map</p>
              <p className="text-2xl font-black text-blue-950">{trucksWithLocations.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[28rem_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#FC2C38]">Bouncie vehicles</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Truck status</h2>
          </div>
          <div className="max-h-[54rem] space-y-2 overflow-y-auto p-3">
            {isLoading && truckRows.length === 0 ? (
              <div className="flex min-h-44 items-center justify-center gap-2 text-sm font-black text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading truck locations…
              </div>
            ) : truckRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <Truck className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-black text-slate-700">No Bouncie trucks found</p>
              </div>
            ) : (
              truckRows.map((truckRow) => {
                const isSelected = selectedVehicleId === truckRow.id;

                return (
                  <div key={truckRow.id}>
                    <button
                      type="button"
                      onClick={() => selectTruck(truckRow)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white text-xs font-black text-white shadow-sm ${truckRow.isMoving ? "bg-emerald-600" : "bg-slate-800"}`}>
                          {truckRow.photoDataUrl ? (
                            <img
                              src={truckRow.photoDataUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Truck className="h-6 w-6" aria-hidden="true" />
                          )}
                          <span className={`absolute bottom-0.5 right-0.5 rounded-md px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm ${truckRow.isMoving ? "bg-emerald-700" : "bg-slate-950"}`}>
                            {truckRow.badge}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-black text-slate-950">{truckRow.title}</span>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${truckRow.isMoving ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                              {truckRow.isMoving ? "Moving" : "Parked"}
                            </span>
                          </span>
                          {truckRow.alias || truckRow.yearMakeModel ? (
                            <span className="mt-0.5 block truncate text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                              {[truckRow.alias, truckRow.yearMakeModel]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          ) : null}
                          <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                            {truckRow.location || "Location not reported"}
                          </span>
                          <span className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {truckRow.lastUpdated || "Report time unavailable"}
                          </span>
                        </span>
                      </div>
                    </button>

                    {isSelected ? (
                      <DailyTruckHistoryPanel
                        dailyTripTotals={dailyTripTotals}
                        historyDate={historyDate}
                        historyError={historyError}
                        isHistoryLoading={isHistoryLoading}
                        normalizedDailyTrips={normalizedDailyTrips}
                        onHistoryDateChange={setHistoryDate}
                        onSelectTrip={selectHistoryTrip}
                        selectedTripId={selectedTripId}
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {selectedTruck ? (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-sm">
                  {selectedTruck.photoDataUrl ? (
                    <img
                      src={selectedTruck.photoDataUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Truck className="h-6 w-6" aria-hidden="true" />
                  )}
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#FC2C38]">Dispatch map</p>
                <h2 className="mt-1 truncate text-xl font-black text-slate-950">
                  {selectedTruck ? selectedTruck.title : "All truck locations"}
                </h2>
                {selectedTruck?.alias || selectedTruck?.yearMakeModel ? (
                  <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                    {[selectedTruck.alias, selectedTruck.yearMakeModel]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {selectedDailyTrip ? (
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-blue-700">
                    Viewing route · {formatTripTime(
                      selectedDailyTrip.startTime,
                      selectedDailyTrip.timeZone,
                    )} – {formatTripTime(
                      selectedDailyTrip.endTime,
                      selectedDailyTrip.timeZone,
                    )}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedTruck?.coordinates ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTruck.coordinates.latitude},${selectedTruck.coordinates.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <Navigation className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  Directions
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={fitAllTrucks}
                disabled={trucksWithLocations.length === 0}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                Fit trucks
              </button>
            </div>
          </div>

          <div
            ref={mapFrameRef}
            className={`relative aspect-[11/6.4] min-h-[32rem] select-none overflow-hidden bg-slate-100 ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
            onPointerDown={handleMapPointerDown}
            onPointerMove={handleMapPointerMove}
            onPointerUp={handleMapPointerUp}
            onPointerCancel={handleMapPointerUp}
            onWheel={(event) => {
              event.preventDefault();
              zoomMap(mapZoom + (event.deltaY < 0 ? 1 : -1));
            }}
          >
            {visibleMapTiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                draggable="false"
                className="pointer-events-none absolute h-auto max-w-none"
                style={{
                  height: `${(256 / MAP_HEIGHT) * 100}%`,
                  left: `${(tile.left / MAP_WIDTH) * 100}%`,
                  top: `${(tile.top / MAP_HEIGHT) * 100}%`,
                  width: `${(256 / MAP_WIDTH) * 100}%`,
                }}
              />
            ))}

            {renderedTripPaths.length > 0 ? (
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                preserveAspectRatio="none"
              >
                {renderedTripPaths.map((tripPath) => (
                  <polyline
                    key={tripPath.id}
                    points={tripPath.points
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke={tripPath.isSelected ? "#1d4ed8" : "#2563eb"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={tripPath.isSelected ? "0.95" : "0.72"}
                    strokeWidth={tripPath.isSelected ? "7" : "5"}
                  />
                ))}
              </svg>
            ) : null}

            {renderedTruckMarkers.map((truckRow) => {
              const isSelected = selectedVehicleId === truckRow.id;

              return (
                <button
                  key={truckRow.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectTruck(truckRow);
                  }}
                  className="absolute z-20 -translate-x-1/2 -translate-y-full"
                  style={{
                    left: `${(truckRow.pixel.x / MAP_WIDTH) * 100}%`,
                    top: `${(truckRow.pixel.y / MAP_HEIGHT) * 100}%`,
                  }}
                  title={`${truckRow.title} — ${truckRow.location || "location reported"}`}
                >
                  <span className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-4 border-white text-xs font-black text-white shadow-xl transition ${truckRow.isMoving ? "bg-emerald-600" : "bg-slate-900"} ${isSelected ? "scale-125 ring-4 ring-blue-400/50" : "hover:scale-110"}`}>
                    {truckRow.photoDataUrl ? (
                      <img
                        src={truckRow.photoDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Truck className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className={`absolute bottom-0 right-0 rounded-tl-md px-1 py-0.5 text-[7px] font-black text-white ${truckRow.isMoving ? "bg-emerald-700" : "bg-slate-950"}`}>
                      {truckRow.badge}
                    </span>
                  </span>
                  <span className={`mx-auto block h-3 w-3 -translate-y-1 rotate-45 border-b-2 border-r-2 border-white ${truckRow.isMoving ? "bg-emerald-600" : "bg-slate-900"}`} />
                </button>
              );
            })}

            <div data-map-control className="absolute right-4 top-4 z-30 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => zoomMap(mapZoom + 1)}
                className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-100"
                aria-label="Zoom in"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => zoomMap(mapZoom - 1)}
                className="flex h-11 w-11 items-center justify-center border-t border-slate-200 text-slate-700 transition hover:bg-slate-100"
                aria-label="Zoom out"
              >
                <Minus className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 z-30 rounded-lg bg-white/95 px-2 py-1 text-[9px] font-bold text-slate-500 shadow-sm">
              © OpenStreetMap contributors
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Truck positions refresh every 30 seconds. Times shown are the last report received from Bouncie.</span>
            <span className="shrink-0 font-black text-slate-700">Zoom {mapZoom}</span>
          </div>

        </section>
      </div>
    </PageContainer>
  );
}
