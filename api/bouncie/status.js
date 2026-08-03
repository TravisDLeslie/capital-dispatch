import { getBouncieAccessToken, getBouncieConfig } from "./_shared.js";
import {
  canPersistBouncieTokens,
  getBouncieTokenStoreName,
  getStoredBouncieTokens,
} from "./_tokenStore.js";

export default async function handler(_request, response) {
  const config = getBouncieConfig();
  const storedTokens = await getStoredBouncieTokens();
  const tokenResult = await getBouncieAccessToken();

  response.status(tokenResult.error ? tokenResult.status || 500 : 200).json({
    configured: Boolean(
      config.clientId && config.clientSecret && config.redirectUri,
    ),
    connected: Boolean(tokenResult.accessToken),
    tokenSource: tokenResult.source || "",
    tokenStore: getBouncieTokenStoreName(),
    canPersistTokens: canPersistBouncieTokens(),
    needsAccessToken: !config.accessToken && !storedTokens?.accessToken,
    hasRefreshToken: Boolean(config.refreshToken || storedTokens?.refreshToken),
    hasWebhookKey: Boolean(config.webhookKey),
    tokenUpdatedAt: storedTokens?.updatedAt || "",
    tokenExpiresAt: storedTokens?.expiresAt || "",
    error: tokenResult.error || "",
  });
}
