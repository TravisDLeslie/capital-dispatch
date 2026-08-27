import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  Calculator,
  CalendarDays,
  Check,
  ClipboardList,
  ClipboardCheck,
  Copy,
  DollarSign,
  History,
  Images,
  BookOpen,
  Mail,
  MailCheck,
  Package,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  UsersRound,
  Warehouse,
  X,
} from "lucide-react";
import AppHeader from "./components/AppHeader";
import SectionHubPage from "./components/SectionHubPage";
import BounciePage from "./pages/BounciePage";
import CheckInPage from "./pages/CheckInPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerPaymentLinksPage from "./pages/CustomerPaymentLinksPage";
import DashboardPage from "./pages/DashboardPage";
import DriverDashboardPage from "./pages/DriverDashboardPage";
import DeliveryCalendarPage from "./pages/DeliveryCalendarPage";
import DeliveryDashboardPage from "./pages/DeliveryDashboardPage";
import DeliveryDispatchPage from "./pages/DeliveryDispatchPage";
import DeliveryHistoryPage from "./pages/DeliveryHistoryPage";
import DeliveryQueuePage from "./pages/DeliveryQueuePage";
import DeliverySettingsPage from "./pages/DeliverySettingsPage";
import DeliveriesPage from "./pages/DeliveriesPage";
import EmailListPage from "./pages/EmailListPage";
import LoginPage from "./components/LoginPage";
import POCalendarPage from "./pages/POCalendarPage";
import OrderFlowPage from "./pages/OrderFlowPage";
import SearchPage from "./pages/SearchPage";
import SalesConverterPage from "./pages/SalesConverterPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";
import SalesReportPage from "./pages/SalesReportPage";
import StockingHandbookPage from "./pages/StockingHandbookPage";
import SouthHubPage from "./pages/SouthHubPage";
import SouthOverviewPage from "./pages/SouthOverviewPage";
import SupplierRunsPage from "./pages/SupplierRunsPage";
import TodayPage from "./pages/TodayPage";
import TheirTruckHistoryPage from "./pages/TheirTruckHistoryPage";
import TheirTruckOverviewPage from "./pages/TheirTruckOverviewPage";
import TheirTruckPOPage from "./pages/TheirTruckPOPage";
import TracePage from "./pages/TracePage";
import UserAdminPage from "./pages/UserAdminPage";
import VendorSettingsPage from "./pages/VendorSettingsPage";
import YardTasksPage from "./pages/YardTasksPage";
import {
  addCheckIn,
  deleteCheckIn,
  getCheckIns,
  subscribeToCheckIns,
  updateCheckInAssignment,
} from "./utils/checkInStorage";
import { getFirebaseErrorMessage } from "./utils/firebaseErrorMessages";
import { auth, isFirebaseConfigured } from "./utils/firebase";
import { isDeliveryComplete } from "./utils/deliveryStatus";
import {
  addSupplierRun,
  deleteSupplierRun,
  subscribeToSupplierRuns,
  updateSupplierRun,
  updateSupplierRunItemPhotos,
  updateSupplierRunItems,
  updateSupplierRunsBulk,
} from "./utils/supplierRunStorage";
import {
  addDelivery,
  deleteDelivery,
  subscribeToDeliveries,
  updateDelivery,
} from "./utils/deliveryStorage";
import {
  addCustomer,
  subscribeToCustomers,
  updateCustomer,
} from "./utils/customerStorage";
import {
  ensureMonthlyPaymentLinks,
  subscribeToCustomerPaymentLinks,
  updateCustomerPaymentLink,
} from "./utils/customerPaymentLinkStorage";
import {
  saveCustomerStatement,
  subscribeToCustomerStatements,
} from "./utils/customerStatementStorage";
import {
  saveSalesOrder,
  subscribeToSalesOrders,
} from "./utils/salesOrderStorage";
import {
  deleteTheirTruckPO,
  saveTheirTruckPO,
  subscribeToTheirTruckPOs,
} from "./utils/theirTruckPoStorage";
import {
  ensureUserProfile,
  subscribeToUserProfile,
  subscribeToUsers,
  updateUserProfile,
} from "./utils/userStorage";
import {
  addEmailListEntry,
  deleteEmailListEntry,
  subscribeToEmailList,
} from "./utils/emailListStorage";
import {
  saveSalesReport,
  subscribeToSalesReports,
} from "./utils/salesReportStorage";
import { getDateInputValue } from "./utils/dateHelpers";
import {
  deleteStockingHandbookItem,
  saveStockingHandbookItem,
  subscribeToStockingHandbookItems,
} from "./utils/stockingHandbookStorage";
import {
  deleteYardTask,
  saveYardTask,
  subscribeToYardTasks,
  updateYardTask,
} from "./utils/yardTaskStorage";
import { subscribeToBouncieVehicleSettings } from "./utils/bouncieVehicleStorage";
import {
  defaultDeliveryScheduleSettings,
} from "./utils/deliverySchedule";
import {
  saveDeliverySettings,
  subscribeToDeliverySettings,
} from "./utils/deliverySettingsStorage";
import {
  defaultVendorSettings,
  saveVendorSettings,
  subscribeToVendorSettings,
} from "./utils/vendorSettingsStorage";
import { capitalLumberAddress } from "./data/options";
import { formatCustomerName } from "./utils/textFormatters";

const DELETE_PO_CODE = "3105";
const SUPER_ADMIN_EMAILS = ["travis@capitallumber.co"];
const SOUTH_PICKUP_AUTO_REFRESH_MS = 5 * 60 * 1000;
const REFRESH_PAGE_STORAGE_KEY = "dispatch-cl-refresh-page";

function getProfileDisplayName(user: Partial<UserProfile> | null | undefined) {
  const emailName = String(user?.email || "").split("@")[0] || "";

  return (
    user?.displayName ||
    user?.driverName ||
    emailName ||
    ""
  ).trim();
}

function getUniqueNames(names: string[]) {
  const seenNames = new Set<string>();

  return names
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();

      if (seenNames.has(key)) {
        return false;
      }

      seenNames.add(key);
      return true;
    })
    .sort((firstName, secondName) =>
      firstName.localeCompare(secondName, undefined, {
        sensitivity: "base",
      }),
    );
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeSearchNumber(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function getLookupItemText(item: Record<string, unknown>) {
  return [
    item.quantity,
    item.qty,
    item.description,
    item.name,
    item.material,
    item.materialDescription,
    item.itemDescription,
    item.internalReference,
    item.sku,
    item.itemNumber,
    item.itemNo,
    item.soNumber,
    item.stockNumber,
    item.productCode,
    item.orderNumber,
    item.customerName,
    item.location,
    item.notes,
  ]
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .join(" ");
}

function getLookupItemNumberText(item: Record<string, unknown>) {
  return [
    item.internalReference,
    item.sku,
    item.itemNumber,
    item.itemNo,
    item.soNumber,
    item.stockNumber,
    item.productCode,
    item.orderNumber,
  ]
    .map((value) => normalizeSearchNumber(value))
    .filter(Boolean)
    .join(" ");
}

function getLookupItemLabel(item: Record<string, unknown>) {
  const quantity = String(item.quantity ?? item.qty ?? "").trim();
  const description = String(
    item.description ??
      item.name ??
      item.material ??
      item.materialDescription ??
      item.itemDescription ??
      "",
  ).trim();
  const itemNumber = String(
    item.internalReference ??
      item.sku ??
      item.itemNumber ??
      item.itemNo ??
      item.soNumber ??
      item.stockNumber ??
      item.productCode ??
      "",
  ).trim();

  return {
    quantity,
    description: description || "Item detail",
    itemNumber,
  };
}

const QUICK_RECEIVING_STATUS_STAMPS = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  partial: "border-orange-200 bg-orange-50 text-orange-700",
  received: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function getQuickReceivedMaterialCount(checkIn: Record<string, unknown>) {
  if (Array.isArray(checkIn.materials)) {
    return checkIn.materials.length;
  }

  if (Array.isArray(checkIn.items)) {
    return checkIn.items.length;
  }

  return 0;
}

function checkInMatchesQuickPO(
  checkIn: Record<string, unknown>,
  poNumber: unknown,
) {
  const normalizedPO = normalizeSearchNumber(poNumber);

  if (!normalizedPO) {
    return false;
  }

  return [
    checkIn.poNumber,
    checkIn.sourceSupplierRunPoNumber,
    checkIn.sourceTheirTruckPONumber,
  ]
    .filter(Boolean)
    .some((value) => normalizeSearchNumber(value) === normalizedPO);
}

function getQuickReceivingStatusForPO(
  checkIns: Array<Record<string, unknown>>,
  poNumber: unknown,
  expectedItemCount = 0,
) {
  const matches = checkIns.filter((checkIn) =>
    checkInMatchesQuickPO(checkIn, poNumber),
  );

  if (matches.length === 0) {
    return {
      key: "pending",
      label: "Pending Check-In",
      className: QUICK_RECEIVING_STATUS_STAMPS.pending,
    };
  }

  const receivedItemCount = matches.reduce(
    (total, checkIn) => total + getQuickReceivedMaterialCount(checkIn),
    0,
  );

  if (expectedItemCount > 0 && receivedItemCount < expectedItemCount) {
    return {
      key: "partial",
      label: "Partial Check-In",
      className: QUICK_RECEIVING_STATUS_STAMPS.partial,
    };
  }

  return {
    key: "received",
    label: "Checked In",
    className: QUICK_RECEIVING_STATUS_STAMPS.received,
  };
}

function getQuickPhotoDataUrl(photo: unknown) {
  if (!photo || typeof photo !== "object") {
    return "";
  }

  return String((photo as { dataUrl?: unknown }).dataUrl || "").trim();
}

function getQuickPhotoArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getQuickPOPhotosForPO(
  checkIns: Array<Record<string, unknown>>,
  poNumber: unknown,
) {
  const photos: Array<{
    id: string;
    dataUrl: string;
    title: string;
    subtitle: string;
  }> = [];
  const seenDataUrls = new Set<string>();

  checkIns
    .filter((checkIn) => checkInMatchesQuickPO(checkIn, poNumber))
    .forEach((checkIn) => {
      const checkInPONumber = String(checkIn.poNumber || poNumber || "PO");
      const checkedInAt = String(checkIn.checkedInAt || checkIn.createdAt || "");
      const addPhoto = (
        photo: unknown,
        title: string,
        subtitleParts: Array<string | undefined>,
      ) => {
        const dataUrl = getQuickPhotoDataUrl(photo);

        if (!dataUrl || seenDataUrls.has(dataUrl)) {
          return;
        }

        seenDataUrls.add(dataUrl);
        photos.push({
          id: `${checkIn.id || checkInPONumber}-${photos.length}`,
          dataUrl,
          title,
          subtitle: subtitleParts.filter(Boolean).join(" • "),
        });
      };

      addPhoto(checkIn.locationPhoto, "PO Location Photo", [
        `PO ${checkInPONumber}`,
        checkedInAt ? formatQuickLookupDate(checkedInAt) : "",
      ]);

      const materials = Array.isArray(checkIn.materials)
        ? checkIn.materials
        : Array.isArray(checkIn.items)
          ? checkIn.items
          : [];

      materials.forEach((material, materialIndex) => {
        const materialRecord = material as Record<string, unknown>;
        const label = getLookupItemLabel(materialRecord);
        const location = String(materialRecord.location || "").trim();
        const materialName = label.description || `Material ${materialIndex + 1}`;
        const subtitleParts = [
          `PO ${checkInPONumber}`,
          materialName,
          location,
        ];

        getQuickPhotoArray(materialRecord.locationPhotos).forEach((photo) => {
          addPhoto(photo, "Location Photo", subtitleParts);
        });
        addPhoto(materialRecord.locationPhoto, "Location Photo", subtitleParts);

        getQuickPhotoArray(materialRecord.damagePhotos).forEach((photo) => {
          addPhoto(photo, "Damage Photo", subtitleParts);
        });
        addPhoto(materialRecord.damagePhoto, "Damage Photo", subtitleParts);
      });
    });

  return photos;
}

function formatQuickLookupDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

async function copyTextToClipboard(value: string) {
  const text = value.trim();

  if (!text) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function normalizeEmployeeName(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function createEmployeeAliasMap(users: Partial<UserProfile>[]) {
  const firstNameCounts = new Map<string, number>();
  const aliasMap: Record<string, string> = {};

  users.forEach((user) => {
    const displayName = getProfileDisplayName(user);
    const firstNameKey = normalizeEmployeeName(displayName.split(/\s+/)[0] || "");

    if (firstNameKey) {
      firstNameCounts.set(firstNameKey, (firstNameCounts.get(firstNameKey) || 0) + 1);
    }
  });

  users.forEach((user) => {
    const displayName = getProfileDisplayName(user);
    const firstName = displayName.split(/\s+/)[0] || "";
    const aliases = [
      displayName,
      user?.driverName || "",
      user?.displayName || "",
      String(user?.email || "").split("@")[0] || "",
    ];
    const firstNameKey = normalizeEmployeeName(firstName);

    if (firstNameKey && firstNameCounts.get(firstNameKey) === 1) {
      aliases.push(firstName);
    }

    aliases.forEach((alias) => {
      const key = normalizeEmployeeName(alias);

      if (key && displayName) {
        aliasMap[key] = displayName;
      }
    });
  });

  return aliasMap;
}

function getEmployeeNameAliases(
  user: Partial<UserProfile> | null | undefined,
) {
  const displayName = getProfileDisplayName(user);
  const emailPrefix = String(user?.email || "").split("@")[0] || "";
  const candidateNames = [
    user?.driverName || "",
    user?.displayName || "",
    displayName,
    emailPrefix,
    displayName.split(/\s+/)[0] || "",
    String(user?.driverName || "").split(/\s+/)[0] || "",
  ];
  const seenAliases = new Set<string>();

  return candidateNames
    .map((name) => String(name || "").trim())
    .filter((name) => {
      const key = normalizeEmployeeName(name);

      if (!key || seenAliases.has(key)) {
        return false;
      }

      seenAliases.add(key);
      return true;
    });
}

function getCanonicalEmployeeName(
  name: string,
  aliasMap: Record<string, string>,
) {
  const key = normalizeEmployeeName(name);

  return aliasMap[key] || name;
}

function areEmployeeNamesEqual(
  firstName: string,
  secondName: string,
  aliasMap: Record<string, string>,
) {
  return (
    normalizeEmployeeName(getCanonicalEmployeeName(firstName, aliasMap)) ===
    normalizeEmployeeName(getCanonicalEmployeeName(secondName, aliasMap))
  );
}

function isActiveEmployee(user: Partial<UserProfile> | null | undefined) {
  return user?.status === "approved" && user?.employeeActive !== false;
}

const LEGACY_ROLE_PAGE_IDS: Record<string, string[]> = {
  driver: [
    "dashboard",
    "south",
    "supplier-runs-check",
    "supplier-runs-calendar",
    "south-calendar",
    "deliveries",
    "deliveries-calendar",
    "deliveries-queue",
  ],
  receiving: [
    "dashboard",
    "receiving",
    "check-in",
    "today",
    "search",
    "trace",
  ],
  "yard-tasks": ["dashboard", "yard-tasks"],
  south: [
    "dashboard",
    "south",
    "south-overview",
    "supplier-runs-add",
    "their-truck-pos",
    "their-truck-overview",
    "supplier-runs-dispatch",
    "supplier-runs-check",
    "supplier-runs-calendar",
    "south-calendar",
    "their-truck-calendar",
    "po-calendar",
    "their-truck-history",
    "supplier-runs-history",
  ],
  delivery: [
    "dashboard",
    "deliveries",
    "deliveries-add",
    "deliveries-dispatch",
    "deliveries-calendar",
    "deliveries-queue",
    "deliveries-history",
  ],
  sales: [
    "dashboard",
    "south",
    "south-overview",
    "supplier-runs-add",
    "their-truck-pos",
    "their-truck-overview",
    "south-calendar",
    "their-truck-calendar",
    "po-calendar",
    "their-truck-history",
    "trace",
    "sales",
    "sales-orders",
    "customers-add",
    "customers-view",
    "sales-tools",
    "sales-converter",
    "documents",
    "stocking-handbook",
  ],
  accounting: [
    "dashboard",
    "accounting",
    "accounting-customers",
    "customer-payment-links",
  ],
};

type UserProfile = {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  workView?: string;
  permissions?: string[];
  status?: string;
  employeeActive?: boolean;
  driverName?: string;
  approvedAt?: string | null;
  approvedBy?: string;
  [key: string]: unknown;
};

type CheckIn = {
  id: string;
  receivingTruckType?: string;
  receivingTruckLabel?: string;
  [key: string]: unknown;
};

type YardTask = {
  id: string;
  title?: string;
  priority?: number;
  area?: string;
  assignedTo?: string;
  notes?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  [key: string]: unknown;
};

type OrderAssignment = {
  type: string;
  customerId?: string;
  customerAccountNumber?: string;
  internalReference?: string;
  businessName?: string;
  orderedBy?: string;
  jobName?: string;
};

type SupplierRunItem = {
  id: string;
  quantity?: string;
  description: string;
  internalReference?: string;
  materialUse?: string;
  orderNumber?: string;
  customerName?: string;
  returnNotes?: string;
  easilyDamaged?: boolean;
  pickedUp: boolean;
  pickedUpAt?: string | null;
  pickupPhoto?: unknown | null;
  pickupPhotos?: unknown[] | null;
};

type SupplierRun = {
  id: string;
  poNumber?: string;
  vendor?: string;
  scheduledDate?: string;
  orderedBy?: string;
  customerName?: string;
  driver?: string;
  supplierAddress?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdById?: string;
  vehicleId?: string;
  vehicleTitle?: string;
  vehicleBadge?: string;
  dispatchStatus?: string;
  items?: SupplierRunItem[];
  status?: string;
  stopWorkflowVersion?: number;
  stopArrivedAt?: string | null;
  stopCompletedAt?: string | null;
  [key: string]: unknown;
};

type TheirTruckPO = {
  id: string;
  poNumber?: string;
  deliveryDate?: string;
  vendor?: string;
  customerName?: string;
  isStock?: boolean;
  items?: Array<Record<string, unknown>>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type DeliveryItem = {
  id: string;
  quantity?: string;
  description: string;
  delivered: boolean;
};

type Delivery = {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  contactName?: string;
  contactPhone?: string;
  phoneNumber?: string;
  driver: string;
  deliveryType?: string;
  unloadType: string;
  forkliftType?: string;
  hasHardware?: boolean;
  needsTarp?: boolean;
  driverTargetArrivalTime?: string;
  hardwareChecked?: boolean;
  deliveryLocationNotes?: string;
  generalNotes?: string;
  deliveryNotes?: string;
  items: DeliveryItem[];
  deliveryPhoto?: unknown | null;
  deliveryPhotos?: unknown[];
  hardwarePhoto?: unknown | null;
  hardwarePhotos?: unknown[];
  deliveredAt?: string;
  dispatchStatus?: string;
  deliveryScope?: string;
  deliveryScopeNotes?: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryOriginName?: string;
  deliveryOriginAddress?: string;
  oneWayDriveMinutes?: number;
  estimatedDurationMinutes?: number;
  drivers?: string[];
  vehicleId?: string;
  vehicleTitle?: string;
  vehicleBadge?: string;
  dispatchAssignments?: Array<{
    id?: string;
    driver?: string;
    vehicleId?: string;
    vehicleTitle?: string;
    vehicleBadge?: string;
  }>;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

type SalesReport = {
  id?: string;
  month: string;
  cashCardSales?: number;
  chargeSales?: number;
  topSpenders?: Array<{
    id?: string;
    name?: string;
    amount?: number;
  }>;
  [key: string]: unknown;
};

type SalesOrder = {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName?: string;
  phone?: string;
  poNumbers?: string[];
  status?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type StockingHandbookItem = {
  id: string;
  category?: string;
  name?: string;
  sku?: string;
  grade?: string;
  nominalDimension?: string;
  actualDimension?: string;
  unitSize?: string;
  stockingLengths?: string;
  notes?: string;
  keywords?: string;
  source?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type CustomerContact = {
  id: string;
  label?: string;
  name?: string;
  phone?: string;
  email?: string;
};

type Customer = {
  id: string;
  name?: string;
  companyName?: string;
  accountNumber?: string;
  email?: string;
  website?: string;
  address?: string;
  streetAddress?: string;
  state?: string;
  zip?: string;
  contacts?: CustomerContact[];
  needsPaymentLink?: boolean;
  paymentLinkContactId?: string;
  paymentLinkNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type CustomerPaymentLink = {
  id: string;
  month: string;
  customerId: string;
  customerName?: string;
  accountNumber?: string;
  contactId?: string;
  contactLabel?: string;
  contactName?: string;
  contactEmail?: string;
  status?: string;
  notes?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type CustomerStatement = {
  id: string;
  customerId: string;
  customerName?: string;
  accountNumber?: string;
  statementMonth: string;
  balanceDueCents?: number;
  dueDate?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type EmailListEntry = {
  id: string;
  email: string;
  name?: string;
  companyName?: string;
  source?: string;
  customerId?: string;
  contactId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type VehicleSetting = {
  id: string;
  title?: string;
  badge?: string;
  bouncieName?: string;
  yearMakeModel?: string;
  [key: string]: unknown;
};

type DeliverySettings = {
  id?: string;
  unloadDurations?: Record<string, number>;
  updatedAt?: string;
  [key: string]: unknown;
};

type VendorSetting = {
  id: string;
  name: string;
  address?: string;
  deliveryCadence?: string;
  routeOrder?: number;
  active?: boolean;
};

type VendorSettings = {
  id?: string;
  vendors?: VendorSetting[];
  updatedAt?: string;
  [key: string]: unknown;
};

function canDeleteRecord(label: string) {
  const enteredCode = window.prompt(
    `Enter the internal delete code to delete ${label}.`,
  );

  if (enteredCode === null) {
    return false;
  }

  if (enteredCode.trim() !== DELETE_PO_CODE) {
    window.alert("Incorrect delete code. Nothing was deleted.");
    return false;
  }

  return true;
}

function isSuperAdminProfile(userProfile: UserProfile | null) {
  return Boolean(
    userProfile?.email &&
      SUPER_ADMIN_EMAILS.includes(userProfile.email.toLowerCase()),
  );
}

function isSuperAdminEmail(email?: string | null) {
  return Boolean(
    email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase()),
  );
}

function getUserRole(
  userProfile: UserProfile | null,
  currentUserEmail?: string | null,
) {
  if (isSuperAdminEmail(currentUserEmail || userProfile?.email)) {
    return "superAdmin";
  }

  if (!userProfile || userProfile.status !== "approved") {
    return "pending";
  }

  if (isSuperAdminProfile(userProfile)) {
    return "superAdmin";
  }

  return userProfile.role || "pending";
}

function getPresetRole(role: string) {
  if (role === "superAdmin" || role === "admin" || role === "pending") {
    return role;
  }

  return "customer";
}

function getWorkView(userProfile: UserProfile | null, role: string) {
  const profileWorkView = userProfile?.workView;

  if (typeof profileWorkView === "string" && profileWorkView) {
    return profileWorkView;
  }

  if (
    ["driver", "sales", "receiving", "south", "delivery", "accounting"].includes(
      role,
    )
  ) {
    return role;
  }

  return "operations";
}

function getAllowedPageIdsForRole(role: string) {
  if (role === "superAdmin") {
    return [
      "dashboard",
      "driver-dashboard",
      "receiving",
      "check-in",
      "today",
      "search",
      "trace",
      "yard-tasks",
      "documents",
      "south",
      "south-overview",
      "supplier-runs-add",
      "their-truck-pos",
      "their-truck-overview",
      "supplier-runs-dispatch",
      "supplier-runs-check",
      "supplier-runs-calendar",
      "south-calendar",
      "their-truck-calendar",
      "po-calendar",
      "their-truck-history",
      "supplier-runs-history",
      "deliveries",
      "deliveries-add",
      "deliveries-dispatch",
      "deliveries-calendar",
      "deliveries-queue",
      "deliveries-history",
      "sales",
      "sales-orders",
      "customers-add",
      "customers-view",
      "sales-tools",
      "sales-converter",
      "trace",
      "stocking-handbook",
      "accounting",
      "accounting-customers",
      "customer-payment-links",
      "fleet",
      "admin",
      "user-admin",
      "email-list",
      "delivery-settings",
      "vendor-settings",
      "order-flow",
      "sales-report",
      "bouncie",
    ];
  }

  if (role === "admin") {
    return [
      "dashboard",
      "driver-dashboard",
      "receiving",
      "check-in",
      "today",
      "search",
      "trace",
      "yard-tasks",
      "documents",
      "south",
      "south-overview",
      "supplier-runs-add",
      "their-truck-pos",
      "their-truck-overview",
      "supplier-runs-dispatch",
      "supplier-runs-check",
      "supplier-runs-calendar",
      "south-calendar",
      "their-truck-calendar",
      "po-calendar",
      "their-truck-history",
      "supplier-runs-history",
      "deliveries",
      "deliveries-add",
      "deliveries-dispatch",
      "deliveries-calendar",
      "deliveries-queue",
      "deliveries-history",
      "sales",
      "sales-orders",
      "customers-add",
      "customers-view",
      "sales-tools",
      "sales-converter",
      "trace",
      "stocking-handbook",
      "accounting",
      "accounting-customers",
      "customer-payment-links",
      "admin",
      "email-list",
      "delivery-settings",
      "vendor-settings",
      "sales-report",
    ];
  }

  if (role === "customer") {
    return ["dashboard"];
  }

  return [];
}

function getAllowedPageIds(
  role: string,
  permissions?: unknown,
) {
  const presetRole = getPresetRole(role);

  if (presetRole === "superAdmin") {
    return getAllowedPageIdsForRole(presetRole);
  }

  if (Array.isArray(permissions) && permissions.length > 0) {
    const pageIds = [
      "dashboard",
      ...permissions.filter(
        (permission): permission is string =>
          typeof permission === "string" &&
          !["fleet", "bouncie"].includes(permission),
      ),
    ];

    if (
      pageIds.includes("deliveries") ||
      pageIds.includes("deliveries-queue") ||
      pageIds.includes("deliveries-calendar")
    ) {
      pageIds.push("deliveries");
      pageIds.push("deliveries-queue", "deliveries-calendar");
    }

    if (
      pageIds.includes("stocking-handbook") &&
      !pageIds.includes("documents")
    ) {
      pageIds.push("documents");
    }

    return pageIds.filter(
      (pageId, index, currentPageIds) =>
        currentPageIds.indexOf(pageId) === index,
    );
  }

  if (LEGACY_ROLE_PAGE_IDS[role]) {
    return LEGACY_ROLE_PAGE_IDS[role];
  }

  return getAllowedPageIdsForRole(presetRole);
}

function PendingApproval({
  currentUser,
  userProfile,
  syncError,
  onSignOut,
}: {
  currentUser: User;
  userProfile: UserProfile | null;
  syncError?: string;
  onSignOut: () => void;
}) {
  const isDisabled = userProfile?.status === "disabled";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7F5] px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
          Capital Dispatch
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
          {isDisabled ? "Access disabled" : "Waiting for approval"}
        </h1>

        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          {isDisabled
            ? "Your account does not currently have access to this app."
            : "Your sign-in worked. A super admin needs to approve your account and assign your role before you can view app data."}
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Signed in as
          </p>
          <p className="mt-1 truncate text-sm font-black text-slate-900">
            {currentUser.email || "Unknown email"}
          </p>
        </div>

        {syncError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700">
            User profile was not saved: {syncError}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, button, [contenteditable="true"]',
    ),
  );
}

function activeElementIsEditing() {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  return (
    ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName) ||
    activeElement.isContentEditable
  );
}

function isSouthPickupRefreshWindow(date = new Date()) {
  const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes();

  return minutesSinceMidnight >= 8 * 60 + 30 && minutesSinceMidnight <= 15 * 60 + 30;
}

function isUnassignedSouthRun(supplierRun: SupplierRun) {
  return (
    supplierRun.status !== "complete" &&
    (supplierRun.dispatchStatus === "needsDispatch" || !supplierRun.driver)
  );
}

function refreshAndRestorePage(pageId: string) {
  try {
    sessionStorage.setItem(REFRESH_PAGE_STORAGE_KEY, pageId);
  } catch (error) {
    console.warn("Unable to save refresh page:", error);
  }

  window.location.reload();
}

function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isTrackingRef = useRef(false);

  useEffect(() => {
    function handleTouchStart(event: TouchEvent) {
      if (
        event.touches.length !== 1 ||
        window.scrollY > 2 ||
        isInteractiveElement(event.target)
      ) {
        isTrackingRef.current = false;
        return;
      }

      startYRef.current = event.touches[0]?.clientY || 0;
      isTrackingRef.current = true;
    }

    function handleTouchMove(event: TouchEvent) {
      if (!isTrackingRef.current || event.touches.length !== 1) {
        return;
      }

      const currentY = event.touches[0]?.clientY || 0;
      const distance = currentY - startYRef.current;

      if (distance <= 0 || window.scrollY > 2) {
        setPullDistance(0);
        return;
      }

      if (distance > 12) {
        event.preventDefault();
      }

      setPullDistance(Math.min(distance, 120));
    }

    function handleTouchEnd() {
      if (!isTrackingRef.current) {
        return;
      }

      isTrackingRef.current = false;

      if (pullDistance >= 78) {
        setIsRefreshing(true);
        window.setTimeout(() => {
          window.location.reload();
        }, 150);
        return;
      }

      setPullDistance(0);
    }

    window.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    window.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [pullDistance]);

  if (pullDistance <= 0 && !isRefreshing) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-3"
      style={{
        transform: `translateY(${Math.max(0, pullDistance - 70)}px)`,
      }}
    >
      <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 shadow-lg">
        {isRefreshing
          ? "Refreshing..."
          : pullDistance >= 78
            ? "Release to refresh"
            : "Pull to refresh"}
      </div>
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] =
    useState(() => {
      try {
        return sessionStorage.getItem(REFRESH_PAGE_STORAGE_KEY) || "dashboard";
      } catch {
        return "dashboard";
      }
    });
  const [previewUserId, setPreviewUserId] =
    useState("");
  const [traceInitialSearch, setTraceInitialSearch] = useState("");
  const [receivingDashboardSearch, setReceivingDashboardSearch] =
    useState("");
  const [copiedReceivingQuickPO, setCopiedReceivingQuickPO] =
    useState("");
  const [viewingReceivingQuickPhotos, setViewingReceivingQuickPhotos] =
    useState<{
      poNumber: string;
      photos: Array<{
        id: string;
        dataUrl: string;
        title: string;
        subtitle: string;
      }>;
    } | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] =
    useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [yardTasks, setYardTasks] = useState<YardTask[]>([]);
  const [supplierRuns, setSupplierRuns] = useState<
    SupplierRun[]
  >([]);
  const [theirTruckPOs, setTheirTruckPOs] = useState<TheirTruckPO[]>([]);
  const [receivingSouthLookupRuns, setReceivingSouthLookupRuns] =
    useState<SupplierRun[]>([]);
  const [deliveries, setDeliveries] = useState<
    Delivery[]
  >([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPaymentLinks, setCustomerPaymentLinks] = useState<
    CustomerPaymentLink[]
  >([]);
  const [customerStatements, setCustomerStatements] = useState<
    CustomerStatement[]
  >([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [stockingHandbookItems, setStockingHandbookItems] = useState<
    StockingHandbookItem[]
  >([]);
  const [emailList, setEmailList] = useState<EmailListEntry[]>([]);
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);
  const [vehicleSettings, setVehicleSettings] = useState<VehicleSetting[]>([]);
  const [deliverySettings, setDeliverySettings] =
    useState<DeliverySettings>(defaultDeliveryScheduleSettings);
  const [vendorSettings, setVendorSettings] =
    useState<VendorSettings>(defaultVendorSettings);
  const [editingDeliveryId, setEditingDeliveryId] =
    useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState("");

  function reportBackgroundSyncError(error: unknown) {
    if ((error as { code?: string })?.code === "permission-denied") {
      return;
    }

    setSyncError(getFirebaseErrorMessage(error));
  }

  const rawUserRole = getUserRole(userProfile, currentUser?.email);
  const userRole = getPresetRole(rawUserRole);
  const isSuperAdmin = userRole === "superAdmin";
  const isApproved =
    isSuperAdmin || userProfile?.status === "approved";
  const allowedPageIds = useMemo(
    () => getAllowedPageIds(userRole, userProfile?.permissions),
    [userRole, userProfile?.permissions],
  );
  const activeVendors = useMemo(
    () =>
      (Array.isArray(vendorSettings.vendors)
        ? vendorSettings.vendors
        : []
      )
        .filter((vendor) => vendor.active !== false && vendor.name)
        .sort((firstVendor, secondVendor) => {
          const firstOrder = Number(firstVendor.routeOrder) || 999;
          const secondOrder = Number(secondVendor.routeOrder) || 999;

          if (firstOrder !== secondOrder) {
            return firstOrder - secondOrder;
          }

          return firstVendor.name.localeCompare(secondVendor.name);
        }),
    [vendorSettings.vendors],
  );
  const vendorOptions = useMemo(
    () =>
      activeVendors
        .map((vendor) => vendor.name)
        .sort((firstVendor, secondVendor) =>
          firstVendor.localeCompare(secondVendor, undefined, {
            sensitivity: "base",
          }),
        ),
    [activeVendors],
  );
  const vendorRouteOptions = useMemo(
    () => activeVendors.map((vendor) => vendor.name),
    [activeVendors],
  );
  const supplierAddressMap = useMemo(
    () =>
      activeVendors.reduce<Record<string, string>>(
        (addressMap, vendor) => ({
          ...addressMap,
          [vendor.name]: vendor.address || "",
        }),
        {},
      ),
    [activeVendors],
  );
  const vendorDeliveryCadenceMap = useMemo(
    () =>
      activeVendors.reduce<Record<string, string>>(
        (cadenceMap, vendor) => ({
          ...cadenceMap,
          [vendor.name]: String(vendor.deliveryCadence || ""),
        }),
        {},
      ),
    [activeVendors],
  );
  const vendorDisplayNameMap = useMemo(
    () =>
      activeVendors.reduce<Record<string, string>>((displayNameMap, vendor) => {
        const keys = [
          vendor.id,
          vendor.name,
          String(vendor.name || "").replace(/[^a-z0-9]/gi, ""),
        ]
          .map((value) =>
            String(value || "")
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]/g, ""),
          )
          .filter(Boolean);

        return keys.reduce(
          (nextDisplayNameMap, key) => ({
            ...nextDisplayNameMap,
            [key]: vendor.name,
          }),
          displayNameMap,
        );
      }, {}),
    [activeVendors],
  );
  const deliveryOriginOptions = useMemo(
    () => [
      {
        name: "Capital Lumber",
        address: capitalLumberAddress,
      },
      ...activeVendors
        .filter((vendor) => vendor.address)
        .map((vendor) => ({
          name: vendor.name,
          address: vendor.address || "",
        })),
    ],
    [activeVendors],
  );
  const dashboardPreviewUsers = useMemo(() => {
    const savedUsers = Array.isArray(users) ? users : [];
    const currentProfile =
      userProfile || currentUser
        ? {
            id: currentUser?.uid || userProfile?.id || "",
            uid: currentUser?.uid || userProfile?.uid || "",
            email: currentUser?.email || userProfile?.email || "",
            displayName:
              getProfileDisplayName(userProfile) || currentUser?.displayName || "",
            role: userRole,
            workView: userProfile?.workView || "operations",
            status: isApproved ? "approved" : userProfile?.status || "pending",
            driverName: userProfile?.driverName || "",
            permissions: userProfile?.permissions,
          }
        : null;
    const userMap = new Map<string, UserProfile>();

    [...(currentProfile ? [currentProfile] : []), ...savedUsers].forEach(
      (profile) => {
        const profileId = profile.uid || profile.id || profile.email || "";

        if (profileId) {
          userMap.set(profileId, profile);
        }
      },
    );

    return [...userMap.values()].sort((firstUser, secondUser) =>
      String(firstUser.displayName || firstUser.email || "").localeCompare(
        String(secondUser.displayName || secondUser.email || ""),
      ),
    );
  }, [currentUser, isApproved, userProfile, userRole, users]);
  const selectedPreviewProfile =
    dashboardPreviewUsers.find(
      (previewUser) =>
        (previewUser.uid || previewUser.id || previewUser.email) ===
        previewUserId,
    ) ||
    dashboardPreviewUsers.find(
      (previewUser) =>
        previewUser.uid === currentUser?.uid ||
        previewUser.id === currentUser?.uid ||
        previewUser.email === currentUser?.email,
    ) ||
    dashboardPreviewUsers[0] ||
    userProfile;
  const effectiveUserRole = isSuperAdmin
    ? getPresetRole(
        getUserRole(selectedPreviewProfile, selectedPreviewProfile?.email),
      )
    : userRole;
  const effectiveAllowedPageIds = isSuperAdmin
    ? getAllowedPageIds(effectiveUserRole, selectedPreviewProfile?.permissions)
    : allowedPageIds;
  const effectiveWorkView = isSuperAdmin
    ? getWorkView(
        selectedPreviewProfile,
        getUserRole(selectedPreviewProfile, selectedPreviewProfile?.email),
      )
    : getWorkView(userProfile, rawUserRole);
  const driverName = isSuperAdmin
    ? selectedPreviewProfile?.driverName || ""
    : userProfile?.driverName || "";
  const driverNameAliases = useMemo(
    () =>
      getEmployeeNameAliases(
        isSuperAdmin ? selectedPreviewProfile : userProfile,
      ),
    [isSuperAdmin, selectedPreviewProfile, userProfile],
  );
  const canReadReceiving = effectiveAllowedPageIds.some((pageId) =>
    [
      "receiving",
      "check-in",
      "today",
      "search",
      "trace",
      "yard-tasks",
    ].includes(pageId),
  );
  const canReadYardTasks = effectiveAllowedPageIds.includes("yard-tasks");
  const canManageYardTasks = ["superAdmin", "admin"].includes(
    effectiveUserRole,
  );
  const canReadSouth = effectiveAllowedPageIds.some((pageId) =>
    [
      "south",
      "south-overview",
      "supplier-runs-add",
      "supplier-runs-dispatch",
      "supplier-runs-check",
      "supplier-runs-calendar",
      "supplier-runs-history",
      "their-truck-overview",
      "their-truck-pos",
      "their-truck-calendar",
      "their-truck-history",
    ].includes(pageId),
  );
  const canAssignSouthRoutes = effectiveAllowedPageIds.includes(
    "supplier-runs-dispatch",
  );
  const canMaintainSouthSchedule =
    isSuperAdmin || allowedPageIds.includes("supplier-runs-dispatch");
  const canReadDeliveries = effectiveAllowedPageIds.some((pageId) =>
    [
      "deliveries",
      "deliveries-add",
      "deliveries-dispatch",
      "deliveries-calendar",
      "deliveries-queue",
      "deliveries-history",
    ].includes(pageId),
  );
  const canEditDeliveryDetails = ["superAdmin", "admin"].includes(
    effectiveUserRole,
  );
  const canReadSales = effectiveAllowedPageIds.some((pageId) =>
    [
      "sales",
      "sales-orders",
      "customers-add",
      "customers-view",
      "sales-tools",
      "sales-converter",
    ].includes(pageId),
  );
  const canReadDocuments = effectiveAllowedPageIds.some((pageId) =>
    ["documents", "stocking-handbook"].includes(pageId),
  );
  const canReadAccounting = effectiveAllowedPageIds.some((pageId) =>
    ["accounting", "accounting-customers", "customer-payment-links"].includes(
      pageId,
    ),
  );
  const canReadAdmin = effectiveAllowedPageIds.some((pageId) =>
    [
      "admin",
      "user-admin",
      "email-list",
      "delivery-settings",
      "vendor-settings",
      "order-flow",
      "sales-report",
    ].includes(pageId),
  );
  const canReadFleet = effectiveAllowedPageIds.some((pageId) =>
    ["fleet", "bouncie"].includes(pageId),
  );
  const canReadEmailList = effectiveAllowedPageIds.includes("email-list");
  const canReadSalesReport = effectiveAllowedPageIds.includes("sales-report");
  const canReadSalesOrders = effectiveAllowedPageIds.includes("sales-orders");
  const canReadCustomerPaymentLinks =
    canReadAccounting &&
    effectiveAllowedPageIds.includes("customer-payment-links");
  const canReadAccountingCustomers =
    canReadAccounting && effectiveAllowedPageIds.includes("accounting-customers");
  const canReadCustomers =
    canReadSales || canReadReceiving || canReadEmailList || canReadAccounting;
  const canManageCustomerStatements =
    ["superAdmin", "admin"].includes(effectiveUserRole) ||
    effectiveAllowedPageIds.includes("accounting-customers");
  const hasDriverName = Boolean(driverName);
  const hasSouthManagementAccess = effectiveAllowedPageIds.some((pageId) =>
    [
      "supplier-runs-add",
      "their-truck-pos",
      "supplier-runs-dispatch",
      "supplier-runs-history",
      "their-truck-history",
    ].includes(pageId),
  );
  const isDriverWorkView = effectiveWorkView === "driver";
  const isSouthDriverScopedView =
    hasDriverName &&
    canReadSouth &&
    (isDriverWorkView ||
      (!["superAdmin", "admin"].includes(effectiveUserRole) &&
        !hasSouthManagementAccess));
  const isDeliveryDriverScopedView =
    hasDriverName &&
    !["superAdmin", "admin"].includes(effectiveUserRole) &&
    canReadDeliveries;
  const shouldShowDriverDashboard =
    isDriverWorkView ||
    (hasDriverName &&
      !["superAdmin", "admin"].includes(effectiveUserRole) &&
      (isSouthDriverScopedView || isDeliveryDriverScopedView));
  const southViewerRole = isSouthDriverScopedView
    ? "driver"
    : effectiveUserRole;
  const employeeAliasMap = createEmployeeAliasMap([
    ...users.filter(isActiveEmployee),
    userProfile || {},
    selectedPreviewProfile || {},
  ]);
  const visibleSupplierRuns =
    isSouthDriverScopedView
      ? supplierRuns.filter(
          (supplierRun) =>
            areEmployeeNamesEqual(
              supplierRun.driver || "",
              driverName,
              employeeAliasMap,
            ),
        )
      : supplierRuns;
  const assignedVisibleSupplierRuns = visibleSupplierRuns.filter(
    (supplierRun) =>
      supplierRun.dispatchStatus !== "needsDispatch" &&
      Boolean(supplierRun.driver),
  );
  const receivingVisibleSupplierRuns = receivingSouthLookupRuns.filter(
    (supplierRun) =>
      supplierRun.dispatchStatus !== "needsDispatch" &&
      Boolean(supplierRun.driver),
  );
  const checkBoardSupplierRuns = canReadSouth
    ? assignedVisibleSupplierRuns
    : receivingVisibleSupplierRuns;
  const southLookupSupplierRuns = canReadSouth
    ? visibleSupplierRuns
    : receivingSouthLookupRuns;
  const southAssignedLookupSupplierRuns = canReadSouth
    ? assignedVisibleSupplierRuns
    : receivingVisibleSupplierRuns;
  const driverDashboardSupplierRuns = isSouthDriverScopedView
    ? assignedVisibleSupplierRuns
    : supplierRuns;
  const visibleDeliveries =
    isDeliveryDriverScopedView
      ? deliveries
          .filter((delivery) => {
            const drivers = Array.isArray(delivery.drivers)
              ? delivery.drivers
              : [];
            const dispatchAssignments = Array.isArray(
              delivery.dispatchAssignments,
            )
              ? delivery.dispatchAssignments
              : [];

            return (
              delivery.dispatchStatus !== "needsDispatch" &&
              (areEmployeeNamesEqual(
                delivery.driver || "",
                driverName,
                employeeAliasMap,
              ) ||
                drivers.some((assignedDriver) =>
                  areEmployeeNamesEqual(
                    assignedDriver,
                    driverName,
                    employeeAliasMap,
                  ),
                ) ||
                dispatchAssignments.some(
                  (assignment) =>
                    areEmployeeNamesEqual(
                      assignment.driver || "",
                      driverName,
                      employeeAliasMap,
                    ),
                ))
            );
          })
          .map((delivery) => {
            const dispatchAssignments = Array.isArray(
              delivery.dispatchAssignments,
            )
              ? delivery.dispatchAssignments
              : [];
            const driverAssignment = dispatchAssignments.find(
              (assignment) =>
                areEmployeeNamesEqual(
                  assignment.driver || "",
                  driverName,
                  employeeAliasMap,
                ),
            );

            return {
              ...delivery,
              driver: driverName,
              vehicleId: driverAssignment?.vehicleId || delivery.vehicleId,
              vehicleTitle:
                driverAssignment?.vehicleTitle || delivery.vehicleTitle,
              vehicleBadge:
                driverAssignment?.vehicleBadge || delivery.vehicleBadge,
            };
          })
      : deliveries;
  const currentUserDisplayName =
    getProfileDisplayName(userProfile) ||
    currentUser?.displayName ||
    userProfile?.email ||
    currentUser?.email ||
    "";
  const currentUserCreator = {
    id: currentUser?.uid || userProfile?.uid || userProfile?.id || "",
    name: currentUserDisplayName,
    email: currentUser?.email || userProfile?.email || "",
  };
  const approvedEmployeeNames = getUniqueNames([
    ...users
      .filter(isActiveEmployee)
      .map(getProfileDisplayName),
    ...(isActiveEmployee(userProfile) ? [getProfileDisplayName(userProfile)] : []),
  ]);
  const currentSalesMonth = new Date().toISOString().slice(0, 7);
  const currentSalesReport = salesReports.find(
    (salesReport) => salesReport.month === currentSalesMonth,
  );
  const currentSalesTotal =
    (Number(currentSalesReport?.cashCardSales) || 0) +
    (Number(currentSalesReport?.chargeSales) || 0);
  const adminDashboardOperations = {
    receivingToday: checkIns.filter((checkIn) => {
      const checkedAt =
        typeof checkIn.checkedInAt === "string" ? checkIn.checkedInAt : "";

      return checkedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
    }).length,
    southNeedsDispatch: supplierRuns.filter(
      (supplierRun) => isUnassignedSouthRun(supplierRun),
    ).length,
    southOpen: supplierRuns.filter(
      (supplierRun) =>
        supplierRun.status !== "complete" &&
        supplierRun.dispatchStatus !== "needsDispatch" &&
        supplierRun.driver,
    ).length,
    deliveryNeedsDispatch: deliveries.filter(
      (delivery) =>
        !isDeliveryComplete(delivery) &&
        (delivery.dispatchStatus === "needsDispatch" || !delivery.driver),
    ).length,
    deliveryOpen: deliveries.filter(
      (delivery) =>
        !isDeliveryComplete(delivery) &&
        delivery.dispatchStatus !== "needsDispatch" &&
        delivery.driver,
    ).length,
    hardwareOpen: deliveries.filter(
      (delivery) =>
        !isDeliveryComplete(delivery) &&
        delivery.dispatchStatus !== "needsDispatch" &&
        delivery.driver &&
        delivery.hasHardware &&
        !delivery.hardwareChecked,
    ).length,
    yardTasksOpen: yardTasks.filter(
      (yardTask) => yardTask.status !== "complete",
    ).length,
    stockingHandbookItems: stockingHandbookItems.length,
    customerCount: customers.length,
    salesMonthTotal: currentSalesTotal,
    cashCardSales: Number(currentSalesReport?.cashCardSales) || 0,
    chargeSales: Number(currentSalesReport?.chargeSales) || 0,
  };
  const southVehicleOptions = vehicleSettings
    .map((vehicleSetting) => ({
      id: vehicleSetting.id,
      title:
        vehicleSetting.title ||
        vehicleSetting.bouncieName ||
        vehicleSetting.yearMakeModel ||
        "Vehicle",
      badge: vehicleSetting.badge || "",
    }))
    .filter((vehicleOption) => vehicleOption.id && vehicleOption.title);
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const bouncieCode = searchParams.get("code");

    if (!bouncieCode) {
      return;
    }

    const callbackUrl = new URL(
      "/api/bouncie/auth/callback",
      window.location.origin,
    );
    callbackUrl.search = window.location.search;
    window.location.replace(callbackUrl.toString());
  }, []);

  useEffect(() => {
    if (currentPage !== "supplier-runs-check") {
      return undefined;
    }

    const refreshTimer = window.setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        activeElementIsEditing() ||
        !isSouthPickupRefreshWindow()
      ) {
        return;
      }

      refreshAndRestorePage("supplier-runs-check");
    }, SOUTH_PICKUP_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [currentPage]);

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (firebaseUser) => {
      setCurrentUser(firebaseUser);
      setIsAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      setIsProfileLoading(false);
      return;
    }

    let isMounted = true;
    let unsubscribeFromUserProfile = () => {};

    setIsProfileLoading(true);

    ensureUserProfile(currentUser, SUPER_ADMIN_EMAILS)
      .then(() => {
        if (!isMounted) {
          return;
        }

        unsubscribeFromUserProfile = subscribeToUserProfile(
          currentUser.uid,
          (savedUserProfile: UserProfile | null) => {
            if (isMounted) {
              setUserProfile(savedUserProfile);
              setSyncError("");
              setIsProfileLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync user profile:", error);

            if (isMounted) {
              setSyncError(getFirebaseErrorMessage(error));
              setIsProfileLoading(false);
            }
          },
        );
      })
      .catch((error: Error) => {
        console.error("Unable to create user profile:", error);

        if (isMounted) {
          if (isSuperAdminEmail(currentUser.email)) {
            setUserProfile({
              id: currentUser.uid,
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "",
              photoURL: currentUser.photoURL || "",
              role: "superAdmin",
              status: "approved",
            });
            setSyncError("");
          } else {
            setSyncError(getFirebaseErrorMessage(error));
          }
          setIsProfileLoading(false);
        }
      });

    return () => {
      isMounted = false;
      unsubscribeFromUserProfile();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setUsers([]);
      return;
    }

    return subscribeToUsers(
      (savedUsers: UserProfile[]) => {
        setUsers(savedUsers);
        setSyncError("");
      },
      (error: Error) => {
        console.error("Unable to sync users:", error);
        reportBackgroundSyncError(error);
      },
    );
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isApproved || !canAssignSouthRoutes) {
      setVehicleSettings([]);
      return () => {};
    }

    return subscribeToBouncieVehicleSettings(
      (savedVehicleSettings: VehicleSetting[]) => {
        setVehicleSettings(savedVehicleSettings);
        setSyncError("");
      },
      (error: Error) => {
        console.error("Unable to sync vehicle settings:", error);
        reportBackgroundSyncError(error);
      },
    );
  }, [canAssignSouthRoutes, isApproved]);

  useEffect(() => {
    if (!isApproved || (!canReadDeliveries && !canReadAdmin)) {
      setDeliverySettings(defaultDeliveryScheduleSettings);
      return () => {};
    }

    return subscribeToDeliverySettings(
      (savedDeliverySettings: DeliverySettings) => {
        setDeliverySettings(savedDeliverySettings);
        setSyncError("");
      },
      (error: Error) => {
        console.error("Unable to sync delivery settings:", error);
        reportBackgroundSyncError(error);
      },
    );
  }, [canReadAdmin, canReadDeliveries, isApproved]);

  useEffect(() => {
    if (!isApproved) {
      setVendorSettings(defaultVendorSettings);
      return () => {};
    }

    return subscribeToVendorSettings(
      (savedVendorSettings: VendorSettings) => {
        setVendorSettings(savedVendorSettings);
        setSyncError("");
      },
      (error: Error) => {
        console.error("Unable to sync vendor settings:", error);
        reportBackgroundSyncError(error);
      },
    );
  }, [isApproved]);

  useEffect(() => {
    if (!isApproved || !canMaintainSouthSchedule || supplierRuns.length === 0) {
      return;
    }

    const todayDateKey = getDateInputValue();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateKey = getDateInputValue(yesterday);
    const staleUnassignedRuns = supplierRuns.filter((supplierRun) => {
      const scheduledDate =
        typeof supplierRun.scheduledDate === "string"
          ? supplierRun.scheduledDate
          : "";

      return (
        isUnassignedSouthRun(supplierRun) &&
        scheduledDate &&
        scheduledDate === yesterdayDateKey
      );
    });

    if (staleUnassignedRuns.length === 0) {
      return;
    }

    updateSupplierRunsBulk(
      staleUnassignedRuns.map((supplierRun) => ({
        id: supplierRun.id,
        scheduledDate: todayDateKey,
        rolloverFromScheduledDate:
          supplierRun.rolloverFromScheduledDate || supplierRun.scheduledDate,
        rolledOverAt: new Date().toISOString(),
      })),
    )
      .then((updatedSupplierRuns) => {
        setSupplierRuns(updatedSupplierRuns);
        setSyncError("");
      })
      .catch((error: Error) => {
        console.error("Unable to roll unassigned South POs forward:", error);
      });
  }, [canMaintainSouthSchedule, isApproved, supplierRuns]);

  useEffect(() => {
    if (
      !isApproved ||
      effectiveAllowedPageIds.length === 0 ||
      effectiveAllowedPageIds.includes(currentPage)
    ) {
      return;
    }

    try {
      sessionStorage.removeItem(REFRESH_PAGE_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }

    setCurrentPage(effectiveAllowedPageIds[0]);
  }, [currentPage, effectiveAllowedPageIds, isApproved]);

  useEffect(() => {
    if (!isApproved || !effectiveAllowedPageIds.includes(currentPage)) {
      return;
    }

    try {
      sessionStorage.removeItem(REFRESH_PAGE_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  }, [currentPage, effectiveAllowedPageIds, isApproved]);

  useEffect(() => {
    if (isAuthLoading || isProfileLoading) {
      return;
    }

    if (!currentUser || !isApproved) {
      setCheckIns([]);
      setYardTasks([]);
      setSupplierRuns([]);
      setTheirTruckPOs([]);
      setReceivingSouthLookupRuns([]);
      setDeliveries([]);
      setCustomers([]);
      setCustomerPaymentLinks([]);
      setCustomerStatements([]);
      setSalesOrders([]);
      setStockingHandbookItems([]);
      setEmailList([]);
      setSalesReports([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let isMounted = true;
    let unsubscribeFromCheckIns = () => {};
    let unsubscribeFromYardTasks = () => {};
    let unsubscribeFromSupplierRuns = () => {};
    let unsubscribeFromTheirTruckPOs = () => {};
    let unsubscribeFromReceivingSouthLookup = () => {};
    let unsubscribeFromDeliveries = () => {};
    let unsubscribeFromCustomers = () => {};
    let unsubscribeFromCustomerPaymentLinks = () => {};
    let unsubscribeFromCustomerStatements = () => {};
    let unsubscribeFromSalesOrders = () => {};
    let unsubscribeFromStockingHandbookItems = () => {};
    let unsubscribeFromEmailList = () => {};
    let unsubscribeFromSalesReports = () => {};

    async function loadCheckIns() {
      try {
        const savedCheckIns = await getCheckIns();

        if (isMounted) {
          setCheckIns(savedCheckIns);
          setSyncError("");
        }
      } catch (error) {
        console.error("Unable to load check-ins:", error);

        if (isMounted) {
          reportBackgroundSyncError(error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (isFirebaseConfigured) {
      if (canReadReceiving) {
        unsubscribeFromCheckIns = subscribeToCheckIns(
          (savedCheckIns: CheckIn[]) => {
            if (isMounted) {
              setCheckIns(savedCheckIns);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync check-ins:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
        );
        if (canReadYardTasks) {
          unsubscribeFromYardTasks = subscribeToYardTasks(
          (savedYardTasks: YardTask[]) => {
            if (isMounted) {
              setYardTasks(savedYardTasks);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync yard tasks:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
          );
        } else {
          setYardTasks([]);
        }
      } else {
        setCheckIns([]);
        setYardTasks([]);
      }

      if (canReadSouth) {
        unsubscribeFromSupplierRuns = subscribeToSupplierRuns(
          (savedSupplierRuns: SupplierRun[]) => {
            if (isMounted) {
              setSupplierRuns(savedSupplierRuns);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync supplier runs:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
          isSouthDriverScopedView ? driverNameAliases : "",
        );
      } else {
        setSupplierRuns([]);
      }

      if (canReadSouth || canReadReceiving) {
        unsubscribeFromTheirTruckPOs = subscribeToTheirTruckPOs(
          (savedTheirTruckPOs: TheirTruckPO[]) => {
            if (isMounted) {
              setTheirTruckPOs(savedTheirTruckPOs);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync Their Truck POs:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
        );
      } else {
        setTheirTruckPOs([]);
      }

      if (canReadReceiving && !canReadSouth) {
        unsubscribeFromReceivingSouthLookup = subscribeToSupplierRuns(
          (savedSupplierRuns: SupplierRun[]) => {
            if (isMounted) {
              setReceivingSouthLookupRuns(savedSupplierRuns);
            }
          },
          (error: Error) => {
            console.error(
              "Unable to sync South PO lookup for receiving:",
              error,
            );

            if (isMounted) {
              setReceivingSouthLookupRuns([]);
            }
          },
        );
      } else {
        setReceivingSouthLookupRuns([]);
      }

      if (canReadDeliveries) {
        unsubscribeFromDeliveries = subscribeToDeliveries(
          (savedDeliveries: Delivery[]) => {
            if (isMounted) {
              setDeliveries(savedDeliveries);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync deliveries:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
          isDeliveryDriverScopedView ? driverName : "",
        );
      } else {
        setDeliveries([]);
      }

      if (canReadCustomers) {
        unsubscribeFromCustomers = subscribeToCustomers(
          (savedCustomers: Customer[]) => {
            if (isMounted) {
              setCustomers(savedCustomers);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync customers:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
        );
      } else {
        setCustomers([]);
      }

      if (canReadCustomerPaymentLinks) {
        unsubscribeFromCustomerPaymentLinks = subscribeToCustomerPaymentLinks(
          (savedCustomerPaymentLinks: CustomerPaymentLink[]) => {
            if (isMounted) {
              setCustomerPaymentLinks(savedCustomerPaymentLinks);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync customer payment links:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
        );
      } else {
        setCustomerPaymentLinks([]);
      }

      if (canManageCustomerStatements) {
        unsubscribeFromCustomerStatements = subscribeToCustomerStatements(
          (savedCustomerStatements: CustomerStatement[]) => {
            if (isMounted) {
              setCustomerStatements(savedCustomerStatements);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync customer statements:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
        );
      } else {
        setCustomerStatements([]);
      }

      if (canReadSalesOrders) {
        unsubscribeFromSalesOrders = subscribeToSalesOrders(
          (savedSalesOrders: SalesOrder[]) => {
            if (isMounted) {
              setSalesOrders(savedSalesOrders);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync sales orders:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
        );
      } else {
        setSalesOrders([]);
      }

      if (canReadDocuments) {
        unsubscribeFromStockingHandbookItems =
          subscribeToStockingHandbookItems(
            (savedStockingHandbookItems: StockingHandbookItem[]) => {
              if (isMounted) {
                setStockingHandbookItems(savedStockingHandbookItems);
                setSyncError("");
                setIsLoading(false);
              }
            },
            (error: Error) => {
              console.error("Unable to sync stocking handbook items:", error);

              if (isMounted) {
                reportBackgroundSyncError(error);
                setIsLoading(false);
              }
            },
          );
      } else {
        setStockingHandbookItems([]);
      }

      if (canReadEmailList) {
        unsubscribeFromEmailList = subscribeToEmailList(
          (savedEmailList: EmailListEntry[]) => {
            if (isMounted) {
              setEmailList(savedEmailList);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync email list:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
        );
      } else {
        setEmailList([]);
      }

      if (canReadSalesReport) {
        unsubscribeFromSalesReports = subscribeToSalesReports(
          (savedSalesReports: SalesReport[]) => {
            if (isMounted) {
              setSalesReports(savedSalesReports);
              setSyncError("");
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to sync sales reports:", error);

            if (isMounted) {
              reportBackgroundSyncError(error);
              setIsLoading(false);
            }
          },
        );
      } else {
        setSalesReports([]);
      }

      if (
        !canReadReceiving &&
        !canReadSouth &&
        !canReadDeliveries &&
        !canReadCustomers &&
        !canReadCustomerPaymentLinks &&
        !canReadSales &&
        !canReadSalesOrders &&
        !canReadDocuments &&
        !canReadEmailList &&
        !canReadSalesReport
      ) {
        setIsLoading(false);
      }
    } else {
      if (canReadReceiving) {
        loadCheckIns();
        if (canReadYardTasks) {
          unsubscribeFromYardTasks = subscribeToYardTasks(
          (savedYardTasks: YardTask[]) => {
            if (isMounted) {
              setYardTasks(savedYardTasks);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load yard tasks:", error);
          },
          );
        } else {
          setYardTasks([]);
        }
      } else {
        setCheckIns([]);
        setYardTasks([]);
      }

      if (canReadSouth) {
        unsubscribeFromSupplierRuns = subscribeToSupplierRuns(
          (savedSupplierRuns: SupplierRun[]) => {
            if (isMounted) {
              setSupplierRuns(savedSupplierRuns);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load supplier runs:", error);
          },
          isSouthDriverScopedView ? driverNameAliases : "",
        );
      } else {
        setSupplierRuns([]);
      }

      if (canReadSouth || canReadReceiving) {
        unsubscribeFromTheirTruckPOs = subscribeToTheirTruckPOs(
          (savedTheirTruckPOs: TheirTruckPO[]) => {
            if (isMounted) {
              setTheirTruckPOs(savedTheirTruckPOs);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load Their Truck POs:", error);
          },
        );
      } else {
        setTheirTruckPOs([]);
      }

      if (canReadReceiving && !canReadSouth) {
        unsubscribeFromReceivingSouthLookup = subscribeToSupplierRuns(
          (savedSupplierRuns: SupplierRun[]) => {
            if (isMounted) {
              setReceivingSouthLookupRuns(savedSupplierRuns);
            }
          },
          (error: Error) => {
            console.error(
              "Unable to load South PO lookup for receiving:",
              error,
            );

            if (isMounted) {
              setReceivingSouthLookupRuns([]);
            }
          },
        );
      } else {
        setReceivingSouthLookupRuns([]);
      }

      if (canReadDeliveries) {
        subscribeToDeliveries(
          (savedDeliveries: Delivery[]) => {
            if (isMounted) {
              setDeliveries(savedDeliveries);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load deliveries:", error);
          },
        );
      } else {
        setDeliveries([]);
      }

      if (canReadCustomers) {
        subscribeToCustomers(
          (savedCustomers: Customer[]) => {
            if (isMounted) {
              setCustomers(savedCustomers);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load customers:", error);
          },
        );
      } else {
        setCustomers([]);
      }

      if (canReadCustomerPaymentLinks) {
        subscribeToCustomerPaymentLinks(
          (savedCustomerPaymentLinks: CustomerPaymentLink[]) => {
            if (isMounted) {
              setCustomerPaymentLinks(savedCustomerPaymentLinks);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load customer payment links:", error);
          },
        );
      } else {
        setCustomerPaymentLinks([]);
      }

      if (canManageCustomerStatements) {
        subscribeToCustomerStatements(
          (savedCustomerStatements: CustomerStatement[]) => {
            if (isMounted) {
              setCustomerStatements(savedCustomerStatements);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load customer statements:", error);
          },
        );
      } else {
        setCustomerStatements([]);
      }

      if (canReadSalesOrders) {
        subscribeToSalesOrders(
          (savedSalesOrders: SalesOrder[]) => {
            if (isMounted) {
              setSalesOrders(savedSalesOrders);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load sales orders:", error);
          },
        );
      } else {
        setSalesOrders([]);
      }

      if (canReadDocuments) {
        subscribeToStockingHandbookItems(
          (savedStockingHandbookItems: StockingHandbookItem[]) => {
            if (isMounted) {
              setStockingHandbookItems(savedStockingHandbookItems);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load stocking handbook items:", error);
          },
        );
      } else {
        setStockingHandbookItems([]);
      }

      if (canReadEmailList) {
        subscribeToEmailList(
          (savedEmailList: EmailListEntry[]) => {
            if (isMounted) {
              setEmailList(savedEmailList);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load email list:", error);
          },
        );
      } else {
        setEmailList([]);
      }

      if (canReadSalesReport) {
        subscribeToSalesReports(
          (savedSalesReports: SalesReport[]) => {
            if (isMounted) {
              setSalesReports(savedSalesReports);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load sales reports:", error);
          },
        );
      } else {
        setSalesReports([]);
      }
    }

    return () => {
      isMounted = false;
      unsubscribeFromCheckIns();
      unsubscribeFromYardTasks();
      unsubscribeFromSupplierRuns();
      unsubscribeFromTheirTruckPOs();
      unsubscribeFromReceivingSouthLookup();
      unsubscribeFromDeliveries();
      unsubscribeFromCustomers();
      unsubscribeFromCustomerPaymentLinks();
      unsubscribeFromCustomerStatements();
      unsubscribeFromSalesOrders();
      unsubscribeFromStockingHandbookItems();
      unsubscribeFromEmailList();
      unsubscribeFromSalesReports();
    };
  }, [
    canReadEmailList,
    canReadCustomers,
    canReadCustomerPaymentLinks,
    canReadSales,
    canReadSalesOrders,
    canReadSalesReport,
    canReadDocuments,
    canManageCustomerStatements,
    currentUser,
    canReadDeliveries,
    canReadReceiving,
    canReadYardTasks,
    canReadSouth,
    driverName,
    driverNameAliases,
    isApproved,
    isAuthLoading,
    isProfileLoading,
    currentPage,
    effectiveUserRole,
  ]);

  async function handleSignOut() {
    if (!auth) {
      return;
    }

    await signOut(auth);
    setCurrentPage("dashboard");
    setEditingDeliveryId("");
  }

  async function handleUpdateUserProfile(
    userId: string,
    updates: Partial<UserProfile>,
  ) {
    await updateUserProfile(userId, updates);
  }

  async function handleAddEmailListEntry(
    emailListEntry: EmailListEntry,
  ) {
    const updatedEmailList = await addEmailListEntry(emailListEntry);
    setEmailList(updatedEmailList);
    setSyncError("");
  }

  async function handleDeleteEmailListEntry(emailListEntryId: string) {
    const updatedEmailList =
      await deleteEmailListEntry(emailListEntryId);
    setEmailList(updatedEmailList);
    setSyncError("");
  }

  async function handleSaveSalesReport(salesReport: SalesReport) {
    const updatedSalesReports = await saveSalesReport(salesReport);
    setSalesReports(updatedSalesReports);
    setSyncError("");
  }

  async function handleSaveSalesOrder(salesOrder: SalesOrder) {
    const updatedSalesOrders = await saveSalesOrder(salesOrder);
    setSalesOrders(updatedSalesOrders);
    setSyncError("");
  }

  async function handleSaveStockingHandbookItem(
    stockingHandbookItem: StockingHandbookItem,
  ) {
    const updatedItems = await saveStockingHandbookItem(stockingHandbookItem);
    setStockingHandbookItems(updatedItems);
    setSyncError("");
  }

  async function handleDeleteStockingHandbookItem(itemId: string) {
    const updatedItems = await deleteStockingHandbookItem(itemId);
    setStockingHandbookItems(updatedItems);
    setSyncError("");
  }

  async function handleSaveYardTask(yardTask: YardTask) {
    const updatedYardTasks = await saveYardTask(yardTask);
    setYardTasks(updatedYardTasks);
    setSyncError("");
  }

  async function handleUpdateYardTask(
    yardTaskId: string,
    yardTaskUpdates: Partial<YardTask>,
  ) {
    const updatedYardTasks = await updateYardTask(
      yardTaskId,
      yardTaskUpdates,
    );
    setYardTasks(updatedYardTasks);
    setSyncError("");
  }

  async function handleDeleteYardTask(yardTaskId: string) {
    const updatedYardTasks = await deleteYardTask(yardTaskId);
    setYardTasks(updatedYardTasks);
    setSyncError("");
  }

  async function handleSaveTheirTruckPO(theirTruckPO: TheirTruckPO) {
    const updatedTheirTruckPOs = await saveTheirTruckPO(theirTruckPO);
    setTheirTruckPOs(updatedTheirTruckPOs);
    setSyncError("");
  }

  async function handleDeleteTheirTruckPO(theirTruckPOId: string) {
    const theirTruckPO = theirTruckPOs.find(
      (currentTheirTruckPO) => currentTheirTruckPO.id === theirTruckPOId,
    );
    const poNumber =
      typeof theirTruckPO?.poNumber === "string"
        ? `PO ${theirTruckPO.poNumber}`
        : "this Their Truck PO";

    if (!canDeleteRecord(poNumber)) {
      return;
    }

    const updatedTheirTruckPOs =
      await deleteTheirTruckPO(theirTruckPOId);
    setTheirTruckPOs(updatedTheirTruckPOs);
    setSyncError("");
  }

  async function handleSaveDeliverySettings(
    updatedDeliverySettings: DeliverySettings,
  ) {
    const savedDeliverySettings = await saveDeliverySettings(
      updatedDeliverySettings,
    );

    setDeliverySettings(savedDeliverySettings);
    setSyncError("");
  }

  async function handleSaveVendorSettings(
    updatedVendorSettings: VendorSettings,
  ) {
    const savedVendorSettings = await saveVendorSettings(updatedVendorSettings);

    setVendorSettings(savedVendorSettings);
    setSyncError("");
  }

  async function handleEnsureMonthlyPaymentLinks(month: string) {
    const updatedPaymentLinks = await ensureMonthlyPaymentLinks(
      customers,
      month,
      currentUserCreator,
    );

    setCustomerPaymentLinks(updatedPaymentLinks);
    setSyncError("");
  }

  async function handleUpdateCustomerPaymentLink(
    paymentLinkId: string,
    updates: Partial<CustomerPaymentLink>,
  ) {
    const updatedPaymentLinks = await updateCustomerPaymentLink(
      paymentLinkId,
      updates,
    );

    setCustomerPaymentLinks(updatedPaymentLinks);
    setSyncError("");
  }

  async function handleAddCheckIn(checkIn: CheckIn) {
    const updatedCheckIns = await addCheckIn(checkIn);
    setCheckIns(updatedCheckIns);
    setSyncError("");
  }

  async function handleUpdateAssignment(
    checkInId: string,
    orderAssignment: OrderAssignment,
  ) {
    const updatedCheckIns = await updateCheckInAssignment(
      checkInId,
      orderAssignment,
    );

    setCheckIns(updatedCheckIns);
    setSyncError("");
  }

  async function handleDeleteCheckIn(checkInId: string) {
    const checkIn = checkIns.find(
      (currentCheckIn) => currentCheckIn.id === checkInId,
    );
    const poNumber =
      typeof checkIn?.poNumber === "string"
        ? `PO ${checkIn.poNumber}`
        : "this check-in";

    if (!canDeleteRecord(poNumber)) {
      return;
    }

    const updatedCheckIns = await deleteCheckIn(checkInId);
    setCheckIns(updatedCheckIns);
    setSyncError("");
  }

  async function handleAddSupplierRun(
    supplierRun: SupplierRun,
  ) {
    const updatedSupplierRuns =
      await addSupplierRun(supplierRun);

    setSupplierRuns(updatedSupplierRuns);
    setSyncError("");
  }

  async function handleUpdateSupplierRun(
    supplierRunId: string,
    supplierRunUpdates: Partial<SupplierRun>,
  ) {
    const updatedSupplierRuns = await updateSupplierRun(
      supplierRunId,
      supplierRunUpdates,
    );

    setSupplierRuns(updatedSupplierRuns);
    setSyncError("");

    return updatedSupplierRuns;
  }

  async function handleAddDelivery(delivery: Delivery) {
    const updatedDeliveries = await addDelivery({
      ...delivery,
      dispatchStatus: delivery.driver
        ? "assigned"
        : delivery.dispatchStatus || "needsDispatch",
    });

    setDeliveries(updatedDeliveries);
    setSyncError("");
  }

  async function handleAddCustomer(customer: Customer) {
    const updatedCustomers = await addCustomer(customer);

    setCustomers(updatedCustomers);
    setSyncError("");
  }

  async function handleUpdateCustomer(
    customerId: string,
    customerUpdates: Partial<Customer>,
  ) {
    const updatedCustomers = await updateCustomer(
      customerId,
      customerUpdates,
    );

    setCustomers(updatedCustomers);
    setSyncError("");
  }

  async function handleSaveCustomerStatement(
    customerStatement: CustomerStatement,
  ) {
    const updatedCustomerStatements =
      await saveCustomerStatement(customerStatement);

    setCustomerStatements(updatedCustomerStatements);
    setSyncError("");
  }

  async function handleUpdateDelivery(
    deliveryId: string,
    deliveryUpdates: Partial<Delivery>,
  ) {
    const updatedDeliveries = await updateDelivery(
      deliveryId,
      deliveryUpdates,
    );

    setDeliveries(updatedDeliveries);
    setSyncError("");
  }

  async function handleDeleteDelivery(deliveryId: string) {
    const delivery = deliveries.find(
      (currentDelivery) => currentDelivery.id === deliveryId,
    );
    const orderLabel =
      typeof delivery?.orderNumber === "string"
        ? `order ${delivery.orderNumber}`
        : "this delivery order";

    if (!canDeleteRecord(orderLabel)) {
      return;
    }

    const updatedDeliveries = await deleteDelivery(deliveryId);

    setDeliveries(updatedDeliveries);
    setEditingDeliveryId("");
    setSyncError("");
  }

  function handleEditDelivery(deliveryId: string) {
    if (!canEditDeliveryDetails) {
      return;
    }

    setEditingDeliveryId(deliveryId);
    setCurrentPage("deliveries-add");
  }

  function handleCancelEditDelivery() {
    setEditingDeliveryId("");
  }

  function navigateToPage(pageId: string) {
    if (pageId === "deliveries-add") {
      setEditingDeliveryId("");
    }

    setCurrentPage(pageId);
  }

  function handleTraceSearch(searchValue: string) {
    setTraceInitialSearch(searchValue);
    setCurrentPage("trace");
  }

  function handleReceivingDashboardSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = receivingDashboardSearch.trim();

    if (!nextSearch) {
      return;
    }

    setTraceInitialSearch(nextSearch);
    setCurrentPage("trace");
  }

  async function handleCopyReceivingQuickPO(poNumber: string) {
    const nextPONumber = poNumber.trim();

    if (!nextPONumber || nextPONumber === "No PO") {
      return;
    }

    await copyTextToClipboard(nextPONumber);
    setCopiedReceivingQuickPO(nextPONumber);
    window.setTimeout(() => {
      setCopiedReceivingQuickPO((currentPONumber) =>
        currentPONumber === nextPONumber ? "" : currentPONumber,
      );
    }, 1600);
  }

  function handleEditSouthPOFromCalendar(supplierRunId: string) {
    setCurrentPage("supplier-runs-calendar");

    try {
      sessionStorage.setItem("dispatch-cl-edit-south-po", supplierRunId);
    } catch {
      // Ignore storage failures; calendar navigation still works.
    }
  }

  async function handleSaveSupplierRunItemPickupPhoto(
    supplierRunId: string,
    itemId: string,
    pickupPhoto: unknown,
    options: { markPickedUp?: boolean } = {},
  ) {
    const supplierRun = supplierRuns.find(
      (currentSupplierRun) =>
        currentSupplierRun.id === supplierRunId,
    );

    if (!supplierRun || !Array.isArray(supplierRun.items)) {
      return;
    }

    const updatedItems = supplierRun.items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      const existingPhotos = Array.isArray(item.pickupPhotos)
        ? item.pickupPhotos.filter(Boolean)
        : item.pickupPhoto
          ? [item.pickupPhoto]
          : [];
      const shouldMarkPickedUp =
        options.markPickedUp && !item.pickedUp;

      return {
        ...item,
        pickupPhoto,
        pickupPhotos: [...existingPhotos, pickupPhoto],
        pickedUp: shouldMarkPickedUp ? true : item.pickedUp,
        pickedUpAt: shouldMarkPickedUp
          ? new Date().toISOString()
          : item.pickedUpAt,
      };
    });

    const updatedSupplierRuns = options.markPickedUp
      ? await updateSupplierRunItems(
          supplierRunId,
          updatedItems,
          {
            status: "open",
            completedAt: null,
            stopWorkflowVersion: supplierRun.stopWorkflowVersion || 1,
          },
        )
      : await updateSupplierRunItemPhotos(
          supplierRunId,
          updatedItems,
        );

    setSupplierRuns(updatedSupplierRuns);
    setSyncError("");
  }

  async function handleArriveSupplierStop(supplierRunIds: string[]) {
    const arrivedAt = new Date().toISOString();
    const updates = supplierRunIds
      .map((supplierRunId) =>
        supplierRuns.find(
          (supplierRun) => supplierRun.id === supplierRunId,
        ),
      )
      .filter(
        (supplierRun): supplierRun is SupplierRun =>
          Boolean(supplierRun) && !supplierRun?.stopArrivedAt,
      )
      .map((supplierRun) => ({
        id: supplierRun.id,
        stopArrivedAt: arrivedAt,
      }));

    if (updates.length === 0) {
      return;
    }

    const updatedSupplierRuns = await updateSupplierRunsBulk(updates);

    setSupplierRuns(updatedSupplierRuns);
    setSyncError("");
  }

  async function handleCompleteSupplierStop(supplierRunIds: string[]) {
    const completedAt = new Date().toISOString();
    const updates = supplierRunIds
      .map((supplierRunId) =>
        supplierRuns.find(
          (supplierRun) => supplierRun.id === supplierRunId,
        ),
      )
      .filter(
        (supplierRun): supplierRun is SupplierRun =>
          Boolean(supplierRun) && !supplierRun?.stopCompletedAt,
      )
      .map((supplierRun) => ({
        id: supplierRun.id,
        stopCompletedAt: completedAt,
        status: "complete",
        completedAt,
      }));

    if (updates.length === 0) {
      return;
    }

    const updatedSupplierRuns = await updateSupplierRunsBulk(updates);

    setSupplierRuns(updatedSupplierRuns);
    setSyncError("");
  }

  async function handleUpdateSupplierRunItemDescription(
    supplierRunId: string,
    itemId: string,
    description: string,
    internalReference?: string,
    quantity?: string,
    materialUse?: string,
    orderNumber?: string,
    customerName?: string,
    returnNotes?: string,
    easilyDamaged?: boolean,
  ) {
    const supplierRun = supplierRuns.find(
      (currentSupplierRun) =>
        currentSupplierRun.id === supplierRunId,
    );

    if (!supplierRun || !Array.isArray(supplierRun.items)) {
      return;
    }

    const updatedItems = supplierRun.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            quantity:
              typeof quantity === "string" ? quantity : item.quantity,
            description,
            internalReference:
              typeof internalReference === "string"
                ? internalReference
                : item.internalReference,
            materialUse:
              typeof materialUse === "string"
                ? materialUse
                : item.materialUse,
            orderNumber:
              typeof orderNumber === "string"
                ? orderNumber
                : item.orderNumber,
            customerName:
              typeof customerName === "string"
                ? formatCustomerName(customerName)
                : item.customerName,
            returnNotes:
              typeof returnNotes === "string"
                ? returnNotes
                : item.returnNotes,
            easilyDamaged:
              typeof easilyDamaged === "boolean"
                ? easilyDamaged
                : item.easilyDamaged,
          }
        : item,
    );

    const updatedSupplierRuns =
      await updateSupplierRunItems(
        supplierRunId,
        updatedItems,
      );

    setSupplierRuns(updatedSupplierRuns);
    setSyncError("");
  }

  async function handleDeleteSupplierRun(supplierRunId: string) {
    const supplierRun = supplierRuns.find(
      (currentSupplierRun) =>
        currentSupplierRun.id === supplierRunId,
    );
    const poNumber =
      typeof supplierRun?.poNumber === "string"
        ? `PO ${supplierRun.poNumber}`
        : "this South PO";

    if (!canDeleteRecord(poNumber)) {
      return;
    }

    const updatedSupplierRuns =
      await deleteSupplierRun(supplierRunId);

    setSupplierRuns(updatedSupplierRuns);
    setSyncError("");
  }

  function renderDashboardPage(forcedWorkView = "") {
    const dashboardAllowedPageIds = effectiveAllowedPageIds;
    const dashboardWorkView = forcedWorkView || effectiveWorkView;
    const isForcedWorkView = Boolean(forcedWorkView);

    if (
      !isForcedWorkView &&
      shouldShowDriverDashboard &&
      (canReadSouth || canReadDeliveries)
    ) {
      return (
        <DriverDashboardPage
          supplierRuns={driverDashboardSupplierRuns}
          deliveries={deliveries}
          users={users}
          employeeOptions={approvedEmployeeNames}
          driverName={driverName}
          isSuperAdmin={false}
          onPageChange={navigateToPage}
        />
      );
    }

    if (
      !isForcedWorkView &&
      (dashboardWorkView === "operations" ||
        effectiveUserRole === "superAdmin" ||
        effectiveUserRole === "admin")
    ) {
      return (
        <DashboardPage
          operations={adminDashboardOperations}
          onPageChange={navigateToPage}
          allowedPageIds={dashboardAllowedPageIds}
          checkIns={checkIns}
          supplierRuns={supplierRuns}
          theirTruckPOs={theirTruckPOs}
          deliveries={deliveries}
          onTraceSearch={handleTraceSearch}
        />
      );
    }

    if (dashboardWorkView === "receiving" && canReadReceiving) {
      const todayCheckIns = checkIns.filter((checkIn) => {
        const checkedAt =
          typeof checkIn.checkedInAt === "string"
            ? checkIn.checkedInAt
            : "";

        return checkedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
      });
      const todayDateKey = new Date().toISOString().slice(0, 10);
      const receivingDashboardSouthRuns = southLookupSupplierRuns;
      const todaySouthRuns = receivingDashboardSouthRuns.filter((supplierRun) => {
        const runDate =
          typeof supplierRun.scheduledDate === "string"
            ? supplierRun.scheduledDate
            : typeof supplierRun.pickupDate === "string"
              ? supplierRun.pickupDate
              : typeof supplierRun.createdAt === "string"
                ? supplierRun.createdAt.slice(0, 10)
                : "";

        return runDate === todayDateKey;
      });
      const completedSouthRuns = receivingDashboardSouthRuns.filter(
        (supplierRun) => supplierRun.status === "complete",
      );
      const openYardTasks = yardTasks.filter(
        (yardTask) => yardTask.status !== "complete",
      );
      const receivingQuickLookupQuery = receivingDashboardSearch.trim();
      const receivingQuickLookupText = normalizeSearchText(
        receivingQuickLookupQuery,
      );
      const receivingQuickLookupNumber = normalizeSearchNumber(
        receivingQuickLookupQuery,
      );
      const quickReceivingCheckIns =
        checkIns as unknown as Array<Record<string, unknown>>;
      const receivingQuickMatches = receivingQuickLookupQuery
        ? [
            ...receivingDashboardSouthRuns.map((supplierRun) => {
              const items = Array.isArray(supplierRun.items)
                ? supplierRun.items.map((item) => item as Record<string, unknown>)
                : [];
              const recordText = [
                supplierRun.poNumber,
                supplierRun.vendor,
                supplierRun.customerName,
                supplierRun.driver,
                supplierRun.orderedBy,
                supplierRun.createdByName,
                supplierRun.supplierAddress,
                ...items.map(getLookupItemText),
              ]
                .map((value) => normalizeSearchText(value))
                .filter(Boolean)
                .join(" ");
              const recordNumberText = [
                supplierRun.poNumber,
                ...items.map(getLookupItemNumberText),
              ]
                .map((value) => normalizeSearchNumber(value))
                .filter(Boolean)
                .join(" ");
              const matchingItems = items.filter((item) => {
                const itemText = getLookupItemText(item);
                const itemNumberText = getLookupItemNumberText(item);

                return (
                  (receivingQuickLookupText &&
                    itemText.includes(receivingQuickLookupText)) ||
                  (receivingQuickLookupNumber &&
                    itemNumberText.includes(receivingQuickLookupNumber))
                );
              });

              return {
                id: `south-${supplierRun.id}`,
                source: "South",
                tone: "red",
                poNumber: supplierRun.poNumber || "No PO",
                vendor: supplierRun.vendor || "Vendor not entered",
                date: formatQuickLookupDate(
                  supplierRun.scheduledDate ||
                    supplierRun.pickupDate ||
                    supplierRun.createdAt,
                ),
                customerName: supplierRun.customerName || "",
                orderNumber:
                  items.find((item) => item.orderNumber)?.orderNumber || "",
                receivingStatus: getQuickReceivingStatusForPO(
                  quickReceivingCheckIns,
                  supplierRun.poNumber,
                  items.length,
                ),
                photos: getQuickPOPhotosForPO(
                  quickReceivingCheckIns,
                  supplierRun.poNumber,
                ),
                items,
                matchingItems,
                recordText,
                recordNumberText,
              };
            }),
            ...theirTruckPOs.map((theirTruckPO) => {
              const items = Array.isArray(theirTruckPO.items)
                ? theirTruckPO.items.map((item) => item as Record<string, unknown>)
                : [];
              const recordText = [
                theirTruckPO.poNumber,
                theirTruckPO.vendor,
                theirTruckPO.customerName,
                theirTruckPO.orderNumber,
                ...items.map(getLookupItemText),
              ]
                .map((value) => normalizeSearchText(value))
                .filter(Boolean)
                .join(" ");
              const recordNumberText = [
                theirTruckPO.poNumber,
                theirTruckPO.orderNumber,
                ...items.map(getLookupItemNumberText),
              ]
                .map((value) => normalizeSearchNumber(value))
                .filter(Boolean)
                .join(" ");
              const matchingItems = items.filter((item) => {
                const itemText = getLookupItemText(item);
                const itemNumberText = getLookupItemNumberText(item);

                return (
                  (receivingQuickLookupText &&
                    itemText.includes(receivingQuickLookupText)) ||
                  (receivingQuickLookupNumber &&
                    itemNumberText.includes(receivingQuickLookupNumber))
                );
              });

              return {
                id: `their-truck-${theirTruckPO.id}`,
                source: "Their Truck",
                tone: "blue",
                poNumber: theirTruckPO.poNumber || "No PO",
                vendor: theirTruckPO.vendor || "Vendor not entered",
                date: formatQuickLookupDate(
                  theirTruckPO.deliveryDate || theirTruckPO.createdAt,
                ),
                customerName: theirTruckPO.customerName || "",
                orderNumber: String(theirTruckPO.orderNumber || ""),
                receivingStatus: getQuickReceivingStatusForPO(
                  quickReceivingCheckIns,
                  theirTruckPO.poNumber,
                  items.length,
                ),
                photos: getQuickPOPhotosForPO(
                  quickReceivingCheckIns,
                  theirTruckPO.poNumber,
                ),
                items,
                matchingItems,
                recordText,
                recordNumberText,
              };
            }),
            ...checkIns.map((checkIn) => {
              const rawItems =
                Array.isArray(checkIn.materials)
                  ? checkIn.materials
                  : Array.isArray(checkIn.items)
                    ? checkIn.items
                    : [];
              const items = rawItems.map(
                (item) => item as Record<string, unknown>,
              );
              const recordText = [
                checkIn.poNumber,
                checkIn.vendor,
                checkIn.customerName,
                checkIn.orderNumber,
                ...items.map(getLookupItemText),
              ]
                .map((value) => normalizeSearchText(value))
                .filter(Boolean)
                .join(" ");
              const recordNumberText = [
                checkIn.poNumber,
                checkIn.orderNumber,
                ...items.map(getLookupItemNumberText),
              ]
                .map((value) => normalizeSearchNumber(value))
                .filter(Boolean)
                .join(" ");
              const matchingItems = items.filter((item) => {
                const itemText = getLookupItemText(item);
                const itemNumberText = getLookupItemNumberText(item);

                return (
                  (receivingQuickLookupText &&
                    itemText.includes(receivingQuickLookupText)) ||
                  (receivingQuickLookupNumber &&
                    itemNumberText.includes(receivingQuickLookupNumber))
                );
              });

              return {
                id: `receiving-${checkIn.id}`,
                source: "Receiving",
                tone: "slate",
                poNumber: String(checkIn.poNumber || "No PO"),
                vendor: String(checkIn.vendor || "Vendor not entered"),
                date: formatQuickLookupDate(
                  checkIn.checkedInAt || checkIn.createdAt,
                ),
                customerName: String(checkIn.customerName || ""),
                orderNumber: String(checkIn.orderNumber || ""),
                receivingStatus: {
                  key: "received",
                  label: "Checked In",
                  className: QUICK_RECEIVING_STATUS_STAMPS.received,
                },
                photos: getQuickPOPhotosForPO(
                  quickReceivingCheckIns,
                  checkIn.poNumber ||
                    checkIn.sourceSupplierRunPoNumber ||
                    checkIn.sourceTheirTruckPONumber,
                ),
                items,
                matchingItems,
                recordText,
                recordNumberText,
              };
            }),
          ]
            .filter((match) => {
              const textMatch =
                receivingQuickLookupText &&
                match.recordText.includes(receivingQuickLookupText);
              const numberMatch =
                receivingQuickLookupNumber &&
                match.recordNumberText.includes(receivingQuickLookupNumber);

              return textMatch || numberMatch;
            })
            .slice(0, 6)
        : [];

      return (
        <SectionHubPage
          title="Receiving Dashboard"
          eyebrow="Receiving"
          description="Check in incoming material, see South POs, and look up stock details."
          icon={Package}
          primaryAction={
            dashboardAllowedPageIds.includes("check-in")
              ? {
                  label: "Check In Items",
                  icon: Plus,
                  onClick: () => setCurrentPage("check-in"),
                }
              : null
          }
          stats={[
            {
              icon: ClipboardCheck,
              label: "Today",
              value: todayCheckIns.length,
              note: "Checked in",
            },
            {
              icon: Truck,
              label: "South",
              value: todaySouthRuns.length,
              note: "POs today",
            },
            {
              icon: ClipboardList,
              label: "Yard",
              value: openYardTasks.length,
              note: "Open tasks",
            },
          ]}
          statsClassName="hidden sm:grid"
          actionsClassName="grid gap-4 xl:grid-cols-2"
          actions={[
            dashboardAllowedPageIds.includes("check-in")
              ? {
                  icon: ClipboardCheck,
                  label: "Receive",
                  title: "Check In Items",
                  description:
                    "Record where material landed and attach photos or notes.",
                  metric: "+",
                  metricLabel: "PO",
                  tone: "success",
                  variant: "live",
                  onClick: () => setCurrentPage("check-in"),
                }
              : null,
            dashboardAllowedPageIds.includes("today")
              ? {
                  icon: PackageCheck,
                  label: "Received",
                  title: "View Checked In Items",
                  description:
                    "Review POs and materials that have already been checked in today.",
                  metric: todayCheckIns.length,
                  metricLabel: "Items",
                  tone: "success",
                  variant: "default",
                  onClick: () => setCurrentPage("today"),
                }
              : null,
            dashboardAllowedPageIds.includes("search")
              ? {
                  icon: History,
                  label: "History",
                  title: "Receiving History",
                  description:
                    "Search and review every checked-in PO by date, vendor, item, customer, or yard location.",
                  metric: checkIns.length,
                  metricLabel: "POs",
                  tone: "archive",
                  variant: "default",
                  onClick: () => setCurrentPage("search"),
                }
              : null,
            dashboardAllowedPageIds.includes("trace")
              ? {
                  icon: Search,
                  label: "Trace",
                  title: "Find PO Chain",
                  description:
                    "Follow a PO or order across South, Their Truck, receiving, and deliveries.",
                  metric: "→",
                  metricLabel: "Trace",
                  tone: "dispatch",
                  variant: "default",
                  onClick: () => setCurrentPage("trace"),
                }
              : null,
            dashboardAllowedPageIds.includes("supplier-runs-check") ||
            dashboardAllowedPageIds.includes("supplier-runs-calendar") ||
            dashboardAllowedPageIds.includes("south-calendar")
              ? {
                  icon: Truck,
                  label: "South Run",
                  title: "Today's South Run",
                  description:
                    "See all South POs expected back from the current route.",
                  metric: todaySouthRuns.length,
                  metricLabel: "POs",
                  tone: "marketing",
                  variant: "default",
                  onClick: () => setCurrentPage("supplier-runs-check"),
                }
              : null,
            dashboardAllowedPageIds.includes("supplier-runs-history")
              ? {
                  icon: History,
                  label: "Archive",
                  title: "South PO History",
                  description:
                    "Review completed South runs and the POs picked up on each route.",
                  metric: completedSouthRuns.length,
                  metricLabel: "Done",
                  tone: "archive",
                  variant: "quiet",
                  onClick: () => setCurrentPage("supplier-runs-history"),
                }
              : null,
            dashboardAllowedPageIds.includes("yard-tasks")
              ? {
                  icon: ClipboardList,
                  label: "Yard",
                  title: "Yard Tasks",
                  description:
                    "Keep loose yard work prioritized without a giant checklist.",
                  metric: openYardTasks.length,
                  metricLabel: "Open",
                  tone: "warning",
                  variant: "default",
                  onClick: () => setCurrentPage("yard-tasks"),
                }
              : null,
            dashboardAllowedPageIds.includes("stocking-handbook")
              ? {
                  icon: BookOpen,
                  label: "Stock Reference",
                  title: "Stocking Handbook",
                  description:
                    "Look up stocked items, lengths, and item numbers.",
                  metric: stockingHandbookItems.length,
                  metricLabel: "Items",
                  tone: "dispatch",
                  variant: "compact",
                  onClick: () => setCurrentPage("stocking-handbook"),
                }
              : null,
          ]}
        >
          {dashboardAllowedPageIds.includes("search") ? (
            <form
              onSubmit={handleReceivingDashboardSearch}
              className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                    Search for a PO
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Find PO chain
                  </h2>
                </div>
                <p className="text-sm font-semibold text-slate-500">
                  Search Their Truck POs, receiving, South runs, item, vendor, or customer.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                    strokeWidth={2.5}
                  />
                  <input
                    type="search"
                    value={receivingDashboardSearch}
                    onChange={(event) =>
                      setReceivingDashboardSearch(event.target.value)
                    }
                    placeholder="Search PO, item, vendor..."
                    className="min-h-[52px] w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-base font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!receivingDashboardSearch.trim()}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Full Lookup
                </button>
              </div>

              {receivingQuickLookupQuery ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Quick PO Matches
                    </p>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      {receivingQuickMatches.length} shown
                    </p>
                  </div>

                  {receivingQuickMatches.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {receivingQuickMatches.map((match) => {
                        const visibleItems =
                          match.matchingItems.length > 0
                            ? match.matchingItems
                            : match.items;
                        const hiddenItemCount = Math.max(
                          match.items.length - visibleItems.slice(0, 3).length,
                          0,
                        );
                        const isSouth = match.tone === "red";
                        const isTheirTruck = match.tone === "blue";
                        const isCopied =
                          copiedReceivingQuickPO === String(match.poNumber);
                        const matchPhotos = Array.isArray(match.photos)
                          ? match.photos
                          : [];

                        return (
                          <article
                            key={match.id}
                            className={`rounded-3xl border bg-white p-4 shadow-sm ${
                              isSouth
                                ? "border-red-100"
                                : isTheirTruck
                                  ? "border-blue-100"
                                  : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                      isSouth
                                        ? "bg-red-50 text-[#FC2C38]"
                                        : isTheirTruck
                                          ? "bg-blue-50 text-blue-700"
                                          : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {match.source}
                                  </span>
                                  {match.receivingStatus ? (
                                    <span
                                      className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${match.receivingStatus.className}`}
                                    >
                                      {match.receivingStatus.label}
                                    </span>
                                  ) : null}
                                  {match.date ? (
                                    <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                                      {match.date}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <h3 className="text-2xl font-black leading-none text-slate-950 sm:text-3xl">
                                    PO {match.poNumber}
                                  </h3>
                                  <button
                                    type="button"
                                    disabled={!match.poNumber || match.poNumber === "No PO"}
                                    onClick={() => {
                                      void handleCopyReceivingQuickPO(
                                        String(match.poNumber),
                                      );
                                    }}
                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                      isCopied
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                    }`}
                                    aria-label={
                                      isCopied
                                        ? `Copied PO number ${match.poNumber}`
                                        : `Copy PO number ${match.poNumber}`
                                    }
                                    title={isCopied ? "Copied" : "Copy PO"}
                                  >
                                    {isCopied ? (
                                      <Check
                                        aria-hidden="true"
                                        className="h-4 w-4"
                                        strokeWidth={3}
                                      />
                                    ) : (
                                      <Copy
                                        aria-hidden="true"
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                      />
                                    )}
                                  </button>
                                  {isCopied ? (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                                      Copied
                                    </span>
                                  ) : null}
                                  {matchPhotos.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setViewingReceivingQuickPhotos({
                                          poNumber: String(match.poNumber),
                                          photos: matchPhotos,
                                        })
                                      }
                                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                      aria-label={`View ${matchPhotos.length} photos for PO ${match.poNumber}`}
                                      title={`View ${matchPhotos.length} photos`}
                                    >
                                      <Images
                                        aria-hidden="true"
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                      />
                                      <span className="text-xs font-black">
                                        {matchPhotos.length}
                                      </span>
                                    </button>
                                  ) : null}
                                </div>
                                <p className="mt-1 truncate text-sm font-black text-slate-600">
                                  {match.vendor}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                                {match.items.length}{" "}
                                {match.items.length === 1 ? "item" : "items"}
                              </span>
                            </div>

                            {match.customerName || match.orderNumber ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {match.customerName ? (
                                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                    Customer:{" "}
                                    {formatCustomerName(
                                      String(match.customerName),
                                    )}
                                  </span>
                                ) : null}
                                {match.orderNumber ? (
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-blue-700">
                                    Order {String(match.orderNumber)}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}

                            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                              {visibleItems.length > 0 ? (
                                <ul className="space-y-2">
                                  {visibleItems.slice(0, 3).map((item, index) => {
                                    const itemLabel = getLookupItemLabel(item);

                                    return (
                                      <li
                                        key={`${match.id}-item-${index}`}
                                        className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-2 last:border-0 last:pb-0"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-sm font-black text-slate-950">
                                            {itemLabel.quantity
                                              ? `${itemLabel.quantity} `
                                              : ""}
                                            {itemLabel.description}
                                          </p>
                                          {itemLabel.itemNumber ? (
                                            <p className="mt-0.5 text-xs font-black uppercase tracking-[0.08em] text-blue-700">
                                              Item / SO #: {itemLabel.itemNumber}
                                            </p>
                                          ) : null}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="text-sm font-bold text-slate-500">
                                  No item lines saved on this PO yet.
                                </p>
                              )}

                              {hiddenItemCount > 0 ? (
                                <p className="mt-2 text-sm font-black text-blue-700">
                                  + {hiddenItemCount} more{" "}
                                  {hiddenItemCount === 1 ? "item" : "items"}
                                </p>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                      No quick PO or item matches yet. Use Full Lookup to search
                      the full PO chain.
                    </div>
                  )}
                </div>
              ) : null}

              {viewingReceivingQuickPhotos ? (
                <div
                  className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="quick-po-photos-title"
                >
                  <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                          PO Photos
                        </p>
                        <h3
                          id="quick-po-photos-title"
                          className="mt-1 text-2xl font-black text-slate-950"
                        >
                          PO {viewingReceivingQuickPhotos.poNumber}
                        </h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {viewingReceivingQuickPhotos.photos.length} saved{" "}
                          {viewingReceivingQuickPhotos.photos.length === 1
                            ? "photo"
                            : "photos"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setViewingReceivingQuickPhotos(null)}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-400 hover:text-slate-950"
                        aria-label="Close PO photos"
                      >
                        <X
                          aria-hidden="true"
                          className="h-5 w-5"
                          strokeWidth={2.5}
                        />
                      </button>
                    </div>

                    <div className="max-h-[72vh] overflow-auto bg-slate-50 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        {viewingReceivingQuickPhotos.photos.map((photo) => (
                          <figure
                            key={photo.id}
                            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                          >
                            <img
                              src={photo.dataUrl}
                              alt={`${photo.title} for PO ${viewingReceivingQuickPhotos.poNumber}`}
                              className="max-h-[520px] w-full object-contain bg-slate-950"
                            />
                            <figcaption className="border-t border-slate-200 px-4 py-3">
                              <p className="text-sm font-black text-slate-950">
                                {photo.title}
                              </p>
                              {photo.subtitle ? (
                                <p className="mt-0.5 text-xs font-bold text-slate-500">
                                  {photo.subtitle}
                                </p>
                              ) : null}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </form>
          ) : null}
        </SectionHubPage>
      );
    }

    if (dashboardWorkView === "south" && canReadSouth) {
      const needsDispatchRuns = visibleSupplierRuns.filter(
        (supplierRun) => isUnassignedSouthRun(supplierRun),
      );
      const openRuns = visibleSupplierRuns.filter(
        (supplierRun) =>
          supplierRun.status !== "complete" &&
          supplierRun.dispatchStatus !== "needsDispatch" &&
          supplierRun.driver,
      );
      const completeRuns = visibleSupplierRuns.filter(
        (supplierRun) => supplierRun.status === "complete",
      );

      return (
        <SectionHubPage
          title="South Dashboard"
          eyebrow="South"
          description="Dispatch and pickup work for South runs."
          icon={Truck}
          primaryAction={
            dashboardAllowedPageIds.includes("supplier-runs-add")
              ? {
                  label: "Add PO",
                  icon: Plus,
                  onClick: () => setCurrentPage("supplier-runs-add"),
                }
              : null
          }
          stats={[
            {
              icon: ShieldCheck,
              label: "Dispatch",
              value: needsDispatchRuns.length,
              note: "Waiting",
            },
            {
              icon: PackageCheck,
              label: "Open",
              value: openRuns.length,
              note: "POs to pick up",
            },
            {
              icon: History,
              label: "Complete",
              value: completeRuns.length,
              note: "South history",
            },
          ]}
          actions={[
            dashboardAllowedPageIds.includes("supplier-runs-dispatch")
              ? {
                  icon: ShieldCheck,
                  label: "Dispatch",
                  title: "Needs Dispatch",
                  description: "Assign driver and truck before pickup.",
                  metric: needsDispatchRuns.length,
                  metricLabel: "Waiting",
                  tone: "warning",
                  variant: "alert",
                  onClick: () => setCurrentPage("supplier-runs-dispatch"),
                }
              : null,
            dashboardAllowedPageIds.includes("supplier-runs-check")
              ? {
                  icon: PackageCheck,
                  label: "Driver Board",
                  title: "POs To Pick Up",
                  description: "Open supplier stops and item checkoffs.",
                  metric: openRuns.length,
                  metricLabel: "Open",
                  tone: "success",
                  variant: "live",
                  onClick: () => setCurrentPage("supplier-runs-check"),
                }
              : null,
            dashboardAllowedPageIds.includes("supplier-runs-calendar")
              ? {
                  icon: CalendarDays,
                  label: "Schedule",
                  title: "South Calendar",
                  description: "View scheduled South POs by route date.",
                  metric: openRuns.length,
                  metricLabel: "Scheduled",
                  tone: "dispatch",
                  variant: "default",
                  onClick: () => setCurrentPage("supplier-runs-calendar"),
                }
              : null,
            dashboardAllowedPageIds.includes("supplier-runs-history")
              ? {
                  icon: History,
                  label: "Archive",
                  title: "South History",
                  description: "Review completed South pickups.",
                  metric: completeRuns.length,
                  metricLabel: "Done",
                  tone: "archive",
                  variant: "quiet",
                  onClick: () => setCurrentPage("supplier-runs-history"),
                }
              : null,
          ]}
        />
      );
    }

    if (dashboardWorkView === "delivery" && canReadDeliveries) {
      return (
        <DeliveryDashboardPage
          deliveries={visibleDeliveries}
          allowedPageIds={dashboardAllowedPageIds}
          isDriverView={isDeliveryDriverScopedView}
          onPageChange={navigateToPage}
        />
      );
    }

    if (dashboardWorkView === "sales" && canReadSales) {
      return (
        <SectionHubPage
          title="Sales Dashboard"
          eyebrow="Sales"
          description="Quick access to PO entry, PO lookup, pricing, and stock reference."
          icon={UsersRound}
          primaryAction={
            dashboardAllowedPageIds.includes("supplier-runs-add")
              ? {
                  label: "Add South PO",
                  icon: Plus,
                  onClick: () => setCurrentPage("supplier-runs-add"),
                }
              : dashboardAllowedPageIds.includes("their-truck-pos")
                ? {
                    label: "Add Their Truck PO",
                    icon: Plus,
                    onClick: () => setCurrentPage("their-truck-pos"),
                  }
                : dashboardAllowedPageIds.includes("customers-add")
              ? {
                  label: "Add Customer",
                  icon: Plus,
                  onClick: () => setCurrentPage("customers-add"),
                }
              : null
          }
          stats={[]}
          actions={[
            dashboardAllowedPageIds.includes("supplier-runs-add")
              ? {
                  icon: Truck,
                  label: "PO Request",
                  title: "Add South PO",
                  description:
                    "Send a pickup request to dispatch for South runs.",
                  metric: "+",
                  metricLabel: "South",
                  tone: "marketing",
                  variant: "live",
                  onClick: () => setCurrentPage("supplier-runs-add"),
                }
              : null,
            dashboardAllowedPageIds.includes("their-truck-pos")
              ? {
                  icon: Warehouse,
                  label: "Vendor Truck",
                  title: "Add Their Truck PO",
                  description:
                    "Schedule a PO arriving on a supplier/vendor truck.",
                  metric: "+",
                  metricLabel: "Inbound",
                  tone: "dispatch",
                  variant: "default",
                  onClick: () => setCurrentPage("their-truck-pos"),
                }
              : null,
            dashboardAllowedPageIds.includes("sales-converter")
              ? {
                  icon: Calculator,
                  label: "Pricing",
                  title: "Pricing Converter",
                  description:
                    "Convert sheet goods, board footage, and target margins.",
                  metric: "$",
                  metricLabel: "Margin",
                  tone: "dispatch",
                  onClick: () => setCurrentPage("sales-converter"),
                }
              : null,
            dashboardAllowedPageIds.includes("stocking-handbook")
              ? {
                  icon: BookOpen,
                  label: "Stock Reference",
                  title: "Stocking Handbook",
                  description:
                    "Look up stocked items, lengths, item numbers, and notes.",
                  metric: stockingHandbookItems.length,
                  metricLabel: "Items",
                  tone: "archive",
                  onClick: () => setCurrentPage("stocking-handbook"),
                }
              : null,
            dashboardAllowedPageIds.includes("trace")
              ? {
                  icon: Search,
                  label: "Lookup",
                  title: "PO Lookup",
                  description:
                    "Search PO and order history across South, receiving, and deliveries.",
                  metric: "PO",
                  metricLabel: "Lookup",
                  tone: "success",
                  onClick: () => setCurrentPage("trace"),
                }
              : null,
          ]}
        />
      );
    }

    return (
      <DashboardPage
        operations={adminDashboardOperations}
        onPageChange={navigateToPage}
        allowedPageIds={effectiveAllowedPageIds}
        checkIns={checkIns}
        supplierRuns={southLookupSupplierRuns}
        theirTruckPOs={theirTruckPOs}
        deliveries={canReadDeliveries ? deliveries : []}
        onTraceSearch={handleTraceSearch}
      />
    );
  }

  function renderCurrentPage() {
    if (currentPage === "receiving" && canReadReceiving) {
      return renderDashboardPage("receiving");
    }

    if (currentPage === "south" && canReadSouth) {
      if (isSouthDriverScopedView) {
        return (
          <SupplierRunsPage
            mode="check"
            supplierRuns={checkBoardSupplierRuns}
            vehicleOptions={southVehicleOptions}
            employeeOptions={approvedEmployeeNames}
            vendorOptions={vendorOptions}
            supplierAddressMap={supplierAddressMap}
            vendorRouteOrder={vendorRouteOptions}
            vendorDisplayNameMap={vendorDisplayNameMap}
            employeeAliasMap={employeeAliasMap}
            viewerRole={southViewerRole}
            canReorderRoute={canAssignSouthRoutes}
            canEditSupplierRuns={canAssignSouthRoutes}
            canReadAllRouteOrders={false}
            routeOrderDriverName={driverName}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onSaveSupplierRunItemPickupPhoto={
              handleSaveSupplierRunItemPickupPhoto
            }
            onArriveSupplierStop={handleArriveSupplierStop}
            onCompleteSupplierStop={handleCompleteSupplierStop}
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
            onRefreshPage={() => refreshAndRestorePage("south")}
          />
        );
      }

      return (
        <SouthHubPage
          supplierRuns={visibleSupplierRuns}
          theirTruckPOs={theirTruckPOs}
          allowedPageIds={effectiveAllowedPageIds}
          isDriverView={isSouthDriverScopedView}
          onPageChange={navigateToPage}
        />
      );
    }

    if (currentPage === "south-overview" && canReadSouth) {
      return (
        <SouthOverviewPage
          supplierRuns={visibleSupplierRuns}
          allowedPageIds={effectiveAllowedPageIds}
          onPageChange={navigateToPage}
        />
      );
    }

    if (currentPage === "their-truck-overview" && canReadSouth) {
      return (
        <TheirTruckOverviewPage
          theirTruckPOs={theirTruckPOs}
          allowedPageIds={effectiveAllowedPageIds}
          onPageChange={navigateToPage}
        />
      );
    }

    if (currentPage === "deliveries" && canReadDeliveries) {
      return (
        <DeliveryDashboardPage
          deliveries={visibleDeliveries}
          allowedPageIds={effectiveAllowedPageIds}
          isDriverView={isDeliveryDriverScopedView}
          onPageChange={navigateToPage}
        />
      );
    }

    if (currentPage === "sales" && canReadSales) {
      return (
        <SectionHubPage
          title="Sales"
          description="Customer records, orders, and quick pricing tools."
          icon={UsersRound}
          primaryAction={
            effectiveAllowedPageIds.includes("sales-orders")
              ? {
                  label: "Add Order",
                  icon: Plus,
                  onClick: () => setCurrentPage("sales-orders"),
                }
              : null
          }
          stats={[
            {
              icon: ClipboardList,
              label: "Orders",
              value: salesOrders.length,
              note: "Linked sales orders",
            },
            {
              icon: UsersRound,
              label: "Customers",
              value: customers.length,
              note: "Saved accounts",
            },
            {
              icon: Calculator,
              label: "Converter",
              value:
                effectiveAllowedPageIds.includes("sales-converter") ? 1 : 0,
              note: "Pricing tool",
            },
          ]}
          actions={[
            effectiveAllowedPageIds.includes("customers-view")
              ? {
                  icon: Search,
                  label: "Customer Lookup",
                  title: "View Customers",
                  description: "Search customer records, account numbers, contacts, and addresses.",
                  metric: customers.length,
                  metricLabel: "Customers",
                  onClick: () => setCurrentPage("customers-view"),
                }
              : null,
            effectiveAllowedPageIds.includes("sales-orders")
              ? {
                  icon: ClipboardList,
                  label: "Orders",
                  title: "Add Orders",
                  description: "Create sales orders, attach customers, and link related PO numbers.",
                  metric: salesOrders.length,
                  metricLabel: "Orders",
                  tone: "marketing",
                  onClick: () => setCurrentPage("sales-orders"),
                }
              : null,
            effectiveAllowedPageIds.includes("sales-tools") ||
            effectiveAllowedPageIds.includes("sales-converter")
              ? {
                  icon: Calculator,
                  label: "Pricing",
                  title: "Price Converter",
                  description: "Convert panels, boards, and item pricing with margin targets.",
                  metric: "$",
                  metricLabel: "Margin",
                  tone: "dispatch",
                  onClick: () => setCurrentPage("sales-converter"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    if (currentPage === "sales-tools" && canReadSales) {
      return (
        <SectionHubPage
          title="Sales Tools"
          description="Fast pricing tools for the sales counter."
          icon={Calculator}
          stats={[
            {
              icon: Calculator,
              label: "Converter",
              value: "$",
              note: "Margin targets",
            },
          ]}
          actions={[
            effectiveAllowedPageIds.includes("sales-converter")
              ? {
                  icon: Calculator,
                  label: "Pricing",
                  title: "Converter",
                  description: "Convert panels, boards, and item pricing with margin targets.",
                  metric: "$",
                  metricLabel: "Margin",
                  tone: "marketing",
                  onClick: () => setCurrentPage("sales-converter"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    if (currentPage === "documents" && canReadDocuments) {
      return (
        <SectionHubPage
          title="Documents"
          description="Shared reference material for the yard, counter, and office."
          icon={BookOpen}
          stats={[
            {
              icon: BookOpen,
              label: "Handbook",
              value: stockingHandbookItems.length,
              note: "Stock items",
            },
          ]}
          actions={[
            effectiveAllowedPageIds.includes("stocking-handbook")
              ? {
                  icon: BookOpen,
                  label: "Stock Reference",
                  title: "Stocking Handbook",
                  description:
                    "Search stocked items, lengths, item numbers, grades, unit sizes, and notes.",
                  metric: stockingHandbookItems.length,
                  metricLabel: "Items",
                  tone: "dispatch",
                  variant: "compact",
                  onClick: () => setCurrentPage("stocking-handbook"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    if (currentPage === "accounting" && canReadAccounting) {
      return (
        <SectionHubPage
          title="Accounting"
          description="Payment link follow-up and account collection tools."
          icon={DollarSign}
          stats={[
            {
              icon: UsersRound,
              label: "Customer Statements",
              value: customerStatements.length,
              note: "Saved balances",
            },
            {
              icon: MailCheck,
              label: "Payment Links",
              value: customerPaymentLinks.filter(
                (paymentLink) =>
                  paymentLink.month === new Date().toISOString().slice(0, 7),
              ).length,
              note: "This month",
            },
          ]}
          actions={[
            canReadAccountingCustomers
              ? {
                  icon: UsersRound,
                  label: "Statements",
                  title: "Customer Statements",
                  description: "View customers with statement balances and monthly history.",
                  metric: customerStatements.length,
                  metricLabel: "Balances",
                  tone: "schedule",
                  onClick: () => setCurrentPage("accounting-customers"),
                }
              : null,
            canReadCustomerPaymentLinks
              ? {
                  icon: MailCheck,
                  label: "A/R",
                  title: "Payment Links",
                  description: "Build and check off monthly customer payment link reminders.",
                  metric: customerPaymentLinks.filter(
                    (paymentLink) =>
                      paymentLink.month === new Date().toISOString().slice(0, 7),
                  ).length,
                  metricLabel: "This Month",
                  tone: "dispatch",
                  onClick: () => setCurrentPage("customer-payment-links"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    if (currentPage === "admin" && canReadAdmin) {
      const pendingUsers = users.filter((user) => user.status === "pending");

      return (
        <SectionHubPage
          title="Admin"
          description="Control user access and email list tools."
          icon={ShieldCheck}
          stats={[
            {
              icon: UsersRound,
              label: "Users",
              value: users.length,
              note: "Known sign-ins",
            },
            {
              icon: ShieldCheck,
              label: "Pending",
              value: pendingUsers.length,
              note: "Need approval",
            },
            {
              icon: Mail,
              label: "Emails",
              value: emailList.length,
              note: "List entries",
            },
            {
              icon: Warehouse,
              label: "Vendors",
              value: activeVendors.length,
              note: "Suppliers",
            },
            ...(canReadSalesReport
              ? [
                  {
                    icon: DollarSign,
                    label: "Sales Pulse",
                    value:
                      currentSalesTotal > 0
                        ? `$${Math.round(currentSalesTotal).toLocaleString()}`
                        : "$0",
                    note: "This month",
                  },
                ]
              : []),
          ]}
          actions={[
            effectiveAllowedPageIds.includes("user-admin")
              ? {
                  icon: ShieldCheck,
                  label: "Access",
                  title: "User Access",
                  description: "Approve people, assign roles, and manage page access.",
                  metric: pendingUsers.length,
                  metricLabel: "Pending",
                  tone: pendingUsers.length > 0 ? "warning" : "dispatch",
                  onClick: () => setCurrentPage("user-admin"),
                }
              : null,
            effectiveAllowedPageIds.includes("email-list")
              ? {
                  icon: Mail,
                  label: "Marketing",
                  title: "Email List",
                  description: "Build groups, add email contacts, and export CSV lists.",
                  metric: emailList.length,
                  metricLabel: "Emails",
                  tone: "marketing",
                  onClick: () => setCurrentPage("email-list"),
                }
              : null,
            effectiveAllowedPageIds.includes("delivery-settings")
              ? {
                  icon: CalendarDays,
                  label: "Schedule",
                  title: "Delivery Settings",
                  description: "Adjust default unload times used by the delivery calendar.",
                  metric: "Min",
                  metricLabel: "Defaults",
                  tone: "dispatch",
                  onClick: () => setCurrentPage("delivery-settings"),
                }
              : null,
            effectiveAllowedPageIds.includes("vendor-settings")
              ? {
                  icon: Warehouse,
                  label: "Suppliers",
                  title: "Vendor Settings",
                  description: "Edit supplier names, addresses, and South route order.",
                  metric: activeVendors.length,
                  metricLabel: "Active",
                  tone: "dispatch",
                  onClick: () => setCurrentPage("vendor-settings"),
                }
              : null,
            effectiveAllowedPageIds.includes("order-flow") && isSuperAdmin
              ? {
                  icon: ClipboardList,
                  label: "Workflow",
                  title: "Order Flow",
                  description:
                    "Prototype the order-first flow and yard build handoff.",
                  metric: "Lab",
                  metricLabel: "Super",
                  tone: "dispatch",
                  onClick: () => setCurrentPage("order-flow"),
                }
              : null,
            canReadSalesReport
              ? {
                  icon: DollarSign,
                  label: "Reports",
                  title: "Sales Pulse",
                  description: "Monthly cash/card sales, charge sales, and top spenders.",
                  metric:
                    currentSalesTotal > 0
                      ? `$${Math.round(currentSalesTotal).toLocaleString()}`
                      : "$0",
                  metricLabel: "Month",
                  tone: "marketing",
                  onClick: () => setCurrentPage("sales-report"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    if (currentPage === "fleet" && canReadFleet) {
      return (
        <SectionHubPage
          title="Fleet"
          description="Vehicle location, Bouncie connection, truck names, and map badges."
          icon={Truck}
          stats={[
            {
              icon: Truck,
              label: "Vehicles",
              value: vehicleSettings.length,
              note: "Saved settings",
            },
          ]}
          actions={[
            effectiveAllowedPageIds.includes("bouncie")
              ? {
                  icon: Truck,
                  label: "Bouncie",
                  title: "Vehicles",
                  description: "Connect Bouncie, name trucks, and manage map badges.",
                  metric: "GPS",
                  metricLabel: "Fleet",
                  tone: "fleet",
                  onClick: () => setCurrentPage("bouncie"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    if (!effectiveAllowedPageIds.includes(currentPage)) {
      return (
        <SectionHubPage
          title="Dashboard"
          description="That page is not available for this login. Choose a section below."
          icon={Package}
          stats={[]}
          actions={[
            effectiveAllowedPageIds.includes("dashboard")
              ? {
                  icon: Package,
                  label: "Home",
                  title: "Open Dashboard",
                  description: "Return to your main dashboard.",
                  metric: "",
                  metricLabel: "Open",
                  tone: "dispatch",
                  onClick: () => setCurrentPage("dashboard"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    switch (currentPage) {
      case "dashboard":
        return renderDashboardPage();

      case "driver-dashboard":
        return (
          <DriverDashboardPage
            supplierRuns={driverDashboardSupplierRuns}
            deliveries={visibleDeliveries}
            users={users}
            employeeOptions={approvedEmployeeNames}
            driverName={driverName}
            isSuperAdmin={isSuperAdmin}
            onPageChange={navigateToPage}
          />
        );

      case "user-admin":
        return (
          <UserAdminPage
            users={users}
            currentUserProfile={userProfile}
            onUpdateUserProfile={handleUpdateUserProfile}
            onPageChange={navigateToPage}
          />
        );

      case "email-list":
        return (
          <EmailListPage
            customers={customers}
            emailList={emailList}
            onAddEmailListEntry={handleAddEmailListEntry}
            onDeleteEmailListEntry={handleDeleteEmailListEntry}
            onPageChange={navigateToPage}
          />
        );

      case "delivery-settings":
        return (
          <DeliverySettingsPage
            deliverySettings={deliverySettings}
            onSaveDeliverySettings={handleSaveDeliverySettings}
            onPageChange={navigateToPage}
          />
        );

      case "vendor-settings":
        return (
          <VendorSettingsPage
            vendorSettings={vendorSettings}
            onSaveVendorSettings={handleSaveVendorSettings}
            onPageChange={navigateToPage}
          />
        );

      case "order-flow":
        return isSuperAdmin ? <OrderFlowPage /> : null;

      case "bouncie":
        return <BounciePage onPageChange={setCurrentPage} />;

      case "yard-tasks":
        return canReadYardTasks ? (
          <YardTasksPage
            yardTasks={yardTasks}
            currentUser={currentUserCreator}
            employeeOptions={approvedEmployeeNames}
            canManageTasks={canManageYardTasks}
            onSaveTask={handleSaveYardTask}
            onUpdateTask={handleUpdateYardTask}
            onDeleteTask={handleDeleteYardTask}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "today":
        return (
          <TodayPage
            checkIns={checkIns}
            customers={customers}
            supplierRuns={southLookupSupplierRuns}
            theirTruckPOs={theirTruckPOs}
            onDeleteCheckIn={handleDeleteCheckIn}
            onUpdateAssignment={
              handleUpdateAssignment
            }
            onPageChange={navigateToPage}
          />
        );

      case "search":
        return (
          <SearchPage
            checkIns={checkIns}
            supplierRuns={southLookupSupplierRuns}
            theirTruckPOs={theirTruckPOs}
            onDeleteCheckIn={handleDeleteCheckIn}
            onUpdateAssignment={
              handleUpdateAssignment
            }
            onPageChange={setCurrentPage}
          />
        );

      case "trace":
        return (
          <TracePage
            checkIns={checkIns}
            supplierRuns={southLookupSupplierRuns}
            theirTruckPOs={theirTruckPOs}
            deliveries={canReadDeliveries ? deliveries : []}
            initialSearch={traceInitialSearch}
            onPageChange={navigateToPage}
          />
        );

      case "supplier-runs-add":
        return (
          <SupplierRunsPage
            mode="add"
            supplierRuns={supplierRuns}
            createdBy={currentUserCreator}
            vehicleOptions={southVehicleOptions}
            employeeOptions={approvedEmployeeNames}
            vendorOptions={vendorOptions}
            supplierAddressMap={supplierAddressMap}
            vendorRouteOrder={vendorRouteOptions}
            vendorDisplayNameMap={vendorDisplayNameMap}
            employeeAliasMap={employeeAliasMap}
            viewerRole={southViewerRole}
            canAssignRoute={false}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onSaveSupplierRunItemPickupPhoto={
              handleSaveSupplierRunItemPickupPhoto
            }
            onArriveSupplierStop={handleArriveSupplierStop}
            onCompleteSupplierStop={handleCompleteSupplierStop}
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
            onRefreshPage={() => refreshAndRestorePage("supplier-runs-add")}
          />
        );

      case "supplier-runs-dispatch":
        return (
          <SupplierRunsPage
            mode="dispatch"
            supplierRuns={supplierRuns}
            vehicleOptions={southVehicleOptions}
            employeeOptions={approvedEmployeeNames}
            vendorOptions={vendorOptions}
            supplierAddressMap={supplierAddressMap}
            vendorRouteOrder={vendorRouteOptions}
            vendorDisplayNameMap={vendorDisplayNameMap}
            employeeAliasMap={employeeAliasMap}
            viewerRole={southViewerRole}
            canAssignRoute
            canReorderRoute={canAssignSouthRoutes}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onSaveSupplierRunItemPickupPhoto={
              handleSaveSupplierRunItemPickupPhoto
            }
            onArriveSupplierStop={handleArriveSupplierStop}
            onCompleteSupplierStop={handleCompleteSupplierStop}
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
            onRefreshPage={() =>
              refreshAndRestorePage("supplier-runs-dispatch")
            }
          />
        );

      case "supplier-runs-check":
        return (
          <SupplierRunsPage
            mode="check"
            supplierRuns={checkBoardSupplierRuns}
            vehicleOptions={southVehicleOptions}
            employeeOptions={approvedEmployeeNames}
            vendorOptions={vendorOptions}
            supplierAddressMap={supplierAddressMap}
            vendorRouteOrder={vendorRouteOptions}
            vendorDisplayNameMap={vendorDisplayNameMap}
            employeeAliasMap={employeeAliasMap}
            viewerRole={southViewerRole}
            canReorderRoute={canAssignSouthRoutes}
            canEditSupplierRuns={canAssignSouthRoutes}
            canReadAllRouteOrders={
              !isSouthDriverScopedView && canReadSouth
            }
            routeOrderDriverName={driverName}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onSaveSupplierRunItemPickupPhoto={
              handleSaveSupplierRunItemPickupPhoto
            }
            onArriveSupplierStop={handleArriveSupplierStop}
            onCompleteSupplierStop={handleCompleteSupplierStop}
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
            onRefreshPage={() => refreshAndRestorePage("supplier-runs-check")}
          />
        );

      case "supplier-runs-calendar":
        return (
          <SupplierRunsPage
            mode="check"
            supplierRuns={checkBoardSupplierRuns}
            vehicleOptions={southVehicleOptions}
            employeeOptions={approvedEmployeeNames}
            vendorOptions={vendorOptions}
            supplierAddressMap={supplierAddressMap}
            vendorRouteOrder={vendorRouteOptions}
            vendorDisplayNameMap={vendorDisplayNameMap}
            employeeAliasMap={employeeAliasMap}
            viewerRole={southViewerRole}
            canReorderRoute={canAssignSouthRoutes}
            canEditSupplierRuns={canAssignSouthRoutes}
            canReadAllRouteOrders={
              !isSouthDriverScopedView && canReadSouth
            }
            routeOrderDriverName={driverName}
            initialCheckViewMode="calendar"
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onSaveSupplierRunItemPickupPhoto={
              handleSaveSupplierRunItemPickupPhoto
            }
            onArriveSupplierStop={handleArriveSupplierStop}
            onCompleteSupplierStop={handleCompleteSupplierStop}
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
            onRefreshPage={() =>
              refreshAndRestorePage("supplier-runs-calendar")
            }
          />
        );

      case "supplier-runs-history":
        return (
          <SupplierRunsPage
            mode="history"
            supplierRuns={southAssignedLookupSupplierRuns}
            vehicleOptions={southVehicleOptions}
            employeeOptions={approvedEmployeeNames}
            vendorOptions={vendorOptions}
            supplierAddressMap={supplierAddressMap}
            vendorRouteOrder={vendorRouteOptions}
            vendorDisplayNameMap={vendorDisplayNameMap}
            employeeAliasMap={employeeAliasMap}
            viewerRole={southViewerRole}
            canEditSupplierRuns={canAssignSouthRoutes}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onSaveSupplierRunItemPickupPhoto={
              handleSaveSupplierRunItemPickupPhoto
            }
            onArriveSupplierStop={handleArriveSupplierStop}
            onCompleteSupplierStop={handleCompleteSupplierStop}
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
            onRefreshPage={() =>
              refreshAndRestorePage("supplier-runs-history")
            }
          />
        );

      case "their-truck-pos":
        return canReadSouth ? (
          <TheirTruckPOPage
            theirTruckPOs={theirTruckPOs}
            vendorOptions={vendorOptions}
            supplierAddressMap={supplierAddressMap}
            vendorDeliveryCadenceMap={vendorDeliveryCadenceMap}
            createdBy={currentUserCreator}
            employeeOptions={approvedEmployeeNames}
            onSaveTheirTruckPO={handleSaveTheirTruckPO}
            onDeleteTheirTruckPO={handleDeleteTheirTruckPO}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "their-truck-calendar":
        return canReadSouth ? (
          <POCalendarPage
            supplierRuns={[]}
            theirTruckPOs={theirTruckPOs}
            mode="theirTruck"
            onSaveTheirTruckPO={handleSaveTheirTruckPO}
            onDeleteTheirTruckPO={handleDeleteTheirTruckPO}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "their-truck-history":
        return canReadSouth ? (
          <TheirTruckHistoryPage
            theirTruckPOs={theirTruckPOs}
            onDeleteTheirTruckPO={handleDeleteTheirTruckPO}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "south-calendar":
        return canReadSouth ? (
          <POCalendarPage
            supplierRuns={visibleSupplierRuns}
            theirTruckPOs={[]}
            mode="south"
            onEditSouthPO={handleEditSouthPOFromCalendar}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "po-calendar":
        return canReadSouth ? (
          <POCalendarPage
            supplierRuns={visibleSupplierRuns}
            theirTruckPOs={theirTruckPOs}
            mode="all"
            onEditSouthPO={handleEditSouthPOFromCalendar}
            onSaveTheirTruckPO={handleSaveTheirTruckPO}
            onDeleteTheirTruckPO={handleDeleteTheirTruckPO}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "deliveries-add":
        return (
          <DeliveriesPage
            deliveries={deliveries}
            customers={customers}
            deliverySettings={deliverySettings}
            deliveryOriginOptions={deliveryOriginOptions}
            canEditDeliveries={canEditDeliveryDetails}
            onAddDelivery={handleAddDelivery}
            onUpdateDelivery={handleUpdateDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            editingDeliveryId={editingDeliveryId}
            onEditDelivery={handleEditDelivery}
            onCancelEditDelivery={handleCancelEditDelivery}
            onPageChange={navigateToPage}
          />
        );

      case "deliveries-queue":
        return (
          <DeliveryQueuePage
            deliveries={visibleDeliveries}
            onUpdateDelivery={handleUpdateDelivery}
            canEditDeliveries={canEditDeliveryDetails}
            employeeOptions={approvedEmployeeNames}
            onEditDelivery={handleEditDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            onPageChange={navigateToPage}
            isDriverView={isDeliveryDriverScopedView}
          />
        );

      case "deliveries-dispatch":
        return (
          <DeliveryDispatchPage
            deliveries={deliveries}
            vehicleOptions={southVehicleOptions}
            employeeOptions={approvedEmployeeNames}
            deliveryOriginOptions={deliveryOriginOptions}
            canEditDeliveries={canEditDeliveryDetails}
            onUpdateDelivery={handleUpdateDelivery}
            onEditDelivery={handleEditDelivery}
            onPageChange={navigateToPage}
          />
        );

      case "deliveries-calendar":
        return (
          <DeliveryCalendarPage
            deliveries={visibleDeliveries}
            canEditDeliveries={canEditDeliveryDetails}
            onEditDelivery={handleEditDelivery}
            onUpdateDelivery={handleUpdateDelivery}
            onPageChange={navigateToPage}
          />
        );

      case "deliveries-history":
        return (
          <DeliveryHistoryPage
            deliveries={visibleDeliveries}
            onPageChange={navigateToPage}
            onUpdateDelivery={handleUpdateDelivery}
            isSuperAdmin={isSuperAdmin}
          />
        );

      case "customers-add":
        return (
          <CustomersPage
            mode="add"
            customers={customers}
            customerStatements={[]}
            canManageCustomerStatements={false}
            parentLabel="Sales"
            parentPage="sales"
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onSaveCustomerStatement={handleSaveCustomerStatement}
            onPageChange={setCurrentPage}
          />
        );

      case "customers-view":
        return (
          <CustomersPage
            mode="view"
            customers={customers}
            customerStatements={[]}
            canManageCustomerStatements={false}
            parentLabel="Sales"
            parentPage="sales"
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onSaveCustomerStatement={handleSaveCustomerStatement}
            onPageChange={setCurrentPage}
          />
        );

      case "accounting-customers":
        return (
          <CustomersPage
            mode="view"
            customers={customers}
            customerStatements={
              canManageCustomerStatements ? customerStatements : []
            }
            canManageCustomerStatements={canManageCustomerStatements}
            parentLabel="Accounting"
            parentPage="accounting"
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onSaveCustomerStatement={handleSaveCustomerStatement}
            onPageChange={setCurrentPage}
          />
        );

      case "customer-payment-links":
        return canReadCustomerPaymentLinks ? (
          <CustomerPaymentLinksPage
            customers={customers}
            paymentLinks={customerPaymentLinks}
            currentUser={currentUserCreator}
            onEnsureMonth={handleEnsureMonthlyPaymentLinks}
            onUpdatePaymentLink={handleUpdateCustomerPaymentLink}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "sales-orders":
        return canReadSalesOrders ? (
          <SalesOrdersPage
            orders={salesOrders}
            customers={customers}
            currentUser={currentUserCreator}
            onSaveOrder={handleSaveSalesOrder}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "sales-converter":
        return <SalesConverterPage onPageChange={setCurrentPage} />;

      case "documents":
        return canReadDocuments ? (
          <SectionHubPage
            title="Documents"
            description="Shared reference material for the yard, counter, and office."
            icon={BookOpen}
            stats={[
              {
                icon: BookOpen,
                label: "Handbook",
                value: stockingHandbookItems.length,
                note: "Stock items",
              },
            ]}
            actions={[
              effectiveAllowedPageIds.includes("stocking-handbook")
                ? {
                    icon: BookOpen,
                    label: "Stock Reference",
                    title: "Stocking Handbook",
                    description:
                      "Search stocked items, lengths, item numbers, grades, unit sizes, and notes.",
                    metric: stockingHandbookItems.length,
                    metricLabel: "Items",
                    tone: "dispatch",
                    variant: "compact",
                    onClick: () => setCurrentPage("stocking-handbook"),
                  }
                : null,
            ].filter(Boolean)}
          />
        ) : null;

      case "stocking-handbook":
        return canReadDocuments ? (
          <StockingHandbookPage
            items={stockingHandbookItems}
            canManage={["superAdmin", "admin"].includes(effectiveUserRole)}
            currentUser={currentUserCreator}
            onSaveItem={handleSaveStockingHandbookItem}
            onDeleteItem={handleDeleteStockingHandbookItem}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "sales-report":
        return canReadSalesReport ? (
          <SalesReportPage
            reports={salesReports}
            isSuperAdmin={isSuperAdmin}
            onSaveReport={handleSaveSalesReport}
            onPageChange={setCurrentPage}
          />
        ) : null;

      case "check-in":
      default:
        return (
          <CheckInPage
            onAddCheckIn={handleAddCheckIn}
            onViewToday={() =>
              setCurrentPage("today")
            }
            onPageChange={setCurrentPage}
            vendorOptions={vendorOptions}
            supplierRuns={southLookupSupplierRuns}
            theirTruckPOs={theirTruckPOs}
            checkedInByDefault={currentUserDisplayName}
            teamMemberOptions={approvedEmployeeNames}
          />
        );
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5]">
      <PullToRefresh />

      {isAuthLoading || isProfileLoading ? (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
            Loading login...
          </div>
        </div>
      ) : !currentUser ? (
        <LoginPage />
      ) : !isApproved ? (
        <PendingApproval
          currentUser={currentUser}
          userProfile={userProfile}
          syncError={syncError}
          onSignOut={handleSignOut}
        />
      ) : (
        <>
          <AppHeader
            currentPage={currentPage}
            onPageChange={navigateToPage}
            currentUser={currentUser}
            currentUserProfile={userProfile}
            effectiveUserRole={effectiveUserRole}
            allowedPageIds={effectiveAllowedPageIds}
            isDriverView={isSouthDriverScopedView || isDeliveryDriverScopedView}
            isSuperAdmin={isSuperAdmin}
            previewUsers={dashboardPreviewUsers}
            selectedPreviewUserId={
              selectedPreviewProfile?.uid ||
              selectedPreviewProfile?.id ||
              selectedPreviewProfile?.email ||
              ""
            }
            onPreviewUserChange={(nextPreviewUserId: string) => {
              setPreviewUserId(nextPreviewUserId);
              setCurrentPage("dashboard");
            }}
            onSignOut={handleSignOut}
          />

          <main className="md:pl-72">
            <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
              {!isFirebaseConfigured ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  Firebase is not configured yet. Add your Vite
                  Firebase environment values to use Firestore.
                </div>
              ) : null}

              {syncError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {syncError}
                </div>
              ) : null}

              {isLoading ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                  Loading records...
                </div>
              ) : null}
            </div>

            {renderCurrentPage()}
          </main>
        </>
      )}
    </div>
  );
}
