import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  Calculator,
  ClipboardCheck,
  DollarSign,
  History,
  Mail,
  MailCheck,
  Package,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";
import AppHeader from "./components/AppHeader";
import SectionHubPage from "./components/SectionHubPage";
import BounciePage from "./pages/BounciePage";
import CheckInPage from "./pages/CheckInPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerPaymentLinksPage from "./pages/CustomerPaymentLinksPage";
import DashboardPage from "./pages/DashboardPage";
import DriverDashboardPage from "./pages/DriverDashboardPage";
import DeliveryHistoryPage from "./pages/DeliveryHistoryPage";
import DeliveryQueuePage from "./pages/DeliveryQueuePage";
import DeliveriesPage from "./pages/DeliveriesPage";
import EmailListPage from "./pages/EmailListPage";
import LoginPage from "./components/LoginPage";
import SearchPage from "./pages/SearchPage";
import SalesConverterPage from "./pages/SalesConverterPage";
import SalesReportPage from "./pages/SalesReportPage";
import SouthHubPage from "./pages/SouthHubPage";
import SupplierRunsPage from "./pages/SupplierRunsPage";
import TodayPage from "./pages/TodayPage";
import UserAdminPage from "./pages/UserAdminPage";
import {
  addCheckIn,
  deleteCheckIn,
  getCheckIns,
  subscribeToCheckIns,
  updateCheckInAssignment,
} from "./utils/checkInStorage";
import { getFirebaseErrorMessage } from "./utils/firebaseErrorMessages";
import { auth, isFirebaseConfigured } from "./utils/firebase";
import {
  addSupplierRun,
  deleteSupplierRun,
  subscribeToSupplierRuns,
  updateSupplierRun,
  updateSupplierRunItems,
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
import { subscribeToBouncieVehicleSettings } from "./utils/bouncieVehicleStorage";

const DELETE_PO_CODE = "3105";
const SUPER_ADMIN_EMAILS = ["travis@capitallumber.co"];

type UserProfile = {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  permissions?: string[];
  status?: string;
  driverName?: string;
  approvedAt?: string | null;
  approvedBy?: string;
  [key: string]: unknown;
};

type CheckIn = {
  id: string;
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
  returnNotes?: string;
  pickedUp: boolean;
  pickedUpAt?: string | null;
  pickupPhoto?: unknown | null;
};

type SupplierRun = {
  id: string;
  poNumber?: string;
  vendor?: string;
  scheduledDate?: string;
  orderedBy?: string;
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
  unloadType: string;
  hasHardware?: boolean;
  hardwareChecked?: boolean;
  deliveryLocationNotes?: string;
  generalNotes?: string;
  deliveryNotes?: string;
  items: DeliveryItem[];
  deliveryPhoto?: unknown | null;
  hardwarePhoto?: unknown | null;
  deliveredAt?: string;
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

function getAllowedPageIdsForRole(role: string) {
  if (role === "superAdmin") {
    return [
      "dashboard",
      "driver-dashboard",
      "receiving",
      "check-in",
      "today",
      "search",
      "south",
      "supplier-runs-add",
      "supplier-runs-dispatch",
      "supplier-runs-check",
      "supplier-runs-history",
      "deliveries",
      "deliveries-add",
      "deliveries-queue",
      "deliveries-history",
      "sales",
      "customers-add",
      "customers-view",
      "customer-payment-links",
      "sales-converter",
      "sales-report",
      "fleet",
      "admin",
      "user-admin",
      "email-list",
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
      "south",
      "supplier-runs-add",
      "supplier-runs-dispatch",
      "supplier-runs-check",
      "supplier-runs-history",
      "deliveries",
      "deliveries-add",
      "deliveries-queue",
      "deliveries-history",
      "sales",
      "customers-add",
      "customers-view",
      "customer-payment-links",
      "sales-converter",
      "sales-report",
      "admin",
      "email-list",
    ];
  }

  if (role === "receiving") {
    return ["dashboard", "receiving", "check-in", "today", "search"];
  }

  if (role === "south") {
    return [
      "dashboard",
      "south",
      "supplier-runs-add",
      "supplier-runs-dispatch",
      "supplier-runs-check",
      "supplier-runs-history",
    ];
  }

  if (role === "delivery") {
    return [
      "dashboard",
      "deliveries",
      "deliveries-queue",
      "deliveries-history",
    ];
  }

  if (role === "sales") {
    return [
      "dashboard",
      "south",
      "supplier-runs-add",
      "sales",
      "customers-add",
      "customers-view",
      "customer-payment-links",
      "sales-converter",
    ];
  }

  if (role === "driver") {
    return [
      "dashboard",
      "south",
      "supplier-runs-check",
      "deliveries",
      "deliveries-queue",
    ];
  }

  return [];
}

function getAllowedPageIds(
  role: string,
  permissions?: unknown,
) {
  if (role === "superAdmin") {
    return getAllowedPageIdsForRole(role);
  }

  if (Array.isArray(permissions) && permissions.length > 0) {
    return [
      "dashboard",
      ...permissions.filter(
        (permission): permission is string =>
          typeof permission === "string" &&
          !["fleet", "bouncie"].includes(permission),
      ),
    ].filter((pageId, index, pageIds) => pageIds.indexOf(pageId) === index);
  }

  return getAllowedPageIdsForRole(role);
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

export default function App() {
  const [currentPage, setCurrentPage] =
    useState("dashboard");
  const [previewUserId, setPreviewUserId] =
    useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] =
    useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [supplierRuns, setSupplierRuns] = useState<
    SupplierRun[]
  >([]);
  const [deliveries, setDeliveries] = useState<
    Delivery[]
  >([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPaymentLinks, setCustomerPaymentLinks] = useState<
    CustomerPaymentLink[]
  >([]);
  const [emailList, setEmailList] = useState<EmailListEntry[]>([]);
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);
  const [vehicleSettings, setVehicleSettings] = useState<VehicleSetting[]>([]);
  const [editingDeliveryId, setEditingDeliveryId] =
    useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState("");

  const userRole = getUserRole(userProfile, currentUser?.email);
  const isSuperAdmin = userRole === "superAdmin";
  const isApproved =
    isSuperAdmin || userProfile?.status === "approved";
  const allowedPageIds = useMemo(
    () => getAllowedPageIds(userRole, userProfile?.permissions),
    [userRole, userProfile?.permissions],
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
              currentUser?.displayName || userProfile?.displayName || "",
            role: userRole,
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
    ? getUserRole(selectedPreviewProfile, selectedPreviewProfile?.email)
    : userRole;
  const effectiveAllowedPageIds = isSuperAdmin
    ? getAllowedPageIds(effectiveUserRole, selectedPreviewProfile?.permissions)
    : allowedPageIds;
  const driverName = isSuperAdmin
    ? selectedPreviewProfile?.driverName || ""
    : userProfile?.driverName || "";
  const canReadReceiving = effectiveAllowedPageIds.some((pageId) =>
    ["receiving", "check-in", "today", "search"].includes(pageId),
  );
  const canReadSouth = effectiveAllowedPageIds.some((pageId) =>
    [
      "south",
      "supplier-runs-add",
      "supplier-runs-dispatch",
      "supplier-runs-check",
      "supplier-runs-history",
    ].includes(pageId),
  );
  const canAssignSouthRoutes = effectiveAllowedPageIds.includes(
    "supplier-runs-dispatch",
  );
  const canReadDeliveries = effectiveAllowedPageIds.some((pageId) =>
    [
      "deliveries",
      "deliveries-add",
      "deliveries-queue",
      "deliveries-history",
    ].includes(pageId),
  );
  const canReadSales = effectiveAllowedPageIds.some((pageId) =>
    [
      "sales",
      "customers-add",
      "customers-view",
      "customer-payment-links",
      "sales-converter",
      "sales-report",
    ].includes(pageId),
  );
  const canReadAdmin = effectiveAllowedPageIds.some((pageId) =>
    ["admin", "user-admin", "email-list"].includes(pageId),
  );
  const canReadFleet = effectiveAllowedPageIds.some((pageId) =>
    ["fleet", "bouncie"].includes(pageId),
  );
  const canReadEmailList = effectiveAllowedPageIds.includes("email-list");
  const canReadSalesReport = effectiveAllowedPageIds.includes("sales-report");
  const canReadCustomerPaymentLinks = effectiveAllowedPageIds.includes(
    "customer-payment-links",
  );
  const canReadCustomers = canReadSales || canReadReceiving || canReadEmailList;
  const visibleSupplierRuns =
    effectiveUserRole === "driver"
      ? supplierRuns.filter(
          (supplierRun) => supplierRun.driver === driverName,
        )
      : supplierRuns;
  const assignedVisibleSupplierRuns = visibleSupplierRuns.filter(
    (supplierRun) =>
      supplierRun.dispatchStatus !== "needsDispatch" &&
      Boolean(supplierRun.driver),
  );
  const visibleDeliveries =
    effectiveUserRole === "driver"
      ? deliveries.filter((delivery) => delivery.driver === driverName)
      : deliveries;
  const currentUserDisplayName =
    currentUser?.displayName ||
    userProfile?.displayName ||
    currentUser?.email ||
    userProfile?.email ||
    "";
  const currentUserCreator = {
    id: currentUser?.uid || userProfile?.uid || userProfile?.id || "",
    name: currentUserDisplayName,
    email: currentUser?.email || userProfile?.email || "",
  };
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
      (supplierRun) =>
        supplierRun.status !== "complete" &&
        (supplierRun.dispatchStatus === "needsDispatch" ||
          !supplierRun.driver),
    ).length,
    southOpen: supplierRuns.filter(
      (supplierRun) =>
        supplierRun.status !== "complete" &&
        supplierRun.dispatchStatus !== "needsDispatch" &&
        supplierRun.driver,
    ).length,
    deliveryOpen: deliveries.filter(
      (delivery) => delivery.status !== "complete",
    ).length,
    hardwareOpen: deliveries.filter(
      (delivery) =>
        delivery.status !== "complete" &&
        delivery.hasHardware &&
        !delivery.hardwareChecked,
    ).length,
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
        setSyncError(getFirebaseErrorMessage(error));
      },
    );
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isApproved || !canAssignSouthRoutes) {
      setVehicleSettings([]);
      return;
    }

    return subscribeToBouncieVehicleSettings(
      (savedVehicleSettings: VehicleSetting[]) => {
        setVehicleSettings(savedVehicleSettings);
        setSyncError("");
      },
      (error: Error) => {
        console.error("Unable to sync vehicle settings:", error);
        setSyncError(getFirebaseErrorMessage(error));
      },
    );
  }, [canAssignSouthRoutes, isApproved]);

  useEffect(() => {
    if (
      !isApproved ||
      effectiveAllowedPageIds.length === 0 ||
      effectiveAllowedPageIds.includes(currentPage)
    ) {
      return;
    }

    setCurrentPage(effectiveAllowedPageIds[0]);
  }, [currentPage, effectiveAllowedPageIds, isApproved]);

  useEffect(() => {
    if (isAuthLoading || isProfileLoading) {
      return;
    }

    if (!currentUser || !isApproved) {
      setCheckIns([]);
      setSupplierRuns([]);
      setDeliveries([]);
      setCustomers([]);
      setCustomerPaymentLinks([]);
      setEmailList([]);
      setSalesReports([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let isMounted = true;
    let unsubscribeFromCheckIns = () => {};
    let unsubscribeFromSupplierRuns = () => {};
    let unsubscribeFromDeliveries = () => {};
    let unsubscribeFromCustomers = () => {};
    let unsubscribeFromCustomerPaymentLinks = () => {};
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
          setSyncError(getFirebaseErrorMessage(error));
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
              setSyncError(getFirebaseErrorMessage(error));
              setIsLoading(false);
            }
          },
        );
      } else {
        setCheckIns([]);
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
              setSyncError(getFirebaseErrorMessage(error));
              setIsLoading(false);
            }
          },
          effectiveUserRole === "driver" ? driverName : "",
        );
      } else {
        setSupplierRuns([]);
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
              setSyncError(getFirebaseErrorMessage(error));
              setIsLoading(false);
            }
          },
          effectiveUserRole === "driver" ? driverName : "",
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
              setSyncError(getFirebaseErrorMessage(error));
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
              setSyncError(getFirebaseErrorMessage(error));
              setIsLoading(false);
            }
          },
        );
      } else {
        setCustomerPaymentLinks([]);
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
              setSyncError(getFirebaseErrorMessage(error));
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
              setSyncError(getFirebaseErrorMessage(error));
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
        !canReadEmailList &&
        !canReadSalesReport
      ) {
        setIsLoading(false);
      }
    } else {
      if (canReadReceiving) {
        loadCheckIns();
      } else {
        setCheckIns([]);
      }

      if (canReadSouth) {
        subscribeToSupplierRuns(
          (savedSupplierRuns: SupplierRun[]) => {
            if (isMounted) {
              setSupplierRuns(savedSupplierRuns);
              setIsLoading(false);
            }
          },
          (error: Error) => {
            console.error("Unable to load supplier runs:", error);
          },
        );
      } else {
        setSupplierRuns([]);
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
      unsubscribeFromSupplierRuns();
      unsubscribeFromDeliveries();
      unsubscribeFromCustomers();
      unsubscribeFromCustomerPaymentLinks();
      unsubscribeFromEmailList();
      unsubscribeFromSalesReports();
    };
  }, [
    canReadEmailList,
    canReadCustomers,
    canReadCustomerPaymentLinks,
    canReadSalesReport,
    currentUser,
    canReadDeliveries,
    canReadReceiving,
    canReadSouth,
    driverName,
    isApproved,
    isAuthLoading,
    isProfileLoading,
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
    const updatedDeliveries = await addDelivery(delivery);

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
    setEditingDeliveryId(deliveryId);
    setCurrentPage("deliveries-add");
  }

  function handleCancelEditDelivery() {
    setEditingDeliveryId("");
  }

  async function handleToggleSupplierRunItem(
    supplierRunId: string,
    itemId: string,
    pickupPhoto?: unknown,
  ) {
    const supplierRun = supplierRuns.find(
      (currentSupplierRun) =>
        currentSupplierRun.id === supplierRunId,
    );

    if (!supplierRun || !Array.isArray(supplierRun.items)) {
      return;
    }

    const checkedAt = new Date().toISOString();

    const updatedItems = supplierRun.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            pickedUp: !item.pickedUp,
            pickedUpAt: !item.pickedUp ? checkedAt : null,
            pickupPhoto: !item.pickedUp ? pickupPhoto : null,
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

  async function handleUpdateSupplierRunItemDescription(
    supplierRunId: string,
    itemId: string,
    description: string,
    internalReference?: string,
    quantity?: string,
    materialUse?: string,
    orderNumber?: string,
    returnNotes?: string,
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
            returnNotes:
              typeof returnNotes === "string"
                ? returnNotes
                : item.returnNotes,
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

  function renderDashboardPage() {
    const dashboardRole = effectiveUserRole;
    const dashboardAllowedPageIds = effectiveAllowedPageIds;

    if (dashboardRole === "driver") {
      return (
        <DriverDashboardPage
          supplierRuns={supplierRuns}
          deliveries={deliveries}
          users={users}
          driverName={driverName}
          isSuperAdmin={false}
          onPageChange={setCurrentPage}
        />
      );
    }

    if (dashboardRole === "superAdmin" || dashboardRole === "admin") {
      return (
        <DashboardPage
          operations={adminDashboardOperations}
          onPageChange={setCurrentPage}
          allowedPageIds={dashboardAllowedPageIds}
        />
      );
    }

    if (dashboardRole === "receiving") {
      const todayCheckIns = checkIns.filter((checkIn) => {
        const checkedAt =
          typeof checkIn.checkedInAt === "string"
            ? checkIn.checkedInAt
            : "";

        return checkedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
      });

      return (
        <SectionHubPage
          title="Receiving Dashboard"
          eyebrow="Receiving"
          description="The receiving work this account can open."
          icon={Package}
          primaryAction={
            dashboardAllowedPageIds.includes("check-in")
              ? {
                  label: "Check In PO",
                  icon: Plus,
                  onClick: () => setCurrentPage("dashboard"),
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
              icon: Search,
              label: "Records",
              value: checkIns.length,
              note: "Searchable POs",
            },
            {
              icon: Package,
              label: "Photos",
              value: checkIns.filter((checkIn) =>
                Array.isArray(checkIn.materials)
                  ? checkIn.materials.some((material) => material.locationPhoto)
                  : false,
              ).length,
              note: "With material photos",
            },
          ]}
          actions={[
            dashboardAllowedPageIds.includes("today")
              ? {
                  icon: ClipboardCheck,
                  label: "Daily Board",
                  title: "Today's Check-Ins",
                  description: "Review what has been checked in today.",
                  metric: todayCheckIns.length,
                  metricLabel: "Today",
                  tone: "success",
                  onClick: () => setCurrentPage("today"),
                }
              : null,
            dashboardAllowedPageIds.includes("search")
              ? {
                  icon: Search,
                  label: "Lookup",
                  title: "Search POs",
                  description: "Find receiving records by PO, customer, vendor, item, or location.",
                  metric: checkIns.length,
                  metricLabel: "Records",
                  tone: "archive",
                  onClick: () => setCurrentPage("search"),
                }
              : null,
          ]}
        />
      );
    }

    if (dashboardRole === "south") {
      const needsDispatchRuns = supplierRuns.filter(
        (supplierRun) =>
          supplierRun.status !== "complete" &&
          (supplierRun.dispatchStatus === "needsDispatch" ||
            !supplierRun.driver),
      );
      const openRuns = supplierRuns.filter(
        (supplierRun) =>
          supplierRun.status !== "complete" &&
          supplierRun.dispatchStatus !== "needsDispatch" &&
          supplierRun.driver,
      );
      const completeRuns = supplierRuns.filter(
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
                  tone: "dispatch",
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
                  onClick: () => setCurrentPage("supplier-runs-check"),
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
                  onClick: () => setCurrentPage("supplier-runs-history"),
                }
              : null,
          ]}
        />
      );
    }

    if (dashboardRole === "delivery") {
      const openDeliveries = deliveries.filter(
        (delivery) => delivery.status !== "complete",
      );
      const completedDeliveries = deliveries.filter(
        (delivery) => delivery.status === "complete",
      );
      const hardwareOpen = openDeliveries.filter(
        (delivery) => delivery.hasHardware && !delivery.hardwareChecked,
      );

      return (
        <SectionHubPage
          title="Delivery Dashboard"
          eyebrow="Deliveries"
          description="Delivery work and completed order history."
          icon={Truck}
          stats={[
            {
              icon: PackageCheck,
              label: "Open",
              value: openDeliveries.length,
              note: "To be delivered",
            },
            {
              icon: Package,
              label: "Hardware",
              value: hardwareOpen.length,
              note: "Needs checkoff",
            },
            {
              icon: History,
              label: "Completed",
              value: completedDeliveries.length,
              note: "Delivery history",
            },
          ]}
          actions={[
            dashboardAllowedPageIds.includes("deliveries-queue")
              ? {
                  icon: PackageCheck,
                  label: "Live Queue",
                  title: "To Be Delivered",
                  description: "Open assigned orders, photos, reminders, and directions.",
                  metric: openDeliveries.length,
                  metricLabel: "Open",
                  tone: hardwareOpen.length > 0 ? "warning" : "success",
                  onClick: () => setCurrentPage("deliveries-queue"),
                }
              : null,
            dashboardAllowedPageIds.includes("deliveries-history")
              ? {
                  icon: History,
                  label: "Archive",
                  title: "Delivery History",
                  description: "Search and review completed deliveries.",
                  metric: completedDeliveries.length,
                  metricLabel: "Done",
                  tone: "archive",
                  onClick: () => setCurrentPage("deliveries-history"),
                }
              : null,
          ]}
        />
      );
    }

    if (dashboardRole === "sales") {
      return (
        <SectionHubPage
          title="Sales Dashboard"
          eyebrow="Sales"
          description="Customer records and pricing tools for sales work."
          icon={UsersRound}
          primaryAction={
            dashboardAllowedPageIds.includes("customers-add")
              ? {
                  label: "Add Customer",
                  icon: Plus,
                  onClick: () => setCurrentPage("customers-add"),
                }
              : null
          }
          stats={[
            {
              icon: UsersRound,
              label: "Customers",
              value: customers.length,
              note: "Saved accounts",
            },
            {
              icon: Calculator,
              label: "Tools",
              value: dashboardAllowedPageIds.includes("sales-converter") ? 1 : 0,
              note: "Pricing converter",
            },
          ]}
          actions={[
            dashboardAllowedPageIds.includes("customers-view")
              ? {
                  icon: Search,
                  label: "Customer Lookup",
                  title: "View Customers",
                  description: "Search customer records and contacts.",
                  metric: customers.length,
                  metricLabel: "Customers",
                  onClick: () => setCurrentPage("customers-view"),
                }
              : null,
            dashboardAllowedPageIds.includes("sales-converter")
              ? {
                  icon: Calculator,
                  label: "Pricing",
                  title: "Converter",
                  description: "Convert sheets, boards, and item pricing.",
                  metric: "$",
                  metricLabel: "Margin",
                  onClick: () => setCurrentPage("sales-converter"),
                }
              : null,
          ]}
        />
      );
    }

    return (
      <DashboardPage
        operations={adminDashboardOperations}
        onPageChange={setCurrentPage}
      />
    );
  }

  function renderCurrentPage() {
    if (currentPage === "receiving" && canReadReceiving) {
      const todayCheckIns = checkIns.filter((checkIn) => {
        const checkedAt =
          typeof checkIn.checkedInAt === "string"
            ? checkIn.checkedInAt
            : "";

        return checkedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
      });

      return (
        <SectionHubPage
          title="Receiving"
          description="Check in vendor POs, review today's work, and search past receiving records."
          icon={Package}
          primaryAction={
            effectiveAllowedPageIds.includes("check-in")
              ? {
                  label: "Check In PO",
                  icon: Plus,
                  onClick: () => setCurrentPage("dashboard"),
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
              icon: Search,
              label: "Records",
              value: checkIns.length,
              note: "Searchable POs",
            },
            {
              icon: Package,
              label: "Photos",
              value: checkIns.filter((checkIn) =>
                Array.isArray(checkIn.materials)
                  ? checkIn.materials.some((material) => material.locationPhoto)
                  : false,
              ).length,
              note: "With material photos",
            },
          ]}
          actions={[
            effectiveAllowedPageIds.includes("today")
              ? {
                  icon: ClipboardCheck,
                  label: "Daily Board",
                  title: "Today's Check-Ins",
                  description: "Review what has been checked in today.",
                  metric: todayCheckIns.length,
                  metricLabel: "Today",
                  tone: "success",
                  onClick: () => setCurrentPage("today"),
                }
              : null,
            effectiveAllowedPageIds.includes("search")
              ? {
                  icon: Search,
                  label: "Lookup",
                  title: "Search POs",
                  description: "Find receiving records by PO, customer, vendor, item, or location.",
                  metric: checkIns.length,
                  metricLabel: "Records",
                  tone: "archive",
                  onClick: () => setCurrentPage("search"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    if (currentPage === "south" && canReadSouth) {
      return (
        <SouthHubPage
          supplierRuns={visibleSupplierRuns}
          allowedPageIds={effectiveAllowedPageIds}
          onPageChange={setCurrentPage}
        />
      );
    }

    if (currentPage === "deliveries" && canReadDeliveries) {
      const openDeliveries = visibleDeliveries.filter(
        (delivery) => delivery.status !== "complete",
      );
      const completedDeliveries = visibleDeliveries.filter(
        (delivery) => delivery.status === "complete",
      );
      const hardwareOpen = openDeliveries.filter(
        (delivery) => delivery.hasHardware && !delivery.hardwareChecked,
      );

      return (
        <SectionHubPage
          title="Deliveries"
          description="Create delivery orders, track driver work, and review completed deliveries."
          icon={Truck}
          primaryAction={
            effectiveAllowedPageIds.includes("deliveries-add")
              ? {
                  label: "Add Delivery",
                  icon: Plus,
                  onClick: () => setCurrentPage("deliveries-add"),
                }
              : null
          }
          stats={[
            {
              icon: PackageCheck,
              label: "Open",
              value: openDeliveries.length,
              note: "To be delivered",
            },
            {
              icon: Package,
              label: "Hardware",
              value: hardwareOpen.length,
              note: "Needs checkoff",
            },
            {
              icon: History,
              label: "Completed",
              value: completedDeliveries.length,
              note: "Delivery history",
            },
          ]}
          actions={[
            effectiveAllowedPageIds.includes("deliveries-queue")
              ? {
                  icon: PackageCheck,
                  label: "Live Queue",
                  title: "To Be Delivered",
                  description: "Open assigned orders, photo capture, hardware reminders, and directions.",
                  metric: openDeliveries.length,
                  metricLabel: "Open",
                  tone: hardwareOpen.length > 0 ? "warning" : "success",
                  onClick: () => setCurrentPage("deliveries-queue"),
                }
              : null,
            effectiveAllowedPageIds.includes("deliveries-history")
              ? {
                  icon: History,
                  label: "Archive",
                  title: "Delivery History",
                  description: "Search and review completed delivery records.",
                  metric: completedDeliveries.length,
                  metricLabel: "Complete",
                  tone: "archive",
                  onClick: () => setCurrentPage("deliveries-history"),
                }
              : null,
          ].filter(Boolean)}
        />
      );
    }

    if (currentPage === "sales" && canReadSales) {
      return (
        <SectionHubPage
          title="Sales"
          description="Manage customers, build email lists, and use quick pricing tools."
          icon={UsersRound}
          primaryAction={
            effectiveAllowedPageIds.includes("customers-add")
              ? {
                  label: "Add Customer",
                  icon: Plus,
                  onClick: () => setCurrentPage("customers-add"),
                }
              : null
          }
          stats={[
            {
              icon: UsersRound,
              label: "Customers",
              value: customers.length,
              note: "Saved accounts",
            },
            {
              icon: Calculator,
              label: "Tools",
              value: effectiveAllowedPageIds.includes("sales-converter") ? 1 : 0,
              note: "Pricing converter",
            },
            ...(canReadCustomerPaymentLinks
              ? [
                  {
                    icon: MailCheck,
                    label: "Payment Links",
                    value: customers.filter(
                      (customer) => customer.needsPaymentLink,
                    ).length,
                    note: "Monthly customers",
                  },
                ]
              : []),
            ...(canReadSalesReport
              ? [
                  {
                    icon: DollarSign,
                    label: "Sales Month",
                    value:
                      currentSalesTotal > 0
                        ? `$${Math.round(currentSalesTotal).toLocaleString()}`
                        : "$0",
                    note: `Cash/Card $${Math.round(
                      Number(currentSalesReport?.cashCardSales) || 0,
                    ).toLocaleString()} · Charge $${Math.round(
                      Number(currentSalesReport?.chargeSales) || 0,
                    ).toLocaleString()}`,
                  },
                ]
              : []),
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
            effectiveAllowedPageIds.includes("sales-converter")
              ? {
                  icon: Calculator,
                  label: "Pricing",
                  title: "Converter",
                  description: "Convert panels, boards, and item pricing with margin targets.",
                  metric: "$",
                  metricLabel: "Margin",
                  onClick: () => setCurrentPage("sales-converter"),
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
            canReadSalesReport
              ? {
                  icon: DollarSign,
                  label: "Admin Pulse",
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
      return null;
    }

    switch (currentPage) {
      case "dashboard":
        return renderDashboardPage();

      case "driver-dashboard":
        return (
          <DriverDashboardPage
            supplierRuns={supplierRuns}
            deliveries={deliveries}
            users={users}
            driverName={driverName}
            isSuperAdmin={isSuperAdmin}
            onPageChange={setCurrentPage}
          />
        );

      case "user-admin":
        return (
          <UserAdminPage
            users={users}
            currentUserProfile={userProfile}
            onUpdateUserProfile={handleUpdateUserProfile}
            onPageChange={setCurrentPage}
          />
        );

      case "email-list":
        return (
          <EmailListPage
            customers={customers}
            emailList={emailList}
            onAddEmailListEntry={handleAddEmailListEntry}
            onDeleteEmailListEntry={handleDeleteEmailListEntry}
            onPageChange={setCurrentPage}
          />
        );

      case "bouncie":
        return <BounciePage onPageChange={setCurrentPage} />;

      case "today":
        return (
          <TodayPage
            checkIns={checkIns}
            customers={customers}
            onDeleteCheckIn={handleDeleteCheckIn}
            onUpdateAssignment={
              handleUpdateAssignment
            }
            onPageChange={setCurrentPage}
          />
        );

      case "search":
        return (
          <SearchPage
            checkIns={checkIns}
            onDeleteCheckIn={handleDeleteCheckIn}
            onUpdateAssignment={
              handleUpdateAssignment
            }
            onPageChange={setCurrentPage}
          />
        );

      case "supplier-runs-add":
        return (
          <SupplierRunsPage
            mode="add"
            supplierRuns={supplierRuns}
            createdBy={currentUserCreator}
            vehicleOptions={southVehicleOptions}
            canAssignRoute={false}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onToggleSupplierRunItem={
              handleToggleSupplierRunItem
            }
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
          />
        );

      case "supplier-runs-dispatch":
        return (
          <SupplierRunsPage
            mode="dispatch"
            supplierRuns={supplierRuns}
            vehicleOptions={southVehicleOptions}
            canAssignRoute
            canReorderRoute={canAssignSouthRoutes}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onToggleSupplierRunItem={
              handleToggleSupplierRunItem
            }
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
          />
        );

      case "supplier-runs-check":
        return (
          <SupplierRunsPage
            mode="check"
            supplierRuns={assignedVisibleSupplierRuns}
            vehicleOptions={southVehicleOptions}
            canReorderRoute={canAssignSouthRoutes}
            canEditSupplierRuns={canAssignSouthRoutes}
            canReadAllRouteOrders={
              effectiveUserRole !== "driver" && canReadSouth
            }
            routeOrderDriverName={driverName}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onToggleSupplierRunItem={
              handleToggleSupplierRunItem
            }
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
          />
        );

      case "supplier-runs-history":
        return (
          <SupplierRunsPage
            mode="history"
            supplierRuns={assignedVisibleSupplierRuns}
            vehicleOptions={southVehicleOptions}
            onAddSupplierRun={handleAddSupplierRun}
            onUpdateSupplierRun={handleUpdateSupplierRun}
            onToggleSupplierRunItem={
              handleToggleSupplierRunItem
            }
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
            onPageChange={setCurrentPage}
          />
        );

      case "deliveries-add":
        return (
          <DeliveriesPage
            deliveries={deliveries}
            onAddDelivery={handleAddDelivery}
            onUpdateDelivery={handleUpdateDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            editingDeliveryId={editingDeliveryId}
            onEditDelivery={handleEditDelivery}
            onCancelEditDelivery={handleCancelEditDelivery}
            onPageChange={setCurrentPage}
          />
        );

      case "deliveries-queue":
        return (
          <DeliveryQueuePage
            deliveries={visibleDeliveries}
            onUpdateDelivery={handleUpdateDelivery}
            onEditDelivery={handleEditDelivery}
            onPageChange={setCurrentPage}
          />
        );

      case "deliveries-history":
        return (
          <DeliveryHistoryPage
            deliveries={visibleDeliveries}
            onPageChange={setCurrentPage}
          />
        );

      case "customers-add":
        return (
          <CustomersPage
            mode="add"
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onPageChange={setCurrentPage}
          />
        );

      case "customers-view":
        return (
          <CustomersPage
            mode="view"
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
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

      case "sales-converter":
        return <SalesConverterPage onPageChange={setCurrentPage} />;

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
          />
        );
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5]">
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
            onPageChange={setCurrentPage}
            currentUser={currentUser}
            currentUserProfile={userProfile}
            allowedPageIds={effectiveAllowedPageIds}
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
