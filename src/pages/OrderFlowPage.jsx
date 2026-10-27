import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Hand,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";
import AddressAutocompleteInput from "../components/AddressAutocompleteInput";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import SearchableSelect from "../components/SearchableSelect";

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
    label: "In Stock",
    shortLabel: "Stock",
    description: "Future path for material already in the yard.",
    icon: Warehouse,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    activeTone:
      "border-emerald-500 bg-emerald-50 text-emerald-800 ring-emerald-100",
  },
];

const activeFulfillmentPaths = fulfillmentPaths.filter(
  (path) => path.id !== "inStock",
);

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
];

function getHandoffOption(orderMethod) {
  return (
    handoffOptions.find((option) => option.id === orderMethod) ||
    handoffOptions[0]
  );
}

function createBlankItem(overrides = {}) {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    quantity: "",
    description: "",
    path: "supplierDelivery",
    vendor: "",
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

function getPath(pathId) {
  return (
    fulfillmentPaths.find((path) => path.id === pathId) ||
    fulfillmentPaths[0]
  );
}

function getItemDateLabel(pathId) {
  if (pathId === "wePickup") {
    return "Pickup";
  }

  if (pathId === "pod") {
    return "POD";
  }

  return "Delivery";
}

function getItemDateValue(item) {
  return item.path === "wePickup" ? item.routeDate : item.supplierDate;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
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
      className={`w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100 ${className}`}
    />
  );
}

function formatOrderNumberInput(value) {
  const digitsOnly = String(value || "").replace(/\D/g, "").slice(0, 6);

  if (digitsOnly.length <= 3) {
    return digitsOnly;
  }

  return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
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
 *   vendorOptions?: string[];
 *   onProcessOrder?: (orderPayload: Record<string, any>) => Promise<Record<string, any> | void>;
 *   onProcessStockPO?: (stockPayload: Record<string, any>) => Promise<Record<string, any> | void>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function OrderFlowPage({
  currentUser = null,
  vendorOptions = [],
  onProcessOrder,
  onProcessStockPO,
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
  const [items, setItems] = useState(defaultItems);
  const [activeItemId, setActiveItemId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [routeEta, setRouteEta] = useState(null);
  const [routeEtaStatus, setRouteEtaStatus] = useState("idle");
  const [routeEtaMessage, setRouteEtaMessage] = useState("");
  const [hasHardware, setHasHardware] = useState(false);
  const [needsTarp, setNeedsTarp] = useState(false);
  const [unloadType, setUnloadType] = useState("Forklift");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [processError, setProcessError] = useState("");
  const [processSummary, setProcessSummary] = useState(null);
  const [stockPoNumber, setStockPoNumber] = useState("");
  const [stockVendor, setStockVendor] = useState("");
  const [stockFulfillmentMethod, setStockFulfillmentMethod] =
    useState("wePickup");
  const [stockScheduledDate, setStockScheduledDate] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockDescription, setStockDescription] = useState("");
  const [stockDriverNotesEnabled, setStockDriverNotesEnabled] =
    useState(false);
  const [stockNotes, setStockNotes] = useState("");
  const [stockEasilyDamaged, setStockEasilyDamaged] = useState(false);
  const [isProcessingStockPO, setIsProcessingStockPO] = useState(false);
  const [stockProcessError, setStockProcessError] = useState("");
  const [stockProcessSummary, setStockProcessSummary] = useState(null);

  const editingItem = items.find((item) => item.id === editingItemId);
  const selectedUnloadType =
    unloadTypes.find((option) => option.id === unloadType) || unloadTypes[0];
  const SelectedUnloadIcon = selectedUnloadType.icon;
  const routeMapUrl = createGoogleMapsRouteUrl(deliveryAddress);
  const selectedHandoff = getHandoffOption(orderMethod);
  const SelectedHandoffIcon = selectedHandoff.icon;
  const deliveryDateText = formatShortDate(deliveryDate) || "No date";
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
  const canProcessOrder = Boolean(
    orderNumber &&
      customerName &&
      savedItems.length > 0 &&
      (orderMethod !== "delivery" || deliveryAddress),
  );
  const canProcessStockPO = Boolean(
    /^\d{3}-\d{3}$/.test(stockPoNumber) &&
      stockVendor.trim() &&
      stockScheduledDate &&
      stockDescription.trim(),
  );

  useEffect(() => {
    if (orderMethod !== "delivery") {
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

  function addItem() {
    const previousItem = items[items.length - 1];
    const nextItem = createBlankItem({
      path: previousItem?.path || "supplierDelivery",
      poNumber: previousItem?.poNumber || "",
      vendor: previousItem?.vendor || "",
    });

    setItems((currentItems) => [...currentItems, nextItem]);
    setActiveItemId(nextItem.id);
  }

  function saveItem(itemId) {
    updateItem(itemId, { saved: true });
    setActiveItemId(null);
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
            createBlankItem({
              path: currentItems[currentItems.length - 1]?.path || "supplierDelivery",
              poNumber: currentItems[currentItems.length - 1]?.poNumber || "",
              vendor: currentItems[currentItems.length - 1]?.vendor || "",
            }),
          ];
    });

    if (editingItemId === itemId) {
      setEditingItemId(null);
    }

    if (activeItemId === itemId) {
      setActiveItemId(null);
    }
  }

  function buildOrderPayload() {
    return {
      orderNumber,
      customerName,
      businessName,
      phoneNumber,
      accountNumber,
      orderMethod,
      deliveryAddress,
      deliveryDate,
      hasHardware,
      needsTarp,
      unloadType,
      deliveryNotes,
      routeEta,
      routeEtaStatus,
      items: savedItems,
      createdBy: currentUser,
    };
  }

  async function processOrder() {
    if (!canProcessOrder || isProcessingOrder) {
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
      const summary = await onProcessOrder(buildOrderPayload());
      setProcessSummary(summary || {});
    } catch (error) {
      console.error("Unable to process order flow:", error);
      setProcessError(
        error?.message || "Unable to process this order. Please try again.",
      );
    } finally {
      setIsProcessingOrder(false);
    }
  }

  function resetStockPO() {
    setStockPoNumber("");
    setStockVendor("");
    setStockFulfillmentMethod("wePickup");
    setStockScheduledDate("");
    setStockQuantity("");
    setStockDescription("");
    setStockDriverNotesEnabled(false);
    setStockNotes("");
    setStockEasilyDamaged(false);
    setStockProcessError("");
    setStockProcessSummary(null);
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
        fulfillmentMethod: stockFulfillmentMethod,
        scheduledDate: stockScheduledDate,
        quantity: stockQuantity,
        description: stockDescription,
        notes: stockDriverNotesEnabled ? stockNotes : "",
        easilyDamaged: stockEasilyDamaged,
        createdBy: currentUser,
      });
      setStockProcessSummary(summary || {});
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
            {orderMethod === "delivery" ? (
              <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Delivery Date
                </p>
                <p className="text-sm font-black text-slate-950">
                  {deliveryDateText}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
            {orderMethod === "delivery" ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Customer Handoff
              </p>
              {orderMethod === "delivery" ? (
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
              ) : (
                <div
                  className={`mt-4 rounded-2xl border p-4 ${
                    orderMethod === "pod"
                      ? "border-amber-100 bg-amber-50 text-amber-900"
                      : "border-blue-100 bg-blue-50 text-blue-900"
                  }`}
                >
                  <p className="text-lg font-black">
                    {selectedHandoff.label}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {selectedHandoff.description}
                  </p>
                </div>
              )}
            </div>
            ) : null}

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
                        {item.vendor || "No vendor"} · PO{" "}
                        {item.poNumber || "not entered"}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                        {getItemDateLabel(item.path)}{" "}
                        {formatShortDate(getItemDateValue(item)) || "No date"}
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
            onClick={processOrder}
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

        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
              Internal Stock
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              New Stock PO
            </h1>
            <p className="mt-2 max-w-2xl text-lg font-bold text-slate-500">
              Enter one PO for Capital Lumber stock and send it to South pickup
              or Their Truck delivery.
            </p>
          </div>

          <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-100 p-1 lg:w-auto">
            <button
              type="button"
              onClick={() => setOrderEntryMode("customer")}
              className="flex-1 rounded-xl px-5 py-3 text-sm font-black text-slate-500 transition hover:text-slate-900 lg:flex-none"
            >
              Customer Order
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-white px-5 py-3 text-sm font-black text-emerald-700 shadow-sm lg:flex-none"
            >
              Stock PO
            </button>
          </div>
        </div>

        <section className="rounded-[2rem] border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Warehouse className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Stock purchase order
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                No customer delivery, tarp, hardware, or address details needed.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
                onChange={setStockVendor}
                allowCustomValue
                placeholder="Start typing a vendor..."
                accent="green"
                inputBackgroundClassName="bg-slate-100 focus:bg-white"
              />
            </Field>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              How is it getting here?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStockFulfillmentMethod("wePickup")}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
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
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
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

          <div className="mt-5 grid gap-4 lg:grid-cols-[200px_160px_1fr]">
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
            <Field label="Quantity Optional">
              <TextInput
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value)}
                placeholder="Qty"
              />
            </Field>
            <Field label="Material">
              <TextInput
                value={stockDescription}
                onChange={(event) => setStockDescription(event.target.value)}
                placeholder="Material description"
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
                checked={stockEasilyDamaged}
                onChange={(event) =>
                  setStockEasilyDamaged(event.target.checked)
                }
                className="h-6 w-6 shrink-0 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
            </label>
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
                Added to {stockProcessSummary.destination || "fulfillment"}.
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
      <Breadcrumbs items={[{ label: "New Home" }, { label: "Orders" }]} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Super Admin Lab
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              New Order
            </h1>
            <button
              type="button"
              onClick={() => setOrderEntryMode("stock")}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <Warehouse className="h-4 w-4" aria-hidden="true" />
              Stock PO
            </button>
          </div>
        </div>

        <div className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:w-auto lg:min-w-[420px]">
          <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Current Order
                </p>
                <p className="truncate text-sm font-black text-slate-700">
                  {businessName || "Business name"} ·{" "}
                  {customerName || "Customer name"}
                </p>
                {accountNumber ? (
                  <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Account # {accountNumber}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-2xl font-black tracking-tight text-slate-950">
                  {orderNumber || "000-000"}
                </p>
                <p className="text-xs font-bold text-slate-500">
                  {phoneNumber || "No phone"}
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

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Step 1
            </p>
            <h2 className="text-xl font-black text-slate-950">
              Order information
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
            6 digit order
          </span>
        </div>

        <div className="grid gap-3 xl:grid-cols-[170px_1fr_1fr_190px_150px] xl:items-end">
          <Field label="Order #">
            <TextInput
              value={orderNumber}
              onChange={(event) =>
                setOrderNumber(formatOrderNumberInput(event.target.value))
              }
              placeholder="019-390"
              inputMode="numeric"
              maxLength={7}
              className="text-2xl font-black"
            />
          </Field>

          <Field label="Name">
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

          <Field label="Business Name">
            <div className="relative">
              <Building2
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <TextInput
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Business name"
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
            <TextInput
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
      </section>

      <section className="mt-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[360px_1fr] xl:items-start">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Step 2
            </p>
            <h2 className="text-xl font-black text-slate-950">
              Customer handoff
            </h2>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {handoffOptions.map((option) => {
                const OptionIcon = option.icon;
                const isSelected = orderMethod === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setOrderMethod(option.id)}
                    className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black transition ${
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
          </div>

          {orderMethod === "delivery" ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-3 xl:grid-cols-[180px_1fr_190px] xl:items-end">
                <Field label="Delivery Date">
                  <TextInput
                    type="date"
                    value={deliveryDate}
                    onChange={(event) => setDeliveryDate(event.target.value)}
                  />
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
                      className="w-full rounded-2xl border border-slate-300 bg-slate-100 py-3 pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
                    />
                  </div>
                </Field>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
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
          ) : (
            <div
              className={`rounded-2xl border px-4 py-3 ${
                orderMethod === "pod"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
                {selectedHandoff.label}
              </p>
              <p className="mt-1 font-black">
                {selectedHandoff.description}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Step 3
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Items & fulfillment
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              For now, just add items that we need to pick up or that need to
              be delivered.
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Item
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          {items.map((item, index) => {
            const itemPath = getPath(item.path);
            const PathIcon = itemPath.icon;
            const isActive = activeItemId === item.id || !item.saved;
            const supplierSetupComplete = Boolean(
              item.vendor && item.poNumber && getItemDateValue(item),
            );

            if (!isActive) {
              const itemDate = getItemDateValue(item);
              const itemDateLabel = getItemDateLabel(item.path);

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                >
                  <div className="grid gap-2 sm:grid-cols-[42px_130px_minmax(180px,1fr)_190px_150px_96px] sm:items-center">
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
                        {item.vendor || "No vendor"} · PO{" "}
                        {item.poNumber || "not entered"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {itemDateLabel}
                      </p>
                      <p className="truncate text-sm font-black text-slate-700">
                        {formatShortDate(itemDate) || "No date"}
                      </p>
                    </div>
                    <WorkflowPill pathId={item.path} />
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-blue-700 shadow-sm">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
                        Active Material
                      </p>
                      <p className="truncate text-lg font-black text-slate-950">
                        {item.description || "New material"}
                      </p>
                    </div>
                  </div>
                  <WorkflowPill pathId={item.path} />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[130px_minmax(220px,1fr)_220px]">
                  <Field label="Qty">
                    <TextInput
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.id, { quantity: event.target.value })
                      }
                      placeholder="Qty"
                    />
                  </Field>
                  <Field label="Item Description">
                    <TextInput
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.id, {
                          description: event.target.value,
                        })
                      }
                      placeholder="2x6-16 #2 Doug Fir"
                    />
                  </Field>
                  <Field label="Fulfillment">
                    <div className="relative">
                      <PathIcon
                        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <select
                        value={item.path}
                        onChange={(event) =>
                          updateItem(item.id, { path: event.target.value })
                        }
                        className="w-full cursor-pointer appearance-none rounded-2xl border border-slate-300 bg-slate-100 py-3 pl-11 pr-12 text-base font-black text-slate-900 outline-none transition hover:border-blue-400 hover:bg-white focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
                      >
                        {activeFulfillmentPaths.map((path) => (
                          <option key={path.id} value={path.id}>
                            {path.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-700"
                        strokeWidth={2.75}
                        aria-hidden="true"
                      />
                    </div>
                  </Field>
                </div>

                {supplierSetupComplete ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">
                        {item.vendor} · PO {item.poNumber}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {getItemDateLabel(item.path)}: {getItemDateValue(item)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingItemId(item.id)}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit Supplier / PO
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                        <CircleHelp className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                          Next: Supplier / PO
                        </p>
                        <p className="mt-1 text-sm font-bold leading-5 text-slate-700">
                          Choose <span className="font-black">We Pickup</span> for South or{" "}
                          <span className="font-black">Supplier Delivery</span> for Their Truck.
                          Then add the vendor, PO number, and pickup or delivery date.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingItemId(item.id)}
                      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
                    >
                      Open Supplier / PO
                    </button>
                  </div>
                )}

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-[#FC2C38] transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => saveItem(item.id)}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Save Item
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {orderMethod === "delivery" ? (
      <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Step 4
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Delivery requirements
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Capture hardware, tarp, unload type, and delivery notes before
              dispatch.
            </p>
          </div>
          <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
            Driver details
          </span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1.4fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
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

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
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

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
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

        <div className="mt-4">
          <Field label="Delivery Notes">
            <textarea
              value={deliveryNotes}
              onChange={(event) => setDeliveryNotes(event.target.value)}
              placeholder="Gate code, placement notes, call before leaving, tarp instructions..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
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
          Review Order
        </button>
      ) : (
        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Review Order
              </p>
              <h2 className="mt-1 text-3xl font-black text-slate-950">
                {orderNumber || "000-000"}
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {businessName || customerName || "No customer"} ·{" "}
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
                  Customer
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {customerName || "No customer name"}
                </p>
                <p className="text-sm font-bold text-slate-600">
                  {businessName || "No business name"}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {phoneNumber || "No phone"}
                </p>
                {accountNumber ? (
                  <p className="mt-1 text-sm font-black text-slate-500">
                    Account # {accountNumber}
                  </p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Delivery setup
                </p>
                <div className="mt-3 rounded-2xl border border-red-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                      <SelectedUnloadIcon className="h-5 w-5" aria-hidden="true" />
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
                {orderMethod === "delivery" ? (
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    {deliveryAddress || "No delivery address"}
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
                        <p className="mt-1 text-sm font-bold text-slate-600">
                          {item.vendor || "No vendor"} · PO{" "}
                          {item.poNumber || "not entered"}
                        </p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                          {item.path === "wePickup" ? "Pickup" : "Delivery"}{" "}
                          {formatShortDate(
                            item.path === "wePickup"
                              ? item.routeDate
                              : item.supplierDate,
                          ) || "No date"}
                        </p>
                      </div>
                      <WorkflowPill pathId={item.path} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="mt-5 inline-flex min-h-[64px] w-full items-center justify-center rounded-[1.5rem] bg-[#FC2C38] px-6 text-xl font-black text-white shadow-sm transition hover:bg-red-600"
          >
            Process Order
          </button>
        </section>
      )}

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
                onClick={() => setEditingItemId(null)}
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
                    updateItem(editingItem.id, { vendor })
                  }
                  allowCustomValue
                  placeholder="Start typing a vendor..."
                  accent="red"
                  inputBackgroundClassName="bg-slate-100 focus:bg-white"
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
              onClick={() => setEditingItemId(null)}
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
