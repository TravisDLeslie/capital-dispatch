import { useMemo, useState } from "react";
import {
  Camera,
  MapPin,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
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

export default function DeliveryHistoryPage({ deliveries }) {
  const [searchValue, setSearchValue] = useState("");

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

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Deliveries
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          History
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

            return (
              <article
                key={delivery.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                      Order {delivery.orderNumber}
                    </p>

                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                      {delivery.customerName}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-slate-500">
                      Delivered {formatCompletedAt(delivery.deliveredAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
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
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
                      <Phone
                        className="h-4 w-4 text-[#FC2C38]"
                        aria-hidden="true"
                      />
                      Phone
                    </p>

                    <p className="text-sm font-semibold text-slate-600">
                      {delivery.phoneNumber || "No phone added"}
                    </p>
                  </div>
                </div>

                {delivery.deliveryNotes ? (
                  <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-black text-slate-900">
                      Notes
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {delivery.deliveryNotes}
                    </p>
                  </div>
                ) : null}

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
              </article>
            );
          })}
        </div>
      ) : null}
    </PageContainer>
  );
}
