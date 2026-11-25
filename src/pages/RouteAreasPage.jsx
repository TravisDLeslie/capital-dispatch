import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Edit3,
  LocateFixed,
  MapPinned,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";
import {
  saveRouteAreas,
  subscribeToRouteAreas,
} from "../utils/routeAreaStorage";

const MAP_WIDTH = 640;
const MAP_HEIGHT = 480;
const DEFAULT_MAP_CENTER = { latitude: 43.615, longitude: -116.2023 };
const MAP_PRESETS = [
  { label: "Treasure Valley", latitude: 43.61, longitude: -116.39, zoom: 10 },
  { label: "Boise", latitude: 43.615, longitude: -116.2023, zoom: 11 },
  { label: "North End", latitude: 43.6403, longitude: -116.2025, zoom: 13 },
  { label: "Meridian", latitude: 43.6121, longitude: -116.3915, zoom: 12 },
  { label: "Eagle", latitude: 43.6954, longitude: -116.354, zoom: 12 },
  { label: "Nampa", latitude: 43.5407, longitude: -116.5635, zoom: 12 },
];
const AREA_COLORS = [
  "#2563EB",
  "#0F766E",
  "#16A34A",
  "#9333EA",
  "#EA580C",
  "#DB2777",
  "#475569",
];

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
  const normalizedY = point.y / worldSize;
  const latitudeRadians = Math.atan(
    Math.sinh(Math.PI * (1 - 2 * normalizedY)),
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

function mapPixelToGeoPoint(x, y, center, zoom) {
  const worldCenter = toWorldPoint(center, zoom);
  return fromWorldPoint(
    {
      x: worldCenter.x + x - MAP_WIDTH / 2,
      y: worldCenter.y + y - MAP_HEIGHT / 2,
    },
    zoom,
  );
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
    return { center: DEFAULT_MAP_CENTER, zoom: 11 };
  }

  const latitudeValues = points.map((point) => point.latitude);
  const longitudeValues = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudeValues);
  const maxLatitude = Math.max(...latitudeValues);
  const minLongitude = Math.min(...longitudeValues);
  const maxLongitude = Math.max(...longitudeValues);
  const span = Math.max(maxLatitude - minLatitude, maxLongitude - minLongitude);
  let zoom = 10;

  if (span < 0.012) zoom = 15;
  else if (span < 0.025) zoom = 14;
  else if (span < 0.05) zoom = 13;
  else if (span < 0.1) zoom = 12;
  else if (span < 0.2) zoom = 11;

  return {
    center: {
      latitude: (minLatitude + maxLatitude) / 2,
      longitude: (minLongitude + maxLongitude) / 2,
    },
    zoom,
  };
}

export default function RouteAreasPage({ onPageChange }) {
  const mapFrameRef = useRef(null);
  const draggedPointIndexRef = useRef(null);
  const didDragPointRef = useRef(false);
  const mapPanRef = useRef(null);
  const didPanMapRef = useRef(false);
  const lastWheelZoomAtRef = useRef(0);
  const [areas, setAreas] = useState([]);
  const [areZonesExpanded, setAreZonesExpanded] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(11);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(AREA_COLORS[0]);
  const [draftPoints, setDraftPoints] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(
    () =>
      subscribeToRouteAreas(setAreas, (routeAreaError) => {
        console.error("Unable to load route areas:", routeAreaError);
        setError(getFirebaseErrorMessage(routeAreaError));
      }),
    [],
  );

  const mapReady = true;
  const visibleMapTiles = useMemo(
    () => getVisibleMapTiles(mapCenter, mapZoom),
    [mapCenter, mapZoom],
  );

  const renderedAreas = useMemo(
    () =>
      areas.map((area) => ({
        ...area,
        pixelPoints: area.points.map((point) =>
          geoPointToMapPixel(point, mapCenter, mapZoom),
        ),
      })),
    [areas, mapCenter, mapZoom],
  );

  const renderedDraftPoints = useMemo(
    () =>
      draftPoints.map((point) =>
        geoPointToMapPixel(point, mapCenter, mapZoom),
      ),
    [draftPoints, mapCenter, mapZoom],
  );

  const activeAreaCount = useMemo(
    () => areas.filter((area) => area.active).length,
    [areas],
  );

  function resetDraft() {
    setIsDrawing(false);
    setEditingAreaId("");
    setDraftName("");
    setDraftColor(AREA_COLORS[0]);
    setDraftPoints([]);
  }

  function startNewArea() {
    setEditingAreaId("");
    setDraftName("");
    setDraftColor(AREA_COLORS[areas.length % AREA_COLORS.length]);
    setDraftPoints([]);
    setIsDrawing(true);
    setMessage("");
    setError("");
  }

  function startEditing(area) {
    setEditingAreaId(area.id);
    setDraftName(area.name);
    setDraftColor(area.color);
    setDraftPoints(area.points);
    setIsDrawing(true);
    setMessage("");
    setError("");
    focusMapToPoints(area.points);
  }

  function focusMapToPoints(points) {
    const nextFocus = getMapFocus(points);
    setMapCenter(nextFocus.center);
    setMapZoom(nextFocus.zoom);
  }

  function getPointerMapPosition(event) {
    const frame = mapFrameRef.current;
    if (!frame) return null;
    const bounds = frame.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * MAP_WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * MAP_HEIGHT,
    };
  }

  function zoomMapAtPosition(nextZoom, position = null) {
    const clampedZoom = Math.max(8, Math.min(17, nextZoom));
    if (clampedZoom === mapZoom) return;

    const anchorPosition = position || {
      x: MAP_WIDTH / 2,
      y: MAP_HEIGHT / 2,
    };
    const anchorCoordinate = mapPixelToGeoPoint(
      anchorPosition.x,
      anchorPosition.y,
      mapCenter,
      mapZoom,
    );
    const anchorAtNextZoom = toWorldPoint(anchorCoordinate, clampedZoom);
    const nextCenter = fromWorldPoint(
      {
        x: anchorAtNextZoom.x - anchorPosition.x + MAP_WIDTH / 2,
        y: anchorAtNextZoom.y - anchorPosition.y + MAP_HEIGHT / 2,
      },
      clampedZoom,
    );

    setMapCenter(nextCenter);
    setMapZoom(clampedZoom);
  }

  function handleMapWheel(event) {
    if (!mapReady) return;
    event.preventDefault();
    const now = Date.now();
    if (now - lastWheelZoomAtRef.current < 160) return;
    const position = getPointerMapPosition(event);
    if (!position) return;
    lastWheelZoomAtRef.current = now;
    zoomMapAtPosition(mapZoom + (event.deltaY < 0 ? 1 : -1), position);
  }

  useEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame) return undefined;

    frame.addEventListener("wheel", handleMapWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleMapWheel);
  });

  function handleMapClick(event) {
    if (didPanMapRef.current) {
      didPanMapRef.current = false;
      return;
    }
    if (didDragPointRef.current) {
      didDragPointRef.current = false;
      return;
    }
    if (!isDrawing || !mapReady) return;
    const position = getPointerMapPosition(event);
    if (!position) return;
    setDraftPoints((currentPoints) => [
      ...currentPoints,
      mapPixelToGeoPoint(position.x, position.y, mapCenter, mapZoom),
    ]);
    setMessage("");
    setError("");
  }

  function handlePointPointerDown(event, pointIndex) {
    event.stopPropagation();
    draggedPointIndexRef.current = pointIndex;
    didDragPointRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMapPointerDown(event) {
    if (event.button !== 0 || event.target.closest?.("[data-map-controls]")) {
      return;
    }

    mapPanRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCenter: mapCenter,
      zoom: mapZoom,
      moved: false,
    };
    didPanMapRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMapPointerMove(event) {
    const pointIndex = draggedPointIndexRef.current;
    if (pointIndex !== null) {
      const position = getPointerMapPosition(event);
      if (!position) return;
      didDragPointRef.current = true;
      const nextPoint = mapPixelToGeoPoint(
        position.x,
        position.y,
        mapCenter,
        mapZoom,
      );
      setDraftPoints((currentPoints) =>
        currentPoints.map((point, index) =>
          index === pointIndex ? nextPoint : point,
        ),
      );
      return;
    }

    const pan = mapPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;

    const deltaClientX = event.clientX - pan.startClientX;
    const deltaClientY = event.clientY - pan.startClientY;
    if (!pan.moved && Math.hypot(deltaClientX, deltaClientY) < 4) return;

    const frame = mapFrameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const deltaMapX = (deltaClientX / bounds.width) * MAP_WIDTH;
    const deltaMapY = (deltaClientY / bounds.height) * MAP_HEIGHT;
    const startCenter = toWorldPoint(pan.startCenter, pan.zoom);

    pan.moved = true;
    didPanMapRef.current = true;
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
    draggedPointIndexRef.current = null;
    if (mapPanRef.current?.pointerId === event.pointerId) {
      mapPanRef.current = null;
    }
    setIsPanning(false);
  }

  async function persistAreas(nextAreas, successMessage) {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const savedAreas = await saveRouteAreas(nextAreas);
      setAreas(savedAreas);
      setMessage(successMessage);
    } catch (saveError) {
      console.error("Unable to save route areas:", saveError);
      setError(getFirebaseErrorMessage(saveError));
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveArea(event) {
    event.preventDefault();
    const name = draftName.trim();

    if (!name) {
      setError("Enter a route area name, such as North End.");
      return;
    }

    if (draftPoints.length < 3) {
      setError("Click at least three points on the map to complete the area.");
      return;
    }

    const now = new Date().toISOString();
    const currentArea = areas.find((area) => area.id === editingAreaId);
    const nextArea = {
      id: editingAreaId || createId(),
      name,
      color: draftColor,
      points: draftPoints,
      active: currentArea?.active !== false,
      createdAt: currentArea?.createdAt || now,
      updatedAt: now,
    };
    const nextAreas = editingAreaId
      ? areas.map((area) => (area.id === editingAreaId ? nextArea : area))
      : [...areas, nextArea];

    try {
      await persistAreas(
        nextAreas,
        editingAreaId ? `${name} updated.` : `${name} route area saved.`,
      );
      resetDraft();
    } catch {
      // The save error is already shown above the map.
    }
  }

  async function toggleArea(area) {
    try {
      await persistAreas(
        areas.map((currentArea) =>
          currentArea.id === area.id
            ? {
                ...currentArea,
                active: !currentArea.active,
                updatedAt: new Date().toISOString(),
              }
            : currentArea,
        ),
        `${area.name} ${area.active ? "paused" : "activated"}.`,
      );
    } catch {
      // The save error is already shown above the map.
    }
  }

  async function deleteArea(area) {
    if (!window.confirm(`Remove the ${area.name} route area?`)) {
      return;
    }

    try {
      await persistAreas(
        areas.filter((currentArea) => currentArea.id !== area.id),
        `${area.name} removed.`,
      );
      if (editingAreaId === area.id) {
        resetDraft();
      }
    } catch {
      // The save error is already shown above the map.
    }
  }

  return (
    <PageContainer className="max-w-[96rem]">
      <Breadcrumbs
        items={[
          { label: "Admin", onClick: () => onPageChange?.("admin") },
          { label: "Route Areas" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Admin · Route planning
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Route Areas
          </h1>
          <p className="mt-2 max-w-3xl text-base font-semibold text-slate-500 sm:text-lg">
            Draw named service zones such as North End. Delivery addresses inside a zone are automatically labeled on the calendar.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <MapPinned className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Active areas
            </p>
            <p className="text-xl font-black text-slate-950">{activeAreaCount}</p>
          </div>
        </div>
      </div>

      {message ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
          <Check className="h-4 w-4" aria-hidden="true" />
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                  Saved areas
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Delivery zones
                </h2>
              </div>
              <button
                type="button"
                onClick={startNewArea}
                disabled={!mapReady || isSaving}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FC2C38] px-3 text-xs font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Draw area
              </button>
            </div>

            {areas.length > 0 ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setAreZonesExpanded((isExpanded) => !isExpanded)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100"
                  aria-expanded={areZonesExpanded}
                >
                  <span className="flex -space-x-2" aria-hidden="true">
                    {areas.slice(0, 4).map((area) => (
                      <span
                        key={area.id}
                        className="h-7 w-7 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: area.color }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-950">
                      {areas.length} saved zone{areas.length === 1 ? "" : "s"}
                    </span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                      {activeAreaCount} active · {areZonesExpanded ? "Hide list" : "Show and edit"}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
                      areZonesExpanded ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {areZonesExpanded ? (
                  <div className="mt-3 space-y-2">
                    {areas.map((area) => (
                      <div
                        key={area.id}
                        className={`rounded-2xl border p-3 ${
                          editingAreaId === area.id
                            ? "border-blue-400 bg-blue-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => focusMapToPoints(area.points)}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <span
                            className="h-9 w-9 shrink-0 rounded-xl border-4 border-white shadow-sm"
                            style={{ backgroundColor: area.color }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-950">
                              {area.name}
                            </span>
                            <span className="block text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                              {area.points.length} boundary points · {area.active ? "Active" : "Paused"}
                            </span>
                          </span>
                        </button>
                        <div className="mt-3 flex gap-2 border-t border-slate-200 pt-2">
                          <button
                            type="button"
                            onClick={() => startEditing(area)}
                            disabled={isSaving}
                            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-2 text-xs font-black text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleArea(area)}
                            disabled={isSaving}
                            className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg bg-white px-2 text-xs font-black text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                          >
                            {area.active ? "Pause" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteArea(area)}
                            disabled={isSaving}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 disabled:opacity-50"
                            aria-label={`Remove ${area.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-8 text-center">
                <LocateFixed className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-black text-slate-700">No route areas yet</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Start with North End, Meridian, Eagle, or any zone your team uses.
                </p>
              </div>
            )}
          </section>

          {isDrawing ? (
            <form
              onSubmit={handleSaveArea}
              className="rounded-3xl border border-blue-200 bg-blue-50 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                    {editingAreaId ? "Edit boundary" : "New route area"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-600">
                    Click around the outside edge. Drag the white points to fine-tune it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetDraft}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-inset ring-slate-200"
                  aria-label="Cancel drawing"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Area name
                </span>
                <input
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="North End"
                  autoFocus
                  className="w-full rounded-xl border border-blue-200 bg-white px-3 py-3 text-sm font-black text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <div className="mt-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Map color
                </p>
                <div className="flex flex-wrap gap-2">
                  {AREA_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDraftColor(color)}
                      className={`h-9 w-9 rounded-xl border-4 border-white shadow-sm ring-2 ${
                        draftColor === color ? "ring-slate-950" : "ring-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Use ${color}`}
                    />
                  ))}
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl bg-white px-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-700 shadow-sm ring-2 ring-inset ring-slate-200 transition hover:bg-slate-50 focus-within:ring-slate-950">
                    <span
                      className="h-6 w-6 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-200"
                      style={{ backgroundColor: draftColor }}
                      aria-hidden="true"
                    />
                    <span>Custom</span>
                    <span className="font-mono text-[9px] text-slate-500">
                      {draftColor.toUpperCase()}
                    </span>
                    <input
                      type="color"
                      value={draftColor}
                      onChange={(event) => setDraftColor(event.target.value)}
                      className="sr-only"
                      aria-label="Choose a custom map color"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-inset ring-blue-100">
                <span className="inline-flex items-center gap-2 text-xs font-black text-slate-700">
                  <MousePointer2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  {draftPoints.length} point{draftPoints.length === 1 ? "" : "s"}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDraftPoints((points) => points.slice(0, -1))}
                    disabled={draftPoints.length === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="Undo last point"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftPoints([])}
                    disabled={draftPoints.length === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="Clear boundary"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving || draftPoints.length < 3}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {isSaving ? "Saving…" : editingAreaId ? "Save changes" : "Save route area"}
              </button>
            </form>
          ) : null}
        </aside>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                Service map
              </p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {isDrawing
                  ? "Click to place boundary points. Drag to move the map; scroll or use +/− to zoom."
                  : "Drag to move the map. Scroll or use +/− to zoom, or choose Draw area to create a zone."}
              </p>
            </div>
            {isDrawing ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-800">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                Drawing {draftName || "new area"}
              </span>
            ) : null}
          </div>
          <div
            ref={mapFrameRef}
            className={`relative aspect-[4/3] min-h-[34rem] w-full touch-none overflow-hidden bg-slate-100 ${
              isPanning
                ? "cursor-grabbing"
                : isDrawing
                  ? "cursor-crosshair"
                  : "cursor-grab"
            }`}
            onClick={handleMapClick}
            onPointerDown={handleMapPointerDown}
            onPointerMove={handleMapPointerMove}
            onPointerUp={handleMapPointerUp}
            onPointerCancel={handleMapPointerUp}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#e8e6df]">
              {visibleMapTiles.map((tile) => (
                <img
                  key={tile.key}
                  src={tile.url}
                  alt=""
                  aria-hidden="true"
                  className="absolute select-none"
                  style={{
                    left: `${(tile.left / MAP_WIDTH) * 100}%`,
                    top: `${(tile.top / MAP_HEIGHT) * 100}%`,
                    width: `${(256 / MAP_WIDTH) * 100}%`,
                    height: `${(256 / MAP_HEIGHT) * 100}%`,
                  }}
                  draggable="false"
                />
              ))}
            </div>

            <svg
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              {renderedAreas.map((area) => (
                <polygon
                  key={area.id}
                  points={area.pixelPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill={area.color}
                  fillOpacity={area.active ? 0.18 : 0.06}
                  stroke={area.color}
                  strokeOpacity={area.active ? 0.95 : 0.4}
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {isDrawing && renderedDraftPoints.length > 0 ? (
                renderedDraftPoints.length >= 3 ? (
                  <polygon
                    points={renderedDraftPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill={draftColor}
                    fillOpacity="0.25"
                    stroke={draftColor}
                    strokeWidth="4"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <polyline
                    points={renderedDraftPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke={draftColor}
                    strokeWidth="4"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              ) : null}

              {isDrawing
                ? renderedDraftPoints.map((point, pointIndex) => (
                    <circle
                      key={`${pointIndex}-${draftPoints[pointIndex]?.latitude}`}
                      cx={point.x}
                      cy={point.y}
                      r="8"
                      fill="white"
                      stroke={draftColor}
                      strokeWidth="4"
                      className="pointer-events-auto cursor-grab active:cursor-grabbing"
                      onPointerDown={(event) => handlePointPointerDown(event, pointIndex)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ))
                : null}
            </svg>

            <div
              data-map-controls
              className="absolute left-4 top-4 flex items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => zoomMapAtPosition(mapZoom + 1)}
                  disabled={mapZoom >= 17}
                  className="flex h-11 w-11 items-center justify-center text-slate-800 hover:bg-slate-100"
                  aria-label="Zoom in"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => zoomMapAtPosition(mapZoom - 1)}
                  disabled={mapZoom <= 8}
                  className="flex h-11 w-11 items-center justify-center border-l border-slate-200 text-slate-800 hover:bg-slate-100"
                  aria-label="Zoom out"
                >
                  <Minus className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <select
                defaultValue=""
                onChange={(event) => {
                  const preset = MAP_PRESETS[Number(event.target.value)];
                  if (!preset) return;
                  setMapCenter({
                    latitude: preset.latitude,
                    longitude: preset.longitude,
                  });
                  setMapZoom(preset.zoom);
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-lg outline-none"
                aria-label="Jump to a map area"
              >
                <option value="" disabled>Jump to area…</option>
                {MAP_PRESETS.map((preset, index) => (
                  <option key={preset.label} value={index}>{preset.label}</option>
                ))}
              </select>
              <span className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600 shadow-lg md:block">
                Zoom {mapZoom} · scroll to fine-tune
              </span>
            </div>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              data-map-controls
              onClick={(event) => event.stopPropagation()}
              className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm"
            >
              © OpenStreetMap contributors
            </a>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
