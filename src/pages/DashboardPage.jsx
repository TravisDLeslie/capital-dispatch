import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  ClipboardCheck,
  DollarSign,
  Plus,
  Truck,
  UsersRound,
} from "lucide-react";
import PageContainer from "../components/PageContainer";

function formatDashboardCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

/**
 * @param {{
 *   title: string;
 *   description: string;
 *   icon: import("lucide-react").LucideIcon;
 *   value: string | number;
 *   note: string;
 *   tone?: "default" | "warning" | "success" | "dispatch" | "marketing" | "fleet";
 *   onClick?: () => void;
 * }} props
 */
function HeartbeatCard({
  title,
  description,
  icon: Icon,
  value,
  note,
  tone = "default",
  onClick,
}) {
  const toneClasses = {
    default: {
      card: "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30",
      icon: "bg-slate-50 text-slate-700 border-slate-200",
      value: "text-slate-950",
    },
    warning: {
      card: "border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/40",
      icon: "bg-amber-50 text-amber-700 border-amber-200",
      value: "text-amber-900",
    },
    success: {
      card: "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50",
      icon: "bg-emerald-100 text-emerald-700 border-emerald-200",
      value: "text-emerald-800",
    },
    dispatch: {
      card: "border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50",
      icon: "bg-white text-blue-700 border-blue-200",
      value: "text-blue-900",
    },
    marketing: {
      card: "border-rose-200 bg-rose-50/40 hover:border-rose-300 hover:bg-rose-50",
      icon: "bg-white text-rose-700 border-rose-200",
      value: "text-rose-900",
    },
    fleet: {
      card: "border-cyan-200 bg-cyan-50/40 hover:border-cyan-300 hover:bg-cyan-50",
      icon: "bg-white text-cyan-700 border-cyan-200",
      value: "text-cyan-900",
    },
  };
  const selectedTone = toneClasses[tone] || toneClasses.default;
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${selectedTone.icon}`}
        >
          <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
        </span>

        <span className="text-right">
          <span className={`block text-3xl font-black ${selectedTone.value}`}>
            {value}
          </span>
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            {note}
          </span>
        </span>
      </div>

      <h2 className="mt-4 text-xl font-black text-slate-950">
        {title}
      </h2>
      <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-[22px] border p-5 text-left shadow-sm transition ${selectedTone.card}`}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`rounded-[22px] border p-5 shadow-sm ${selectedTone.card}`}>
      {content}
    </article>
  );
}

/**
 * @param {{
 *   headerAccessory?: import("react").ReactNode;
 *   onPageChange?: (pageId: string) => void;
 *   allowedPageIds?: string[];
 *   operations?: {
 *     receivingToday?: number;
 *     southNeedsDispatch?: number;
 *     southOpen?: number;
 *     deliveryOpen?: number;
 *     hardwareOpen?: number;
 *     customerCount?: number;
 *     salesMonthTotal?: number;
 *     cashCardSales?: number;
 *     chargeSales?: number;
 *   };
 * }} props
 */
export default function DashboardPage({
  headerAccessory = null,
  onPageChange,
  allowedPageIds = [],
  operations = {},
}) {
  const quickActions = [
    {
      id: "supplier-runs-add",
      title: "Add POs for South",
      description: "Create a South pickup request.",
      icon: Plus,
      tone: "bg-red-50 text-[#FC2C38] border-red-100 hover:border-red-200 hover:bg-red-100/70",
    },
    {
      id: "supplier-runs-dispatch",
      title: "Dispatch South POs",
      description: "Assign drivers and trucks.",
      icon: Truck,
      tone: "bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-200 hover:bg-blue-100/70",
    },
    {
      id: "supplier-runs-check",
      title: "POs to Pick Up",
      description: "Open the driver pickup board.",
      icon: ClipboardCheck,
      tone: "bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-200 hover:bg-amber-100/70",
    },
    {
      id: "sales-converter",
      title: "Converter",
      description: "Boards, sheets, items, and margin.",
      icon: Calculator,
      tone: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200 hover:bg-emerald-100/70",
    },
    {
      id: "sales",
      title: "Sales",
      description: "Customers, pulse, and tools.",
      icon: DollarSign,
      tone: "bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-200 hover:bg-rose-100/70",
    },
  ].filter((action) => allowedPageIds.includes(action.id));

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Dashboard
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            Operations Dashboard
          </h1>

          <p className="mt-2 max-w-3xl text-lg text-slate-500">
            A quick heartbeat for receiving, South runs, deliveries, and sales.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {headerAccessory}
        </div>
      </div>

      {quickActions.length > 0 ? (
        <section className="mb-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                Quick Actions
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Jump into the work
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const ActionIcon = action.icon;

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onPageChange?.(action.id)}
                  className={`group flex min-h-[92px] items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition ${action.tone}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <ActionIcon
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={2.6}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-black text-slate-950">
                      {action.title}
                    </span>
                    <span className="mt-0.5 block text-xs font-bold leading-5 text-slate-500">
                      {action.description}
                    </span>
                  </span>

                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                    strokeWidth={2.6}
                  />
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HeartbeatCard
          icon={ClipboardCheck}
          title="Receiving"
          description="POs checked in today."
          value={operations.receivingToday || 0}
          note="Today"
          tone="success"
          onClick={() => onPageChange?.("today")}
        />

        <HeartbeatCard
          icon={AlertTriangle}
          title="South Dispatch"
          description="PO requests waiting for driver and truck assignment."
          value={operations.southNeedsDispatch || 0}
          note="Waiting"
          tone={operations.southNeedsDispatch > 0 ? "warning" : "dispatch"}
          onClick={() => onPageChange?.("supplier-runs-dispatch")}
        />

        <HeartbeatCard
          icon={Truck}
          title="Deliveries"
          description="Open deliveries with hardware reminders called out."
          value={operations.deliveryOpen || 0}
          note={`${operations.hardwareOpen || 0} hardware`}
          tone={operations.hardwareOpen > 0 ? "warning" : "success"}
          onClick={() => onPageChange?.("deliveries-queue")}
        />

        <HeartbeatCard
          icon={UsersRound}
          title="Sales"
          description="Current month cash/card and charge sales."
          value={formatDashboardCurrency(operations.salesMonthTotal)}
          note={`Cash/Card ${formatDashboardCurrency(
            operations.cashCardSales,
          )} · Charge ${formatDashboardCurrency(operations.chargeSales)}`}
          tone="marketing"
          onClick={() => onPageChange?.("sales")}
        />
      </section>

    </PageContainer>
  );
}
