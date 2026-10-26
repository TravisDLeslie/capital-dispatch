import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Percent,
  Search,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { trexPriceBookItems } from "../data/trexPriceBook";

const margins = [0.225, 0.25, 0.3];
const pageSize = 40;

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getSellPrice(cost, margin) {
  return cost / (1 - margin);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function MarginPrices({ item, compact = false }) {
  if (!compact) {
    return margins.map((margin) => (
      <td
        key={margin}
        className="whitespace-nowrap px-4 py-4 text-right text-sm font-black text-emerald-800"
      >
        {formatMoney(getSellPrice(item.jobPackCost, margin))}
      </td>
    ));
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {margins.map((margin) => (
        <div
          key={margin}
          className="rounded-xl bg-emerald-50 px-2 py-2 text-center"
        >
          <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-emerald-600">
            {margin * 100}%
          </span>
          {formatMoney(getSellPrice(item.jobPackCost, margin))}
        </div>
      ))}
    </div>
  );
}

export default function TrexPriceBookPage({ onPageChange }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [collection, setCollection] = useState("all");
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => [...new Set(trexPriceBookItems.map((item) => item.category))].sort(),
    [],
  );
  const collections = useMemo(() => {
    const items =
      category === "all"
        ? trexPriceBookItems
        : trexPriceBookItems.filter((item) => item.category === category);

    return [...new Set(items.map((item) => item.collection))].sort();
  }, [category]);

  const filteredItems = useMemo(() => {
    const search = normalize(query);

    return trexPriceBookItems.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (collection !== "all" && item.collection !== collection) return false;
      if (!search) return true;

      return normalize(
        [
          item.productCode,
          item.description,
          item.color,
          item.type,
          item.category,
          item.collection,
          item.status,
        ].join(" "),
      ).includes(search);
    });
  }, [category, collection, query]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const updateCategory = (value) => {
    setCategory(value);
    setCollection("all");
    setPage(1);
  };

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Documents", onClick: () => onPageChange("documents") },
          { label: "Trex" },
        ]}
      />

      <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              OrePac Boise · August 2026
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Trex Price Book
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-emerald-100 sm:text-base">
              Search stocked Trex products and quote directly from Job Pack pricing.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <span className="block text-2xl font-black">{trexPriceBookItems.length}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                Products
              </span>
            </div>
            {margins.map((margin) => (
              <div
                key={margin}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"
              >
                <span className="block text-2xl font-black">{margin * 100}%</span>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                  Margin
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_240px]">
          <label className="relative block">
            <span className="sr-only">Search the Trex price book</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search product code, color, size, or description..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <select
            value={category}
            onChange={(event) => updateCategory(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            aria-label="Filter by product category"
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={collection}
            onChange={(event) => {
              setCollection(event.target.value);
              setPage(1);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            aria-label="Filter by Trex collection"
          >
            <option value="all">All collections</option>
            {collections.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Percent className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-black text-amber-950">Job Pack pricing is the cost basis</p>
              <p className="text-xs font-semibold leading-5 text-amber-800">
                Sell price = cost ÷ (1 − margin). “Piece” pricing is used where the source sheet uses that label.
              </p>
            </div>
          </div>
          <p className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-amber-800">
            {filteredItems.length} matches
          </p>
        </div>
      </section>

      {visibleItems.length > 0 ? (
        <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.12em]">Product</th>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.12em]">Details</th>
                  <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.12em]">Job Pack Cost</th>
                  {margins.map((margin) => (
                    <th key={margin} className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.12em]">
                      {margin * 100}% Margin
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleItems.map((item) => (
                  <tr key={`${item.sourcePage}-${item.productCode}`} className="align-top hover:bg-emerald-50/40">
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-950">{item.productCode}</p>
                      <p className="mt-1 text-xs font-bold text-emerald-700">{item.collection}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-bold text-slate-800">{item.description}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {[item.color, item.type, `${item.piecesPerUnit}/unit`, item.status]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <p className="text-sm font-black text-slate-950">{formatMoney(item.jobPackCost)}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                        {item.costLabel} / {item.uom}
                      </p>
                    </td>
                    <MarginPrices item={item} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {visibleItems.map((item) => (
              <article key={`${item.sourcePage}-${item.productCode}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-slate-950">{item.productCode}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-emerald-700">
                      {item.collection}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-100 px-3 py-2 text-right">
                    <p className="text-sm font-black text-slate-950">{formatMoney(item.jobPackCost)}</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                      {item.costLabel} / {item.uom}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-800">{item.description}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {[item.color, item.type, `${item.piecesPerUnit}/unit`, item.status]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-4">
                  <MarginPrices item={item} compact />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black text-slate-950">No Trex products found</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">Try a product code, color, size, or broader category.</p>
        </section>
      )}

      {pageCount > 1 ? (
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Page {currentPage} of {pageCount}
          </p>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            disabled={currentPage === pageCount}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs font-semibold text-slate-400">
        Source: OrePac Building Products, Boise Net Pricing, August 2026. Verify current pricing before quoting.
      </p>
    </PageContainer>
  );
}
