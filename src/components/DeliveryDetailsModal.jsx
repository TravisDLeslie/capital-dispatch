import {
  Camera,
  Clock3,
  ExternalLink,
  FileText,
  MapPin,
  Package,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { formatCustomerName } from "../utils/textFormatters";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "object" && Number.isFinite(value?.seconds)) {
    return new Date(value.seconds * 1000);
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = toDate(value);

  if (!date) return "Completion time not recorded";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getPhotos(delivery, singularField, pluralField) {
  const photos = Array.isArray(delivery?.[pluralField])
    ? delivery[pluralField].filter((photo) => photo?.dataUrl || photo?.url)
    : [];
  const legacyPhoto = delivery?.[singularField];
  const legacyUrl = legacyPhoto?.dataUrl || legacyPhoto?.url;

  if (!legacyUrl) return photos;
  if (photos.some((photo) => (photo?.dataUrl || photo?.url) === legacyUrl)) {
    return photos;
  }

  return [legacyPhoto, ...photos];
}

function DetailCard({ icon: Icon, label, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#FC2C38]" />
        {label}
      </p>
      <div className="mt-2 text-sm font-bold text-slate-800">{children}</div>
    </div>
  );
}

export default function DeliveryDetailsModal({ delivery, onClose }) {
  if (!delivery) return null;

  const deliveryPhotos = getPhotos(delivery, "deliveryPhoto", "deliveryPhotos");
  const hardwarePhotos = getPhotos(delivery, "hardwarePhoto", "hardwarePhotos");
  const items = Array.isArray(delivery.items) ? delivery.items : [];
  const documents = Array.isArray(delivery.deliveryOrderDocuments)
    ? delivery.deliveryOrderDocuments.filter((document) => document?.url)
    : [];
  const deliveredAt =
    delivery.deliveredAt || delivery.completedAt || delivery.updatedAt;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-details-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Delivered · {formatDateTime(deliveredAt)}
            </p>
            <h2 id="delivery-details-title" className="mt-1 truncate text-2xl font-black text-slate-950 sm:text-3xl">
              Order {delivery.orderNumber || "—"}
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {formatCustomerName(delivery.customerName) || "Customer not listed"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-400 hover:text-slate-950"
            aria-label="Close delivery details"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </header>

        <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailCard icon={Clock3} label="Delivered">
              {formatDateTime(deliveredAt)}
            </DetailCard>
            <DetailCard icon={UserRound} label="Driver">
              {delivery.driver || "Not recorded"}
            </DetailCard>
            <DetailCard icon={Truck} label="Unload">
              {[delivery.unloadType, delivery.forkliftType].filter(Boolean).join(" · ") || "Not recorded"}
            </DetailCard>
            <DetailCard icon={MapPin} label="Destination">
              {delivery.address || "No address recorded"}
            </DetailCard>
          </div>

          {items.length > 0 ? (
            <section className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
                <Package aria-hidden="true" className="h-4 w-4 text-[#FC2C38]" />
                Delivered items
              </h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {items.map((item, index) => (
                  <div key={item.id || `${item.description}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                    {item.quantity ? <span className="mr-2 font-black text-[#FC2C38]">Qty {item.quantity}</span> : null}
                    {item.description || "Delivery item"}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {deliveryPhotos.length > 0 || hardwarePhotos.length > 0 ? (
            <section className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
                <Camera aria-hidden="true" className="h-4 w-4 text-[#FC2C38]" />
                Delivery photos
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...deliveryPhotos, ...hardwarePhotos].map((photo, index) => {
                  const photoUrl = photo?.dataUrl || photo?.url;
                  return (
                    <a key={`${photoUrl}-${index}`} href={photoUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <img src={photoUrl} alt={`Delivery proof ${index + 1}`} className="h-52 w-full bg-slate-100 object-contain transition group-hover:scale-[1.02]" />
                      <span className="flex items-center justify-between px-3 py-2 text-xs font-black text-slate-700">
                        View photo {index + 1}
                        <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}

          {documents.length > 0 ? (
            <section className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
                <FileText aria-hidden="true" className="h-4 w-4 text-[#FC2C38]" />
                Delivery Order Copy
              </h3>
              <div className="mt-3 space-y-2">
                {documents.map((document, index) => (
                  <a key={document.id || document.path || document.url} href={document.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-300 hover:bg-blue-50">
                    <span className="truncate">{document.name || `Delivery Order Copy ${index + 1}`}</span>
                    <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600" />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {deliveryPhotos.length === 0 && hardwarePhotos.length === 0 && documents.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <p className="font-black text-slate-800">No delivery photos or documents were saved.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
