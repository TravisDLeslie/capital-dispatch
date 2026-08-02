import { getBouncieAccessToken, getBouncieConfig } from "./_shared.js";

export default async function handler(_request, response) {
  const config = getBouncieConfig();
  const tokenResult = await getBouncieAccessToken();

  response.status(tokenResult.error ? tokenResult.status || 500 : 200).json({
    configured: Boolean(
      config.clientId && config.clientSecret && config.redirectUri,
    ),
    connected: Boolean(tokenResult.accessToken),
    needsAuthorizationCode: !config.authorizationCode && !config.accessToken,
    hasWebhookKey: Boolean(config.webhookKey),
    error: tokenResult.error || "",
    rotatedRefreshToken: Boolean(tokenResult.rotatedRefreshToken),
  });
}
