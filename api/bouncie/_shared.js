import {
  getStoredBouncieTokens,
  saveBouncieTokens,
} from "./_tokenStore.js";

const BOUNCIE_AUTH_URL = "https://auth.bouncie.com/dialog/authorize";
const BOUNCIE_TOKEN_URL = "https://auth.bouncie.com/oauth/token";
const BOUNCIE_API_BASE_URL = "https://api.bouncie.dev/v1";

function cleanToken(value) {
  return String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export function getBouncieConfig() {
  return {
    clientId: process.env.BOUNCIE_CLIENT_ID || "",
    clientSecret: process.env.BOUNCIE_CLIENT_SECRET || "",
    redirectUri: process.env.BOUNCIE_REDIRECT_URI || "",
    accessToken: cleanToken(process.env.BOUNCIE_ACCESS_TOKEN),
    refreshToken: cleanToken(process.env.BOUNCIE_REFRESH_TOKEN),
    webhookKey: process.env.BOUNCIE_WEBHOOK_KEY || "",
  };
}

export function getMissingConfig(config) {
  return ["clientId", "clientSecret", "redirectUri"].filter(
    (configKey) => !config[configKey],
  );
}

export function createAuthorizationUrl(config) {
  const authorizationUrl = new URL(BOUNCIE_AUTH_URL);

  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("resource", `${BOUNCIE_API_BASE_URL}/`);
  authorizationUrl.searchParams.set("state", crypto.randomUUID());

  return authorizationUrl.toString();
}

export async function exchangeBouncieToken(body) {
  const tokenResponse = await fetch(BOUNCIE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok) {
    const message =
      tokenData?.errors ||
      tokenData?.error_description ||
      tokenData?.error ||
      "Unable to exchange Bouncie token.";

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }

  return tokenData;
}

export async function refreshBouncieToken(config) {
  if (!config.refreshToken) {
    return {
      error:
        "Bouncie access token expired and no refresh token is saved. Reconnect Bouncie from Admin > Vehicles.",
      status: 401,
    };
  }

  try {
    const tokenData = await exchangeBouncieToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    });

    return {
      accessToken: cleanToken(tokenData.access_token),
      refreshToken: cleanToken(tokenData.refresh_token),
      expiresIn: tokenData.expires_in || null,
    };
  } catch (error) {
    return {
      error:
        "Bouncie access token expired and the refresh token could not be used. Reconnect Bouncie from Admin > Vehicles > Connect Bouncie, then update both Bouncie token values in Vercel.",
      status: 401,
      data: {
        message: error.message || "Unable to refresh Bouncie token.",
      },
    };
  }
}

export async function getBouncieAccessToken() {
  const config = getBouncieConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length > 0) {
    return {
      error: `Missing Bouncie environment values: ${missingConfig.join(", ")}`,
      status: 500,
    };
  }

  const storedTokens = await getStoredBouncieTokens();
  const storedAccessToken = cleanToken(storedTokens?.accessToken);
  const storedRefreshToken = cleanToken(storedTokens?.refreshToken);

  if (storedAccessToken) {
    const storedConfig = {
      ...config,
      accessToken: storedAccessToken,
      refreshToken: storedRefreshToken || config.refreshToken,
    };

    return {
      accessToken: storedConfig.accessToken,
      refreshToken: storedConfig.refreshToken,
      config: storedConfig,
      source: "redis",
    };
  }

  if (config.accessToken) {
    return {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      config,
      source: "environment",
    };
  }

  return {
    error:
      "Bouncie is not connected yet. Connect Bouncie from Admin > Vehicles.",
    status: 409,
  };
}

export async function callBouncieApi(path) {
  const tokenResult = await getBouncieAccessToken();

  if (tokenResult.error) {
    return tokenResult;
  }

  const requestBouncieApi = (accessToken) =>
    fetch(`${BOUNCIE_API_BASE_URL}${path}`, {
      headers: {
        Authorization: accessToken,
        "Content-Type": "application/json",
      },
    });

  let apiResponse = await requestBouncieApi(tokenResult.accessToken);
  let data = await apiResponse.json().catch(() => ({}));
  let refreshedToken = null;

  if (apiResponse.status === 401 && tokenResult.config?.refreshToken) {
    const refreshedTokenResult = await refreshBouncieToken(tokenResult.config);

    if (refreshedTokenResult.error) {
      return refreshedTokenResult;
    }

    refreshedToken = refreshedTokenResult;
    await saveBouncieTokens(refreshedToken, "refresh");
    apiResponse = await requestBouncieApi(refreshedToken.accessToken);
    data = await apiResponse.json().catch(() => ({}));
  }

  if (!apiResponse.ok) {
    const baseError =
      data?.errors ||
      data?.error ||
      `Bouncie API request failed with status ${apiResponse.status}.`;
    const tokenHelp =
      apiResponse.status === 401
        ? " Bouncie rejected the access token and the refresh retry did not work. Reconnect Bouncie from Admin > Vehicles > Connect Bouncie."
        : "";

    return {
      error: `${baseError}${tokenHelp}`,
      status: apiResponse.status,
      data,
    };
  }

  return {
    data,
    refreshedAccessToken: refreshedToken?.accessToken || "",
    rotatedRefreshToken:
      refreshedToken?.refreshToken &&
      refreshedToken.refreshToken !== tokenResult.refreshToken
        ? refreshedToken.refreshToken
        : "",
  };
}

export async function callBouncieApiWithoutRefresh(path) {
  const tokenResult = await getBouncieAccessToken();

  if (tokenResult.error) {
    return tokenResult;
  }

  const apiResponse = await fetch(`${BOUNCIE_API_BASE_URL}${path}`, {
    headers: {
      Authorization: tokenResult.accessToken,
      "Content-Type": "application/json",
    },
  });
  const data = await apiResponse.json().catch(() => ({}));

  if (!apiResponse.ok) {
    const baseError =
      data?.errors ||
      data?.error ||
      `Bouncie API request failed with status ${apiResponse.status}.`;
    const tokenHelp =
      apiResponse.status === 401
        ? " Bouncie rejected the access token. Reconnect Bouncie from Admin > Vehicles > Connect Bouncie."
        : "";

    return {
      error: `${baseError}${tokenHelp}`,
      status: apiResponse.status,
      data,
    };
  }

  return { data, rotatedRefreshToken: tokenResult.rotatedRefreshToken };
}
