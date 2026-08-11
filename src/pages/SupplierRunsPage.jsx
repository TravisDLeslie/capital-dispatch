import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Home,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import CustomerNameBadge from "../components/CustomerNameBadge";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import SupplierRunCard from "../components/SupplierRunCard";
import SupplierRunForm from "../components/SupplierRunForm";
import {
  favoriteSouthDrivers,
  southDrivers,
  southVendorRouteOrder,
} from "../data/options";
import {
  formatDateInput,
  getDateInputValue,
  getTodayHeading,
  isToday,
} from "../utils/dateHelpers";
import {
  getSouthRouteOrderId,
  saveSouthRouteOrder,
  subscribeToSouthRouteOrders,
} from "../utils/southRouteOrderStorage";

const UNASSIGNED_DRIVER = "Unassigned Driver";
const driverAvatarColors = [
  "bg-red-100 text-red-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
  "bg-lime-100 text-lime-700",
  "bg-orange-100 text-orange-700",
  "bg-slate-200 text-slate-700",
];

function normalizeVendorName(vendor) {
  return String(vendor || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getDisplayVendorName(vendor, vendorDisplayNameMap = {}) {
  const normalizedVendor = normalizeVendorName(vendor);

  return (
    vendorDisplayNameMap[normalizedVendor] ||
    vendor ||
    "Unknown Supplier"
  );
}

function formatCreatedAt(value) {
  if (!value) {
    return "";
  }

  const createdAtDate = new Date(value);

  if (Number.isNaN(createdAtDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(createdAtDate);
}

function getVendorRouteIndex(vendor, vendorRouteOrder = southVendorRouteOrder) {
  const normalizedVendor = normalizeVendorName(vendor);
  const routeIndex = vendorRouteOrder.findIndex(
    (routeVendor) =>
      normalizeVendorName(routeVendor) === normalizedVendor,
  );

  return routeIndex === -1
    ? Number.MAX_SAFE_INTEGER
    : routeIndex;
}

function sortVendorGroups(
  vendorGroups,
  manualVendorOrder = [],
  vendorRouteOrder = southVendorRouteOrder,
) {
  const normalizedManualOrder = manualVendorOrder.map(normalizeVendorName);

  return [...vendorGroups].sort((firstGroup, secondGroup) => {
    const firstManualIndex = normalizedManualOrder.indexOf(
      normalizeVendorName(firstGroup.vendor),
    );
    const secondManualIndex = normalizedManualOrder.indexOf(
      normalizeVendorName(secondGroup.vendor),
    );

    if (firstManualIndex !== -1 || secondManualIndex !== -1) {
      if (firstManualIndex === -1) {
        return 1;
      }

      if (secondManualIndex === -1) {
        return -1;
      }

      return firstManualIndex - secondManualIndex;
    }

    const firstIndex = getVendorRouteIndex(firstGroup.vendor, vendorRouteOrder);
    const secondIndex = getVendorRouteIndex(
      secondGroup.vendor,
      vendorRouteOrder,
    );

    if (firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }

    return firstGroup.vendor.localeCompare(secondGroup.vendor);
  });
}

function getDriverAvatar(driver) {
  const name = driver || UNASSIGNED_DRIVER;
  const colorIndex = [...name].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  ) % driverAvatarColors.length;

  return {
    initial: name.trim().charAt(0).toUpperCase() || "?",
    colorClass: driverAvatarColors[colorIndex],
  };
}

function groupRunsByVendor(
  supplierRuns,
  manualVendorOrder = [],
  vendorRouteOrder = southVendorRouteOrder,
  vendorDisplayNameMap = {},
) {
  const vendorGroups = supplierRuns.reduce((groups, supplierRun) => {
    const vendor = getDisplayVendorName(
      supplierRun.vendor,
      vendorDisplayNameMap,
    );
    const existingGroup = groups.find(
      (group) => group.vendor === vendor,
    );

    if (existingGroup) {
      existingGroup.runs.push(supplierRun);
      return groups;
    }

    return [
      ...groups,
      {
        vendor,
        runs: [supplierRun],
      },
    ];
  }, []);

  return sortVendorGroups(vendorGroups, manualVendorOrder, vendorRouteOrder);
}

function groupRunsByDriverAndVendor(
  supplierRuns,
  routeOrdersByDriver = {},
  vendorRouteOrder = southVendorRouteOrder,
  vendorDisplayNameMap = {},
) {
  const runsByDriver = supplierRuns.reduce((groups, supplierRun) => {
    const driver = supplierRun.driver || UNASSIGNED_DRIVER;

    return {
      ...groups,
      [driver]: [...(groups[driver] || []), supplierRun],
    };
  }, {});

  return Object.entries(runsByDriver).map(([driver, runs]) => ({
    driver,
    vendorGroups: groupRunsByVendor(
      runs,
      routeOrdersByDriver[driver]?.vendorOrder || [],
      vendorRouteOrder,
      vendorDisplayNameMap,
    ),
  }));
}

function getDirectionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
}

function getMaterialUseLabel(materialUse) {
  const labels = {
    order: "Order",
    stock: "Stock",
    return: "Return",
    swap: "Swap",
  };

  return labels[materialUse] || "Order";
}

function getSupplierRunCustomerName(supplierRun) {
  return (
    supplierRun.customerName ||
    (Array.isArray(supplierRun.items)
      ? supplierRun.items.find(
          (item) => item.materialUse !== "stock" && item.customerName,
        )?.customerName
      : "") ||
    ""
  );
}

function getMaterialUseBadgeClass(materialUse) {
  if (materialUse === "return") {
    return "bg-amber-100 text-amber-800";
  }

  if (materialUse === "swap") {
    return "bg-violet-100 text-violet-800";
  }

  return "bg-slate-100 text-slate-600";
}

function getDateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSupplierRunDateKey(supplierRun) {
  if (supplierRun.scheduledDate) {
    return supplierRun.scheduledDate;
  }

  if (supplierRun.createdAt) {
    return getDateKeyFromDate(new Date(supplierRun.createdAt));
  }

  return "";
}

function hasPickedUpItems(supplierRun) {
  return Array.isArray(supplierRun?.items)
    ? supplierRun.items.some((item) => item.pickedUp)
    : false;
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);

  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      key: getDateKeyFromDate(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: getDateKeyFromDate(date) === getDateInputValue(),
    };
  });
}

function getMonthLabel(monthDate) {
  return monthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getSouthPageTitle(mode) {
  if (mode === "history") {
    return "History";
  }

  if (mode === "dispatch") {
    return "Needs Dispatch";
  }

  if (mode === "check") {
    return "Check South POs";
  }

  return "Add South POs";
}

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeSearchNumbers(value) {
  return String(value || "").replace(/\D/g, "");
}

function supplierRunMatchesSearch(supplierRun, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const itemText = Array.isArray(supplierRun.items)
    ? supplierRun.items
        .map((item) =>
          [
            item.quantity,
            item.description,
            item.internalReference,
            item.materialUse,
            item.customerName,
            item.orderNumber,
            item.returnNotes,
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ")
    : "";
  const searchableText = [
    supplierRun.poNumber,
    supplierRun.vendor,
    supplierRun.driver,
    supplierRun.vehicleTitle,
    supplierRun.vehicleBadge,
    supplierRun.orderedBy,
    supplierRun.customerName,
    supplierRun.createdByName,
    supplierRun.createdByEmail,
    supplierRun.supplierAddress,
    getSupplierRunDateKey(supplierRun),
    supplierRun.completedAt,
    supplierRun.updatedAt,
    itemText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const numericSearchTerm = normalizeSearchNumbers(searchTerm);
  const searchableNumbers = [
    supplierRun.poNumber,
    ...(
      Array.isArray(supplierRun.items)
        ? supplierRun.items.map((item) => item.orderNumber)
        : []
    ),
  ]
    .map(normalizeSearchNumbers)
    .filter(Boolean);

  return (
    searchableText.includes(searchTerm) ||
    (numericSearchTerm.length > 0 &&
      searchableNumbers.some((searchableNumber) =>
        searchableNumber.includes(numericSearchTerm),
      ))
  );
}

function supplierRunMatchesPickupSearch(
  supplierRun,
  searchTerm,
  includeCustomerName = false,
) {
  if (!searchTerm) {
    return true;
  }

  const itemText = Array.isArray(supplierRun.items)
    ? supplierRun.items
        .map((item) =>
          [
            item.internalReference,
            includeCustomerName ? item.customerName : "",
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ")
    : "";
  const searchableText = [
    supplierRun.poNumber,
    includeCustomerName ? supplierRun.customerName : "",
    itemText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const numericSearchTerm = normalizeSearchNumbers(searchTerm);
  const searchableNumbers = [
    supplierRun.poNumber,
    ...(Array.isArray(supplierRun.items)
      ? supplierRun.items.map((item) => item.internalReference)
      : []),
  ]
    .map(normalizeSearchNumbers)
    .filter(Boolean);

  return (
    searchableText.includes(searchTerm) ||
    (numericSearchTerm.length > 0 &&
      searchableNumbers.some((searchableNumber) =>
        searchableNumber.includes(numericSearchTerm),
      ))
  );
}

function getDateSortValue(supplierRun) {
  const dateKey = getSupplierRunDateKey(supplierRun);
  const parsedDate = dateKey ? new Date(`${dateKey}T00:00:00`) : null;

  return parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.getTime()
    : Number.MAX_SAFE_INTEGER;
}

function sortSupplierRunsByClosestPickupDate(supplierRuns) {
  const todayTime = new Date(`${getDateInputValue()}T00:00:00`).getTime();

  return [...supplierRuns].sort((firstRun, secondRun) => {
    const firstTime = getDateSortValue(firstRun);
    const secondTime = getDateSortValue(secondRun);
    const firstIsUpcoming = firstTime >= todayTime;
    const secondIsUpcoming = secondTime >= todayTime;

    if (firstIsUpcoming !== secondIsUpcoming) {
      return firstIsUpcoming ? -1 : 1;
    }

    if (firstIsUpcoming && secondIsUpcoming) {
      return firstTime - secondTime;
    }

    if (!firstIsUpcoming && !secondIsUpcoming) {
      return secondTime - firstTime;
    }

    return String(firstRun.poNumber || "").localeCompare(
      String(secondRun.poNumber || ""),
    );
  });
}

function groupHistoryRunsByPickupDate(
  supplierRuns,
  vendorRouteOrder = southVendorRouteOrder,
  vendorDisplayNameMap = {},
) {
  const groupsByDate = supplierRuns.reduce((groups, supplierRun) => {
    const dateKey = getSupplierRunDateKey(supplierRun) || "no-date";

    return {
      ...groups,
      [dateKey]: [...(groups[dateKey] || []), supplierRun],
    };
  }, {});

  return Object.entries(groupsByDate)
    .sort(([firstDateKey], [secondDateKey]) =>
      secondDateKey.localeCompare(firstDateKey),
    )
    .map(([dateKey, runs]) => ({
      dateKey,
      label:
        dateKey === "no-date"
          ? "No pickup date"
          : formatDateInput(dateKey),
      runs,
      driverGroups: groupRunsByDriverAndVendor(
        runs,
        {},
        vendorRouteOrder,
        vendorDisplayNameMap,
      ),
    }));
}

export default function SupplierRunsPage({
  mode = "add",
  supplierRuns,
  onAddSupplierRun,
  onToggleSupplierRunItem,
  onUpdateSupplierRunItemDescription,
  onUpdateSupplierRun,
  onDeleteSupplierRun,
  createdBy = {},
  vehicleOptions,
  vendorOptions,
  supplierAddressMap,
  vendorRouteOrder,
  vendorDisplayNameMap,
  canAssignRoute = false,
  canReorderRoute = false,
  canEditSupplierRuns = canAssignRoute || canReorderRoute,
  canReadAllRouteOrders = canReorderRoute,
  routeOrderDriverName = "",
  viewerRole = "",
  initialCheckViewMode = "list",
  onPageChange,
  onRefreshPage,
}) {
  const safeVehicleOptions = Array.isArray(vehicleOptions)
    ? vehicleOptions
    : [];
  const safeVendorRouteOrder =
    Array.isArray(vendorRouteOrder) && vendorRouteOrder.length > 0
      ? vendorRouteOrder
      : southVendorRouteOrder;
  const safeVendorDisplayNameMap = vendorDisplayNameMap || {};
  const shouldShowMobileStopIcon = viewerRole === "driver";
  const todayKey = getDateInputValue();
  const [successMessage, setSuccessMessage] = useState("");
  const [openStopKeys, setOpenStopKeys] = useState({});
  const [openDriverKeys, setOpenDriverKeys] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedScheduleDate, setSelectedScheduleDate] =
    useState(todayKey);
  const [checkViewMode, setCheckViewMode] = useState(initialCheckViewMode);
  const [viewingSupplierRun, setViewingSupplierRun] =
    useState(null);
  const [editingSupplierRun, setEditingSupplierRun] =
    useState(null);
  const [southRouteOrders, setSouthRouteOrders] = useState([]);
  const [draggingStop, setDraggingStop] = useState(null);
  const [routeOrderError, setRouteOrderError] = useState("");
  const [dispatchDrafts, setDispatchDrafts] = useState({});
  const [savingDispatchRunId, setSavingDispatchRunId] = useState("");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [pickupSearch, setPickupSearch] = useState("");
  const [dateMoveDraft, setDateMoveDraft] = useState(todayKey);
  const [dateMoveError, setDateMoveError] = useState("");
  const [savingDateMove, setSavingDateMove] = useState(false);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successMessage]);

  useEffect(() => {
    if (mode === "check") {
      setCheckViewMode(initialCheckViewMode);
    }
  }, [initialCheckViewMode, mode]);

  useEffect(() => {
    if (mode !== "check" || !canEditSupplierRuns) {
      return;
    }

    let pendingSupplierRunId = "";

    try {
      pendingSupplierRunId =
        sessionStorage.getItem("dispatch-cl-edit-south-po") || "";
      sessionStorage.removeItem("dispatch-cl-edit-south-po");
    } catch {
      pendingSupplierRunId = "";
    }

    if (!pendingSupplierRunId) {
      return;
    }

    const pendingSupplierRun = supplierRuns.find(
      (supplierRun) => supplierRun.id === pendingSupplierRunId,
    );

    if (pendingSupplierRun) {
      setEditingSupplierRun(pendingSupplierRun);
    }
  }, [canEditSupplierRuns, mode, supplierRuns]);

  useEffect(
    () =>
      subscribeToSouthRouteOrders(
        setSouthRouteOrders,
        (routeOrderSyncError) => {
          console.error(
            "Unable to sync South route orders:",
            routeOrderSyncError,
          );
          setRouteOrderError(
            "Unable to sync route order. Publish Firestore rules for South route orders.",
          );
        },
        canReadAllRouteOrders
          ? {}
          : { driverName: routeOrderDriverName },
      ),
    [canReadAllRouteOrders, routeOrderDriverName],
  );

  async function handleSubmit(supplierRun) {
    await onAddSupplierRun(supplierRun);

    setSuccessMessage(
      supplierRun.dispatchStatus === "needsDispatch"
        ? `PO ${supplierRun.poNumber} was scheduled for ${formatDateInput(
            supplierRun.scheduledDate,
          )} and sent to Needs Dispatch.`
        : `PO ${supplierRun.poNumber} was scheduled for ${formatDateInput(
            supplierRun.scheduledDate,
          )} and sent to ${supplierRun.driver}'s South list.`,
    );
  }

  async function handleEditSubmit(supplierRun) {
    if (!editingSupplierRun?.id || !canEditSupplierRuns) {
      return;
    }

    await onUpdateSupplierRun(editingSupplierRun.id, supplierRun);
    setEditingSupplierRun(null);
    setSuccessMessage(`PO ${supplierRun.poNumber} was updated.`);
  }

  function toggleStop(driver, vendor, scope = "open") {
    const stopKey = `${scope}::${driver}::${vendor}`;

    setOpenStopKeys((currentOpenStopKeys) => ({
      ...currentOpenStopKeys,
      [stopKey]: !currentOpenStopKeys[stopKey],
    }));
  }

  function toggleDriver(driver, scope = "open") {
    const driverKey = `${scope}::${driver}`;

    setOpenDriverKeys((currentOpenDriverKeys) => ({
      ...currentOpenDriverKeys,
      [driverKey]: !currentOpenDriverKeys[driverKey],
    }));
  }

  function isDriverOpen(driver, scope = "open") {
    return Boolean(openDriverKeys[`${scope}::${driver}`]);
  }

  function isStopOpen(driver, vendor, scope = "open") {
    return Boolean(openStopKeys[`${scope}::${driver}::${vendor}`]);
  }

  async function saveRouteOrder(driver, vendorOrder) {
    const routeOrderId = getSouthRouteOrderId(
      driver,
      selectedScheduleDate,
    );

    setRouteOrderError("");

    try {
      const updatedRouteOrders = await saveSouthRouteOrder({
        id: routeOrderId,
        driver,
        dateKey: selectedScheduleDate,
        vendorOrder,
      });

      setSouthRouteOrders(updatedRouteOrders);
    } catch (routeOrderSaveError) {
      console.error("Unable to save South route order:", routeOrderSaveError);
      setRouteOrderError(
        "Unable to save route order. Publish Firestore rules for South route orders.",
      );
    }
  }

  function moveVendor(vendors, fromVendor, toVendor) {
    const fromIndex = vendors.indexOf(fromVendor);
    const toIndex = vendors.indexOf(toVendor);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return vendors;
    }

    const nextVendors = [...vendors];
    const [movedVendor] = nextVendors.splice(fromIndex, 1);
    nextVendors.splice(toIndex, 0, movedVendor);

    return nextVendors;
  }

  async function handleStopDrop(driver, targetVendor, vendorGroups) {
    if (!canReorderRoute) {
      setDraggingStop(null);
      return;
    }

    if (!draggingStop || draggingStop.driver !== driver) {
      setDraggingStop(null);
      return;
    }

    const currentVendorOrder = vendorGroups.map(
      (vendorGroup) => vendorGroup.vendor,
    );
    const nextVendorOrder = moveVendor(
      currentVendorOrder,
      draggingStop.vendor,
      targetVendor,
    );

    setDraggingStop(null);

    if (nextVendorOrder.join("::") === currentVendorOrder.join("::")) {
      return;
    }

    await saveRouteOrder(driver, nextVendorOrder);
  }

  async function handleMoveStop(driver, vendorGroups, vendor, offset) {
    if (!canReorderRoute) {
      return;
    }

    const currentVendorOrder = vendorGroups.map(
      (vendorGroup) => vendorGroup.vendor,
    );
    const currentIndex = currentVendorOrder.indexOf(vendor);
    const nextIndex = currentIndex + offset;

    if (
      currentIndex === -1 ||
      nextIndex < 0 ||
      nextIndex >= currentVendorOrder.length
    ) {
      return;
    }

    const nextVendorOrder = [...currentVendorOrder];
    const [movedVendor] = nextVendorOrder.splice(currentIndex, 1);
    nextVendorOrder.splice(nextIndex, 0, movedVendor);

    await saveRouteOrder(driver, nextVendorOrder);
  }

  function getVendorGroupStats(vendorGroup) {
    const items = vendorGroup.runs.flatMap((supplierRun) =>
      Array.isArray(supplierRun.items) ? supplierRun.items : [],
    );
    const remainingItems = items.filter(
      (item) => !item.pickedUp,
    ).length;

    return {
      poCount: vendorGroup.runs.length,
      itemCount: items.length,
      remainingItems,
    };
  }

  function getVendorGroupAddress(vendorGroup) {
    const settingsAddress =
      supplierAddressMap?.[vendorGroup.vendor]?.trim?.() || "";

    if (settingsAddress) {
      return settingsAddress;
    }

    const runWithAddress = vendorGroup.runs.find(
      (supplierRun) =>
        typeof supplierRun.supplierAddress === "string" &&
        supplierRun.supplierAddress.trim(),
    );

    return runWithAddress?.supplierAddress?.trim() || "";
  }

  function getDisplaySupplierRun(supplierRun) {
    const displayVendor = getDisplayVendorName(
      supplierRun.vendor,
      safeVendorDisplayNameMap,
    );

    return displayVendor === supplierRun.vendor
      ? supplierRun
      : {
          ...supplierRun,
          vendor: displayVendor,
        };
  }

  function getDriverGroupStats(driverGroup) {
    const items = driverGroup.vendorGroups.flatMap((vendorGroup) =>
      vendorGroup.runs.flatMap((supplierRun) =>
        Array.isArray(supplierRun.items) ? supplierRun.items : [],
      ),
    );
    const pickedUpItems = items.filter((item) => item.pickedUp).length;
    const remainingItems = items.length - pickedUpItems;
    const progressPercent =
      items.length > 0
        ? Math.round((pickedUpItems / items.length) * 100)
        : 0;

    return {
      itemCount: items.length,
      pickedUpItems,
      remainingItems,
      progressPercent,
    };
  }

  function getDriverGroupVehicleLabel(driverGroup) {
    const vehicleLabels = [
      ...new Set(
        driverGroup.vendorGroups
          .flatMap((vendorGroup) => vendorGroup.runs)
          .map(
            (supplierRun) =>
              supplierRun.vehicleBadge ||
              supplierRun.vehicleTitle ||
              "",
          )
          .filter(Boolean),
      ),
    ];

    if (vehicleLabels.length === 0) {
      return "";
    }

    if (vehicleLabels.length === 1) {
      return vehicleLabels[0];
    }

    return `${vehicleLabels[0]} +${vehicleLabels.length - 1}`;
  }

  function getDriverStatsForRuns(driver, runs) {
    return getDriverGroupStats({
      driver,
      vendorGroups: groupRunsByVendor(
        runs.filter(
          (supplierRun) =>
            (supplierRun.driver || UNASSIGNED_DRIVER) === driver,
        ),
      ),
    });
  }

  function getDispatchDraft(supplierRun) {
    return {
      driver: supplierRun.driver || "",
      vehicleId: supplierRun.vehicleId || "",
      ...(dispatchDrafts[supplierRun.id] || {}),
    };
  }

  function updateDispatchDraft(supplierRunId, field, value) {
    setDispatchDrafts((currentDrafts) => ({
      ...currentDrafts,
      [supplierRunId]: {
        ...(currentDrafts[supplierRunId] || {}),
        [field]: value,
      },
    }));
    setRouteOrderError("");
  }

  async function assignSupplierRun(supplierRun) {
    const draft = getDispatchDraft(supplierRun);
    const selectedVehicle = safeVehicleOptions.find(
      (vehicleOption) => vehicleOption.id === draft.vehicleId,
    );

    if (!southDrivers.includes(draft.driver)) {
      setRouteOrderError(`Select a driver for PO ${supplierRun.poNumber}.`);
      return;
    }

    if (safeVehicleOptions.length > 0 && !selectedVehicle) {
      setRouteOrderError(`Select a truck for PO ${supplierRun.poNumber}.`);
      return;
    }

    setSavingDispatchRunId(supplierRun.id);
    setRouteOrderError("");

    try {
      const updatedSupplierRuns = await onUpdateSupplierRun(
        supplierRun.id,
        {
          driver: draft.driver,
          vehicleId: selectedVehicle?.id || "",
          vehicleTitle: selectedVehicle?.title || "",
          vehicleBadge: selectedVehicle?.badge || "",
          dispatchStatus: "assigned",
        },
      );

      setDispatchDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[supplierRun.id];
        return nextDrafts;
      });

      if (Array.isArray(updatedSupplierRuns)) {
        setSuccessMessage(
          `PO ${supplierRun.poNumber} was assigned to ${draft.driver}.`,
        );
      }
    } catch (assignError) {
      console.error("Unable to assign South PO:", assignError);
      setRouteOrderError("Unable to assign that PO. Check Firebase rules.");
    } finally {
      setSavingDispatchRunId("");
    }
  }

  function changeCalendarMonth(offset) {
    setCalendarMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + offset,
          1,
        ),
    );
  }

  const runsByDate = supplierRuns.reduce((groups, supplierRun) => {
    const dateKey = getSupplierRunDateKey(supplierRun);

    if (!dateKey) {
      return groups;
    }

    return {
      ...groups,
      [dateKey]: [...(groups[dateKey] || []), supplierRun],
    };
  }, {});
  const calendarDays = getCalendarDays(calendarMonth);
  const selectedScheduleRuns = [
    ...(runsByDate[selectedScheduleDate] || []),
  ].sort((firstRun, secondRun) => {
    const firstIndex = getVendorRouteIndex(firstRun.vendor);
    const secondIndex = getVendorRouteIndex(secondRun.vendor);

    if (firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }

    return String(firstRun.poNumber || "").localeCompare(
      String(secondRun.poNumber || ""),
    );
  });
  const selectedSupplierRunDetails = viewingSupplierRun
    ? getDisplaySupplierRun(
        supplierRuns.find(
          (supplierRun) => supplierRun.id === viewingSupplierRun.id,
        ) || viewingSupplierRun,
      )
    : null;

  useEffect(() => {
    if (!selectedSupplierRunDetails) {
      setDateMoveError("");
      return;
    }

    setDateMoveDraft(
      getSupplierRunDateKey(selectedSupplierRunDetails) || todayKey,
    );
    setDateMoveError("");
  }, [selectedSupplierRunDetails, todayKey]);

  async function handleMoveSelectedSupplierRunDate() {
    if (!selectedSupplierRunDetails || !dateMoveDraft) {
      setDateMoveError("Choose a pickup date.");
      return;
    }

    if (!canEditSupplierRuns) {
      setDateMoveError("You do not have access to move this PO.");
      return;
    }

    if (
      selectedSupplierRunDetails.status === "complete" ||
      hasPickedUpItems(selectedSupplierRunDetails)
    ) {
      setDateMoveError(
        "This PO cannot be moved after items have been picked up.",
      );
      return;
    }

    setSavingDateMove(true);
    setDateMoveError("");

    try {
      await onUpdateSupplierRun(selectedSupplierRunDetails.id, {
        scheduledDate: dateMoveDraft,
      });

      const [year, month] = dateMoveDraft.split("-").map(Number);

      setViewingSupplierRun({
        ...selectedSupplierRunDetails,
        scheduledDate: dateMoveDraft,
      });
      setSelectedScheduleDate(dateMoveDraft);
      setCalendarMonth(new Date(year, month - 1, 1));
      setSuccessMessage(
        `PO ${
          selectedSupplierRunDetails.poNumber || ""
        } was moved to ${formatDateInput(dateMoveDraft)}.`,
      );
    } catch (moveError) {
      console.error("Unable to move South PO date:", moveError);
      setDateMoveError("Unable to move this PO date. Check Firebase rules.");
    } finally {
      setSavingDateMove(false);
    }
  }

  const dailyRuns = supplierRuns.filter(
    (supplierRun) => {
      if (supplierRun.status === "complete") {
        return (
          getSupplierRunDateKey(supplierRun) === selectedScheduleDate &&
          isToday(supplierRun.completedAt || supplierRun.updatedAt)
        );
      }

      return getSupplierRunDateKey(supplierRun) === selectedScheduleDate;
    },
  );

  const historyRuns = supplierRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );
  const historySearchTerm = normalizeSearchText(historySearch);
  const filteredHistoryRuns = historyRuns.filter((supplierRun) =>
    supplierRunMatchesSearch(supplierRun, historySearchTerm),
  );

  const visibleRuns =
    mode === "history" ? historyRuns : dailyRuns;
  const canViewSouthCustomerName = canEditSupplierRuns;
  const pickupSearchTerm = normalizeSearchText(pickupSearch);
  const filteredVisibleRuns =
    mode === "check" && checkViewMode === "list"
      ? visibleRuns.filter((supplierRun) =>
          supplierRunMatchesPickupSearch(
            supplierRun,
            pickupSearchTerm,
            canViewSouthCustomerName,
          ),
        )
      : visibleRuns;

  const openRuns = filteredVisibleRuns.filter(
    (supplierRun) => supplierRun.status !== "complete",
  );

  const completeRuns = filteredVisibleRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );

  const routeOrdersByDriver = southRouteOrders
    .filter(
      (routeOrder) => routeOrder.dateKey === selectedScheduleDate,
    )
    .reduce(
      (ordersByDriver, routeOrder) => ({
        ...ordersByDriver,
        [routeOrder.driver || UNASSIGNED_DRIVER]: routeOrder,
      }),
      {},
    );

  const openRunGroups = groupRunsByDriverAndVendor(
    openRuns,
    mode === "check" ? routeOrdersByDriver : {},
    safeVendorRouteOrder,
    safeVendorDisplayNameMap,
  );
  const completeRunGroups =
    groupRunsByDriverAndVendor(
      completeRuns,
      mode === "check" ? routeOrdersByDriver : {},
      safeVendorRouteOrder,
      safeVendorDisplayNameMap,
    );
  const openStopsCount = openRunGroups.reduce(
    (count, driverGroup) =>
      count + driverGroup.vendorGroups.length,
    0,
  );
  const openItemsCount = openRuns.reduce(
    (count, supplierRun) =>
      count +
      (Array.isArray(supplierRun.items)
        ? supplierRun.items.filter((item) => !item.pickedUp).length
        : 0),
    0,
  );
  const historyDateGroups =
    groupHistoryRunsByPickupDate(
      filteredHistoryRuns,
      safeVendorRouteOrder,
      safeVendorDisplayNameMap,
    );
  const dispatchRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" &&
      (supplierRun.dispatchStatus === "needsDispatch" ||
        !supplierRun.driver),
  );
  const dispatchSearchTerm = normalizeSearchText(dispatchSearch);
  const filteredDispatchRuns = sortSupplierRunsByClosestPickupDate(
    dispatchRuns.filter((supplierRun) =>
      supplierRunMatchesSearch(supplierRun, dispatchSearchTerm),
    ),
  );
  const selectedSupplierRunDateIsLocked =
    selectedSupplierRunDetails &&
    (selectedSupplierRunDetails.status === "complete" ||
      hasPickedUpItems(selectedSupplierRunDetails));
  const canMoveSelectedSupplierRunDate =
    selectedSupplierRunDetails &&
    canEditSupplierRuns &&
    !selectedSupplierRunDateIsLocked;
  const pageTitle = getSouthPageTitle(mode);
  const displayPageTitle =
    mode === "check" && checkViewMode === "calendar"
      ? "South Calendar"
      : pageTitle;

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "South", onClick: () => onPageChange?.("south") },
          { label: displayPageTitle },
        ]}
      />

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
              Driver / South
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              {displayPageTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onRefreshPage?.()}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-[#FC2C38]"
            aria-label="Refresh South"
            title="Refresh South"
          >
            <RefreshCw
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.6}
            />
          </button>
        </div>

        {mode === "check" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
              {formatDateInput(selectedScheduleDate)}
            </div>

            <button
              type="button"
              onClick={() =>
                setCheckViewMode((currentMode) =>
                  currentMode === "calendar" ? "list" : "calendar",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#dc1f2b]"
            >
              <CalendarDays
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.4}
              />
              {checkViewMode === "calendar" ? "View" : "Calendar"}
            </button>
          </div>
        ) : (
          <div className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            {getTodayHeading()}
          </div>
        )}

        <p className="mt-2 text-slate-500">
          {mode === "history"
            ? "Older completed South pickups stay here so the daily driver board stays focused."
            : mode === "dispatch"
              ? "Assign the driver and truck before the PO reaches the driver pickup board."
            : mode === "check"
              ? checkViewMode === "calendar"
                ? "See scheduled South POs by pickup date, then open a PO to review or move it."
                : "Drivers can check off scheduled South pickup items as they load them from each supplier."
              : "Add South PO requests before the driver leaves, while they are on the road, or schedule them ahead. Dispatch assigns driver and truck next."}
        </p>
      </div>

      {successMessage ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-bold text-red-700">
            ✓ {successMessage}
          </p>
        </div>
      ) : null}

      {mode === "add" ? (
        <SupplierRunForm
          onSubmit={handleSubmit}
          createdBy={createdBy}
          vehicleOptions={safeVehicleOptions}
          vendorOptions={vendorOptions}
          supplierAddressMap={supplierAddressMap}
          canAssignRoute={canAssignRoute}
        />
      ) : mode === "dispatch" ? (
        <section>
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Waiting For Assignment
            </p>
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-3xl font-black text-slate-900">
                {filteredDispatchRuns.length}
              </p>

              {dispatchSearchTerm ? (
                <p className="text-sm font-bold text-slate-500">
                  Showing {filteredDispatchRuns.length} of{" "}
                  {dispatchRuns.length}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <label
              htmlFor="south-dispatch-search"
              className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
            >
              Search Needs Dispatch
            </label>

            <div className="flex gap-2">
              <input
                id="south-dispatch-search"
                type="search"
                value={dispatchSearch}
                onChange={(event) => setDispatchSearch(event.target.value)}
                placeholder="Search PO, vendor, date, ordered by, item, or notes"
                className="min-h-[46px] flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />

              {dispatchSearch ? (
                <button
                  type="button"
                  onClick={() => setDispatchSearch("")}
                  className="rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {routeOrderError ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              {routeOrderError}
            </div>
          ) : null}

          {filteredDispatchRuns.length === 0 ? (
            <EmptyState
              title={
                dispatchSearchTerm
                  ? "No Needs Dispatch POs match that search"
                  : "No South POs need dispatch"
              }
              description={
                dispatchSearchTerm
                  ? "Clear the search to see every PO waiting for assignment."
                  : "Sales-created PO requests will appear here until dispatch assigns a driver and truck."
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredDispatchRuns.map((supplierRun) => {
                const draft = getDispatchDraft(supplierRun);
                const itemCount = Array.isArray(supplierRun.items)
                  ? supplierRun.items.length
                  : 0;
                const runCustomerName =
                  getSupplierRunCustomerName(supplierRun);
                const createdAtLabel = formatCreatedAt(supplierRun.createdAt);

                return (
                  <article
                    key={supplierRun.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                          South Request
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-black text-slate-950">
                            PO {supplierRun.poNumber}
                          </h3>

                          {canViewSouthCustomerName && runCustomerName ? (
                            <CustomerNameBadge name={runCustomerName} />
                          ) : null}
                        </div>

                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {supplierRun.vendor || "Unknown Supplier"} •{" "}
                          {formatDateInput(
                            getSupplierRunDateKey(supplierRun),
                          )}{" "}
                          • {itemCount} {itemCount === 1 ? "item" : "items"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.12em]">
                          {createdAtLabel ? (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber-100">
                              Entered {createdAtLabel}
                            </span>
                          ) : null}
                          {supplierRun.orderedBy ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                              Ordered by {supplierRun.orderedBy}
                            </span>
                          ) : null}
                          {supplierRun.createdByName ||
                          supplierRun.createdByEmail ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                              Created by{" "}
                              {supplierRun.createdByName ||
                                supplierRun.createdByEmail}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[180px_180px_auto] lg:min-w-[520px]">
                        <label className="block">
                          <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                            Driver
                          </span>
                          <select
                            value={draft.driver}
                            onChange={(event) =>
                              updateDispatchDraft(
                                supplierRun.id,
                                "driver",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                          >
                            <option value="">Select...</option>
                            <optgroup label="Favorites">
                              {favoriteSouthDrivers.map((driverOption) => (
                                <option
                                  key={driverOption}
                                  value={driverOption}
                                >
                                  {driverOption}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="All Drivers">
                              {southDrivers
                                .filter(
                                  (driverOption) =>
                                    !favoriteSouthDrivers.includes(
                                      driverOption,
                                    ),
                                )
                                .map((driverOption) => (
                                  <option
                                    key={driverOption}
                                    value={driverOption}
                                  >
                                    {driverOption}
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                            Truck
                          </span>
                          <select
                            value={draft.vehicleId}
                            onChange={(event) =>
                              updateDispatchDraft(
                                supplierRun.id,
                                "vehicleId",
                                event.target.value,
                              )
                            }
                            disabled={safeVehicleOptions.length === 0}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="">
                              {safeVehicleOptions.length > 0
                                ? "Select..."
                                : "No vehicles"}
                            </option>
                            {safeVehicleOptions.map((vehicleOption) => (
                              <option
                                key={vehicleOption.id}
                                value={vehicleOption.id}
                              >
                                {vehicleOption.title}
                                {vehicleOption.badge
                                  ? ` (${vehicleOption.badge})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          onClick={() => assignSupplierRun(supplierRun)}
                          disabled={savingDispatchRunId === supplierRun.id}
                          className="self-end rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {savingDispatchRunId === supplierRun.id
                            ? "Assigning..."
                            : "Assign"}
                        </button>

                        {canEditSupplierRuns ? (
                          <button
                            type="button"
                            onClick={() => setEditingSupplierRun(supplierRun)}
                            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 sm:col-span-3"
                          >
                            Edit PO
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : mode === "history" ? (
        <section>
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Completed South POs
            </p>

            <p className="mt-1 text-3xl font-black text-slate-900">
              {filteredHistoryRuns.length}
            </p>

            {historySearchTerm ? (
              <p className="mt-1 text-sm font-bold text-slate-500">
                Showing {filteredHistoryRuns.length} of {historyRuns.length}
              </p>
            ) : null}
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="south-history-search"
              className="mb-2 block text-sm font-black text-slate-700"
            >
              Search South history
            </label>
            <div className="flex items-center gap-2">
              <input
                id="south-history-search"
                type="search"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search PO, vendor, driver, item, order #..."
                className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
              {historySearch ? (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {historyRuns.length === 0 ? (
            <EmptyState
              title="No completed South POs"
              description="Completed pickups will show here by route date."
            />
          ) : filteredHistoryRuns.length === 0 ? (
            <EmptyState
              title="No South history matches"
              description="Try searching by PO number, vendor, driver, item, or date."
            />
          ) : (
            <div className="space-y-5">
              {historyDateGroups.map((dateGroup) => (
                <div
                  key={dateGroup.dateKey}
                  className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 py-1">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                        Route Date
                      </p>
                      <h4 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                        {dateGroup.label}
                      </h4>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">
                      {dateGroup.runs.length}{" "}
                      {dateGroup.runs.length === 1 ? "PO" : "POs"}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {dateGroup.driverGroups.map((group) => {
                      const driverAvatar = getDriverAvatar(group.driver);
                      const driverKey = `${dateGroup.dateKey}::${group.driver}`;
                      const driverIsOpen = isDriverOpen(
                        driverKey,
                        "history",
                      );

                      return (
                        <div
                          key={driverKey}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              toggleDriver(driverKey, "history")
                            }
                            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-slate-100"
                            aria-expanded={driverIsOpen}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black ${driverAvatar.colorClass}`}
                                aria-hidden="true"
                              >
                                {driverAvatar.initial}
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                  Driver
                                </p>

                                <h5 className="truncate text-lg font-black tracking-tight text-slate-800">
                                  {group.driver}
                                </h5>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
                                {group.vendorGroups.reduce(
                                  (count, vendorGroup) =>
                                    count + vendorGroup.runs.length,
                                  0,
                                )}{" "}
                                POs
                              </div>

                              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                                <ChevronDown
                                  aria-hidden="true"
                                  className={`h-5 w-5 transition-transform ${
                                    driverIsOpen ? "rotate-180" : ""
                                  }`}
                                  strokeWidth={2.6}
                                />
                              </span>
                            </div>
                          </button>

                          {driverIsOpen ? (
                            <div className="mt-3 space-y-4">
                              {group.vendorGroups.map((vendorGroup) => {
                                const stats =
                                  getVendorGroupStats(vendorGroup);
                                const stopKey = `${dateGroup.dateKey}::${group.driver}::${vendorGroup.vendor}`;
                                const stopIsOpen = isStopOpen(
                                  group.driver,
                                  stopKey,
                                  "history",
                                );

                                return (
                                  <div
                                    key={vendorGroup.vendor}
                                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleStop(
                                          group.driver,
                                          stopKey,
                                          "history",
                                        )
                                      }
                                      className="flex w-full min-w-0 flex-col gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                                      aria-expanded={stopIsOpen}
                                    >
                                      <div className="min-w-0">
                                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                          Stop
                                        </p>

                                        <h6 className="truncate text-base font-black text-slate-800">
                                          {vendorGroup.vendor}
                                        </h6>

                                        <p className="mt-1 text-sm font-semibold text-slate-500">
                                          {stats.poCount}{" "}
                                          {stats.poCount === 1
                                            ? "PO"
                                            : "POs"}{" "}
                                          • {stats.itemCount} items
                                        </p>
                                      </div>

                                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                                        <ChevronDown
                                          aria-hidden="true"
                                          className={`h-5 w-5 transition-transform ${
                                            stopIsOpen ? "rotate-180" : ""
                                          }`}
                                          strokeWidth={2.6}
                                        />
                                      </span>
                                    </button>

                                    {stopIsOpen ? (
                                      <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                        {vendorGroup.runs.map(
                                          (supplierRun) => (
                                            <SupplierRunCard
                                              key={supplierRun.id}
                                              supplierRun={getDisplaySupplierRun(
                                                supplierRun,
                                              )}
                                              onToggleItem={
                                                onToggleSupplierRunItem
                                              }
                                              onUpdateItemDescription={
                                                onUpdateSupplierRunItemDescription
                                              }
                                              onDelete={onDeleteSupplierRun}
                                              isCompletedSection
                                              showCustomerName={
                                                canViewSouthCustomerName
                                              }
                                              customerNameTruncate={false}
                                            />
                                          ),
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          {checkViewMode === "calendar" ? (
            <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                    <CalendarDays
                      aria-hidden="true"
                      className="h-4 w-4"
                      strokeWidth={2.4}
                    />
                    South Schedule
                  </p>

                  <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    Scheduled South POs
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeCalendarMonth(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                    aria-label="Previous month"
                  >
                    <ChevronLeft
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={2.5}
                    />
                  </button>

                  <div className="min-w-36 rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-black text-slate-900">
                    {getMonthLabel(calendarMonth)}
                  </div>

                  <button
                    type="button"
                    onClick={() => changeCalendarMonth(1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                    aria-label="Next month"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={2.5}
                    />
                  </button>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {[
                      "Sun",
                      "Mon",
                      "Tue",
                      "Wed",
                      "Thu",
                      "Fri",
                      "Sat",
                    ].map((dayLabel) => (
                      <div key={dayLabel} className="py-2">
                        {dayLabel}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                      const dayRuns = runsByDate[day.key] || [];
                      const isSelected =
                        selectedScheduleDate === day.key;

                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() =>
                            setSelectedScheduleDate(day.key)
                          }
                          className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl border text-sm font-black transition sm:min-h-16 ${
                            isSelected
                              ? "border-[#FC2C38] bg-red-50 text-[#FC2C38]"
                              : day.inCurrentMonth
                                ? "border-slate-200 bg-white text-slate-800 hover:border-red-200 hover:bg-red-50"
                                : "border-slate-100 bg-slate-50 text-slate-300"
                          }`}
                        >
                          <span
                            className={
                              day.isToday
                                ? "flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white"
                                : ""
                            }
                          >
                            {day.day}
                          </span>

                          {dayRuns.length > 0 ? (
                            <span
                              className="mt-1 h-1.5 w-1.5 rounded-full bg-[#FC2C38]"
                              aria-label={`${dayRuns.length} South POs`}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {formatDateInput(selectedScheduleDate)}
                  </p>

                  <h3 className="mt-1 text-2xl font-black text-slate-900">
                    {selectedScheduleRuns.length}{" "}
                    {selectedScheduleRuns.length === 1
                      ? "South PO"
                      : "South POs"}
                  </h3>

                  <div className="mt-4 space-y-3">
                    {selectedScheduleRuns.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                        No South POs scheduled for this date.
                      </p>
                    ) : (
                      selectedScheduleRuns.map((supplierRun) => {
                        const itemCount = Array.isArray(
                          supplierRun.items,
                        )
                          ? supplierRun.items.length
                          : 0;
                        const runCustomerName =
                          getSupplierRunCustomerName(supplierRun);

                        return (
                          <button
                            key={supplierRun.id}
                            type="button"
                            onClick={() =>
                              setViewingSupplierRun(supplierRun)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-red-200 hover:bg-red-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-lg font-black text-slate-900">
                                  {supplierRun.poNumber || "No PO #"}
                                </p>

                                <p className="mt-1 truncate text-sm font-bold text-slate-600">
                                  {supplierRun.vendor ||
                                    "Unknown Supplier"}
                                </p>

                                {canViewSouthCustomerName &&
                                runCustomerName ? (
                                  <CustomerNameBadge
                                    name={runCustomerName}
                                    prefix=""
                                    className="mt-1"
                                  />
                                ) : null}
                              </div>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                                  supplierRun.status === "complete"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {supplierRun.status === "complete"
                                  ? "Complete"
                                  : "Open"}
                              </span>
                            </div>

                            <p className="mt-2 text-xs font-bold text-slate-500">
                              Driver:{" "}
                              {supplierRun.driver || "Unassigned"} •{" "}
                              {itemCount}{" "}
                              {itemCount === 1 ? "item" : "items"}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </aside>
              </div>
            </div>
          ) : null}

          {checkViewMode === "list" ? (
          <>

          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <label
              htmlFor="south-pickup-search"
              className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
            >
              Search POs To Pick Up
            </label>

            <div className="flex items-center gap-2">
              <span className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.4}
                />
                <input
                  id="south-pickup-search"
                  type="search"
                  value={pickupSearch}
                  onChange={(event) => setPickupSearch(event.target.value)}
                  placeholder={
                    canViewSouthCustomerName
                      ? "Search PO #, customer, or item #"
                      : "Search PO # or item #"
                  }
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />
              </span>

              {pickupSearch ? (
                <button
                  type="button"
                  onClick={() => setPickupSearch("")}
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-2 py-3 text-center sm:px-4 sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-blue-700 sm:text-xs sm:tracking-[0.18em]">
                Open Stops
              </p>

              <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                {openStopsCount}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-2 py-3 text-center sm:px-4 sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-700 sm:text-xs sm:tracking-[0.18em]">
                Items Left
              </p>

              <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                {openItemsCount}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-2 py-3 text-center sm:px-4 sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700 sm:text-xs sm:tracking-[0.18em]">
                Completed POs
              </p>

              <p className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                {completeRuns.length}
              </p>
            </div>
          </div>

          {visibleRuns.length === 0 ? (
            <EmptyState
              title="No South POs scheduled for this date"
              description="Choose another date on the calendar to view scheduled South pickups."
            />
          ) : null}

          {visibleRuns.length > 0 && filteredVisibleRuns.length === 0 ? (
            <EmptyState
              title="No South POs match that search"
              description={
                canViewSouthCustomerName
                  ? "Search by PO number, customer name, or item number."
                  : "Search by PO number or item number."
              }
            />
          ) : null}

          {openRuns.length > 0 ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900">
                    Open Stops
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Work these first. Stops are grouped by driver, then supplier.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {openRunGroups.map((driverGroup) => {
                  const driverStats = getDriverStatsForRuns(
                    driverGroup.driver,
                    filteredVisibleRuns,
                  );
                  const driverAvatar = getDriverAvatar(
                    driverGroup.driver,
                  );
                  const driverIsOpen = isDriverOpen(
                    driverGroup.driver,
                  );
                  const vehicleLabel =
                    getDriverGroupVehicleLabel(driverGroup);
                  const driverPoCount =
                    driverGroup.vendorGroups.reduce(
                      (count, vendorGroup) =>
                        count + vendorGroup.runs.length,
                      0,
                    );

                  return (
                    <div
                      key={driverGroup.driver}
                      className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3 shadow-sm ring-1 ring-blue-100 sm:p-4"
                    >
                      <button
                        type="button"
                        onClick={() => toggleDriver(driverGroup.driver)}
                        className="mb-4 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-blue-50"
                        aria-expanded={driverIsOpen}
                      >
                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black ${driverAvatar.colorClass}`}
                              aria-hidden="true"
                            >
                              {driverAvatar.initial}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="hidden text-xs font-black uppercase tracking-[0.2em] text-blue-700 sm:block">
                                Driver Route
                              </p>

                              <div className="flex min-w-0 items-center gap-2 sm:mt-1">
                                <h4 className="min-w-0 flex-1 truncate text-2xl font-black tracking-tight text-slate-900">
                                  {driverGroup.driver}
                                </h4>

                                <span className="shrink-0 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-800 sm:hidden">
                                  {driverPoCount}{" "}
                                  {driverPoCount === 1 ? "PO" : "POs"}
                                </span>

                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm sm:hidden">
                                  <ChevronDown
                                    aria-hidden="true"
                                    className={`h-5 w-5 transition-transform ${
                                      driverIsOpen ? "rotate-180" : ""
                                    }`}
                                    strokeWidth={2.6}
                                  />
                                </span>
                              </div>

                              {vehicleLabel ? (
                                <p className="mt-1 text-sm font-black text-slate-500">
                                  Truck {vehicleLabel}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="hidden shrink-0 items-center gap-2 sm:flex">
                            <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-800">
                              {driverPoCount}{" "}
                              {driverPoCount === 1 ? "PO" : "POs"}
                            </div>

                            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm">
                              <ChevronDown
                                aria-hidden="true"
                                className={`h-5 w-5 transition-transform ${
                                  driverIsOpen ? "rotate-180" : ""
                                }`}
                                strokeWidth={2.6}
                              />
                            </span>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
                            <span className="text-slate-500">
                              Route Progress
                            </span>

                            <span className="text-emerald-700">
                              {driverStats.progressPercent}%
                            </span>
                          </div>

                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all"
                              style={{
                                width: `${driverStats.progressPercent}%`,
                              }}
                            />
                          </div>

                          <p className="mt-2 text-xs font-bold text-slate-500">
                            {driverStats.pickedUpItems}/
                            {driverStats.itemCount} items picked up
                            {driverStats.remainingItems > 0
                              ? ` • ${driverStats.remainingItems} left`
                              : " • complete"}
                          </p>
                        </div>
                      </button>

                      {routeOrderError ? (
                        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                          {routeOrderError}
                        </div>
                      ) : null}

                    {driverIsOpen ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 px-1">
                        <h5 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">
                          Stops
                        </h5>
                        <span className="text-xs font-bold text-slate-400">
                          {driverGroup.vendorGroups.length}{" "}
                          {driverGroup.vendorGroups.length === 1
                            ? "stop"
                            : "stops"}
                        </span>
                      </div>

                      {driverGroup.vendorGroups.map((vendorGroup, vendorIndex) => {
                        const stats = getVendorGroupStats(vendorGroup);
                        const supplierAddress =
                          getVendorGroupAddress(vendorGroup);
                        const stopIsOpen = isStopOpen(
                          driverGroup.driver,
                          vendorGroup.vendor,
                        );

                        return (
                          <div
                            key={vendorGroup.vendor}
                            draggable={
                              canReorderRoute &&
                              driverGroup.vendorGroups.length > 1
                            }
                            onDragStart={() =>
                              canReorderRoute
                                ? setDraggingStop({
                                    driver: driverGroup.driver,
                                    vendor: vendorGroup.vendor,
                                  })
                                : undefined
                            }
                            onDragOver={(event) => {
                              if (
                                draggingStop?.driver === driverGroup.driver
                              ) {
                                event.preventDefault();
                              }
                            }}
                            onDrop={() =>
                              handleStopDrop(
                                driverGroup.driver,
                                vendorGroup.vendor,
                                driverGroup.vendorGroups,
                              )
                            }
                            onDragEnd={() => setDraggingStop(null)}
                            className={`overflow-hidden rounded-xl border bg-white transition ${
                              draggingStop?.driver === driverGroup.driver &&
                              draggingStop?.vendor === vendorGroup.vendor
                                ? "border-blue-300 opacity-60"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-stretch gap-2">
                              {canReorderRoute &&
                              driverGroup.vendorGroups.length > 1 ? (
                                <div
                                  className="flex w-11 shrink-0 flex-col items-center justify-center gap-1 border-r border-slate-100 bg-slate-50 px-1 sm:w-10 sm:cursor-grab sm:px-0 sm:active:cursor-grabbing"
                                  title="Drag to reorder this stop"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMoveStop(
                                        driverGroup.driver,
                                        driverGroup.vendorGroups,
                                        vendorGroup.vendor,
                                        -1,
                                      )
                                    }
                                    disabled={vendorIndex === 0}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 sm:hidden"
                                    aria-label={`Move ${vendorGroup.vendor} earlier in route`}
                                  >
                                    <ArrowUp
                                      aria-hidden="true"
                                      className="h-4 w-4"
                                      strokeWidth={2.6}
                                    />
                                  </button>

                                  <GripVertical
                                    aria-hidden="true"
                                    className="hidden h-5 w-5 text-slate-400 sm:block"
                                    strokeWidth={2.4}
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMoveStop(
                                        driverGroup.driver,
                                        driverGroup.vendorGroups,
                                        vendorGroup.vendor,
                                        1,
                                      )
                                    }
                                    disabled={
                                      vendorIndex ===
                                      driverGroup.vendorGroups.length - 1
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 sm:hidden"
                                    aria-label={`Move ${vendorGroup.vendor} later in route`}
                                  >
                                    <ArrowDown
                                      aria-hidden="true"
                                      className="h-4 w-4"
                                      strokeWidth={2.6}
                                    />
                                  </button>
                                </div>
                              ) : null}

                              <button
                                type="button"
                                onClick={() =>
                                  toggleStop(
                                    driverGroup.driver,
                                    vendorGroup.vendor,
                                  )
                                }
                                className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3 text-left transition hover:bg-red-50/40 sm:flex-row sm:items-center sm:justify-between"
                                aria-expanded={stopIsOpen}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={`h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-50 text-[#FC2C38] ${
                                      shouldShowMobileStopIcon
                                        ? "flex"
                                        : "hidden sm:flex"
                                    }`}
                                  >
                                    <Home
                                      aria-hidden="true"
                                      className="h-7 w-7"
                                      strokeWidth={2.5}
                                    />
                                  </span>

                                  <div className="min-w-0">
                                    <h5 className="truncate text-xl font-black text-slate-900">
                                      {vendorGroup.vendor}
                                    </h5>

                                    <p className="mt-1 text-sm font-bold text-slate-500">
                                      {stats.poCount}{" "}
                                      {stats.poCount === 1 ? "PO" : "POs"} •{" "}
                                      {stats.remainingItems}{" "}
                                      {stats.remainingItems === 1
                                        ? "item"
                                        : "items"}{" "}
                                      left
                                    </p>
                                  </div>
                                </div>
                              </button>

                              <div className="flex shrink-0 flex-col items-end justify-center gap-2.5 py-4 pr-4 sm:flex-row sm:items-center sm:gap-2 sm:py-0 sm:pr-5">
                                {supplierAddress ? (
                                  <a
                                    href={getDirectionsUrl(
                                      supplierAddress,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-[#FC2C38] px-3.5 text-[11px] font-black text-white shadow-sm transition hover:bg-[#dc1f2b] sm:px-4 sm:text-xs"
                                    aria-label={`Directions to ${vendorGroup.vendor}`}
                                  >
                                    <ArrowUpRight
                                      aria-hidden="true"
                                      className="h-3.5 w-3.5"
                                      strokeWidth={2.6}
                                    />
                                    <span>Directions</span>
                                  </a>
                                ) : null}

                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <span className="inline-flex rounded-lg bg-white px-2.5 py-1.5 text-xs font-black text-blue-800 shadow-sm sm:px-3">
                                    {stats.poCount}{" "}
                                    {stats.poCount === 1
                                      ? "PO"
                                      : "POs"}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleStop(
                                        driverGroup.driver,
                                        vendorGroup.vendor,
                                      )
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                                    aria-label={
                                      stopIsOpen
                                        ? `Close ${vendorGroup.vendor}`
                                        : `Open ${vendorGroup.vendor}`
                                    }
                                    aria-expanded={stopIsOpen}
                                  >
                                    <ChevronDown
                                      aria-hidden="true"
                                      className={`h-5 w-5 transition-transform ${
                                        stopIsOpen ? "rotate-180" : ""
                                      }`}
                                      strokeWidth={2.6}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {stopIsOpen ? (
                              <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                {vendorGroup.runs.map((supplierRun) => (
                                  <SupplierRunCard
                                    key={supplierRun.id}
                                    supplierRun={getDisplaySupplierRun(
                                      supplierRun,
                                    )}
                                    onToggleItem={
                                      onToggleSupplierRunItem
                                    }
                                    onUpdateItemDescription={
                                      onUpdateSupplierRunItemDescription
                                    }
                                    onEdit={
                                      canEditSupplierRuns
                                        ? setEditingSupplierRun
                                        : undefined
                                    }
                                    onDelete={onDeleteSupplierRun}
                                    showCustomerName={
                                      canViewSouthCustomerName
                                    }
                                    defaultItemsOpen={
                                      vendorGroup.runs.length === 1
                                    }
                                    compactWhenClosed={
                                      vendorGroup.runs.length > 1
                                    }
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            </div>
          ) : visibleRuns.length > 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5">
              <p className="text-lg font-black text-emerald-900">
                All South POs are checked off.
              </p>

              <p className="mt-1 text-sm font-semibold text-emerald-700">
                Completed stops are listed below for reference.
              </p>
            </div>
          ) : null}

          {completeRuns.length > 0 ? (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-800">
                    Completed Today
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Completed South pickups are also saved in History.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {completeRunGroups.map((driverGroup) => {
                  const driverAvatar = getDriverAvatar(
                    driverGroup.driver,
                  );
                  const driverIsOpen = isDriverOpen(
                    driverGroup.driver,
                    "complete",
                  );

                  return (
                    <div
                      key={driverGroup.driver}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleDriver(driverGroup.driver, "complete")
                        }
                        className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-slate-100"
                        aria-expanded={driverIsOpen}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black ${driverAvatar.colorClass}`}
                            aria-hidden="true"
                          >
                            {driverAvatar.initial}
                          </div>

                          <h4 className="truncate text-lg font-black tracking-tight text-slate-800">
                            {driverGroup.driver}
                          </h4>
                        </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
                          {driverGroup.vendorGroups.reduce(
                            (count, vendorGroup) =>
                              count + vendorGroup.runs.length,
                            0,
                          )}{" "}
                          POs
                        </div>

                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                          <ChevronDown
                            aria-hidden="true"
                            className={`h-5 w-5 transition-transform ${
                              driverIsOpen ? "rotate-180" : ""
                            }`}
                            strokeWidth={2.6}
                          />
                        </span>
                      </div>
                    </button>

                    {driverIsOpen ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3 px-1">
                        <h5 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">
                          Stops
                        </h5>
                        <span className="text-xs font-bold text-slate-400">
                          {driverGroup.vendorGroups.length}{" "}
                          {driverGroup.vendorGroups.length === 1
                            ? "stop"
                            : "stops"}
                        </span>
                      </div>

                      {driverGroup.vendorGroups.map((vendorGroup) => {
                        const stats = getVendorGroupStats(vendorGroup);
                        const supplierAddress =
                          getVendorGroupAddress(vendorGroup);
                        const stopIsOpen = isStopOpen(
                          driverGroup.driver,
                          vendorGroup.vendor,
                          "complete",
                        );

                        return (
                          <div
                            key={vendorGroup.vendor}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleStop(
                                    driverGroup.driver,
                                    vendorGroup.vendor,
                                    "complete",
                                  )
                                }
                                className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3 text-left transition hover:bg-red-50/40 sm:flex-row sm:items-center sm:justify-between"
                                aria-expanded={stopIsOpen}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={`h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-50 text-[#FC2C38] ${
                                      shouldShowMobileStopIcon
                                        ? "flex"
                                        : "hidden sm:flex"
                                    }`}
                                  >
                                    <Home
                                      aria-hidden="true"
                                      className="h-7 w-7"
                                      strokeWidth={2.5}
                                    />
                                  </span>

                                  <div className="min-w-0">
                                    <h5 className="truncate text-lg font-black text-slate-800">
                                      {vendorGroup.vendor}
                                    </h5>

                                    <p className="mt-1 text-sm font-bold text-emerald-700">
                                      {stats.poCount}{" "}
                                      {stats.poCount === 1 ? "PO" : "POs"} •{" "}
                                      {stats.itemCount}{" "}
                                      {stats.itemCount === 1
                                        ? "item"
                                        : "items"}{" "}
                                      complete
                                    </p>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="inline-flex rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm">
                                    {stats.poCount}{" "}
                                    {stats.poCount === 1
                                      ? "PO"
                                      : "POs"}
                                  </span>

                                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                                    <ChevronDown
                                      aria-hidden="true"
                                      className={`h-5 w-5 transition-transform ${
                                        stopIsOpen ? "rotate-180" : ""
                                      }`}
                                      strokeWidth={2.6}
                                    />
                                  </span>
                                </div>
                              </button>

                              {supplierAddress ? (
                                <a
                                  href={getDirectionsUrl(supplierAddress)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mx-3 mb-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#dc1f2b] sm:mx-0 sm:my-3 sm:mr-3"
                                >
                                  Directions
                                  <ArrowUpRight
                                    aria-hidden="true"
                                    className="h-4 w-4"
                                    strokeWidth={2.6}
                                  />
                                </a>
                              ) : null}
                            </div>

                            {stopIsOpen ? (
                              <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                {vendorGroup.runs.map((supplierRun) => (
                                  <SupplierRunCard
                                    key={supplierRun.id}
                                    supplierRun={getDisplaySupplierRun(
                                      supplierRun,
                                    )}
                                    onToggleItem={onToggleSupplierRunItem}
                                    onUpdateItemDescription={
                                      onUpdateSupplierRunItemDescription
                                    }
                                    onDelete={onDeleteSupplierRun}
                                    isCompletedSection
                                    showCustomerName={
                                      canViewSouthCustomerName
                                    }
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          </>
          ) : null}
        </section>
      )}

      {editingSupplierRun && canEditSupplierRuns ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close PO editor"
            onClick={() => setEditingSupplierRun(null)}
          />

          <section
            className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-w-5xl sm:rounded-3xl"
            aria-modal="true"
            role="dialog"
            aria-label={`Edit South PO ${
              editingSupplierRun.poNumber || ""
            }`.trim()}
          >
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Edit South PO
                </p>
                <h3 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900">
                  {editingSupplierRun.poNumber || "No PO #"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setEditingSupplierRun(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Close PO editor"
              >
                <X
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={2.5}
                />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <SupplierRunForm
                onSubmit={handleEditSubmit}
                createdBy={createdBy}
                vehicleOptions={safeVehicleOptions}
                vendorOptions={vendorOptions}
                supplierAddressMap={supplierAddressMap}
                canAssignRoute={
                  editingSupplierRun.dispatchStatus !== "needsDispatch"
                }
                initialSupplierRun={getDisplaySupplierRun(editingSupplierRun)}
                onCancel={() => setEditingSupplierRun(null)}
              />
            </div>
          </section>
        </div>
      ) : null}

      {selectedSupplierRunDetails ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close PO details"
            onClick={() => setViewingSupplierRun(null)}
          />

          <section
            className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
            aria-modal="true"
            role="dialog"
            aria-labelledby="south-po-detail-title"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  South PO Details
                </p>

                <h3
                  id="south-po-detail-title"
                  className="mt-1 truncate text-3xl font-black tracking-tight text-slate-900"
                >
                  {selectedSupplierRunDetails.poNumber || "No PO #"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setViewingSupplierRun(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Close PO details"
              >
                <X
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={2.5}
                />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Supplier
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {selectedSupplierRunDetails.vendor ||
                      "Unknown Supplier"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Driver
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {selectedSupplierRunDetails.driver || "Unassigned"}
                  </p>
                </div>

                {canViewSouthCustomerName &&
                getSupplierRunCustomerName(selectedSupplierRunDetails) ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <CustomerNameBadge
                      name={getSupplierRunCustomerName(
                        selectedSupplierRunDetails,
                      )}
                      className="text-sm"
                    />
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Pickup Date
                  </p>

                  {canMoveSelectedSupplierRunDate ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="date"
                        value={dateMoveDraft}
                        onChange={(event) => {
                          setDateMoveDraft(event.target.value);
                          setDateMoveError("");
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />

                      <button
                        type="button"
                        onClick={handleMoveSelectedSupplierRunDate}
                        disabled={
                          savingDateMove ||
                          dateMoveDraft ===
                            getSupplierRunDateKey(
                              selectedSupplierRunDetails,
                            )
                        }
                        className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white transition hover:bg-[#dc1f2b] disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {savingDateMove ? "Moving..." : "Move PO Date"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-lg font-black text-slate-900">
                        {formatDateInput(
                          getSupplierRunDateKey(
                            selectedSupplierRunDetails,
                          ),
                        )}
                      </p>

                      {selectedSupplierRunDateIsLocked ? (
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Date locked after pickup starts.
                        </p>
                      ) : null}
                    </>
                  )}

                  {dateMoveError ? (
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      {dateMoveError}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Status
                  </p>
                  <p
                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                      selectedSupplierRunDetails.status === "complete"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {selectedSupplierRunDetails.status === "complete"
                      ? "Complete"
                      : "Open"}
                  </p>
                </div>
              </div>

              {selectedSupplierRunDetails.supplierAddress ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Address
                  </p>

                  <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-bold text-slate-800">
                      {selectedSupplierRunDetails.supplierAddress}
                    </p>

                    <a
                      href={getDirectionsUrl(
                        selectedSupplierRunDetails.supplierAddress,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-2 text-sm font-black text-white transition hover:bg-[#dc1f2b]"
                    >
                      Directions
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={2.6}
                      />
                    </a>
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Pickup Items
                    </p>

                    <h4 className="mt-1 text-xl font-black text-slate-900">
                      {Array.isArray(selectedSupplierRunDetails.items)
                        ? selectedSupplierRunDetails.items.length
                        : 0}{" "}
                      items
                    </h4>
                  </div>
                </div>

                <div className="space-y-3">
                  {Array.isArray(selectedSupplierRunDetails.items) &&
                  selectedSupplierRunDetails.items.length > 0 ? (
                    selectedSupplierRunDetails.items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          item.pickedUp
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            {item.quantity ? (
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                                QTY: {item.quantity}
                              </p>
                            ) : null}

                            <p className="mt-1 text-base font-black text-slate-900">
                              {item.description || "No description"}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                              {item.internalReference ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                  SKU / SO: {item.internalReference}
                                </span>
                              ) : null}

                              <span
                                className={`rounded-full px-3 py-1 ${getMaterialUseBadgeClass(
                                  item.materialUse,
                                )}`}
                              >
                                {getMaterialUseLabel(item.materialUse)}
                                {item.orderNumber
                                  ? ` ${item.orderNumber}`
                                  : ""}
                              </span>
                            </div>

                            {item.returnNotes ? (
                              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                                  Return / swap notes
                                </p>
                                <p className="mt-1">{item.returnNotes}</p>
                              </div>
                            ) : null}
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                              item.pickedUp
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {item.pickedUp
                              ? "Picked Up"
                              : item.materialUse === "return"
                                ? "Needs Returned"
                                : item.materialUse === "swap"
                                  ? "Needs Swapped"
                                  : "Needs Pickup"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-slate-500">
                      No items listed on this PO.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </PageContainer>
  );
}
