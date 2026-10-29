import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BookOpen,
  Layers3,
  PackageOpen,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  WOODGRAIN_CAPITAL_NET_COUNT,
  WOODGRAIN_PRICE_BOOK_CATEGORY_COUNT,
  WOODGRAIN_PRICE_BOOK_ITEM_COUNT,
  woodgrainPriceBookItems,
} from "../data/woodgrainPriceBook";

const margins = [
  { value: 0.4, label: "40%", tone: "border-orange-200 bg-orange-50 text-orange-950" },
  { value: 0.45, label: "45%", tone: "border-amber-200 bg-amber-50 text-amber-950" },
  { value: 0.55, label: "55%", tone: "border-emerald-200 bg-emerald-50 text-emerald-950" },
];

const categoryOrder = [
  "MDF",
  "Finger Joint",
  "Hemlock",
  "Alder",
  "Solid Pine",
  "Oak",
  "Specialty Woods",
  "Specialty Corners",
  "Composite Frames",
  "Columns & Posts",
  "Fypon",
];

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const normalize = (value) => String(value || "").trim().toLowerCase();

const parseLengthFeet = (value) => {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*'/);
  return match ? Number(match[1]) : null;
};

const sellPrice = (cost, margin) => (cost ? cost / (1 - margin) : null);

const getCost = (item, basis) => {
  const preferred = basis === "bundle" ? item.bundleCost : item.pieceCost;
  return preferred ?? item.pieceCost ?? item.bundleCost;
};

const getCostLabel = (item) => {
  if (item.unit === "CLF") return "per lineal ft";
  if (item.unit === "CTN") return "per carton";
  if (item.unit === "ROLL") return "per roll";
  return "each";
};

function PriceCell({ item, cost, margin }) {
  const linealFootCost = item.unit === "CLF" ? cost / 100 : cost;
  const price = margin ? sellPrice(linealFootCost, margin.value) : linealFootCost;
  const lengthFeet = item.unit === "CLF" ? parseLengthFeet(item.length) : null;
  const boardPrice = lengthFeet ? price * lengthFeet : null;
  const tone = margin?.tone || "border-slate-200 bg-white text-slate-950";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${tone}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-65">
        {margin?.label || "Cost"}
      </p>
      <p className="mt-1 text-lg font-black leading-none sm:text-xl">{formatMoney(price)}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] opacity-65">
        {getCostLabel(item)}
      </p>
      {boardPrice ? (
        <p className="mt-2 border-t border-current/10 pt-2 text-xs font-black">
          {formatMoney(boardPrice)} / {item.length} piece
        </p>
      ) : null}
    </div>
  );
}

function ProductRow({ item, basis }) {
  const cost = getCost(item, basis);
  const metadata = [
    item.size || null,
    item.length ? `Length ${item.length}` : null,
    item.piecesPerUnit ? `${item.piecesPerUnit} pcs/unit` : null,
  ].filter(Boolean);

  return (
    <article className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[minmax(230px,1.5fr)_repeat(4,minmax(125px,1fr))] xl:items-stretch">
        <div className="min-w-0 rounded-2xl bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            {item.pattern ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-emerald-800">
                Profile {item.pattern}
              </span>
            ) : null}
            {item.pricingSource === "Capital Net" ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">
                Capital net
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-black leading-tight text-slate-950 sm:text-lg">
            {item.description}
          </h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Woodgrain item #{item.itemCode}
          </p>
          <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">
            {metadata.join(" · ") || "See source price book for specifications"}
          </p>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            {item.pricingSource} · page {item.capitalSourcePage || item.sourcePage}
          </p>
        </div>
        <PriceCell item={item} cost={cost} />
        {margins.map((margin) => (
          <PriceCell key={margin.value} item={item} cost={cost} margin={margin} />
        ))}
      </div>
    </article>
  );
}

export default function WoodgrainPriceBookPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("capital-net");
  const [section, setSection] = useState("all");
  const [basis, setBasis] = useState("piece");

  const categories = useMemo(
    () => categoryOrder.filter((name) => woodgrainPriceBookItems.some((item) => item.category === name)),
    [],
  );

  const categoryItems = useMemo(() => {
    if (category === "capital-net") {
      return woodgrainPriceBookItems.filter((item) => item.pricingSource === "Capital Net");
    }
    if (category === "all") return woodgrainPriceBookItems;
    return woodgrainPriceBookItems.filter((item) => item.category === category);
  }, [category]);

  const sections = useMemo(
    () => [...new Set(categoryItems.map((item) => item.section))].sort((a, b) => a.localeCompare(b)),
    [categoryItems],
  );

  const filteredItems = useMemo(() => {
    const needle = normalize(query);
    return categoryItems.filter((item) => {
      if (section !== "all" && item.section !== section) return false;
      if (!needle) return true;
      return [
        item.itemCode,
        item.pattern,
        item.description,
        item.size,
        item.length,
        item.category,
        item.section,
      ].some((value) => normalize(value).includes(needle));
    });
  }, [categoryItems, query, section]);

  const grouped = useMemo(() => {
    const groups = new Map();
    filteredItems.forEach((item) => {
      const key = category === "all" || category === "capital-net" ? `${item.category}||${item.section}` : item.section;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()];
  }, [category, filteredItems]);

  const chooseCategory = (nextCategory) => {
    setCategory(nextCategory);
    setSection("all");
  };

  return (
    <div className="min-h-screen bg-[#f7f5f1] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1580px] space-y-6">
        <header className="overflow-hidden rounded-[32px] border border-emerald-200 bg-slate-950 text-white shadow-xl">
          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_auto] lg:px-10 lg:py-10">
            <div>
              <div className="flex items-center gap-3 text-emerald-300">
                <BookOpen className="h-5 w-5" />
                <p className="text-xs font-black uppercase tracking-[0.22em]">Documents · Price book</p>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Woodgrain</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-slate-300 sm:text-base">
                Search the complete stocking-dealer catalog and quote from Capital Lumber net pricing wherever a negotiated item match is available.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 self-end sm:gap-3">
              {[
                [WOODGRAIN_PRICE_BOOK_ITEM_COUNT, "Items"],
                [WOODGRAIN_PRICE_BOOK_CATEGORY_COUNT, "Categories"],
                [WOODGRAIN_CAPITAL_NET_COUNT, "Net prices"],
              ].map(([value, label]) => (
                <div key={label} className="min-w-[92px] rounded-2xl border border-white/10 bg-white/10 px-3 py-4 text-center">
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 bg-emerald-950/60 px-6 py-4 sm:px-8 lg:px-10">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-50">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <span>Capital Net badges use the Capital Lumber price sheet.</span>
              <span className="hidden text-emerald-300 sm:inline">•</span>
              <span>All other items use the Woodgrain stocking-dealer book.</span>
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Find an item</span>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search item number, pattern, description, size, or section..."
                  className="h-14 w-full bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-900" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </label>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Quote basis</p>
              <div className="mt-2 inline-flex rounded-2xl bg-slate-100 p-1">
                {[
                  ["piece", "Piece / small qty"],
                  ["bundle", "Bundle / 100'+"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBasis(value)}
                    className={`rounded-xl px-4 py-3 text-xs font-black transition ${basis === value ? "bg-slate-950 text-white shadow" : "text-slate-500 hover:text-slate-950"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {[
              ["capital-net", `Capital Net (${WOODGRAIN_CAPITAL_NET_COUNT})`],
              ["all", `All (${WOODGRAIN_PRICE_BOOK_ITEM_COUNT})`],
              ...categories.map((name) => [name, name]),
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseCategory(value)}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-black transition ${category === value ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {sections.length > 1 && sections.length <= 24 ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSection("all")}
                className={`rounded-xl px-3 py-2 text-[11px] font-black ${section === "all" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                All sections
              </button>
              {sections.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSection(name)}
                  className={`rounded-xl px-3 py-2 text-[11px] font-black ${section === name ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <PackageOpen className="h-5 w-5 text-emerald-700" />
            <p className="text-sm font-black text-slate-950">{filteredItems.length} matching items</p>
          </div>
          <p className="text-xs font-bold text-slate-500">
            Sell prices use cost ÷ (1 − margin).
          </p>
        </div>

        {grouped.length ? (
          <div className="space-y-6">
            {grouped.map(([groupName, items]) => {
              const [groupCategory, groupSection] = groupName.includes("||") ? groupName.split("||") : [category, groupName];
              return (
                <section key={groupName} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-5 sm:px-7">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-emerald-700 p-3 text-white shadow-sm">
                        <Layers3 className="h-5 w-5" />
                      </div>
                      <div>
                        {(category === "all" || category === "capital-net") ? (
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{groupCategory}</p>
                        ) : null}
                        <h2 className="mt-1 text-xl font-black text-slate-950">{groupSection}</h2>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 shadow-sm">
                      {items.length} items
                    </span>
                  </div>
                  <div className="space-y-3 p-4 sm:p-5">
                    {items.map((item) => (
                      <ProductRow key={`${item.itemCode}-${item.length}-${item.section}`} item={item} basis={basis} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <BadgeDollarSign className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-xl font-black text-slate-950">No Woodgrain items match</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Try a different category, section, or search.</p>
          </div>
        )}

        <footer className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-xs font-semibold leading-relaxed text-slate-500 shadow-sm sm:px-7">
          <p className="font-black text-slate-800">Pricing reference</p>
          <p className="mt-1">
            Woodgrain Stocking Dealer and Capital Lumber Net Price documents dated June 10, 2024. Prices are subject to change; confirm unusual or special-order items before committing a quote.
          </p>
        </footer>
      </div>
    </div>
  );
}
