import { useState } from "react";
import {
  ChevronDown,
  HelpCircle,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import AddressAutocompleteInput from "../components/AddressAutocompleteInput";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";

function createEmptyContact() {
  return {
    id: createId(),
    label: "",
    name: "",
    phone: "",
    email: "",
  };
}

function createDefaultContacts() {
  return [createEmptyContact()];
}

const customerTypeOptions = [
  { value: "current", label: "Current Customer" },
  { value: "prospect", label: "Prospect" },
];

function getCustomerType(customer) {
  return customer.customerType === "prospect" ? "prospect" : "current";
}

function getCustomerTypeLabel(customerType) {
  return customerType === "prospect" ? "Prospect" : "Current Customer";
}

function getCustomerTypeBadgeClass(customerType) {
  return customerType === "prospect"
    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
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

function getPlaceComponent(place, type, useShortName = false) {
  const component = place?.address_components?.find((addressComponent) =>
    addressComponent.types?.includes(type),
  );

  return useShortName ? component?.short_name || "" : component?.long_name || "";
}

function getStreetAddressFromPlace(place, fallbackAddress) {
  const streetNumber = getPlaceComponent(place, "street_number");
  const route = getPlaceComponent(place, "route");

  return [streetNumber, route].filter(Boolean).join(" ") || fallbackAddress;
}

function customerMatchesSearch(customer, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableText = [
    customer.name,
    customer.companyName,
    customer.accountNumber,
    customer.email,
    customer.website,
    getCustomerTypeLabel(getCustomerType(customer)),
    customer.address,
    customer.streetAddress,
    customer.city,
    customer.state,
    customer.zip,
    ...(Array.isArray(customer.contacts)
      ? customer.contacts.flatMap((contact) => [
          contact.label,
          contact.name,
          contact.phone,
          contact.email,
        ])
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
}

export default function CustomersPage({
  mode = "view",
  customers,
  onAddCustomer,
  onUpdateCustomer,
  onPageChange,
}) {
  const savedCustomers = Array.isArray(customers) ? customers : [];
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [customerType, setCustomerType] = useState("current");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [contacts, setContacts] = useState(createDefaultContacts);
  const [needsPaymentLink, setNeedsPaymentLink] = useState(false);
  const [paymentLinkContactId, setPaymentLinkContactId] = useState("");
  const [paymentLinkNotes, setPaymentLinkNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [openContactCustomerIds, setOpenContactCustomerIds] = useState({});
  const customerTypeCounts = savedCustomers.reduce(
    (counts, customer) => {
      const type = getCustomerType(customer);

      return {
        ...counts,
        [type]: counts[type] + 1,
      };
    },
    { current: 0, prospect: 0 },
  );
  const filteredCustomers = savedCustomers.filter((customer) => {
    const matchesType =
      customerTypeFilter === "all" ||
      getCustomerType(customer) === customerTypeFilter;

    return matchesType && customerMatchesSearch(customer, searchTerm);
  });

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function applyGooglePlaceAddress(place, fallbackAddress) {
    const nextStreetAddress = getStreetAddressFromPlace(place, fallbackAddress);
    const nextCity =
      getPlaceComponent(place, "locality") ||
      getPlaceComponent(place, "postal_town") ||
      getPlaceComponent(place, "administrative_area_level_2");
    const nextState = getPlaceComponent(
      place,
      "administrative_area_level_1",
      true,
    );
    const nextZip = getPlaceComponent(place, "postal_code");

    setStreetAddress(nextStreetAddress);
    setCity(nextCity);
    setState(nextState);
    setZip(nextZip);
    clearFeedback();
  }

  function updateContact(contactId, field, value) {
    setContacts((currentContacts) =>
      currentContacts.map((contact) =>
        contact.id === contactId
          ? {
              ...contact,
              [field]: field === "phone" ? formatPhoneNumber(value) : value,
            }
          : contact,
      ),
    );
    clearFeedback();
  }

  function addContact() {
    setContacts((currentContacts) => [
      ...currentContacts,
      createEmptyContact(),
    ]);
    clearFeedback();
  }

  function removeContact(contactId) {
    setContacts((currentContacts) => {
      if (currentContacts.length <= 1) {
        return [createEmptyContact()];
      }

      return currentContacts.filter(
        (contact) => contact.id !== contactId,
      );
    });
    clearFeedback();
  }

  function resetForm() {
    setName("");
    setCompanyName("");
    setAccountNumber("");
    setCustomerType("current");
    setEmail("");
    setWebsite("");
    setStreetAddress("");
    setCity("");
    setState("");
    setZip("");
    setContacts(createDefaultContacts());
    setNeedsPaymentLink(false);
    setPaymentLinkContactId("");
    setPaymentLinkNotes("");
    setEditingCustomerId("");
  }

  function startEditingCustomer(customer) {
    setEditingCustomerId(customer.id);
    setName(customer.name || "");
    setCompanyName(customer.companyName || "");
    setAccountNumber(customer.accountNumber || "");
    setCustomerType(getCustomerType(customer));
    setEmail(customer.email || "");
    setWebsite(customer.website || "");
    setStreetAddress(
      customer.streetAddress || customer.address || "",
    );
    setCity(customer.city || "");
    setState(customer.state || "");
    setZip(customer.zip || "");
    setNeedsPaymentLink(Boolean(customer.needsPaymentLink));
    setPaymentLinkContactId(customer.paymentLinkContactId || "");
    setPaymentLinkNotes(customer.paymentLinkNotes || "");
    setContacts(
      Array.isArray(customer.contacts) && customer.contacts.length > 0
        ? customer.contacts.map((contact) => ({
            id: contact.id || createId(),
            label: contact.label || "",
            name: contact.name || "",
            phone: contact.phone || "",
            email: contact.email || "",
          }))
        : createDefaultContacts(),
    );
    setMessage("");
    setError("");
  }

  function cancelEditingCustomer() {
    resetForm();
    setMessage("");
    setError("");
  }

  function toggleCustomerContacts(customerId) {
    setOpenContactCustomerIds((currentOpenContactCustomerIds) => ({
      ...currentOpenContactCustomerIds,
      [customerId]: !currentOpenContactCustomerIds[customerId],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!name.trim() && !companyName.trim()) {
      setError("Enter a customer name or company name.");
      return;
    }

    const savedContacts = contacts
      .map((contact) => ({
        id: contact.id,
        label: contact.label.trim(),
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim(),
      }))
      .filter(
        (contact) =>
          contact.label ||
          contact.name ||
          contact.phone ||
          contact.email,
      );
    const customerUpdates = {
      name: name.trim(),
      companyName: companyName.trim(),
      accountNumber: accountNumber.trim(),
      customerType,
      email: email.trim(),
      website: website.trim(),
      streetAddress: streetAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      address: [
        streetAddress.trim(),
        city.trim(),
        state.trim(),
        zip.trim(),
      ]
        .filter(Boolean)
        .join(", "),
      contacts: savedContacts,
      needsPaymentLink,
      paymentLinkContactId:
        needsPaymentLink && paymentLinkContactId ? paymentLinkContactId : "",
      paymentLinkNotes: needsPaymentLink ? paymentLinkNotes.trim() : "",
    };

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (editingCustomerId) {
        await onUpdateCustomer(editingCustomerId, customerUpdates);
        setMessage(
          `${
            customerUpdates.companyName || customerUpdates.name
          } was updated.`,
        );
      } else {
        const now = new Date().toISOString();
        const customer = {
          id: createId(),
          ...customerUpdates,
          createdAt: now,
          updatedAt: now,
        };

        await onAddCustomer(customer);
        setMessage(
          `${customer.companyName || customer.name} was added to Customers.`,
        );
      }
      resetForm();
    } catch (submitError) {
      console.error("Unable to save customer:", submitError);
      setError(getFirebaseErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Sales", onClick: () => onPageChange?.("sales") },
          {
            label: editingCustomerId
              ? "Edit Customer"
              : mode === "add"
                ? "Add Customer"
                : "View Customers",
          },
        ]}
      />

      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
              Sales
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
              {editingCustomerId
                ? "Edit Customer"
                : mode === "add"
                  ? "Add Customer"
                  : "View Customers"}
            </h1>

            <p className="mt-2 text-lg text-slate-500">
              {editingCustomerId
                ? "Update customer details and contacts."
                : mode === "add"
                  ? "Add customer account details and contacts for future order links."
                  : "Search current customers and prospects by name, company, account number, email, address, or contact."}
            </p>
          </div>

          {mode !== "add" && !editingCustomerId ? (
            <button
              type="button"
              onClick={() => onPageChange?.("customers-add")}
              className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
            >
              <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
              Add Customer
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {mode === "add" || editingCustomerId ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="Customer name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Company Name
              </span>
              <input
                type="text"
                value={companyName}
                onChange={(event) => {
                  setCompanyName(event.target.value);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="Company"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700">
                Account #
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-slate-700 focus:text-slate-700 focus:outline-none"
                    aria-label="Spruce Account Number"
                  >
                    <HelpCircle
                      aria-hidden="true"
                      className="h-4 w-4"
                      strokeWidth={2.4}
                    />
                  </button>

                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white shadow-lg group-focus-within:block group-hover:block">
                    Spruce Account Number
                  </span>
                </span>
              </span>
              <input
                type="text"
                value={accountNumber}
                onChange={(event) => {
                  setAccountNumber(event.target.value);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="Account number"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Customer Type
              </span>
              <select
                value={customerType}
                onChange={(event) => {
                  setCustomerType(event.target.value);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              >
                {customerTypeOptions.map((customerTypeOption) => (
                  <option
                    key={customerTypeOption.value}
                    value={customerTypeOption.value}
                  >
                    {customerTypeOption.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="customer@example.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Website
              </span>
              <input
                type="text"
                inputMode="url"
                value={website}
                onChange={(event) => {
                  setWebsite(event.target.value);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="kingbuilding.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_140px_140px]">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Street Address
              </span>
              <AddressAutocompleteInput
                value={streetAddress}
                onChange={(nextStreetAddress) => {
                  setStreetAddress(nextStreetAddress);
                  clearFeedback();
                }}
                onPlaceSelected={applyGooglePlaceAddress}
                disabled={isSubmitting}
                placeholder="Street address"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                City
              </span>
              <input
                type="text"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="Boise"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                State
              </span>
              <input
                type="text"
                value={state}
                onChange={(event) => {
                  setState(event.target.value.toUpperCase().slice(0, 2));
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="ID"
                maxLength={2}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold uppercase text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Zip
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={zip}
                onChange={(event) => {
                  setZip(event.target.value.replace(/\D/g, "").slice(0, 10));
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="83703"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>
          </div>

          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Contacts
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Start with one contact and add more as needed.
                </p>
              </div>

              <button
                type="button"
                onClick={addContact}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <Plus
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.4}
                />
                Add Contact
              </button>
            </div>

            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(160px,0.8fr)_minmax(0,1fr)_220px_minmax(220px,1fr)_auto]"
                >
                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Contact Type
                    </span>
                    <input
                      type="text"
                      value={contact.label}
                      onChange={(event) =>
                        updateContact(
                          contact.id,
                          "label",
                          event.target.value,
                        )
                      }
                      disabled={isSubmitting}
                      placeholder="Accounts Payable"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Name
                    </span>
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(event) =>
                        updateContact(
                          contact.id,
                          "name",
                          event.target.value,
                        )
                      }
                      disabled={isSubmitting}
                      placeholder="Contact name"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Phone
                    </span>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={contact.phone}
                      onChange={(event) =>
                        updateContact(
                          contact.id,
                          "phone",
                          event.target.value,
                        )
                      }
                      disabled={isSubmitting}
                      placeholder="(208) 555-1234"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Email
                    </span>
                    <input
                      type="email"
                      value={contact.email}
                      onChange={(event) =>
                        updateContact(
                          contact.id,
                          "email",
                          event.target.value,
                        )
                      }
                      disabled={isSubmitting}
                      placeholder="ap@example.com"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => removeContact(contact.id)}
                    disabled={isSubmitting}
                    className="self-end rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={needsPaymentLink}
                onChange={(event) => {
                  setNeedsPaymentLink(event.target.checked);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-[#FC2C38] focus:ring-red-200"
              />

              <span>
                <span className="block text-base font-black text-slate-900">
                  Needs monthly payment link
                </span>
                <span className="mt-1 block text-sm font-semibold text-slate-500">
                  Include this customer on the monthly payment link checklist.
                </span>
              </span>
            </label>

            {needsPaymentLink ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Payment Link Contact
                  </span>
                  <select
                    value={paymentLinkContactId}
                    onChange={(event) => {
                      setPaymentLinkContactId(event.target.value);
                      clearFeedback();
                    }}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  >
                    <option value="">Use main customer email</option>
                    {contacts
                      .filter(
                        (contact) =>
                          contact.name ||
                          contact.label ||
                          contact.email,
                      )
                      .map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {[
                            contact.label,
                            contact.name,
                            contact.email,
                          ]
                            .filter(Boolean)
                            .join(" - ")}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Payment Link Notes
                  </span>
                  <input
                    type="text"
                    value={paymentLinkNotes}
                    onChange={(event) => {
                      setPaymentLinkNotes(event.target.value);
                      clearFeedback();
                    }}
                    disabled={isSubmitting}
                    placeholder="Send to AP, monthly statement, etc."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {editingCustomerId ? (
              <button
                type="button"
                onClick={cancelEditingCustomer}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 bg-white px-6 py-4 text-lg font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 sm:w-48"
              >
                Cancel
              </button>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#FC2C38] px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting
                ? "Saving Customer..."
                : editingCustomerId
                  ? "Update Customer"
                  : "Save Customer"}
            </button>
          </div>
        </form>
      ) : (
        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {[
                {
                  value: "all",
                  label: "All",
                  count: savedCustomers.length,
                },
                {
                  value: "current",
                  label: "Current",
                  count: customerTypeCounts.current,
                },
                {
                  value: "prospect",
                  label: "Prospects",
                  count: customerTypeCounts.prospect,
                },
              ].map((filterOption) => {
                const isActive = customerTypeFilter === filterOption.value;

                return (
                  <button
                    key={filterOption.value}
                    type="button"
                    onClick={() => setCustomerTypeFilter(filterOption.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-black transition sm:px-4 ${
                      isActive
                        ? "border-[#FC2C38] bg-red-50 text-[#FC2C38]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {filterOption.label}{" "}
                    <span className="text-xs opacity-75">
                      {filterOption.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Search Customers
              </span>
              <span className="relative block">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.4}
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, company, account #, email, address, contact, or phone"
                  className="w-full rounded-xl border border-slate-300 py-4 pl-12 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </span>
            </label>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                <UsersRound
                  aria-hidden="true"
                  className="h-7 w-7"
                  strokeWidth={2.4}
                />
              </div>

              <h2 className="mt-4 text-xl font-black text-slate-900">
                No customers found
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
                Add a customer or try a different search.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredCustomers.map((customer) => {
                const hasContacts =
                  Array.isArray(customer.contacts) &&
                  customer.contacts.length > 0;
                const contactsAreOpen =
                  Boolean(openContactCustomerIds[customer.id]);
                const type = getCustomerType(customer);

                return (
                  <article
                    key={customer.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                        {customer.accountNumber ? (
                          <span className="inline-flex items-center gap-1.5">
                            Account # {customer.accountNumber}
                            <span className="group relative inline-flex">
                              <button
                                type="button"
                                className="text-[#FC2C38]/70 transition hover:text-[#FC2C38] focus:text-[#FC2C38] focus:outline-none"
                                aria-label="Spruce Account Number"
                              >
                                <HelpCircle
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5"
                                  strokeWidth={2.4}
                                />
                              </button>

                              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-black normal-case tracking-normal text-white shadow-lg group-focus-within:block group-hover:block">
                                Spruce Account Number
                              </span>
                            </span>
                          </span>
                        ) : (
                          "Customer"
                        )}
                      </p>

                      <h2 className="mt-1 truncate text-2xl font-black text-slate-900">
                        {customer.companyName ||
                          customer.name ||
                          "Unnamed Customer"}
                      </h2>

                      <p
                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${getCustomerTypeBadgeClass(
                          type,
                        )}`}
                      >
                        {getCustomerTypeLabel(type)}
                      </p>

                      {customer.name && customer.companyName ? (
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {customer.name}
                        </p>
                      ) : null}

                      {customer.email ? (
                        <p className="mt-2 text-sm font-bold text-slate-600">
                          {customer.email}
                        </p>
                      ) : null}

                      {customer.website ? (
                        <p className="mt-1 text-sm font-bold text-slate-600">
                          {customer.website}
                        </p>
                      ) : null}

                      {customer.needsPaymentLink ? (
                        <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                          Monthly Payment Link
                        </p>
                      ) : null}

                      {customer.streetAddress ||
                      customer.city ||
                      customer.state ||
                      customer.zip ||
                      customer.address ? (
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {[
                            customer.streetAddress || customer.address,
                            customer.city,
                            customer.state,
                            customer.zip,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => startEditingCustomer(customer)}
                      className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => toggleCustomerContacts(customer.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                        aria-expanded={contactsAreOpen}
                      >
                        <span>
                          <span className="block text-sm font-black text-slate-900">
                            Contacts
                          </span>
                          <span className="mt-0.5 block text-xs font-bold text-slate-500">
                            {hasContacts
                              ? `${customer.contacts.length} saved contact${
                                  customer.contacts.length === 1 ? "" : "s"
                                }`
                              : "No contacts saved"}
                          </span>
                        </span>

                        <ChevronDown
                          aria-hidden="true"
                          className={`h-5 w-5 text-slate-500 transition-transform ${
                            contactsAreOpen ? "rotate-180" : ""
                          }`}
                          strokeWidth={2.6}
                        />
                      </button>

                      {contactsAreOpen ? (
                        <div className="mt-2 space-y-2">
                          {hasContacts ? (
                            customer.contacts.map((contact) => (
                              <div
                                key={contact.id}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                              >
                                {contact.label ? (
                                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                                    {contact.label}
                                  </p>
                                ) : null}

                                <p className="font-black text-slate-900">
                                  {contact.name || "No contact name"}
                                </p>

                                <p className="mt-1 text-sm font-bold text-slate-500">
                                  {contact.phone || "No phone listed"}
                                </p>

                                {contact.email ? (
                                  <p className="mt-1 text-sm font-bold text-slate-500">
                                    {contact.email}
                                  </p>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-500">
                              No contacts saved.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </PageContainer>
  );
}
