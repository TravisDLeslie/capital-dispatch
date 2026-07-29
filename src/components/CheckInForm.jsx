import { useState } from "react";
import {
  locations,
  receivingTeamMembers,
  vendors,
} from "../data/options";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";

function createEmptyMaterial() {
  return {
    id: createId(),
    description: "",
    location: "",
    locationPhoto: null,
    notes: "",
    conditionGood: true,
    damagePhoto: null,
    saved: false,
  };
}

function formatPoNumber(value) {
  const numbersOnly = value.replace(/\D/g, "").slice(0, 6);

  if (numbersOnly.length > 3) {
    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
  }

  return numbersOnly;
}

function findMatchingOption(value, options) {
  return options.find(
    (option) => option.toLowerCase() === value.trim().toLowerCase(),
  );
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

async function createLocationPhoto(file) {
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

export default function CheckInForm({ onSubmit }) {
  const [poNumber, setPoNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [poLocation, setPoLocation] = useState("");
  const [checkedInBy, setCheckedInBy] = useState("");
  const [processingPhotoMaterialId, setProcessingPhotoMaterialId] =
    useState("");

  const [materials, setMaterials] = useState([
    createEmptyMaterial(),
  ]);

  const [materialsSkipped, setMaterialsSkipped] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearError() {
    setError("");
  }

  function handlePoChange(event) {
    setPoNumber(formatPoNumber(event.target.value));
    clearError();
  }

  function handlePoLocationChange(value) {
    setPoLocation(value);
    setMaterials((currentMaterials) =>
      currentMaterials.map((material) =>
        material.location
          ? material
          : {
              ...material,
              location: value,
            },
      ),
    );
    clearError();
  }

  function updateMaterial(materialId, value) {
    setMaterials((currentMaterials) =>
      currentMaterials.map((material) =>
        material.id === materialId
          ? {
              ...material,
              description: value,
              saved: false,
            }
          : material,
      ),
    );

    setMaterialsSkipped(false);
    clearError();
  }

  function updateMaterialLocation(materialId, value) {
    setMaterials((currentMaterials) =>
      currentMaterials.map((material) =>
        material.id === materialId
          ? {
              ...material,
              location: value,
              saved: false,
            }
          : material,
      ),
    );

    setMaterialsSkipped(false);
    clearError();
  }

  function updateMaterialNotes(materialId, value) {
    setMaterials((currentMaterials) =>
      currentMaterials.map((material) =>
        material.id === materialId
          ? {
              ...material,
              notes: value,
              saved: false,
            }
          : material,
      ),
    );

    setMaterialsSkipped(false);
    clearError();
  }

  function updateMaterialCondition(materialId, conditionGood) {
    setMaterials((currentMaterials) =>
      currentMaterials.map((material) =>
        material.id === materialId
          ? {
              ...material,
              conditionGood,
              damagePhoto: conditionGood
                ? null
                : material.damagePhoto,
              saved: false,
            }
          : material,
      ),
    );

    setMaterialsSkipped(false);
    clearError();
  }

  function saveMaterial(materialId) {
    const material = materials.find(
      (item) => item.id === materialId,
    );

    if (!material?.description.trim()) {
      setError("Enter a material description before saving it.");
      return;
    }

    if (!findMatchingOption(material.location, locations)) {
      setError("Select a location for this material before saving it.");
      return;
    }

    if (!material.conditionGood && !material.damagePhoto) {
      setError("Snap a damage photo before saving this material.");
      return;
    }

    setMaterials((currentMaterials) =>
      currentMaterials.map((item) =>
        item.id === materialId
          ? {
              ...item,
              description: item.description.trim(),
              location: findMatchingOption(item.location, locations),
              notes: item.notes.trim(),
              saved: true,
            }
          : item,
      ),
    );

    clearError();
  }

  function editMaterial(materialId) {
    setMaterials((currentMaterials) =>
      currentMaterials.map((material) =>
        material.id === materialId
          ? {
              ...material,
              saved: false,
            }
          : material,
      ),
    );

    clearError();
  }

  function addMaterial() {
    setMaterials((currentMaterials) => [
      ...currentMaterials,
      {
        ...createEmptyMaterial(),
        location: poLocation,
      },
    ]);

    setMaterialsSkipped(false);
    clearError();
  }

  function removeMaterial(materialId) {
    setMaterials((currentMaterials) => {
      if (currentMaterials.length === 1) {
        return [createEmptyMaterial()];
      }

      return currentMaterials.filter(
        (material) => material.id !== materialId,
      );
    });

    clearError();
  }

  function skipMaterials() {
    setMaterialsSkipped(true);
    setMaterials([createEmptyMaterial()]);
    clearError();
  }

  function restoreMaterials() {
    setMaterialsSkipped(false);
    setMaterials([createEmptyMaterial()]);
    clearError();
  }

  function resetForm() {
    setPoNumber("");
    setVendor("");
    setPoLocation("");
    setCheckedInBy("");
    setProcessingPhotoMaterialId("");
    setMaterials([createEmptyMaterial()]);
    setMaterialsSkipped(false);
    setError("");
  }

  async function handleMaterialPhotoChange(
    materialId,
    event,
    photoField = "locationPhoto",
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the material photo.");
      event.target.value = "";
      return;
    }

    setProcessingPhotoMaterialId(materialId);
    clearError();

    try {
      const photo = await createLocationPhoto(file);
      setMaterials((currentMaterials) =>
        currentMaterials.map((material) =>
          material.id === materialId
            ? {
                ...material,
                [photoField]: photo,
                saved: false,
              }
            : material,
        ),
      );
    } catch (photoError) {
      console.error("Unable to prepare photo:", photoError);
      setError("Unable to prepare that photo. Try taking it again.");
    } finally {
      setProcessingPhotoMaterialId("");
      event.target.value = "";
    }
  }

  function removeMaterialPhoto(materialId) {
    removeMaterialPhotoField(materialId, "locationPhoto");
  }

  function removeMaterialPhotoField(materialId, photoField) {
    setMaterials((currentMaterials) =>
      currentMaterials.map((material) =>
        material.id === materialId
          ? {
              ...material,
              [photoField]: null,
              saved: false,
            }
          : material,
      ),
    );

    clearError();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (processingPhotoMaterialId) {
      setError("Wait for the material photo to finish preparing.");
      return;
    }

    if (!/^\d{3}-\d{3}$/.test(poNumber)) {
      setError("Enter a complete six-digit PO number.");
      return;
    }

    const matchedVendor = findMatchingOption(vendor, vendors);

    if (!matchedVendor) {
      setError("Select a vendor from the vendor list.");
      return;
    }

    const matchedLocation = findMatchingOption(
      poLocation,
      locations,
    );

    if (!matchedLocation) {
      setError("Select a location for the PO.");
      return;
    }

    if (!receivingTeamMembers.includes(checkedInBy)) {
      setError("Select who checked in this PO.");
      return;
    }

    const enteredMaterials = materials.filter((material) =>
      material.description.trim(),
    );

    if (!materialsSkipped && enteredMaterials.length === 0) {
      setError(
        "Add at least one material or choose Skip Materials.",
      );
      return;
    }

    const unsavedMaterial = enteredMaterials.find(
      (material) => !material.saved,
    );

    if (!materialsSkipped && unsavedMaterial) {
      setError(
        "Save each material before completing the PO check-in.",
      );
      return;
    }

    const cleanedMaterials = enteredMaterials.map((material) => ({
      id: material.id,
      description: material.description.trim(),
      location:
        findMatchingOption(material.location, locations) ||
        matchedLocation,
      locationPhoto: material.locationPhoto,
      conditionGood: material.conditionGood !== false,
      damagePhoto: material.damagePhoto,
      notes: material.notes.trim(),
    }));

    const newCheckIn = {
      id: createId(),
      poNumber,
      vendor: matchedVendor,
      poLocation: matchedLocation,
      checkedInBy,
      notes: "",

      orderAssignment: null,
      assignedAt: null,

      materials: materialsSkipped ? [] : cleanedMaterials,
      materialsSkipped,

      checkedInAt: new Date().toISOString(),
    };

    setIsSubmitting(true);

    try {
      await onSubmit(newCheckIn);
      resetForm();
    } catch (submitError) {
      console.error("Unable to save check-in:", submitError);
      setError(getFirebaseErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg sm:p-8"
    >
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
          Receiving
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Check In a PO
        </h2>

        <p className="mt-2 text-slate-500">
          Record the vendor delivery and where the material was
          placed.
        </p>
      </div>

      <div className="space-y-7">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="poNumber"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              PO Number
            </label>

            <input
              id="poNumber"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              value={poNumber}
              onChange={handlePoChange}
              disabled={isSubmitting}
              placeholder="123-456"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-2xl font-black tracking-[0.15em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label
              htmlFor="vendor-select"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              Vendor
            </label>

            <select
              id="vendor-select"
              value={vendor}
              onChange={(event) => {
                setVendor(event.target.value);
                clearError();
              }}
              disabled={isSubmitting}
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 md:hidden"
            >
              <option value="">Select a vendor...</option>

              {vendors.map((vendorOption) => (
                <option
                  key={vendorOption}
                  value={vendorOption}
                >
                  {vendorOption}
                </option>
              ))}
            </select>

            <input
              id="vendor-search"
              type="text"
              list="vendor-options"
              autoComplete="off"
              value={vendor}
              onChange={(event) => {
                setVendor(event.target.value);
                clearError();
              }}
              disabled={isSubmitting}
              placeholder="Start typing a vendor..."
              aria-label="Vendor"
              className="hidden w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 md:block"
            />

            <datalist id="vendor-options">
              {vendors.map((vendorOption) => (
                <option
                  key={vendorOption}
                  value={vendorOption}
                />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="po-location-select"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              PO Location
            </label>

            <select
              id="po-location-select"
              value={poLocation}
              onChange={(event) =>
                handlePoLocationChange(event.target.value)
              }
              disabled={isSubmitting}
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 md:hidden"
            >
              <option value="">Select a location...</option>

              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>

            <input
              id="po-location-search"
              type="text"
              list="location-options"
              autoComplete="off"
              value={poLocation}
              onChange={(event) =>
                handlePoLocationChange(event.target.value)
              }
              disabled={isSubmitting}
              placeholder="Where was this PO placed?"
              aria-label="PO Location"
              className="hidden w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 md:block"
            />

            <datalist id="location-options">
              {locations.map((location) => (
                <option key={location} value={location} />
              ))}
            </datalist>

            <p className="mt-2 text-sm text-slate-500">
              Used as the default for each material. You can change
              individual material locations below.
            </p>
          </div>

          <div>
            <label
              htmlFor="checked-in-by"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              Checked In By
            </label>

            <select
              id="checked-in-by"
              value={checkedInBy}
              onChange={(event) => {
                setCheckedInBy(event.target.value);
                clearError();
              }}
              disabled={isSubmitting}
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Select a team member...</option>

              {receivingTeamMembers.map((teamMember) => (
                <option key={teamMember} value={teamMember}>
                  {teamMember}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-700">
                Materials
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Save each entered material, or skip this section.
              </p>
            </div>

            {!materialsSkipped ? (
              <button
                type="button"
                onClick={skipMaterials}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Skip Materials
              </button>
            ) : (
              <button
                type="button"
                onClick={restoreMaterials}
                disabled={isSubmitting}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900"
              >
                Add Materials
              </button>
            )}
          </div>

          {materialsSkipped ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-800">
              Materials will be skipped. The PO number, vendor, and
              location will still be saved.
            </div>
          ) : (
            <div className="space-y-4">
              {materials.map((material, index) => (
                <div
                  key={material.id}
                  className={`rounded-2xl border p-4 ${
                    material.saved
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">
                        Material {index + 1}
                      </h4>

                      {material.saved ? (
                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          ✓ Material saved
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeMaterial(material.id)
                      }
                      className="text-sm font-semibold text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>

                  {material.saved ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">
                            {material.description}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            Location: {material.location}
                          </p>

                          {material.locationPhoto ? (
                            <p className="mt-1 text-sm font-semibold text-emerald-700">
                              Wide location photo attached
                            </p>
                          ) : null}

                          {material.notes ? (
                            <p className="mt-1 text-sm font-semibold text-slate-600">
                              Note: {material.notes}
                            </p>
                          ) : null}

                          <p
                            className={`mt-1 text-sm font-semibold ${
                              material.conditionGood === false
                                ? "text-red-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {material.conditionGood === false
                              ? "Damage photo attached"
                              : "Material marked in good condition"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            editMaterial(material.id)
                          }
                          className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Edit
                        </button>
                      </div>

                      {material.locationPhoto ? (
                        <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
                          <img
                            src={material.locationPhoto.dataUrl}
                            alt={`Location for material ${index + 1}`}
                            className="h-36 w-full object-cover"
                          />
                        </div>
                      ) : null}

                      {material.damagePhoto ? (
                        <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
                          <img
                            src={material.damagePhoto.dataUrl}
                            alt={`Damage for material ${index + 1}`}
                            className="h-36 w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor={`material-${material.id}`}
                          className="mb-2 block text-sm font-bold text-slate-700"
                        >
                          Material
                        </label>

                        <input
                          id={`material-${material.id}`}
                          type="text"
                          value={material.description}
                          onChange={(event) =>
                            updateMaterial(
                              material.id,
                              event.target.value,
                            )
                          }
                          placeholder="Example: 2x4-8 SPF Studs"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`material-location-${material.id}`}
                          className="mb-2 block text-sm font-bold text-slate-700"
                        >
                          Material Location
                        </label>

                        <select
                          id={`material-location-${material.id}`}
                          value={material.location}
                          onChange={(event) =>
                            updateMaterialLocation(
                              material.id,
                              event.target.value,
                            )
                          }
                          disabled={isSubmitting}
                          className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 md:hidden"
                        >
                          <option value="">
                            Select a material location...
                          </option>

                          {locations.map((location) => (
                            <option
                              key={location}
                              value={location}
                            >
                              {location}
                            </option>
                          ))}
                        </select>

                        <input
                          id={`material-location-search-${material.id}`}
                          type="text"
                          list="location-options"
                          autoComplete="off"
                          value={material.location}
                          onChange={(event) =>
                            updateMaterialLocation(
                              material.id,
                              event.target.value,
                            )
                          }
                          disabled={isSubmitting}
                          placeholder="Where is this material?"
                          aria-label={`Location for material ${index + 1}`}
                          className="hidden w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 md:block"
                        />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-700">
                              Material Location Photo
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              Please take a wide photo showing
                              where this material was placed.
                            </p>
                          </div>

                          {material.locationPhoto ? (
                            <button
                              type="button"
                              onClick={() =>
                                removeMaterialPhoto(material.id)
                              }
                              disabled={
                                isSubmitting ||
                                Boolean(processingPhotoMaterialId)
                              }
                              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                            >
                              Remove Photo
                            </button>
                          ) : null}
                        </div>

                        <label
                          htmlFor={`material-photo-${material.id}`}
                          className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition hover:border-emerald-500 hover:bg-emerald-50"
                        >
                          <span className="text-sm font-black text-slate-900">
                            {material.locationPhoto
                              ? "Retake Wide Photo"
                              : "Snap Wide Photo"}
                          </span>

                          <span className="mt-1 text-xs font-semibold text-slate-500">
                            Wide angle is best so the yard spot is
                            easy to recognize.
                          </span>
                        </label>

                        <input
                          id={`material-photo-${material.id}`}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(event) =>
                            handleMaterialPhotoChange(
                              material.id,
                              event,
                            )
                          }
                          disabled={
                            isSubmitting ||
                            Boolean(processingPhotoMaterialId)
                          }
                          className="sr-only"
                        />

                        {processingPhotoMaterialId ===
                        material.id ? (
                          <p className="mt-3 text-sm font-semibold text-slate-500">
                            Preparing photo...
                          </p>
                        ) : null}

                        {material.locationPhoto ? (
                          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                            <img
                              src={material.locationPhoto.dataUrl}
                              alt={`Location preview for material ${index + 1}`}
                              className="h-36 w-full object-cover"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={material.conditionGood !== false}
                            onChange={(event) =>
                              updateMaterialCondition(
                                material.id,
                                event.target.checked,
                              )
                            }
                            disabled={isSubmitting}
                            className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                          />

                          <span>
                            <span className="block text-sm font-bold text-slate-700">
                              Material looks in good condition
                            </span>

                            <span className="mt-1 block text-sm font-semibold text-slate-500">
                              Uncheck this if you can see damage,
                              then snap a photo of the damaged
                              part.
                            </span>
                          </span>
                        </label>

                        {material.conditionGood === false ? (
                          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-red-800">
                                  Damage Photo
                                </p>

                                <p className="mt-1 text-sm font-semibold text-red-700">
                                  Snap a clear photo of the damaged
                                  area before saving this material.
                                </p>
                              </div>

                              {material.damagePhoto ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeMaterialPhotoField(
                                      material.id,
                                      "damagePhoto",
                                    )
                                  }
                                  disabled={
                                    isSubmitting ||
                                    Boolean(
                                      processingPhotoMaterialId,
                                    )
                                  }
                                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                                >
                                  Remove Photo
                                </button>
                              ) : null}
                            </div>

                            <label
                              htmlFor={`damage-photo-${material.id}`}
                              className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-red-200 bg-white px-4 py-4 text-center transition hover:border-red-400 hover:bg-red-50"
                            >
                              <span className="text-sm font-black text-red-800">
                                {material.damagePhoto
                                  ? "Retake Damage Photo"
                                  : "Snap Damage Photo"}
                              </span>

                              <span className="mt-1 text-xs font-semibold text-red-700">
                                Focus on the damaged part so it is
                                easy to review later.
                              </span>
                            </label>

                            <input
                              id={`damage-photo-${material.id}`}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(event) =>
                                handleMaterialPhotoChange(
                                  material.id,
                                  event,
                                  "damagePhoto",
                                )
                              }
                              disabled={
                                isSubmitting ||
                                Boolean(processingPhotoMaterialId)
                              }
                              className="sr-only"
                            />

                            {processingPhotoMaterialId ===
                            material.id ? (
                              <p className="mt-3 text-sm font-semibold text-red-700">
                                Preparing photo...
                              </p>
                            ) : null}

                            {material.damagePhoto ? (
                              <div className="mt-3 overflow-hidden rounded-xl border border-red-200 bg-white">
                                <img
                                  src={material.damagePhoto.dataUrl}
                                  alt={`Damage preview for material ${index + 1}`}
                                  className="h-36 w-full object-cover"
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label
                          htmlFor={`material-notes-${material.id}`}
                          className="mb-2 block text-sm font-bold text-slate-700"
                        >
                          Material Notes
                        </label>

                        <textarea
                          id={`material-notes-${material.id}`}
                          value={material.notes}
                          onChange={(event) =>
                            updateMaterialNotes(
                              material.id,
                              event.target.value,
                            )
                          }
                          disabled={isSubmitting}
                          rows={3}
                          placeholder="Example: damaged corner, only received 3 of 4 boards..."
                          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          saveMaterial(material.id)
                        }
                        className="w-full rounded-xl bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
                      >
                        Save Material
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addMaterial}
                className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3.5 font-bold text-slate-600 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800"
              >
                + Add Another Material
              </button>
            </div>
          )}
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 font-semibold text-red-700"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || Boolean(processingPhotoMaterialId)}
          className="w-full rounded-xl bg-emerald-700 px-6 py-4 text-lg font-black text-white shadow-md transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Saving..." : "Complete Check In"}
        </button>
      </div>
    </form>
  );
}
