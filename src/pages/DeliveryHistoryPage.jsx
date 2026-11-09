import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudRain,
  Images,
  MapPin,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import MarkDeliveredModal from "../components/MarkDeliveredModal";
import PageContainer from "../components/PageContainer";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import { formatCustomerName } from "../utils/textFormatters";

const MAX_DELIVERY_PROOF_PHOTOS = 10;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function getDateValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (Number.isFinite(Number(value?.seconds))) {
    return new Date(Number(value.seconds) * 1000);
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateKey(value) {
  const date = getDateValue(value);

  if (!date) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getCompletedDateKey(delivery) {
  return getDateKey(
    delivery?.deliveredAt || delivery?.deliveryDate || delivery?.updatedAt,
  );
}

function getCalendarMonthDays(monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      dateKey: getDateKey(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

function getCalendarMonthLabel(monthDate) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(monthDate);
}

function formatDayHeading(dateKey) {
  if (!dateKey || dateKey === "all") {
    return "All completed deliveries";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function formatCompletedAt(value) {
  if (!value) {
    return "No completed time";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(getDateValue(value));
}

function formatTimeLabel(value) {
  if (!value) {
    return "";
  }

  const [hours = "0", minutes = "00"] = value.split(":");
  const date = new Date();

  date.setHours(Number(hours), Number(minutes), 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDeliveryTypeLabel(value) {
  if (value === "priority") {
    return "Priority";
  }

  if (value === "hotShot") {
    return "Hot Shot";
  }

  if (value === "return") {
    return "Return";
  }

  return "Standard";
}

function formatForkliftLabel(value) {
  if (value === "donkey") {
    return "Donkey 5000 lbs";
  }

  if (value === "manitou") {
    return "Manitou 4500 lbs";
  }

  if (value === "moffit") {
    return "Moffit 5500 lbs";
  }

  return "";
}

function PhotoPreview({
  photo,
  label,
  isHardware = false,
  onView,
  deliveryId,
  photoField,
  photosField,
}) {
  if (!photo?.dataUrl) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() =>
        onView?.({
          ...photo,
          label,
          deliveryId,
          photoField,
          photosField,
        })
      }
      className={`block w-full overflow-hidden rounded-2xl border bg-white text-left transition ${
        isHardware
          ? "border-red-200 hover:bg-red-50"
          : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <img
        src={photo.dataUrl}
        alt={label}
        className="h-48 w-full bg-slate-100 object-contain sm:h-64"
      />

      <span
        className={`flex items-center gap-2 px-3 py-2 text-sm font-black ${
          isHardware ? "text-[#FC2C38]" : "text-slate-700"
        }`}
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        View {label}
      </span>
    </button>
  );
}

function getPhotoList(delivery, photoField, photosField) {
  const photos = Array.isArray(delivery?.[photosField])
    ? delivery[photosField].filter((photo) => photo?.dataUrl)
    : [];
  const legacyPhoto = delivery?.[photoField]?.dataUrl
    ? delivery[photoField]
    : null;

  if (!legacyPhoto) {
    return photos;
  }

  if (photos.some((photo) => photo.dataUrl === legacyPhoto.dataUrl)) {
    return photos;
  }

  return [legacyPhoto, ...photos];
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

async function createPhotoFromFile(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const targetDataUrlLength = 70000;
  const maxWidth = 640;
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

  while (dataUrl.length > targetDataUrlLength && quality > 0.26) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return {
    name: file.name,
    type: "image/jpeg",
    dataUrl,
    capturedAt: new Date().toISOString(),
  };
}

function CompletedPhotoUpload({
  title,
  detail,
  isHardware = false,
  isUpdating = false,
  disabled = false,
  onTakePhoto,
  onUploadPhotos,
}) {
  const toneClasses = isHardware
    ? "border-red-200 bg-red-50"
    : "border-blue-200 bg-blue-50";
  const iconClasses = isHardware ? "text-[#FC2C38]" : "text-blue-700";

  return (
    <section className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <Camera className={`h-5 w-5 ${iconClasses}`} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-black text-slate-950">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
            {detail}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
          <Camera className="h-4 w-4" aria-hidden="true" />
          {isUpdating ? "Saving..." : "Take Photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={isUpdating || disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              onTakePhoto?.(file);
              event.target.value = "";
            }}
            className="sr-only"
          />
        </label>

        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
          <Images className="h-4 w-4" aria-hidden="true" />
          Upload Photos
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isUpdating || disabled}
            onChange={(event) => {
              onUploadPhotos?.(Array.from(event.target.files || []));
              event.target.value = "";
            }}
            className="sr-only"
          />
        </label>
      </div>
    </section>
  );
}

function PhotoPreviewGrid({
  photos,
  label,
  isHardware = false,
  onView,
  deliveryId,
  photoField,
  photosField,
}) {
  if (!photos.length) {
    return null;
  }

  return photos.map((photo, photoIndex) => (
    <PhotoPreview
      key={`${label}-${photo.dataUrl}-${photoIndex}`}
      photo={photo}
      label={`${label} ${photoIndex + 1}`}
      isHardware={isHardware}
      onView={onView}
      deliveryId={deliveryId}
      photoField={photoField}
      photosField={photosField}
    />
  ));
}

export default function DeliveryHistoryPage({
  deliveries,
  onPageChange,
  onUpdateDelivery,
  onUpdateDeliveredAt,
  onDeleteDelivery,
  isSuperAdmin = false,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [openDeliveryKeys, setOpenDeliveryKeys] = useState({});
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [updatingPhotoKey, setUpdatingPhotoKey] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(null);
  const [updatingDeliveredAt, setUpdatingDeliveredAt] = useState(false);
  const [deletingDeliveryId, setDeletingDeliveryId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const resultsRef = useRef(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const completedDeliveries = useMemo(
    () =>
      deliveries
        .filter((delivery) => isDeliveryComplete(delivery))
        .sort(
          (firstDelivery, secondDelivery) =>
            new Date(
              secondDelivery.deliveredAt || secondDelivery.updatedAt,
            ) -
            new Date(
              firstDelivery.deliveredAt || firstDelivery.updatedAt,
            ),
        ),
    [deliveries],
  );

  const completedDeliveriesByDate = useMemo(() => {
    const groupedDeliveries = new Map();

    completedDeliveries.forEach((delivery) => {
      const dateKey = getCompletedDateKey(delivery);

      if (!dateKey) {
        return;
      }

      groupedDeliveries.set(dateKey, [
        ...(groupedDeliveries.get(dateKey) || []),
        delivery,
      ]);
    });

    return groupedDeliveries;
  }, [completedDeliveries]);

  const latestCompletedDateKey = getCompletedDateKey(completedDeliveries[0]);
  const calendarDays = useMemo(
    () => getCalendarMonthDays(calendarMonth),
    [calendarMonth],
  );
  const displayedMonthCount = useMemo(
    () =>
      completedDeliveries.filter((delivery) => {
        const date = getDateValue(
          delivery.deliveredAt || delivery.deliveryDate || delivery.updatedAt,
        );

        return (
          date &&
          date.getFullYear() === calendarMonth.getFullYear() &&
          date.getMonth() === calendarMonth.getMonth()
        );
      }).length,
    [calendarMonth, completedDeliveries],
  );

  useEffect(() => {
    if (selectedDate || !latestCompletedDateKey) {
      return;
    }

    const latestCompletedDate = new Date(`${latestCompletedDateKey}T12:00:00`);
    setSelectedDate(latestCompletedDateKey);
    setCalendarMonth(
      new Date(
        latestCompletedDate.getFullYear(),
        latestCompletedDate.getMonth(),
        1,
      ),
    );
  }, [latestCompletedDateKey, selectedDate]);

  const matchingDeliveries = useMemo(() => {
    const textSearch = normalizeText(searchValue);
    const numberSearch = normalizeNumber(searchValue);

    const deliveriesToFilter = textSearch
      ? completedDeliveries
      : selectedDate && selectedDate !== "all"
        ? completedDeliveriesByDate.get(selectedDate) || []
        : completedDeliveries;

    if (!textSearch) {
      return deliveriesToFilter;
    }

    return deliveriesToFilter.filter((delivery) => {
      const orderMatches =
        numberSearch.length > 0 &&
        normalizeNumber(delivery.orderNumber).includes(numberSearch);
      const customerMatches = normalizeText(
        delivery.customerName,
      ).includes(textSearch);
      const addressMatches = normalizeText(delivery.address).includes(
        textSearch,
      );
      const scopeMatches = normalizeText(
        `${delivery.deliveryScope || ""} ${delivery.deliveryScopeNotes || ""}`,
      ).includes(textSearch);

      return orderMatches || customerMatches || addressMatches || scopeMatches;
    });
  }, [
    completedDeliveries,
    completedDeliveriesByDate,
    searchValue,
    selectedDate,
  ]);

  const hasHistory = completedDeliveries.length > 0;
  const hasSearch = searchValue.trim().length > 0;

  function toggleDelivery(deliveryId) {
    setOpenDeliveryKeys((currentOpenDeliveryKeys) => ({
      ...currentOpenDeliveryKeys,
      [deliveryId]: !currentOpenDeliveryKeys[deliveryId],
    }));
  }

  function changeCalendarMonth(offset) {
    setCalendarMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + offset,
          1,
        ),
    );
  }

  function chooseCalendarDay(day) {
    setSelectedDate(day.dateKey);
    setSearchValue("");

    if (!day.isCurrentMonth) {
      setCalendarMonth(
        new Date(day.date.getFullYear(), day.date.getMonth(), 1),
      );
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }

  async function handleDeletePhoto() {
    if (!isSuperAdmin || !viewingPhoto?.deliveryId || !viewingPhoto?.dataUrl) {
      return;
    }

    const delivery = deliveries.find(
      (currentDelivery) => currentDelivery.id === viewingPhoto.deliveryId,
    );

    if (!delivery || !onUpdateDelivery) {
      return;
    }

    const photosField = viewingPhoto.photosField;
    const photoField = viewingPhoto.photoField;
    const nextPhotos = Array.isArray(delivery[photosField])
      ? delivery[photosField].filter(
          (photo) => photo?.dataUrl && photo.dataUrl !== viewingPhoto.dataUrl,
        )
      : [];
    const nextUpdates = {
      [photosField]: nextPhotos,
      updatedAt: new Date().toISOString(),
    };

    if (delivery[photoField]?.dataUrl === viewingPhoto.dataUrl) {
      nextUpdates[photoField] = nextPhotos[0] || null;
    }

    await onUpdateDelivery(delivery.id, nextUpdates);
    setViewingPhoto(null);
  }

  async function handleCompletedDeliveryPhotos(
    delivery,
    files,
    photoField,
    photosField,
  ) {
    const selectedFiles = Array.from(files || []).filter(Boolean);

    if (!delivery?.id || !onUpdateDelivery || selectedFiles.length === 0) {
      return;
    }

    const savedDeliveryPhotos = getPhotoList(
      delivery,
      "deliveryPhoto",
      "deliveryPhotos",
    );
    const savedHardwarePhotos = getPhotoList(
      delivery,
      "hardwarePhoto",
      "hardwarePhotos",
    );
    const remainingPhotoSlots = Math.max(
      0,
      MAX_DELIVERY_PROOF_PHOTOS -
        savedDeliveryPhotos.length -
        savedHardwarePhotos.length,
    );

    if (remainingPhotoSlots === 0) {
      setPhotoError(
        `This delivery already has the maximum of ${MAX_DELIVERY_PROOF_PHOTOS} delivery and hardware photos.`,
      );
      return;
    }

    const filesToSave = selectedFiles.slice(0, remainingPhotoSlots);
    const skippedPhotoCount = selectedFiles.length - filesToSave.length;

    const updateKey = `${delivery.id}:${photosField}`;
    setPhotoError("");
    setUpdatingPhotoKey(updateKey);

    try {
      const newPhotos = [];

      for (const file of filesToSave) {
        newPhotos.push(await createPhotoFromFile(file));
      }

      const currentPhotos = getPhotoList(delivery, photoField, photosField);
      const nextPhotos = [...currentPhotos, ...newPhotos];

      await onUpdateDelivery(delivery.id, {
        [photoField]: newPhotos[newPhotos.length - 1],
        [photosField]: nextPhotos,
        updatedAt: new Date().toISOString(),
      });

      if (skippedPhotoCount > 0) {
        setPhotoError(
          `Saved ${newPhotos.length} photo${newPhotos.length === 1 ? "" : "s"}. A delivery can have up to ${MAX_DELIVERY_PROOF_PHOTOS} delivery and hardware photos total.`,
        );
      }
    } catch (uploadError) {
      console.error("Unable to add completed delivery photos:", uploadError);
      setPhotoError(
        "Unable to save those photos. Check your connection and try again.",
      );
    } finally {
      setUpdatingPhotoKey("");
    }
  }

  async function handleUpdateDeliveredAt(deliveredAt) {
    if (!editingDeliveryDate?.id || !onUpdateDeliveredAt) {
      return;
    }

    setUpdatingDeliveredAt(true);

    try {
      const didUpdate = await onUpdateDeliveredAt(
        editingDeliveryDate.id,
        deliveredAt,
      );

      if (didUpdate !== false) {
        const correctedDateKey = getDateKey(deliveredAt);

        if (correctedDateKey) {
          const correctedDate = new Date(`${correctedDateKey}T12:00:00`);
          setSelectedDate(correctedDateKey);
          setCalendarMonth(
            new Date(
              correctedDate.getFullYear(),
              correctedDate.getMonth(),
              1,
            ),
          );
          setSearchValue("");
          setOpenDeliveryKeys((currentOpenDeliveryKeys) => ({
            ...currentOpenDeliveryKeys,
            [editingDeliveryDate.id]: true,
          }));
        }

        setEditingDeliveryDate(null);
      }
    } finally {
      setUpdatingDeliveredAt(false);
    }
  }

  async function handleDeleteCompletedDelivery(delivery) {
    if (!delivery?.id || !onDeleteDelivery || deletingDeliveryId) {
      return;
    }

    const orderLabel = delivery.orderNumber
      ? `order ${delivery.orderNumber}`
      : "this completed delivery";

    if (
      !window.confirm(
        `Permanently delete ${orderLabel} from delivery history? This removes its delivery photos, uploaded Delivery Order Copies, and delivery record. The linked customer order will remain.`,
      )
    ) {
      return;
    }

    setPhotoError("");
    setDeletingDeliveryId(delivery.id);

    try {
      await onDeleteDelivery(delivery.id);
      setOpenDeliveryKeys((currentOpenDeliveryKeys) => {
        const nextOpenDeliveryKeys = { ...currentOpenDeliveryKeys };
        delete nextOpenDeliveryKeys[delivery.id];
        return nextOpenDeliveryKeys;
      });
    } catch (deleteError) {
      console.error("Unable to delete completed delivery:", deleteError);
      setPhotoError(
        "Unable to delete that delivery and its attachments. Nothing else was changed.",
      );
    } finally {
      setDeletingDeliveryId("");
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Deliveries", onClick: () => onPageChange?.("deliveries") },
          { label: "Delivery History" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Delivery History
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Past Deliveries
        </h1>

        <p className="mt-2 text-lg text-slate-500">
          Pick a day to review completed stops, delivery details, and photos.
        </p>
      </div>

      {hasHistory ? (
        <label
          htmlFor="delivery-history-search"
          className="relative mb-6 block"
        >
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Search past deliveries
          </span>
          <Search
            className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="delivery-history-search"
            type="search"
            autoComplete="off"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search order, customer, or address..."
            className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-base font-bold text-slate-900 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
      ) : null}

      {hasHistory ? (
        <section className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Completed delivery calendar
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                {getCalendarMonthLabel(calendarMonth)}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {displayedMonthCount}{" "}
                {displayedMonthCount === 1 ? "delivery" : "deliveries"} completed this month
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeCalendarMonth(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("all");
                  setSearchValue("");
                }}
                className={`h-11 rounded-xl border px-4 text-sm font-black transition ${
                  selectedDate !== "all"
                    ? "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    : "border-slate-950 bg-slate-950 text-white"
                }`}
              >
                All history
              </button>
              <button
                type="button"
                onClick={() => changeCalendarMonth(1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 px-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (weekday) => (
                    <span
                      key={weekday}
                      className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-400"
                    >
                      {weekday}
                    </span>
                  ),
                )}
              </div>

              <div className="grid grid-cols-7 bg-slate-200/80 gap-px">
                {calendarDays.map((day) => {
                  const dayDeliveries =
                    completedDeliveriesByDate.get(day.dateKey) || [];
                  const isSelected = day.dateKey === selectedDate;

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => chooseCalendarDay(day)}
                      className={`min-h-28 bg-white p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-300 ${
                        isSelected
                          ? "relative z-10 bg-red-50 ring-2 ring-inset ring-[#FC2C38]"
                          : day.isCurrentMonth
                            ? "hover:bg-slate-50"
                            : "bg-slate-50/70 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                            isSelected
                              ? "bg-[#FC2C38] text-white"
                              : day.isCurrentMonth
                                ? "text-slate-800"
                                : "text-slate-300"
                          }`}
                        >
                          {day.date.getDate()}
                        </span>
                        {dayDeliveries.length > 0 ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800">
                            {dayDeliveries.length}
                          </span>
                        ) : null}
                      </span>

                      <span className="mt-2 block space-y-1">
                        {dayDeliveries.slice(0, 2).map((delivery) => (
                          <span
                            key={delivery.id}
                            className="block truncate rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-900"
                          >
                            {delivery.orderNumber || "Delivery"} ·{" "}
                            {formatCustomerName(delivery.customerName)}
                          </span>
                        ))}
                        {dayDeliveries.length > 2 ? (
                          <span className="block px-2 text-[10px] font-black text-slate-500">
                            +{dayDeliveries.length - 2} more
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            ref={resultsRef}
            className="scroll-mt-24 border-t border-slate-200 bg-slate-50 p-4"
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                {hasSearch ? "Searching all history" : "Showing"}
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {hasSearch ? "Matching completed deliveries" : formatDayHeading(selectedDate)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {matchingDeliveries.length}{" "}
                {matchingDeliveries.length === 1 ? "delivery" : "deliveries"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!hasHistory ? (
        <EmptyState
          title="No delivery history yet"
          description="Completed deliveries will appear here."
        />
      ) : null}

      {hasHistory && hasSearch && matchingDeliveries.length === 0 ? (
        <EmptyState
          title="No matching deliveries found"
          description="Try searching with fewer words or just the order number."
        />
      ) : null}

      {photoError ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
          {photoError}
        </div>
      ) : null}

      {hasHistory &&
      !hasSearch &&
      selectedDate &&
      selectedDate !== "all" &&
      matchingDeliveries.length === 0 ? (
        <EmptyState
          title="No completed deliveries on this day"
          description="Choose another highlighted date or select All history."
        />
      ) : null}

      {matchingDeliveries.length > 0 ? (
        <div className="space-y-4">
          {matchingDeliveries.map((delivery) => {
            const items = Array.isArray(delivery.items)
              ? delivery.items
              : [];
            const contactPhone =
              delivery.contactPhone || delivery.phoneNumber || "";
            const deliveryLocationNotes =
              delivery.deliveryLocationNotes ||
              delivery.deliveryNotes ||
              "";
            const generalNotes = delivery.generalNotes || "";
            const deliveryIsOpen = Boolean(
              openDeliveryKeys[delivery.id],
            );
            const scopeSummary = getDeliveryScopeSummary(delivery);
            const deliveryPhotos = getPhotoList(
              delivery,
              "deliveryPhoto",
              "deliveryPhotos",
            );
            const hardwarePhotos = getPhotoList(
              delivery,
              "hardwarePhoto",
              "hardwarePhotos",
            );
            const proofPhotoCount =
              deliveryPhotos.length + hardwarePhotos.length;
            const proofPhotoLimitReached =
              proofPhotoCount >= MAX_DELIVERY_PROOF_PHOTOS;

            return (
              <article
                key={delivery.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleDelivery(delivery.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 text-left transition hover:text-[#FC2C38] lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)_auto] lg:items-start"
                  aria-expanded={deliveryIsOpen}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                      Order {delivery.orderNumber}
                    </p>

                    <h2 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-900">
                      {formatCustomerName(delivery.customerName)}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-slate-500">
                      Delivered {formatCompletedAt(delivery.deliveredAt)}
                    </p>
                  </div>

                  <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 lg:col-span-1">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                      {delivery.driver}
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                      <Truck className="h-4 w-4" aria-hidden="true" />
                      {delivery.unloadType}
                    </span>

                    {delivery.unloadType === "Forklift" &&
                    delivery.forkliftType ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-black text-orange-800">
                        {formatForkliftLabel(delivery.forkliftType)}
                      </span>
                    ) : null}

                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-black ${
                        delivery.deliveryType === "return"
                          ? "bg-blue-50 text-blue-700"
                          : delivery.deliveryType === "hotShot"
                          ? "bg-red-50 text-[#FC2C38]"
                          : delivery.deliveryType === "priority"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {formatDeliveryTypeLabel(delivery.deliveryType)}
                    </span>

                    {delivery.hasHardware ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm font-black text-[#FC2C38]">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Hardware delivered
                      </span>
                    ) : null}

                    {delivery.needsTarp ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700">
                        <CloudRain className="h-4 w-4" aria-hidden="true" />
                        Tarp
                      </span>
                    ) : null}

                    {delivery.driverTargetArrivalTime ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-black text-violet-700">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        Driver there{" "}
                        {formatTimeLabel(delivery.driverTargetArrivalTime)}
                      </span>
                    ) : null}

                  </div>

                    <span className="col-start-2 row-start-1 flex h-9 w-9 items-center justify-center self-start justify-self-end rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm lg:col-start-auto lg:row-start-auto">
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-5 w-5 transition-transform ${
                          deliveryIsOpen ? "rotate-180" : ""
                        }`}
                        strokeWidth={2.6}
                      />
                    </span>
                </button>

                {deliveryIsOpen ? (
                <>
                {onUpdateDeliveredAt || onDeleteDelivery ? (
                  <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        Delivered date and time
                      </p>
                      <p className="mt-1 text-base font-black text-slate-950">
                        {formatCompletedAt(delivery.deliveredAt)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        The internal app code is required to change this record.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {onUpdateDeliveredAt ? (
                        <button
                          type="button"
                          onClick={() => setEditingDeliveryDate(delivery)}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                        >
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          Edit date &amp; time
                        </button>
                      ) : null}

                      {onDeleteDelivery ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCompletedDelivery(delivery)
                          }
                          disabled={Boolean(deletingDeliveryId)}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-[#FC2C38] shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          {deletingDeliveryId === delivery.id
                            ? "Deleting..."
                            : "Delete delivery"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                      <MapPin
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                      />
                      Address
                    </p>

                    <p className="text-sm font-semibold text-slate-600">
                      {delivery.address}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                      <UserRound
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                      />
                      Contact
                    </p>

                    <p className="text-sm font-semibold text-slate-600">
                      {delivery.contactName || "No contact name added"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                      <Phone
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                      />
                      Contact Phone
                    </p>

                    <p className="text-sm font-semibold text-slate-600">
                      {contactPhone || "No contact phone added"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {deliveryLocationNotes ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-black text-slate-900">
                      Delivery Location Notes
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {deliveryLocationNotes}
                    </p>
                  </div>
                ) : null}

                {generalNotes ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black text-slate-900">
                      General Notes
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {generalNotes}
                    </p>
                  </div>
                ) : null}
                </div>

                <div className="mt-5">
                  <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                    <Package className="h-4 w-4" aria-hidden="true" />
                    Delivery Scope
                  </p>

                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-sm font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                      {scopeSummary.label}
                    </p>

                    {scopeSummary.detail ? (
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {scopeSummary.detail}
                      </p>
                    ) : null}
                  </div>

                  {scopeSummary.usesItems ? (
                    <ul className="mt-3 space-y-2">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                        >
                          {item.quantity ? (
                            <span className="mr-2 font-black text-[#FC2C38]">
                              {item.quantity}
                            </span>
                          ) : null}
                          {item.description}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
	                  {onUpdateDelivery ? (
	                    <CompletedPhotoUpload
	                      title={
	                        deliveryPhotos.length > 0
	                          ? "Add more delivery photos"
	                          : "Add delivery photos"
	                      }
	                      detail="Use the camera now or choose one or more photos the driver shares later."
	                      disabled={proofPhotoLimitReached}
	                      isUpdating={
	                        updatingPhotoKey ===
	                        `${delivery.id}:deliveryPhotos`
	                      }
	                      onTakePhoto={(file) =>
	                        handleCompletedDeliveryPhotos(
	                          delivery,
	                          [file],
	                          "deliveryPhoto",
	                          "deliveryPhotos",
	                        )
	                      }
	                      onUploadPhotos={(files) =>
	                        handleCompletedDeliveryPhotos(
	                          delivery,
	                          files,
	                          "deliveryPhoto",
	                          "deliveryPhotos",
	                        )
	                      }
	                    />
	                  ) : null}

	                  {onUpdateDelivery &&
	                  (delivery.hasHardware || hardwarePhotos.length > 0) ? (
	                    <CompletedPhotoUpload
	                      title={
	                        hardwarePhotos.length > 0
	                          ? "Add more hardware photos"
	                          : "Add hardware photos"
	                      }
	                      detail={`Attach proof of the hardware that went with this completed delivery. ${proofPhotoCount} of ${MAX_DELIVERY_PROOF_PHOTOS} total photos saved.`}
	                      isHardware
	                      disabled={proofPhotoLimitReached}
	                      isUpdating={
	                        updatingPhotoKey ===
	                        `${delivery.id}:hardwarePhotos`
	                      }
	                      onTakePhoto={(file) =>
	                        handleCompletedDeliveryPhotos(
	                          delivery,
	                          [file],
	                          "hardwarePhoto",
	                          "hardwarePhotos",
	                        )
	                      }
	                      onUploadPhotos={(files) =>
	                        handleCompletedDeliveryPhotos(
	                          delivery,
	                          files,
	                          "hardwarePhoto",
	                          "hardwarePhotos",
	                        )
	                      }
	                    />
	                  ) : null}

	                  <PhotoPreviewGrid
	                    photos={deliveryPhotos}
	                    label="delivery photo"
	                    onView={setViewingPhoto}
	                    deliveryId={delivery.id}
	                    photoField="deliveryPhoto"
	                    photosField="deliveryPhotos"
	                  />

	                  <PhotoPreviewGrid
	                    photos={hardwarePhotos}
	                    label="hardware photo"
	                    isHardware
	                    onView={setViewingPhoto}
	                    deliveryId={delivery.id}
	                    photoField="hardwarePhoto"
	                    photosField="hardwarePhotos"
	                  />
                </div>
                </>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
      {viewingPhoto?.dataUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={viewingPhoto.label || "Delivery photo"}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="truncate text-sm font-black uppercase tracking-[0.12em] text-slate-700">
                {viewingPhoto.label || "Delivery Photo"}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-[#FC2C38] shadow-sm transition hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setViewingPhoto(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
                  aria-label="Close photo"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-950 p-3">
              <img
                src={viewingPhoto.dataUrl}
                alt={viewingPhoto.label || "Delivery photo"}
                className="max-h-[78vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}

      <MarkDeliveredModal
        delivery={editingDeliveryDate}
        initialDeliveredAt={editingDeliveryDate?.deliveredAt || ""}
        eyebrow="Completed delivery"
        title="Change delivered date & time"
        helperText="Save the corrected completion time. You will be asked for the internal app code before the record changes."
        submitLabel="Save Delivered Time"
        isSaving={updatingDeliveredAt}
        onClose={() => {
          if (!updatingDeliveredAt) {
            setEditingDeliveryDate(null);
          }
        }}
        onConfirm={handleUpdateDeliveredAt}
      />
    </PageContainer>
  );
}
