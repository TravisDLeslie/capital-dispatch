import Breadcrumbs from "../components/Breadcrumbs";
import DeliveryOrderForm from "../components/DeliveryOrderForm";
import PageContainer from "../components/PageContainer";

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
    onPageChange?.("deliveries-calendar");
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
    </PageContainer>
  );
}
