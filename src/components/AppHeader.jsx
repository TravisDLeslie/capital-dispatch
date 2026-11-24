import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  LogOut,
  LayoutDashboard,
  MessagesSquare,
  Package,
  PackageCheck,
  Plus,
  ShieldCheck,
  Truck,
  Wrench,
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
    group: "Orders",
    id: "order-flow",
    label: "New Order",
  },
  {
    group: "Orders",
    id: "order-builds",
    label: "Open Orders",
  },
  {
    group: "Yard Tasks",
    id: "yard-tasks",
    label: "Yard Tasks",
  },
  {
    group: "Yard Documents",
    id: "yard-documents",
    label: "Yard Documents",
    workView: "receiving",
  },
  {
    group: "Dispatch",
    id: "dispatch",
    label: "Dispatch",
  },
  {
    group: "South",
    id: "south",
    label: "Fulfillment",
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
    group: "Quote Requests",
    id: "quote-requests",
    label: "Quote Requests",
  },
  {
    group: "Documents",
    id: "documents",
    label: "Documents",
  },
  {
    group: "Documents",
    id: "yard-documents",
    label: "Yard Documents",
    workView: "outside-receiving",
  },
  {
    group: "Accounting",
    id: "accounting",
    label: "Accounting",
  },
  {
    group: "Suppliers",
    id: "supplier-chat",
    label: "Supplier Pricing",
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

const navigationGroupOrder = [
  "Dashboard",
  "Orders",
  "Dispatch",
  "South",
  "Deliveries",
  "Yard Tasks",
  "Yard Documents",
  "Sales",
  "Quote Requests",
  "Suppliers",
  "Documents",
  "Accounting",
  "Admin",
  "Fleet",
];

const navigationGroupSections = {
  Dashboard: "Main",
  Orders: "Main",
  Dispatch: "Operations",
  South: "Operations",
  Deliveries: "Operations",
  "Yard Tasks": "Operations",
  "Yard Documents": "Operations",
  Sales: "Customers & Suppliers",
  "Quote Requests": "Customers & Suppliers",
  Suppliers: "Customers & Suppliers",
  Documents: "Resources",
  Accounting: "Resources",
  Admin: "Management",
  Fleet: "Management",
};

const newHomeNavigationItems = [
  {
    id: "new-home",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    id: "order-flow",
    label: "Orders",
    icon: ClipboardList,
  },
  {
    id: "new-fulfillment",
    label: "Fulfillment",
    icon: Truck,
  },
  {
    id: "new-build",
    label: "Build",
    icon: Package,
  },
  {
    id: "dispatch",
    label: "Dispatch",
    icon: ClipboardCheck,
  },
  {
    id: "deliveries",
    label: "Deliveries",
    icon: PackageCheck,
  },
  {
    id: "documents",
    label: "Documents",
    icon: BookOpen,
  },
];

function getNavButtonClass(isActive, isMobile = false) {
  const activeClass = "bg-white/10 text-white";
  const inactiveClass =
    "text-white/80 hover:bg-white/10 hover:text-white";

  return `${isMobile ? "gap-4 px-4 py-2.5 text-sm" : "gap-3 px-4 py-2 text-[13px]"} flex w-full items-center rounded-xl text-left font-semibold transition ${
    isActive ? activeClass : inactiveClass
  }`;
}

function getActionNavButtonClass(isActive, isMobile = false) {
  const stateClass = isActive
    ? "bg-[#FC2C38] text-white shadow-sm"
    : "bg-white/10 text-white hover:bg-[#FC2C38] hover:text-white hover:shadow-sm";

  return `${
    isMobile ? "px-4 py-3 text-sm" : "px-4 py-2 text-[13px]"
  } group flex w-full items-center gap-3 rounded-xl text-left font-black transition ${stateClass}`;
}

function getCurrentPageLabel(currentPage) {
  if (currentPage === "new-home") {
    return "New Home";
  }

  if (
    [
      "new-overview",
      "new-orders",
      "new-fulfillment",
      "new-build",
      "new-dispatch",
      "new-deliveries",
      "new-documents",
    ].includes(currentPage)
  ) {
    return "New App Flow";
  }

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
    return "Fulfillment";
  }

  if (["check-in", "today", "search", "trace"].includes(currentPage)) {
    return "Receiving";
  }

  if (currentPage === "yard-tasks") {
    return "Yard Tasks";
  }

  if (currentPage === "yard-documents") {
    return "Yard Documents";
  }

  if (currentPage === "dispatch") {
    return "Dispatch";
  }

  if (String(currentPage || "").startsWith("deliveries-")) {
    return "Deliveries";
  }

  if (["order-flow", "order-builds"].includes(currentPage)) {
    return "Orders";
  }

  if (
    String(currentPage || "").startsWith("customers-") ||
    currentPage === "sales-orders" ||
    currentPage === "sales-tools" ||
    currentPage === "sales-converter"
  ) {
    return "Sales";
  }

  if (
    [
      "documents",
      "stocking-handbook",
      "trex-price-book",
      "timbertech-price-book",
      "woodgrain-price-book",
      "inventory",
    ].includes(currentPage)
  ) {
    return "Documents";
  }

  if (
    currentPage === "accounting" ||
    currentPage === "accounting-expenses" ||
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
      "twilio-settings",
      "vendor-settings",
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
  if (currentPage === "new-home") {
    return "New Home";
  }

  if (
    [
      "new-overview",
      "new-orders",
      "new-fulfillment",
      "new-build",
      "new-dispatch",
      "new-deliveries",
      "new-documents",
    ].includes(currentPage)
  ) {
    return "New Home";
  }

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
    return "South";
  }

  if (currentPage === "yard-tasks") {
    return "Yard Tasks";
  }

  if (currentPage === "yard-documents") {
    return "Yard Documents";
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

  if (["order-flow", "order-builds"].includes(currentPage)) {
    return "Orders";
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

  if (currentPage === "quote-requests") {
    return "Quote Requests";
  }

  if (
    [
      "documents",
      "stocking-handbook",
      "trex-price-book",
      "timbertech-price-book",
      "woodgrain-price-book",
      "inventory",
    ].includes(currentPage)
  ) {
    return "Documents";
  }

  if (
    currentPage === "accounting" ||
    currentPage === "accounting-expenses" ||
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
      "twilio-settings",
      "vendor-settings",
      "sales-report",
    ].includes(currentPage)
  ) {
    return "Admin";
  }

  if (currentPage === "fleet" || currentPage === "bouncie") {
    return "Fleet";
  }

  if (currentPage === "supplier-chat") {
    return "Suppliers";
  }

  return navigationItems.find((item) => item.id === currentPage)?.group || "";
}

function getNavGroupIcon(group) {
  if (group === "New Home") {
    return LayoutDashboard;
  }

  if (group === "South") {
    return Truck;
  }

  if (group === "Dashboard") {
    return LayoutDashboard;
  }

  if (group === "Orders") {
    return ClipboardList;
  }

  if (group === "Deliveries") {
    return PackageCheck;
  }

  if (group === "Sales") {
    return UsersRound;
  }

  if (group === "Quote Requests") {
    return ClipboardList;
  }

  if (group === "Suppliers") {
    return MessagesSquare;
  }

  if (group === "Yard Tasks") {
    return ClipboardList;
  }

  if (group === "Yard Documents") {
    return BookOpen;
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
 *   navigationGroupOverride?: string;
 *   onPageChange: (pageId: string) => void;
 *   currentUser: Record<string, any> | null;
 *   currentUserProfile: Record<string, any> | null;
 *   effectiveUserRole?: string;
 *   effectiveWorkView?: string;
 *   allowedPageIds?: string[];
 *   isDriverView?: boolean;
 *   isSuperAdmin?: boolean;
 *   isNewAppShell?: boolean;
 *   onExitNewAppShell?: () => void;
 *   isPreviewMode?: boolean;
 *   onExitPreview?: () => void;
 *   onSignOut: () => void;
 * }} props
 */
export default function AppHeader({
  currentPage,
  navigationGroupOverride = "",
  onPageChange,
  effectiveUserRole = "",
  effectiveWorkView = "",
  allowedPageIds,
  isDriverView = false,
  isSuperAdmin = false,
  isNewAppShell = false,
  onExitNewAppShell,
  isPreviewMode = false,
  onExitPreview,
  onSignOut,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openNavGroups, setOpenNavGroups] = useState({
    "New Home": false,
    Dashboard: true,
    Orders: false,
    "Yard Tasks": false,
    "Yard Documents": false,
    Dispatch: false,
    South: false,
    Deliveries: false,
    Sales: false,
    "Quote Requests": false,
    Suppliers: false,
    Documents: false,
    Accounting: false,
    Admin: false,
    Fleet: false,
  });
  const southGroupLabel = "Fulfillment";
  const isReceivingWorkView = effectiveWorkView === "receiving";
  const isNewHomeHeader = isSuperAdmin && isNewAppShell;
  const logoHomePageId = isNewHomeHeader
    ? "new-home"
    : effectiveUserRole === "supplier"
      ? "supplier-chat"
      : "dashboard";

  useEffect(() => {
    const currentGroup =
      navigationGroupOverride ||
      (currentPage === "yard-documents" && !isReceivingWorkView
        ? "Documents"
        : getCurrentPageGroup(currentPage));

    if (!currentGroup) {
      return;
    }

    setOpenNavGroups({
      "New Home": false,
      Dashboard: false,
      Orders: false,
      "Yard Tasks": false,
      "Yard Documents": false,
      Dispatch: false,
      South: false,
      Deliveries: false,
      Sales: false,
      "Quote Requests": false,
      Suppliers: false,
      Documents: false,
      Accounting: false,
      Admin: false,
      Fleet: false,
      [currentGroup]: true,
    });
  }, [
    allowedPageIds,
    currentPage,
    isReceivingWorkView,
    navigationGroupOverride,
  ]);

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

    if (group === "South") {
      const southLinks = getSouthDropdownLinks();
      const activeSouthLink = southLinks.find((link) => link.isActive);

      return activeSouthLink?.pageId || southLinks[0]?.pageId || groupItems[0].id;
    }

    return groupItems[0].id;
  }

  function toggleNavGroup(group) {
    setOpenNavGroups((currentOpenNavGroups) => {
      const nextIsOpen = !currentOpenNavGroups[group];

      return {
        "New Home": false,
        Dashboard: false,
        Orders: false,
        "Yard Tasks": false,
        "Yard Documents": false,
        Dispatch: false,
        South: false,
        Deliveries: false,
        Sales: false,
        "Quote Requests": false,
        Documents: false,
        Accounting: false,
        Admin: false,
        Fleet: false,
        [group]: nextIsOpen,
      };
    });
  }

  function getSouthDropdownLinks() {
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
            label: "South",
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
      hasAllowedPage(["receiving", "check-in", "today", "search", "trace"])
        ? {
            id: "po-receiving",
            label: "Receiving",
            pageId: pageAllowed("receiving") ? "receiving" : "check-in",
            isActive: ["receiving", "check-in", "today", "search", "trace"].includes(
              currentPage,
            ),
          }
        : null,
    ].filter(Boolean);
  }

  function getSalesDropdownLinks() {
    const pageAllowed = (pageId) =>
      !allowedPageIds || allowedPageIds.includes(pageId);

    return [
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
      pageAllowed("accounting-expenses")
        ? {
            id: "accounting-expenses",
            label: "Expenses",
            pageId: "accounting-expenses",
          }
        : null,
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
      pageAllowed("deliveries-route-planner")
        ? {
            id: "deliveries-route-planner",
            label: "Route Planner",
            pageId: "deliveries-route-planner",
          }
        : null,
      pageAllowed("deliveries-queued-upcoming")
        ? {
            id: "deliveries-queued-upcoming",
            label: "View Upcoming",
            pageId: "deliveries-queued-upcoming",
          }
        : null,
      pageAllowed("deliveries-calendar")
        ? {
            id: "deliveries-calendar",
            label: "Delivery Calendar",
            pageId: "deliveries-calendar",
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
    if (effectiveUserRole === "supplier") {
      return (
        <div className={isMobile ? "py-2" : "py-1"}>
          <button
            type="button"
            onClick={() => handlePageChange("supplier-chat")}
            className={`flex w-full items-center rounded-2xl text-left font-black transition ${
              isMobile
                ? "gap-4 px-4 py-4 text-lg"
                : "gap-3 px-3 py-2.5 text-[15px]"
            } ${
              currentPage === "supplier-chat"
                ? "bg-[#FC2C38] text-white shadow-sm"
                : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            <MessagesSquare
              aria-hidden="true"
              className={isMobile ? "h-6 w-6 shrink-0" : "h-5 w-5 shrink-0"}
              strokeWidth={2.5}
            />
            <span className="min-w-0 flex-1 truncate">Supplier Portal</span>
          </button>
        </div>
      );
    }

    if (isNewHomeHeader) {
      return (
        <div className={isMobile ? "space-y-3 py-2" : "space-y-1.5 py-1"}>
          <div className={isMobile ? "px-4 pb-2" : "px-3 pb-1"}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
              New App Flow
            </p>
            <p
              className={`mt-1 font-semibold text-white/70 ${
                isMobile ? "text-sm leading-5" : "text-xs leading-4"
              }`}
            >
              A clean pass at the future menu.
            </p>
          </div>

          {newHomeNavigationItems.map((item) => {
            const NewHomeIcon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePageChange(item.id)}
                className={`flex w-full items-center rounded-2xl text-left font-black transition ${
                  isMobile
                    ? "gap-4 px-4 py-4 text-lg"
                    : "gap-3 px-3 py-2 text-[15px]"
                } ${
                  isMobile
                    ? "text-white hover:bg-white/10"
                    : "text-white/90 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center bg-white/10 text-white ${
                    isMobile
                      ? "h-11 w-11 rounded-2xl"
                      : "h-8 w-8 rounded-xl"
                  }`}
                >
                  <NewHomeIcon
                    aria-hidden="true"
                    className={isMobile ? "h-5 w-5" : "h-4 w-4"}
                    strokeWidth={2.6}
                  />
                </span>

                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="px-4 pt-3">
            <button
              type="button"
              onClick={() => {
                onExitNewAppShell?.();
                setIsMenuOpen(false);
              }}
              className="flex w-full items-center justify-center rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:bg-white/90"
            >
              Back to Current App
            </button>
          </div>
        </div>
      );
    }

    let lastRenderedSection = "";

    return navigationGroupOrder.map((group) => {
      const groupItems = navigationItems.filter((item) => {
        if (item.workView === "receiving" && !isReceivingWorkView) {
          return false;
        }

        if (item.workView === "outside-receiving" && isReceivingWorkView) {
          return false;
        }

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
              pageId === "po-calendar" ||
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
              [
                "documents",
                "stocking-handbook",
                "trex-price-book",
                "timbertech-price-book",
                "woodgrain-price-book",
                "inventory",
              ].includes(pageId),
            )) ||
          (item.id === "accounting" &&
            allowedPageIds.some((pageId) =>
              [
                "accounting",
                "accounting-expenses",
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
                "twilio-settings",
                "vendor-settings",
                "sales-report",
              ].includes(pageId),
            )) ||
          (item.id === "fleet" &&
            allowedPageIds.some((pageId) =>
              ["fleet", "bouncie"].includes(pageId),
            )) ||
          (item.id === "new-home" &&
            allowedPageIds.includes("new-home"));

        return item.group === group && pageIsAllowed;
      });
      const isGroupOpen = openNavGroups[group];
      const NavGroupIcon = getNavGroupIcon(group);
      const hasGroupItems = groupItems.length > 0;
      const currentPageGroup =
        navigationGroupOverride ||
        (currentPage === "yard-documents" && !isReceivingWorkView
          ? "Documents"
          : getCurrentPageGroup(currentPage));
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
        "New Home",
        "Yard Tasks",
        "Yard Documents",
        "Dispatch",
        "South",
        "Deliveries",
        "Sales",
        "Quote Requests",
        "Accounting",
        "Admin",
        "Fleet",
      ].includes(group);
      const hasExpandedChildren =
        shouldShowSouthDropdown ||
        shouldShowDeliveriesDropdown ||
        shouldShowSalesDropdown ||
        shouldShowAccountingDropdown ||
        (isGroupOpen && hasGroupItems && !isSinglePageGroup);
      const shouldUseSubtleActiveGroupStyle =
        groupIsActive && hasExpandedChildren;
      const sectionLabel = navigationGroupSections[group] || "Other";
      const isFirstRenderedGroup = !lastRenderedSection;
      const shouldShowSectionLabel =
        hasGroupItems && sectionLabel !== lastRenderedSection;

      if (hasGroupItems) {
        lastRenderedSection = sectionLabel;
      }

      return hasGroupItems ? (
        <div
          key={group}
          className={`${
            isMobile
              ? "border-b border-white/10 py-4 last:border-b-0"
              : `${shouldShowSectionLabel && !isFirstRenderedGroup ? "mt-4" : ""} py-1`
          }`}
        >
          {shouldShowSectionLabel && !isMobile ? (
            <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
              {sectionLabel}
            </p>
          ) : null}
          <div
            className={`relative flex w-full items-center overflow-hidden rounded-xl transition ${
              shouldUseSubtleActiveGroupStyle
                ? "bg-white/10 text-white ring-1 ring-inset ring-white/10"
                : groupIsActive
                  ? "bg-[#FC2C38] text-white"
                  : "text-white hover:bg-white/10"
            }`}
          >
            {shouldUseSubtleActiveGroupStyle ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#FC2C38]"
              />
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (isSinglePageGroup) {
                  handlePageChange(getPrimaryGroupPageId(groupItems, group));
                } else if (hasGroupItems) {
                  toggleNavGroup(group);
                }
              }}
              className={`flex min-w-0 flex-1 items-center rounded-l-xl text-left font-black ${
                isMobile
                  ? "gap-4 px-4 py-4 text-lg"
                  : "gap-3 px-3 py-2.5 text-[15px]"
              }`}
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
                className={
                  isMobile ? "h-6 w-6 shrink-0" : "h-5 w-5 shrink-0"
                }
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
                className={`flex h-full shrink-0 items-center justify-center rounded-r-xl text-white/70 transition hover:text-white ${
                  isMobile ? "min-h-[56px] w-12" : "min-h-[40px] w-10"
                }`}
                aria-label={`${isGroupOpen ? "Collapse" : "Open"} ${
                  group === "South" ? southGroupLabel : group
                } menu`}
                aria-expanded={isGroupOpen}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`${isMobile ? "h-5 w-5" : "h-4 w-4"} transition-transform ${
                    isGroupOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2.6}
                />
              </button>
            ) : hasGroupItems && !isSinglePageGroup ? (
              <button
                type="button"
                onClick={() => toggleNavGroup(group)}
                className={`flex h-full shrink-0 items-center justify-center rounded-r-xl text-white/70 transition hover:text-white ${
                  isMobile ? "min-h-[56px] w-12" : "min-h-[40px] w-10"
                }`}
                aria-label={`${isGroupOpen ? "Collapse" : "Open"} ${group} menu`}
                aria-expanded={isGroupOpen}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`${isMobile ? "h-5 w-5" : "h-4 w-4"} transition-transform ${
                    isGroupOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2.6}
                />
              </button>
            ) : null}
          </div>

          {shouldShowSouthDropdown ? (
            <div
              className={
                isMobile
                  ? "mt-3 space-y-2 pl-5"
                  : "ml-5 mt-2 space-y-1 border-l border-white/20"
              }
            >
              {southDropdownLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handlePageChange(link.pageId)}
                  className={`flex w-full items-center gap-3 rounded-xl text-left font-black transition ${
                    isMobile
                      ? "px-4 py-2.5 text-sm"
                      : "gap-2 rounded-l-none py-2 pl-3 pr-3 text-[13px]"
                  } ${
                    link.isActive
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {!isMobile ? (
                    <span
                      aria-hidden="true"
                      className="relative -ml-3 h-px w-4 shrink-0 bg-white/25 after:absolute after:-left-[2px] after:-top-[2px] after:h-1 after:w-1 after:rounded-full after:bg-white/45"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {shouldShowDeliveriesDropdown ? (
            <div
              className={
                isMobile
                  ? "mt-3 space-y-2 pl-5"
                  : "ml-5 mt-2 space-y-1 border-l border-white/20"
              }
            >
              {deliveriesDropdownLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handlePageChange(link.pageId)}
                  className={`flex w-full items-center gap-3 rounded-xl text-left font-black transition ${
                    isMobile
                      ? "px-4 py-2.5 text-sm"
                      : "gap-2 rounded-l-none py-2 pl-3 pr-3 text-[13px]"
                  } ${
                    link.isActive
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {!isMobile ? (
                    <span
                      aria-hidden="true"
                      className="relative -ml-3 h-px w-4 shrink-0 bg-white/25 after:absolute after:-left-[2px] after:-top-[2px] after:h-1 after:w-1 after:rounded-full after:bg-white/45"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {shouldShowSalesDropdown ? (
            <div
              className={
                isMobile
                  ? "mt-3 space-y-2 pl-5"
                  : "ml-5 mt-2 space-y-1 border-l border-white/20"
              }
            >
              {salesDropdownLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handlePageChange(link.pageId)}
                  className={`flex w-full items-center gap-3 rounded-xl text-left font-black transition ${
                    isMobile
                      ? "px-4 py-2.5 text-sm"
                      : "gap-2 rounded-l-none py-2 pl-3 pr-3 text-[13px]"
                  } ${
                    link.isActive
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {!isMobile ? (
                    <span
                      aria-hidden="true"
                      className="relative -ml-3 h-px w-4 shrink-0 bg-white/25 after:absolute after:-left-[2px] after:-top-[2px] after:h-1 after:w-1 after:rounded-full after:bg-white/45"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {shouldShowAccountingDropdown ? (
            <div
              className={
                isMobile
                  ? "mt-3 space-y-2 pl-5"
                  : "ml-5 mt-2 space-y-1 border-l border-white/20"
              }
            >
              {accountingDropdownLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handlePageChange(link.pageId)}
                  className={`flex w-full items-center gap-3 rounded-xl text-left font-black transition ${
                    isMobile
                      ? "px-4 py-2.5 text-sm"
                      : "gap-2 rounded-l-none py-2 pl-3 pr-3 text-[13px]"
                  } ${
                    link.isActive
                      ? "bg-[#FC2C38] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {!isMobile ? (
                    <span
                      aria-hidden="true"
                      className="relative -ml-3 h-px w-4 shrink-0 bg-white/25 after:absolute after:-left-[2px] after:-top-[2px] after:h-1 after:w-1 after:rounded-full after:bg-white/45"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {hasGroupItems && isGroupOpen && !isSinglePageGroup ? (
            <div
              className={
                isMobile
                  ? "mt-3 space-y-2"
                  : "ml-5 mt-2 space-y-1 border-l border-white/20"
              }
            >
              {groupItems.map((item) => {
                const isActive = currentPage === item.id;
                const isPrimaryAction = item.id === "supplier-runs-add";
                const itemClassName = isPrimaryAction
                  ? getActionNavButtonClass(isActive, isMobile)
                  : getNavButtonClass(isActive, isMobile);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePageChange(item.id)}
                    className={`${itemClassName} ${
                      isMobile ? "" : "rounded-l-none pl-3 pr-3"
                    }`}
                  >
                    {!isMobile ? (
                      <span
                        aria-hidden="true"
                        className="relative -ml-3 h-px w-4 shrink-0 bg-white/25 after:absolute after:-left-[2px] after:-top-[2px] after:h-1 after:w-1 after:rounded-full after:bg-white/45"
                      />
                    ) : null}
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
                    ) : null}
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-white/10 bg-[#1e1e1e] md:flex">
        <button
          type="button"
          onClick={() => handlePageChange(logoHomePageId)}
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
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 shadow-sm">
            {isSuperAdmin && isPreviewMode ? (
              <button
                type="button"
                onClick={onExitPreview}
                className="mb-1 flex w-full items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-300/20"
              >
                Exit preview
              </button>
            ) : null}

            <button
              type="button"
              onClick={onSignOut}
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.3}
              />
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
                {navigationGroupOverride || getCurrentPageLabel(currentPage)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handlePageChange(logoHomePageId)}
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
              onClick={onSignOut}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white ring-1 ring-white/15 transition hover:bg-white/15"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={2.3} />
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
                onClick={() => handlePageChange(logoHomePageId)}
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
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2 shadow-sm">
                {isSuperAdmin && isPreviewMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      onExitPreview?.();
                      setIsMenuOpen(false);
                    }}
                    className="mb-2 w-full rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-300/20"
                  >
                    Exit preview
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onSignOut}
                  className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white shadow-sm transition hover:bg-white/10"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut
                    aria-hidden="true"
                    className="h-5 w-5"
                    strokeWidth={2.3}
                  />
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
