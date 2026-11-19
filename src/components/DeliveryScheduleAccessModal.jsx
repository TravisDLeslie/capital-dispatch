import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, LockKeyhole, X } from "lucide-react";

const DELIVERY_SCHEDULE_PASSWORD = "DSP1905";

export default function DeliveryScheduleAccessModal({
  isOpen = false,
  onClose,
  onUnlock,
  eyebrow = "Changes protected",
  title = "Unlock delivery scheduling",
  description =
    "Viewing remains available. Enter the password to assign, edit, move, group, ungroup, or remove deliveries.",
  submitLabel = "Unlock changes",
  errorMessage = "Incorrect delivery scheduling password. Try again.",
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    setPassword("");
    setError("");
    setShowPassword(false);
    document.body.style.overflow = "hidden";

    function handleEscape(event) {
      if (event.key === "Escape") {
        onCloseRef.current?.();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (password === DELIVERY_SCHEDULE_PASSWORD) {
      setError("");
      onUnlock?.();
      return;
    }

    setError(errorMessage);
    setPassword("");
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-schedule-access-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            aria-label="Close password prompt"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
          {eyebrow}
        </p>
        <h2
          id="delivery-schedule-access-title"
          className="mt-1 text-2xl font-black tracking-tight text-slate-950"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="mt-5">
          <label
            htmlFor="delivery-schedule-password"
            className="text-xs font-black uppercase tracking-[0.14em] text-slate-600"
          >
            Scheduling password
          </label>
          <div className="relative mt-2">
            <input
              id="delivery-schedule-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              autoComplete="current-password"
              autoFocus
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 pr-14 text-lg font-bold text-slate-950 outline-none transition focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "delivery-schedule-access-error" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((currentValue) => !currentValue)}
              className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-slate-500 transition hover:text-slate-950"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>

          {error ? (
            <p
              id="delivery-schedule-access-error"
              className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-5 w-full rounded-2xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-md transition hover:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-200"
          >
            {submitLabel}
          </button>
        </form>
      </section>
    </div>,
    document.body,
  );
}
