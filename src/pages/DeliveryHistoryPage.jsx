import { useMemo, useState } from "react";
import {
  Camera,
  ChevronDown,
  Clock,
  CloudRain,
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
import PageContainer from "../components/PageContainer";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import { formatCustomerName } from "../utils/textFormatters";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeNumber(value) {
  return String(value || "").replace(/\D/g, "");
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
  }).format(new Date(value));
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
  isSuperAdmin = false,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [openDeliveryKeys, setOpenDeliveryKeys] = useState({});
  const [viewingPhoto, setViewingPhoto] = useState(null);

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

  const matchingDeliveries = useMemo(() => {
    const textSearch = normalizeText(searchValue);
    const numberSearch = normalizeNumber(searchValue);

    if (!textSearch) {
      return completedDeliveries;
    }

    return completedDeliveries.filter((delivery) => {
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
  }, [completedDeliveries, searchValue]);

  const hasHistory = completedDeliveries.length > 0;
  const hasSearch = searchValue.trim().length > 0;

  function toggleDelivery(deliveryId) {
    setOpenDeliveryKeys((currentOpenDeliveryKeys) => ({
      ...currentOpenDeliveryKeys,
      [deliveryId]: !currentOpenDeliveryKeys[deliveryId],
    }));
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
          Search completed deliveries by order number, customer name,
          or address.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="delivery-history-search"
          className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search
        </label>

        <input
          id="delivery-history-search"
          type="search"
          autoComplete="off"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search order #, customer, or address..."
          className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-bold text-slate-900 outline-none transition placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        />

        <p className="mt-3 text-sm font-semibold text-slate-500">
          {matchingDeliveries.length}{" "}
          {matchingDeliveries.length === 1 ? "delivery" : "deliveries"}{" "}
          found
        </p>
      </div>

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
    </PageContainer>
  );
}
