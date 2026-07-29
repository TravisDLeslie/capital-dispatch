import { useState } from "react";
import {
  Camera,
  CheckCircle2,
  Edit3,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  ShieldAlert,
  Truck,
} from "lucide-react";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";

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

async function createPhotoFromFile(file) {
  const dataUrl = await readFileAsDataUrl(file);

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    dataUrl,
    capturedAt: new Date().toISOString(),
  };
}

function groupDeliveriesByDriver(deliveries) {
  return deliveries.reduce((groups, delivery) => {
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

export default function DeliveryQueuePage({
  deliveries,
  onUpdateDelivery,
  onEditDelivery,
}) {
  const [error, setError] = useState("");
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState("");

  const openDeliveries = deliveries.filter(
    (delivery) => delivery.status !== "complete",
  );
  const driverGroups = groupDeliveriesByDriver(openDeliveries);

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

      {driverGroups.length === 0 ? (
        <EmptyState
          title="No deliveries waiting"
          description="Open delivery orders will appear here by driver."
        />
      ) : (
        <div className="space-y-6">
          {driverGroups.map((driverGroup) => (
            <section
              key={driverGroup.driver}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
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
              </div>

              <div className="space-y-4">
                {driverGroup.deliveries.map((delivery) => {
                  const items = Array.isArray(delivery.items)
                    ? delivery.items
                    : [];
                  const isUpdating =
                    updatingDeliveryId === delivery.id;

                  return (
                    <article
                      key={delivery.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                            Order {delivery.orderNumber}
                          </p>

                          <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                            {delivery.customerName}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700">
                              <Truck
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              {delivery.unloadType}
                            </span>

                            {delivery.phoneNumber ? (
                              <a
                                href={`tel:${delivery.phoneNumber.replace(/\D/g, "")}`}
                                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700 transition hover:text-[#FC2C38]"
                              >
                                <Phone
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {delivery.phoneNumber}
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
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

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                          <MapPin
                            className="h-4 w-4 text-[#FC2C38]"
                            aria-hidden="true"
                          />
                          Address
                        </p>

                        <p className="text-sm font-semibold text-slate-600">
                          {delivery.address}
                        </p>
                      </div>

                      {delivery.deliveryNotes ? (
                        <div className="mt-4 rounded-2xl border border-red-100 bg-white p-4">
                          <p className="text-sm font-black text-slate-900">
                            Notes
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {delivery.deliveryNotes}
                          </p>
                        </div>
                      ) : null}

                      {delivery.hasHardware ? (
                        <div className="mt-4 rounded-2xl border-2 border-[#FC2C38] bg-red-50 p-4">
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

                          <label className="mt-4 flex cursor-pointer flex-col gap-3 rounded-2xl border border-red-200 bg-white p-4 transition hover:bg-red-50">
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
                              className="text-sm font-semibold text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#FC2C38] file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
                            />

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
                        </div>
                      ) : null}

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                          <Package
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Items
                        </p>

                        <ul className="space-y-2">
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
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50">
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
                            className="text-sm font-semibold text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
                          />

                          {delivery.deliveryPhoto ? (
                            <span className="text-sm font-bold text-emerald-700">
                              Delivery photo saved
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-slate-500">
                              Take a clear photo after dropping off the
                              material.
                            </span>
                          )}
                        </label>

                        <button
                          type="button"
                          onClick={() => handleCompleteDelivery(delivery)}
                          disabled={isUpdating}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle2
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                          Complete Delivery
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
