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

function getPhotoDataUrl(photo) {
  return String(photo?.dataUrl || photo?.url || "").trim();
}

function getMaterialDescription(material, index) {
  return String(
    material?.description ||
      material?.itemDescription ||
      material?.name ||
      material?.itemName ||
      `Item ${index + 1}`,
  ).trim();
}

function getReceivingLocationPhotos(matchingCheckIns, poNumber) {
  const photos = [];
  const seenPhotos = new Set();

  const addPhoto = (photo, { checkIn, location = "", description = "" }) => {
    const dataUrl = getPhotoDataUrl(photo);

    if (!dataUrl || seenPhotos.has(dataUrl)) {
      return;
    }

    seenPhotos.add(dataUrl);
    const receivedDate = formatReceivedDate(
      getDateValue(
        checkIn?.checkedInAt ||
          checkIn?.receivedAt ||
          checkIn?.updatedAt ||
          checkIn?.createdAt,
      ),
    );

    photos.push({
      id: `${checkIn?.id || poNumber || "po"}-${photos.length}`,
      dataUrl,
      location: String(location || "").trim(),
      title: location ? `Received at ${location}` : "Receiving location photo",
      subtitle: [description, receivedDate].filter(Boolean).join(" • "),
    });
  };

  matchingCheckIns.forEach((checkIn) => {
    const materials = getCheckInMaterials(checkIn);
    const fallbackLocation = String(checkIn?.poLocation || "").trim();

    if (checkIn?.locationPhoto) {
      addPhoto(checkIn.locationPhoto, {
        checkIn,
        location: fallbackLocation,
      });
    }

    materials.forEach((material, materialIndex) => {
      const location = String(material?.location || fallbackLocation).trim();
      const description = getMaterialDescription(material, materialIndex);
      const materialPhotos = Array.isArray(material?.locationPhotos)
        ? material.locationPhotos
        : [];

      materialPhotos.forEach((photo) =>
        addPhoto(photo, { checkIn, location, description }),
      );
      if (material?.locationPhoto) {
        addPhoto(material.locationPhoto, {
          checkIn,
          location,
          description,
        });
      }
    });
  });

  return photos;
}

function getReceivedItems(matchingCheckIns) {
  const receivedItems = [];
  const seenItems = new Set();

  matchingCheckIns.forEach((checkIn) => {
    const fallbackLocation = String(checkIn?.poLocation || "").trim();
    const receivedDateLabel = formatReceivedDate(
      getDateValue(
        checkIn?.checkedInAt ||
          checkIn?.receivedAt ||
          checkIn?.updatedAt ||
          checkIn?.createdAt,
      ),
    );

    getCheckInMaterials(checkIn).forEach((material, materialIndex) => {
      const description = getMaterialDescription(material, materialIndex);
      const quantity = String(material?.quantity || material?.qty || "").trim();
      const location = String(material?.location || fallbackLocation).trim();
      const itemKey = [description, quantity, location]
        .join("|")
        .toLowerCase();

      if (seenItems.has(itemKey)) {
        return;
      }

      seenItems.add(itemKey);
      receivedItems.push({
        id: String(material?.id || `${checkIn?.id || "check-in"}-${materialIndex}`),
        description,
        quantity,
        location,
        receivedDateLabel,
      });
    });
  });

  return receivedItems;
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
  const receivingPhotos = getReceivingLocationPhotos(
    matchingCheckIns,
    poNumber,
  );
  const receivedItems = getReceivedItems(matchingCheckIns);

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
    receivedItems,
    receivingPhotos,
  };
}
