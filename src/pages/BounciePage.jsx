import { Car, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";

function getVehicleName(vehicle) {
  return (
    vehicle?.nickname ||
    vehicle?.name ||
    [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") ||
    vehicle?.vin ||
    "Bouncie Vehicle"
  );
}

function getVehicleDetail(vehicle) {
  return [
    vehicle?.vin ? `VIN ${vehicle.vin}` : "",
    vehicle?.imei ? `IMEI ${vehicle.imei}` : "",
    vehicle?.licensePlate ? `Plate ${vehicle.licensePlate}` : "",
  ]
    .filter(Boolean)
    .join(" • ");
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

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Connection
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {status?.connected ? "Bouncie Connected" : "Connect Bouncie"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {status?.connected
                ? "Vehicle data can be loaded from Bouncie."
                : "Authorize Bouncie, then save the returned authorization code in Vercel."}
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

        {status?.needsAuthorizationCode ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            After Bouncie redirects back, add the shown code to Vercel as{" "}
            <span className="font-black text-slate-900">
              BOUNCIE_AUTHORIZATION_CODE
            </span>
            , then redeploy.
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Vehicles
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {vehicles.length} Found
            </h2>
          </div>
        </div>

        <div className="grid gap-3">
          {vehicles.length > 0 ? (
            vehicles.map((vehicle, index) => (
              <div
                key={vehicle?.id || vehicle?.vin || vehicle?.imei || index}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#FC2C38] shadow-sm">
                  <Car aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900">
                    {getVehicleName(vehicle)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {getVehicleDetail(vehicle) || "Vehicle details from Bouncie"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
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
