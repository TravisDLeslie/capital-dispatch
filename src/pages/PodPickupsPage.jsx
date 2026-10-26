import {
  CalendarDays,
  Check,
  Package,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * @param {{
 *   podPickups?: Array<Record<string, any>>;
 *   onCompletePodPickup?: (podPickupId: string) => void;
 *   onDeletePodPickup?: (podPickupId: string) => void;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function PodPickupsPage({
  podPickups = [],
  onCompletePodPickup,
  onDeletePodPickup,
  onPageChange,
}) {
  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "New Home", onClick: () => onPageChange?.("new-home") },
          { label: "Fulfillment" },
          { label: "POD" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Customer Pickup
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            POD Tracker
          </h1>
          <p className="mt-2 max-w-2xl text-lg font-bold text-slate-500">
            POs the customer is picking up directly from a supplier.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-amber-800">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          {podPickups.length} PODs
        </span>
      </div>

      <div className="grid gap-3">
        {podPickups.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-xl font-black text-slate-950">
              No POD pickups yet
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Process an order with a POD item and it will show up here.
            </p>
          </div>
        ) : (
          podPickups.map((pickup) => (
            <article
              key={pickup.id}
              className="rounded-[2rem] border border-amber-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                    POD Pickup
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      PO {pickup.poNumber || "Not entered"}
                    </h2>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-amber-800">
                      Order {pickup.orderNumber || "No order"}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-black text-slate-800">
                    {pickup.businessName || pickup.customerName || "No customer"}
                  </p>
                  <p className="text-sm font-bold text-slate-500">
                    {pickup.vendor || "No vendor"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {formatDate(pickup.podDate)}
                  </span>
                  {pickup.status === "complete" ? (
                    <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-black text-emerald-700">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Picked Up
                    </span>
                  ) : onCompletePodPickup ? (
                    <button
                      type="button"
                      onClick={() => onCompletePodPickup(pickup.id)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Mark Picked Up
                    </button>
                  ) : null}
                  {onDeletePodPickup ? (
                    <button
                      type="button"
                      onClick={() => onDeletePodPickup(pickup.id)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-[#FC2C38] transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {(pickup.items || []).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <p className="font-black text-slate-950">
                      {item.quantity ? `QTY ${item.quantity} · ` : ""}
                      {item.description || "Unnamed item"}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </PageContainer>
  );
}
