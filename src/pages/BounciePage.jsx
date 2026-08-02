import {
  Car,
  CheckCircle2,
  ExternalLink,
  Hash,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";
import {
  saveBouncieVehicleSetting,
  subscribeToBouncieVehicleSettings,
} from "../utils/bouncieVehicleStorage";
import {
  getFirstVehicleValue,
  getVehicleDetail,
  getVehicleKey,
  getVehicleName,
  getVehicleYearMakeModel,
  getUniqueVehicleBadgeTexts,
} from "../utils/bouncieVehicleFormatters";

async function readApiJson(response, routeName) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const responseText = await response.text();

  throw new Error(
    `${routeName} returned ${response.status} instead of JSON. ${
      responseText ? responseText.slice(0, 120) : ""
    }`,
  );
}

export default function BounciePage() {
  const [status, setStatus] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleSettings, setVehicleSettings] = useState([]);
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [savingVehicleId, setSavingVehicleId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const vehicleSettingsById = vehicleSettings.reduce(
    (settingsById, setting) => ({
      ...settingsById,
      [setting.id]: setting,
    }),
    {},
  );
  const vehicleTitles = vehicles.map((vehicle, index) => {
    const vehicleId = getVehicleKey(vehicle, index);
    const savedSetting = vehicleSettingsById[vehicleId];
    const bouncieVehicleName = getVehicleName(vehicle);

    return savedSetting?.title || bouncieVehicleName;
  });
  const vehicleBadges = getUniqueVehicleBadgeTexts(vehicleTitles);

  async function loadBouncie() {
    setIsLoading(true);
    setError("");

    try {
      const statusResponse = await fetch("/api/bouncie/status");
      const statusData = await readApiJson(
        statusResponse,
        "Bouncie status route",
      );
      setStatus(statusData);

      if (!statusResponse.ok || !statusData.connected) {
        setError(statusData.error || "Bouncie is not connected yet.");
        setVehicles([]);
        return;
      }

      const vehiclesResponse = await fetch("/api/bouncie/vehicles");
      const vehiclesData = await readApiJson(
        vehiclesResponse,
        "Bouncie vehicles route",
      );

      if (!vehiclesResponse.ok) {
        setError(vehiclesData.error || "Unable to load Bouncie vehicles.");
        setVehicles([]);
        return;
      }

      setVehicles(Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : []);
    } catch (loadError) {
      console.error("Unable to load Bouncie:", loadError);
      setError(
        loadError.message ||
          "Unable to reach the Bouncie API route.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBouncie();
  }, []);

  useEffect(
    () =>
      subscribeToBouncieVehicleSettings(
        setVehicleSettings,
        (settingsError) => {
          console.error("Unable to sync Bouncie vehicle settings:", settingsError);
          setError(
            "Unable to sync vehicle titles. Publish Firestore rules for Bouncie vehicle settings.",
          );
        },
      ),
    [],
  );

  function startEditingVehicle(vehicle, vehicleId, currentTitle) {
    setEditingVehicleId(vehicleId);
    setEditingTitle(currentTitle || getVehicleName(vehicle));
  }

  function cancelEditingVehicle() {
    setEditingVehicleId("");
    setEditingTitle("");
  }

  async function handleSaveVehicleTitle(vehicle, vehicleId) {
    const title = editingTitle.trim();

    if (!title) {
      return;
    }

    setSavingVehicleId(vehicleId);

    try {
      const updatedSettings = await saveBouncieVehicleSetting({
        id: vehicleId,
        title,
        bouncieName: getVehicleName(vehicle),
        yearMakeModel: getVehicleYearMakeModel(vehicle),
        vin: getFirstVehicleValue(vehicle, ["vin", "vehicle.vin"]),
        imei: getFirstVehicleValue(vehicle, ["imei", "device.imei"]),
      });

      setVehicleSettings(updatedSettings);
      cancelEditingVehicle();
    } catch (saveError) {
      console.error("Unable to save vehicle title:", saveError);
      setError(
        "Unable to save vehicle title. Publish Firestore rules for Bouncie vehicle settings.",
      );
    } finally {
      setSavingVehicleId("");
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Admin
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Vehicles
        </h1>

        <p className="mt-2 max-w-3xl text-lg text-slate-500">
          View fleet vehicles from Bouncie inside Capital Dispatch.
        </p>
      </div>

      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Connection
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900">
                {status?.connected ? "Bouncie Connected" : "Connect Bouncie"}
              </h2>
              {status?.connected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                  <CheckCircle2
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    strokeWidth={2.6}
                  />
                  Live
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
              {status?.connected
                ? status?.hasRefreshToken
                  ? "Fleet data is loading from Bouncie. Refresh token is saved for reconnection."
                  : "Fleet data is loading from Bouncie, but this access token may expire. Reconnect and save both token values."
                : "Authorize Bouncie, then save the returned access and refresh tokens in Vercel."}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/api/bouncie/auth/start"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
            >
              <ExternalLink
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.5}
              />
              Connect Bouncie
            </a>
            <button
              type="button"
              onClick={loadBouncie}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                strokeWidth={2.5}
              />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {error}
          </div>
        ) : null}

        {status?.needsAccessToken ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            After Bouncie redirects back, add the shown access token as{" "}
            <span className="font-black text-slate-900">
              BOUNCIE_ACCESS_TOKEN
            </span>
            {" "}and the refresh token as{" "}
            <span className="font-black text-slate-900">
              BOUNCIE_REFRESH_TOKEN
            </span>
            , then redeploy.
          </div>
        ) : status?.connected && !status?.hasRefreshToken ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            BOUNCIE_REFRESH_TOKEN is missing. Reconnect Bouncie and save both
            returned token values in Vercel so the next token refresh is easier.
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Vehicles
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {vehicles.length} {vehicles.length === 1 ? "Vehicle" : "Vehicles"}
            </h2>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {vehicles.length > 0 ? (
            vehicles.map((vehicle, index) => {
              const vehicleId = getVehicleKey(vehicle, index);
              const savedSetting = vehicleSettingsById[vehicleId];
              const bouncieVehicleName = getVehicleName(vehicle);
              const vehicleName = vehicleTitles[index];
              const yearMakeModel = getVehicleYearMakeModel(vehicle);
              const vehicleDetail = getVehicleDetail(vehicle);
              const isEditingVehicle = editingVehicleId === vehicleId;
              const isSavingVehicle = savingVehicleId === vehicleId;

              return (
                <div
                  key={vehicleId}
                  className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0F2] text-lg font-black text-[#FC2C38]">
                      {vehicleBadges[index]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          {isEditingVehicle ? (
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(event) =>
                                  setEditingTitle(event.target.value)
                                }
                                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                                placeholder="Truck 12"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSaveVehicleTitle(vehicle, vehicleId)
                                  }
                                  disabled={isSavingVehicle || !editingTitle.trim()}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                  <Save
                                    aria-hidden="true"
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                  />
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingVehicle}
                                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                                  aria-label="Cancel title edit"
                                >
                                  <X
                                    aria-hidden="true"
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                  />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex min-w-0 items-start gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xl font-black text-slate-950">
                                  {vehicleName}
                                </p>
                                {savedSetting?.title ? (
                                  <p className="mt-0.5 truncate text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                                    Bouncie: {bouncieVehicleName}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  startEditingVehicle(
                                    vehicle,
                                    vehicleId,
                                    savedSetting?.title,
                                  )
                                }
                                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#FC2C38] hover:text-[#FC2C38]"
                                aria-label={`Edit ${vehicleName} title`}
                              >
                                <Pencil
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                  strokeWidth={2.4}
                                />
                              </button>
                            </div>
                          )}
                          <p className="mt-1 text-base font-extrabold text-slate-700">
                            {yearMakeModel || "Year make model unavailable"}
                          </p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                          <ShieldCheck
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            strokeWidth={2.5}
                          />
                          Active
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            <Hash
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                              strokeWidth={2.4}
                            />
                            IDs
                          </p>
                          <p className="mt-1 break-words text-sm font-bold text-slate-700">
                            {vehicleDetail || "No VIN, IMEI, or plate listed"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            <Car
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                              strokeWidth={2.4}
                            />
                            Source
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-700">
                            Bouncie vehicle profile
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center xl:col-span-2">
              <Car
                aria-hidden="true"
                className="mx-auto h-10 w-10 text-slate-400"
                strokeWidth={2.2}
              />
              <p className="mt-3 text-base font-black text-slate-900">
                No vehicles loaded yet
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Connect Bouncie and refresh this page.
              </p>
            </div>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
