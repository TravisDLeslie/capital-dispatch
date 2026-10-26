import { useMemo, useState } from "react";
import { BookOpen, Layers3, Percent, Search } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { timberTechCollections } from "../data/timberTechPriceBook";

const margins = [0.225, 0.25, 0.3];

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

function PricingRow({ label, cost }) {
  if (typeof cost !== "number") return null;

  return (
    <div className="grid grid-cols-[minmax(110px,1.2fr)_repeat(4,minmax(72px,1fr))] items-center gap-2 border-t border-slate-100 px-3 py-3 first:border-t-0 sm:px-4">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-600">{label}</p>
      <div className="text-right">
        <p className="text-sm font-black text-slate-950">{formatMoney(cost)}</p>
        <p className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">PDF / LF</p>
      </div>
      {margins.map((margin) => (
        <div key={margin} className="rounded-lg bg-emerald-50 px-1.5 py-2 text-right">
          <p className="text-[9px] font-black uppercase tracking-[0.06em] text-emerald-600 sm:hidden">
            {margin * 100}%
          </p>
          <p className="text-xs font-black text-emerald-800 sm:text-sm">
            {formatMoney(getSellPrice(cost, margin))}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function TimberTechPriceBookPage({ onPageChange }) {
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("all");

  const filteredCollections = useMemo(() => {
    const search = query.trim().toLowerCase();

    return timberTechCollections.filter((item) => {
      if (material !== "all" && item.material !== material) return false;
      if (!search) return true;

      return [item.collection, item.look, item.tier, item.material, ...item.colors]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [material, query]);

  const pricedCount = timberTechCollections.filter(
    (item) => typeof item.boardCost === "number",
  ).length;

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Documents", onClick: () => onPageChange("documents") },
          { label: "TimberTech" },
        ]}
      />

      <section className="overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-sky-200">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Boise Cascade · 2026 Decking Prices
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              TimberTech Price Book
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-sky-100 sm:text-base">
              Compare TimberTech collections and quote from the listed per-linear-foot pricing.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <span className="block text-2xl font-black">{timberTechCollections.length}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-200">Collections</span>
            </div>
            {margins.map((margin) => (
              <div key={margin} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <span className="block text-2xl font-black">{margin * 100}%</span>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-200">Margin</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative block">
            <span className="sr-only">Search the TimberTech price book</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search collection, color, or wood look..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <select
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            aria-label="Filter by TimberTech material"
          >
            <option value="all">All materials</option>
            <option value="Advanced PVC">Advanced PVC</option>
            <option value="Composite">Composite</option>
          </select>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Percent className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-black text-amber-950">PDF pricing is the cost basis</p>
              <p className="text-xs font-semibold leading-5 text-amber-800">
                Sell price = listed LF price ÷ (1 − margin). Unlisted pricing stays marked “Call for price.”
              </p>
            </div>
          </div>
          <p className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-amber-800">
            {pricedCount} priced · {filteredCollections.length} shown
          </p>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        {filteredCollections.map((item) => {
          const hasPricing = typeof item.boardCost === "number";

          return (
            <article key={item.collection} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-700">{item.material}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">{item.collection}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">{item.look}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600 shadow-sm">
                    {item.tier}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {item.colors.map((color) => (
                    <span key={color} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {color}
                    </span>
                  ))}
                </div>
              </div>

              {hasPricing ? (
                <div>
                  <div className="hidden grid-cols-[minmax(110px,1.2fr)_repeat(4,minmax(72px,1fr))] gap-2 bg-slate-950 px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[0.08em] text-white sm:grid">
                    <span className="text-left">Product</span>
                    <span>PDF Cost</span>
                    <span>22.5%</span>
                    <span>25%</span>
                    <span>30%</span>
                  </div>
                  <PricingRow label="Square / Grooved" cost={item.boardCost} />
                  <PricingRow label="Fascia" cost={item.fasciaCost} />
                  <PricingRow label={item.riserLabel || "Riser"} cost={item.riserCost} />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-5 text-slate-600">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <Layers3 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-black text-slate-900">Call for price</p>
                    <p className="text-sm font-semibold">{item.pricingNote}</p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {filteredCollections.length === 0 ? (
        <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <Layers3 className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black text-slate-950">No TimberTech collections found</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">Try a collection name, color, or broader material filter.</p>
        </section>
      ) : null}

      <p className="mt-4 text-center text-xs font-semibold text-slate-400">
        Source: TimberTech Capital Lumber / Boise Cascade decking prices, 2026. Verify current pricing before quoting.
      </p>
    </PageContainer>
  );
}
