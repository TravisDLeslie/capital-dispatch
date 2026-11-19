function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T12:00:00`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.getFullYear() === Number(value.slice(0, 4)) &&
    parsedDate.getMonth() + 1 === Number(value.slice(5, 7)) &&
    parsedDate.getDate() === Number(value.slice(8, 10))
  );
}

function isValidTimeValue(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hours, minutes] = value.split(":").map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function timeValueToMinutes(value) {
  if (!isValidTimeValue(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

export const defaultCalendarBlockOffBackgroundColor = "#6B4423";
export const deliveryDayFullBlockOffIdPrefix = "delivery-day-full-";

export function isDeliveryDayFullBlockOff(blockOff) {
  return String(blockOff?.id || "").startsWith(
    deliveryDayFullBlockOffIdPrefix,
  );
}

export function createDeliveryDayFullBlockOff(date, restoreBlockOff = null) {
  const normalizedRestoreBlockOff = normalizeCalendarBlockOffEntry(
    restoreBlockOff ? { ...restoreBlockOff, date } : null,
    0,
    { allowRestore: false },
  );

  return {
    id: `${deliveryDayFullBlockOffIdPrefix}${date}`,
    date,
    reason: "Existing deliveries remain scheduled",
    icon: "🔒",
    backgroundColor: "#0F172A",
    mode: "allDay",
    openStart: "",
    openEnd: "",
    ...(normalizedRestoreBlockOff &&
    !isDeliveryDayFullBlockOff(normalizedRestoreBlockOff)
      ? { restoreBlockOff: normalizedRestoreBlockOff }
      : {}),
  };
}

export function getDeliveryDayFullRestoreBlockOff(blockOff) {
  if (!isDeliveryDayFullBlockOff(blockOff)) {
    return null;
  }

  const restoredBlockOff = normalizeCalendarBlockOffEntry(
    blockOff?.restoreBlockOff
      ? { ...blockOff.restoreBlockOff, date: blockOff.date }
      : null,
    0,
    { allowRestore: false },
  );

  return restoredBlockOff && !isDeliveryDayFullBlockOff(restoredBlockOff)
    ? restoredBlockOff
    : null;
}

export const calendarBlockOffColorOptions = [
  { value: "#6B4423", label: "Brown" },
  { value: "#991B1B", label: "Red" },
  { value: "#C2410C", label: "Orange" },
  { value: "#166534", label: "Green" },
  { value: "#0F766E", label: "Teal" },
  { value: "#1D4ED8", label: "Blue" },
  { value: "#6D28D9", label: "Purple" },
  { value: "#0F172A", label: "Black" },
];

export function normalizeCalendarBlockOffBackgroundColor(value) {
  const color = String(value || "").trim().toUpperCase();

  return /^#[0-9A-F]{6}$/.test(color)
    ? color
    : defaultCalendarBlockOffBackgroundColor;
}

export function getCalendarBlockOffTextColor(backgroundColor) {
  const color = normalizeCalendarBlockOffBackgroundColor(backgroundColor);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const perceivedBrightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return perceivedBrightness > 165 ? "#0F172A" : "#FFFFFF";
}

export const calendarBlockOffIconOptions = [
  { value: "📅", label: "Calendar" },
  { value: "🦃", label: "Thanksgiving" },
  { value: "🎄", label: "Christmas" },
  { value: "🎆", label: "New Year" },
  { value: "🇺🇸", label: "Patriotic holiday" },
  { value: "🎃", label: "Halloween" },
  { value: "🎉", label: "Company event" },
  { value: "📦", label: "Inventory" },
  { value: "🌨️", label: "Weather" },
  { value: "🏢", label: "Office closed" },
];

export function isAllDayCalendarBlockOff(blockOff) {
  return Boolean(blockOff) && blockOff.mode !== "limitedHours";
}

export function formatCalendarBlockOffTime(timeValue) {
  const minutes = timeValueToMinutes(String(timeValue || ""));

  if (minutes === null) {
    return "";
  }

  const hours = Math.floor(minutes / 60);
  const minuteValue = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";

  return `${hours % 12 || 12}:${String(minuteValue).padStart(2, "0")} ${period}`;
}

export function getCalendarBlockOffScheduleLabel(blockOff) {
  if (!blockOff) {
    return "";
  }

  if (isDeliveryDayFullBlockOff(blockOff)) {
    const restoredBlockOff = getDeliveryDayFullRestoreBlockOff(blockOff);

    if (restoredBlockOff && !isAllDayCalendarBlockOff(restoredBlockOff)) {
      return `Day is full for deliveries · Partially closed (${formatCalendarBlockOffTime(
        restoredBlockOff.openStart,
      )}–${formatCalendarBlockOffTime(restoredBlockOff.openEnd)} open)`;
    }

    return "Day is full for deliveries";
  }

  if (isAllDayCalendarBlockOff(blockOff)) {
    return "Closed all day";
  }

  return `Open ${formatCalendarBlockOffTime(blockOff.openStart)}–${formatCalendarBlockOffTime(blockOff.openEnd)}`;
}

function normalizeCalendarBlockOffEntry(
  blockOff,
  index,
  { allowRestore = true } = {},
) {
  const date = String(blockOff?.date || "").trim();
  const reason = String(blockOff?.reason || "").trim();

  if (!isValidDateKey(date) || !reason) {
    return null;
  }

  const requestedMode =
    blockOff?.mode === "limitedHours" ? "limitedHours" : "allDay";
  const openStart = String(blockOff?.openStart || "").trim();
  const openEnd = String(blockOff?.openEnd || "").trim();
  const hasValidOpenWindow =
    requestedMode === "limitedHours" &&
    timeValueToMinutes(openStart) !== null &&
    timeValueToMinutes(openEnd) !== null &&
    timeValueToMinutes(openStart) < timeValueToMinutes(openEnd);
  const normalizedBlockOff = {
    id: String(blockOff?.id || `calendar-block-${date}-${index}`),
    date,
    reason,
    icon: String(blockOff?.icon || "📅").trim() || "📅",
    backgroundColor: normalizeCalendarBlockOffBackgroundColor(
      blockOff?.backgroundColor,
    ),
    mode: hasValidOpenWindow ? "limitedHours" : "allDay",
    openStart: hasValidOpenWindow ? openStart : "",
    openEnd: hasValidOpenWindow ? openEnd : "",
  };

  if (allowRestore && isDeliveryDayFullBlockOff(normalizedBlockOff)) {
    const restoredBlockOff = normalizeCalendarBlockOffEntry(
      blockOff?.restoreBlockOff
        ? { ...blockOff.restoreBlockOff, date }
        : null,
      index,
      { allowRestore: false },
    );

    if (restoredBlockOff && !isDeliveryDayFullBlockOff(restoredBlockOff)) {
      normalizedBlockOff.restoreBlockOff = restoredBlockOff;
    }
  }

  return normalizedBlockOff;
}

export function normalizeCalendarBlockOffs(blockOffs) {
  const blockOffByDate = new Map();

  (Array.isArray(blockOffs) ? blockOffs : []).forEach((blockOff, index) => {
    const normalizedBlockOff = normalizeCalendarBlockOffEntry(blockOff, index);

    if (!normalizedBlockOff) {
      return;
    }

    blockOffByDate.set(normalizedBlockOff.date, normalizedBlockOff);
  });

  return [...blockOffByDate.values()].sort((first, second) =>
    first.date.localeCompare(second.date),
  );
}

export function getCalendarBlockOffMap(blockOffs) {
  return new Map(
    normalizeCalendarBlockOffs(blockOffs).map((blockOff) => [
      blockOff.date,
      blockOff,
    ]),
  );
}
