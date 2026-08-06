import { useEffect, useState } from "react";
import {
  favoriteSouthDrivers,
  southDrivers,
  supplierAddresses as fallbackSupplierAddresses,
  vendors as fallbackVendors,
} from "../data/options";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { getDateInputValue } from "../utils/dateHelpers";
import { createId } from "../utils/idHelpers";

function createEmptyPickupItem() {
  return {
    id: createId(),
    quantity: "",
    description: "",
    internalReference: "",
    materialUse: "order",
    orderNumber: "",
    customerName: "",
    returnNotes: "",
    saved: false,
    pickedUp: false,
  };
}

function usesOrderNumber(materialUse) {
  return ["order", "return", "swap"].includes(materialUse);
}

function usesReturnNotes(materialUse) {
  return ["return", "swap"].includes(materialUse);
}

function getMaterialUseLabel(materialUse) {
  const labels = {
    order: "Order",
    stock: "Stock",
    return: "Return",
    swap: "Swap",
  };

  return labels[materialUse] || "Order";
}

function formatPoNumber(value) {
  const numbersOnly = value.replace(/\D/g, "").slice(0, 6);

  if (numbersOnly.length > 3) {
    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
  }

  return numbersOnly;
}

function formatOrderNumber(value) {
  return formatPoNumber(value);
}

function findMatchingVendor(value, vendorOptions) {
  return vendorOptions.find(
    (vendor) => vendor.toLowerCase() === value.trim().toLowerCase(),
  );
}

function findSupplierAddress(value, vendorOptions, supplierAddressMap) {
  const matchedVendor = findMatchingVendor(value, vendorOptions);

  return matchedVendor ? supplierAddressMap[matchedVendor] || "" : "";
}

const orderedByOptions = [
  "Dane",
  "Joe",
  "Travis",
  "Todd",
  "Shane",
  "McKenzie",
  "Tim",
  "Justin",
  "Pete",
];

export default function SupplierRunForm({
  onSubmit,
  createdBy,
  vehicleOptions,
  vendorOptions,
  supplierAddressMap,
  canAssignRoute = false,
  initialSupplierRun = null,
  onCancel,
}) {
  const safeVehicleOptions = Array.isArray(vehicleOptions)
    ? vehicleOptions
    : [];
  const safeVendorOptions =
    Array.isArray(vendorOptions) && vendorOptions.length > 0
      ? vendorOptions
      : fallbackVendors;
  const safeSupplierAddressMap = {
    ...fallbackSupplierAddresses,
    ...(supplierAddressMap || {}),
  };
  const [poNumber, setPoNumber] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    getDateInputValue(),
  );
  const [orderedBy, setOrderedBy] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vendor, setVendor] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [items, setItems] = useState([createEmptyPickupItem()]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedVehicle = safeVehicleOptions.find(
    (vehicleOption) => vehicleOption.id === vehicleId,
  );
  const isEditing = Boolean(initialSupplierRun?.id);

  function getInitialItems(supplierRun) {
    const pickupItems = Array.isArray(supplierRun?.items)
      ? supplierRun.items
      : [];

    if (pickupItems.length === 0) {
      return [createEmptyPickupItem()];
    }

    return pickupItems.map((item) => ({
      ...item,
      id: item.id || createId(),
      quantity: item.quantity || "",
      description: item.description || "",
      internalReference: item.internalReference || "",
      materialUse: item.materialUse || "order",
      orderNumber: item.orderNumber || "",
      customerName: item.customerName || "",
      returnNotes: item.returnNotes || "",
      saved: true,
      pickedUp: Boolean(item.pickedUp),
    }));
  }

  useEffect(() => {
    if (!initialSupplierRun) {
      return;
    }

    setPoNumber(initialSupplierRun.poNumber || "");
    setScheduledDate(
      initialSupplierRun.scheduledDate || getDateInputValue(),
    );
    setOrderedBy(initialSupplierRun.orderedBy || "");
    setCustomerName(
      initialSupplierRun.customerName ||
        getInitialItems(initialSupplierRun).find((item) =>
          usesOrderNumber(item.materialUse),
        )?.customerName ||
        "",
    );
    setVendor(initialSupplierRun.vendor || "");
    setSupplierAddress(initialSupplierRun.supplierAddress || "");
    setDriver(initialSupplierRun.driver || "");
    setVehicleId(initialSupplierRun.vehicleId || "");
    setItems(getInitialItems(initialSupplierRun));
    setError("");
  }, [initialSupplierRun]);

  function clearError() {
    setError("");
  }

  function updateVendor(value) {
    setVendor(value);

    const address = findSupplierAddress(
      value,
      safeVendorOptions,
      safeSupplierAddressMap,
    );

    if (address) {
      setSupplierAddress(address);
    }

    clearError();
  }

  function updateItem(itemId, description) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              description,
              saved: false,
            }
          : item,
      ),
    );

    clearError();
  }

  function updateItemQuantity(itemId, quantity) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity,
              saved: false,
            }
          : item,
      ),
    );

    clearError();
  }

  function updateItemInternalReference(itemId, internalReference) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              internalReference,
              saved: false,
            }
          : item,
      ),
    );

    clearError();
  }

  function updateItemMaterialUse(itemId, materialUse) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              materialUse,
              orderNumber:
                usesOrderNumber(materialUse) ? item.orderNumber : "",
              customerName:
                usesOrderNumber(materialUse) ? item.customerName : "",
              returnNotes:
                usesReturnNotes(materialUse) ? item.returnNotes : "",
              saved: false,
            }
          : item,
      ),
    );

    clearError();
  }

  function updateItemOrderNumber(itemId, orderNumber) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              orderNumber,
              saved: false,
            }
          : item,
      ),
    );

    clearError();
  }

  function updateItemReturnNotes(itemId, returnNotes) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              returnNotes,
              saved: false,
            }
          : item,
      ),
    );

    clearError();
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      createEmptyPickupItem(),
    ]);

    clearError();
  }

  function removeItem(itemId) {
    if (items.find((item) => item.id === itemId)?.pickedUp) {
      return;
    }

    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return [createEmptyPickupItem()];
      }

      return currentItems.filter((item) => item.id !== itemId);
    });

    clearError();
  }

  function saveItem(itemId) {
    const item = items.find(
      (pickupItem) => pickupItem.id === itemId,
    );

    if (!item?.description.trim()) {
      setError("Enter an item description before saving it.");
      return;
    }

    if (
      usesReturnNotes(item.materialUse) &&
      !item.pickedUp &&
      !item.returnNotes?.trim()
    ) {
      setError(
        "Add return notes so the driver knows where it is and what it looks like.",
      );
      return;
    }

    setItems((currentItems) =>
      currentItems.map((pickupItem) =>
        pickupItem.id === itemId
          ? {
              ...pickupItem,
              quantity: pickupItem.quantity.trim(),
              description: pickupItem.description.trim(),
              internalReference:
                pickupItem.internalReference.trim(),
              materialUse: pickupItem.materialUse || "order",
              customerName:
                usesOrderNumber(pickupItem.materialUse)
                  ? pickupItem.customerName?.trim() || ""
                  : "",
              orderNumber:
                usesOrderNumber(pickupItem.materialUse)
                  ? formatOrderNumber(pickupItem.orderNumber || "")
                  : "",
              returnNotes:
                usesReturnNotes(pickupItem.materialUse)
                  ? pickupItem.returnNotes.trim()
                  : "",
              saved: true,
            }
          : pickupItem,
      ),
    );

    clearError();
  }

  function editItem(itemId) {
    if (items.find((item) => item.id === itemId)?.pickedUp) {
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              saved: false,
            }
          : item,
      ),
    );

    clearError();
  }

  function resetForm() {
    setPoNumber("");
    setScheduledDate(getDateInputValue());
    setOrderedBy("");
    setCustomerName("");
    setVendor("");
    setSupplierAddress("");
    setDriver("");
    setVehicleId("");
    setItems([createEmptyPickupItem()]);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!/^\d{3}-\d{3}$/.test(poNumber)) {
      setError("Enter a complete six-digit PO number.");
      return;
    }

    if (!scheduledDate) {
      setError("Choose the scheduled pickup date.");
      return;
    }

    if (!orderedBy) {
      setError("Select who ordered this South PO.");
      return;
    }

    const matchedVendor = findMatchingVendor(vendor);

    if (!matchedVendor) {
      setError("Select a vendor from the vendor list.");
      return;
    }

    if (!isEditing && canAssignRoute && !southDrivers.includes(driver)) {
      setError("Select the driver for this South PO.");
      return;
    }

    if (
      canAssignRoute &&
      !isEditing &&
      safeVehicleOptions.length > 0 &&
      !selectedVehicle
    ) {
      setError("Select what truck is going South.");
      return;
    }

    const pickupItems = items
      .filter((item) => item.description.trim())
      .map((item) => {
        const itemData = { ...item };
        delete itemData.saved;
        const itemUsesCustomer = usesOrderNumber(item.materialUse);

        return {
          ...itemData,
          id: item.id || createId(),
          quantity: item.quantity?.trim() || "",
          description: item.description.trim(),
          internalReference: item.internalReference?.trim() || "",
          materialUse: item.materialUse || "order",
          customerName:
            itemUsesCustomer ? customerName.trim() || "" : "",
          orderNumber:
            usesOrderNumber(item.materialUse)
              ? formatOrderNumber(item.orderNumber || "")
              : "",
          returnNotes:
            usesReturnNotes(item.materialUse)
              ? item.returnNotes?.trim() || ""
              : "",
          pickedUp: Boolean(item.pickedUp),
        };
      });

    if (pickupItems.length === 0) {
      setError("Add at least one item for the driver to pick up.");
      return;
    }

    const returnItemMissingNotes = pickupItems.find(
      (item) =>
        usesReturnNotes(item.materialUse) &&
        !item.pickedUp &&
        !item.returnNotes?.trim(),
    );

    if (returnItemMissingNotes) {
      setError(
        "Add return notes for each return or swap item before sending it to the driver.",
      );
      return;
    }

    const unsavedItem = items.find(
      (item) => item.description.trim() && !item.saved,
    );

    if (unsavedItem) {
      setError("Save each pickup item before sending the PO to the driver.");
      return;
    }

    const now = new Date().toISOString();
    const supplierRunCustomerName = pickupItems.some((item) =>
      usesOrderNumber(item.materialUse),
    )
      ? customerName.trim()
      : "";
    const supplierRun = {
      ...(initialSupplierRun || {}),
      id: initialSupplierRun?.id || createId(),
      poNumber,
      scheduledDate,
      orderedBy,
      customerName: supplierRunCustomerName,
      vendor: matchedVendor,
      supplierAddress: supplierAddress.trim(),
      driver: canAssignRoute ? driver : initialSupplierRun?.driver || "",
      vehicleId: canAssignRoute
        ? selectedVehicle?.id || initialSupplierRun?.vehicleId || ""
        : initialSupplierRun?.vehicleId || "",
      vehicleTitle: canAssignRoute
        ? selectedVehicle?.title || initialSupplierRun?.vehicleTitle || ""
        : initialSupplierRun?.vehicleTitle || "",
      vehicleBadge: canAssignRoute
        ? selectedVehicle?.badge || initialSupplierRun?.vehicleBadge || ""
        : initialSupplierRun?.vehicleBadge || "",
      dispatchStatus:
        canAssignRoute && driver
          ? "assigned"
          : initialSupplierRun?.dispatchStatus || "needsDispatch",
      items: pickupItems,
      status: initialSupplierRun?.status || "open",
      createdByName:
        initialSupplierRun?.createdByName || createdBy?.name || "",
      createdByEmail:
        initialSupplierRun?.createdByEmail || createdBy?.email || "",
      createdById:
        initialSupplierRun?.createdById || createdBy?.id || "",
      createdAt: initialSupplierRun?.createdAt || now,
      updatedAt: now,
    };

    setIsSubmitting(true);

    try {
      await onSubmit(supplierRun);
      if (!isEditing) {
        resetForm();
      }
    } catch (submitError) {
      console.error("Unable to save supplier run:", submitError);
      setError(getFirebaseErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg sm:p-8"
    >
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
          {isEditing ? "Edit Pickup" : "Driver Pickup"}
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          {isEditing ? `Edit PO ${poNumber}` : "Add South PO"}
        </h2>

        <p className="mt-2 text-slate-500">
          {isEditing
            ? "Update the PO, supplier, driver, and pickup items without removing it from the route."
            : "Add the PO, supplier, and items. Dispatch will assign the driver and truck from Needs Dispatch."}
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  PO Details
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  Pickup Reference
                </h3>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 sm:min-w-48">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Created By
                </p>
                <p className="mt-0.5 truncate text-sm font-black text-slate-800">
                  {createdBy?.name || createdBy?.email || "Signed in user"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div>
                <label
                  htmlFor="supplier-run-ordered-by"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Ordered By
                </label>

                <select
                  id="supplier-run-ordered-by"
                  value={orderedBy}
                  onChange={(event) => {
                    setOrderedBy(event.target.value);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select...</option>
                  {orderedByOptions.map((orderedByOption) => (
                    <option key={orderedByOption} value={orderedByOption}>
                      {orderedByOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="supplier-run-date"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Pickup Date
                </label>

                <input
                  id="supplier-run-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => {
                    setScheduledDate(event.target.value);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="lg:col-span-2 xl:col-span-1 2xl:col-span-2">
                <label
                  htmlFor="supplier-run-po"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  PO Number
                </label>

                <input
                  id="supplier-run-po"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={7}
                  value={poNumber}
                  onChange={(event) => {
                    setPoNumber(formatPoNumber(event.target.value));
                    clearError();
                  }}
                  disabled={isSubmitting}
                  placeholder="123-456"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-3xl font-black tracking-[0.12em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="lg:col-span-2 xl:col-span-1 2xl:col-span-2">
                <label
                  htmlFor="supplier-run-customer-name"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Customer Name
                </label>

                <input
                  id="supplier-run-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  placeholder="For order, return, or swap items"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Not used for stock-only pickup items.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Route Assignment
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                Supplier & Driver
              </h3>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label
                  htmlFor="supplier-run-vendor-select"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Vendor
                </label>

                <select
                  id="supplier-run-vendor-select"
                  value={vendor}
                  onChange={(event) => updateVendor(event.target.value)}
                  disabled={isSubmitting}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 md:hidden"
                >
                  <option value="">Select a vendor...</option>

                  {safeVendorOptions.map((vendorOption) => (
                    <option
                      key={vendorOption}
                      value={vendorOption}
                    >
                      {vendorOption}
                    </option>
                  ))}
                </select>

                <input
                  id="supplier-run-vendor-search"
                  type="text"
                  list="supplier-run-vendor-options"
                  autoComplete="off"
                  value={vendor}
                  onChange={(event) => updateVendor(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Start typing a vendor..."
                  aria-label="Vendor"
                  className="hidden w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 md:block"
                />

                <datalist id="supplier-run-vendor-options">
                  {safeVendorOptions.map((vendorOption) => (
                    <option
                      key={vendorOption}
                      value={vendorOption}
                    />
                  ))}
                </datalist>
              </div>

              {canAssignRoute ? (
                <>
                  <div>
                    <label
                      htmlFor="supplier-run-driver"
                      className="mb-2 block text-sm font-bold text-slate-700"
                    >
                      Driver
                    </label>

                    <select
                      id="supplier-run-driver"
                      value={driver}
                      onChange={(event) => {
                        setDriver(event.target.value);
                        clearError();
                      }}
                      disabled={isSubmitting}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Select a driver...</option>

                      <optgroup label="Favorites">
                        {favoriteSouthDrivers.map((driverOption) => (
                          <option key={driverOption} value={driverOption}>
                            {driverOption}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="All Drivers">
                        {southDrivers
                          .filter(
                            (driverOption) =>
                              !favoriteSouthDrivers.includes(driverOption),
                          )
                          .map((driverOption) => (
                            <option key={driverOption} value={driverOption}>
                              {driverOption}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label
                      htmlFor="supplier-run-vehicle"
                      className="mb-2 block text-sm font-bold text-slate-700"
                    >
                      What Truck is going South?
                    </label>

                    <select
                      id="supplier-run-vehicle"
                      value={vehicleId}
                      onChange={(event) => {
                        setVehicleId(event.target.value);
                        clearError();
                      }}
                      disabled={
                        isSubmitting || safeVehicleOptions.length === 0
                      }
                      className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {safeVehicleOptions.length > 0
                          ? "Select a truck..."
                          : "No vehicles saved yet"}
                      </option>

                      {safeVehicleOptions.map((vehicleOption) => (
                        <option
                          key={vehicleOption.id}
                          value={vehicleOption.id}
                        >
                          {vehicleOption.title}
                          {vehicleOption.badge
                            ? ` (${vehicleOption.badge})`
                            : ""}
                        </option>
                      ))}
                    </select>

                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      This ties the South PO to the truck for location and ETA
                      later.
                    </p>
                  </div>
                </>
              ) : (
                <div className="lg:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-black text-amber-900">
                    Dispatch will assign the driver and truck.
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-800">
                    Submit the PO request now, and it will land in Needs
                    Dispatch.
                  </p>
                </div>
              )}

              <div className="lg:col-span-2">
                <label
                  htmlFor="supplier-run-address"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Supplier Address
                </label>

                <input
                  id="supplier-run-address"
                  type="text"
                  autoComplete="street-address"
                  value={supplierAddress}
                  onChange={(event) => {
                    setSupplierAddress(event.target.value);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  placeholder="Optional: address for driver directions"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Known supplier addresses fill automatically and can be
                  edited.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Checklist
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                Pickup Items
              </h3>
            </div>

            <p className="text-sm font-semibold text-slate-500">
              These become the driver checklist.
            </p>
          </div>

          <div>
            <h3 className="sr-only">
              Pickup Items
            </h3>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Item {index + 1}
                    </h4>

                    {item.pickedUp ? (
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        Picked up - locked
                      </p>
                    ) : item.saved ? (
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        ✓ Item saved
                      </p>
                    ) : null}
                  </div>

                  {!item.pickedUp ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={isSubmitting}
                      className="text-sm font-semibold text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                {item.saved ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      {item.quantity ? (
                        <p className="mb-1 text-sm font-black text-blue-700">
                          QTY: {item.quantity}
                        </p>
                      ) : null}

                      <p className="font-bold text-slate-900">
                        {item.description}
                      </p>

                      {item.internalReference ? (
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          SKU / Item # / SO#:{" "}
                          {item.internalReference}
                        </p>
                      ) : null}

                      <p className="mt-2 text-sm font-black text-slate-600">
                        {getMaterialUseLabel(item.materialUse)}
                        {item.orderNumber ? ` ${item.orderNumber}` : ""}
                      </p>

                      {item.returnNotes ? (
                        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                          {item.returnNotes}
                        </p>
                      ) : null}
                    </div>

                    {!item.pickedUp ? (
                      <button
                        type="button"
                        onClick={() => editItem(item.id)}
                        disabled={isSubmitting}
                        className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 lg:grid-cols-[110px_minmax(280px,1fr)_minmax(220px,0.5fr)]">
                      <div>
                        <label
                          htmlFor={`supplier-item-quantity-${item.id}`}
                          className="sr-only"
                        >
                          Quantity
                        </label>

                        <input
                          id={`supplier-item-quantity-${item.id}`}
                          type="text"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItemQuantity(
                              item.id,
                              event.target.value,
                            )
                          }
                          disabled={isSubmitting}
                          placeholder="QTY"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`supplier-item-description-${item.id}`}
                          className="sr-only"
                        >
                          Item Description
                        </label>

                        <input
                          id={`supplier-item-description-${item.id}`}
                          type="text"
                          value={item.description}
                          onChange={(event) =>
                            updateItem(item.id, event.target.value)
                          }
                          disabled={isSubmitting}
                          placeholder="Example: 2 units LVL, hangers, trim pack"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`supplier-item-reference-${item.id}`}
                          className="sr-only"
                        >
                          SKU / Item # / SO#
                        </label>

                        <input
                          id={`supplier-item-reference-${item.id}`}
                          type="text"
                          value={item.internalReference}
                          onChange={(event) =>
                            updateItemInternalReference(
                              item.id,
                              event.target.value,
                            )
                          }
                          disabled={isSubmitting}
                          placeholder="SKU / Item # / SO#"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[180px_minmax(180px,0.55fr)_160px]">
                      <div>
                        <label
                          htmlFor={`supplier-item-use-${item.id}`}
                          className="sr-only"
                        >
                          Item Type
                        </label>

                        <select
                          id={`supplier-item-use-${item.id}`}
                          value={item.materialUse}
                          onChange={(event) =>
                            updateItemMaterialUse(
                              item.id,
                              event.target.value,
                            )
                          }
                          disabled={isSubmitting}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        >
                          <option value="order">Order</option>
                          <option value="stock">Stock</option>
                          <option value="return">Return</option>
                          <option value="swap">Swap</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`supplier-item-order-${item.id}`}
                          className="sr-only"
                        >
                          Order Number
                        </label>

                        <input
                          id={`supplier-item-order-${item.id}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={7}
                          value={item.orderNumber}
                          onChange={(event) =>
                            updateItemOrderNumber(
                              item.id,
                              formatOrderNumber(event.target.value),
                            )
                          }
                          disabled={
                            isSubmitting ||
                            !usesOrderNumber(item.materialUse)
                          }
                          placeholder="Order #"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => saveItem(item.id)}
                        disabled={isSubmitting}
                        className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        Save Item
                      </button>
                    </div>

                    {usesReturnNotes(item.materialUse) ? (
                      <div>
                        <label
                          htmlFor={`supplier-item-return-notes-${item.id}`}
                          className="sr-only"
                        >
                          Return or swap notes
                        </label>

                        <textarea
                          id={`supplier-item-return-notes-${item.id}`}
                          value={item.returnNotes || ""}
                          onChange={(event) =>
                            updateItemReturnNotes(
                              item.id,
                              event.target.value,
                            )
                          }
                          disabled={isSubmitting}
                          rows={3}
                          placeholder="Return notes: where it is, what it looks like, condition, labels, or anything the driver should know"
                          className="w-full resize-y rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-slate-900 outline-none transition placeholder:text-amber-700/70 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              disabled={isSubmitting}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3.5 font-bold text-slate-600 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800"
            >
              + Add Another Item
            </button>
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 font-semibold text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-6 py-4 text-lg font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:text-slate-400 sm:w-48"
            >
              Cancel
            </button>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-black text-white shadow-md transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting
              ? "Saving South PO..."
              : isEditing
                ? "Save PO Changes"
                : "Send to Driver"}
          </button>
        </div>
      </div>
    </form>
  );
}
