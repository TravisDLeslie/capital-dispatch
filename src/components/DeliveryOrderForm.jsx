import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  CloudRain,
  Diamond,
  ExternalLink,
  Hand,
  ListChecks,
  MapPin,
  Package,
  Phone,
  Plus,
  ShieldCheck,
  Truck,
  Trash2,
  UserRound,
  Zap,
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

const deliveryTypeOptions = [
  {
    value: "standard",
    label: "Standard",
    description: "Normal delivery within the standard schedule.",
    Icon: Truck,
  },
  {
    value: "priority",
    label: "Priority",
    description: "Faster delivery with priority scheduling.",
    Icon: Zap,
  },
  {
    value: "hotShot",
    label: "Hot Shot",
    description: "Urgent delivery with maximum attention.",
    Icon: Diamond,
  },
];

const forkliftOptions = [
  {
    value: "donkey",
    label: "Donkey",
    capacity: "5000 lbs",
    detail: "3 way",
  },
  {
    value: "manitou",
    label: "Manitou",
    capacity: "4500 lbs",
    detail: "Crab, 12' Tall",
  },
  {
    value: "moffit",
    label: "Moffit",
    capacity: "5500 lbs",
    detail: "Crab, 10' Tall",
  },
];

const deliverySteps = [
  "Order & Customer",
  "Delivery Setup",
  "What's Going",
  "Driver Instructions",
  "Review & Send",
];

function FormSection({ eyebrow, title, description, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-1 border-b border-slate-100 pb-4">
        {eyebrow ? (
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            {eyebrow}
          </p>
        ) : null}

        <h3 className="text-xl font-black tracking-tight text-slate-900">
          {title}
        </h3>

        {description ? (
          <p className="text-sm font-semibold leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      {children}
    </section>
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
  const [deliveryType, setDeliveryType] = useState("standard");
  const [unloadType, setUnloadType] = useState("Forklift");
  const [forkliftType, setForkliftType] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [deliveryOriginName, setDeliveryOriginName] =
    useState("Capital Lumber");
  const [deliveryOriginAddress, setDeliveryOriginAddress] = useState(
    getOriginAddress("Capital Lumber", safeDeliveryOriginOptions),
  );
  const [oneWayDriveMinutes, setOneWayDriveMinutes] = useState("");
  const [driverTargetArrivalTime, setDriverTargetArrivalTime] = useState("");
  const [deliveryScope, setDeliveryScope] = useState("shipOrderComplete");
  const [deliveryScopeNotes, setDeliveryScopeNotes] = useState("");
  const [hasHardware, setHasHardware] = useState(false);
  const [needsTarp, setNeedsTarp] = useState(false);
  const [deliveryLocationNotes, setDeliveryLocationNotes] =
    useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [items, setItems] = useState([createEmptyDeliveryItem()]);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState("");
  const [routeEtaStatus, setRouteEtaStatus] = useState("idle");
  const [routeEtaMessage, setRouteEtaMessage] = useState("");
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
    setDeliveryType(initialDelivery.deliveryType || "standard");
    setUnloadType(initialDelivery.unloadType || "Forklift");
    setForkliftType(initialDelivery.forkliftType || "");
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
    setDriverTargetArrivalTime(initialDelivery.driverTargetArrivalTime || "");
    setDeliveryScope(getDeliveryScopeOption(initialDelivery).value);
    setDeliveryScopeNotes(initialDelivery.deliveryScopeNotes || "");
    setHasHardware(Boolean(initialDelivery.hasHardware));
    setNeedsTarp(Boolean(initialDelivery.needsTarp));
    setDeliveryLocationNotes(
      initialDelivery.deliveryLocationNotes ||
        initialDelivery.deliveryNotes ||
        "",
    );
    setGeneralNotes(initialDelivery.generalNotes || "");
    setItems(createItemsFromDelivery(initialDelivery));
    setCurrentStep(1);
    setError("");
    setRouteEtaStatus("idle");
    setRouteEtaMessage("");
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
      setRouteEtaStatus("idle");
      setRouteEtaMessage("");
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
    setDeliveryType("standard");
    setUnloadType("Forklift");
    setForkliftType("");
    setDeliveryDate("");
    setDeliveryTimeSlot("");
    setDeliveryOriginName("Capital Lumber");
    setDeliveryOriginAddress(
      getOriginAddress("Capital Lumber", safeDeliveryOriginOptions),
    );
    setOneWayDriveMinutes("");
    setDriverTargetArrivalTime("");
    setDeliveryScope("shipOrderComplete");
    setDeliveryScopeNotes("");
    setHasHardware(false);
    setNeedsTarp(false);
    setDeliveryLocationNotes("");
    setGeneralNotes("");
    setItems([createEmptyDeliveryItem()]);
    setCurrentStep(1);
    setError("");
    setRouteEtaStatus("idle");
    setRouteEtaMessage("");
  }

  async function handleCalculateRouteEta() {
    const origin = deliveryOriginAddress.trim();
    const destination = address.trim();

    if (!origin || !destination) {
      setRouteEtaStatus("error");
      setRouteEtaMessage("Enter the delivery address before calculating ETA.");
      return;
    }

    setRouteEtaStatus("loading");
    setRouteEtaMessage("");

    try {
      const routeResponse = await fetch(
        `/api/maps/route?origin=${encodeURIComponent(
          origin,
        )}&destination=${encodeURIComponent(destination)}`,
      );
      const routeData = await routeResponse.json().catch(() => ({}));

      if (!routeResponse.ok) {
        throw new Error(
          routeData?.error || "Google Maps could not calculate this route.",
        );
      }

      const routeMinutes = Math.max(
        1,
        Math.round(Number(routeData.durationSeconds || 0) / 60),
      );

      setOneWayDriveMinutes(String(routeMinutes));
      setRouteEtaStatus("success");
      setRouteEtaMessage(
        `${routeData.durationText || `${routeMinutes} min`} one-way${
          routeData.distanceText ? ` · ${routeData.distanceText}` : ""
        }`,
      );
      clearError();
    } catch (routeError) {
      console.error("Unable to calculate delivery route ETA:", routeError);
      setRouteEtaStatus("error");
      setRouteEtaMessage(
        routeError?.message ||
          "Route ETA unavailable. You can still enter minutes manually.",
      );
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault();

    if (currentStep < deliverySteps.length) {
      const stepError = validateStep(currentStep);

      if (stepError) {
        setError(stepError);
        return;
      }

      setCurrentStep((step) => Math.min(step + 1, deliverySteps.length));
      clearError();
      return;
    }

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
      deliveryType,
      unloadType,
      forkliftType: unloadType === "Forklift" ? forkliftType : "",
      deliveryDate,
      deliveryTimeSlot,
      deliveryOriginName,
      deliveryOriginAddress,
      oneWayDriveMinutes: Number(oneWayDriveMinutes) || 0,
      driverTargetArrivalTime,
      estimatedDurationMinutes: getDeliveryDurationMinutes(
        unloadType,
        null,
        deliverySettings,
      ),
      deliveryScope: selectedScope.value,
      deliveryScopeNotes: deliveryScopeNotes.trim(),
      hasHardware,
      needsTarp,
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

  function validateStep(step) {
    const selectedScope = getDeliveryScopeOption(deliveryScope);

    if (step === 1) {
      if (!/^\d{3}-\d{3}$/.test(orderNumber)) {
        return "Enter a complete six-digit order number.";
      }

      if (!customerName.trim()) {
        return "Enter the customer name.";
      }

      if (!address.trim()) {
        return "Enter the delivery address.";
      }
    }

    if (step === 2) {
      if (!deliveryUnloadTypes.includes(unloadType)) {
        return "Select the delivery unload type.";
      }

    }

    if (step === 3) {
      if (selectedScope.requiresNotes && !deliveryScopeNotes.trim()) {
        return `Enter ${selectedScope.noteLabel.toLowerCase()}.`;
      }

      const savedDeliveryItems = items.filter((item) =>
        item.description.trim(),
      );

      if (selectedScope.usesItems && savedDeliveryItems.length === 0) {
        return "Add at least one item for the driver to deliver.";
      }

      if (
        selectedScope.usesItems &&
        savedDeliveryItems.some((item) => !item.saved)
      ) {
        return "Save each delivery item before continuing.";
      }
    }

    return "";
  }

  function goToStep(step) {
    if (step < currentStep) {
      setCurrentStep(step);
      clearError();
      return;
    }

    for (let stepIndex = currentStep; stepIndex < step; stepIndex += 1) {
      const stepError = validateStep(stepIndex);

      if (stepError) {
        setError(stepError);
        setCurrentStep(stepIndex);
        return;
      }
    }

    setCurrentStep(step);
    clearError();
  }

  function goToNextStep() {
    const stepError = validateStep(currentStep);

    if (stepError) {
      setError(stepError);
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, deliverySteps.length));
    clearError();
  }

  const selectedScope = getDeliveryScopeOption(deliveryScope);
  const savedItems = items.filter((item) => item.description.trim());
  const selectedDeliveryType =
    deliveryTypeOptions.find((option) => option.value === deliveryType) ||
    deliveryTypeOptions[0];
  const selectedForklift =
    forkliftOptions.find((option) => option.value === forkliftType) || null;

  return (
    <form onSubmit={(event) => event.preventDefault()} className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
              Create Delivery
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              {isEditing ? "Edit Delivery Order" : "Add Delivery"}
            </h2>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
              {isEditing
                ? "Update the customer stop, setup, reminders, and items."
                : "Walk through the delivery details, then send it to dispatch."}
            </p>
          </div>

          <div className="flex gap-2">
            {isEditing && onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            ) : null}

            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((step) => Math.max(step - 1, 1))}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-2 lg:grid-cols-5">
          {deliverySteps.map((stepLabel, index) => {
            const stepNumber = index + 1;
            const isActive = currentStep === stepNumber;
            const isComplete = currentStep > stepNumber;

            return (
              <button
                key={stepLabel}
                type="button"
                onClick={() => goToStep(stepNumber)}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-[#FC2C38] bg-red-50 text-slate-900"
                    : isComplete
                      ? "border-emerald-200 bg-emerald-50 text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    isActive
                      ? "bg-[#FC2C38] text-white"
                      : isComplete
                        ? "bg-emerald-700 text-white"
                        : "bg-white text-slate-500"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    stepNumber
                  )}
                </span>

                <span className="text-xs font-black uppercase tracking-[0.08em]">
                  {stepLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5">
        {currentStep === 1 ? (
          <FormSection
            eyebrow="Step 1 of 5"
            title="Order & Customer"
            description="Start with the order number, customer, delivery address, and site contact."
          >
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
                setRouteEtaStatus("idle");
                setRouteEtaMessage("");
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
          </FormSection>
        ) : null}

        {currentStep === 2 ? (
          <FormSection
            eyebrow="Step 2 of 5"
            title="Delivery Setup"
            description="Choose the delivery urgency, unload method, timing, and where the driver is leaving from."
          >
          <h4 className="mb-3 text-sm font-bold text-slate-700">
            Delivery Type
          </h4>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {deliveryTypeOptions.map((typeOption) => {
              const TypeIcon = typeOption.Icon;
              const isSelected = deliveryType === typeOption.value;

              return (
                <button
                  key={typeOption.value}
                  type="button"
                  onClick={() => {
                    setDeliveryType(typeOption.value);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-[#FC2C38] bg-red-50 text-slate-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <TypeIcon
                      className={`h-5 w-5 ${
                        isSelected ? "text-[#FC2C38]" : "text-slate-500"
                      }`}
                      aria-hidden="true"
                    />
                    {isSelected ? (
                      <Check
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                        strokeWidth={3}
                      />
                    ) : null}
                  </span>

                  <span className="mt-3 block text-sm font-black">
                    {typeOption.label}
                  </span>

                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                    {typeOption.description}
                  </span>
                </button>
              );
            })}
          </div>

          <h4 className="mb-3 text-sm font-bold text-slate-700">
            Unload Type
          </h4>

          <div className="grid gap-3 sm:grid-cols-3">
            {deliveryUnloadTypes.map((unloadOption) => {
              const isSelected = unloadType === unloadOption;

              return (
                <button
                  key={unloadOption}
                  type="button"
                  onClick={() => {
                    setUnloadType(unloadOption);
                    if (unloadOption !== "Forklift") {
                      setForkliftType("");
                    }
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

          {unloadType === "Forklift" ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-col gap-1">
                <h4 className="text-sm font-black text-slate-900">
                  Which forklift?
                </h4>
                <p className="text-sm font-semibold text-slate-500">
                  Pick the forklift that should go with this delivery.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {forkliftOptions.map((forkliftOption) => {
                  const isSelected = forkliftType === forkliftOption.value;

                  return (
                    <button
                      key={forkliftOption.value}
                      type="button"
                      onClick={() => {
                        setForkliftType(forkliftOption.value);
                        clearError();
                      }}
                      disabled={isSubmitting}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-[#FC2C38] bg-white text-slate-900 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-base font-black">
                            {forkliftOption.label}
                          </span>
                          <span className="mt-1 block text-sm font-black text-[#FC2C38]">
                            {forkliftOption.capacity}
                          </span>
                          <span className="mt-1 block text-xs font-bold text-slate-500">
                            {forkliftOption.detail}
                          </span>
                        </span>

                        {isSelected ? (
                          <Check
                            className="h-5 w-5 shrink-0 text-[#FC2C38]"
                            aria-hidden="true"
                            strokeWidth={3}
                          />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label
              htmlFor="driver-target-arrival-time"
              className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              What time should the driver be there?
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                Optional
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-[minmax(180px,0.35fr)_1fr] sm:items-center">
              <input
                id="driver-target-arrival-time"
                type="time"
                value={driverTargetArrivalTime}
                onChange={(event) => {
                  setDriverTargetArrivalTime(event.target.value);
                  clearError();
                }}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />

              <p className="text-sm font-semibold text-slate-500">
                {driverTargetArrivalTime
                  ? `Drivers will see “be there around ${formatTimeLabel(
                      driverTargetArrivalTime,
                    )}.”`
                  : "Leave blank if dispatch should control the timing later."}
              </p>
            </div>
          </div>

          <div className="mb-3 mt-6">
            <h4 className="text-sm font-bold text-slate-700">
              Where is the delivery leaving from?
            </h4>

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
                  setRouteEtaStatus("idle");
                  setRouteEtaMessage("");
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
                className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
              >
                One-way route ETA
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Not required
                </span>
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

              <button
                type="button"
                onClick={handleCalculateRouteEta}
                disabled={
                  isSubmitting ||
                  routeEtaStatus === "loading" ||
                  !deliveryOriginAddress.trim() ||
                  !address.trim()
                }
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-[#FC2C38] transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {routeEtaStatus === "loading"
                  ? "Calculating..."
                  : "Calculate ETA"}
              </button>

              {routeEtaMessage ? (
                <p
                  className={`mt-2 text-xs font-black ${
                    routeEtaStatus === "error"
                      ? "text-red-600"
                      : "text-emerald-700"
                  }`}
                >
                  {routeEtaMessage}
                </p>
              ) : null}
            </div>
          </div>
          </FormSection>
        ) : null}

        {currentStep === 3 ? (
          <FormSection
            eyebrow="Step 3 of 5"
            title="What's Going"
            description="Pick the delivery scope and add item details only when they are useful."
          >
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
              {selectedScope.requiresNotes ? (
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
              placeholder={selectedScope.notePlaceholder}
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </div>

          {selectedScope.usesItems ? (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900">
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Delivery Items
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
          </div>
          ) : null}
          </FormSection>
        ) : null}

        {currentStep === 4 ? (
          <FormSection
            eyebrow="Step 4 of 5"
            title="Driver Instructions"
            description="Add reminders, site placement details, and anything the driver should know before leaving."
          >
        <div className="grid gap-3 lg:grid-cols-2">
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
                Drivers will see a reminder and must check hardware off.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 transition hover:border-blue-200">
            <input
              type="checkbox"
              checked={needsTarp}
              onChange={(event) => {
                setNeedsTarp(event.target.checked);
                clearError();
              }}
              disabled={isSubmitting}
              className="mt-1 h-5 w-5 rounded border-blue-300 text-blue-700 focus:ring-blue-200"
            />

            <span>
              <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                <CloudRain
                  className="h-4 w-4 text-blue-700"
                  aria-hidden="true"
                />
                Tarp needed
              </span>

              <span className="mt-1 block text-sm font-semibold text-slate-600">
                Mark this when the load should be tarped before leaving.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
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
              rows={4}
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
              rows={4}
              placeholder='Example: Call "John" before leaving.'
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </div>
        </div>
          </FormSection>
        ) : null}

        {currentStep === 5 ? (
          <FormSection
            eyebrow="Step 5 of 5"
            title="Review & Send"
            description="Give it one last look before this goes to Needs Dispatch."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Order & Customer
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {orderNumber || "No order"}
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {formatCustomerName(customerName) || "No customer"}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {address || "No address entered"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Delivery Setup
                </p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {selectedDeliveryType.label} · {unloadType}
                </p>
                {unloadType === "Forklift" ? (
                  <p className="mt-1 text-sm font-black text-[#FC2C38]">
                    Forklift:{" "}
                    {selectedForklift
                      ? `${selectedForklift.label} · ${selectedForklift.capacity}`
                      : "Not selected"}
                  </p>
                ) : null}
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  From {deliveryOriginName}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Driver there:{" "}
                  {driverTargetArrivalTime
                    ? formatTimeLabel(driverTargetArrivalTime)
                    : "Dispatch decides"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  What's Going
                </p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {selectedScope.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {selectedScope.usesItems
                    ? `${savedItems.length} ${
                        savedItems.length === 1 ? "item" : "items"
                      } listed`
                    : selectedScope.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hasHardware ? (
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-[#FC2C38]">
                      Hardware
                    </span>
                  ) : null}
                  {needsTarp ? (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                      Tarp
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {selectedScope.usesItems && savedItems.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-sm font-black text-slate-900">
                  Delivery Items
                </p>
                <ul className="space-y-2">
                  {savedItems.map((item) => (
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
            ) : null}
          </FormSection>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep((step) => Math.max(step - 1, 1))}
            disabled={isSubmitting || currentStep === 1}
            className="rounded-xl border border-slate-300 bg-white px-5 py-4 text-base font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-44"
          >
            Back
          </button>

          {currentStep < deliverySteps.length ? (
            <button
              type="button"
              onClick={goToNextStep}
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-sm"
            >
              {currentStep === deliverySteps.length - 1
                ? "Review Delivery"
                : `Next: ${deliverySteps[currentStep]}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-sm"
            >
              {isSubmitting
                ? "Saving Delivery..."
                : isEditing
                  ? "Save Order Changes"
                  : "Send to Needs Dispatch"}
            </button>
          )}
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
