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
  onDeleteCheckIn,
  onUpdateAssignment,
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Daily Receiving
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Today’s Check-Ins
          </h2>

          <p className="mt-2 text-slate-500">
            {getTodayHeading()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {unassignedCount > 0 ? (
            <div className="inline-flex rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800">
              {unassignedCount} need assignment
            </div>
          ) : null}

          <div className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            {todaysCheckIns.length}{" "}
            {todaysCheckIns.length === 1 ? "PO" : "POs"} checked
            in
          </div>
        </div>
      </div>

      {todaysCheckIns.length === 0 ? (
        <EmptyState
          title="No POs checked in today"
          description="New receiving records will appear here as soon as they are checked in."
        />
      ) : (
        <div className="space-y-3">
          {todaysCheckIns.map((checkIn) => (
            <CheckInCard
              key={checkIn.id}
              checkIn={checkIn}
              customers={customers}
              onDelete={onDeleteCheckIn}
              onUpdateAssignment={onUpdateAssignment}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
