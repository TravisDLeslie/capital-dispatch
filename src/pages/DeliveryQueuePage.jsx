import { useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  ExternalLink,
  MapPin,
  Package,
  ShieldAlert,
  Truck,
  UserRound,
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
} from "../utils/deliverySchedule";
import { formatCustomerName } from "../utils/textFormatters";

function getDirectionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
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

function PhotoPreview({ photo, label }) {
  if (!photo?.dataUrl) {
    return null;
  }

  return (
    <a
      href={photo.dataUrl}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-red-200"
    >
      <img
        src={photo.dataUrl}
        alt={label}
        className="h-40 w-full object-cover"
      />

      <span className="block px-3 py-2 text-sm font-black text-slate-700">
        View {label}
      </span>
    </a>
  );
}

export default function DeliveryQueuePage({
  deliveries,
  onUpdateDelivery,
  canEditDeliveries = false,
  onEditDelivery,
  onPageChange,
}) {
  const [error, setError] = useState("");
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("All");
  const [openDriverKeys, setOpenDriverKeys] = useState({});
  const [openDeliveryKeys, setOpenDeliveryKeys] = useState({});

  const openDeliveries = deliveries.filter(
    (delivery) =>
      delivery.status !== "complete" &&
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
  const filteredDeliveries =
    selectedDriver === "All"
      ? openDeliveries
      : openDeliveries.filter(
          (delivery) =>
            (delivery.driver || "Unassigned Driver") === selectedDriver,
        );
  const driverGroups = groupDeliveriesByDriver(filteredDeliveries);

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

  async function handlePhotoChange(deliveryId, file, photoField) {
    if (!file) {
      return;
    }

    setError("");
    setUpdatingDeliveryId(deliveryId);

    try {
      const photo = await createPhotoFromFile(file);

      await onUpdateDelivery(deliveryId, {
        [photoField]: photo,
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

  async function handleCompleteDelivery(delivery) {
    if (!delivery.deliveryPhoto) {
      setError(
        `Add a delivery photo before completing order ${delivery.orderNumber}.`,
      );
      return;
    }

    if (delivery.hasHardware && !delivery.hardwarePhoto) {
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

                  return (
                    <article
                      key={delivery.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
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

                            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700">
                              <Truck className="h-4 w-4" aria-hidden="true" />
                              {delivery.unloadType}
                            </span>
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

                      {generalNotes ? (
                        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-black text-slate-900">
                            General Notes
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {generalNotes}
                          </p>
                        </section>
                      ) : null}

                      {delivery.hasHardware ? (
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

                          <label className="mt-4 flex min-w-0 cursor-pointer flex-col gap-3 rounded-2xl border border-red-200 bg-white p-4 transition hover:bg-red-50">
                            <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                              <Camera
                                className="h-4 w-4 text-[#FC2C38]"
                                aria-hidden="true"
                              />
                              Hardware photo
                            </span>

                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              disabled={isUpdating}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                handlePhotoChange(
                                  delivery.id,
                                  file,
                                  "hardwarePhoto",
                                );
                                event.target.value = "";
                              }}
                              className="sr-only"
                            />

                            <span className="inline-flex w-full items-center justify-center rounded-xl bg-[#FC2C38] px-4 py-2.5 text-sm font-black text-white">
                              Take / Upload Hardware Photo
                            </span>

                            {delivery.hardwarePhoto ? (
                              <span className="text-sm font-bold text-emerald-700">
                                Hardware photo saved
                              </span>
                            ) : (
                              <span className="text-sm font-bold text-red-700">
                                Required when hardware is on the delivery.
                              </span>
                            )}
                          </label>

                          <div className="mt-4">
                            <PhotoPreview
                              photo={delivery.hardwarePhoto}
                              label="hardware photo"
                            />
                          </div>
                        </section>
                      ) : null}

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

                      <section className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="flex items-center gap-2 text-sm font-black text-slate-900">
                          <Camera
                            className="h-4 w-4 text-[#FC2C38]"
                            aria-hidden="true"
                          />
                          Completion
                        </p>

                        <div className="grid gap-3 lg:grid-cols-2">
                        <label className="flex min-w-0 cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50">
                          <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                            <Camera
                              className="h-4 w-4 text-[#FC2C38]"
                              aria-hidden="true"
                            />
                            Delivery photo
                          </span>

                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={isUpdating}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              handlePhotoChange(
                                delivery.id,
                                file,
                                "deliveryPhoto",
                              );
                              event.target.value = "";
                            }}
                            className="sr-only"
                          />

                          <span className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white">
                            Take / Upload Delivery Photo
                          </span>

                          {delivery.deliveryPhoto ? (
                            <span className="text-sm font-bold text-emerald-700">
                              Delivery photo saved
                            </span>
                          ) : (
                            <span className="max-w-full text-wrap text-xs font-semibold leading-5 text-slate-500">
                              Take a clear photo after drop-off.
                            </span>
                          )}
                        </label>

                        <PhotoPreview
                          photo={delivery.deliveryPhoto}
                          label="delivery photo"
                        />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCompleteDelivery(delivery)}
                          disabled={isUpdating}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:py-4"
                        >
                          <CheckCircle2
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                          Complete Delivery
                        </button>
                      </section>
                      </>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
