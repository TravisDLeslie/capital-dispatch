import { ClipboardList, PackageCheck, Truck, Warehouse } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const pathLabels = {
  wePickup: "South pickup",
  supplierDelivery: "Their Truck",
  pod: "POD",
  inStock: "Stock",
};

function getWaitingItems(build) {
  return (build.items || []).filter((item) => item.path !== "inStock");
}

function getStockItems(build) {
  return (build.items || []).filter((item) => item.path === "inStock");
}

/**
 * @param {{
 *   builds?: Array<Record<string, any>>;
 *   onPageChange?: (pageId: string) => void;
 * }} props
 */
export default function OrderBuildsPage({ builds = [], onPageChange }) {
  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "New Home", onClick: () => onPageChange?.("new-home") },
          { label: "Build" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Build Watch
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Orders Waiting on Material
          </h1>
          <p className="mt-2 max-w-2xl text-lg font-bold text-slate-500">
            A high-level build view that shows what is ready and what is still
            waiting on South, Their Truck, or POD material.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          {builds.length} orders
        </span>
      </div>

      <div className="grid gap-3">
        {builds.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
            <Warehouse className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-xl font-black text-slate-950">
              No builds tracked yet
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Process an order in New Home and it will appear here.
            </p>
          </div>
        ) : (
          builds.map((build) => {
            const waitingItems = getWaitingItems(build);
            const stockItems = getStockItems(build);

            return (
              <article
                key={build.id}
                className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                      Order {build.orderNumber || "No order #"}
                    </p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                      {build.businessName || build.customerName || "No customer"}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {build.customerName || "No contact"}
                      {build.phoneNumber ? ` · ${build.phoneNumber}` : ""}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <span className="rounded-2xl bg-amber-50 px-4 py-2 text-center text-sm font-black text-amber-800">
                      {waitingItems.length} waiting
                    </span>
                    <span className="rounded-2xl bg-emerald-50 px-4 py-2 text-center text-sm font-black text-emerald-800">
                      {stockItems.length} stock
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Truck className="h-5 w-5" aria-hidden="true" />
                      <p className="text-sm font-black uppercase tracking-[0.12em]">
                        Waiting On
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {waitingItems.length === 0 ? (
                        <p className="text-sm font-bold text-slate-500">
                          No outside material paths on this order.
                        </p>
                      ) : (
                        waitingItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl bg-white px-4 py-3"
                          >
                            <p className="font-black text-slate-950">
                              {item.quantity ? `QTY ${item.quantity} · ` : ""}
                              {item.description || "Unnamed item"}
                            </p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                              {pathLabels[item.path] || "Outside"} ·{" "}
                              {item.vendor || "No vendor"} · PO{" "}
                              {item.poNumber || "not entered"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <PackageCheck className="h-5 w-5" aria-hidden="true" />
                      <p className="text-sm font-black uppercase tracking-[0.12em]">
                        Can Build From Stock
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {stockItems.length === 0 ? (
                        <p className="text-sm font-bold text-slate-500">
                          No stock items entered yet.
                        </p>
                      ) : (
                        stockItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl bg-white px-4 py-3"
                          >
                            <p className="font-black text-slate-950">
                              {item.quantity ? `QTY ${item.quantity} · ` : ""}
                              {item.description || "Unnamed item"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
