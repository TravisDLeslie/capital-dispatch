import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Mail,
  MapPin,
  Package,
  Phone,
  Route,
  Search,
  Truck,
  UserRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { formatCustomerName } from "../utils/textFormatters";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeVendorName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function formatDateTime(value) {
  if (!value) {
    return "Time not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) {
    return "";
  }

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getItemText(item) {
  return [item.quantity, item.description].filter(Boolean).join(" ");
}

function getAssignment(checkIn) {
  if (checkIn.orderAssignment?.type) {
    return checkIn.orderAssignment;
  }

  if (checkIn.customer?.businessName) {
    return checkIn.customer;
  }

  return null;
}

const RECEIVING_STATUS_STAMPS = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  partial: "border-orange-200 bg-orange-50 text-orange-700",
  received: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function getReceivedMaterialCount(checkIn) {
  if (Array.isArray(checkIn?.materials)) {
    return checkIn.materials.length;
  }

  if (Array.isArray(checkIn?.items)) {
    return checkIn.items.length;
  }

  return 0;
}

function checkInMatchesPO(checkIn, poNumber) {
  const normalizedPO = normalizeNumber(poNumber);

  if (!normalizedPO) {
    return false;
  }

  return [
    checkIn?.poNumber,
    checkIn?.sourceSupplierRunPoNumber,
    checkIn?.sourceTheirTruckPONumber,
  ]
    .filter(Boolean)
    .some((value) => normalizeNumber(value) === normalizedPO);
}

function getReceivingStatusForPO(checkIns, poNumber, expectedItemCount = 0) {
  const matches = Array.isArray(checkIns)
    ? checkIns.filter((checkIn) => checkInMatchesPO(checkIn, poNumber))
    : [];

  if (matches.length === 0) {
    return {
      key: "pending",
      label: "Pending Check-In",
      className: RECEIVING_STATUS_STAMPS.pending,
      checkedInAt: "",
    };
  }

  const receivedItemCount = matches.reduce(
    (total, checkIn) => total + getReceivedMaterialCount(checkIn),
    0,
  );
  const latestCheckIn = [...matches].sort(
    (firstCheckIn, secondCheckIn) =>
      new Date(secondCheckIn.checkedInAt || secondCheckIn.createdAt || 0) -
      new Date(firstCheckIn.checkedInAt || firstCheckIn.createdAt || 0),
  )[0];

  if (expectedItemCount > 0 && receivedItemCount < expectedItemCount) {
    return {
      key: "partial",
      label: "Partial Check-In",
      className: RECEIVING_STATUS_STAMPS.partial,
      checkedInAt: latestCheckIn?.checkedInAt || latestCheckIn?.createdAt || "",
    };
  }

  return {
    key: "received",
    label: "Checked In",
    className: RECEIVING_STATUS_STAMPS.received,
    checkedInAt: latestCheckIn?.checkedInAt || latestCheckIn?.createdAt || "",
  };
}

function getTracePOStatusCards(traceResults, checkIns) {
  const cards = new Map();

  traceResults.supplierRuns.forEach((supplierRun) => {
    const poNumber = supplierRun.poNumber || "";
    const items = Array.isArray(supplierRun.items) ? supplierRun.items : [];

    if (!poNumber) {
      return;
    }

    cards.set(`south-${normalizeNumber(poNumber) || poNumber}`, {
      id: `south-${supplierRun.id || poNumber}`,
      source: "South",
      poNumber,
      vendor: supplierRun.vendor || "Supplier",
      status: getReceivingStatusForPO(checkIns, poNumber, items.length),
    });
  });

  traceResults.theirTruckPOs.forEach((theirTruckPO) => {
    const poNumber = theirTruckPO.poNumber || "";
    const items = Array.isArray(theirTruckPO.items) ? theirTruckPO.items : [];

    if (!poNumber) {
      return;
    }

    cards.set(`their-${normalizeNumber(poNumber) || poNumber}`, {
      id: `their-${theirTruckPO.id || poNumber}`,
      source: "Their Truck",
      poNumber,
      vendor: theirTruckPO.vendor || "Vendor",
      status: getReceivingStatusForPO(checkIns, poNumber, items.length),
    });
  });

  traceResults.checkIns.forEach((checkIn) => {
    const poNumber =
      checkIn.poNumber ||
      checkIn.sourceSupplierRunPoNumber ||
      checkIn.sourceTheirTruckPONumber ||
      "";

    if (!poNumber) {
      return;
    }

    const key = `received-${normalizeNumber(poNumber) || poNumber}`;

    if ([...cards.values()].some((card) => normalizeNumber(card.poNumber) === normalizeNumber(poNumber))) {
      return;
    }

    cards.set(key, {
      id: `received-${checkIn.id || poNumber}`,
      source: "Receiving",
      poNumber,
      vendor: checkIn.vendor || "Vendor",
      status: {
        key: "received",
        label: "Checked In",
        className: RECEIVING_STATUS_STAMPS.received,
        checkedInAt: checkIn.checkedInAt || checkIn.createdAt || "",
      },
    });
  });

  return [...cards.values()];
}

function getSearchableText(record) {
  return normalizeText(
    [
      record.poNumber,
      record.sourceSupplierRunPoNumber,
      record.sourceTheirTruckPONumber,
      record.orderNumber,
      record.vendor,
      record.sourceTheirTruckVendor,
      record.customerName,
      record.sourceTheirTruckCustomerName,
      record.supplierAddress,
      record.driver,
      record.checkedInBy,
      record.poLocation,
      record.deliveryAddress,
      record.contactName,
      record.phoneNumber,
      record.generalNotes,
      record.deliveryLocationNotes,
      record.createdByName,
      record.orderedBy,
      record.orderAssignment?.businessName,
      record.orderAssignment?.orderedBy,
      record.orderAssignment?.jobName,
      record.orderAssignment?.internalReference,
      record.sourceTheirTruckOrderNumber,
      ...(Array.isArray(record.items)
        ? record.items.flatMap((item) => [
            item.quantity,
            item.description,
            item.internalReference,
            item.sku,
            item.itemNumber,
            item.itemNo,
            item.soNumber,
            item.stockNumber,
            item.productCode,
            item.name,
            item.notes,
            item.orderNumber,
            item.customerName,
            item.returnNotes,
          ])
        : []),
      ...(Array.isArray(record.materials)
        ? record.materials.flatMap((material) => [
            material.description,
            material.location,
            material.notes,
            material.internalReference,
            material.sku,
            material.itemNumber,
            material.itemNo,
            material.soNumber,
          ])
        : []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function recordMatchesSearch(record, searchValue) {
  const textSearch = normalizeText(searchValue);
  const numberSearch = normalizeNumber(searchValue);

  if (!textSearch) {
    return false;
  }

  const textMatches = getSearchableText(record).includes(textSearch);
  const numberMatches =
    numberSearch.length > 0 &&
    [
      record.poNumber,
      record.sourceSupplierRunPoNumber,
      record.sourceTheirTruckPONumber,
      record.orderNumber,
      ...(Array.isArray(record.items)
        ? record.items.flatMap((item) => [
            item.orderNumber,
            item.internalReference,
            item.sku,
            item.itemNumber,
            item.itemNo,
            item.soNumber,
            item.stockNumber,
            item.productCode,
          ])
        : []),
      ...(Array.isArray(record.materials)
        ? record.materials.flatMap((material) => [
            material.internalReference,
            material.sku,
            material.itemNumber,
            material.itemNo,
            material.soNumber,
          ])
        : []),
      record.orderAssignment?.internalReference,
    ]
      .filter(Boolean)
      .some((value) => normalizeNumber(value).includes(numberSearch));

  return textMatches || numberMatches;
}

function recordMatchesVendor(record, vendorName) {
  const normalizedVendor = normalizeVendorName(vendorName);

  if (!normalizedVendor) {
    return false;
  }

  return [record?.vendor, record?.sourceTheirTruckVendor]
    .filter(Boolean)
    .some((value) => normalizeVendorName(value) === normalizedVendor);
}

function getRecordDate(record, source) {
  if (source === "south") {
    return (
      record.scheduledDate ||
      record.pickupDate ||
      record.completedAt ||
      record.updatedAt ||
      record.createdAt ||
      ""
    );
  }

  return (
    record.deliveryDate ||
    record.completedAt ||
    record.updatedAt ||
    record.createdAt ||
    ""
  );
}

function isPOComplete(record) {
  return Boolean(record?.status === "complete" || record?.completedAt);
}

function checkInMatchesVendorPO(checkIn, record, source) {
  if (source === "south" && checkIn?.sourceSupplierRunId === record?.id) {
    return true;
  }

  if (
    source === "theirTruck" &&
    checkIn?.sourceTheirTruckPOId === record?.id
  ) {
    return true;
  }

  if (checkIn?.sourceType && checkIn.sourceType !== source) {
    return false;
  }

  const recordPO = normalizeNumber(record?.poNumber);

  return Boolean(
    recordPO &&
      [
        checkIn?.poNumber,
        checkIn?.sourceSupplierRunPoNumber,
        checkIn?.sourceTheirTruckPONumber,
      ].some((value) => normalizeNumber(value) === recordPO),
  );
}

function getVendorPOCards(supplierRuns, theirTruckPOs, checkIns = []) {
  return [
    ...supplierRuns.map((supplierRun) => ({
      id: `south-${supplierRun.id}`,
      source: "south",
      sourceLabel: "South",
      poNumber: supplierRun.poNumber || "No PO #",
      date: getRecordDate(supplierRun, "south"),
      complete: isPOComplete(supplierRun),
      driver: supplierRun.driver || "",
      customerName:
        supplierRun.customerName ||
        supplierRun.items?.find((item) => item.customerName)?.customerName ||
        "",
      orderNumber:
        supplierRun.orderNumber ||
        supplierRun.items?.find((item) => item.orderNumber)?.orderNumber ||
        "",
      address: supplierRun.supplierAddress || "",
      orderedBy: supplierRun.orderedBy || "",
      createdBy:
        supplierRun.createdByName || supplierRun.createdByEmail || "",
      createdAt: supplierRun.createdAt || "",
      completedAt:
        supplierRun.completedAt || supplierRun.stopCompletedAt || "",
      arrivedAt: supplierRun.stopArrivedAt || "",
      vehicle: [supplierRun.vehicleTitle, supplierRun.vehicleBadge]
        .filter(Boolean)
        .join(" · "),
      dispatchStatus: supplierRun.dispatchStatus || "",
      notes:
        supplierRun.driverNotes ||
        supplierRun.notes ||
        supplierRun.generalNotes ||
        "",
      items: Array.isArray(supplierRun.items) ? supplierRun.items : [],
      checkIns: checkIns.filter((checkIn) =>
        checkInMatchesVendorPO(checkIn, supplierRun, "south"),
      ),
    })),
    ...theirTruckPOs.map((theirTruckPO) => ({
      id: `their-truck-${theirTruckPO.id}`,
      source: "theirTruck",
      sourceLabel: "Their Truck",
      poNumber: theirTruckPO.poNumber || "No PO #",
      date: getRecordDate(theirTruckPO, "theirTruck"),
      complete: isPOComplete(theirTruckPO),
      driver: "",
      customerName: theirTruckPO.isStock
        ? "Stock"
        : theirTruckPO.customerName || "",
      orderNumber: theirTruckPO.orderNumber || "",
      address: theirTruckPO.vendorAddress || "",
      orderedBy: theirTruckPO.orderedBy || "",
      createdBy:
        theirTruckPO.createdByName || theirTruckPO.createdByEmail || "",
      createdAt: theirTruckPO.createdAt || "",
      completedAt: theirTruckPO.completedAt || "",
      arrivedAt: "",
      vehicle: "",
      dispatchStatus: "",
      notes: theirTruckPO.vendorDeliveryNotes || "",
      items: Array.isArray(theirTruckPO.items) ? theirTruckPO.items : [],
      checkIns: checkIns.filter((checkIn) =>
        checkInMatchesVendorPO(checkIn, theirTruckPO, "theirTruck"),
      ),
    })),
  ].sort((firstPO, secondPO) => {
    if (firstPO.complete !== secondPO.complete) {
      return firstPO.complete ? 1 : -1;
    }

    return String(secondPO.date || "").localeCompare(String(firstPO.date || ""));
  });
}

function vendorPOCardMatchesSearch(card, searchValue) {
  const textSearch = normalizeText(searchValue);
  const numberSearch = normalizeNumber(searchValue);

  if (!textSearch) {
    return true;
  }

  const items = Array.isArray(card?.items) ? card.items : [];
  const searchableValues = [
    card?.poNumber,
    card?.orderNumber,
    card?.customerName,
    card?.driver,
    card?.vehicle,
    card?.address,
    card?.orderedBy,
    card?.createdBy,
    card?.notes,
    ...items.flatMap((item) => [
      item.quantity,
      item.description,
      item.internalReference,
      item.sku,
      item.itemNumber,
      item.itemNo,
      item.soNumber,
      item.stockNumber,
      item.productCode,
      item.orderNumber,
      item.customerName,
      item.notes,
      item.returnNotes,
    ]),
  ].filter(Boolean);
  const textMatches = normalizeText(searchableValues.join(" ")).includes(
    textSearch,
  );
  const numberMatches =
    Boolean(numberSearch) &&
    searchableValues.some((value) =>
      normalizeNumber(value).includes(numberSearch),
    );

  return textMatches || numberMatches;
}

function makeEvent({
  id,
  type,
  title,
  description,
  timestamp,
  meta = [],
  recordType,
  recordId,
}) {
  return {
    id,
    type,
    title,
    description,
    timestamp,
    meta: meta.filter(Boolean),
    recordType,
    recordId,
  };
}

function getEventTone(type) {
  if (type === "south") {
    return {
      icon: Route,
      dot: "bg-blue-600",
      badge: "bg-blue-50 text-blue-700",
      border: "border-blue-100",
    };
  }

  if (type === "delivery") {
    return {
      icon: Truck,
      dot: "bg-amber-600",
      badge: "bg-amber-50 text-amber-800",
      border: "border-amber-100",
    };
  }

  if (type === "theirTruck") {
    return {
      icon: Package,
      dot: "bg-indigo-600",
      badge: "bg-indigo-50 text-indigo-700",
      border: "border-indigo-100",
    };
  }

  return {
    icon: ClipboardCheck,
    dot: "bg-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-100",
  };
}

/**
 * @param {{
 *   checkIns?: Array<Record<string, any>>;
 *   supplierRuns?: Array<Record<string, any>>;
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   deliveries?: Array<Record<string, any>>;
 *   vendors?: Array<Record<string, any>>;
 *   initialSearch?: string;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function TracePage({
  checkIns = [],
  supplierRuns = [],
  theirTruckPOs = [],
  deliveries = [],
  vendors = [],
  initialSearch = "",
  onPageChange,
}) {
  const [searchValue, setSearchValue] = useState(initialSearch);
  const hasSearch = searchValue.trim().length > 0;

  useEffect(() => {
    setSearchValue(initialSearch);
  }, [initialSearch]);

  const vendorDirectory = useMemo(() => {
    const directory = new Map();

    vendors.forEach((vendor) => {
      const key = normalizeVendorName(vendor?.name);

      if (key) {
        directory.set(key, { ...vendor, name: vendor.name });
      }
    });

    [...supplierRuns, ...theirTruckPOs].forEach((record) => {
      const vendorName = String(record?.vendor || "").trim();
      const key = normalizeVendorName(vendorName);

      if (key && !directory.has(key)) {
        directory.set(key, { name: vendorName, contacts: [] });
      }
    });

    return [...directory.values()].sort((firstVendor, secondVendor) =>
      firstVendor.name.localeCompare(secondVendor.name, undefined, {
        sensitivity: "base",
      }),
    );
  }, [supplierRuns, theirTruckPOs, vendors]);
  const selectedVendor = useMemo(() => {
    const normalizedSearch = normalizeVendorName(searchValue);

    return vendorDirectory.find(
      (vendor) => normalizeVendorName(vendor.name) === normalizedSearch,
    );
  }, [searchValue, vendorDirectory]);
  const vendorSuggestions = useMemo(() => {
    const normalizedSearch = normalizeVendorName(searchValue);

    if (!normalizedSearch || selectedVendor) {
      return [];
    }

    return vendorDirectory
      .filter((vendor) =>
        normalizeVendorName(vendor.name).includes(normalizedSearch),
      )
      .slice(0, 6);
  }, [searchValue, selectedVendor, vendorDirectory]);

  const traceResults = useMemo(() => {
    if (!hasSearch) {
      return {
        supplierRuns: [],
        theirTruckPOs: [],
        checkIns: [],
        deliveries: [],
        events: [],
      };
    }

    const matchedSupplierRuns = supplierRuns.filter((supplierRun) =>
      selectedVendor
        ? recordMatchesVendor(supplierRun, selectedVendor.name)
        : recordMatchesSearch(supplierRun, searchValue),
    );
    const matchedTheirTruckPOs = theirTruckPOs.filter((theirTruckPO) =>
      selectedVendor
        ? recordMatchesVendor(theirTruckPO, selectedVendor.name)
        : recordMatchesSearch(theirTruckPO, searchValue),
    );
    const matchedSupplierRunIds = new Set(
      matchedSupplierRuns.map((supplierRun) => supplierRun.id),
    );
    const matchedTheirTruckPOIds = new Set(
      matchedTheirTruckPOs.map((theirTruckPO) => theirTruckPO.id),
    );
    const matchedPoNumbers = new Set(
      [...matchedSupplierRuns, ...matchedTheirTruckPOs]
        .map((record) => normalizeNumber(record.poNumber))
        .filter(Boolean),
    );

    const matchedCheckIns = checkIns.filter((checkIn) => {
      const linkedSouthRunMatches =
        checkIn.sourceSupplierRunId &&
        matchedSupplierRunIds.has(checkIn.sourceSupplierRunId);
      const linkedTheirTruckMatches =
        checkIn.sourceTheirTruckPOId &&
        matchedTheirTruckPOIds.has(checkIn.sourceTheirTruckPOId);
      const linkedPoMatches =
        (normalizeNumber(checkIn.sourceSupplierRunPoNumber) &&
          matchedPoNumbers.has(
            normalizeNumber(checkIn.sourceSupplierRunPoNumber),
          )) ||
        (normalizeNumber(checkIn.sourceTheirTruckPONumber) &&
          matchedPoNumbers.has(
            normalizeNumber(checkIn.sourceTheirTruckPONumber),
          ));

      return (
        (selectedVendor
          ? recordMatchesVendor(checkIn, selectedVendor.name)
          : recordMatchesSearch(checkIn, searchValue)) ||
        linkedSouthRunMatches ||
        linkedTheirTruckMatches ||
        linkedPoMatches
      );
    });

    const matchedDeliveries = selectedVendor
      ? []
      : deliveries.filter((delivery) =>
          recordMatchesSearch(delivery, searchValue),
        );

    const events = [
      ...matchedSupplierRuns.flatMap((supplierRun) => {
        const items = Array.isArray(supplierRun.items)
          ? supplierRun.items
          : [];
        const pickedItems = items.filter((item) => item.pickedUp);

        return [
          makeEvent({
            id: `south-created-${supplierRun.id}`,
            type: "south",
            title: `South PO ${supplierRun.poNumber}`,
            description: supplierRun.driver
              ? `${supplierRun.vendor || "Supplier"} pickup was added and assigned to ${supplierRun.driver}.`
              : `${supplierRun.vendor || "Supplier"} pickup was added.`,
            timestamp: supplierRun.createdAt,
            meta: [
              supplierRun.scheduledDate
                ? `Route date ${formatDateOnly(supplierRun.scheduledDate)}`
                : "",
              supplierRun.driver ? `Driver ${supplierRun.driver}` : "",
              supplierRun.vehicleTitle || supplierRun.vehicleBadge
                ? `Truck ${[
                    supplierRun.vehicleTitle,
                    supplierRun.vehicleBadge,
                  ]
                    .filter(Boolean)
                    .join(" ")}`
                : "",
              supplierRun.createdByName
                ? `Created by ${supplierRun.createdByName}`
                : "",
              supplierRun.orderedBy ? `Ordered by ${supplierRun.orderedBy}` : "",
              supplierRun.customerName
                ? `Customer ${formatCustomerName(supplierRun.customerName)}`
                : "",
              `${items.length} ${items.length === 1 ? "item" : "items"}`,
            ],
            recordType: "south",
            recordId: supplierRun.id,
          }),
          ...pickedItems.map((item) =>
            makeEvent({
              id: `south-picked-${supplierRun.id}-${item.id}`,
              type: "south",
              title:
                item.materialUse === "return"
                  ? "Item returned"
                  : item.materialUse === "swap"
                    ? "Item swapped"
                    : "Item picked up",
              description:
                getItemText(item) || `PO ${supplierRun.poNumber} item`,
              timestamp: item.pickedUpAt || supplierRun.updatedAt,
              meta: [
                supplierRun.vendor,
                item.orderNumber ? `Order ${item.orderNumber}` : "",
                item.customerName
                  ? `Customer ${formatCustomerName(item.customerName)}`
                  : "",
                item.pickupPhoto?.dataUrl ? "Photo saved" : "",
              ],
              recordType: "south",
              recordId: supplierRun.id,
            }),
          ),
          supplierRun.status === "complete" || supplierRun.completedAt
            ? makeEvent({
                id: `south-complete-${supplierRun.id}`,
                type: "south",
                title: "South PO complete",
                description: `PO ${supplierRun.poNumber} was completed.`,
                timestamp: supplierRun.completedAt || supplierRun.updatedAt,
                meta: [supplierRun.vendor, supplierRun.driver],
                recordType: "south",
                recordId: supplierRun.id,
              })
            : null,
        ].filter(Boolean);
      }),
      ...matchedTheirTruckPOs.flatMap((theirTruckPO) => {
        const items = Array.isArray(theirTruckPO.items)
          ? theirTruckPO.items
          : [];

        return [
          makeEvent({
            id: `their-truck-created-${theirTruckPO.id}`,
            type: "theirTruck",
            title: `Their Truck PO ${theirTruckPO.poNumber}`,
            description: `${theirTruckPO.vendor || "Vendor"} inbound PO was scheduled.`,
            timestamp:
              theirTruckPO.createdAt ||
              theirTruckPO.deliveryDate ||
              theirTruckPO.updatedAt,
            meta: [
              theirTruckPO.deliveryDate
                ? `Delivery ${formatDateOnly(theirTruckPO.deliveryDate)}`
                : "",
              theirTruckPO.isStock
                ? "Stock"
                : theirTruckPO.customerName
                  ? `Customer ${formatCustomerName(theirTruckPO.customerName)}`
                  : "",
              theirTruckPO.orderNumber
                ? `Order ${theirTruckPO.orderNumber}`
                : "",
              theirTruckPO.createdByName
                ? `Created by ${theirTruckPO.createdByName}`
                : "",
              theirTruckPO.orderedBy ? `Ordered by ${theirTruckPO.orderedBy}` : "",
              `${items.length} ${items.length === 1 ? "item" : "items"}`,
            ],
            recordType: "theirTruck",
            recordId: theirTruckPO.id,
          }),
          theirTruckPO.status === "complete" || theirTruckPO.completedAt
            ? makeEvent({
                id: `their-truck-complete-${theirTruckPO.id}`,
                type: "theirTruck",
                title: "Their Truck PO complete",
                description: `PO ${theirTruckPO.poNumber} was completed.`,
                timestamp: theirTruckPO.completedAt || theirTruckPO.updatedAt,
                meta: [theirTruckPO.vendor],
                recordType: "theirTruck",
                recordId: theirTruckPO.id,
              })
            : null,
        ].filter(Boolean);
      }),
      ...matchedCheckIns.map((checkIn) => {
        const assignment = getAssignment(checkIn);

        return makeEvent({
          id: `receiving-${checkIn.id}`,
          type: "receiving",
          title: `Received PO ${checkIn.poNumber}`,
          description: `${checkIn.vendor || "Vendor"} checked in by ${
            checkIn.checkedInBy || "receiving"
          }.`,
          timestamp: checkIn.checkedInAt,
          meta: [
            checkIn.poLocation,
            checkIn.sourceType === "south" ? "Linked from South" : "",
            checkIn.sourceType === "theirTruck" ? "Linked from Their Truck" : "",
            assignment?.businessName
              ? `Customer ${formatCustomerName(assignment.businessName)}`
              : "",
            Array.isArray(checkIn.materials)
              ? `${checkIn.materials.length} ${
                  checkIn.materials.length === 1 ? "material" : "materials"
                }`
              : "",
          ],
          recordType: "receiving",
          recordId: checkIn.id,
        });
      }),
      ...matchedDeliveries.map((delivery) =>
        makeEvent({
          id: `delivery-${delivery.id}`,
          type: "delivery",
          title: `Delivery order ${delivery.orderNumber}`,
          description: `${formatCustomerName(
            delivery.customerName || "Customer",
          )} ${delivery.status === "complete" ? "was delivered" : "is scheduled"}.`,
          timestamp:
            delivery.deliveredAt ||
            delivery.scheduledStartAt ||
            delivery.updatedAt ||
            delivery.createdAt,
          meta: [
            delivery.driver ? `Driver ${delivery.driver}` : "",
            delivery.deliveryAddress,
            delivery.status === "complete" ? "Complete" : "Open",
            delivery.hasHardware ? "Hardware" : "",
          ],
          recordType: "delivery",
          recordId: delivery.id,
        }),
      ),
    ]
      .filter(Boolean)
      .sort(
        (firstEvent, secondEvent) =>
          new Date(firstEvent.timestamp || 0) -
          new Date(secondEvent.timestamp || 0),
      );

    return {
      supplierRuns: matchedSupplierRuns,
      theirTruckPOs: matchedTheirTruckPOs,
      checkIns: matchedCheckIns,
      deliveries: matchedDeliveries,
      events,
    };
  }, [
    checkIns,
    deliveries,
    hasSearch,
    searchValue,
    selectedVendor,
    supplierRuns,
    theirTruckPOs,
  ]);

  const totalMatches =
    traceResults.supplierRuns.length +
    traceResults.theirTruckPOs.length +
    traceResults.checkIns.length +
    traceResults.deliveries.length;
  const tracePOStatusCards = useMemo(
    () => getTracePOStatusCards(traceResults, checkIns),
    [checkIns, traceResults],
  );
  const [vendorSourceFilter, setVendorSourceFilter] = useState("all");
  const [vendorStatusFilter, setVendorStatusFilter] = useState("all");
  const [vendorPOSearch, setVendorPOSearch] = useState("");
  const tracePOCards = useMemo(
    () =>
      getVendorPOCards(
        traceResults.supplierRuns,
        traceResults.theirTruckPOs,
        traceResults.checkIns,
      ),
    [
      traceResults.checkIns,
      traceResults.supplierRuns,
      traceResults.theirTruckPOs,
    ],
  );
  const vendorPOCards = useMemo(
    () => (selectedVendor ? tracePOCards : []),
    [selectedVendor, tracePOCards],
  );
  const filteredVendorPOCards = useMemo(
    () =>
      vendorPOCards.filter((card) => {
        const sourceMatches =
          vendorSourceFilter === "all" || card.source === vendorSourceFilter;
        const statusMatches =
          vendorStatusFilter === "all" ||
          (vendorStatusFilter === "open" ? !card.complete : card.complete);
        const searchMatches = vendorPOCardMatchesSearch(card, vendorPOSearch);

        return sourceMatches && statusMatches && searchMatches;
      }),
    [
      vendorPOCards,
      vendorPOSearch,
      vendorSourceFilter,
      vendorStatusFilter,
    ],
  );
  const openVendorPOCount = vendorPOCards.filter((card) => !card.complete).length;
  const completedVendorPOCount = vendorPOCards.length - openVendorPOCount;

  useEffect(() => {
    setVendorSourceFilter("all");
    setVendorStatusFilter("all");
    setVendorPOSearch("");
  }, [selectedVendor?.name]);

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Dashboard", onClick: () => onPageChange?.("dashboard") },
          { label: "Trace PO / Order" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Activity Trace
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Trace PO / Order
          </h2>

          <p className="mt-2 max-w-3xl text-slate-500">
            Search a PO, order number, customer, vendor, item, or SKU to see the
            chain across South pickups, Their Truck POs, receiving, and deliveries.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onPageChange?.("dashboard")}
          className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" strokeWidth={2.7} />
          Back to Dashboard
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="trace-search"
          className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search
        </label>

        <div className="relative">
          <input
            id="trace-search"
            type="search"
            autoComplete="off"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search PO, order #, customer, vendor, item, SKU..."
            className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-bold text-slate-900 outline-none transition placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />

          {vendorSuggestions.length > 0 ? (
            <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Vendors
              </p>
              {vendorSuggestions.map((vendor) => (
                <button
                  key={normalizeVendorName(vendor.name)}
                  type="button"
                  onClick={() => setSearchValue(vendor.name)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#FC2C38]">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="truncate font-black text-slate-900">
                      {vendor.name}
                    </span>
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">
                    View POs
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {hasSearch ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {totalMatches} matching records • {traceResults.events.length}{" "}
            timeline events
          </p>
        ) : null}
      </div>

      {selectedVendor ? (
        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 p-5 text-white sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15">
                  <Building2 className="h-7 w-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                    Vendor PO Lookup
                  </p>
                  <h2 className="mt-1 truncate text-3xl font-black tracking-tight">
                    {selectedVendor.name}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-slate-300">
                    {selectedVendor.phone ? (
                      <a
                        href={`tel:${selectedVendor.phone}`}
                        className="inline-flex items-center gap-2 transition hover:text-white"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {selectedVendor.phone}
                      </a>
                    ) : null}
                    {selectedVendor.address ? (
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        {selectedVendor.address}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <VendorMetric label="Open" value={openVendorPOCount} tone="red" />
                <VendorMetric
                  label="South"
                  value={traceResults.supplierRuns.length}
                  tone="blue"
                />
                <VendorMetric
                  label="Their Truck"
                  value={traceResults.theirTruckPOs.length}
                  tone="indigo"
                />
              </div>
            </div>
          </div>

          {Array.isArray(selectedVendor.contacts) &&
          selectedVendor.contacts.length > 0 ? (
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Vendor Contacts
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedVendor.contacts.map((contact, index) => (
                  <div
                    key={contact.id || `${contact.name}-${index}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-slate-900">
                        {contact.name || "Vendor contact"}
                      </span>
                      {contact.products ? (
                        <span className="block text-xs font-bold text-slate-500">
                          {contact.products}
                        </span>
                      ) : null}
                    </span>
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                        aria-label={`Call ${contact.name || "vendor contact"}`}
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : null}
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                        aria-label={`Email ${contact.name || "vendor contact"}`}
                      >
                        <Mail className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="p-4 sm:p-5">
            <div className="mb-4 space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Purchase Orders
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  Open POs are listed first, followed by completed history.
                </p>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                  Showing {filteredVendorPOCards.length} of {vendorPOCards.length}
                </p>
              </div>

              <label className="relative block">
                <span className="sr-only">Search this vendor's purchase orders</span>
                <Search
                  aria-hidden="true"
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2.5}
                />
                <input
                  type="search"
                  value={vendorPOSearch}
                  onChange={(event) => setVendorPOSearch(event.target.value)}
                  placeholder="Search this vendor by PO, order, customer, item, or SKU..."
                  className="min-h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
                />
              </label>

              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex w-fit max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1">
                  {[
                    { id: "all", label: "All Statuses", count: vendorPOCards.length },
                    { id: "open", label: "Open", count: openVendorPOCount },
                    {
                      id: "completed",
                      label: "Completed",
                      count: completedVendorPOCount,
                    },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setVendorStatusFilter(filter.id)}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black transition sm:px-4 ${
                        vendorStatusFilter === filter.id
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {filter.label} · {filter.count}
                    </button>
                  ))}
                </div>

                <div className="inline-flex w-fit max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1">
                  {[
                    { id: "all", label: "All Sources", count: vendorPOCards.length },
                    {
                      id: "south",
                      label: "South",
                      count: traceResults.supplierRuns.length,
                    },
                    {
                      id: "theirTruck",
                      label: "Their Truck",
                      count: traceResults.theirTruckPOs.length,
                    },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setVendorSourceFilter(filter.id)}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black transition sm:px-4 ${
                        vendorSourceFilter === filter.id
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {filter.label} · {filter.count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredVendorPOCards.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {filteredVendorPOCards.map((card) => (
                  <VendorPOCard key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="font-black text-slate-800">
                  No POs match the selected filters
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Try another status, source, or PO search.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {!hasSearch ? (
        <EmptyState
          title="Search a PO or order"
          description="Try a PO like 440-952, an order number, customer name, vendor, item description, or SKU."
        />
      ) : null}

      {hasSearch && totalMatches === 0 && !selectedVendor ? (
        <EmptyState
          title="No chain found"
          description="Try searching with just the PO number, just the order number, or fewer words."
        />
      ) : null}

      {totalMatches > 0 && !selectedVendor ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {tracePOStatusCards.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Receiving Status
                </p>

                <div className="mt-4 grid gap-2">
                  {tracePOStatusCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            PO {card.poNumber}
                          </p>
                          <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                            {card.source} · {card.vendor}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${card.status.className}`}
                        >
                          {card.status.label}
                        </span>
                      </div>

                      {card.status.checkedInAt ? (
                        <p className="mt-2 text-xs font-bold text-slate-500">
                          {formatDateTime(card.status.checkedInAt)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Matches
              </p>

              <div className="mt-4 grid gap-2">
                <SummaryPill
                  icon={Route}
                  label="South POs"
                  value={traceResults.supplierRuns.length}
                />
                <SummaryPill
                  icon={Package}
                  label="Their Truck"
                  value={traceResults.theirTruckPOs.length}
                />
                <SummaryPill
                  icon={ClipboardCheck}
                  label="Receiving"
                  value={traceResults.checkIns.length}
                />
                <SummaryPill
                  icon={Truck}
                  label="Deliveries"
                  value={traceResults.deliveries.length}
                />
              </div>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {tracePOCards.length > 0 ? (
              <div className="mb-7 border-b border-slate-200 pb-7">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                  Full PO Details
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">
                  Everything saved on these POs
                </h3>
                <div className="mt-4 space-y-3">
                  {tracePOCards.map((card) => (
                    <VendorPOCard key={card.id} card={card} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Timeline
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">
                  Chain of Events
                </h3>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                Oldest first
              </span>
            </div>

            <div className="relative space-y-4 before:absolute before:bottom-0 before:left-4 before:top-0 before:w-px before:bg-slate-200">
              {traceResults.events.map((event) => (
                <TimelineEvent key={event.id} event={event} />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </PageContainer>
  );
}

function VendorMetric({ label, value, tone }) {
  const toneClass =
    tone === "red"
      ? "bg-red-500/15 text-red-100 ring-red-400/20"
      : tone === "blue"
        ? "bg-blue-500/15 text-blue-100 ring-blue-400/20"
        : "bg-indigo-500/15 text-indigo-100 ring-indigo-400/20";

  return (
    <div className={`min-w-20 rounded-2xl px-3 py-3 text-center ring-1 ${toneClass}`}>
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em]">
        {label}
      </p>
    </div>
  );
}

function getPhotoUrl(photo) {
  if (typeof photo === "string") {
    return photo.trim();
  }

  return String(photo?.url || photo?.dataUrl || "").trim();
}

function getItemPhotos(item) {
  const photos = Array.isArray(item?.pickupPhotos) ? item.pickupPhotos : [];
  const normalizedPhotos = photos
    .map((photo) => ({
      photo,
      url: getPhotoUrl(photo),
    }))
    .filter(Boolean);
  const legacyPhotoUrl = getPhotoUrl(item?.pickupPhoto);

  if (
    legacyPhotoUrl &&
    !normalizedPhotos.some((photo) => photo.url === legacyPhotoUrl)
  ) {
    normalizedPhotos.push({
      photo: item.pickupPhoto,
      url: legacyPhotoUrl,
    });
  }

  return normalizedPhotos.filter((photo) => photo.url);
}

function getCheckInPhotos(checkIn) {
  const photos = [];
  const seenUrls = new Set();
  const addPhoto = (photo, title, subtitle = "") => {
    const url = getPhotoUrl(photo);

    if (!url || seenUrls.has(url)) {
      return;
    }

    seenUrls.add(url);
    photos.push({
      url,
      title,
      subtitle,
      capturedAt: photo?.capturedAt || photo?.createdAt || "",
    });
  };

  addPhoto(
    checkIn?.locationPhoto,
    "PO location",
    checkIn?.poLocation || "Material placement",
  );

  const materials = Array.isArray(checkIn?.materials)
    ? checkIn.materials
    : Array.isArray(checkIn?.items)
      ? checkIn.items
      : [];

  materials.forEach((material, index) => {
    const materialName = material?.description || `Material ${index + 1}`;
    const subtitle = [materialName, material?.location]
      .filter(Boolean)
      .join(" • ");
    const locationPhotos = Array.isArray(material?.locationPhotos)
      ? material.locationPhotos
      : [];
    const damagePhotos = Array.isArray(material?.damagePhotos)
      ? material.damagePhotos
      : [];

    locationPhotos.forEach((photo) =>
      addPhoto(photo, "Check-in location", subtitle),
    );
    addPhoto(material?.locationPhoto, "Check-in location", subtitle);
    damagePhotos.forEach((photo) =>
      addPhoto(photo, "Damage photo", subtitle),
    );
    addPhoto(material?.damagePhoto, "Damage photo", subtitle);
  });

  return photos;
}

function VendorPOCard({ card }) {
  const isSouth = card.source === "south";
  const SourceIcon = isSouth ? Route : Truck;
  const sourceTone = isSouth
    ? "bg-blue-50 text-blue-700"
    : "bg-indigo-50 text-indigo-700";
  const details = [
    { label: isSouth ? "Pickup date" : "Delivery date", value: card.date ? formatDateOnly(card.date) : "Not scheduled" },
    { label: "Driver", value: card.driver },
    { label: "Truck", value: card.vehicle },
    { label: "Customer", value: card.customerName === "Stock" ? "Stock" : card.customerName ? formatCustomerName(card.customerName) : "" },
    { label: "Order #", value: card.orderNumber },
    { label: "Ordered by", value: card.orderedBy },
    { label: "Created by", value: card.createdBy },
    { label: "Supplier address", value: card.address },
    { label: "Entered", value: card.createdAt ? formatDateTime(card.createdAt) : "" },
    { label: "Arrived", value: card.arrivedAt ? formatDateTime(card.arrivedAt) : "" },
    { label: "Completed", value: card.completedAt ? formatDateTime(card.completedAt) : "" },
  ].filter((detail) => detail.value);
  const receivingRecords = Array.isArray(card.checkIns) ? card.checkIns : [];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${sourceTone}`}>
            <SourceIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-xs font-black uppercase tracking-[0.14em] ${isSouth ? "text-blue-700" : "text-indigo-700"}`}>
                {card.sourceLabel}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${
                  card.complete
                    ? "bg-slate-100 text-slate-500"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {card.complete ? "Completed" : "Open"}
              </span>
            </div>
            <h3 className="mt-1 truncate text-2xl font-black text-slate-950">
              PO {card.poNumber}
            </h3>
          </div>
        </div>
        <span className="shrink-0 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-600">
          {card.items.length} {card.items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
        {details.map((detail) => (
          <div key={`${card.id}-${detail.label}`} className="min-w-0 rounded-xl bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {detail.label}
            </p>
            <p className="mt-0.5 break-words text-sm font-black text-slate-800">
              {detail.value}
            </p>
          </div>
        ))}
      </div>

      {card.notes ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
            {isSouth ? "Driver notes" : "Delivery cadence / notes"}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-amber-950">
            {card.notes}
          </p>
        </div>
      ) : null}

      {card.items.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            All PO Items
          </p>
          <div className="space-y-2">
            {card.items.map((item, index) => {
              const pickupPhotos = getItemPhotos(item);

              return (
                <div
                  key={item.id || `${card.id}-item-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900">
                        {item.quantity ? `${item.quantity} ` : ""}
                        {item.description || "Item details not entered"}
                      </p>
                      {item.internalReference ? (
                        <p className="mt-1 break-words text-xs font-bold text-slate-500">
                          Item / SKU / SO#: {item.internalReference}
                        </p>
                      ) : null}
                    </div>
                    {isSouth ? (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                          item.pickedUp || item.pickedUpAt || pickupPhotos.length > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {item.pickedUp || item.pickedUpAt || pickupPhotos.length > 0
                          ? "Picked up"
                          : "Needs pickup"}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.orderNumber ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-700">
                        Order {item.orderNumber}
                      </span>
                    ) : null}
                    {item.customerName ? (
                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black text-orange-700">
                        {formatCustomerName(item.customerName)}
                      </span>
                    ) : null}
                    {item.materialUse ? (
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700">
                        {item.materialUse}
                      </span>
                    ) : null}
                    {item.easilyDamaged ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">
                        Easily damaged
                      </span>
                    ) : null}
                    {pickupPhotos.length > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                        {pickupPhotos.length} pickup {pickupPhotos.length === 1 ? "photo" : "photos"}
                      </span>
                    ) : null}
                  </div>

                  {item.returnNotes || item.notes ? (
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600">
                      {item.returnNotes || item.notes}
                    </p>
                  ) : null}

                  {pickupPhotos.length > 0 ? (
                    <div className="mt-3">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                        Pickup photos
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                      {pickupPhotos.map(({ photo, url }, photoIndex) => (
                        <a
                          key={`${card.id}-${item.id || index}-photo-${photoIndex}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-24 shrink-0 overflow-hidden rounded-xl border border-emerald-200 bg-white"
                        >
                          <img
                            src={url}
                            alt={`PO ${card.poNumber} item ${index + 1} pickup ${photoIndex + 1}`}
                            className="h-20 w-full object-cover"
                          />
                          {photo?.capturedAt ? (
                            <span className="block px-2 py-1.5 text-[9px] font-bold leading-tight text-slate-500">
                              {formatDateTime(photo.capturedAt)}
                            </span>
                          ) : null}
                        </a>
                      ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
          No item lines were saved on this PO.
        </p>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              Receiving / Check-In
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Check-in details, material locations, notes, and photos.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {receivingRecords.length} {receivingRecords.length === 1 ? "check-in" : "check-ins"}
          </span>
        </div>

        {receivingRecords.length > 0 ? (
          <div className="mt-3 space-y-3">
            {receivingRecords.map((checkIn, checkInIndex) => {
              const materials = Array.isArray(checkIn.materials)
                ? checkIn.materials
                : Array.isArray(checkIn.items)
                  ? checkIn.items
                  : [];
              const checkInPhotos = getCheckInPhotos(checkIn);
              const assignment = getAssignment(checkIn);

              return (
                <section
                  key={checkIn.id || `${card.id}-check-in-${checkInIndex}`}
                  className="rounded-2xl border border-emerald-300 bg-emerald-100/70 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        Checked in {checkIn.checkedInAt ? formatDateTime(checkIn.checkedInAt) : "—"}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        {checkIn.checkedInBy
                          ? `By ${checkIn.checkedInBy}`
                          : "Employee not recorded"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {checkIn.poLocation ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-800">
                          Location: {checkIn.poLocation}
                        </span>
                      ) : null}
                      {checkIn.receivingTruckLabel ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-700">
                          {checkIn.receivingTruckLabel}
                        </span>
                      ) : null}
                      {assignment?.businessName ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-blue-700">
                          {assignment.businessName}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {materials.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {materials.map((material, materialIndex) => (
                        <div
                          key={material.id || `${card.id}-received-${materialIndex}`}
                          className="rounded-xl border border-emerald-100 bg-white px-3 py-2"
                        >
                          <p className="text-xs font-black text-slate-900">
                            {material.quantity ? `${material.quantity} ` : ""}
                            {material.description || `Material ${materialIndex + 1}`}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                            {material.location ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                {material.location}
                              </span>
                            ) : null}
                            {material.conditionGood === false ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                                Damage noted
                              </span>
                            ) : null}
                          </div>
                          {material.notes ? (
                            <p className="mt-1.5 whitespace-pre-wrap text-xs font-semibold text-slate-600">
                              {material.notes}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : checkIn.materialsSkipped ? (
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-500">
                      Material details were skipped during check-in.
                    </p>
                  ) : null}

                  {checkInPhotos.length > 0 ? (
                    <div className="mt-3">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                        Check-in photos
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {checkInPhotos.map((photo, photoIndex) => (
                          <a
                            key={`${checkIn.id || checkInIndex}-photo-${photoIndex}`}
                            href={photo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-xl border border-emerald-200 bg-white"
                          >
                            <img
                              src={photo.url}
                              alt={`${photo.title} for PO ${card.poNumber}`}
                              className="h-24 w-full object-cover"
                            />
                            <span className="block px-2 py-2">
                              <span className="block text-[10px] font-black text-slate-800">
                                {photo.title}
                              </span>
                              {photo.subtitle ? (
                                <span className="mt-0.5 block text-[9px] font-semibold text-slate-500">
                                  {photo.subtitle}
                                </span>
                              ) : null}
                              {photo.capturedAt ? (
                                <span className="mt-0.5 block text-[9px] font-semibold text-slate-400">
                                  {formatDateTime(photo.capturedAt)}
                                </span>
                              ) : null}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-bold text-slate-500">
                      No check-in photos were saved.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
            This PO has not been checked in yet.
          </p>
        )}
      </div>
    </article>
  );
}

function SummaryPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
      <span className="flex items-center gap-2 text-sm font-black text-slate-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-900 shadow-sm">
        {value}
      </span>
    </div>
  );
}

function TimelineEvent({ event }) {
  const tone = getEventTone(event.type);
  const Icon = tone.icon;

  return (
    <article className="relative pl-10">
      <span
        className={`absolute left-[9px] top-5 h-3.5 w-3.5 rounded-full ring-4 ring-white ${tone.dot}`}
        aria-hidden="true"
      />

      <div className={`rounded-2xl border ${tone.border} bg-white p-4 shadow-sm`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${tone.badge}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {event.type}
            </p>

            <h4 className="mt-3 text-xl font-black text-slate-900">
              {event.title}
            </h4>

            <p className="mt-1 font-semibold text-slate-600">
              {event.description}
            </p>
          </div>

          <p className="shrink-0 text-sm font-black text-slate-500">
            {formatDateTime(event.timestamp)}
          </p>
        </div>

        {event.meta.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {event.meta.map((metaItem) => (
              <span
                key={metaItem}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
              >
                {metaItem}
              </span>
            ))}
          </div>
        ) : null}

      </div>
    </article>
  );
}
