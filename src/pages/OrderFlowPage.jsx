import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  FileUp,
  Hand,
  LoaderCircle,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";
import AddressAutocompleteInput from "../components/AddressAutocompleteInput";
import Breadcrumbs from "../components/Breadcrumbs";
import OrderDetailsModal from "../components/OrderDetailsModal";
import PageContainer from "../components/PageContainer";
import SearchableSelect from "../components/SearchableSelect";
import cashAccounts from "../data/cashAccounts.json";
import chargeAccounts from "../data/chargeAccounts.json";
import { inventoryCatalogItems } from "../data/inventoryCatalog";

// Keep the shortcut implementation available for a later rollout.
const SHOW_SHIP_ORDER_COMPLETE_SHORTCUT = false;

const normalizeInventorySearch = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeAccountNumber = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

function buildCustomerAccountOptions(customers) {
  const accountsByNumber = new Map();

  (Array.isArray(customers) ? customers : []).forEach((customer) => {
    const accountNumber = String(customer.accountNumber || "").trim();

    if (!accountNumber) {
      return;
    }

    accountsByNumber.set(normalizeAccountNumber(accountNumber), {
      accountNumber,
      customerId: customer.id || "",
      name: String(customer.companyName || customer.name || "").trim(),
      businessName: String(customer.companyName || customer.name || "").trim(),
      accountType:
        customer.accountType === "charge" || customer.accountTerms === "Net 30"
          ? "charge"
          : customer.accountType === "cash"
            ? "cash"
            : "customer",
    });
  });

  [
    ...chargeAccounts.map((account) => ({ ...account, accountType: "charge" })),
    ...cashAccounts.map((account) => ({ ...account, accountType: "cash" })),
  ].forEach((account) => {
    const accountNumber = String(account.accountJobNumber || "").trim();
    const normalizedAccountNumber = normalizeAccountNumber(accountNumber);

    if (!accountNumber || accountsByNumber.has(normalizedAccountNumber)) {
      return;
    }

    accountsByNumber.set(normalizedAccountNumber, {
      accountNumber,
      customerId: `${account.accountType}-account-${accountNumber}`,
      name: String(account.name || "").trim(),
      businessName: String(account.name || "").trim(),
      accountType: account.accountType,
    });
  });

  return [...accountsByNumber.values()].sort((firstAccount, secondAccount) =>
    firstAccount.accountNumber.localeCompare(secondAccount.accountNumber, "en-US", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

const inventoryCatalog = [
  {
    itemNumber: "SHIP",
    description: "",
    brand: "Shipping",
    groupSection: "Delivery",
    defaultVendor: "",
    nonStocked: false,
    onHand: null,
    manualDescription: true,
  },
  ...Array.from(
    new Map(
      inventoryCatalogItems
        .filter((item) => item?.itemNumber)
        .map((item) => [
          normalizeInventorySearch(item.itemNumber),
          {
            itemNumber: String(item.itemNumber || "").trim(),
            description: String(item.description || "").trim(),
            brand: String(item.brand || "").trim(),
            groupSection: String(item.groupSection || "").trim(),
            defaultVendor: String(item.defaultVendor || "").trim(),
            nonStocked: Boolean(item.nonStocked),
            onHand: item.onHand,
          },
        ]),
    ).values(),
  ),
].sort((left, right) =>
  left.itemNumber.localeCompare(right.itemNumber, "en-US", {
    numeric: true,
    sensitivity: "base",
  }),
);

const fulfillmentPaths = [
  {
    id: "supplierDelivery",
    label: "Supplier Delivery",
    shortLabel: "Supplier",
    description: "Vendor brings this material in on their truck.",
    icon: Package,
    tone: "border-blue-200 bg-blue-50 text-blue-800",
    activeTone: "border-blue-500 bg-blue-50 text-blue-800 ring-blue-100",
  },
  {
    id: "wePickup",
    label: "We Pickup",
    shortLabel: "Pickup",
    description: "Dispatch this material onto a South pickup route.",
    icon: Truck,
    tone: "border-red-200 bg-red-50 text-[#FC2C38]",
    activeTone: "border-[#FC2C38] bg-red-50 text-[#FC2C38] ring-red-100",
  },
  {
    id: "pod",
    label: "POD",
    shortLabel: "POD",
    description: "Customer picks this material up from our supplier.",
    icon: ShoppingBag,
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    activeTone: "border-amber-500 bg-amber-50 text-amber-800 ring-amber-100",
  },
  {
    id: "inStock",
    label: "From Yard (In Stock)",
    shortLabel: "Yard Stock",
    description: "Pull this stocked item from Capital Lumber's yard.",
    icon: Warehouse,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    activeTone:
      "border-emerald-500 bg-emerald-50 text-emerald-800 ring-emerald-100",
  },
];

const activeFulfillmentPaths = fulfillmentPaths;

const CAPITAL_LUMBER_ADDRESS = "3105 W State St, Boise, ID 83703";

function createGoogleMapsRouteUrl(destination) {
  const trimmedDestination = String(destination || "").trim();

  if (!trimmedDestination) {
    return "";
  }

  const params = new URLSearchParams({
    api: "1",
    origin: CAPITAL_LUMBER_ADDRESS,
    destination: trimmedDestination,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const unloadTypes = [
  {
    id: "Forklift",
    label: "Forklift",
    description: "Unload with forklift",
    icon: Truck,
  },
  {
    id: "Hand unload",
    label: "Hand unload",
    description: "Material unloaded by hand",
    icon: Hand,
  },
  {
    id: "Dump",
    label: "Dump",
    description: "Dump truck delivery",
    icon: Package,
  },
];

const returnLoadTypes = [
  {
    id: "Hand unload",
    label: "Hand Load",
    description: "Load the return by hand",
    icon: Hand,
  },
  {
    id: "Forklift",
    label: "Forklift",
    description: "A forklift is needed at pickup",
    icon: Truck,
  },
];

const handoffOptions = [
  {
    id: "willCall",
    label: "Will Call",
    description: "Customer picks up at Capital Lumber.",
    icon: ShoppingBag,
    tone: "bg-blue-50 text-blue-700",
  },
  {
    id: "delivery",
    label: "Delivery",
    description: "Capital Lumber delivers to the customer.",
    icon: Truck,
    tone: "bg-red-50 text-[#FC2C38]",
  },
  {
    id: "pod",
    label: "POD",
    description: "Customer picks up from our supplier.",
    icon: Package,
    tone: "bg-amber-50 text-amber-700",
  },
  {
    id: "return",
    label: "Return",
    description: "Pick up returned material and bring it back to Capital Lumber.",
    icon: ArrowLeft,
    tone: "bg-violet-50 text-violet-700",
  },
  {
    id: "vendorReturn",
    label: "Vendor Return",
    description: "Take returned material from Capital Lumber back to a supplier.",
    icon: Truck,
    tone: "bg-amber-50 text-amber-800",
  },
];

function getHandoffOption(orderMethod) {
  return (
    handoffOptions.find((option) => option.id === orderMethod) ||
    handoffOptions[0]
  );
}

function normalizeVendorName(vendorName) {
  return String(vendorName || "").trim().toLowerCase();
}

function getVendorAddress(vendorName, supplierAddressMap) {
  const normalizedVendorName = normalizeVendorName(vendorName);
  const matchedVendorName = Object.keys(supplierAddressMap || {}).find(
    (currentVendorName) =>
      normalizeVendorName(currentVendorName) === normalizedVendorName,
  );

  return matchedVendorName ? supplierAddressMap[matchedVendorName] || "" : "";
}

function createBlankItem(overrides = {}) {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    quantity: "",
    itemNumber: "",
    description: "",
    path: "supplierDelivery",
    vendor: "",
    supplierAddress: "",
    poNumber: "",
    routeDate: "",
    supplierDate: "",
    supplierNote: "",
    driverNotesEnabled: false,
    driverNotes: "",
    easilyDamaged: false,
    saved: false,
    ...overrides,
  };
}

const defaultItems = [createBlankItem({ id: "item-1" })];

function createBlankStockItem() {
  return {
    id: `stock-item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    quantity: "",
    itemNumber: "",
    description: "",
    easilyDamaged: false,
  };
}

function getPath(pathId) {
  return (
    fulfillmentPaths.find((path) => path.id === pathId) ||
    fulfillmentPaths[0]
  );
}

function getItemDateLabel(pathId) {
  if (pathId === "inStock") {
    return "Availability";
  }

  if (pathId === "wePickup") {
    return "Pickup";
  }

  if (pathId === "pod") {
    return "POD";
  }

  return "Delivery";
}

function getItemDateValue(item) {
  if (item.path === "inStock") {
    return "";
  }

  return item.path === "wePickup" ? item.routeDate : item.supplierDate;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 sm:text-[11px]">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-2.5 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100 ${className}`}
    />
  );
}

function getLocalDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateFromValue(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function FutureDeliveryDatePicker({ value, onChange }) {
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const selectedDate = getDateFromValue(value);
  const today = useMemo(() => {
    const currentDate = new Date();
    currentDate.setHours(12, 0, 0, 0);
    return currentDate;
  }, []);
  const todayValue = getLocalDateValue(today);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => selectedDate || today,
  );
  const [popoverPosition, setPopoverPosition] = useState({
    left: 12,
    top: 12,
    width: 352,
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleOutsidePointer(event) {
      if (
        !triggerRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function updatePosition() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();

      if (!triggerRect) {
        return;
      }

      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const popoverHeight = popoverRef.current?.offsetHeight || 410;
      const width = Math.min(352, Math.max(288, viewportWidth - 24));
      const left = Math.min(
        Math.max(12, triggerRect.left),
        Math.max(12, viewportWidth - width - 12),
      );
      const openAbove =
        viewportHeight - triggerRect.bottom < popoverHeight + 16 &&
        triggerRect.top > viewportHeight - triggerRect.bottom;
      const preferredTop = openAbove
        ? triggerRect.top - popoverHeight - 10
        : triggerRect.bottom + 10;
      const top = Math.min(
        Math.max(12, preferredTop),
        Math.max(12, viewportHeight - popoverHeight - 12),
      );

      setPopoverPosition({ left, top, width });
    }

    const animationFrame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, visibleMonth]);

  const monthStart = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
    12,
  );
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(1 - monthStart.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(monthStart);

  function openPicker() {
    setVisibleMonth(selectedDate || today);
    setIsOpen((currentValue) => !currentValue);
  }

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={openPicker}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-slate-100 px-3.5 py-2.5 text-left text-base font-bold outline-none transition focus:ring-4 focus:ring-red-100 ${
          isOpen
            ? "border-[#FC2C38] bg-white"
            : "border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-white"
        }`}
      >
        <span className={value ? "text-slate-900" : "text-slate-500"}>
          {selectedDate
            ? new Intl.DateTimeFormat("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              }).format(selectedDate)
            : "Choose date"}
        </span>
        <CalendarDays className="h-5 w-5 shrink-0" aria-hidden="true" />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Choose future delivery date"
              className="fixed z-[300] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-4 shadow-2xl"
              style={popoverPosition}
            >
              <div className="mb-3 border-b border-slate-200 pb-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Delivery Date
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Choose a requested date, or close this and use Future Date to schedule it later.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleMonth(
                      new Date(
                        visibleMonth.getFullYear(),
                        visibleMonth.getMonth() - 1,
                        1,
                        12,
                      ),
                    )
                  }
                  className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <p className="text-base font-black text-slate-950">{monthLabel}</p>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleMonth(
                      new Date(
                        visibleMonth.getFullYear(),
                        visibleMonth.getMonth() + 1,
                        1,
                        12,
                      ),
                    )
                  }
                  className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <span key={day} className="py-1">{day}</span>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarDays.map((date) => {
                  const dateValue = getLocalDateValue(date);
                  const isPast = dateValue < todayValue;
                  const isSelected = dateValue === value;
                  const isCurrentMonth = date.getMonth() === monthStart.getMonth();

                  return (
                    <button
                      key={dateValue}
                      type="button"
                      disabled={isPast}
                      onClick={() => {
                        onChange(dateValue);
                        setIsOpen(false);
                      }}
                      className={`grid aspect-square min-h-9 place-items-center rounded-xl text-sm font-black transition ${
                        isSelected
                          ? "bg-[#FC2C38] text-white shadow-sm"
                          : isPast
                            ? "cursor-not-allowed text-slate-300"
                            : isCurrentMonth
                              ? "text-slate-900 hover:bg-red-50 hover:text-[#FC2C38]"
                              : "text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Clear
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function OrderEntryToolbar({
  mode,
  orderedBy,
  orderedByOptions,
  onModeChange,
  onOrderedByChange,
}) {
  const orderTypes = [
    { id: "customer", label: "Customer Order" },
    { id: "stock", label: "Stock Order" },
    { id: "return", label: "Return" },
    { id: "vendorReturn", label: "Vendor Return" },
  ];

  return (
    <div className="mb-3 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[minmax(250px,330px)_minmax(0,1fr)] lg:items-end">
      <Field label="Ordered by">
        <div className="group relative">
          <UserRound
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-slate-700 group-focus-within:text-[#FC2C38]"
            aria-hidden="true"
          />
          <select
            value={orderedBy}
            onChange={(event) => onOrderedByChange(event.target.value)}
            className="w-full cursor-pointer appearance-none rounded-xl border border-slate-300 bg-slate-100 py-2.5 pl-12 pr-12 text-base font-black text-slate-900 outline-none transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-white hover:shadow-md focus:translate-y-0 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
          >
            <option value="">Select who placed the order...</option>
            {orderedByOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-slate-700 group-focus-within:text-[#FC2C38]"
            aria-hidden="true"
          />
        </div>
      </Field>

      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
          Order type
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:grid-cols-4">
          {orderTypes.map((orderType) => {
            const isSelected = mode === orderType.id;

            return (
              <button
                key={orderType.id}
                type="button"
                onClick={() => onModeChange(orderType.id)}
                aria-pressed={isSelected}
                className={`min-h-10 cursor-pointer rounded-lg border px-2.5 py-2 text-sm font-black transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 ${
                  isSelected
                    ? "border-slate-950 bg-slate-950 text-white shadow-md"
                    : "border-slate-200 bg-white/70 text-slate-600 shadow-sm hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:text-slate-950 hover:shadow-md active:translate-y-0 active:bg-slate-200"
                }`}
              >
                {orderType.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InventoryItemNumberInput({
  value,
  onChange,
  onSelect,
  catalog = inventoryCatalog,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = normalizeInventorySearch(value);
  const itemByNumber = useMemo(
    () =>
      new Map(
        catalog.map((item) => [
          normalizeInventorySearch(item.itemNumber),
          item,
        ]),
      ),
    [catalog],
  );
  const suggestions = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    const queryTokens = String(value || "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) || [];
    const matches = [];

    for (const item of catalog) {
      const normalizedNumber = normalizeInventorySearch(item.itemNumber);
      const normalizedDescription = normalizeInventorySearch(item.description);
      const normalizedMetadata = normalizeInventorySearch(
        [item.brand, item.groupSection, item.defaultVendor]
          .filter(Boolean)
          .join(" "),
      );
      const searchableText = [
        normalizedNumber,
        normalizedDescription,
        normalizedMetadata,
      ].join(" ");
      const matchesEveryToken = queryTokens.every((token) =>
        searchableText.includes(normalizeInventorySearch(token)),
      );
      let score = null;

      if (normalizedNumber.startsWith(normalizedQuery)) {
        score = 0;
      } else if (normalizedDescription.startsWith(normalizedQuery)) {
        score = 1;
      } else if (normalizedNumber.includes(normalizedQuery)) {
        score = 2;
      } else if (normalizedDescription.includes(normalizedQuery)) {
        score = 3;
      } else if (matchesEveryToken) {
        score = 4;
      } else if (normalizedMetadata.includes(normalizedQuery)) {
        score = 5;
      }

      if (score !== null) {
        matches.push({ item, score });
      }
    }

    return matches
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.item.itemNumber.localeCompare(right.item.itemNumber, "en-US", {
            numeric: true,
            sensitivity: "base",
          }),
      )
      .slice(0, 8)
      .map(({ item }) => item);
  }, [catalog, normalizedQuery, value]);

  function handleChange(event) {
    const nextValue = event.target.value;
    onChange(nextValue);
    setIsOpen(true);

    const exactMatch = itemByNumber.get(
      normalizeInventorySearch(nextValue),
    );
    if (exactMatch) {
      onSelect(exactMatch);
    }
  }

  function selectItem(item) {
    onSelect(item);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <TextInput
        value={value}
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        autoComplete="off"
        placeholder="Item # or description"
      />
      {isOpen && normalizedQuery && suggestions.length > 0 ? (
        <div className="absolute left-0 top-[calc(100%+0.4rem)] z-30 max-h-96 w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            <span>Matching inventory items</span>
            <span>{suggestions.length} shown</span>
          </div>
          {suggestions.map((item) => (
            <button
              key={item.itemNumber}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectItem(item)}
              className="group mb-1 grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-xl border border-transparent px-3 py-3 text-left transition last:mb-0 hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="w-fit rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-black tracking-wide text-white transition group-hover:bg-blue-700">
                {item.itemNumber}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                  item.nonStocked
                    ? "bg-violet-100 text-violet-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {item.manualDescription
                  ? "Ship label"
                  : item.nonStocked
                  ? "Non-stocked"
                  : Number.isFinite(item.onHand) && item.onHand > 0
                    ? `${item.onHand} on hand`
                    : "Stock item"}
              </span>
              <span className="col-span-2 line-clamp-2 text-sm font-black leading-5 text-slate-900">
                {item.manualDescription
                  ? "Enter a shipment label such as Order 1 or Basement"
                  : item.description || "No description listed"}
              </span>
              <span className="col-span-2 truncate text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                {[
                  item.brand ||
                    (item.groupSection
                      ? `Inventory group ${item.groupSection}`
                      : "Capital Lumber inventory"),
                  item.defaultVendor
                    ? `Vendor: ${item.defaultVendor}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatOrderNumberInput(value) {
  const digitsOnly = String(value || "").replace(/\D/g, "").slice(0, 6);

  if (digitsOnly.length <= 3) {
    return digitsOnly;
  }

  return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
}

function normalizeOrderNumberForMatch(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getRecordOrderNumber(record) {
  return String(record?.orderNumber || record?.sourceOrderNumber || "").trim();
}

function createReturnOrderNumber() {
  const randomValues = new Uint32Array(1);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    randomValues[0] = Math.floor(Math.random() * 1_000_000);
  }

  return `R${String(randomValues[0] % 1_000_000).padStart(6, "0")}`;
}

function formatPhoneInput(value) {
  const digitsOnly = String(value || "").replace(/\D/g, "").slice(0, 10);
  const area = digitsOnly.slice(0, 3);
  const prefix = digitsOnly.slice(3, 6);
  const line = digitsOnly.slice(6, 10);

  if (digitsOnly.length <= 3) {
    return area;
  }

  if (digitsOnly.length <= 6) {
    return `(${area}) ${prefix}`;
  }

  return `(${area}) ${prefix}-${line}`;
}

const MAX_ORDER_IMPORT_BYTES = 3 * 1024 * 1024;

function inferOrderImportMimeType(file) {
  if (file?.type) {
    return file.type;
  }

  const extension = String(file?.name || "")
    .split(".")
    .pop()
    .toLowerCase();

  return (
    {
      pdf: "application/pdf",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv",
      tsv: "text/tab-separated-values",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    }[extension] || ""
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () =>
      reject(new Error("The selected file could not be read.")),
    );
    reader.readAsDataURL(file);
  });
}

function formatShortDate(value) {
  if (!value) {
    return "";
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function WorkflowPill({ pathId }) {
  const path = getPath(pathId);
  const Icon = path.icon;

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] ${path.tone}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {path.shortLabel}
    </span>
  );
}

function ChoiceButton({
  active,
  children,
  icon: Icon,
  tone = "red",
  onClick,
}) {
  const activeClass =
    tone === "green"
      ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-emerald-100"
      : "border-[#FC2C38] bg-red-50 text-[#FC2C38] ring-red-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black transition ${
        active
          ? `${activeClass} ring-4`
          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
      }`}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/**
 * @param {{
 *   currentUser?: { id?: string; name?: string; email?: string } | null;
 *   employeeOptions?: string[];
 *   customers?: Array<Record<string, any>>;
 *   vendorOptions?: string[];
 *   supplierAddressMap?: Record<string, string>;
 *   removedInventoryItemNumbers?: string[];
 *   existingOrderSources?: Record<string, Array<Record<string, any>>>;
 *   onProcessOrder?: (orderPayload: Record<string, any>) => Promise<Record<string, any> | void>;
 *   onProcessStockPO?: (stockPayload: Record<string, any>) => Promise<Record<string, any> | void>;
 *   onDeleteExistingOrder?: (orderNumber: string) => Promise<boolean>;
 *   onSendPoToSouthDispatch?: (payload: { poNumber: string; orderNumber?: string; sourceOrderId?: string; customerName?: string; vendor?: string; supplierAddress?: string; notes?: string; items?: Array<Record<string, any>> }) => Promise<Record<string, any>>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function OrderFlowPage({
  currentUser = null,
  employeeOptions = [],
  customers = [],
  vendorOptions = [],
  supplierAddressMap = {},
  removedInventoryItemNumbers = [],
  existingOrderSources = {},
  onProcessOrder,
  onProcessStockPO,
  onDeleteExistingOrder,
  onSendPoToSouthDispatch,
  onPageChange,
}) {
  const [orderEntryMode, setOrderEntryMode] = useState("customer");
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [orderMethod, setOrderMethod] = useState("delivery");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTitle, setDeliveryTitle] = useState("");
  const [items, setItems] = useState(defaultItems);
  const [activeItemId, setActiveItemId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [routeEta, setRouteEta] = useState(null);
  const [routeEtaStatus, setRouteEtaStatus] = useState("idle");
  const [routeEtaMessage, setRouteEtaMessage] = useState("");
  const [hasHardware, setHasHardware] = useState(false);
  const [needsTarp, setNeedsTarp] = useState(false);
  const [unloadType, setUnloadType] = useState("Forklift");
  const [returnLoadType, setReturnLoadType] = useState("Hand unload");
  const [vendorReturnVendor, setVendorReturnVendor] = useState("");
  const [vendorReturnPoNumber, setVendorReturnPoNumber] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [processError, setProcessError] = useState("");
  const [processSummary, setProcessSummary] = useState(null);
  const [isDuplicateOrderPromptOpen, setIsDuplicateOrderPromptOpen] =
    useState(false);
  const [viewingDuplicateOrderNumber, setViewingDuplicateOrderNumber] =
    useState("");
  const [reviewedDuplicateOrderKey, setReviewedDuplicateOrderKey] =
    useState("");
  const [isDeletingDuplicateOrder, setIsDeletingDuplicateOrder] =
    useState(false);
  const [duplicateDeleteError, setDuplicateDeleteError] = useState("");
  const [orderImportStatus, setOrderImportStatus] = useState("idle");
  const [orderImportError, setOrderImportError] = useState("");
  const [orderImportFileName, setOrderImportFileName] = useState("");
  const [orderImportDraft, setOrderImportDraft] = useState(null);
  const [isOrderImportOpen, setIsOrderImportOpen] = useState(false);
  const [isOrderImportReviewOpen, setIsOrderImportReviewOpen] =
    useState(false);
  const [stockPoNumber, setStockPoNumber] = useState("");
  const [stockVendor, setStockVendor] = useState("");
  const [stockVendorAddress, setStockVendorAddress] = useState("");
  const [stockFulfillmentMethod, setStockFulfillmentMethod] =
    useState("wePickup");
  const [stockScheduledDate, setStockScheduledDate] = useState("");
  const [stockItems, setStockItems] = useState(() => [
    createBlankStockItem(),
  ]);
  const [stockDriverNotesEnabled, setStockDriverNotesEnabled] =
    useState(false);
  const [stockNotes, setStockNotes] = useState("");
  const [isProcessingStockPO, setIsProcessingStockPO] = useState(false);
  const [stockProcessError, setStockProcessError] = useState("");
  const [stockProcessSummary, setStockProcessSummary] = useState(null);
  const [orderedBy, setOrderedBy] = useState(() =>
    String(currentUser?.name || "").trim(),
  );
  const orderedByOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...(Array.isArray(employeeOptions) ? employeeOptions : []), currentUser?.name]
            .map((option) => String(option || "").trim())
            .filter(Boolean),
        ),
      ).sort((firstOption, secondOption) =>
        firstOption.localeCompare(secondOption, "en-US", {
          sensitivity: "base",
        }),
      ),
    [currentUser?.name, employeeOptions],
  );
  const customerAccountOptions = useMemo(
    () => buildCustomerAccountOptions(customers),
    [customers],
  );
  const linkedCustomerAccount = useMemo(
    () =>
      customerAccountOptions.find(
        (account) =>
          normalizeAccountNumber(account.accountNumber) ===
          normalizeAccountNumber(accountNumber),
      ) || null,
    [accountNumber, customerAccountOptions],
  );
  const availableInventoryCatalog = useMemo(() => {
    const removedItemNumberSet = new Set(
      removedInventoryItemNumbers.map((itemNumber) =>
        normalizeInventorySearch(itemNumber),
      ),
    );

    return inventoryCatalog.filter(
      (item) =>
        !removedItemNumberSet.has(
          normalizeInventorySearch(item.itemNumber),
        ),
    );
  }, [removedInventoryItemNumbers]);

  const editingItem = items.find((item) => item.id === editingItemId);
  const selectedUnloadType =
    unloadTypes.find((option) => option.id === unloadType) || unloadTypes[0];
  const SelectedUnloadIcon = selectedUnloadType.icon;
  const selectedReturnLoadType =
    returnLoadTypes.find((option) => option.id === returnLoadType) ||
    returnLoadTypes[0];
  const SelectedReturnLoadIcon = selectedReturnLoadType.icon;
  const routeMapUrl = createGoogleMapsRouteUrl(deliveryAddress);
  const selectedHandoff = getHandoffOption(orderMethod);
  const SelectedHandoffIcon = selectedHandoff.icon;
  const deliveryDateText =
    formatShortDate(deliveryDate) || "Future date · schedule later";
  const pathCounts = useMemo(
    () =>
      activeFulfillmentPaths.map((path) => ({
        ...path,
        count: items.filter((item) => item.path === path.id).length,
      })),
    [items],
  );
  const savedItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.saved) {
          return false;
        }

        return Boolean(
          String(item.quantity || "").trim() ||
            String(item.description || "").trim() ||
            String(item.poNumber || "").trim(),
        );
      }),
    [items],
  );
  const hasShipOrderCompleteItem = items.some(
    (item) =>
      item.saved &&
      String(item.itemNumber || "").trim().toUpperCase() === "SHIP",
  );
  const isReturnOrder = orderEntryMode === "return";
  const isVendorReturnOrder = orderEntryMode === "vendorReturn";
  const isReturnWorkflow = isReturnOrder || isVendorReturnOrder;
  const duplicateOrderMatch = useMemo(() => {
    if (isReturnWorkflow) {
      return null;
    }

    const orderKey = normalizeOrderNumberForMatch(orderNumber);

    if (orderKey.length !== 6) {
      return null;
    }

    const sourceGroups = [
      existingOrderSources.orderBuilds,
      existingOrderSources.salesOrders,
      existingOrderSources.deliveries,
      existingOrderSources.supplierRuns,
      existingOrderSources.theirTruckPOs,
    ];

    for (const sourceGroup of sourceGroups) {
      const match = (Array.isArray(sourceGroup) ? sourceGroup : []).find(
        (record) =>
          normalizeOrderNumberForMatch(getRecordOrderNumber(record)) ===
          orderKey,
      );

      if (match) {
        return match;
      }
    }

    return null;
  }, [existingOrderSources, isReturnWorkflow, orderNumber]);
  const duplicateOrderNumber = duplicateOrderMatch
    ? getRecordOrderNumber(duplicateOrderMatch) || orderNumber
    : "";
  const duplicateOrderKey = normalizeOrderNumberForMatch(duplicateOrderNumber);
  const duplicateOrderWasReviewed = Boolean(
    duplicateOrderKey && reviewedDuplicateOrderKey === duplicateOrderKey,
  );
  const duplicateOrderCustomer = duplicateOrderMatch
    ? String(
        duplicateOrderMatch.businessName ||
          duplicateOrderMatch.customerName ||
          duplicateOrderMatch.customer ||
          "Existing customer",
      ).trim()
    : "";
  const duplicateOrderIsArchived = Boolean(
    duplicateOrderMatch?.archived ||
      String(duplicateOrderMatch?.status || "").toLowerCase() === "archived",
  );
  const canProcessOrder = Boolean(
    (isReturnOrder ? /^R\d{6}$/.test(orderNumber) : orderNumber) &&
      orderedBy &&
      (isVendorReturnOrder
        ? vendorReturnVendor && vendorReturnPoNumber
        : customerName) &&
      savedItems.length > 0 &&
      (!isReturnWorkflow || deliveryDate) &&
      (!["delivery", "return", "vendorReturn"].includes(orderMethod) ||
        deliveryAddress),
  );
  const validStockItems = useMemo(
    () =>
      stockItems.filter((item) => String(item.description || "").trim()),
    [stockItems],
  );
  const canProcessStockPO = Boolean(
    /^\d{3}-\d{3}$/.test(stockPoNumber) &&
      orderedBy &&
      stockVendor.trim() &&
      stockScheduledDate &&
      validStockItems.length > 0,
  );

  useEffect(() => {
    const currentUserName = String(currentUser?.name || "").trim();

    if (!orderedBy && currentUserName) {
      setOrderedBy(currentUserName);
    }
  }, [currentUser?.name, orderedBy]);

  useEffect(() => {
    if (!["delivery", "vendorReturn"].includes(orderMethod)) {
      setRouteEta(null);
      setRouteEtaStatus("idle");
      setRouteEtaMessage("");
      return undefined;
    }

    const trimmedAddress = deliveryAddress.trim();

    if (trimmedAddress.length < 8) {
      setRouteEta(null);
      setRouteEtaStatus("idle");
      setRouteEtaMessage("");
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setRouteEtaStatus("loading");
      setRouteEtaMessage("");

      try {
        const params = new URLSearchParams({
          origin: CAPITAL_LUMBER_ADDRESS,
          destination: trimmedAddress,
        });
        const response = await fetch(`/api/maps/route?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "Route ETA unavailable.");
        }

        setRouteEta(data);
        setRouteEtaStatus("success");
        setRouteEtaMessage("Live route ETA from Capital Lumber.");
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setRouteEta(null);
        setRouteEtaStatus("error");
        setRouteEtaMessage(error.message || "Route ETA unavailable.");
      }
    }, 650);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deliveryAddress, orderMethod]);

  function updateItem(itemId, updates) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    );
  }

  function updateItemVendor(itemId, vendor) {
    setItems((currentItems) => {
      const currentItem = currentItems.find((item) => item.id === itemId);

      if (!currentItem) {
        return currentItems;
      }

      const vendorKey = normalizeVendorName(vendor);
      const currentVendorKey = normalizeVendorName(currentItem.vendor);
      const vendorChanged = vendorKey !== currentVendorKey;
      const matchingSetup = vendorKey
        ? currentItems.find(
            (item) =>
              item.id !== itemId &&
              item.path === currentItem.path &&
              normalizeVendorName(item.vendor) === vendorKey &&
              (String(item.poNumber || "").trim() || getItemDateValue(item)),
          )
        : null;
      const matchingDate = matchingSetup
        ? getItemDateValue(matchingSetup)
        : "";

      return currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        return {
          ...item,
          vendor,
          supplierAddress: getVendorAddress(vendor, supplierAddressMap),
          poNumber:
            vendorChanged || !String(item.poNumber || "").trim()
              ? matchingSetup?.poNumber || ""
              : item.poNumber,
          ...(item.path === "wePickup"
            ? {
                routeDate:
                  vendorChanged || !item.routeDate
                    ? matchingDate
                    : item.routeDate,
                ...(vendorChanged ? { supplierDate: "" } : {}),
              }
            : {
                supplierDate:
                  vendorChanged || !item.supplierDate
                    ? matchingDate
                    : item.supplierDate,
                ...(vendorChanged ? { routeDate: "" } : {}),
              }),
        };
      });
    });
  }

  function finishSupplierSetup(itemId) {
    setItems((currentItems) => {
      const sourceItem = currentItems.find((item) => item.id === itemId);

      if (!sourceItem || !normalizeVendorName(sourceItem.vendor)) {
        return currentItems;
      }

      const sourceVendorKey = normalizeVendorName(sourceItem.vendor);
      const sourceDate = getItemDateValue(sourceItem);

      return currentItems.map((item) => {
        if (
          item.id === itemId ||
          item.path === "inStock" ||
          normalizeVendorName(item.vendor) !== sourceVendorKey
        ) {
          return item;
        }

        const dateUpdates =
          item.path === sourceItem.path && sourceDate
            ? item.path === "wePickup"
              ? { routeDate: item.routeDate || sourceDate }
              : { supplierDate: item.supplierDate || sourceDate }
            : {};

        return {
          ...item,
          poNumber: item.poNumber || sourceItem.poNumber,
          supplierAddress:
            item.supplierAddress || sourceItem.supplierAddress,
          ...dateUpdates,
        };
      });
    });
    setEditingItemId(null);
  }

  function getNewItemDefaults(sourceItem = {}) {
    if (isVendorReturnOrder) {
      return {
        path: "vendorReturn",
        poNumber: vendorReturnPoNumber || sourceItem.poNumber || "",
        vendor: vendorReturnVendor || sourceItem.vendor || "",
        supplierAddress:
          deliveryAddress || sourceItem.supplierAddress || "",
        routeDate: "",
        supplierDate: deliveryDate || sourceItem.supplierDate || "",
      };
    }

    if (isReturnOrder) {
      return {
        path: "inStock",
        poNumber: "",
        vendor: "",
        supplierAddress: "",
        routeDate: "",
        supplierDate: "",
      };
    }

    return {
      path: sourceItem.path || "supplierDelivery",
      poNumber: sourceItem.poNumber || "",
      vendor: sourceItem.vendor || "",
      supplierAddress: sourceItem.supplierAddress || "",
      routeDate: sourceItem.routeDate || "",
      supplierDate: sourceItem.supplierDate || "",
    };
  }

  function addItem() {
    const previousItem = items[items.length - 1];
    const nextItem = createBlankItem(getNewItemDefaults(previousItem));

    setItems((currentItems) => [...currentItems, nextItem]);
    setActiveItemId(nextItem.id);
  }

  function saveItem(itemId) {
    updateItem(itemId, { saved: true });
    setActiveItemId(null);
  }

  function shipOrderComplete() {
    const placeholderDescription =
      "Complete order — line items to be added later";

    setItems((currentItems) => {
      const existingShipItem = currentItems.find(
        (item) =>
          String(item.itemNumber || "").trim().toUpperCase() === "SHIP",
      );
      const blankItem = currentItems.find(
        (item) =>
          !item.saved &&
          !String(item.quantity || "").trim() &&
          !String(item.itemNumber || "").trim() &&
          !String(item.description || "").trim() &&
          !String(item.vendor || "").trim() &&
          !String(item.poNumber || "").trim(),
      );
      const targetItemId = existingShipItem?.id || blankItem?.id;
      const shipItemUpdates = {
        quantity: existingShipItem?.quantity || "1",
        itemNumber: "SHIP",
        description:
          String(existingShipItem?.description || "").trim() ||
          placeholderDescription,
        path: "inStock",
        vendor: "",
        supplierAddress: "",
        poNumber: "",
        routeDate: "",
        supplierDate: "",
        saved: true,
        lineItemsPending: true,
      };

      if (targetItemId) {
        return currentItems.map((item) =>
          item.id === targetItemId ? { ...item, ...shipItemUpdates } : item,
        );
      }

      return [
        ...currentItems,
        createBlankItem(shipItemUpdates),
      ];
    });
    setActiveItemId(null);
    setEditingItemId(null);
  }

  function saveItemAndAddAnother(itemId) {
    const sourceItem = items.find((item) => item.id === itemId);

    if (!sourceItem) {
      return;
    }

    const nextItem = createBlankItem(getNewItemDefaults(sourceItem));

    setItems((currentItems) => [
      ...currentItems.map((item) =>
        item.id === itemId ? { ...item, saved: true } : item,
      ),
      nextItem,
    ]);
    setActiveItemId(nextItem.id);
  }

  function editItem(itemId) {
    updateItem(itemId, { saved: false });
    setActiveItemId(itemId);
  }

  function deleteItem(itemId) {
    setItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      return nextItems.length > 0
        ? nextItems
        : [
            createBlankItem(
              getNewItemDefaults(currentItems[currentItems.length - 1]),
            ),
          ];
    });

    if (editingItemId === itemId) {
      setEditingItemId(null);
    }

    if (activeItemId === itemId) {
      setActiveItemId(null);
    }
  }

  async function importOrderFile(file) {
    if (!file || orderImportStatus === "loading") {
      return;
    }

    const mimeType = inferOrderImportMimeType(file);

    if (!mimeType) {
      setOrderImportStatus("error");
      setOrderImportError(
        "Use a PDF, Excel/CSV file, JPG, PNG, or WebP image.",
      );
      return;
    }

    if (file.size > MAX_ORDER_IMPORT_BYTES) {
      setOrderImportStatus("error");
      setOrderImportError("This first version supports files up to 3 MB.");
      return;
    }

    setOrderImportStatus("loading");
    setOrderImportError("");
    setOrderImportFileName(file.name);
    setOrderImportDraft(null);

    try {
      const fileData = await readFileAsDataUrl(file);
      const response = await fetch("/api/orders/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType,
          fileData,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "The order document could not be parsed.");
      }

      setOrderImportDraft(data?.draft || null);
      setOrderImportStatus("success");
      setIsOrderImportOpen(false);
      setIsOrderImportReviewOpen(true);
    } catch (error) {
      setOrderImportStatus("error");
      setOrderImportError(
        error?.message || "The order document could not be parsed.",
      );
    }
  }

  function applyImportedOrder() {
    if (!orderImportDraft) {
      return;
    }

    if (orderImportDraft.orderNumber) {
      setOrderNumber(formatOrderNumberInput(orderImportDraft.orderNumber));
    }

    if (orderImportDraft.businessName) {
      handleBusinessNameChange(orderImportDraft.businessName);
    }

    if (orderImportDraft.customerName) {
      setCustomerName(orderImportDraft.customerName);
    }

    if (orderImportDraft.phoneNumber) {
      setPhoneNumber(formatPhoneInput(orderImportDraft.phoneNumber));
    }

    if (orderImportDraft.accountNumber) {
      setAccountNumber(orderImportDraft.accountNumber);
    }

    if (["delivery", "willCall", "pod"].includes(orderImportDraft.orderMethod)) {
      setOrderMethod(orderImportDraft.orderMethod);
    }

    if (orderImportDraft.deliveryAddress) {
      setDeliveryAddress(orderImportDraft.deliveryAddress);
    }

    if (orderImportDraft.deliveryDate) {
      setDeliveryDate(orderImportDraft.deliveryDate);
    }

    if (orderImportDraft.notes) {
      setDeliveryNotes(orderImportDraft.notes);
    }

    const importedItems = (orderImportDraft.items || [])
      .map((importedItem) => {
        const matchedCatalogItem = availableInventoryCatalog.find(
          (catalogItem) =>
            normalizeInventorySearch(catalogItem.itemNumber) ===
            normalizeInventorySearch(importedItem.itemNumber),
        );
        const path = [
          "supplierDelivery",
          "wePickup",
          "pod",
          "inStock",
        ].includes(importedItem.fulfillment)
          ? importedItem.fulfillment
          : "supplierDelivery";
        const vendor =
          importedItem.vendor || matchedCatalogItem?.defaultVendor || "";

        return createBlankItem({
          quantity: importedItem.quantity || "",
          itemNumber: importedItem.itemNumber || "",
          description:
            importedItem.description || matchedCatalogItem?.description || "",
          path,
          vendor,
          supplierAddress: getVendorAddress(vendor, supplierAddressMap),
          poNumber: formatOrderNumberInput(importedItem.poNumber || ""),
          routeDate:
            path === "wePickup" ? importedItem.scheduledDate || "" : "",
          supplierDate:
            path !== "wePickup" && path !== "inStock"
              ? importedItem.scheduledDate || ""
              : "",
          saved: true,
        });
      })
      .filter(
        (item) => item.itemNumber || item.description || item.quantity,
      );

    if (importedItems.length > 0) {
      setItems(importedItems);
      setActiveItemId(null);
      setEditingItemId(null);
    }

    setIsOrderImportReviewOpen(false);
  }

  function buildOrderPayload({ allowDuplicateOrder = false } = {}) {
    const isDeliveryOrder = ["delivery", "return", "vendorReturn"].includes(
      orderMethod,
    );
    const payloadItems = isVendorReturnOrder
      ? savedItems.map((item) => ({
          ...item,
          path: "vendorReturn",
          vendor: vendorReturnVendor,
          poNumber: vendorReturnPoNumber,
          supplierAddress: deliveryAddress,
          routeDate: "",
          supplierDate: deliveryDate,
        }))
      : savedItems;

    return {
      orderNumber,
      customerName: isVendorReturnOrder ? vendorReturnVendor : customerName,
      businessName: isVendorReturnOrder ? vendorReturnVendor : businessName,
      phoneNumber,
      accountNumber,
      customerId: linkedCustomerAccount?.customerId || "",
      customerAccountType: linkedCustomerAccount?.accountType || "",
      orderKind: isVendorReturnOrder
        ? "vendorReturn"
        : isReturnOrder
          ? "return"
          : "customer",
      orderedBy,
      orderMethod,
      deliveryAddress,
      deliveryDate,
      returnDate: isReturnWorkflow ? deliveryDate : "",
      deliveryTitle: isVendorReturnOrder
        ? `${vendorReturnVendor} Return · PO ${vendorReturnPoNumber}`
        : deliveryTitle,
      hasHardware: isReturnWorkflow ? false : isDeliveryOrder ? hasHardware : false,
      needsTarp: isReturnWorkflow ? false : isDeliveryOrder ? needsTarp : false,
      unloadType: isVendorReturnOrder
        ? "Vendor unload"
        : isReturnOrder
          ? returnLoadType
          : isDeliveryOrder
            ? unloadType
            : "",
      deliveryNotes: isDeliveryOrder ? deliveryNotes : "",
      returnNotes: isReturnWorkflow ? deliveryNotes.trim() : "",
      routeEta: isDeliveryOrder ? routeEta : null,
      routeEtaStatus: isDeliveryOrder ? routeEtaStatus : "idle",
      vendorReturnVendor,
      vendorReturnPoNumber,
      items: payloadItems,
      createdBy: currentUser,
      allowDuplicateOrder,
    };
  }

  function showCustomerOrder() {
    if (["return", "vendorReturn"].includes(orderMethod)) {
      setOrderNumber("");
      setOrderMethod("delivery");
    }
    setOrderEntryMode("customer");
  }

  function showReturnOrder() {
    if (orderMethod !== "return") {
      setOrderNumber(createReturnOrderNumber());
      setOrderMethod("return");
      setItems((currentItems) =>
        currentItems.map((item) => ({
          ...item,
          path: "inStock",
          vendor: "",
          supplierAddress: "",
          poNumber: "",
          routeDate: "",
          supplierDate: "",
        })),
      );
      setActiveItemId(null);
      setEditingItemId(null);
      setIsReviewing(false);
    }
    setOrderEntryMode("return");
  }

  function showVendorReturnOrder() {
    if (orderMethod !== "vendorReturn") {
      if (isReturnOrder) {
        setOrderNumber("");
      }
      setOrderMethod("vendorReturn");
      setItems((currentItems) =>
        currentItems.map((item) => ({
          ...item,
          path: "vendorReturn",
          vendor: vendorReturnVendor,
          supplierAddress: deliveryAddress,
          poNumber: vendorReturnPoNumber,
          routeDate: "",
          supplierDate: deliveryDate,
        })),
      );
      setActiveItemId(null);
      setEditingItemId(null);
      setIsReviewing(false);
    }
    setOrderEntryMode("vendorReturn");
  }

  function handleBusinessNameChange(nextBusinessName) {
    setBusinessName(nextBusinessName);

    const matchingCustomer = customerAccountOptions.find(
      (account) =>
        String(account.name || "").trim().toLowerCase() ===
        String(nextBusinessName || "").trim().toLowerCase(),
    );

    if (!matchingCustomer) {
      return;
    }

    setBusinessName(matchingCustomer.businessName || matchingCustomer.name);
    setAccountNumber(matchingCustomer.accountNumber);
  }

  async function processOrder({ allowDuplicateOrder = false } = {}) {
    if (!canProcessOrder || isProcessingOrder) {
      return;
    }

    if (duplicateOrderMatch && !allowDuplicateOrder) {
      setIsDuplicateOrderPromptOpen(true);
      return;
    }

    if (typeof onProcessOrder !== "function") {
      setProcessError("Order processing is not connected yet.");
      return;
    }

    setIsProcessingOrder(true);
    setProcessError("");
    setProcessSummary(null);

    try {
      const summary = await onProcessOrder(
        buildOrderPayload({ allowDuplicateOrder }),
      );
      setProcessSummary(summary || {});
      onPageChange?.(
        summary?.vendorReturnCreated ? "supplier-runs-dispatch" : "dashboard",
      );
    } catch (error) {
      console.error("Unable to process order flow:", error);
      setProcessError(
        error?.message || "Unable to process this order. Please try again.",
      );
    } finally {
      setIsProcessingOrder(false);
    }
  }

  async function deleteDuplicateOrder() {
    if (
      typeof onDeleteExistingOrder !== "function" ||
      !duplicateOrderNumber ||
      isDeletingDuplicateOrder
    ) {
      return;
    }

    setIsDeletingDuplicateOrder(true);
    setDuplicateDeleteError("");

    try {
      const wasDeleted = await onDeleteExistingOrder(duplicateOrderNumber);

      if (!wasDeleted) {
        return;
      }

      setIsDuplicateOrderPromptOpen(false);
      setViewingDuplicateOrderNumber("");
      setReviewedDuplicateOrderKey("");
    } catch (error) {
      console.error("Unable to permanently delete duplicate order:", error);
      setDuplicateDeleteError(
        error?.message ||
          "Unable to delete the existing order. Please try again.",
      );
    } finally {
      setIsDeletingDuplicateOrder(false);
    }
  }

  function resetStockPO() {
    setStockPoNumber("");
    setStockVendor("");
    setStockVendorAddress("");
    setStockFulfillmentMethod("wePickup");
    setStockScheduledDate("");
    setStockItems([createBlankStockItem()]);
    setStockDriverNotesEnabled(false);
    setStockNotes("");
    setStockProcessError("");
    setStockProcessSummary(null);
  }

  function updateStockVendor(vendor) {
    setStockVendor(vendor);
    setStockVendorAddress(getVendorAddress(vendor, supplierAddressMap));
  }

  function updateStockItem(itemId, updates) {
    setStockItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    );
  }

  function addStockItem() {
    setStockItems((currentItems) => [
      ...currentItems,
      createBlankStockItem(),
    ]);
  }

  function deleteStockItem(itemId) {
    setStockItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      return nextItems.length > 0 ? nextItems : [createBlankStockItem()];
    });
  }

  async function processStockPO() {
    if (!canProcessStockPO || isProcessingStockPO) {
      return;
    }

    if (typeof onProcessStockPO !== "function") {
      setStockProcessError("Stock PO processing is not connected yet.");
      return;
    }

    setIsProcessingStockPO(true);
    setStockProcessError("");
    setStockProcessSummary(null);

    try {
      const summary = await onProcessStockPO({
        poNumber: stockPoNumber,
        vendor: stockVendor,
        vendorAddress: stockVendorAddress,
        fulfillmentMethod: stockFulfillmentMethod,
        scheduledDate: stockScheduledDate,
        items: validStockItems.map((item) => ({
          quantity: String(item.quantity || "").trim(),
          itemNumber: String(item.itemNumber || "").trim(),
          description: String(item.description || "").trim(),
          easilyDamaged: Boolean(item.easilyDamaged),
        })),
        notes: stockDriverNotesEnabled ? stockNotes : "",
        orderedBy,
        createdBy: currentUser,
      });
      setStockProcessSummary(summary || {});
      onPageChange?.("dashboard");
    } catch (error) {
      console.error("Unable to process stock PO:", error);
      setStockProcessError(
        error?.message || "Unable to save this stock PO. Please try again.",
      );
    } finally {
      setIsProcessingStockPO(false);
    }
  }

  if (isReviewing) {
    return (
      <PageContainer>
        <Breadcrumbs
          items={[
            { label: "New Home", onClick: () => onPageChange?.("new-home") },
            { label: "Orders" },
            { label: "Review" },
          ]}
        />

        <button
          type="button"
          onClick={() => setIsReviewing(false)}
          className="mb-4 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Order
        </button>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Review Order
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                {orderNumber || "000-000"}
              </h1>
              <p className="mt-2 text-lg font-black text-slate-700">
                {businessName || "Business name"}
              </p>
              {accountNumber ? (
                <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                  Account # {accountNumber}
                </p>
              ) : null}
              <p className="text-sm font-bold text-slate-500">
                {customerName || "Customer name"} · {phoneNumber || "No phone"}
              </p>
            </div>

            <span
              className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${selectedHandoff.tone}`}
            >
              <SelectedHandoffIcon className="h-4 w-4" aria-hidden="true" />
              {selectedHandoff.label}
            </span>
            {["delivery", "return"].includes(orderMethod) ? (
              <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {isReturnOrder ? "Return Date" : "Delivery Date"}
                </p>
                <p className="text-sm font-black text-slate-950">
                  {deliveryDateText}
                </p>
              </div>
            ) : null}
          </div>

          <div
            className={`mt-6 grid gap-4 ${
              orderMethod === "delivery" ? "xl:grid-cols-[1fr_1fr]" : ""
            }`}
          >
            {orderMethod === "delivery" ? (
            <>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Customer Handoff
              </p>
              <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      From
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      Capital Lumber
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      {CAPITAL_LUMBER_ADDRESS}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      To
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {deliveryAddress || "No delivery address"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                          Route ETA From Our Yard
                        </p>
                        <p className="mt-1 text-2xl font-black text-emerald-900">
                          {routeEtaStatus === "loading"
                            ? "Calculating..."
                            : routeEta?.durationText || "Not calculated"}
                        </p>
                        <p className="text-sm font-bold text-emerald-700">
                          {routeEta?.distanceText
                            ? `${routeEta.distanceText} one-way`
                            : routeEtaMessage ||
                              "Enter a delivery address to calculate the route."}
                        </p>
                      </div>

                      {routeMapUrl ? (
                        <a
                          href={routeMapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                        >
                          Open Route
                          <ExternalLink
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </a>
                      ) : null}
                    </div>
                  </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Delivery Setup
              </p>
              <div className="mt-3 rounded-2xl border border-red-100 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                    <SelectedUnloadIcon
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                      Delivery Type
                    </p>
                    <p className="text-lg font-black text-slate-950">
                      {unloadType}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <span
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${
                    hasHardware
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-red-50 text-[#FC2C38]"
                  }`}
                >
                  {hasHardware ? "Hardware included" : "No hardware"}
                </span>
                <span
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${
                    needsTarp
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-red-50 text-[#FC2C38]"
                  }`}
                >
                  {needsTarp ? "Tarp needed" : "No tarp"}
                </span>
              </div>

              {deliveryNotes ? (
                <div className="mt-3 rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Delivery Notes
                  </p>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                    {deliveryNotes}
                  </p>
                </div>
              ) : null}
            </div>
            </>
            ) : (
              <div
                className={`rounded-3xl border p-5 ${
                  orderMethod === "pod"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-blue-200 bg-blue-50 text-blue-900"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <SelectedHandoffIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">
                      Customer Handoff
                    </p>
                    <p className="mt-1 text-xl font-black">
                      {selectedHandoff.label}
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {selectedHandoff.description}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Items
              </p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                {savedItems.length} items
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {savedItems.map((item) => (
                <div
                  key={`review-page-${item.id}`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">
                        {item.quantity ? `QTY ${item.quantity} · ` : ""}
                        {item.description || "Unnamed item"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        {item.path === "inStock"
                          ? "From Capital Lumber yard · No PO required"
                          : `${item.vendor || "No vendor"} · PO ${item.poNumber || "not entered"}`}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                        {item.path === "inStock"
                          ? "Ready from stock"
                          : `${getItemDateLabel(item.path)} ${
                              formatShortDate(getItemDateValue(item)) || "No date"
                            }`}
                      </p>
                    </div>
                    <WorkflowPill pathId={item.path} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => processOrder()}
            disabled={!canProcessOrder || isProcessingOrder}
            className="mt-5 inline-flex min-h-[64px] w-full items-center justify-center rounded-[1.5rem] bg-[#FC2C38] px-6 text-xl font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isProcessingOrder ? "Processing..." : "Process Order"}
          </button>

          {processError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
              {processError}
            </div>
          ) : null}

          {processSummary ? (
            <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Order Processed
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-800">
                Linked South, Their Truck, POD, Delivery, and Build records
                were created where needed.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-emerald-900">
                <span className="rounded-full bg-white px-3 py-1.5">
                  South {processSummary.southCount || 0}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5">
                  Their Truck {processSummary.theirTruckCount || 0}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5">
                  POD {processSummary.podCount || 0}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5">
                  Delivery {processSummary.deliveryCreated ? "yes" : "no"}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onPageChange?.("order-builds")}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
                >
                  View Build Watch
                </button>
                <button
                  type="button"
                  onClick={() => onPageChange?.("new-home")}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 text-sm font-black text-emerald-800"
                >
                  Back to New Home
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </PageContainer>
    );
  }

  if (orderEntryMode === "stock") {
    return (
      <PageContainer>
        <Breadcrumbs items={[{ label: "Orders" }, { label: "Stock PO" }]} />

        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
              Internal Stock
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              New Stock PO
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-bold text-slate-500">
              Enter one PO for Capital Lumber stock and send it to South pickup
              or Their Truck delivery.
            </p>
          </div>

        </div>

        <OrderEntryToolbar
          mode="stock"
          orderedBy={orderedBy}
          orderedByOptions={orderedByOptions}
          onOrderedByChange={setOrderedBy}
          onModeChange={(nextMode) => {
            if (nextMode === "customer") {
              showCustomerOrder();
            } else if (nextMode === "return") {
              showReturnOrder();
            } else if (nextMode === "vendorReturn") {
              showVendorReturnOrder();
            }
          }}
        />

        <section className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Warehouse className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Stock purchase order
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                No customer delivery, tarp, hardware, or address details needed.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Field label="PO Number">
              <TextInput
                value={stockPoNumber}
                onChange={(event) =>
                  setStockPoNumber(formatOrderNumberInput(event.target.value))
                }
                placeholder="123-456"
                inputMode="numeric"
                maxLength={7}
                className="text-xl font-black"
              />
            </Field>

            <Field label="Vendor">
              <SearchableSelect
                value={stockVendor}
                options={vendorOptions}
                onChange={updateStockVendor}
                allowCustomValue
                placeholder="Start typing a vendor..."
                accent="green"
                inputBackgroundClassName="bg-slate-100 focus:bg-white"
              />
            </Field>

            <div className="lg:col-span-2">
              <Field label="Vendor Address">
                <TextInput
                  value={stockVendorAddress}
                  onChange={(event) => setStockVendorAddress(event.target.value)}
                  placeholder="Select a saved vendor to fill its address..."
                />
              </Field>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              How is it getting here?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStockFulfillmentMethod("wePickup")}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  stockFulfillmentMethod === "wePickup"
                    ? "border-[#FC2C38] bg-red-50 ring-4 ring-red-100"
                    : "border-slate-200 bg-slate-50 hover:bg-white"
                }`}
              >
                <Truck className="h-6 w-6 text-[#FC2C38]" aria-hidden="true" />
                <div>
                  <p className="font-black text-slate-950">We Pickup</p>
                  <p className="text-sm font-bold text-slate-500">
                    Send this PO to the South pickup board.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStockFulfillmentMethod("supplierDelivery")}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  stockFulfillmentMethod === "supplierDelivery"
                    ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                    : "border-slate-200 bg-slate-50 hover:bg-white"
                }`}
              >
                <Package className="h-6 w-6 text-blue-700" aria-hidden="true" />
                <div>
                  <p className="font-black text-slate-950">They Deliver</p>
                  <p className="text-sm font-bold text-slate-500">
                    Add this PO to Their Truck receiving.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-3 max-w-xs">
            <Field
              label={
                stockFulfillmentMethod === "wePickup"
                  ? "Pickup Date"
                  : "Delivery Date"
              }
            >
              <TextInput
                type="date"
                value={stockScheduledDate}
                onChange={(event) => setStockScheduledDate(event.target.value)}
              />
            </Field>
          </div>

          <section className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  PO Items
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Material on this PO
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Add every item before saving. They will stay together under PO {stockPoNumber || "000-000"}.
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {stockItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">
                      Item {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteStockItem(item.id)}
                      disabled={stockItems.length === 1}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[130px_190px_minmax(0,1fr)]">
                    <Field label="Quantity Optional">
                      <TextInput
                        value={item.quantity}
                        onChange={(event) =>
                          updateStockItem(item.id, {
                            quantity: event.target.value,
                          })
                        }
                        placeholder="Qty"
                      />
                    </Field>
                    <Field label="Item # Optional">
                      <InventoryItemNumberInput
                        value={item.itemNumber}
                        catalog={availableInventoryCatalog}
                        onChange={(itemNumber) =>
                          updateStockItem(item.id, { itemNumber })
                        }
                        onSelect={(inventoryItem) => {
                          updateStockItem(item.id, {
                            itemNumber: inventoryItem.itemNumber,
                            description: inventoryItem.description,
                          });
                          if (inventoryItem.defaultVendor) {
                            updateStockVendor(inventoryItem.defaultVendor);
                          }
                        }}
                      />
                    </Field>
                    <Field label="Material">
                      <TextInput
                        value={item.description}
                        onChange={(event) =>
                          updateStockItem(item.id, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Material description"
                      />
                    </Field>
                  </div>

                  <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                    <span>
                      <span className="block text-sm font-black text-slate-950">
                        Easily damaged?
                      </span>
                      <span className="mt-0.5 block text-xs font-bold text-amber-800">
                        Driver will see needs corners/protection for this item.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={item.easilyDamaged}
                      onChange={(event) =>
                        updateStockItem(item.id, {
                          easilyDamaged: event.target.checked,
                        })
                      }
                      className="h-6 w-6 shrink-0 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                  </label>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStockItem}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Item
            </button>
          </section>

          <div className="mt-5">
            <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={stockDriverNotesEnabled}
                  onChange={(event) =>
                    setStockDriverNotesEnabled(event.target.checked)
                  }
                  className="mt-1 h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  <span className="block text-sm font-black text-slate-950">
                    Add driver notes for this PO
                  </span>
                  <span className="mt-1 block text-sm font-bold text-amber-800">
                    {stockFulfillmentMethod === "wePickup"
                      ? "Notes show on the South driver pickup card."
                      : "Notes stay with the PO for receiving."}
                  </span>
                </span>
              </label>

              {stockDriverNotesEnabled ? (
                <textarea
                  value={stockNotes}
                  onChange={(event) => setStockNotes(event.target.value)}
                  placeholder="Anything the driver should know about this PO or pickup..."
                  rows={3}
                  className="mt-4 w-full resize-none rounded-xl border border-amber-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition placeholder:text-amber-700/60 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                />
              ) : null}
            </section>
          </div>

          <button
            type="button"
            onClick={processStockPO}
            disabled={
              !canProcessStockPO ||
              isProcessingStockPO ||
              Boolean(stockProcessSummary)
            }
            className="mt-5 inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-lg font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            {isProcessingStockPO
              ? "Saving Stock PO..."
              : `Save to ${
                  stockFulfillmentMethod === "wePickup"
                    ? "South"
                    : "Their Truck"
                }`}
          </button>

          {stockProcessError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
              {stockProcessError}
            </div>
          ) : null}

          {stockProcessSummary ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-lg font-black text-emerald-900">
                PO {stockProcessSummary.poNumber || stockPoNumber} saved
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-700">
                Added {stockProcessSummary.itemCount || validStockItems.length} item{(stockProcessSummary.itemCount || validStockItems.length) === 1 ? "" : "s"} to {stockProcessSummary.destination || "fulfillment"}.
              </p>
              <button
                type="button"
                onClick={resetStockPO}
                className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm"
              >
                Add Another Stock PO
              </button>
            </div>
          ) : null}
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Orders" },
          {
            label: isVendorReturnOrder
              ? "New Vendor Return"
              : isReturnOrder
                ? "New Return"
                : "New Customer Order",
          },
        ]}
      />

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
              {isVendorReturnOrder
                ? "Vendor Return Delivery"
                : isReturnOrder
                  ? "Customer Return"
                  : "Customer Order"}
            </p>
            {!isReturnWorkflow ? (
              <button
                type="button"
                onClick={() => setIsOrderImportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
              >
                <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                Import order file
              </button>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {isVendorReturnOrder
                ? "New Vendor Return"
                : isReturnOrder
                  ? "New Return"
                  : "New Customer Order"}
            </h1>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm lg:w-auto lg:min-w-[360px]">
          <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {isVendorReturnOrder
                    ? "Current Vendor Return"
                    : isReturnOrder
                      ? "Current Return"
                      : "Current Order"}
                </p>
                <p className="truncate text-sm font-black text-slate-700">
                  {isVendorReturnOrder
                    ? `${vendorReturnVendor || "Vendor"} · PO ${vendorReturnPoNumber || "not entered"}`
                    : `${businessName || "Business name"} · ${customerName || "Customer name"}`}
                </p>
                {accountNumber ? (
                  <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Account # {accountNumber}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-xl font-black tracking-tight text-slate-950">
                  {orderNumber || (isReturnOrder ? "R000000" : "000-000")}
                </p>
                <p className="text-xs font-bold text-slate-500">
                  {isVendorReturnOrder
                    ? deliveryAddress || "No vendor address"
                    : phoneNumber || "No phone"}
                </p>
                <span
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${selectedHandoff.tone}`}
                >
                  <SelectedHandoffIcon
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {selectedHandoff.label}
                </span>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {orderMethod === "delivery"
                    ? `Delivery ${deliveryDateText}`
                    : selectedHandoff.description}
                </p>
              </div>
          </div>
        </div>
      </div>

      <OrderEntryToolbar
        mode={orderEntryMode}
        orderedBy={orderedBy}
        orderedByOptions={orderedByOptions}
        onOrderedByChange={setOrderedBy}
        onModeChange={(nextMode) => {
          if (nextMode === "customer") {
            showCustomerOrder();
          } else if (nextMode === "stock") {
            setOrderEntryMode("stock");
          } else if (nextMode === "vendorReturn") {
            showVendorReturnOrder();
          } else {
            showReturnOrder();
          }
        }}
      />

      {isOrderImportOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-import-title"
        >
          <section className="relative w-full max-w-4xl rounded-[2rem] border border-blue-200 bg-blue-50 p-5 shadow-2xl sm:p-6">
            <button
              type="button"
              onClick={() => setIsOrderImportOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-white text-slate-600 shadow-sm transition hover:bg-blue-100"
              aria-label="Close order import"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
        <div className="flex flex-col gap-5 pr-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
                Import Order Draft
              </p>
              <h2
                id="order-import-title"
                className="text-lg font-black text-slate-950"
              >
                Drop an order document and review what it finds
              </h2>
              <p className="mt-0.5 text-sm font-bold text-slate-500">
                PDF, image, Excel, or CSV · Nothing is saved until you review
                and process the order.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                importOrderFile(event.dataTransfer.files?.[0]);
              }}
              className={`flex min-h-[56px] min-w-0 cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed bg-white px-4 transition hover:border-blue-500 hover:bg-blue-50 sm:min-w-[330px] ${
                orderImportStatus === "error"
                  ? "border-red-300"
                  : "border-blue-300"
              }`}
            >
              {orderImportStatus === "loading" ? (
                <LoaderCircle
                  className="h-5 w-5 shrink-0 animate-spin text-blue-700"
                  aria-hidden="true"
                />
              ) : orderImportFileName ? (
                <FileText
                  className="h-5 w-5 shrink-0 text-blue-700"
                  aria-hidden="true"
                />
              ) : (
                <FileUp
                  className="h-5 w-5 shrink-0 text-blue-700"
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-slate-900">
                  {orderImportStatus === "loading"
                    ? `Reading ${orderImportFileName || "document"}...`
                    : orderImportFileName || "Choose or drop an order"}
                </span>
                <span className="block text-xs font-bold text-slate-500">
                  {orderImportStatus === "success"
                    ? "Draft ready to review"
                    : "Up to 3 MB"}
                </span>
              </span>
              <input
                type="file"
                accept=".pdf,.xls,.xlsx,.csv,.tsv,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                disabled={orderImportStatus === "loading"}
                onChange={(event) => {
                  importOrderFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>

            {orderImportStatus === "success" && orderImportDraft ? (
              <button
                type="button"
                onClick={() => setIsOrderImportReviewOpen(true)}
                className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-blue-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
              >
                Review Draft
              </button>
            ) : null}
          </div>
        </div>

        {orderImportError ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700">
            {orderImportError}
          </div>
        ) : null}
          </section>
        </div>
      ) : null}

      {isOrderImportReviewOpen && orderImportDraft ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-import-review-title"
        >
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
                  Imported Draft · {orderImportFileName}
                </p>
                <h2
                  id="order-import-review-title"
                  className="mt-1 text-2xl font-black text-slate-950"
                >
                  Review before filling the order
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Missing or uncertain fields stay blank so you can correct
                  them in the regular form.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOrderImportReviewOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                aria-label="Close import review"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Order #", orderImportDraft.orderNumber],
                  ["Business", orderImportDraft.businessName],
                  ["Customer", orderImportDraft.customerName],
                  ["Account #", orderImportDraft.accountNumber],
                  ["Phone", orderImportDraft.phoneNumber],
                  [
                    "Handoff",
                    orderImportDraft.orderMethod
                      ? getHandoffOption(orderImportDraft.orderMethod).label
                      : "",
                  ],
                  ["Delivery date", orderImportDraft.deliveryDate],
                  ["Delivery address", orderImportDraft.deliveryAddress],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 break-words text-sm font-black text-slate-900">
                      {value || "Not found"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
                      Extracted Items
                    </p>
                    <p className="text-lg font-black text-slate-950">
                      {orderImportDraft.items?.length || 0} line item
                      {(orderImportDraft.items?.length || 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">
                    Review each line
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  {(orderImportDraft.items || []).map((item, index) => (
                    <div
                      key={`${item.itemNumber}-${item.description}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-black text-slate-950">
                            {item.quantity ? `QTY ${item.quantity} · ` : ""}
                            {item.description || "Description not found"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {[
                              item.itemNumber
                                ? `Item # ${item.itemNumber}`
                                : "",
                              item.vendor ? `Vendor ${item.vendor}` : "",
                              item.poNumber ? `PO ${item.poNumber}` : "",
                              item.scheduledDate || "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || "No additional details found"}
                          </p>
                        </div>
                        <WorkflowPill
                          pathId={item.fulfillment || "supplierDelivery"}
                        />
                      </div>
                    </div>
                  ))}

                  {!orderImportDraft.items?.length ? (
                    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm font-black text-amber-800">
                      No item lines were found. You can still apply the customer
                      details and add items manually.
                    </div>
                  ) : null}
                </div>
              </div>

              {orderImportDraft.notes ? (
                <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Notes found
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {orderImportDraft.notes}
                  </p>
                </div>
              ) : null}

              {orderImportDraft.warnings?.length ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                    Needs a human check
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm font-bold text-amber-900">
                    {orderImportDraft.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsOrderImportReviewOpen(false)}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyImportedOrder}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-blue-700 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Apply Draft to Order
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Step 1
            </p>
            <h2 className="text-xl font-black text-slate-950">
              {isVendorReturnOrder
                ? "Vendor return information"
                : isReturnOrder
                  ? "Return information"
                  : "Order information"}
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
            {isVendorReturnOrder
              ? "Existing order + PO"
              : isReturnOrder
                ? "Unique return ID"
                : "6 digit order"}
          </span>
        </div>

        {isVendorReturnOrder ? (
          <div className="grid gap-2.5 xl:grid-cols-[150px_minmax(220px,1fr)_170px_minmax(280px,1.5fr)] xl:items-end">
            <Field label="Order #">
              <TextInput
                value={orderNumber}
                onChange={(event) =>
                  setOrderNumber(formatOrderNumberInput(event.target.value))
                }
                placeholder="029-499"
                inputMode="numeric"
                maxLength={7}
                className="text-xl font-black"
              />
            </Field>

            <Field label="Vendor">
              <SearchableSelect
                value={vendorReturnVendor}
                options={vendorOptions}
                onChange={(nextVendor) => {
                  const nextAddress = getVendorAddress(
                    nextVendor,
                    supplierAddressMap,
                  );
                  setVendorReturnVendor(nextVendor);
                  if (nextAddress) {
                    setDeliveryAddress(nextAddress);
                  }
                  setItems((currentItems) =>
                    currentItems.map((item) => ({
                      ...item,
                      path: "vendorReturn",
                      vendor: nextVendor,
                      supplierAddress: nextAddress || deliveryAddress,
                    })),
                  );
                }}
                allowCustomValue
                placeholder="Choose vendor..."
                accent="blue"
                inputBackgroundClassName="bg-slate-100 focus:bg-white"
              />
            </Field>

            <Field label="PO Number">
              <TextInput
                value={vendorReturnPoNumber}
                onChange={(event) => {
                  const nextPoNumber = formatOrderNumberInput(event.target.value);
                  setVendorReturnPoNumber(nextPoNumber);
                  setItems((currentItems) =>
                    currentItems.map((item) => ({
                      ...item,
                      poNumber: nextPoNumber,
                    })),
                  );
                }}
                placeholder="444-185"
                inputMode="numeric"
                maxLength={7}
              />
            </Field>

            <Field label="Vendor Address">
              <AddressAutocompleteInput
                value={deliveryAddress}
                onChange={(nextAddress) => {
                  setDeliveryAddress(nextAddress);
                  setItems((currentItems) =>
                    currentItems.map((item) => ({
                      ...item,
                      supplierAddress: nextAddress,
                    })),
                  );
                }}
                autoComplete="off"
                enableLocalFallback
                placeholder="Start typing the vendor address..."
                showStatus={false}
                className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
              />
            </Field>
          </div>
        ) : (
        <div className="grid gap-2.5 xl:grid-cols-[150px_minmax(180px,1.1fr)_minmax(170px,1fr)_170px_135px] xl:items-end">
          <Field label={isReturnOrder ? "Return #" : "Order #"}>
            <TextInput
              value={orderNumber}
              onChange={(event) => {
                if (!isReturnOrder) {
                  setOrderNumber(formatOrderNumberInput(event.target.value));
                  setIsDuplicateOrderPromptOpen(false);
                  setReviewedDuplicateOrderKey("");
                }
              }}
              placeholder={isReturnOrder ? "R000000" : "019-390"}
              inputMode={isReturnOrder ? "text" : "numeric"}
              maxLength={7}
              readOnly={isReturnOrder}
              className={`text-xl font-black ${
                isReturnOrder ? "cursor-default bg-violet-50 text-violet-800" : ""
              }`}
            />
          </Field>

          <Field label="Business Name">
            <div className="relative">
              <Building2
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <TextInput
                value={businessName}
                onChange={(event) =>
                  handleBusinessNameChange(event.target.value)
                }
                placeholder="Business name"
                className="pl-12"
                list="order-business-names"
                autoComplete="off"
              />
              <datalist id="order-business-names">
                {customerAccountOptions.map((account) => (
                  <option
                    key={`${account.accountType}-${account.accountNumber}-${account.name}`}
                    value={account.name}
                    label={`Account ${account.accountNumber} · ${
                      account.accountType === "charge"
                        ? "Charge"
                        : account.accountType === "cash"
                          ? "Cash"
                          : "Customer"
                    }`}
                  />
                ))}
              </datalist>
            </div>
          </Field>

          <Field label="Customer Name">
            <div className="relative">
              <UserRound
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <TextInput
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
                className="pl-12"
              />
            </div>
          </Field>

          <Field label="Phone">
            <TextInput
              value={phoneNumber}
              onChange={(event) =>
                setPhoneNumber(formatPhoneInput(event.target.value))
              }
              placeholder="(208) 555-0192"
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>

          <Field label="Account #">
            <div>
              <div className="relative">
                <TextInput
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  placeholder="Optional"
                  list="order-customer-accounts"
                  autoComplete="off"
                  className={linkedCustomerAccount ? "pr-12" : ""}
                />
                {linkedCustomerAccount ? (
                  <span
                    className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-700 text-white"
                    title="Account found"
                    aria-label="Account found"
                  >
                    <Check
                      className="h-4 w-4"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  </span>
                ) : null}
              </div>
              <datalist id="order-customer-accounts">
                {customerAccountOptions.map((account) => (
                  <option
                    key={`${account.accountType}-${account.accountNumber}`}
                    value={account.accountNumber}
                    label={`${account.name || "Unnamed account"} · ${
                      account.accountType === "charge"
                        ? "Charge"
                        : account.accountType === "cash"
                          ? "Cash"
                          : "Customer"
                    }`}
                  />
                ))}
              </datalist>
              {!linkedCustomerAccount && accountNumber.trim() ? (
                <p className="mt-1.5 truncate text-[11px] font-bold text-slate-400">
                  No saved account match
                </p>
              ) : null}
            </div>
          </Field>
        </div>
        )}

        {duplicateOrderMatch ? (
          <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">
                    Duplicate order number
                  </p>
                  {duplicateOrderIsArchived ? (
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                      Archived
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-bold text-amber-950">
                  Order {duplicateOrderNumber} already exists for {duplicateOrderCustomer}.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReviewedDuplicateOrderKey(duplicateOrderKey);
                    setViewingDuplicateOrderNumber(duplicateOrderNumber);
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-amber-900 px-4 text-sm font-black text-white transition hover:bg-amber-800"
                >
                  View existing order
                </button>
                {typeof onDeleteExistingOrder === "function" ? (
                  <button
                    type="button"
                    onClick={() => void deleteDuplicateOrder()}
                    disabled={isDeletingDuplicateOrder}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {isDeletingDuplicateOrder ? "Deleting..." : "Delete permanently"}
                  </button>
                ) : null}
              </div>
            </div>
            {duplicateDeleteError ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700">
                {duplicateDeleteError}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5">
        <div
          className={`grid gap-3 ${
            isReturnWorkflow
              ? "xl:grid-cols-[260px_1fr] xl:items-start"
              : "lg:grid-cols-[minmax(180px,1fr)_minmax(420px,560px)] lg:items-end"
          }`}
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Step 2
            </p>
            <h2 className="text-xl font-black text-slate-950">
              {isVendorReturnOrder
                ? "Vendor return delivery"
                : isReturnOrder
                  ? "Return pickup"
                  : "Customer handoff"}
            </h2>

            {isReturnWorkflow ? (
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                {isVendorReturnOrder
                  ? "Send the selected material from Capital Lumber back to the supplier."
                  : "Enter the address where the material needs to be picked up."}
              </p>
            ) : null}
          </div>

          {!isReturnWorkflow ? (
            <div className="grid grid-cols-3 gap-1.5">
              {handoffOptions.filter((option) => !["return", "vendorReturn"].includes(option.id)).map((option) => {
                const OptionIcon = option.icon;
                const isSelected = orderMethod === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setOrderMethod(option.id)}
                    className={`inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-black transition sm:gap-2 sm:px-3 sm:text-sm ${
                      isSelected
                        ? "border-[#FC2C38] bg-red-50 text-[#FC2C38] ring-4 ring-red-100"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <OptionIcon className="h-4 w-4" aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {isReturnWorkflow ? (
            <div className={`rounded-2xl border p-3 ${
              isVendorReturnOrder
                ? "border-amber-200 bg-amber-50/60"
                : "border-violet-200 bg-violet-50/60"
            }`}>
              <div className="grid gap-3 xl:grid-cols-[180px_1fr] xl:items-start">
                <Field label={isVendorReturnOrder ? "Vendor Return Date" : "Return Date"}>
                  <TextInput
                    type="date"
                    value={deliveryDate}
                    onChange={(event) => setDeliveryDate(event.target.value)}
                  />
                </Field>

                <Field label={isVendorReturnOrder ? "Vendor Address" : "Return Pickup Address"}>
                  <div className="relative">
                    <MapPin
                      className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${
                        isVendorReturnOrder ? "text-amber-600" : "text-violet-500"
                      }`}
                      aria-hidden="true"
                    />
                    <AddressAutocompleteInput
                      value={deliveryAddress}
                      onChange={setDeliveryAddress}
                      autoComplete="off"
                      enableLocalFallback
                      placeholder={
                        isVendorReturnOrder
                          ? "Start typing the vendor return address..."
                          : "Start typing the return pickup address..."
                      }
                      showStatus={false}
                      className={`w-full rounded-2xl border bg-white py-3 pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                        isVendorReturnOrder
                          ? "border-amber-200 focus:border-amber-500 focus:ring-amber-100"
                          : "border-violet-200 focus:border-violet-500 focus:ring-violet-100"
                      }`}
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-2">
                <Field label={isVendorReturnOrder ? "Vendor Return Notes" : "Return Notes"}>
                  <textarea
                    value={deliveryNotes}
                    onChange={(event) => setDeliveryNotes(event.target.value)}
                    placeholder={
                      isVendorReturnOrder
                        ? "Return authorization, contact, material condition, loading notes, or anything the driver should know..."
                        : "What is being returned, its condition, pickup location, who to ask for, or anything the driver should know..."
                    }
                    rows={2}
                    className={`w-full resize-none rounded-xl border bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                      isVendorReturnOrder
                        ? "border-amber-200 focus:border-amber-500 focus:ring-amber-100"
                        : "border-violet-200 focus:border-violet-500 focus:ring-violet-100"
                    }`}
                  />
                </Field>
              </div>
            </div>
          ) : null}
        </div>

        {!isReturnWorkflow && orderMethod === "delivery" ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2.5 xl:grid-cols-[310px_minmax(260px,1fr)_210px_160px] xl:items-end">
                <Field label="Delivery Timing">
                  <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryDate("")}
                      aria-pressed={!deliveryDate}
                      className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
                        !deliveryDate
                          ? "border-[#FC2C38] bg-[#FC2C38] text-white shadow-sm"
                          : "border-slate-300 bg-white text-slate-600 hover:border-[#FC2C38] hover:text-[#FC2C38]"
                      }`}
                    >
                      Future Date
                    </button>
                    <FutureDeliveryDatePicker
                      value={deliveryDate}
                      onChange={setDeliveryDate}
                    />
                  </div>
                  {!deliveryDate ? (
                    <span className="mt-1.5 block text-[11px] font-bold text-[#FC2C38]">
                      Delivery is set up now and can be scheduled later.
                    </span>
                  ) : null}
                </Field>

                <Field label="Delivery Address">
                  <div className="relative">
                    <MapPin
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <AddressAutocompleteInput
                      value={deliveryAddress}
                      onChange={setDeliveryAddress}
                      autoComplete="off"
                      enableLocalFallback
                      placeholder="Start typing the delivery address..."
                      showStatus={false}
                      className="w-full rounded-xl border border-slate-300 bg-slate-100 py-2.5 pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
                    />
                  </div>
                </Field>

                <Field label="Delivery Title">
                  <TextInput
                    value={deliveryTitle}
                    onChange={(event) => setDeliveryTitle(event.target.value)}
                    placeholder="Order 1, Basement, etc."
                  />
                </Field>

                <div className="min-h-[46px] rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Route ETA
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {routeEtaStatus === "loading"
                      ? "Calculating..."
                      : routeEta?.durationText || "Not calculated yet"}
                  </p>
                  {routeEta?.distanceText ? (
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      {routeEta.distanceText} one-way
                    </p>
                  ) : null}
                </div>
              </div>
              <p
                className={`mt-2 text-xs font-bold ${
                  routeEtaStatus === "error"
                    ? "text-amber-700"
                    : routeEtaStatus === "success"
                      ? "text-emerald-700"
                      : "text-slate-500"
                }`}
              >
                {routeEtaMessage ||
                  "Route time calculates from Capital Lumber once an address is entered."}
              </p>
          </div>
        ) : null}
      </section>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Step 3
            </p>
            <h2 className="text-xl font-black text-slate-950">
              {isVendorReturnOrder
                ? "Items going back to vendor"
                : isReturnOrder
                  ? "Return items"
                  : "Items & fulfillment"}
            </h2>
            <p className="mt-0.5 text-xs font-bold text-slate-500 sm:text-sm">
              {isVendorReturnOrder
                ? `Add every item being returned to ${vendorReturnVendor || "the supplier"}.`
                : isReturnOrder
                  ? "Add every item that needs to come back to Capital Lumber."
                  : "Add material from Capital Lumber's yard or from a supplier."}
            </p>
          </div>
          {SHOW_SHIP_ORDER_COMPLETE_SHORTCUT &&
          !isReturnWorkflow &&
          orderMethod === "delivery" ? (
            <button
              type="button"
              onClick={shipOrderComplete}
              disabled={hasShipOrderCompleteItem}
              aria-pressed={hasShipOrderCompleteItem}
              title="Save the order now and add its individual line items later."
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border px-4 text-sm font-black transition ${
                hasShipOrderCompleteItem
                  ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-950 hover:bg-slate-950 hover:text-white"
              }`}
            >
              Ship Order Complete
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2">
          {items.map((item, index) => {
            const isActive = activeItemId === item.id || !item.saved;
            const isYardStock = item.path === "inStock";
            const supplierSetupComplete = Boolean(
              isYardStock ||
                (item.vendor && item.poNumber && getItemDateValue(item)),
            );

            if (!isActive) {
              const itemDate = getItemDateValue(item);
              const itemDateLabel = getItemDateLabel(item.path);

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                >
                  <div
                    className={`grid gap-2 sm:items-center ${
                      isReturnWorkflow
                        ? "sm:grid-cols-[42px_130px_minmax(220px,1fr)_140px_96px]"
                        : "sm:grid-cols-[42px_130px_minmax(180px,1fr)_190px_150px_96px]"
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-500">
                      {index + 1}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        QTY
                      </span>
                      <span className="text-sm font-black text-slate-950">
                        {item.quantity || "-"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">
                        {item.description || "New material"}
                      </p>
                        <p className="truncate text-xs font-bold text-slate-500">
                          {item.itemNumber ? `Item # ${item.itemNumber} · ` : ""}
                          {isVendorReturnOrder
                            ? `${vendorReturnVendor || "Vendor"} · PO ${vendorReturnPoNumber || "not entered"}`
                            : isReturnOrder
                            ? "Return item"
                            : isYardStock
                            ? "From Capital Lumber yard"
                            : `${item.vendor || "No vendor"} · PO ${item.poNumber || "not entered"}`}
                      </p>
                    </div>
                    {!isReturnWorkflow ? (
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {itemDateLabel}
                      </p>
                      <p className="truncate text-sm font-black text-slate-700">
                        {isYardStock
                          ? "Ready from stock"
                          : formatShortDate(itemDate) || "No date"}
                      </p>
                    </div>
                    ) : null}
                    {isReturnWorkflow ? (
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] ${
                        isVendorReturnOrder
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-violet-200 bg-violet-50 text-violet-700"
                      }`}>
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        {isVendorReturnOrder ? "Vendor Return" : "Return"}
                      </span>
                    ) : (
                      <WorkflowPill pathId={item.path} />
                    )}
                    <div className="flex items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => editItem(item.id)}
                        className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-[#FC2C38] transition hover:bg-red-50"
                        aria-label="Delete item"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            }

            return (
              <article
                key={item.id}
                className="rounded-3xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-blue-700 shadow-sm">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
                        Item {index + 1}
                      </p>
                      <p className="truncate text-lg font-black text-slate-950">
                        {item.description || "New material"}
                      </p>
                    </div>
                  </div>
                  {isReturnWorkflow ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] ${
                      isVendorReturnOrder
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-violet-200 bg-violet-50 text-violet-700"
                    }`}>
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      {isVendorReturnOrder ? "Vendor Return" : "Return"}
                    </span>
                  ) : (
                    <WorkflowPill pathId={item.path} />
                  )}
                </div>

                <div
                  className={`mt-3 grid gap-3 ${
                    isReturnWorkflow
                      ? "lg:grid-cols-[110px_180px_minmax(220px,1fr)]"
                      : "lg:grid-cols-[110px_220px_minmax(280px,1fr)]"
                  }`}
                >
                  <Field label="Qty">
                    <TextInput
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.id, { quantity: event.target.value })
                      }
                      placeholder="Qty"
                    />
                  </Field>
                  <Field label="Item # Optional">
                    <InventoryItemNumberInput
                      value={item.itemNumber}
                      catalog={availableInventoryCatalog}
                      onChange={(itemNumber) =>
                        updateItem(item.id, { itemNumber })
                      }
                      onSelect={(inventoryItem) => {
                        if (inventoryItem.manualDescription) {
                          updateItem(item.id, {
                            itemNumber: inventoryItem.itemNumber,
                            description: "",
                            ...(isVendorReturnOrder
                              ? {
                                  path: "vendorReturn",
                                  vendor: vendorReturnVendor,
                                  supplierAddress: deliveryAddress,
                                  poNumber: vendorReturnPoNumber,
                                  routeDate: "",
                                  supplierDate: deliveryDate,
                                }
                              : {
                                  path: "inStock",
                                  vendor: "",
                                  supplierAddress: "",
                                  poNumber: "",
                                  routeDate: "",
                                  supplierDate: "",
                                }),
                          });
                          return;
                        }

                        if (!inventoryItem.nonStocked) {
                          updateItem(item.id, {
                            itemNumber: inventoryItem.itemNumber,
                            description: inventoryItem.description,
                            ...(isVendorReturnOrder
                              ? {
                                  path: "vendorReturn",
                                  vendor: vendorReturnVendor,
                                  supplierAddress: deliveryAddress,
                                  poNumber: vendorReturnPoNumber,
                                  routeDate: "",
                                  supplierDate: deliveryDate,
                                }
                              : {
                                  path: "inStock",
                                  vendor: "",
                                  supplierAddress: "",
                                  poNumber: "",
                                  routeDate: "",
                                  supplierDate: "",
                                }),
                          });
                          return;
                        }

                        updateItem(item.id, {
                          itemNumber: inventoryItem.itemNumber,
                          description: inventoryItem.description,
                          ...(!isReturnWorkflow && item.path === "inStock"
                            ? { path: "supplierDelivery" }
                            : {}),
                        });

                        if (!isReturnWorkflow && inventoryItem.defaultVendor) {
                          updateItemVendor(
                            item.id,
                            inventoryItem.defaultVendor,
                          );
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label={
                      item.itemNumber === "SHIP"
                        ? "Material Notes"
                        : "Item Description"
                    }
                  >
                    <TextInput
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.id, {
                          description: event.target.value,
                        })
                      }
                      placeholder={
                        item.itemNumber === "SHIP"
                          ? "Material notes, load details, etc."
                          : "2x6-16 #2 Doug Fir"
                      }
                    />
                  </Field>
                </div>

                {!isReturnWorkflow ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 sm:text-[11px]">
                      Where is this material coming from?
                    </p>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {activeFulfillmentPaths.map((path) => {
                        const OptionIcon = path.icon;
                        const isSelected = item.path === path.id;

                        return (
                          <button
                            key={path.id}
                            type="button"
                            onClick={() =>
                              updateItem(item.id, {
                                path: path.id,
                                ...(path.id === "inStock"
                                  ? {
                                      vendor: "",
                                      supplierAddress: "",
                                      poNumber: "",
                                      routeDate: "",
                                      supplierDate: "",
                                    }
                                  : {}),
                              })
                            }
                            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition ${
                              isSelected
                                ? `${path.activeTone} ring-2`
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                            }`}
                            aria-pressed={isSelected}
                          >
                            <OptionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{path.shortLabel}</span>
                            {isSelected ? (
                              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {isReturnWorkflow ? (
                  <div className={`mt-4 flex items-center gap-3 rounded-2xl border p-4 ${
                    isVendorReturnOrder
                      ? "border-amber-200 bg-amber-50"
                      : "border-violet-200 bg-violet-50"
                  }`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${
                      isVendorReturnOrder ? "text-amber-800" : "text-violet-700"
                    }`}>
                      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className={`text-xs font-black uppercase tracking-[0.14em] ${
                        isVendorReturnOrder ? "text-amber-800" : "text-violet-700"
                      }`}>
                        {isVendorReturnOrder ? "Vendor return item" : "Return material"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-700">
                        {isVendorReturnOrder
                          ? `This item will leave Capital Lumber and go back to ${vendorReturnVendor || "the vendor"} · PO ${vendorReturnPoNumber || "not entered"}.`
                          : "This item will be picked up at the return address and brought back to Capital Lumber."}
                      </p>
                    </div>
                  </div>
                ) : isYardStock ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                      <Warehouse className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        From Capital Lumber yard
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-700">
                        This stocked item is ready to pull. No vendor or PO setup is needed.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
                          Supplier / PO
                        </p>
                        {supplierSetupComplete ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Ready
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-800">
                            Complete these fields
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        Reused automatically on the next item
                      </p>
                    </div>

                    <div className="mt-2.5 grid gap-2 md:grid-cols-[minmax(200px,1.35fr)_150px_180px_auto] md:items-end">
                      <Field label="Vendor">
                        <SearchableSelect
                          value={item.vendor}
                          options={vendorOptions}
                          onChange={(vendor) => updateItemVendor(item.id, vendor)}
                          allowCustomValue
                          placeholder="Vendor"
                          accent="blue"
                          inputBackgroundClassName="bg-slate-50 focus:bg-white"
                        />
                      </Field>
                      <Field label="PO #">
                        <TextInput
                          value={item.poNumber}
                          onChange={(event) =>
                            updateItem(item.id, {
                              poNumber: formatOrderNumberInput(event.target.value),
                            })
                          }
                          placeholder="444-185"
                          inputMode="numeric"
                          maxLength={7}
                        />
                      </Field>
                      <Field label={getItemDateLabel(item.path)}>
                        <div className="relative">
                          <CalendarDays
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                            aria-hidden="true"
                          />
                          <TextInput
                            type="date"
                            value={getItemDateValue(item)}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                item.path === "wePickup"
                                  ? { routeDate: event.target.value }
                                  : { supplierDate: event.target.value },
                              )
                            }
                            className="pl-10"
                          />
                        </div>
                      </Field>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(item.id)}
                        className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800"
                      >
                        More details
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-[#FC2C38]"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => saveItem(item.id)}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Save &amp; Finish
                  </button>
                  <button
                    type="button"
                    onClick={() => saveItemAndAddAnother(item.id)}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-sm transition ${
                      isReturnWorkflow
                        ? "bg-violet-600 hover:bg-violet-700"
                        : "bg-[#FC2C38] hover:bg-red-700"
                    }`}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Save &amp; Add Another
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addItem}
          className={`mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition ${
            isReturnWorkflow
              ? "bg-violet-600 text-white shadow-sm hover:bg-violet-700"
              : "bg-slate-950 text-white shadow-sm hover:bg-slate-800"
          }`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Item
        </button>
      </section>

      {isReturnOrder ? (
        <section className="mt-3 rounded-2xl border border-violet-200 bg-white p-3 shadow-sm sm:p-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700">
                Step 4
              </p>
              <h2 className="text-xl font-black text-slate-950">
                Type of return
              </h2>
              <p className="mt-0.5 text-xs font-bold text-slate-500 sm:text-sm">
                Tell dispatch how the returned material needs to be loaded.
              </p>
            </div>
            <span className="rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700">
              Return pickup
            </span>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {returnLoadTypes.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setReturnLoadType(option.id)}
                className={`flex min-h-[72px] items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  returnLoadType === option.id
                    ? "border-violet-500 bg-violet-50 text-violet-900 ring-4 ring-violet-100"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200 hover:bg-white"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">
                  <option.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-black">{option.label}</span>
                  <span className="mt-0.5 block text-sm font-bold text-slate-500">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : orderMethod === "delivery" ? (
      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Step 4
            </p>
            <h2 className="text-xl font-black text-slate-950">
              Delivery requirements
            </h2>
            <p className="mt-0.5 text-xs font-bold text-slate-500 sm:text-sm">
              Capture hardware, tarp, unload type, and delivery notes before
              dispatch.
            </p>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
            Driver details
          </span>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_1.4fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Does this order have hardware?
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ChoiceButton
                active={hasHardware}
                tone="green"
                icon={ShieldCheck}
                onClick={() => setHasHardware(true)}
              >
                Yes
              </ChoiceButton>
              <ChoiceButton
                active={!hasHardware}
                onClick={() => setHasHardware(false)}
              >
                No
              </ChoiceButton>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Do we need a tarp to cover it?
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ChoiceButton
                active={needsTarp}
                tone="green"
                icon={Truck}
                onClick={() => setNeedsTarp(true)}
              >
                Yes
              </ChoiceButton>
              <ChoiceButton
                active={!needsTarp}
                onClick={() => setNeedsTarp(false)}
              >
                No
              </ChoiceButton>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Type of delivery
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {unloadTypes.map((option) => (
                <ChoiceButton
                  key={option.id}
                  active={unloadType === option.id}
                  icon={option.icon}
                  onClick={() => setUnloadType(option.id)}
                >
                  {option.label}
                </ChoiceButton>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Field label="Delivery Notes">
            <textarea
              value={deliveryNotes}
              onChange={(event) => setDeliveryNotes(event.target.value)}
              placeholder="Gate code, placement notes, call before leaving, tarp instructions..."
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-2.5 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
            />
          </Field>
        </div>
      </section>
      ) : null}

      {!isReviewing ? (
        <button
          type="button"
          onClick={() => setIsReviewing(true)}
          className="mt-5 inline-flex min-h-[68px] w-full items-center justify-center rounded-[1.5rem] bg-slate-950 px-6 text-xl font-black text-white shadow-sm transition hover:bg-slate-800"
        >
          {isVendorReturnOrder
            ? "Review Vendor Return"
            : isReturnOrder
              ? "Review Return"
              : "Review Order"}
        </button>
      ) : (
        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                {isVendorReturnOrder
                  ? "Review Vendor Return"
                  : isReturnOrder
                    ? "Review Return"
                    : "Review Order"}
              </p>
              <h2 className="mt-1 text-3xl font-black text-slate-950">
                {orderNumber || (isReturnOrder ? "R000000" : "000-000")}
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {isVendorReturnOrder
                  ? vendorReturnVendor || "No vendor"
                  : businessName || customerName || "No customer"} ·{" "}
                {selectedHandoff.label}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsReviewing(false)}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Edit Order
            </button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[320px_1fr]">
            <div className="grid gap-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {isVendorReturnOrder ? "Vendor" : "Customer"}
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {isVendorReturnOrder
                    ? vendorReturnVendor || "No vendor selected"
                    : customerName || "No customer name"}
                </p>
                <p className="text-sm font-bold text-slate-600">
                  {isVendorReturnOrder
                    ? `PO ${vendorReturnPoNumber || "not entered"}`
                    : businessName || "No business name"}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {isVendorReturnOrder
                    ? deliveryAddress || "No vendor address"
                    : phoneNumber || "No phone"}
                </p>
                {!isVendorReturnOrder && accountNumber ? (
                  <p className="mt-1 text-sm font-black text-slate-500">
                    Account # {accountNumber}
                  </p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {isVendorReturnOrder
                    ? "Vendor return setup"
                    : isReturnOrder
                      ? "Return setup"
                      : "Delivery setup"}
                </p>
                <div className="mt-3 rounded-2xl border border-red-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                      {isVendorReturnOrder ? (
                        <Truck className="h-5 w-5" aria-hidden="true" />
                      ) : isReturnOrder ? (
                        <SelectedReturnLoadIcon className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <SelectedUnloadIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                        {isVendorReturnOrder
                          ? "Unload"
                          : isReturnOrder
                            ? "Return Type"
                            : "Delivery Type"}
                      </p>
                      <p className="text-lg font-black text-slate-950">
                        {isVendorReturnOrder
                          ? "Handled by vendor"
                          : isReturnOrder
                            ? selectedReturnLoadType.label
                            : unloadType}
                      </p>
                    </div>
                  </div>
                </div>
                {!isReturnWorkflow ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-black ${
                      hasHardware
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-[#FC2C38]"
                    }`}
                  >
                    {hasHardware ? "Hardware included" : "No hardware"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-black ${
                      needsTarp
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-[#FC2C38]"
                    }`}
                  >
                    {needsTarp ? "Tarp needed" : "No tarp"}
                  </span>
                </div>
                ) : null}
                {["delivery", "return", "vendorReturn"].includes(orderMethod) ? (
                  <div className="mt-2">
                    <p className="text-sm font-bold text-slate-600">
                      {deliveryAddress ||
                        (isVendorReturnOrder
                          ? "No vendor address"
                          : isReturnOrder
                            ? "No return pickup address"
                            : "No delivery address")}
                    </p>
                    {!isReturnWorkflow && deliveryTitle ? (
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {deliveryTitle}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {isReturnWorkflow ? (
                  <p className={`mt-2 text-sm font-black ${
                    isVendorReturnOrder ? "text-amber-800" : "text-violet-700"
                  }`}>
                    {isVendorReturnOrder ? "Vendor return date" : "Return date"}: {deliveryDateText}
                  </p>
                ) : null}
                {routeEta?.durationText ? (
                  <p className="mt-2 text-sm font-black text-emerald-700">
                    Route ETA: {routeEta.durationText}
                    {routeEta.distanceText ? ` · ${routeEta.distanceText}` : ""}
                  </p>
                ) : null}
                {deliveryNotes ? (
                  <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-bold leading-6 text-slate-600">
                    {deliveryNotes}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Items
                </p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                  {items.length} items
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {items.map((item) => (
                  <div
                    key={`review-${item.id}`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">
                          {item.quantity ? `QTY ${item.quantity} · ` : ""}
                          {item.description || "Unnamed item"}
                        </p>
                        {item.itemNumber ? (
                          <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-blue-600">
                            Item # {item.itemNumber}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm font-bold text-slate-600">
                          {isVendorReturnOrder
                            ? `${vendorReturnVendor || "Vendor"} · PO ${vendorReturnPoNumber || "not entered"}`
                            : isReturnOrder
                            ? "Return pickup item"
                            : item.path === "inStock"
                            ? "From Capital Lumber yard · No PO required"
                            : `${item.vendor || "No vendor"} · PO ${item.poNumber || "not entered"}`}
                        </p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                          {isVendorReturnOrder
                            ? "Vendor handles unloading"
                            : isReturnOrder
                            ? `Return by ${selectedReturnLoadType.label}`
                            : item.path === "inStock"
                            ? "Ready from stock"
                            : `${item.path === "wePickup" ? "Pickup" : "Delivery"} ${
                                formatShortDate(
                                  item.path === "wePickup"
                                    ? item.routeDate
                                    : item.supplierDate,
                                ) || "No date"
                              }`}
                        </p>
                      </div>
                      {isReturnWorkflow ? (
                        <span className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] ${
                          isVendorReturnOrder
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-violet-200 bg-violet-50 text-violet-700"
                        }`}>
                          {isVendorReturnOrder ? "Vendor Return" : "Return"}
                        </span>
                      ) : (
                        <WorkflowPill pathId={item.path} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => processOrder()}
            disabled={!canProcessOrder || isProcessingOrder}
            className="mt-5 inline-flex min-h-[64px] w-full items-center justify-center rounded-[1.5rem] bg-[#FC2C38] px-6 text-xl font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isProcessingOrder
              ? "Processing..."
              : isVendorReturnOrder
                ? "Create Vendor Return"
                : isReturnOrder
                  ? "Create Return"
                  : "Process Order"}
          </button>
          {processError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
              {processError}
            </div>
          ) : null}
        </section>
      )}

      {isDuplicateOrderPromptOpen && duplicateOrderMatch ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/55 p-0 sm:items-center sm:p-6">
          <div className="mx-auto w-full max-w-xl rounded-t-[2rem] border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-[2rem] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                  Duplicate order number
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Order {duplicateOrderNumber} already exists
                </h2>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                  Check the existing order for {duplicateOrderCustomer} before
                  creating another order with the same number.
                </p>
                {duplicateOrderIsArchived ? (
                  <p className="mt-2 inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">
                    Archived order record
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIsDuplicateOrderPromptOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                aria-label="Close duplicate order warning"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setIsDuplicateOrderPromptOpen(false);
                  setReviewedDuplicateOrderKey(duplicateOrderKey);
                  setViewingDuplicateOrderNumber(duplicateOrderNumber);
                }}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-slate-950 px-5 text-base font-black text-white transition hover:bg-slate-800"
              >
                View existing order
              </button>
              {duplicateOrderWasReviewed ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDuplicateOrderPromptOpen(false);
                    void processOrder({ allowDuplicateOrder: true });
                  }}
                  className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-5 text-base font-black text-amber-900 transition hover:bg-amber-100"
                >
                  Create another anyway
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-14 cursor-not-allowed items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-5 text-base font-black text-slate-400"
                >
                  Review order first
                </button>
              )}
            </div>
            {typeof onDeleteExistingOrder === "function" ? (
              <button
                type="button"
                onClick={() => void deleteDuplicateOrder()}
                disabled={isDeletingDuplicateOrder}
                className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-5 text-base font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
                {isDeletingDuplicateOrder
                  ? "Deleting existing order..."
                  : "Delete existing order permanently"}
              </button>
            ) : null}
            {duplicateDeleteError ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700">
                {duplicateDeleteError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {viewingDuplicateOrderNumber ? (
        <OrderDetailsModal
          orderNumber={viewingDuplicateOrderNumber}
          sources={existingOrderSources}
          onDeleteOrder={onDeleteExistingOrder}
          onSendPoToSouthDispatch={onSendPoToSouthDispatch}
          onClose={() => setViewingDuplicateOrderNumber("")}
        />
      ) : null}

      {editingItem ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Supplier Setup
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {editingItem.description || "Material line"}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {editingItem.quantity || "No qty"} ·{" "}
                  {getPath(editingItem.path).label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => finishSupplierSetup(editingItem.id)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Close setup"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <Field label="Vendor">
                <SearchableSelect
                  value={editingItem.vendor}
                  options={vendorOptions}
                  onChange={(vendor) =>
                    updateItemVendor(editingItem.id, vendor)
                  }
                  allowCustomValue
                  placeholder="Start typing a vendor..."
                  accent="red"
                  inputBackgroundClassName="bg-slate-100 focus:bg-white"
                />
              </Field>
              <Field label="Vendor Address">
                <TextInput
                  value={editingItem.supplierAddress || ""}
                  onChange={(event) =>
                    updateItem(editingItem.id, {
                      supplierAddress: event.target.value,
                    })
                  }
                  placeholder="Select a saved vendor to fill its address..."
                />
              </Field>
              <Field label="PO Number">
                <TextInput
                  value={editingItem.poNumber}
                  onChange={(event) =>
                    updateItem(editingItem.id, {
                      poNumber: formatOrderNumberInput(event.target.value),
                    })
                  }
                  placeholder="441-185"
                  inputMode="numeric"
                  maxLength={7}
                />
              </Field>
              <Field
                label={
                  editingItem.path === "wePickup"
                    ? "Pickup Date"
                    : editingItem.path === "pod"
                      ? "POD Date"
                      : "Delivery Date"
                }
              >
                <div className="relative">
                  <CalendarDays
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <TextInput
                    type="date"
                    value={
                      editingItem.path === "wePickup"
                        ? editingItem.routeDate
                        : editingItem.supplierDate
                    }
                    onChange={(event) =>
                      updateItem(
                        editingItem.id,
                        editingItem.path === "wePickup"
                          ? { routeDate: event.target.value }
                          : { supplierDate: event.target.value },
                      )
                    }
                    className="pl-12"
                  />
                </div>
              </Field>
              {editingItem.path === "supplierDelivery" ? (
                <Field label="Cadence / Note">
                  <TextInput
                    value={editingItem.supplierNote}
                    onChange={(event) =>
                      updateItem(editingItem.id, {
                        supplierNote: event.target.value,
                      })
                    }
                    placeholder="Typical cadence: M-W-F"
                  />
                </Field>
              ) : null}

              {editingItem.path === "wePickup" ? (
                <>
                  <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(editingItem.driverNotesEnabled)}
                        onChange={(event) =>
                          updateItem(editingItem.id, {
                            driverNotesEnabled: event.target.checked,
                          })
                        }
                        className="mt-1 h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>
                        <span className="block text-sm font-black text-slate-950">
                          Add driver notes for this PO
                        </span>
                        <span className="mt-1 block text-sm font-bold text-amber-800">
                          Notes show on the South driver pickup card.
                        </span>
                      </span>
                    </label>

                    {editingItem.driverNotesEnabled ? (
                      <textarea
                        value={editingItem.driverNotes || ""}
                        onChange={(event) =>
                          updateItem(editingItem.id, {
                            driverNotes: event.target.value,
                          })
                        }
                        placeholder="Anything the driver should know about this PO or pickup..."
                        rows={3}
                        className="mt-4 w-full resize-none rounded-xl border border-amber-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition placeholder:text-amber-700/60 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                      />
                    ) : null}
                  </section>

                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <span>
                      <span className="block text-sm font-black text-slate-950">
                        Easily damaged?
                      </span>
                      <span className="mt-1 block text-sm font-bold text-amber-800">
                        Driver will see needs corners/protection.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(editingItem.easilyDamaged)}
                      onChange={(event) =>
                        updateItem(editingItem.id, {
                          easilyDamaged: event.target.checked,
                        })
                      }
                      className="h-6 w-6 shrink-0 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                  </label>
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => finishSupplierSetup(editingItem.id)}
              className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
