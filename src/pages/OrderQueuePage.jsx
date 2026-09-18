import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const pathOptions = [
  { id: "wePickup", label: "We Pickup", tone: "bg-red-50 text-[#FC2C38]" },
  { id: "supplierDelivery", label: "Supplier Delivery", tone: "bg-blue-50 text-blue-700" },
  { id: "pod", label: "Customer POD", tone: "bg-amber-50 text-amber-700" },
  { id: "inStock", label: "Our Material", tone: "bg-emerald-50 text-emerald-700" },
];

function createBlankItem() {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    quantity: "",
    description: "",
    path: "wePickup",
    vendor: "",
    poNumber: "",
    routeDate: "",
    supplierDate: "",
    saved: true,
  };
}

function formatOrderNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getOrderTitle(order) {
  return (
    order.businessName ||
    order.companyName ||
    order.customerName ||
    "Unnamed order"
  );
}

function getOrderDate(order) {
  return order.deliveryDate || order.expectedDate || "";
}

function getItemDate(item) {
  return item.routeDate || item.supplierDate || item.expectedDate || "";
}

function getPath(pathId) {
  return pathOptions.find((path) => path.id === pathId) || pathOptions[0];
}

function OrderEditPanel({ order, onSave, onArchive, onComplete }) {
  const [draft, setDraft] = useState(() => ({
    ...order,
    items: Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [createBlankItem()],
  }));
  const [isSaving, setIsSaving] = useState(false);
  const items = Array.isArray(draft.items) ? draft.items : [];

  function updateField(field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function updateItem(itemId, field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: currentDraft.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }));
  }

  function addItem() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: [...(currentDraft.items || []), createBlankItem()],
    }));
  }

  function removeItem(itemId) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: (currentDraft.items || []).filter((item) => item.id !== itemId),
    }));
  }

  async function saveOrder() {
    setIsSaving(true);
    try {
      await onSave(order.id, {
        ...draft,
        orderNumber: formatOrderNumber(draft.orderNumber),
        items: items.filter(
          (item) =>
            String(item.quantity || "").trim() ||
            String(item.description || "").trim() ||
            String(item.vendor || "").trim() ||
            String(item.poNumber || "").trim(),
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-4">
        <label className="grid gap-1 text-sm font-black text-slate-700">
          Order #
          <input
            value={draft.orderNumber || ""}
            onChange={(event) =>
              updateField("orderNumber", formatOrderNumber(event.target.value))
            }
            className="h-12 rounded-xl border border-slate-300 px-3 text-base font-black outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            placeholder="123-456"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-slate-700">
          Customer
          <input
            value={draft.customerName || ""}
            onChange={(event) => updateField("customerName", event.target.value)}
            className="h-12 rounded-xl border border-slate-300 px-3 text-base font-bold outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-slate-700">
          Business
          <input
            value={draft.businessName || ""}
            onChange={(event) => updateField("businessName", event.target.value)}
            className="h-12 rounded-xl border border-slate-300 px-3 text-base font-bold outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-slate-700">
          Phone
          <input
            value={draft.phone || draft.phoneNumber || ""}
            onChange={(event) => {
              updateField("phone", event.target.value);
              updateField("phoneNumber", event.target.value);
            }}
            className="h-12 rounded-xl border border-slate-300 px-3 text-base font-bold outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[180px_180px_minmax(220px,1fr)]">
        <label className="grid gap-1 text-sm font-black text-slate-700">
          Handoff
          <select
            value={draft.handoffType || "willCall"}
            onChange={(event) => updateField("handoffType", event.target.value)}
            className="h-12 rounded-xl border border-slate-300 px-3 text-base font-black outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          >
            <option value="willCall">Will Call</option>
            <option value="delivery">Delivery</option>
            <option value="pod">POD</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-black text-slate-700">
          Needed Date
          <input
            type="date"
            value={draft.deliveryDate || ""}
            onChange={(event) => updateField("deliveryDate", event.target.value)}
            className="h-12 rounded-xl border border-slate-300 px-3 text-base font-bold outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-slate-700">
          Delivery Address
          <input
            value={draft.deliveryAddress || ""}
            onChange={(event) =>
              updateField("deliveryAddress", event.target.value)
            }
            className="h-12 rounded-xl border border-slate-300 px-3 text-base font-bold outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            Items
          </p>
          <p className="text-sm font-bold text-slate-500">
            Add, remove, or reroute material before the order is done.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Item
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[42px_90px_minmax(200px,1fr)_160px_160px_150px_44px] lg:items-end"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-500">
              {index + 1}
            </span>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              QTY
              <input
                value={item.quantity || ""}
                onChange={(event) =>
                  updateItem(item.id, "quantity", event.target.value)
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-black normal-case tracking-normal text-slate-950 outline-none"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Material
              <input
                value={item.description || ""}
                onChange={(event) =>
                  updateItem(item.id, "description", event.target.value)
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-black normal-case tracking-normal text-slate-950 outline-none"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Path
              <select
                value={item.path || "wePickup"}
                onChange={(event) => updateItem(item.id, "path", event.target.value)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black normal-case tracking-normal text-slate-950 outline-none"
              >
                {pathOptions.map((path) => (
                  <option key={path.id} value={path.id}>
                    {path.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Vendor
              <input
                value={item.vendor || ""}
                onChange={(event) => updateItem(item.id, "vendor", event.target.value)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black normal-case tracking-normal text-slate-950 outline-none"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              PO / Date
              <input
                value={item.poNumber || ""}
                onChange={(event) => updateItem(item.id, "poNumber", event.target.value)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black normal-case tracking-normal text-slate-950 outline-none"
                placeholder="PO #"
              />
            </label>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-white text-[#FC2C38]"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Delete this order from the queue? It will stay in order history.",
              )
            ) {
              onArchive(order.id);
            }
          }}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-[#FC2C38]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete Order
        </button>
        <button
          type="button"
          onClick={() => onComplete(order.id)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Mark Complete
        </button>
        <button
          type="button"
          onClick={saveOrder}
          disabled={isSaving}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#FC2C38] px-6 text-sm font-black text-white disabled:bg-slate-300"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default function OrderQueuePage({
  orders = [],
  onUpdateOrder,
  onPageChange,
}) {
  const [search, setSearch] = useState("");
  const [openOrderId, setOpenOrderId] = useState("");

  const filteredOrders = useMemo(() => {
    const needle = normalizeSearch(search);

    return orders.filter((order) => {
      if (!needle) return true;
      const haystack = normalizeSearch(
        [
          order.orderNumber,
          order.customerName,
          order.businessName,
          order.phone,
          order.accountNumber,
          ...(Array.isArray(order.items)
            ? order.items.flatMap((item) => [
                item.description,
                item.vendor,
                item.poNumber,
              ])
            : []),
        ].join(" "),
      );
      return haystack.includes(needle);
    });
  }, [orders, search]);

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "New Home", onClick: () => onPageChange?.("new-home") },
          { label: "Orders" },
          { label: "Order Queue" },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Active Orders
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Order Queue
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-bold text-slate-500">
            Open new-flow orders that can still be edited, routed, completed, or deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPageChange?.("order-flow")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 text-sm font-black text-white shadow-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Order
        </button>
      </div>

      <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 focus-within:border-[#FC2C38] focus-within:ring-4 focus-within:ring-red-100">
          <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-14 flex-1 bg-transparent text-base font-bold text-slate-950 outline-none"
            placeholder="Search order, customer, PO, vendor, or item..."
          />
        </label>
        <p className="mt-3 text-sm font-black text-slate-500">
          {filteredOrders.length} active orders
        </p>
      </section>

      <div className="mt-5 grid gap-4">
        {filteredOrders.map((order) => {
          const isOpen = openOrderId === order.id;
          const items = Array.isArray(order.items) ? order.items : [];
          const handoff = String(order.handoffType || "willCall");

          return (
            <article
              key={order.id}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                    <ClipboardList className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-black text-slate-950">
                        {order.orderNumber || "000-000"}
                      </p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                        {handoff}
                      </span>
                    </div>
                    <h2 className="mt-1 truncate text-xl font-black text-slate-950">
                      {getOrderTitle(order)}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm font-black text-slate-500">
                      <span>{order.customerName || "No contact"}</span>
                      <span>{order.phone || order.phoneNumber || "No phone"}</span>
                      <span>{getOrderDate(order) || "No date"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                    <Package className="h-4 w-4" aria-hidden="true" />
                    {items.length} items
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenOrderId(isOpen ? "" : order.id)}
                    className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white"
                  >
                    {isOpen ? "Close" : "Open / Edit"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {pathOptions.map((path) => {
                  const count = items.filter((item) => item.path === path.id).length;
                  if (!count) return null;
                  return (
                    <span
                      key={path.id}
                      className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${path.tone}`}
                    >
                      {path.label}: {count}
                    </span>
                  );
                })}
              </div>

              {isOpen ? (
                <OrderEditPanel
                  order={order}
                  onSave={onUpdateOrder}
                  onArchive={(orderId) =>
                    onUpdateOrder(orderId, { status: "archived", archivedAt: new Date().toISOString() })
                  }
                  onComplete={(orderId) =>
                    onUpdateOrder(orderId, { status: "complete", completedAt: new Date().toISOString() })
                  }
                />
              ) : null}
            </article>
          );
        })}

        {filteredOrders.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-xl font-black text-slate-950">No active orders</p>
            <p className="mt-2 text-sm font-bold text-slate-500">
              New orders will land here after they are processed.
            </p>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
