import { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Pencil,
  Trash2,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import SearchableSelect from "../components/SearchableSelect";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { getDateInputValue, formatDateInput } from "../utils/dateHelpers";
import { createId } from "../utils/idHelpers";
import { formatCustomerName } from "../utils/textFormatters";

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

function formatPoNumber(value) {
  const numbersOnly = String(value || "").replace(/\D/g, "").slice(0, 6);

  if (numbersOnly.length > 3) {
    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
  }

  return numbersOnly;
}

function createEmptyItem() {
  return {
    id: createId(),
    quantity: "",
    description: "",
    internalReference: "",
  };
}

function findMatchingVendor(value, vendorOptions) {
  return vendorOptions.find(
    (vendor) => vendor.toLowerCase() === value.trim().toLowerCase(),
  );
}

function getVendorAddress(vendor, supplierAddressMap) {
  return supplierAddressMap?.[vendor] || "";
}

function getVendorDeliveryCadence(vendor, vendorDeliveryCadenceMap) {
  return vendorDeliveryCadenceMap?.[vendor] || "";
}

function getItemSummary(items) {
  const itemCount = items.length;

  if (itemCount === 0) {
    return "No items";
  }

  return `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
}

/**
 * @param {{
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   vendorOptions?: string[];
 *   supplierAddressMap?: Record<string, string>;
 *   vendorDeliveryCadenceMap?: Record<string, string>;
 *   createdBy?: { name?: string; email?: string };
 *   employeeOptions?: string[];
 *   onSaveTheirTruckPO?: Function;
 *   onDeleteTheirTruckPO?: Function;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function TheirTruckPOPage({
  theirTruckPOs = [],
  vendorOptions = [],
  supplierAddressMap = {},
  vendorDeliveryCadenceMap = {},
  createdBy = null,
  employeeOptions = [],
  onSaveTheirTruckPO,
  onDeleteTheirTruckPO,
  onPageChange,
}) {
  const safeTheirTruckPOs = useMemo(
    () => (Array.isArray(theirTruckPOs) ? theirTruckPOs : []),
    [theirTruckPOs],
  );
  const safeVendorOptions = Array.isArray(vendorOptions)
    ? vendorOptions
    : [];
  const orderedByOptions = getUniqueOptions([
    ...employeeOptions,
    createdBy?.name,
  ]);
  const formRef = useRef(null);
  const [editingTheirTruckPOId, setEditingTheirTruckPOId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [orderedBy, setOrderedBy] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(getDateInputValue());
  const [isStock, setIsStock] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorDeliveryNotes, setVendorDeliveryNotes] = useState("");
  const [items, setItems] = useState([createEmptyItem()]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editingTheirTruckPO = safeTheirTruckPOs.find(
    (theirTruckPO) => theirTruckPO.id === editingTheirTruckPOId,
  );

  function clearError() {
    setError("");
  }

  function updateVendor(value) {
    setVendor(value);
    const matchedVendor = findMatchingVendor(value, safeVendorOptions);
    const address = matchedVendor
      ? getVendorAddress(matchedVendor, supplierAddressMap)
      : "";

    if (address) {
      setVendorAddress(address);
    }

    if (matchedVendor) {
      const deliveryCadence = getVendorDeliveryCadence(
        matchedVendor,
        vendorDeliveryCadenceMap,
      );

      if (deliveryCadence) {
        setVendorDeliveryNotes(deliveryCadence);
      }
    }

    clearError();
  }

  function updateItem(itemId, field, value) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
    clearError();
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
    clearError();
  }

  function removeItem(itemId) {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return [createEmptyItem()];
      }

      return currentItems.filter((item) => item.id !== itemId);
    });
    clearError();
  }

  function resetForm() {
    setEditingTheirTruckPOId("");
    setPoNumber("");
    setOrderedBy("");
    setDeliveryDate(getDateInputValue());
    setIsStock(false);
    setCustomerName("");
    setOrderNumber("");
    setVendor("");
    setVendorAddress("");
    setVendorDeliveryNotes("");
    setItems([createEmptyItem()]);
  }

  function handleEditTheirTruckPO(theirTruckPO) {
    setEditingTheirTruckPOId(theirTruckPO.id);
    setPoNumber(theirTruckPO.poNumber || "");
    setOrderedBy(theirTruckPO.orderedBy || "");
    setDeliveryDate(theirTruckPO.deliveryDate || getDateInputValue());
    setIsStock(Boolean(theirTruckPO.isStock));
    setCustomerName(theirTruckPO.customerName || "");
    setOrderNumber(theirTruckPO.orderNumber || "");
    setVendor(theirTruckPO.vendor || "");
    setVendorAddress(theirTruckPO.vendorAddress || "");
    setVendorDeliveryNotes(theirTruckPO.vendorDeliveryNotes || "");
    setItems(
      Array.isArray(theirTruckPO.items) && theirTruckPO.items.length > 0
        ? theirTruckPO.items.map((item) => ({
            id: item.id || createId(),
            quantity: item.quantity || "",
            description: item.description || "",
            internalReference: item.internalReference || "",
          }))
        : [createEmptyItem()],
    );
    setMessage("");
    setError("");

    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!/^\d{3}-\d{3}$/.test(poNumber)) {
      setError("Enter a complete six-digit PO number.");
      return;
    }

    if (!orderedBy) {
      setError("Select who ordered this PO.");
      return;
    }

    if (!deliveryDate) {
      setError("Choose the delivery date.");
      return;
    }

    if (!isStock && !customerName.trim()) {
      setError("Enter the customer name or mark this PO as stock.");
      return;
    }

    const matchedVendor = findMatchingVendor(vendor, safeVendorOptions);

    if (!matchedVendor) {
      setError("Select a vendor from the vendor list.");
      return;
    }

    const cleanItems = items
      .filter((item) => item.description.trim())
      .map((item) => ({
        id: item.id || createId(),
        quantity: item.quantity.trim(),
        description: item.description.trim(),
        internalReference: item.internalReference.trim(),
      }));

    if (cleanItems.length === 0) {
      setError("Add at least one delivery item.");
      return;
    }

    const now = new Date().toISOString();
    const savedTheirTruckPO = {
      ...editingTheirTruckPO,
      id: editingTheirTruckPO?.id || createId(),
      poNumber,
      flowType: "theirTruck",
      status: editingTheirTruckPO?.status || "scheduled",
      createdByName:
        editingTheirTruckPO?.createdByName || createdBy?.name || "",
      createdByEmail:
        editingTheirTruckPO?.createdByEmail || createdBy?.email || "",
      orderedBy,
      deliveryDate,
      isStock,
      customerName: isStock ? "" : formatCustomerName(customerName),
      orderNumber: isStock ? "" : orderNumber.trim(),
      vendor: matchedVendor,
      vendorAddress: vendorAddress.trim(),
      vendorDeliveryNotes: vendorDeliveryNotes.trim(),
      items: cleanItems,
      sentToDeliveryCalendarAt:
        editingTheirTruckPO?.sentToDeliveryCalendarAt || now,
      createdAt: editingTheirTruckPO?.createdAt || now,
      updatedAt: now,
    };

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await onSaveTheirTruckPO?.(savedTheirTruckPO);
      setMessage(
        editingTheirTruckPOId
          ? `PO ${poNumber} was updated.`
          : `PO ${poNumber} was sent to the delivery calendar for ${formatDateInput(deliveryDate)}.`,
      );
      resetForm();
    } catch (saveError) {
      console.error("Unable to save their truck PO:", saveError);
      setError(getFirebaseErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "PO's", onClick: () => onPageChange?.("south") },
          { label: "Their Truck" },
        ]}
      />

      <div className="mb-6">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-700">
          <Truck aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          Their Truck Flow
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
          Add Their Truck PO
        </h1>
        <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
          Schedule vendor-delivered POs that are not going through the South
          pickup route.
        </p>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="font-bold text-blue-800">✓ {message}</p>
        </div>
      ) : null}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {editingTheirTruckPOId ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Editing Their Truck PO
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  PO {poNumber || editingTheirTruckPO?.poNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                Cancel Edit
              </button>
            </div>
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,0.65fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  PO Details
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Reference
                </h2>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Created By
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {editingTheirTruckPO?.createdByName ||
                    editingTheirTruckPO?.createdByEmail ||
                    createdBy?.name ||
                    createdBy?.email ||
                    "Signed in user"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="their-truck-ordered-by"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Ordered By
                </label>
                <select
                  id="their-truck-ordered-by"
                  value={orderedBy}
                  onChange={(event) => {
                    setOrderedBy(event.target.value);
                    clearError();
                  }}
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
                  htmlFor="their-truck-date"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Delivery Date
                </label>
                <input
                  id="their-truck-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(event) => {
                    setDeliveryDate(event.target.value);
                    clearError();
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="their-truck-po"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  PO Number
                </label>
                <input
                  id="their-truck-po"
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  value={poNumber}
                  onChange={(event) => {
                    setPoNumber(formatPoNumber(event.target.value));
                    clearError();
                  }}
                  placeholder="123-456"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-3xl font-black tracking-[0.12em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="their-truck-customer"
                    className="block text-sm font-bold text-slate-700"
                  >
                    Customer Name
                  </label>

                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <input
                      type="checkbox"
                      checked={isStock}
                      onChange={(event) => {
                        setIsStock(event.target.checked);
                        if (event.target.checked) {
                          setCustomerName("");
                          setOrderNumber("");
                        }
                        clearError();
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Stock
                  </label>
                </div>
                <input
                  id="their-truck-customer"
                  type="text"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value.toUpperCase());
                    clearError();
                  }}
                  disabled={isStock}
                  placeholder={isStock ? "Stock PO" : "Customer name"}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div>
                <label
                  htmlFor="their-truck-order"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Order #
                </label>
                <input
                  id="their-truck-order"
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  value={orderNumber}
                  onChange={(event) => {
                    setOrderNumber(formatPoNumber(event.target.value));
                    clearError();
                  }}
                  disabled={isStock}
                  placeholder={isStock ? "Stock PO" : "Optional order #"}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
            <div className="mb-5 border-b border-blue-100 pb-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Vendor Details
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Supplier Delivery
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="their-truck-vendor"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Vendor
                </label>
                <SearchableSelect
                  id="their-truck-vendor"
                  value={vendor}
                  options={safeVendorOptions}
                  onChange={updateVendor}
                  allowCustomValue
                  placeholder="Start typing a vendor..."
                  accent="blue"
                />
              </div>

              <div>
                <label
                  htmlFor="their-truck-vendor-address"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Vendor Address
                </label>
                <input
                  id="their-truck-vendor-address"
                  type="text"
                  value={vendorAddress}
                  onChange={(event) => setVendorAddress(event.target.value)}
                  placeholder="Optional vendor address"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="their-truck-delivery-notes"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Delivery Cadence
                </label>
                <textarea
                  id="their-truck-delivery-notes"
                  value={vendorDeliveryNotes}
                  onChange={(event) => setVendorDeliveryNotes(event.target.value)}
                  rows={3}
                  placeholder="Example: M-W-F, T-Th, or usually delivers Tuesday mornings..."
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Delivery Items
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Items Coming In
              </h2>
            </div>

            <p className="text-sm font-bold text-slate-500">
              These become the receiving checklist.
            </p>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">
                    Item {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-sm font-bold text-red-500 transition hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_220px]">
                  <input
                    type="text"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.id, "quantity", event.target.value)
                    }
                    placeholder="QTY"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(event) =>
                      updateItem(item.id, "description", event.target.value)
                    }
                    placeholder="Item description"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                  <input
                    type="text"
                    value={item.internalReference}
                    onChange={(event) =>
                      updateItem(item.id, "internalReference", event.target.value)
                    }
                    placeholder="SKU / Item # / SO#"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3.5 font-bold text-slate-600 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800"
            >
              + Add Another Item
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-2xl bg-blue-700 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving
            ? editingTheirTruckPOId
              ? "Saving..."
              : "Sending..."
            : editingTheirTruckPOId
              ? "Save Their Truck PO Changes"
              : "Send To Delivery Calendar"}
        </button>
      </form>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Scheduled
            </p>
            <h2 className="text-2xl font-black text-slate-950">
              Their Truck POs
            </h2>
          </div>

          <span className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
            {safeTheirTruckPOs.length}
          </span>
        </div>

        {safeTheirTruckPOs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
            <CalendarDays
              aria-hidden="true"
              className="mx-auto h-8 w-8 text-slate-300"
            />
            <p className="mt-3 text-sm font-bold text-slate-500">
              No Their Truck POs scheduled yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {safeTheirTruckPOs.slice(0, 9).map((theirTruckPO) => (
              <article
                key={theirTruckPO.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-slate-950">
                      {theirTruckPO.poNumber}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {formatDateInput(theirTruckPO.deliveryDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-blue-700">
                    {getItemSummary(Array.isArray(theirTruckPO.items) ? theirTruckPO.items : [])}
                  </span>
                </div>

                <p className="mt-3 text-sm font-black uppercase tracking-[0.08em] text-slate-700">
                  {theirTruckPO.vendor}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {theirTruckPO.isStock
                    ? "Stock"
                    : formatCustomerName(theirTruckPO.customerName)}
                </p>
                {!theirTruckPO.isStock && theirTruckPO.orderNumber ? (
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-blue-700">
                    Order {theirTruckPO.orderNumber}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    onClick={() => handleEditTheirTruckPO(theirTruckPO)}
                    className="inline-flex items-center gap-2 text-sm font-black text-blue-700 transition hover:text-blue-900"
                  >
                    <Pencil
                      aria-hidden="true"
                      className="h-4 w-4"
                      strokeWidth={2.5}
                    />
                    Edit PO
                  </button>

                  {onDeleteTheirTruckPO ? (
                    <button
                      type="button"
                      onClick={() => onDeleteTheirTruckPO(theirTruckPO.id)}
                      className="inline-flex items-center gap-2 text-sm font-black text-red-600 transition hover:text-red-800"
                    >
                      <Trash2
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={2.5}
                      />
                      Delete PO
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
