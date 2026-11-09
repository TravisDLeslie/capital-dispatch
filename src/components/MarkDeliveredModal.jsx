import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, X } from "lucide-react";
import { formatCustomerName } from "../utils/textFormatters";

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function getLocalDateValue(date = new Date()) {
  return [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
  ].join("-");
}

function getLocalTimeValue(date = new Date()) {
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

export default function MarkDeliveredModal({
  delivery,
  isSaving = false,
  initialDeliveredAt = "",
  eyebrow = "Manual completion",
  title = "When was it delivered?",
  helperText =
    "This timestamp is used in Delivery History. Photos can still be added later when the driver returns.",
  submitLabel = "Confirm Delivered",
  onClose,
  onConfirm,
}) {
  const [deliveredDate, setDeliveredDate] = useState(() =>
    getLocalDateValue(),
  );
  const [deliveredTime, setDeliveredTime] = useState(() =>
    getLocalTimeValue(),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!delivery) {
      return;
    }

    const initialDate = initialDeliveredAt
      ? new Date(initialDeliveredAt)
      : new Date();
    const safeInitialDate = Number.isNaN(initialDate.getTime())
      ? new Date()
      : initialDate;
    setDeliveredDate(getLocalDateValue(safeInitialDate));
    setDeliveredTime(getLocalTimeValue(safeInitialDate));
    setError("");
  }, [delivery, initialDeliveredAt]);

  useEffect(() => {
    if (!delivery) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSaving) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [delivery, isSaving, onClose]);

  if (!delivery) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!deliveredDate || !deliveredTime) {
      setError("Choose the delivered date and time.");
      return;
    }

    const deliveredAtDate = new Date(
      `${deliveredDate}T${deliveredTime}:00`,
    );

    if (Number.isNaN(deliveredAtDate.getTime())) {
      setError("Choose a valid delivered date and time.");
      return;
    }

    if (deliveredAtDate.getTime() > Date.now() + 60000) {
      setError("Delivered time cannot be in the future.");
      return;
    }

    await onConfirm?.(deliveredAtDate.toISOString());
  }

  const customerName = formatCustomerName(delivery.customerName);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-delivered-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                {eyebrow}
              </p>
              <h2
                id="mark-delivered-title"
                className="mt-1 text-2xl font-black tracking-tight text-slate-950"
              >
                {title}
              </h2>
              <p className="mt-1 truncate text-sm font-bold text-slate-500">
                Order {delivery.orderNumber || "not listed"}
                {customerName ? ` · ${customerName}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={isSaving}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
            aria-label="Close delivered date and time"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {helperText ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
              {helperText}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Delivered date
              </span>
              <input
                type="date"
                value={deliveredDate}
                max={getLocalDateValue()}
                onChange={(event) => setDeliveredDate(event.target.value)}
                disabled={isSaving}
                required
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-slate-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Delivered time
              </span>
              <input
                type="time"
                value={deliveredTime}
                onChange={(event) => setDeliveredTime(event.target.value)}
                disabled={isSaving}
                required
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-slate-100"
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={isSaving}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {isSaving ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
