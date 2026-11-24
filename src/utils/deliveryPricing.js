export const CAPITAL_LUMBER_ADDRESS = "3105 W State St, Boise, ID 83703";

const METERS_PER_MILE = 1609.344;

export function getDeliveryShippingRate(distanceMeters) {
  const distance = Number(distanceMeters);

  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }

  if (distance < METERS_PER_MILE) {
    return { label: "Under 1 mile shipping", normal: "$15", forklift: "$25" };
  }

  if (distance <= METERS_PER_MILE * 2.5) {
    return { label: "1–2.5 mile shipping", normal: "$20", forklift: "$35" };
  }

  if (distance <= METERS_PER_MILE * 3.75) {
    return { label: "2.5–3.75 mile shipping", normal: "$29", forklift: "$38" };
  }

  if (distance <= METERS_PER_MILE * 6) {
    return { label: "3.75–6 mile shipping", normal: "$35", forklift: "$50" };
  }

  if (distance <= METERS_PER_MILE * 8.5) {
    return { label: "6–8.5 mile shipping", normal: "$43", forklift: "$57" };
  }

  if (distance <= METERS_PER_MILE * 12) {
    return { label: "8.5–12 mile shipping", normal: "$47", forklift: "$60" };
  }

  if (distance <= METERS_PER_MILE * 25) {
    return { label: "12–25 mile shipping", normal: "$50", forklift: "$75" };
  }

  if (distance < METERS_PER_MILE * 30) {
    return { label: "25–30 mile shipping", normal: "$60", forklift: "$85" };
  }

  if (distance <= METERS_PER_MILE * 45) {
    return {
      label: "30–45 mile shipping",
      normal: "",
      forklift: "$110",
      forkliftLabel: "Forklift or dump",
    };
  }

  if (distance <= METERS_PER_MILE * 60) {
    return {
      label: "45–60 mile shipping",
      normal: "",
      forklift: "$150",
      forkliftLabel: "Forklift or dump",
    };
  }

  if (distance <= METERS_PER_MILE * 80) {
    return {
      label: "60–80 mile shipping",
      normal: "",
      forklift: "$225",
      forkliftLabel: "Forklift or dump",
    };
  }

  if (distance <= METERS_PER_MILE * 110) {
    return {
      label: "80–110 mile shipping",
      normal: "",
      forklift: "$325",
      forkliftLabel: "Forklift or dump",
    };
  }

  return { label: "Over 110 miles", normal: "", forklift: "" };
}

export function formatDeliveryDriveTime(seconds) {
  const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} hr ${remainingMinutes} min`;
  }

  if (hours > 0) {
    return `${hours} hr`;
  }

  return `${minutes} min`;
}
