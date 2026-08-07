import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import {
  deliveryOriginOptions as fallbackDeliveryOriginOptions,
  deliveryUnloadTypes,
} from "../data/options";
import {
  defaultDeliveryScheduleSettings,
  getDeliveryDurationMinutes,
} from "../utils/deliverySchedule";
import {
  deliveryScopeOptions,
  getDeliveryScopeOption,
} from "../utils/deliveryScope";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";
import { formatCustomerName } from "../utils/textFormatters";

function createEmptyDeliveryItem() {
  return {
    id: createId(),
    quantity: "",
    description: "",
    saved: false,
    delivered: false,
  };
}

function createItemsFromDelivery(delivery) {
  if (!Array.isArray(delivery?.items) || delivery.items.length === 0) {
    return [createEmptyDeliveryItem()];
  }

  return delivery.items.map((item) => ({
    id: item.id || createId(),
    quantity: item.quantity || "",
    description: item.description || "",
    delivered: Boolean(item.delivered),
    saved: true,
  }));
}

function formatOrderNumber(value) {
  const numbersOnly = value.replace(/\D/g, "").slice(0, 6);

  if (numbersOnly.length > 3) {
    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
  }

  return numbersOnly;
}

function formatPhoneNumber(value) {
  const numbersOnly = value.replace(/\D/g, "").slice(0, 10);

  if (numbersOnly.length > 6) {
    return `(${numbersOnly.slice(0, 3)}) ${numbersOnly.slice(
      3,
      6,
    )}-${numbersOnly.slice(6)}`;
  }

  if (numbersOnly.length > 3) {
    return `(${numbersOnly.slice(0, 3)}) ${numbersOnly.slice(3)}`;
  }

  if (numbersOnly.length > 0) {
    return `(${numbersOnly}`;
  }

  return "";
}

function getDirectionsUrl(originAddress, destinationAddress) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    originAddress || "",
  )}&destination=${encodeURIComponent(destinationAddress || "")}`;
}

function getOriginAddress(originName, originOptions = fallbackDeliveryOriginOptions) {
  return (
    originOptions.find(
      (originOption) => originOption.name === originName,
    )?.address || originOptions[0]?.address || ""
  );
}

function normalizeLookup(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCustomerDisplayName(customer) {
  return formatCustomerName(customer?.companyName || customer?.name);
}

function getCustomerAddress(customer) {
  if (!customer) {
    return "";
  }

  return (
    customer.address ||
    [customer.streetAddress, customer.city, customer.state, customer.zip]
      .filter(Boolean)
      .join(", ")
  );
}

function getPrimaryCustomerContact(customer) {
  if (!Array.isArray(customer?.contacts)) {
    return null;
  }

  return (
    customer.contacts.find(
      (contact) => contact.name || contact.phone || contact.email,
    ) || null
  );
}

export default function DeliveryOrderForm({
  initialDelivery = null,
  deliverySettings = defaultDeliveryScheduleSettings,
  onSubmit,
  onCancel,
  onDelete,
  customers = [],
  deliveryOriginOptions,
}) {
  const safeDeliveryOriginOptions =
    Array.isArray(deliveryOriginOptions) && deliveryOriginOptions.length > 0
      ? deliveryOriginOptions
      : fallbackDeliveryOriginOptions;
  const isEditing = Boolean(initialDelivery);
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [driver, setDriver] = useState("");
  const [unloadType, setUnloadType] = useState("Forklift");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [deliveryOriginName, setDeliveryOriginName] =
    useState("Capital Lumber");
  const [deliveryOriginAddress, setDeliveryOriginAddress] = useState(
    getOriginAddress("Capital Lumber", safeDeliveryOriginOptions),
  );
  const [oneWayDriveMinutes, setOneWayDriveMinutes] = useState("");
  const [deliveryScope, setDeliveryScope] = useState("shipOrderComplete");
  const [deliveryScopeNotes, setDeliveryScopeNotes] = useState("");
  const [hasHardware, setHasHardware] = useState(false);
  const [deliveryLocationNotes, setDeliveryLocationNotes] =
    useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [items, setItems] = useState([createEmptyDeliveryItem()]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!initialDelivery) {
      return;
    }

    setOrderNumber(initialDelivery.orderNumber || "");
    setCustomerName(initialDelivery.customerName || "");
    setAddress(initialDelivery.address || "");
    setContactName(initialDelivery.contactName || "");
    setContactPhone(
      initialDelivery.contactPhone || initialDelivery.phoneNumber || "",
    );
    setDriver(initialDelivery.driver || "");
    setUnloadType(initialDelivery.unloadType || "Forklift");
    setDeliveryDate(initialDelivery.deliveryDate || "");
    setDeliveryTimeSlot(initialDelivery.deliveryTimeSlot || "");
    setDeliveryOriginName(
      initialDelivery.deliveryOriginName || "Capital Lumber",
    );
    setDeliveryOriginAddress(
      initialDelivery.deliveryOriginAddress ||
        getOriginAddress(
          initialDelivery.deliveryOriginName || "Capital Lumber",
          safeDeliveryOriginOptions,
        ),
    );
    setOneWayDriveMinutes(
      initialDelivery.oneWayDriveMinutes
        ? String(initialDelivery.oneWayDriveMinutes)
        : "",
    );
    setDeliveryScope(getDeliveryScopeOption(initialDelivery).value);
    setDeliveryScopeNotes(initialDelivery.deliveryScopeNotes || "");
    setHasHardware(Boolean(initialDelivery.hasHardware));
    setDeliveryLocationNotes(
      initialDelivery.deliveryLocationNotes ||
        initialDelivery.deliveryNotes ||
        "",
    );
    setGeneralNotes(initialDelivery.generalNotes || "");
    setItems(createItemsFromDelivery(initialDelivery));
    setError("");
  }, [initialDelivery, safeDeliveryOriginOptions]);

  function clearError() {
    setError("");
  }

  function findMatchingCustomer(value) {
    const normalizedValue = normalizeLookup(value);

    if (!normalizedValue) {
      return null;
    }

    return (
      customers.find((customer) =>
        [customer.companyName, customer.name, customer.accountNumber]
          .filter(Boolean)
          .some(
            (lookupValue) => normalizeLookup(lookupValue) === normalizedValue,
          ),
      ) || null
    );
  }

  function applyCustomerDetails(customer, force = false) {
    if (!customer) {
      return;
    }

    const matchedAddress = getCustomerAddress(customer);
    const primaryContact = getPrimaryCustomerContact(customer);

    if (matchedAddress && (force || !address.trim())) {
      setAddress(matchedAddress);
    }

    if (primaryContact?.name && (force || !contactName.trim())) {
      setContactName(primaryContact.name);
    }

    if (primaryContact?.phone && (force || !contactPhone.trim())) {
      setContactPhone(formatPhoneNumber(primaryContact.phone));
    }
  }

  function updateItem(itemId, field, value) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
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
      createEmptyDeliveryItem(),
    ]);

    clearError();
  }

  function removeItem(itemId) {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return [createEmptyDeliveryItem()];
      }

      return currentItems.filter((item) => item.id !== itemId);
    });

    clearError();
  }

  function saveItem(itemId) {
    const item = items.find(
      (deliveryItem) => deliveryItem.id === itemId,
    );

    if (!item?.description.trim()) {
      setError("Enter an item description before saving it.");
      return;
    }

    setItems((currentItems) =>
      currentItems.map((deliveryItem) =>
        deliveryItem.id === itemId
          ? {
              ...deliveryItem,
              quantity: deliveryItem.quantity.trim(),
              description: deliveryItem.description.trim(),
              saved: true,
            }
          : deliveryItem,
      ),
    );

    clearError();
  }

  function editItem(itemId) {
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
    setOrderNumber("");
    setCustomerName("");
    setAddress("");
    setContactName("");
    setContactPhone("");
    setDriver("");
    setUnloadType("Forklift");
    setDeliveryDate("");
    setDeliveryTimeSlot("");
    setDeliveryOriginName("Capital Lumber");
    setDeliveryOriginAddress(
      getOriginAddress("Capital Lumber", safeDeliveryOriginOptions),
    );
    setOneWayDriveMinutes("");
    setDeliveryScope("shipOrderComplete");
    setDeliveryScopeNotes("");
    setHasHardware(false);
    setDeliveryLocationNotes("");
    setGeneralNotes("");
    setItems([createEmptyDeliveryItem()]);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!/^\d{3}-\d{3}$/.test(orderNumber)) {
      setError("Enter a complete six-digit order number.");
      return;
    }

    if (!customerName.trim()) {
      setError("Enter the customer name.");
      return;
    }

    if (!address.trim()) {
      setError("Enter the delivery address.");
      return;
    }

    if (!deliveryUnloadTypes.includes(unloadType)) {
      setError("Select the delivery unload type.");
      return;
    }

    const selectedScope = getDeliveryScopeOption(deliveryScope);

    if (selectedScope.requiresNotes && !deliveryScopeNotes.trim()) {
      setError(`Enter ${selectedScope.noteLabel.toLowerCase()}.`);
      return;
    }

    const deliveryItems = items
      .filter((item) => item.description.trim())
      .map((item) => ({
        id: item.id,
        quantity: item.quantity?.trim() || "",
        description: item.description.trim(),
        delivered: Boolean(item.delivered),
      }));

    if (selectedScope.usesItems && deliveryItems.length === 0) {
      setError("Add at least one item for the driver to deliver.");
      return;
    }

    const unsavedItem = items.find(
      (item) => item.description.trim() && !item.saved,
    );

    if (selectedScope.usesItems && unsavedItem) {
      setError("Save each delivery item before sending the order to the driver.");
      return;
    }

    const now = new Date().toISOString();
    const delivery = {
      id: initialDelivery?.id || createId(),
      orderNumber: orderNumber.trim(),
      customerName: formatCustomerName(customerName),
      address: address.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      phoneNumber: contactPhone.trim(),
      driver,
      dispatchStatus: driver ? "assigned" : "needsDispatch",
      unloadType,
      deliveryDate,
      deliveryTimeSlot,
      deliveryOriginName,
      deliveryOriginAddress,
      oneWayDriveMinutes: Number(oneWayDriveMinutes) || 0,
      estimatedDurationMinutes: getDeliveryDurationMinutes(
        unloadType,
        null,
        deliverySettings,
      ),
      deliveryScope: selectedScope.value,
      deliveryScopeNotes: deliveryScopeNotes.trim(),
      hasHardware,
      hardwareChecked: hasHardware
        ? Boolean(initialDelivery?.hardwareChecked)
        : false,
      hardwarePhoto: hasHardware
        ? initialDelivery?.hardwarePhoto || null
        : null,
      deliveryLocationNotes: deliveryLocationNotes.trim(),
      generalNotes: generalNotes.trim(),
      deliveryNotes: deliveryLocationNotes.trim(),
      items: selectedScope.usesItems ? deliveryItems : [],
      deliveryPhoto: initialDelivery?.deliveryPhoto || null,
      deliveredAt: initialDelivery?.deliveredAt || null,
      status: initialDelivery?.status || "open",
      createdAt: initialDelivery?.createdAt || now,
      updatedAt: now,
    };

    setIsSubmitting(true);

    try {
      await onSubmit(delivery);
      if (isEditing && onCancel) {
        onCancel();
      } else {
        resetForm();
      }
    } catch (submitError) {
      console.error("Unable to save delivery:", submitError);
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
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Delivery's for Drivers
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          {isEditing ? "Edit Delivery Order" : "Add Delivery"}
        </h2>

        <p className="mt-2 text-slate-500">
          {isEditing
            ? "Update the customer stop, unload method, notes, and delivery items."
            : "Build the order now. Dispatch can assign the driver when it is ready."}
        </p>
      </div>

      <div className="space-y-7">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label
              htmlFor="delivery-order-number"
              className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <Package className="h-4 w-4" aria-hidden="true" />
              Order Number
            </label>

            <input
              id="delivery-order-number"
              type="text"
              autoComplete="off"
              value={orderNumber}
              onChange={(event) => {
                setOrderNumber(formatOrderNumber(event.target.value));
                clearError();
              }}
              disabled={isSubmitting}
              inputMode="numeric"
              maxLength={7}
              placeholder="123-456"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-xl font-black tracking-[0.12em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </div>

          <div>
            <label
              htmlFor="delivery-customer"
              className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Customer / Company
            </label>

            <input
              id="delivery-customer"
              type="text"
              autoComplete="organization"
              list="delivery-customers"
              value={customerName}
              onChange={(event) => {
                const nextCustomerName = event.target.value.toUpperCase();
                const matchedCustomer = findMatchingCustomer(nextCustomerName);

                setCustomerName(nextCustomerName);
                applyCustomerDetails(matchedCustomer, true);
                clearError();
              }}
              onBlur={() =>
                applyCustomerDetails(findMatchingCustomer(customerName), true)
              }
              disabled={isSubmitting}
              placeholder="Customer name"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />

            <datalist id="delivery-customers">
              {customers.map((customer) => {
                const displayName = getCustomerDisplayName(customer);

                if (!displayName) {
                  return null;
                }

                return (
                  <option
                    key={customer.id}
                    value={displayName}
                    label={
                      customer.accountNumber ||
                      formatCustomerName(customer.name) ||
                      ""
                    }
                  />
                );
              })}
            </datalist>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <label
              htmlFor="delivery-address"
              className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Address
            </label>

            <AddressAutocompleteInput
              id="delivery-address"
              value={address}
              onChange={(nextAddress) => {
                setAddress(nextAddress);
                clearError();
              }}
              disabled={isSubmitting}
              placeholder="Delivery address"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </div>

          <div>
            <label
              htmlFor="delivery-contact-name"
              className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Contact Name
            </label>

            <input
              id="delivery-contact-name"
              type="text"
              autoComplete="name"
              value={contactName}
              onChange={(event) => {
                setContactName(event.target.value);
                clearError();
              }}
              disabled={isSubmitting}
              placeholder="Who will be on site?"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </div>

          <div>
            <label
              htmlFor="delivery-contact-phone"
              className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Contact Phone
            </label>

            <input
              id="delivery-contact-phone"
              type="tel"
              autoComplete="tel"
              value={contactPhone}
              onChange={(event) => {
                setContactPhone(formatPhoneNumber(event.target.value));
                clearError();
              }}
              disabled={isSubmitting}
              placeholder="Contact phone"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </div>
        </div>

        <section>
          <h3 className="mb-3 text-sm font-bold text-slate-700">
            Unload Type
          </h3>

          <div className="grid gap-3 sm:grid-cols-3">
            {deliveryUnloadTypes.map((unloadOption) => {
              const isSelected = unloadType === unloadOption;

              return (
                <button
                  key={unloadOption}
                  type="button"
                  onClick={() => {
                    setUnloadType(unloadOption);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-black transition ${
                    isSelected
                      ? "border-[#FC2C38] bg-red-50 text-[#FC2C38] shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    {unloadOption}
                    {isSelected ? (
                      <Check
                        className="h-4 w-4"
                        aria-hidden="true"
                        strokeWidth={3}
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-700">
              Where is the delivery leaving from?
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Capital Lumber is the default. Pick a supplier if the truck is
              leaving from a pickup.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(160px,0.45fr)]">
            <div>
              <label
                htmlFor="delivery-origin"
                className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Origin
              </label>

              <select
                id="delivery-origin"
                value={deliveryOriginName}
                onChange={(event) => {
                  const originName = event.target.value;

                  setDeliveryOriginName(originName);
                  setDeliveryOriginAddress(
                    getOriginAddress(originName, safeDeliveryOriginOptions),
                  );
                  clearError();
                }}
                disabled={isSubmitting}
                className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              >
                {safeDeliveryOriginOptions.map((originOption) => (
                  <option key={originOption.name} value={originOption.name}>
                    {originOption.name}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-sm font-semibold text-slate-500">
                {deliveryOriginAddress}
              </p>

              {address.trim() ? (
                <a
                  href={getDirectionsUrl(deliveryOriginAddress, address)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#FC2C38] transition hover:text-red-700"
                >
                  Open live route ETA
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="one-way-drive-minutes"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                One-way route ETA
              </label>

              <div className="flex items-center gap-3">
                <input
                  id="one-way-drive-minutes"
                  type="number"
                  min="0"
                  max="240"
                  step="1"
                  value={oneWayDriveMinutes}
                  onChange={(event) => {
                    setOneWayDriveMinutes(event.target.value);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  placeholder="18"
                  className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />

                <span className="shrink-0 text-sm font-black text-slate-500">
                  min
                </span>
              </div>

              <p className="mt-2 text-xs font-bold text-slate-500">
                Used twice for out-and-back time.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-700">
              Delivery Scope
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Use this instead of writing every item for large deliveries.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            {deliveryScopeOptions.map((scopeOption) => {
              const isSelected = deliveryScope === scopeOption.value;

              return (
                <button
                  key={scopeOption.value}
                  type="button"
                  onClick={() => {
                    setDeliveryScope(scopeOption.value);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-[#FC2C38] bg-red-50 text-slate-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-black">
                    {scopeOption.label}
                    {isSelected ? (
                      <Check
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                        strokeWidth={3}
                      />
                    ) : null}
                  </span>

                  <span className="mt-2 block text-sm font-semibold leading-5 text-slate-500">
                    {scopeOption.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label
              htmlFor="delivery-scope-notes"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              {getDeliveryScopeOption(deliveryScope).noteLabel}
              {getDeliveryScopeOption(deliveryScope).requiresNotes ? (
                <span className="ml-2 text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                  Required
                </span>
              ) : null}
            </label>

            <textarea
              id="delivery-scope-notes"
              value={deliveryScopeNotes}
              onChange={(event) => {
                setDeliveryScopeNotes(event.target.value);
                clearError();
              }}
              disabled={isSubmitting}
              rows={3}
              placeholder={getDeliveryScopeOption(deliveryScope).notePlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </div>
        </section>

        <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-red-100 bg-red-50 p-4 transition hover:border-red-200">
          <input
            type="checkbox"
            checked={hasHardware}
            onChange={(event) => {
              setHasHardware(event.target.checked);
              clearError();
            }}
            disabled={isSubmitting}
            className="mt-1 h-5 w-5 rounded border-red-300 text-[#FC2C38] focus:ring-red-200"
          />

          <span>
            <span className="flex items-center gap-2 text-sm font-black text-slate-900">
              <ShieldCheck
                className="h-4 w-4 text-[#FC2C38]"
                aria-hidden="true"
              />
              Hardware to deliver
            </span>

            <span className="mt-1 block text-sm font-semibold text-slate-600">
              Drivers will see a large reminder and must check hardware
              off before completing the delivery.
            </span>
          </span>
        </label>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
          <label
            htmlFor="delivery-location-notes"
            className="mb-2 block text-sm font-bold text-slate-700"
          >
            Delivery Location Notes
          </label>

          <textarea
            id="delivery-location-notes"
            value={deliveryLocationNotes}
            onChange={(event) => {
              setDeliveryLocationNotes(event.target.value);
              clearError();
            }}
            disabled={isSubmitting}
            rows={3}
            placeholder="Example: Place on driveway, leave by garage."
            className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
          </div>

          <div>
            <label
              htmlFor="delivery-general-notes"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              General Notes
            </label>

            <textarea
              id="delivery-general-notes"
              value={generalNotes}
              onChange={(event) => {
                setGeneralNotes(event.target.value);
                clearError();
              }}
              disabled={isSubmitting}
              rows={3}
              placeholder='Example: Call "John" before leaving.'
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </div>
        </div>

        {getDeliveryScopeOption(deliveryScope).usesItems ? (
        <section>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-700">
              Delivery Items
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              These become the driver's delivery checklist.
            </p>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Item {index + 1}
                    </h4>

                    {item.saved ? (
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        Item saved
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                </div>

                {item.saved ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {item.quantity ? (
                        <p className="mb-1 text-sm font-black text-[#FC2C38]">
                          QTY: {item.quantity}
                        </p>
                      ) : null}

                      <p className="font-bold text-slate-900">
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => editItem(item.id)}
                      disabled={isSubmitting}
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-[#FC2C38] transition hover:bg-red-50"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-[minmax(100px,0.2fr)_minmax(0,1fr)_auto]">
                    <div>
                      <label
                        htmlFor={`delivery-item-quantity-${item.id}`}
                        className="sr-only"
                      >
                        Quantity
                      </label>

                      <input
                        id={`delivery-item-quantity-${item.id}`}
                        type="text"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "quantity",
                            event.target.value,
                          )
                        }
                        disabled={isSubmitting}
                        placeholder="QTY"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`delivery-item-description-${item.id}`}
                        className="sr-only"
                      >
                        Item description
                      </label>

                      <input
                        id={`delivery-item-description-${item.id}`}
                        type="text"
                        value={item.description}
                        onChange={(event) =>
                          updateItem(
                            item.id,
                            "description",
                            event.target.value,
                          )
                        }
                        disabled={isSubmitting}
                        placeholder="Item description"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => saveItem(item.id)}
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save Item
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            disabled={isSubmitting}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Item
          </button>
        </section>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          {isEditing ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 bg-white px-5 py-4 text-base font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-44"
            >
              Cancel
            </button>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Saving Delivery..."
              : isEditing
                ? "Save Order Changes"
                : "Send to Needs Dispatch"}
          </button>
        </div>

        {isEditing && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(initialDelivery.id)}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-red-300 bg-white px-5 py-4 text-base font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete Order
          </button>
        ) : null}
      </div>
    </form>
  );
}
