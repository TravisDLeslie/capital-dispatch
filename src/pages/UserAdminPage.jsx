import { useEffect, useState } from "react";
import {
  getIdTokenResult,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from "firebase/auth";
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  ClipboardList,
  History,
  Mail,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Truck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import DeliveryPriceEstimate from "../components/DeliveryPriceEstimate";
import PageContainer from "../components/PageContainer";
import { inventoryCatalogItems } from "../data/inventoryCatalog";
import { auth } from "../utils/firebase";
import {
  listCustomerAccountRequests,
  listCustomerQuotePricingVersions,
  listCustomerQuoteRequests,
  reviewCustomerAccountRequest,
  updateCustomerQuoteRequest,
} from "../utils/customerAccountRequestStorage";
import { deleteSupplierAccount } from "../utils/userStorage";

const roles = [
  { value: "pending", label: "Pending" },
  { value: "customer", label: "General Employee" },
  { value: "supplier", label: "Supplier" },
  { value: "admin", label: "Admin" },
  { value: "superAdmin", label: "Super Admin" },
];

const workViews = [
  { value: "operations", label: "Operations" },
  { value: "main", label: "Main" },
  { value: "dispatch-ops", label: "Dispatch Ops" },
  { value: "driver", label: "Driver" },
  { value: "sales", label: "Sales" },
  { value: "receiving", label: "Receiving" },
  { value: "south", label: "Fulfillment" },
  { value: "delivery", label: "Delivery" },
  { value: "accounting", label: "Accounting" },
  { value: "supplier", label: "Supplier Portal" },
];

const dispatchOpsPermissionIds = [
  "dashboard",
  "dispatch",
  "south-overview",
  "supplier-runs-dispatch",
  "supplier-runs-check",
  "supplier-runs-calendar",
  "deliveries-add",
  "deliveries-dispatch",
  "deliveries-route-planner",
  "receiving",
  "check-in",
  "today",
  "search",
  "trace",
];

const mainPermissionIds = [
  "dashboard",
  "order-flow",
  "order-builds",
  "deliveries-calendar",
  "sales",
  "sales-tools",
  "sales-converter",
];

const permissionGroups = [
  {
    title: "Dashboard",
    permissions: [
      { id: "dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Receiving",
    permissions: [
      { id: "receiving", label: "Receiving" },
      { id: "yard-documents", label: "Yard Documents" },
      { id: "check-in", label: "Check In" },
      { id: "today", label: "Today's Check-Ins" },
      { id: "search", label: "Search PO" },
      { id: "trace", label: "Trace PO / Order" },
    ],
  },
  {
    title: "Yard Tasks",
    permissions: [
      { id: "yard-tasks", label: "Yard Tasks" },
    ],
  },
  {
    title: "Dispatch",
    permissions: [
      { id: "dispatch", label: "Dispatch Hub" },
      { id: "supplier-runs-dispatch", label: "South Needs Dispatch" },
      { id: "deliveries-dispatch", label: "Delivery Needs Dispatch" },
    ],
  },
  {
    title: "Fulfillment",
    permissions: [
      { id: "south", label: "Fulfillment" },
      { id: "south-overview", label: "South Pickups" },
      { id: "supplier-runs-add", label: "Add South Pickup" },
      { id: "their-truck-overview", label: "Their Truck Overview" },
      { id: "their-truck-pos", label: "Add Their Truck PO" },
      { id: "supplier-runs-check", label: "View POs to Pick Up" },
      { id: "supplier-runs-calendar", label: "South Calendar" },
      { id: "south-calendar", label: "South Only Calendar" },
      { id: "their-truck-calendar", label: "Their Truck Calendar" },
      { id: "po-calendar", label: "All PO Calendar" },
      { id: "supplier-runs-history", label: "South History" },
      { id: "their-truck-history", label: "Their Truck History" },
    ],
  },
  {
    title: "Deliveries",
    permissions: [
      { id: "deliveries", label: "Deliveries" },
      { id: "deliveries-add", label: "Add Deliveries" },
      { id: "deliveries-route-planner", label: "Delivery Route Planner" },
      { id: "deliveries-calendar", label: "Delivery Calendar" },
      {
        id: "deliveries-queued-upcoming",
        label: "Queued Upcoming Deliveries",
      },
      { id: "deliveries-queue", label: "To Be Delivered" },
      { id: "deliveries-history", label: "Delivery History" },
    ],
  },
  {
    title: "Orders",
    permissions: [
      { id: "order-flow", label: "Create Orders" },
      { id: "order-builds", label: "View Open Orders" },
    ],
  },
  {
    title: "Sales",
    permissions: [
      { id: "sales", label: "Sales" },
      { id: "quote-requests", label: "Quote Requests" },
      { id: "sales-orders", label: "Sales Orders" },
      { id: "customers-add", label: "Add Customer" },
      { id: "customers-view", label: "View Customers" },
      { id: "sales-tools", label: "Tools" },
      { id: "sales-converter", label: "Converter" },
      { id: "trace", label: "PO Lookup" },
    ],
  },
  {
    title: "Documents",
    permissions: [
      { id: "documents", label: "Documents" },
      { id: "stocking-handbook", label: "Stocking Handbook" },
      { id: "inventory", label: "Inventory" },
      { id: "trex-price-book", label: "Trex Price Book" },
      { id: "timbertech-price-book", label: "TimberTech Price Book" },
      { id: "woodgrain-price-book", label: "Woodgrain Price Book" },
    ],
  },
  {
    title: "Accounting",
    permissions: [
      { id: "accounting", label: "Accounting" },
      { id: "accounting-customers", label: "Customer Statements" },
      { id: "customer-payment-links", label: "Payment Links" },
    ],
  },
  {
    title: "Supplier Portal",
    permissions: [
      { id: "supplier-chat", label: "Supplier Pricing Chat" },
    ],
  },
  {
    title: "Admin",
    permissions: [
      { id: "admin", label: "Admin" },
      { id: "user-admin", label: "User Access" },
      { id: "email-list", label: "Email List" },
      { id: "delivery-settings", label: "Delivery Settings" },
      { id: "twilio-settings", label: "Twilio Messaging" },
      { id: "vendor-settings", label: "Vendor Settings" },
      { id: "sales-report", label: "Sales Pulse" },
    ],
  },
];

const allPermissionIds = permissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.id),
);

function getProfileDisplayName(user) {
  const emailName = String(user?.email || "").split("@")[0] || "";

  return user?.displayName || user?.driverName || emailName || "";
}

function getUniqueOptions(options) {
  const seenOptions = new Set();

  return options
    .map((option) => String(option || "").trim())
    .filter(Boolean)
    .filter((option) => {
      const key = option.toLowerCase();

      if (seenOptions.has(key)) {
        return false;
      }

      seenOptions.add(key);
      return true;
    })
    .sort((firstOption, secondOption) =>
      firstOption.localeCompare(secondOption, undefined, {
        sensitivity: "base",
      }),
    );
}

const rolePermissionPresets = {
  pending: [],
  customer: ["dashboard"],
  supplier: ["supplier-chat"],
  admin: allPermissionIds.filter(
    (permissionId) =>
      !["user-admin", "fleet", "bouncie"].includes(permissionId),
  ),
  superAdmin: allPermissionIds,
};

const legacyRolePermissionPresets = {
  driver: [
    "dashboard",
    "south",
    "supplier-runs-check",
    "supplier-runs-calendar",
    "south-calendar",
    "deliveries",
    "deliveries-calendar",
    "deliveries-queue",
    "deliveries-route-planner",
  ],
  receiving: [
    "dashboard",
    "receiving",
    "yard-documents",
    "check-in",
    "today",
    "search",
    "trace",
  ],
  "yard-tasks": ["dashboard", "yard-tasks"],
  south: [
    "dashboard",
    "dispatch",
    "south",
    "south-overview",
    "supplier-runs-add",
    "their-truck-overview",
    "their-truck-pos",
    "south-calendar",
    "supplier-runs-dispatch",
    "supplier-runs-check",
    "supplier-runs-calendar",
    "their-truck-calendar",
    "po-calendar",
    "supplier-runs-history",
    "their-truck-history",
  ],
  delivery: [
    "dashboard",
    "dispatch",
    "deliveries",
    "deliveries-add",
    "deliveries-dispatch",
    "deliveries-calendar",
    "deliveries-queued-upcoming",
    "deliveries-queue",
    "deliveries-route-planner",
    "deliveries-history",
  ],
  sales: [
    "dashboard",
    "south",
    "south-overview",
    "supplier-runs-add",
    "their-truck-overview",
    "their-truck-pos",
    "their-truck-calendar",
    "their-truck-history",
    "po-calendar",
    "trace",
    "sales",
    "quote-requests",
    "sales-orders",
    "customers-add",
    "customers-view",
    "sales-tools",
    "sales-converter",
    "documents",
    "stocking-handbook",
    "inventory",
    "trex-price-book",
    "timbertech-price-book",
    "woodgrain-price-book",
  ],
  accounting: [
    "dashboard",
    "accounting",
    "accounting-expenses",
    "accounting-customers",
    "customer-payment-links",
  ],
};

const statuses = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "disabled", label: "Disabled" },
];

function isActiveEmployee(user) {
  return (
    user.status === "approved" &&
    user.role !== "supplier" &&
    user.workView !== "supplier" &&
    user.employeeActive !== false
  );
}

function getStatusClass(status) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "disabled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

function getCustomerRequestStatus(status) {
  if (status === "approved") {
    return {
      label: "Account linked",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (status === "rejected") {
    return {
      label: "Not linked",
      className: "bg-red-100 text-red-700",
    };
  }
  if (status === "pendingAccountReview") {
    return {
      label: "Ready to verify",
      className: "bg-blue-100 text-blue-700",
    };
  }

  return {
    label: "Email not verified",
    className: "bg-amber-100 text-amber-700",
  };
}

function formatCustomerRequestDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

const quoteStatusOptions = [
  { value: "new", label: "New request" },
  { value: "reviewing", label: "Reviewing" },
  { value: "quoted", label: "Quote prepared" },
  { value: "closed", label: "Closed" },
];

const quoteTimelineLabels = {
  "as-soon-as-possible": "As soon as possible",
  "within-one-week": "Within one week",
  "within-two-weeks": "Within two weeks",
  "this-month": "Sometime this month",
  flexible: "Timing is flexible",
};

const DEFAULT_QUOTE_TAX_RATE = 6;
const QUOTE_ITEM_CATALOG = inventoryCatalogItems
  .map((item) => ({
    itemNumber: String(item.itemNumber || "").trim(),
    description: String(item.description || "").trim(),
    brand: String(item.brand || "").trim(),
    groupSection: String(item.groupSection || "").trim(),
  }))
  .filter((item) => item.itemNumber && item.description);
const quoteCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatQuoteCurrency(value) {
  const amount = Number(value);
  return quoteCurrencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function getQuotePricingSummary(quoteRequest, draft) {
  const materialSubtotal = (draft.items || quoteRequest.items || []).reduce(
    (total, item, index) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const unitPrice = Number(draft.itemPrices?.[index]);
      return total + quantity * (Number.isFinite(unitPrice) ? unitPrice : 0);
    },
    0,
  );
  const deliveryCharge = quoteRequest.deliveryNeeded
    ? Math.max(0, Number(draft.deliveryCharge) || 0)
    : 0;
  const subtotal = materialSubtotal + deliveryCharge;
  const taxRate = Math.max(0, Number(draft.taxRate) || 0);
  const taxAmount = subtotal * (taxRate / 100);

  return {
    deliveryCharge,
    materialSubtotal,
    subtotal,
    taxAmount,
    taxRate,
    total: subtotal + taxAmount,
  };
}

function getQuoteRequestDraft(quoteRequest) {
  const savedPricingDraft = quoteRequest.pricingDraft || {};
  const draftItems =
    Array.isArray(savedPricingDraft.items) && savedPricingDraft.items.length > 0
      ? savedPricingDraft.items
      : quoteRequest.items || [];
  const hasSavedPricingDraft =
    Array.isArray(savedPricingDraft.itemPrices) &&
    savedPricingDraft.itemPrices.length === draftItems.length;

  return {
    items: draftItems.map((item) => ({ ...item })),
    status: quoteRequest.status || "new",
    internalNote: quoteRequest.internalNote || "",
    versionTitle: "",
    versionNote: "",
    publicNote: hasSavedPricingDraft
      ? savedPricingDraft.publicNote || ""
      : quoteRequest.publicNote || "",
    itemPrices: hasSavedPricingDraft
      ? savedPricingDraft.itemPrices.map((price) =>
          price === null || price === undefined ? "" : String(price),
        )
      : draftItems.map((item) =>
          item.unitPrice === null || item.unitPrice === undefined
            ? ""
            : String(item.unitPrice),
        ),
    deliveryCharge: hasSavedPricingDraft
      ? savedPricingDraft.deliveryCharge === null ||
        savedPricingDraft.deliveryCharge === undefined
        ? ""
        : String(savedPricingDraft.deliveryCharge)
      : quoteRequest.deliveryCharge === null ||
          quoteRequest.deliveryCharge === undefined
        ? ""
        : String(quoteRequest.deliveryCharge),
    taxRate: hasSavedPricingDraft
      ? savedPricingDraft.taxRate === null || savedPricingDraft.taxRate === undefined
        ? String(DEFAULT_QUOTE_TAX_RATE)
        : String(savedPricingDraft.taxRate)
      : String(
          quoteRequest.pricingPublished
            ? Number(quoteRequest.taxRate) || 0
            : DEFAULT_QUOTE_TAX_RATE,
        ),
  };
}

function getQuoteStatus(status) {
  if (status === "quoted") {
    return { label: "Quote prepared", className: "bg-emerald-100 text-emerald-700" };
  }
  if (status === "closed") {
    return { label: "Closed", className: "bg-slate-200 text-slate-600" };
  }
  if (status === "reviewing") {
    return { label: "Reviewing", className: "bg-blue-100 text-blue-700" };
  }
  return { label: "New request", className: "bg-amber-100 text-amber-700" };
}

function getCustomerPortalAdminError(error, fallbackMessage) {
  const message = String(error?.message || "").trim();
  const normalizedMessage = message.toLowerCase();

  if (
    !message ||
    normalizedMessage === "internal" ||
    normalizedMessage.includes("functions/internal")
  ) {
    return fallbackMessage;
  }

  return message.replace(/^Firebase:\s*/i, "");
}

function getUserPermissions(user) {
  if (Array.isArray(user.permissions)) {
    return user.permissions.filter(
      (permission) => typeof permission === "string",
    );
  }

  return (
    rolePermissionPresets[user.role] ||
    legacyRolePermissionPresets[user.role] ||
    []
  );
}

function getPresetRole(role) {
  if (
    role === "superAdmin" ||
    role === "admin" ||
    role === "pending" ||
    role === "supplier"
  ) {
    return role;
  }

  return "customer";
}

function getWorkView(user) {
  if (user.role === "supplier") {
    return "supplier";
  }

  if (typeof user.workView === "string" && user.workView) {
    return user.workView;
  }

  if (
    ["driver", "sales", "receiving", "south", "delivery", "accounting"].includes(
      user.role,
    )
  ) {
    return user.role;
  }

  return "operations";
}

export default function UserAdminPage({
  users,
  vendors,
  currentUserProfile,
  onUpdateUserProfile,
  onPageChange,
  quoteRequestsOnly = false,
}) {
  const [adminView, setAdminView] = useState(
    quoteRequestsOnly ? "quotes" : "employees",
  );
  const [drafts, setDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openAccessPanels, setOpenAccessPanels] = useState({});
  const [openAccessGroups, setOpenAccessGroups] = useState({});
  const [customerRequests, setCustomerRequests] = useState([]);
  const [customerRequestDrafts, setCustomerRequestDrafts] = useState({});
  const [isLoadingCustomerRequests, setIsLoadingCustomerRequests] =
    useState(true);
  const [reviewingCustomerRequestId, setReviewingCustomerRequestId] =
    useState("");
  const [quoteRequests, setQuoteRequests] = useState([]);
  const [quoteRequestDrafts, setQuoteRequestDrafts] = useState({});
  const [quoteItemSearches, setQuoteItemSearches] = useState({});
  const [isLoadingQuoteRequests, setIsLoadingQuoteRequests] = useState(true);
  const [savingQuoteRequestId, setSavingQuoteRequestId] = useState("");
  const [publishingQuoteRequestId, setPublishingQuoteRequestId] = useState("");
  const [pricingValidationRequestId, setPricingValidationRequestId] = useState("");
  const [quotePricingVersions, setQuotePricingVersions] = useState({});
  const [openQuotePricingHistory, setOpenQuotePricingHistory] = useState({});
  const [expandedQuoteRequests, setExpandedQuoteRequests] = useState({});
  const [loadingQuotePricingHistoryId, setLoadingQuotePricingHistoryId] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("all");
  const [quoteResultLimit, setQuoteResultLimit] = useState(20);
  const vendorList = Array.isArray(vendors) ? vendors : [];
  const driverNameOptions = getUniqueOptions(
    users
      .filter(isActiveEmployee)
      .map(getProfileDisplayName),
  );
  const removedUsers = users.filter((user) => user.status === "disabled");
  const supplierUsers = users.filter(
    (user) =>
      user.status !== "disabled" &&
      (user.role === "supplier" || user.workView === "supplier"),
  );
  const employeeUsers = users.filter(
    (user) =>
      user.status !== "disabled" &&
      user.role !== "supplier" &&
      user.workView !== "supplier",
  );
  const visibleAccessUsers =
    adminView === "suppliers"
      ? supplierUsers
      : adminView === "removed"
        ? removedUsers
        : employeeUsers;

  const pendingCustomerRequestCount = customerRequests.filter(
    (customerRequest) =>
      !["approved", "rejected"].includes(customerRequest.status),
  ).length;
  const openQuoteRequestCount = quoteRequests.filter((quoteRequest) =>
    ["new", "reviewing"].includes(quoteRequest.status),
  ).length;
  const normalizedQuoteSearch = quoteSearch.trim().toLowerCase();
  const quoteSearchDigits = normalizedQuoteSearch.replace(/\D/g, "");
  const filteredQuoteRequests = quoteRequests.filter((quoteRequest) => {
    if (
      quoteStatusFilter !== "all" &&
      quoteRequest.status !== quoteStatusFilter
    ) {
      return false;
    }
    if (!normalizedQuoteSearch) return true;

    const searchableText = [
      quoteRequest.reference,
      quoteRequest.name,
      quoteRequest.businessName,
      quoteRequest.email,
      quoteRequest.phone,
      quoteRequest.accountNumber,
      quoteRequest.deliveryAddress,
      ...(quoteRequest.items || []).flatMap((item) => [
        item.itemNumber,
        item.description,
      ]),
      ...(quoteRequest.pricingDraft?.items || []).flatMap((item) => [
        item.itemNumber,
        item.description,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const searchableDigits = searchableText.replace(/\D/g, "");

    return (
      searchableText.includes(normalizedQuoteSearch) ||
      (quoteSearchDigits.length >= 3 && searchableDigits.includes(quoteSearchDigits))
    );
  });
  const displayedQuoteRequests = filteredQuoteRequests.slice(0, quoteResultLimit);

  useEffect(() => {
    if (!quoteRequestsOnly) {
      loadCustomerPortalRequests();
    }
    loadQuoteRequests();
  }, [quoteRequestsOnly]);

  async function loadCustomerPortalRequests({ quiet = false } = {}) {
    if (!quiet) setIsLoadingCustomerRequests(true);

    try {
      const savedRequests = await listCustomerAccountRequests();
      setCustomerRequests(savedRequests);
      setCustomerRequestDrafts(
        Object.fromEntries(
          savedRequests.map((customerRequest) => [
            customerRequest.id,
            {
              verifiedAccountNumber:
                customerRequest.verifiedAccountNumber ||
                customerRequest.requestedAccountNumber ||
                "",
              reviewNotes: customerRequest.reviewNotes || "",
            },
          ]),
        ),
      );
    } catch (loadError) {
      console.error("Unable to load customer portal requests:", loadError);
      setError(
        getCustomerPortalAdminError(
          loadError,
          "Unable to load customer portal requests. Check the deployed functions.",
        ),
      );
    } finally {
      setIsLoadingCustomerRequests(false);
    }
  }

  async function loadQuoteRequests({ quiet = false } = {}) {
    if (!quiet) setIsLoadingQuoteRequests(true);

    try {
      const savedRequests = await listCustomerQuoteRequests();
      setQuoteRequests(savedRequests);
      setQuoteRequestDrafts(
        Object.fromEntries(
          savedRequests.map((quoteRequest) => [
            quoteRequest.id,
            getQuoteRequestDraft(quoteRequest),
          ]),
        ),
      );
    } catch (loadError) {
      console.error("Unable to load customer quote requests:", loadError);
      setError(
        getCustomerPortalAdminError(
          loadError,
          "Unable to load customer quote requests. Check the deployed functions.",
        ),
      );
    } finally {
      setIsLoadingQuoteRequests(false);
    }
  }

  async function toggleQuotePricingHistory(quoteRequest) {
    const requestId = quoteRequest.id;
    const isOpen = Boolean(openQuotePricingHistory[requestId]);
    if (isOpen) {
      setOpenQuotePricingHistory((current) => ({
        ...current,
        [requestId]: false,
      }));
      return;
    }

    setOpenQuotePricingHistory((current) => ({
      ...current,
      [requestId]: true,
    }));
    if (quotePricingVersions[requestId]) return;

    setLoadingQuotePricingHistoryId(requestId);
    try {
      const versions = await listCustomerQuotePricingVersions(requestId);
      setQuotePricingVersions((current) => ({
        ...current,
        [requestId]: versions,
      }));
    } catch (historyError) {
      console.error("Unable to load quote pricing history:", historyError);
      setError(
        getCustomerPortalAdminError(
          historyError,
          "Unable to load the pricing version history.",
        ),
      );
    } finally {
      setLoadingQuotePricingHistoryId("");
    }
  }

  function updateQuoteRequestDraft(requestId, field, value) {
    setQuoteRequestDrafts((currentDrafts) => ({
      ...currentDrafts,
      [requestId]: {
        ...(currentDrafts[requestId] || {}),
        [field]: value,
      },
    }));
    setMessage("");
    setError("");
  }

  function updateQuoteItemPrice(requestId, itemIndex, value) {
    setQuoteRequestDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[requestId] || {};
      const itemPrices = [...(currentDraft.itemPrices || [])];
      itemPrices[itemIndex] = value;
      return {
        ...currentDrafts,
        [requestId]: {
          ...currentDraft,
          itemPrices,
        },
      };
    });
    setMessage("");
    setError("");
  }

  function updateQuoteItemQuantity(requestId, itemIndex, value) {
    setQuoteRequestDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[requestId] || {};
      const items = [...(currentDraft.items || [])];
      items[itemIndex] = { ...items[itemIndex], quantity: value };
      return {
        ...currentDrafts,
        [requestId]: { ...currentDraft, items },
      };
    });
    setMessage("");
    setError("");
  }

  function removeQuoteItem(requestId, itemIndex) {
    setQuoteRequestDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[requestId] || {};
      return {
        ...currentDrafts,
        [requestId]: {
          ...currentDraft,
          items: (currentDraft.items || []).filter((_, index) => index !== itemIndex),
          itemPrices: (currentDraft.itemPrices || []).filter(
            (_, index) => index !== itemIndex,
          ),
        },
      };
    });
    setMessage("");
    setError("");
  }

  function addQuoteItem(requestId, catalogItem) {
    setQuoteRequestDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[requestId] || {};
      const items = currentDraft.items || [];
      if (items.some((item) => item.itemNumber === catalogItem.itemNumber)) {
        return currentDrafts;
      }
      return {
        ...currentDrafts,
        [requestId]: {
          ...currentDraft,
          items: [...items, { ...catalogItem, quantity: 1 }],
          itemPrices: [...(currentDraft.itemPrices || []), ""],
        },
      };
    });
    setQuoteItemSearches((current) => ({ ...current, [requestId]: "" }));
    setMessage("");
    setError("");
  }

  async function saveQuoteRequest(quoteRequest, { publishPricing = false } = {}) {
    const draft = quoteRequestDrafts[quoteRequest.id] || {};
    const requestItems = draft.items || quoteRequest.items || [];
    setMessage("");
    setError("");

    if (requestItems.length === 0) {
      setError("Keep at least one material item on the quote.");
      return;
    }
    if (
      requestItems.some(
        (item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0,
      )
    ) {
      setError("Enter a quantity greater than zero for every material item.");
      return;
    }

    if (publishPricing) {
      const itemPrices = draft.itemPrices || [];
      const hasInvalidPrice = requestItems.some((item, index) => {
        const rawPrice = itemPrices[index];
        const price = Number(rawPrice);
        return rawPrice === "" || rawPrice === null || rawPrice === undefined || !Number.isFinite(price) || price < 0;
      });
      const taxRate = Number(draft.taxRate);
      const deliveryCharge = Number(draft.deliveryCharge || 0);

      if (hasInvalidPrice) {
        setPricingValidationRequestId(quoteRequest.id);
        setError("Enter a valid unit price for every requested item before sending the quote.");
        return;
      }
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 25) {
        setError("Enter a valid sales tax rate between 0% and 25%.");
        return;
      }
      if (!Number.isFinite(deliveryCharge) || deliveryCharge < 0) {
        setError("Enter a valid delivery charge.");
        return;
      }
    }

    if (publishPricing) {
      setPublishingQuoteRequestId(quoteRequest.id);
    } else {
      setSavingQuoteRequestId(quoteRequest.id);
    }
    try {
      const saveResult = await updateCustomerQuoteRequest({
        requestId: quoteRequest.id,
        status: publishPricing ? "quoted" : draft.status || "new",
        internalNote: draft.internalNote?.trim() || "",
        publishPricing,
        savePricingDraft: true,
        requestItems: requestItems.map((item) => ({
          itemNumber: item.itemNumber,
          description: item.description,
          brand: item.brand || "",
          groupSection: item.groupSection || "",
          quantity: Number(item.quantity),
        })),
        draftItems: requestItems.map((item, index) => ({
          itemNumber: item.itemNumber,
          unitPrice:
            draft.itemPrices?.[index] === "" ||
            draft.itemPrices?.[index] === null ||
            draft.itemPrices?.[index] === undefined
              ? null
              : Number(draft.itemPrices[index]),
        })),
        draftTaxRate:
          draft.taxRate === "" || draft.taxRate === null || draft.taxRate === undefined
            ? null
            : Number(draft.taxRate),
        draftDeliveryCharge:
          !quoteRequest.deliveryNeeded ||
          draft.deliveryCharge === "" ||
          draft.deliveryCharge === null ||
          draft.deliveryCharge === undefined
            ? null
            : Number(draft.deliveryCharge),
        draftPublicNote: draft.publicNote?.trim() || "",
        pricedItems: publishPricing
          ? requestItems.map((item, index) => ({
              itemNumber: item.itemNumber,
              unitPrice: Number(draft.itemPrices?.[index]),
            }))
          : [],
        taxRate: Number(draft.taxRate) || 0,
        deliveryCharge: quoteRequest.deliveryNeeded
          ? Number(draft.deliveryCharge) || 0
          : 0,
        publicNote: draft.publicNote?.trim() || "",
        versionTitle: draft.versionTitle?.trim() || "",
        versionNote: draft.versionNote?.trim() || "",
      });
      setMessage(
        publishPricing
          ? `Pricing Version ${Math.max(1, Number(quoteRequest.pricingVersion) + 1 || 1)} sent to the customer for ${quoteRequest.reference || "quote request"}.`
          : `Saved Pricing Version ${Math.max(1, Number(saveResult?.pricingRevision) || Number(quoteRequest.pricingRevision) + 1 || 1)} for ${quoteRequest.reference || "quote request"}.`,
      );
      if (publishPricing) setPricingValidationRequestId("");
      setQuotePricingVersions((current) => {
        const nextVersions = { ...current };
        delete nextVersions[quoteRequest.id];
        return nextVersions;
      });
      setOpenQuotePricingHistory((current) => ({
        ...current,
        [quoteRequest.id]: false,
      }));
      await loadQuoteRequests({ quiet: true });
    } catch (saveError) {
      console.error("Unable to update customer quote request:", saveError);
      setError(
        getCustomerPortalAdminError(
          saveError,
          "Unable to update that customer quote request.",
        ),
      );
    } finally {
      setSavingQuoteRequestId("");
      setPublishingQuoteRequestId("");
    }
  }

  function updateCustomerRequestDraft(requestId, field, value) {
    setCustomerRequestDrafts((currentDrafts) => ({
      ...currentDrafts,
      [requestId]: {
        ...(currentDrafts[requestId] || {}),
        [field]: value,
      },
    }));
    setMessage("");
    setError("");
  }

  async function reviewCustomerRequest(customerRequest, decision) {
    const draft = customerRequestDrafts[customerRequest.id] || {};

    if (decision === "approve" && !customerRequest.emailVerified) {
      setError("The customer must verify their email before you can link an account.");
      return;
    }
    if (decision === "approve" && !draft.verifiedAccountNumber?.trim()) {
      setError("Enter the account number you verified in your records.");
      return;
    }
    if (
      decision === "reject" &&
      !window.confirm(
        `Mark ${customerRequest.email || "this request"} as not linked? They can still sign in, but will not receive account-specific access.`,
      )
    ) {
      return;
    }

    setReviewingCustomerRequestId(customerRequest.id);
    setMessage("");
    setError("");

    try {
      await reviewCustomerAccountRequest({
        requestId: customerRequest.id,
        decision,
        verifiedAccountNumber: draft.verifiedAccountNumber?.trim() || "",
        reviewNotes: draft.reviewNotes?.trim() || "",
      });
      setMessage(
        decision === "approve"
          ? `Linked ${customerRequest.email} to account ${draft.verifiedAccountNumber.trim()}.`
          : `Left ${customerRequest.email} unlinked.`,
      );
      await loadCustomerPortalRequests({ quiet: true });
    } catch (reviewError) {
      console.error("Unable to review customer portal request:", reviewError);
      setError(
        getCustomerPortalAdminError(
          reviewError,
          "Unable to update that customer portal request.",
        ),
      );
    } finally {
      setReviewingCustomerRequestId("");
    }
  }

  function getDraft(user) {
    const role = getPresetRole(user.role || "pending");
    const isSupplier = role === "supplier";

    return {
      role,
      workView: isSupplier ? "supplier" : getWorkView(user),
      status: user.status || "pending",
      employeeActive: isSupplier ? false : user.employeeActive !== false,
      displayName: user.displayName || "",
      driverName: isSupplier ? "" : user.driverName || "",
      vendorId: user.vendorId || "",
      vendorName: user.vendorName || "",
      permissions: isSupplier ? ["supplier-chat"] : getUserPermissions(user),
      ...(drafts[user.id] || {}),
    };
  }

  function updateDraft(userId, field, value) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: {
        ...(currentDrafts[userId] || {}),
        [field]: value,
      },
    }));
    setMessage("");
    setError("");
  }

  async function saveUser(user) {
    const draft = getDraft(user);
    const isSupplier = draft.role === "supplier";
    const approvedAt =
      draft.status === "approved" && user.status !== "approved"
        ? new Date().toISOString()
        : user.approvedAt || null;
    const approvedBy =
      draft.status === "approved" && user.status !== "approved"
        ? currentUserProfile?.email || ""
        : user.approvedBy || "";

    setSavingUserId(user.id);
    setMessage("");
    setError("");

    try {
      await onUpdateUserProfile(user.id, {
        role: draft.role,
        workView: isSupplier ? "supplier" : draft.workView || "operations",
        status: draft.status,
        employeeActive: isSupplier ? false : Boolean(draft.employeeActive),
        displayName: draft.displayName,
        driverName: isSupplier ? "" : draft.driverName,
        vendorId: isSupplier ? draft.vendorId : "",
        vendorName: isSupplier ? draft.vendorName : "",
        permissions: isSupplier ? ["supplier-chat"] : draft.permissions || [],
        approvedAt,
        approvedBy,
      });

      setDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[user.id];
        return nextDrafts;
      });
      setMessage(`Updated ${user.email || "user"}.`);
    } catch (saveError) {
      console.error("Unable to update user:", saveError);
      setError("Unable to update that user. Check Firebase rules.");
    } finally {
      setSavingUserId("");
    }
  }

  async function deleteSupplier(user) {
    if (user.role !== "supplier") return;

    const supplierName = user.displayName || user.email || "this supplier";
    const confirmation = window.prompt(
      `Delete ${supplierName} completely? This permanently removes the login, profile, invitations, conversations, and messages. Type DELETE to continue.`,
    );
    if (confirmation !== "DELETE") return;

    setDeletingUserId(user.id);
    setMessage("");
    setError("");

    try {
      if (!auth?.currentUser) {
        throw new Error("Your signed-in account could not be verified.");
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
        login_hint: auth.currentUser.email || "",
      });
      const credential = await reauthenticateWithPopup(
        auth.currentUser,
        provider,
      );
      const tokenResult = await getIdTokenResult(credential.user, true);
      const authTime = new Date(tokenResult.authTime).getTime();
      if (
        !Number.isFinite(authTime) ||
        Date.now() - authTime >= 30 * 60 * 1000
      ) {
        throw new Error("Google did not return a fresh sign-in. Try again.");
      }

      const result = await deleteSupplierAccount(user.id);
      setMessage(
        `Deleted ${supplierName}, ${result?.deletedConversations || 0} conversation(s), and ${result?.deletedInvitations || 0} invitation(s).`,
      );
    } catch (deleteError) {
      console.error("Unable to delete supplier account:", deleteError);
      setError(
        deleteError?.message ||
          "Unable to delete that supplier account. Verify your Google account and try again.",
      );
    } finally {
      setDeletingUserId("");
    }
  }

  function applyRolePreset(userId, role) {
    const user = users.find((savedUser) => savedUser.id === userId);
    const currentDraft = user
      ? getDraft(user)
      : { workView: "operations", employeeActive: true };

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: {
        ...(currentDrafts[userId] || {}),
        role,
        workView:
          role === "supplier"
            ? "supplier"
            : currentDraft.workView === "supplier"
              ? "operations"
              : currentDraft.workView,
        employeeActive:
          role === "supplier"
            ? false
            : currentDraft.role === "supplier"
              ? true
              : currentDraft.employeeActive,
        driverName: role === "supplier" ? "" : currentDraft.driverName,
        permissions: [...(rolePermissionPresets[role] || [])],
      },
    }));
    setMessage("");
    setError("");
  }

  function applyWorkView(userId, workView) {
    const user = users.find((savedUser) => savedUser.id === userId);
    const currentDraft = user ? getDraft(user) : { permissions: [] };
    const presetPermissions =
      workView === "dispatch-ops"
        ? dispatchOpsPermissionIds
        : workView === "main"
          ? mainPermissionIds
          : [];
    const nextPermissions = workView === "supplier"
      ? ["supplier-chat"]
      : [
          ...new Set([
            ...(currentDraft.permissions || []),
            ...presetPermissions,
          ]),
        ];

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: {
        ...(currentDrafts[userId] || {}),
        workView,
        permissions: nextPermissions,
      },
    }));
    setMessage("");
    setError("");
  }

  function togglePermission(userId, permissionId) {
    const user = users.find((savedUser) => savedUser.id === userId);
    const currentDraft = user ? getDraft(user) : { permissions: [] };
    const currentPermissions = currentDraft.permissions || [];
    const nextPermissions = currentPermissions.includes(permissionId)
      ? currentPermissions.filter(
          (permission) => permission !== permissionId,
        )
      : [...currentPermissions, permissionId];

    updateDraft(userId, "permissions", nextPermissions);
  }

  function getAccessGroupKey(userId, groupTitle) {
    return `${userId}::${groupTitle}`;
  }

  function isAccessGroupOpen(userId, group, draft) {
    const groupKey = getAccessGroupKey(userId, group.title);

    if (groupKey in openAccessGroups) {
      return openAccessGroups[groupKey];
    }

    return group.permissions.some((permission) =>
      (draft.permissions || []).includes(permission.id),
    );
  }

  function toggleAccessGroup(userId, group, draft) {
    const groupKey = getAccessGroupKey(userId, group.title);
    const groupIsOpen = isAccessGroupOpen(userId, group, draft);

    setOpenAccessGroups((currentOpenAccessGroups) => ({
      ...currentOpenAccessGroups,
      [groupKey]: !groupIsOpen,
    }));
  }

  function toggleAccessPanel(userId) {
    setOpenAccessPanels((currentOpenAccessPanels) => ({
      ...currentOpenAccessPanels,
      [userId]: !currentOpenAccessPanels[userId],
    }));
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={
          quoteRequestsOnly
            ? [
                { label: "Sales", onClick: () => onPageChange?.("sales") },
                { label: "Quote Requests" },
              ]
            : [
                { label: "Admin", onClick: () => onPageChange?.("admin") },
                { label: "User Access" },
              ]
        }
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          {quoteRequestsOnly ? "Sales" : "Admin"}
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          {quoteRequestsOnly ? "Quote Requests" : "User Access"}
        </h1>

        <p className="mt-2 text-lg text-slate-500">
          {quoteRequestsOnly
            ? "Review customer material requests, delivery details, and quote status."
            : "Manage employee and supplier access, and manually connect customer portal emails to the correct account on file."}
        </p>
      </div>

      {!quoteRequestsOnly ? (
        <div className="mb-6 inline-flex flex-wrap rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
          <button
            type="button"
            onClick={() => setAdminView("employees")}
            className={`rounded-xl px-5 py-3 text-sm font-black transition ${
              adminView === "employees"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Employees
            <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs">
              {employeeUsers.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAdminView("suppliers")}
            className={`rounded-xl px-5 py-3 text-sm font-black transition ${
              adminView === "suppliers"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Suppliers
            <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs">
              {supplierUsers.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAdminView("customers")}
            className={`rounded-xl px-5 py-3 text-sm font-black transition ${
              adminView === "customers"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Customer Portal
            {pendingCustomerRequestCount > 0 ? (
              <span className="ml-2 rounded-full bg-[#FC2C38] px-2 py-0.5 text-xs text-white">
                {pendingCustomerRequestCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setAdminView("quotes")}
            className={`rounded-xl px-5 py-3 text-sm font-black transition ${
              adminView === "quotes"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Quote Requests
            {openQuoteRequestCount > 0 ? (
              <span className="ml-2 rounded-full bg-[#FC2C38] px-2 py-0.5 text-xs text-white">
                {openQuoteRequestCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setAdminView("removed")}
            className={`rounded-xl px-5 py-3 text-sm font-black transition ${
              adminView === "removed"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Removed
            <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs">
              {removedUsers.length}
            </span>
          </button>
        </div>
      ) : null}

      {message ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {adminView === "customers" ? (
        <div className="space-y-4">
          <section className="flex flex-col gap-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white">
                <UserRoundCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Customer portal accounts
                </h2>
                <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Customers can sign in as soon as their email is verified.
                  Link the verified email to the account number in your records
                  before showing account-specific pricing or private account data.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadCustomerPortalRequests()}
              disabled={isLoadingCustomerRequests}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isLoadingCustomerRequests ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </section>

          {isLoadingCustomerRequests ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
              Loading customer portal accounts…
            </div>
          ) : customerRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <Building2 className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-lg font-black text-slate-800">
                No customer requests yet
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                New customer portal registrations will appear here, separate
                from employee access.
              </p>
            </div>
          ) : (
            customerRequests.map((customerRequest) => {
              const status = getCustomerRequestStatus(customerRequest.status);
              const draft = customerRequestDrafts[customerRequest.id] || {};
              const isReviewing =
                reviewingCustomerRequestId === customerRequest.id;

              return (
                <section
                  key={customerRequest.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-slate-950">
                          {customerRequest.businessName || "Customer account"}
                        </h2>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.1em] ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                            customerRequest.emailVerified
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {customerRequest.emailVerified ? (
                            <BadgeCheck className="h-4 w-4" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                          {customerRequest.emailVerified
                            ? "Email verified"
                            : "Waiting for email verification"}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-700">
                        {customerRequest.name || "Name not provided"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {customerRequest.email} · {customerRequest.phone}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {customerRequest.address}
                      </p>
                      {customerRequest.createdAt ? (
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          Requested {formatCustomerRequestDate(customerRequest.createdAt)}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:w-[650px]">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Customer submitted
                        </p>
                        <p className="mt-2 text-lg font-black text-slate-950">
                          {customerRequest.hasExistingAccount
                            ? customerRequest.requestedAccountNumber || "No number"
                            : "New account request"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Treat this as a lead only—verify it against your own records.
                        </p>
                      </div>
                      <label className="block rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                          Verified account on file
                        </span>
                        <input
                          type="text"
                          value={draft.verifiedAccountNumber || ""}
                          onChange={(event) =>
                            updateCustomerRequestDraft(
                              customerRequest.id,
                              "verifiedAccountNumber",
                              event.target.value,
                            )
                          }
                          placeholder="Enter verified account #"
                          className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-black text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Internal verification note
                        </span>
                        <input
                          type="text"
                          value={draft.reviewNotes || ""}
                          onChange={(event) =>
                            updateCustomerRequestDraft(
                              customerRequest.id,
                              "reviewNotes",
                              event.target.value,
                            )
                          }
                          maxLength={500}
                          placeholder="Example: matched in Spruce by business name and phone"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        />
                      </label>
                    </div>
                  </div>

                  {customerRequest.reviewedAt ? (
                    <p className="mt-4 text-xs font-semibold text-slate-400">
                      Last reviewed {formatCustomerRequestDate(customerRequest.reviewedAt)}
                      {customerRequest.reviewedBy
                        ? ` by ${customerRequest.reviewedBy}`
                        : ""}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {customerRequest.status !== "rejected" ? (
                      <button
                        type="button"
                        onClick={() =>
                          reviewCustomerRequest(customerRequest, "reject")
                        }
                        disabled={isReviewing}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Leave unlinked
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        reviewCustomerRequest(customerRequest, "approve")
                      }
                      disabled={isReviewing || !customerRequest.emailVerified}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <BadgeCheck className="h-4 w-4" />
                      {isReviewing
                        ? "Saving…"
                        : customerRequest.status === "approved"
                          ? "Update account link"
                          : "Verify and link account"}
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      ) : adminView === "quotes" ? (
        <div className="space-y-4">
          <section className="flex flex-col gap-4 rounded-3xl border border-violet-200 bg-violet-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-black text-slate-950">Customer quote requests</h2>
                <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Every request submitted from the customer portal appears here with its material list, quantity, timing, and delivery details.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => loadQuoteRequests()} disabled={isLoadingQuoteRequests} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${isLoadingQuoteRequests ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Search quote requests</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={quoteSearch}
                    onChange={(event) => {
                      setQuoteSearch(event.target.value);
                      setQuoteResultLimit(20);
                    }}
                    placeholder="Customer, business, phone, email, account, quote, address, or item…"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </span>
              </label>
              <label className="lg:w-56">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Status</span>
                <select
                  value={quoteStatusFilter}
                  onChange={(event) => {
                    setQuoteStatusFilter(event.target.value);
                    setQuoteResultLimit(20);
                  }}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-black text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100"
                >
                  <option value="all">All statuses</option>
                  {quoteStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500">
              <span>Showing {displayedQuoteRequests.length} of {filteredQuoteRequests.length} matching {filteredQuoteRequests.length === 1 ? "quote" : "quotes"}</span>
              {quoteSearch || quoteStatusFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuoteSearch("");
                    setQuoteStatusFilter("all");
                    setQuoteResultLimit(20);
                  }}
                  className="font-black text-violet-700 hover:text-violet-900"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </section>

          {isLoadingQuoteRequests ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">Loading customer quote requests…</div>
          ) : quoteRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <ClipboardList className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-lg font-black text-slate-800">No quote requests yet</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">New customer portal quote requests will appear here automatically.</p>
            </div>
          ) : filteredQuoteRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <Search className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-lg font-black text-slate-800">No matching quote requests</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Try a different customer, phone number, quote number, item, or status.</p>
            </div>
          ) : (
            <>
              {displayedQuoteRequests.map((quoteRequest) => {
              const status = getQuoteStatus(quoteRequest.status);
              const draft = quoteRequestDrafts[quoteRequest.id] || {
                ...getQuoteRequestDraft(quoteRequest),
              };
              const isSaving = savingQuoteRequestId === quoteRequest.id;
              const isPublishing = publishingQuoteRequestId === quoteRequest.id;
              const pricingSummary = getQuotePricingSummary(quoteRequest, draft);
              const isExpanded = Boolean(expandedQuoteRequests[quoteRequest.id]);
              const draftItems = draft.items || quoteRequest.items || [];
              const itemSearch = quoteItemSearches[quoteRequest.id] || "";
              const normalizedItemSearch = itemSearch.trim().toLowerCase();
              const existingItemNumbers = new Set(
                draftItems.map((item) => item.itemNumber),
              );
              const catalogMatches =
                normalizedItemSearch.length >= 2
                  ? QUOTE_ITEM_CATALOG.filter(
                      (item) =>
                        !existingItemNumbers.has(item.itemNumber) &&
                        [
                          item.itemNumber,
                          item.description,
                          item.brand,
                          item.groupSection,
                        ]
                          .join(" ")
                          .toLowerCase()
                          .includes(normalizedItemSearch),
                    ).slice(0, 8)
                  : [];

              return (
                <section key={quoteRequest.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className={`flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between ${isExpanded ? "border-b border-slate-200" : ""}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">{quoteRequest.reference || "Quote request"}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.1em] ${status.className}`}>{status.label}</span>
                      </div>
                      <h2 className="mt-2 text-2xl font-black text-slate-950">{quoteRequest.businessName || quoteRequest.name || "Customer quote"}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{quoteRequest.name || "Contact not provided"} · {quoteRequest.email || "No email"} · {quoteRequest.phone || "No phone"}</p>
                      {quoteRequest.createdAt ? <p className="mt-2 text-xs font-semibold text-slate-400">Submitted {formatCustomerRequestDate(quoteRequest.createdAt)}</p> : null}
                    </div>

                    <div className="shrink-0 lg:w-[520px]">
                      <div className="mb-2 flex justify-start lg:justify-end">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                            quoteRequest.pricingDraftHasChanges
                              ? "bg-amber-100 text-amber-800"
                              : quoteRequest.pricingPublished
                                ? "bg-violet-100 text-violet-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {quoteRequest.pricingRevision || quoteRequest.pricingVersion
                            ? `V${Math.max(1, Number(quoteRequest.pricingRevision) || Number(quoteRequest.pricingVersion) || 1)}${quoteRequest.pricingDraftHasChanges ? " · Unsent changes" : ""}`
                            : "Draft"}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Account</p>
                          <p className="mt-1 text-sm font-black text-slate-800">{quoteRequest.accountNumber || "Not linked yet"}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Needed</p>
                          <p className="mt-1 text-sm font-black text-slate-800">{quoteTimelineLabels[quoteRequest.neededBy] || quoteRequest.neededBy || "Not provided"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedQuoteRequests((current) => ({
                              ...current,
                              [quoteRequest.id]: !isExpanded,
                            }))
                          }
                          className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white px-4 text-sm font-black text-violet-700 transition hover:bg-violet-50"
                          aria-expanded={isExpanded}
                          aria-controls={`quote-details-${quoteRequest.id}`}
                        >
                          {isExpanded ? "Collapse" : "Open quote"}
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded ? (
                  <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
                    <span id={`quote-details-${quoteRequest.id}`} className="sr-only">Quote details</span>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="h-5 w-5 text-violet-600" />
                          <h3 className="font-black text-slate-950">Requested material</h3>
                        </div>
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{draftItems.length} items</span>
                      </div>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                        {draftItems.map((item, itemIndex) => {
                          const quantity = Math.max(0, Number(item.quantity) || 0);
                          const rawUnitPrice = draft.itemPrices?.[itemIndex];
                          const unitPrice = Number(rawUnitPrice);
                          const hasUnitPriceError =
                            pricingValidationRequestId === quoteRequest.id &&
                            (rawUnitPrice === "" ||
                              rawUnitPrice === null ||
                              rawUnitPrice === undefined ||
                              !Number.isFinite(unitPrice) ||
                              unitPrice < 0);
                          const lineTotal = quantity * (Number.isFinite(unitPrice) ? unitPrice : 0);

                          return (
                            <div key={`${quoteRequest.id}-${item.itemNumber}-${itemIndex}`} className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:grid-cols-[90px_1fr_100px_135px_105px_42px] sm:items-center">
                              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#FC2C38]">{item.itemNumber}</p>
                              <p className="text-sm font-bold text-slate-800">{item.description}</p>
                              <label>
                                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 sm:sr-only">Quantity</span>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={item.quantity}
                                  onChange={(event) =>
                                    updateQuoteItemQuantity(
                                      quoteRequest.id,
                                      itemIndex,
                                      event.target.value,
                                    )
                                  }
                                  aria-label={`Quantity for ${item.description}`}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-right text-sm font-black text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100"
                                />
                              </label>
                              <label>
                                <span className={`mb-1 block text-[10px] font-black uppercase tracking-[0.1em] sm:sr-only ${hasUnitPriceError ? "text-red-600" : "text-slate-400"}`}>
                                  {hasUnitPriceError ? "Unit price required" : "Unit price"}
                                </span>
                                <span className="relative block">
                                  <span className={`pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-black ${hasUnitPriceError ? "text-red-500" : "text-slate-400"}`}>$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={rawUnitPrice ?? ""}
                                    onChange={(event) => updateQuoteItemPrice(quoteRequest.id, itemIndex, event.target.value)}
                                    placeholder="Required"
                                    aria-label={`Unit price for ${item.description}`}
                                    aria-invalid={hasUnitPriceError}
                                    className={`w-full rounded-xl border py-2.5 pl-7 pr-3 text-right text-sm font-black outline-none placeholder:text-xs placeholder:font-black ${
                                      hasUnitPriceError
                                        ? "border-red-400 bg-red-50 text-red-950 placeholder:text-red-600 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                                        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:ring-4 focus:ring-violet-100"
                                    }`}
                                  />
                                </span>
                                {hasUnitPriceError ? <span className="mt-1 block text-right text-[10px] font-black uppercase tracking-[0.08em] text-red-600">Required</span> : null}
                              </label>
                              <div className="sm:text-right">
                                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Line total</p>
                                <p className="mt-1 text-sm font-black text-slate-950">{formatQuoteCurrency(lineTotal)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeQuoteItem(quoteRequest.id, itemIndex)}
                                disabled={draftItems.length === 1}
                                className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label={`Remove ${item.description}`}
                                title={draftItems.length === 1 ? "A quote needs at least one item" : "Remove item"}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="relative mt-3 rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-3">
                        <label htmlFor={`add-quote-item-${quoteRequest.id}`} className="text-xs font-black uppercase tracking-[0.12em] text-violet-700">
                          Add material to this quote
                        </label>
                        <span className="relative mt-2 block">
                          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                          <input
                            id={`add-quote-item-${quoteRequest.id}`}
                            type="search"
                            value={itemSearch}
                            onChange={(event) =>
                              setQuoteItemSearches((current) => ({
                                ...current,
                                [quoteRequest.id]: event.target.value,
                              }))
                            }
                            placeholder="Search item number, description, or brand…"
                            className="w-full rounded-xl border border-violet-200 bg-white py-3 pl-11 pr-4 text-sm font-bold text-slate-950 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100"
                          />
                        </span>
                        {catalogMatches.length > 0 ? (
                          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                            {catalogMatches.map((catalogItem) => (
                              <button
                                key={catalogItem.itemNumber}
                                type="button"
                                onClick={() => addQuoteItem(quoteRequest.id, catalogItem)}
                                className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-violet-50"
                              >
                                <span className="min-w-0">
                                  <span className="block text-xs font-black uppercase tracking-[0.1em] text-violet-700">{catalogItem.itemNumber}</span>
                                  <span className="mt-0.5 block truncate text-sm font-bold text-slate-800">{catalogItem.description}</span>
                                </span>
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-600 text-white">
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : normalizedItemSearch.length >= 2 ? (
                          <p className="mt-2 text-sm font-bold text-slate-500">No additional catalog items match that search.</p>
                        ) : null}
                      </div>

                      <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Customer pricing</p>
                              {quoteRequest.pricingPublished ? (
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${quoteRequest.pricingDraftHasChanges ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                                  {quoteRequest.pricingDraftHasChanges
                                    ? "Unsent pricing draft"
                                    : `Version ${Math.max(1, Number(quoteRequest.pricingVersion) || 1)} sent`}
                                </span>
                              ) : <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Draft</span>}
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-600">Enter unit prices, delivery, and tax. Save keeps a private draft; Send creates a new customer-visible version.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleQuotePricingHistory(quoteRequest)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100"
                          >
                            <History className="h-4 w-4" aria-hidden="true" />
                            {openQuotePricingHistory[quoteRequest.id] ? "Hide history" : `Pricing history${quoteRequest.pricingRevision ? ` (${quoteRequest.pricingRevision})` : ""}`}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {quoteRequest.deliveryNeeded ? (
                              <label>
                                <span className="mb-1 block text-xs font-black text-slate-600">Delivery charge</span>
                                <span className="relative block">
                                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-black text-slate-400">$</span>
                                  <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.deliveryCharge ?? ""} onChange={(event) => updateQuoteRequestDraft(quoteRequest.id, "deliveryCharge", event.target.value)} placeholder="0.00" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-7 pr-3 text-right text-sm font-black text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100" />
                                </span>
                              </label>
                            ) : null}
                            <label>
                              <span className="mb-1 block text-xs font-black text-slate-600">Sales tax rate</span>
                              <span className="relative block">
                                <input type="number" min="0" max="25" step="0.01" inputMode="decimal" value={draft.taxRate ?? ""} onChange={(event) => updateQuoteRequestDraft(quoteRequest.id, "taxRate", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-3 pr-8 text-right text-sm font-black text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100" />
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-black text-slate-400">%</span>
                              </span>
                            </label>
                            <label className="sm:col-span-2">
                              <span className="mb-1 block text-xs font-black text-slate-600">Note to customer <span className="font-semibold text-slate-400">(optional)</span></span>
                              <textarea value={draft.publicNote || ""} onChange={(event) => updateQuoteRequestDraft(quoteRequest.id, "publicNote", event.target.value)} maxLength={800} rows={3} placeholder="Pricing details, substitutions, or a short message for the customer…" className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100" />
                            </label>
                          </div>

                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Quote total</p>
                            <dl className="mt-3 space-y-2 text-sm font-bold text-slate-600">
                              <div className="flex justify-between gap-3"><dt>Material</dt><dd>{formatQuoteCurrency(pricingSummary.materialSubtotal)}</dd></div>
                              {quoteRequest.deliveryNeeded ? <div className="flex justify-between gap-3"><dt>Delivery</dt><dd>{formatQuoteCurrency(pricingSummary.deliveryCharge)}</dd></div> : null}
                              <div className="flex justify-between gap-3 border-t border-slate-100 pt-2"><dt>Subtotal</dt><dd>{formatQuoteCurrency(pricingSummary.subtotal)}</dd></div>
                              <div className="flex justify-between gap-3"><dt>Tax ({pricingSummary.taxRate.toFixed(2)}%)</dt><dd>{formatQuoteCurrency(pricingSummary.taxAmount)}</dd></div>
                            </dl>
                            <div className="mt-3 flex items-end justify-between gap-3 border-t-2 border-slate-950 pt-3">
                              <span className="text-sm font-black uppercase tracking-[0.1em] text-slate-950">Total</span>
                              <span className="text-2xl font-black text-slate-950">{formatQuoteCurrency(pricingSummary.total)}</span>
                            </div>
                          </div>
                        </div>

                        {openQuotePricingHistory[quoteRequest.id] ? (
                          <div className="mt-4 border-t border-violet-200 pt-4">
                            {loadingQuotePricingHistoryId === quoteRequest.id ? (
                              <p className="text-sm font-bold text-slate-500">Loading pricing versions…</p>
                            ) : (quotePricingVersions[quoteRequest.id] || []).length === 0 ? (
                              <p className="text-sm font-bold text-slate-500">No saved pricing versions yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {(quotePricingVersions[quoteRequest.id] || []).map((version) => (
                                  <div key={version.id} className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-violet-700">Version {version.revision}</span>
                                          {version.type === "published" ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">Sent to customer{version.customerVersion ? ` · V${version.customerVersion}` : ""}</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Internal draft</span>}
                                        </div>
                                        <p className="mt-2 text-sm font-black text-slate-950">{version.title || "Pricing update"}</p>
                                        {version.note ? <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-600">{version.note}</p> : null}
                                        <p className="mt-2 text-[11px] font-semibold text-slate-400">{version.createdAt ? formatCustomerRequestDate(version.createdAt) : "Time unavailable"}{version.createdBy ? ` · ${version.createdBy}` : ""}</p>
                                      </div>
                                      <p className="text-lg font-black text-slate-950">{formatQuoteCurrency(version.total)}</p>
                                    </div>
                                    <details className="mt-3 border-t border-slate-100 pt-3">
                                      <summary className="cursor-pointer text-xs font-black text-violet-700">View saved prices</summary>
                                      <div className="mt-3 space-y-2">
                                        {(version.items || []).map((item, itemIndex) => (
                                          <div key={`${version.id}-${item.itemNumber}-${itemIndex}`} className="grid gap-1 rounded-xl bg-slate-50 px-3 py-2 text-xs sm:grid-cols-[70px_1fr_70px_90px] sm:items-center">
                                            <span className="font-black text-slate-500">{item.itemNumber || `Item ${itemIndex + 1}`}</span>
                                            <span className="font-bold text-slate-800">{item.description || "Item description unavailable"}</span>
                                            <span className="font-bold text-slate-600 sm:text-right">Qty {item.quantity}</span>
                                            <span className="font-black text-slate-950 sm:text-right">{item.unitPrice === null || item.unitPrice === undefined ? "Not priced" : `${formatQuoteCurrency(item.unitPrice)} ea.`}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <dl className="mt-3 ml-auto grid max-w-xs gap-1 text-xs font-bold text-slate-600">
                                        <div className="flex justify-between gap-4"><dt>Material</dt><dd>{formatQuoteCurrency(version.materialSubtotal)}</dd></div>
                                        <div className="flex justify-between gap-4"><dt>Delivery</dt><dd>{formatQuoteCurrency(version.deliveryCharge)}</dd></div>
                                        <div className="flex justify-between gap-4"><dt>Tax{version.taxRate !== null && version.taxRate !== undefined ? ` (${Number(version.taxRate).toFixed(2)}%)` : ""}</dt><dd>{formatQuoteCurrency(version.taxAmount)}</dd></div>
                                        <div className="flex justify-between gap-4 border-t border-slate-200 pt-1 font-black text-slate-950"><dt>Total</dt><dd>{formatQuoteCurrency(version.total)}</dd></div>
                                      </dl>
                                    </details>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start gap-3">
                          {quoteRequest.deliveryNeeded ? <Truck className="mt-0.5 h-5 w-5 shrink-0 text-[#FC2C38]" /> : <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />}
                          <div>
                            <p className="text-sm font-black text-slate-950">{quoteRequest.deliveryNeeded ? "Delivery requested" : "Customer pickup"}</p>
                            {quoteRequest.deliveryNeeded ? <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {quoteRequest.deliveryAddress || "Address not provided"}</p> : null}
                          </div>
                        </div>
                        {quoteRequest.deliveryNeeded ? (
                          <DeliveryPriceEstimate
                            address={quoteRequest.deliveryAddress}
                            compact
                          />
                        ) : null}
                        {quoteRequest.notes ? <div className="mt-3 border-t border-slate-200 pt-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Customer notes</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{quoteRequest.notes}</p></div> : null}
                      </div>
                    </div>

                    <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Internal follow-up</p>
                      <label className="mt-4 block">
                        <span className="mb-1 block text-xs font-black text-slate-600">Status</span>
                        <select value={draft.status || "new"} onChange={(event) => updateQuoteRequestDraft(quoteRequest.id, "status", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100">
                          {quoteStatusOptions.map((option) => <option key={option.value} value={option.value} disabled={option.value === "quoted" && !quoteRequest.pricingPublished}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="mt-4 block">
                        <span className="mb-1 block text-xs font-black text-slate-600">Internal note</span>
                        <textarea value={draft.internalNote || ""} onChange={(event) => updateQuoteRequestDraft(quoteRequest.id, "internalNote", event.target.value)} maxLength={800} rows={4} placeholder="Who is preparing this quote, follow-up details, or outcome…" className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100" />
                      </label>
                      <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-700">New pricing version</p>
                        <label className="mt-3 block">
                          <span className="mb-1 block text-xs font-black text-slate-600">Version title <span className="font-semibold text-slate-400">(optional)</span></span>
                          <input value={draft.versionTitle || ""} onChange={(event) => updateQuoteRequestDraft(quoteRequest.id, "versionTitle", event.target.value)} maxLength={80} placeholder="Example: Updated framing package" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100" />
                        </label>
                        <label className="mt-3 block">
                          <span className="mb-1 block text-xs font-black text-slate-600">Version note <span className="font-semibold text-slate-400">(internal)</span></span>
                          <textarea value={draft.versionNote || ""} onChange={(event) => updateQuoteRequestDraft(quoteRequest.id, "versionNote", event.target.value)} maxLength={400} rows={2} placeholder="What changed in this version?" className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100" />
                        </label>
                      </div>
                      <button type="button" onClick={() => saveQuoteRequest(quoteRequest)} disabled={isSaving || isPublishing} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:bg-slate-400">{isSaving ? "Saving version…" : "Save new pricing version"}</button>
                      <button type="button" onClick={() => saveQuoteRequest(quoteRequest, { publishPricing: true })} disabled={isSaving || isPublishing} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-wait disabled:bg-slate-400">
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {isPublishing ? "Sending pricing…" : quoteRequest.pricingPublished ? `Send as Version ${Math.max(2, Number(quoteRequest.pricingVersion) + 1 || 2)}` : "Send pricing to customer"}
                      </button>
                      {quoteRequest.reviewedAt ? <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">Last updated {formatCustomerRequestDate(quoteRequest.reviewedAt)}{quoteRequest.reviewedBy ? ` by ${quoteRequest.reviewedBy}` : ""}</p> : null}
                    </aside>
                  </div>
                  ) : null}
                </section>
                );
              })}
              {displayedQuoteRequests.length < filteredQuoteRequests.length ? (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setQuoteResultLimit((currentLimit) => currentLimit + 20)}
                    className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
                  >
                    Load 20 more quotes
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
      <div className="space-y-4">
        {visibleAccessUsers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Building2 className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-lg font-black text-slate-800">
              {adminView === "suppliers"
                ? "No supplier accounts yet"
                : adminView === "removed"
                  ? "No removed accounts"
                  : "No employee accounts yet"}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {adminView === "suppliers"
                ? "Supplier portal accounts will appear here after they register or are invited."
                : adminView === "removed"
                  ? "Disabled employee and supplier accounts will appear here."
                  : "Employee accounts will appear here after they sign in or are added."}
            </p>
          </div>
        ) : null}
        {visibleAccessUsers.map((user) => {
          const draft = getDraft(user);
          const hasChanges =
            draft.role !== (user.role || "pending") ||
            draft.workView !== getWorkView(user) ||
            draft.status !== (user.status || "pending") ||
            draft.employeeActive !== (user.employeeActive !== false) ||
            draft.displayName !== (user.displayName || "") ||
            draft.driverName !== (user.driverName || "") ||
            draft.vendorId !== (user.vendorId || "") ||
            draft.vendorName !== (user.vendorName || "") ||
            JSON.stringify([...(draft.permissions || [])].sort()) !==
              JSON.stringify(getUserPermissions(user).sort());
          const accessPanelIsOpen = Boolean(openAccessPanels[user.id]);

          return (
            <section
              key={user.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-black text-slate-900">
                      {user.displayName || user.email || "New user"}
                    </h2>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${getStatusClass(
                        user.status,
                      )}`}
                    >
                      {user.status || "pending"}
                    </span>

                    {user.status === "approved" ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                          user.role === "supplier"
                            ? "bg-emerald-100 text-emerald-700"
                            : user.employeeActive === false
                            ? "bg-slate-100 text-slate-500"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {user.role === "supplier"
                          ? "Supplier Portal"
                          : user.employeeActive === false
                            ? "inactive"
                            : "active"}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {user.email || "No email"}
                  </p>

                  {user.lastLoginAt ? (
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      Last login:{" "}
                      {new Date(user.lastLoginAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 xl:w-[1080px]">
                  <label className="block sm:col-span-2 xl:col-span-1">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Display Name
                    </span>
                    <input
                      type="text"
                      value={draft.displayName}
                      onChange={(event) =>
                        updateDraft(
                          user.id,
                          "displayName",
                          event.target.value,
                        )
                      }
                      placeholder="Austin Miller"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Status
                    </span>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        updateDraft(
                          user.id,
                          "status",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      {statuses.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {draft.role === "supplier" ? (
                    <label className="block sm:col-span-2 xl:col-span-1">
                      <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Bound Vendor
                      </span>
                      <select
                        required
                        value={draft.vendorId}
                        onChange={(event) => {
                          const vendor = vendorList.find(
                            (item) => String(item.id || item.name) === event.target.value,
                          );
                          updateDraft(user.id, "vendorId", event.target.value);
                          updateDraft(user.id, "vendorName", vendor?.name || "");
                        }}
                        className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-950 outline-none focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="">Choose vendor</option>
                        {vendorList.map((vendor) => (
                          <option key={vendor.id || vendor.name} value={vendor.id || vendor.name}>
                            {vendor.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {draft.role !== "supplier" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Employee
                    </span>
                    <select
                      value={draft.employeeActive ? "active" : "inactive"}
                      onChange={(event) =>
                        updateDraft(
                          user.id,
                          "employeeActive",
                          event.target.value === "active",
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  ) : null}

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Preset
                    </span>
                    <select
                      value={draft.role}
                      onChange={(event) =>
                        applyRolePreset(
                          user.id,
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      {roles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {draft.role !== "supplier" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Work View
                    </span>
                    <select
                      value={draft.workView}
                      onChange={(event) =>
                        applyWorkView(
                          user.id,
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      {workViews.map((workView) => (
                        <option key={workView.value} value={workView.value}>
                          {workView.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  ) : null}

                  {draft.role !== "supplier" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Driver Name
                    </span>
                    <select
                      value={draft.driverName}
                      onChange={(event) =>
                        updateDraft(
                          user.id,
                          "driverName",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      <option value="">None</option>
                      {driverNameOptions.map((driver) => (
                        <option key={driver} value={driver}>
                          {driver}
                        </option>
                      ))}
                    </select>
                  </label>
                  ) : null}
                </div>
              </div>

              {draft.role === "supplier" ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                    Supplier Portal Only
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-800">
                    This account can only open Supplier Pricing Chat. It cannot
                    be assigned as an employee or driver.
                  </p>
                </div>
              ) : (
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => toggleAccessPanel(user.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-4 text-left transition hover:bg-slate-100"
                  aria-expanded={accessPanelIsOpen}
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Page Access
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Pick exactly what this user can open.
                    </p>
                  </div>

                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">
                      {(draft.permissions || []).length} selected
                    </span>

                    <ChevronDown
                      aria-hidden="true"
                      className={`h-5 w-5 text-slate-400 transition-transform ${
                        accessPanelIsOpen ? "rotate-180" : ""
                      }`}
                      strokeWidth={2.5}
                    />
                  </span>
                </button>

                {accessPanelIsOpen ? (
                <div className="space-y-2 border-t border-slate-200 p-4">
                  {permissionGroups.map((group) => {
                    const selectedCount = group.permissions.filter(
                      (permission) =>
                        (draft.permissions || []).includes(
                          permission.id,
                        ),
                    ).length;
                    const groupIsOpen = isAccessGroupOpen(
                      user.id,
                      group,
                      draft,
                    );

                    return (
                      <div
                        key={group.title}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleAccessGroup(user.id, group, draft)
                          }
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                          aria-expanded={groupIsOpen}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-black text-slate-900">
                              {group.title}
                            </span>
                            <span className="mt-0.5 block text-xs font-bold text-slate-500">
                              {selectedCount} of{" "}
                              {group.permissions.length} selected
                            </span>
                          </span>

                          <span className="flex shrink-0 items-center gap-2">
                            {selectedCount > 0 ? (
                              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-[#FC2C38]">
                                {selectedCount}
                              </span>
                            ) : null}

                            <ChevronDown
                              aria-hidden="true"
                              className={`h-5 w-5 text-slate-400 transition-transform ${
                                groupIsOpen ? "rotate-180" : ""
                              }`}
                              strokeWidth={2.5}
                            />
                          </span>
                        </button>

                        {groupIsOpen ? (
                          <div className="space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
                            {group.permissions.map((permission) => (
                              <label
                                key={permission.id}
                                className="flex items-center gap-2 text-sm font-bold text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={(
                                    draft.permissions || []
                                  ).includes(permission.id)}
                                  onChange={() =>
                                    togglePermission(
                                      user.id,
                                      permission.id,
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-[#FC2C38] focus:ring-red-200"
                                />
                                <span>{permission.label}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                ) : null}
              </div>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {user.role === "supplier" &&
                currentUserProfile?.role === "superAdmin" ? (
                  <button
                    type="button"
                    onClick={() => deleteSupplier(user)}
                    disabled={deletingUserId === user.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingUserId === user.id
                      ? "Deleting account…"
                      : "Delete supplier account"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => saveUser(user)}
                  disabled={!hasChanges || savingUserId === user.id}
                  className="rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingUserId === user.id
                    ? "Saving..."
                    : "Save Access"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      )}
    </PageContainer>
  );
}
