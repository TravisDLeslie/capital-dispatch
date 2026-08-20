import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import {
  locations,
  vendors as fallbackVendors,
} from "../data/options";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";
import { formatCustomerName } from "../utils/textFormatters";
import SearchableSelect from "./SearchableSelect";

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

function getDateKey(value) {
  if (!value) {
    return "";
  }

  const valueString = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(valueString)) {
    return valueString;
  }

  const date = new Date(valueString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function findMatchingOption(value, options) {
  return options.find(
    (option) => option.toLowerCase() === value.trim().toLowerCase(),
  );
}

function getUniqueOptions(options) {
  const seenOptions = new Set();

  return options
    .map((option) => String(option || "").trim())
    .filter(Boolean)
    .filter((option) => {
      const key = option.toLowerCase();

      if (seenOptions.has(key)) {
        return false;
      }

      seenOptions.add(key);
      return true;
    });
}

function findMatchingTeamMember(value, teamMemberOptions) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  const firstName = normalizedValue.split(/\s+/)[0] || "";

  if (!normalizedValue) {
    return "";
  }

  return (
    teamMemberOptions.find((teamMember) => {
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

function getTodaySouthRuns(supplierRuns) {
  const todayKey = getTodayDateKey();

  if (!Array.isArray(supplierRuns)) {
    return [];
  }

  return supplierRuns
    .filter((supplierRun) => {
      const runDate =
        getDateKey(supplierRun?.scheduledDate) ||
        getDateKey(supplierRun?.completedAt) ||
        getDateKey(supplierRun?.updatedAt) ||
        getDateKey(supplierRun?.createdAt);

      return runDate === todayKey;
    })
    .sort(sortSouthRunsByRecent);
}

function getTodayTheirTruckPOs(theirTruckPOs) {
  const todayKey = getTodayDateKey();

  if (!Array.isArray(theirTruckPOs)) {
    return [];
  }

  return theirTruckPOs
    .filter((theirTruckPO) => {
      const deliveryDate =
        getDateKey(theirTruckPO?.deliveryDate) ||
        getDateKey(theirTruckPO?.updatedAt) ||
        getDateKey(theirTruckPO?.createdAt);

      return (
        theirTruckPO?.status !== "complete" &&
        deliveryDate === todayKey
      );
    })
    .sort(sortTheirTruckPOsByRecent);
}

function getPoSuggestionLabel(poRecord, sourceType) {
  const vendor = poRecord?.vendor || "Unknown vendor";
  const date =
    sourceType === "south"
      ? formatSouthRunDate(poRecord?.scheduledDate || poRecord?.completedAt)
      : formatSouthRunDate(poRecord?.deliveryDate);

  return [vendor, date].filter(Boolean).join(" • ");
}

function getPoSuggestionTitle(poRecord, sourceType) {
  if (sourceType === "south") {
    const customerName = poRecord?.customerName
      ? formatCustomerName(poRecord.customerName)
      : "";
    const orderNumber = poRecord?.orderNumber || poRecord?.order || "";

    return [customerName, orderNumber ? `Order ${orderNumber}` : ""]
      .filter(Boolean)
      .join(" • ");
  }

  const customerName = poRecord?.customerName
    ? formatCustomerName(poRecord.customerName)
    : "";
  const orderNumber = poRecord?.orderNumber || "";

  return [customerName, orderNumber ? `Order ${orderNumber}` : ""]
    .filter(Boolean)
    .join(" • ");
}

function getPoSuggestionItemCount(poRecord) {
  const itemCount = Array.isArray(poRecord?.items) ? poRecord.items.length : 0;

  if (itemCount === 0) {
    return "";
  }

  return `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
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
  teamMemberOptions = [],
}) {
  const vendors =
    Array.isArray(vendorOptions) && vendorOptions.length > 0
      ? vendorOptions
      : fallbackVendors;
  const teamMembers = useMemo(
    () =>
      getUniqueOptions([
        ...teamMemberOptions,
        checkedInByDefault,
      ]),
    [checkedInByDefault, teamMemberOptions],
  );
  const [poNumber, setPoNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [receivingTruckType, setReceivingTruckType] =
    useState("theirTruck");
  const [checkedInBy, setCheckedInBy] = useState(() =>
    findMatchingTeamMember(checkedInByDefault, teamMembers),
  );
  const [linkedSouthRunId, setLinkedSouthRunId] = useState("");
  const [linkedTheirTruckPOId, setLinkedTheirTruckPOId] = useState("");
  const [isPoSuggestionMenuOpen, setIsPoSuggestionMenuOpen] =
    useState(false);
  const [processingPhotoMaterialId, setProcessingPhotoMaterialId] =
    useState("");
  const [currentStep, setCurrentStep] = useState(1);

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

    const defaultTeamMember = findMatchingTeamMember(
      checkedInByDefault,
      teamMembers,
    );

    if (defaultTeamMember) {
      setCheckedInBy(defaultTeamMember);
    }
  }, [checkedInBy, checkedInByDefault, teamMembers]);

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
  const poSuggestions =
    receivingTruckType === "ourTruck"
      ? getTodaySouthRuns(supplierRuns)
      : getTodayTheirTruckPOs(theirTruckPOs);
  const poSuggestionSourceType =
    receivingTruckType === "ourTruck" ? "south" : "theirTruck";
  const filteredPoSuggestions = useMemo(() => {
    const normalizedSearch = normalizePoNumber(poNumber);

    if (!normalizedSearch) {
      return poSuggestions;
    }

    return poSuggestions.filter((poSuggestion) =>
      normalizePoNumber(poSuggestion?.poNumber).includes(normalizedSearch),
    );
  }, [poNumber, poSuggestions]);
  const poSuggestionInputLabel =
    receivingTruckType === "ourTruck"
      ? "South POs from today"
      : "Their Truck POs from today";

  function handlePoChange(event) {
    const nextPoNumber = formatPoNumber(event.target.value);
    const preferredSouthMatches =
      receivingTruckType === "ourTruck"
        ? getMatchingSouthRunsForPo(nextPoNumber, supplierRuns)
        : [];
    const preferredTheirTruckMatches =
      receivingTruckType === "theirTruck"
        ? getMatchingTheirTruckPOsForPo(nextPoNumber, theirTruckPOs)
        : [];
    const fallbackSouthMatches =
      receivingTruckType !== "ourTruck"
        ? getMatchingSouthRunsForPo(nextPoNumber, supplierRuns)
        : [];
    const fallbackTheirTruckMatches =
      receivingTruckType !== "theirTruck"
        ? getMatchingTheirTruckPOsForPo(nextPoNumber, theirTruckPOs)
        : [];
    const nextSouthRun =
      nextPoNumber.length === 7
        ? preferredSouthMatches[0] || fallbackSouthMatches[0] || null
        : null;
    const nextTheirTruckPO =
      nextPoNumber.length === 7
        ? preferredTheirTruckMatches[0] ||
          fallbackTheirTruckMatches[0] ||
          null
        : null;

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

    setPoNumber(formatPoNumber(String(supplierRun.poNumber || "")));
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

    setPoNumber(formatPoNumber(String(theirTruckPO.poNumber || "")));
    setLinkedTheirTruckPOId(theirTruckPO.id);
    setLinkedSouthRunId("");
    setReceivingTruckType("theirTruck");
    populateMaterialsFromPoItems(nextTheirTruckItems, "theirTruck");

    if (theirTruckPO.vendor) {
      setVendor(theirTruckPO.vendor);
    }

    clearError();
  }

  function handlePoSuggestionSelect(poSuggestion) {
    if (poSuggestionSourceType === "south") {
      linkSouthRun(poSuggestion);
    } else {
      linkTheirTruckPO(poSuggestion);
    }

    setIsPoSuggestionMenuOpen(false);
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
    setCheckedInBy(findMatchingTeamMember(checkedInByDefault, teamMembers));
    setLinkedSouthRunId("");
    setLinkedTheirTruckPOId("");
    setProcessingPhotoMaterialId("");
    setCurrentStep(1);
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
            }
          : material,
      ),
    );

    clearError();
  }

  const enteredMaterials = materials.filter((material) =>
    material.description.trim(),
  );
  const savedMaterials = enteredMaterials.filter(
    (material) => material.saved,
  );
  const hasLinkedPo = Boolean(linkedSouthRun || linkedTheirTruckPO);
  const activeSourceRecord = linkedSouthRun || linkedTheirTruckPO;
  const sourceLabel = linkedSouthRun
    ? "Our Truck"
    : linkedTheirTruckPO
      ? "Their Truck"
      : receivingTruckType === "ourTruck"
        ? "Our Truck"
        : "Their Truck";
  const allSavedMaterialsHaveLocationPhotos =
    savedMaterials.length > 0 &&
    savedMaterials.every((material) => material.locationPhoto);
  const damagedMaterials = savedMaterials.filter(
    (material) => material.conditionGood === false,
  );
  const damagedMaterialsMissingPhotos = damagedMaterials.filter(
    (material) => !material.damagePhoto,
  );
  function validateStepOne() {
    if (!/^\d{3}-\d{3}$/.test(poNumber)) {
      setError("Enter a complete six-digit PO number.");
      return false;
    }

    if (!findMatchingOption(vendor, vendors)) {
      setError("Select a vendor from the vendor list.");
      return false;
    }

    if (!teamMembers.includes(checkedInBy)) {
      setError("Select who checked in this PO.");
      return false;
    }

    clearError();
    return true;
  }

  function validateStepTwo() {
    if (enteredMaterials.length === 0) {
      setError(
        "Add at least one material before continuing to photos.",
      );
      return false;
    }

    const unsavedMaterial = enteredMaterials.find(
      (material) => !material.saved,
    );

    if (unsavedMaterial) {
      setError("Save each material before continuing to photos.");
      setOpenMaterialId(unsavedMaterial.id);
      return false;
    }

    clearError();
    return true;
  }

  function validateStepThree() {
    if (processingPhotoMaterialId) {
      setError("Wait for the material photo to finish preparing.");
      return false;
    }

    if (!allSavedMaterialsHaveLocationPhotos) {
      setError("Add a location photo for each received material.");
      return false;
    }

    if (damagedMaterialsMissingPhotos.length > 0) {
      setError("Add a damage photo for each damaged material.");
      return false;
    }

    clearError();
    return true;
  }

  function goToNextStep() {
    if (currentStep === 1 && validateStepOne()) {
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2 && validateStepTwo()) {
      setCurrentStep(3);
    }
  }

  function goToPreviousStep() {
    setCurrentStep((step) => Math.max(1, step - 1));
    clearError();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateStepOne() || !validateStepTwo() || !validateStepThree()) {
      return;
    }

    const matchedVendor = findMatchingOption(vendor, vendors);

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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FC2C38]">
              Check In Product
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Check In Product
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600 sm:text-base">
              3 steps to check in material quickly and accurately.
            </p>
          </div>

          <div className="w-full space-y-3 lg:max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-slate-500">
                Checked in by
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FC2C38] text-sm font-black uppercase text-white">
                  {(checkedInBy || checkedInByDefault || "?")
                    .trim()
                    .slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-slate-950">
                    {checkedInBy || checkedInByDefault || "Signed in user"}
                  </span>
                  <span className="block text-xs font-semibold text-slate-500">
                    Saved automatically with this check-in.
                  </span>
                </span>
              </div>
            </div>

            <div className="hidden gap-2 text-sm font-bold text-slate-700 sm:grid sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                <Camera className="h-4 w-4" aria-hidden="true" />
                Photos required
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {locations.length} locations
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Damage tracking
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6 border-y border-slate-200 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={currentStep === 1 || isSubmitting}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Go back one step"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex-1">
              <p className="text-center text-xs font-black uppercase tracking-[0.12em] text-slate-900">
                Step {currentStep} of 3
              </p>
              <div className="mx-auto mt-3 grid max-w-xs grid-cols-3 gap-1.5">
                {[1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full ${
                      currentStep >= step ? "bg-blue-700" : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {currentStep === 1 ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-black text-slate-950">
                PO & Vendor
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Enter the PO number to get started.
              </p>
            </div>

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
                    icon: Truck,
                    selectedClass: "border-blue-500 bg-blue-50",
                    textClass: "text-blue-800",
                  },
                  {
                    value: "ourTruck",
                    label: "Our Truck",
                    detail: "South run or Capital driver",
                    icon: Warehouse,
                    selectedClass: "border-red-500 bg-red-50",
                    textClass: "text-red-800",
                  },
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = receivingTruckType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setReceivingTruckType(option.value);
                        if (option.value === "ourTruck") {
                          setLinkedTheirTruckPOId("");
                        } else {
                          setLinkedSouthRunId("");
                        }
                        clearError();
                      }}
                      disabled={isSubmitting}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? option.selectedClass
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Icon
                          className={`h-5 w-5 ${
                            isSelected ? option.textClass : "text-slate-500"
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                      <span>
                        <span
                          className={`block text-lg font-black ${
                            isSelected ? option.textClass : "text-slate-900"
                          }`}
                        >
                          {option.label}
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-slate-500">
                          {option.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="relative">
                <label
                  htmlFor="poNumber"
                  className="mb-2 block text-sm font-black uppercase tracking-[0.08em] text-slate-700"
                >
                  PO Number *
                </label>
                <div className="relative">
                  <input
                    id="poNumber"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={7}
                    value={poNumber}
                    onChange={handlePoChange}
                    onFocus={() => setIsPoSuggestionMenuOpen(true)}
                    onBlur={() => {
                      window.setTimeout(
                        () => setIsPoSuggestionMenuOpen(false),
                        150,
                      );
                    }}
                    disabled={isSubmitting}
                    placeholder="123-456"
                    className="w-full rounded-xl border border-slate-300 px-4 py-4 pr-14 text-2xl font-black tracking-[0.08em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                  />
                  {/^\d{3}-\d{3}$/.test(poNumber) ? (
                    <CheckCircle2
                      className="absolute right-4 top-1/2 h-7 w-7 -translate-y-1/2 text-emerald-700"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>

                {isPoSuggestionMenuOpen && (
                  <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-slate-400">
                        {poSuggestionInputLabel}
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto overscroll-contain p-2">
                      {filteredPoSuggestions.length > 0 ? (
                        filteredPoSuggestions.map((poSuggestion) => {
                          const poSuggestionTitle = getPoSuggestionTitle(
                            poSuggestion,
                            poSuggestionSourceType,
                          );
                          const itemCount =
                            getPoSuggestionItemCount(poSuggestion);

                          return (
                            <button
                              key={`${receivingTruckType}-${poSuggestion.id || poSuggestion.poNumber}`}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() =>
                                handlePoSuggestionSelect(poSuggestion)
                              }
                              className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                            >
                              <span className="flex items-start justify-between gap-3">
                                <span>
                                  <span className="block text-xl font-black tracking-[0.08em] text-slate-950">
                                    {formatPoNumber(
                                      String(poSuggestion.poNumber || ""),
                                    )}
                                  </span>
                                  <span className="mt-1 block text-sm font-bold text-slate-600">
                                    {getPoSuggestionLabel(
                                      poSuggestion,
                                      poSuggestionSourceType,
                                    )}
                                  </span>
                                  {poSuggestionTitle ? (
                                    <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
                                      {poSuggestionTitle}
                                    </span>
                                  ) : null}
                                </span>
                                {itemCount ? (
                                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-slate-600">
                                    {itemCount}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-5 text-sm font-bold text-slate-500">
                          No matching {poSuggestionInputLabel.toLowerCase()}.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="vendor-select"
                  className="mb-2 block text-sm font-black uppercase tracking-[0.08em] text-slate-700"
                >
                  Vendor *
                </label>
                <SearchableSelect
                  id="vendor-select"
                  value={vendor}
                  options={vendors}
                  onChange={(nextVendor) => {
                    setVendor(nextVendor);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  allowCustomValue
                  placeholder="Start typing a vendor..."
                  accent="blue"
                />
              </div>
            </div>

            {visibleSouthRun || visibleTheirTruckPO ? (
              <section
                className={`rounded-2xl border px-4 py-4 ${
                  hasLinkedPo
                    ? "border-blue-200 bg-blue-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-black uppercase tracking-[0.18em] ${
                        hasLinkedPo ? "text-blue-700" : "text-amber-700"
                      }`}
                    >
                      {hasLinkedPo ? "PO Linked" : "PO Found"}
                    </p>
                    <h3 className="mt-1 text-xl font-black text-slate-900">
                      PO {activeSourceRecord?.poNumber || poNumber} from{" "}
                      {activeSourceRecord?.vendor || vendor || sourceLabel}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {sourceLabel}
                      {visibleSouthDate ? ` • ${visibleSouthDate}` : ""}
                      {visibleTheirTruckDate
                        ? ` • ${visibleTheirTruckDate}`
                        : ""}
                    </p>
                  </div>

                  {hasLinkedPo ? (
                    <button
                      type="button"
                      onClick={
                        linkedSouthRun ? unlinkSouthRun : unlinkTheirTruckPO
                      }
                      className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                    >
                      Unlink
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        visibleSouthRun
                          ? linkSouthRun(visibleSouthRun)
                          : linkTheirTruckPO(visibleTheirTruckPO)
                      }
                      className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800"
                    >
                      Link PO
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-900">
                PO suggestions show {poSuggestionInputLabel}. You can still type any PO manually.
              </section>
            )}
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-950">
                  Items & Location
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Confirm items received and where you placed them.
                </p>
              </div>
              <button
                type="button"
                onClick={addMaterial}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Item
              </button>
            </div>

            <datalist id="location-options">
              {locations.map((location) => (
                <option key={location} value={location} />
              ))}
            </datalist>

            <div className="space-y-3">
              {materials.map((material, index) => {
                const isMaterialOpen = openMaterialId === material.id;
                const materialTitle =
                  material.description.trim() || `Material ${index + 1}`;

                return (
                  <div
                    key={material.id}
                    className={`overflow-hidden rounded-2xl border ${
                      material.saved
                        ? "border-emerald-200 bg-white"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <Package className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-black text-slate-900">
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
                          {material.location || "Select location"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          material.saved
                            ? editMaterial(material.id)
                            : setOpenMaterialId((currentId) =>
                                currentId === material.id
                                  ? ""
                                  : material.id,
                              )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        {material.saved ? "Edit" : isMaterialOpen ? "Close" : "Open"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMaterial(material.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-white text-red-600 transition hover:bg-red-50"
                        aria-label={`Remove material ${index + 1}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    {!material.saved && isMaterialOpen ? (
                      <div className="space-y-4 border-t border-slate-200 p-4">
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
                              updateMaterial(material.id, event.target.value)
                            }
                            placeholder="Example: 2x4-8 SPF Studs"
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`material-location-${material.id}`}
                            className="mb-2 block text-sm font-bold text-slate-700"
                          >
                            Material Location *
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
                            className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 md:hidden"
                          >
                            <option value="">Select a material location...</option>
                            {locations.map((location) => (
                              <option key={location} value={location}>
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
                            className="hidden w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100 md:block"
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {["Building C", "Inner Yard", "Street", "On Truck/Delivery"].map(
                              (location) => (
                                <button
                                  key={location}
                                  type="button"
                                  onClick={() =>
                                    updateMaterialLocation(
                                      material.id,
                                      location,
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                  {location}
                                </button>
                              ),
                            )}
                          </div>
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
                            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => saveMaterial(material.id)}
                          className="w-full rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
                        >
                          Update / Save Item
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-black text-slate-950">
                Photos & Condition
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Add photos and record condition of the items.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="divide-y divide-blue-100">
                {[
                  {
                    icon: ClipboardList,
                    label: `PO ${poNumber || "Not entered"}`,
                    detail: vendor || "Vendor",
                    done: /^\d{3}-\d{3}$/.test(poNumber),
                  },
                  {
                    icon: Package,
                    label: `${savedMaterials.length} ${
                      savedMaterials.length === 1 ? "Item" : "Items"
                    }`,
                    detail: "Received",
                    done: savedMaterials.length > 0,
                  },
                  {
                    icon: MapPin,
                    label:
                      savedMaterials.length > 0
                        ? [
                            ...new Set(
                              savedMaterials
                                .map((material) => material.location)
                                .filter(Boolean),
                            ),
                          ].join(", ") || "No location"
                        : "No location",
                    detail: "Location",
                    done: savedMaterials.every((material) =>
                      findMatchingOption(material.location, locations),
                    ),
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.detail}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <Icon className="h-5 w-5 text-slate-700" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950">
                          {item.label}
                        </p>
                        <p className="text-xs font-semibold text-slate-600">
                          {item.detail}
                        </p>
                      </div>
                      {item.done ? (
                        <CheckCircle2
                          className="h-5 w-5 shrink-0 text-emerald-700"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              {savedMaterials.map((material, index) => (
                <section
                  key={material.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                      <Package className="h-5 w-5 text-slate-700" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-slate-950">
                        {material.description || `Material ${index + 1}`}
                      </h4>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {material.location || "No location selected"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        value: true,
                        label: "No, all items are in good condition",
                        icon: CheckCircle2,
                        className: "border-slate-200 bg-white text-slate-800",
                      },
                      {
                        value: false,
                        label: "Yes, some items are damaged",
                        icon: AlertTriangle,
                        className: "border-red-200 bg-red-50 text-red-700",
                      },
                    ].map((option) => {
                      const Icon = option.icon;
                      const isSelected =
                        material.conditionGood !== false === option.value;

                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() =>
                            updateMaterialCondition(
                              material.id,
                              option.value,
                            )
                          }
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                            isSelected
                              ? option.className
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-black uppercase tracking-[0.08em] text-slate-700">
                        Location Photo *
                      </p>
                      {material.locationPhoto ? (
                        <button
                          type="button"
                          onClick={() => removeMaterialPhoto(material.id)}
                          disabled={
                            isSubmitting ||
                            Boolean(processingPhotoMaterialId)
                          }
                          className="text-sm font-bold text-red-600"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <label
                      htmlFor={`material-photo-${material.id}`}
                      className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition hover:border-blue-600 hover:bg-blue-50"
                    >
                      {material.locationPhoto ? (
                        <img
                          src={material.locationPhoto.dataUrl}
                          alt={`Location preview for material ${index + 1}`}
                          className="h-40 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <>
                          <Camera className="h-8 w-8 text-blue-700" aria-hidden="true" />
                          <span className="mt-2 text-sm font-black text-blue-700">
                            Add Location Photo
                          </span>
                          <span className="mt-1 text-xs font-semibold text-slate-500">
                            Please take a wide photo showing where this material was placed.
                          </span>
                        </>
                      )}
                    </label>
                    <input
                      id={`material-photo-${material.id}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) =>
                        handleMaterialPhotoChange(material.id, event)
                      }
                      disabled={
                        isSubmitting || Boolean(processingPhotoMaterialId)
                      }
                      className="sr-only"
                    />
                  </div>

                  {material.conditionGood === false ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.08em] text-red-800">
                            Damage Photo *
                          </p>
                          <p className="mt-1 text-xs font-semibold text-red-700">
                            Capture a close-up of the damaged part.
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
                              Boolean(processingPhotoMaterialId)
                            }
                            className="text-sm font-bold text-red-700"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <label
                        htmlFor={`damage-photo-${material.id}`}
                        className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-red-200 bg-white px-4 py-4 text-center transition hover:border-red-400 hover:bg-red-50"
                      >
                        {material.damagePhoto ? (
                          <img
                            src={material.damagePhoto.dataUrl}
                            alt={`Damage preview for material ${index + 1}`}
                            className="h-36 w-full rounded-lg object-cover"
                          />
                        ) : (
                          <>
                            <Camera className="h-7 w-7 text-red-700" aria-hidden="true" />
                            <span className="mt-2 text-sm font-black text-red-800">
                              Add Damage Photo
                            </span>
                          </>
                        )}
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
                          isSubmitting || Boolean(processingPhotoMaterialId)
                        }
                        className="sr-only"
                      />
                    </div>
                  ) : null}
                </section>
              ))}
            </div>

            {processingPhotoMaterialId ? (
              <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
                Preparing photo...
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 font-semibold text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goToPreviousStep}
            disabled={currentStep === 1 || isSubmitting}
            className="rounded-xl border border-slate-300 bg-white px-6 py-4 font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-40"
          >
            Back
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={goToNextStep}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-blue-700 px-6 py-4 font-black text-white shadow-md transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-400 sm:min-w-56"
            >
              Continue
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || Boolean(processingPhotoMaterialId)}
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-emerald-700 px-6 py-4 text-lg font-black text-white shadow-md transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-400 sm:min-w-56"
            >
              <Check className="h-5 w-5" aria-hidden="true" />
              {isSubmitting ? "Saving..." : "Check In"}
            </button>
          )}
        </div>
      </div>

      <div className="hidden gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid md:grid-cols-4">
        <div className="flex items-start gap-3 md:col-span-1">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
            <Camera className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Damage photo tips
            </p>
            <p className="mt-2 text-sm font-black text-slate-900">
              Take a clear overall photo
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Show the entire load or package.
            </p>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-900">
            Capture damage close-up
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Take close-up photos of any damage.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-900">
            Add as many as needed
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Multiple photos help ensure accuracy.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
          <ShieldCheck className="h-6 w-6 shrink-0 text-[#FC2C38]" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-800">
            All damage photos are time-stamped and saved with this check-in record.
          </p>
        </div>
      </div>
    </form>
  );
}
