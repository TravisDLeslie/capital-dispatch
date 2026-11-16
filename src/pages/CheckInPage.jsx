import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import CheckInForm from "../components/CheckInForm";
import PageContainer from "../components/PageContainer";

/**
 * @param {{
 *   onAddCheckIn: (checkIn: any) => Promise<void>;
 *   onViewToday: () => void;
 *   onPageChange?: (pageId: string) => void;
 *   vendorOptions?: string[];
 *   supplierRuns?: any[];
 *   theirTruckPOs?: any[];
 *   initialPoNumber?: string;
 *   checkedInByDefault?: string;
 *   teamMemberOptions?: string[];
 * }} props
 */
export default function CheckInPage({
  onAddCheckIn,
  onViewToday,
  onPageChange,
  vendorOptions = [],
  supplierRuns = [],
  theirTruckPOs = [],
  initialPoNumber = "",
  checkedInByDefault = "",
  teamMemberOptions = [],
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

  async function handleSubmit(checkIn) {
    await onAddCheckIn(checkIn);

    setSuccessMessage(
      `PO ${checkIn.poNumber} was checked in successfully.`,
    );
  }

  return (
    <PageContainer>
      <button
        type="button"
        onClick={() => onPageChange?.("receiving")}
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 md:hidden"
        aria-label="Back to Receiving Dashboard"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2.7} />
        Back to Receiving
      </button>

      <Breadcrumbs
        items={[
          { label: "Receiving", onClick: () => onPageChange?.("receiving") },
          { label: "Check In" },
        ]}
      />

      {successMessage ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-emerald-800">
            ✓ {successMessage}
          </p>

          <button
            type="button"
            onClick={onViewToday}
            className="text-left text-sm font-bold text-emerald-700 underline underline-offset-4 hover:text-emerald-900"
          >
            View today’s check-ins
          </button>
        </div>
      ) : null}

      <CheckInForm
        initialPoNumber={initialPoNumber}
        onSubmit={handleSubmit}
        vendorOptions={vendorOptions}
        supplierRuns={supplierRuns}
        theirTruckPOs={theirTruckPOs}
        checkedInByDefault={checkedInByDefault}
        teamMemberOptions={teamMemberOptions}
      />
    </PageContainer>
  );
}
