import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  Edit3,
  Eye,
  EyeOff,
  PackageSearch,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { createId } from "../utils/idHelpers";

const EMPTY_FORM = {
  itemNumber: "",
  description: "",
  category: "",
  group: "",
  unit: "",
  price: "",
  lastPurchasePrice: "",
  alternativeSkus: "",
  keywords: "",
  notes: "",
};
const PURCHASE_PRICE_ACCESS_CODE = "3105";

function moneyDisplay(value) {
  const numberValue = Number(String(value || "").replace(/[$,]/g, ""));

  if (!Number.isFinite(numberValue) || String(value || "").trim() === "") {
    return "Not set";
  }

  return numberValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function listDisplay(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value || "");
}

function searchableText(item) {
  return [
    item.itemNumber,
    item.description,
    item.category,
    item.group,
    item.unit,
    listDisplay(item.alternativeSkus),
    listDisplay(item.keywords),
  ]
    .join(" ")
    .toLowerCase();
}

function getUniqueOptions(items, key) {
  return [
    ...new Set(
      items
        .map((item) => String(item[key] || "").trim())
        .filter(Boolean),
    ),
  ].sort((firstOption, secondOption) =>
    firstOption.localeCompare(secondOption, undefined, { numeric: true }),
  );
}

function ItemForm({
  canEdit,
  categoryOptions,
  groupOptions,
  currentUser,
  editingItem,
  onCancel,
  onSaveItem,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...editingItem,
    alternativeSkus: listDisplay(editingItem?.alternativeSkus),
    keywords: listDisplay(editingItem?.keywords),
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    if (!form.itemNumber.trim() || !form.description.trim()) {
      setError("Item number and description are required.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await onSaveItem({
        ...form,
        id: editingItem?.id || createId(),
        updatedBy: currentUser?.name || currentUser?.email || "",
      });
      onCancel();
    } catch (saveError) {
      console.error("Unable to save catalog item:", saveError);
      setError(saveError?.message || "Unable to save item.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            {editingItem?.id ? "Edit Item" : "Add Item"}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Catalog Details
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm"
          aria-label="Close item form"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Item #
          </span>
          <input
            value={form.itemNumber}
            onChange={(event) => updateField("itemNumber", event.target.value)}
            placeholder="Example: 010203"
            className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Unit
          </span>
          <input
            value={form.unit}
            onChange={(event) => updateField("unit", event.target.value)}
            placeholder="Each, LF, BF, sheet..."
            className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Description
        </span>
        <input
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          placeholder="2x6-16 #2 Doug Fir"
          className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Category
          </span>
          <input
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            list="item-catalog-categories"
            placeholder="Dimensional Lumber"
            className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
          <datalist id="item-catalog-categories">
            {categoryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Group
          </span>
          <input
            value={form.group}
            onChange={(event) => updateField("group", event.target.value)}
            list="item-catalog-groups"
            placeholder="Framing, Cedar, Panels..."
            className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
          <datalist id="item-catalog-groups">
            {groupOptions.map((group) => (
              <option key={group} value={group} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Sell Price
          </span>
          <input
            value={form.price}
            onChange={(event) => updateField("price", event.target.value)}
            inputMode="decimal"
            placeholder="12.50"
            className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Last Purchase Price
          </span>
          <input
            value={form.lastPurchasePrice}
            onChange={(event) =>
              updateField("lastPurchasePrice", event.target.value)
            }
            inputMode="decimal"
            placeholder="9.85"
            className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Alternative SKUs
        </span>
        <input
          value={form.alternativeSkus}
          onChange={(event) => updateField("alternativeSkus", event.target.value)}
          placeholder="Comma separated"
          className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Search Keywords
        </span>
        <input
          value={form.keywords}
          onChange={(event) => updateField("keywords", event.target.value)}
          placeholder="Comma separated: treated, pt, green..."
          className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Notes
        </span>
        <textarea
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          rows={3}
          placeholder="Internal item notes..."
          className="mt-2 w-full rounded-[10px] border border-slate-300 px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
        />
      </label>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canEdit || isSaving}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#FC2C38] px-4 py-3 text-base font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Save className="h-5 w-5" />
        {isSaving ? "Saving..." : "Save Item"}
      </button>
    </form>
  );
}

export default function ItemCatalogPage({
  items = [],
  canEdit = false,
  currentUser,
  onDeleteItem,
  onPageChange,
  onSaveItem,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [purchasePriceUnlocked, setPurchasePriceUnlocked] = useState(false);
  const [purchasePriceError, setPurchasePriceError] = useState("");

  const categoryOptions = useMemo(
    () => getUniqueOptions(items, "category"),
    [items],
  );
  const groupOptions = useMemo(
    () => getUniqueOptions(items, "group"),
    [items],
  );
  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      if (
        selectedCategory !== "All" &&
        String(item.category || "") !== selectedCategory
      ) {
        return false;
      }

      if (selectedGroup !== "All" && String(item.group || "") !== selectedGroup) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return searchableText(item).includes(normalizedSearch);
    });
  }, [items, searchTerm, selectedCategory, selectedGroup]);
  const visibleItems = filteredItems.slice(0, 250);
  const selectedItem =
    items.find((item) => item.id === selectedItemId) || visibleItems[0] || null;

  async function handleDelete(itemId) {
    if (!canEdit || !window.confirm("Delete this catalog item?")) {
      return;
    }

    setDeleteError("");

    try {
      await onDeleteItem(itemId);

      if (selectedItemId === itemId) {
        setSelectedItemId("");
      }
    } catch (error) {
      console.error("Unable to delete catalog item:", error);
      setDeleteError(error?.message || "Unable to delete item.");
    }
  }

  function handleRevealPurchasePrice() {
    if (purchasePriceUnlocked) {
      setPurchasePriceUnlocked(false);
      setPurchasePriceError("");
      return;
    }

    const enteredCode = window.prompt("Enter the purchase price password.");

    if (enteredCode === null) {
      return;
    }

    if (enteredCode.trim() === PURCHASE_PRICE_ACCESS_CODE) {
      setPurchasePriceUnlocked(true);
      setPurchasePriceError("");
      return;
    }

    setPurchasePriceError("Wrong password. Last purchase price is still hidden.");
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "New Home", onClick: () => onPageChange?.("new-home") },
          { label: "Orders", onClick: () => onPageChange?.("order-flow") },
          { label: "Item Catalog" },
        ]}
      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            Sellable Items
          </p>
          <h1 className="mt-2 text-4xl font-black text-slate-950 sm:text-5xl">
            Item Catalog
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-bold text-slate-500">
            Search item numbers, pricing, last purchase cost, alternate SKUs, and keywords.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditingItem({ ...EMPTY_FORM })}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#FC2C38] px-5 py-3 text-base font-black text-white shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Add Item
          </button>
        ) : null}
      </div>

      <div className="mt-6 rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_110px]">
          <label className="relative block">
            <span className="sr-only">Search item catalog</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item #, description, SKU, keyword..."
              className="w-full rounded-[10px] border border-slate-300 py-3 pl-12 pr-4 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </label>
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="rounded-[10px] border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          >
            <option value="All">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={selectedGroup}
            onChange={(event) => setSelectedGroup(event.target.value)}
            className="rounded-[10px] border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-950 outline-none focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
          >
            <option value="All">All groups</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-center rounded-[10px] bg-slate-950 px-4 py-3 text-center text-white">
            <div>
              <p className="text-2xl font-black leading-none">{filteredItems.length}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                Items
              </p>
            </div>
          </div>
        </div>
      </div>

      {deleteError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {deleteError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(360px,460px)_1fr]">
        <div className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
            {visibleItems.map((item) => {
              const isSelected = item.id === selectedItem?.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-[#FC2C38] bg-red-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                        #{item.itemNumber || "No item #"}
                      </p>
                      <h3 className="mt-1 truncate text-lg font-black text-slate-950">
                        {item.description || "Untitled item"}
                      </h3>
                      <p className="mt-1 truncate text-sm font-bold text-slate-500">
                        {item.category || "Uncategorized"}
                        {item.group ? ` • ${item.group}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      {item.unit || "Unit"}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredItems.length > visibleItems.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-500">
                Showing first {visibleItems.length}. Use search or filters to narrow the list.
              </div>
            ) : null}
            {visibleItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <PackageSearch className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-lg font-black text-slate-950">
                  No items found
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Add an item or adjust the search.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {editingItem ? (
          <ItemForm
            canEdit={canEdit}
            categoryOptions={categoryOptions}
            currentUser={currentUser}
            editingItem={editingItem}
            groupOptions={groupOptions}
            onCancel={() => setEditingItem(null)}
            onSaveItem={onSaveItem}
          />
        ) : selectedItem ? (
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Item #{selectedItem.itemNumber || "Not Set"}
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
                  {selectedItem.description || "Untitled item"}
                </h2>
                <p className="mt-2 text-base font-bold text-slate-500">
                  {selectedItem.category || "Uncategorized"}
                  {selectedItem.group ? ` • ${selectedItem.group}` : ""}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(selectedItem)}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedItem.id)}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 shadow-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Sell Price
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-700">
                  {moneyDisplay(selectedItem.price)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      Last Purchase
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {purchasePriceUnlocked
                        ? moneyDisplay(selectedItem.lastPurchasePrice)
                        : "Hidden"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRevealPurchasePrice}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
                    aria-label={
                      purchasePriceUnlocked
                        ? "Hide last purchase price"
                        : "Show last purchase price"
                    }
                  >
                    {purchasePriceUnlocked ? (
                      <EyeOff className="h-4 w-4" strokeWidth={2.4} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={2.4} />
                    )}
                  </button>
                </div>
                {!purchasePriceUnlocked ? (
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Tap the eye to reveal.
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Unit
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {selectedItem.unit || "Not set"}
                </p>
              </div>
            </div>

            {purchasePriceError ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {purchasePriceError}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-slate-500" />
                  <h3 className="text-lg font-black text-slate-950">
                    Alternative SKUs
                  </h3>
                </div>
                <p className="mt-3 text-base font-bold text-slate-600">
                  {listDisplay(selectedItem.alternativeSkus) || "None entered"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="h-5 w-5 text-slate-500" />
                  <h3 className="text-lg font-black text-slate-950">
                    Keywords
                  </h3>
                </div>
                <p className="mt-3 text-base font-bold text-slate-600">
                  {listDisplay(selectedItem.keywords) || "None entered"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <h3 className="text-lg font-black text-slate-950">Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-base font-bold text-slate-600">
                {selectedItem.notes || "No notes entered."}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <PackageSearch className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-xl font-black text-slate-950">
              Start the item catalog
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Add your first sellable item to begin building the database.
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
