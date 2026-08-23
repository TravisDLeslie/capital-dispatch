function formatTimeLabel(timeValue) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function createTimeSlotOptions(startTime, endTime, incrementMinutes) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  const options = [];

  for (
    let totalMinutes = startTotalMinutes;
    totalMinutes <= endTotalMinutes;
    totalMinutes += incrementMinutes
  ) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}`;

    options.push({
      value,
      label: formatTimeLabel(value),
    });
  }

  return options;
}

export const deliveryTimeSlotOptions = createTimeSlotOptions(
  "06:00",
  "16:00",
  15,
);

export const defaultUnloadDurationMinutes = {
  "Hand unload": 60,
  Dump: 20,
  Forklift: 30,
};

export const deliveryLoadBufferMinutes = 20;

export const defaultDeliveryScheduleSettings = {
  id: "deliverySchedule",
  unloadDurations: defaultUnloadDurationMinutes,
};

export function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export function getDeliveryDurationMinutes(
  unloadType,
  explicitDuration,
  settings = defaultDeliveryScheduleSettings,
) {
  const numericDuration = Number(explicitDuration);

  if (Number.isFinite(numericDuration) && numericDuration > 0) {
    return numericDuration;
  }

  return (
    Number(settings?.unloadDurations?.[unloadType]) ||
    defaultUnloadDurationMinutes[unloadType] ||
    30
  );
}

export function getTimeSlotLabel(timeValue) {
  if (!timeValue) {
    return "Unscheduled";
  }

  return (
    deliveryTimeSlotOptions.find((timeSlot) => timeSlot.value === timeValue)
      ?.label ||
    (/^\d{2}:\d{2}$/.test(timeValue) ? formatTimeLabel(timeValue) : timeValue)
  );
}

export function addMinutesToTime(timeValue, minutesToAdd) {
  if (!timeValue) {
    return "";
  }

  const [hours, minutes] = timeValue.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "";
  }

  const date = new Date();
  date.setHours(hours, minutes + minutesToAdd, 0, 0);

  return date.toTimeString().slice(0, 5);
}

export function getDeliveryDriveMinutes(delivery) {
  const driveMinutes = Number(delivery?.oneWayDriveMinutes);

  return Number.isFinite(driveMinutes) && driveMinutes > 0
    ? driveMinutes
    : 0;
}

export function getDeliveryTotalBlockMinutes(delivery) {
  const unloadMinutes = getDeliveryDurationMinutes(
    delivery?.unloadType,
    delivery?.estimatedDurationMinutes,
  );
  const driveMinutes = getDeliveryDriveMinutes(delivery);

  return unloadMinutes + driveMinutes * 2 + deliveryLoadBufferMinutes;
}

export function timeToMinutes(timeValue) {
  if (!timeValue) {
    return null;
  }

  const [hours, minutes] = timeValue.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

export function getDeliveryTimeWindow(delivery) {
  const startMinutes = timeToMinutes(delivery?.deliveryTimeSlot || "");

  if (startMinutes === null) {
    return null;
  }

  return {
    start: startMinutes,
    end: startMinutes + getDeliveryTotalBlockMinutes(delivery),
  };
}

export function scheduleWindowsOverlap(firstWindow, secondWindow) {
  if (!firstWindow || !secondWindow) {
    return false;
  }

  return (
    firstWindow.start < secondWindow.end && secondWindow.start < firstWindow.end
  );
}

export function getDeliveryTimeRange(delivery) {
  const startTime = delivery?.deliveryTimeSlot || "";
  const duration = getDeliveryTotalBlockMinutes(delivery);
  const endTime = addMinutesToTime(startTime, duration);

  if (!startTime) {
    return "Unscheduled";
  }

  return endTime
    ? `${getTimeSlotLabel(startTime)} - ${getTimeSlotLabel(endTime)}`
    : getTimeSlotLabel(startTime);
}

export function getDeliveryBackAroundLabel(delivery) {
  const startTime = delivery?.deliveryTimeSlot || "";

  if (!startTime) {
    return "Not scheduled";
  }

  const backAroundTime = addMinutesToTime(
    startTime,
    getDeliveryTotalBlockMinutes(delivery),
  );

  return backAroundTime ? getTimeSlotLabel(backAroundTime) : "Not scheduled";
}

export function getDeliverySiteArrivalLabel(delivery) {
  const startTime = delivery?.deliveryTimeSlot || "";

  if (!startTime) {
    return "Not scheduled";
  }

  const siteArrivalTime = addMinutesToTime(
    startTime,
    deliveryLoadBufferMinutes + getDeliveryDriveMinutes(delivery),
  );

  return siteArrivalTime ? getTimeSlotLabel(siteArrivalTime) : "Not scheduled";
}

export function getDeliveryBlockSummary(delivery) {
  const driveMinutes = getDeliveryDriveMinutes(delivery);
  const unloadMinutes = getDeliveryDurationMinutes(
    delivery?.unloadType,
    delivery?.estimatedDurationMinutes,
  );
  const totalMinutes = getDeliveryTotalBlockMinutes(delivery);

  if (driveMinutes <= 0) {
    return `${totalMinutes} min total · ${deliveryLoadBufferMinutes} loading + ${unloadMinutes} unload`;
  }

  return `${totalMinutes} min total · ${deliveryLoadBufferMinutes} loading + ${driveMinutes * 2} drive + ${unloadMinutes} unload`;
}
