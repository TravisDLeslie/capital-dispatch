import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
  Trash2,
  Warehouse,
} from "lucide-react";
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
const DELIVERY_SERVICE_MINUTES = 35;

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
    destination: stops[stops.length - 1].address,
    travelmode: "driving",
  });
  const waypointAddresses = stops.slice(0, -1).map((stop) => stop.address);

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
  const [stops, setStops] = useState(loadSavedStops);
  const [error, setError] = useState("");
  const [mapImageError, setMapImageError] = useState(false);
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

  useEffect(() => {
    try {
      localStorage.setItem(ROUTE_STOPS_STORAGE_KEY, JSON.stringify(stops));
    } catch (storageError) {
      console.warn("Unable to save delivery route stops:", storageError);
    }
  }, [stops]);

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
    const destination = stops[stops.length - 1].address;
    const waypointAddresses = stops.slice(0, -1).map((stop) => stop.address);
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
      size: "640x520",
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
        createdAt: new Date().toISOString(),
      },
    ]);
    setAddress("");
    setError("");
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
          Add jobsite addresses, arrange the stops, and see the full route from
          Capital Lumber.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)]">
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
                  <input
                    id="route-planner-address"
                    type="text"
                    value={address}
                    onChange={(event) => {
                      setAddress(event.target.value);
                      setError("");
                    }}
                    autoComplete="street-address"
                    enterKeyHint="done"
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
                {stops.map((stop, stopIndex) => (
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
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-100">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {DELIVERY_SERVICE_MINUTES} min delivery
                      </span>
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
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                <Navigation className="h-4 w-4" aria-hidden="true" />
                Route from Capital
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                All stops map
              </h2>
            </div>
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

          {staticMapUrl && !mapImageError ? (
            <img
              src={staticMapUrl}
              alt="Delivery route from Capital Lumber through the saved stops"
              onError={() => setMapImageError(true)}
              className="mt-4 aspect-[4/3] w-full rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
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
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
                <p className="text-xl font-black text-slate-950">
                  {stops.length}
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Stops
                </p>
              </div>
              <div className="rounded-2xl bg-red-50 px-3 py-3 text-center">
                <p className="text-xl font-black text-slate-950">
                  {routeState.route?.durationText ||
                    (routeState.status === "loading" ? "..." : "--")}
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Drive time
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-3 text-center">
                <p className="text-xl font-black text-slate-950">
                  {formatDurationMinutes(
                    stops.length * DELIVERY_SERVICE_MINUTES,
                  )}
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Delivery time
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 px-3 py-3 text-center">
                <p className="text-xl font-black text-slate-950">
                  {routeState.route?.distanceText ||
                    (routeState.status === "loading" ? "..." : "--")}
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Distance
                </p>
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
    </PageContainer>
  );
}
