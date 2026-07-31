import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import AppHeader from "./components/AppHeader";
import CheckInPage from "./pages/CheckInPage";
import DeliveryHistoryPage from "./pages/DeliveryHistoryPage";
import DeliveryQueuePage from "./pages/DeliveryQueuePage";
import DeliveriesPage from "./pages/DeliveriesPage";
import LoginPage from "./components/LoginPage";
import SearchPage from "./pages/SearchPage";
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
  updateSupplierRunItems,
} from "./utils/supplierRunStorage";
import {
  addDelivery,
  deleteDelivery,
  subscribeToDeliveries,
  updateDelivery,
} from "./utils/deliveryStorage";
import {
  ensureUserProfile,
  subscribeToUserProfile,
  subscribeToUsers,
  updateUserProfile,
} from "./utils/userStorage";

const DELETE_PO_CODE = "3105";
const SUPER_ADMIN_EMAILS = ["travis@capitallumber.co"];

type UserProfile = {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
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
  pickedUp: boolean;
  pickedUpAt?: string | null;
  pickupPhoto?: unknown | null;
};

type SupplierRun = {
  id: string;
  poNumber?: string;
  vendor?: string;
  scheduledDate?: string;
  driver?: string;
  supplierAddress?: string;
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

function getAllowedPageIds(role: string) {
  if (role === "superAdmin") {
    return [
      "check-in",
      "today",
      "search",
      "supplier-runs-add",
      "supplier-runs-check",
      "supplier-runs-history",
      "deliveries-add",
      "deliveries-queue",
      "deliveries-history",
      "user-admin",
    ];
  }

  if (role === "admin") {
    return [
      "check-in",
      "today",
      "search",
      "supplier-runs-add",
      "supplier-runs-check",
      "supplier-runs-history",
      "deliveries-add",
      "deliveries-queue",
      "deliveries-history",
    ];
  }

  if (role === "receiving") {
    return ["check-in", "today", "search"];
  }

  if (role === "south") {
    return ["supplier-runs-check", "supplier-runs-history"];
  }

  if (role === "delivery") {
    return ["deliveries-queue", "deliveries-history"];
  }

  if (role === "driver") {
    return ["supplier-runs-check", "deliveries-queue"];
  }

  return [];
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
    useState("check-in");
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
  const [editingDeliveryId, setEditingDeliveryId] =
    useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState("");

  const userRole = getUserRole(userProfile, currentUser?.email);
  const isSuperAdmin = userRole === "superAdmin";
  const isApproved =
    isSuperAdmin || userProfile?.status === "approved";
  const allowedPageIds = useMemo(
    () => getAllowedPageIds(userRole),
    [userRole],
  );
  const driverName = userProfile?.driverName || "";
  const canReadReceiving = allowedPageIds.some((pageId) =>
    ["check-in", "today", "search"].includes(pageId),
  );
  const canReadSouth = allowedPageIds.some((pageId) =>
    [
      "supplier-runs-add",
      "supplier-runs-check",
      "supplier-runs-history",
    ].includes(pageId),
  );
  const canReadDeliveries = allowedPageIds.some((pageId) =>
    [
      "deliveries-add",
      "deliveries-queue",
      "deliveries-history",
    ].includes(pageId),
  );
  const visibleSupplierRuns =
    userRole === "driver"
      ? supplierRuns.filter(
          (supplierRun) => supplierRun.driver === driverName,
        )
      : supplierRuns;
  const visibleDeliveries =
    userRole === "driver"
      ? deliveries.filter((delivery) => delivery.driver === driverName)
      : deliveries;

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
    if (
      !isApproved ||
      allowedPageIds.length === 0 ||
      allowedPageIds.includes(currentPage)
    ) {
      return;
    }

    setCurrentPage(allowedPageIds[0]);
  }, [allowedPageIds, currentPage, isApproved]);

  useEffect(() => {
    if (isAuthLoading || isProfileLoading) {
      return;
    }

    if (!currentUser || !isApproved) {
      setCheckIns([]);
      setSupplierRuns([]);
      setDeliveries([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let isMounted = true;
    let unsubscribeFromCheckIns = () => {};
    let unsubscribeFromSupplierRuns = () => {};
    let unsubscribeFromDeliveries = () => {};

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
          userRole === "driver" ? driverName : "",
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
          userRole === "driver" ? driverName : "",
        );
      } else {
        setDeliveries([]);
      }

      if (!canReadReceiving && !canReadSouth && !canReadDeliveries) {
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
    }

    return () => {
      isMounted = false;
      unsubscribeFromCheckIns();
      unsubscribeFromSupplierRuns();
      unsubscribeFromDeliveries();
    };
  }, [
    currentUser,
    canReadDeliveries,
    canReadReceiving,
    canReadSouth,
    driverName,
    isApproved,
    isAuthLoading,
    isProfileLoading,
    userRole,
  ]);

  async function handleSignOut() {
    if (!auth) {
      return;
    }

    await signOut(auth);
    setCurrentPage("check-in");
    setEditingDeliveryId("");
  }

  async function handleUpdateUserProfile(
    userId: string,
    updates: Partial<UserProfile>,
  ) {
    await updateUserProfile(userId, updates);
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

  async function handleAddDelivery(delivery: Delivery) {
    const updatedDeliveries = await addDelivery(delivery);

    setDeliveries(updatedDeliveries);
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

  function renderCurrentPage() {
    if (!allowedPageIds.includes(currentPage)) {
      return null;
    }

    switch (currentPage) {
      case "user-admin":
        return (
          <UserAdminPage
            users={users}
            currentUserProfile={userProfile}
            onUpdateUserProfile={handleUpdateUserProfile}
          />
        );

      case "today":
        return (
          <TodayPage
            checkIns={checkIns}
            onDeleteCheckIn={handleDeleteCheckIn}
            onUpdateAssignment={
              handleUpdateAssignment
            }
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
          />
        );

      case "supplier-runs-add":
        return (
          <SupplierRunsPage
            mode="add"
            supplierRuns={supplierRuns}
            onAddSupplierRun={handleAddSupplierRun}
            onToggleSupplierRunItem={
              handleToggleSupplierRunItem
            }
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
          />
        );

      case "supplier-runs-check":
        return (
          <SupplierRunsPage
            mode="check"
            supplierRuns={visibleSupplierRuns}
            onAddSupplierRun={handleAddSupplierRun}
            onToggleSupplierRunItem={
              handleToggleSupplierRunItem
            }
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
          />
        );

      case "supplier-runs-history":
        return (
          <SupplierRunsPage
            mode="history"
            supplierRuns={visibleSupplierRuns}
            onAddSupplierRun={handleAddSupplierRun}
            onToggleSupplierRunItem={
              handleToggleSupplierRunItem
            }
            onUpdateSupplierRunItemDescription={
              handleUpdateSupplierRunItemDescription
            }
            onDeleteSupplierRun={handleDeleteSupplierRun}
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
          />
        );

      case "deliveries-queue":
        return (
          <DeliveryQueuePage
            deliveries={visibleDeliveries}
            onUpdateDelivery={handleUpdateDelivery}
            onEditDelivery={handleEditDelivery}
          />
        );

      case "deliveries-history":
        return (
          <DeliveryHistoryPage deliveries={visibleDeliveries} />
        );

      case "check-in":
      default:
        return (
          <CheckInPage
            onAddCheckIn={handleAddCheckIn}
            onViewToday={() =>
              setCurrentPage("today")
            }
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
            allowedPageIds={allowedPageIds}
            isSuperAdmin={isSuperAdmin}
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
