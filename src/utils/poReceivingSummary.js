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
  return String(photo?.url || photo?.dataUrl || "").trim();
}

function getMaterialDescription(material, index) {
  return String(
    material?.sourceDescription ||
      material?.description ||
      material?.itemDescription ||
      material?.name ||
      material?.itemName ||
      `Item ${index + 1}`,
  ).trim();
}

function getMaterialQuantityAndDescription(material, index) {
  const explicitQuantity = String(
    material?.quantity || material?.qty || "",
  ).trim();
  const sourceDescription = String(material?.sourceDescription || "").trim();
  const description = getMaterialDescription(material, index);

  if (explicitQuantity || sourceDescription || !material?.sourceItemId) {
    return {
      quantity: explicitQuantity,
      description,
    };
  }

  const legacyAutoFilledMatch = description.match(
    /^\s*(?:qty\s*)?(\d+(?:\.\d+)?)\s+[·-]?\s*(.+)$/i,
  );

  if (!legacyAutoFilledMatch) {
    return {
      quantity: "",
      description,
    };
  }

  return {
    quantity: legacyAutoFilledMatch[1],
    description: legacyAutoFilledMatch[2].trim(),
  };
}

function getExpectedItemDescription(item) {
  return String(
    item?.description ||
      item?.materialDescription ||
      item?.itemDescription ||
      item?.name ||
      "Item description not entered",
  ).trim();
}

function normalizeItemDescription(item) {
  return getExpectedItemDescription(item)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getNumericItemQuantity(item) {
  const value = String(item?.quantity || item?.qty || "")
    .trim()
    .replace(/^qty\s*/i, "");
  const numericValue = Number(value.replace(/,/g, ""));

  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : null;
}

export function getReceivingItemStates(expectedItems = [], receivedItems = []) {
  const availableReceivedItems = receivedItems.map((item) => ({
    item,
    remainingQuantity: getNumericItemQuantity(item),
    used: false,
  }));

  return expectedItems.map((expectedItem) => {
    const expectedDescription = normalizeItemDescription(expectedItem);
    const expectedQuantity = getNumericItemQuantity(expectedItem);
    const expectedSourceItemId = String(expectedItem?.id || "").trim();
    const matchedReceivedItems = [];
    const matchesExpectedItem = ({ item, used }) => {
      if (used) {
        return false;
      }

      const receivedSourceItemId = String(item?.sourceItemId || "").trim();

      if (expectedSourceItemId && receivedSourceItemId) {
        return expectedSourceItemId === receivedSourceItemId;
      }

      return normalizeItemDescription(item) === expectedDescription;
    };

    if (expectedQuantity === null) {
      const matchingItem = availableReceivedItems.find(matchesExpectedItem);

      if (!matchingItem) {
        return {
          expectedItem,
          isReceived: false,
          matchedReceivedItems,
          remainingQuantity: null,
        };
      }

      matchingItem.used = true;
      matchedReceivedItems.push(matchingItem.item);
      return {
        expectedItem,
        isReceived: true,
        matchedReceivedItems,
        remainingQuantity: 0,
      };
    }

    let remainingExpectedQuantity = expectedQuantity;

    availableReceivedItems.forEach((receivedEntry) => {
      if (
        remainingExpectedQuantity <= 0 ||
        !matchesExpectedItem(receivedEntry)
      ) {
        return;
      }

      if (receivedEntry.remainingQuantity === null) {
        receivedEntry.used = true;
        matchedReceivedItems.push(receivedEntry.item);
        remainingExpectedQuantity = 0;
        return;
      }

      const quantityToApply = Math.min(
        remainingExpectedQuantity,
        receivedEntry.remainingQuantity,
      );

      remainingExpectedQuantity -= quantityToApply;
      receivedEntry.remainingQuantity -= quantityToApply;

      if (quantityToApply > 0) {
        matchedReceivedItems.push(receivedEntry.item);
      }

      if (receivedEntry.remainingQuantity <= 0) {
        receivedEntry.used = true;
      }
    });

    return {
      expectedItem,
      isReceived: remainingExpectedQuantity <= 0,
      matchedReceivedItems,
      remainingQuantity: remainingExpectedQuantity,
    };
  });
}

export function getWaitingReceivingItems(itemReceivingStates = []) {
  return itemReceivingStates.flatMap(
    ({ expectedItem, isReceived, remainingQuantity }) => {
      if (isReceived) {
        return [];
      }

      if (remainingQuantity === null) {
        return [expectedItem];
      }

      return [
        {
          ...expectedItem,
          quantity: Number.isInteger(remainingQuantity)
            ? String(remainingQuantity)
            : String(Number(remainingQuantity.toFixed(3))),
        },
      ];
    },
  );
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
      const { description, quantity } = getMaterialQuantityAndDescription(
        material,
        materialIndex,
      );
      const location = String(material?.location || fallbackLocation).trim();
      const itemKey = [
        checkIn?.id || "check-in",
        material?.id || materialIndex,
        description,
        quantity,
        location,
      ]
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
        sourceItemId: String(material?.sourceItemId || "").trim(),
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
