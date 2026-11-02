import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
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
import PageContainer from "../components/PageContainer";
import SearchableSelect from "../components/SearchableSelect";
import cashAccounts from "../data/cashAccounts.json";
import chargeAccounts from "../data/chargeAccounts.json";
import { inventoryCatalogItems } from "../data/inventoryCatalog";

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

const inventoryCatalog = Array.from(
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
).sort((left, right) =>
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

function getVendorAddress(vendorName, supplierAddressMap) {
  const normalizedVendorName = String(vendorName || "").trim().toLowerCase();
  const matchedVendorName = Object.keys(supplierAddressMap || {}).find(
    (currentVendorName) =>
      currentVendorName.trim().toLowerCase() === normalizedVendorName,
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

    const startsWith = [];
    const contains = [];

    for (const item of catalog) {
      const normalizedNumber = normalizeInventorySearch(item.itemNumber);
      const normalizedDescription = normalizeInventorySearch(item.description);
      const normalizedMetadata = normalizeInventorySearch(
        [item.brand, item.groupSection, item.defaultVendor]
          .filter(Boolean)
          .join(" "),
      );

      if (normalizedNumber.startsWith(normalizedQuery)) {
        startsWith.push(item);
      } else if (
        normalizedNumber.includes(normalizedQuery) ||
        normalizedDescription.includes(normalizedQuery) ||
        normalizedMetadata.includes(normalizedQuery)
      ) {
        contains.push(item);
      }

      if (startsWith.length >= 8) {
        break;
      }
    }

    return [...startsWith, ...contains].slice(0, 8);
  }, [catalog, normalizedQuery]);

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
        placeholder="Item #"
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
                {item.nonStocked
                  ? "Non-stocked"
                  : Number.isFinite(item.onHand) && item.onHand > 0
                    ? `${item.onHand} on hand`
                    : "Stock item"}
              </span>
              <span className="col-span-2 line-clamp-2 text-sm font-black leading-5 text-slate-900">
                {item.description || "No description listed"}
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
 *   customers?: Array<Record<string, any>>;
 *   vendorOptions?: string[];
 *   supplierAddressMap?: Record<string, string>;
 *   removedInventoryItemNumbers?: string[];
 *   onProcessOrder?: (orderPayload: Record<string, any>) => Promise<Record<string, any> | void>;
 *   onProcessStockPO?: (stockPayload: Record<string, any>) => Promise<Record<string, any> | void>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function OrderFlowPage({
  currentUser = null,
  customers = [],
  vendorOptions = [],
  supplierAddressMap = {},
  removedInventoryItemNumbers = [],
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
  const validStockItems = useMemo(
    () =>
      stockItems.filter((item) => String(item.description || "").trim()),
    [stockItems],
  );
  const canProcessStockPO = Boolean(
    /^\d{3}-\d{3}$/.test(stockPoNumber) &&
      stockVendor.trim() &&
      stockScheduledDate &&
      validStockItems.length > 0,
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
      supplierAddress: previousItem?.supplierAddress || "",
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
              supplierAddress:
                currentItems[currentItems.length - 1]?.supplierAddress || "",
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

  function buildOrderPayload() {
    const isDeliveryOrder = orderMethod === "delivery";

    return {
      orderNumber,
      customerName,
      businessName,
      phoneNumber,
      accountNumber,
      customerId: linkedCustomerAccount?.customerId || "",
      customerAccountType: linkedCustomerAccount?.accountType || "",
      orderMethod,
      deliveryAddress,
      deliveryDate,
      hasHardware: isDeliveryOrder ? hasHardware : false,
      needsTarp: isDeliveryOrder ? needsTarp : false,
      unloadType: isDeliveryOrder ? unloadType : "",
      deliveryNotes: isDeliveryOrder ? deliveryNotes : "",
      routeEta: isDeliveryOrder ? routeEta : null,
      routeEtaStatus: isDeliveryOrder ? routeEtaStatus : "idle",
      items: savedItems,
      createdBy: currentUser,
    };
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
      onPageChange?.("dashboard");
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

          <div className="mt-5 max-w-xs">
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

          <section className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              <button
                type="button"
                onClick={addStockItem}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Item
              </button>
            </div>

            <div className="mt-4 space-y-3">
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
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-md ring-4 ring-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-lg"
            >
              <Warehouse className="h-5 w-5" aria-hidden="true" />
              New Stock PO
            </button>
            <button
              type="button"
              onClick={() => setIsOrderImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
            >
              <FileUp className="h-5 w-5" aria-hidden="true" />
              Import Order
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
              Add material from Capital Lumber's yard or from a supplier.
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
                          {item.itemNumber ? `Item # ${item.itemNumber} · ` : ""}
                          {isYardStock
                            ? "From Capital Lumber yard"
                            : `${item.vendor || "No vendor"} · PO ${item.poNumber || "not entered"}`}
                      </p>
                    </div>
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

                <div className="mt-4 grid gap-3 lg:grid-cols-[110px_180px_minmax(220px,1fr)_220px]">
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
                      onSelect={(inventoryItem) =>
                        updateItem(item.id, {
                          itemNumber: inventoryItem.itemNumber,
                          description: inventoryItem.description,
                          ...(!inventoryItem.nonStocked
                            ? {
                                path: "inStock",
                                vendor: "",
                                supplierAddress: "",
                                poNumber: "",
                                routeDate: "",
                                supplierDate: "",
                              }
                            : {}),
                          ...(inventoryItem.defaultVendor
                            ? {
                                vendor: inventoryItem.defaultVendor,
                                supplierAddress: getVendorAddress(
                                  inventoryItem.defaultVendor,
                                  supplierAddressMap,
                                ),
                              }
                            : {}),
                        })
                      }
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
                        onChange={(event) => {
                          const path = event.target.value;
                          updateItem(item.id, {
                            path,
                            ...(path === "inStock"
                              ? {
                                  vendor: "",
                                  supplierAddress: "",
                                  poNumber: "",
                                  routeDate: "",
                                  supplierDate: "",
                                }
                              : {}),
                          });
                        }}
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

                {isYardStock ? (
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
                ) : supplierSetupComplete ? (
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
                        {item.itemNumber ? (
                          <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-blue-600">
                            Item # {item.itemNumber}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm font-bold text-slate-600">
                          {item.path === "inStock"
                            ? "From Capital Lumber yard · No PO required"
                            : `${item.vendor || "No vendor"} · PO ${item.poNumber || "not entered"}`}
                        </p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                          {item.path === "inStock"
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
                    updateItem(editingItem.id, {
                      vendor,
                      supplierAddress: getVendorAddress(
                        vendor,
                        supplierAddressMap,
                      ),
                    })
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
