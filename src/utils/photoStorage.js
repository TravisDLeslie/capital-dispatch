import {
  getDownloadURL,
  ref,
  uploadBytes,
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
