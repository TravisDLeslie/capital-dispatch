import { useMemo, useState } from "react";
import { History, PackageCheck, Search, Trash2, Truck, X } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { formatDateInput } from "../utils/dateHelpers";
import { formatCustomerName } from "../utils/textFormatters";

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeSearchNumbers(value) {
  return String(value || "").replace(/\D/g, "");
}

function getItemText(items) {
  return Array.isArray(items)
    ? items
        .map((item) =>
          [item.quantity, item.description, item.internalReference]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ")
    : "";
}

function theirTruckPOMatchesSearch(theirTruckPO, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const searchNumbers = normalizeSearchNumbers(searchTerm);
  const searchableText = normalizeSearchText(
    [
      theirTruckPO.poNumber,
      theirTruckPO.orderNumber,
      theirTruckPO.customerName,
      theirTruckPO.vendor,
      theirTruckPO.vendorAddress,
      theirTruckPO.vendorDeliveryNotes,
      getItemText(theirTruckPO.items),
    ]
      .filter(Boolean)
      .join(" "),
  );
  const searchableNumbers = normalizeSearchNumbers(searchableText);

  return (
    searchableText.includes(searchTerm) ||
    (searchNumbers && searchableNumbers.includes(searchNumbers))
  );
}

function groupPOsByDeliveryDate(theirTruckPOs) {
  const groupedPOs = theirTruckPOs.reduce((groups, theirTruckPO) => {
    const dateKey = theirTruckPO.deliveryDate || "unscheduled";

    return {
      ...groups,
      [dateKey]: [...(groups[dateKey] || []), theirTruckPO],
    };
  }, {});

  return Object.entries(groupedPOs)
    .sort(([firstDate], [secondDate]) => secondDate.localeCompare(firstDate))
    .map(([date, pos]) => ({
      date,
      pos: [...pos].sort((firstPO, secondPO) =>
        String(firstPO.poNumber || "").localeCompare(
          String(secondPO.poNumber || ""),
        ),
      ),
    }));
}

function getItemCount(theirTruckPO) {
  return Array.isArray(theirTruckPO.items) ? theirTruckPO.items.length : 0;
}

/**
 * @param {{
 *   theirTruckPOs?: Array<Record<string, any>>;
 *   onDeleteTheirTruckPO?: (theirTruckPOId: string) => void;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function TheirTruckHistoryPage({
  theirTruckPOs = [],
  onDeleteTheirTruckPO,
  onPageChange,
}) {
  const [search, setSearch] = useState("");
  const safeTheirTruckPOs = useMemo(
    () => (Array.isArray(theirTruckPOs) ? theirTruckPOs : []),
    [theirTruckPOs],
  );
  const searchTerm = normalizeSearchText(search);
  const filteredTheirTruckPOs = useMemo(
    () =>
      safeTheirTruckPOs.filter((theirTruckPO) =>
        theirTruckPOMatchesSearch(theirTruckPO, searchTerm),
      ),
    [safeTheirTruckPOs, searchTerm],
  );
  const dateGroups = groupPOsByDeliveryDate(filteredTheirTruckPOs);

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "PO's", onClick: () => onPageChange?.("south") },
          { label: "Their Truck History" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            <History aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            Inbound Archive
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            Their Truck History
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-500">
            Search and review vendor-delivered POs by delivery date, vendor,
            customer, order number, or item.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-right shadow-sm">
          <p className="text-3xl font-black text-blue-800">
            {filteredTheirTruckPOs.length}
          </p>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-500">
            Records
          </p>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="their-truck-history-search"
          className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
        >
          Search Their Truck History
        </label>

        <div className="flex items-center gap-2">
          <span className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              strokeWidth={2.4}
            />
            <input
              id="their-truck-history-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search PO #, order #, customer, vendor, or item"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </span>

          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
              aria-label="Clear search"
            >
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      </section>

      {safeTheirTruckPOs.length === 0 ? (
        <EmptyState
          title="No Their Truck POs yet"
          description="Their Truck POs will show here after they are added."
        />
      ) : filteredTheirTruckPOs.length === 0 ? (
        <EmptyState
          title="No Their Truck POs match that search"
          description="Search by PO number, order number, customer, vendor, or item."
        />
      ) : (
        <section className="space-y-5">
          {dateGroups.map((dateGroup) => (
            <div
              key={dateGroup.date}
              className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-50/40 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-white px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                    Delivery Date
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    {dateGroup.date === "unscheduled"
                      ? "Unscheduled"
                      : formatDateInput(dateGroup.date)}
                  </h2>
                </div>

                <span className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
                  {dateGroup.pos.length}{" "}
                  {dateGroup.pos.length === 1 ? "PO" : "POs"}
                </span>
              </div>

              <div className="grid gap-3 p-4 xl:grid-cols-2">
                {dateGroup.pos.map((theirTruckPO) => (
                  <article
                    key={theirTruckPO.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                          <Truck
                            aria-hidden="true"
                            className="h-6 w-6"
                            strokeWidth={2.5}
                          />
                        </span>

                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                            Their Truck
                          </p>
                          <h3 className="mt-1 truncate text-2xl font-black text-slate-950">
                            {theirTruckPO.poNumber || "No PO #"}
                          </h3>
                        </div>
                      </div>

                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-blue-700">
                        {getItemCount(theirTruckPO)}{" "}
                        {getItemCount(theirTruckPO) === 1 ? "item" : "items"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600">
                      <p>
                        Vendor:{" "}
                        <span className="text-slate-950">
                          {theirTruckPO.vendor || "Unknown vendor"}
                        </span>
                      </p>

                      <p>
                        Customer:{" "}
                        <span className="text-slate-950">
                          {theirTruckPO.isStock
                            ? "Stock"
                            : formatCustomerName(theirTruckPO.customerName)}
                        </span>
                      </p>

                      {theirTruckPO.orderNumber ? (
                        <p>
                          Order:{" "}
                          <span className="text-slate-950">
                            {theirTruckPO.orderNumber}
                          </span>
                        </p>
                      ) : null}

                      {theirTruckPO.vendorDeliveryNotes ? (
                        <p>
                          Cadence:{" "}
                          <span className="text-slate-950">
                            {theirTruckPO.vendorDeliveryNotes}
                          </span>
                        </p>
                      ) : null}
                    </div>

                    {Array.isArray(theirTruckPO.items) &&
                    theirTruckPO.items.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-950">
                          <PackageCheck
                            aria-hidden="true"
                            className="h-4 w-4 text-blue-700"
                            strokeWidth={2.4}
                          />
                          Items
                        </div>
                        <ul className="space-y-1 text-sm font-semibold text-slate-600">
                          {theirTruckPO.items.slice(0, 4).map((item) => (
                            <li key={item.id}>
                              {item.quantity ? `${item.quantity} ` : ""}
                              {item.description}
                              {item.internalReference
                                ? ` • ${item.internalReference}`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {onDeleteTheirTruckPO ? (
                      <div className="mt-4 border-t border-slate-200 pt-3">
                        <button
                          type="button"
                          onClick={() => onDeleteTheirTruckPO(theirTruckPO.id)}
                          className="inline-flex items-center gap-2 text-sm font-black text-red-600 transition hover:text-red-800"
                        >
                          <Trash2
                            aria-hidden="true"
                            className="h-4 w-4"
                            strokeWidth={2.5}
                          />
                          Delete PO
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </PageContainer>
  );
}
