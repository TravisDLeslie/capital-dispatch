import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Edit3,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { getDeliveryScopeSummary } from "../utils/deliveryScope";
import {
  deliveryTimeSlotOptions,
  getDeliveryDurationMinutes,
  getDeliveryTimeRange,
  getTodayDateValue,
} from "../utils/deliverySchedule";

function formatDateLabel(dateValue) {
  if (!dateValue) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateValue}T12:00:00`));
}

function getScheduledDeliveries(deliveries, selectedDate) {
  return deliveries
    .filter(
      (delivery) =>
        delivery.status !== "complete" &&
        delivery.dispatchStatus !== "needsDispatch" &&
        delivery.driver &&
        delivery.deliveryDate === selectedDate,
    )
    .sort((firstDelivery, secondDelivery) =>
      String(firstDelivery.deliveryTimeSlot || "99:99").localeCompare(
        String(secondDelivery.deliveryTimeSlot || "99:99"),
      ),
    );
}

export default function DeliveryCalendarPage({
  deliveries,
  canEditDeliveries = false,
  onEditDelivery,
  onPageChange,
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateValue());

  const scheduledDeliveries = useMemo(
    () => getScheduledDeliveries(deliveries, selectedDate),
    [deliveries, selectedDate],
  );
  const deliveriesByTimeSlot = useMemo(
    () =>
      scheduledDeliveries.reduce((groups, delivery) => {
        const timeSlot = delivery.deliveryTimeSlot || "unscheduled";

        return {
          ...groups,
          [timeSlot]: [...(groups[timeSlot] || []), delivery],
        };
      }, {}),
    [scheduledDeliveries],
  );
  const unscheduledDeliveries = scheduledDeliveries.filter(
    (delivery) => !delivery.deliveryTimeSlot,
  );
  const visibleTimeSlots = deliveryTimeSlotOptions.filter(
    (timeSlot) => deliveriesByTimeSlot[timeSlot.value]?.length > 0,
  );

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Deliveries", onClick: () => onPageChange?.("deliveries") },
          { label: "Calendar" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Delivery Schedule
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Delivery Calendar
          </h1>

          <p className="mt-2 text-base font-semibold text-slate-500 sm:text-lg">
            See assigned deliveries by time block for the day.
          </p>
        </div>

        <label className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Schedule Date
          </span>

          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-black text-slate-900 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100 lg:w-60"
          />
        </label>
      </div>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-900">
              {formatDateLabel(selectedDate)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {scheduledDeliveries.length}{" "}
              {scheduledDeliveries.length === 1 ? "delivery" : "deliveries"}{" "}
              scheduled
            </p>
          </div>

          <button
            type="button"
            onClick={() => onPageChange?.("deliveries-dispatch")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            <Truck className="h-4 w-4" aria-hidden="true" />
            Needs Dispatch
          </button>
        </div>
      </section>

      {scheduledDeliveries.length === 0 ? (
        <EmptyState
          title="No deliveries scheduled"
          description="Assigned deliveries with this date will show here by time slot."
        />
      ) : (
        <div className="space-y-4">
          {visibleTimeSlots.map((timeSlot) => (
            <section
              key={timeSlot.value}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
                  <Clock className="h-5 w-5" aria-hidden="true" />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {timeSlot.label}
                  </h2>
                  <p className="text-sm font-bold text-slate-500">
                    {(deliveriesByTimeSlot[timeSlot.value] || []).length} stop
                    {(deliveriesByTimeSlot[timeSlot.value] || []).length === 1
                      ? ""
                      : "s"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {(deliveriesByTimeSlot[timeSlot.value] || []).map(
                  (delivery) => {
                    const scopeSummary = getDeliveryScopeSummary(delivery);
                    const duration = getDeliveryDurationMinutes(
                      delivery.unloadType,
                      delivery.estimatedDurationMinutes,
                    );

                    return (
                      <article
                        key={delivery.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                              Order {delivery.orderNumber}
                            </p>
                            <h3 className="mt-1 truncate text-xl font-black text-slate-900">
                              {delivery.customerName}
                            </h3>
                          </div>

                          {canEditDeliveries ? (
                          <button
                            type="button"
                            onClick={() => onEditDelivery(delivery.id)}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
                            aria-label={`Edit delivery ${delivery.orderNumber}`}
                          >
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-slate-700">
                            {getDeliveryTimeRange(delivery)}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-slate-700">
                            {duration} min
                          </span>
                          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-slate-700">
                            {delivery.unloadType}
                          </span>
                          <span className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-black text-[#FC2C38]">
                            {scopeSummary.shortLabel}
                          </span>
                        </div>

                        <div className="mt-3 rounded-xl bg-white px-4 py-3">
                          <p className="flex items-center gap-2 text-sm font-black text-slate-900">
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            {delivery.address}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
                          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                            <Truck className="h-4 w-4" aria-hidden="true" />
                            {delivery.driver}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                            <Package className="h-4 w-4" aria-hidden="true" />
                            {scopeSummary.label}
                          </span>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </section>
          ))}

          {unscheduledDeliveries.length > 0 ? (
            <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-black text-slate-900">
                Date Set, Time Not Set
              </h2>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {unscheduledDeliveries.map((delivery) => (
                  <article
                    key={delivery.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">
                      Order {delivery.orderNumber}
                    </p>
                    <p className="mt-1 text-xl font-black text-slate-900">
                      {delivery.customerName}
                    </p>
                    {canEditDeliveries ? (
                    <button
                      type="button"
                      onClick={() => onEditDelivery(delivery.id)}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700"
                    >
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                      Set Time
                    </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </PageContainer>
  );
}
