import { useEffect, useState } from "react";
import { Save, Timer, Truck } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { deliveryUnloadTypes } from "../data/options";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";

export default function DeliverySettingsPage({
  deliverySettings,
  onSaveDeliverySettings,
  onPageChange,
}) {
  const [draftDurations, setDraftDurations] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraftDurations(deliverySettings?.unloadDurations || {});
  }, [deliverySettings]);

  async function handleSubmit(event) {
    event.preventDefault();

    const unloadDurations = deliveryUnloadTypes.reduce(
      (durations, unloadType) => ({
        ...durations,
        [unloadType]: Math.max(
          5,
          Number(draftDurations[unloadType]) || 30,
        ),
      }),
      {},
    );

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      await onSaveDeliverySettings({
        ...deliverySettings,
        unloadDurations,
      });
      setMessage("Delivery time defaults saved.");
    } catch (saveError) {
      console.error("Unable to save delivery settings:", saveError);
      setError(getFirebaseErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Admin", onClick: () => onPageChange?.("admin") },
          { label: "Delivery Settings" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Admin
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Delivery Settings
        </h1>

        <p className="mt-2 max-w-3xl text-base font-semibold text-slate-500 sm:text-lg">
          Set the default unloading time by delivery type. New deliveries will
          auto-calculate their calendar block from these numbers.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
            <Timer className="h-6 w-6" aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900">
              Default Time Blocks
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              Adjust these as the real world teaches us.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {deliveryUnloadTypes.map((unloadType) => (
            <label
              key={unloadType}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <span className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                <Truck className="h-4 w-4 text-[#FC2C38]" aria-hidden="true" />
                {unloadType}
              </span>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="5"
                  max="240"
                  step="5"
                  value={draftDurations[unloadType] || ""}
                  onChange={(event) => {
                    setDraftDurations((currentDurations) => ({
                      ...currentDurations,
                      [unloadType]: event.target.value,
                    }));
                    setMessage("");
                    setError("");
                  }}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                />

                <span className="shrink-0 text-sm font-black text-slate-500">
                  min
                </span>
              </div>
            </label>
          ))}
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSaving}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Saving..." : "Save Defaults"}
        </button>
      </form>
    </PageContainer>
  );
}
