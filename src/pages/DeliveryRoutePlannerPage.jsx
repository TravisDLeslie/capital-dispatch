import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  ExternalLink,
  MapPin,
  Maximize2,
  Navigation,
  Plus,
  Sparkles,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import AddressAutocompleteInput from "../components/AddressAutocompleteInput";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { capitalLumberAddress } from "../data/options";
import { createId } from "../utils/idHelpers";
import {
  getGoogleMapsApiKey,
  loadGooglePlaces,
} from "../utils/googlePlaces";

const ROUTE_STOPS_STORAGE_KEY = "dispatch-cl-delivery-route-stops";
const MAX_ROUTE_STOPS = 10;
const DEFAULT_SERVICE_TYPE = "small";
const STOP_SERVICE_OPTIONS = [
  { id: "small", label: "Small delivery", minutes: 35 },
  { id: "large", label: "Large delivery", minutes: 75 },
  { id: "return", label: "Return", minutes: 90 },
];

function getStopServiceOption(stopOrServiceType) {
  const serviceType =
    typeof stopOrServiceType === "string"
      ? stopOrServiceType
      : stopOrServiceType?.serviceType;

  return (
    STOP_SERVICE_OPTIONS.find((option) => option.id === serviceType) ||
    STOP_SERVICE_OPTIONS[0]
  );
}

function loadSavedStops() {
  try {
    const savedStops = JSON.parse(
      localStorage.getItem(ROUTE_STOPS_STORAGE_KEY) || "[]",
    );

    return Array.isArray(savedStops)
      ? savedStops.filter((stop) => stop?.id && stop?.address)
      : [];
  } catch (error) {
    console.warn("Unable to load saved delivery route stops:", error);
    return [];
  }
}

function getDeliveryArea(address) {
  const addressParts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (addressParts.length >= 3) {
    return `${addressParts[1]}, ${addressParts[2].split(/\s+/)[0]}`;
  }

  return addressParts[1] || addressParts[0] || "Unknown area";
}

function getGoogleMapsRouteUrl(stops) {
  if (stops.length === 0) {
    return "";
  }

  const params = new URLSearchParams({
    api: "1",
    origin: capitalLumberAddress,
    destination: capitalLumberAddress,
    travelmode: "driving",
  });
  const waypointAddresses = stops.map((stop) => stop.address);

  if (waypointAddresses.length > 0) {
    params.set("waypoints", waypointAddresses.join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function getStopMarkerLabel(index) {
  if (index < 9) {
    return String(index + 1);
  }

  return String.fromCharCode(65 + index - 9);
}

function formatDurationMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hr ${minutes} min`;
  }

  if (hours > 0) {
    return `${hours} hr`;
  }

  return `${minutes} min`;
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export default function DeliveryRoutePlannerPage({ onPageChange }) {
  const [address, setAddress] = useState("");
  const [stopServiceType, setStopServiceType] = useState(DEFAULT_SERVICE_TYPE);
  const [stops, setStops] = useState(loadSavedStops);
  const [error, setError] = useState("");
  const [mapImageError, setMapImageError] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState({
    status: "idle",
    message: "",
  });
  const [routeState, setRouteState] = useState({
    status: "idle",
    route: null,
    error: "",
  });
  const googleMapsApiKey = getGoogleMapsApiKey();
  const googleMapsRouteUrl = useMemo(() => getGoogleMapsRouteUrl(stops), [stops]);
  const deliveryTimeMinutes = stops.reduce(
    (totalMinutes, stop) =>
      totalMinutes + getStopServiceOption(stop).minutes,
    0,
  );
  const routeLegs = Array.isArray(routeState.route?.legs)
    ? routeState.route.legs
    : [];
  const returnToYardLeg = routeLegs.length > stops.length
    ? routeLegs[routeLegs.length - 1]
    : null;
  const driveTimeMinutes = Number(routeState.route?.durationSeconds)
    ? Math.max(1, Math.round(Number(routeState.route.durationSeconds) / 60))
    : null;
  const totalRouteMinutes =
    driveTimeMinutes === null
      ? null
      : driveTimeMinutes + deliveryTimeMinutes;

  useEffect(() => {
    try {
      localStorage.setItem(ROUTE_STOPS_STORAGE_KEY, JSON.stringify(stops));
    } catch (storageError) {
      console.warn("Unable to save delivery route stops:", storageError);
    }
  }, [stops]);

  useEffect(() => {
    if (!isMapExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMapExpanded(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMapExpanded]);

  useEffect(() => {
    setMapImageError(false);

    if (stops.length === 0) {
      setRouteState({ status: "idle", route: null, error: "" });
      return;
    }

    const controller = new AbortController();
    let didTimeOut = false;
    const timeoutId = globalThis.setTimeout(() => {
      didTimeOut = true;
      controller.abort();
    }, 8000);
    const destination = capitalLumberAddress;
    const waypointAddresses = stops.map((stop) => stop.address);
    const params = new URLSearchParams({
      origin: capitalLumberAddress,
      destination,
    });

    if (waypointAddresses.length > 0) {
      params.set("waypoints", waypointAddresses.join("|"));
    }

    setRouteState({ status: "loading", route: null, error: "" });

    fetch(`/api/maps/route?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "Unable to calculate this route.");
        }

        setRouteState({ status: "ready", route: data, error: "" });
      })
      .catch((routeError) => {
        if (controller.signal.aborted && !didTimeOut) {
          return;
        }

        setRouteState({
          status: "error",
          route: null,
          error:
            (didTimeOut
              ? "Route totals timed out on localhost. Open Google Maps to view the route."
              : routeError?.message) ||
            "Route totals are unavailable. You can still open the route in Google Maps.",
        });
      })
      .finally(() => globalThis.clearTimeout(timeoutId));

    return () => {
      globalThis.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [stops]);

  const staticMapUrl = useMemo(() => {
    if (!googleMapsApiKey || stops.length === 0) {
      return "";
    }

    const params = new URLSearchParams({
      key: googleMapsApiKey,
      size: "640x640",
      scale: "2",
      maptype: "roadmap",
    });

    params.append(
      "markers",
      `color:0x111827|label:C|${capitalLumberAddress}`,
    );
    stops.forEach((stop, index) => {
      params.append(
        "markers",
        `color:0xfc2c38|label:${getStopMarkerLabel(index)}|${stop.address}`,
      );
    });

    if (routeState.route?.encodedPolyline) {
      params.append(
        "path",
        `color:0xfc2c38ff|weight:5|enc:${routeState.route.encodedPolyline}`,
      );
    }

    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }, [googleMapsApiKey, routeState.route?.encodedPolyline, stops]);

  function handleAddStop(event) {
    event.preventDefault();
    const nextAddress = address.trim();

    if (!nextAddress) {
      setError("Enter a delivery address first.");
      return;
    }

    if (stops.length >= MAX_ROUTE_STOPS) {
      setError(`This quick route supports up to ${MAX_ROUTE_STOPS} stops.`);
      return;
    }

    if (
      stops.some(
        (stop) => stop.address.toLowerCase() === nextAddress.toLowerCase(),
      )
    ) {
      setError("That address is already on this route.");
      return;
    }

    setStops((currentStops) => [
      ...currentStops,
      {
        id: createId(),
        address: nextAddress,
        serviceType: stopServiceType,
        createdAt: new Date().toISOString(),
      },
    ]);
    setAddress("");
    setStopServiceType(DEFAULT_SERVICE_TYPE);
    setError("");
  }

  function updateStopServiceType(stopId, serviceType) {
    if (!STOP_SERVICE_OPTIONS.some((option) => option.id === serviceType)) {
      return;
    }

    setStops((currentStops) =>
      currentStops.map((stop) =>
        stop.id === stopId ? { ...stop, serviceType } : stop,
      ),
    );
  }

  function moveStop(stopIndex, direction) {
    const nextIndex = stopIndex + direction;

    if (nextIndex < 0 || nextIndex >= stops.length) {
      return;
    }

    setStops((currentStops) => {
      const nextStops = [...currentStops];
      [nextStops[stopIndex], nextStops[nextIndex]] = [
        nextStops[nextIndex],
        nextStops[stopIndex],
      ];
      return nextStops;
    });
  }

  function deleteStop(stopId) {
    setStops((currentStops) =>
      currentStops.filter((stop) => stop.id !== stopId),
    );
  }

  function clearAllStops() {
    const shouldClear = globalThis.confirm(
      `Clear all ${stops.length} saved ${stops.length === 1 ? "address" : "addresses"}?`,
    );

    if (!shouldClear) {
      return;
    }

    setStops([]);
    setAddress("");
    setStopServiceType(DEFAULT_SERVICE_TYPE);
    setError("");
    setOptimizationStatus({ status: "idle", message: "" });
  }

  async function getBrowserOptimizedOrder(routeStops) {
    const google = await withTimeout(
      loadGooglePlaces(),
      8000,
      "Google Maps took too long to load.",
    );

    if (google?.maps?.importLibrary) {
      await withTimeout(
        google.maps.importLibrary("routes"),
        8000,
        "Google routing took too long to load.",
      );
    }

    if (!google?.maps?.DirectionsService) {
      throw new Error("Google route optimization is not available.");
    }

    const directionsResult = await withTimeout(
      new Promise((resolve, reject) => {
        const directionsService = new google.maps.DirectionsService();

        directionsService.route(
          {
            origin: capitalLumberAddress,
            destination: capitalLumberAddress,
            waypoints: routeStops.map((stop) => ({
              location: stop.address,
              stopover: true,
            })),
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
            drivingOptions: {
              departureTime: new Date(),
              trafficModel: google.maps.TrafficModel.BEST_GUESS,
            },
          },
          (result, status) => {
            if (status === "OK" && result) {
              resolve(result);
              return;
            }

            reject(
              new Error(`Google could not optimize this route (${status}).`),
            );
          },
        );
      }),
      10000,
      "Google took too long to organize the stops.",
    );

    return directionsResult.routes?.[0]?.waypoint_order || [];
  }

  async function getServerOptimizedOrder(routeStops) {
    const params = new URLSearchParams({
      origin: capitalLumberAddress,
      destination: capitalLumberAddress,
      waypoints: routeStops.map((stop) => stop.address).join("|"),
      optimizeWaypoints: "true",
    });
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`/api/maps/route?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));

      if (
        !response.ok ||
        !Array.isArray(data.optimizedWaypointOrder) ||
        data.optimizedWaypointOrder.length !== routeStops.length
      ) {
        throw new Error(data?.error || "The route server did not return an order.");
      }

      return data.optimizedWaypointOrder;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  async function optimizeRoute() {
    if (stops.length < 2) {
      return;
    }

    const routeStops = [...stops];
    setOptimizationStatus({
      status: "loading",
      message: "Finding the fastest driving order...",
    });

    try {
      const optimizedOrder = await withTimeout(
        Promise.any([
          getServerOptimizedOrder(routeStops),
          getBrowserOptimizedOrder(routeStops),
        ]),
        12000,
        "Route optimization timed out. Try again in a moment.",
      );

      if (optimizedOrder.length !== routeStops.length) {
        throw new Error("Google did not return a complete stop order.");
      }

      const optimizedStops = optimizedOrder.map((stopIndex) =>
        routeStops[stopIndex],
      );

      if (optimizedStops.some((stop) => !stop)) {
        throw new Error("Google returned an invalid stop order.");
      }

      setStops(optimizedStops);
      setOptimizationStatus({
        status: "success",
        message: "Stops organized for the fastest estimated drive time.",
      });
    } catch (optimizationError) {
      console.error("Unable to optimize delivery route:", optimizationError);
      const optimizationMessage = Array.isArray(optimizationError?.errors)
        ? "Google route optimization is unavailable. Check the Maps API setup and try again."
        : optimizationError?.message;

      setOptimizationStatus({
        status: "error",
        message:
          optimizationMessage ||
          "Unable to optimize the route. Check the addresses and try again.",
      });
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Deliveries", onClick: () => onPageChange?.("deliveries") },
          { label: "Route Planner" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
          Quick Route
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Delivery Route Planner
        </h1>
        <p className="mt-2 max-w-3xl text-lg font-semibold leading-7 text-slate-500">
          Add jobsite addresses, arrange the stops, and see the full round trip
          from Capital Lumber back to the yard.
        </p>
      </div>

      <div className="grid gap-6 min-[1100px]:max-[1279px]:grid-cols-[minmax(0,0.98fr)_minmax(390px,1.02fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Warehouse className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Route starts here
                </p>
                <p className="font-black text-slate-950">Capital Lumber</p>
                <p className="text-sm font-bold text-slate-500">
                  {capitalLumberAddress}
                </p>
              </div>
            </div>

            <form onSubmit={handleAddStop} className="mt-5">
              <label
                htmlFor="route-planner-address"
                className="mb-2 block text-sm font-black text-slate-800"
              >
                Add a delivery address
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <AddressAutocompleteInput
                    id="route-planner-address"
                    value={address}
                    onChange={(nextAddress) => {
                      setAddress(nextAddress);
                      setError("");
                    }}
                    autoComplete="off"
                    enableLocalFallback
                    placeholder="Start typing a jobsite address..."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Save stop
                </button>
              </div>
              <fieldset className="mt-3">
                <legend className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Stop type and service time
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {STOP_SERVICE_OPTIONS.map((option) => {
                    const isSelected = stopServiceType === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setStopServiceType(option.id)}
                        aria-pressed={isSelected}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          isSelected
                            ? "border-[#FC2C38] bg-red-50 ring-2 ring-red-100"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="block text-sm font-black text-slate-900">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs font-bold text-slate-500">
                          {formatDurationMinutes(option.minutes)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <p className="mt-2 text-xs font-bold text-slate-500">
                Stops save automatically on this device.
              </p>
              {error ? (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {error}
                </p>
              ) : null}
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                  Stop order
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Saved addresses
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={optimizeRoute}
                  disabled={
                    stops.length < 2 || optimizationStatus.status === "loading"
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {optimizationStatus.status === "loading"
                    ? "Organizing..."
                    : "Optimize fastest route"}
                </button>
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-slate-700 shadow-sm">
                  {stops.length} {stops.length === 1 ? "stop" : "stops"}
                </span>
                {stops.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearAllStops}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-black text-[#FC2C38] transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Clear all
                  </button>
                ) : null}
              </div>
            </div>

            {optimizationStatus.message ? (
              <p
                className={`mb-4 rounded-xl px-3 py-2 text-sm font-bold ${
                  optimizationStatus.status === "error"
                    ? "bg-red-50 text-red-700"
                    : optimizationStatus.status === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-blue-50 text-blue-700"
                }`}
              >
                {optimizationStatus.message}
              </p>
            ) : null}

            {stops.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No addresses yet"
                description="Enter the first jobsite address above to start the route."
              />
            ) : (
              <div className="space-y-3">
                {stops.map((stop, stopIndex) => {
                  const serviceOption = getStopServiceOption(stop);

                  return (
                    <article
                      key={stop.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FC2C38] text-sm font-black text-white">
                      {stopIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                        {getDeliveryArea(stop.address)}
                      </p>
                      <p className="mt-1 text-sm font-bold leading-5 text-slate-800">
                        {stop.address}
                      </p>
                      <label className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-100">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">
                          Service type for stop {stopIndex + 1}
                        </span>
                        <select
                          value={serviceOption.id}
                          onChange={(event) =>
                            updateStopServiceType(stop.id, event.target.value)
                          }
                          className="cursor-pointer bg-transparent font-black outline-none"
                        >
                          {STOP_SERVICE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label} · {formatDurationMinutes(option.minutes)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => moveStop(stopIndex, -1)}
                        disabled={stopIndex === 0}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Move stop ${stopIndex + 1} up`}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStop(stopIndex, 1)}
                        disabled={stopIndex === stops.length - 1}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Move stop ${stopIndex + 1} down`}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStop(stop.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 text-[#FC2C38] transition hover:bg-red-50"
                        aria-label={`Delete stop ${stopIndex + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    </article>
                  );
                })}
                <article className="flex items-start gap-3 rounded-2xl bg-slate-950 p-3 text-white shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#FC2C38]">
                    <Warehouse className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                      Return to yard
                    </p>
                    <p className="mt-1 text-sm font-bold leading-5 text-white">
                      {capitalLumberAddress}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-300">
                      Final stop → Capital Lumber · drive only, no delivery time
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-right">
                    <p className="text-base font-black text-white">
                      {returnToYardLeg?.durationText ||
                        (routeState.status === "loading" ? "..." : "--")}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                      Drive back
                    </p>
                    {returnToYardLeg?.distanceText ? (
                      <p className="mt-0.5 text-[10px] font-bold text-slate-300">
                        {returnToYardLeg.distanceText}
                      </p>
                    ) : null}
                  </div>
                </article>
              </div>
            )}
          </section>
        </div>

        <section className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm min-[1100px]:sticky min-[1100px]:top-4 min-[1100px]:max-[1279px]:p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-[1100px]:max-[1279px]:items-stretch">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                <Navigation className="h-4 w-4" aria-hidden="true" />
                Round trip from Capital
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                All stops + return map
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 min-[1100px]:max-[1279px]:grid min-[1100px]:max-[1279px]:grid-cols-2">
              {staticMapUrl && !mapImageError ? (
                <button
                  type="button"
                  onClick={() => setIsMapExpanded(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  Expand map
                </button>
              ) : null}
              {googleMapsRouteUrl ? (
                <a
                  href={googleMapsRouteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Open route
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          {staticMapUrl && !mapImageError ? (
            <img
              src={staticMapUrl}
              alt="Round-trip delivery route from Capital Lumber through the saved stops and back to the yard"
              onError={() => setMapImageError(true)}
              className="mt-3 h-[clamp(320px,44vh,500px)] w-full rounded-2xl border border-slate-200 bg-slate-100 object-contain min-[1100px]:max-[1279px]:h-[280px]"
            />
          ) : (
            <div className="mt-3 flex h-[clamp(320px,44vh,500px)] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center min-[1100px]:max-[1279px]:h-[280px]">
              <div>
                <MapPin className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-black text-slate-700">
                  {stops.length === 0
                    ? "Add an address to build the map."
                    : "Map preview needs the Google Maps key."}
                </p>
                {googleMapsRouteUrl ? (
                  <a
                    href={googleMapsRouteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#FC2C38]"
                  >
                    View in Google Maps
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>
          )}

          {stops.length > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#FC2C38]" aria-hidden="true" />
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                    Route time breakdown
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/10 px-2 py-2.5 text-center">
                    <p className="text-lg font-black sm:text-xl">
                      {routeState.route?.durationText ||
                        (routeState.status === "loading" ? "..." : "--")}
                    </p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-300 sm:text-[10px]">
                      Round-trip drive
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-400 px-2 py-2.5 text-center text-slate-950">
                    <p className="text-lg font-black sm:text-xl">
                      {formatDurationMinutes(deliveryTimeMinutes)}
                    </p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-950/70 sm:text-[10px]">
                      Delivery time
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold text-amber-950/70 sm:text-[10px]">
                      Based on each saved stop type
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FC2C38] px-2 py-2.5 text-center">
                    <p className="text-lg font-black sm:text-xl">
                      {totalRouteMinutes === null
                        ? routeState.status === "loading"
                          ? "..."
                          : "--"
                        : formatDurationMinutes(totalRouteMinutes)}
                    </p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-red-100 sm:text-[10px]">
                      Total time
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] font-bold text-slate-300">
                  Total includes the drive back to Capital Lumber + the selected service time at each stop
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-center">
                  <p className="text-lg font-black text-slate-950">{stops.length}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Stops</p>
                </div>
                <div className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-center">
                  <p className="text-lg font-black text-slate-950">
                    {routeState.route?.distanceText ||
                      (routeState.status === "loading" ? "..." : "--")}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Distance</p>
                </div>
              </div>
            </div>
          ) : null}

          {routeState.error ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              {routeState.error}
            </p>
          ) : null}
        </section>
      </div>

      {isMapExpanded && staticMapUrl ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded delivery route map"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsMapExpanded(false);
            }
          }}
        >
          <div className="flex h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                  Round trip from Capital
                </p>
                <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
                  Expanded route map
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMapExpanded(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
                aria-label="Close expanded map"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4">
              <img
                src={staticMapUrl}
                alt="Expanded round-trip delivery route from Capital Lumber through the saved stops and back to the yard"
                className="h-full w-full rounded-2xl bg-white object-contain shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-white p-3 sm:grid-cols-4 sm:px-5">
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                <p className="text-base font-black text-slate-950">{stops.length}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Stops</p>
              </div>
              <div className="rounded-xl bg-red-50 px-3 py-2 text-center">
                <p className="text-base font-black text-slate-950">
                  {routeState.route?.durationText || "--"}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Driving</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-center">
                <p className="text-base font-black text-slate-950">
                  {formatDurationMinutes(deliveryTimeMinutes)}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Delivery</p>
              </div>
              <div className="rounded-xl bg-slate-950 px-3 py-2 text-center text-white">
                <p className="text-base font-black">
                  {totalRouteMinutes === null
                    ? "--"
                    : formatDurationMinutes(totalRouteMinutes)}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">Total time</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
