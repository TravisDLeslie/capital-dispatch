import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Package,
  Plus,
  ReceiptText,
  Trash2,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import SearchableSelect from "../components/SearchableSelect";

function formatPONumberInput(value) {
  const digitsOnly = String(value || "").replace(/\D/g, "").slice(0, 6);

  if (digitsOnly.length <= 3) {
    return digitsOnly;
  }

  return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
}

function getDateInputValue() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;

  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

const methodOptions = {
  pickup: {
    label: "We Pick Up",
    description: "Send this stock PO to South dispatch.",
    icon: Truck,
    activeClass: "border-[#FC2C38] bg-red-50 text-[#FC2C38]",
  },
  supplierDelivery: {
    label: "They Deliver",
    description: "Track this stock PO as a supplier truck inbound.",
    icon: Package,
    activeClass: "border-blue-500 bg-blue-50 text-blue-700",
  },
};

export default function PurchaseOrdersPage({
  currentUser,
  vendorOptions = [],
  supplierAddressMap = {},
  onCreatePurchaseOrder,
  onPageChange,
}) {
  const [method, setMethod] = useState("pickup");
  const [poNumber, setPoNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [expectedDate, setExpectedDate] = useState(getDateInputValue());
  const [notes, setNotes] = useState("");
  const [draftItem, setDraftItem] = useState({
    quantity: "",
    description: "",
    sku: "",
  });
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const selectedVendorAddress = useMemo(
    () => supplierAddressMap[vendor] || "",
    [supplierAddressMap, vendor],
  );
  const MethodIcon = methodOptions[method].icon;

  function handleSaveDraftItem() {
    const quantity = draftItem.quantity.trim();
    const description = draftItem.description.trim();
    const sku = draftItem.sku.trim();

    if (!quantity || !description) {
      setErrorMessage("Add a quantity and item description before saving the item.");
      return;
    }

    setItems((currentItems) => [
      ...currentItems,
      {
        id: `${Date.now()}-${currentItems.length}`,
        quantity,
        description,
        sku,
      },
    ]);
    setDraftItem({ quantity: "", description: "", sku: "" });
    setErrorMessage("");
  }

  function handleRemoveItem(itemId) {
    setItems((currentItems) =>
      currentItems.filter((currentItem) => currentItem.id !== itemId),
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSuccessMessage("");

    const cleanPoNumber = formatPONumberInput(poNumber);
    const cleanVendor = vendor.trim();

    if (cleanPoNumber.length !== 7) {
      setErrorMessage("Enter a full 6 digit PO number.");
      return;
    }

    if (!cleanVendor) {
      setErrorMessage("Choose the vendor for this purchase order.");
      return;
    }

    if (items.length === 0) {
      setErrorMessage("Save at least one stocked item for this PO.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await onCreatePurchaseOrder?.({
        method,
        poNumber: cleanPoNumber,
        vendor: cleanVendor,
        vendorAddress: selectedVendorAddress,
        expectedDate,
        notes: notes.trim(),
        items,
      });

      setPoNumber("");
      setVendor("");
      setNotes("");
      setItems([]);
      setSuccessMessage(
        method === "pickup"
          ? "Stock PO sent to New Flow South."
          : "Stock PO sent to New Flow Their Truck.",
      );
    } catch (error) {
      setErrorMessage(error?.message || "Unable to create this purchase order.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer className="max-w-[92rem]">
      <Breadcrumbs
        items={[
          { label: "New Home", onClick: () => onPageChange?.("new-home") },
          { label: "Purchasing" },
          { label: "Purchase Orders" },
        ]}
      />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Stock Replenishment
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Purchase Orders
          </h1>
          <p className="mt-3 max-w-3xl text-lg font-bold text-slate-500">
            Create stocked-item POs and choose whether we pick them up or the vendor delivers.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 shadow-sm">
          Created by{" "}
          <span className="text-slate-950">{currentUser?.name || "Current user"}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(methodOptions).map(([methodKey, option]) => {
              const Icon = option.icon;
              const isActive = method === methodKey;

              return (
                <button
                  key={methodKey}
                  type="button"
                  onClick={() => setMethod(methodKey)}
                  className={`flex min-h-28 items-center gap-4 rounded-2xl border p-4 text-left transition ${
                    isActive
                      ? option.activeClass
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xl font-black text-slate-950">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-sm font-bold opacity-80">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  PO Details
                </p>
                <h2 className="text-2xl font-black text-slate-950">
                  Stock PO
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-black text-slate-700">
                PO Number
                <input
                  value={poNumber}
                  onChange={(event) =>
                    setPoNumber(formatPONumberInput(event.target.value))
                  }
                  inputMode="numeric"
                  placeholder="441-185"
                  className="mt-2 h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg font-black text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </label>

              <label className="text-sm font-black text-slate-700">
                {method === "pickup" ? "Pickup Date" : "Expected Delivery Date"}
                <div className="relative mt-2">
                  <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(event) => setExpectedDate(event.target.value)}
                    className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-lg font-black text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </div>
              </label>
            </div>

            <label className="mt-4 block text-sm font-black text-slate-700">
              Vendor
              <SearchableSelect
                id="stock-po-vendor"
                value={vendor}
                options={vendorOptions}
                onChange={setVendor}
                placeholder="Start typing a vendor..."
                allowCustomValue
                accent={method === "pickup" ? "red" : "blue"}
                className="mt-2"
              />
            </label>

            {selectedVendorAddress ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
                {selectedVendorAddress}
              </div>
            ) : null}

            <label className="mt-4 block text-sm font-black text-slate-700">
              Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes for receiving or dispatch..."
                className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white p-4 text-base font-semibold text-slate-900 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </label>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                  Stocked Items
                </p>
                <h2 className="text-2xl font-black text-slate-950">
                  Add Items
                </h2>
              </div>
              <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[0.25fr_1fr_0.5fr_auto] sm:items-end">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                QTY
                <input
                  value={draftItem.quantity}
                  onChange={(event) =>
                    setDraftItem((currentItem) => ({
                      ...currentItem,
                      quantity: event.target.value,
                    }))
                  }
                  placeholder="10"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </label>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Item Description
                <input
                  value={draftItem.description}
                  onChange={(event) =>
                    setDraftItem((currentItem) => ({
                      ...currentItem,
                      description: event.target.value,
                    }))
                  }
                  placeholder='2x6-16 #2 Doug Fir'
                  className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </label>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Item #
                <input
                  value={draftItem.sku}
                  onChange={(event) =>
                    setDraftItem((currentItem) => ({
                      ...currentItem,
                      sku: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </label>
              <button
                type="button"
                onClick={handleSaveDraftItem}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Save Item
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">
                  Save one stocked item at a time. These will become the receiving checklist.
                </div>
              ) : (
                items.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-black text-slate-950">
                        QTY {item.quantity} · {item.description}
                      </p>
                      {item.sku ? (
                        <p className="text-sm font-bold text-slate-500">
                          Item # {item.sku}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-black text-[#FC2C38]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {successMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl bg-[#FC2C38] px-6 text-lg font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MethodIcon className="h-5 w-5" aria-hidden="true" />
          {isSaving ? "Creating PO..." : "Create Stock Purchase Order"}
        </button>
      </form>
    </PageContainer>
  );
}
