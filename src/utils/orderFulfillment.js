import { isDeliveryComplete } from "./deliveryStatus";

function normalizeOrderNumber(value) {
  const cleanValue = String(value || "").trim();
  const digits = cleanValue.replace(/\D/g, "");

  return digits || cleanValue.toLowerCase();
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value === "object" && Number.isFinite(value?.seconds)) {
    return new Date(value.seconds * 1000);
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDeliveredDate(value) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getRecordOrderNumbers(record) {
  const items = [
    ...(Array.isArray(record?.items) ? record.items : []),
    ...(Array.isArray(record?.materials) ? record.materials : []),
  ];

  return [
    record?.orderNumber,
    record?.sourceOrderNumber,
    record?.orderAssignment?.orderNumber,
    ...items.map((item) => item?.orderNumber),
  ]
    .map(normalizeOrderNumber)
    .filter(Boolean);
}

/**
 * @returns {{ key: "pod" | "willCall" | "delivery"; label: string } | null}
 */
function getFulfillmentType(record) {
  const rawType = String(
    record?.handoffType || record?.orderMethod || record?.fulfillmentType || "",
  )
    .trim()
    .toLowerCase();

  if (rawType === "pod" || rawType === "podpickup") {
    return { key: "pod", label: "POD" };
  }

  if (rawType === "willcall" || rawType === "will call") {
    return { key: "willCall", label: "Will Call" };
  }

  if (rawType === "delivery" || rawType === "customerdelivery") {
    return { key: "delivery", label: "Delivery" };
  }

  if (
    record?.address ||
    record?.deliveryAddress ||
    record?.dispatchStatus ||
    record?.linkedDeliveryId
  ) {
    return { key: "delivery", label: "Delivery" };
  }

  return null;
}

/**
 * @returns {Array<{
 *   orderNumber: string;
 *   key: "pod" | "willCall" | "delivery";
 *   label: string;
 *   isDelivered: boolean;
 *   deliveredDateLabel: string;
 *   deliveryRecord: Record<string, any> | null;
 * }>}
 */
export function getOrderFulfillmentBadges(orderNumbers, records) {
  const safeRecords = Array.isArray(records) ? records : [];
  const seenBadges = new Set();
  const badges = [];

  (Array.isArray(orderNumbers) ? orderNumbers : [orderNumbers]).forEach(
    (orderNumber) => {
      const orderKey = normalizeOrderNumber(orderNumber);
      const matchingRecords = safeRecords.filter((record) =>
        getRecordOrderNumbers(record).includes(orderKey),
      );
      const fulfillment = matchingRecords
        .map(getFulfillmentType)
        .find((value) => value !== null);
      const completedDelivery =
        matchingRecords.find(
          (record) =>
            getFulfillmentType(record)?.key === "delivery" &&
            Boolean(record?.deliveredAt || record?.delivered),
        ) ||
        matchingRecords.find(
          (record) =>
            getFulfillmentType(record)?.key === "delivery" &&
            isDeliveryComplete(record),
        );

      if (!orderKey || !fulfillment) {
        return;
      }

      const badgeKey = `${orderKey}-${fulfillment.key}`;

      if (seenBadges.has(badgeKey)) {
        return;
      }

      seenBadges.add(badgeKey);
      badges.push({
        orderNumber: String(orderNumber || "").trim(),
        ...fulfillment,
        isDelivered: Boolean(completedDelivery),
        deliveredDateLabel: formatDeliveredDate(
          completedDelivery?.deliveredAt ||
            completedDelivery?.completedAt ||
            completedDelivery?.updatedAt,
        ),
        deliveryRecord: completedDelivery || null,
      });
    },
  );

  return badges;
}

export function getOrderFulfillmentBadgeClass(fulfillmentKey) {
  if (fulfillmentKey === "pod") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (fulfillmentKey === "willCall") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-red-200 bg-red-50 text-[#FC2C38]";
}
