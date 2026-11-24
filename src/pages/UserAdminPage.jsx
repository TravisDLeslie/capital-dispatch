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
  Mail,
  MapPin,
  PackageCheck,
  RefreshCw,
  Trash2,
  Truck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import DeliveryPriceEstimate from "../components/DeliveryPriceEstimate";
import PageContainer from "../components/PageContainer";
import { auth } from "../utils/firebase";
import {
  listCustomerAccountRequests,
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
  const [isLoadingQuoteRequests, setIsLoadingQuoteRequests] = useState(true);
  const [savingQuoteRequestId, setSavingQuoteRequestId] = useState("");
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
            {
              status: quoteRequest.status || "new",
              internalNote: quoteRequest.internalNote || "",
            },
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

  async function saveQuoteRequest(quoteRequest) {
    const draft = quoteRequestDrafts[quoteRequest.id] || {};
    setSavingQuoteRequestId(quoteRequest.id);
    setMessage("");
    setError("");

    try {
      await updateCustomerQuoteRequest({
        requestId: quoteRequest.id,
        status: draft.status || "new",
        internalNote: draft.internalNote?.trim() || "",
      });
      setMessage(`Updated ${quoteRequest.reference || "quote request"}.`);
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

          {isLoadingQuoteRequests ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">Loading customer quote requests…</div>
          ) : quoteRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <ClipboardList className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-lg font-black text-slate-800">No quote requests yet</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">New customer portal quote requests will appear here automatically.</p>
            </div>
          ) : (
            quoteRequests.map((quoteRequest) => {
              const status = getQuoteStatus(quoteRequest.status);
              const draft = quoteRequestDrafts[quoteRequest.id] || {
                status: quoteRequest.status || "new",
                internalNote: quoteRequest.internalNote || "",
              };
              const isSaving = savingQuoteRequestId === quoteRequest.id;

              return (
                <section key={quoteRequest.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">{quoteRequest.reference || "Quote request"}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.1em] ${status.className}`}>{status.label}</span>
                      </div>
                      <h2 className="mt-2 text-2xl font-black text-slate-950">{quoteRequest.businessName || quoteRequest.name || "Customer quote"}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{quoteRequest.name || "Contact not provided"} · {quoteRequest.email || "No email"} · {quoteRequest.phone || "No phone"}</p>
                      {quoteRequest.createdAt ? <p className="mt-2 text-xs font-semibold text-slate-400">Submitted {formatCustomerRequestDate(quoteRequest.createdAt)}</p> : null}
                    </div>

                    <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:w-[460px]">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Account</p>
                        <p className="mt-1 text-sm font-black text-slate-800">{quoteRequest.accountNumber || "Not linked yet"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Needed</p>
                        <p className="mt-1 text-sm font-black text-slate-800">{quoteTimelineLabels[quoteRequest.neededBy] || quoteRequest.neededBy || "Not provided"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="h-5 w-5 text-violet-600" />
                          <h3 className="font-black text-slate-950">Requested material</h3>
                        </div>
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{quoteRequest.items?.length || 0} items</span>
                      </div>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                        {(quoteRequest.items || []).map((item) => (
                          <div key={`${quoteRequest.id}-${item.itemNumber}`} className="grid gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[110px_1fr_100px] sm:items-center">
                            <p className="text-xs font-black uppercase tracking-[0.1em] text-[#FC2C38]">{item.itemNumber}</p>
                            <p className="text-sm font-bold text-slate-800">{item.description}</p>
                            <p className="text-sm font-black text-slate-950 sm:text-right">Qty {item.quantity}</p>
                          </div>
                        ))}
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
                          {quoteStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="mt-4 block">
                        <span className="mb-1 block text-xs font-black text-slate-600">Internal note</span>
                        <textarea value={draft.internalNote || ""} onChange={(event) => updateQuoteRequestDraft(quoteRequest.id, "internalNote", event.target.value)} maxLength={800} rows={4} placeholder="Who is preparing this quote, follow-up details, or outcome…" className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-100" />
                      </label>
                      <button type="button" onClick={() => saveQuoteRequest(quoteRequest)} disabled={isSaving} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:bg-slate-400">{isSaving ? "Saving…" : "Save quote status"}</button>
                      {quoteRequest.reviewedAt ? <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">Last updated {formatCustomerRequestDate(quoteRequest.reviewedAt)}{quoteRequest.reviewedBy ? ` by ${quoteRequest.reviewedBy}` : ""}</p> : null}
                    </aside>
                  </div>
                </section>
              );
            })
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
