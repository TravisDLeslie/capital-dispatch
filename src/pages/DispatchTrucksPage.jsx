import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  RefreshCw,
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
} from "../utils/bouncieVehicleFormatters";

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

export default function DispatchTrucksPage({ onPageChange }) {
  const mapFrameRef = useRef(null);
  const mapPanRef = useRef(null);
  const didFitInitialVehiclesRef = useRef(false);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(10);
  const [isPanning, setIsPanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState("");

  const vehicleTitles = useMemo(
    () =>
      vehicles.map(
        (vehicle) =>
          getVehicleDefaultAppTitle(vehicle) || getVehicleName(vehicle),
      ),
    [vehicles],
  );

  const vehicleBadges = useMemo(
    () => getUniqueVehicleBadgeTexts(vehicleTitles),
    [vehicleTitles],
  );

  const truckRows = useMemo(
    () =>
      vehicles
        .map((vehicle, index) => {
          const coordinates = normalizeCoordinates(vehicle);
          const speed = getVehicleSpeed(vehicle);
          const isMoving = speed > 1 || getVehicleEngineRunning(vehicle);

          return {
            badge: vehicleBadges[index],
            coordinates,
            id: getVehicleKey(vehicle, index),
            isMoving,
            lastUpdated: getVehicleLastUpdated(vehicle),
            location: getVehicleLocationLabel(vehicle),
            speed,
            title: vehicleTitles[index],
            vehicle,
          };
        })
        .sort((firstTruck, secondTruck) => {
          if (firstTruck.isMoving !== secondTruck.isMoving) {
            return firstTruck.isMoving ? -1 : 1;
          }

          return firstTruck.title.localeCompare(secondTruck.title);
        }),
    [vehicleBadges, vehicleTitles, vehicles],
  );

  const trucksWithLocations = useMemo(
    () => truckRows.filter((truckRow) => truckRow.coordinates),
    [truckRows],
  );
  const selectedTruck = truckRows.find(
    (truckRow) => truckRow.id === selectedVehicleId,
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

  function fitAllTrucks() {
    const focus = getMapFocus(
      trucksWithLocations.map((truckRow) => truckRow.coordinates),
    );
    setMapCenter(focus.center);
    setMapZoom(focus.zoom);
  }

  function selectTruck(truckRow) {
    setSelectedVehicleId(truckRow.id);

    if (truckRow.coordinates) {
      setMapCenter(truckRow.coordinates);
      setMapZoom((currentZoom) => Math.max(14, currentZoom));
    }
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

      <div className="grid items-start gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#FC2C38]">Bouncie vehicles</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Truck status</h2>
          </div>
          <div className="max-h-[42rem] space-y-2 overflow-y-auto p-3">
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
              truckRows.map((truckRow) => (
                <button
                  key={truckRow.id}
                  type="button"
                  onClick={() => selectTruck(truckRow)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selectedVehicleId === truckRow.id
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-xs font-black text-white ${truckRow.isMoving ? "bg-emerald-600" : "bg-slate-800"}`}>
                      {truckRow.badge}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-black text-slate-950">{truckRow.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${truckRow.isMoving ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                          {truckRow.isMoving ? "Moving" : "Parked"}
                        </span>
                      </span>
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
              ))
            )}
          </div>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#FC2C38]">Dispatch map</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                {selectedTruck ? selectedTruck.title : "All truck locations"}
              </h2>
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
                  <span className={`flex min-h-11 min-w-11 items-center justify-center rounded-2xl border-4 border-white px-2 text-xs font-black text-white shadow-xl transition ${truckRow.isMoving ? "bg-emerald-600" : "bg-slate-900"} ${isSelected ? "scale-125 ring-4 ring-blue-400/50" : "hover:scale-110"}`}>
                    {truckRow.badge}
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
