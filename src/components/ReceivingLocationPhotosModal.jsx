import { Images, MapPin, X } from "lucide-react";

/**
 * @param {{
 *   poNumber?: string;
 *   locationLabel?: string;
 *   photos?: Array<{
 *     id?: string;
 *     dataUrl: string;
 *     title?: string;
 *     subtitle?: string;
 *   }>;
 *   onClose?: () => void;
 * }} props
 */
export default function ReceivingLocationPhotosModal({
  poNumber,
  locationLabel,
  photos = [],
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receiving-location-photos-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              <MapPin aria-hidden="true" className="h-4 w-4" />
              Receiving Location
            </p>
            <h3
              id="receiving-location-photos-title"
              className="mt-1 text-2xl font-black text-slate-950"
            >
              {locationLabel || "Location photo"}
            </h3>
            <p className="mt-1 text-sm font-bold text-slate-500">
              PO {poNumber || "—"} · {photos.length} saved {photos.length === 1 ? "photo" : "photos"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-400 hover:text-slate-950"
            aria-label="Close receiving photos"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="max-h-[74vh] overflow-auto bg-slate-50 p-4">
          {photos.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {photos.map((photo) => (
                <figure
                  key={photo.id || photo.dataUrl}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <img
                    src={photo.dataUrl}
                    alt={`${photo.title || "Receiving location"} for PO ${poNumber}`}
                    className="max-h-[560px] w-full bg-slate-950 object-contain"
                  />
                  <figcaption className="border-t border-slate-200 px-4 py-3">
                    <p className="text-sm font-black text-slate-950">
                      {photo.title || locationLabel || "Receiving location"}
                    </p>
                    {photo.subtitle ? (
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        {photo.subtitle}
                      </p>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Images aria-hidden="true" className="h-7 w-7" />
              </span>
              <p className="mt-4 text-lg font-black text-slate-950">
                No location photo was saved
              </p>
              <p className="mt-1 max-w-md text-sm font-semibold text-slate-500">
                This PO was received at {locationLabel || "this location"}, but its check-in does not include a location photo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
