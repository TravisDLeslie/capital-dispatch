import { useState } from "react";
import { locations, vendors } from "../data/options";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";

function createEmptyMaterial() {
  return {
    id: createId(),
    description: "",
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

export default function CheckInForm({ onSubmit }) {
  const [poNumber, setPoNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [poLocation, setPoLocation] = useState("");

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

  function saveMaterial(materialId) {
    const material = materials.find(
      (item) => item.id === materialId,
    );

    if (!material?.description.trim()) {
      setError("Enter a material description before saving it.");
      return;
    }

    setMaterials((currentMaterials) =>
      currentMaterials.map((item) =>
        item.id === materialId
          ? {
              ...item,
              description: item.description.trim(),
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
      createEmptyMaterial(),
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
    setMaterials([createEmptyMaterial()]);
    setMaterialsSkipped(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

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
    }));

    const newCheckIn = {
      id: createId(),
      poNumber,
      vendor: matchedVendor,
      poLocation: matchedLocation,

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
            onChange={(event) => {
              setPoLocation(event.target.value);
              clearError();
            }}
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
            onChange={(event) => {
              setPoLocation(event.target.value);
              clearError();
            }}
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
            The entire PO will be tied to this location.
          </p>
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-bold text-slate-900">
                        {material.description}
                      </p>

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
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row">
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
                        className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          saveMaterial(material.id)
                        }
                        className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
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
          className="w-full rounded-xl bg-emerald-700 px-6 py-4 text-lg font-black text-white shadow-md transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-300"
        >
          Complete Check In
        </button>
      </div>
    </form>
  );
}
