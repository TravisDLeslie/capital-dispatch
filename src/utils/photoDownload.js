function sanitizeFileName(value) {
  return String(value || "delivery-photo")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "delivery-photo";
}

function getExtension(contentType) {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  return ".jpg";
}

function getDownloadName(photo, fallbackName, contentType) {
  const rawName = sanitizeFileName(photo?.name || fallbackName);

  if (/\.[a-z0-9]{2,5}$/i.test(rawName)) {
    return rawName;
  }

  return `${rawName}${getExtension(contentType || photo?.type)}`;
}

function clickDownloadLink(url, fileName, openInNewTab = false) {
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  if (openInNewTab) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadDeliveryPhoto(photo, fallbackName) {
  const photoUrl = photo?.dataUrl || photo?.url;

  if (!photoUrl) {
    return false;
  }

  try {
    const response = await fetch(photoUrl);

    if (!response.ok) {
      throw new Error(`Photo download failed (${response.status}).`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    clickDownloadLink(
      objectUrl,
      getDownloadName(photo, fallbackName, blob.type),
    );
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    return true;
  } catch {
    // If a legacy or externally hosted image blocks fetch/CORS, opening the
    // original still gives the user a browser-native Save Image option.
    clickDownloadLink(
      photoUrl,
      getDownloadName(photo, fallbackName, photo?.type),
      true,
    );
    return false;
  }
}
