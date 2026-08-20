import { useEffect, useState } from "react";
import { MapPin, Plus, Save, Trash2, Warehouse, X } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";

function createEmptyVendor(routeOrder = 1) {
  return {
    id: createId(),
    name: "",
    address: "",
    deliveryCadence: "",
    routeOrder,
    active: true,
  };
}

export default function VendorSettingsPage({
  vendorSettings,
  onSaveVendorSettings,
  onPageChange,
}) {
  const [draftVendors, setDraftVendors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newVendorDraft, setNewVendorDraft] = useState(null);

  useEffect(() => {
    setDraftVendors(
      Array.isArray(vendorSettings?.vendors)
        ? vendorSettings.vendors.map((vendor, index) => ({
            ...vendor,
            id: vendor.id || createId(),
            routeOrder: Number(vendor.routeOrder) || index + 1,
            deliveryCadence: vendor.deliveryCadence || "",
            active: vendor.active !== false,
          }))
        : [],
    );
  }, [vendorSettings]);

  function updateVendor(vendorId, field, value) {
    setDraftVendors((currentVendors) =>
      currentVendors.map((vendor) =>
        vendor.id === vendorId
          ? {
              ...vendor,
              [field]:
                field === "routeOrder"
                  ? value.replace(/\D/g, "").slice(0, 3)
                  : value,
            }
          : vendor,
      ),
    );
    setMessage("");
    setError("");
  }

  function addVendor() {
    setNewVendorDraft(createEmptyVendor(draftVendors.length + 1));
    setMessage("");
    setError("");
  }

  function updateNewVendor(field, value) {
    setNewVendorDraft((currentVendor) =>
      currentVendor
        ? {
            ...currentVendor,
            [field]:
              field === "routeOrder"
                ? value.replace(/\D/g, "").slice(0, 3)
                : value,
          }
        : currentVendor,
    );
    setMessage("");
    setError("");
  }

  function saveNewVendor() {
    const cleanVendor = {
      ...newVendorDraft,
      name: String(newVendorDraft?.name || "").trim(),
      address: String(newVendorDraft?.address || "").trim(),
      deliveryCadence: String(newVendorDraft?.deliveryCadence || "").trim(),
      routeOrder:
        Number(newVendorDraft?.routeOrder) || draftVendors.length + 1,
      active: true,
    };

    if (!cleanVendor.name) {
      setError("Enter the vendor name before adding it.");
      return;
    }

    setDraftVendors((currentVendors) => [...currentVendors, cleanVendor]);
    setNewVendorDraft(null);
    setMessage("Vendor added. Save vendor settings when you are ready.");
    setError("");
  }

  function deleteVendor(vendorId) {
    setDraftVendors((currentVendors) =>
      currentVendors.filter((vendor) => vendor.id !== vendorId),
    );
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanVendors = draftVendors
      .map((vendor, index) => ({
        ...vendor,
        name: String(vendor.name || "").trim(),
        address: String(vendor.address || "").trim(),
        deliveryCadence: String(vendor.deliveryCadence || "").trim(),
        routeOrder: Number(vendor.routeOrder) || index + 1,
        active: vendor.active !== false,
      }))
      .filter((vendor) => vendor.name);

    if (cleanVendors.length === 0) {
      setError("Add at least one vendor.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      await onSaveVendorSettings({
        ...vendorSettings,
        vendors: cleanVendors,
      });
      setMessage("Vendor settings saved.");
    } catch (saveError) {
      console.error("Unable to save vendor settings:", saveError);
      setError(getFirebaseErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Admin", onClick: () => onPageChange?.("admin") },
          { label: "Vendor Settings" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Admin
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Vendor Settings
        </h1>

        <p className="mt-2 max-w-3xl text-base font-semibold text-slate-500 sm:text-lg">
          Manage supplier names, addresses, delivery cadence, and default South route order.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
              <Warehouse className="h-6 w-6" aria-hidden="true" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900">
                Suppliers
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                These feed Receiving, South, and delivery origin dropdowns.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={addVendor}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white transition hover:bg-red-600"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Vendor
          </button>
        </div>

        <div className="space-y-3">
          {draftVendors.map((vendor, index) => (
            <section
              key={vendor.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="grid gap-3 lg:grid-cols-[90px_minmax(180px,0.8fr)_minmax(260px,1.2fr)_minmax(160px,0.7fr)_auto] lg:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Order
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={vendor.routeOrder || index + 1}
                    onChange={(event) =>
                      updateVendor(vendor.id, "routeOrder", event.target.value)
                    }
                    disabled={isSaving}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Vendor Name
                  </span>
                  <input
                    type="text"
                    value={vendor.name}
                    onChange={(event) =>
                      updateVendor(vendor.id, "name", event.target.value)
                    }
                    disabled={isSaving}
                    placeholder="Boise Cascade"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Address
                  </span>
                  <input
                    type="text"
                    value={vendor.address}
                    onChange={(event) =>
                      updateVendor(vendor.id, "address", event.target.value)
                    }
                    disabled={isSaving}
                    placeholder="4300 S Enterprise St, Boise, ID 83705"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Delivery Cadence
                  </span>
                  <input
                    type="text"
                    value={vendor.deliveryCadence || ""}
                    onChange={(event) =>
                      updateVendor(
                        vendor.id,
                        "deliveryCadence",
                        event.target.value,
                      )
                    }
                    disabled={isSaving}
                    placeholder="M-W-F"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => deleteVendor(vendor.id)}
                  disabled={isSaving || draftVendors.length <= 1}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remove
                </button>
              </div>
            </section>
          ))}
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSaving}
          className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-base font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save className="h-5 w-5" aria-hidden="true" />
          {isSaving ? "Saving..." : "Save Vendor Settings"}
        </button>
      </form>

      {newVendorDraft ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-4 py-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Add Vendor
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  New Supplier
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Add the vendor details here, then save vendor settings.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewVendorDraft(null);
                  setError("");
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                aria-label="Close add vendor"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Route Order
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newVendorDraft.routeOrder || ""}
                  onChange={(event) =>
                    updateNewVendor("routeOrder", event.target.value)
                  }
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Vendor Name
                </span>
                <input
                  type="text"
                  value={newVendorDraft.name}
                  onChange={(event) =>
                    updateNewVendor("name", event.target.value)
                  }
                  disabled={isSaving}
                  placeholder="Boise Cascade"
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Address
              </span>
              <input
                type="text"
                value={newVendorDraft.address}
                onChange={(event) =>
                  updateNewVendor("address", event.target.value)
                }
                disabled={isSaving}
                placeholder="4300 S Enterprise St, Boise, ID 83705"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Delivery Cadence
              </span>
              <input
                type="text"
                value={newVendorDraft.deliveryCadence || ""}
                onChange={(event) =>
                  updateNewVendor("deliveryCadence", event.target.value)
                }
                disabled={isSaving}
                placeholder="M-W-F"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </label>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setNewVendorDraft(null);
                  setError("");
                }}
                className="min-h-[52px] rounded-xl border border-slate-300 bg-white px-5 text-base font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNewVendor}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 text-base font-black text-white shadow-sm transition hover:bg-red-600"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
                Add Vendor
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
