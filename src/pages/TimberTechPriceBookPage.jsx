import { useMemo, useState } from "react";
import { BookOpen, Layers3, Percent, Search } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { timberTechCollections } from "../data/timberTechPriceBook";

const margins = [0.225, 0.25, 0.3];
const materialTabs = ["all", "Advanced PVC", "Composite"];
const collectionPriceTiers = {
  "Vintage Collection": "$$$$",
  "Landmark Collection": "$$$$",
  "Harvest+ Collection": "$$$",
  "Harvest Collection": "$$",
  "Porch Collection": "Specialty",
  "Legacy Collection": "$$$",
  "Reserve Collection": "$$$",
  "Terrain+ Collection": "$$",
  "Premier+ Collection": "$$",
  "Terrain Collection": "$$",
  "Prime+ Collection": "$",
  "Prime & Premier Collections": "$",
};

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

function getSwatchColor(color) {
  const value = color.toLowerCase();
  if (/(gray|grey|silver|timber)/.test(value)) return "#8d8a83";
  if (/(white|oyster|salt)/.test(value)) return "#d8d0c3";
  if (/(espresso|cocoa|dark|brown|mocha|walnut)/.test(value)) return "#594238";
  if (/(mahogany|leather|roast)/.test(value)) return "#704536";
  if (/(teak|pecan|wheat|coconut|chestnut)/.test(value)) return "#927054";
  if (/(coast|drift|boardwalk)/.test(value)) return "#7c8580";

  const palette = ["#8c735f", "#6f6256", "#9a856e", "#746f65", "#80624e"];
  const hash = [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  return palette[hash % palette.length];
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

  const materialCounts = useMemo(
    () => ({
      all: timberTechCollections.length,
      "Advanced PVC": timberTechCollections.filter(
        (item) => item.material === "Advanced PVC",
      ).length,
      Composite: timberTechCollections.filter(
        (item) => item.material === "Composite",
      ).length,
    }),
    [],
  );

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

  const pricedCount = filteredCollections.filter(
    (item) => typeof item.boardCost === "number",
  ).length;

  const updateMaterial = (nextMaterial) => {
    setMaterial(nextMaterial);
  };

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Documents", onClick: () => onPageChange("documents") },
          { label: "TimberTech" },
        ]}
      />

      <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-slate-950 via-stone-900 to-amber-950 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Boise Cascade · 2026 Decking Prices
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              TimberTech Price Book
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-amber-100 sm:text-base">
              Compare Advanced PVC and Composite collections by wood look, color, and price tier.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <span className="block text-2xl font-black">{timberTechCollections.length}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">Collections</span>
            </div>
            {margins.map((margin) => (
              <div key={margin} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <span className="block text-2xl font-black">{margin * 100}%</span>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">Margin</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="overflow-x-auto pb-1">
          <div
            role="tablist"
            aria-label="Filter TimberTech collections by material"
            className="flex min-w-max gap-2 rounded-2xl bg-stone-100 p-1.5"
          >
            {materialTabs.map((tab) => {
              const isActive = material === tab;
              const label = tab === "all" ? "All collections" : `${tab} decking`;

              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => updateMaterial(tab)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black uppercase tracking-[0.08em] transition ${
                    isActive
                      ? "bg-stone-900 text-white shadow-sm"
                      : "text-stone-600 hover:bg-white hover:text-stone-950"
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-2 py-0.5 text-[9px] ${isActive ? "bg-white/15" : "bg-white"}`}>
                    {materialCounts[tab]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="relative mt-4 block">
          <span className="sr-only">Search the TimberTech price book</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search collection, color, or wood look..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-600 focus:bg-white focus:ring-4 focus:ring-amber-100"
          />
        </label>

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
          const isAdvancedPvc = item.material === "Advanced PVC";

          return (
            <article
              key={item.collection}
              className="self-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className={`min-h-40 p-5 text-white sm:p-6 ${
                isAdvancedPvc
                  ? "bg-gradient-to-br from-slate-950 via-stone-800 to-amber-900"
                  : "bg-gradient-to-br from-slate-950 via-emerald-950 to-stone-800"
              }`}>
                <div className="flex h-full flex-col justify-between gap-7">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">
                      {item.material}
                    </span>
                    <span className="text-sm font-black text-amber-100">
                      {collectionPriceTiers[item.collection] || item.tier}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/70">
                      {item.tier}
                    </p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight">{item.collection}</h2>
                    <p className="mt-1 text-sm font-bold text-white/75">{item.look}</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Available colors
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
                  {item.colors.map((color) => (
                    <div key={color} className="flex items-center gap-2">
                      <span
                        className="h-6 w-6 rounded-full border-2 border-white shadow ring-1 ring-slate-200"
                        style={{ backgroundColor: getSwatchColor(color) }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-bold text-slate-600">{color}</span>
                    </div>
                  ))}
                </div>
              </div>

              {hasPricing ? (
                <div className="border-t border-slate-200">
                  <div className="hidden grid-cols-[minmax(110px,1.2fr)_repeat(4,minmax(72px,1fr))] gap-2 bg-slate-950 px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[0.08em] text-white sm:grid">
                    <span className="text-left">Product</span>
                    <span>PDF Cost</span>
                    <span>22.5%</span>
                    <span>25%</span>
                    <span>30%</span>
                  </div>
                  <PricingRow label="Deck boards · 1×6" cost={item.boardCost} />
                  <PricingRow label="Fascia · 1×12" cost={item.fasciaCost} />
                  <PricingRow label={`${item.riserLabel || "Riser"} · 1×8`} cost={item.riserCost} />
                </div>
              ) : (
                <div className="flex items-center gap-3 border-t border-slate-200 p-5 text-slate-600">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
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
