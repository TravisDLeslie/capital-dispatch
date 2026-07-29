import { useState } from "react";
import {
  Building2,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  MapPin,
  Package,
  Pencil,
  Trash2,
  X,
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
  const [isViewingMaterials, setIsViewingMaterials] =
    useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);

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
  const mobileVisibleMaterials = materials.slice(0, 2);
  const hiddenMaterialCount = Math.max(
    materials.length - visibleMaterials.length,
    0,
  );
  const mobileHiddenMaterialCount = Math.max(
    materials.length - mobileVisibleMaterials.length,
    0,
  );

  return (
    <article className="rounded-[22px] border border-[#DCE4EF] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition hover:border-slate-300 sm:p-6 lg:rounded-[24px] lg:px-8 lg:py-7">
      <div className="lg:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <h2 className="min-w-0 whitespace-nowrap text-[26px] font-black leading-none tracking-tight text-[#0F172A]">
            {checkIn.poNumber}
          </h2>

          <div className="flex shrink-0 items-start text-right">
            <div>
              <p className="text-lg font-black leading-tight text-[#0F172A]">
                {formatTime(checkIn.checkedInAt)}
              </p>

              <p className="mt-1 text-base font-medium leading-tight text-[#64748B]">
                {showFullDate
                  ? formatFullDate(checkIn.checkedInAt)
                  : formatShortDate(checkIn.checkedInAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex min-w-0 items-start gap-3">
          <Building2
            aria-hidden="true"
            className="h-10 w-10 shrink-0 text-[#1D64C8]"
            strokeWidth={2.1}
          />

          <div className="min-w-0">
            <p className="truncate text-xl font-black leading-tight text-[#0F172A]">
              {checkIn.vendor}
            </p>

            <p className="mt-1 text-lg font-medium leading-tight text-[#64748B]">
              Vendor
            </p>
          </div>
        </div>
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-7 lg:gap-8">
          <h2 className="text-2xl font-extrabold leading-none tracking-tight text-[#0F172A] sm:text-3xl lg:text-[40px] lg:font-black lg:leading-none">
            {checkIn.poNumber}
          </h2>

          <div className="flex min-w-0 items-start gap-3">
            <Building2
              aria-hidden="true"
              className="mt-0.5 h-10 w-10 shrink-0 text-[#1D64C8] lg:h-11 lg:w-11"
              strokeWidth={2.1}
            />

            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-[#0F172A] lg:text-[22px] lg:leading-tight">
                {checkIn.vendor}
              </p>

              <p className="mt-1 text-lg font-medium text-[#64748B] lg:text-[20px] lg:leading-tight">
                Vendor
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-3 text-left lg:text-right">
          <Clock3
            aria-hidden="true"
            className="mt-1 h-8 w-8 shrink-0 text-slate-700"
            strokeWidth={2.2}
          />

          <div>
            <p className="text-xl font-medium text-[#0F172A] lg:text-[22px] lg:font-black lg:leading-tight">
              {formatTime(checkIn.checkedInAt)}
            </p>

            <p className="mt-1 text-lg font-medium text-[#64748B] lg:text-[20px] lg:leading-tight">
              {showFullDate
                ? formatFullDate(checkIn.checkedInAt)
                : formatShortDate(checkIn.checkedInAt)}
            </p>
          </div>
        </div>
      </div>

      {!isEditing ? (
        <>
          <div className="mt-6 border-t border-[#DCE4EF] pt-5 lg:mt-7 lg:border-t-0 lg:pt-0">
            <h3 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl lg:text-[24px] lg:font-black lg:leading-tight">
              {getAssignmentHeading()}
            </h3>

            <p className="mt-2 text-lg font-medium text-[#64748B] lg:text-[20px] lg:leading-tight">
              {getAssignmentSubheading()}
            </p>
          </div>

          <div className="mt-5 rounded-[18px] border border-[#DCE4EF] px-4 py-4 lg:mt-6 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:px-0 lg:py-0 lg:pt-5">
            <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E98413]">
                  <MapPin
                    aria-hidden="true"
                    className="h-9 w-9"
                    fill="currentColor"
                    strokeWidth={1.8}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-base font-medium text-[#64748B] lg:hidden">
                    Location
                  </p>

                  <p className="mt-1 text-lg font-black text-[#0F172A] lg:mt-0 lg:text-[20px] lg:leading-tight">
                    {checkIn.poLocation || "No location recorded"}
                  </p>

                  <p className="mt-1 hidden text-[18px] font-medium leading-tight text-[#64748B] lg:block">
                    Location
                  </p>
                </div>

                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto h-6 w-6 text-[#64748B] lg:hidden"
                  strokeWidth={2.5}
                />
              </div>

              <div className="flex items-center gap-4 border-t border-[#DCE4EF] pt-4 md:border-l md:border-t-0 md:pl-7 md:pt-0">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#079455]">
                  <CircleCheckBig
                    aria-hidden="true"
                    className="h-9 w-9"
                    strokeWidth={2.3}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-base font-medium text-[#64748B] lg:hidden">
                    Checked In By
                  </p>

                  <p className="mt-1 text-lg font-black text-[#0F172A] lg:hidden">
                    {checkIn.checkedInBy
                      ? checkIn.checkedInBy
                      : "Checked in"}
                  </p>

                  <p className="hidden text-[20px] font-black leading-tight text-[#0F172A] lg:block">
                    {checkIn.checkedInBy
                      ? `Checked in by ${checkIn.checkedInBy}`
                      : "Checked in"}
                  </p>

                  <p className="mt-1 text-base font-medium text-[#64748B] lg:text-[18px] lg:leading-tight">
                    {formatTime(checkIn.checkedInAt)}
                  </p>
                </div>

                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto h-6 w-6 text-[#64748B] lg:hidden"
                  strokeWidth={2.5}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-[#DCE4EF] px-4 py-4 lg:mt-6 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:px-0 lg:py-0 lg:pt-5">
            <div className="flex items-center gap-3">
              <Package
                aria-hidden="true"
                className="h-6 w-6 text-slate-700"
                strokeWidth={2.1}
              />

              <h3 className="text-xl font-black text-[#0F172A] lg:text-[22px] lg:leading-tight">
                Items
              </h3>
            </div>

            {checkIn.materialsSkipped ? (
              <p className="mt-4 text-lg font-semibold text-amber-700">
                Materials skipped
              </p>
            ) : materials.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {mobileVisibleMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="flex gap-3 text-base font-medium text-[#0F172A] lg:hidden"
                  >
                    <span className="text-[#64748B]">•</span>
                    <span className="min-w-0">
                      <span>{material.description}</span>

                      {material.location ? (
                        <span className="mt-0.5 block text-sm font-semibold text-[#64748B]">
                          {material.location}
                          {material.locationPhoto ? " • Photo" : ""}
                          {material.damagePhoto ? " • Damage" : ""}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}

                {visibleMaterials.map((material) => (
                  <div
                    key={`desktop-${material.id}`}
                    className="hidden gap-3 text-base font-medium text-[#0F172A] lg:flex lg:text-[17px] lg:leading-tight"
                  >
                    <span className="text-[#64748B]">•</span>
                    <span className="min-w-0">
                      <span>{material.description}</span>

                      {material.location ? (
                        <span className="mt-0.5 block text-sm font-semibold text-[#64748B]">
                          {material.location}
                          {material.locationPhoto ? " • Photo" : ""}
                          {material.damagePhoto ? " • Damage" : ""}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}

                {mobileHiddenMaterialCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsViewingMaterials(true)}
                    className="flex w-full items-center pt-3 text-left text-base font-black text-[#1D64C8] transition hover:text-blue-800 lg:hidden"
                  >
                    + {mobileHiddenMaterialCount} more{" "}
                    {mobileHiddenMaterialCount === 1
                      ? "item"
                      : "items"}
                    <ChevronRight
                      aria-hidden="true"
                      className="ml-auto h-6 w-6 text-[#64748B]"
                      strokeWidth={2.5}
                    />
                  </button>
                ) : null}

                {hiddenMaterialCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsViewingMaterials(true)}
                    className="hidden pt-1 text-left text-base font-black text-[#1D64C8] transition hover:text-blue-800 lg:block lg:text-[17px]"
                  >
                    + {hiddenMaterialCount} more{" "}
                    {hiddenMaterialCount === 1
                      ? "item"
                      : "items"}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-lg font-semibold text-[#64748B]">
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

          {checkIn.locationPhoto?.dataUrl ? (
            <div className="mt-5 rounded-2xl border border-[#DCE4EF] bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#64748B]">
                    Location Photo
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#64748B]">
                    Wide photo of where the material was placed
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setViewingPhoto({
                      dataUrl: checkIn.locationPhoto.dataUrl,
                      title: "Location Photo",
                      subtitle:
                        "Wide photo of where the material was placed",
                    })
                  }
                  className="rounded-lg border border-[#DCE4EF] bg-white px-3 py-2 text-sm font-black text-[#0F172A] transition hover:border-[#1D64C8] hover:text-[#1D64C8]"
                >
                  View
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setViewingPhoto({
                    dataUrl: checkIn.locationPhoto.dataUrl,
                    title: "Location Photo",
                    subtitle:
                      "Wide photo of where the material was placed",
                  })
                }
                className="block w-full overflow-hidden rounded-xl"
              >
                <img
                  src={checkIn.locationPhoto.dataUrl}
                  alt={`Material location for PO ${checkIn.poNumber}`}
                  className="h-36 w-full object-cover sm:h-44"
                />
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex gap-3 border-t border-[#DCE4EF] pt-4 sm:justify-end lg:mt-6 lg:border-t-0 lg:pt-0">
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-[#DCE4EF] bg-white px-5 py-3 text-base font-black text-[#0F172A] transition hover:border-[#1D64C8] hover:bg-blue-50 hover:text-[#1D64C8] sm:flex-none sm:px-6 sm:py-2.5"
            >
              <Pencil
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.4}
              />
              Edit
            </button>

            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(checkIn.id)}
                className="inline-flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-[#EF2B2D] bg-white px-5 py-3 text-base font-black text-[#EF2B2D] transition hover:bg-red-50 sm:flex-none sm:px-6 sm:py-2.5"
              >
                <Trash2
                  aria-hidden="true"
                  className="h-5 w-5"
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

      {isViewingMaterials ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/45 px-3 py-4 sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`materials-title-${checkIn.id}`}
        >
          <div className="max-h-[86vh] w-full overflow-hidden rounded-[22px] bg-white shadow-2xl sm:max-w-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#DCE4EF] px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#64748B]">
                  PO {checkIn.poNumber}
                </p>

                <h3
                  id={`materials-title-${checkIn.id}`}
                  className="mt-1 text-xl font-black text-[#0F172A]"
                >
                  All Items
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsViewingMaterials(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#DCE4EF] text-[#64748B] transition hover:border-slate-400 hover:text-[#0F172A]"
                aria-label="Close items"
              >
                <X
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={2.4}
                />
              </button>
            </div>

            <div className="max-h-[64vh] overflow-y-auto px-5 py-4">
              <div className="space-y-3">
                {materials.map((material, index) => (
                  <div
                    key={material.id || `${checkIn.id}-${index}`}
                    className="rounded-xl border border-[#DCE4EF] bg-slate-50 px-4 py-3"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#64748B]">
                      Item {index + 1}
                    </p>

                    <p className="mt-1 text-base font-bold leading-snug text-[#0F172A]">
                      {material.description}
                    </p>

                    {material.location ? (
                      <p className="mt-2 text-sm font-semibold text-[#64748B]">
                        Location: {material.location}
                      </p>
                    ) : null}

                    <p
                      className={`mt-2 text-sm font-black ${
                        material.conditionGood === false
                          ? "text-red-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {material.conditionGood === false
                        ? "Damage noted"
                        : "Good condition"}
                    </p>

                    {material.locationPhoto?.dataUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingPhoto({
                            dataUrl:
                              material.locationPhoto.dataUrl,
                            title: `Item ${index + 1} Location Photo`,
                            subtitle: material.description,
                          })
                        }
                        className="mt-3 block w-full overflow-hidden rounded-xl border border-[#DCE4EF] bg-white text-left"
                      >
                        <img
                          src={material.locationPhoto.dataUrl}
                          alt={`Location for item ${index + 1}`}
                          className="h-32 w-full object-cover"
                        />

                        <span className="block px-3 py-2 text-sm font-black text-[#1D64C8]">
                          View photo
                        </span>
                      </button>
                    ) : null}

                    {material.damagePhoto?.dataUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingPhoto({
                            dataUrl: material.damagePhoto.dataUrl,
                            title: `Item ${index + 1} Damage Photo`,
                            subtitle: material.description,
                          })
                        }
                        className="mt-3 block w-full overflow-hidden rounded-xl border border-red-200 bg-white text-left"
                      >
                        <img
                          src={material.damagePhoto.dataUrl}
                          alt={`Damage for item ${index + 1}`}
                          className="h-32 w-full object-cover"
                        />

                        <span className="block px-3 py-2 text-sm font-black text-red-700">
                          View damage photo
                        </span>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewingPhoto?.dataUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`photo-title-${checkIn.id}`}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[22px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#DCE4EF] px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#64748B]">
                  PO {checkIn.poNumber}
                </p>

                <h3
                  id={`photo-title-${checkIn.id}`}
                  className="mt-1 text-xl font-black text-[#0F172A]"
                >
                  {viewingPhoto.title || "Location Photo"}
                </h3>

                {viewingPhoto.subtitle ? (
                  <p className="mt-1 text-sm font-semibold text-[#64748B]">
                    {viewingPhoto.subtitle}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setViewingPhoto(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#DCE4EF] text-[#64748B] transition hover:border-slate-400 hover:text-[#0F172A]"
                aria-label="Close location photo"
              >
                <X
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={2.4}
                />
              </button>
            </div>

            <div className="max-h-[74vh] overflow-auto bg-slate-950">
              <img
                src={viewingPhoto.dataUrl}
                alt={`Material location for PO ${checkIn.poNumber}`}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
