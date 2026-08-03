import { ChevronRight } from "lucide-react";

export default function Breadcrumbs({ items }) {
  const visibleItems = Array.isArray(items)
    ? items.filter((item) => item && item.label)
    : [];

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <nav
      className="mb-4 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400"
      aria-label="Breadcrumb"
    >
      {visibleItems.map((item, index) => {
        const isLast = index === visibleItems.length - 1;

        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-[#FC2C38] transition hover:text-red-700"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? "text-[#FC2C38]" : ""}>
                {item.label}
              </span>
            )}

            {!isLast ? (
              <ChevronRight
                aria-hidden="true"
                className="h-3.5 w-3.5 text-slate-300"
                strokeWidth={3}
              />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
