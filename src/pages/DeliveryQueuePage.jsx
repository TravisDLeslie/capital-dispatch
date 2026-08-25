import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  CloudRain,
  Edit3,
  ExternalLink,
  Images,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Phone,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";
import {
  getDeliveryBackAroundLabel,
  getDeliveryBlockSummary,
  getDeliverySiteArrivalLabel,
  getDeliveryTimeRange,
  getDeliveryTimeWindow,
  scheduleWindowsOverlap,
} from "../utils/deliverySchedule";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import { formatCustomerName } from "../utils/textFormatters";

function getDirectionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
}

function getRouteDirectionsUrl(originAddress, destinationAddress) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    originAddress || "",
  )}&destination=${encodeURIComponent(destinationAddress || "")}`;
}

function getGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
}

function formatTimeLabel(value) {
  if (!value) {
    return "";
  }

  const [hours = "0", minutes = "00"] = value.split(":");
  const date = new Date();

  date.setHours(Number(hours), Number(minutes), 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDeliveryTypeLabel(value) {
  if (value === "priority") {
    return "Priority";
  }

  if (value === "hotShot") {
    return "Hot Shot";
  }

  if (value === "return") {
    return "Return";
  }

  return "Standard";
}

function formatForkliftLabel(value) {
  if (value === "donkey") {
    return "Donkey 5000 lbs";
  }

  if (value === "manitou") {
    return "Manitou 4500 lbs";
  }

  if (value === "moffit") {
    return "Moffit 5500 lbs";
  }

  return "";
}

function getPhotoList(delivery, photoField, photosField) {
  const photos = Array.isArray(delivery?.[photosField])
    ? delivery[photosField].filter((photo) => photo?.dataUrl)
    : [];
  const legacyPhoto = delivery?.[photoField]?.dataUrl ? delivery[photoField] : null;

  if (!legacyPhoto) {
    return photos;
  }

  if (
    photos.some((photo) => photo.dataUrl === legacyPhoto.dataUrl)
  ) {
    return photos;
  }

  return [legacyPhoto, ...photos];
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function createPhotoFromFile(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const maxWidth = 720;
  const scale = Math.min(maxWidth / image.width, 1);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.68;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrl.length > 240000 && quality > 0.34) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return {
    name: file.name,
    type: "image/jpeg",
    dataUrl,
    capturedAt: new Date().toISOString(),
  };
}

function groupDeliveriesByDriver(deliveries) {
  const sortedDeliveries = [...deliveries].sort((firstDelivery, secondDelivery) => {
    const firstDate = firstDelivery.deliveryDate || "9999-99-99";
    const secondDate = secondDelivery.deliveryDate || "9999-99-99";
    const dateComparison = firstDate.localeCompare(secondDate);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return String(firstDelivery.deliveryTimeSlot || "99:99").localeCompare(
      String(secondDelivery.deliveryTimeSlot || "99:99"),
    );
  });

  return sortedDeliveries.reduce((groups, delivery) => {
    const driver = delivery.driver || "Unassigned Driver";
    const existingGroup = groups.find(
      (group) => group.driver === driver,
    );

    if (existingGroup) {
      existingGroup.deliveries.push(delivery);
      return groups;
    }

    return [
      ...groups,
      {
        driver,
        deliveries: [delivery],
      },
    ];
  }, []);
}

function deliveryHasDriver(delivery, driverName) {
  const drivers = Array.isArray(delivery.drivers)
    ? delivery.drivers.filter(Boolean)
    : [];

  return [delivery.driver, ...drivers]
    .filter(Boolean)
    .includes(driverName);
}

function findDriverScheduleConflict(candidateDelivery, deliveries, nextDriver) {
  const candidateWindow = getDeliveryTimeWindow(candidateDelivery);

  if (!nextDriver || !candidateDelivery.deliveryDate || !candidateWindow) {
    return null;
  }

  return deliveries.find(
    (delivery) =>
      delivery.id !== candidateDelivery.id &&
      delivery.status !== "complete" &&
      delivery.dispatchStatus !== "needsDispatch" &&
      delivery.deliveryDate === candidateDelivery.deliveryDate &&
      deliveryHasDriver(delivery, nextDriver) &&
      scheduleWindowsOverlap(candidateWindow, getDeliveryTimeWindow(delivery)),
  );
}

function getUniqueOptions(options) {
  const seenOptions = new Set();

  return options
    .map((option) => String(option || "").trim())
    .filter(Boolean)
    .filter((option) => {
      const key = option.toLowerCase();

      if (seenOptions.has(key)) {
        return false;
      }

      seenOptions.add(key);
      return true;
    });
}

function PhotoPreview({ photo, label, onView }) {
  if (!photo?.dataUrl) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => onView?.({ ...photo, label })}
      className="block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-red-200"
    >
      <img
        src={photo.dataUrl}
        alt={label}
        className="h-56 w-full bg-slate-100 object-contain sm:h-72"
      />

      <span className="block px-3 py-2 text-sm font-black text-slate-700">
        View {label}
      </span>
    </button>
  );
}

function PhotoPreviewGrid({ photos, label, onView }) {
  if (!photos.length) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {photos.map((photo, photoIndex) => (
        <PhotoPreview
          key={`${label}-${photo.dataUrl}-${photoIndex}`}
          photo={photo}
          label={`${label} ${photoIndex + 1}`}
          onView={onView}
        />
      ))}
    </div>
  );
}

function getDeliveryItemsLabel(items, scopeSummary) {
  if (!scopeSummary.usesItems) {
    return "All";
  }

  return `${items.length} ${items.length === 1 ? "item" : "items"}`;
}

function RoutePreviewCard({ delivery }) {
  const originAddress =
    delivery.deliveryOriginAddress || "3105 W State St, Boise, ID 83703";
  const destinationAddress = delivery.address || "";
  const [routeState, setRouteState] = useState({
    status: "idle",
    route: null,
    error: "",
  });
  const googleMapsApiKey = getGoogleMapsApiKey();

  const staticMapUrl = useMemo(() => {
    const encodedPolyline = routeState.route?.encodedPolyline;

    if (!googleMapsApiKey || !encodedPolyline || !destinationAddress) {
      return "";
    }

    const params = new URLSearchParams({
      key: googleMapsApiKey,
      size: "640x320",
      scale: "2",
      maptype: "roadmap",
    });

    params.append("markers", `color:blue|label:A|${originAddress}`);
    params.append("markers", `color:red|label:B|${destinationAddress}`);
    params.append("path", `color:0xff2a3dff|weight:5|enc:${encodedPolyline}`);

    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }, [
    destinationAddress,
    googleMapsApiKey,
    originAddress,
    routeState.route?.encodedPolyline,
  ]);

  useEffect(() => {
    if (!originAddress || !destinationAddress) {
      setRouteState({ status: "idle", route: null, error: "" });
      return;
    }

    const controller = new AbortController();

    setRouteState({ status: "loading", route: null, error: "" });

    const params = new URLSearchParams({
      origin: originAddress,
      destination: destinationAddress,
    });

    fetch(`/api/maps/route?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "Unable to calculate route.");
        }

        setRouteState({ status: "ready", route: data, error: "" });
      })
      .catch((routeError) => {
        if (controller.signal.aborted) {
          return;
        }

        console.warn("Unable to load delivery route:", routeError);
        setRouteState({
          status: "error",
          route: null,
          error:
            routeError?.message ||
            "Route ETA unavailable. Open maps for live navigation.",
        });
      });

    return () => controller.abort();
  }, [destinationAddress, originAddress]);

  return (
    <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Navigation
              className="h-4 w-4 text-[#FC2C38]"
              aria-hidden="true"
            />
            Route Preview
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            From {delivery.deliveryOriginName || "Capital Lumber"} to the jobsite.
          </p>
        </div>

        <a
          href={getRouteDirectionsUrl(originAddress, destinationAddress)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
        >
          Open Maps
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>

      {staticMapUrl ? (
        <img
          src={staticMapUrl}
          alt={`Route map to ${delivery.address}`}
          className="mt-4 h-44 w-full rounded-2xl border border-slate-200 object-cover"
        />
      ) : (
        <div className="mt-4 flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-bold text-slate-500">
          {routeState.status === "loading"
            ? "Loading route map..."
            : "Map preview appears when Google Maps is configured."}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-center">
          <p className="text-2xl font-black text-slate-900">
            {routeState.route?.durationText ||
              (routeState.status === "loading" ? "..." : "--")}
          </p>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            ETA
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
          <p className="text-2xl font-black text-slate-900">
            {routeState.route?.distanceText ||
              (routeState.status === "loading" ? "..." : "--")}
          </p>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Distance
          </p>
        </div>
      </div>

      {routeState.error ? (
        <p className="mt-3 text-sm font-bold text-amber-700">
          {routeState.error}
        </p>
      ) : null}
    </section>
  );
}

const DRIVER_DELIVERY_STEPS = [
  "Review & Load",
  "En Route",
  "Unload & Photos",
  "Complete",
];

const MOBILE_DRIVER_DELIVERY_STEPS = ["Load", "Route", "Photos", "Done"];

function MobileDeliveryFlowCard({
  delivery,
  deliveryIndex,
  deliveryCount,
  deliveryStep,
  setDeliveryStep,
  isUpdating,
  deliveryPhotos,
  hardwarePhotos,
  scopeSummary,
  contactPhone,
  deliveryLocationNotes,
  generalNotes,
  onPhotoChange,
  onHardwareChecked,
  onCompleteDelivery,
  onViewPhoto,
  isFocusedDriverView = false,
}) {
  const [loadedDeliveryKeys, setLoadedDeliveryKeys] = useState({});
  const items = Array.isArray(delivery.items) ? delivery.items : [];
  const originAddress =
    delivery.deliveryOriginAddress || "3105 W State St, Boise, ID 83703";
  const isMaterialLoaded = Boolean(loadedDeliveryKeys[delivery.id]);
  const isHardwareLoaded = !delivery.hasHardware || Boolean(delivery.hardwareChecked);
  const canLeaveYard = isMaterialLoaded && isHardwareLoaded;
  const stepStatus =
    deliveryStep === 1
      ? "EN ROUTE"
      : deliveryStep === 2
        ? "COMPLETE DELIVERY"
        : deliveryStep === 3
          ? "DELIVERY COMPLETE"
          : "TODAY'S DELIVERY";

  function goToNextStep() {
    setDeliveryStep(delivery.id, deliveryStep + 1);
  }

  function goToPreviousStep() {
    setDeliveryStep(delivery.id, deliveryStep - 1);
  }

  return (
    <article
      className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${
        isFocusedDriverView ? "" : "lg:hidden"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <button
          type="button"
          onClick={goToPreviousStep}
          disabled={deliveryStep === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-slate-100 disabled:opacity-30"
          aria-label="Previous delivery step"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="text-center">
          <p className="text-sm font-black text-slate-900">
            {Math.min(deliveryIndex + 1, deliveryCount)} of {deliveryCount}
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            Deliveries
          </p>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-slate-100"
          aria-label="Message dispatch"
        >
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-4 items-start gap-1">
          {MOBILE_DRIVER_DELIVERY_STEPS.map((stepLabel, stepIndex) => {
            const isActiveStep = deliveryStep === stepIndex;
            const isCompleteStep = deliveryStep > stepIndex;

            return (
              <button
                key={stepLabel}
                type="button"
                onClick={() => setDeliveryStep(delivery.id, stepIndex)}
                className="min-w-0 text-center"
                aria-current={isActiveStep ? "step" : undefined}
              >
                <span
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
                    isActiveStep
                      ? "bg-[#FC2C38] text-white"
                      : isCompleteStep
                        ? "bg-emerald-700 text-white"
                        : "border border-slate-300 bg-slate-50 text-slate-500"
                  }`}
                >
                  {isCompleteStep ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    stepIndex + 1
                  )}
                </span>
                <span
                  className={`mt-1 block truncate text-[10px] font-black uppercase leading-3 tracking-[0.04em] ${
                    isActiveStep ? "text-slate-950" : "text-slate-500"
                  }`}
                >
                  {stepLabel}
                </span>
              </button>
            );
          })}
        </div>

        {deliveryStep < 3 ? (
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              {stepStatus}
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {formatCustomerName(delivery.customerName)}
            </h2>

            <p className="text-base font-semibold text-slate-900">
              Order #{delivery.orderNumber}
            </p>
          </div>
        ) : null}

        {deliveryStep === 0 ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <MapPin
                  className="mt-1 h-5 w-5 shrink-0 text-slate-900"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold leading-5 text-slate-900">
                  {delivery.address}
                </p>
              </div>

              <a
                href={getRouteDirectionsUrl(originAddress, delivery.address)}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-900 shadow-sm"
              >
                <Navigation
                  className="h-5 w-5 text-[#FC2C38]"
                  aria-hidden="true"
                />
                Navigate
              </a>
            </div>

            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-900">
              <div className="flex items-center gap-2 border-b border-r border-slate-200 px-3 py-3">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {formatDeliveryTypeLabel(delivery.deliveryType)}
              </div>
              <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3">
                <Truck className="h-4 w-4" aria-hidden="true" />
                {delivery.unloadType}
              </div>
              <div className="flex items-center gap-2 border-r border-slate-200 px-3 py-3">
                <Package className="h-4 w-4" aria-hidden="true" />
                {items.length} {items.length === 1 ? "Item" : "Items"}
              </div>
              <div className="flex items-center gap-2 px-3 py-3">
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                {scopeSummary.shortLabel || scopeSummary.label}
              </div>
            </div>

            {delivery.hasHardware ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                <p className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-[#FC2C38]">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  Hardware Included
                </p>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">
                  Don&apos;t forget the hardware. A photo of the hardware will
                  be required at delivery.
                </p>
              </div>
            ) : null}

            {delivery.needsTarp ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-blue-800">
                  <CloudRain className="h-5 w-5" aria-hidden="true" />
                  Tarp needed before leaving.
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-900">
                Before You Leave
              </p>

              <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-900">
                <input
                  type="checkbox"
                  checked={isMaterialLoaded}
                  onChange={(event) =>
                    setLoadedDeliveryKeys((currentLoadedDeliveryKeys) => ({
                      ...currentLoadedDeliveryKeys,
                      [delivery.id]: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 rounded border-slate-300 text-[#FC2C38] focus:ring-red-200"
                />
                Material loaded
              </label>

              {delivery.hasHardware ? (
                <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    checked={Boolean(delivery.hardwareChecked)}
                    onChange={(event) =>
                      onHardwareChecked(delivery, event.target.checked)
                    }
                    disabled={isUpdating}
                    className="h-5 w-5 rounded border-slate-300 text-[#FC2C38] focus:ring-red-200"
                  />
                  Hardware loaded
                </label>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                if (canLeaveYard) {
                  goToNextStep();
                }
              }}
              disabled={!canLeaveYard || isUpdating}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#FC2C38] px-4 py-4 text-sm font-black uppercase tracking-[0.04em] text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Ready To Leave
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            {!canLeaveYard ? (
              <p className="text-center text-xs font-bold text-slate-500">
                Check {delivery.hasHardware ? "material and hardware" : "material"} loaded before leaving.
              </p>
            ) : null}
          </>
        ) : null}

        {deliveryStep === 1 ? (
          <>
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 text-slate-900" />
              <p className="text-sm font-semibold leading-5 text-slate-900">
                {delivery.address}
              </p>
            </div>

            <RoutePreviewCard delivery={delivery} />

            <section>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-900">
                Delivery Instructions
              </p>
              <p className="mt-2 text-base font-semibold leading-6 text-slate-900">
                {deliveryLocationNotes ||
                  generalNotes ||
                  "No delivery instructions added."}
              </p>
              {contactPhone ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call {delivery.contactName || "contact"} before arriving.
                </p>
              ) : null}
            </section>

            {delivery.hasHardware ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-[#FC2C38]">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  Hardware on this delivery
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={goToNextStep}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#FC2C38] px-4 py-4 text-sm font-black uppercase tracking-[0.04em] text-white shadow-sm"
            >
              I&apos;ve Arrived
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}

        {deliveryStep === 2 ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.08em] text-slate-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FC2C38] text-xs text-white">
                    1
                  </span>
                  Material Photo
                </p>
                <span className="text-xs font-black uppercase text-[#FC2C38]">
                  Required
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Take a photo of the delivered material.
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-black text-[#FC2C38]">
                  <Camera className="h-5 w-5" aria-hidden="true" />
                  Take Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={isUpdating}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      onPhotoChange(
                        delivery,
                        file,
                        "deliveryPhoto",
                        "deliveryPhotos",
                      );
                      event.target.value = "";
                    }}
                    className="sr-only"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700">
                  <Images className="h-5 w-5" aria-hidden="true" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUpdating}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      onPhotoChange(
                        delivery,
                        file,
                        "deliveryPhoto",
                        "deliveryPhotos",
                      );
                      event.target.value = "";
                    }}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="mt-3">
                <PhotoPreviewGrid
                  photos={deliveryPhotos}
                  label="delivery photo"
                  onView={onViewPhoto}
                />
              </div>
            </div>

            {delivery.hasHardware ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.08em] text-slate-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FC2C38] text-xs text-white">
                      2
                    </span>
                    Hardware Photo
                  </p>
                  <span className="text-xs font-black uppercase text-[#FC2C38]">
                    Required
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  Take a photo showing the hardware was delivered.
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-red-200 bg-white px-4 py-4 text-sm font-black text-[#FC2C38]">
                    <Camera className="h-5 w-5" aria-hidden="true" />
                    Take Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={isUpdating}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        onPhotoChange(
                          delivery,
                          file,
                          "hardwarePhoto",
                          "hardwarePhotos",
                        );
                        event.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700">
                    <Images className="h-5 w-5" aria-hidden="true" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUpdating}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        onPhotoChange(
                          delivery,
                          file,
                          "hardwarePhoto",
                          "hardwarePhotos",
                        );
                        event.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                <label className="mt-3 flex items-center gap-3 text-sm font-black text-slate-900">
                  <input
                    type="checkbox"
                    checked={Boolean(delivery.hardwareChecked)}
                    onChange={(event) =>
                      onHardwareChecked(delivery, event.target.checked)
                    }
                    disabled={isUpdating}
                    className="h-5 w-5 rounded border-red-300 text-[#FC2C38] focus:ring-red-200"
                  />
                  Hardware delivered
                </label>

                <div className="mt-3">
                  <PhotoPreviewGrid
                    photos={hardwarePhotos}
                    label="hardware photo"
                    onView={onViewPhoto}
                  />
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.08em] text-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FC2C38] text-xs text-white">
                  {delivery.hasHardware ? 3 : 2}
                </span>
                Condition
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Was everything delivered in good condition?
              </p>
              <button
                type="button"
                onClick={goToNextStep}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Yes, everything is good
              </button>
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-[#FC2C38]"
              >
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                No, there was an issue
              </button>
            </div>
          </>
        ) : null}

        {deliveryStep === 3 ? (
          <>
            <div className="py-4 text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-14 w-14" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-2xl font-black text-slate-950">
                Delivery Complete!
              </h2>
              <p className="mt-2 text-base font-semibold text-slate-700">
                Thank you. Great job.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-900">
                Delivery Summary
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">Order</span>
                  <span className="font-bold text-slate-900">
                    {delivery.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">Customer</span>
                  <span className="text-right font-bold text-slate-900">
                    {formatCustomerName(delivery.customerName)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">Items</span>
                  <span className="font-bold text-slate-900">
                    {getDeliveryItemsLabel(items, scopeSummary)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">Hardware</span>
                  <span className="font-bold text-emerald-700">
                    {delivery.hasHardware
                      ? delivery.hardwareChecked
                        ? "Delivered"
                        : "Needs check"
                      : "None"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCompleteDelivery(delivery)}
              disabled={isUpdating}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#FC2C38] px-4 py-4 text-sm font-black uppercase tracking-[0.04em] text-white shadow-sm disabled:opacity-60"
            >
              Complete Delivery
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export default function DeliveryQueuePage({
  deliveries,
  onUpdateDelivery,
  canEditDeliveries = false,
  employeeOptions = /** @type {string[]} */ ([]),
  onEditDelivery,
  onDeleteDelivery,
  onPageChange,
  isDriverView = false,
}) {
  const [error, setError] = useState("");
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState("");
  const [reassigningDeliveryId, setReassigningDeliveryId] = useState("");
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState("All");
  const [openDriverKeys, setOpenDriverKeys] = useState({});
  const [openDeliveryKeys, setOpenDeliveryKeys] = useState({});
  const [deliveryStepKeys, setDeliveryStepKeys] = useState({});
  const [pendingDriverSelections, setPendingDriverSelections] = useState({});

  const openDeliveries = deliveries.filter(
    (delivery) =>
      !isDeliveryComplete(delivery) &&
      delivery.dispatchStatus !== "needsDispatch" &&
      delivery.driver,
  );
  const driverNames = [
    ...new Set(
      openDeliveries.map(
        (delivery) => delivery.driver || "Unassigned Driver",
      ),
    ),
  ].sort((firstDriver, secondDriver) =>
    firstDriver.localeCompare(secondDriver),
  );
  const driverOptions = getUniqueOptions([...employeeOptions, ...driverNames]);
  const filteredDeliveries =
    selectedDriver === "All"
      ? openDeliveries
      : openDeliveries.filter(
          (delivery) =>
            (delivery.driver || "Unassigned Driver") === selectedDriver,
        );
  const driverGroups = groupDeliveriesByDriver(filteredDeliveries);
  const currentDriverDelivery = isDriverView ? openDeliveries[0] : null;
  const upNextDriverDeliveries = isDriverView ? openDeliveries.slice(1) : [];

  function toggleDriver(driver) {
    setOpenDriverKeys((currentOpenDriverKeys) => ({
      ...currentOpenDriverKeys,
      [driver]: !currentOpenDriverKeys[driver],
    }));
  }

  function isDriverOpen(driver) {
    return openDriverKeys[driver] !== false;
  }

  function toggleDelivery(deliveryId) {
    setOpenDeliveryKeys((currentOpenDeliveryKeys) => ({
      ...currentOpenDeliveryKeys,
      [deliveryId]: !currentOpenDeliveryKeys[deliveryId],
    }));
  }

  function isDeliveryOpen(deliveryId, deliveryIndex) {
    return openDeliveryKeys[deliveryId] ?? deliveryIndex === 0;
  }

  function getDeliveryStep(deliveryId) {
    return deliveryStepKeys[deliveryId] ?? 0;
  }

  function setDeliveryStep(deliveryId, stepIndex) {
    setDeliveryStepKeys((currentDeliveryStepKeys) => ({
      ...currentDeliveryStepKeys,
      [deliveryId]: Math.max(0, Math.min(stepIndex, 3)),
    }));
  }

  async function handlePhotoChange(delivery, file, photoField, photosField) {
    if (!file) {
      return;
    }

    setError("");
    setUpdatingDeliveryId(delivery.id);

    try {
      const photo = await createPhotoFromFile(file);
      const currentPhotos = getPhotoList(delivery, photoField, photosField);
      const nextPhotos = [...currentPhotos, photo];

      await onUpdateDelivery(delivery.id, {
        [photoField]: photo,
        [photosField]: nextPhotos,
      });
    } catch (photoError) {
      console.error("Unable to save delivery photo:", photoError);
      setError("Unable to save that delivery photo. Try again.");
    } finally {
      setUpdatingDeliveryId("");
    }
  }

  async function handleHardwareChecked(delivery, isChecked) {
    setError("");
    setUpdatingDeliveryId(delivery.id);

    try {
      await onUpdateDelivery(delivery.id, {
        hardwareChecked: isChecked,
      });
    } finally {
      setUpdatingDeliveryId("");
    }
  }

  async function handleReassignDriver(delivery, nextDriver) {
    if (!nextDriver || nextDriver === delivery.driver) {
      return;
    }

    const conflict = findDriverScheduleConflict(
      delivery,
      deliveries,
      nextDriver,
    );

    if (conflict) {
      setError(
        `${nextDriver} already has order ${conflict.orderNumber} scheduled ${getDeliveryTimeRange(
          conflict,
        )}.`,
      );
      return;
    }

    const currentAssignments = Array.isArray(delivery.dispatchAssignments)
      ? delivery.dispatchAssignments
      : [];
    const nextAssignments =
      currentAssignments.length > 0
        ? currentAssignments.map((assignment, assignmentIndex) =>
            assignmentIndex === 0
              ? { ...assignment, driver: nextDriver }
              : assignment,
          )
        : [
            {
              id: "truck-1",
              driver: nextDriver,
              vehicleId: delivery.vehicleId || "",
              vehicleTitle: delivery.vehicleTitle || "",
              vehicleBadge: delivery.vehicleBadge || "",
            },
          ];

    setReassigningDeliveryId(delivery.id);
    setError("");

    try {
      await onUpdateDelivery(delivery.id, {
        driver: nextDriver,
        drivers: [
          nextDriver,
          ...(Array.isArray(delivery.drivers) ? delivery.drivers : []).filter(
            (driverName) =>
              driverName &&
              driverName !== delivery.driver &&
              driverName !== nextDriver,
          ),
        ],
        dispatchAssignments: nextAssignments,
        updatedAt: new Date().toISOString(),
      });
      setPendingDriverSelections((currentSelections) => {
        const nextSelections = { ...currentSelections };
        delete nextSelections[delivery.id];
        return nextSelections;
      });
    } catch (updateError) {
      console.error("Unable to change delivery driver:", updateError);
      setError("Unable to change that delivery driver. Try again.");
    } finally {
      setReassigningDeliveryId("");
    }
  }

  async function handleSendBackToDispatch(delivery) {
    if (!canEditDeliveries || isDriverView) {
      return;
    }

    setError("");
    setUpdatingDeliveryId(delivery.id);

    try {
      await onUpdateDelivery(delivery.id, {
        dispatchStatus: "needsDispatch",
        driver: "",
        drivers: [],
        vehicleId: "",
        vehicleTitle: "",
        vehicleBadge: "",
        dispatchAssignments: [],
        updatedAt: new Date().toISOString(),
      });
    } catch (updateError) {
      console.error("Unable to send delivery back to dispatch:", updateError);
      setError("Unable to send that delivery back to dispatch. Try again.");
    } finally {
      setUpdatingDeliveryId("");
    }
  }

  async function handleCompleteDelivery(delivery) {
    const deliveryPhotos = getPhotoList(
      delivery,
      "deliveryPhoto",
      "deliveryPhotos",
    );
    const hardwarePhotos = getPhotoList(
      delivery,
      "hardwarePhoto",
      "hardwarePhotos",
    );

    if (deliveryPhotos.length === 0) {
      setError(
        `Add a delivery photo before completing order ${delivery.orderNumber}.`,
      );
      return;
    }

    if (delivery.hasHardware && hardwarePhotos.length === 0) {
      setError(
        `Add a hardware photo before completing order ${delivery.orderNumber}.`,
      );
      return;
    }

    if (delivery.hasHardware && !delivery.hardwareChecked) {
      setError(
        `Check off hardware delivered before completing order ${delivery.orderNumber}.`,
      );
      return;
    }

    setError("");
    setUpdatingDeliveryId(delivery.id);

    try {
      await onUpdateDelivery(delivery.id, {
        status: "complete",
        deliveredAt: new Date().toISOString(),
      });
    } finally {
      setUpdatingDeliveryId("");
    }
  }

  if (isDriverView) {
    const currentDeliveryItems = Array.isArray(currentDriverDelivery?.items)
      ? currentDriverDelivery.items
      : [];
    const currentDeliveryPhotos = currentDriverDelivery
      ? getPhotoList(
          currentDriverDelivery,
          "deliveryPhoto",
          "deliveryPhotos",
        )
      : [];
    const currentHardwarePhotos = currentDriverDelivery
      ? getPhotoList(
          currentDriverDelivery,
          "hardwarePhoto",
          "hardwarePhotos",
        )
      : [];
    const currentScopeSummary = currentDriverDelivery
      ? getDeliveryScopeSummary(currentDriverDelivery)
      : null;
    const currentDeliveryStep = currentDriverDelivery
      ? getDeliveryStep(currentDriverDelivery.id)
      : 0;

    return (
      <PageContainer>
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Driver
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            My Deliveries
          </h1>

          <p className="mt-2 text-base font-semibold text-slate-500">
            Focus on the current stop. Finish it, then move to the next one.
          </p>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {!currentDriverDelivery ? (
          <EmptyState
            title="No deliveries assigned"
            description="Assigned delivery orders will show here when dispatch sends them to you."
          />
        ) : (
          <div className="space-y-5">
            <section>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Current Delivery
              </p>

              <MobileDeliveryFlowCard
                delivery={currentDriverDelivery}
                deliveryIndex={0}
                deliveryCount={openDeliveries.length}
                deliveryStep={currentDeliveryStep}
                setDeliveryStep={setDeliveryStep}
                isUpdating={updatingDeliveryId === currentDriverDelivery.id}
                deliveryPhotos={currentDeliveryPhotos}
                hardwarePhotos={currentHardwarePhotos}
                scopeSummary={currentScopeSummary}
                contactPhone={
                  currentDriverDelivery.contactPhone ||
                  currentDriverDelivery.phoneNumber ||
                  ""
                }
                deliveryLocationNotes={
                  currentDriverDelivery.deliveryLocationNotes ||
                  currentDriverDelivery.deliveryNotes ||
                  ""
                }
                generalNotes={currentDriverDelivery.generalNotes || ""}
                onPhotoChange={handlePhotoChange}
                onHardwareChecked={handleHardwareChecked}
                onCompleteDelivery={handleCompleteDelivery}
                onViewPhoto={setViewingPhoto}
                isFocusedDriverView
              />
            </section>

            {upNextDriverDeliveries.length > 0 ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Up Next
                  </p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {upNextDriverDeliveries.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {upNextDriverDeliveries.map((delivery, index) => {
                    const items = Array.isArray(delivery.items)
                      ? delivery.items
                      : [];
                    const upNextScopeSummary = getDeliveryScopeSummary(delivery);

                    return (
                      <article
                        key={delivery.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                              Delivery {index + 2} of {openDeliveries.length}
                            </p>
                            <h2 className="mt-1 truncate text-xl font-black text-slate-900">
                              {formatCustomerName(delivery.customerName)}
                            </h2>
                            <p className="mt-1 text-sm font-bold text-slate-500">
                              Order #{delivery.orderNumber}
                            </p>
                          </div>

                          <ChevronDown
                            className="mt-2 h-5 w-5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                            {getDeliveryTimeRange(delivery)}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                            {getDeliveryItemsLabel(items, upNextScopeSummary)}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Deliveries", onClick: () => onPageChange?.("deliveries") },
          { label: "To Be Delivered" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Deliveries
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          To Be Delivered
        </h1>

        <p className="mt-2 text-lg text-slate-500">
          Driver orders, delivery photos, and hardware reminders.
        </p>
      </div>

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {driverNames.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-black text-slate-900">
            Filter by driver
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {["All", ...driverNames].map((driverName) => {
              const isSelected = selectedDriver === driverName;

              return (
                <button
                  key={driverName}
                  type="button"
                  onClick={() => setSelectedDriver(driverName)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                    isSelected
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {driverName}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {driverGroups.length === 0 ? (
        <EmptyState
          title={
            openDeliveries.length === 0
              ? "No deliveries waiting"
              : "No deliveries for this driver"
          }
          description={
            openDeliveries.length === 0
              ? "Open delivery orders will appear here by driver."
              : "Choose another driver or switch back to All."
          }
        />
      ) : (
        <div className="space-y-6">
          {driverGroups.map((driverGroup) => (
            <section
              key={driverGroup.driver}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleDriver(driverGroup.driver)}
                className="flex w-full items-center justify-between gap-4 border-b border-slate-200 pb-4 text-left transition hover:text-[#FC2C38]"
                aria-expanded={isDriverOpen(driverGroup.driver)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                    <Truck className="h-6 w-6" aria-hidden="true" />
                  </div>

                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900">
                      {driverGroup.driver}
                    </h2>

                    <p className="text-sm font-bold text-slate-500">
                      {driverGroup.deliveries.length}{" "}
                      {driverGroup.deliveries.length === 1
                        ? "order"
                        : "orders"}
                    </p>
                  </div>
                </div>

                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${
                      isDriverOpen(driverGroup.driver)
                        ? "rotate-180"
                        : ""
                    }`}
                    aria-hidden="true"
                    strokeWidth={2.6}
                  />
                </span>
              </button>

              {isDriverOpen(driverGroup.driver) ? (
              <div className="mt-5 space-y-4">
                {driverGroup.deliveries.map((delivery, deliveryIndex) => {
                  const items = Array.isArray(delivery.items)
                    ? delivery.items
                    : [];
                  const isUpdating =
                    updatingDeliveryId === delivery.id;
                  const contactPhone =
                    delivery.contactPhone || delivery.phoneNumber || "";
                  const deliveryLocationNotes =
                    delivery.deliveryLocationNotes ||
                    delivery.deliveryNotes ||
                    "";
                  const generalNotes = delivery.generalNotes || "";
                  const scopeSummary = getDeliveryScopeSummary(delivery);
                  const deliveryIsOpen = isDeliveryOpen(
                    delivery.id,
                    deliveryIndex,
                  );
                  const deliveryStep = getDeliveryStep(delivery.id);
                  const deliveryPhotos = getPhotoList(
                    delivery,
                    "deliveryPhoto",
                    "deliveryPhotos",
                  );
                  const hardwarePhotos = getPhotoList(
                    delivery,
                    "hardwarePhoto",
                    "hardwarePhotos",
                  );

                  return (
                    <div key={delivery.id}>
                      <MobileDeliveryFlowCard
                        delivery={delivery}
                        deliveryIndex={deliveryIndex}
                        deliveryCount={driverGroup.deliveries.length}
                        deliveryStep={deliveryStep}
                        setDeliveryStep={setDeliveryStep}
                        isUpdating={isUpdating}
                        deliveryPhotos={deliveryPhotos}
                        hardwarePhotos={hardwarePhotos}
                        scopeSummary={scopeSummary}
                        contactPhone={contactPhone}
                        deliveryLocationNotes={deliveryLocationNotes}
                        generalNotes={generalNotes}
                        onPhotoChange={handlePhotoChange}
                        onHardwareChecked={handleHardwareChecked}
                        onCompleteDelivery={handleCompleteDelivery}
                        onViewPhoto={setViewingPhoto}
                      />

                      {canEditDeliveries ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 lg:hidden">
                          <button
                            type="button"
                            onClick={() => handleSendBackToDispatch(delivery)}
                            disabled={isUpdating}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RotateCcw
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                            Send back to dispatch
                          </button>
                        </div>
                      ) : null}

                    <article className="hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:block">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <button
                          type="button"
                          onClick={() => toggleDelivery(delivery.id)}
                          className="min-w-0 flex-1 text-left"
                          aria-expanded={deliveryIsOpen}
                        >
                          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                            {deliveryIndex === 0 ? "Next Delivery" : "Queued"} ·
                            Order {delivery.orderNumber}
                          </span>

                          <span className="mt-1 block text-2xl font-black tracking-tight text-slate-900">
                            {formatCustomerName(delivery.customerName)}
                          </span>

                          <span className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700">
                              <Clock className="h-4 w-4" aria-hidden="true" />
                              {getDeliveryTimeRange(delivery)}
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
                              Back {getDeliveryBackAroundLabel(delivery)}
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700">
                              Site around {getDeliverySiteArrivalLabel(delivery)}
                            </span>

                            {delivery.driverTargetArrivalTime ? (
                              <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-black text-violet-700">
                                <Clock
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Be there{" "}
                                {formatTimeLabel(
                                  delivery.driverTargetArrivalTime,
                                )}
                              </span>
                            ) : null}

                            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700">
                              <Truck className="h-4 w-4" aria-hidden="true" />
                              {delivery.unloadType}
                            </span>

                            {delivery.unloadType === "Forklift" &&
                            delivery.forkliftType ? (
                              <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-black text-orange-800">
                                {formatForkliftLabel(delivery.forkliftType)}
                              </span>
                            ) : null}

                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-black ${
                                delivery.deliveryType === "return"
                                  ? "bg-blue-50 text-blue-700"
                                  : delivery.deliveryType === "hotShot"
                                  ? "bg-red-50 text-[#FC2C38]"
                                  : delivery.deliveryType === "priority"
                                    ? "bg-amber-50 text-amber-800"
                                    : "bg-white text-slate-700"
                              }`}
                            >
                              {formatDeliveryTypeLabel(delivery.deliveryType)}
                            </span>

                            {delivery.needsTarp ? (
                              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700">
                                <CloudRain
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Tarp
                              </span>
                            ) : null}
                          </span>
                        </button>

                        <div className="flex flex-col gap-2 sm:flex-row lg:items-start">
                          <button
                            type="button"
                            onClick={() => toggleDelivery(delivery.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
                          >
                            {deliveryIsOpen ? "Close" : "Open"}
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                deliveryIsOpen ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </button>

                          {canEditDeliveries ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditDelivery(delivery.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
                              >
                                <Edit3
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSendBackToDispatch(delivery)}
                                disabled={isUpdating}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <RotateCcw
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Send back to dispatch
                              </button>

                              {onDeleteDelivery ? (
                                <button
                                  type="button"
                                  onClick={() => onDeleteDelivery(delivery.id)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-[#FC2C38] shadow-sm transition hover:bg-red-50"
                                >
                                  <Trash2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Delete
                                </button>
                              ) : null}
                            </>
                          ) : null}

                          <a
                            href={getDirectionsUrl(delivery.address)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
                          >
                            Directions
                            <ExternalLink
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </a>
                        </div>
                      </div>

                      {deliveryIsOpen ? (
                      <>
                      {canEditDeliveries && driverOptions.length > 0 ? (
                        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-sm font-black text-slate-900">
                                Assigned Driver
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-500">
                                Change who sees this delivery in their driver view.
                              </p>
                            </div>

                            {(() => {
                              const selectedReassignDriver =
                                pendingDriverSelections[delivery.id] ??
                                delivery.driver ??
                                "";
                              const reassignConflict =
                                selectedReassignDriver &&
                                selectedReassignDriver !== delivery.driver
                                  ? findDriverScheduleConflict(
                                      delivery,
                                      deliveries,
                                      selectedReassignDriver,
                                    )
                                  : null;
                              const canSaveReassign =
                                Boolean(selectedReassignDriver) &&
                                selectedReassignDriver !== delivery.driver &&
                                !reassignConflict &&
                                reassigningDeliveryId !== delivery.id;

                              return (
                                <div className="w-full space-y-2 lg:max-w-xl">
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <label className="block flex-1">
                                      <span className="sr-only">
                                        Change delivery driver
                                      </span>
                                      <select
                                        value={selectedReassignDriver}
                                        onChange={(event) =>
                                          setPendingDriverSelections(
                                            (currentSelections) => ({
                                              ...currentSelections,
                                              [delivery.id]:
                                                event.target.value,
                                            }),
                                          )
                                        }
                                        disabled={
                                          reassigningDeliveryId === delivery.id
                                        }
                                        className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 disabled:bg-slate-100 disabled:text-slate-400"
                                      >
                                        <option value="">
                                          Select driver...
                                        </option>
                                        {driverOptions.map((driverOption) => (
                                          <option
                                            key={driverOption}
                                            value={driverOption}
                                          >
                                            {driverOption}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleReassignDriver(
                                          delivery,
                                          selectedReassignDriver,
                                        )
                                      }
                                      disabled={!canSaveReassign}
                                      className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                                    >
                                      {reassigningDeliveryId === delivery.id
                                        ? "Saving..."
                                        : "Save"}
                                    </button>
                                  </div>

                                  {reassignConflict ? (
                                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                                      {selectedReassignDriver} already has order{" "}
                                      {reassignConflict.orderNumber} scheduled{" "}
                                      {getDeliveryTimeRange(reassignConflict)}.
                                    </p>
                                  ) : selectedReassignDriver !==
                                    delivery.driver ? (
                                    <p className="text-xs font-bold text-slate-500">
                                      Click Save to confirm the driver change.
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </div>
                        </section>
                      ) : null}

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="grid grid-cols-4 gap-2">
                          {DRIVER_DELIVERY_STEPS.map((stepLabel, stepIndex) => {
                            const isActiveStep = deliveryStep === stepIndex;
                            const isCompleteStep = deliveryStep > stepIndex;

                            return (
                              <button
                                key={stepLabel}
                                type="button"
                                onClick={() =>
                                  setDeliveryStep(delivery.id, stepIndex)
                                }
                                className={`flex min-w-0 flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition ${
                                  isActiveStep
                                    ? "bg-slate-950 text-white shadow-sm"
                                    : isCompleteStep
                                      ? "bg-emerald-50 text-emerald-800"
                                      : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                }`}
                                aria-current={isActiveStep ? "step" : undefined}
                              >
                                <span
                                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                                    isActiveStep
                                      ? "bg-[#FC2C38] text-white"
                                      : isCompleteStep
                                        ? "bg-emerald-700 text-white"
                                        : "bg-white text-slate-500"
                                  }`}
                                >
                                  {isCompleteStep ? (
                                    <CheckCircle2
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    stepIndex + 1
                                  )}
                                </span>

                                <span className="text-[10px] font-black uppercase leading-4 tracking-[0.08em] sm:text-xs">
                                  {stepLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {deliveryStep === 0 ? (
                      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                            <Clock
                              className="h-4 w-4 text-[#FC2C38]"
                              aria-hidden="true"
                            />
                            Schedule & Route
                          </p>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                Window
                              </p>
                              <p className="mt-1 text-sm font-black text-slate-900">
                                {delivery.deliveryDate || "No date"} ·{" "}
                                {getDeliveryTimeRange(delivery)}
                              </p>
                            </div>

                            <div className="rounded-xl bg-emerald-50 px-4 py-3">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                                Back Around
                              </p>
                              <p className="mt-1 text-lg font-black text-emerald-800">
                                {getDeliveryBackAroundLabel(delivery)}
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-sm font-bold text-slate-500">
                            Site arrival around{" "}
                            {getDeliverySiteArrivalLabel(delivery)}.
                          </p>

                          <p className="mt-2 text-sm font-bold text-slate-500">
                            {getDeliveryBlockSummary(delivery)}
                          </p>

                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            Leaving From
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {delivery.deliveryOriginName || "Capital Lumber"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {delivery.deliveryOriginAddress ||
                              "3105 W State St, Boise, ID 83703"}
                          </p>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                          <MapPin
                            className="h-4 w-4 text-[#FC2C38]"
                            aria-hidden="true"
                          />
                          Delivery Address
                        </p>

                        <p className="text-sm font-semibold text-slate-600">
                          {delivery.address}
                        </p>

                          <a
                            href={getDirectionsUrl(delivery.address)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#FC2C38] transition hover:text-red-700"
                          >
                            Directions
                            <ExternalLink
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </a>
                        </section>
                      </div>
                      ) : null}

                      {deliveryStep === 1 ? (
                      <div className="mt-4">
                        <RoutePreviewCard delivery={delivery} />
                      </div>
                      ) : null}

                      {deliveryStep === 0 ? (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                            <UserRound
                              className="h-4 w-4 text-[#FC2C38]"
                              aria-hidden="true"
                            />
                            Contact
                          </p>

                          <p className="text-sm font-semibold text-slate-600">
                            {delivery.contactName || "No contact name added"}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {contactPhone || "No contact phone added"}
                          </p>
                        </section>

                        {deliveryLocationNotes ? (
                          <section className="rounded-2xl border border-red-100 bg-white p-4">
                            <p className="text-sm font-black text-slate-900">
                              Delivery Location Notes
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-600">
                              {deliveryLocationNotes}
                            </p>
                          </section>
                        ) : null}
                      </div>
                      ) : null}

                      {deliveryStep === 0 && generalNotes ? (
                        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-black text-slate-900">
                            General Notes
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {generalNotes}
                          </p>
                        </section>
                      ) : null}

                      {deliveryStep === 2 && delivery.hasHardware ? (
                        <section className="mt-4 rounded-2xl border-2 border-[#FC2C38] bg-red-50 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <ShieldAlert
                                className="mt-0.5 h-7 w-7 text-[#FC2C38]"
                                aria-hidden="true"
                              />

                              <div>
                                <p className="text-xl font-black text-slate-900">
                                  Hardware on this delivery
                                </p>

                                <p className="mt-1 text-sm font-bold text-red-700">
                                  Take a hardware photo and check it off
                                  before completing this order.
                                </p>
                              </div>
                            </div>

                            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  delivery.hardwareChecked,
                                )}
                                onChange={(event) =>
                                  handleHardwareChecked(
                                    delivery,
                                    event.target.checked,
                                  )
                                }
                                disabled={isUpdating}
                                className="h-5 w-5 rounded border-red-300 text-[#FC2C38] focus:ring-red-200"
                              />
                              Hardware delivered
                            </label>
                          </div>

                          <div className="mt-4 flex min-w-0 flex-col gap-3 rounded-2xl border border-red-200 bg-white p-4">
                            <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                              <Camera
                                className="h-4 w-4 text-[#FC2C38]"
                                aria-hidden="true"
                              />
                              Hardware photo
                            </span>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-2.5 text-sm font-black text-white">
                                <Camera className="h-4 w-4" aria-hidden="true" />
                                Take Photo
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  disabled={isUpdating}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    handlePhotoChange(
                                      delivery,
                                      file,
                                      "hardwarePhoto",
                                      "hardwarePhotos",
                                    );
                                    event.target.value = "";
                                  }}
                                  className="sr-only"
                                />
                              </label>

                              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700">
                                <Images className="h-4 w-4" aria-hidden="true" />
                                Upload Photo
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUpdating}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    handlePhotoChange(
                                      delivery,
                                      file,
                                      "hardwarePhoto",
                                      "hardwarePhotos",
                                    );
                                    event.target.value = "";
                                  }}
                                  className="sr-only"
                                />
                              </label>
                            </div>

                            {hardwarePhotos.length > 0 ? (
                              <span className="text-sm font-bold text-emerald-700">
                                {hardwarePhotos.length} hardware{" "}
                                {hardwarePhotos.length === 1
                                  ? "photo"
                                  : "photos"}{" "}
                                saved
                              </span>
                            ) : (
                              <span className="text-sm font-bold text-red-700">
                                Required when hardware is on the delivery.
                              </span>
                            )}
                          </div>

                          <div className="mt-4">
                            <PhotoPreviewGrid
                              photos={hardwarePhotos}
                              label="hardware photo"
                              onView={setViewingPhoto}
                            />
                          </div>
                        </section>
                      ) : null}

                      {deliveryStep === 0 && delivery.needsTarp ? (
                        <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                          <p className="flex items-center gap-2 text-lg font-black text-slate-900">
                            <CloudRain
                              className="h-5 w-5 text-blue-700"
                              aria-hidden="true"
                            />
                            Tarp needed
                          </p>

                          <p className="mt-1 text-sm font-bold text-blue-700">
                            Make sure the load is tarped before leaving.
                          </p>
                        </section>
                      ) : null}

                      {deliveryStep === 0 ? (
                      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                          <Package
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Delivery Scope
                        </p>

                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                            {scopeSummary.label}
                          </p>

                          {scopeSummary.detail ? (
                            <p className="mt-1 text-base font-black text-slate-900">
                              {scopeSummary.detail}
                            </p>
                          ) : null}
                        </div>

                        {scopeSummary.usesItems ? (
                          <ul className="mt-3 space-y-2">
                            {items.map((item) => (
                              <li
                                key={item.id}
                                className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                              >
                                {item.quantity ? (
                                  <span className="mr-2 font-black text-[#FC2C38]">
                                    {item.quantity}
                                  </span>
                                ) : null}
                                {item.description}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </section>
                      ) : null}

                      {deliveryStep === 2 ? (
                      <section className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="flex items-center gap-2 text-sm font-black text-slate-900">
                          <Camera
                            className="h-4 w-4 text-[#FC2C38]"
                            aria-hidden="true"
                          />
                          Completion
                        </p>

                        <div className="grid gap-3 lg:grid-cols-2">
                        <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                            <Camera
                              className="h-4 w-4 text-[#FC2C38]"
                              aria-hidden="true"
                            />
                            Delivery photo
                          </span>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white">
                              <Camera className="h-4 w-4" aria-hidden="true" />
                              Take Photo
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                disabled={isUpdating}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  handlePhotoChange(
                                    delivery,
                                    file,
                                    "deliveryPhoto",
                                    "deliveryPhotos",
                                  );
                                  event.target.value = "";
                                }}
                                className="sr-only"
                              />
                            </label>

                            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700">
                              <Images className="h-4 w-4" aria-hidden="true" />
                              Upload Photo
                              <input
                                type="file"
                                accept="image/*"
                                disabled={isUpdating}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  handlePhotoChange(
                                    delivery,
                                    file,
                                    "deliveryPhoto",
                                    "deliveryPhotos",
                                  );
                                  event.target.value = "";
                                }}
                                className="sr-only"
                              />
                            </label>
                          </div>

                          {deliveryPhotos.length > 0 ? (
                            <span className="text-sm font-bold text-emerald-700">
                              {deliveryPhotos.length} delivery{" "}
                              {deliveryPhotos.length === 1
                                ? "photo"
                                : "photos"}{" "}
                              saved
                            </span>
                          ) : (
                            <span className="max-w-full text-wrap text-xs font-semibold leading-5 text-slate-500">
                              Take a clear photo after drop-off.
                            </span>
                          )}
                        </div>

                        <PhotoPreviewGrid
                          photos={deliveryPhotos}
                          label="delivery photo"
                          onView={setViewingPhoto}
                        />
                        </div>

                      </section>
                      ) : null}

                      {deliveryStep === 3 ? (
                        <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-xl font-black text-slate-900">
                                Complete this delivery
                              </p>

                              <p className="mt-1 text-sm font-bold text-emerald-800">
                                Confirm photos, hardware, and condition before
                                closing order {delivery.orderNumber}.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCompleteDelivery(delivery)}
                              disabled={isUpdating}
                              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:py-4 lg:w-auto"
                            >
                              <CheckCircle2
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                              Complete Delivery
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white px-4 py-3">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                Delivery Photos
                              </p>
                              <p className="mt-1 text-2xl font-black text-slate-900">
                                {deliveryPhotos.length}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-white px-4 py-3">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                Hardware
                              </p>
                              <p className="mt-1 text-base font-black text-slate-900">
                                {delivery.hasHardware
                                  ? delivery.hardwareChecked
                                    ? "Delivered"
                                    : "Needs Check"
                                  : "None"}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-white px-4 py-3">
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                Back Around
                              </p>
                              <p className="mt-1 text-base font-black text-slate-900">
                                {getDeliveryBackAroundLabel(delivery)}
                              </p>
                            </div>
                          </div>

                          {deliveryPhotos.length || hardwarePhotos.length ? (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <PhotoPreviewGrid
                                photos={deliveryPhotos}
                                label="delivery photo"
                                onView={setViewingPhoto}
                              />

                              <PhotoPreviewGrid
                                photos={hardwarePhotos}
                                label="hardware photo"
                                onView={setViewingPhoto}
                              />
                            </div>
                          ) : null}
                        </section>
                      ) : null}

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setDeliveryStep(delivery.id, deliveryStep - 1)
                          }
                          disabled={deliveryStep === 0}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Back
                        </button>

                        {deliveryStep < DRIVER_DELIVERY_STEPS.length - 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDeliveryStep(delivery.id, deliveryStep + 1)
                            }
                            className="rounded-xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
                          >
                            Next:{" "}
                            {DRIVER_DELIVERY_STEPS[deliveryStep + 1]}
                          </button>
                        ) : null}
                      </div>
                      </>
                      ) : null}
                    </article>
                    </div>
                  );
                })}
              </div>
              ) : null}
            </section>
          ))}
        </div>
      )}

      {viewingPhoto?.dataUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={viewingPhoto.label || "Delivery photo"}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="truncate text-sm font-black uppercase tracking-[0.12em] text-slate-700">
                {viewingPhoto.label || "Delivery Photo"}
              </p>
              <button
                type="button"
                onClick={() => setViewingPhoto(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
                aria-label="Close photo"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-950 p-3">
              <img
                src={viewingPhoto.dataUrl}
                alt={viewingPhoto.label || "Delivery photo"}
                className="max-h-[78vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
