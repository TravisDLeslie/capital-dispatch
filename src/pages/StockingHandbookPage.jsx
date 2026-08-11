import { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Boxes,
  ChevronDown,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import { createId } from "../utils/idHelpers";

const emptyForm = {
  category: "",
  name: "",
  sku: "",
  grade: "",
  nominalDimension: "",
  actualDimension: "",
  unitSize: "",
  stockingLengths: "",
  notes: "",
  keywords: "",
  lengthItems: [],
};

function createEmptyLengthItem() {
  return {
    id: createId(),
    length: "",
    itemNumber: "",
    notes: "",
  };
}

function normalizeSearch(value) {
  return String(value || "")
    .replace(/[×✕]/g, "x")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function getDefaultLengthItems(item) {
  const normalizedName = normalizeSearch(item.name);
  const normalizedDimension = normalizeSearch(item.nominalDimension);

  if (
    item.id === "stock-dim-2x4-dfl" ||
    (normalizedName.includes("2x4dougfir") &&
      normalizedName.includes("framing")) ||
    (normalizedDimension === "2x4" &&
      normalizedName.includes("dougfir") &&
      normalizedName.includes("framing"))
  ) {
    return [
      { id: "2x4-dfl-8", length: "8 ft", itemNumber: "01", notes: "" },
      { id: "2x4-dfl-10", length: "10 ft", itemNumber: "02", notes: "" },
      { id: "2x4-dfl-12", length: "12 ft", itemNumber: "03", notes: "" },
    ];
  }

  return [];
}

function getLengthItemsFromStockingLengths(item) {
  const stockingLengths = String(item.stockingLengths || "");
  const matches = [...stockingLengths.matchAll(/(\d+(?:\.\d+)?)\s*(?:ft|')/gi)];
  const seenLengths = new Set();

  return matches
    .map((match) => `${match[1]} ft`)
    .filter((length) => {
      if (seenLengths.has(length)) {
        return false;
      }

      seenLengths.add(length);

      return true;
    })
    .map((length) => ({
      id: `${item.id || "stock"}-${normalizeSearch(length)}`,
      length,
      itemNumber: "",
      notes: "",
    }));
}

function getDisplayLengthItems(item) {
  if (Array.isArray(item.lengthItems) && item.lengthItems.length > 0) {
    return item.lengthItems;
  }

  const defaultLengthItems = getDefaultLengthItems(item);

  if (defaultLengthItems.length > 0) {
    return defaultLengthItems;
  }

  return getLengthItemsFromStockingLengths(item);
}

function getSearchText(item) {
  return [
    item.category,
    item.name,
    item.sku,
    item.grade,
    item.nominalDimension,
    item.actualDimension,
    item.unitSize,
    item.stockingLengths,
    ...getDisplayLengthItems(item).flatMap((lengthItem) => [
      lengthItem.length,
      lengthItem.itemNumber,
      lengthItem.notes,
    ]),
    item.notes,
    item.keywords,
  ]
    .filter(Boolean)
    .join(" ");
}

function Detail({ label, value }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea = false }) {
  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100";

  return (
    <label className={textarea ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </label>
  );
}

/**
 * @param {{
 *   items?: Array<Record<string, any>>;
 *   canManage?: boolean;
 *   currentUser?: { name?: string; email?: string } | null;
 *   onSaveItem?: Function;
 *   onDeleteItem?: Function;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function StockingHandbookPage({
  items = [],
  canManage = false,
  currentUser = null,
  onSaveItem,
  onDeleteItem,
  onPageChange,
}) {
  const safeItems = useMemo(
    () => (Array.isArray(items) ? items : []),
    [items],
  );
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          safeItems
            .map((item) => item.category)
            .filter(Boolean)
            .sort((firstCategory, secondCategory) =>
              firstCategory.localeCompare(secondCategory),
            ),
        ),
      ),
    ],
    [safeItems],
  );
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [editingItemId, setEditingItemId] = useState("");
  const [detailsItemId, setDetailsItemId] = useState("");
  const [expandedLengthItemIds, setExpandedLengthItemIds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef(null);

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    return safeItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const matchesSearch =
        !normalizedSearch ||
        normalizeSearch(getSearchText(item)).includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [safeItems, search, selectedCategory]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce((groups, item) => {
      const category = item.category || "General";

      return {
        ...groups,
        [category]: [...(groups[category] || []), item],
      };
    }, {});
  }, [filteredItems]);
  const detailsItem = safeItems.find((item) => item.id === detailsItemId);
  const detailsLengthItems = detailsItem ? getDisplayLengthItems(detailsItem) : [];

  function updateForm(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setError("");
    setMessage("");
  }

  function startAdding() {
    setEditingItemId("new");
    setForm({
      ...emptyForm,
      category:
        selectedCategory && selectedCategory !== "All" ? selectedCategory : "",
    });
    setError("");
    setMessage("");
  }

  function startEditing(item) {
    setEditingItemId(item.id);
    setForm({
      category: item.category || "",
      name: item.name || "",
      sku: item.sku || "",
      grade: item.grade || "",
      nominalDimension: item.nominalDimension || "",
      actualDimension: item.actualDimension || "",
      unitSize: item.unitSize || "",
      stockingLengths: item.stockingLengths || "",
      lengthItems:
        getDisplayLengthItems(item).length > 0
          ? getDisplayLengthItems(item).map((lengthItem) => ({
              id: lengthItem.id || createId(),
              length: lengthItem.length || "",
              itemNumber: lengthItem.itemNumber || "",
              notes: lengthItem.notes || "",
            }))
          : [],
      notes: item.notes || "",
      keywords: item.keywords || "",
    });
    setError("");
    setMessage("");
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function addLengthItem() {
    setForm((currentForm) => ({
      ...currentForm,
      lengthItems: [
        ...(Array.isArray(currentForm.lengthItems)
          ? currentForm.lengthItems
          : []),
        createEmptyLengthItem(),
      ],
    }));
    setError("");
    setMessage("");
  }

  function updateLengthItem(lengthItemId, field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      lengthItems: (Array.isArray(currentForm.lengthItems)
        ? currentForm.lengthItems
        : []
      ).map((lengthItem) =>
        lengthItem.id === lengthItemId
          ? {
              ...lengthItem,
              [field]: value,
            }
          : lengthItem,
      ),
    }));
    setError("");
    setMessage("");
  }

  function removeLengthItem(lengthItemId) {
    setForm((currentForm) => ({
      ...currentForm,
      lengthItems: (Array.isArray(currentForm.lengthItems)
        ? currentForm.lengthItems
        : []
      ).filter((lengthItem) => lengthItem.id !== lengthItemId),
    }));
    setError("");
    setMessage("");
  }

  function toggleLengthItems(itemId) {
    setExpandedLengthItemIds((currentIds) =>
      currentIds.includes(itemId)
        ? currentIds.filter((currentId) => currentId !== itemId)
        : [...currentIds, itemId],
    );
  }

  function cancelEditing() {
    setEditingItemId("");
    setForm(emptyForm);
    setError("");
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!canManage || !onSaveItem) {
      setError("Only Admin or Super Admin can edit the stocking handbook.");
      return;
    }

    if (!form.name.trim()) {
      setError("Add an item name.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await onSaveItem({
        ...form,
        id: editingItemId === "new" ? createId() : editingItemId,
        source: editingItemId === "new" ? "app" : undefined,
        updatedBy: currentUser?.name || currentUser?.email || "",
      });
      setMessage(`${form.name.trim()} saved.`);
      cancelEditing();
    } catch (saveError) {
      console.error("Unable to save stocking handbook item:", saveError);
      setError(getFirebaseErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!canManage || !onDeleteItem) {
      setError("Only Admin or Super Admin can delete stocking handbook items.");
      return;
    }

    const confirmed = window.confirm(`Delete ${item.name}?`);

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await onDeleteItem(item.id);
      setMessage(`${item.name} deleted.`);
      if (editingItemId === item.id) {
        cancelEditing();
      }
    } catch (deleteError) {
      console.error("Unable to delete stocking handbook item:", deleteError);
      setError(getFirebaseErrorMessage(deleteError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-5 sm:mb-8">
        <Breadcrumbs
          items={[
            { label: "Sales", onClick: () => onPageChange?.("sales") },
            { label: "Stocking Handbook" },
          ]}
        />

        <div className="mt-4 flex flex-col gap-3 lg:mt-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FC2C38] sm:text-xs">
              Stock Reference
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:mt-2 sm:text-5xl">
              Stocking Handbook
            </h1>
            <p className="mt-2 hidden max-w-3xl text-lg font-semibold text-slate-500 sm:block">
              Search stocked items, lengths, unit sizes, grades, and notes from
              the Capital Lumber stocking handbook.
            </p>
          </div>

          {canManage ? (
            <button
              type="button"
              onClick={startAdding}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-red-600 sm:px-5 sm:py-3 sm:text-base"
            >
              <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
              Add Item
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-black text-red-700">
          {error}
        </div>
      ) : null}

      {editingItemId ? (
        <form
          ref={editorRef}
          onSubmit={handleSave}
          className="mb-8 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                {editingItemId === "new" ? "New Stock Item" : "Edit Stock Item"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {editingItemId === "new" ? "Add Handbook Item" : form.name}
              </h2>
            </div>

            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-xl border border-slate-200 bg-white p-3 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Close stocking handbook editor"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Item Name"
              value={form.name}
              onChange={(value) => updateForm("name", value)}
              placeholder="2x6 Doug Fir/Larch"
            />
            <Field
              label="Category"
              value={form.category}
              onChange={(value) => updateForm("category", value)}
              placeholder="Dimensional Lumber"
            />
            <Field
              label="SKU / Item #"
              value={form.sku}
              onChange={(value) => updateForm("sku", value)}
              placeholder="Optional"
            />
            <Field
              label="Grade"
              value={form.grade}
              onChange={(value) => updateForm("grade", value)}
              placeholder="2&Btr"
            />
            <Field
              label="Nominal Dimension"
              value={form.nominalDimension}
              onChange={(value) => updateForm("nominalDimension", value)}
              placeholder="2x6"
            />
            <Field
              label="Actual Dimension"
              value={form.actualDimension}
              onChange={(value) => updateForm("actualDimension", value)}
              placeholder="1-1/2 in x 5-1/2 in"
            />
            <Field
              label="Typical Unit Size"
              value={form.unitSize}
              onChange={(value) => updateForm("unitSize", value)}
              placeholder="189 pc units"
            />
            <Field
              label="Stocking Lengths"
              value={form.stockingLengths}
              onChange={(value) => updateForm("stockingLengths", value)}
              placeholder="8 ft / 10 ft / 12 ft"
            />
            <div className="md:col-span-2">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-700">
                    Length Item Numbers
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Add the item number for each stocked length, like 8' = 01.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addLengthItem}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-[#FC2C38] hover:bg-red-50 hover:text-[#FC2C38]"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Add Length
                </button>
              </div>

              {Array.isArray(form.lengthItems) &&
              form.lengthItems.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {form.lengthItems.map((lengthItem) => (
                    <div
                      key={lengthItem.id}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1.4fr_auto]"
                    >
                      <input
                        value={lengthItem.length}
                        onChange={(event) =>
                          updateLengthItem(
                            lengthItem.id,
                            "length",
                            event.target.value,
                          )
                        }
                        placeholder="8 ft"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />
                      <input
                        value={lengthItem.itemNumber}
                        onChange={(event) =>
                          updateLengthItem(
                            lengthItem.id,
                            "itemNumber",
                            event.target.value,
                          )
                        }
                        placeholder="Item # 01"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />
                      <input
                        value={lengthItem.notes}
                        onChange={(event) =>
                          updateLengthItem(
                            lengthItem.id,
                            "notes",
                            event.target.value,
                          )
                        }
                        placeholder="Optional note"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeLengthItem(lengthItem.id)}
                        className="rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-black text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={addLengthItem}
                  className="w-full rounded-2xl border-2 border-dashed border-slate-300 px-4 py-4 text-sm font-black text-slate-500 transition hover:border-[#FC2C38] hover:bg-red-50 hover:text-[#FC2C38]"
                >
                  + Add length/item # rows
                </button>
              )}
            </div>
            <Field
              label="Notes"
              value={form.notes}
              onChange={(value) => updateForm("notes", value)}
              placeholder="Availability, selling notes, exceptions, grade notes..."
              textarea
            />
            <Field
              label="Backend Search Keywords"
              value={form.keywords}
              onChange={(value) => updateForm("keywords", value)}
              placeholder="Common nicknames, misspellings, vendor terms, sales shortcuts..."
              textarea
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-black text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Save aria-hidden="true" className="h-5 w-5" />
              {isSaving ? "Saving..." : "Save Item"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label>
            <span className="mb-2 flex items-center justify-between gap-3 text-sm font-black text-slate-700">
              <span>Search Handbook</span>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white lg:hidden">
                {filteredItems.length} items
              </span>
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus-within:border-[#FC2C38] focus-within:ring-4 focus-within:ring-red-100 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
              <Search
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-slate-400 sm:h-5 sm:w-5"
                strokeWidth={2.4}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item, length, or #..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300 sm:text-base"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Clear handbook search"
                >
                  <X aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              ) : null}
            </div>
          </label>

          <div className="hidden rounded-2xl bg-slate-950 px-5 py-3 text-center text-white lg:block">
            <p className="text-2xl font-black">{filteredItems.length}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
              Items
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:mt-5">
          {categories.map((category) => {
            const isSelected = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-black transition sm:px-4 sm:py-2 sm:text-sm ${
                  isSelected
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#FC2C38] hover:text-[#FC2C38]"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 space-y-8">
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No stock items found"
            description="Try a different item, length, grade, or category."
          />
        ) : (
          Object.entries(groupedItems).map(([category, categoryItems]) => (
            <section key={category}>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                  <Boxes
                    aria-hidden="true"
                    className="h-5 w-5"
                    strokeWidth={2.5}
                  />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Category
                  </p>
                  <h2 className="text-2xl font-black text-slate-950">
                    {category}
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {categoryItems.map((item) => {
                  const lengthItems = getDisplayLengthItems(item);
                  const hasLengthItems = lengthItems.length > 0;
                  const isLengthExpanded = expandedLengthItemIds.includes(
                    item.id,
                  );

                  return (
                    <article
                      key={item.id}
                      className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                    >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                          Stock Item
                        </p>
                        <h3 className="mt-1 text-2xl font-black leading-tight text-slate-950">
                          {item.name}
                        </h3>
                        {item.sku ? (
                          <p className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                            SKU {item.sku}
                          </p>
                        ) : null}
                      </div>

                      <BookOpen
                        aria-hidden="true"
                        className="h-6 w-6 shrink-0 text-slate-300"
                        strokeWidth={2.4}
                      />
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Detail label="Grade" value={item.grade} />
                      <Detail
                        label="Nominal"
                        value={item.nominalDimension}
                      />
                      <Detail label="Actual" value={item.actualDimension} />
                      <Detail label="Unit Size" value={item.unitSize} />
                      <Detail
                        label="Stocking Lengths"
                        value={item.stockingLengths}
                      />
                    </div>

                    {hasLengthItems ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/40">
                        <button
                          type="button"
                          onClick={() => toggleLengthItems(item.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-blue-50"
                        >
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
                              View Lengths / Item Numbers
                            </p>
                            <p className="mt-1 text-sm font-black text-slate-950">
                              {lengthItems.length}{" "}
                              {lengthItems.length === 1
                                ? "length total"
                                : "lengths total"}
                            </p>
                          </div>
                          <ChevronDown
                            aria-hidden="true"
                            className={`h-5 w-5 shrink-0 text-slate-500 transition ${
                              isLengthExpanded ? "rotate-180" : ""
                            }`}
                            strokeWidth={2.5}
                          />
                        </button>

                        {isLengthExpanded ? (
                          <div>
                            <div className="grid grid-cols-[1fr_1fr] border-t border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                              <span>Length</span>
                              <span>Item #</span>
                            </div>
                            {lengthItems.map((lengthItem) => (
                              <div
                                key={lengthItem.id}
                                className="grid grid-cols-[1fr_1fr] border-t border-slate-100 px-4 py-2 text-sm font-black text-slate-900"
                              >
                                <span>{lengthItem.length || "-"}</span>
                                <span
                                  className={
                                    lengthItem.itemNumber
                                      ? "text-blue-700"
                                      : "text-slate-400"
                                  }
                                >
                                  {lengthItem.itemNumber || "Item # needed"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {item.notes ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                          Notes
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-amber-950">
                          {item.notes}
                        </p>
                      </div>
                    ) : null}

                    {canManage ? (
                      <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => setDetailsItemId(item.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          <BookOpen
                            aria-hidden="true"
                            className="h-4 w-4"
                            strokeWidth={2.5}
                          />
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil
                            aria-hidden="true"
                            className="h-4 w-4"
                            strokeWidth={2.5}
                          />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2
                            aria-hidden="true"
                            className="h-4 w-4"
                            strokeWidth={2.5}
                          />
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="mt-5 border-t border-slate-200 pt-4">
                        <button
                          type="button"
                          onClick={() => setDetailsItemId(item.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          <BookOpen
                            aria-hidden="true"
                            className="h-4 w-4"
                            strokeWidth={2.5}
                          />
                          Details
                        </button>
                      </div>
                    )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {detailsItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
                  Stock Details
                </p>
                <h2 className="mt-1 text-3xl font-black text-slate-950">
                  {detailsItem.name}
                </h2>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {[detailsItem.grade, detailsItem.nominalDimension]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsItemId("")}
                className="rounded-xl border border-slate-200 bg-white p-3 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Close stock details"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Detail label="Category" value={detailsItem.category} />
              <Detail label="SKU / Item #" value={detailsItem.sku} />
              <Detail label="Actual" value={detailsItem.actualDimension} />
              <Detail label="Unit Size" value={detailsItem.unitSize} />
              <Detail
                label="Stocking Lengths"
                value={detailsItem.stockingLengths}
              />
            </div>

            {detailsLengthItems.length > 0 ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1fr_1fr_1.4fr] bg-slate-950 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  <span>Length</span>
                  <span>Item #</span>
                  <span>Notes</span>
                </div>
                {detailsLengthItems.map((lengthItem) => (
                  <div
                    key={lengthItem.id}
                    className="grid grid-cols-[1fr_1fr_1.4fr] border-t border-slate-100 px-4 py-3 text-sm font-black text-slate-900"
                  >
                    <span>{lengthItem.length || "-"}</span>
                    <span
                      className={
                        lengthItem.itemNumber ? "text-blue-700" : "text-slate-400"
                      }
                    >
                      {lengthItem.itemNumber || "Item # needed"}
                    </span>
                    <span className="text-slate-500">
                      {lengthItem.notes || "-"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm font-bold text-slate-500">
                No length-specific item numbers entered yet.
              </div>
            )}

            {detailsItem.notes ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-amber-950">
                  {detailsItem.notes}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    setDetailsItemId("");
                    startEditing(detailsItem);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Pencil
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={2.5}
                  />
                  Edit
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDetailsItemId("")}
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PageContainer>
  );
}
