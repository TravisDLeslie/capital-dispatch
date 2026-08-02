import { callBouncieApi } from "./_shared.js";

export default async function handler(_request, response) {
  const result = await callBouncieApi("/vehicles");

  if (result.error) {
    response.status(result.status || 500).json({
      error: result.error,
      data: result.data || null,
    });
    return;
  }

  response.status(200).json({
    vehicles: Array.isArray(result.data) ? result.data : result.data?.data || [],
    raw: result.data,
    rotatedRefreshToken: Boolean(result.rotatedRefreshToken),
  });
}
