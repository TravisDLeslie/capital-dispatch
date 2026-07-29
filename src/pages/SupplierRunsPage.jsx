import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import SupplierRunCard from "../components/SupplierRunCard";
import SupplierRunForm from "../components/SupplierRunForm";
import {
  getTodayHeading,
  isToday,
} from "../utils/dateHelpers";

const UNASSIGNED_DRIVER = "Unassigned Driver";

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

function groupRunsByDriverAndVendor(supplierRuns) {
  return supplierRuns.reduce((driverGroups, supplierRun) => {
    const driver = supplierRun.driver || UNASSIGNED_DRIVER;
    const existingDriverGroup = driverGroups.find(
      (group) => group.driver === driver,
    );

    if (existingDriverGroup) {
      existingDriverGroup.vendorGroups = groupRunsByVendor([
        ...existingDriverGroup.vendorGroups.flatMap(
          (group) => group.runs,
        ),
        supplierRun,
      ]);
      return driverGroups;
    }

    return [
      ...driverGroups,
      {
        driver,
        vendorGroups: groupRunsByVendor([supplierRun]),
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
  const [openStopKeys, setOpenStopKeys] = useState({});

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
      `PO ${supplierRun.poNumber} was sent to ${supplierRun.driver}'s South list.`,
    );
  }

  function toggleStop(driver, vendor, scope = "open") {
    const stopKey = `${scope}::${driver}::${vendor}`;

    setOpenStopKeys((currentOpenStopKeys) => ({
      ...currentOpenStopKeys,
      [stopKey]: !currentOpenStopKeys[stopKey],
    }));
  }

  function isStopOpen(driver, vendor, scope = "open") {
    return Boolean(openStopKeys[`${scope}::${driver}::${vendor}`]);
  }

  function getVendorGroupStats(vendorGroup) {
    const items = vendorGroup.runs.flatMap((supplierRun) =>
      Array.isArray(supplierRun.items) ? supplierRun.items : [],
    );
    const remainingItems = items.filter(
      (item) => !item.pickedUp,
    ).length;

    return {
      poCount: vendorGroup.runs.length,
      itemCount: items.length,
      remainingItems,
    };
  }

  function getDriverGroupStats(driverGroup) {
    const items = driverGroup.vendorGroups.flatMap((vendorGroup) =>
      vendorGroup.runs.flatMap((supplierRun) =>
        Array.isArray(supplierRun.items) ? supplierRun.items : [],
      ),
    );
    const pickedUpItems = items.filter((item) => item.pickedUp).length;
    const remainingItems = items.length - pickedUpItems;
    const progressPercent =
      items.length > 0
        ? Math.round((pickedUpItems / items.length) * 100)
        : 0;

    return {
      itemCount: items.length,
      pickedUpItems,
      remainingItems,
      progressPercent,
    };
  }

  function getDriverStatsForRuns(driver, runs) {
    return getDriverGroupStats({
      driver,
      vendorGroups: groupRunsByVendor(
        runs.filter(
          (supplierRun) =>
            (supplierRun.driver || UNASSIGNED_DRIVER) === driver,
        ),
      ),
    });
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

  const openRunGroups = groupRunsByDriverAndVendor(openRuns);
  const completeRunGroups =
    groupRunsByDriverAndVendor(completeRuns);
  const openStopsCount = openRunGroups.reduce(
    (count, driverGroup) =>
      count + driverGroup.vendorGroups.length,
    0,
  );
  const openItemsCount = openRuns.reduce(
    (count, supplierRun) =>
      count +
      (Array.isArray(supplierRun.items)
        ? supplierRun.items.filter((item) => !item.pickedUp).length
        : 0),
    0,
  );
  const historyRunGroups =
    groupRunsByDriverAndVendor(historyRuns);

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
          Driver / South
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          {mode === "history"
            ? "History"
            : mode === "check"
              ? "Check South POs"
              : "Add South POs"}
        </h2>

        <div className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          {getTodayHeading()}
        </div>

        <p className="mt-2 text-slate-500">
          {mode === "history"
            ? "Older completed South pickups stay here so the daily driver board stays focused."
            : mode === "check"
              ? "Drivers can check off today's South pickup items as they load them from each supplier."
              : "Dispatch can add South POs before the driver leaves or while they are already on the road."}
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
              title="No older completed South POs"
              description="Completed pickups will move here after today."
            />
          ) : (
            <div className="space-y-5">
              {historyRunGroups.map((group) => (
                <div
                  key={group.driver}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Driver
                      </p>

                      <h4 className="text-lg font-black tracking-tight text-slate-800">
                        {group.driver}
                      </h4>
                    </div>

                    <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
                      {group.vendorGroups.reduce(
                        (count, vendorGroup) =>
                          count + vendorGroup.runs.length,
                        0,
                      )}{" "}
                      POs
                    </div>
                  </div>

                  <div className="space-y-4">
                    {group.vendorGroups.map((vendorGroup) => (
                      <div key={vendorGroup.vendor}>
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          Stop
                        </p>

                        <h5 className="mb-2 text-base font-black text-slate-800">
                          {vendorGroup.vendor}
                        </h5>

                        <div className="space-y-3">
                          {vendorGroup.runs.map((supplierRun) => (
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
                {openStopsCount}
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
              title="No South POs for today"
              description="New South pickups and today's completed POs will appear here."
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
                    Work these first. Stops are grouped by driver, then supplier.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {openRunGroups.map((driverGroup) => {
                  const driverStats = getDriverStatsForRuns(
                    driverGroup.driver,
                    visibleRuns,
                  );

                  return (
                    <div
                      key={driverGroup.driver}
                      className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3 shadow-sm ring-1 ring-blue-100 sm:p-4"
                    >
                      <div className="mb-4 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                            Driver Route
                          </p>

                          <h4 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                            {driverGroup.driver}
                          </h4>
                        </div>

                        <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-blue-800 shadow-sm">
                          {driverGroup.vendorGroups.reduce(
                            (count, vendorGroup) =>
                              count + vendorGroup.runs.length,
                            0,
                          )}{" "}
                          POs
                        </div>
                      </div>
                      </div>

                      <div className="mb-4 rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
                          <span className="text-slate-900">
                            Driver Progress
                          </span>

                          <span className="text-emerald-700">
                            {driverStats.progressPercent}%
                          </span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-600 transition-all"
                            style={{
                              width: `${driverStats.progressPercent}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-xs font-bold text-slate-500">
                          {driverStats.pickedUpItems}/
                          {driverStats.itemCount} items picked up
                          {driverStats.remainingItems > 0
                            ? ` • ${driverStats.remainingItems} left`
                            : " • complete"}
                        </p>
                      </div>

                    <div className="space-y-3 border-l-4 border-blue-200 pl-3">
                      {driverGroup.vendorGroups.map((vendorGroup) => {
                        const stats = getVendorGroupStats(vendorGroup);
                        const stopIsOpen = isStopOpen(
                          driverGroup.driver,
                          vendorGroup.vendor,
                        );

                        return (
                          <div
                            key={vendorGroup.vendor}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                toggleStop(
                                  driverGroup.driver,
                                  vendorGroup.vendor,
                                )
                              }
                              className="flex w-full flex-col gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                              aria-expanded={stopIsOpen}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                  Supplier Stop
                                </p>

                                <h5 className="truncate text-xl font-black text-slate-900">
                                  {vendorGroup.vendor}
                                </h5>

                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                  {stats.remainingItems} left of{" "}
                                  {stats.itemCount} items
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-blue-800 shadow-sm">
                                  {stats.poCount}{" "}
                                  {stats.poCount === 1
                                    ? "PO"
                                    : "POs"}
                                </span>

                                <span className="rounded-lg border border-blue-100 bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">
                                  {stopIsOpen ? "Hide" : "Open"}
                                </span>
                              </div>
                            </button>

                            {stopIsOpen ? (
                              <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                {vendorGroup.runs.map((supplierRun) => (
                                  <SupplierRunCard
                                    key={supplierRun.id}
                                    supplierRun={supplierRun}
                                    onToggleItem={
                                      onToggleSupplierRunItem
                                    }
                                    onUpdateItemDescription={
                                      onUpdateSupplierRunItemDescription
                                    }
                                    onDelete={onDeleteSupplierRun}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : visibleRuns.length > 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5">
              <p className="text-lg font-black text-emerald-900">
                All South POs are checked off.
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
                    Older completed South pickups move to History after today.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {completeRunGroups.map((driverGroup) => (
                  <div
                    key={driverGroup.driver}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-lg font-black tracking-tight text-slate-800">
                        {driverGroup.driver}
                      </h4>

                      <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
                        {driverGroup.vendorGroups.reduce(
                          (count, vendorGroup) =>
                            count + vendorGroup.runs.length,
                          0,
                        )}{" "}
                        POs
                      </div>
                    </div>

                    <div className="space-y-4">
                      {driverGroup.vendorGroups.map((vendorGroup) => {
                        const stats = getVendorGroupStats(vendorGroup);
                        const stopIsOpen = isStopOpen(
                          driverGroup.driver,
                          vendorGroup.vendor,
                          "complete",
                        );

                        return (
                          <div
                            key={vendorGroup.vendor}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                toggleStop(
                                  driverGroup.driver,
                                  vendorGroup.vendor,
                                  "complete",
                                )
                              }
                              className="flex w-full flex-col gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                              aria-expanded={stopIsOpen}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                  Supplier Stop
                                </p>

                                <h5 className="truncate text-lg font-black text-slate-800">
                                  {vendorGroup.vendor}
                                </h5>

                                <p className="mt-1 text-sm font-semibold text-emerald-700">
                                  Complete • {stats.itemCount} items
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm">
                                  {stats.poCount}{" "}
                                  {stats.poCount === 1
                                    ? "PO"
                                    : "POs"}
                                </span>

                                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">
                                  {stopIsOpen ? "Hide" : "Open"}
                                </span>
                              </div>
                            </button>

                            {stopIsOpen ? (
                              <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                                {vendorGroup.runs.map((supplierRun) => (
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
                            ) : null}
                          </div>
                        );
                      })}
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
