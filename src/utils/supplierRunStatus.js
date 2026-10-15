function getPickupPhotoUrl(photo) {
  return String(photo?.url || photo?.dataUrl || "").trim();
}

export function isSupplierRunItemComplete(item) {
  const pickupPhotos = Array.isArray(item?.pickupPhotos)
    ? item.pickupPhotos
    : [];

  return Boolean(
    item?.pickedUp ||
      item?.pickedUpAt ||
      pickupPhotos.some(getPickupPhotoUrl) ||
      getPickupPhotoUrl(item?.pickupPhoto),
  );
}

export function getOpenSupplierRunItemCount(supplierRun) {
  return Array.isArray(supplierRun?.items)
    ? supplierRun.items.filter((item) => !isSupplierRunItemComplete(item)).length
    : 0;
}

export function isOpenSupplierRun(supplierRun) {
  return Boolean(
    supplierRun?.status !== "complete" &&
      getOpenSupplierRunItemCount(supplierRun) > 0,
  );
}

export function isAssignedOpenSupplierRun(supplierRun) {
  return Boolean(
    isOpenSupplierRun(supplierRun) &&
      supplierRun?.dispatchStatus !== "needsDispatch" &&
      supplierRun?.driver,
  );
}
