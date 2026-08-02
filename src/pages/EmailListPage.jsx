import {
  Download,
  FolderPlus,
  Mail,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";
import { createId } from "../utils/idHelpers";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getCustomerLabel(customer) {
  return customer.companyName || customer.name || "Customer";
}

function collectCustomerEmailOptions(customers) {
  return customers.flatMap((customer) => {
    const customerName = getCustomerLabel(customer);
    const options = [];

    if (customer.email) {
      options.push({
        id: `${customer.id}-main`,
        email: customer.email,
        name: customer.name || "",
        companyName: customerName,
        source: "Account Email",
        customerId: customer.id,
      });
    }

    if (Array.isArray(customer.contacts)) {
      customer.contacts.forEach((contact) => {
        if (!contact.email) {
          return;
        }

        options.push({
          id: `${customer.id}-${contact.id}`,
          email: contact.email,
          name: contact.name || contact.label || "",
          companyName: customerName,
          source: contact.label || "Contact",
          customerId: customer.id,
          contactId: contact.id,
        });
      });
    }

    return options;
  });
}

function escapeCsvValue(value) {
  const stringValue = String(value || "");

  if (
    stringValue.includes(",") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }

  return stringValue;
}

function createCsvFileName(group) {
  const safeGroup = String(group || "email-list")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${safeGroup || "email-list"}-emails.csv`;
}

export default function EmailListPage({
  customers,
  emailList,
  onAddEmailListEntry,
  onDeleteEmailListEntry,
}) {
  const savedEmailList = Array.isArray(emailList) ? emailList : [];
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCompanyName, setManualCompanyName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("General");
  const [newGroupName, setNewGroupName] = useState("");
  const [createdGroups, setCreatedGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const savedEmailSet = useMemo(
    () => {
      const entries = Array.isArray(emailList) ? emailList : [];

      return new Set(
        entries.map((entry) => normalizeEmail(entry.email)),
      );
    },
    [emailList],
  );

  const emailGroups = useMemo(() => {
    const entries = Array.isArray(emailList) ? emailList : [];
    const groups = new Set(["General"]);

    createdGroups.forEach((group) => {
      if (group) {
        groups.add(group);
      }
    });

    entries.forEach((entry) => {
      if (entry.group) {
        groups.add(String(entry.group));
      }
    });

    return [...groups].sort((firstGroup, secondGroup) =>
      firstGroup.localeCompare(secondGroup),
    );
  }, [createdGroups, emailList]);

  const customerEmailOptions = useMemo(() => {
    const optionsByEmail = new Map();
    const customerList = Array.isArray(customers) ? customers : [];

    collectCustomerEmailOptions(customerList).forEach((option) => {
      const normalizedEmail = normalizeEmail(option.email);

      if (!normalizedEmail || optionsByEmail.has(normalizedEmail)) {
        return;
      }

      optionsByEmail.set(normalizedEmail, {
        ...option,
        email: normalizedEmail,
      });
    });

    return [...optionsByEmail.values()].sort((firstOption, secondOption) =>
      String(firstOption.companyName || "").localeCompare(
        String(secondOption.companyName || ""),
      ),
    );
  }, [customers]);

  const availableCustomerEmailOptions = customerEmailOptions.filter(
    (option) => !savedEmailSet.has(normalizeEmail(option.email)),
  );

  const filteredCustomerEmailOptions = availableCustomerEmailOptions.filter(
    (option) => {
      const query = searchQuery.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return [
        option.email,
        option.name,
        option.companyName,
        option.source,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    },
  );

  const filteredEmailList = savedEmailList.filter((entry) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      entry.email,
      entry.name,
      entry.companyName,
      entry.source,
      entry.group,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const activeGroupEmailList = filteredEmailList.filter(
    (entry) => (entry.group || "General") === selectedGroup,
  );

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  async function addEntry(entry) {
    const normalizedEmail = normalizeEmail(entry.email);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Add a valid email address.");
      setMessage("");
      return;
    }

    if (savedEmailSet.has(normalizedEmail)) {
      setError(`${normalizedEmail} is already in the email list.`);
      setMessage("");
      return;
    }

    setIsSubmitting(true);

    try {
      await onAddEmailListEntry({
        id: createId(),
        email: normalizedEmail,
        name: entry.name?.trim() || "",
        companyName: entry.companyName?.trim() || "",
        group: entry.group?.trim() || selectedGroup,
        source: entry.source || "Manual",
        customerId: entry.customerId || "",
        contactId: entry.contactId || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setMessage(`${normalizedEmail} was added to the email list.`);
      setError("");
      setManualEmail("");
      setManualName("");
      setManualCompanyName("");
    } catch (submitError) {
      console.error("Unable to add email list entry:", submitError);
      setError(getFirebaseErrorMessage(submitError));
      setMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManualSubmit(event) {
    event.preventDefault();

    await addEntry({
      email: manualEmail,
      name: manualName,
      companyName: manualCompanyName,
      source: "Manual",
    });
  }

  function handleAddGroup(event) {
    event.preventDefault();

    const trimmedGroupName = newGroupName.trim();

    if (!trimmedGroupName) {
      setError("Add a group name first.");
      setMessage("");
      return;
    }

    setCreatedGroups((currentGroups) =>
      currentGroups.includes(trimmedGroupName)
        ? currentGroups
        : [...currentGroups, trimmedGroupName],
    );
    setSelectedGroup(trimmedGroupName);
    setNewGroupName("");
    setMessage(`${trimmedGroupName} is ready. New emails will be added there.`);
    setError("");
  }

  async function handleDelete(entry) {
    setIsSubmitting(true);

    try {
      await onDeleteEmailListEntry(entry.id);
      setMessage(`${entry.email} was removed from the email list.`);
      setError("");
    } catch (deleteError) {
      console.error("Unable to delete email list entry:", deleteError);
      setError(getFirebaseErrorMessage(deleteError));
      setMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleExportGroup() {
    if (activeGroupEmailList.length === 0) {
      setError(`No emails to export for ${selectedGroup}.`);
      setMessage("");
      return;
    }

    const headers = [
      "Email",
      "Name",
      "Company",
      "Source",
      "Group",
      "Created At",
    ];
    const rows = activeGroupEmailList.map((entry) => [
      entry.email,
      entry.name,
      entry.companyName,
      entry.source,
      entry.group || "General",
      entry.createdAt,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const csvBlob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const csvUrl = URL.createObjectURL(csvBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = csvUrl;
    downloadLink.download = createCsvFileName(selectedGroup);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(csvUrl);

    setMessage(
      `Exported ${activeGroupEmailList.length} emails from ${selectedGroup}.`,
    );
    setError("");
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Admin
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Email List
        </h1>

        <p className="mt-2 max-w-3xl text-lg text-slate-500">
          Build a reusable email list from customer accounts and manually added
          contacts.
        </p>
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

      <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <FolderPlus
              aria-hidden="true"
              className="h-6 w-6"
              strokeWidth={2.4}
            />
          </span>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              List Group
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Pick where new manual or account emails should be saved.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Active Group
            </span>
            <select
              value={selectedGroup}
              onChange={(event) => {
                setSelectedGroup(event.target.value);
                clearFeedback();
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
            >
              {emailGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>

          <form onSubmit={handleAddGroup} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                New Group
              </span>
              <input
                type="text"
                value={newGroupName}
                onChange={(event) => {
                  setNewGroupName(event.target.value);
                  clearFeedback();
                }}
                placeholder="Contractors, Designers, Accounts Payable"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Create Group
            </button>
          </form>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
              <Plus aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Add Manually
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Add a one-off email that is not attached to a customer account.
              </p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Email
              </span>
              <input
                type="email"
                value={manualEmail}
                onChange={(event) => {
                  setManualEmail(event.target.value);
                  clearFeedback();
                }}
                disabled={isSubmitting}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Name
                </span>
                <input
                  type="text"
                  value={manualName}
                  onChange={(event) => {
                    setManualName(event.target.value);
                    clearFeedback();
                  }}
                  disabled={isSubmitting}
                  placeholder="Contact name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Company
                </span>
                <input
                  type="text"
                  value={manualCompanyName}
                  onChange={(event) => {
                    setManualCompanyName(event.target.value);
                    clearFeedback();
                  }}
                  disabled={isSubmitting}
                  placeholder="Company"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <UserPlus
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.4}
              />
              Add Email
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Search aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Select From Accounts
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Import emails already saved on customer accounts and contacts.
              </p>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Search
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search email, account, company, or contact"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </label>

          <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto pr-1">
            {filteredCustomerEmailOptions.length > 0 ? (
              filteredCustomerEmailOptions.map((option) => (
                <div
                  key={option.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-900">
                      {option.email}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {[option.name, option.companyName, option.source]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                      Add to {selectedGroup}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      addEntry({
                        ...option,
                        group: selectedGroup,
                      })
                    }
                    disabled={isSubmitting}
                    className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Add
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
                No available account emails found.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
              Saved List
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              {activeGroupEmailList.length} {selectedGroup} Emails
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <button
              type="button"
              onClick={handleExportGroup}
              disabled={activeGroupEmailList.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <Download
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.4}
              />
              Export CSV
            </button>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {emailGroups.map((group) => {
                const groupCount = savedEmailList.filter(
                  (entry) => (entry.group || "General") === group,
                ).length;
                const isActive = selectedGroup === group;

                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setSelectedGroup(group)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                      isActive
                        ? "bg-[#FC2C38] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {group} ({groupCount})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {activeGroupEmailList.length > 0 ? (
            activeGroupEmailList.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900">
                    {entry.email}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {[entry.name, entry.companyName, entry.source]
                      .filter(Boolean)
                      .join(" • ") || "Email list"}
                  </p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                    {entry.group || "General"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(entry)}
                  disabled={isSubmitting}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <Trash2
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={2.4}
                  />
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
              <Mail
                aria-hidden="true"
                className="mx-auto h-9 w-9 text-slate-400"
                strokeWidth={2.2}
              />
              <p className="mt-3 text-base font-black text-slate-900">
                No saved emails yet
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Add one manually or import from customer accounts.
              </p>
            </div>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
