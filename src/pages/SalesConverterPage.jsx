import {
  ArrowRight,
  Calculator,
  ClipboardList,
  Layers,
  Mail,
  MapPin,
  Package,
  Phone,
  Ruler,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const targetMargins = [20, 22.5, 25, 27.5, 30, 35, 40, 45, 50, 55, 60, 65, 70];

function toNumber(value) {
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function feetAndInchesToFeet(feet, inches) {
  return toNumber(feet) + toNumber(inches) / 12;
}

function formatNumber(value) {
  return numberFormatter.format(value || 0);
}

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatPercent(value) {
  return `${formatNumber(value)}%`;
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function getRecordItemText(record) {
  return [...(Array.isArray(record?.items) ? record.items : []), ...(Array.isArray(record?.materials) ? record.materials : [])]
    .map((item) =>
      [
        item?.description,
        item?.internalReference,
        item?.sku,
        item?.itemNumber,
        item?.orderNumber,
        item?.customerName,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
}

function createDashboardSearchItem(
  record,
  type,
  title,
  subtitle,
  searchValue,
  details = {},
) {
  return {
    id: `${type}-${record?.id || title}-${searchValue}`,
    type,
    title,
    subtitle,
    searchValue,
    ...details,
    searchableText: normalizeSearchText(
      [
        title,
        subtitle,
        searchValue,
        record?.poNumber,
        record?.orderNumber,
        record?.customerName,
        record?.businessName,
        record?.vendor,
        record?.address,
        record?.contactName,
        record?.internalReference,
        getRecordItemText(record),
        details.searchText,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

function ConverterInput({
  label,
  labelHint,
  value,
  onChange,
  placeholder,
  suffix,
  step = "any",
}) {
  return (
    <label className="block">
      <span className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        {labelHint ? (
          <span className="text-xs font-semibold text-slate-400">
            {labelHint}
          </span>
        ) : null}
      </span>
      <div className="flex overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-100">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 px-4 py-3 text-base font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
        />
        {suffix ? (
          <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-sm font-black uppercase tracking-[0.08em] text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function ResultCard({ label, value, helper, tone = "default", badge = "" }) {
  const toneClasses = {
    default: {
      card: "border-slate-200 bg-slate-50",
      label: "text-slate-500",
      value: "text-slate-900",
      helper: "text-slate-500",
    },
    muted: {
      card: "border-slate-200 bg-slate-100",
      label: "text-slate-400",
      value: "text-slate-400",
      helper: "text-slate-400",
    },
    warning: {
      card: "border-orange-300 bg-orange-50",
      label: "text-orange-700",
      value: "text-orange-900",
      helper: "text-orange-700",
    },
  };
  const selectedTone = toneClasses[tone] || toneClasses.default;

  return (
    <div className={`rounded-2xl border p-4 ${selectedTone.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs font-black uppercase tracking-[0.16em] ${selectedTone.label}`}>
          {label}
        </p>
        {badge ? (
          <span className="rounded-full bg-orange-200 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-orange-900">
            {badge}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-2xl font-black tracking-tight ${selectedTone.value}`}>
        {value}
      </p>
      {helper ? (
        <p className={`mt-1 text-sm font-semibold ${selectedTone.helper}`}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function MarginTable({
  costEach,
  totalCost,
  unitLabel,
  targetUnitCost,
  targetUnitLabel,
}) {
  const showTargetUnit = Boolean(targetUnitLabel);
  const tableGridClass = showTargetUnit
    ? "sm:grid-cols-[0.7fr_1fr_1fr_1fr]"
    : "sm:grid-cols-[0.7fr_1fr_1fr]";

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="px-4 pt-4">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
            Target Margin
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Sell price needed at each margin.
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        <div
          className={`hidden gap-3 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500 sm:grid ${tableGridClass}`}
        >
          <span>Margin</span>
          <span>Per {unitLabel}</span>
          {showTargetUnit ? <span>Per {targetUnitLabel}</span> : null}
          <span>Total</span>
        </div>

        {targetMargins.map((margin) => {
          const marginRate = margin / 100;
          const isLowMargin = margin <= 22.5;
          const isHighMargin = margin > 45;
          const sellEach = marginRate < 1 ? costEach / (1 - marginRate) : 0;
          const sellTotal = marginRate < 1 ? totalCost / (1 - marginRate) : 0;
          const targetUnitSell =
            marginRate < 1 && showTargetUnit
              ? targetUnitCost / (1 - marginRate)
              : 0;

          return (
            <div
              key={margin}
              className={`grid gap-2 px-4 py-3 sm:items-center sm:gap-3 ${tableGridClass} ${
                isHighMargin
                  ? "bg-orange-50"
                  : isLowMargin
                    ? "bg-slate-50 text-slate-400 opacity-65"
                    : ""
              }`}
            >
              <p
                className={`flex items-center gap-2 text-sm font-black ${
                  isHighMargin
                    ? "text-orange-800"
                    : isLowMargin
                      ? "text-slate-400"
                      : "text-[#FC2C38]"
                }`}
              >
                <span>{margin}%</span>
                {isHighMargin ? (
                  <span className="rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-900">
                    Maybe trim
                  </span>
                ) : null}
              </p>
              <p className={`flex items-center justify-between gap-3 text-sm font-black sm:block ${isLowMargin ? "text-slate-400" : isHighMargin ? "text-orange-900" : "text-slate-900"}`}>
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 sm:hidden">
                  Per {unitLabel}
                </span>
                <span>{formatCurrency(sellEach)}</span>
              </p>
              {showTargetUnit ? (
                <p className={`flex items-center justify-between gap-3 text-sm font-black sm:block ${isLowMargin ? "text-slate-400" : isHighMargin ? "text-orange-900" : "text-slate-900"}`}>
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 sm:hidden">
                    Per {targetUnitLabel}
                  </span>
                  <span>{formatCurrency(targetUnitSell)}</span>
                </p>
              ) : null}
              <p className={`flex items-center justify-between gap-3 text-sm font-bold sm:block ${isLowMargin ? "text-slate-400" : isHighMargin ? "text-orange-800" : "text-slate-600"}`}>
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 sm:hidden">
                  Total
                </span>
                <span>{formatCurrency(sellTotal)}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SellPriceCheck({
  value,
  onChange,
  costEach,
  quantity,
  unitFactor,
  unitLabel,
  targetUnitLabel,
}) {
  const sellEach = toNumber(value);
  const margin = sellEach > 0 ? ((sellEach - costEach) / sellEach) * 100 : 0;
  const marginTone = margin > 45 ? "warning" : margin <= 22.5 ? "muted" : "default";
  const sellTotal = sellEach * quantity;
  const showTargetUnit = Boolean(targetUnitLabel);
  const targetUnitSell = unitFactor > 0 && showTargetUnit ? sellEach / unitFactor : 0;

  return (
    <div
      id="margin-calculator"
      className="mt-4 scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <div
        className={`grid gap-3 sm:items-end ${
          showTargetUnit
            ? "sm:grid-cols-[1.2fr_0.8fr_0.8fr]"
            : "sm:grid-cols-[1.2fr_0.8fr]"
        }`}
      >
        <ConverterInput
          label={`Check Sell Price Per ${unitLabel}`}
          value={value}
          onChange={onChange}
          placeholder="0.00"
          suffix="$"
        />

        <ResultCard
          label="Actual Margin"
          value={formatPercent(margin)}
          helper={`${formatCurrency(sellTotal)} total`}
          tone={marginTone}
          badge={margin > 45 ? "Maybe trim" : ""}
        />

        {showTargetUnit ? (
          <ResultCard
            label={`Sell Per ${targetUnitLabel}`}
            value={formatCurrency(targetUnitSell)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   onPageChange?: (pageId: string) => void;
 *   onTraceSearch?: (searchValue: string) => void;
 *   searchSources?: Record<string, Array<Record<string, any>>>;
 *   dashboardMode?: boolean;
 * }} props
 */
export default function SalesConverterPage({
  onPageChange,
  onTraceSearch,
  searchSources = {},
  dashboardMode = false,
}) {
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [isDashboardSearchOpen, setIsDashboardSearchOpen] = useState(false);
  const [converterType, setConverterType] = useState("boards");
  const [panelQuantity, setPanelQuantity] = useState("1");
  const [panelWidthFeet, setPanelWidthFeet] = useState("4");
  const [panelWidthInches, setPanelWidthInches] = useState("");
  const [panelLengthFeet, setPanelLengthFeet] = useState("8");
  const [panelLengthInches, setPanelLengthInches] = useState("");
  const [panelPrice, setPanelPrice] = useState("");
  const [panelPriceUnit, setPanelPriceUnit] = useState("msf");
  const [panelSellPrice, setPanelSellPrice] = useState("");

  const [boardQuantity, setBoardQuantity] = useState("1");
  const [boardThickness, setBoardThickness] = useState("2");
  const [boardWidth, setBoardWidth] = useState("6");
  const [boardLength, setBoardLength] = useState("16");
  const [boardPricePerMbf, setBoardPricePerMbf] = useState("");
  const [boardSellPrice, setBoardSellPrice] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemCost, setItemCost] = useState("");
  const [itemSellPrice, setItemSellPrice] = useState("");

  const panelTotals = useMemo(() => {
    const quantity = toNumber(panelQuantity);
    const widthFeet = feetAndInchesToFeet(panelWidthFeet, panelWidthInches);
    const lengthFeet = feetAndInchesToFeet(panelLengthFeet, panelLengthInches);
    const squareFeetEach = widthFeet * lengthFeet;
    const totalSquareFeet = squareFeetEach * quantity;
    const price = toNumber(panelPrice);
    const pricePerSqft =
      panelPriceUnit === "msf"
        ? price / 1000
        : panelPriceUnit === "sheet" && squareFeetEach > 0
          ? price / squareFeetEach
          : price;
    const costEachSheet =
      panelPriceUnit === "sheet" ? price : squareFeetEach * pricePerSqft;
    const totalCost =
      panelPriceUnit === "sheet" ? quantity * price : totalSquareFeet * pricePerSqft;

    return {
      squareFeetEach,
      msfEach: squareFeetEach / 1000,
      totalSquareFeet,
      costEachSheet,
      pricePerSqft,
      pricePerMsf: pricePerSqft * 1000,
      totalCost,
    };
  }, [
    panelLengthFeet,
    panelLengthInches,
    panelPrice,
    panelPriceUnit,
    panelQuantity,
    panelWidthFeet,
    panelWidthInches,
  ]);

  const boardTotals = useMemo(() => {
    const quantity = toNumber(boardQuantity);
    const boardFeetEach =
      (toNumber(boardThickness) * toNumber(boardWidth) * toNumber(boardLength)) /
      12;
    const totalBoardFeet = boardFeetEach * quantity;
    const totalMbf = totalBoardFeet / 1000;
    const totalCost = totalMbf * toNumber(boardPricePerMbf);
    const costEachBoard = quantity > 0 ? totalCost / quantity : 0;

    return {
      boardFeetEach,
      mbfEach: boardFeetEach / 1000,
      costEachBoard,
      totalBoardFeet,
      totalMbf,
      totalCost,
      pricePerBoardFoot: toNumber(boardPricePerMbf) / 1000,
    };
  }, [
    boardLength,
    boardPricePerMbf,
    boardQuantity,
    boardThickness,
    boardWidth,
  ]);

  const itemTotals = useMemo(() => {
    const quantity = toNumber(itemQuantity);
    const costEachItem = toNumber(itemCost);

    return {
      costEachItem,
      totalCost: costEachItem * quantity,
    };
  }, [itemCost, itemQuantity]);

  const dashboardSearchItems = useMemo(() => {
    const safeSource = (key) =>
      Array.isArray(searchSources?.[key]) ? searchSources[key] : [];
    const items = [];

    [...safeSource("vendors")]
      .sort((firstVendor, secondVendor) =>
        String(firstVendor.name || "").localeCompare(
          String(secondVendor.name || ""),
          undefined,
          {
            sensitivity: "base",
            ignorePunctuation: true,
            numeric: true,
          },
        ),
      )
      .forEach((record) => {
        const contacts = Array.isArray(record.contacts) ? record.contacts : [];
        const contactText = contacts
          .map((contact) =>
            [contact.name, contact.products, contact.phone, contact.email]
              .filter(Boolean)
              .join(" "),
          )
          .join(" ");
        items.push(
          createDashboardSearchItem(
            record,
            "Supplier",
            String(record.name || "Supplier"),
            [record.phone, record.deliveryCadence, record.address]
              .filter(Boolean)
              .join(" • "),
            String(record.name || ""),
            {
              supplierProfile: true,
              phone: String(record.phone || ""),
              address: String(record.address || ""),
              deliveryCadence: String(record.deliveryCadence || ""),
              contacts,
              searchText: contactText,
            },
          ),
        );
      });

    safeSource("supplierRuns").forEach((record) => {
      const poNumber = String(record.poNumber || "").trim();
      items.push(
        createDashboardSearchItem(
          record,
          "South PO",
          poNumber ? `PO ${poNumber}` : "South pickup",
          [record.vendor, record.customerName, record.scheduledDate]
            .filter(Boolean)
            .join(" • "),
          poNumber || record.orderNumber || record.customerName || "",
        ),
      );
    });

    safeSource("theirTruckPOs").forEach((record) => {
      const poNumber = String(record.poNumber || "").trim();
      items.push(
        createDashboardSearchItem(
          record,
          "Their Truck",
          poNumber ? `PO ${poNumber}` : "Supplier delivery",
          [record.vendor, record.customerName, record.deliveryDate]
            .filter(Boolean)
            .join(" • "),
          poNumber || record.orderNumber || record.customerName || "",
        ),
      );
    });

    safeSource("checkIns").forEach((record) => {
      const poNumber = String(record.poNumber || "").trim();
      const businessName = record.orderAssignment?.businessName || record.customer?.businessName;
      items.push(
        createDashboardSearchItem(
          record,
          "Receiving",
          poNumber ? `PO ${poNumber}` : "Receiving check-in",
          [record.vendor, businessName, record.poLocation]
            .filter(Boolean)
            .join(" • "),
          poNumber || businessName || record.vendor || "",
        ),
      );
    });

    safeSource("deliveries").forEach((record) => {
      const orderNumber = String(record.orderNumber || "").trim();
      items.push(
        createDashboardSearchItem(
          record,
          "Delivery",
          orderNumber ? `Order ${orderNumber}` : record.customerName || "Delivery",
          [record.customerName, record.address, record.driver]
            .filter(Boolean)
            .join(" • "),
          orderNumber || record.customerName || record.address || "",
        ),
      );
    });

    safeSource("orderBuilds").forEach((record) => {
      const orderNumber = String(record.orderNumber || "").trim();
      items.push(
        createDashboardSearchItem(
          record,
          "Order",
          orderNumber ? `Order ${orderNumber}` : "Open order",
          [record.businessName, record.customerName, record.status]
            .filter(Boolean)
            .join(" • "),
          orderNumber || record.businessName || record.customerName || "",
        ),
      );
    });

    safeSource("customers").forEach((record) => {
      const customerName = String(
        record.businessName || record.customerName || record.name || "",
      ).trim();
      items.push(
        createDashboardSearchItem(
          record,
          "Customer",
          customerName || "Customer",
          [record.contactName, record.phone, record.accountNumber]
            .filter(Boolean)
            .join(" • "),
          customerName || record.accountNumber || record.phone || "",
        ),
      );
    });

    return items.filter((item) => item.searchValue);
  }, [searchSources]);
  const normalizedDashboardSearch = normalizeSearchText(dashboardSearch);
  const dashboardSearchAllMatches = normalizedDashboardSearch
    ? dashboardSearchItems
        .filter((item) => item.searchableText.includes(normalizedDashboardSearch))
    : dashboardSearchItems.filter((item) => item.supplierProfile);
  const dashboardSearchMatches = dashboardSearchAllMatches.slice(0, 40);

  if (dashboardMode) {
    return (
      <PageContainer>
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Main Dashboard
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            Main
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            Start an order, find activity across the app, or open a pricing tool.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const searchValue = dashboardSearch.trim();

            if (searchValue) {
              onTraceSearch?.(searchValue);
            }
          }}
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row"
        >
          <div className="relative min-w-0 flex-1">
            <label className="relative block">
              <span className="sr-only">Search across the app</span>
              <Search
                aria-hidden="true"
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                strokeWidth={2.5}
              />
              <input
                type="search"
                value={dashboardSearch}
                onChange={(event) => {
                  setDashboardSearch(event.target.value);
                  setIsDashboardSearchOpen(true);
                }}
                onFocus={() => setIsDashboardSearchOpen(true)}
                onBlur={() =>
                  window.setTimeout(() => setIsDashboardSearchOpen(false), 150)
                }
                placeholder="Search PO, order, customer, vendor, material, or SKU..."
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 text-base font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
              />
            </label>

            {isDashboardSearchOpen ? (
              <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {dashboardSearchMatches.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto p-2">
                    {dashboardSearchMatches.map((result) =>
                      result.supplierProfile ? (
                        <button
                          key={result.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setIsDashboardSearchOpen(false);
                            onTraceSearch?.(result.searchValue);
                          }}
                          className="block w-full rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span>
                              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                                Supplier
                              </span>
                              <span className="mt-0.5 block text-base font-black text-slate-950">
                                {result.title}
                              </span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-blue-700">
                              View all POs
                              <ArrowRight
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                                strokeWidth={2.7}
                              />
                            </span>
                          </span>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-slate-600">
                            {result.phone ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                                {result.phone}
                              </span>
                            ) : null}
                            {result.address ? (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                                {result.address}
                              </span>
                            ) : null}
                            {result.deliveryCadence ? (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-blue-700">
                                Delivers {result.deliveryCadence}
                              </span>
                            ) : null}
                          </div>
                          {Array.isArray(result.contacts) && result.contacts.length > 0 ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {result.contacts.slice(0, 4).map((contact) => (
                                <div
                                  key={contact.id || `${contact.name}-${contact.products}`}
                                  className="rounded-lg border border-blue-100 bg-white px-3 py-2"
                                >
                                  <p className="text-xs font-black text-slate-900">
                                    {contact.name || "Supplier contact"}
                                  </p>
                                  {contact.products ? (
                                    <p className="mt-0.5 text-[11px] font-bold text-blue-700">
                                      Best for: {contact.products}
                                    </p>
                                  ) : null}
                                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                                    {contact.phone ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Phone className="h-3 w-3" aria-hidden="true" />
                                        {contact.phone}
                                      </span>
                                    ) : null}
                                    {contact.email ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Mail className="h-3 w-3" aria-hidden="true" />
                                        {contact.email}
                                      </span>
                                    ) : null}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="mt-2 block text-xs font-semibold text-slate-500">
                              No product contacts have been added yet.
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          key={result.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setIsDashboardSearchOpen(false);
                            onTraceSearch?.(result.searchValue);
                          }}
                          className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                        <span className="min-w-0">
                          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#FC2C38]">
                            {result.type}
                          </span>
                          <span className="mt-0.5 block truncate text-sm font-black text-slate-950">
                            {result.title}
                          </span>
                          {result.subtitle ? (
                            <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                              {result.subtitle}
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-slate-400"
                          strokeWidth={2.6}
                        />
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-5">
                    <p className="text-sm font-black text-slate-700">
                      No quick matches yet
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Press Enter or Search App to run the full search.
                    </p>
                  </div>
                )}
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">
                  {dashboardSearchMatches.length > 0
                    ? normalizedDashboardSearch
                      ? `${dashboardSearchMatches.length}${dashboardSearchAllMatches.length > dashboardSearchMatches.length ? ` of ${dashboardSearchAllMatches.length}` : ""} quick match${dashboardSearchMatches.length === 1 ? "" : "es"} • Press Enter for all results`
                      : `${dashboardSearchAllMatches.length} supplier${dashboardSearchAllMatches.length === 1 ? "" : "s"} • Type to search products and contacts`
                    : "Search includes POs, orders, customers, vendors, materials, and SKUs"}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Search App
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.7} />
          </button>
        </form>

        <div className="grid gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onPageChange?.("order-flow")}
            className="group flex min-h-[230px] flex-col justify-between rounded-[2rem] border border-red-200 bg-red-50 p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-lg"
          >
            <span>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#FC2C38] shadow-sm">
                <ClipboardList aria-hidden="true" className="h-7 w-7" strokeWidth={2.5} />
              </span>
              <span className="mt-6 block text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Orders
              </span>
              <span className="mt-2 block text-3xl font-black tracking-tight text-slate-950">
                New Orders
              </span>
              <span className="mt-2 block max-w-md text-base font-semibold text-slate-600">
                Enter a customer order or create a streamlined Stock PO.
              </span>
            </span>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#FC2C38]">
              Start an order
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={2.7} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onPageChange?.("sales-converter")}
            className="group flex min-h-[230px] flex-col justify-between rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
          >
            <span>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                <Calculator aria-hidden="true" className="h-7 w-7" strokeWidth={2.5} />
              </span>
              <span className="mt-6 block text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Pricing Tool
              </span>
              <span className="mt-2 block text-3xl font-black tracking-tight text-slate-950">
                Price Converter
              </span>
              <span className="mt-2 block max-w-md text-base font-semibold text-slate-600">
                Convert boards, panel goods, and items with the margin calculator included.
              </span>
            </span>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-emerald-800">
              Open converter
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={2.7} />
            </span>
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {!dashboardMode ? (
        <Breadcrumbs
          items={[
            { label: "Sales", onClick: () => onPageChange?.("sales") },
            { label: "Converter" },
          ]}
        />
      ) : null}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            {dashboardMode ? "Main Dashboard" : "Sales"}
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            {dashboardMode ? "Main" : "Converter"}
          </h1>

          <p className="mt-2 max-w-3xl text-lg text-slate-500">
            {dashboardMode
              ? "Start an order, search operations, or use the pricing tools below."
              : "Price converter for boards, panel goods, and individual items."}
          </p>
        </div>

        {dashboardMode ? (
          <button
            type="button"
            onClick={() => onPageChange?.("order-flow")}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-600 sm:w-auto"
          >
            <ClipboardList aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            New Order
          </button>
        ) : null}
      </div>

      {dashboardMode ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const searchValue = dashboardSearch.trim();

            if (searchValue) {
              onTraceSearch?.(searchValue);
            }
          }}
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row"
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search across the app</span>
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              strokeWidth={2.5}
            />
            <input
              type="search"
              value={dashboardSearch}
              onChange={(event) => setDashboardSearch(event.target.value)}
              placeholder="Search PO, order, customer, vendor, material, or SKU..."
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 text-base font-bold text-slate-950 outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Search App
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.7} />
          </button>
        </form>
      ) : null}

      <div
        className={
          dashboardMode
            ? "rounded-[2rem] border border-slate-200 bg-slate-100/70 p-4 shadow-sm sm:p-5"
            : ""
        }
      >
        {dashboardMode ? (
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#FC2C38] shadow-sm">
              <Calculator aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                Pricing Tool
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Price Converter
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Convert material pricing and check target margins in one place.
              </p>
            </div>
          </div>
        ) : null}

      {dashboardMode ? (
        <a
          href="#margin-calculator"
          className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
              <Calculator aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-sm font-black text-emerald-950">
                Margin calculator included
              </span>
              <span className="mt-0.5 block text-xs font-bold text-emerald-700 sm:text-sm">
                Enter your cost, then check actual margin and target sell prices below.
              </span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-black text-emerald-800">
            View margin ↓
          </span>
        </a>
      ) : null}

      <div className="mb-5 grid grid-cols-3 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:max-w-2xl sm:grid-cols-[auto_1fr_1fr_1fr]">
        <span className="hidden px-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 sm:block sm:px-3 sm:text-xs">
          Convert
        </span>
        <button
          type="button"
          onClick={() => setConverterType("boards")}
          className={`flex min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-black transition sm:gap-2 sm:px-4 sm:text-sm ${
            converterType === "boards"
              ? "bg-[#FC2C38] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Ruler aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
          <span>Boards</span>
        </button>
        <button
          type="button"
          onClick={() => setConverterType("panel")}
          className={`flex min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-black transition sm:gap-2 sm:px-4 sm:text-sm ${
            converterType === "panel"
              ? "bg-[#FC2C38] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Layers aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
          <span>Panel Goods</span>
        </button>
        <button
          type="button"
          onClick={() => setConverterType("item")}
          className={`flex min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-black transition sm:gap-2 sm:px-4 sm:text-sm ${
            converterType === "item"
              ? "bg-[#FC2C38] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Package aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
          Item
        </button>
      </div>

      <div className="grid gap-5">
        {converterType === "panel" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
              <Layers aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Panel Goods
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Use for plywood, OSB, siding, and other sheet goods sold by
                SQFT, MSF, or sheet.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ConverterInput
              label="Quantity"
              value={panelQuantity}
              onChange={setPanelQuantity}
              placeholder="1"
              suffix="pcs"
            />
            <ConverterInput
              label={
                panelPriceUnit === "msf"
                  ? "Price Per MSF"
                  : panelPriceUnit === "sheet"
                    ? "Price Per Sheet"
                    : "Price Per SQFT"
              }
              value={panelPrice}
              onChange={setPanelPrice}
              placeholder="0.00"
              suffix="$"
            />
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Panel Price Unit
              </span>
              <select
                value={panelPriceUnit}
                onChange={(event) => setPanelPriceUnit(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              >
                <option value="msf">Price per MSF / 1,000 SQFT</option>
                <option value="sqft">Price per SQFT</option>
                <option value="sheet">Price per sheet</option>
              </select>
            </label>
            <ConverterInput
              label="Width Feet"
              value={panelWidthFeet}
              onChange={setPanelWidthFeet}
              placeholder="4"
              suffix="ft"
            />
            <ConverterInput
              label="Width Inches"
              value={panelWidthInches}
              onChange={setPanelWidthInches}
              placeholder="0"
              suffix="in"
            />
            <ConverterInput
              label="Length Feet"
              value={panelLengthFeet}
              onChange={setPanelLengthFeet}
              placeholder="8"
              suffix="ft"
            />
            <ConverterInput
              label="Length Inches"
              value={panelLengthInches}
              onChange={setPanelLengthInches}
              placeholder="0"
              suffix="in"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ResultCard
              label="SQFT Each"
              value={`${formatNumber(panelTotals.squareFeetEach)} SQFT`}
            />
            <ResultCard
              label="Total SQFT"
              value={`${formatNumber(panelTotals.totalSquareFeet)} SQFT`}
            />
            <ResultCard
              label="Cost Per Sheet"
              value={formatCurrency(panelTotals.costEachSheet)}
              helper={`${formatCurrency(panelTotals.pricePerSqft)} per SQFT`}
            />
            <ResultCard
              label="Estimated Cost"
              value={formatCurrency(panelTotals.totalCost)}
            />
          </div>

          <SellPriceCheck
            value={panelSellPrice}
            onChange={setPanelSellPrice}
            costEach={panelTotals.costEachSheet}
            quantity={toNumber(panelQuantity)}
            unitFactor={panelTotals.msfEach}
            unitLabel="Sheet"
            targetUnitLabel="MSF"
          />

          <MarginTable
            costEach={panelTotals.costEachSheet}
            totalCost={panelTotals.totalCost}
            unitLabel="sheet"
            targetUnitCost={panelTotals.pricePerMsf}
            targetUnitLabel="MSF"
          />
        </section>
        ) : null}

        {converterType === "boards" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Ruler aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Boards
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Use nominal thickness, width, length, and supplier MBF pricing.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ConverterInput
              label="Quantity"
              value={boardQuantity}
              onChange={setBoardQuantity}
              placeholder="1"
              suffix="pcs"
            />
            <ConverterInput
              label="Price Per MBF"
              value={boardPricePerMbf}
              onChange={setBoardPricePerMbf}
              placeholder="0.00"
              suffix="$"
            />
            <ConverterInput
              label="Thickness"
              labelHint="First number: 1×8-12 = 1"
              value={boardThickness}
              onChange={setBoardThickness}
              placeholder="2"
              suffix="in"
            />
            <ConverterInput
              label="Width"
              labelHint="Second number: 1×8-12 = 8"
              value={boardWidth}
              onChange={setBoardWidth}
              placeholder="6"
              suffix="in"
            />
            <ConverterInput
              label="Length"
              labelHint="Last number: 1×8-12 = 12"
              value={boardLength}
              onChange={setBoardLength}
              placeholder="16"
              suffix="ft"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ResultCard
              label="Each Board"
              value={`${formatNumber(boardTotals.boardFeetEach)} BF`}
            />
            <ResultCard
              label="Total Board Feet"
              value={`${formatNumber(boardTotals.totalBoardFeet)} BF`}
            />
            <ResultCard
              label="Total MBF"
              value={`${formatNumber(boardTotals.totalMbf)} MBF`}
            />
            <ResultCard
              label="Estimated Cost"
              value={formatCurrency(boardTotals.totalCost)}
              helper={`${formatCurrency(boardTotals.pricePerBoardFoot)} per BF`}
            />
          </div>

          <SellPriceCheck
            value={boardSellPrice}
            onChange={setBoardSellPrice}
            costEach={boardTotals.costEachBoard}
            quantity={toNumber(boardQuantity)}
            unitFactor={boardTotals.mbfEach}
            unitLabel="Board"
            targetUnitLabel="MBF"
          />

          <MarginTable
            costEach={boardTotals.costEachBoard}
            totalCost={boardTotals.totalCost}
            unitLabel="board"
            targetUnitCost={toNumber(boardPricePerMbf)}
            targetUnitLabel="MBF"
          />
        </section>
        ) : null}

        {converterType === "item" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Package aria-hidden="true" className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Item
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Use for hardware, special order parts, and anything priced per
                each.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ConverterInput
              label="Quantity"
              value={itemQuantity}
              onChange={setItemQuantity}
              placeholder="1"
              suffix="pcs"
            />
            <ConverterInput
              label="Cost Per Item"
              value={itemCost}
              onChange={setItemCost}
              placeholder="0.00"
              suffix="$"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ResultCard
              label="Cost Per Item"
              value={formatCurrency(itemTotals.costEachItem)}
            />
            <ResultCard
              label="Estimated Cost"
              value={formatCurrency(itemTotals.totalCost)}
            />
          </div>

          <SellPriceCheck
            value={itemSellPrice}
            onChange={setItemSellPrice}
            costEach={itemTotals.costEachItem}
            quantity={toNumber(itemQuantity)}
            unitFactor={0}
            unitLabel="Item"
          />

          <MarginTable
            costEach={itemTotals.costEachItem}
            totalCost={itemTotals.totalCost}
            unitLabel="item"
          />
        </section>
        ) : null}
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <Calculator
              aria-hidden="true"
              className="h-5 w-5"
              strokeWidth={2.4}
            />
          </span>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Quick formulas
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              SQFT = width x length x quantity. Board feet = thickness x width x
              length / 12 x quantity. MBF = board feet / 1,000.
            </p>
          </div>
        </div>
      </div>
      </div>
    </PageContainer>
  );
}
