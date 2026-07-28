import { useState } from "react";
import {
  Building2,
  CircleCheckBig,
  Clock3,
  MapPin,
  Package,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  formatFullDate,
  formatShortDate,
  formatTime,
} from "../utils/dateHelpers";

function getSavedAssignment(checkIn) {
  if (checkIn.orderAssignment?.type) {
    return checkIn.orderAssignment;
  }

  if (checkIn.customer?.businessName) {
    return {
      type: "customer",
      businessName: checkIn.customer.businessName || "",
      orderedBy: checkIn.customer.orderedBy || "",
      jobName: checkIn.customer.jobName || "",
    };
  }

  return null;
}

export default function CheckInCard({
  checkIn,
  showFullDate = false,
  onDelete,
  onUpdateAssignment,
}) {
  const savedAssignment = getSavedAssignment(checkIn);

  const materials = Array.isArray(checkIn.materials)
    ? checkIn.materials
    : [];

  const [isEditing, setIsEditing] = useState(false);
  const [assignmentType, setAssignmentType] = useState(
    savedAssignment?.type || "",
  );

  const [businessName, setBusinessName] = useState(
    savedAssignment?.businessName || "",
  );

  const [orderedBy, setOrderedBy] = useState(
    savedAssignment?.orderedBy || "",
  );

  const [jobName, setJobName] = useState(
    savedAssignment?.jobName || "",
  );

  const [assignmentError, setAssignmentError] = useState("");

  function openEditor() {
    const currentAssignment = getSavedAssignment(checkIn);

    setAssignmentType(currentAssignment?.type || "");
    setBusinessName(currentAssignment?.businessName || "");
    setOrderedBy(currentAssignment?.orderedBy || "");
    setJobName(currentAssignment?.jobName || "");
    setAssignmentError("");
    setIsEditing(true);
  }

  function closeEditor() {
    setIsEditing(false);
    setAssignmentError("");
  }

  function selectAssignmentType(type) {
    setAssignmentType(type);
    setAssignmentError("");

    if (type === "stock") {
      setBusinessName("");
      setOrderedBy("");
      setJobName("");
    }
  }

  function handleAssignmentSave(event) {
    event.preventDefault();

    if (!assignmentType) {
      setAssignmentError("Choose Customer Order or Stock.");
      return;
    }

    if (
      assignmentType === "customer" &&
      !businessName.trim()
    ) {
      setAssignmentError(
        "Enter the business or customer name.",
      );
      return;
    }

    const orderAssignment =
      assignmentType === "stock"
        ? {
            type: "stock",
            businessName: "",
            orderedBy: "",
            jobName: "",
          }
        : {
            type: "customer",
            businessName: businessName.trim(),
            orderedBy: orderedBy.trim(),
            jobName: jobName.trim(),
          };

    onUpdateAssignment(checkIn.id, orderAssignment);
    setAssignmentError("");
    setIsEditing(false);
  }

  function getAssignmentHeading() {
    if (savedAssignment?.type === "stock") {
      return "Stock";
    }

    if (savedAssignment?.type === "customer") {
      return savedAssignment.businessName;
    }

    return "Not assigned";
  }

  function getAssignmentSubheading() {
    if (savedAssignment?.type === "stock") {
      return "Capital Lumber inventory";
    }

    if (savedAssignment?.type === "customer") {
      return [
        savedAssignment.orderedBy
          ? `Ordered by ${savedAssignment.orderedBy}`
          : "",
        savedAssignment.jobName || "",
      ]
        .filter(Boolean)
        .join(" • ");
    }

    return "Link a customer or mark as stock";
  }

  const visibleMaterials = materials.slice(0, 3);
  const hiddenMaterialCount = Math.max(
    materials.length - visibleMaterials.length,
    0,
  );

  return (
    <article className="rounded-[28px] border border-[#DCE4EF] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.10)] transition hover:border-slate-300 sm:p-8 xl:p-12">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:gap-10">
          <h2 className="text-5xl font-black leading-none tracking-tight text-[#0F172A] sm:text-6xl">
            {checkIn.poNumber}
          </h2>

          <div className="flex min-w-0 items-start gap-4">
            <Building2
              aria-hidden="true"
              className="mt-0.5 h-12 w-12 shrink-0 text-[#1D64C8]"
              strokeWidth={2.4}
            />

            <div className="min-w-0">
              <p className="truncate text-2xl font-black text-[#0F172A]">
                {checkIn.vendor}
              </p>

              <p className="mt-1 text-xl font-medium text-[#64748B]">
                Vendor
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-4 text-left lg:text-right">
          <Clock3
            aria-hidden="true"
            className="mt-1 h-9 w-9 shrink-0 text-slate-700"
            strokeWidth={2.2}
          />

          <div>
            <p className="text-2xl font-black text-[#0F172A]">
              {formatTime(checkIn.checkedInAt)}
            </p>

            <p className="mt-1 text-xl font-medium text-[#64748B]">
              {showFullDate
                ? formatFullDate(checkIn.checkedInAt)
                : formatShortDate(checkIn.checkedInAt)}
            </p>
          </div>
        </div>
      </div>

      {!isEditing ? (
        <>
          <div className="mt-14">
            <h3 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">
              {getAssignmentHeading()}
            </h3>

            <p className="mt-3 text-2xl font-medium text-[#64748B]">
              {getAssignmentSubheading()}
            </p>
          </div>

          <div className="mt-9 border-t border-[#DCE4EF] pt-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex items-center gap-6">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E98413]">
                  <MapPin
                    aria-hidden="true"
                    className="h-11 w-11"
                    fill="currentColor"
                    strokeWidth={1.8}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-xl font-black text-[#0F172A]">
                    {checkIn.poLocation || "No location recorded"}
                  </p>

                  <p className="mt-2 text-xl font-medium text-[#64748B]">
                    Location
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 border-t border-[#DCE4EF] pt-6 md:border-l md:border-t-0 md:pl-10 md:pt-0">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#079455]">
                  <CircleCheckBig
                    aria-hidden="true"
                    className="h-11 w-11"
                    strokeWidth={2.3}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-xl font-black text-[#0F172A]">
                    {checkIn.checkedInBy
                      ? `Checked in by ${checkIn.checkedInBy}`
                      : "Checked in"}
                  </p>

                  <p className="mt-2 text-xl font-medium text-[#64748B]">
                    {formatTime(checkIn.checkedInAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-9 border-t border-[#DCE4EF] pt-8">
            <div className="flex items-center gap-3">
              <Package
                aria-hidden="true"
                className="h-8 w-8 text-slate-700"
                strokeWidth={2.1}
              />

              <h3 className="text-2xl font-black text-[#0F172A]">
                Items
              </h3>
            </div>

            {checkIn.materialsSkipped ? (
              <p className="mt-5 text-lg font-semibold text-amber-700">
                Materials skipped
              </p>
            ) : materials.length > 0 ? (
              <div className="mt-5 space-y-3">
                {visibleMaterials.map((material) => (
                  <p
                    key={material.id}
                    className="flex gap-4 text-xl font-medium text-[#0F172A]"
                  >
                    <span className="text-[#64748B]">•</span>
                    <span>{material.description}</span>
                  </p>
                ))}

                {hiddenMaterialCount > 0 ? (
                  <p className="pt-1 text-xl font-black text-[#1D64C8]">
                    + {hiddenMaterialCount} more{" "}
                    {hiddenMaterialCount === 1 ? "item" : "items"}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-lg font-semibold text-[#64748B]">
                No materials recorded
              </p>
            )}
          </div>

          {checkIn.notes ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                Notes
              </p>

              <p className="mt-2 whitespace-pre-wrap text-base font-semibold text-amber-950">
                {checkIn.notes}
              </p>
            </div>
          ) : null}

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex items-center justify-center gap-4 rounded-[14px] border border-[#DCE4EF] bg-white px-9 py-4 text-xl font-black text-[#0F172A] transition hover:border-[#1D64C8] hover:bg-blue-50 hover:text-[#1D64C8]"
            >
              <Pencil
                aria-hidden="true"
                className="h-7 w-7"
                strokeWidth={2.4}
              />
              Edit
            </button>

            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(checkIn.id)}
                className="inline-flex items-center justify-center gap-4 rounded-[14px] border border-[#EF2B2D] bg-white px-9 py-4 text-xl font-black text-[#EF2B2D] transition hover:bg-red-50"
              >
                <Trash2
                  aria-hidden="true"
                  className="h-7 w-7"
                  strokeWidth={2.4}
                />
                Delete
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <form onSubmit={handleAssignmentSave}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-slate-900">
                  Assign PO
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  Choose customer material or Capital Lumber stock.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                className="text-sm font-bold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  selectAssignmentType("customer")
                }
                className={`rounded-xl border p-4 text-left transition ${
                  assignmentType === "customer"
                    ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="font-black text-slate-900">
                  Customer Order
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Link this PO to a business, person, and job.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  selectAssignmentType("stock")
                }
                className={`rounded-xl border p-4 text-left transition ${
                  assignmentType === "stock"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="font-black text-slate-900">
                  Stock
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Place this material into Capital Lumber inventory.
                </p>
              </button>
            </div>

            {assignmentType === "customer" ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <label
                    htmlFor={`business-${checkIn.id}`}
                    className="mb-1 block text-xs font-bold text-slate-600"
                  >
                    Business / Customer
                  </label>

                  <input
                    id={`business-${checkIn.id}`}
                    type="text"
                    autoComplete="off"
                    value={businessName}
                    onChange={(event) => {
                      setBusinessName(event.target.value);
                      setAssignmentError("");
                    }}
                    placeholder="ABC Construction"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`ordered-by-${checkIn.id}`}
                    className="mb-1 block text-xs font-bold text-slate-600"
                  >
                    Ordered By
                  </label>

                  <input
                    id={`ordered-by-${checkIn.id}`}
                    type="text"
                    autoComplete="off"
                    value={orderedBy}
                    onChange={(event) =>
                      setOrderedBy(event.target.value)
                    }
                    placeholder="Mike Johnson"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`job-${checkIn.id}`}
                    className="mb-1 block text-xs font-bold text-slate-600"
                  >
                    Job / Project
                  </label>

                  <input
                    id={`job-${checkIn.id}`}
                    type="text"
                    autoComplete="off"
                    value={jobName}
                    onChange={(event) =>
                      setJobName(event.target.value)
                    }
                    placeholder="Smith Residence"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            ) : null}

            {assignmentType === "stock" ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="font-bold text-blue-900">
                  This PO will be marked as Stock
                </p>

                <p className="mt-1 text-sm text-blue-700">
                  No customer, contact, or job information is
                  required.
                </p>
              </div>
            ) : null}

            {assignmentError ? (
              <p className="mt-3 text-sm font-semibold text-red-600">
                {assignmentError}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                Save Assignment
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
}
