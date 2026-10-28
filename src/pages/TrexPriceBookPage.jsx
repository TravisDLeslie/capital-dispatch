import { useMemo, useState } from "react";
import {
  BookOpen,
  PackageSearch,
  Percent,
  Search,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { trexPriceBookItems } from "../data/trexPriceBook";

const margins = [0.225, 0.25, 0.3];
const marginTones = {
  0.225: {
    background: "bg-orange-50",
    price: "text-orange-900",
    total: "text-orange-700/80",
  },
  0.25: {
    background: "bg-amber-50",
    price: "text-amber-900",
    total: "text-amber-700/80",
  },
  0.3: {
    background: "bg-emerald-50",
    price: "text-emerald-800",
    total: "text-emerald-700/80",
  },
};
const productGroups = [
  {
    id: "decking",
    label: "Decking",
    categories: ["Decking - Composite", "Decking - PVC & Universal"],
  },
  { id: "all", label: "All", categories: null },
  {
    id: "plugs",
    label: "Plugs",
    categories: ["Deck Plugs", "Fascia Plugs"],
  },
  {
    id: "screws",
    label: "Screws",
    categories: ["Deck Screws", "Fascia Screws"],
  },
  {
    id: "fasteners",
    label: "Fasteners",
    categories: ["Hidden Fasteners"],
  },
  { id: "railing", label: "Railing", categories: ["Railing"] },
  {
    id: "accessories",
    label: "Accessories",
    categories: ["Decking Accessories"],
  },
];

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

function compareText(first, second) {
  return String(first || "").localeCompare(String(second || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getProfileRank(profile) {
  const value = normalize(profile);

  if (value.includes("grooved")) return 0;
  if (value.includes("square")) return 1;
  if (value.includes("riser")) return 2;
  if (value.includes("fascia")) return 3;
  return 4;
}

function compareProfiles(first, second) {
  return getProfileRank(first) - getProfileRank(second) || compareText(first, second);
}

function getTrexItemTitle(item) {
  return [item.description, item.type].filter(Boolean).join(" · ") || item.collection;
}

function getTrexVariantParts(item) {
  const description = String(item.description || "").trim();
  const match = description.match(/^(.*?)\s+-\s+((?:\d+(?:\.\d+)?)\s*(?:'|"))$/);

  return {
    baseDescription: match?.[1]?.trim() || description,
    lengthLabel: match?.[2]?.replace(/\s+/g, "") || "",
  };
}

function getBoardLengthFeet(item) {
  if (normalize(item.uom) !== "lf") return null;

  const { lengthLabel } = getTrexVariantParts(item);
  const match = lengthLabel.match(/^(\d+(?:\.\d+)?)'/);
  const length = Number(match?.[1]);

  return Number.isFinite(length) && length > 0 ? length : null;
}

function getBoardTotal(item, pricePerFoot) {
  const length = getBoardLengthFeet(item);
  return length ? pricePerFoot * length : null;
}

function PriceValue({ item, price, priceClassName, totalClassName }) {
  const boardTotal = getBoardTotal(item, price);

  return (
    <>
      <p className={priceClassName}>
        {formatMoney(price)}
        {boardTotal ? <span className="ml-1 text-xs font-black uppercase opacity-65">/LF</span> : null}
      </p>
      <p className={totalClassName}>
        {boardTotal ? `${formatMoney(boardTotal)} board` : item.uom}
      </p>
    </>
  );
}

function groupTrexVariants(items) {
  const groups = new Map();

  items.forEach((item) => {
    const { baseDescription, lengthLabel } = getTrexVariantParts(item);
    const title = [baseDescription, item.type].filter(Boolean).join(" · ");
    const key = [baseDescription, item.color, item.type].map(normalize).join("|");

    if (!groups.has(key)) {
      groups.set(key, { key, title, variants: [] });
    }

    groups.get(key).variants.push({ item, lengthLabel });
  });

  return [...groups.values()].map((group) => ({
    ...group,
    isLengthGroup:
      group.variants.length > 1 && group.variants.every((variant) => variant.lengthLabel),
  }));
}

function matchesProductGroup(item, groupId) {
  const group = productGroups.find((entry) => entry.id === groupId);
  return !group?.categories || group.categories.includes(item.category);
}

function getCollectionTier(collection, category) {
  const normalizedCollection = normalize(collection);

  if (normalizedCollection.includes("signature")) return "Luxury";
  if (normalizedCollection.includes("transcend")) return "Best";
  if (normalizedCollection.includes("select")) return "Better";
  if (normalizedCollection.includes("enhance")) return "Good";
  if (normalizedCollection.includes("refuge")) return "PVC";
  if (category.includes("Railing")) return "Railing";
  if (category.includes("Plug")) return "Plugs";
  if (category.includes("Screw")) return "Screws";
  if (category.includes("Fastener")) return "Fasteners";
  return "Accessories";
}

function getSwatchColor(color) {
  const value = normalize(color);
  if (/(gray|grey|silver|pebble)/.test(value)) return "#8b8b84";
  if (/(white|salt|oyster)/.test(value)) return "#d8d0c2";
  if (/(black|charcoal)/.test(value)) return "#343331";
  if (/(espresso|cocoa|dark|brown|mocha)/.test(value)) return "#594238";
  if (/(lava|rum|red|mahogany)/.test(value)) return "#774737";
  if (/(gold|honey|wheat|cinnamon)/.test(value)) return "#aa7d53";
  if (/(teak|torch|caramel|saddle)/.test(value)) return "#866047";
  if (/(island|tide|coast|blue)/.test(value)) return "#75888a";

  const palette = ["#8c735f", "#6f6256", "#9a856e", "#746f65", "#80624e"];
  const hash = [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function getCollectionGroupRank(group) {
  const categories = group.categories.join(" ");
  const tierRanks = { Luxury: 0, Best: 1, Better: 2, Good: 3, PVC: 4 };

  if (categories.includes("Decking -")) return tierRanks[group.tier] ?? 5;
  if (categories.includes("Railing")) return 10;
  if (categories.includes("Hidden Fasteners")) return 20;
  if (categories.includes("Plug")) return 21;
  if (categories.includes("Screw")) return 22;
  return 23;
}

function MobileMarginPrices({ item }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {margins.map((margin) => {
        const sellPrice = getSellPrice(item.jobPackCost, margin);
        const tone = marginTones[margin];

        return (
          <div
            key={margin}
            className={`rounded-xl px-2 py-2 text-center ${tone.background}`}
          >
            <span className={`block text-[9px] font-black uppercase tracking-[0.12em] ${tone.total}`}>
              {margin * 100}%
            </span>
            <PriceValue
              item={item}
              price={sellPrice}
              priceClassName={`text-lg font-black ${tone.price}`}
              totalClassName={`mt-1 text-xs font-black ${tone.total}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function TrexPricingCard({ group }) {
  const [profileFilter, setProfileFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const profiles = useMemo(
    () => [...new Set(group.items.map((item) => item.type).filter(Boolean))].sort(compareProfiles),
    [group.items],
  );
  const activeProfile = profiles.includes(profileFilter) ? profileFilter : "all";
  const visibleItems = useMemo(
    () =>
      activeProfile === "all"
        ? group.items
        : group.items.filter((item) => item.type === activeProfile),
    [activeProfile, group.items],
  );
  const availableColors = useMemo(
    () =>
      [...new Set(visibleItems.map((item) => item.color).filter(Boolean))].sort(
        compareText,
      ),
    [visibleItems],
  );
  const activeColor = availableColors.includes(colorFilter) ? colorFilter : "all";
  const colorFilteredItems = useMemo(
    () =>
      activeColor === "all"
        ? visibleItems
        : visibleItems.filter((item) => item.color === activeColor),
    [activeColor, visibleItems],
  );
  const colorSections = useMemo(() => {
    const sections = new Map();

    colorFilteredItems.forEach((item) => {
      const colorName = item.color || "General products";
      if (!sections.has(colorName)) sections.set(colorName, []);
      sections.get(colorName).push(item);
    });

    return [...sections.entries()]
      .map(([colorName, items]) => ({
        colorName,
        variantGroups: groupTrexVariants(items),
      }))
      .sort((first, second) => compareText(first.colorName, second.colorName));
  }, [colorFilteredItems]);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-700 p-5 text-white sm:p-6">
        <div className="flex h-full flex-col justify-between gap-8">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100 backdrop-blur">
              {group.tier}
            </span>
            <span className="text-xs font-black text-emerald-100">
              {group.items.length} {group.items.length === 1 ? "product" : "products"}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-200">
              {group.categories.join(" · ")}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">{group.collection}</h2>
          </div>
        </div>
      </div>

      {profiles.length > 1 ? (
        <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            Choose profile
          </p>
          <div className="mt-3 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2" role="tablist" aria-label={`${group.collection} profile`}>
              {["all", ...profiles].map((profile) => {
                const isActive = activeProfile === profile;
                const count =
                  profile === "all"
                    ? group.items.length
                    : group.items.filter((item) => item.type === profile).length;

                return (
                  <button
                    key={profile}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setProfileFilter(profile)}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition ${
                      isActive
                        ? "bg-slate-950 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950"
                    }`}
                  >
                    {profile === "all" ? "All profiles" : profile}
                    <span className={`rounded-full px-2 py-0.5 text-[9px] ${isActive ? "bg-white/15" : "bg-white"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {availableColors.length > 0 ? (
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            Choose color
          </p>
          <div className="mt-3 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2" aria-label={`${group.collection} colors`}>
              <button
                type="button"
                aria-pressed={activeColor === "all"}
                onClick={() => setColorFilter("all")}
                className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-black transition ${
                  activeColor === "all"
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-950"
                }`}
              >
                <span className="h-4 w-4 rounded-full border border-current bg-gradient-to-br from-amber-200 via-stone-400 to-slate-700" />
                All colors
                <span className={activeColor === "all" ? "text-slate-300" : "text-slate-400"}>
                  {visibleItems.length}
                </span>
              </button>
              {availableColors.map((value) => {
                const isActive = activeColor === value;
                const count = visibleItems.filter((item) => item.color === value).length;

                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setColorFilter(value)}
                    className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-black transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-950"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: getSwatchColor(value) }}
                      aria-hidden="true"
                    />
                    {value}
                    <span className={isActive ? "text-slate-300" : "text-slate-400"}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-200">
          <div className="sticky top-0 z-10 hidden grid-cols-[minmax(190px,1.5fr)_repeat(4,minmax(120px,1fr))] gap-2 bg-slate-950 px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-[0.08em] text-white sm:grid">
            <span className="text-left">Product</span>
            <span>Job Pack</span>
            <span>22.5%</span>
            <span>25%</span>
            <span>30%</span>
          </div>
          <div className="hidden sm:block">
            {colorSections.map((colorSection) => (
              <section key={colorSection.colorName} className="border-t border-slate-300 first:border-t-0">
                <div className="flex items-center gap-3 bg-emerald-50 px-4 py-3">
                  {colorSection.colorName !== "General products" ? (
                    <span
                      className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-emerald-200"
                      style={{ backgroundColor: getSwatchColor(colorSection.colorName) }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-600">Color</p>
                    <h3 className="text-base font-black text-emerald-950">{colorSection.colorName}</h3>
                  </div>
                </div>
                {colorSection.variantGroups.map((variantGroup) => (
                  <div key={variantGroup.key} className="border-t border-slate-200">
                    {variantGroup.isLengthGroup ? (
                      <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2.5">
                        <p className="text-sm font-black text-slate-950">{variantGroup.title}</p>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500 shadow-sm">
                          {variantGroup.variants.length} lengths
                        </span>
                      </div>
                    ) : null}
                    {variantGroup.variants.map(({ item, lengthLabel }) => (
                      <div
                        key={`${item.sourcePage}-${item.productCode}`}
                        className="grid grid-cols-[minmax(190px,1.5fr)_repeat(4,minmax(120px,1fr))] items-center gap-2 border-t border-slate-100 px-4 py-3 first:border-t-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-black leading-5 text-slate-950">
                            {variantGroup.isLengthGroup ? lengthLabel : getTrexItemTitle(item)}
                          </p>
                          <p className="mt-0.5 text-[11px] font-normal leading-4 text-slate-500">
                            Item # {item.productCode}
                          </p>
                        </div>
                        <div className="text-right">
                          <PriceValue
                            item={item}
                            price={item.jobPackCost}
                            priceClassName="text-lg font-black text-slate-950"
                            totalClassName="mt-1 text-sm font-black uppercase tracking-[0.02em] text-slate-500"
                          />
                        </div>
                        {margins.map((margin) => {
                          const sellPrice = getSellPrice(item.jobPackCost, margin);
                          const tone = marginTones[margin];

                          return (
                            <div key={margin} className={`rounded-lg px-1.5 py-2 text-right ${tone.background}`}>
                              <PriceValue
                                item={item}
                                price={sellPrice}
                                priceClassName={`text-lg font-black ${tone.price}`}
                                totalClassName={`mt-1 text-xs font-black ${tone.total}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
          <div className="sm:hidden">
            {colorSections.map((colorSection) => (
              <section key={colorSection.colorName} className="border-t border-slate-300 first:border-t-0">
                <div className="flex items-center gap-3 bg-emerald-50 px-4 py-3">
                  {colorSection.colorName !== "General products" ? (
                    <span
                      className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-emerald-200"
                      style={{ backgroundColor: getSwatchColor(colorSection.colorName) }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-600">Color</p>
                    <h3 className="text-base font-black text-emerald-950">{colorSection.colorName}</h3>
                  </div>
                </div>
                {colorSection.variantGroups.map((variantGroup) => (
                  <div key={variantGroup.key} className="border-t border-slate-200">
                    {variantGroup.isLengthGroup ? (
                      <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-black leading-5 text-slate-950">
                          {variantGroup.title}
                        </p>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500 shadow-sm">
                          {variantGroup.variants.length} lengths
                        </span>
                      </div>
                    ) : null}
                    <div className="divide-y divide-slate-100">
                      {variantGroup.variants.map(({ item, lengthLabel }) => (
                        <div key={`${item.sourcePage}-${item.productCode}`} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-base font-black leading-6 text-slate-950">
                                {variantGroup.isLengthGroup ? lengthLabel : getTrexItemTitle(item)}
                              </p>
                              <p className="mt-1 text-xs font-normal text-slate-500">
                                Item # {item.productCode}
                              </p>
                            </div>
                            <div className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-right">
                              <PriceValue
                                item={item}
                                price={item.jobPackCost}
                                priceClassName="text-lg font-black text-slate-950"
                                totalClassName="mt-1 text-xs font-black uppercase tracking-[0.04em] text-slate-500"
                              />
                            </div>
                          </div>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            {[`${item.piecesPerUnit}/unit`, item.status].filter(Boolean).join(" · ")}
                          </p>
                          <div className="mt-4">
                            <MobileMarginPrices item={item} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
      </div>
    </article>
  );
}

export default function TrexPriceBookPage({ onPageChange }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("decking");
  const [collection, setCollection] = useState("all");
  const totalCollectionCount = useMemo(
    () => new Set(trexPriceBookItems.map((item) => item.collection)).size,
    [],
  );

  const productGroupCounts = useMemo(
    () =>
      Object.fromEntries(
        productGroups.map((group) => [
          group.id,
          trexPriceBookItems.filter((item) => matchesProductGroup(item, group.id)).length,
        ]),
      ),
    [],
  );
  const collections = useMemo(() => {
    const items =
      category === "all"
        ? trexPriceBookItems
        : trexPriceBookItems.filter((item) => matchesProductGroup(item, category));

    return [...new Set(items.map((item) => item.collection))].sort();
  }, [category]);
  const collectionCounts = useMemo(
    () =>
      Object.fromEntries(
        collections.map((value) => [
          value,
          trexPriceBookItems.filter(
            (item) =>
              matchesProductGroup(item, category) && item.collection === value,
          ).length,
        ]),
      ),
    [category, collections],
  );
  const filteredItems = useMemo(() => {
    const search = normalize(query);

    return trexPriceBookItems.filter((item) => {
      if (!matchesProductGroup(item, category)) return false;
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

  const organizedItems = useMemo(
    () =>
      [...filteredItems].sort(
        (first, second) =>
          compareText(first.category, second.category) ||
          compareText(first.collection, second.collection) ||
          compareText(first.color, second.color) ||
          compareProfiles(first.type, second.type) ||
          compareText(first.description, second.description) ||
          compareText(first.productCode, second.productCode),
      ),
    [filteredItems],
  );

  const collectionGroups = useMemo(() => {
    const groups = new Map();

    organizedItems.forEach((item) => {
      const key = item.collection || "Other";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          collection: key,
          categories: new Set(),
          colors: new Set(),
          items: [],
        });
      }
      const group = groups.get(key);
      group.categories.add(item.category);
      if (item.color) group.colors.add(item.color);
      group.items.push(item);
    });

    return [...groups.values()]
      .map((group) => {
        const categories = [...group.categories].sort(compareText);
        return {
          ...group,
          categories,
          colors: [...group.colors].sort(compareText),
          tier: getCollectionTier(group.collection, categories.join(" ")),
        };
      })
      .sort(
        (first, second) =>
          getCollectionGroupRank(first) - getCollectionGroupRank(second) ||
          compareText(first.collection, second.collection),
      );
  }, [organizedItems]);

  const updateCategory = (value) => {
    setCategory(value);
    setCollection("all");
  };

  const updateCollection = (value) => {
    setCollection(value);
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
              <span className="block text-2xl font-black">{totalCollectionCount}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                Collections
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
        <div className="mb-4 overflow-x-auto pb-1">
          <div
            role="tablist"
            aria-label="Filter Trex products by type"
            className="flex min-w-max gap-2 rounded-2xl bg-slate-100 p-1.5"
          >
            {productGroups.map((group) => {
              const isActive = category === group.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => updateCategory(group.id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition sm:px-4 ${
                    isActive
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  {group.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] ${
                      isActive ? "bg-white/15 text-white" : "bg-white text-slate-500"
                    }`}
                  >
                    {productGroupCounts[group.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="relative block">
            <span className="sr-only">Search the Trex price book</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search product code, color, size, or description..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
          </label>
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
          <div className="shrink-0 text-right">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">
              {collectionGroups.length} collections · {filteredItems.length} products
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-700/70">
              Collection → color
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Quick collections
          </p>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2" aria-label="Quick filter by Trex collection">
              <button
                type="button"
                aria-pressed={collection === "all"}
                onClick={() => updateCollection("all")}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-black transition ${
                  collection === "all"
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
                }`}
              >
                All collections
                <span className={collection === "all" ? "text-emerald-100" : "text-slate-400"}>
                  {productGroupCounts[category]}
                </span>
              </button>
              {collections.map((value) => {
                const isActive = collection === value;

                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => updateCollection(value)}
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-black transition ${
                      isActive
                        ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
                    }`}
                  >
                    {value}
                    <span className={isActive ? "text-emerald-100" : "text-slate-400"}>
                      {collectionCounts[value]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {collectionGroups.length > 0 ? (
        <section className="mt-5 space-y-5">
          {collectionGroups.map((group) => (
            <TrexPricingCard key={group.key} group={group} />
          ))}
        </section>
      ) : (
        <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black text-slate-950">No Trex products found</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">Try a product code, color, size, or broader category.</p>
        </section>
      )}

      <p className="mt-4 text-center text-xs font-semibold text-slate-400">
        Source: OrePac Building Products, Boise Net Pricing, August 2026. Verify current pricing before quoting.
      </p>
    </PageContainer>
  );
}
