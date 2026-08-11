import {
  ArrowRight,
  CalendarDays,
  History,
  Plus,
  Warehouse,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { formatDateInput } from "../utils/dateHelpers";
import { formatCustomerName } from "../utils/textFormatters";

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getItemCount(theirTruckPO) {
  return Array.isArray(theirTruckPO.items) ? theirTruckPO.items.length : 0;
}

function isTodayTheirTruckPO(theirTruckPO) {
  return theirTruckPO.deliveryDate === getTodayDateKey();
}

function QuickAction({
  icon: Icon,
  title,
  description,
  metric,
  tone = "blue",
  onClick,
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50/80 text-blue-950 hover:bg-blue-50",
    slate: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-white",
    green:
      "border-emerald-200 bg-emerald-50/80 text-emerald-950 hover:bg-emerald-50",
  };
  const iconTones = {
    blue: "bg-white text-blue-700",
    slate: "bg-white text-slate-500",
    green: "bg-white text-emerald-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[108px] items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition ${tones[tone] || tones.blue}`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconTones[tone] || iconTones.blue}`}
      >
        <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black">{title}</span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-slate-600">
          {description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {metric !== undefined ? (
          <span className="rounded-xl bg-white px-3 py-2 text-center text-lg font-black text-slate-950 shadow-sm">
            {metric}
          </span>
        ) : null}
        <ArrowRight
          aria-hidden="true"
          className="h-5 w-5 text-slate-500 transition group-hover:translate-x-1"
          strokeWidth={2.6}
        />
      </span>
    </button>
  );
}

/**
 * @param {{
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   allowedPageIds?: string[];
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function TheirTruckOverviewPage({
  theirTruckPOs = [],
  allowedPageIds = [],
  onPageChange,
}) {
  const canOpen = (pageId) => allowedPageIds.includes(pageId);
  const safeTheirTruckPOs = Array.isArray(theirTruckPOs) ? theirTruckPOs : [];
  const scheduledPOs = safeTheirTruckPOs.filter(
    (theirTruckPO) => theirTruckPO.status !== "complete",
  );
  const todaysPOs = scheduledPOs.filter(isTodayTheirTruckPO);
  const todaysItemCount = todaysPOs.reduce(
    (count, theirTruckPO) => count + getItemCount(theirTruckPO),
    0,
  );

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "PO's", onClick: () => onPageChange?.("south") },
          { label: "Their Truck" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            <Warehouse
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.5}
            />
            Their Truck
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            Their Truck
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            Manage vendor-delivered POs and see what is expected inbound today.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-right shadow-sm">
          <p className="text-3xl font-black text-blue-800">{todaysPOs.length}</p>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
            Today
          </p>
        </div>
      </div>

      <section className="mb-6 grid gap-3 lg:grid-cols-2">
        {canOpen("their-truck-pos") ? (
          <QuickAction
            icon={Plus}
            title="Add Their Truck PO"
            description="Schedule a PO coming in on a vendor truck."
            onClick={() => onPageChange?.("their-truck-pos")}
          />
        ) : null}

        {canOpen("their-truck-calendar") ? (
          <QuickAction
            icon={CalendarDays}
            title="Their Truck Calendar"
            description="See inbound POs by delivery date."
            metric={scheduledPOs.length}
            onClick={() => onPageChange?.("their-truck-calendar")}
          />
        ) : null}

        {canOpen("their-truck-history") ? (
          <QuickAction
            icon={History}
            title="Their Truck History"
            description="Search and review vendor-delivered PO records."
            metric={safeTheirTruckPOs.length}
            tone="slate"
            onClick={() => onPageChange?.("their-truck-history")}
          />
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
              Inbound Today
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              POs Arriving Today
            </h2>
          </div>

          <span className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
            {todaysItemCount} items
          </span>
        </div>

        {todaysPOs.length === 0 ? (
          <EmptyState
            title="None scheduled today"
            description="Their Truck POs scheduled for today will show here."
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {todaysPOs.map((theirTruckPO) => (
              <button
                key={theirTruckPO.id}
                type="button"
                onClick={() => onPageChange?.("their-truck-calendar")}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-black text-slate-950">
                      {theirTruckPO.poNumber || "No PO #"}
                    </p>
                    <p className="mt-1 text-sm font-black uppercase tracking-[0.1em] text-slate-600">
                      {theirTruckPO.vendor || "Unknown vendor"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {theirTruckPO.isStock
                        ? "Stock"
                        : formatCustomerName(theirTruckPO.customerName)}
                    </p>
                  </div>

                  <span className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                    <span className="block text-lg font-black text-blue-800">
                      {getItemCount(theirTruckPO)}
                    </span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      Items
                    </span>
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {formatDateInput(theirTruckPO.deliveryDate)}
                  </span>
                  {theirTruckPO.orderNumber ? (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
                      Order {theirTruckPO.orderNumber}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
