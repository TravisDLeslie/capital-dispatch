import { useState } from "react";
import capitalLumberLogo from "../assets/capital-lumber-logo-black-text.png";

const navigationItems = [
  {
    group: "Receiving",
    id: "check-in",
    label: "Check In",
  },
  {
    group: "Receiving",
    id: "today",
    label: "Today's Check-Ins",
  },
  {
    group: "Receiving",
    id: "search",
    label: "Search PO",
  },
  {
    group: "Driver",
    subtitle: "South",
    id: "supplier-runs-add",
    label: "Add POs",
  },
  {
    group: "Driver",
    subtitle: "South",
    id: "supplier-runs-check",
    label: "Check POs",
  },
  {
    group: "Driver",
    subtitle: "South",
    id: "supplier-runs-history",
    label: "History",
  },
];

function getNavButtonClass(item, isActive, isMobile = false) {
  const activeClass =
    item.group === "Driver"
      ? "bg-blue-700 text-white shadow-sm"
      : "bg-emerald-700 text-white shadow-sm";

  const inactiveClass =
    "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900";

  return `${isMobile ? "w-full justify-between" : "whitespace-nowrap"} flex items-center rounded-xl px-4 py-2.5 text-left text-sm font-bold transition ${
    isActive ? activeClass : inactiveClass
  }`;
}

function getCurrentPageLabel(currentPage) {
  const currentItem = navigationItems.find(
    (item) => item.id === currentPage,
  );

  if (!currentItem) {
    return "Check In";
  }

  return currentItem.subtitle
    ? `${currentItem.subtitle} / ${currentItem.label}`
    : currentItem.label;
}

export default function AppHeader({ currentPage, onPageChange }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function handlePageChange(pageId) {
    onPageChange(pageId);
    setIsMenuOpen(false);
  }

  function renderNavigation() {
    return ["Receiving", "Driver"].map((group) => (
      <div key={group} className="mb-3 last:mb-0">
        <p className="mb-2 px-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          {group}
        </p>

        {group === "Driver" ? (
          <p className="mb-2 px-2 text-sm font-black text-blue-800">
            South
          </p>
        ) : null}

        <div className="space-y-2">
          {navigationItems
            .filter((item) => item.group === group)
            .map((item) => {
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePageChange(item.id)}
                  className={getNavButtonClass(
                    item,
                    isActive,
                    true,
                  )}
                >
                  <span>{item.label}</span>
                  {isActive ? (
                    <span className="text-xs uppercase tracking-wide opacity-75">
                      Open
                    </span>
                  ) : null}
                </button>
              );
            })}
        </div>
      </div>
    ));
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 md:block">
        <button
          type="button"
          onClick={() => handlePageChange("check-in")}
          className="mb-8 block text-left"
        >
          <img
            src={capitalLumberLogo}
            alt="Capital Lumber Co."
            className="h-auto w-44"
          />

          <p className="mt-2 text-sm font-black tracking-tight text-slate-900">
            Dispatch CL
          </p>
        </button>

        <nav>{renderNavigation()}</nav>
      </aside>

      <header className="border-b border-slate-200 bg-white md:hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex min-h-20 items-center justify-between gap-4 py-4">
            <button
              type="button"
              onClick={() => handlePageChange("check-in")}
              className="min-w-0 text-left"
            >
              <img
                src={capitalLumberLogo}
                alt="Capital Lumber Co."
                className="h-auto w-36 max-w-[52vw]"
              />

              <p className="mt-1 text-sm font-black tracking-tight text-slate-900">
                Dispatch CL
              </p>
            </button>

            <button
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 shadow-sm transition hover:bg-slate-100"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
            >
              <span className="flex w-5 flex-col gap-1.5">
                <span
                  className={`h-0.5 rounded-full bg-current transition ${
                    isMenuOpen
                      ? "translate-y-2 rotate-45"
                      : ""
                  }`}
                />
                <span
                  className={`h-0.5 rounded-full bg-current transition ${
                    isMenuOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`h-0.5 rounded-full bg-current transition ${
                    isMenuOpen
                      ? "-translate-y-2 -rotate-45"
                      : ""
                  }`}
                />
              </span>

              <span className="hidden text-sm font-black sm:block">
                {getCurrentPageLabel(currentPage)}
              </span>
            </button>
          </div>

        {isMenuOpen ? (
          <nav className="pb-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
              {renderNavigation()}
            </div>
          </nav>
        ) : null}
        </div>
      </header>
    </>
  );
}
