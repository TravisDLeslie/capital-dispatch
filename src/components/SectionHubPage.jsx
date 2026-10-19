import { ArrowRight } from "lucide-react";
import Breadcrumbs from "./Breadcrumbs";
import PageContainer from "./PageContainer";

function StatTile({
  icon: Icon,
  label,
  value,
  note,
  tone = "default",
  solidIcon = false,
}) {
  const toneClasses = {
    default: {
      tile: "border-slate-200 bg-white",
      icon: "bg-slate-100 text-slate-500",
      solidIcon: "bg-slate-700 text-white shadow-md shadow-slate-200",
      label: "text-slate-500",
    },
    success: {
      tile: "border-emerald-200 bg-emerald-50/60",
      icon: "bg-white text-emerald-700",
      solidIcon: "bg-emerald-600 text-white shadow-md shadow-emerald-200",
      label: "text-emerald-800",
    },
    warning: {
      tile: "border-amber-200 bg-amber-50/70",
      icon: "bg-white text-amber-700",
      solidIcon: "bg-amber-500 text-white shadow-md shadow-amber-200",
      label: "text-amber-800",
    },
    dispatch: {
      tile: "border-blue-200 bg-blue-50/60",
      icon: "bg-white text-blue-700",
      solidIcon: "bg-blue-600 text-white shadow-md shadow-blue-200",
      label: "text-blue-800",
    },
    schedule: {
      tile: "border-violet-200 bg-violet-50/60",
      icon: "bg-white text-violet-700",
      solidIcon: "bg-violet-600 text-white shadow-md shadow-violet-200",
      label: "text-violet-800",
    },
  };
  const selectedTone = toneClasses[tone] || toneClasses.default;

  return (
    <div className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${selectedTone.tile}`}>
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            solidIcon ? selectedTone.solidIcon : selectedTone.icon
          }`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <p className={`text-[10px] font-black uppercase tracking-[0.1em] sm:text-xs sm:tracking-[0.14em] ${selectedTone.label}`}>
          {label}
        </p>
      </div>
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
  ctaLabel = "",
  className = "",
  solidIcon = false,
  tone = "default",
  variant = "default",
  onClick,
}) {
  const toneClasses = {
    default: {
      button:
        "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/30",
      icon: "bg-slate-100 text-slate-700",
      solidIcon: "bg-slate-700 text-white shadow-md shadow-slate-200",
      metric: "bg-slate-50 text-slate-950",
      arrow: "text-[#FC2C38]",
      label: "text-slate-400",
      title: "text-slate-950",
      description: "text-slate-500",
    },
    warning: {
      button:
        "border-amber-300 bg-amber-50/70 hover:border-amber-400 hover:bg-amber-50",
      icon: "bg-white text-amber-700",
      solidIcon: "bg-amber-500 text-white shadow-md shadow-amber-200",
      metric: "bg-amber-50 text-amber-900",
      arrow: "text-amber-700",
      label: "text-amber-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    dispatch: {
      button:
        "border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50",
      icon: "bg-white text-blue-700",
      solidIcon: "bg-blue-600 text-white shadow-md shadow-blue-200",
      metric: "bg-white text-blue-900",
      arrow: "text-blue-700",
      label: "text-blue-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    schedule: {
      button:
        "border-indigo-200 bg-indigo-50/50 hover:border-indigo-300 hover:bg-indigo-50",
      icon: "bg-white text-indigo-700",
      solidIcon: "bg-indigo-600 text-white shadow-md shadow-indigo-200",
      metric: "bg-white text-indigo-900",
      arrow: "text-indigo-700",
      label: "text-indigo-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    receiving: {
      button:
        "border-purple-300 bg-purple-100/70 hover:border-purple-400 hover:bg-purple-100",
      icon: "bg-purple-600 text-white shadow-purple-200",
      solidIcon: "bg-purple-600 text-white shadow-md shadow-purple-200",
      metric: "bg-white text-purple-900",
      arrow: "text-purple-700",
      label: "text-purple-800",
      title: "text-slate-950",
      description: "text-slate-700",
    },
    marketing: {
      button:
        "border-rose-200 bg-rose-50/40 hover:border-rose-300 hover:bg-rose-50",
      icon: "bg-white text-rose-700",
      solidIcon: "bg-rose-600 text-white shadow-md shadow-rose-200",
      metric: "bg-white text-rose-900",
      arrow: "text-rose-700",
      label: "text-rose-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    priority: {
      button:
        "border-red-200 bg-red-50/60 hover:border-red-300 hover:bg-red-50",
      icon: "bg-white text-[#FC2C38]",
      solidIcon: "bg-[#FC2C38] text-white shadow-md shadow-red-200",
      metric: "bg-white text-red-700",
      arrow: "text-[#FC2C38]",
      label: "text-red-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    fleet: {
      button:
        "border-cyan-200 bg-cyan-50/40 hover:border-cyan-300 hover:bg-cyan-50",
      icon: "bg-white text-cyan-700",
      solidIcon: "bg-cyan-600 text-white shadow-md shadow-cyan-200",
      metric: "bg-white text-cyan-900",
      arrow: "text-cyan-700",
      label: "text-cyan-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    success: {
      button:
        "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400 hover:bg-emerald-50",
      icon: "bg-white text-emerald-700",
      solidIcon: "bg-emerald-600 text-white shadow-md shadow-emerald-200",
      metric: "bg-white text-emerald-800",
      arrow: "text-emerald-700",
      label: "text-emerald-700",
      title: "text-slate-950",
      description: "text-slate-600",
    },
    archive: {
      button:
        "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white",
      icon: "bg-white text-slate-500",
      solidIcon: "bg-slate-600 text-white shadow-md shadow-slate-200",
      metric: "bg-white text-slate-700",
      arrow: "text-slate-500",
      label: "text-slate-400",
      title: "text-slate-800",
      description: "text-slate-500",
    },
  };
  const selectedTone = toneClasses[tone] || toneClasses.default;
  const variantClasses = {
    default: {
      button: "items-center gap-4 p-4 sm:p-5",
      icon: "h-12 w-12 rounded-2xl",
      iconSvg: "h-6 w-6",
      title: "text-xl",
      metric: "rounded-2xl px-3 py-2",
      bar: "",
    },
    alert: {
      button: "items-center gap-4 p-4 sm:p-5 ring-1 ring-amber-100",
      icon: "h-14 w-14 rounded-2xl",
      iconSvg: "h-7 w-7",
      title: "text-2xl",
      metric: "rounded-2xl px-4 py-3",
      bar: "bg-amber-500",
    },
    priority: {
      button: "items-center gap-4 p-5 sm:p-6 ring-1 ring-red-100",
      icon: "h-14 w-14 rounded-2xl",
      iconSvg: "h-7 w-7",
      title: "text-2xl",
      metric: "rounded-2xl px-4 py-3",
      bar: "bg-[#FC2C38]",
    },
    live: {
      button: "items-center gap-4 p-5 sm:p-6 ring-1 ring-emerald-100",
      icon: "h-14 w-14 rounded-2xl",
      iconSvg: "h-7 w-7",
      title: "text-2xl",
      metric: "rounded-2xl px-4 py-3",
      bar: "bg-emerald-600",
    },
    compact: {
      button: "items-center gap-4 p-4 sm:p-5",
      icon: "h-11 w-11 rounded-xl",
      iconSvg: "h-5 w-5",
      title: "text-lg",
      metric: "rounded-xl px-3 py-2",
      bar: "bg-indigo-500",
    },
    quiet: {
      button: "items-center gap-4 p-4 sm:p-5 opacity-90",
      icon: "h-11 w-11 rounded-xl",
      iconSvg: "h-5 w-5",
      title: "text-lg",
      metric: "rounded-xl px-3 py-2",
      bar: "bg-slate-300",
    },
  };
  const selectedVariant = variantClasses[variant] || variantClasses.default;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-full overflow-hidden rounded-2xl border text-left shadow-sm transition ${selectedVariant.button} ${selectedTone.button} ${className}`}
    >
      {selectedVariant.bar ? (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1.5 ${selectedVariant.bar}`}
        />
      ) : null}

      <span
        className={`flex shrink-0 items-center justify-center ${selectedVariant.icon} ${
          solidIcon ? selectedTone.solidIcon : selectedTone.icon
        }`}
      >
        <Icon
          aria-hidden="true"
          className={selectedVariant.iconSvg}
          strokeWidth={2.4}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-[10px] font-black uppercase tracking-[0.16em] ${selectedTone.label}`}
        >
          {label}
        </span>
        <span
          className={`mt-1 block font-black ${selectedVariant.title} ${selectedTone.title}`}
        >
          {title}
        </span>
        <span
          className={`mt-1 block text-sm font-semibold leading-5 ${selectedTone.description}`}
        >
          {description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {metric !== undefined ? (
          <span
            className={`text-right shadow-sm ${selectedVariant.metric} ${selectedTone.metric}`}
          >
            <span className="block text-xl font-black">
              {metric}
            </span>
            <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {metricLabel}
            </span>
          </span>
        ) : null}
        {ctaLabel ? (
          <span className="hidden text-xs font-black uppercase tracking-[0.12em] text-slate-500 sm:block">
            {ctaLabel}
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
 *   titleAction?: {
 *     label: string;
 *     icon: import("lucide-react").LucideIcon;
 *     onClick: () => void;
 *   } | null;
 *   stats: Array<{
 *     icon: import("lucide-react").LucideIcon;
 *     label: string;
 *     value: string | number;
 *     note: string;
 *     tone?: string;
 *     solidIcon?: boolean;
 *   }>;
 *   actions: Array<Record<string, unknown> | null>;
 *   headerAccessory?: import("react").ReactNode;
 *   statsClassName?: string;
 *   actionsClassName?: string;
 *   topContent?: import("react").ReactNode;
 *   children?: import("react").ReactNode;
 *   footer?: import("react").ReactNode;
 * }} props
 */
export default function SectionHubPage({
  eyebrow = "",
  title,
  description,
  icon: Icon,
  primaryAction = null,
  titleAction = null,
  stats,
  actions,
  headerAccessory = null,
  statsClassName = "",
  actionsClassName = "grid gap-3",
  topContent = null,
  children = null,
  footer = null,
}) {
  const PrimaryActionIcon = primaryAction?.icon;
  const TitleActionIcon = titleAction?.icon;

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: title }]} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            {eyebrow || title}
          </p>

          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-slate-900">
              {title}
            </h1>

            {titleAction ? (
              <button
                type="button"
                onClick={titleAction.onClick}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-[#FC2C38]"
                aria-label={titleAction.label}
                title={titleAction.label}
              >
                {TitleActionIcon ? (
                  <TitleActionIcon
                    aria-hidden="true"
                    className="h-5 w-5"
                    strokeWidth={2.5}
                  />
                ) : null}
              </button>
            ) : null}
          </div>
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
        <section
          className={`mb-5 grid grid-cols-3 gap-2 sm:gap-4 ${statsClassName}`}
        >
          {stats.map((stat) => (
            <StatTile key={stat.label} {...stat} />
          ))}
        </section>
      ) : null}

      {topContent}

      {children}

      <section className={actionsClassName}>
        {actions.filter(Boolean).map((action) => (
          <ActionRow key={action.title} {...action} />
        ))}
      </section>

      {footer}
    </PageContainer>
  );
}
