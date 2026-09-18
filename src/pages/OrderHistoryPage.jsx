import { useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  History,
  Package,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const closedStatuses = new Set(["complete", "completed", "archived", "cancelled", "canceled"]);

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}`.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getOrderTitle(order) {
  return (
    order.businessName ||
    order.companyName ||
    order.customerName ||
    "Unnamed order"
  );
}

function getClosedLabel(order) {
  const status = String(order.status || "").toLowerCase();
  if (status === "complete" || status === "completed") return "Complete";
  if (status === "archived") return "Deleted";
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  return "Closed";
}

export default function OrderHistoryPage({
  orders = [],
  onUpdateOrder,
  onDeleteOrder,
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
          order.status,
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
          { label: "Order History" },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Closed Orders
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Order History
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-bold text-slate-500">
            Completed, deleted, and cancelled new-flow orders.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-white">
          <p className="text-3xl font-black">{orders.length}</p>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
            Records
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 focus-within:border-[#FC2C38] focus-within:ring-4 focus-within:ring-red-100">
          <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-14 flex-1 bg-transparent text-base font-bold text-slate-950 outline-none"
            placeholder="Search order, customer, PO, vendor, item, or status..."
          />
        </label>
        <p className="mt-3 text-sm font-black text-slate-500">
          {filteredOrders.length} records found
        </p>
      </section>

      <div className="mt-5 grid gap-4">
        {filteredOrders.map((order) => {
          const isOpen = openOrderId === order.id;
          const items = Array.isArray(order.items) ? order.items : [];
          const status = String(order.status || "").toLowerCase();
          const isComplete = status === "complete" || status === "completed";

          return (
            <article
              key={order.id}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                      isComplete
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Archive className="h-6 w-6" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-black text-slate-950">
                        {order.orderNumber || "000-000"}
                      </p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                        {getClosedLabel(order)}
                      </span>
                    </div>
                    <h2 className="mt-1 truncate text-xl font-black text-slate-950">
                      {getOrderTitle(order)}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm font-black text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        {formatDate(order.completedAt || order.archivedAt || order.updatedAt)}
                      </span>
                      <span>{order.customerName || "No contact"}</span>
                      <span>{order.phone || order.phoneNumber || "No phone"}</span>
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
                    className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700"
                  >
                    {isOpen ? "Close" : "View"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateOrder?.(order.id, {
                        status: "processed",
                        reopenedAt: new Date().toISOString(),
                      })
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Reopen
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteOrder?.(order.id)}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Items
                  </p>
                  <div className="mt-3 grid gap-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700"
                      >
                        {item.quantity ? `QTY ${item.quantity} · ` : ""}
                        {item.description || "Unnamed item"}
                        <span className="ml-2 text-slate-400">
                          {item.vendor || "No vendor"} · PO{" "}
                          {item.poNumber || "not entered"}
                        </span>
                      </div>
                    ))}
                    {items.length === 0 ? (
                      <p className="text-sm font-bold text-slate-500">
                        No items saved on this order.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        {filteredOrders.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <History className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-xl font-black text-slate-950">No order history yet</p>
            <p className="mt-2 text-sm font-bold text-slate-500">
              Completed or deleted new-flow orders will show here.
            </p>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

export { closedStatuses };
