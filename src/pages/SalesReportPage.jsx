import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CreditCard,
  DollarSign,
  Save,
  Trophy,
  UsersRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { createId } from "../utils/idHelpers";

function getCurrentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month) {
  if (!month) {
    return "No month";
  }

  const parsedDate = new Date(`${month}-01T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return month;
  }

  return parsedDate.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function createEmptySpender() {
  return {
    id: createId(),
    name: "",
    amount: "",
  };
}

function getReportTotal(report) {
  return (Number(report?.cashCardSales) || 0) + (Number(report?.chargeSales) || 0);
}

function SalesMetric({ icon: Icon, label, value, note, tone = "default" }) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-950",
    cash: "border-emerald-200 bg-emerald-50/40 text-emerald-800",
    charge: "border-blue-200 bg-blue-50/40 text-blue-900",
    total: "border-rose-200 bg-rose-50/40 text-rose-900",
  };

  return (
    <article className={`min-w-0 rounded-2xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
        {label}
      </p>
      <p className="mt-3 break-words text-[clamp(1.75rem,3vw,2.35rem)] font-black leading-none tracking-normal">
        {value}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-500">
        {note}
      </p>
    </article>
  );
}

function ReportSummary({ report }) {
  const topSpenders = Array.isArray(report?.topSpenders)
    ? report.topSpenders.filter((spender) => spender.name || spender.amount)
    : [];

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            <CalendarDays aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            {formatMonth(report?.month)}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Sales Pulse
          </h2>
        </div>
        <span className="rounded-2xl bg-rose-50 px-4 py-2 text-right">
          <span className="block text-[clamp(1.25rem,3vw,1.75rem)] font-black leading-none text-rose-900">
            {formatCurrency(getReportTotal(report))}
          </span>
          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            Total sales
          </span>
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SalesMetric
          icon={CreditCard}
          label="Cash/Card"
          value={formatCurrency(report?.cashCardSales)}
          note="Paid at sale"
          tone="cash"
        />
        <SalesMetric
          icon={Banknote}
          label="Charge"
          value={formatCurrency(report?.chargeSales)}
          note="Account sales"
          tone="charge"
        />
        <SalesMetric
          icon={DollarSign}
          label="Total"
          value={formatCurrency(getReportTotal(report))}
          note="Month total"
          tone="total"
        />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="flex items-center gap-2 text-sm font-black text-slate-950">
          <Trophy aria-hidden="true" className="h-4 w-4 text-amber-600" strokeWidth={2.5} />
          Top 5 Spenders
        </p>

        {topSpenders.length > 0 ? (
          <div className="mt-3 space-y-2">
            {topSpenders.slice(0, 5).map((spender, index) => (
              <div
                key={spender.id || `${spender.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="mr-2 text-xs font-black text-slate-400">
                    #{index + 1}
                  </span>
                  <span className="font-black text-slate-900">
                    {spender.name || "Unnamed customer"}
                  </span>
                </span>
                <span className="shrink-0 font-black text-slate-900">
                  {formatCurrency(spender.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            No top spenders entered for this month.
          </p>
        )}
      </div>
    </article>
  );
}

export default function SalesReportPage({
  reports,
  isSuperAdmin,
  onSaveReport,
  onPageChange,
}) {
  const sortedReports = useMemo(
    () =>
      [...(Array.isArray(reports) ? reports : [])].sort((firstReport, secondReport) =>
        String(secondReport.month || "").localeCompare(
          String(firstReport.month || ""),
        ),
      ),
    [reports],
  );
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const selectedReport =
    sortedReports.find((report) => report.month === selectedMonth) || null;
  const [cashCardSales, setCashCardSales] = useState("");
  const [chargeSales, setChargeSales] = useState("");
  const [topSpenders, setTopSpenders] = useState([
    createEmptySpender(),
    createEmptySpender(),
    createEmptySpender(),
    createEmptySpender(),
    createEmptySpender(),
  ]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadReportIntoForm(selectedReport);
  }, [selectedReport]);

  function loadReportIntoForm(report) {
    setCashCardSales(report ? String(report.cashCardSales || "") : "");
    setChargeSales(report ? String(report.chargeSales || "") : "");
    setTopSpenders(
      Array.from({ length: 5 }, (_, index) => {
        const spender = report?.topSpenders?.[index];

        return spender
          ? {
              id: spender.id || createId(),
              name: spender.name || "",
              amount: spender.amount ? String(spender.amount) : "",
            }
          : createEmptySpender();
      }),
    );
  }

  function handleMonthChange(month) {
    const report = sortedReports.find(
      (currentReport) => currentReport.month === month,
    );

    setSelectedMonth(month);
    loadReportIntoForm(report);
    setMessage("");
    setError("");
  }

  function updateSpender(spenderId, field, value) {
    setTopSpenders((currentSpenders) =>
      currentSpenders.map((spender) =>
        spender.id === spenderId
          ? {
              ...spender,
              [field]: value,
            }
          : spender,
      ),
    );
  }

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!isSuperAdmin) {
      setError("Only super admin can save sales reports.");
      return;
    }

    if (!selectedMonth) {
      setError("Choose a month before saving.");
      return;
    }

    setIsSaving(true);

    try {
      await onSaveReport({
        month: selectedMonth,
        cashCardSales,
        chargeSales,
        topSpenders: topSpenders
          .filter((spender) => spender.name.trim() || spender.amount)
          .slice(0, 5),
      });
      setMessage(`${formatMonth(selectedMonth)} sales report saved.`);
    } catch (saveError) {
      console.error("Unable to save sales report:", saveError);
      setError(saveError.message || "Unable to save sales report.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Sales", onClick: () => onPageChange?.("sales") },
          { label: "Sales Pulse" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            <DollarSign aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            Sales Admin
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            Sales Pulse
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            Monthly cash/card sales, charge sales, and top customer spenders.
          </p>
        </div>
      </div>

      <section className="space-y-5">
        <ReportSummary
          report={
            selectedReport || {
              month: selectedMonth,
              cashCardSales: 0,
              chargeSales: 0,
              topSpenders: [],
            }
          }
        />

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          {isSuperAdmin ? (
            <form
              onSubmit={handleSave}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-black text-slate-900">
                    Month
                  </span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => handleMonthChange(event.target.value)}
                    className="mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-slate-900">
                    Cash / Credit Card Sales
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashCardSales}
                    onChange={(event) => setCashCardSales(event.target.value)}
                    placeholder="0.00"
                    className="mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-black text-slate-900">
                    Charge Sales
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={chargeSales}
                    onChange={(event) => setChargeSales(event.target.value)}
                    placeholder="0.00"
                    className="mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                  />
                </label>
              </div>

              <div className="mt-5">
                <p className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <UsersRound aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                  Top 5 Spenders
                </p>
                <div className="mt-3 space-y-3">
                  {topSpenders.map((spender, index) => (
                    <div
                      key={spender.id}
                      className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[auto_1fr_160px]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-500">
                        #{index + 1}
                      </span>
                      <input
                        type="text"
                        value={spender.name}
                        onChange={(event) =>
                          updateSpender(spender.id, "name", event.target.value)
                        }
                        placeholder="Customer name"
                        className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={spender.amount}
                        onChange={(event) =>
                          updateSpender(spender.id, "amount", event.target.value)
                        }
                        placeholder="Amount"
                        className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSaving}
                className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save aria-hidden="true" className="h-5 w-5" strokeWidth={2.6} />
                {isSaving ? "Saving..." : "Save Sales Month"}
              </button>
            </form>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black text-slate-950">
                Admin view only
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Super admin enters monthly sales totals. Admins can review the
                current month and history.
              </p>
            </div>
          )}

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <label className="block">
              <span className="text-sm font-black text-slate-900">
                View Month
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => handleMonthChange(event.target.value)}
                className="mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </label>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
              History
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Monthly Reports
            </h2>

            {sortedReports.length > 0 ? (
              <div className="mt-4 space-y-3">
                {sortedReports.map((report) => (
                  <button
                    key={report.month}
                    type="button"
                    onClick={() => handleMonthChange(report.month)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      selectedMonth === report.month
                        ? "border-[#FC2C38] bg-red-50"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <span>
                      <span className="block font-black text-slate-950">
                        {formatMonth(report.month)}
                      </span>
                      <span className="block text-sm font-bold text-slate-500">
                        Cash/Card {formatCurrency(report.cashCardSales)} · Charge{" "}
                        {formatCurrency(report.chargeSales)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-black text-slate-950">
                      {formatCurrency(getReportTotal(report))}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-black text-slate-900">
                  No sales reports yet
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Super admin can add this month’s totals to start the history.
                </p>
              </div>
            )}
          </section>
        </div>
        </div>
      </section>
    </PageContainer>
  );
}
