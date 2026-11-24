import { Clock3, RefreshCw, Route, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CAPITAL_LUMBER_ADDRESS,
  getDeliveryShippingRate,
} from "../utils/deliveryPricing";

const routeEstimateCache = new Map();

function normalizeAddress(value) {
  return String(value || "").trim();
}

export default function DeliveryPriceEstimate({
  address,
  className = "",
  compact = false,
  enabled = true,
}) {
  const destination = normalizeAddress(address);
  const [retryCount, setRetryCount] = useState(0);
  const [estimate, setEstimate] = useState(() =>
    routeEstimateCache.get(destination) || null,
  );
  const [status, setStatus] = useState(
    routeEstimateCache.has(destination) ? "success" : "idle",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || destination.length < 8) {
      setEstimate(null);
      setStatus("idle");
      setError("");
      return undefined;
    }

    const cachedEstimate = routeEstimateCache.get(destination);

    if (cachedEstimate && retryCount === 0) {
      setEstimate(cachedEstimate);
      setStatus("success");
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    setEstimate(null);
    setStatus("loading");
    setError("");
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          origin: CAPITAL_LUMBER_ADDRESS,
          destination,
        });
        const response = await fetch(`/api/maps/route?${params.toString()}`, {
          signal: controller.signal,
        });
        const routeData = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            routeData?.error || "Delivery pricing is unavailable for this address.",
          );
        }

        routeEstimateCache.set(destination, routeData);
        setEstimate(routeData);
        setStatus("success");
      } catch (routeError) {
        if (routeError?.name === "AbortError") return;
        setEstimate(null);
        setStatus("error");
        setError(
          routeError?.message || "Delivery pricing is unavailable for this address.",
        );
      }
    }, 650);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [destination, enabled, retryCount]);

  const rate = useMemo(
    () => getDeliveryShippingRate(estimate?.distanceMeters),
    [estimate?.distanceMeters],
  );

  if (!enabled || destination.length < 8) {
    return null;
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className={`mt-3 flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
        Calculating delivery distance and price…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`mt-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}>
        <p className="text-xs font-bold leading-5 text-amber-800">{error}</p>
        <button
          type="button"
          onClick={() => setRetryCount((current) => current + 1)}
          className="shrink-0 rounded-lg bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-amber-800 shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!rate) {
    return null;
  }

  return (
    <div className={`mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
            <Route className="h-3.5 w-3.5" aria-hidden="true" />
            Estimated delivery pricing
          </p>
          <p className="mt-1 text-xs font-bold text-slate-600">
            {estimate?.distanceText || "Route ready"}
            {estimate?.durationText ? ` · ${estimate.durationText} one way` : ""}
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-800 shadow-sm">
          {rate.label}
        </span>
      </div>

      {rate.normal || rate.forklift ? (
        <div className={`mt-3 grid gap-2 ${rate.normal ? "grid-cols-2" : "grid-cols-1"}`}>
          {rate.normal ? (
            <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                Standard delivery
              </p>
              <p className={`${compact ? "text-xl" : "text-2xl"} mt-0.5 font-black text-slate-950`}>
                {rate.normal}
              </p>
            </div>
          ) : null}
          <div className="rounded-xl bg-blue-100 px-3 py-2.5">
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-blue-700">
              <Truck className="h-3 w-3" aria-hidden="true" />
              {rate.forkliftLabel || "Forklift delivery"}
            </p>
            <p className={`${compact ? "text-xl" : "text-2xl"} mt-0.5 font-black text-blue-950`}>
              {rate.forklift}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm font-black text-slate-800 shadow-sm">
          Call 208-343-5481 for a delivery price to this address.
        </p>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[10px] font-bold leading-4 text-emerald-800/80">
        <Clock3 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        Estimate based on the current route from Capital Lumber. Final delivery charge is confirmed with your quote.
      </p>
    </div>
  );
}
