import { useMemo, useState } from "react";
import {
  Camera,
  ChevronDown,
  MapPin,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";

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

function PhotoPreview({ photo, label, isHardware = false }) {
  if (!photo?.dataUrl) {
    return null;
  }

  return (
    <a
      href={photo.dataUrl}
      target="_blank"
      rel="noreferrer"
      className={`block overflow-hidden rounded-2xl border bg-white transition ${
        isHardware
          ? "border-red-200 hover:bg-red-50"
          : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <img
        src={photo.dataUrl}
        alt={label}
        className="h-40 w-full object-cover"
      />

      <span
        className={`flex items-center gap-2 px-3 py-2 text-sm font-black ${
          isHardware ? "text-[#FC2C38]" : "text-slate-700"
        }`}
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        View {label}
      </span>
    </a>
  );
}

export default function DeliveryHistoryPage({ deliveries, onPageChange }) {
  const [searchValue, setSearchValue] = useState("");
  const [openDeliveryKeys, setOpenDeliveryKeys] = useState({});

  const completedDeliveries = useMemo(
    () =>
      deliveries
        .filter((delivery) => delivery.status === "complete")
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

      return orderMatches || customerMatches || addressMatches;
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

            return (
              <article
                key={delivery.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleDelivery(delivery.id)}
                  className="flex w-full flex-col gap-4 text-left transition hover:text-[#FC2C38] lg:flex-row lg:items-start lg:justify-between"
                  aria-expanded={deliveryIsOpen}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                      Order {delivery.orderNumber}
                    </p>

                    <h2 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-900">
                      {delivery.customerName}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-slate-500">
                      Delivered {formatCompletedAt(delivery.deliveredAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                      {delivery.driver}
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                      <Truck className="h-4 w-4" aria-hidden="true" />
                      {delivery.unloadType}
                    </span>

                    {delivery.hasHardware ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm font-black text-[#FC2C38]">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Hardware delivered
                      </span>
                    ) : null}

                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-5 w-5 transition-transform ${
                          deliveryIsOpen ? "rotate-180" : ""
                        }`}
                        strokeWidth={2.6}
                      />
                    </span>
                  </div>
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
                    Items
                  </p>

                  <ul className="space-y-2">
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
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <PhotoPreview
                    photo={delivery.deliveryPhoto}
                    label="delivery photo"
                  />

                  <PhotoPreview
                    photo={delivery.hardwarePhoto}
                    label="hardware photo"
                    isHardware
                  />
                </div>
                </>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </PageContainer>
  );
}
