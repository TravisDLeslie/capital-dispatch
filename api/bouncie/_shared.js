const BOUNCIE_AUTH_URL = "https://auth.bouncie.com/dialog/authorize";
const BOUNCIE_TOKEN_URL = "https://auth.bouncie.com/oauth/token";
const BOUNCIE_API_BASE_URL = "https://api.bouncie.dev/v1";

export function getBouncieConfig() {
  return {
    clientId: process.env.BOUNCIE_CLIENT_ID || "",
    clientSecret: process.env.BOUNCIE_CLIENT_SECRET || "",
    redirectUri: process.env.BOUNCIE_REDIRECT_URI || "",
    accessToken: process.env.BOUNCIE_ACCESS_TOKEN || "",
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

export async function getBouncieAccessToken() {
  const config = getBouncieConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length > 0) {
    return {
      error: `Missing Bouncie environment values: ${missingConfig.join(", ")}`,
      status: 500,
    };
  }

  if (config.accessToken) {
    return { accessToken: config.accessToken };
  }

  return {
    error:
      "Bouncie is not connected yet. Connect once and add BOUNCIE_ACCESS_TOKEN in Vercel.",
    status: 409,
  };
}

export async function callBouncieApi(path) {
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
    return {
      error:
        data?.errors ||
        data?.error ||
        `Bouncie API request failed with status ${apiResponse.status}.`,
      status: apiResponse.status,
      data,
    };
  }

  return { data, rotatedRefreshToken: tokenResult.rotatedRefreshToken };
}
