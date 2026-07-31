import { useEffect, useState } from "react";
import {
  ChevronDown,
  Package,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
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
    group: "South",
    id: "supplier-runs-add",
    label: "Add POs for South",
  },
  {
    group: "South",
    id: "supplier-runs-check",
    label: "View POs To Pick Up",
  },
  {
    group: "South",
    id: "supplier-runs-history",
    label: "South PO History",
  },
  {
    group: "Deliveries",
    id: "deliveries-add",
    label: "Add Deliveries",
  },
  {
    group: "Deliveries",
    id: "deliveries-queue",
    label: "Deliveries",
  },
  {
    group: "Deliveries",
    id: "deliveries-history",
    label: "Delivery History",
  },
  {
    group: "Admin",
    id: "user-admin",
    label: "User Access",
  },
];

function getNavButtonClass(item, isActive, isMobile = false) {
  const activeClass =
    item.group === "South"
      ? "bg-blue-700 text-white shadow-sm"
      : item.group === "Deliveries"
        ? "bg-[#FC2C38] text-white shadow-sm"
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

  return `${currentItem.group} / ${currentItem.label}`;
}

function getNavGroupIcon(group) {
  if (group === "South") {
    return Truck;
  }

  if (group === "Deliveries") {
    return PackageCheck;
  }

  if (group === "Admin") {
    return ShieldCheck;
  }

  return Package;
}

export default function AppHeader({
  currentPage,
  onPageChange,
  currentUser,
  currentUserProfile,
  allowedPageIds,
  isSuperAdmin = false,
  onSignOut,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openNavGroups, setOpenNavGroups] = useState({
    Receiving: true,
    South: true,
    Deliveries: true,
    Admin: true,
  });

  useEffect(() => {
    const currentItem = navigationItems.find(
      (item) => item.id === currentPage,
    );

    if (!currentItem) {
      return;
    }

    setOpenNavGroups((currentOpenNavGroups) => ({
      ...currentOpenNavGroups,
      [currentItem.group]: true,
    }));
  }, [currentPage]);

  function handlePageChange(pageId) {
    onPageChange(pageId);
    setIsMenuOpen(false);
  }

  function toggleNavGroup(group) {
    setOpenNavGroups((currentOpenNavGroups) => ({
      ...currentOpenNavGroups,
      [group]: !currentOpenNavGroups[group],
    }));
  }

  function renderNavigation() {
    return ["Receiving", "South", "Deliveries", "Admin"].map((group) => {
      const groupItems = navigationItems.filter((item) => {
        const pageIsAllowed =
          !allowedPageIds || allowedPageIds.includes(item.id);

        return item.group === group && pageIsAllowed;
      });
      const isGroupOpen = openNavGroups[group];
      const NavGroupIcon = getNavGroupIcon(group);
      const hasGroupItems = groupItems.length > 0;
      const groupColorClass =
        group === "South"
          ? "text-blue-800"
          : group === "Deliveries"
            ? "text-[#FC2C38]"
            : "text-emerald-800";

      return hasGroupItems ? (
        <div
          key={group}
          className="mb-5 border-b border-slate-200 pb-4 last:mb-0 last:border-b-0 last:pb-0"
        >
          <button
            type="button"
            onClick={() => {
              if (hasGroupItems) {
                toggleNavGroup(group);
              }
            }}
            className={`mb-3 flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-base font-black uppercase tracking-[0.16em] transition ${
              hasGroupItems ? "hover:bg-slate-100" : "cursor-default"
            } ${groupColorClass}`}
            aria-expanded={isGroupOpen}
          >
            <span className="flex items-center gap-2 text-[17px] font-black leading-none">
              <NavGroupIcon
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.5}
              />
              {group}
            </span>
            {hasGroupItems ? (
              <span className="text-slate-400">
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 transition-transform ${
                    isGroupOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2.6}
                />
              </span>
            ) : null}
          </button>

          {hasGroupItems && isGroupOpen ? (
            <div className="space-y-2 pl-2">
              {groupItems.map((item) => {
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
          ) : null}
        </div>
      ) : null;
    });
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

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="truncate text-sm font-black text-slate-900">
            {currentUser?.email || "Signed in"}
          </p>

          {isSuperAdmin ? (
            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">
              Super Admin
            </p>
          ) : currentUserProfile?.role ? (
            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              {currentUserProfile.role}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <header className="border-b border-slate-200 bg-white md:hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex min-h-20 items-center justify-between gap-4 py-4">
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

            <button
              type="button"
              onClick={() => handlePageChange("check-in")}
              className="min-w-0 flex-1 text-center"
            >
              <img
                src={capitalLumberLogo}
                alt="Capital Lumber Co."
                className="mx-auto h-auto w-36 max-w-[52vw]"
              />
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="h-10 w-[62px] shrink-0 rounded-xl text-sm font-black text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
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
