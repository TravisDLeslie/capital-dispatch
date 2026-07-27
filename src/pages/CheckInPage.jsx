import { useEffect, useState } from "react";
import CheckInForm from "../components/CheckInForm";
import PageContainer from "../components/PageContainer";

export default function CheckInPage({
  onAddCheckIn,
  onViewToday,
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

      <CheckInForm onSubmit={handleSubmit} />
    </PageContainer>
  );
}
