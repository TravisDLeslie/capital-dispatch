import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { auth, firebaseStorageBucket, storage } from "./firebase";
import { compressImageFile } from "./photoStorage";

const MAX_ORDER_COPY_FILE_SIZE = 15 * 1024 * 1024;

function safeFileName(value) {
  return String(value || "order-copy")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function safePathSegment(value, label) {
  const text = String(value || "").trim();

  if (!text || text === "[object Object]") {
    throw new Error(`Missing ${label} for order-copy upload.`);
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

async function prepareOrderCopyFile(file) {
  if (isPdfFile(file)) {
    return {
      blob: file,
      contentType: "application/pdf",
      fileName: safeFileName(file.name || "order-copy.pdf"),
    };
  }

  if (!isImageFile(file)) {
    throw new Error("Choose a photo, image, or PDF Order Copy.");
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
        String(file.name || "order-copy").replace(/\.[^.]+$/, ""),
      )}.jpg`,
    };
  } catch (error) {
    console.warn("Unable to compress order-copy image:", error);
    return {
      blob: file,
      contentType: file.type || "application/octet-stream",
      fileName: safeFileName(file.name || "order-copy-image"),
    };
  }
}

export async function uploadDispatchOrderCopyFile({
  recordType,
  recordId,
  file,
}) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  if (!file) {
    throw new Error("Choose an Order Copy to upload.");
  }

  if (file.size > MAX_ORDER_COPY_FILE_SIZE) {
    throw new Error("That Order Copy is larger than 15 MB.");
  }

  const safeRecordType = safePathSegment(recordType, "record type");
  const safeRecordId = safePathSegment(recordId, "record ID");
  const uploadedAt = new Date().toISOString();
  const preparedFile = await prepareOrderCopyFile(file);
  const uniquePrefix = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const path = `dispatchOrderCopies/${safeRecordType}/${safeRecordId}/${uniquePrefix}-${preparedFile.fileName}`;
  const documentRef = ref(storage, path);

  try {
    await uploadBytes(documentRef, preparedFile.blob, {
      contentType: preparedFile.contentType,
      customMetadata: {
        recordType: safeRecordType,
        recordId: safeRecordId,
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

export async function uploadDispatchOrderCopyFiles({
  recordType,
  recordId,
  files,
}) {
  const selectedFiles = Array.from(files || []);

  if (selectedFiles.length === 0) {
    throw new Error("Choose an Order Copy to upload.");
  }

  const uploadedFiles = [];

  for (const file of selectedFiles) {
    uploadedFiles.push(
      await uploadDispatchOrderCopyFile({
        recordType,
        recordId,
        file,
      }),
    );
  }

  return uploadedFiles;
}

export async function deleteDispatchOrderCopyFile(document) {
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
