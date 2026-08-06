import {
  Edit3,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  StickyNote,
  Truck,
  UserRound,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import DeliveryOrderForm from "../components/DeliveryOrderForm";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";

function formatCreatedAt(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDirectionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
}

export default function DeliveriesPage({
  deliveries,
  customers,
  deliverySettings,
  deliveryOriginOptions,
  canEditDeliveries = false,
  onAddDelivery,
  onUpdateDelivery,
  onDeleteDelivery,
  editingDeliveryId,
  onEditDelivery,
  onCancelEditDelivery,
  onPageChange,
}) {
  const editingDelivery = deliveries.find(
    (delivery) => delivery.id === editingDeliveryId,
  );

  async function handleSubmit(delivery) {
    await onAddDelivery(delivery);
  }

  async function handleUpdateSubmit(delivery) {
    await onUpdateDelivery(delivery.id, delivery);
    onCancelEditDelivery();
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Deliveries", onClick: () => onPageChange?.("deliveries") },
          { label: "Add Orders" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Deliveries
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Add Orders
        </h1>

        <p className="mt-2 text-lg text-slate-500">
          Build delivery orders, then hold them for dispatch or assign a driver.
        </p>
      </div>

      <DeliveryOrderForm
        key={editingDelivery?.id || "new-delivery"}
        initialDelivery={editingDelivery || null}
        customers={customers || []}
        deliverySettings={deliverySettings}
        deliveryOriginOptions={deliveryOriginOptions}
        onSubmit={
          editingDelivery ? handleUpdateSubmit : handleSubmit
        }
        onCancel={onCancelEditDelivery}
        onDelete={onDeleteDelivery}
      />

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Delivery Queue
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Recent Orders
            </h2>
          </div>

          <p className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm">
            {deliveries.length}{" "}
            {deliveries.length === 1 ? "order" : "orders"}
          </p>
        </div>

        {deliveries.length === 0 ? (
          <EmptyState
            title="No delivery orders yet"
            description="Saved delivery orders will appear here."
          />
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => {
              const items = Array.isArray(delivery.items)
                ? delivery.items
                : [];
              const contactPhone =
                delivery.contactPhone || delivery.phoneNumber || "";
              const deliveryLocationNotes =
                delivery.deliveryLocationNotes ||
                delivery.deliveryNotes ||
                "";
              const generalNotes = delivery.generalNotes || "";
              const needsDispatch =
                delivery.dispatchStatus === "needsDispatch" ||
                !delivery.driver;
              const scopeSummary = getDeliveryScopeSummary(delivery);

              return (
                <article
                  key={delivery.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                        Order {delivery.orderNumber}
                      </p>

                      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                        {delivery.customerName}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {needsDispatch ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-black text-amber-800">
                            Needs Dispatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
                            Assigned
                          </span>
                        )}

                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                          <Truck
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          {delivery.unloadType}
                        </span>

                        {delivery.hasHardware ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm font-black text-[#FC2C38]">
                            <ShieldCheck
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                            Hardware
                          </span>
                        ) : null}

                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                          <UserRound
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          {delivery.driver || "No driver yet"}
                        </span>

                        {delivery.createdAt ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-500">
                            {formatCreatedAt(delivery.createdAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {canEditDeliveries ? (
                      <button
                        type="button"
                        onClick={() => {
                          onEditDelivery(delivery.id);
                          window.scrollTo({
                            top: 0,
                            behavior: "smooth",
                          });
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        <Edit3
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        Edit
                      </button>
                      ) : null}

                      <a
                        href={getDirectionsUrl(delivery.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600"
                      >
                        Directions
                        <ExternalLink
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </a>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                        <MapPin
                          className="h-4 w-4 text-[#FC2C38]"
                          aria-hidden="true"
                        />
                        Address
                      </p>

                      <p className="text-sm font-semibold text-slate-600">
                        {delivery.address}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                        <UserRound
                          className="h-4 w-4 text-[#FC2C38]"
                          aria-hidden="true"
                        />
                        Contact
                      </p>

                      <p className="text-sm font-semibold text-slate-600">
                        {delivery.contactName || "No contact name added"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                        <Phone
                          className="h-4 w-4 text-[#FC2C38]"
                          aria-hidden="true"
                        />
                        Contact Phone
                      </p>

                      <p className="text-sm font-semibold text-slate-600">
                        {contactPhone || "No contact phone added"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {deliveryLocationNotes ? (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                        <StickyNote
                          className="h-4 w-4 text-[#FC2C38]"
                          aria-hidden="true"
                        />
                        Delivery Location Notes
                      </p>

                      <p className="text-sm font-semibold text-slate-700">
                        {deliveryLocationNotes}
                      </p>
                    </div>
                  ) : null}

                  {generalNotes ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                        <StickyNote
                          className="h-4 w-4 text-[#FC2C38]"
                          aria-hidden="true"
                        />
                        General Notes
                      </p>

                      <p className="text-sm font-semibold text-slate-700">
                        {generalNotes}
                      </p>
                    </div>
                  ) : null}
                  </div>

                  <div className="mt-5">
                    <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                      <Package
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      Delivery Scope
                    </p>

                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-sm font-black uppercase tracking-[0.12em] text-[#FC2C38]">
                        {scopeSummary.label}
                      </p>

                      {scopeSummary.detail ? (
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {scopeSummary.detail}
                        </p>
                      ) : null}
                    </div>

                    {scopeSummary.usesItems ? (
                      <ul className="mt-3 space-y-2">
                        {items.map((item) => (
                          <li
                            key={item.id}
                            className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                          >
                            {item.quantity ? (
                              <span className="mr-2 font-black text-[#FC2C38]">
                                {item.quantity}
                              </span>
                            ) : null}
                            {item.description}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
