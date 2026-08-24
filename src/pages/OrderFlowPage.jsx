import { useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  Clock,
  Hammer,
  Package,
  Plus,
  Route,
  Truck,
  Warehouse,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const fulfillmentPaths = [
  {
    id: "inStock",
    label: "In Stock",
    description: "Material is already in the yard and can move to a build.",
    icon: Warehouse,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    id: "southPO",
    label: "South PO",
    description: "We pick it up from a supplier on a South route.",
    icon: Truck,
    tone: "border-red-200 bg-red-50 text-[#FC2C38]",
  },
  {
    id: "theirTruckPO",
    label: "Their Truck PO",
    description: "Vendor brings the material to Capital Lumber.",
    icon: Package,
    tone: "border-blue-200 bg-blue-50 text-blue-800",
  },
  {
    id: "waiting",
    label: "Backordered / Waiting",
    description: "Not ready yet. Keep visible without sending to the yard.",
    icon: Clock,
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
];

const defaultItems = [
  {
    id: "item-1",
    quantity: "10",
    description: "2x6-16 #2 Doug Fir",
    path: "inStock",
    buildReady: true,
  },
  {
    id: "item-2",
    quantity: "4",
    description: "4x4-16 Pressure Treat",
    path: "southPO",
    buildReady: false,
  },
  {
    id: "item-3",
    quantity: "1",
    description: "Simpson hardware pack",
    path: "waiting",
    buildReady: false,
  },
];

function getPath(pathId) {
  return (
    fulfillmentPaths.find((path) => path.id === pathId) ||
    fulfillmentPaths[0]
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
    />
  );
}

function FlowStep({ icon: Icon, title, description, tone = "red" }) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-red-50 text-[#FC2C38]";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <span
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function OrderFlowPage() {
  const [orderNumber, setOrderNumber] = useState("019-390");
  const [customerName, setCustomerName] = useState("King Building");
  const [neededBy, setNeededBy] = useState("");
  const [buildName, setBuildName] = useState("Main delivery build");
  const [items, setItems] = useState(defaultItems);

  const pathCounts = useMemo(
    () =>
      fulfillmentPaths.map((path) => ({
        ...path,
        count: items.filter((item) => item.path === path.id).length,
      })),
    [items],
  );
  const buildItems = items.filter((item) => item.path !== "waiting");
  const readyBuildItems = buildItems.filter(
    (item) => item.path === "inStock" || item.buildReady,
  );
  const blockedItems = items.filter(
    (item) => item.path === "waiting" || !item.buildReady,
  );

  function updateItem(itemId, updates) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    );
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        id: `item-${Date.now()}`,
        quantity: "",
        description: "",
        path: "inStock",
        buildReady: true,
      },
    ]);
  }

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Order Flow" }]} />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Super Admin Lab
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Order Flow
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold leading-7 text-slate-500">
            Test the future order-first workflow without changing the live PO,
            receiving, delivery, or yard task data.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
          Prototype only
        </span>
      </div>

      <section className="grid gap-3 lg:grid-cols-5">
        <FlowStep
          icon={ClipboardList}
          title="Order"
          description="Start with the customer order and required items."
        />
        <FlowStep
          icon={Route}
          title="Fulfillment"
          description="Choose where each item is coming from."
          tone="blue"
        />
        <FlowStep
          icon={Package}
          title="Receiving"
          description="South and Their Truck items come back into inventory."
          tone="amber"
        />
        <FlowStep
          icon={Hammer}
          title="Build"
          description="Yard crew stages the ready material."
          tone="green"
        />
        <FlowStep
          icon={Truck}
          title="Delivery"
          description="Built orders move to delivery or customer pickup."
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            Order
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Parent Record
          </h2>
          <div className="mt-5 grid gap-4">
            <Field label="Order Number">
              <TextInput
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                placeholder="019-390"
              />
            </Field>
            <Field label="Customer">
              <TextInput
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
              />
            </Field>
            <Field label="Needed By">
              <TextInput
                type="date"
                value={neededBy}
                onChange={(event) => setNeededBy(event.target.value)}
              />
            </Field>
            <Field label="Build Name">
              <TextInput
                value={buildName}
                onChange={(event) => setBuildName(event.target.value)}
                placeholder="Main delivery build"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Fulfillment Paths
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Order Items
              </h2>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Item
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {items.map((item, index) => {
              const itemPath = getPath(item.path);
              const PathIcon = itemPath.icon;

              return (
                <article
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-3 lg:grid-cols-[100px_1fr_220px]">
                    <Field label={`Qty ${index + 1}`}>
                      <TextInput
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, {
                            quantity: event.target.value,
                          })
                        }
                        placeholder="Qty"
                      />
                    </Field>
                    <Field label="Item Description">
                      <TextInput
                        value={item.description}
                        onChange={(event) =>
                          updateItem(item.id, {
                            description: event.target.value,
                          })
                        }
                        placeholder="2x6-16 #2 Doug Fir"
                      />
                    </Field>
                    <Field label="Fulfillment">
                      <select
                        value={item.path}
                        onChange={(event) =>
                          updateItem(item.id, {
                            path: event.target.value,
                            buildReady: event.target.value === "inStock",
                          })
                        }
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
                      >
                        {fulfillmentPaths.map((path) => (
                          <option key={path.id} value={path.id}>
                            {path.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span
                      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black ${itemPath.tone}`}
                    >
                      <PathIcon className="h-4 w-4" aria-hidden="true" />
                      {itemPath.label}
                    </span>
                    <label className="inline-flex items-center gap-2 text-sm font-black text-slate-700">
                      <input
                        type="checkbox"
                        checked={item.buildReady}
                        onChange={(event) =>
                          updateItem(item.id, {
                            buildReady: event.target.checked,
                          })
                        }
                        disabled={item.path === "waiting"}
                        className="h-5 w-5 rounded border-slate-300 text-[#FC2C38] focus:ring-[#FC2C38]"
                      />
                      Ready for yard build
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
            Path Summary
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {pathCounts.map((path) => {
              const PathIcon = path.icon;

              return (
                <div
                  key={path.id}
                  className={`rounded-3xl border p-4 ${path.tone}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <PathIcon className="h-5 w-5" aria-hidden="true" />
                    <span className="text-3xl font-black">{path.count}</span>
                  </div>
                  <p className="mt-3 text-sm font-black">{path.label}</p>
                  <p className="mt-1 text-xs font-semibold opacity-80">
                    {path.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Yard Build
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {buildName || "Build"}
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                Order {orderNumber || "No order"} ·{" "}
                {customerName || "No customer"}
              </p>
            </div>
            <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
              {readyBuildItems.length}/{buildItems.length} ready
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {items.map((item) => {
              const itemPath = getPath(item.path);
              const isReady = item.path !== "waiting" && item.buildReady;

              return (
                <div
                  key={`build-${item.id}`}
                  className={`rounded-2xl border px-4 py-3 ${
                    isReady
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-slate-950">
                        {item.quantity ? `${item.quantity} · ` : ""}
                        {item.description || "Unnamed item"}
                      </p>
                      <p className="text-sm font-bold text-slate-600">
                        {isReady
                          ? "Ready for build"
                          : item.path === "waiting"
                            ? "Waiting before yard can build"
                            : `Waiting on ${itemPath.label}`}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
                        isReady
                          ? "bg-white text-emerald-700"
                          : "bg-white text-amber-800"
                      }`}
                    >
                      {itemPath.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-black text-slate-900">
              Order chain preview
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              When this becomes live, each order item can create or link to a
              South PO, Their Truck PO, receiving check-in, and yard build task.
              Yard crew would see the build only when the needed material is
              ready or partially ready.
            </p>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
