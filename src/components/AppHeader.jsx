import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
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
import capitalLumberLogo from "../assets/capital-lumber-new.svg";

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
    group: "Yard Tasks",
    id: "yard-tasks",
    label: "Yard Tasks",
  },
  {
    group: "Dispatch",
    id: "dispatch",
    label: "Dispatch",
  },
  {
    group: "South",
    id: "south",
    label: "Inbound POs",
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
    group: "Documents",
    id: "documents",
    label: "Documents",
  },
  {
    group: "Accounting",
    id: "accounting",
    label: "Accounting",
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
  const activeClass = "bg-white/10 text-white";
  const inactiveClass =
    "text-white/80 hover:bg-white/10 hover:text-white";

  return `${isMobile ? "px-4 py-2.5" : "px-7 py-2.5"} flex w-full items-center gap-4 rounded-xl text-left text-sm font-semibold transition ${
    isActive ? activeClass : inactiveClass
  }`;
}

function getActionNavButtonClass(isActive, isMobile = false) {
  const stateClass = isActive
    ? "bg-[#FC2C38] text-white shadow-sm"
    : "bg-white/10 text-white hover:bg-[#FC2C38] hover:text-white hover:shadow-sm";

  return `${
    isMobile ? "px-4 py-3" : "px-5 py-3"
  } group flex w-full items-center gap-3 rounded-xl text-left text-sm font-black transition ${stateClass}`;
}

function getCurrentPageLabel(currentPage) {
  if (
    String(currentPage || "").startsWith("supplier-runs") ||
    currentPage === "south-overview" ||
    currentPage === "their-truck-pos" ||
    currentPage === "their-truck-overview" ||
    currentPage === "south-calendar" ||
    currentPage === "their-truck-calendar" ||
    currentPage === "their-truck-history" ||
    currentPage === "po-calendar"
  ) {
    return "Inbound POs";
  }

  if (["check-in", "today", "search", "trace"].includes(currentPage)) {
    return "Receiving";
  }

  if (currentPage === "yard-tasks") {
    return "Yard Tasks";
  }

  if (currentPage === "dispatch") {
    return "Dispatch";
  }

  if (String(currentPage || "").startsWith("deliveries-")) {
    return "Deliveries";
  }

  if (
    String(currentPage || "").startsWith("customers-") ||
    currentPage === "sales-orders" ||
    currentPage === "sales-tools" ||
    currentPage === "sales-converter"
  ) {
    return "Sales";
  }

  if (["documents", "stocking-handbook"].includes(currentPage)) {
    return "Documents";
  }

  if (
    currentPage === "accounting" ||
    currentPage === "accounting-customers" ||
    currentPage === "customer-payment-links"
  ) {
    return "Accounting";
  }

  if (
    [
      "user-admin",
      "email-list",
      "delivery-settings",
      "vendor-settings",
      "order-flow",
      "sales-report",
    ].includes(currentPage)
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
  if (
    String(currentPage || "").startsWith("supplier-runs") ||
    currentPage === "south-overview" ||
    currentPage === "their-truck-pos" ||
    currentPage === "their-truck-overview" ||
    currentPage === "south-calendar" ||
    currentPage === "their-truck-calendar" ||
    currentPage === "their-truck-history" ||
    currentPage === "po-calendar"
  ) {
    return "South";
  }

  if (["receiving", "check-in", "today", "search", "trace"].includes(currentPage)) {
    return "Receiving";
  }

  if (currentPage === "yard-tasks") {
    return "Yard Tasks";
  }

  if (currentPage === "dispatch") {
    return "Dispatch";
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
    currentPage === "sales-orders" ||
    currentPage === "sales-tools" ||
    currentPage === "sales-converter"
  ) {
    return "Sales";
  }

  if (["documents", "stocking-handbook"].includes(currentPage)) {
    return "Documents";
  }

  if (
    currentPage === "accounting" ||
    currentPage === "accounting-customers" ||
    currentPage === "customer-payment-links"
  ) {
    return "Accounting";
  }

  if (
    currentPage === "admin" ||
    [
      "user-admin",
      "email-list",
      "delivery-settings",
      "vendor-settings",
      "order-flow",
      "sales-report",
    ].includes(currentPage)
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

  if (group === "Yard Tasks") {
    return ClipboardList;
  }

  if (group === "Dispatch") {
    return ClipboardCheck;
  }

  if (group === "Documents") {
    return BookOpen;
  }

  if (group === "Accounting") {
    return DollarSign;
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
 *   effectiveUserRole?: string;
 *   allowedPageIds?: string[];
 *   isDriverView?: boolean;
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
  effectiveUserRole = "",
  allowedPageIds,
  isDriverView = false,
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
    "Yard Tasks": false,
    Dispatch: false,
    South: false,
    Deliveries: false,
    Sales: false,
    Documents: false,
    Accounting: false,
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
  const southGroupLabel = isDriverView ? "South" : "Inbound POs";

  useEffect(() => {
    const currentGroup = getCurrentPageGroup(currentPage);

    if (!currentGroup) {
      return;
    }

    setOpenNavGroups({
      Dashboard: false,
      Receiving: false,
      "Yard Tasks": false,
      Dispatch: false,
      South: false,
      Deliveries: false,
      Sales: false,
      Documents: false,
      Accounting: false,
      Admin: false,
      Fleet: false,
      [currentGroup]: true,
    });
  }, [allowedPageIds, currentPage]);

  function handlePageChange(pageId) {
    onPageChange(pageId);
    setIsMenuOpen(false);
  }

  function getPrimaryGroupPageId(groupItems, group) {
    if (group === "South" && isDriverView) {
      return allowedPageIds?.includes("supplier-runs-check")
        ? "supplier-runs-check"
        : groupItems[0].id;
    }

    return groupItems[0].id;
  }

  function toggleNavGroup(group) {
    setOpenNavGroups((currentOpenNavGroups) => {
      const nextIsOpen = !currentOpenNavGroups[group];

      return {
        Dashboard: false,
        Receiving: false,
        "Yard Tasks": false,
        Dispatch: false,
        South: false,
        Deliveries: false,
        Sales: false,
        Documents: false,
        Accounting: false,
        Admin: false,
        Fleet: false,
        [group]: nextIsOpen,
      };
    });
  }

  function getSouthDropdownLinks() {
    if (isDriverView) {
      return [];
    }

    const pageAllowed = (pageId) =>
      !allowedPageIds || allowedPageIds.includes(pageId);
    const hasAllowedPage = (pageIds) =>
      !allowedPageIds ||
      pageIds.some((pageId) => allowedPageIds.includes(pageId));
    const southPageId = pageAllowed("south-overview")
      ? "south-overview"
      : "south";
    const theirTruckPageId =
      (pageAllowed("their-truck-overview") && "their-truck-overview") ||
      (pageAllowed("their-truck-pos") && "their-truck-pos") ||
      (pageAllowed("their-truck-calendar") &&
        "their-truck-calendar") ||
      (pageAllowed("their-truck-history") &&
        "their-truck-history") ||
      "";

    return [
      hasAllowedPage([
        "south",
        "south-overview",
        "supplier-runs-add",
        "supplier-runs-dispatch",
        "supplier-runs-check",
        "supplier-runs-calendar",
        "south-calendar",
        "supplier-runs-history",
      ])
        ? {
            id: "po-south",
            label: "South Pickups",
            pageId: southPageId,
            isActive:
              currentPage === "south-overview" ||
              String(currentPage || "").startsWith("supplier-runs") ||
              currentPage === "south-calendar",
          }
        : null,
      theirTruckPageId
        ? {
            id: "po-their-truck",
            label: "Their Truck",
            pageId: theirTruckPageId,
            isActive:
              currentPage === "their-truck-pos" ||
              currentPage === "their-truck-overview" ||
              currentPage === "their-truck-calendar" ||
              currentPage === "their-truck-history",
          }
        : null,
    ].filter(Boolean);
  }

  function getSalesDropdownLinks() {
    const pageAllowed = (pageId) =>
      !allowedPageIds || allowedPageIds.includes(pageId);

    return [
      pageAllowed("sales-orders")
        ? {
            id: "sales-orders",
            label: "Orders",
            pageId: "sales-orders",
          }
        : null,
      pageAllowed("customers-view")
        ? {
            id: "sales-customers",
            label: "Customers",
            pageId: "customers-view",
          }
        : null,
      pageAllowed("sales-tools") ||
      pageAllowed("sales-converter")
        ? {
            id: "sales-tools",
            label: "Price Converter",
            pageId: pageAllowed("sales-tools")
              ? "sales-tools"
              : "sales-converter",
          }
        : null,
    ]
      .filter(Boolean)
      .map((link) => ({
        ...link,
        isActive:
          currentPage === link.pageId ||
          (link.id === "sales-tools" &&
            ["sales-tools", "sales-converter"].includes(
              currentPage,
            )),
      }));
  }

  function getAccountingDropdownLinks() {
    const pageAllowed = (pageId) =>
      !allowedPageIds || allowedPageIds.includes(pageId);

    return [
      pageAllowed("accounting-customers")
        ? {
            id: "accounting-customers",
            label: "Customers",
            pageId: "accounting-customers",
          }
        : null,
      pageAllowed("customer-payment-links")
        ? {
            id: "accounting-payment-links",
            label: "Payment Links",
            pageId: "customer-payment-links",
          }
        : null,
    ]
      .filter(Boolean)
      .map((link) => ({
        ...link,
        isActive: currentPage === link.pageId,
      }));
  }

  function getDeliveriesDropdownLinks() {
    if (!["superAdmin", "admin"].includes(effectiveUserRole)) {
      return [];
    }

    const pageAllowed = (pageId) =>
      !allowedPageIds || allowedPageIds.includes(pageId);

    return [
      pageAllowed("deliveries-dispatch")
        ? {
            id: "deliveries-needs-dispatch",
            label: "Needs Dispatch",
            pageId: "deliveries-dispatch",
          }
        : null,
      pageAllowed("deliveries-calendar")
        ? {
            id: "deliveries-calendar",
            label: "Delivery Calendar",
            pageId: "deliveries-calendar",
          }
        : null,
      pageAllowed("deliveries-queue")
        ? {
            id: "deliveries-upcoming",
            label: "View Upcoming Deliveries",
            pageId: "deliveries-queue",
          }
        : null,
      pageAllowed("deliveries-history")
        ? {
            id: "deliveries-past-history",
            label: "Past History",
            pageId: "deliveries-history",
          }
        : null,
    ]
      .filter(Boolean)
      .map((link) => ({
        ...link,
        isActive: currentPage === link.pageId,
      }));
  }

  function renderNavigation(isMobile = false) {
    return ["Dashboard", "Receiving", "Yard Tasks", "Dispatch", "South", "Deliveries", "Sales", "Documents", "Accounting", "Admin", "Fleet"].map((group) => {
      const groupItems = navigationItems.filter((item) => {
        const pageIsAllowed =
          !allowedPageIds ||
          allowedPageIds.includes(item.id) ||
          (item.id === "south" &&
            allowedPageIds.some((pageId) =>
              String(pageId).startsWith("supplier-runs") ||
              pageId === "south-overview" ||
              pageId === "their-truck-pos" ||
              pageId === "their-truck-overview" ||
              pageId === "south-calendar" ||
              pageId === "their-truck-calendar" ||
              pageId === "their-truck-history" ||
              pageId === "po-calendar",
            )) ||
          (item.id === "receiving" &&
            allowedPageIds.some((pageId) =>
              ["check-in", "today", "search", "trace"].includes(pageId),
            )) ||
          (item.id === "yard-tasks" &&
            allowedPageIds.includes("yard-tasks")) ||
          (item.id === "dispatch" &&
            allowedPageIds.includes("dispatch")) ||
          (item.id === "deliveries" &&
            allowedPageIds.some((pageId) =>
              String(pageId).startsWith("deliveries-"),
            )) ||
          (item.id === "sales" &&
            allowedPageIds.includes("sales") &&
            allowedPageIds.some(
              (pageId) =>
                String(pageId).startsWith("customers-") ||
                pageId === "sales-orders" ||
                pageId === "sales-tools" ||
                pageId === "sales-converter",
            )) ||
          (item.id === "documents" &&
            allowedPageIds.some((pageId) =>
              ["documents", "stocking-handbook"].includes(pageId),
            )) ||
          (item.id === "accounting" &&
            allowedPageIds.some((pageId) =>
              [
                "accounting",
                "accounting-customers",
                "customer-payment-links",
              ].includes(pageId),
            )) ||
          (item.id === "admin" &&
            allowedPageIds.some((pageId) =>
              [
                "user-admin",
                "email-list",
                "delivery-settings",
                "vendor-settings",
                "order-flow",
                "sales-report",
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
      const currentPageGroup = getCurrentPageGroup(currentPage);
      const groupIsActive = currentPageGroup === group;
      const southDropdownLinks =
        group === "South" ? getSouthDropdownLinks() : [];
      const deliveriesDropdownLinks =
        group === "Deliveries" ? getDeliveriesDropdownLinks() : [];
      const salesDropdownLinks =
        group === "Sales" ? getSalesDropdownLinks() : [];
      const accountingDropdownLinks =
        group === "Accounting" ? getAccountingDropdownLinks() : [];
      const shouldShowSouthDropdown =
        group === "South" && isGroupOpen && southDropdownLinks.length > 0;
      const shouldShowDeliveriesDropdown =
        group === "Deliveries" &&
        isGroupOpen &&
        deliveriesDropdownLinks.length > 0;
      const shouldShowSalesDropdown =
        group === "Sales" && isGroupOpen && salesDropdownLinks.length > 0;
      const shouldShowAccountingDropdown =
        group === "Accounting" &&
        isGroupOpen &&
        accountingDropdownLinks.length > 0;
      const isSinglePageGroup = [
        "Dashboard",
        "Receiving",
        "Yard Tasks",
        "Dispatch",
        "South",
        "Deliveries",
        "Sales",
        "Documents",
        "Accounting",
        "Admin",
        "Fleet",
      ].includes(group);

      return hasGroupItems ? (
        <div
          key={group}
          className="border-b border-white/10 py-4 first:pt-0 last:border-b-0"
        >
          <div
            className={`flex w-full items-center rounded-xl transition ${
              groupIsActive
                ? "bg-[#FC2C38] text-white"
                : "text-white hover:bg-white/10"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (isSinglePageGroup) {
                  handlePageChange(getPrimaryGroupPageId(groupItems, group));
                } else if (hasGroupItems) {
                  toggleNavGroup(group);
                }
              }}
              className="flex min-w-0 flex-1 items-center gap-4 rounded-l-xl px-4 py-4 text-left text-lg font-black"
              aria-expanded={
                shouldShowSouthDropdown ||
                shouldShowDeliveriesDropdown ||
                shouldShowSalesDropdown ||
                shouldShowAccountingDropdown ||
                !isSinglePageGroup
                  ? isGroupOpen
                  : undefined
              }
            >
              <NavGroupIcon
                aria-hidden="true"
                className="h-6 w-6 shrink-0"
                strokeWidth={2.5}
              />
              <span className="min-w-0 truncate">
                {group === "South" ? southGroupLabel : group}
              </span>
            </button>

            {(group === "South" && southDropdownLinks.length > 0) ||
            (group === "Deliveries" &&
              deliveriesDropdownLinks.length > 0) ||
            (group === "Sales" && salesDropdownLinks.length > 0) ||
            (group === "Accounting" && accountingDropdownLinks.length > 0) ? (
              <button
                type="button"
                onClick={() => toggleNavGroup(group)}
                className="flex h-full min-h-[56px] w-12 shrink-0 items-center justify-center rounded-r-xl text-white/70 transition hover:text-white"
                aria-label={`${isGroupOpen ? "Collapse" : "Open"} ${
                  group === "South" ? southGroupLabel : group
                } menu`}
                aria-expanded={isGroupOpen}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`h-5 w-5 transition-transform ${
                    isGroupOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2.6}
                />
              </button>
            ) : hasGroupItems && !isSinglePageGroup ? (
              <span className="pr-4 text-white/70">
                <ChevronDown
                  aria-hidden="true"
                  className={`h-5 w-5 transition-transform ${
                    isGroupOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2.6}
                />
              </span>
            ) : null}
          </div>

          {shouldShowSouthDropdown ? (
            <div className="mt-3 space-y-2 pl-5">
              {southDropdownLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handlePageChange(link.pageId)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-black transition ${
                    link.isActive
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      link.isActive ? "bg-white" : "bg-white/40"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {shouldShowDeliveriesDropdown ? (
            <div className="mt-3 space-y-2 pl-5">
              {deliveriesDropdownLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handlePageChange(link.pageId)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-black transition ${
                    link.isActive
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      link.isActive ? "bg-white" : "bg-white/40"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {shouldShowSalesDropdown ? (
            <div className="mt-3 space-y-2 pl-5">
              {salesDropdownLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handlePageChange(link.pageId)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-black transition ${
                    link.isActive
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      link.isActive ? "bg-white" : "bg-white/40"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {shouldShowAccountingDropdown ? (
            <div className="mt-3 space-y-2 pl-5">
              {accountingDropdownLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handlePageChange(link.pageId)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-black transition ${
                    link.isActive
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      link.isActive ? "bg-white" : "bg-white/40"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

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
                          isActive ? "bg-white" : "bg-white/40"
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
      <label className="block border-b border-white/10 px-4 py-3">
        <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
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
          className="w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-xs font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-500/20"
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-white/10 bg-[#1e1e1e] md:flex">
        <button
          type="button"
          onClick={() => handlePageChange("dashboard")}
          className="block px-8 pb-8 pt-8 text-left"
        >
          <img
            src={capitalLumberLogo}
            alt="Capital Lumber Co."
            className="h-auto w-52"
          />
        </button>

        <nav className="min-h-0 flex-1 overflow-y-auto px-5">
          {renderNavigation()}
        </nav>

        <div className="border-t border-white/10 p-5">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-sm">
            {renderPreviewSelect()}

            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FC2C38] text-sm font-black text-white">
                {userInitial}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-white">
                  {currentUser?.displayName ||
                    currentUser?.email ||
                    "Signed in"}
                </span>

                {isSuperAdmin ? (
                  <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                    Super Admin
                  </span>
                ) : currentUserProfile?.role ? (
                  <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                    {currentUserProfile.role}
                  </span>
                ) : null}
              </span>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
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

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1e1e1e] md:hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex min-h-20 items-center justify-between gap-4 py-4">
            <button
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex shrink-0 items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-white shadow-sm transition hover:bg-white/10"
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
                className="mx-auto h-auto w-40 max-w-[52vw]"
              />
            </button>

            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white ring-1 ring-white/15 transition hover:bg-white/15"
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

          <aside className="relative flex h-full w-[86vw] max-w-[340px] flex-col border-r border-white/10 bg-[#1e1e1e] shadow-2xl">
            <div className="flex items-center justify-between px-6 pb-5 pt-6">
              <button
                type="button"
                onClick={() => handlePageChange("dashboard")}
                className="min-w-0 text-left"
              >
                <img
                  src={capitalLumberLogo}
                  alt="Capital Lumber Co."
                  className="h-auto w-48 max-w-full"
                />
              </button>

              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl font-semibold leading-none text-white shadow-sm"
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-5">
              {renderNavigation(true)}
            </nav>

            <div className="border-t border-white/10 px-5 py-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 shadow-sm">
                {renderPreviewSelect()}

                <div className="flex items-center gap-3 px-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-white">
                    {currentUser?.displayName ||
                      currentUser?.email ||
                      "Signed in"}
                  </span>

                  {isSuperAdmin ? (
                    <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
                      Super Admin
                    </span>
                  ) : currentUserProfile?.role ? (
                    <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
                      {currentUserProfile.role}
                    </span>
                  ) : null}
                </span>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-white/10"
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
