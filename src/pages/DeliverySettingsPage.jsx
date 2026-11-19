import { useEffect, useState } from "react";
import {
  CalendarOff,
  Pencil,
  Plus,
  Save,
  Timer,
  Trash2,
  Truck,
  Undo2,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { deliveryUnloadTypes } from "../data/options";
import {
  calendarBlockOffColorOptions,
  calendarBlockOffIconOptions,
  defaultCalendarBlockOffBackgroundColor,
  getCalendarBlockOffScheduleLabel,
  getCalendarBlockOffTextColor,
  normalizeCalendarBlockOffs,
} from "../utils/deliveryCalendarBlockOffs";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";

function formatBlockOffDate(dateKey) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

export default function DeliverySettingsPage({
  deliverySettings,
  onSaveDeliverySettings,
  onPageChange,
}) {
  const [draftDurations, setDraftDurations] = useState({});
  const [calendarBlockOffs, setCalendarBlockOffs] = useState([]);
  const [blockOffDate, setBlockOffDate] = useState("");
  const [blockOffReason, setBlockOffReason] = useState("");
  const [blockOffIcon, setBlockOffIcon] = useState("📅");
  const [blockOffBackgroundColor, setBlockOffBackgroundColor] = useState(
    defaultCalendarBlockOffBackgroundColor,
  );
  const [blockOffMode, setBlockOffMode] = useState("allDay");
  const [blockOffOpenStart, setBlockOffOpenStart] = useState("07:30");
  const [blockOffOpenEnd, setBlockOffOpenEnd] = useState("11:00");
  const [editingBlockOffId, setEditingBlockOffId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraftDurations(deliverySettings?.unloadDurations || {});
    setCalendarBlockOffs(
      normalizeCalendarBlockOffs(deliverySettings?.calendarBlockOffs),
    );
  }, [deliverySettings]);

  const [returnDuration, setReturnDuration] = useState(
    deliverySettings?.returnDurationMinutes || 60,
  );

  useEffect(() => {
    setReturnDuration(deliverySettings?.returnDurationMinutes || 60);
  }, [deliverySettings]);

  function clearBlockOffDraft() {
    setBlockOffDate("");
    setBlockOffReason("");
    setBlockOffIcon("📅");
    setBlockOffBackgroundColor(defaultCalendarBlockOffBackgroundColor);
    setBlockOffMode("allDay");
    setBlockOffOpenStart("07:30");
    setBlockOffOpenEnd("11:00");
    setEditingBlockOffId("");
  }

  function handleAddBlockOff() {
    const date = blockOffDate.trim();
    const reason = blockOffReason.trim();

    if (!date || !reason) {
      setError("Choose a date and enter what the calendar is closed for.");
      return;
    }

    if (
      blockOffMode === "limitedHours" &&
      (!blockOffOpenStart ||
        !blockOffOpenEnd ||
        blockOffOpenStart >= blockOffOpenEnd)
    ) {
      setError("Choose an opening time that is before the closing time.");
      return;
    }

    const existingBlockOff = calendarBlockOffs.find(
      (blockOff) => blockOff.date === date,
    );
    const id =
      editingBlockOffId ||
      existingBlockOff?.id ||
      `calendar-block-${date}-${Date.now()}`;

    setCalendarBlockOffs((currentBlockOffs) =>
      normalizeCalendarBlockOffs([
        ...currentBlockOffs.filter(
          (blockOff) =>
            blockOff.id !== editingBlockOffId && blockOff.date !== date,
        ),
        {
          id,
          date,
          reason,
          icon: blockOffIcon,
          backgroundColor: blockOffBackgroundColor,
          mode: blockOffMode,
          openStart:
            blockOffMode === "limitedHours" ? blockOffOpenStart : "",
          openEnd: blockOffMode === "limitedHours" ? blockOffOpenEnd : "",
        },
      ]),
    );
    clearBlockOffDraft();
    setMessage("");
    setError("");
  }

  function handleEditBlockOff(blockOff) {
    setBlockOffDate(blockOff.date);
    setBlockOffReason(blockOff.reason);
    setBlockOffIcon(blockOff.icon || "📅");
    setBlockOffBackgroundColor(
      blockOff.backgroundColor || defaultCalendarBlockOffBackgroundColor,
    );
    setBlockOffMode(blockOff.mode || "allDay");
    setBlockOffOpenStart(blockOff.openStart || "07:30");
    setBlockOffOpenEnd(blockOff.openEnd || "11:00");
    setEditingBlockOffId(blockOff.id);
    setMessage("");
    setError("");
  }

  function handleRemoveBlockOff(blockOffId) {
    setCalendarBlockOffs((currentBlockOffs) =>
      currentBlockOffs.filter((blockOff) => blockOff.id !== blockOffId),
    );

    if (editingBlockOffId === blockOffId) {
      clearBlockOffDraft();
    }

    setMessage("");
    setError("");
  }

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
        returnDurationMinutes: Math.max(5, Number(returnDuration) || 60),
        calendarBlockOffs,
      });
      setMessage("Delivery settings and calendar block-offs saved.");
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
          Set delivery timing defaults and close calendar dates for holidays,
          company events, or limited-hour days when delivery scheduling changes.
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

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <span className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
            <Undo2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
            Return delivery type
          </span>

          <div className="flex items-center gap-3">
            <input
              type="number"
              min="5"
              max="240"
              step="5"
              value={returnDuration || ""}
              onChange={(event) => {
                setReturnDuration(event.target.value);
                setMessage("");
                setError("");
              }}
              disabled={isSaving}
              className="w-full max-w-xs rounded-xl border border-blue-200 px-4 py-3 text-lg font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />

            <span className="shrink-0 text-sm font-black text-slate-500">
              min
            </span>
          </div>

          <p className="mt-2 text-sm font-bold text-slate-500">
            Default is 60 minutes. This is used when Delivery Type is Return.
          </p>
        </div>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900">
                <CalendarOff className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Calendar Block Offs
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Mark a full closure or set the hours the yard is open, then
                  add a holiday icon and note for the dispatch team.
                </p>
              </div>
            </div>
            <span className="self-start rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-900 ring-1 ring-amber-200">
              {calendarBlockOffs.length} blocked
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(180px,0.55fr)_minmax(260px,1fr)]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                Date
              </span>
              <input
                type="date"
                value={blockOffDate}
                onChange={(event) => {
                  setBlockOffDate(event.target.value);
                  setMessage("");
                  setError("");
                }}
                disabled={isSaving}
                className="min-h-12 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                What is it for?
              </span>
              <input
                type="text"
                value={blockOffReason}
                onChange={(event) => {
                  setBlockOffReason(event.target.value);
                  setMessage("");
                  setError("");
                }}
                disabled={isSaving}
                placeholder="Thanksgiving, inventory count, company event..."
                className="min-h-12 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
              />
            </label>

          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(320px,1fr)]">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                Holiday icon
              </p>
              <div className="flex flex-wrap gap-2">
                {calendarBlockOffIconOptions.map((iconOption) => (
                  <button
                    key={iconOption.value}
                    type="button"
                    onClick={() => {
                      setBlockOffIcon(iconOption.value);
                      setMessage("");
                      setError("");
                    }}
                    disabled={isSaving}
                    title={iconOption.label}
                    aria-label={iconOption.label}
                    aria-pressed={blockOffIcon === iconOption.value}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition focus:outline-none focus:ring-4 focus:ring-amber-100 ${
                      blockOffIcon === iconOption.value
                        ? "border-amber-500 bg-amber-200 shadow-sm"
                        : "border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50"
                    }`}
                  >
                    <span aria-hidden="true">{iconOption.value}</span>
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-4 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                Block background
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {calendarBlockOffColorOptions.map((colorOption) => (
                  <button
                    key={colorOption.value}
                    type="button"
                    onClick={() => {
                      setBlockOffBackgroundColor(colorOption.value);
                      setMessage("");
                      setError("");
                    }}
                    disabled={isSaving}
                    title={colorOption.label}
                    aria-label={`${colorOption.label} background`}
                    aria-pressed={
                      blockOffBackgroundColor.toUpperCase() === colorOption.value
                    }
                    className={`h-9 w-9 rounded-full border-4 shadow-sm transition focus:outline-none focus:ring-4 focus:ring-amber-100 ${
                      blockOffBackgroundColor.toUpperCase() === colorOption.value
                        ? "border-white ring-2 ring-slate-950"
                        : "border-white hover:scale-105"
                    }`}
                    style={{ backgroundColor: colorOption.value }}
                  />
                ))}
                <label className="relative flex h-9 min-w-28 cursor-pointer items-center gap-2 rounded-full border border-amber-200 bg-white px-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-amber-400">
                  <input
                    type="color"
                    value={blockOffBackgroundColor}
                    onChange={(event) => {
                      setBlockOffBackgroundColor(event.target.value.toUpperCase());
                      setMessage("");
                      setError("");
                    }}
                    disabled={isSaving}
                    className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    aria-label="Choose a custom background color"
                  />
                  Custom
                </label>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                Availability
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-amber-100 p-1">
                {[
                  { id: "allDay", label: "Closed all day" },
                  { id: "limitedHours", label: "Open limited hours" },
                ].map((modeOption) => (
                  <button
                    key={modeOption.id}
                    type="button"
                    onClick={() => {
                      setBlockOffMode(modeOption.id);
                      setMessage("");
                      setError("");
                    }}
                    disabled={isSaving}
                    className={`rounded-lg px-3 py-2.5 text-xs font-black transition ${
                      blockOffMode === modeOption.id
                        ? "bg-white text-amber-950 shadow-sm"
                        : "text-amber-800 hover:bg-white/60"
                    }`}
                  >
                    {modeOption.label}
                  </button>
                ))}
              </div>

              {blockOffMode === "limitedHours" ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-1.5 block text-xs font-black text-slate-600">
                      Open from
                    </span>
                    <input
                      type="time"
                      step="900"
                      value={blockOffOpenStart}
                      onChange={(event) => {
                        setBlockOffOpenStart(event.target.value);
                        setMessage("");
                        setError("");
                      }}
                      disabled={isSaving}
                      className="min-h-12 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-black text-slate-600">
                      Open until
                    </span>
                    <input
                      type="time"
                      step="900"
                      value={blockOffOpenEnd}
                      onChange={(event) => {
                        setBlockOffOpenEnd(event.target.value);
                        setMessage("");
                        setError("");
                      }}
                      disabled={isSaving}
                      className="min-h-12 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAddBlockOff}
                disabled={isSaving || !blockOffDate || !blockOffReason.trim()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingBlockOffId ? (
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {editingBlockOffId ? "Update date" : "Add date"}
              </button>
              {editingBlockOffId ? (
                <button
                  type="button"
                  onClick={clearBlockOffDraft}
                  disabled={isSaving}
                  className="min-h-12 rounded-xl border border-amber-300 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-amber-50"
                >
                  Cancel
                </button>
              ) : null}
          </div>

          {calendarBlockOffs.length > 0 ? (
            <div className="mt-5 grid gap-2 xl:grid-cols-2">
              {calendarBlockOffs.map((blockOff) => (
                <article
                  key={blockOff.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-4 border-white text-xl shadow-sm"
                      style={{
                        backgroundColor: blockOff.backgroundColor,
                        color: getCalendarBlockOffTextColor(
                          blockOff.backgroundColor,
                        ),
                      }}
                      aria-hidden="true"
                    >
                      {blockOff.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">
                        {formatBlockOffDate(blockOff.date)}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-amber-900">
                        {blockOff.reason}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                        {getCalendarBlockOffScheduleLabel(blockOff)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditBlockOff(blockOff)}
                      disabled={isSaving}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-amber-50 hover:text-amber-900"
                      aria-label={`Edit block off for ${formatBlockOffDate(blockOff.date)}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveBlockOff(blockOff.id)}
                      disabled={isSaving}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                      aria-label={`Remove block off for ${formatBlockOffDate(blockOff.date)}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-amber-300 bg-white/70 px-4 py-4 text-center text-sm font-bold text-slate-500">
              No calendar dates are blocked off.
            </p>
          )}
        </section>

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
          {isSaving ? "Saving..." : "Save Delivery Settings"}
        </button>
      </form>
    </PageContainer>
  );
}
