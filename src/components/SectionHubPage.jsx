import { ArrowRight } from "lucide-react";
import Breadcrumbs from "./Breadcrumbs";
import PageContainer from "./PageContainer";

function StatTile({ icon: Icon, label, value, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <p className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 sm:flex-row sm:items-center sm:gap-2 sm:text-xs sm:tracking-[0.14em]">
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950 sm:mt-3 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs font-bold leading-tight text-slate-500 sm:text-sm">
        {note}
      </p>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  title,
  description,
  metric,
  metricLabel,
  tone = "default",
  onClick,
}) {
  const toneClasses = {
    default: {
      button:
        "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30",
      icon: "bg-slate-100 text-slate-700",
      metric: "bg-slate-50 text-slate-950",
      arrow: "text-[#FC2C38]",
    },
    warning: {
      button:
        "border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/40",
      icon: "bg-amber-50 text-amber-700",
      metric: "bg-amber-50 text-amber-900",
      arrow: "text-amber-700",
    },
    dispatch: {
      button:
        "border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50",
      icon: "bg-white text-blue-700",
      metric: "bg-white text-blue-900",
      arrow: "text-blue-700",
    },
    marketing: {
      button:
        "border-rose-200 bg-rose-50/40 hover:border-rose-300 hover:bg-rose-50",
      icon: "bg-white text-rose-700",
      metric: "bg-white text-rose-900",
      arrow: "text-rose-700",
    },
    fleet: {
      button:
        "border-cyan-200 bg-cyan-50/40 hover:border-cyan-300 hover:bg-cyan-50",
      icon: "bg-white text-cyan-700",
      metric: "bg-white text-cyan-900",
      arrow: "text-cyan-700",
    },
    success: {
      button:
        "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50",
      icon: "bg-emerald-100 text-emerald-700",
      metric: "bg-white text-emerald-800",
      arrow: "text-emerald-700",
    },
    archive: {
      button:
        "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
      icon: "bg-white text-slate-500",
      metric: "bg-white text-slate-700",
      arrow: "text-slate-500",
    },
  };
  const selectedTone = toneClasses[tone] || toneClasses.default;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition sm:p-5 ${selectedTone.button}`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${selectedTone.icon}`}
      >
        <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
        <span className="mt-1 block text-xl font-black text-slate-950">
          {title}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-slate-500">
          {description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {metric !== undefined ? (
          <span className={`rounded-2xl px-3 py-2 text-right ${selectedTone.metric}`}>
            <span className="block text-xl font-black">
              {metric}
            </span>
            <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {metricLabel}
            </span>
          </span>
        ) : null}
        <ArrowRight
          aria-hidden="true"
          className={`h-5 w-5 transition group-hover:translate-x-1 ${selectedTone.arrow}`}
          strokeWidth={2.6}
        />
      </span>
    </button>
  );
}

/**
 * @param {{
 *   eyebrow?: string;
 *   title: string;
 *   description: string;
 *   icon: import("lucide-react").LucideIcon;
 *   primaryAction?: {
 *     label: string;
 *     icon: import("lucide-react").LucideIcon;
 *     onClick: () => void;
 *   } | null;
 *   stats: Array<{
 *     icon: import("lucide-react").LucideIcon;
 *     label: string;
 *     value: string | number;
 *     note: string;
 *   }>;
 *   actions: Array<Record<string, unknown> | null>;
 *   headerAccessory?: import("react").ReactNode;
 *   children?: import("react").ReactNode;
 * }} props
 */
export default function SectionHubPage({
  eyebrow = "",
  title,
  description,
  icon: Icon,
  primaryAction = null,
  stats,
  actions,
  headerAccessory = null,
  children = null,
}) {
  const PrimaryActionIcon = primaryAction?.icon;

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: title }]} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            {eyebrow || title}
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            {description}
          </p>
        </div>

        {headerAccessory || primaryAction ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {headerAccessory}

            {primaryAction ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-600 sm:mt-1"
              >
                {PrimaryActionIcon ? (
                  <PrimaryActionIcon
                    aria-hidden="true"
                    className="h-5 w-5"
                    strokeWidth={2.7}
                  />
                ) : null}
                {primaryAction.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {stats?.length ? (
        <section className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
          {stats.map((stat) => (
            <StatTile key={stat.label} {...stat} />
          ))}
        </section>
      ) : null}

      {children}

      <section className="grid gap-3">
        {actions.filter(Boolean).map((action) => (
          <ActionRow key={action.title} {...action} />
        ))}
      </section>
    </PageContainer>
  );
}
