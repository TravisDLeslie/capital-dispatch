export function formatVehicleValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (["string", "number", "boolean"].includes(typeof value)) {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(formatVehicleValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    for (const key of [
      "name",
      "displayName",
      "label",
      "value",
      "text",
      "description",
      "number",
    ]) {
      const formattedValue = formatVehicleValue(value[key]);

      if (formattedValue) {
        return formattedValue;
      }
    }
  }

  return "";
}

export function getFirstVehicleValue(vehicle, paths) {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce(
        (currentValue, key) =>
          currentValue && currentValue[key] !== undefined
            ? currentValue[key]
            : undefined,
        vehicle,
      );
    const formattedValue = formatVehicleValue(value);

    if (formattedValue) {
      return formattedValue;
    }
  }

  return "";
}

export function getVehicleYearMakeModel(vehicle) {
  return [
    getFirstVehicleValue(vehicle, [
      "year",
      "modelYear",
      "vehicleYear",
      "standardYear",
      "vehicle.year",
      "vehicle.modelYear",
      "details.year",
      "specs.year",
      "info.year",
    ]),
    getFirstVehicleValue(vehicle, [
      "make",
      "vehicleMake",
      "standardMake",
      "vehicle.make",
      "details.make",
      "specs.make",
      "info.make",
    ]),
    getFirstVehicleValue(vehicle, [
      "model",
      "vehicleModel",
      "standardModel",
      "vehicle.model",
      "details.model",
      "specs.model",
      "info.model",
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

export function getVehicleName(vehicle) {
  return (
    getFirstVehicleValue(vehicle, [
      "nickname",
      "name",
      "displayName",
      "label",
    ]) ||
    getVehicleYearMakeModel(vehicle) ||
    getFirstVehicleValue(vehicle, ["vin", "vehicle.vin"]) ||
    "Bouncie Vehicle"
  );
}

export function getVehicleDetail(vehicle) {
  const vin = getFirstVehicleValue(vehicle, ["vin", "vehicle.vin"]);
  const imei = getFirstVehicleValue(vehicle, ["imei", "device.imei"]);
  const plate = getFirstVehicleValue(vehicle, [
    "licensePlate",
    "plate",
    "vehicle.licensePlate",
    "vehicle.plate",
  ]);

  return [
    vin ? `VIN ${vin}` : "",
    imei ? `IMEI ${imei}` : "",
    plate ? `Plate ${plate}` : "",
  ]
    .filter(Boolean)
    .join(" • ");
}

export function getVehicleKey(vehicle, index) {
  const rawKey =
    getFirstVehicleValue(vehicle, [
      "id",
      "vehicleId",
      "vin",
      "imei",
      "device.imei",
      "vehicle.vin",
    ]) || `vehicle-${index}`;

  return String(rawKey).replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function getVehicleBadgeText(title) {
  const cleanTitle = String(title || "").trim();

  if (!cleanTitle) {
    return "V";
  }

  const words = cleanTitle
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word.slice(0, 1))
    .join("")
    .toUpperCase();
}

export function getVehicleCoordinates(vehicle) {
  const latitude = getFirstVehicleValue(vehicle, [
    "latitude",
    "lat",
    "location.latitude",
    "location.lat",
    "lastLocation.latitude",
    "lastLocation.lat",
    "currentLocation.latitude",
    "currentLocation.lat",
    "gps.latitude",
    "gps.lat",
    "position.latitude",
    "position.lat",
  ]);
  const longitude = getFirstVehicleValue(vehicle, [
    "longitude",
    "lng",
    "lon",
    "location.longitude",
    "location.lng",
    "location.lon",
    "lastLocation.longitude",
    "lastLocation.lng",
    "lastLocation.lon",
    "currentLocation.longitude",
    "currentLocation.lng",
    "currentLocation.lon",
    "gps.longitude",
    "gps.lng",
    "gps.lon",
    "position.longitude",
    "position.lng",
    "position.lon",
  ]);

  if (!latitude || !longitude) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

export function getVehicleLocationLabel(vehicle) {
  const address = getFirstVehicleValue(vehicle, [
    "address",
    "location.address",
    "location.formattedAddress",
    "lastLocation.address",
    "lastLocation.formattedAddress",
    "currentLocation.address",
    "currentLocation.formattedAddress",
    "place",
    "place.name",
  ]);
  const coordinates = getVehicleCoordinates(vehicle);

  if (address) {
    return address;
  }

  if (coordinates) {
    return `${coordinates.latitude}, ${coordinates.longitude}`;
  }

  return "";
}

export function getVehicleLastUpdated(vehicle) {
  const rawDate = getFirstVehicleValue(vehicle, [
    "updatedAt",
    "lastUpdated",
    "lastSeen",
    "lastSeenAt",
    "location.updatedAt",
    "location.timestamp",
    "location.time",
    "lastLocation.updatedAt",
    "lastLocation.timestamp",
    "lastLocation.time",
    "currentLocation.updatedAt",
    "currentLocation.timestamp",
    "currentLocation.time",
  ]);

  if (!rawDate) {
    return "";
  }

  const parsedDate = new Date(rawDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return rawDate;
  }

  return parsedDate.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
