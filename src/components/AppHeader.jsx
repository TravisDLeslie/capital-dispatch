import { useEffect, useState } from "react";
import {
  ChevronDown,
  LogOut,
  Package,
  PackageCheck,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";
import capitalLumberLogo from "../assets/capital-lumber-logo-black-text.png";

const navigationItems = [
  {
    group: "Receiving",
    id: "check-in",
    label: "Check In Items",
  },
  {
    group: "Receiving",
    id: "today",
    label: "Today's Checked In Items",
  },
  {
    group: "Receiving",
    id: "search",
    label: "Search POs",
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
    group: "Sales",
    id: "customers-add",
    label: "Add Customer",
  },
  {
    group: "Sales",
    id: "customers-view",
    label: "View Customers",
  },
  {
    group: "Admin",
    id: "user-admin",
    label: "User Access",
  },
];

function getNavButtonClass(isActive, isMobile = false) {
  const activeClass = "text-[#FC2C38]";
  const inactiveClass =
    "text-slate-900 hover:bg-slate-50 hover:text-[#FC2C38]";

  return `${isMobile ? "px-4 py-2.5" : "px-7 py-2.5"} flex w-full items-center gap-4 rounded-xl text-left text-sm font-semibold transition ${
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

  if (group === "Sales") {
    return UsersRound;
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
    South: false,
    Deliveries: false,
    Sales: false,
    Admin: false,
  });
  const userInitial = (
    currentUser?.displayName ||
    currentUser?.email ||
    "U"
  )
    .trim()
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    const currentItem = navigationItems.find(
      (item) => item.id === currentPage,
    );

    if (!currentItem) {
      return;
    }

    setOpenNavGroups({
      Receiving: false,
      South: false,
      Deliveries: false,
      Sales: false,
      Admin: false,
      [currentItem.group]: true,
    });
  }, [currentPage]);

  function handlePageChange(pageId) {
    onPageChange(pageId);
    setIsMenuOpen(false);
  }

  function toggleNavGroup(group) {
    setOpenNavGroups((currentOpenNavGroups) => {
      const nextIsOpen = !currentOpenNavGroups[group];

      return {
        Receiving: false,
        South: false,
        Deliveries: false,
        Sales: false,
        Admin: false,
        [group]: nextIsOpen,
      };
    });
  }

  function renderNavigation(isMobile = false) {
    return ["Receiving", "South", "Deliveries", "Sales", "Admin"].map((group) => {
      const groupItems = navigationItems.filter((item) => {
        const pageIsAllowed =
          !allowedPageIds || allowedPageIds.includes(item.id);

        return item.group === group && pageIsAllowed;
      });
      const isGroupOpen = openNavGroups[group];
      const NavGroupIcon = getNavGroupIcon(group);
      const hasGroupItems = groupItems.length > 0;
      const groupIsActive = groupItems.some(
        (item) => item.id === currentPage,
      );

      return hasGroupItems ? (
        <div
          key={group}
          className="border-b border-slate-200 py-4 first:pt-0 last:border-b-0"
        >
          <button
            type="button"
            onClick={() => {
              if (hasGroupItems) {
                toggleNavGroup(group);
              }
            }}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-4 text-left text-lg font-black transition ${
              groupIsActive
                ? "bg-red-50 text-[#FC2C38]"
                : "text-slate-900 hover:bg-slate-50"
            }`}
            aria-expanded={isGroupOpen}
          >
            <span className="flex items-center gap-4 leading-none">
              <NavGroupIcon
                aria-hidden="true"
                className="h-6 w-6"
                strokeWidth={2.5}
              />
              {group}
            </span>
            {hasGroupItems ? (
              <span className="text-slate-400">
                <ChevronDown
                  aria-hidden="true"
                  className={`h-5 w-5 transition-transform ${
                    isGroupOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2.6}
                />
              </span>
            ) : null}
          </button>

          {hasGroupItems && isGroupOpen ? (
            <div className="mt-3 space-y-2">
              {groupItems.map((item) => {
                const isActive = currentPage === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePageChange(item.id)}
                    className={getNavButtonClass(isActive, isMobile)}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isActive ? "bg-[#FC2C38]" : "bg-slate-400"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white md:flex">
        <button
          type="button"
          onClick={() => handlePageChange("check-in")}
          className="block px-8 pb-8 pt-8 text-left"
        >
          <img
            src={capitalLumberLogo}
            alt="Capital Lumber Co."
            className="h-auto w-48"
          />
        </button>

        <nav className="min-h-0 flex-1 overflow-y-auto px-5">
          {renderNavigation()}
        </nav>

        <div className="border-t border-slate-200 p-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FC2C38] text-sm font-black text-white">
                {userInitial}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-slate-900">
                  {currentUser?.displayName ||
                    currentUser?.email ||
                    "Signed in"}
                </span>

                {isSuperAdmin ? (
                  <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                    Super Admin
                  </span>
                ) : currentUserProfile?.role ? (
                  <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    {currentUserProfile.role}
                  </span>
                ) : null}
              </span>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="flex w-full items-center gap-3 border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.3}
              />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white md:hidden">
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
              onClick={() => setIsMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200"
              aria-label="Open account menu"
            >
              {userInitial}
            </button>
          </div>
        </div>
      </header>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
          />

          <aside className="relative flex h-full w-[86vw] max-w-[340px] flex-col border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 pb-5 pt-6">
              <button
                type="button"
                onClick={() => handlePageChange("check-in")}
                className="min-w-0 text-left"
              >
                <img
                  src={capitalLumberLogo}
                  alt="Capital Lumber Co."
                  className="h-auto w-44 max-w-full"
                />
              </button>

              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-semibold leading-none text-slate-600 shadow-sm"
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-5">
              {renderNavigation(true)}
            </nav>

            <div className="border-t border-slate-200 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-600">
                    {currentUser?.displayName ||
                      currentUser?.email ||
                      "Signed in"}
                  </span>

                  {isSuperAdmin ? (
                    <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Super Admin
                    </span>
                  ) : currentUserProfile?.role ? (
                    <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      {currentUserProfile.role}
                    </span>
                  ) : null}
                </span>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <LogOut
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={2.3}
                  />
                  Sign out
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
