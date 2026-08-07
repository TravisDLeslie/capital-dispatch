import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  MailCheck,
  Search,
  SkipForward,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { formatCustomerName } from "../utils/textFormatters";

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month) {
  if (!month) {
    return "";
  }

  const [year, monthNumber] = month.split("-");
  const monthDate = new Date(Number(year), Number(monthNumber) - 1, 1);

  return monthDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusMeta(status) {
  if (status === "paid") {
    return {
      label: "Paid",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (status === "sent") {
    return {
      label: "Sent",
      className: "bg-blue-100 text-blue-700",
    };
  }

  if (status === "skipped") {
    return {
      label: "Skipped",
      className: "bg-slate-200 text-slate-600",
    };
  }

  return {
    label: "Not Sent",
    className: "bg-amber-100 text-amber-800",
  };
}

function customerMatchesSearch(customer, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    customer.customerName,
    customer.accountNumber,
    customer.contactName,
    customer.contactEmail,
    customer.contactLabel,
    customer.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedSearch);
}

export default function CustomerPaymentLinksPage({
  customers,
  paymentLinks,
  currentUser,
  onEnsureMonth,
  onUpdatePaymentLink,
  onPageChange,
}) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const eligibleCustomers = useMemo(
    () =>
      (Array.isArray(customers) ? customers : []).filter(
        (customer) => customer.needsPaymentLink,
      ),
    [customers],
  );
  const selectedMonthLinks = useMemo(
    () =>
      (Array.isArray(paymentLinks) ? paymentLinks : []).filter(
        (paymentLink) => paymentLink.month === selectedMonth,
      ),
    [paymentLinks, selectedMonth],
  );
  const filteredLinks = selectedMonthLinks.filter((paymentLink) =>
    customerMatchesSearch(paymentLink, searchTerm),
  );
  const notSentCount = selectedMonthLinks.filter(
    (paymentLink) => paymentLink.status === "notSent" || !paymentLink.status,
  ).length;
  const sentCount = selectedMonthLinks.filter(
    (paymentLink) => paymentLink.status === "sent",
  ).length;
  const paidCount = selectedMonthLinks.filter(
    (paymentLink) => paymentLink.status === "paid",
  ).length;
  const skippedCount = selectedMonthLinks.filter(
    (paymentLink) => paymentLink.status === "skipped",
  ).length;

  async function handleEnsureMonth() {
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      await onEnsureMonth(selectedMonth);
      setMessage(`${formatMonth(selectedMonth)} payment checklist is ready.`);
    } catch (ensureError) {
      console.error("Unable to create payment link checklist:", ensureError);
      setError(getFirebaseErrorMessage(ensureError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(paymentLink, status) {
    const now = new Date().toISOString();
    const updates = {
      status,
      updatedById: currentUser?.id || "",
      updatedByName: currentUser?.name || "",
      updatedByEmail: currentUser?.email || "",
    };

    if (status === "sent") {
      updates.sentAt = now;
    }

    if (status === "paid") {
      updates.paidAt = now;
    }

    setError("");
    setMessage("");

    try {
      await onUpdatePaymentLink(paymentLink.id, updates);
    } catch (statusError) {
      console.error("Unable to update payment link:", statusError);
      setError(getFirebaseErrorMessage(statusError));
    }
  }

  async function handleNotesChange(paymentLink, notes) {
    try {
      await onUpdatePaymentLink(paymentLink.id, { notes });
    } catch (notesError) {
      console.error("Unable to update payment link notes:", notesError);
      setError(getFirebaseErrorMessage(notesError));
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Sales", onClick: () => onPageChange?.("sales") },
          { label: "Payment Links" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Customers
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            Payment Links
          </h1>

          <p className="mt-2 max-w-3xl text-lg text-slate-500">
            Build a monthly checklist for customers who need payment links and
            mark each one sent, paid, or skipped.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onPageChange?.("customers-view")}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Manage Customers
        </button>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Month
            </span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                setSelectedMonth(event.target.value);
                setMessage("");
                setError("");
              }}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Search This Month
            </span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                strokeWidth={2.4}
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search customer, account #, contact, or email"
                className="w-full rounded-xl border border-slate-300 py-3 pl-12 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </span>
          </label>

          <button
            type="button"
            onClick={handleEnsureMonth}
            disabled={isSaving}
            className="inline-flex min-h-[50px] items-center justify-center rounded-xl bg-[#FC2C38] px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSaving ? "Building..." : "Build Month"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Link Customers
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {eligibleCustomers.length}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              Not Sent
            </p>
            <p className="mt-2 text-3xl font-black text-amber-900">
              {notSentCount}
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              Sent
            </p>
            <p className="mt-2 text-3xl font-black text-blue-900">
              {sentCount}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              Paid
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-900">
              {paidCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Skipped
            </p>
            <p className="mt-2 text-3xl font-black text-slate-700">
              {skippedCount}
            </p>
          </div>
        </div>
      </section>

      {selectedMonthLinks.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <CircleDollarSign
            aria-hidden="true"
            className="mx-auto h-12 w-12 text-[#FC2C38]"
            strokeWidth={2.3}
          />
          <h2 className="mt-4 text-2xl font-black text-slate-950">
            No checklist for {formatMonth(selectedMonth)} yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
            Mark customers as needing monthly payment links, then build the
            month here.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          {filteredLinks.map((paymentLink) => {
            const statusMeta = getStatusMeta(paymentLink.status);

            return (
              <article
                key={paymentLink.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>

                      {paymentLink.accountNumber ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Account # {paymentLink.accountNumber}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-2xl font-black text-slate-950">
                      {formatCustomerName(paymentLink.customerName)}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {paymentLink.contactLabel
                        ? `${paymentLink.contactLabel} · `
                        : ""}
                      {paymentLink.contactName || "No contact name"}
                    </p>

                    <p className="mt-1 break-words text-sm font-black text-slate-700">
                      {paymentLink.contactEmail || "No email saved"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-400">
                      {paymentLink.sentAt ? (
                        <span>Sent {formatTimestamp(paymentLink.sentAt)}</span>
                      ) : null}
                      {paymentLink.paidAt ? (
                        <span>Paid {formatTimestamp(paymentLink.paidAt)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 lg:w-[390px]">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(paymentLink, "sent")}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      <MailCheck
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={2.5}
                      />
                      Sent
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(paymentLink, "paid")}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <CheckCircle2
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={2.5}
                      />
                      Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(paymentLink, "skipped")}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-600 transition hover:bg-slate-100"
                    >
                      <SkipForward
                        aria-hidden="true"
                        className="h-4 w-4"
                        strokeWidth={2.5}
                      />
                      Skip
                    </button>
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Notes
                  </span>
                  <textarea
                    defaultValue={paymentLink.notes || ""}
                    onBlur={(event) =>
                      handleNotesChange(paymentLink, event.target.value)
                    }
                    rows={2}
                    placeholder="Anything helpful for this month's payment link..."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>
              </article>
            );
          })}
        </section>
      )}
    </PageContainer>
  );
}
