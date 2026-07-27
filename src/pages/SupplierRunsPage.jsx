import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import SupplierRunCard from "../components/SupplierRunCard";
import SupplierRunForm from "../components/SupplierRunForm";

export default function SupplierRunsPage({
  supplierRuns,
  onAddSupplierRun,
  onToggleSupplierRunItem,
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

  const openRuns = supplierRuns.filter(
    (supplierRun) => supplierRun.status !== "complete",
  );

  const completeRuns = supplierRuns.filter(
    (supplierRun) => supplierRun.status === "complete",
  );

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
          Supplier Runs
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Driver Pickup Board
        </h2>

        <p className="mt-2 text-slate-500">
          Dispatch can add pickup POs here. Drivers can check off
          items as they load them from the supplier.
        </p>
      </div>

      {successMessage ? (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="font-bold text-blue-800">
            ✓ {successMessage}
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <SupplierRunForm onSubmit={handleSubmit} />

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">
                Driver Checklist
              </h3>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                {openRuns.length} open{" "}
                {openRuns.length === 1 ? "run" : "runs"}
              </p>
            </div>
          </div>

          {supplierRuns.length === 0 ? (
            <EmptyState
              title="No supplier runs yet"
              description="Add a PO pickup and it will appear here for the driver."
            />
          ) : null}

          {openRuns.length > 0 ? (
            <div className="space-y-3">
              {openRuns.map((supplierRun) => (
                <SupplierRunCard
                  key={supplierRun.id}
                  supplierRun={supplierRun}
                  onToggleItem={onToggleSupplierRunItem}
                />
              ))}
            </div>
          ) : null}

          {completeRuns.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                Completed
              </h3>

              <div className="space-y-3">
                {completeRuns.map((supplierRun) => (
                  <SupplierRunCard
                    key={supplierRun.id}
                    supplierRun={supplierRun}
                    onToggleItem={onToggleSupplierRunItem}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </PageContainer>
  );
}
