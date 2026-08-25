import {
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  ExternalLink,
  Hash,
  Image as ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import {
  deleteBouncieVehicleSetting,
  saveBouncieVehicleSetting,
  subscribeToBouncieVehicleSettings,
} from "../utils/bouncieVehicleStorage";
import {
  getFirstVehicleValue,
  getVehicleDefaultAppTitle,
  getVehicleDetail,
  getVehicleKey,
  getVehicleName,
  getVehicleYearMakeModel,
  getUniqueVehicleBadgeTexts,
} from "../utils/bouncieVehicleFormatters";

function createEmptyVehicleDraft() {
  return {
    id: "",
    nickname: "",
    badge: "",
    year: "",
    make: "",
    model: "",
    vin: "",
    photoDataUrl: "",
    lastServiceDate: "",
    lastServiceDescription: "",
    lastServiceProvider: "",
  };
}

function getManualVehicleTitle(vehicleSetting) {
  return (
    vehicleSetting?.nickname ||
    vehicleSetting?.title ||
    [vehicleSetting?.year, vehicleSetting?.make, vehicleSetting?.model]
      .filter(Boolean)
      .join(" ") ||
    "Vehicle"
  );
}

function getManualVehicleYearMakeModel(vehicleSetting) {
  return (
    vehicleSetting?.yearMakeModel ||
    [vehicleSetting?.year, vehicleSetting?.make, vehicleSetting?.model]
      .filter(Boolean)
      .join(" ")
  );
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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

export default function BounciePage({ onPageChange }) {
  const [status, setStatus] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleSettings, setVehicleSettings] = useState([]);
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBadge, setEditingBadge] = useState("");
  const [savingVehicleId, setSavingVehicleId] = useState("");
  const [vehicleDraft, setVehicleDraft] = useState(createEmptyVehicleDraft());
  const [isVehicleFormOpen, setIsVehicleFormOpen] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState("");
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

    return (
      savedSetting?.title ||
      getVehicleDefaultAppTitle(vehicle) ||
      bouncieVehicleName
    );
  });
  const vehicleBadgeSources = vehicles.map((vehicle, index) => {
    const vehicleId = getVehicleKey(vehicle, index);
    const savedSetting = vehicleSettingsById[vehicleId];

    return savedSetting?.badge || vehicleTitles[index];
  });
  const vehicleBadges = getUniqueVehicleBadgeTexts(vehicleBadgeSources);

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
    const savedSetting = vehicleSettingsById[vehicleId];

    setEditingVehicleId(vehicleId);
    setEditingTitle(currentTitle || getVehicleName(vehicle));
    setEditingBadge(savedSetting?.badge || "");
  }

  function cancelEditingVehicle() {
    setEditingVehicleId("");
    setEditingTitle("");
    setEditingBadge("");
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
        badge: editingBadge.trim(),
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

  function startAddingVehicle() {
    setVehicleDraft(createEmptyVehicleDraft());
    setIsVehicleFormOpen(true);
    setEditingVehicleId("");
  }

  function startEditingVehicleDetails(vehicleSetting) {
    setVehicleDraft({
      id: vehicleSetting.id || "",
      nickname:
        vehicleSetting.nickname ||
        vehicleSetting.title ||
        vehicleSetting.bouncieName ||
        "",
      badge: vehicleSetting.badge || "",
      year: vehicleSetting.year || "",
      make: vehicleSetting.make || "",
      model: vehicleSetting.model || "",
      vin: vehicleSetting.vin || "",
      photoDataUrl: vehicleSetting.photoDataUrl || "",
      lastServiceDate: vehicleSetting.lastServiceDate || "",
      lastServiceDescription: vehicleSetting.lastServiceDescription || "",
      lastServiceProvider: vehicleSetting.lastServiceProvider || "",
    });
    setIsVehicleFormOpen(true);
    setEditingVehicleId("");
  }

  function updateVehicleDraft(field, value) {
    setVehicleDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  async function handleVehiclePhotoChange(file) {
    if (!file) {
      return;
    }

    try {
      const dataUrl = await readImageAsDataUrl(file);
      updateVehicleDraft("photoDataUrl", dataUrl);
    } catch (photoError) {
      console.error("Unable to load vehicle photo:", photoError);
      setError("Unable to load that vehicle photo. Try a different image.");
    }
  }

  async function handleSaveVehicleDetails(event) {
    event.preventDefault();

    const nickname = vehicleDraft.nickname.trim();
    const yearMakeModel = [
      vehicleDraft.year,
      vehicleDraft.make,
      vehicleDraft.model,
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
    const title = nickname || yearMakeModel;

    if (!title) {
      setError("Add at least a nickname or year/make/model for the vehicle.");
      return;
    }

    const vehicleId =
      vehicleDraft.id ||
      `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setSavingVehicleId(vehicleId);
    setError("");

    try {
      const updatedSettings = await saveBouncieVehicleSetting({
        id: vehicleId,
        isManual: true,
        title,
        nickname,
        badge: vehicleDraft.badge.trim(),
        year: vehicleDraft.year.trim(),
        make: vehicleDraft.make.trim(),
        model: vehicleDraft.model.trim(),
        yearMakeModel,
        vin: vehicleDraft.vin.trim(),
        photoDataUrl: vehicleDraft.photoDataUrl,
        lastServiceDate: vehicleDraft.lastServiceDate,
        lastServiceDescription: vehicleDraft.lastServiceDescription.trim(),
        lastServiceProvider: vehicleDraft.lastServiceProvider.trim(),
      });

      setVehicleSettings(updatedSettings);
      setVehicleDraft(createEmptyVehicleDraft());
      setIsVehicleFormOpen(false);
    } catch (saveError) {
      console.error("Unable to save vehicle:", saveError);
      setError(
        "Unable to save vehicle. Publish Firestore rules for Bouncie vehicle settings.",
      );
    } finally {
      setSavingVehicleId("");
    }
  }

  async function handleDeleteVehicle(vehicleSettingId) {
    setDeletingVehicleId(vehicleSettingId);
    setError("");

    try {
      const updatedSettings = await deleteBouncieVehicleSetting(vehicleSettingId);
      setVehicleSettings(updatedSettings);
    } catch (deleteError) {
      console.error("Unable to delete vehicle:", deleteError);
      setError(
        "Unable to delete vehicle. Publish Firestore rules for Bouncie vehicle settings.",
      );
    } finally {
      setDeletingVehicleId("");
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Admin", onClick: () => onPageChange?.("admin") },
          { label: "Vehicles" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Admin
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Vehicles
        </h1>

        <p className="mt-2 max-w-3xl text-lg text-slate-500">
          Manage the trucks and equipment Capital Dispatch uses today. Bouncie
          can be connected later for live vehicle data.
        </p>
      </div>

      <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              Manual Fleet
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {vehicleSettings.length}{" "}
              {vehicleSettings.length === 1 ? "Vehicle" : "Vehicles"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Add nickname, VIN, service info, and a photo. These vehicles are
              available for South and delivery truck assignment.
            </p>
          </div>

          <button
            type="button"
            onClick={startAddingVehicle}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
          >
            <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
            Add Vehicle
          </button>
        </div>

        {isVehicleFormOpen ? (
          <form
            onSubmit={handleSaveVehicleDetails}
            className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                  Vehicle Details
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  {vehicleDraft.id ? "Edit Vehicle" : "Add Vehicle"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVehicleDraft(createEmptyVehicleDraft());
                  setIsVehicleFormOpen(false);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
                aria-label="Close vehicle form"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                  {vehicleDraft.photoDataUrl ? (
                    <img
                      src={vehicleDraft.photoDataUrl}
                      alt="Vehicle preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon
                      className="h-10 w-10 text-slate-300"
                      aria-hidden="true"
                      strokeWidth={2}
                    />
                  )}
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) =>
                      handleVehiclePhotoChange(event.target.files?.[0])
                    }
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Nickname
                  </span>
                  <input
                    type="text"
                    value={vehicleDraft.nickname}
                    onChange={(event) =>
                      updateVehicleDraft("nickname", event.target.value)
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                    placeholder="R45"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Map Badge
                  </span>
                  <input
                    type="text"
                    value={vehicleDraft.badge}
                    onChange={(event) =>
                      updateVehicleDraft("badge", event.target.value)
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                    placeholder="R45"
                    maxLength={8}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Year
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={vehicleDraft.year}
                    onChange={(event) =>
                      updateVehicleDraft("year", event.target.value)
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                    placeholder="2021"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Make
                  </span>
                  <input
                    type="text"
                    value={vehicleDraft.make}
                    onChange={(event) =>
                      updateVehicleDraft("make", event.target.value)
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                    placeholder="Ram"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Model
                  </span>
                  <input
                    type="text"
                    value={vehicleDraft.model}
                    onChange={(event) =>
                      updateVehicleDraft("model", event.target.value)
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                    placeholder="5500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    VIN
                  </span>
                  <input
                    type="text"
                    value={vehicleDraft.vin}
                    onChange={(event) =>
                      updateVehicleDraft("vin", event.target.value)
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                    placeholder="Last 6 or full VIN"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Last Service
                  </span>
                  <input
                    type="date"
                    value={vehicleDraft.lastServiceDate}
                    onChange={(event) =>
                      updateVehicleDraft("lastServiceDate", event.target.value)
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Service For
                  </span>
                  <input
                    type="text"
                    value={vehicleDraft.lastServiceDescription}
                    onChange={(event) =>
                      updateVehicleDraft(
                        "lastServiceDescription",
                        event.target.value,
                      )
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                    placeholder="Oil, brakes, DOT..."
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Service Shop
                  </span>
                  <input
                    type="text"
                    value={vehicleDraft.lastServiceProvider}
                    onChange={(event) =>
                      updateVehicleDraft("lastServiceProvider", event.target.value)
                    }
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                    placeholder="Shop or mechanic"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setVehicleDraft(createEmptyVehicleDraft());
                  setIsVehicleFormOpen(false);
                }}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(savingVehicleId)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Save Vehicle
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {vehicleSettings.length > 0 ? (
            vehicleSettings.map((vehicleSetting) => {
              const vehicleTitle = getManualVehicleTitle(vehicleSetting);
              const yearMakeModel =
                getManualVehicleYearMakeModel(vehicleSetting);
              const isDeletingVehicle = deletingVehicleId === vehicleSetting.id;

              return (
                <article
                  key={vehicleSetting.id}
                  className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="h-36 w-full overflow-hidden rounded-2xl bg-slate-100 sm:h-auto sm:w-44">
                      {vehicleSetting.photoDataUrl ? (
                        <img
                          src={vehicleSetting.photoDataUrl}
                          alt={vehicleTitle}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <Car className="h-12 w-12" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-2xl font-black text-slate-950">
                              {vehicleTitle}
                            </h3>
                            {vehicleSetting.badge ? (
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                                {vehicleSetting.badge}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-base font-extrabold text-slate-600">
                            {yearMakeModel || "Year make model not entered"}
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              startEditingVehicleDetails(vehicleSetting)
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                            aria-label={`Edit ${vehicleTitle}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(vehicleSetting.id)}
                            disabled={isDeletingVehicle}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-[#FC2C38] shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Delete ${vehicleTitle}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                            VIN
                          </p>
                          <p className="mt-1 break-words text-sm font-black text-slate-800">
                            {vehicleSetting.vin || "Not entered"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            <CalendarDays
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Last Service
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-800">
                            {vehicleSetting.lastServiceDate || "Not entered"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                            Service For
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-800">
                            {vehicleSetting.lastServiceDescription ||
                              "Not entered"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            <Building2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Service Shop
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-800">
                            {vehicleSetting.lastServiceProvider || "Not entered"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
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
                No manual vehicles yet
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Add your trucks here now, then connect Bouncie later if needed.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Connection
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900">
                {status?.connected ? "Bouncie Connected" : "Optional Bouncie"}
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
                ? status?.tokenSource === "redis"
                  ? "Fleet data is loading from Bouncie. Tokens are saved in Redis so deploys will not reset the connection."
                  : "Fleet data is loading from Bouncie using Vercel environment tokens. Reconnect after Redis token storage is configured."
                : "Manual vehicles work now. Connect Bouncie later if you want live location and device data."}
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

        {!status?.canPersistTokens ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Connect Redis to this Vercel project so Bouncie tokens can be saved
            across deploys.
          </div>
        ) : status?.needsAccessToken ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            Click Connect Bouncie. After the redirect, tokens will be saved to
            Redis automatically.
          </div>
        ) : status?.connected && !status?.hasRefreshToken ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Refresh token is missing. Reconnect Bouncie so the app can save a
            fresh access and refresh token pair.
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Bouncie Vehicles
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
                            <div className="flex flex-col gap-2">
                              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                                <label className="block">
                                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                                    Vehicle Name
                                  </span>
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(event) =>
                                      setEditingTitle(event.target.value)
                                    }
                                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                                    placeholder="Truck 12"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                                    Map Badge
                                  </span>
                                  <input
                                    type="text"
                                    value={editingBadge}
                                    onChange={(event) =>
                                      setEditingBadge(event.target.value)
                                    }
                                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                                    maxLength={5}
                                    placeholder="R45"
                                  />
                                </label>
                              </div>
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
