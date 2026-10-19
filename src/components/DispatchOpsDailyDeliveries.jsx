import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  MapPin,
  Navigation,
  Package,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Truck,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import { capitalLumberAddress } from "../data/options";
import { getDateInputValue, getTodayHeading } from "../utils/dateHelpers";
import { createId } from "../utils/idHelpers";
import {
  deleteDispatchOpsDelivery,
  saveDispatchOpsDelivery,
  subscribeToDispatchOpsDeliveries,
} from "../utils/dispatchOpsDeliveryStorage";

const emptyDraft = {
  name: "",
  address: "",
  orderNumber: "",
  phoneNumber: "",
  spruceNumber: "",
  driverName: "",
  distanceMeters: 0,
  distanceText: "",
  durationSeconds: 0,
  durationText: "",
};

function formatOrderNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 6);

  return digits.length > 3
    ? `${digits.slice(0, 3)}-${digits.slice(3)}`
    : digits;
}

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)})${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatRouteDistance(meters) {
  const miles = Number(meters || 0) / 1609.344;

  return miles >= 10 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
}

function formatRouteDuration(seconds) {
  const totalMinutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hr ${minutes} min`;
  }

  return hours > 0 ? `${hours} hr` : `${minutes} min`;
}

async function geocodeAddress(address) {
  const params = new URLSearchParams({
    f: "json",
    SingleLine: address,
    countryCode: "USA",
    location: "-116.2023,43.6150",
    maxLocations: "1",
    outSR: "4326",
    outFields: "Match_addr",
  });
  const response = await fetch(
    `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Unable to locate this address.");
  }

  const result = await response.json();
  const candidate = result?.candidates?.[0];

  if (!candidate?.location) {
    throw new Error("Unable to locate this address.");
  }

  return {
    longitude: Number(candidate.location.x),
    latitude: Number(candidate.location.y),
  };
}

async function calculateOpenRoute(origin, destination) {
  const [originCoordinates, destinationCoordinates] = await Promise.all([
    geocodeAddress(origin),
    geocodeAddress(destination),
  ]);
  const coordinates = [originCoordinates, destinationCoordinates]
    .map(({ longitude, latitude }) => `${longitude},${latitude}`)
    .join(";");
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`,
  );

  if (!response.ok) {
    throw new Error("Driving route is unavailable.");
  }

  const result = await response.json();
  const route = result?.routes?.[0];

  if (result?.code !== "Ok" || !route) {
    throw new Error("Driving route is unavailable.");
  }

  const distanceMeters = Number(route.distance || 0);
  const durationSeconds = Number(route.duration || 0);

  return {
    distanceMeters,
    distanceText: formatRouteDistance(distanceMeters),
    durationSeconds,
    durationText: formatRouteDuration(durationSeconds),
  };
}

async function calculateDeliveryRoute(destination) {
  const params = new URLSearchParams({
    origin: capitalLumberAddress,
    destination,
  });

  try {
    const response = await fetch(`/api/maps/route?${params.toString()}`);
    const routeData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(routeData?.error || "Route distance is unavailable.");
    }

    return routeData;
  } catch (googleRouteError) {
    console.warn(
      "Google route calculation is unavailable; using the open route fallback:",
      googleRouteError,
    );
    return calculateOpenRoute(capitalLumberAddress, destination);
  }
}

/**
 * @param {{
 *   createdBy?: Record<string, string>;
 *   driverOptions?: string[];
 *   className?: string;
 * }} props
 */
export default function DispatchOpsDailyDeliveries({
  createdBy = {},
  driverOptions = [],
  className = "mt-6",
}) {
  const todayKey = getDateInputValue();
  const [deliveries, setDeliveries] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState("");
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState("");
  const [expandedDrivers, setExpandedDrivers] = useState({});
  const [isClosedExpanded, setIsClosedExpanded] = useState(false);
  const [deliveryRouteStatuses, setDeliveryRouteStatuses] = useState({});
  const [routeRetryVersion, setRouteRetryVersion] = useState(0);
  const routeAttemptsRef = useRef(new Set());
  const deliveriesRef = useRef(deliveries);
  const normalizedDriverOptions = Array.from(
    new Set(driverOptions.filter(Boolean).map((driver) => String(driver).trim())),
  ).sort((firstDriver, secondDriver) =>
    firstDriver.localeCompare(secondDriver),
  );
  const activeDeliveries = deliveries.filter(
    (delivery) => delivery.status !== "delivery-left",
  );
  const closedDeliveries = deliveries.filter(
    (delivery) => delivery.status === "delivery-left",
  );
  const deliveryGroups = Object.entries(
    activeDeliveries.reduce((groups, delivery) => {
      const driverName = String(delivery.driverName || "").trim() || "Unassigned";
      return {
        ...groups,
        [driverName]: [...(groups[driverName] || []), delivery],
      };
    }, {}),
  ).sort(([firstDriver], [secondDriver]) => {
    if (firstDriver === "Unassigned") return 1;
    if (secondDriver === "Unassigned") return -1;
    return firstDriver.localeCompare(secondDriver);
  });

  useEffect(() => {
    return subscribeToDispatchOpsDeliveries(
      todayKey,
      setDeliveries,
      (loadError) => {
        console.error("Unable to sync today's Dispatch Ops deliveries:", loadError);
        setError("Unable to load today’s deliveries. Check the connection and try again.");
      },
    );
  }, [todayKey]);

  useEffect(() => {
    deliveriesRef.current = deliveries;
  }, [deliveries]);

  useEffect(() => {
    if (!isFormOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) {
        setIsFormOpen(false);
        setDraft(emptyDraft);
        setEditingDeliveryId("");
        setError("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFormOpen, saving]);

  useEffect(() => {
    const deliveriesNeedingRoutes = deliveries.filter(
      (delivery) =>
        delivery.address?.trim() &&
        !delivery.distanceText &&
        !routeAttemptsRef.current.has(delivery.id),
    );

    deliveriesNeedingRoutes.forEach((delivery) => {
      routeAttemptsRef.current.add(delivery.id);
      setDeliveryRouteStatuses((currentStatuses) => ({
        ...currentStatuses,
        [delivery.id]: "loading",
      }));

      calculateDeliveryRoute(delivery.address.trim())
        .then(async (routeData) => {
          const latestDelivery =
            deliveriesRef.current.find(
              (currentDelivery) => currentDelivery.id === delivery.id,
            );

          if (!latestDelivery) {
            return;
          }

          if (
            latestDelivery.address?.trim() !== delivery.address.trim()
          ) {
            routeAttemptsRef.current.delete(delivery.id);
            setDeliveryRouteStatuses((currentStatuses) => ({
              ...currentStatuses,
              [delivery.id]: "idle",
            }));
            setRouteRetryVersion((currentVersion) => currentVersion + 1);
            return;
          }

          const routeFields = {
            distanceMeters: Number(routeData.distanceMeters || 0),
            distanceText: routeData.distanceText || "",
            durationSeconds: Number(routeData.durationSeconds || 0),
            durationText: routeData.durationText || "",
          };
          await saveDispatchOpsDelivery({
            ...latestDelivery,
            ...routeFields,
          });

          setDeliveries((currentDeliveries) =>
            currentDeliveries.map((currentDelivery) =>
              currentDelivery.id === delivery.id
                ? { ...currentDelivery, ...routeFields }
                : currentDelivery,
            ),
          );
          setDeliveryRouteStatuses((currentStatuses) => ({
            ...currentStatuses,
            [delivery.id]: "success",
          }));
        })
        .catch((routeError) => {
          console.error("Unable to calculate saved delivery route:", routeError);
          setDeliveryRouteStatuses((currentStatuses) => ({
            ...currentStatuses,
            [delivery.id]: "error",
          }));
        });
    });
  }, [deliveries, routeRetryVersion]);

  function openForm() {
    setDraft(emptyDraft);
    setEditingDeliveryId("");
    setError("");
    setIsFormOpen(true);
  }

  function openEditForm(delivery) {
    setDraft({
      name: delivery.name || "",
      address: delivery.address || "",
      orderNumber: formatOrderNumber(delivery.orderNumber),
      phoneNumber: formatPhoneNumber(delivery.phoneNumber),
      spruceNumber: delivery.spruceNumber || "",
      driverName: delivery.driverName || "",
      distanceMeters: Number(delivery.distanceMeters || 0),
      distanceText: delivery.distanceText || "",
      durationSeconds: Number(delivery.durationSeconds || 0),
      durationText: delivery.durationText || "",
    });
    setEditingDeliveryId(delivery.id);
    setError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setIsFormOpen(false);
    setDraft(emptyDraft);
    setEditingDeliveryId("");
    setError("");
  }

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
      ...(field === "address"
        ? {
            distanceMeters: 0,
            distanceText: "",
            durationSeconds: 0,
            durationText: "",
          }
        : {}),
    }));
    setError("");
  }

  function toggleDriver(driverName) {
    setExpandedDrivers((currentDrivers) => ({
      ...currentDrivers,
      [driverName]: !currentDrivers[driverName],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const name = draft.name.trim();
    const orderNumber = draft.orderNumber.trim();
    const spruceNumber = draft.spruceNumber.trim();

    if (!name || !orderNumber || !spruceNumber) {
      setError("Add a name, order number, and Spruce number.");
      return;
    }

    if (!/^\d{3}-\d{3}$/.test(orderNumber)) {
      setError("Order number must be six digits formatted like 123-456.");
      return;
    }

    if (draft.phoneNumber && !/^\(\d{3}\)\d{3}-\d{4}$/.test(draft.phoneNumber)) {
      setError("Phone number must be ten digits formatted like (208)284-6163.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const now = new Date().toISOString();
      const existingDelivery = deliveries.find(
        (delivery) => delivery.id === editingDeliveryId,
      );
      const saveResult = await saveDispatchOpsDelivery({
        id: editingDeliveryId || createId(),
        dateKey: todayKey,
        name,
        address: draft.address.trim(),
        orderNumber,
        phoneNumber: draft.phoneNumber.trim(),
        spruceNumber,
        driverName: draft.driverName.trim(),
        distanceMeters: draft.distanceMeters,
        distanceText: draft.distanceText,
        durationSeconds: draft.durationSeconds,
        durationText: draft.durationText,
        createdAt: existingDelivery?.createdAt || now,
        createdById: createdBy.id || "",
        createdByName: createdBy.name || "",
        createdByEmail: createdBy.email || "",
      });

      setDeliveries(saveResult.deliveries);
      setDraft(emptyDraft);
      setIsFormOpen(false);
      setEditingDeliveryId("");
      if (saveResult.syncPending) {
        setError("Saved on this device. Shared syncing will resume when the connection is available.");
      }
    } catch (saveError) {
      console.error("Unable to save Dispatch Ops delivery:", saveError);
      setError("Unable to save this delivery. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function retryDeliveryRoute(deliveryId) {
    routeAttemptsRef.current.delete(deliveryId);
    setDeliveryRouteStatuses((currentStatuses) => ({
      ...currentStatuses,
      [deliveryId]: "idle",
    }));
    setRouteRetryVersion((currentVersion) => currentVersion + 1);
  }

  async function handleDelete(delivery) {
    if (!window.confirm(`Remove ${delivery.name} from today’s deliveries?`)) {
      return;
    }

    setDeletingId(delivery.id);
    setError("");

    try {
      await deleteDispatchOpsDelivery(delivery.id);
      setDeliveries((currentDeliveries) =>
        currentDeliveries.filter(
          (currentDelivery) => currentDelivery.id !== delivery.id,
        ),
      );
    } catch (deleteError) {
      console.error("Unable to remove Dispatch Ops delivery:", deleteError);
      setError("Unable to remove this delivery. Check the connection and try again.");
    } finally {
      setDeletingId("");
    }
  }

  async function handleDeliveryStatus(delivery, status) {
    setUpdatingDeliveryId(delivery.id);
    setError("");

    try {
      const saveResult = await saveDispatchOpsDelivery({
        ...delivery,
        status,
        deliveryLeftAt:
          status === "delivery-left" ? new Date().toISOString() : "",
      });

      setDeliveries(saveResult.deliveries);
      if (saveResult.syncPending) {
        setError("Updated on this device. Shared syncing will resume when the connection is available.");
      }
    } catch (statusError) {
      console.error("Unable to update Dispatch Ops delivery status:", statusError);
      setError("Unable to update this delivery. Check the connection and try again.");
    } finally {
      setUpdatingDeliveryId("");
    }
  }

  return (
    <section className={`${className} overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm`}>
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-950/30">
            <Truck aria-hidden="true" className="h-6 w-6" strokeWidth={2.6} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">
              Daily Delivery List
            </p>
            <h2 className="mt-0.5 text-2xl font-black tracking-tight">
              Today’s Deliveries
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
            <CalendarDays aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            {getTodayHeading()}
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-white">
              {activeDeliveries.length}
            </span>
          </div>
          <button
            type="button"
            onClick={openForm}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-500"
          >
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.8} />
            Add Delivery
          </button>
        </div>
      </div>

      {error && !isFormOpen ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="p-4 sm:p-5">
        {activeDeliveries.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 text-center">
            {deliveries.length === 0 ? (
              <ClipboardList aria-hidden="true" className="h-8 w-8 text-slate-300" strokeWidth={2.2} />
            ) : (
              <CircleCheck aria-hidden="true" className="h-8 w-8 text-emerald-500" strokeWidth={2.2} />
            )}
            <p className="mt-2 text-base font-black text-slate-700">
              {deliveries.length === 0
                ? "No deliveries added for today"
                : "All deliveries have left"}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {deliveries.length === 0
                ? "Select Add Delivery above to build today’s digital list."
                : "Closed deliveries are listed below for reference."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveryGroups.map(([driverName, driverDeliveries]) => (
              <section
                key={driverName}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleDriver(driverName)}
                  aria-expanded={Boolean(expandedDrivers[driverName])}
                  className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      driverName === "Unassigned"
                        ? "bg-amber-500 text-white"
                        : "bg-blue-600 text-white"
                    }`}>
                      <UserRound aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-slate-950 sm:text-base">
                        {driverName}
                      </h3>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm">
                      {driverDeliveries.length} {driverDeliveries.length === 1 ? "delivery" : "deliveries"}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-4 w-4 text-slate-500 transition ${
                        expandedDrivers[driverName] ? "rotate-180" : ""
                      }`}
                      strokeWidth={2.6}
                    />
                  </span>
                </button>

                {expandedDrivers[driverName] ? (
                <ol className="space-y-2 border-t border-slate-200 bg-slate-50/60 p-2.5 sm:p-3">
                  {driverDeliveries.map((delivery, index) => (
                    <li
                      key={delivery.id}
                      className="grid gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-3"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h4 className="truncate text-sm font-black text-slate-950 sm:text-base">
                            {delivery.name}
                          </h4>
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-800">
                            Order {delivery.orderNumber}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Package aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
                            Spruce {delivery.spruceNumber}
                          </span>
                          {delivery.phoneNumber ? (
                            <a
                              href={`tel:${delivery.phoneNumber}`}
                              className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                            >
                              <Phone aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
                              {delivery.phoneNumber}
                            </a>
                          ) : null}
                          {delivery.address ? (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                              {delivery.address}
                            </span>
                          ) : null}
                          {delivery.distanceText ? (
                            <span className="inline-flex items-center gap-1 font-black text-blue-700">
                              <Navigation aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
                              {delivery.distanceText} from Capital
                              {delivery.durationText
                                ? ` · ${delivery.durationText}`
                                : ""}
                            </span>
                          ) : delivery.address &&
                            deliveryRouteStatuses[delivery.id] === "loading" ? (
                            <span className="inline-flex items-center gap-1 font-black text-slate-500">
                              <Navigation aria-hidden="true" className="h-3 w-3 animate-pulse" strokeWidth={2.5} />
                              Calculating route from Capital...
                            </span>
                          ) : delivery.address &&
                            deliveryRouteStatuses[delivery.id] === "error" ? (
                            <button
                              type="button"
                              onClick={() => retryDeliveryRoute(delivery.id)}
                              className="inline-flex items-center gap-1 font-black text-amber-700 hover:underline"
                            >
                              <Navigation aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
                              Retry route
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-self-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleDeliveryStatus(delivery, "delivery-left")
                          }
                          disabled={updatingDeliveryId === delivery.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Mark ${delivery.name} as delivery gone`}
                          title="Delivery Gone"
                        >
                          <CircleCheck aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(delivery)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50"
                          aria-label={`Edit ${delivery.name}`}
                          title="Edit delivery"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(delivery)}
                          disabled={deletingId === delivery.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          aria-label={`Remove ${delivery.name} from today's deliveries`}
                          title="Remove delivery"
                        >
                          <Trash2 aria-hidden="true" className="h-4.5 w-4.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                ) : null}
              </section>
            ))}
          </div>
        )}

        {closedDeliveries.length > 0 ? (
          <section className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50">
            <button
              type="button"
              onClick={() => setIsClosedExpanded((currentValue) => !currentValue)}
              aria-expanded={isClosedExpanded}
              className="flex w-full items-center justify-between gap-3 bg-emerald-100/70 px-4 py-3 text-left transition hover:bg-emerald-100"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <CircleCheck aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-950 sm:text-base">
                    Delivery Gone
                  </h3>
                </div>
              </div>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800 shadow-sm">
                  {closedDeliveries.length}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 text-emerald-700 transition ${
                    isClosedExpanded ? "rotate-180" : ""
                  }`}
                  strokeWidth={2.6}
                />
              </span>
            </button>

            {isClosedExpanded ? (
            <ol className="space-y-2 border-t border-emerald-200 p-2.5 sm:p-3">
              {closedDeliveries.map((delivery) => (
                <li
                  key={delivery.id}
                  className="grid gap-2.5 rounded-xl border border-emerald-200 bg-white p-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <CircleCheck aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h4 className="truncate text-base font-black text-slate-900">
                        {delivery.name}
                      </h4>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                        <UserRound aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {delivery.driverName || "Unassigned"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-slate-500">
                      <span>Order {delivery.orderNumber}</span>
                      <span>Spruce {delivery.spruceNumber}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeliveryStatus(delivery, "active")}
                    disabled={updatingDeliveryId === delivery.id}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 justify-self-end rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Return delivery to the active list"
                  >
                    <Undo2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                    Reopen
                  </button>
                </li>
              ))}
            </ol>
            ) : null}
          </section>
        ) : null}
      </div>

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispatch-ops-delivery-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2.8} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
                    Today’s List
                  </p>
                  <h3
                    id="dispatch-ops-delivery-title"
                    className="mt-0.5 text-2xl font-black tracking-tight"
                  >
                    {editingDeliveryId ? "Edit Delivery" : "Add Delivery"}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close add delivery form"
              >
                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                    Name
                  </span>
                  <input
                    autoFocus
                    type="text"
                    value={draft.name}
                    onChange={(event) => updateDraft("name", event.target.value)}
                    placeholder="Customer or job name"
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                    Address <span className="text-slate-400">Optional</span>
                  </span>
                  <AddressAutocompleteInput
                    id="dispatch-ops-delivery-address"
                    value={draft.address}
                    onChange={(value) => updateDraft("address", value)}
                    placeholder="Start typing a delivery address"
                    useUncontrolledValue
                    enableLocalFallback
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <Navigation aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Distance and drive time will appear on the saved delivery.
                  </p>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                    Assign Driver <span className="text-slate-400">Optional</span>
                  </span>
                  <select
                    value={draft.driverName}
                    onChange={(event) => updateDraft("driverName", event.target.value)}
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Unassigned</option>
                    {draft.driverName &&
                    !normalizedDriverOptions.includes(draft.driverName) ? (
                      <option value={draft.driverName}>{draft.driverName}</option>
                    ) : null}
                    {normalizedDriverOptions.map((driverName) => (
                      <option key={driverName} value={driverName}>
                        {driverName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                    Order #
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    value={draft.orderNumber}
                    onChange={(event) =>
                      updateDraft(
                        "orderNumber",
                        formatOrderNumber(event.target.value),
                      )
                    }
                    placeholder="123-456"
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                    Spruce #
                  </span>
                  <input
                    type="text"
                    value={draft.spruceNumber}
                    onChange={(event) => updateDraft("spruceNumber", event.target.value)}
                    placeholder="Spruce number"
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                    Phone # <span className="text-slate-400">Optional</span>
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={13}
                    value={draft.phoneNumber}
                    onChange={(event) =>
                      updateDraft(
                        "phoneNumber",
                        formatPhoneNumber(event.target.value),
                      )
                    }
                    placeholder="(208)284-6163"
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2.8} />
                  {saving
                    ? "Saving..."
                    : editingDeliveryId
                      ? "Save Changes"
                      : "Save Delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
