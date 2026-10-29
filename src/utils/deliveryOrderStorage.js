import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { auth, firebaseStorageBucket, storage } from "./firebase";
import { compressImageFile } from "./photoStorage";

const MAX_DELIVERY_ORDER_FILE_SIZE = 15 * 1024 * 1024;

function safeFileName(value) {
  return String(value || "delivery-order")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function safePathSegment(value, label) {
  const text = String(value || "").trim();

  if (!text || text === "[object Object]") {
    throw new Error(`Missing ${label} for delivery-order upload.`);
  }

  return text
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isPdfFile(file) {
  return (
    file?.type === "application/pdf" ||
    String(file?.name || "").toLowerCase().endsWith(".pdf")
  );
}

function isImageFile(file) {
  return String(file?.type || "").startsWith("image/");
}

async function prepareDeliveryOrderFile(file) {
  if (isPdfFile(file)) {
    return {
      blob: file,
      contentType: "application/pdf",
      fileName: safeFileName(file.name || "delivery-order.pdf"),
    };
  }

  if (!isImageFile(file)) {
    throw new Error("Choose a photo, image, or PDF Delivery Order Copy.");
  }

  try {
    const { blob } = await compressImageFile(file, {
      maxWidth: 1800,
      quality: 0.8,
    });

    return {
      blob,
      contentType: "image/jpeg",
      fileName: `${safeFileName(
        String(file.name || "delivery-order").replace(/\.[^.]+$/, ""),
      )}.jpg`,
    };
  } catch (error) {
    // Some iPad/iPhone image formats cannot be decoded by canvas. Firebase
    // Storage can still keep the original file, so preserve it as a fallback.
    console.warn("Unable to compress delivery-order image:", error);
    return {
      blob: file,
      contentType: file.type || "application/octet-stream",
      fileName: safeFileName(file.name || "delivery-order-image"),
    };
  }
}

export async function uploadDeliveryOrderFile({ deliveryId, file }) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  if (!file) {
    throw new Error("Choose a Delivery Order Copy to upload.");
  }

  if (file.size > MAX_DELIVERY_ORDER_FILE_SIZE) {
    throw new Error("That Delivery Order Copy is larger than 15 MB.");
  }

  const safeDeliveryId = safePathSegment(deliveryId, "delivery ID");
  const uploadedAt = new Date().toISOString();
  const preparedFile = await prepareDeliveryOrderFile(file);
  const uniquePrefix = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const path = `deliveries/${safeDeliveryId}/delivery-orders/${uniquePrefix}-${preparedFile.fileName}`;
  const documentRef = ref(storage, path);

  try {
    await uploadBytes(documentRef, preparedFile.blob, {
      contentType: preparedFile.contentType,
      customMetadata: {
        deliveryId: safeDeliveryId,
        originalName: String(file.name || preparedFile.fileName).slice(0, 200),
      },
    });
  } catch (error) {
    error.message = `${
      error.message || "Upload failed"
    } Bucket: ${firebaseStorageBucket || "missing"} Path: ${path}`;
    throw error;
  }

  const url = await getDownloadURL(documentRef);
  const currentUser = auth?.currentUser;

  return {
    id: uniquePrefix,
    url,
    path,
    name: file.name || preparedFile.fileName,
    type: preparedFile.contentType,
    size: preparedFile.blob.size,
    uploadedAt,
    uploadedById: currentUser?.uid || "",
    uploadedByName:
      currentUser?.displayName || currentUser?.email || "Dispatch",
  };
}

export async function uploadDeliveryOrderFiles({ deliveryId, files }) {
  const selectedFiles = Array.from(files || []);

  if (selectedFiles.length === 0) {
    throw new Error("Choose a Delivery Order Copy to upload.");
  }

  const uploadedFiles = [];

  for (const file of selectedFiles) {
    uploadedFiles.push(
      await uploadDeliveryOrderFile({
        deliveryId,
        file,
      }),
    );
  }

  return uploadedFiles;
}

export async function deleteDeliveryOrderFile(document) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  const path = String(document?.path || "").trim();

  if (!path) {
    return;
  }

  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    if (String(error?.code || "").includes("storage/object-not-found")) {
      return;
    }

    throw error;
  }
}
