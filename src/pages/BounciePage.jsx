import {
  Car,
  CheckCircle2,
  ExternalLink,
  Hash,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";

function formatVehicleValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (["string", "number", "boolean"].includes(typeof value)) {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(formatVehicleValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    for (const key of [
      "name",
      "displayName",
      "label",
      "value",
      "text",
      "description",
      "number",
    ]) {
      const formattedValue = formatVehicleValue(value[key]);

      if (formattedValue) {
        return formattedValue;
      }
    }
  }

  return "";
}

function getFirstValue(vehicle, paths) {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce(
        (currentValue, key) =>
          currentValue && currentValue[key] !== undefined
            ? currentValue[key]
            : undefined,
        vehicle,
      );
    const formattedValue = formatVehicleValue(value);

    if (formattedValue) {
      return formattedValue;
    }
  }

  return "";
}

function getVehicleYearMakeModel(vehicle) {
  return [
    getFirstValue(vehicle, [
      "year",
      "modelYear",
      "vehicleYear",
      "standardYear",
      "vehicle.year",
      "vehicle.modelYear",
      "details.year",
      "specs.year",
      "info.year",
    ]),
    getFirstValue(vehicle, [
      "make",
      "vehicleMake",
      "standardMake",
      "vehicle.make",
      "details.make",
      "specs.make",
      "info.make",
    ]),
    getFirstValue(vehicle, [
      "model",
      "vehicleModel",
      "standardModel",
      "vehicle.model",
      "details.model",
      "specs.model",
      "info.model",
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function getVehicleName(vehicle) {
  return (
    getFirstValue(vehicle, ["nickname", "name", "displayName", "label"]) ||
    getVehicleYearMakeModel(vehicle) ||
    getFirstValue(vehicle, ["vin", "vehicle.vin"]) ||
    "Bouncie Vehicle"
  );
}

function getVehicleDetail(vehicle) {
  const vin = getFirstValue(vehicle, ["vin", "vehicle.vin"]);
  const imei = getFirstValue(vehicle, ["imei", "device.imei"]);
  const plate = getFirstValue(vehicle, [
    "licensePlate",
    "plate",
    "vehicle.licensePlate",
    "vehicle.plate",
  ]);

  return [
    vin ? `VIN ${vin}` : "",
    imei ? `IMEI ${imei}` : "",
    plate ? `Plate ${plate}` : "",
  ]
    .filter(Boolean)
    .join(" • ");
}

function getVehicleInitial(vehicle) {
  return getVehicleName(vehicle).slice(0, 1).toUpperCase();
}

export default function BounciePage() {
  const [status, setStatus] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadBouncie() {
    setIsLoading(true);
    setError("");

    try {
      const statusResponse = await fetch("/api/bouncie/status");
      const statusData = await statusResponse.json();
      setStatus(statusData);

      if (!statusResponse.ok || !statusData.connected) {
        setError(statusData.error || "Bouncie is not connected yet.");
        setVehicles([]);
        return;
      }

      const vehiclesResponse = await fetch("/api/bouncie/vehicles");
      const vehiclesData = await vehiclesResponse.json();

      if (!vehiclesResponse.ok) {
        setError(vehiclesData.error || "Unable to load Bouncie vehicles.");
        setVehicles([]);
        return;
      }

      setVehicles(Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : []);
    } catch (loadError) {
      console.error("Unable to load Bouncie:", loadError);
      setError("Unable to reach the Bouncie API route.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBouncie();
  }, []);

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
                ? "Fleet data is loading from Bouncie."
                : "Authorize Bouncie, then save the returned access token in Vercel."}
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
            After Bouncie redirects back, add the shown access token to Vercel as{" "}
            <span className="font-black text-slate-900">
              BOUNCIE_ACCESS_TOKEN
            </span>
            , then redeploy.
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
              const vehicleName = getVehicleName(vehicle);
              const yearMakeModel = getVehicleYearMakeModel(vehicle);
              const vehicleDetail = getVehicleDetail(vehicle);

              return (
                <div
                  key={vehicle?.id || vehicle?.vin || vehicle?.imei || index}
                  className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0F2] text-lg font-black text-[#FC2C38]">
                      {getVehicleInitial(vehicle)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-xl font-black text-slate-950">
                            {vehicleName}
                          </p>
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
