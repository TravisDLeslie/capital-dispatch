import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Warehouse,
  X,
} from "lucide-react";

const MAX_NOTIFICATIONS = 75;
const MAX_STORED_IDS = 250;

function toDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }

  if (Number.isFinite(Number(value?.seconds))) {
    const converted = new Date(Number(value.seconds) * 1000);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  const converted = value instanceof Date ? value : new Date(value);
  return Number.isNaN(converted.getTime()) ? null : converted;
}

function getTimestamp(value) {
  return toDate(value)?.getTime() || 0;
}

function getString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatActivityTime(timestamp) {
  if (!timestamp) return "Recorded activity";

  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatFullActivityTime(timestamp) {
  if (!timestamp) return "Time not recorded";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getFacts(facts) {
  return facts.filter((fact) => getString(fact?.value));
}

function getPhotoUrl(photo) {
  if (typeof photo === "string") return photo.trim();
  return String(photo?.url || photo?.dataUrl || "").trim();
}

function buildPhotoList() {
  const photos = [];
  const seenUrls = new Set();

  function add(photo, label) {
    const url = getPhotoUrl(photo);

    if (!url || seenUrls.has(url)) return;

    seenUrls.add(url);
    photos.push({
      id: getString(photo?.id) || `${label}-${photos.length}`,
      url,
      label,
    });
  }

  return { photos, add };
}

function getSouthPickupPhotos(item) {
  const { photos, add } = buildPhotoList();

  (Array.isArray(item?.pickupPhotos) ? item.pickupPhotos : []).forEach(
    (photo) => add(photo, "Pickup photo"),
  );
  add(item?.pickupPhoto, "Pickup photo");

  return photos;
}

function getCheckInPhotos(checkIn) {
  const { photos, add } = buildPhotoList();

  add(checkIn?.locationPhoto, "PO location");

  const materials = Array.isArray(checkIn?.materials)
    ? checkIn.materials
    : Array.isArray(checkIn?.items)
      ? checkIn.items
      : [];

  materials.forEach((material) => {
    (Array.isArray(material?.locationPhotos)
      ? material.locationPhotos
      : []
    ).forEach((photo) => add(photo, "Check-in location"));
    add(material?.locationPhoto, "Check-in location");

    (Array.isArray(material?.damagePhotos) ? material.damagePhotos : []).forEach(
      (photo) => add(photo, "Damage photo"),
    );
    add(material?.damagePhoto, "Damage photo");
  });

  return photos;
}

function getReceivingLocation(checkIn) {
  const materialLocations = (Array.isArray(checkIn?.materials)
    ? checkIn.materials
    : Array.isArray(checkIn?.items)
      ? checkIn.items
      : []
  )
    .map((material) => getString(material?.location))
    .filter(Boolean);
  const uniqueLocations = Array.from(new Set(materialLocations));

  if (uniqueLocations.length > 0) return uniqueLocations.join(" · ");
  return getString(checkIn?.poLocation) || getString(checkIn?.location);
}

function getCheckInOrderInfo(checkIn) {
  const assignment =
    checkIn?.orderAssignment && typeof checkIn.orderAssignment === "object"
      ? checkIn.orderAssignment
      : checkIn?.customer && typeof checkIn.customer === "object"
        ? checkIn.customer
        : {};
  const isStock = getString(assignment?.type).toLowerCase() === "stock";
  const orderNumber =
    getString(assignment?.internalReference) ||
    getString(checkIn?.sourceTheirTruckOrderNumber) ||
    getString(checkIn?.orderNumber);
  const orderName = isStock
    ? "Stock"
    : getString(assignment?.jobName) ||
      getString(assignment?.businessName) ||
      getString(checkIn?.sourceTheirTruckCustomerName) ||
      getString(checkIn?.customerName);

  return { isStock, orderNumber, orderName };
}

function getDeliveryPhotos(delivery) {
  const { photos, add } = buildPhotoList();

  (Array.isArray(delivery?.deliveryPhotos)
    ? delivery.deliveryPhotos
    : []
  ).forEach((photo) => add(photo, "Delivery photo"));
  add(delivery?.deliveryPhoto, "Delivery photo");

  (Array.isArray(delivery?.hardwarePhotos)
    ? delivery.hardwarePhotos
    : []
  ).forEach((photo) => add(photo, "Hardware photo"));
  add(delivery?.hardwarePhoto, "Hardware photo");

  return photos;
}

function getStoredState(storageKey) {
  const fallback = {
    initializedAt: Date.now(),
    readIds: [],
    dismissedIds: [],
  };

  try {
    const storedValue = localStorage.getItem(storageKey);

    if (!storedValue) {
      localStorage.setItem(storageKey, JSON.stringify(fallback));
      return fallback;
    }

    const parsed = JSON.parse(storedValue);

    if (!parsed || typeof parsed !== "object") {
      localStorage.setItem(storageKey, JSON.stringify(fallback));
      return fallback;
    }

    return {
      initializedAt:
        Number(parsed.initializedAt) > 0
          ? Number(parsed.initializedAt)
          : fallback.initializedAt,
      readIds: Array.isArray(parsed.readIds)
        ? parsed.readIds.filter(Boolean).slice(-MAX_STORED_IDS)
        : [],
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter(Boolean).slice(-MAX_STORED_IDS)
        : [],
    };
  } catch {
    return fallback;
  }
}

function buildNotifications({ supplierRuns, checkIns, deliveries }) {
  const notifications = [];

  (Array.isArray(supplierRuns) ? supplierRuns : []).forEach((run) => {
    const runItems = Array.isArray(run?.items) ? run.items : [];

    runItems.forEach((item, itemIndex) => {
      if (!item?.pickedUp && !item?.pickedUpAt) return;

      const timestamp = getTimestamp(item.pickedUpAt);
      const itemId = getString(item.id) || `item-${itemIndex}`;
      const runId = getString(run?.id) || getString(run?.poNumber) || "south";
      const description =
        getString(item.description) || getString(item.itemNumber) || "Material";
      const quantity = getString(item.quantity);
      const poNumber = getString(run?.poNumber);
      const vendor = getString(run?.vendor);
      const orderNumber = getString(item.orderNumber);
      const customerName =
        getString(item.customerName) || getString(run?.customerName);
      const driver = getString(run?.driver);

      notifications.push({
        id: `south:${runId}:${itemId}:${timestamp || "picked"}`,
        type: "south",
        timestamp,
        title: "South item picked up",
        message: `${quantity ? `Qty ${quantity} · ` : ""}${description}`,
        detail: [poNumber ? `PO ${poNumber}` : "", vendor]
          .filter(Boolean)
          .join(" · "),
        summary: `${description} was marked picked up${
          vendor ? ` from ${vendor}` : " through South"
        }.`,
        facts: getFacts([
          { label: "PO number", value: poNumber },
          { label: "Supplier", value: vendor },
          { label: "Item", value: description },
          { label: "Quantity", value: quantity },
          { label: "Order", value: orderNumber },
          { label: "Customer", value: customerName },
          { label: "Driver", value: driver },
        ]),
        photos: getSouthPickupPhotos(item),
      });
    });
  });

  (Array.isArray(checkIns) ? checkIns : []).forEach((checkIn, checkInIndex) => {
    const timestamp = getTimestamp(
      checkIn?.checkedInAt || checkIn?.createdAt || checkIn?.updatedAt,
    );
    const checkInId =
      getString(checkIn?.id) ||
      getString(checkIn?.poNumber) ||
      `check-in-${checkInIndex}`;
    const poNumber = getString(checkIn?.poNumber);
    const vendor = getString(checkIn?.vendor);
    const checkedInBy = getString(checkIn?.checkedInBy);
    const receivingLocation = getReceivingLocation(checkIn);
    const { isStock, orderNumber, orderName } =
      getCheckInOrderInfo(checkIn);
    const orderLabel = isStock
      ? "Stock"
      : orderNumber
        ? `Order ${orderNumber}`
        : orderName;
    const receivingTruck =
      getString(checkIn?.receivingTruckLabel) ||
      getString(checkIn?.receivingTruckType);

    notifications.push({
      id: `checkin:${checkInId}:${timestamp || "checked-in"}`,
      type: "checkin",
      timestamp,
      title: "Material checked in",
      message:
        [poNumber ? `PO ${poNumber}` : "", orderLabel]
          .filter(Boolean)
          .join(" · ") || "Receiving check-in complete",
      detail: [
        !isStock && orderName ? orderName : "",
        vendor,
        receivingLocation ? `Location: ${receivingLocation}` : "",
        checkedInBy ? `Checked in by ${checkedInBy}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      summary: `${poNumber ? `PO ${poNumber}` : "Material"} was checked into receiving${
        orderLabel ? ` for ${orderLabel}` : ""
      }${
        !isStock && orderName ? ` · ${orderName}` : ""
      }${
        receivingLocation ? ` at ${receivingLocation}` : ""
      }${
        checkedInBy ? ` by ${checkedInBy}` : ""
      }.`,
      facts: getFacts([
        { label: "PO number", value: poNumber },
        { label: "Order number", value: orderNumber },
        { label: "Order name", value: orderName },
        { label: "Supplier", value: vendor },
        { label: "Location", value: receivingLocation },
        { label: "Checked in by", value: checkedInBy },
        { label: "Truck", value: receivingTruck },
      ]),
      photos: getCheckInPhotos(checkIn),
    });
  });

  (Array.isArray(deliveries) ? deliveries : []).forEach(
    (delivery, deliveryIndex) => {
      const isComplete =
        delivery?.delivered === true ||
        delivery?.status === "complete" ||
        delivery?.dispatchStatus === "complete" ||
        Boolean(delivery?.deliveredAt || delivery?.completedAt);

      if (!isComplete) return;

      const timestamp = getTimestamp(
        delivery?.deliveredAt ||
          delivery?.completedAt ||
          delivery?.updatedAt ||
          delivery?.createdAt,
      );
      const deliveryId =
        getString(delivery?.id) ||
        getString(delivery?.orderNumber) ||
        `delivery-${deliveryIndex}`;
      const orderNumber = getString(delivery?.orderNumber);
      const customerName = getString(delivery?.customerName);
      const driver = getString(delivery?.driver);

      notifications.push({
        id: `delivery:${deliveryId}:${timestamp || "complete"}`,
        type: "delivery",
        timestamp,
        title: "Delivery complete",
        message: [orderNumber ? `Order ${orderNumber}` : "", customerName]
          .filter(Boolean)
          .join(" · ") || "Delivery completed",
        detail: [getString(delivery?.address), driver ? `Driver ${driver}` : ""]
          .filter(Boolean)
          .join(" · "),
        summary: `${orderNumber ? `Order ${orderNumber}` : "The delivery"} was marked delivered${
          customerName ? ` for ${customerName}` : ""
        }.`,
        facts: getFacts([
          { label: "Order", value: orderNumber },
          { label: "Customer", value: customerName },
          { label: "Address", value: getString(delivery?.address) },
          { label: "Driver", value: driver },
          {
            label: "Truck",
            value:
              getString(delivery?.vehicleTitle) ||
              getString(delivery?.vehicleBadge),
          },
        ]),
        photos: getDeliveryPhotos(delivery),
      });
    },
  );

  return notifications
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, MAX_NOTIFICATIONS);
}

const notificationStyles = {
  south: {
    Icon: PackageCheck,
    label: "South pickup",
    unread: "border-blue-200 bg-blue-50",
    icon: "bg-blue-600 text-white",
    labelClass: "text-blue-700",
  },
  checkin: {
    Icon: Warehouse,
    label: "Receiving",
    unread: "border-amber-200 bg-amber-50",
    icon: "bg-amber-500 text-white",
    labelClass: "text-amber-700",
  },
  delivery: {
    Icon: CheckCircle2,
    label: "Delivery",
    unread: "border-emerald-200 bg-emerald-50",
    icon: "bg-emerald-600 text-white",
    labelClass: "text-emerald-700",
  },
};

/**
 * @param {{
 *   currentUserKey?: string;
 *   supplierRuns?: any[];
 *   checkIns?: any[];
 *   deliveries?: any[];
 * }} props
 */
export default function ActivityNotificationBell({
  currentUserKey,
  supplierRuns = [],
  checkIns = [],
  deliveries = [],
}) {
  const rootRef = useRef(null);
  const storageKey = `capital-lumber-activity-alerts:${currentUserKey || "user"}`;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [activityState, setActivityState] = useState(() =>
    getStoredState(storageKey),
  );

  const notifications = useMemo(
    () => buildNotifications({ supplierRuns, checkIns, deliveries }),
    [supplierRuns, checkIns, deliveries],
  );

  const readIds = useMemo(
    () => new Set(activityState.readIds),
    [activityState.readIds],
  );
  const dismissedIds = useMemo(
    () => new Set(activityState.dismissedIds),
    [activityState.dismissedIds],
  );
  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) => !dismissedIds.has(notification.id),
      ),
    [dismissedIds, notifications],
  );
  const unreadNotifications = visibleNotifications.filter(
    (notification) =>
      notification.timestamp > activityState.initializedAt &&
      !readIds.has(notification.id),
  );
  const unreadCount = unreadNotifications.length;
  const activeUnreadNotification = unreadNotifications[0] || null;

  useEffect(() => {
    function handleOutsidePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (isPhotoViewerOpen) {
          setIsPhotoViewerOpen(false);
          return;
        }

        setIsOpen(false);
        setSelectedNotification(null);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPhotoViewerOpen]);

  useEffect(() => {
    setSelectedPhotoIndex(0);
    setIsPhotoViewerOpen(false);
  }, [selectedNotification?.id]);

  useEffect(() => {
    const photoCount = selectedNotification?.photos?.length || 0;

    if (photoCount < 2) return undefined;

    function handlePhotoKeyDown(event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();
      setSelectedPhotoIndex((current) =>
        event.key === "ArrowRight"
          ? (current + 1) % photoCount
          : (current - 1 + photoCount) % photoCount,
      );
    }

    document.addEventListener("keydown", handlePhotoKeyDown);
    return () => document.removeEventListener("keydown", handlePhotoKeyDown);
  }, [selectedNotification]);

  function saveActivityState(updater) {
    setActivityState((current) => {
      const next = updater(current);

      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // The alerts remain usable for this session when storage is unavailable.
      }

      return next;
    });
  }

  function markRead(notificationId) {
    if (readIds.has(notificationId)) return;

    saveActivityState((current) => ({
      ...current,
      readIds: [...current.readIds, notificationId].slice(-MAX_STORED_IDS),
    }));
  }

  function markAllRead() {
    const idsToRead = visibleNotifications.map(
      (notification) => notification.id,
    );

    saveActivityState((current) => ({
      ...current,
      readIds: Array.from(new Set([...current.readIds, ...idsToRead])).slice(
        -MAX_STORED_IDS,
      ),
    }));
  }

  function dismissNotification(notificationId) {
    saveActivityState((current) => ({
      ...current,
      dismissedIds: [...current.dismissedIds, notificationId].slice(
        -MAX_STORED_IDS,
      ),
    }));
  }

  function openNotification(notification) {
    markRead(notification.id);
    setSelectedPhotoIndex(0);
    setIsPhotoViewerOpen(false);
    setSelectedNotification(notification);
    setIsOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="fixed right-5 top-5 z-[80] hidden lg:block"
    >
      {activeUnreadNotification ? (
        <button
          type="button"
          onClick={() => openNotification(activeUnreadNotification)}
          className={`absolute right-16 top-0 flex w-[360px] max-w-[calc(100vw-6.5rem)] items-start gap-3 rounded-2xl border p-3.5 text-left shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl ${
            notificationStyles[activeUnreadNotification.type].unread
          }`}
          aria-label={`View new alert: ${activeUnreadNotification.title}`}
        >
          {(() => {
            const style = notificationStyles[activeUnreadNotification.type];
            const Icon = style.Icon;

            return (
              <>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[10px] font-black uppercase tracking-[0.16em] ${style.labelClass}`}
                  >
                    New {style.label} alert
                  </span>
                  <span className="mt-0.5 block text-sm font-black text-slate-950">
                    {activeUnreadNotification.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-bold text-slate-700">
                    {activeUnreadNotification.message}
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <span>Click to view</span>
                    {unreadCount > 1 ? (
                      <span>+{unreadCount - 1} more</span>
                    ) : (
                      <span>
                        {formatActivityTime(activeUnreadNotification.timestamp)}
                      </span>
                    )}
                  </span>
                </span>
              </>
            );
          })()}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border bg-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl ${
          isOpen
            ? "border-[#FF2D36] text-[#FF2D36]"
            : "border-slate-200 text-slate-700"
        }`}
        aria-label={`Activity alerts${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#FF2D36] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section className="absolute right-0 top-14 flex w-[420px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF2D36]">
                Activity alerts
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-950">
                Latest updates
              </h2>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-extrabold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[min(70vh,640px)] space-y-2 overflow-y-auto bg-slate-50 p-3">
            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((notification) => {
                const style = notificationStyles[notification.type];
                const Icon = style.Icon;
                const isRead =
                  notification.timestamp <= activityState.initializedAt ||
                  readIds.has(notification.id);

                return (
                  <article
                    key={notification.id}
                    className={`group relative overflow-hidden rounded-xl border shadow-sm transition ${
                      isRead
                        ? "border-slate-200 bg-slate-100"
                        : style.unread
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className="flex w-full gap-3 px-3.5 py-3.5 pr-11 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isRead ? "bg-slate-300 text-slate-600" : style.icon
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase tracking-[0.16em] ${
                              isRead ? "text-slate-500" : style.labelClass
                            }`}
                          >
                            {style.label}
                          </span>
                          {!isRead ? (
                            <span className="h-2 w-2 rounded-full bg-[#FF2D36]" />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-sm font-black text-slate-950">
                          {notification.title}
                        </span>
                        <span className="mt-1 block text-xs font-bold text-slate-700">
                          {notification.message}
                        </span>
                        {notification.detail ? (
                          <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
                            {notification.detail}
                          </span>
                        ) : null}
                        <span className="mt-2 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                          {formatActivityTime(notification.timestamp)}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => dismissNotification(notification.id)}
                      className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-[#FF2D36] hover:shadow-sm"
                      aria-label={`Dismiss ${notification.title}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-black text-slate-800">
                  No activity alerts
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  New South pickups, check-ins, and completed deliveries will
                  show here.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {selectedNotification ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-5 py-10 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedNotification(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-alert-title"
        >
          {(() => {
            const style = notificationStyles[selectedNotification.type];
            const Icon = style.Icon;

            return (
              <section className="flex max-h-[calc(100vh-5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-5 border-b border-slate-200 px-7 py-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-[11px] font-black uppercase tracking-[0.18em] ${style.labelClass}`}
                      >
                        {style.label}
                      </p>
                      <h2
                        id="activity-alert-title"
                        className="mt-1 text-2xl font-black text-slate-950"
                      >
                        {selectedNotification.title}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {formatFullActivityTime(
                          selectedNotification.timestamp,
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedNotification(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                    aria-label="Close activity details"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <div className="overflow-y-auto px-7 py-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      What happened
                    </p>
                    <p className="mt-2 text-base font-extrabold leading-6 text-slate-900">
                      {selectedNotification.summary}
                    </p>
                  </div>

                  {selectedNotification.facts?.length > 0 ? (
                    <dl className="mt-5 grid grid-cols-2 gap-3">
                      {selectedNotification.facts.map((fact) => (
                        <div
                          key={`${fact.label}:${fact.value}`}
                          className="rounded-xl border border-slate-200 px-4 py-3"
                        >
                          <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                            {fact.label}
                          </dt>
                          <dd className="mt-1 break-words text-sm font-extrabold text-slate-900">
                            {fact.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  {selectedNotification.photos?.length > 0 ? (
                    <section className="mt-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Photos
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-700">
                            Photos captured with this activity
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {selectedPhotoIndex + 1} of {selectedNotification.photos.length}
                        </span>
                      </div>

                      <div className="relative mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                        <button
                          type="button"
                          onClick={() => setIsPhotoViewerOpen(true)}
                          className="block w-full cursor-zoom-in"
                          aria-label={`Expand ${selectedNotification.photos[selectedPhotoIndex].label || `photo ${selectedPhotoIndex + 1}`} slideshow`}
                        >
                          <img
                            src={selectedNotification.photos[selectedPhotoIndex].url}
                            alt={
                              selectedNotification.photos[selectedPhotoIndex]
                                .label ||
                              `Activity photo ${selectedPhotoIndex + 1}`
                            }
                            className="h-[min(46vh,390px)] w-full object-contain"
                          />
                        </button>

                        {selectedNotification.photos.length > 1 ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPhotoIndex((current) =>
                                  (current - 1 +
                                    selectedNotification.photos.length) %
                                  selectedNotification.photos.length,
                                )
                              }
                              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-lg transition hover:scale-105 hover:bg-white"
                              aria-label="Previous photo"
                            >
                              <ChevronLeft className="h-6 w-6" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPhotoIndex((current) =>
                                  (current + 1) %
                                  selectedNotification.photos.length,
                                )
                              }
                              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-lg transition hover:scale-105 hover:bg-white"
                              aria-label="Next photo"
                            >
                              <ChevronRight className="h-6 w-6" />
                            </button>
                          </>
                        ) : null}

                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-4 pb-3 pt-10">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-white">
                            {selectedNotification.photos[selectedPhotoIndex]
                              .label || `Photo ${selectedPhotoIndex + 1}`}
                          </p>
                        </div>
                      </div>

                      {selectedNotification.photos.length > 1 ? (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                          {selectedNotification.photos.map((photo, index) => (
                            <button
                              key={`${photo.id}:${photo.url}`}
                              type="button"
                              onClick={() => setSelectedPhotoIndex(index)}
                              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                                index === selectedPhotoIndex
                                  ? "border-[#FF2D36] shadow-sm"
                                  : "border-transparent opacity-70 hover:opacity-100"
                              }`}
                              aria-label={`Show ${photo.label || `photo ${index + 1}`}`}
                              aria-current={
                                index === selectedPhotoIndex ? "true" : undefined
                              }
                            >
                              <img
                                src={photo.url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedNotification(null)}
                      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </section>
            );
          })()}
        </div>
      ) : null}

      {selectedNotification?.photos?.length > 0 && isPhotoViewerOpen ? (
        <div
          className="fixed inset-0 z-[120] flex flex-col bg-slate-950/95 px-4 py-4 backdrop-blur-md sm:px-8 sm:py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsPhotoViewerOpen(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded activity photo slideshow"
        >
          <div className="flex items-center justify-between gap-4 text-white">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
                Delivery photos
              </p>
              <p className="mt-1 truncate text-sm font-black">
                {selectedNotification.photos[selectedPhotoIndex].label ||
                  `Photo ${selectedPhotoIndex + 1}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">
                {selectedPhotoIndex + 1} of {selectedNotification.photos.length}
              </span>
              <button
                type="button"
                onClick={() => setIsPhotoViewerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Close expanded slideshow"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center">
            <img
              src={selectedNotification.photos[selectedPhotoIndex].url}
              alt={
                selectedNotification.photos[selectedPhotoIndex].label ||
                `Delivery photo ${selectedPhotoIndex + 1}`
              }
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            />

            {selectedNotification.photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPhotoIndex((current) =>
                      (current - 1 + selectedNotification.photos.length) %
                      selectedNotification.photos.length,
                    )
                  }
                  className="absolute left-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-xl transition hover:scale-105 sm:left-3"
                  aria-label="Previous expanded photo"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPhotoIndex((current) =>
                      (current + 1) % selectedNotification.photos.length,
                    )
                  }
                  className="absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-xl transition hover:scale-105 sm:right-3"
                  aria-label="Next expanded photo"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </>
            ) : null}
          </div>

          {selectedNotification.photos.length > 1 ? (
            <div className="mx-auto mt-4 flex max-w-full gap-2 overflow-x-auto rounded-2xl bg-white/5 p-2">
              {selectedNotification.photos.map((photo, index) => (
                <button
                  key={`expanded:${photo.id}:${photo.url}`}
                  type="button"
                  onClick={() => setSelectedPhotoIndex(index)}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                    index === selectedPhotoIndex
                      ? "border-white opacity-100"
                      : "border-transparent opacity-50 hover:opacity-90"
                  }`}
                  aria-label={`Show expanded ${photo.label || `photo ${index + 1}`}`}
                  aria-current={index === selectedPhotoIndex ? "true" : undefined}
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
