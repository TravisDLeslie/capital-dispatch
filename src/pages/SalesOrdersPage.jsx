import { useMemo, useState } from "react";
import {
  ClipboardList,
  Link2,
  Phone,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";
import { formatCustomerName } from "../utils/textFormatters";

function formatOrderNumber(value) {
  const numbersOnly = String(value || "").replace(/\D/g, "").slice(0, 6);

  if (numbersOnly.length > 3) {
    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
  }

  return numbersOnly;
}

function formatPoNumber(value) {
  return formatOrderNumber(value);
}

function normalizeSearch(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function getCustomerDisplayName(customer) {
  return formatCustomerName(customer.companyName || customer.name) || "UNNAMED CUSTOMER";
}

function getPrimaryPhone(customer) {
  if (customer.phone) {
    return customer.phone;
  }

  const contacts = Array.isArray(customer.contacts) ? customer.contacts : [];
  return contacts.find((contact) => contact.phone)?.phone || "";
}

function findCustomer(customers, customerName) {
  const normalizedName = normalizeSearch(customerName);

  if (!normalizedName) {
    return null;
  }

  return (
    customers.find((customer) =>
      [
        customer.name,
        customer.companyName,
        getCustomerDisplayName(customer),
      ].some((value) => normalizeSearch(value) === normalizedName),
    ) || null
  );
}

function mergeCustomerPhone(customer, phone) {
  const cleanPhone = String(phone || "").trim();

  if (!cleanPhone) {
    return {};
  }

  const contacts = Array.isArray(customer.contacts) ? customer.contacts : [];
  const hasPhone = contacts.some(
    (contact) => String(contact.phone || "").trim() === cleanPhone,
  );

  if (customer.phone === cleanPhone || hasPhone) {
    return {};
  }

  if (contacts.length === 0) {
    return {
      contacts: [
        {
          id: createId(),
          label: "Primary",
          name: getCustomerDisplayName(customer),
          phone: cleanPhone,
          email: "",
        },
      ],
    };
  }

  return {
    contacts: [
      {
        ...contacts[0],
        phone: contacts[0].phone || cleanPhone,
      },
      ...contacts.slice(1),
    ],
  };
}

function parsePoLinks(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((entry) => formatPoNumber(entry))
    .filter((entry) => /^\d{3}-\d{3}$/.test(entry));
}

/**
 * @param {{
 *   orders?: Array<Record<string, any>>;
 *   customers?: Array<Record<string, any>>;
 *   currentUser?: { id?: string; name?: string; email?: string } | null;
 *   onSaveOrder?: Function;
 *   onAddCustomer?: Function;
 *   onUpdateCustomer?: Function;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function SalesOrdersPage({
  orders = [],
  customers = [],
  currentUser = null,
  onSaveOrder,
  onAddCustomer,
  onUpdateCustomer,
  onPageChange,
}) {
  const safeOrders = useMemo(
    () => (Array.isArray(orders) ? orders : []),
    [orders],
  );
  const safeCustomers = useMemo(
    () => (Array.isArray(customers) ? customers : []),
    [customers],
  );
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [poLinks, setPoLinks] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recentCustomers = safeCustomers.slice(0, 6);
  const filteredOrders = useMemo(() => {
    const searchValue = normalizeSearch(search);

    if (!searchValue) {
      return safeOrders;
    }

    return safeOrders.filter((order) =>
      [
        order.orderNumber,
        order.customerName,
        order.phone,
        ...(Array.isArray(order.poNumbers) ? order.poNumbers : []),
      ].some((value) => normalizeSearch(value).includes(searchValue)),
    );
  }, [safeOrders, search]);

  function selectCustomer(customer) {
    setCustomerName(getCustomerDisplayName(customer));
    setPhone(getPrimaryPhone(customer));
    setError("");
  }

  function resetForm() {
    setOrderNumber("");
    setCustomerName("");
    setPhone("");
    setPoLinks("");
    setNotes("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!/^\d{3}-\d{3}$/.test(orderNumber)) {
      setError("Enter a complete six-digit order number.");
      return;
    }

    if (!customerName.trim()) {
      setError("Enter the customer name for this order.");
      return;
    }

    const now = new Date().toISOString();
    const cleanCustomerName = formatCustomerName(customerName);
    const cleanPhone = phone.trim();
    const linkedPoNumbers = parsePoLinks(poLinks);
    let customer = findCustomer(safeCustomers, cleanCustomerName);

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      if (customer) {
        const customerUpdates = mergeCustomerPhone(customer, cleanPhone);

        if (Object.keys(customerUpdates).length > 0) {
          await onUpdateCustomer?.(customer.id, customerUpdates);
          customer = {
            ...customer,
            ...customerUpdates,
          };
        }
      } else {
        customer = {
          id: createId(),
          name: cleanCustomerName,
          companyName: cleanCustomerName,
          accountNumber: "",
          customerType: "current",
          email: "",
          website: "",
          streetAddress: "",
          city: "",
          state: "",
          zip: "",
          address: "",
          contacts: cleanPhone
            ? [
                {
                  id: createId(),
                  label: "Primary",
                  name: cleanCustomerName,
                  phone: cleanPhone,
                  email: "",
                },
              ]
            : [],
          createdAt: now,
          updatedAt: now,
        };

        await onAddCustomer?.(customer);
      }

      await onSaveOrder?.({
        id: createId(),
        orderNumber,
        customerId: customer.id,
        customerName: getCustomerDisplayName(customer),
        phone: cleanPhone || getPrimaryPhone(customer),
        poNumbers: linkedPoNumbers,
        notes: notes.trim(),
        status: "open",
        createdByName: currentUser?.name || "",
        createdByEmail: currentUser?.email || "",
        createdAt: now,
      });

      setMessage(`Order ${orderNumber} was saved and linked to ${getCustomerDisplayName(customer)}.`);
      resetForm();
    } catch (saveError) {
      console.error("Unable to save sales order:", saveError);
      setError(getFirebaseErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Sales", onClick: () => onPageChange?.("sales") },
          { label: "Orders" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
            Sales
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            Orders
          </h1>

          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            Start linking customer orders to POs, South pickups, and receiving.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.55fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Plus aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                + Add Order
              </p>
              <h2 className="text-2xl font-black text-slate-950">
                New Sales Order
              </h2>
            </div>
          </div>

          {recentCustomers.length > 0 ? (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Recent Customers
              </p>

              <div className="flex flex-wrap gap-2">
                {recentCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    {getCustomerDisplayName(customer)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <label
                  htmlFor="sales-order-number"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  Order #
                </label>

                <input
                  id="sales-order-number"
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  value={orderNumber}
                  onChange={(event) =>
                    setOrderNumber(formatOrderNumber(event.target.value))
                  }
                  placeholder="123-456"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-black tracking-[0.12em] text-slate-950 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div>
                <label
                  htmlFor="sales-order-customer"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  Customer Name
                </label>

                <input
                  id="sales-order-customer"
                  type="text"
                  list="sales-order-customers"
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(event.target.value.toUpperCase())
                  }
                  placeholder="Customer or company name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-bold text-slate-950 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />

                <datalist id="sales-order-customers">
                  {safeCustomers.map((customer) => (
                    <option key={customer.id} value={getCustomerDisplayName(customer)} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="sales-order-phone"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  Phone Number
                </label>

                <input
                  id="sales-order-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Optional customer phone"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-950 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div>
                <label
                  htmlFor="sales-order-pos"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  Possible PO Links
                </label>

                <input
                  id="sales-order-pos"
                  type="text"
                  value={poLinks}
                  onChange={(event) => setPoLinks(event.target.value)}
                  placeholder="440-952, 441-125"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-950 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="sales-order-notes"
                className="mb-2 block text-sm font-black text-slate-700"
              >
                Notes
              </label>

              <textarea
                id="sales-order-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Optional order notes, what is coming South, what may arrive on their truck, or anything to connect later."
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-950 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-red-600 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? "Saving Order..." : "Save Order"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Order List
              </p>
              <h2 className="text-2xl font-black text-slate-950">
                Recent Orders
              </h2>
            </div>

            <span className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
              {safeOrders.length}
            </span>
          </div>

          <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search aria-hidden="true" className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, customer, phone, PO..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <ClipboardList
                  aria-hidden="true"
                  className="mx-auto h-8 w-8 text-slate-300"
                />
                <p className="mt-3 text-sm font-bold text-slate-500">
                  No sales orders saved yet.
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black text-slate-950">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-blue-700">
                        <UserRound
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                        {formatCustomerName(order.customerName)}
                      </p>
                    </div>

                    {Array.isArray(order.poNumbers) && order.poNumbers.length > 0 ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-blue-700">
                        {order.poNumbers.length} PO{order.poNumbers.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>

                  {order.phone ? (
                    <p className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600">
                      <Phone aria-hidden="true" className="h-4 w-4" />
                      {order.phone}
                    </p>
                  ) : null}

                  {Array.isArray(order.poNumbers) && order.poNumbers.length > 0 ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
                      <Link2 aria-hidden="true" className="h-4 w-4" />
                      {order.poNumbers.map((poNumber) => (
                        <span
                          key={poNumber}
                          className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700"
                        >
                          {poNumber}
                        </span>
                      ))}
                    </p>
                  ) : null}

                  {order.notes ? (
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                      {order.notes}
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
