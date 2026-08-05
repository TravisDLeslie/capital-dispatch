export const deliveryScopeOptions = [
  {
    value: "shipOrderComplete",
    label: "Ship Order Complete",
    shortLabel: "Complete",
    description: "Driver should deliver the full order.",
    noteLabel: "Delivery scope notes",
    notePlaceholder: "Optional note for the full order.",
    requiresNotes: false,
    usesItems: false,
  },
  {
    value: "shipPartialOrder",
    label: "Ship Partial Order",
    shortLabel: "Partial",
    description: "Only part of the order is going on this delivery.",
    noteLabel: "What is shipping?",
    notePlaceholder: "Example: Deliver framing package only.",
    requiresNotes: true,
    usesItems: false,
  },
  {
    value: "shipAllExcept",
    label: "Ship All Except",
    shortLabel: "All Except",
    description: "Most of the order is going, except the items listed.",
    noteLabel: "What is not shipping?",
    notePlaceholder: "Example: Except 12 pcs 2x12x20 and Simpson hardware.",
    requiresNotes: true,
    usesItems: false,
  },
  {
    value: "customItems",
    label: "Custom Item List",
    shortLabel: "Custom Items",
    description: "Use a manual item list when the delivery is small or specific.",
    noteLabel: "Item list notes",
    notePlaceholder: "Optional note for this custom list.",
    requiresNotes: false,
    usesItems: true,
  },
];

export function getDeliveryScopeOption(deliveryOrScope) {
  const scopeValue =
    typeof deliveryOrScope === "string"
      ? deliveryOrScope
      : deliveryOrScope?.deliveryScope;

  const explicitOption = deliveryScopeOptions.find(
    (scopeOption) => scopeOption.value === scopeValue,
  );

  if (explicitOption) {
    return explicitOption;
  }

  const items = Array.isArray(deliveryOrScope?.items)
    ? deliveryOrScope.items
    : [];

  if (items.length > 0) {
    return deliveryScopeOptions.find(
      (scopeOption) => scopeOption.value === "customItems",
    );
  }

  return deliveryScopeOptions[0];
}

export function getDeliveryScopeSummary(delivery) {
  const scopeOption = getDeliveryScopeOption(delivery);
  const scopeNotes = String(delivery?.deliveryScopeNotes || "").trim();

  return {
    ...scopeOption,
    detail: scopeNotes,
    itemCount: Array.isArray(delivery?.items) ? delivery.items.length : 0,
  };
}
