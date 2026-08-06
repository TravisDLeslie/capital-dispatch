import { useEffect, useState } from "react";
import {
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Package,
  PackageCheck,
  Plus,
  ShieldCheck,
  Truck,
  Wrench,
  UserRound,
  UsersRound,
} from "lucide-react";
import capitalLumberLogo from "../assets/capital-lumber-logo-black-text.png";

const navigationItems = [
  {
    group: "Dashboard",
    id: "dashboard",
    label: "Dashboard",
  },
  {
    group: "Receiving",
    id: "receiving",
    label: "Receiving",
  },
  {
    group: "South",
    id: "south",
    label: "South",
  },
  {
    group: "Deliveries",
    id: "deliveries",
    label: "Deliveries",
  },
  {
    group: "Sales",
    id: "sales",
    label: "Sales",
  },
  {
    group: "Admin",
    id: "admin",
    label: "Admin",
  },
  {
    group: "Fleet",
    id: "fleet",
    label: "Fleet",
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

function getActionNavButtonClass(isActive, isMobile = false) {
  const stateClass = isActive
    ? "bg-[#FC2C38] text-white shadow-sm"
    : "bg-red-50 text-[#FC2C38] hover:bg-[#FC2C38] hover:text-white hover:shadow-sm";

  return `${
    isMobile ? "px-4 py-3" : "px-5 py-3"
  } group flex w-full items-center gap-3 rounded-xl text-left text-sm font-black transition ${stateClass}`;
}

function getCurrentPageLabel(currentPage) {
  if (String(currentPage || "").startsWith("supplier-runs")) {
    return "South";
  }

  if (["check-in", "today", "search"].includes(currentPage)) {
    return "Receiving";
  }

  if (String(currentPage || "").startsWith("deliveries-")) {
    return "Deliveries";
  }

  if (
    String(currentPage || "").startsWith("customers-") ||
    currentPage === "customer-payment-links" ||
    currentPage === "sales-converter" ||
    currentPage === "sales-report"
  ) {
    return "Sales";
  }

  if (
    ["user-admin", "email-list", "delivery-settings", "vendor-settings"].includes(
      currentPage,
    )
  ) {
    return "Admin";
  }

  if (["fleet", "bouncie"].includes(currentPage)) {
    return "Fleet";
  }

  const currentItem = navigationItems.find(
    (item) => item.id === currentPage,
  );

  if (!currentItem) {
    return "Check In";
  }

  return `${currentItem.group} / ${currentItem.label}`;
}

function getCurrentPageGroup(currentPage) {
  if (String(currentPage || "").startsWith("supplier-runs")) {
    return "South";
  }

  if (["receiving", "check-in", "today", "search"].includes(currentPage)) {
    return "Receiving";
  }

  if (
    currentPage === "deliveries" ||
    String(currentPage || "").startsWith("deliveries-")
  ) {
    return "Deliveries";
  }

  if (
    currentPage === "sales" ||
    String(currentPage || "").startsWith("customers-") ||
    currentPage === "customer-payment-links" ||
    currentPage === "sales-converter" ||
    currentPage === "sales-report"
  ) {
    return "Sales";
  }

  if (
    currentPage === "admin" ||
    ["user-admin", "email-list", "delivery-settings", "vendor-settings"].includes(
      currentPage,
    )
  ) {
    return "Admin";
  }

  if (currentPage === "fleet" || currentPage === "bouncie") {
    return "Fleet";
  }

  return navigationItems.find((item) => item.id === currentPage)?.group || "";
}

function getNavGroupIcon(group) {
  if (group === "South") {
    return Truck;
  }

  if (group === "Dashboard") {
    return LayoutDashboard;
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

  if (group === "Fleet") {
    return Wrench;
  }

  return Package;
}

/**
 * @param {{
 *   currentPage: string;
 *   onPageChange: (pageId: string) => void;
 *   currentUser: Record<string, any> | null;
 *   currentUserProfile: Record<string, any> | null;
 *   allowedPageIds?: string[];
 *   isSuperAdmin?: boolean;
 *   previewUsers?: Array<Record<string, any>>;
 *   selectedPreviewUserId?: string;
 *   onPreviewUserChange?: (userId: string) => void;
 *   onSignOut: () => void;
 * }} props
 */
export default function AppHeader({
  currentPage,
  onPageChange,
  currentUser,
  currentUserProfile,
  allowedPageIds,
  isSuperAdmin = false,
  previewUsers = [],
  selectedPreviewUserId = "",
  onPreviewUserChange,
  onSignOut,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openNavGroups, setOpenNavGroups] = useState({
    Dashboard: true,
    Receiving: true,
    South: false,
    Deliveries: false,
    Sales: false,
    Admin: false,
    Fleet: false,
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
    const currentGroup = getCurrentPageGroup(currentPage);

    if (!currentGroup) {
      return;
    }

    setOpenNavGroups({
      Dashboard: false,
      Receiving: false,
      South: false,
      Deliveries: false,
      Sales: false,
      Admin: false,
      Fleet: false,
      [currentGroup]: true,
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
        Dashboard: false,
        Receiving: false,
        South: false,
        Deliveries: false,
        Sales: false,
        Admin: false,
        Fleet: false,
        [group]: nextIsOpen,
      };
    });
  }

  function renderNavigation(isMobile = false) {
    return ["Dashboard", "Receiving", "South", "Deliveries", "Sales", "Admin", "Fleet"].map((group) => {
      const groupItems = navigationItems.filter((item) => {
        const pageIsAllowed =
          !allowedPageIds ||
          allowedPageIds.includes(item.id) ||
          (item.id === "south" &&
            allowedPageIds.some((pageId) =>
              String(pageId).startsWith("supplier-runs"),
            )) ||
          (item.id === "receiving" &&
            allowedPageIds.some((pageId) =>
              ["check-in", "today", "search"].includes(pageId),
            )) ||
          (item.id === "deliveries" &&
            allowedPageIds.some((pageId) =>
              String(pageId).startsWith("deliveries-"),
            )) ||
          (item.id === "sales" &&
            allowedPageIds.some(
              (pageId) =>
                String(pageId).startsWith("customers-") ||
                pageId === "customer-payment-links" ||
                pageId === "sales-converter" ||
                pageId === "sales-report",
            )) ||
          (item.id === "admin" &&
            allowedPageIds.some((pageId) =>
              [
                "user-admin",
                "email-list",
                "delivery-settings",
                "vendor-settings",
              ].includes(pageId),
            )) ||
          (item.id === "fleet" &&
            allowedPageIds.some((pageId) =>
              ["fleet", "bouncie"].includes(pageId),
            ));

        return item.group === group && pageIsAllowed;
      });
      const isGroupOpen = openNavGroups[group];
      const NavGroupIcon = getNavGroupIcon(group);
      const hasGroupItems = groupItems.length > 0;
      const groupIsActive = getCurrentPageGroup(currentPage) === group;
      const isSinglePageGroup = [
        "Dashboard",
        "Receiving",
        "South",
        "Deliveries",
        "Sales",
        "Admin",
        "Fleet",
      ].includes(group);

      return hasGroupItems ? (
        <div
          key={group}
          className="border-b border-slate-200 py-4 first:pt-0 last:border-b-0"
        >
          <button
            type="button"
            onClick={() => {
              if (isSinglePageGroup) {
                handlePageChange(groupItems[0].id);
              } else if (hasGroupItems) {
                toggleNavGroup(group);
              }
            }}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-4 text-left text-lg font-black transition ${
              groupIsActive
                ? "bg-red-50 text-[#FC2C38]"
                : "text-slate-900 hover:bg-slate-50"
            }`}
            aria-expanded={isSinglePageGroup ? undefined : isGroupOpen}
          >
            <span className="flex items-center gap-4 leading-none">
              <NavGroupIcon
                aria-hidden="true"
                className="h-6 w-6"
                strokeWidth={2.5}
              />
              {group}
            </span>
            {hasGroupItems && !isSinglePageGroup ? (
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

          {hasGroupItems && isGroupOpen && !isSinglePageGroup ? (
            <div className="mt-3 space-y-2">
              {groupItems.map((item) => {
                const isActive = currentPage === item.id;
                const isPrimaryAction = item.id === "supplier-runs-add";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePageChange(item.id)}
                    className={
                      isPrimaryAction
                        ? getActionNavButtonClass(isActive, isMobile)
                        : getNavButtonClass(isActive, isMobile)
                    }
                  >
                    {isPrimaryAction ? (
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition ${
                          isActive
                            ? "bg-white/20"
                            : "bg-[#FC2C38] text-white group-hover:bg-white/20"
                        }`}
                        aria-hidden="true"
                      >
                        <Plus className="h-4 w-4" strokeWidth={3} />
                      </span>
                    ) : (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isActive ? "bg-[#FC2C38]" : "bg-slate-400"
                        }`}
                        aria-hidden="true"
                      />
                    )}
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

  function getPreviewUserId(user) {
    return user?.uid || user?.id || user?.email || "";
  }

  function renderPreviewSelect() {
    if (!isSuperAdmin || !Array.isArray(previewUsers) || previewUsers.length === 0) {
      return null;
    }

    return (
      <label className="block border-b border-slate-200 px-4 py-3">
        <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          <UserRound
            aria-hidden="true"
            className="h-3.5 w-3.5"
            strokeWidth={2.5}
          />
          View App As
        </span>

        <select
          value={selectedPreviewUserId}
          onChange={(event) => onPreviewUserChange?.(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        >
          {previewUsers.map((previewUser) => {
            const previewUserId = getPreviewUserId(previewUser);
            const previewUserName =
              previewUser.displayName || previewUser.email || "User";
            const previewRole = previewUser.role || "pending";

            return (
              <option key={previewUserId} value={previewUserId}>
                {previewUserName} ({previewRole})
              </option>
            );
          })}
        </select>
      </label>
    );
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white md:flex">
        <button
          type="button"
          onClick={() => handlePageChange("dashboard")}
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
            {renderPreviewSelect()}

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
              onClick={() => handlePageChange("dashboard")}
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
                onClick={() => handlePageChange("dashboard")}
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
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                {renderPreviewSelect()}

                <div className="flex items-center gap-3 px-3 py-3">
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
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
