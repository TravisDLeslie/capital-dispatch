import { callBouncieApi } from "./_shared.js";

export default async function handler(_request, response) {
  const pageSize = 3;
  const maxPages = 34;
  const vehicles = [];
  let rotatedRefreshToken = false;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const skip = pageIndex * pageSize;
    const result = await callBouncieApi(
      `/vehicles?limit=${pageSize}&skip=${skip}`,
    );

    if (result.error) {
      response.status(result.status || 500).json({
        error: result.error,
        data: result.data || null,
      });
      return;
    }

    const pageVehicles = Array.isArray(result.data)
      ? result.data
      : result.data?.data || [];

    vehicles.push(...pageVehicles);
    rotatedRefreshToken ||= Boolean(result.rotatedRefreshToken);

    if (pageVehicles.length < pageSize) {
      break;
    }
  }

  response.status(200).json({
    vehicles,
    raw: vehicles,
    rotatedRefreshToken,
  });
}
