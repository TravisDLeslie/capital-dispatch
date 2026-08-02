import {
  Car,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Satellite,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";
import {
  getVehicleCoordinates,
  getVehicleDefaultAppTitle,
  getVehicleKey,
  getVehicleLastUpdated,
  getVehicleLocationLabel,
  getVehicleName,
  getVehicleYearMakeModel,
  getUniqueVehicleBadgeTexts,
} from "../utils/bouncieVehicleFormatters";
import { subscribeToBouncieVehicleSettings } from "../utils/bouncieVehicleStorage";

const markerPositions = [
  { left: "18%", top: "34%" },
  { left: "38%", top: "24%" },
  { left: "62%", top: "42%" },
  { left: "78%", top: "28%" },
  { left: "28%", top: "68%" },
  { left: "55%", top: "70%" },
  { left: "82%", top: "64%" },
  { left: "45%", top: "52%" },
];

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

function getVehicleMapUrl(vehicle) {
  const coordinates = getVehicleCoordinates(vehicle);

  if (!coordinates) {
    return "";
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${coordinates.latitude},${coordinates.longitude}`,
  )}`;
}

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleSettings, setVehicleSettings] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const vehicleSettingsById = useMemo(
    () =>
      vehicleSettings.reduce(
        (settingsById, setting) => ({
          ...settingsById,
          [setting.id]: setting,
        }),
        {},
      ),
    [vehicleSettings],
  );

  const dashboardVehicleTitles = vehicles.map((vehicle, index) => {
    const vehicleId = getVehicleKey(vehicle, index);
    const savedSetting = vehicleSettingsById[vehicleId];
    const bouncieName = getVehicleName(vehicle);
    return (
      savedSetting?.title ||
      getVehicleDefaultAppTitle(vehicle) ||
      bouncieName
    );
  });
  const dashboardVehicleBadges = getUniqueVehicleBadgeTexts(
    vehicles.map((vehicle, index) => {
      const vehicleId = getVehicleKey(vehicle, index);
      const savedSetting = vehicleSettingsById[vehicleId];

      return savedSetting?.badge || dashboardVehicleTitles[index];
    }),
  );
  const dashboardVehicles = vehicles.map((vehicle, index) => {
    const vehicleId = getVehicleKey(vehicle, index);
    const bouncieName = getVehicleName(vehicle);
    const title = dashboardVehicleTitles[index];
    const locationLabel = getVehicleLocationLabel(vehicle);

    return {
      id: vehicleId,
      vehicle,
      title,
      bouncieName,
      yearMakeModel: getVehicleYearMakeModel(vehicle),
      badge: dashboardVehicleBadges[index],
      locationLabel,
      lastUpdated: getVehicleLastUpdated(vehicle),
      mapUrl: getVehicleMapUrl(vehicle),
      hasLocation: Boolean(locationLabel),
    };
  });

  const locatedVehicles = dashboardVehicles.filter(
    (vehicle) => vehicle.hasLocation,
  );

  async function loadDashboardVehicles() {
    setIsLoading(true);
    setError("");

    try {
      const vehiclesResponse = await fetch("/api/bouncie/vehicles");
      const vehiclesData = await readApiJson(
        vehiclesResponse,
        "Bouncie vehicles route",
      );

      if (!vehiclesResponse.ok) {
        setError(vehiclesData.error || "Unable to load vehicle locations.");
        setVehicles([]);
        return;
      }

      setVehicles(
        Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : [],
      );
    } catch (loadError) {
      console.error("Unable to load dashboard vehicles:", loadError);
      setError(
        loadError.message ||
          "Unable to reach the Bouncie vehicle route.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardVehicles();
  }, []);

  useEffect(
    () =>
      subscribeToBouncieVehicleSettings(
        setVehicleSettings,
        (settingsError) => {
          console.error("Unable to sync vehicle settings:", settingsError);
        },
      ),
    [],
  );

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Dashboard
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            Fleet Snapshot
          </h1>

          <p className="mt-2 max-w-3xl text-lg text-slate-500">
            A quick look at where the Capital trucks are reporting from.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboardVehicles}
          disabled={isLoading}
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw
            aria-hidden="true"
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            strokeWidth={2.5}
          />
          Refresh Fleet
        </button>
      </div>

      {error ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            <Car aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            Vehicles
          </p>
          <p className="mt-3 text-4xl font-black text-slate-950">
            {dashboardVehicles.length}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Connected through Bouncie
          </p>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            <Satellite
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.5}
            />
            Located
          </p>
          <p className="mt-3 text-4xl font-black text-slate-950">
            {locatedVehicles.length}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Showing last known position
          </p>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            <Route aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            Dispatch Pulse
          </p>
          <p className="mt-3 text-4xl font-black text-[#FC2C38]">
            Live
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Ready for route work
          </p>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <div className="absolute inset-0 opacity-70">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:54px_54px]" />
          </div>

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-200">
                Boise Area
              </p>
              <h2 className="mt-2 text-3xl font-black">
                Fleet Board
              </h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">
              {locatedVehicles.length} reporting
            </span>
          </div>

          <div className="relative z-10 mt-10 h-[300px] rounded-[24px] border border-white/10 bg-white/5">
            <div className="absolute left-[8%] right-[8%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
            <div className="absolute bottom-[16%] left-[20%] top-[18%] w-1 rounded-full bg-white/10" />
            <div className="absolute bottom-[12%] right-[28%] top-[24%] w-1 rotate-12 rounded-full bg-white/10" />

            {dashboardVehicles.length > 0 ? (
              dashboardVehicles.map((dashboardVehicle, index) => {
                const markerPosition =
                  markerPositions[index % markerPositions.length];

                return (
                  <div
                    key={dashboardVehicle.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={markerPosition}
                  >
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-sm font-black shadow-xl ${
                        dashboardVehicle.hasLocation
                          ? "border-white/30 bg-[#FC2C38] text-white"
                          : "border-white/20 bg-white/10 text-white/70"
                      }`}
                      title={dashboardVehicle.title}
                    >
                      {dashboardVehicle.badge}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="text-sm font-bold text-white/60">
                  Vehicle markers will appear here after Bouncie loads.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                Locations
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Trucks
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {dashboardVehicles.length > 0 ? (
              dashboardVehicles.map((dashboardVehicle) => (
                <div
                  key={dashboardVehicle.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0F2] text-sm font-black text-[#FC2C38]">
                      {dashboardVehicle.badge}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black text-slate-950">
                        {dashboardVehicle.title}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-slate-500">
                        {dashboardVehicle.yearMakeModel || "Vehicle profile"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-white px-3 py-3">
                    <MapPin
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#FC2C38]"
                      strokeWidth={2.5}
                    />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-slate-800">
                        {dashboardVehicle.locationLabel ||
                          "Location not reported yet"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {dashboardVehicle.lastUpdated
                          ? `Updated ${dashboardVehicle.lastUpdated}`
                          : "Waiting for a Bouncie location update"}
                      </p>
                    </div>
                  </div>

                  {dashboardVehicle.mapUrl ? (
                    <a
                      href={dashboardVehicle.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
                    >
                      <Navigation
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={2.5}
                      />
                      Open in Maps
                    </a>
                  ) : null}
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
                  Connect Bouncie from Admin Vehicles.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
