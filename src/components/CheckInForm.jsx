import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  locations,
  receivingTeamMembers,
  vendors as fallbackVendors,
} from "../data/options";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";
import { formatCustomerName } from "../utils/textFormatters";

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

function normalizePoNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function findMatchingOption(value, options) {
  return options.find(
    (option) => option.toLowerCase() === value.trim().toLowerCase(),
  );
}

function findMatchingTeamMember(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  const firstName = normalizedValue.split(/\s+/)[0] || "";

  if (!normalizedValue) {
    return "";
  }

  return (
    receivingTeamMembers.find((teamMember) => {
      const normalizedTeamMember = teamMember.toLowerCase();

      return (
        normalizedTeamMember === normalizedValue ||
        normalizedTeamMember === firstName
      );
    }) || ""
  );
}

function formatSouthRunDate(value) {
  if (!value) {
    return "";
  }

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    ).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSouthItemText(item) {
  return [item.quantity, item.description].filter(Boolean).join(" ");
}

function createMaterialFromPoItem(item, sourceType) {
  return {
    ...createEmptyMaterial(),
    description:
      [item.quantity, item.description].filter(Boolean).join(" ") ||
      item.description ||
      "",
    sourceItemId: item.id || "",
    sourceType,
  };
}

function getLinkedSouthOrderAssignment(supplierRun, items) {
  if (!supplierRun) {
    return null;
  }

  const orderItem = items.find(
    (item) => item.customerName || item.orderNumber,
  );
  const customerName =
    supplierRun.customerName || orderItem?.customerName || "";
  const orderNumber =
    orderItem?.orderNumber ||
    items.find((item) => item.orderNumber)?.orderNumber ||
    "";

  if (!customerName && !orderNumber) {
    return null;
  }

  return {
    type: "customer",
    internalReference: orderNumber,
    businessName: customerName ? formatCustomerName(customerName) : "",
    customerId: "",
    customerAccountNumber: "",
    orderedBy: supplierRun.orderedBy || "",
    jobName: "",
  };
}

function getLinkedTheirTruckOrderAssignment(theirTruckPO) {
  if (!theirTruckPO || theirTruckPO.isStock) {
    return null;
  }

  if (!theirTruckPO.customerName && !theirTruckPO.orderNumber) {
    return null;
  }

  return {
    type: "customer",
    internalReference: theirTruckPO.orderNumber || "",
    businessName: theirTruckPO.customerName
      ? formatCustomerName(theirTruckPO.customerName)
      : "",
    customerId: "",
    customerAccountNumber: "",
    orderedBy: theirTruckPO.orderedBy || "",
    jobName: "",
  };
}

function sortSouthRunsByRecent(firstRun, secondRun) {
  return (
    new Date(
      secondRun.completedAt ||
        secondRun.updatedAt ||
        secondRun.createdAt ||
        secondRun.scheduledDate ||
        0,
    ) -
    new Date(
      firstRun.completedAt ||
        firstRun.updatedAt ||
        firstRun.createdAt ||
        firstRun.scheduledDate ||
        0,
    )
  );
}

function getMatchingSouthRunsForPo(poNumber, supplierRuns) {
  const normalizedPoNumber = normalizePoNumber(poNumber);

  if (!normalizedPoNumber || !Array.isArray(supplierRuns)) {
    return [];
  }

  return supplierRuns
    .filter(
      (supplierRun) =>
        normalizePoNumber(supplierRun?.poNumber) ===
        normalizedPoNumber,
    )
    .sort(sortSouthRunsByRecent);
}

function sortTheirTruckPOsByRecent(firstPO, secondPO) {
  return (
    new Date(
      secondPO.updatedAt ||
        secondPO.createdAt ||
        secondPO.deliveryDate ||
        0,
    ) -
    new Date(
      firstPO.updatedAt ||
        firstPO.createdAt ||
        firstPO.deliveryDate ||
        0,
    )
  );
}

function getMatchingTheirTruckPOsForPo(poNumber, theirTruckPOs) {
  const normalizedPoNumber = normalizePoNumber(poNumber);

  if (!normalizedPoNumber || !Array.isArray(theirTruckPOs)) {
    return [];
  }

  return theirTruckPOs
    .filter(
      (theirTruckPO) =>
        normalizePoNumber(theirTruckPO?.poNumber) === normalizedPoNumber,
    )
    .sort(sortTheirTruckPOsByRecent);
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

export default function CheckInForm({
  onSubmit,
  vendorOptions,
  supplierRuns = [],
  theirTruckPOs = [],
  checkedInByDefault = "",
}) {
  const vendors =
    Array.isArray(vendorOptions) && vendorOptions.length > 0
      ? vendorOptions
      : fallbackVendors;
  const [poNumber, setPoNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [receivingTruckType, setReceivingTruckType] =
    useState("theirTruck");
  const [checkedInBy, setCheckedInBy] = useState(() =>
    findMatchingTeamMember(checkedInByDefault),
  );
  const [linkedSouthRunId, setLinkedSouthRunId] = useState("");
  const [linkedTheirTruckPOId, setLinkedTheirTruckPOId] = useState("");
  const [processingPhotoMaterialId, setProcessingPhotoMaterialId] =
    useState("");

  const [materials, setMaterials] = useState(() => [
    createEmptyMaterial(),
  ]);
  const [openMaterialId, setOpenMaterialId] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (checkedInBy) {
      return;
    }

    const defaultTeamMember = findMatchingTeamMember(checkedInByDefault);

    if (defaultTeamMember) {
      setCheckedInBy(defaultTeamMember);
    }
  }, [checkedInBy, checkedInByDefault]);

  useEffect(() => {
    if (poNumber.length !== 7 || linkedSouthRunId || linkedTheirTruckPOId) {
      return;
    }

    const matchingSouthRun = getMatchingSouthRunsForPo(
      poNumber,
      supplierRuns,
    )[0];

    if (matchingSouthRun) {
      const matchingSouthItems = Array.isArray(matchingSouthRun.items)
        ? matchingSouthRun.items
        : [];

      setLinkedSouthRunId(matchingSouthRun.id);
      setLinkedTheirTruckPOId("");
      populateMaterialsFromPoItems(matchingSouthItems, "south");

      if (matchingSouthRun.vendor) {
        setVendor(matchingSouthRun.vendor);
      }

      setReceivingTruckType("ourTruck");
      return;
    }

    const matchingTheirTruckPO = getMatchingTheirTruckPOsForPo(
      poNumber,
      theirTruckPOs,
    )[0];

    if (matchingTheirTruckPO) {
      const matchingTheirTruckItems = Array.isArray(matchingTheirTruckPO.items)
        ? matchingTheirTruckPO.items
        : [];

      setLinkedSouthRunId("");
      setLinkedTheirTruckPOId(matchingTheirTruckPO.id);
      populateMaterialsFromPoItems(
        matchingTheirTruckItems,
        "theirTruck",
      );

      if (matchingTheirTruckPO.vendor) {
        setVendor(matchingTheirTruckPO.vendor);
      }

      setReceivingTruckType("theirTruck");
    }
  }, [
    linkedSouthRunId,
    linkedTheirTruckPOId,
    poNumber,
    supplierRuns,
    theirTruckPOs,
  ]);

  function clearError() {
    setError("");
  }

  function populateMaterialsFromPoItems(items, sourceType) {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const nextMaterials = items.map((item) =>
      createMaterialFromPoItem(item, sourceType),
    );

    setMaterials(nextMaterials);
    setOpenMaterialId("");
  }

  const matchingSouthRuns = getMatchingSouthRunsForPo(
    poNumber,
    supplierRuns,
  );
  const linkedSouthRun =
    matchingSouthRuns.find(
      (supplierRun) => supplierRun.id === linkedSouthRunId,
    ) || null;
  const visibleSouthRun = linkedSouthRun || matchingSouthRuns[0] || null;
  const visibleSouthItems = Array.isArray(visibleSouthRun?.items)
    ? visibleSouthRun.items
    : [];
  const visibleSouthDate =
    formatSouthRunDate(visibleSouthRun?.scheduledDate) ||
    formatSouthRunDate(visibleSouthRun?.completedAt) ||
    formatSouthRunDate(visibleSouthRun?.updatedAt);
  const matchingTheirTruckPOs = getMatchingTheirTruckPOsForPo(
    poNumber,
    theirTruckPOs,
  );
  const linkedTheirTruckPO =
    matchingTheirTruckPOs.find(
      (theirTruckPO) => theirTruckPO.id === linkedTheirTruckPOId,
    ) || null;
  const visibleTheirTruckPO =
    linkedTheirTruckPO || matchingTheirTruckPOs[0] || null;
  const visibleTheirTruckItems = Array.isArray(visibleTheirTruckPO?.items)
    ? visibleTheirTruckPO.items
    : [];
  const visibleTheirTruckDate =
    formatSouthRunDate(visibleTheirTruckPO?.deliveryDate) ||
    formatSouthRunDate(visibleTheirTruckPO?.updatedAt);

  function handlePoChange(event) {
    const nextPoNumber = formatPoNumber(event.target.value);
    const nextMatchingRuns = getMatchingSouthRunsForPo(
      nextPoNumber,
      supplierRuns,
    );
    const nextMatchingTheirTruckPOs = getMatchingTheirTruckPOsForPo(
      nextPoNumber,
      theirTruckPOs,
    );
    const nextSouthRun =
      nextPoNumber.length === 7 ? nextMatchingRuns[0] : null;
    const nextTheirTruckPO =
      nextPoNumber.length === 7 ? nextMatchingTheirTruckPOs[0] : null;

    setPoNumber(nextPoNumber);

    if (nextSouthRun) {
      const nextSouthItems = Array.isArray(nextSouthRun.items)
        ? nextSouthRun.items
        : [];

      setLinkedSouthRunId(nextSouthRun.id);
      setLinkedTheirTruckPOId("");
      populateMaterialsFromPoItems(nextSouthItems, "south");

      if (nextSouthRun.vendor) {
        setVendor(nextSouthRun.vendor);
      }

      setReceivingTruckType("ourTruck");
    } else if (nextTheirTruckPO) {
      const nextTheirTruckItems = Array.isArray(nextTheirTruckPO.items)
        ? nextTheirTruckPO.items
        : [];

      setLinkedSouthRunId("");
      setLinkedTheirTruckPOId(nextTheirTruckPO.id);
      populateMaterialsFromPoItems(
        nextTheirTruckItems,
        "theirTruck",
      );

      if (nextTheirTruckPO.vendor) {
        setVendor(nextTheirTruckPO.vendor);
      }

      setReceivingTruckType("theirTruck");
    } else {
      setLinkedSouthRunId("");
      setLinkedTheirTruckPOId("");
    }

    clearError();
  }

  function linkSouthRun(supplierRun) {
    const nextSouthItems = Array.isArray(supplierRun.items)
      ? supplierRun.items
      : [];

    setLinkedSouthRunId(supplierRun.id);
    setLinkedTheirTruckPOId("");
    setReceivingTruckType("ourTruck");
    populateMaterialsFromPoItems(nextSouthItems, "south");

    if (supplierRun.vendor) {
      setVendor(supplierRun.vendor);
    }

    clearError();
  }

  function linkTheirTruckPO(theirTruckPO) {
    const nextTheirTruckItems = Array.isArray(theirTruckPO.items)
      ? theirTruckPO.items
      : [];

    setLinkedTheirTruckPOId(theirTruckPO.id);
    setLinkedSouthRunId("");
    setReceivingTruckType("theirTruck");
    populateMaterialsFromPoItems(nextTheirTruckItems, "theirTruck");

    if (theirTruckPO.vendor) {
      setVendor(theirTruckPO.vendor);
    }

    clearError();
  }

  function unlinkTheirTruckPO() {
    setLinkedTheirTruckPOId("");
    clearError();
  }

  function unlinkSouthRun() {
    setLinkedSouthRunId("");
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

    setOpenMaterialId("");
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

    setOpenMaterialId(materialId);
    clearError();
  }

  function addMaterial() {
    const newMaterial = createEmptyMaterial();

    setMaterials((currentMaterials) => [
      ...currentMaterials,
      newMaterial,
    ]);

    setOpenMaterialId(newMaterial.id);
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

    setOpenMaterialId((currentId) =>
      currentId === materialId ? "" : currentId,
    );
    clearError();
  }

  function resetForm() {
    const newMaterial = createEmptyMaterial();

    setPoNumber("");
    setVendor("");
    setReceivingTruckType("theirTruck");
    setCheckedInBy(findMatchingTeamMember(checkedInByDefault));
    setLinkedSouthRunId("");
    setLinkedTheirTruckPOId("");
    setProcessingPhotoMaterialId("");
    setMaterials([newMaterial]);
    setOpenMaterialId("");
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

    if (!receivingTeamMembers.includes(checkedInBy)) {
      setError("Select who checked in this PO.");
      return;
    }

    const enteredMaterials = materials.filter((material) =>
      material.description.trim(),
    );

    if (enteredMaterials.length === 0) {
      setError(
        "Add at least one material before completing the PO check-in.",
      );
      return;
    }

    const unsavedMaterial = enteredMaterials.find(
      (material) => !material.saved,
    );

    if (unsavedMaterial) {
      setError(
        "Save each material before completing the PO check-in.",
      );
      return;
    }

    const cleanedMaterials = enteredMaterials.map((material) => ({
      id: material.id,
      description: material.description.trim(),
      location: findMatchingOption(material.location, locations),
      locationPhoto: material.locationPhoto,
      conditionGood: material.conditionGood !== false,
      damagePhoto: material.damagePhoto,
      notes: material.notes.trim(),
    }));

    const materialLocations = [
      ...new Set(
        cleanedMaterials
          .map((material) => material.location)
          .filter(Boolean),
      ),
    ];
    const poLocation =
      materialLocations.length === 1
        ? materialLocations[0]
        : materialLocations.length > 1
          ? "Multiple material locations"
          : "";
    const linkedSouthOrderAssignment = getLinkedSouthOrderAssignment(
      linkedSouthRun,
      visibleSouthItems,
    );
    const linkedTheirTruckOrderAssignment =
      getLinkedTheirTruckOrderAssignment(linkedTheirTruckPO);
    const linkedOrderAssignment =
      linkedSouthOrderAssignment || linkedTheirTruckOrderAssignment;

    const newCheckIn = {
      id: createId(),
      poNumber,
      vendor: matchedVendor,
      poLocation,
      receivingTruckType,
      receivingTruckLabel:
        receivingTruckType === "ourTruck"
          ? "Our Truck"
          : "Their Truck",
      checkedInBy,
      notes: "",

      orderAssignment: linkedOrderAssignment,
      assignedAt: null,

      materials: cleanedMaterials,
      materialsSkipped: false,

      sourceType: linkedSouthRun
        ? "south"
        : linkedTheirTruckPO
          ? "theirTruck"
          : "",
      sourceSupplierRunId: linkedSouthRun?.id || "",
      sourceSupplierRunPoNumber: linkedSouthRun?.poNumber || "",
      sourceSupplierRunVendor: linkedSouthRun?.vendor || "",
      sourceSupplierRunDriver: linkedSouthRun?.driver || "",
      sourceSupplierRunScheduledDate:
        linkedSouthRun?.scheduledDate || "",
      sourceSupplierRunCompletedAt:
        linkedSouthRun?.completedAt || "",
      sourceSupplierRunItemIds: linkedSouthRun
        ? visibleSouthItems.map((item) => item.id).filter(Boolean)
        : [],
      sourceTheirTruckPOId: linkedTheirTruckPO?.id || "",
      sourceTheirTruckPONumber: linkedTheirTruckPO?.poNumber || "",
      sourceTheirTruckVendor: linkedTheirTruckPO?.vendor || "",
      sourceTheirTruckDeliveryDate:
        linkedTheirTruckPO?.deliveryDate || "",
      sourceTheirTruckOrderNumber:
        linkedTheirTruckPO?.orderNumber || "",
      sourceTheirTruckCustomerName:
        linkedTheirTruckPO?.customerName || "",
      sourceTheirTruckItemIds: linkedTheirTruckPO
        ? visibleTheirTruckItems.map((item) => item.id).filter(Boolean)
        : [],

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
        <section>
          <p className="mb-2 text-sm font-bold text-slate-700">
            How did this PO arrive?
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                value: "theirTruck",
                label: "Their Truck",
                detail: "Vendor delivery or outside carrier",
                selectedClass: "border-blue-500 bg-blue-50 shadow-sm",
                selectedTextClass: "text-blue-800",
              },
              {
                value: "ourTruck",
                label: "Our Truck",
                detail: "South run or Capital driver",
                selectedClass: "border-red-500 bg-red-50 shadow-sm",
                selectedTextClass: "text-red-800",
              },
            ].map((option) => {
              const isSelected = receivingTruckType === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setReceivingTruckType(option.value);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? option.selectedClass
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`block text-lg font-black ${
                      isSelected
                        ? option.selectedTextClass
                        : "text-slate-900"
                    }`}
                  >
                    {option.label}
                  </span>

                  <span className="mt-1 block text-sm font-semibold text-slate-500">
                    {option.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

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

        {visibleSouthRun ? (
          <section
            className={`rounded-2xl border px-4 py-4 ${
              linkedSouthRun
                ? "border-blue-200 bg-blue-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p
                  className={`text-xs font-black uppercase tracking-[0.18em] ${
                    linkedSouthRun
                      ? "text-blue-700"
                      : "text-amber-700"
                  }`}
                >
                  {linkedSouthRun
                    ? "South PO Linked"
                    : "South PO Found"}
                </p>

                <h3 className="mt-1 text-xl font-black text-slate-900">
                  PO {visibleSouthRun.poNumber} from{" "}
                  {visibleSouthRun.vendor || "South"}
                </h3>

                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {[
                    visibleSouthRun.driver
                      ? `Driver: ${visibleSouthRun.driver}`
                      : "No driver assigned",
                    visibleSouthDate
                      ? `Pickup: ${visibleSouthDate}`
                      : "",
                    visibleSouthRun.status === "complete"
                      ? "Completed"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>

                {visibleSouthItems.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm font-semibold text-slate-700">
                    {visibleSouthItems.slice(0, 3).map((item, index) => (
                      <li key={item.id || `${visibleSouthRun.id}-${index}`}>
                        {getSouthItemText(item) ||
                          `Item ${index + 1}`}
                        {item.pickedUp ? (
                          <span className="ml-2 text-emerald-700">
                            Picked up
                          </span>
                        ) : null}
                      </li>
                    ))}
                    {visibleSouthItems.length > 3 ? (
                      <li className="text-slate-500">
                        + {visibleSouthItems.length - 3} more items
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {matchingSouthRuns.length > 1 ? (
                  <select
                    value={visibleSouthRun.id}
                    onChange={(event) => {
                      const selectedRun = matchingSouthRuns.find(
                        (supplierRun) =>
                          supplierRun.id === event.target.value,
                      );

                      if (selectedRun) {
                        linkSouthRun(selectedRun);
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                  >
                    {matchingSouthRuns.map((supplierRun) => (
                      <option
                        key={supplierRun.id}
                        value={supplierRun.id}
                      >
                        {supplierRun.vendor || "South"}{" "}
                        {formatSouthRunDate(
                          supplierRun.scheduledDate,
                        )}
                      </option>
                    ))}
                  </select>
                ) : null}

                {linkedSouthRun ? (
                  <button
                    type="button"
                    onClick={unlinkSouthRun}
                    className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                  >
                    Unlink
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => linkSouthRun(visibleSouthRun)}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800"
                  >
                    Link South PO
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {visibleTheirTruckPO ? (
          <section
            className={`rounded-2xl border px-4 py-4 ${
              linkedTheirTruckPO
                ? "border-blue-200 bg-blue-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p
                  className={`text-xs font-black uppercase tracking-[0.18em] ${
                    linkedTheirTruckPO
                      ? "text-blue-700"
                      : "text-amber-700"
                  }`}
                >
                  {linkedTheirTruckPO
                    ? "Their Truck PO Linked"
                    : "Their Truck PO Found"}
                </p>

                <h3 className="mt-1 text-xl font-black text-slate-900">
                  PO {visibleTheirTruckPO.poNumber} from{" "}
                  {visibleTheirTruckPO.vendor || "Their Truck"}
                </h3>

                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {[
                    visibleTheirTruckPO.isStock
                      ? "Stock"
                      : visibleTheirTruckPO.customerName
                        ? `Customer: ${formatCustomerName(visibleTheirTruckPO.customerName)}`
                        : "",
                    visibleTheirTruckPO.orderNumber
                      ? `Order: ${visibleTheirTruckPO.orderNumber}`
                      : "",
                    visibleTheirTruckDate
                      ? `Delivery: ${visibleTheirTruckDate}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>

                {visibleTheirTruckItems.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm font-semibold text-slate-700">
                    {visibleTheirTruckItems.slice(0, 3).map((item, index) => (
                      <li
                        key={
                          item.id || `${visibleTheirTruckPO.id}-${index}`
                        }
                      >
                        {[item.quantity, item.description]
                          .filter(Boolean)
                          .join(" ") || `Item ${index + 1}`}
                      </li>
                    ))}
                    {visibleTheirTruckItems.length > 3 ? (
                      <li className="text-slate-500">
                        + {visibleTheirTruckItems.length - 3} more items
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {matchingTheirTruckPOs.length > 1 ? (
                  <select
                    value={visibleTheirTruckPO.id}
                    onChange={(event) => {
                      const selectedPO = matchingTheirTruckPOs.find(
                        (theirTruckPO) =>
                          theirTruckPO.id === event.target.value,
                      );

                      if (selectedPO) {
                        linkTheirTruckPO(selectedPO);
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                  >
                    {matchingTheirTruckPOs.map((theirTruckPO) => (
                      <option
                        key={theirTruckPO.id}
                        value={theirTruckPO.id}
                      >
                        {theirTruckPO.vendor || "Their Truck"}{" "}
                        {formatSouthRunDate(theirTruckPO.deliveryDate)}
                      </option>
                    ))}
                  </select>
                ) : null}

                {linkedTheirTruckPO ? (
                  <button
                    type="button"
                    onClick={unlinkTheirTruckPO}
                    className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                  >
                    Unlink
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => linkTheirTruckPO(visibleTheirTruckPO)}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800"
                  >
                    Link Their Truck PO
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <datalist id="location-options">
          {locations.map((location) => (
            <option key={location} value={location} />
          ))}
        </datalist>

        <section>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-700">
              Materials
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Add each material, then expand it when you need to
              edit its details.
            </p>
          </div>

          <div className="space-y-3">
            {materials.map((material, index) => {
              const isMaterialOpen =
                openMaterialId === material.id;
              const materialTitle =
                material.description.trim() || `Material ${index + 1}`;
              const materialMeta = [
                material.location || "Choose a material location",
                material.locationPhoto ? "Location photo" : "",
                material.damagePhoto ? "Damage photo" : "",
                material.notes ? "Note" : "",
              ]
                .filter(Boolean)
                .join(" • ");

              return (
                <div
                  key={material.id}
                  className={`overflow-hidden rounded-2xl border ${
                    material.saved
                      ? "border-emerald-200 bg-white"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900">
                          {materialTitle}
                        </h4>

                        {material.sourceType ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                            From PO
                          </span>
                        ) : null}

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                            material.saved
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {material.saved ? "Saved" : "Needs Details"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {materialMeta}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {material.saved ? (
                        <button
                          type="button"
                          onClick={() => editMaterial(material.id)}
                          className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Edit
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          setOpenMaterialId((currentId) =>
                            currentId === material.id ? "" : material.id,
                          )
                        }
                        aria-label={
                          isMaterialOpen
                            ? `Collapse material ${index + 1}`
                            : `Expand material ${index + 1}`
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        {isMaterialOpen ? (
                          <ChevronUp
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronDown
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeMaterial(material.id)}
                        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                {!material.saved ? (
                  <>
                    <div
                      className={`space-y-4 border-t border-slate-200 p-4 ${
                        isMaterialOpen ? "block" : "hidden"
                      }`}
                    >
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
                  </>
                ) : isMaterialOpen ? (
                  <div className="border-t border-emerald-100 bg-emerald-50/40 p-4">
                    <p className="text-sm font-semibold text-slate-600">
                      {material.description}
                    </p>
                  </div>
                ) : null}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addMaterial}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3.5 font-bold text-slate-600 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800"
            >
              + Add Another Material
            </button>
          </div>
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
