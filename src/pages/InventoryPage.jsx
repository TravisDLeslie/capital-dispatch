import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Database,
  PackageCheck,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { inventoryCatalogItems } from "../data/inventoryCatalog";

const PAGE_SIZE = 50;

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const groupFormatter = new Intl.Collator("en-US", {
  numeric: true,
  sensitivity: "base",
});

function formatNumber(value) {
  return Number.isFinite(value) ? numberFormatter.format(value) : "—";
}

function compareItemNumbers(leftItem, rightItem) {
  const left = String(leftItem || "").trim();
  const right = String(rightItem || "").trim();
  const leftNumber = Number.parseInt(left.match(/^0*(\d+)/)?.[1] || "", 10);
  const rightNumber = Number.parseInt(right.match(/^0*(\d+)/)?.[1] || "", 10);
  const leftIsNumeric = Number.isFinite(leftNumber);
  const rightIsNumeric = Number.isFinite(rightNumber);

  if (leftIsNumeric && rightIsNumeric && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  if (leftIsNumeric !== rightIsNumeric) {
    return leftIsNumeric ? -1 : 1;
  }

  return groupFormatter.compare(left, right);
}

function stockTone(onHand, nonStocked = false) {
  if (nonStocked) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (!Number.isFinite(onHand) || onHand === 0) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  if (onHand < 0) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function InventoryRow({ item, rank, canManage, isRemoved, onToggleRemoved }) {
  return (
    <tr className="border-t border-slate-100 align-top transition hover:bg-blue-50/40">
      <td className="px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 hidden min-w-8 text-xs font-black text-slate-300 xl:inline">
            {rank}
          </span>
          <div>
            <p className="font-black text-slate-950">{item.itemNumber}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {item.nonStocked
                ? `${item.brand} · Non-stocked`
                : `Page ${item.sourcePage}`}
            </p>
          </div>
        </div>
      </td>
      <td className="max-w-xl px-4 py-4">
        <p className="font-bold leading-5 text-slate-900">
          {item.description || "No description provided"}
        </p>
      </td>
      <td className="px-4 py-4">
        <span
          className={`inline-flex min-w-20 justify-center rounded-full border px-3 py-1.5 text-sm font-black ${stockTone(
            item.onHand,
            item.nonStocked,
          )}`}
        >
          {item.nonStocked ? "Non-stocked" : formatNumber(item.onHand)}
        </span>
      </td>
      {canManage ? (
        <td className="px-4 py-4 text-right">
          <button
            type="button"
            onClick={() => onToggleRemoved(item)}
            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
              isRemoved
                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                : "border-red-200 text-red-600 hover:bg-red-50"
            }`}
          >
            {isRemoved ? (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isRemoved ? "Restore" : "Remove"}
          </button>
        </td>
      ) : null}
    </tr>
  );
}

function InventoryCard({
  item,
  rank,
  canManage,
  isRemoved,
  onToggleRemoved,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-blue-600">
              Item {item.itemNumber}
            </span>
            <span className="text-xs font-bold text-slate-400">#{rank}</span>
          </div>
          <h2 className="mt-2 font-black leading-5 text-slate-950">
            {item.description || "No description provided"}
          </h2>
          {item.nonStocked ? (
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-violet-600">
              {item.brand} · Non-stocked
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 text-sm">
        <div
          className={`rounded-xl border p-3 ${stockTone(
            item.onHand,
            item.nonStocked,
          )}`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-70">
            On hand
          </p>
          <p className="mt-1 font-black">
            {item.nonStocked ? "Non-stocked" : formatNumber(item.onHand)}
          </p>
        </div>
      </div>
      {canManage ? (
        <button
          type="button"
          onClick={() => onToggleRemoved(item)}
          className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-black transition ${
            isRemoved
              ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              : "border-red-200 text-red-600 hover:bg-red-50"
          }`}
        >
          {isRemoved ? (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
          {isRemoved ? "Restore item" : "Remove from inventory"}
        </button>
      ) : null}
    </article>
  );
}

/**
 * @param {{
 *   removedItemNumbers?: string[];
 *   canManage?: boolean;
 *   onSaveRemovedItemNumbers?: (itemNumbers: string[]) => Promise<unknown>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function InventoryPage({
  removedItemNumbers = [],
  canManage = false,
  onSaveRemovedItemNumbers,
  onPageChange,
}) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [groupSection, setGroupSection] = useState("all");
  const [sortBy, setSortBy] = useState("item");
  const [inventoryView, setInventoryView] = useState("active");
  const [actionMessage, setActionMessage] = useState("");
  const [isSavingRemoval, setIsSavingRemoval] = useState(false);
  const [page, setPage] = useState(1);
  const removedItemNumberSet = useMemo(
    () => new Set(removedItemNumbers.map((itemNumber) => String(itemNumber))),
    [removedItemNumbers],
  );
  const activeInventoryItems = useMemo(
    () =>
      inventoryCatalogItems.filter(
        (item) => !removedItemNumberSet.has(String(item.itemNumber)),
      ),
    [removedItemNumberSet],
  );
  const removedInventoryItems = useMemo(
    () =>
      inventoryCatalogItems.filter((item) =>
        removedItemNumberSet.has(String(item.itemNumber)),
      ),
    [removedItemNumberSet],
  );

  const groups = useMemo(
    () =>
      [...new Set(inventoryCatalogItems.map((item) => item.groupSection))].sort(
        groupFormatter.compare,
      ),
    [],
  );

  const inventoryStats = useMemo(
    () => ({
      total: activeInventoryItems.length,
      inStock: activeInventoryItems.filter((item) => item.onHand > 0).length,
      nonStocked: activeInventoryItems.filter((item) => item.nonStocked).length,
      groups: groups.length,
    }),
    [activeInventoryItems, groups.length],
  );

  const filteredItems = useMemo(() => {
    const search = normalize(query);
    const sourceItems =
      inventoryView === "removed" ? removedInventoryItems : activeInventoryItems;
    const results = sourceItems.filter((item) => {
      if (groupSection !== "all" && item.groupSection !== groupSection) return false;
      if (stockFilter === "positive" && !(item.onHand > 0)) return false;
      if (stockFilter === "zero" && item.onHand !== 0) return false;
      if (stockFilter === "negative" && !(item.onHand < 0)) return false;
      if (stockFilter === "nonStocked" && !item.nonStocked) return false;
      if (!search) return true;

      return normalize(
        [item.itemNumber, item.description, item.groupSection].join(" "),
      ).includes(search);
    });

    if (sortBy === "item") {
      return [...results].sort((a, b) =>
        compareItemNumbers(a.itemNumber, b.itemNumber),
      );
    }
    if (sortBy === "description") {
      return [...results].sort((a, b) =>
        groupFormatter.compare(a.description, b.description),
      );
    }
    if (sortBy === "onHand") {
      return [...results].sort((a, b) => (b.onHand ?? -Infinity) - (a.onHand ?? -Infinity));
    }
    return results;
  }, [
    activeInventoryItems,
    groupSection,
    inventoryView,
    query,
    removedInventoryItems,
    sortBy,
    stockFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [groupSection, inventoryView, query, sortBy, stockFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visibleItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  const hasFilters =
    query ||
    stockFilter !== "all" ||
    groupSection !== "all" ||
    sortBy !== "item";

  const clearFilters = () => {
    setQuery("");
    setStockFilter("all");
    setGroupSection("all");
    setSortBy("item");
  };

  async function toggleRemovedItem(item) {
    if (
      isSavingRemoval ||
      !canManage ||
      typeof onSaveRemovedItemNumbers !== "function"
    ) {
      return;
    }

    const isRemoved = removedItemNumberSet.has(String(item.itemNumber));
    if (
      !isRemoved &&
      !window.confirm(
        `Remove item ${item.itemNumber} from active inventory and order lookup? You can restore it later.`,
      )
    ) {
      return;
    }

    const nextRemovedItemNumbers = isRemoved
      ? removedItemNumbers.filter(
          (itemNumber) => String(itemNumber) !== String(item.itemNumber),
        )
      : [...removedItemNumbers, String(item.itemNumber)];

    setIsSavingRemoval(true);
    setActionMessage("");
    try {
      await onSaveRemovedItemNumbers(nextRemovedItemNumbers);
      setActionMessage(
        isRemoved
          ? `Item ${item.itemNumber} restored.`
          : `Item ${item.itemNumber} removed from active inventory.`,
      );
    } catch (error) {
      setActionMessage(
        error?.message || "Unable to update this inventory item.",
      );
    } finally {
      setIsSavingRemoval(false);
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Documents", onClick: () => onPageChange?.("documents") },
          { label: "Inventory" },
        ]}
      />

      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              <Database className="h-4 w-4" aria-hidden="true" />
              Capital Lumber · Inventory database
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Inventory
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-blue-100 sm:text-base">
              Search item numbers and descriptions, review current on-hand quantities, and see YTD usage from the November 1, 2026 inventory report.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: Boxes, value: inventoryStats.total, label: "Items" },
              { icon: PackageCheck, value: inventoryStats.inStock, label: "In stock" },
              { icon: Boxes, value: inventoryStats.nonStocked, label: "Non-stocked" },
              { icon: Database, value: inventoryStats.groups, label: "Groups" },
            ].map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"
              >
                <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
                <span className="mt-2 block text-2xl font-black">
                  {numberFormatter.format(value)}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-200">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setInventoryView("active")}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                inventoryView === "active"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Active ({numberFormatter.format(activeInventoryItems.length)})
            </button>
            <button
              type="button"
              onClick={() => setInventoryView("removed")}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                inventoryView === "removed"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Removed ({numberFormatter.format(removedInventoryItems.length)})
            </button>
          </div>
          {actionMessage ? (
            <p className="text-sm font-bold text-slate-600">{actionMessage}</p>
          ) : null}
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search item number, name, description, or group…"
            className="h-14 w-full rounded-2xl border border-slate-300 bg-slate-50 pl-12 pr-12 text-base font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="Clear inventory search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Stock status
            <select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800"
            >
              <option value="all">All quantities</option>
              <option value="positive">In stock</option>
              <option value="zero">Zero on hand</option>
              <option value="negative">Negative on hand</option>
              <option value="nonStocked">Non-stocked catalog</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 sm:col-span-2">
            Group / section
            <select
              value={groupSection}
              onChange={(event) => setGroupSection(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800"
            >
              <option value="all">All {groups.length} groups</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Sort by
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800"
            >
              <option value="item">Item number</option>
              <option value="rank">Report order</option>
              <option value="description">Description</option>
              <option value="onHand">On hand</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-bold text-slate-600">
            Showing {filteredItems.length ? startIndex + 1 : 0}–
            {Math.min(startIndex + PAGE_SIZE, filteredItems.length)} of{" "}
            <span className="font-black text-slate-950">
              {numberFormatter.format(filteredItems.length)}
            </span>{" "}
            items
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {visibleItems.length ? (
        <>
          <section className="mt-5 hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Item #</th>
                    <th className="px-4 py-4">Name / description</th>
                    <th className="px-4 py-4">On hand</th>
                    {canManage ? (
                      <th className="px-4 py-4 text-right">Action</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item, index) => (
                    <InventoryRow
                      key={`${item.itemNumber}-${item.sourcePage}-${index}`}
                      item={item}
                      rank={startIndex + index + 1}
                      canManage={canManage}
                      isRemoved={inventoryView === "removed"}
                      onToggleRemoved={toggleRemovedItem}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-5 grid gap-3 md:hidden">
            {visibleItems.map((item, index) => (
              <InventoryCard
                key={`${item.itemNumber}-${item.sourcePage}-${index}`}
                item={item}
                rank={startIndex + index + 1}
                canManage={canManage}
                isRemoved={inventoryView === "removed"}
                onToggleRemoved={toggleRemovedItem}
              />
            ))}
          </section>

          <nav
            className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            aria-label="Inventory pages"
          >
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </button>
            <p className="text-sm font-black text-slate-700">
              Page {safePage} of {pageCount}
            </p>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage === pageCount}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </>
      ) : (
        <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black text-slate-950">
            {inventoryView === "removed"
              ? "No removed inventory items"
              : "No inventory items found"}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {inventoryView === "removed"
              ? "Items removed from active inventory will appear here and can be restored."
              : "Try a different item number, description, or filter."}
          </p>
        </section>
      )}

      <p className="mt-5 text-center text-xs font-semibold text-slate-400">
        Source: Capital Lumber Company inventory report plus Woodgrain, Trex, and TimberTech price books. Non-stocked catalog items do not represent yard quantities.
      </p>
    </PageContainer>
  );
}
