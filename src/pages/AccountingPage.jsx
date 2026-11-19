import { useEffect, useState } from "react";
import {
  BarChart3,
  DollarSign,
  Pencil,
  Plus,
  ReceiptText,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import {
  deleteAccountingExpense,
  saveAccountingExpense,
  subscribeToAccountingExpenses,
} from "../utils/accountingExpenseStorage";
import { createId } from "../utils/idHelpers";

const expenseCategories = [
  "Payroll",
  "Payroll Taxes & Benefits",
  "Rent & Property",
  "Insurance",
  "Materials & Supplies",
  "Utilities",
  "Vehicles & Fuel",
  "Equipment & Maintenance",
  "Software & Subscriptions",
  "Professional Services",
  "Office & Admin",
  "Marketing & Advertising",
  "Meals & Travel",
  "Taxes & Licenses",
  "Other",
];

const expenseCategoryColors = [
  "#FC2C38",
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#0891B2",
  "#DB2777",
  "#4F46E5",
  "#65A30D",
  "#EA580C",
  "#0F766E",
  "#9333EA",
  "#475569",
  "#B45309",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getTodayDateValue() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function getEmptyDraft() {
  return {
    description: "",
    vendor: "",
    category: "Other",
    amount: "",
  };
}

function formatCurrencyFromCents(amountCents) {
  return currencyFormatter.format((Number(amountCents) || 0) / 100);
}

function getExpenseCategorySummaries(expenses) {
  const categoryTotals = new Map();

  expenses.forEach((expense) => {
    const category = String(expense.category || "Other").trim() || "Other";
    categoryTotals.set(
      category,
      (categoryTotals.get(category) || 0) +
        (Number(expense.amountCents) || 0),
    );
  });

  const sortedCategories = [...categoryTotals.entries()].sort(
    (firstCategory, secondCategory) => secondCategory[1] - firstCategory[1],
  );
  const totalCents = sortedCategories.reduce(
    (total, [, amountCents]) => total + amountCents,
    0,
  );

  return sortedCategories.map(([category, amountCents], index) => ({
    category,
    amountCents,
    color: expenseCategoryColors[index % expenseCategoryColors.length],
    percentage: totalCents > 0 ? (amountCents / totalCents) * 100 : 0,
  }));
}

function ExpenseCategoryChart({ expenses, totalCents }) {
  const categorySummaries = getExpenseCategorySummaries(expenses);
  let currentPercentage = 0;
  const chartSegments = categorySummaries.map((categorySummary, index) => {
    const startPercentage = currentPercentage;
    currentPercentage += categorySummary.percentage;
    const endPercentage =
      index === categorySummaries.length - 1 ? 100 : currentPercentage;

    return `${categorySummary.color} ${startPercentage}% ${endPercentage}%`;
  });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
            Expense mix
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            By category
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          Monthly
        </span>
      </div>

      {categorySummaries.length ? (
        <>
          <div className="mt-5 flex justify-center">
            <div
              className="relative flex h-44 w-44 items-center justify-center rounded-full shadow-inner"
              style={{
                background: `conic-gradient(${chartSegments.join(", ")})`,
              }}
              role="img"
              aria-label="Fixed expenses by category"
            >
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-slate-100 bg-white px-2 text-center shadow-sm">
                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Monthly total
                </span>
                <span className="mt-1 text-lg font-black text-slate-950">
                  {formatCurrencyFromCents(totalCents)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
            {categorySummaries.map((categorySummary) => (
              <div
                key={categorySummary.category}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-slate-50 px-3 py-2"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: categorySummary.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-900">
                    {categorySummary.category}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {categorySummary.percentage.toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs font-black text-slate-950">
                  {formatCurrencyFromCents(categorySummary.amountCents)}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
          <BarChart3 className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-black text-slate-700">
            Add an expense to build the chart
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Each category will get its own color and percentage.
          </p>
        </div>
      )}
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value, note, tone = "slate" }) {
  const toneClasses = {
    red: "border-red-200 bg-red-50 text-red-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-white text-slate-600",
  };

  return (
    <section className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-[10px] font-black uppercase tracking-[0.12em]">
          {label}
        </p>
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs font-bold text-slate-500">{note}</p>
    </section>
  );
}

export default function AccountingPage({
  currentUser,
  onBack,
}) {
  const [expenses, setExpenses] = useState([]);
  const [draft, setDraft] = useState(getEmptyDraft);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return subscribeToAccountingExpenses(
      (savedExpenses) => {
        setExpenses(savedExpenses);
        setError("");
      },
      (syncError) => {
        console.error("Unable to sync accounting expenses:", syncError);
        setError(
          syncError?.code === "permission-denied"
            ? "Accounting expense access is not enabled in Firebase yet."
            : "Unable to sync expenses. Check your connection and try again.",
        );
      },
    );
  }, []);

  const monthTotalCents = expenses.reduce(
    (total, expense) => total + (Number(expense.amountCents) || 0),
    0,
  );
  const yearTotalCents = monthTotalCents * 12;

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setError("");
  }

  function resetForm() {
    setDraft(getEmptyDraft());
    setEditingExpenseId("");
    setError("");
  }

  async function handleSaveExpense(event) {
    event.preventDefault();
    const amount = Number(draft.amount);
    const category = draft.category.trim();

    if (!draft.description.trim()) {
      setError("Add what the fixed expense is for.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an expense amount greater than $0.00.");
      return;
    }

    if (!category) {
      setError("Choose or enter an expense category.");
      return;
    }

    const existingExpense = expenses.find(
      (expense) => expense.id === editingExpenseId,
    );
    setIsSaving(true);

    try {
      const updatedExpenses = await saveAccountingExpense({
        ...existingExpense,
        id: editingExpenseId || createId(),
        expenseDate: existingExpense?.expenseDate || getTodayDateValue(),
        description: draft.description,
        vendor: draft.vendor,
        category,
        amountCents: Math.round(amount * 100),
        createdById:
          existingExpense?.createdById || currentUser?.id || "",
        createdByName:
          existingExpense?.createdByName || currentUser?.name || "",
        createdByEmail:
          existingExpense?.createdByEmail || currentUser?.email || "",
      });

      setExpenses(updatedExpenses);
      resetForm();
    } catch (saveError) {
      console.error("Unable to save accounting expense:", saveError);
      setError(
        saveError?.code === "permission-denied"
          ? "Accounting expense access is not enabled in Firebase yet."
          : "Unable to save this expense. Check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditExpense(expense) {
    setEditingExpenseId(expense.id);
    setDraft({
      description: expense.description || "",
      vendor: expense.vendor || "",
      category: expense.category || "Other",
      amount: ((Number(expense.amountCents) || 0) / 100).toFixed(2),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteExpense(expense) {
    const shouldDelete = window.confirm(
      `Delete ${expense.description || "this expense"} for ${formatCurrencyFromCents(expense.amountCents)}?`,
    );

    if (!shouldDelete) {
      return;
    }

    try {
      const updatedExpenses = await deleteAccountingExpense(expense.id);
      setExpenses(updatedExpenses);

      if (editingExpenseId === expense.id) {
        resetForm();
      }
    } catch (deleteError) {
      console.error("Unable to delete accounting expense:", deleteError);
      setError("Unable to delete this expense. Check your connection and try again.");
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Accounting", onClick: onBack },
          { label: "Expenses" },
        ]}
      />

      <div className="mt-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Restricted accounting workspace
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Fixed Expenses
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500 sm:text-base">
            Keep one line for each recurring monthly cost. The yearly projection updates automatically.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={DollarSign}
          label="Monthly fixed total"
          value={formatCurrencyFromCents(monthTotalCents)}
          note={`${expenses.length} recurring ${expenses.length === 1 ? "expense" : "expenses"}`}
          tone="red"
        />
        <SummaryCard
          icon={BarChart3}
          label="Yearly projection"
          value={formatCurrencyFromCents(yearTotalCents)}
          note="Monthly fixed total × 12"
          tone="emerald"
        />
        <SummaryCard
          icon={ReceiptText}
          label="Average expense"
          value={formatCurrencyFromCents(
            expenses.length ? monthTotalCents / expenses.length : 0,
          )}
          note="Average monthly line item"
          tone="blue"
        />
        <SummaryCard
          icon={Tag}
          label="Categories"
          value={new Set(expenses.map((expense) => expense.category || "Other")).size}
          note="Across fixed costs"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                Quick entry
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {editingExpenseId ? "Edit expense" : "Add an expense"}
              </h2>
            </div>
            {editingExpenseId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel edit
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSaveExpense} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            <label className="md:col-span-2 xl:col-span-8">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                What was it? *
              </span>
              <input
                type="text"
                value={draft.description}
                onChange={(event) => updateDraft("description", event.target.value)}
                placeholder="Example: Monthly payroll"
                maxLength={200}
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-950 outline-none transition focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
              />
            </label>
            <label className="xl:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                Monthly amount *
              </span>
              <span className="relative mt-1.5 block">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-black text-slate-500">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={draft.amount}
                  onChange={(event) => updateDraft("amount", event.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-7 pr-3 text-sm font-black text-slate-950 outline-none transition focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
                />
              </span>
            </label>
            <label className="xl:col-span-5">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                Vendor / paid to
              </span>
              <input
                type="text"
                value={draft.vendor}
                onChange={(event) => updateDraft("vendor", event.target.value)}
                placeholder="Optional"
                maxLength={150}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-950 outline-none transition focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
              />
            </label>
            <label className="xl:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                Category *
              </span>
              <input
                type="text"
                list="fixed-expense-categories"
                value={draft.category}
                onChange={(event) => updateDraft("category", event.target.value)}
                placeholder="Choose or type a category"
                maxLength={100}
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-950 outline-none transition focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
              />
              <datalist id="fixed-expense-categories">
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </datalist>
              <span className="mt-1.5 block text-[10px] font-bold text-slate-500">
                Select a suggestion or type a new category.
              </span>
            </label>
            <div className="flex items-end xl:col-span-3">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white shadow-md transition hover:bg-red-600 disabled:cursor-wait disabled:opacity-60"
              >
                {editingExpenseId ? (
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {isSaving
                  ? "Saving..."
                  : editingExpenseId
                    ? "Save changes"
                    : "Add expense"}
              </button>
            </div>
          </form>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}
        </section>
        <ExpenseCategoryChart expenses={expenses} totalCents={monthTotalCents} />
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FC2C38]">
              Monthly fixed expense list
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Recurring expenses
            </h2>
          </div>
          <p className="text-lg font-black text-slate-950">
            {formatCurrencyFromCents(monthTotalCents)}
          </p>
        </div>

        {expenses.length ? (
          <div className="divide-y divide-slate-100">
            {expenses.map((expense) => (
              <article
                key={expense.id}
                className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-6 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-950">
                    {expense.description}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
                      <Tag className="h-3 w-3" aria-hidden="true" />
                      {expense.category || "Other"}
                    </p>
                    <span className="text-slate-300">•</span>
                    <p className="truncate text-xs font-bold text-slate-500">
                      {expense.vendor || "No vendor entered"}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-black text-slate-950 md:text-right">
                  {formatCurrencyFromCents(expense.amountCents)}
                </p>
                <div className="flex items-center gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => handleEditExpense(expense)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
                    aria-label={`Edit ${expense.description}`}
                    title="Edit expense"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(expense)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50"
                    aria-label={`Delete ${expense.description}`}
                    title="Delete expense"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <ReceiptText className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-black text-slate-950">
              No fixed expenses yet
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Add each recurring monthly cost once and the totals will update automatically.
            </p>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
