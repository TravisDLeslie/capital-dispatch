import {
  getDownloadURL,
  ref,
  uploadBytes,
  uploadString,
} from "firebase/storage";
import { firebaseStorageBucket, storage } from "./firebase";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Unable to prepare photo for upload."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function safeFileName(value) {
  return String(value || "pickup-photo")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function safePathSegment(value, label) {
  const text = String(value || "").trim();

  if (!text || text === "[object Object]") {
    throw new Error(`Missing ${label} for photo upload.`);
  }

  return text
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function compressImageFile(file, options = {}) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const maxWidth = options.maxWidth || 1200;
  const scale = Math.min(maxWidth / image.width, 1);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, options.quality || 0.72);

  return {
    blob,
    width,
    height,
  };
}

export async function uploadSupplierRunPickupPhoto({
  supplierRunId,
  itemId,
  file,
}) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  const capturedAt = new Date().toISOString();
  const safeSupplierRunId = safePathSegment(
    supplierRunId,
    "South PO ID",
  );
  const safeItemId = safePathSegment(itemId, "item ID");
  const { blob, width, height } = await compressImageFile(file);
  const fileName = `${Date.now()}-${safeFileName(file.name || "pickup")}.jpg`;
  const path = `supplierRuns/${safeSupplierRunId}/items/${safeItemId}/${fileName}`;
  const photoRef = ref(storage, path);

  try {
    await uploadBytes(photoRef, blob, {
      contentType: "image/jpeg",
    });
  } catch (error) {
    error.message = `${
      error.message || "Upload failed"
    } Bucket: ${firebaseStorageBucket || "missing"} Path: ${path} Blob: ${
      blob.type || "unknown"
    }/${blob.size || 0}`;
    throw error;
  }

  const url = await getDownloadURL(photoRef);

  return {
    url,
    path,
    name: file.name || fileName,
    type: "image/jpeg",
    size: blob.size,
    width,
    height,
    capturedAt,
  };
}

function isDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:");
}

function getPhotoSource(photo) {
  if (!photo) {
    return "";
  }

  if (typeof photo === "string") {
    return photo;
  }

  return photo.dataUrl || photo.url || "";
}

function getDataUrlContentType(dataUrl, fallback = "image/jpeg") {
  const match = String(dataUrl).match(/^data:([^;,]+)[;,]/);

  return match?.[1] || fallback;
}

async function uploadCheckInDataUrlPhoto({
  checkInId,
  materialId,
  photo,
  field,
  index,
}) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  const dataUrl = getPhotoSource(photo);

  if (!isDataUrl(dataUrl)) {
    return photo;
  }

  const capturedAt = photo?.capturedAt || new Date().toISOString();
  const safeCheckInId = safePathSegment(checkInId, "check-in ID");
  const safeMaterialId = safePathSegment(materialId, "material ID");
  const contentType = getDataUrlContentType(dataUrl);
  const fileName = `${Date.now()}-${index + 1}-${safeFileName(
    photo?.name || field,
  )}.jpg`;
  const path = `checkIns/${safeCheckInId}/materials/${safeMaterialId}/${field}/${fileName}`;
  const photoRef = ref(storage, path);

  try {
    await uploadString(photoRef, dataUrl, "data_url", {
      contentType,
    });
  } catch (error) {
    error.message = `${
      error.message || "Upload failed"
    } Bucket: ${firebaseStorageBucket || "missing"} Path: ${path}`;
    throw error;
  }

  const url = await getDownloadURL(photoRef);

  return {
    ...photo,
    dataUrl: url,
    url,
    path,
    type: contentType,
    capturedAt,
  };
}

async function uploadCheckInPhotoList({
  checkInId,
  materialId,
  photos,
  field,
}) {
  const photoList = Array.isArray(photos)
    ? photos.filter(Boolean)
    : photos
      ? [photos]
      : [];

  return Promise.all(
    photoList.map((photo, index) =>
      uploadCheckInDataUrlPhoto({
        checkInId,
        materialId,
        photo,
        field,
        index,
      }),
    ),
  );
}

export async function uploadCheckInPhotos(checkIn) {
  if (!checkIn || !Array.isArray(checkIn.materials)) {
    return checkIn;
  }

  const materials = await Promise.all(
    checkIn.materials.map(async (material, materialIndex) => {
      const materialId =
        material.id || `material-${materialIndex + 1}`;
      const locationPhotos = await uploadCheckInPhotoList({
        checkInId: checkIn.id,
        materialId,
        photos: material.locationPhotos || material.locationPhoto,
        field: "locationPhotos",
      });
      const damagePhotos = await uploadCheckInPhotoList({
        checkInId: checkIn.id,
        materialId,
        photos: material.damagePhotos || material.damagePhoto,
        field: "damagePhotos",
      });

      return {
        ...material,
        locationPhoto: locationPhotos[0] || null,
        locationPhotos,
        damagePhoto: damagePhotos[0] || null,
        damagePhotos,
      };
    }),
  );

  return {
    ...checkIn,
    materials,
    locationPhoto: materials
      .flatMap((material) => material.locationPhotos || [])
      .filter(Boolean)[0] || checkIn.locationPhoto || null,
  };
}
