import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { formatDateInput, getDateInputValue } from "../utils/dateHelpers";
import { formatCustomerName } from "../utils/textFormatters";

function getDateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);

  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      key: getDateKeyFromDate(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: getDateKeyFromDate(date) === getDateInputValue(),
    };
  });
}

function getMonthLabel(monthDate) {
  return monthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getDateKeyDayGap(startDateKey, endDateKey) {
  if (!startDateKey || !endDateKey) {
    return 0;
  }

  const startDate = new Date(`${startDateKey}T00:00:00`);
  const endDate = new Date(`${endDateKey}T00:00:00`);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return 0;
  }

  return Math.round((endDate - startDate) / 86400000);
}

function getSupplierRunDateKey(supplierRun) {
  if (supplierRun.scheduledDate) {
    const rolloverFromScheduledDate =
      typeof supplierRun.rolloverFromScheduledDate === "string"
        ? supplierRun.rolloverFromScheduledDate
        : "";

    if (
      rolloverFromScheduledDate &&
      getDateKeyDayGap(rolloverFromScheduledDate, supplierRun.scheduledDate) > 1
    ) {
      return rolloverFromScheduledDate;
    }

    return supplierRun.scheduledDate;
  }

  if (supplierRun.createdAt) {
    return getDateKeyFromDate(new Date(supplierRun.createdAt));
  }

  return "";
}

function getDateKeyFromValue(value) {
  if (!value) {
    return "";
  }

  return getDateKeyFromDate(new Date(value));
}

function getLatestItemPickedUpAt(supplierRun) {
  if (!Array.isArray(supplierRun?.items)) {
    return "";
  }

  return supplierRun.items
    .map((item) => item.pickedUpAt)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function getSupplierRunPickupDateKey(supplierRun) {
  return (
    getDateKeyFromValue(
      supplierRun.stopStrapUpUntil ||
        supplierRun.stopCompletedAt ||
        supplierRun.completedAt ||
        getLatestItemPickedUpAt(supplierRun) ||
        supplierRun.updatedAt,
    ) || getSupplierRunDateKey(supplierRun)
  );
}

function getSupplierRunBoardDateKey(supplierRun) {
  if (supplierRun.status === "complete") {
    return getSupplierRunPickupDateKey(supplierRun);
  }

  return getSupplierRunDateKey(supplierRun);
}

function getSupplierRunCustomerName(supplierRun) {
  return (
    supplierRun.customerName ||
    (Array.isArray(supplierRun.items)
      ? supplierRun.items.find(
          (item) => item.materialUse !== "stock" && item.customerName,
        )?.customerName
      : "") ||
    ""
  );
}

function getSouthCalendarItem(supplierRun) {
  const items = Array.isArray(supplierRun.items) ? supplierRun.items : [];

  return {
    id: `south-${supplierRun.id}`,
    sourceId: supplierRun.id,
    source: supplierRun,
    type: "south",
    date: getSupplierRunBoardDateKey(supplierRun),
    poNumber: supplierRun.poNumber || "No PO #",
    orderNumber:
      supplierRun.orderNumber ||
      items.find((item) => item.orderNumber)?.orderNumber ||
      "",
    customerName: getSupplierRunCustomerName(supplierRun),
    vendor: supplierRun.vendor || "Unknown supplier",
    driver: supplierRun.driver || "Needs dispatch",
    itemCount: items.length,
    status: supplierRun.status === "complete" ? "Complete" : "Route PO",
  };
}

function getTheirTruckCalendarItem(theirTruckPO) {
  const items = Array.isArray(theirTruckPO.items) ? theirTruckPO.items : [];

  return {
    id: `their-${theirTruckPO.id}`,
    sourceId: theirTruckPO.id,
    source: theirTruckPO,
    type: "theirTruck",
    date: theirTruckPO.deliveryDate || "",
    poNumber: theirTruckPO.poNumber || "No PO #",
    orderNumber: theirTruckPO.orderNumber || "",
    customerName: theirTruckPO.isStock
      ? "Stock"
      : formatCustomerName(theirTruckPO.customerName),
    vendor: theirTruckPO.vendor || "Unknown vendor",
    driver: "Vendor truck",
    itemCount: items.length,
    status: "Inbound PO",
    cadence: theirTruckPO.vendorDeliveryNotes || "",
  };
}

function sortCalendarItems(firstItem, secondItem) {
  if (firstItem.type !== secondItem.type) {
    return firstItem.type === "south" ? -1 : 1;
  }

  return String(firstItem.poNumber || "").localeCompare(
    String(secondItem.poNumber || ""),
  );
}

function groupItemsByDate(items) {
  return items.reduce((groups, item) => {
    if (!item.date) {
      return groups;
    }

    return {
      ...groups,
      [item.date]: [...(groups[item.date] || []), item],
    };
  }, {});
}

function CalendarItemCard({ item, onSelect }) {
  const isSouth = item.type === "south";
  const Icon = isSouth ? Truck : Warehouse;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
        isSouth
          ? "border-red-200 bg-red-50/70 hover:border-[#FC2C38] hover:bg-red-50"
          : "border-blue-200 bg-blue-50/80 hover:border-blue-500 hover:bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isSouth ? "bg-[#FC2C38] text-white" : "bg-blue-600 text-white"
            }`}
          >
            <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          </span>

          <div className="min-w-0">
            <p
              className={`text-[10px] font-black uppercase tracking-[0.16em] ${
                isSouth ? "text-[#FC2C38]" : "text-blue-700"
              }`}
            >
              {isSouth ? "South Pickup" : "Their Truck"}
            </p>
            <h3 className="mt-1 truncate text-2xl font-black text-slate-950">
              {item.poNumber}
            </h3>
          </div>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
            isSouth
              ? "bg-white text-red-700"
              : "bg-white text-blue-700"
          }`}
        >
          {item.status}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600">
        <p>
          <span className="text-slate-950">{item.vendor}</span>
          {isSouth ? ` • ${item.driver}` : ""}
        </p>

        {item.customerName ? (
          <p>
            Customer:{" "}
            <span className="text-slate-950">{item.customerName}</span>
          </p>
        ) : null}

        {item.orderNumber ? (
          <p>
            Order: <span className="text-slate-950">{item.orderNumber}</span>
          </p>
        ) : null}

        {item.cadence ? (
          <p>
            Cadence: <span className="text-slate-950">{item.cadence}</span>
          </p>
        ) : null}
      </div>

      <p className="mt-4 rounded-xl bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {item.itemCount} {item.itemCount === 1 ? "item" : "items"}
      </p>
    </button>
  );
}

function createEmptyTheirTruckItem() {
  return {
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    quantity: "",
    description: "",
    internalReference: "",
  };
}

function TheirTruckCalendarEditor({
  theirTruckPO,
  onClose,
  onSave,
  onDelete,
}) {
  const [draft, setDraft] = useState(() => ({
    ...theirTruckPO,
    items:
      Array.isArray(theirTruckPO.items) && theirTruckPO.items.length > 0
        ? theirTruckPO.items.map((item) => ({
            id: item.id || createEmptyTheirTruckItem().id,
            quantity: item.quantity || "",
            description: item.description || "",
            internalReference: item.internalReference || "",
          }))
        : [createEmptyTheirTruckItem()],
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
    setError("");
  }

  function updateItem(itemId, field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: currentDraft.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }));
    setError("");
  }

  function addItem() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: [...currentDraft.items, createEmptyTheirTruckItem()],
    }));
  }

  function removeItem(itemId) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items:
        currentDraft.items.length === 1
          ? [createEmptyTheirTruckItem()]
          : currentDraft.items.filter((item) => item.id !== itemId),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanItems = draft.items
      .filter((item) => String(item.description || "").trim())
      .map((item) => ({
        id: item.id || createEmptyTheirTruckItem().id,
        quantity: String(item.quantity || "").trim(),
        description: String(item.description || "").trim(),
        internalReference: String(item.internalReference || "").trim(),
      }));

    if (!draft.deliveryDate) {
      setError("Choose a delivery date.");
      return;
    }

    if (!draft.vendor?.trim()) {
      setError("Enter the vendor.");
      return;
    }

    if (!draft.isStock && !draft.customerName?.trim()) {
      setError("Enter a customer name or mark this PO as stock.");
      return;
    }

    if (cleanItems.length === 0) {
      setError("Add at least one item.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSave({
        ...draft,
        customerName: draft.isStock
          ? ""
          : formatCustomerName(draft.customerName),
        orderNumber: draft.isStock ? "" : String(draft.orderNumber || "").trim(),
        items: cleanItems,
      });
      onClose();
    } catch (saveError) {
      console.error("Unable to save Their Truck PO:", saveError);
      setError("Unable to save Their Truck PO.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) {
      return;
    }

    await onDelete(theirTruckPO.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close Their Truck PO editor"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-blue-200 bg-white shadow-2xl sm:max-w-4xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-blue-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Edit Their Truck PO
            </p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">
              {draft.poNumber || "No PO #"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Close editor"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <section className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Delivery Date
              </span>
              <input
                type="date"
                value={draft.deliveryDate || ""}
                onChange={(event) =>
                  updateDraft("deliveryDate", event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Vendor
              </span>
              <input
                type="text"
                value={draft.vendor || ""}
                onChange={(event) => updateDraft("vendor", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Customer Name
              </span>
              <input
                type="text"
                value={draft.customerName || ""}
                onChange={(event) =>
                  updateDraft("customerName", event.target.value.toUpperCase())
                }
                disabled={draft.isStock}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Order #
              </span>
              <input
                type="text"
                value={draft.orderNumber || ""}
                onChange={(event) =>
                  updateDraft("orderNumber", event.target.value)
                }
                disabled={draft.isStock}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-blue-700">
              <input
                type="checkbox"
                checked={Boolean(draft.isStock)}
                onChange={(event) => {
                  const isStock = event.target.checked;
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    isStock,
                    customerName: isStock ? "" : currentDraft.customerName,
                    orderNumber: isStock ? "" : currentDraft.orderNumber,
                  }));
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Stock PO
            </label>
          </section>

          <section className="rounded-3xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Items
                </p>
                <h3 className="text-xl font-black text-slate-950">
                  Delivery Items
                </h3>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                + Item
              </button>
            </div>

            <div className="space-y-3">
              {draft.items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-900">
                      Item {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-sm font-bold text-red-500"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_200px]">
                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.id, "quantity", event.target.value)
                      }
                      placeholder="Qty"
                      className="rounded-xl border border-slate-300 px-3 py-2 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.id, "description", event.target.value)
                      }
                      placeholder="Item description"
                      className="rounded-xl border border-slate-300 px-3 py-2 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                    <input
                      type="text"
                      value={item.internalReference}
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "internalReference",
                          event.target.value,
                        )
                      }
                      placeholder="SKU / Item # / SO#"
                      className="rounded-xl border border-slate-300 px-3 py-2 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_160px]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white shadow-sm transition hover:bg-blue-800 disabled:bg-slate-300"
            >
              {isSaving ? "Saving..." : "Save Their Truck PO"}
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 font-black text-red-600 shadow-sm transition hover:bg-red-50"
              >
                <Trash2
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.5}
                />
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * @param {{
 *   supplierRuns?: Array<Record<string, any>>;
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   mode?: "all" | "south" | "theirTruck";
 *   onEditSouthPO?: (supplierRunId: string) => void;
 *   onSaveTheirTruckPO?: (theirTruckPO: { id: string; [key: string]: any }) => Promise<void>;
 *   onDeleteTheirTruckPO?: (theirTruckPOId: string) => Promise<void>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function POCalendarPage({
  supplierRuns = [],
  theirTruckPOs = [],
  mode = "all",
  onEditSouthPO,
  onSaveTheirTruckPO,
  onDeleteTheirTruckPO,
  onPageChange,
}) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(getDateInputValue());
  const [editingTheirTruckPO, setEditingTheirTruckPO] = useState(null);
  const calendarDays = getCalendarDays(calendarMonth);
  const allCalendarItems = useMemo(() => {
    const southItems =
      mode === "all" || mode === "south"
        ? (Array.isArray(supplierRuns) ? supplierRuns : [])
            .map(getSouthCalendarItem)
            .filter((item) => item.date)
        : [];
    const theirTruckItems =
      mode === "all" || mode === "theirTruck"
        ? (Array.isArray(theirTruckPOs) ? theirTruckPOs : [])
            .map(getTheirTruckCalendarItem)
            .filter((item) => item.date)
        : [];

    return [...southItems, ...theirTruckItems].sort(sortCalendarItems);
  }, [mode, supplierRuns, theirTruckPOs]);
  const itemsByDate = groupItemsByDate(allCalendarItems);
  const selectedDateItems = [...(itemsByDate[selectedDate] || [])].sort(
    sortCalendarItems,
  );
  const selectedSouthCount = selectedDateItems.filter(
    (item) => item.type === "south",
  ).length;
  const selectedTheirTruckCount = selectedDateItems.filter(
    (item) => item.type === "theirTruck",
  ).length;
  const pageTitle =
    mode === "theirTruck"
      ? "Their Truck Calendar"
      : mode === "south"
        ? "South Calendar"
        : "PO Calendar";

  function changeCalendarMonth(offset) {
    setCalendarMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + offset,
          1,
        ),
    );
  }

  function handleSelectItem(item) {
    if (item.type === "south") {
      onEditSouthPO?.(item.sourceId);
      return;
    }

    setEditingTheirTruckPO(item.source);
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Inbound POs", onClick: () => onPageChange?.("south") },
          { label: pageTitle },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            <CalendarDays
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2.4}
            />
            {mode === "theirTruck" ? "Inbound Vendor Schedule" : "PO Schedule"}
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            {pageTitle}
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            {mode === "theirTruck"
              ? "Inbound POs arriving on vendor trucks or outside carriers."
              : "South pickups and Their Truck inbound POs in one calendar, with each type styled differently."}
          </p>
        </div>

        <div className="grid w-full grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
          {[
            {
              mode: "all",
              label: "All",
              icon: PackageCheck,
              pageId: "po-calendar",
            },
            {
              mode: "south",
              label: "South",
              icon: Truck,
              pageId: "south-calendar",
            },
            {
              mode: "theirTruck",
              label: "Vendor",
              icon: Warehouse,
              pageId: "their-truck-calendar",
            },
          ].map((filterOption) => {
            const FilterIcon = filterOption.icon;
            const isActive = mode === filterOption.mode;

            return (
              <button
                key={filterOption.mode}
                type="button"
                onClick={() => onPageChange?.(filterOption.pageId)}
                className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[11px] font-black uppercase tracking-[0.08em] transition sm:min-w-[104px] sm:gap-2 sm:px-4 sm:text-xs ${
                  isActive
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <FilterIcon
                  aria-hidden="true"
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  strokeWidth={2.5}
                />
                {filterOption.label}
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeCalendarMonth(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Previous month"
            >
              <ChevronLeft
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.5}
              />
            </button>

            <div className="min-w-36 rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-black text-slate-900">
              {getMonthLabel(calendarMonth)}
            </div>

            <button
              type="button"
              onClick={() => changeCalendarMonth(1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Next month"
            >
              <ChevronRight
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.5}
              />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.12em]">
            {mode !== "theirTruck" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-[#FC2C38]">
                <span className="h-2 w-2 rounded-full bg-[#FC2C38]" />
                South
              </span>
            ) : null}
            {mode !== "south" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-blue-700">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Their Truck
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (dayLabel) => (
                  <div key={dayLabel} className="py-2">
                    {dayLabel}
                  </div>
                ),
              )}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayItems = itemsByDate[day.key] || [];
                const hasSouth = dayItems.some((item) => item.type === "south");
                const hasTheirTruck = dayItems.some(
                  (item) => item.type === "theirTruck",
                );
                const isSelected = selectedDate === day.key;

                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedDate(day.key)}
                    className={`relative flex min-h-16 flex-col items-center justify-center rounded-xl border text-sm font-black transition sm:min-h-20 ${
                      isSelected
                        ? "border-slate-900 bg-slate-950 text-white"
                        : day.inCurrentMonth
                          ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                          : "border-slate-100 bg-slate-50 text-slate-300"
                    }`}
                  >
                    <span
                      className={
                        day.isToday && !isSelected
                          ? "flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white"
                          : ""
                      }
                    >
                      {day.day}
                    </span>

                    {dayItems.length > 0 ? (
                      <span className="mt-2 flex items-center gap-1">
                        {hasSouth ? (
                          <span
                            className="h-2 w-2 rounded-full bg-[#FC2C38]"
                            aria-label="South PO"
                          />
                        ) : null}
                        {hasTheirTruck ? (
                          <span
                            className="h-2 w-2 rounded-full bg-blue-600"
                            aria-label="Their Truck PO"
                          />
                        ) : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              {formatDateInput(selectedDate)}
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              {selectedDateItems.length}{" "}
              {selectedDateItems.length === 1 ? "PO" : "POs"}
            </h2>

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.1em]">
              {mode !== "theirTruck" ? (
                <span className="rounded-full bg-red-50 px-3 py-1.5 text-[#FC2C38]">
                  {selectedSouthCount} South
                </span>
              ) : null}
              {mode !== "south" ? (
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                  {selectedTheirTruckCount} Their Truck
                </span>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {selectedDateItems.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                  No POs scheduled for this date.
                </p>
              ) : (
                selectedDateItems.map((item) => (
                  <CalendarItemCard
                    key={item.id}
                    item={item}
                    onSelect={handleSelectItem}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      </section>

      {editingTheirTruckPO ? (
        <TheirTruckCalendarEditor
          theirTruckPO={editingTheirTruckPO}
          onClose={() => setEditingTheirTruckPO(null)}
          onSave={onSaveTheirTruckPO}
          onDelete={onDeleteTheirTruckPO}
        />
      ) : null}
    </PageContainer>
  );
}
