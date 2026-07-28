import { useState } from "react";
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

  function renderAssignmentDetails() {
    if (savedAssignment?.type === "stock") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-blue-800">
            Stock
          </span>

          <p className="text-sm font-semibold text-slate-600">
            Capital Lumber inventory
          </p>
        </div>
      );
    }

    if (savedAssignment?.type === "customer") {
      return (
        <div className="min-w-0">
          <p className="font-bold text-slate-900">
            {savedAssignment.businessName}
          </p>

          {savedAssignment.orderedBy ||
          savedAssignment.jobName ? (
            <p className="mt-0.5 text-sm text-slate-500">
              {savedAssignment.orderedBy
                ? `Ordered by ${savedAssignment.orderedBy}`
                : ""}

              {savedAssignment.orderedBy &&
              savedAssignment.jobName
                ? " • "
                : ""}

              {savedAssignment.jobName || ""}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <p className="text-sm font-semibold text-amber-700">
        Not assigned — link a customer or mark as stock
      </p>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {checkIn.poNumber}
            </h2>

            <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
              {checkIn.vendor}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-slate-700">
            {formatTime(checkIn.checkedInAt)}
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            {showFullDate
              ? formatFullDate(checkIn.checkedInAt)
              : formatShortDate(checkIn.checkedInAt)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
          📍 {checkIn.poLocation || "No location recorded"}
        </span>

        {checkIn.materialsSkipped ? (
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
            Materials skipped
          </span>
        ) : (
          materials.map((material) => (
            <span
              key={material.id}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600"
            >
              {material.description}
            </span>
          ))
        )}

        {checkIn.checkedInBy ? (
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
            Checked in by {checkIn.checkedInBy}
          </span>
        ) : null}
      </div>

      {checkIn.notes ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
            Notes
          </p>

          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-amber-900">
            {checkIn.notes}
          </p>
        </div>
      ) : null}

      <div className="mt-3 border-t border-slate-100 pt-3">
        {!isEditing ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {renderAssignmentDetails()}
            </div>

            <button
              type="button"
              onClick={openEditor}
              aria-label="Edit PO assignment"
              title="Edit PO assignment"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
            >
              ✎
            </button>
          </div>
        ) : (
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
        )}
      </div>

      {onDelete ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onDelete(checkIn.id)}
            className="text-xs font-bold text-red-500 transition hover:text-red-700"
          >
            Delete
          </button>
        </div>
      ) : null}
    </article>
  );
}
