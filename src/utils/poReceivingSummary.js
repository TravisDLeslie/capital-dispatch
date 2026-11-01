function normalizePONumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function getCheckInMaterials(checkIn) {
  if (Array.isArray(checkIn?.materials)) {
    return checkIn.materials;
  }

  if (Array.isArray(checkIn?.items)) {
    return checkIn.items;
  }

  return [];
}

function checkInMatchesPO(checkIn, poNumber) {
  const normalizedPO = normalizePONumber(poNumber);

  if (!normalizedPO) {
    return false;
  }

  return [
    checkIn?.poNumber,
    checkIn?.sourceSupplierRunPoNumber,
    checkIn?.sourceTheirTruckPONumber,
  ]
    .filter(Boolean)
    .some((value) => normalizePONumber(value) === normalizedPO);
}

function addUniqueLocation(locations, seenLocations, value) {
  const location = String(value || "").trim();
  const normalizedLocation = location.toLowerCase();

  if (
    !location ||
    normalizedLocation === "multiple material locations" ||
    seenLocations.has(normalizedLocation)
  ) {
    return;
  }

  seenLocations.add(normalizedLocation);
  locations.push(location);
}

function formatLocationSummary(locations) {
  if (locations.length <= 2) {
    return locations.join(", ");
  }

  return `${locations.slice(0, 2).join(", ")} +${locations.length - 2}`;
}

function getDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLatestReceivedDate(checkIns) {
  return checkIns
    .map((checkIn) =>
      getDateValue(
        checkIn?.checkedInAt ||
          checkIn?.receivedAt ||
          checkIn?.updatedAt ||
          checkIn?.createdAt,
      ),
    )
    .filter(Boolean)
    .sort((firstDate, secondDate) => secondDate - firstDate)[0];
}

function formatReceivedDate(date) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function getPOReceivingSummary(
  checkIns,
  poNumber,
  expectedItemCount = 0,
) {
  const matchingCheckIns = (Array.isArray(checkIns) ? checkIns : []).filter(
    (checkIn) => checkInMatchesPO(checkIn, poNumber),
  );
  const locations = [];
  const seenLocations = new Set();
  let receivedItemCount = 0;

  matchingCheckIns.forEach((checkIn) => {
    const materials = getCheckInMaterials(checkIn);

    receivedItemCount += materials.length;
    materials.forEach((material) =>
      addUniqueLocation(locations, seenLocations, material?.location),
    );

    if (materials.length === 0 || locations.length === 0) {
      addUniqueLocation(locations, seenLocations, checkIn?.poLocation);
    }
  });

  const isReceived = matchingCheckIns.length > 0;
  const isPartial =
    isReceived &&
    Number(expectedItemCount) > 0 &&
    receivedItemCount < Number(expectedItemCount);
  const latestReceivedDate = getLatestReceivedDate(matchingCheckIns);

  return {
    key: !isReceived ? "pending" : isPartial ? "partial" : "received",
    label: !isReceived
      ? "Not received yet"
      : isPartial
        ? "Partially received"
        : "Received",
    isReceived,
    isPartial,
    matchingCheckInCount: matchingCheckIns.length,
    receivedItemCount,
    receivedAt: latestReceivedDate?.toISOString() || "",
    receivedDateLabel: formatReceivedDate(latestReceivedDate),
    locations,
    locationLabel: formatLocationSummary(locations),
  };
}
