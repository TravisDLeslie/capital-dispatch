import { useEffect, useState } from "react";
import AppHeader from "./components/AppHeader";
import CheckInPage from "./pages/CheckInPage";
import SearchPage from "./pages/SearchPage";
import SupplierRunsPage from "./pages/SupplierRunsPage";
import TodayPage from "./pages/TodayPage";
import {
  addCheckIn,
  deleteCheckIn,
  getCheckIns,
  subscribeToCheckIns,
  updateCheckInAssignment,
} from "./utils/checkInStorage";
import { getFirebaseErrorMessage } from "./utils/firebaseErrorMessages";
import { isFirebaseConfigured } from "./utils/firebase";
import {
  addSupplierRun,
  deleteSupplierRun,
  subscribeToSupplierRuns,
  updateSupplierRunItems,
} from "./utils/supplierRunStorage";

type CheckIn = {
  id: string;
  [key: string]: unknown;
};

type OrderAssignment = {
  type: string;
  businessName?: string;
  orderedBy?: string;
  jobName?: string;
};

type SupplierRunItem = {
  id: string;
  description: string;
  pickedUp: boolean;
  pickedUpAt?: string | null;
  pickupPhoto?: unknown | null;
};

type SupplierRun = {
  id: string;
  driver?: string;
  items?: SupplierRunItem[];
  status?: string;
  [key: string]: unknown;
};

export default function App() {
  const [currentPage, setCurrentPage] =
    useState("check-in");

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [supplierRuns, setSupplierRuns] = useState<
    SupplierRun[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    let isMounted = true;
    let unsubscribeFromCheckIns = () => {};
    let unsubscribeFromSupplierRuns = () => {};

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

      unsubscribeFromSupplierRuns = subscribeToSupplierRuns(
        (savedSupplierRuns: SupplierRun[]) => {
          if (isMounted) {
            setSupplierRuns(savedSupplierRuns);
            setSyncError("");
          }
        },
        (error: Error) => {
          console.error("Unable to sync supplier runs:", error);

          if (isMounted) {
            setSyncError(getFirebaseErrorMessage(error));
            setIsLoading(false);
          }
        },
      );
    } else {
      loadCheckIns();
      subscribeToSupplierRuns(
        (savedSupplierRuns: SupplierRun[]) => {
          if (isMounted) {
            setSupplierRuns(savedSupplierRuns);
          }
        },
        (error: Error) => {
          console.error("Unable to load supplier runs:", error);
        },
      );
    }

    return () => {
      isMounted = false;
      unsubscribeFromCheckIns();
      unsubscribeFromSupplierRuns();
    };
  }, []);

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
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this check-in?",
    );

    if (!shouldDelete) {
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
            description,
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
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this supplier PO?",
    );

    if (!shouldDelete) {
      return;
    }

    const updatedSupplierRuns =
      await deleteSupplierRun(supplierRunId);

    setSupplierRuns(updatedSupplierRuns);
    setSyncError("");
  }

  function renderCurrentPage() {
    switch (currentPage) {
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

      case "supplier-runs-history":
        return (
          <SupplierRunsPage
            mode="history"
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
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        currentPage={currentPage}
        onPageChange={setCurrentPage}
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
              Loading receiving records...
            </div>
          ) : null}
        </div>

        {renderCurrentPage()}
      </main>
    </div>
  );
}
