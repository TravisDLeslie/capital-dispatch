import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import SupplierRunCard from "../components/SupplierRunCard";
import SupplierRunForm from "../components/SupplierRunForm";
import {
  getTodayHeading,
  isToday,
} from "../utils/dateHelpers";

function groupRunsByVendor(supplierRuns) {
  return supplierRuns.reduce((groups, supplierRun) => {
    const vendor = supplierRun.vendor || "Unknown Supplier";
    const existingGroup = groups.find(
      (group) => group.vendor === vendor,
    );

    if (existingGroup) {
      existingGroup.runs.push(supplierRun);
      return groups;
    }

    return [
      ...groups,
      {
        vendor,
        runs: [supplierRun],
      },
    ];
  }, []);
}

export default function SupplierRunsPage({
  mode = "add",
  supplierRuns,
  onAddSupplierRun,
  onToggleSupplierRunItem,
  onUpdateSupplierRunItemDescription,
  onDeleteSupplierRun,
}) {
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successMessage]);

  async function handleSubmit(supplierRun) {
    await onAddSupplierRun(supplierRun);

    setSuccessMessage(
      `PO ${supplierRun.poNumber} was sent to the driver list.`,
    );
  }

  const dailyRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status !== "complete" ||
      isToday(supplierRun.completedAt || supplierRun.updatedAt),
  );

  const historyRuns = supplierRuns.filter(
    (supplierRun) =>
      supplierRun.status === "complete" &&
      !isToday(supplierRun.completedAt || supplierRun.updatedAt),
  );

  const visibleRuns =
    mode === "history" ? historyRuns : dailyRuns;

  const openRuns = visibleRuns.filter(
    (supplierRun) => supplierRun.status !== "complete",
  );

  const completeRuns = visibleRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );

  const openRunGroups = groupRunsByVendor(openRuns);
  const completeRunGroups = groupRunsByVendor(completeRuns);
  const openItemsCount = openRuns.reduce(
    (count, supplierRun) =>
      count +
      (Array.isArray(supplierRun.items)
        ? supplierRun.items.filter((item) => !item.pickedUp).length
        : 0),
    0,
  );
  const historyRunGroups = groupRunsByVendor(historyRuns);

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
          Driver / Supplier Runs
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          {mode === "history"
            ? "History"
            : mode === "check"
              ? "Check POs"
              : "Add POs"}
        </h2>

        <div className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          {getTodayHeading()}
        </div>

        <p className="mt-2 text-slate-500">
          {mode === "history"
            ? "Older completed supplier pickups stay here so the daily driver board stays focused."
            : mode === "check"
              ? "Drivers can check off today's pickup items as they load them from the supplier."
              : "Dispatch can add pickup POs before the driver leaves or while they are already on the road."}
        </p>
      </div>

      {successMessage ? (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="font-bold text-blue-800">
            ✓ {successMessage}
          </p>
        </div>
      ) : null}

      {mode === "add" ? (
        <SupplierRunForm onSubmit={handleSubmit} />
      ) : mode === "history" ? (
        <section>
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Completed Before Today
            </p>

            <p className="mt-1 text-3xl font-black text-slate-900">
              {historyRuns.length}
            </p>
          </div>

          {historyRuns.length === 0 ? (
            <EmptyState
              title="No older completed supplier runs"
              description="Completed pickups will move here after today."
            />
          ) : (
            <div className="space-y-5">
              {historyRunGroups.map((group) => (
                <div
                  key={group.vendor}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Supplier
                      </p>

                      <h4 className="text-lg font-black tracking-tight text-slate-800">
                        {group.vendor}
                      </h4>
                    </div>

                    <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
                      {group.runs.length}{" "}
                      {group.runs.length === 1 ? "PO" : "POs"}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.runs.map((supplierRun) => (
                      <SupplierRunCard
                        key={supplierRun.id}
                        supplierRun={supplierRun}
                        onToggleItem={onToggleSupplierRunItem}
                        onUpdateItemDescription={
                          onUpdateSupplierRunItemDescription
                        }
                        onDelete={onDeleteSupplierRun}
                        isCompletedSection
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                Open Stops
              </p>

              <p className="mt-1 text-3xl font-black text-slate-900">
                {openRunGroups.length}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                Items Left
              </p>

              <p className="mt-1 text-3xl font-black text-slate-900">
                {openItemsCount}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Completed POs
              </p>

              <p className="mt-1 text-3xl font-black text-slate-900">
                {completeRuns.length}
              </p>
            </div>
          </div>

          {visibleRuns.length === 0 ? (
            <EmptyState
              title="No supplier runs for today"
              description="New pickups and today's completed POs will appear here."
            />
          ) : null}

          {openRuns.length > 0 ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900">
                    Open Stops
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Work these first. Stops are grouped by supplier.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {openRunGroups.map((group) => (
                  <div
                    key={group.vendor}
                    className="rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm sm:p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                          Stop
                        </p>

                        <h4 className="text-xl font-black tracking-tight text-slate-900">
                          {group.vendor}
                        </h4>
                      </div>

                      <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-blue-800 shadow-sm">
                        {group.runs.length}{" "}
                        {group.runs.length === 1 ? "PO" : "POs"}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {group.runs.map((supplierRun) => (
                        <SupplierRunCard
                          key={supplierRun.id}
                          supplierRun={supplierRun}
                          onToggleItem={onToggleSupplierRunItem}
                          onUpdateItemDescription={
                            onUpdateSupplierRunItemDescription
                          }
                          onDelete={onDeleteSupplierRun}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : visibleRuns.length > 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5">
              <p className="text-lg font-black text-emerald-900">
                All supplier POs are checked off.
              </p>

              <p className="mt-1 text-sm font-semibold text-emerald-700">
                Completed stops are listed below for reference.
              </p>
            </div>
          ) : null}

          {completeRuns.length > 0 ? (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-800">
                    Completed Today
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Older completed pickups move to History after today.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {completeRunGroups.map((group) => (
                  <div
                    key={group.vendor}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-lg font-black tracking-tight text-slate-800">
                        {group.vendor}
                      </h4>

                      <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
                        {group.runs.length}{" "}
                        {group.runs.length === 1 ? "PO" : "POs"}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {group.runs.map((supplierRun) => (
                        <SupplierRunCard
                          key={supplierRun.id}
                          supplierRun={supplierRun}
                          onToggleItem={onToggleSupplierRunItem}
                          onUpdateItemDescription={
                            onUpdateSupplierRunItemDescription
                          }
                          onDelete={onDeleteSupplierRun}
                          isCompletedSection
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}
    </PageContainer>
  );
}
