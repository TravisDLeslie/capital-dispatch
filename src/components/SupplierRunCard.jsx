import { useState } from "react";
import { FileText } from "lucide-react";
import capitalLumberLogo from "../assets/capital-lumber-logo-black-text.png";
import {
  formatFullDate,
  formatShortDate,
  formatTime,
} from "../utils/dateHelpers";

const capitalLumberInfo = {
  name: "Capital Lumber Co, Inc",
  addressLineOne: "3105 W. State St.",
  addressLineTwo: "Boise, ID 83703",
  phone: "208-343-5481",
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPickupItemsForPrint(items) {
  if (items.length === 0) {
    return `
      <tr>
        <td colspan="3" class="empty">No pickup items listed.</td>
      </tr>
    `;
  }

  return items
    .map(
      (item) => `
        <tr>
          <td class="qty">${escapeHtml(item.quantity || "-")}</td>
          <td>
            <strong>${escapeHtml(item.description)}</strong>
            ${
              item.internalReference
                ? `<span>SKU / Item # / SO#: ${escapeHtml(
                    item.internalReference,
                  )}</span>`
                : ""
            }
          </td>
          <td>${item.pickedUp ? "Picked up" : "Pending"}</td>
        </tr>
      `,
    )
    .join("");
}

function createPickupSheetHtml(supplierRun, items) {
  const logoUrl = new URL(
    capitalLumberLogo,
    window.location.origin,
  ).href;
  const createdDate = supplierRun.createdAt
    ? `${formatFullDate(supplierRun.createdAt)} at ${formatTime(
        supplierRun.createdAt,
      )}`
    : "Not recorded";

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Pickup PO ${escapeHtml(supplierRun.poNumber)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f8fafc;
            color: #0f172a;
            font-family: Arial, Helvetica, sans-serif;
          }
          .sheet {
            width: min(8.5in, calc(100vw - 32px));
            min-height: 11in;
            margin: 16px auto;
            padding: 0.55in;
            background: #fff;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
          }
          .top {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 4px solid #fc2c38;
            padding-bottom: 22px;
          }
          h1 {
            margin: 0;
            font-size: 30px;
            letter-spacing: -0.03em;
          }
          .logo {
            width: 230px;
            max-width: 100%;
            height: auto;
            display: block;
            margin-bottom: 12px;
          }
          .muted {
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.5;
          }
          .po {
            text-align: right;
          }
          .po strong {
            display: block;
            font-size: 28px;
            letter-spacing: -0.03em;
          }
          .section {
            margin-top: 26px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }
          .box {
            border: 1px solid #dce4ef;
            border-radius: 12px;
            padding: 16px;
          }
          .label {
            margin: 0 0 8px;
            color: #64748b;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }
          .value {
            margin: 0;
            font-size: 16px;
            font-weight: 800;
            line-height: 1.45;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }
          th {
            padding: 10px;
            background: #0f172a;
            color: #fff;
            font-size: 12px;
            text-align: left;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          td {
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 10px;
            vertical-align: top;
            font-size: 14px;
            line-height: 1.4;
          }
          td span {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
          }
          .qty {
            width: 86px;
            font-weight: 900;
          }
          .empty {
            color: #64748b;
            font-weight: 700;
            text-align: center;
          }
          .footer {
            margin-top: 34px;
            padding-top: 16px;
            border-top: 1px solid #dce4ef;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
          }
          @media print {
            body { background: #fff; }
            .sheet {
              width: auto;
              min-height: auto;
              margin: 0;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <section class="top">
            <div>
              <img
                class="logo"
                src="${escapeHtml(logoUrl)}"
                alt="${escapeHtml(capitalLumberInfo.name)}"
              />
              <h1>${escapeHtml(capitalLumberInfo.name)}</h1>
              <p class="muted">
                ${escapeHtml(capitalLumberInfo.addressLineOne)}<br />
                ${escapeHtml(capitalLumberInfo.addressLineTwo)}<br />
                Phone: ${escapeHtml(capitalLumberInfo.phone)}
              </p>
            </div>
            <div class="po">
              <p class="label">Pickup PO</p>
              <strong>${escapeHtml(supplierRun.poNumber)}</strong>
              <p class="muted">Created ${escapeHtml(createdDate)}</p>
            </div>
          </section>

          <section class="section grid">
            <div class="box">
              <p class="label">Supplier</p>
              <p class="value">
                ${escapeHtml(supplierRun.vendor || "Not listed")}
              </p>
              <p class="muted">
                ${escapeHtml(
                  supplierRun.supplierAddress || "No address listed",
                )}
              </p>
            </div>
            <div class="box">
              <p class="label">Driver</p>
              <p class="value">
                ${escapeHtml(supplierRun.driver || "Unassigned")}
              </p>
              <p class="muted">For vendor pickup reference</p>
            </div>
          </section>

          <section class="section">
            <p class="label">Items To Pick Up</p>
            <table>
              <thead>
                <tr>
                  <th>Qty</th>
                  <th>Item Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${formatPickupItemsForPrint(items)}
              </tbody>
            </table>
          </section>

          <p class="footer">
            Generated from Capital Lumber Dispatch.
          </p>
        </main>
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => window.print(), 300);
          });
        </script>
      </body>
    </html>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
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

async function createPickupPhoto(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const maxWidth = 720;
  const scale = Math.min(maxWidth / image.width, 1);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.68;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrl.length > 240000 && quality > 0.34) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return {
    dataUrl,
    name: file.name,
    type: "image/jpeg",
    capturedAt: new Date().toISOString(),
  };
}

export default function SupplierRunCard({
  supplierRun,
  onToggleItem,
  onUpdateItemDescription,
  onDelete,
  isCompletedSection = false,
}) {
  const items = Array.isArray(supplierRun.items)
    ? supplierRun.items
    : [];

  const pickedUpCount = items.filter(
    (item) => item.pickedUp,
  ).length;

  const isComplete =
    items.length > 0 && pickedUpCount === items.length;
  const remainingCount = items.length - pickedUpCount;
  const progressPercent =
    items.length > 0 ? (pickedUpCount / items.length) * 100 : 0;
  const [editingItemId, setEditingItemId] = useState("");
  const [editingQuantity, setEditingQuantity] = useState("");
  const [editingDescription, setEditingDescription] =
    useState("");
  const [editingInternalReference, setEditingInternalReference] =
    useState("");
  const [editError, setEditError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [processingPhotoItemId, setProcessingPhotoItemId] =
    useState("");
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [isItemsOpen, setIsItemsOpen] = useState(true);

  function startEditingItem(item) {
    setEditingItemId(item.id);
    setEditingQuantity(item.quantity || "");
    setEditingDescription(item.description || "");
    setEditingInternalReference(item.internalReference || "");
    setEditError("");
    setIsItemsOpen(true);
  }

  function cancelEditingItem() {
    setEditingItemId("");
    setEditingQuantity("");
    setEditingDescription("");
    setEditingInternalReference("");
    setEditError("");
  }

  async function saveItemDescription(itemId) {
    const cleanedDescription = editingDescription.trim();

    if (!cleanedDescription) {
      setEditError("Enter an item description before saving.");
      return;
    }

    await onUpdateItemDescription(
      supplierRun.id,
      itemId,
      cleanedDescription,
      editingInternalReference.trim(),
      editingQuantity.trim(),
    );

    cancelEditingItem();
  }

  async function handlePickupPhotoChange(itemId, event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file for the pickup photo.");
      event.target.value = "";
      return;
    }

    setProcessingPhotoItemId(itemId);
    setPhotoError("");

    try {
      const pickupPhoto = await createPickupPhoto(file);
      await onToggleItem(supplierRun.id, itemId, pickupPhoto);
    } catch (photoError) {
      console.error("Unable to save pickup photo:", photoError);
      setPhotoError("Unable to save that photo. Try taking it again.");
    } finally {
      setProcessingPhotoItemId("");
      event.target.value = "";
    }
  }

  function openPickupSheet() {
    const pickupSheetWindow = window.open("", "_blank");

    if (!pickupSheetWindow) {
      setPhotoError("Allow pop-ups to open the pickup PDF.");
      return;
    }

    pickupSheetWindow.document.open();
    pickupSheetWindow.document.write(
      createPickupSheetHtml(supplierRun, items),
    );
    pickupSheetWindow.document.close();
    pickupSheetWindow.focus();
  }

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm transition ${
        isComplete
          ? "border-emerald-200 bg-white"
          : "border-blue-200 bg-white hover:border-blue-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {supplierRun.poNumber}
            </h2>

            {isComplete ? (
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-emerald-800">
                Complete
              </span>
            ) : (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-amber-800">
                Needs Pickup
              </span>
            )}
          </div>

          {isItemsOpen ? (
            <>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Added {formatShortDate(supplierRun.createdAt)} at{" "}
                {formatTime(supplierRun.createdAt)}
              </p>

              <p className="mt-1 text-sm font-black text-blue-700">
                Driver: {supplierRun.driver || "Unassigned"}
              </p>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={openPickupSheet}
            aria-label={`Open pickup PDF for PO ${supplierRun.poNumber}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 sm:w-auto sm:gap-2 sm:px-3 sm:py-2"
          >
            <FileText
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {isItemsOpen ? (
            <div
            className={`rounded-xl px-3 py-2 text-sm font-black ${
              isComplete
                ? "bg-emerald-100 text-emerald-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {isComplete
              ? "All picked up"
              : `${remainingCount} left`}
            </div>
          ) : null}
        </div>
      </div>

      {isItemsOpen ? (
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>
            {pickedUpCount}/{items.length} picked up
          </span>

          {!isComplete ? (
            <span>{remainingCount} remaining</span>
          ) : null}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${
              isComplete ? "bg-emerald-500" : "bg-blue-600"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsItemsOpen((current) => !current)}
        className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
        aria-expanded={isItemsOpen}
      >
        <span>
          <span className="block text-sm font-black text-slate-900">
            Pickup Items
          </span>

          <span className="mt-0.5 block text-xs font-bold text-slate-500">
            {pickedUpCount}/{items.length} picked up
          </span>
        </span>

        <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">
          {isItemsOpen ? "Close" : "View"}
        </span>
      </button>

      {isItemsOpen ? (
        <div className="mt-3 space-y-2">
          {photoError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            >
              {photoError}
            </div>
          ) : null}

          {items.map((item) => {
            const isEditing = editingItemId === item.id;
            const pickupPhotoInputId = `pickup-photo-${supplierRun.id}-${item.id}`;

            return (
              <div
                key={item.id}
                className={`rounded-xl border px-4 py-3 transition ${
                  item.pickedUp
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-blue-200 bg-blue-50/60"
                }`}
              >
                {!isEditing ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    {item.pickedUp ? (
                      <input
                        type="checkbox"
                        checked
                        onChange={() =>
                          onToggleItem(supplierRun.id, item.id)
                        }
                        className="mt-1 h-5 w-5 shrink-0 accent-blue-700"
                        aria-label={`Mark ${item.description} not picked up`}
                      />
                    ) : (
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-700 bg-white" />
                    )}

                    <span className="min-w-0 flex-1">
                      {item.quantity ? (
                        <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                          QTY: {item.quantity}
                        </span>
                      ) : null}

                      <span
                        className={`block text-base font-semibold ${
                          item.pickedUp
                            ? "text-emerald-800 line-through decoration-2"
                            : "text-slate-800"
                        }`}
                      >
                        {item.description}
                      </span>

                      {item.pickedUp && item.pickedUpAt ? (
                        <span className="mt-1 block text-xs font-bold text-emerald-700">
                          Picked up {formatTime(item.pickedUpAt)}
                        </span>
                      ) : null}

                      {item.internalReference ? (
                        <span className="mt-1 block text-xs font-bold text-slate-500">
                          SKU / Item # / SO#:{" "}
                          {item.internalReference}
                        </span>
                      ) : null}

                      {item.pickupPhoto?.dataUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setViewingPhoto({
                              dataUrl: item.pickupPhoto.dataUrl,
                              title: "Pickup Photo",
                              subtitle: item.description,
                            })
                          }
                          className="mt-3 block overflow-hidden rounded-xl border border-emerald-200 bg-white text-left"
                        >
                          <img
                            src={item.pickupPhoto.dataUrl}
                            alt={`Pickup for ${item.description}`}
                            className="h-24 w-40 object-cover"
                          />

                          <span className="block px-3 py-2 text-xs font-black text-emerald-700">
                            View pickup photo
                          </span>
                        </button>
                      ) : null}
                    </span>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {!item.pickedUp ? (
                        <>
                          <label
                            htmlFor={pickupPhotoInputId}
                            className="cursor-pointer rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                          >
                            {processingPhotoItemId === item.id
                              ? "Saving Photo..."
                              : "Snap Photo & Pick Up"}
                          </label>

                          <input
                            id={pickupPhotoInputId}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) =>
                              handlePickupPhotoChange(item.id, event)
                            }
                            disabled={Boolean(processingPhotoItemId)}
                            className="sr-only"
                          />
                        </>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => startEditingItem(item)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ) : (
                <div>
                  <label
                    htmlFor={`supplier-item-quantity-${supplierRun.id}-${item.id}`}
                    className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                  >
                    Quantity
                  </label>

                  <input
                    id={`supplier-item-quantity-${supplierRun.id}-${item.id}`}
                    type="text"
                    value={editingQuantity}
                    onChange={(event) => {
                      setEditingQuantity(event.target.value);
                      setEditError("");
                    }}
                    placeholder="Optional quantity"
                    className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />

                  <label
                    htmlFor={`supplier-item-${supplierRun.id}-${item.id}`}
                    className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                  >
                    Edit Item
                  </label>

                  <textarea
                    id={`supplier-item-${supplierRun.id}-${item.id}`}
                    value={editingDescription}
                    onChange={(event) => {
                      setEditingDescription(event.target.value);
                      setEditError("");
                    }}
                    rows={3}
                    className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />

                  <label
                    htmlFor={`supplier-item-reference-${supplierRun.id}-${item.id}`}
                    className="mb-2 mt-3 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
                  >
                    SKU / Item # / SO#
                  </label>

                  <input
                    id={`supplier-item-reference-${supplierRun.id}-${item.id}`}
                    type="text"
                    value={editingInternalReference}
                    onChange={(event) => {
                      setEditingInternalReference(event.target.value);
                      setEditError("");
                    }}
                    placeholder="Optional internal reference"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />

                  {editError ? (
                    <p className="mt-2 text-sm font-semibold text-red-600">
                      {editError}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEditingItem}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => saveItemDescription(item.id)}
                      className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-800"
                    >
                      Save Item
                    </button>
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {supplierRun.completedAt ? (
        <p className="mt-3 text-xs font-bold text-emerald-700">
          {isCompletedSection ? "Finished" : "Completed"}{" "}
          {formatFullDate(supplierRun.completedAt)} at{" "}
          {formatTime(supplierRun.completedAt)}
        </p>
      ) : null}

      {supplierRun.updatedAt ? (
        <p className="mt-3 text-xs font-semibold text-slate-400">
          Last updated {formatFullDate(supplierRun.updatedAt)} at{" "}
          {formatTime(supplierRun.updatedAt)}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => onDelete(supplierRun.id)}
          className="text-xs font-bold text-red-500 transition hover:text-red-700"
        >
          Delete PO
        </button>
      </div>

      {viewingPhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={viewingPhoto.title}
        >
          <div className="max-h-full w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {viewingPhoto.title}
                </h3>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {viewingPhoto.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingPhoto(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="bg-slate-100 p-3">
              <img
                src={viewingPhoto.dataUrl}
                alt={viewingPhoto.title}
                className="max-h-[75vh] w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
