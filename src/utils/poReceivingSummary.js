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
    locations,
    locationLabel: formatLocationSummary(locations),
  };
}
