export function getPhotoUrl(photo) {
  return String(photo?.url || photo?.dataUrl || "").trim();
}

export function getPickupPhotoList(item) {
  const photos = Array.isArray(item?.pickupPhotos)
    ? item.pickupPhotos.filter((photo) => getPhotoUrl(photo))
    : [];
  const legacyPhoto = getPhotoUrl(item?.pickupPhoto) ? item.pickupPhoto : null;

  if (
    legacyPhoto &&
    !photos.some((photo) => getPhotoUrl(photo) === getPhotoUrl(legacyPhoto))
  ) {
    return [...photos, legacyPhoto];
  }

  return photos;
}

export function hasPickupPhoto(item) {
  return getPickupPhotoList(item).length > 0;
}

export function isPickupItemComplete(item) {
  return Boolean(item?.pickedUp || item?.pickedUpAt);
}

export function addPickupPhotoToItems(items, itemId, pickupPhoto) {
  return items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    const hasNewPickupPhoto = Boolean(
      pickupPhoto &&
        (typeof pickupPhoto !== "object" ||
          pickupPhoto.url ||
          pickupPhoto.dataUrl),
    );

    if (!hasNewPickupPhoto) {
      return item;
    }

    const existingPhotos = getPickupPhotoList(item);

    return {
      ...item,
      pickupPhoto,
      pickupPhotos: [...existingPhotos, pickupPhoto],
    };
  });
}

export function markPickupItemPickedUpInItems(
  items,
  itemId,
  pickedUpAt = new Date().toISOString(),
) {
  return items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    return {
      ...item,
      pickedUp: true,
      pickedUpAt: item.pickedUpAt || pickedUpAt,
    };
  });
}

export function areAllPickupItemsComplete(items) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => isPickupItemComplete(item))
  );
}
