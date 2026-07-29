import { useMemo, useState } from "react";
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
}) {
  const [searchValue, setSearchValue] = useState("");

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

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
          PO Lookup
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Search Receiving
        </h2>

        <p className="mt-2 text-slate-500">
          Search by PO, customer, contact, job, stock, vendor,
          material, or yard location.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="receivingSearch"
          className="mb-2 block text-sm font-bold text-slate-700"
        >
          Search
        </label>

        <input
          id="receivingSearch"
          type="search"
          autoComplete="off"
          value={searchValue}
          onChange={(event) =>
            setSearchValue(event.target.value)
          }
          placeholder="Search PO, customer, job, stock..."
          className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg font-bold text-slate-900 outline-none transition placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />

        {hasSearch ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {matchingCheckIns.length}{" "}
            {matchingCheckIns.length === 1
              ? "record"
              : "records"}{" "}
            found
          </p>
        ) : null}
      </div>

      {!hasSearch ? (
        <EmptyState
          title="Search receiving records"
          description="Enter a PO number, customer, contact, job, stock, vendor, material, or location."
        />
      ) : null}

      {hasSearch && matchingCheckIns.length === 0 ? (
        <EmptyState
          title="No matching records found"
          description="Check the spelling or try searching with fewer words."
        />
      ) : null}

      {matchingCheckIns.length > 0 ? (
        <div className="space-y-3">
          {matchingCheckIns.map((checkIn) => (
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
    </PageContainer>
  );
}
