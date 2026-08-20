import Breadcrumbs from "../components/Breadcrumbs";
import CheckInCard from "../components/CheckInCard";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import {
  getTodayHeading,
  isToday,
} from "../utils/dateHelpers";

export default function TodayPage({
  checkIns,
  customers,
  supplierRuns = /** @type {any[]} */ ([]),
  theirTruckPOs = /** @type {any[]} */ ([]),
  onDeleteCheckIn,
  onUpdateAssignment,
  onPageChange,
}) {
  const todaysCheckIns = checkIns
    .filter((checkIn) => isToday(checkIn.checkedInAt))
    .sort(
      (firstCheckIn, secondCheckIn) =>
        new Date(secondCheckIn.checkedInAt) -
        new Date(firstCheckIn.checkedInAt),
    );

  const unassignedCount = todaysCheckIns.filter(
    (checkIn) =>
      !checkIn.orderAssignment?.type &&
      !checkIn.customer?.businessName,
  ).length;

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Receiving", onClick: () => onPageChange?.("receiving") },
          { label: "Today's Check-Ins" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FC2C38]">
            Daily Receiving
          </p>

          <h2 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            Today’s Check-Ins
          </h2>

          <p className="mt-2 text-lg font-semibold text-slate-500">
            {getTodayHeading()}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Checked In
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {todaysCheckIns.length}
          </p>
          <p className="text-sm font-bold text-slate-500">
            {todaysCheckIns.length === 1 ? "PO today" : "POs today"}
          </p>
        </div>

        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Received
          </p>
          <p className="mt-2 text-3xl font-black text-emerald-800">
            {todaysCheckIns.filter((checkIn) => !checkIn.materialsSkipped).length}
          </p>
          <p className="text-sm font-bold text-emerald-700">
            with material details
          </p>
        </div>

        <div
          className={`rounded-[22px] border p-4 shadow-sm ${
            unassignedCount > 0
              ? "border-amber-200 bg-amber-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <p
            className={`text-xs font-black uppercase tracking-[0.16em] ${
              unassignedCount > 0 ? "text-amber-700" : "text-slate-400"
            }`}
          >
            Needs Assignment
          </p>
          <p
            className={`mt-2 text-3xl font-black ${
              unassignedCount > 0 ? "text-amber-900" : "text-slate-950"
            }`}
          >
            {unassignedCount}
          </p>
          <p
            className={`text-sm font-bold ${
              unassignedCount > 0 ? "text-amber-700" : "text-slate-500"
            }`}
          >
            customer or stock links
          </p>
        </div>
      </div>

      {todaysCheckIns.length === 0 ? (
        <EmptyState
          title="No POs checked in today"
          description="New receiving records will appear here as soon as they are checked in."
        />
      ) : (
        <div className="space-y-4">
          {todaysCheckIns.map((checkIn) => (
            <CheckInCard
              key={checkIn.id}
              checkIn={checkIn}
              customers={customers}
              supplierRuns={supplierRuns}
              theirTruckPOs={theirTruckPOs}
              onDelete={onDeleteCheckIn}
              onUpdateAssignment={onUpdateAssignment}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
