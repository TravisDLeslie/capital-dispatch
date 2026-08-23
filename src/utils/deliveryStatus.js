export function isDeliveryComplete(delivery) {
  const status = String(delivery?.status || "").trim().toLowerCase();

  return (
    status === "complete" ||
    Boolean(delivery?.deliveredAt) ||
    Boolean(delivery?.delivered)
  );
}
