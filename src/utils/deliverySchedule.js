export const deliveryTimeSlotOptions = [
  { value: "08:00", label: "8:00 AM" },
  { value: "08:30", label: "8:30 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "09:30", label: "9:30 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "10:30", label: "10:30 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "11:30", label: "11:30 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "12:30", label: "12:30 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "13:30", label: "1:30 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "14:30", label: "2:30 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "15:30", label: "3:30 PM" },
  { value: "16:00", label: "4:00 PM" },
];

export const defaultUnloadDurationMinutes = {
  "Hand unload": 60,
  Dump: 20,
  Forklift: 30,
};

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
  return (
    deliveryTimeSlotOptions.find((timeSlot) => timeSlot.value === timeValue)
      ?.label || timeValue || "Unscheduled"
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

export function getDeliveryTimeRange(delivery) {
  const startTime = delivery?.deliveryTimeSlot || "";
  const duration = getDeliveryDurationMinutes(
    delivery?.unloadType,
    delivery?.estimatedDurationMinutes,
  );
  const endTime = addMinutesToTime(startTime, duration);

  if (!startTime) {
    return "Unscheduled";
  }

  return endTime
    ? `${getTimeSlotLabel(startTime)} - ${getTimeSlotLabel(endTime)}`
    : getTimeSlotLabel(startTime);
}
