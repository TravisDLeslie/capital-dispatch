import { useMemo, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import CheckInCard from "../components/CheckInCard";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePoNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function getDateKey(value) {
  if (!value) {
    return "unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return date.toISOString().slice(0, 10);
}

function formatDateGroup(value) {
  if (value === "unknown") {
    return "No Date";
  }

  const [year, month, day] = String(value).split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function groupCheckInsByDateAndVendor(checkIns) {
  const groupsByDate = checkIns.reduce((groups, checkIn) => {
    const dateKey = getDateKey(checkIn.checkedInAt);

    return {
      ...groups,
      [dateKey]: [...(groups[dateKey] || []), checkIn],
    };
  }, {});

  return Object.entries(groupsByDate)
    .sort(([firstDate], [secondDate]) =>
      secondDate.localeCompare(firstDate),
    )
    .map(([dateKey, dateCheckIns]) => {
      const groupsByVendor = dateCheckIns.reduce((groups, checkIn) => {
        const vendor = checkIn.vendor || "No vendor";

        return {
          ...groups,
          [vendor]: [...(groups[vendor] || []), checkIn],
        };
      }, {});

      return {
        dateKey,
        label: formatDateGroup(dateKey),
        checkIns: dateCheckIns,
        vendorGroups: Object.entries(groupsByVendor)
          .sort(([firstVendor], [secondVendor]) =>
            firstVendor.localeCompare(secondVendor),
          )
          .map(([vendor, vendorCheckIns]) => ({
            vendor,
            checkIns: vendorCheckIns.sort(
              (firstCheckIn, secondCheckIn) =>
                new Date(secondCheckIn.checkedInAt) -
                new Date(firstCheckIn.checkedInAt),
            ),
          })),
      };
    });
}

function getAssignment(checkIn) {
  if (checkIn.orderAssignment?.type) {
    return checkIn.orderAssignment;
  }

  if (checkIn.customer?.businessName) {
    return {
      type: "customer",
      businessName: checkIn.customer.businessName || "",
      orderedBy: checkIn.customer.orderedBy || "",
      jobName: checkIn.customer.jobName || "",
      internalReference: checkIn.customer.internalReference || "",
    };
  }

  return null;
}

export default function SearchPage({
  checkIns,
  onDeleteCheckIn,
  onUpdateAssignment,
  onPageChange,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [openDateGroups, setOpenDateGroups] = useState({});
  const [openVendorGroups, setOpenVendorGroups] = useState({});

  const matchingCheckIns = useMemo(() => {
    const textSearch = normalizeText(searchValue);
    const poSearch = normalizePoNumber(searchValue);

    if (!textSearch) {
      return [];
    }

    return checkIns
      .filter((checkIn) => {
        const assignment = getAssignment(checkIn);

        const poMatches =
          poSearch.length > 0 &&
          normalizePoNumber(checkIn.poNumber).includes(
            poSearch,
          );

        const stockMatches =
          assignment?.type === "stock" &&
          "stock".includes(textSearch);

        const customerOrderMatches =
          assignment?.type === "customer" &&
          "customer order".includes(textSearch);

        const unassignedMatches =
          !assignment &&
          ("unassigned".includes(textSearch) ||
            "not assigned".includes(textSearch));

        const businessMatches = normalizeText(
          assignment?.businessName,
        ).includes(textSearch);

        const orderedByMatches = normalizeText(
          assignment?.orderedBy,
        ).includes(textSearch);

        const jobMatches = normalizeText(
          assignment?.jobName,
        ).includes(textSearch);

        const assignmentReferenceMatches = normalizeText(
          assignment?.internalReference,
        ).includes(textSearch);

        const vendorMatches = normalizeText(
          checkIn.vendor,
        ).includes(textSearch);

        const locationMatches = normalizeText(
          checkIn.poLocation,
        ).includes(textSearch);

        const materialMatches = Array.isArray(
          checkIn.materials,
        )
          ? checkIn.materials.some((material) =>
              normalizeText(
                material.description,
              ).includes(textSearch),
            )
          : false;

        return (
          poMatches ||
          stockMatches ||
          customerOrderMatches ||
          unassignedMatches ||
          businessMatches ||
          orderedByMatches ||
          jobMatches ||
          assignmentReferenceMatches ||
          vendorMatches ||
          locationMatches ||
          materialMatches
        );
      })
      .sort(
        (firstCheckIn, secondCheckIn) =>
          new Date(secondCheckIn.checkedInAt) -
          new Date(firstCheckIn.checkedInAt),
      );
  }, [checkIns, searchValue]);

  const hasSearch = searchValue.trim().length > 0;
  const historyCheckIns = hasSearch ? matchingCheckIns : checkIns;
  const historyGroups = useMemo(
    () => groupCheckInsByDateAndVendor(historyCheckIns),
    [historyCheckIns],
  );

  function isDateGroupOpen(dateKey) {
    if (openDateGroups[dateKey] !== undefined) {
      return openDateGroups[dateKey];
    }

    return true;
  }

  function isVendorGroupOpen(groupKey) {
    if (openVendorGroups[groupKey] !== undefined) {
      return openVendorGroups[groupKey];
    }

    return false;
  }

  function toggleDateGroup(dateKey) {
    setOpenDateGroups((currentGroups) => ({
      ...currentGroups,
      [dateKey]: !isDateGroupOpen(dateKey),
    }));
  }

  function toggleVendorGroup(groupKey) {
    setOpenVendorGroups((currentGroups) => ({
      ...currentGroups,
      [groupKey]: !isVendorGroupOpen(groupKey),
    }));
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Receiving", onClick: () => onPageChange?.("receiving") },
          { label: "Receiving History" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
          Receiving History
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Search Receiving
        </h2>

        <p className="mt-2 text-slate-500">
          Search by PO, customer, contact, job, stock, vendor,
          material, or yard location.
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Receiving Records
        </p>

        <p className="mt-1 text-3xl font-black text-slate-900">
          {hasSearch ? matchingCheckIns.length : checkIns.length}
        </p>

        {hasSearch ? (
          <p className="mt-1 text-sm font-bold text-slate-500">
            Showing {matchingCheckIns.length} of {checkIns.length}
          </p>
        ) : null}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="receivingSearch"
          className="mb-2 block text-sm font-bold text-slate-700"
        >
          Search
        </label>

        <div className="flex items-center gap-2">
          <input
            id="receivingSearch"
            type="search"
            autoComplete="off"
            value={searchValue}
            onChange={(event) =>
              setSearchValue(event.target.value)
            }
            placeholder="Search PO, customer, job, stock..."
            className="min-h-[48px] w-full rounded-xl border border-slate-300 px-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          />

          {hasSearch ? (
            <button
              type="button"
              onClick={() => setSearchValue("")}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {checkIns.length === 0 ? (
        <EmptyState
          title="No receiving history yet"
          description="Completed receiving check-ins will show here by date and vendor."
        />
      ) : hasSearch && matchingCheckIns.length === 0 ? (
        <EmptyState
          title="No matching records found"
          description="Check the spelling or try searching with fewer words."
        />
      ) : (
        <div className="space-y-5">
          {historyGroups.map((dateGroup) => {
            const dateIsOpen = isDateGroupOpen(dateGroup.dateKey);

            return (
              <div
                key={dateGroup.dateKey}
                className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
              >
                <button
                  type="button"
                  onClick={() => toggleDateGroup(dateGroup.dateKey)}
                  className="mb-3 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl px-1 py-1 text-left transition hover:bg-slate-50"
                  aria-expanded={dateIsOpen}
                >
                  <span>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                      Check-In Date
                    </span>
                    <span className="mt-1 block text-xl font-black tracking-tight text-slate-900">
                      {dateGroup.label}
                    </span>
                  </span>

                  <span className="flex items-center gap-2">
                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">
                      {dateGroup.checkIns.length}{" "}
                      {dateGroup.checkIns.length === 1 ? "PO" : "POs"}
                    </span>

                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-5 w-5 transition-transform ${
                          dateIsOpen ? "rotate-180" : ""
                        }`}
                        strokeWidth={2.6}
                      />
                    </span>
                  </span>
                </button>

                {dateIsOpen ? (
                  <div className="space-y-4">
                    {dateGroup.vendorGroups.map((vendorGroup) => {
                      const groupKey = `${dateGroup.dateKey}::${vendorGroup.vendor}`;
                      const vendorIsOpen = isVendorGroupOpen(groupKey);
                      const materialCount = vendorGroup.checkIns.reduce(
                        (count, checkIn) =>
                          count +
                          (Array.isArray(checkIn.materials)
                            ? checkIn.materials.length
                            : 0),
                        0,
                      );

                      return (
                        <div
                          key={groupKey}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80"
                        >
                          <button
                            type="button"
                            onClick={() => toggleVendorGroup(groupKey)}
                            className="flex w-full min-w-0 flex-col gap-3 px-4 py-4 text-left transition hover:bg-slate-100 sm:flex-row sm:items-center sm:justify-between"
                            aria-expanded={vendorIsOpen}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#FC2C38] shadow-sm">
                                <Building2
                                  aria-hidden="true"
                                  className="h-6 w-6"
                                  strokeWidth={2.4}
                                />
                              </span>

                              <span className="min-w-0">
                                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                  Vendor
                                </span>
                                <span className="block truncate text-lg font-black text-slate-800">
                                  {vendorGroup.vendor}
                                </span>
                                <span className="mt-1 block text-sm font-semibold text-slate-500">
                                  {vendorGroup.checkIns.length}{" "}
                                  {vendorGroup.checkIns.length === 1
                                    ? "PO"
                                    : "POs"}{" "}
                                  • {materialCount} materials
                                </span>
                              </span>
                            </span>

                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                              <ChevronDown
                                aria-hidden="true"
                                className={`h-5 w-5 transition-transform ${
                                  vendorIsOpen ? "rotate-180" : ""
                                }`}
                                strokeWidth={2.6}
                              />
                            </span>
                          </button>

                          {vendorIsOpen ? (
                            <div className="space-y-3 border-t border-slate-200 bg-white p-3">
                              {vendorGroup.checkIns.map((checkIn) => (
                                <CheckInCard
                                  key={checkIn.id}
                                  checkIn={checkIn}
                                  showFullDate
                                  onDelete={onDeleteCheckIn}
                                  onUpdateAssignment={onUpdateAssignment}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
