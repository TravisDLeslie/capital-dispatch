import { Calculator, Layers, Package, Ruler } from "lucide-react";
import { useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const targetMargins = [20, 25, 27.5, 30, 35, 40, 45, 50];

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

function ConverterInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  step = "any",
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
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

function ResultCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-sm font-semibold text-slate-500">{helper}</p>
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
  trimMargin,
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
          const sellEach = marginRate < 1 ? costEach / (1 - marginRate) : 0;
          const sellTotal = marginRate < 1 ? totalCost / (1 - marginRate) : 0;
          const targetUnitSell =
            marginRate < 1 && showTargetUnit
              ? targetUnitCost / (1 - marginRate)
              : 0;

          return (
            <div
              key={margin}
              className={`grid gap-2 px-4 py-3 sm:items-center sm:gap-3 ${tableGridClass}`}
            >
              <p className="flex items-center gap-2 text-sm font-black text-[#FC2C38]">
                <span>{margin}%</span>
                {trimMargin === margin ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                    Trim
                  </span>
                ) : null}
              </p>
              <p className="flex items-center justify-between gap-3 text-sm font-black text-slate-900 sm:block">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 sm:hidden">
                  Per {unitLabel}
                </span>
                <span>{formatCurrency(sellEach)}</span>
              </p>
              {showTargetUnit ? (
                <p className="flex items-center justify-between gap-3 text-sm font-black text-slate-900 sm:block">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 sm:hidden">
                    Per {targetUnitLabel}
                  </span>
                  <span>{formatCurrency(targetUnitSell)}</span>
                </p>
              ) : null}
              <p className="flex items-center justify-between gap-3 text-sm font-bold text-slate-600 sm:block">
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
  const sellTotal = sellEach * quantity;
  const showTargetUnit = Boolean(targetUnitLabel);
  const targetUnitSell = unitFactor > 0 && showTargetUnit ? sellEach / unitFactor : 0;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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

export default function SalesConverterPage() {
  const [converterType, setConverterType] = useState("panel");
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

  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Sales
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Converter
        </h1>

        <p className="mt-2 max-w-3xl text-lg text-slate-500">
          Convert panel goods, boards, and each-price items so supplier pricing
          is easier to turn into job dollars.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:max-w-2xl">
        <span className="px-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 sm:px-3 sm:text-xs">
          Convert
        </span>
        <button
          type="button"
          onClick={() => setConverterType("panel")}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
            converterType === "panel"
              ? "bg-[#FC2C38] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Layers aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          <span className="sm:hidden">Sheet</span>
          <span className="hidden sm:inline">Panel Goods</span>
        </button>
        <button
          type="button"
          onClick={() => setConverterType("boards")}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
            converterType === "boards"
              ? "bg-[#FC2C38] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Ruler aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          <span className="sm:hidden">Board</span>
          <span className="hidden sm:inline">Boards</span>
        </button>
        <button
          type="button"
          onClick={() => setConverterType("item")}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
            converterType === "item"
              ? "bg-[#FC2C38] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Package aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
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
              value={boardThickness}
              onChange={setBoardThickness}
              placeholder="2"
              suffix="in"
            />
            <ConverterInput
              label="Width"
              value={boardWidth}
              onChange={setBoardWidth}
              placeholder="6"
              suffix="in"
            />
            <ConverterInput
              label="Length"
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
            trimMargin={50}
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
    </PageContainer>
  );
}
