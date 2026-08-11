import { useMemo, useState } from "react";
import {
  BookOpen,
  Boxes,
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
};

function normalizeSearch(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
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
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
      notes: item.notes || "",
      keywords: item.keywords || "",
    });
    setError("");
    setMessage("");
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
      <div className="mb-8">
        <Breadcrumbs
          items={[
            { label: "Sales", onClick: () => onPageChange?.("sales") },
            { label: "Stocking Handbook" },
          ]}
        />

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FC2C38]">
              Stock Reference
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Stocking Handbook
            </h1>
            <p className="mt-3 max-w-3xl text-lg font-semibold text-slate-500">
              Search stocked items, lengths, unit sizes, grades, and notes from
              the Capital Lumber stocking handbook.
            </p>
          </div>

          {canManage ? (
            <button
              type="button"
              onClick={startAdding}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-red-600"
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

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label>
            <span className="mb-2 block text-sm font-black text-slate-700">
              Search Handbook
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 focus-within:border-[#FC2C38] focus-within:ring-4 focus-within:ring-red-100">
              <Search
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-slate-400"
                strokeWidth={2.4}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search 2x6, OSB, cedar, unit size, length..."
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-300"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Clear handbook search"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </label>

          <div className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-white">
            <p className="text-2xl font-black">{filteredItems.length}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
              Items
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => {
            const isSelected = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-black transition ${
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
                {categoryItems.map((item) => (
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
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </PageContainer>
  );
}
