import {
  formatFullDate,
  formatShortDate,
  formatTime,
} from "../utils/dateHelpers";

export default function SupplierRunCard({
  supplierRun,
  onToggleItem,
  isCompletedSection = false,
}) {
  const items = Array.isArray(supplierRun.items)
    ? supplierRun.items
    : [];

  const pickedUpCount = items.filter(
    (item) => item.pickedUp,
  ).length;

  const isComplete =
    items.length > 0 && pickedUpCount === items.length;
  const remainingCount = items.length - pickedUpCount;
  const progressPercent =
    items.length > 0 ? (pickedUpCount / items.length) * 100 : 0;

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm transition ${
        isComplete
          ? "border-emerald-200 bg-white"
          : "border-blue-200 bg-white hover:border-blue-300 hover:shadow-md"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {supplierRun.poNumber}
            </h2>

            {isComplete ? (
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-emerald-800">
                Complete
              </span>
            ) : (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-amber-800">
                Needs Pickup
              </span>
            )}
          </div>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            Added {formatShortDate(supplierRun.createdAt)} at{" "}
            {formatTime(supplierRun.createdAt)}
          </p>
        </div>

        <div
          className={`rounded-xl px-3 py-2 text-sm font-black ${
            isComplete
              ? "bg-emerald-100 text-emerald-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {isComplete
            ? "All picked up"
            : `${remainingCount} left`}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>
            {pickedUpCount}/{items.length} picked up
          </span>

          {!isComplete ? (
            <span>{remainingCount} remaining</span>
          ) : null}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${
              isComplete ? "bg-emerald-500" : "bg-blue-600"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <label
            key={item.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
              item.pickedUp
                ? "border-emerald-200 bg-emerald-50"
                : "border-blue-200 bg-blue-50/60"
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(item.pickedUp)}
              onChange={() => onToggleItem(supplierRun.id, item.id)}
              className="mt-1 h-5 w-5 shrink-0 accent-blue-700"
            />

            <span className="min-w-0 flex-1">
              <span
                className={`block text-base font-semibold ${
                  item.pickedUp
                    ? "text-emerald-800 line-through decoration-2"
                    : "text-slate-800"
                }`}
              >
                {item.description}
              </span>

              {item.pickedUp && item.pickedUpAt ? (
                <span className="mt-1 block text-xs font-bold text-emerald-700">
                  Picked up {formatTime(item.pickedUpAt)}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      {supplierRun.completedAt ? (
        <p className="mt-3 text-xs font-bold text-emerald-700">
          {isCompletedSection ? "Finished" : "Completed"}{" "}
          {formatFullDate(supplierRun.completedAt)} at{" "}
          {formatTime(supplierRun.completedAt)}
        </p>
      ) : null}

      {supplierRun.updatedAt ? (
        <p className="mt-3 text-xs font-semibold text-slate-400">
          Last updated {formatFullDate(supplierRun.updatedAt)} at{" "}
          {formatTime(supplierRun.updatedAt)}
        </p>
      ) : null}
    </article>
  );
}
