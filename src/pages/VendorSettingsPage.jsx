import { useEffect, useState } from "react";
import {
  ContactRound,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  Plus,
  Save,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";

function createEmptyVendor(routeOrder = 1) {
  return {
    id: createId(),
    name: "",
    address: "",
    phone: "",
    contacts: [],
    deliveryCadence: "",
    routeOrder,
    active: true,
  };
}

function createEmptyVendorContact() {
  return {
    id: createId(),
    name: "",
    products: "",
    phone: "",
    email: "",
  };
}

function formatVendorPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function cleanVendorContacts(contacts) {
  return (Array.isArray(contacts) ? contacts : [])
    .map((contact) => ({
      ...contact,
      id: contact.id || createId(),
      name: String(contact.name || "").trim(),
      products: String(contact.products || "").trim(),
      phone: formatVendorPhoneNumber(contact.phone),
      email: String(contact.email || "").trim(),
    }))
    .filter(
      (contact) =>
        contact.name || contact.products || contact.phone || contact.email,
    );
}

function VendorContactsEditor({ contacts, onChange, disabled = false }) {
  const safeContacts = Array.isArray(contacts) ? contacts : [];

  function updateContact(contactId, field, value) {
    onChange(
      safeContacts.map((contact) =>
        contact.id === contactId
          ? {
              ...contact,
              [field]:
                field === "phone" ? formatVendorPhoneNumber(value) : value,
            }
          : contact,
      ),
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ContactRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-900">Product Contacts</p>
            <p className="text-xs font-semibold text-slate-500">
              Record who to call for specific products or departments.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...safeContacts, createEmptyVendorContact()])}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Contact
        </button>
      </div>

      {safeContacts.length > 0 ? (
        <div className="mt-4 space-y-3">
          {safeContacts.map((contact) => (
            <div
              key={contact.id}
              className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-[1fr_1.35fr_0.85fr_1fr_auto] xl:items-end"
            >
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Contact Name
                </span>
                <input
                  type="text"
                  value={contact.name || ""}
                  onChange={(event) =>
                    updateContact(contact.id, "name", event.target.value)
                  }
                  disabled={disabled}
                  placeholder="Jane Smith"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  <PackageSearch className="h-3.5 w-3.5" aria-hidden="true" />
                  Best For / Products
                </span>
                <input
                  type="text"
                  value={contact.products || ""}
                  onChange={(event) =>
                    updateContact(contact.id, "products", event.target.value)
                  }
                  disabled={disabled}
                  placeholder="LVL, I-joists, engineered wood"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Phone
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={contact.phone || ""}
                  onChange={(event) =>
                    updateContact(contact.id, "phone", event.target.value)
                  }
                  disabled={disabled}
                  placeholder="(208) 284-6163"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Email
                </span>
                <input
                  type="email"
                  value={contact.email || ""}
                  onChange={(event) =>
                    updateContact(contact.id, "email", event.target.value)
                  }
                  disabled={disabled}
                  placeholder="jane@supplier.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    safeContacts.filter(
                      (currentContact) => currentContact.id !== contact.id,
                    ),
                  )
                }
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-red-200 bg-white px-3 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Remove ${contact.name || "supplier contact"}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500">
          No product contacts added yet.
        </p>
      )}
    </div>
  );
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
            phone: formatVendorPhoneNumber(vendor.phone),
            contacts: cleanVendorContacts(vendor.contacts),
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
                  : field === "phone"
                    ? formatVendorPhoneNumber(value)
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
                : field === "phone"
                  ? formatVendorPhoneNumber(value)
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
      phone: formatVendorPhoneNumber(newVendorDraft?.phone),
      contacts: cleanVendorContacts(newVendorDraft?.contacts),
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
        phone: formatVendorPhoneNumber(vendor.phone),
        contacts: cleanVendorContacts(vendor.contacts),
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
          Manage supplier details, product contacts, delivery cadence, and default South route order.
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[90px_minmax(170px,0.8fr)_minmax(230px,1.1fr)_minmax(145px,0.65fr)_minmax(145px,0.65fr)_auto] xl:items-end">
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
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Main Phone
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={vendor.phone || ""}
                    onChange={(event) =>
                      updateVendor(vendor.id, "phone", event.target.value)
                    }
                    disabled={isSaving}
                    placeholder="(208) 284-6163"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
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

              <VendorContactsEditor
                contacts={vendor.contacts}
                disabled={isSaving}
                onChange={(contacts) =>
                  updateVendor(vendor.id, "contacts", contacts)
                }
              />
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
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
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

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Main Phone
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={newVendorDraft.phone || ""}
                  onChange={(event) =>
                    updateNewVendor("phone", event.target.value)
                  }
                  disabled={isSaving}
                  placeholder="(208) 284-6163"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </label>

              <label className="block">
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
            </div>

            <VendorContactsEditor
              contacts={newVendorDraft.contacts}
              disabled={isSaving}
              onChange={(contacts) => updateNewVendor("contacts", contacts)}
            />

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
