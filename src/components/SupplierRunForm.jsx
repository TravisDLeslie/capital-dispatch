import { useState } from "react";
import { vendors } from "../data/options";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";

function createEmptyPickupItem() {
  return {
    id: createId(),
    description: "",
    pickedUp: false,
  };
}

function formatPoNumber(value) {
  const numbersOnly = value.replace(/\D/g, "").slice(0, 6);

  if (numbersOnly.length > 3) {
    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
  }

  return numbersOnly;
}

function findMatchingVendor(value) {
  return vendors.find(
    (vendor) => vendor.toLowerCase() === value.trim().toLowerCase(),
  );
}

export default function SupplierRunForm({ onSubmit }) {
  const [poNumber, setPoNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [items, setItems] = useState([createEmptyPickupItem()]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearError() {
    setError("");
  }

  function updateItem(itemId, description) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              description,
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
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return [createEmptyPickupItem()];
      }

      return currentItems.filter((item) => item.id !== itemId);
    });

    clearError();
  }

  function resetForm() {
    setPoNumber("");
    setVendor("");
    setItems([createEmptyPickupItem()]);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!/^\d{3}-\d{3}$/.test(poNumber)) {
      setError("Enter a complete six-digit PO number.");
      return;
    }

    const matchedVendor = findMatchingVendor(vendor);

    if (!matchedVendor) {
      setError("Select a vendor from the vendor list.");
      return;
    }

    const pickupItems = items
      .filter((item) => item.description.trim())
      .map((item) => ({
        id: item.id,
        description: item.description.trim(),
        pickedUp: false,
      }));

    if (pickupItems.length === 0) {
      setError("Add at least one item for the driver to pick up.");
      return;
    }

    const now = new Date().toISOString();
    const supplierRun = {
      id: createId(),
      poNumber,
      vendor: matchedVendor,
      items: pickupItems,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };

    setIsSubmitting(true);

    try {
      await onSubmit(supplierRun);
      resetForm();
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
          Driver Pickup
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Add Supplier Run
        </h2>

        <p className="mt-2 text-slate-500">
          Add the PO, supplier, and items before the driver leaves
          or while they are already on the road.
        </p>
      </div>

      <div className="space-y-7">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
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
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-2xl font-black tracking-[0.15em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </div>

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
              onChange={(event) => {
                setVendor(event.target.value);
                clearError();
              }}
              disabled={isSubmitting}
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 md:hidden"
            >
              <option value="">Select a vendor...</option>

              {vendors.map((vendorOption) => (
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
              onChange={(event) => {
                setVendor(event.target.value);
                clearError();
              }}
              disabled={isSubmitting}
              placeholder="Start typing a vendor..."
              aria-label="Vendor"
              className="hidden w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 md:block"
            />

            <datalist id="supplier-run-vendor-options">
              {vendors.map((vendorOption) => (
                <option
                  key={vendorOption}
                  value={vendorOption}
                />
              ))}
            </datalist>
          </div>
        </div>

        <section>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-700">
              Pickup Items
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              These become the driver checklist.
            </p>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">
                    Item {index + 1}
                  </h4>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={isSubmitting}
                    className="text-sm font-semibold text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>

                <input
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-black text-white shadow-md transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Saving Run..." : "Send to Driver"}
        </button>
      </div>
    </form>
  );
}
