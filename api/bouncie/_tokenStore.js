const TOKEN_KEY = "bouncie:tokens";

function getRedisConfig() {
  return {
    url:
      process.env.KV_REST_API_URL ||
      process.env.REDIS_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      "",
    token:
      process.env.KV_REST_API_TOKEN ||
      process.env.REDIS_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      "",
    redisUrl: process.env.REDIS_URL || "",
  };
}

async function redisUrlCommand(command) {
  const config = getRedisConfig();

  if (!config.redisUrl) {
    return {
      error:
        "Redis token storage is not configured. Connect Redis to this Vercel project so Bouncie tokens can persist across deploys.",
    };
  }

  let redisClient = null;

  try {
    const { createClient } = await import("redis");
    redisClient = createClient({
      url: config.redisUrl,
    });

    redisClient.on("error", (error) => {
      console.error("Redis client error:", error);
    });

    await redisClient.connect();

    if (command[0] === "GET") {
      const value = await redisClient.get(command[1]);

      return { data: { result: value } };
    }

    if (command[0] === "SET") {
      await redisClient.set(command[1], command[2]);

      return { data: { result: "OK" } };
    }

    return { error: `Unsupported Redis command: ${command[0]}` };
  } catch (error) {
    return {
      error: error.message || "Unable to reach Redis token storage.",
    };
  } finally {
    if (redisClient) {
      await redisClient.quit().catch(() => {});
    }
  }
}

async function redisCommand(command) {
  const config = getRedisConfig();

  if (!config.url || !config.token) {
    return redisUrlCommand(command);
  }

  try {
    const redisResponse = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    const redisData = await redisResponse.json().catch(() => ({}));

    if (!redisResponse.ok || redisData?.error) {
      return {
        error:
          redisData?.error ||
          `Redis request failed with status ${redisResponse.status}.`,
      };
    }

    return { data: redisData };
  } catch (error) {
    return {
      error: error.message || "Unable to reach Redis token storage.",
    };
  }
}

export async function getStoredBouncieTokens() {
  const result = await redisCommand(["GET", TOKEN_KEY]);

  if (result.error || !result.data?.result) {
    return null;
  }

  try {
    return JSON.parse(result.data.result);
  } catch (error) {
    console.error("Unable to parse Bouncie tokens from Redis:", error);
    return null;
  }
}

export async function saveBouncieTokens(tokenData, source = "api") {
  if (!tokenData?.accessToken) {
    return false;
  }

  const now = new Date();
  const expiresInSeconds = Number(tokenData.expiresIn || 0);
  const expiresAt =
    expiresInSeconds > 0
      ? new Date(now.getTime() + expiresInSeconds * 1000).toISOString()
      : "";
  const tokenPayload = {
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken || "",
    expiresIn: expiresInSeconds || null,
    expiresAt,
    source,
    updatedAt: now.toISOString(),
  };
  const result = await redisCommand([
    "SET",
    TOKEN_KEY,
    JSON.stringify(tokenPayload),
  ]);

  if (result.error) {
    console.error("Unable to save Bouncie tokens to Redis:", result.error);
    return false;
  }

  return true;
}

export function canPersistBouncieTokens() {
  const config = getRedisConfig();

  return Boolean((config.url && config.token) || config.redisUrl);
}

export function getBouncieTokenStoreName() {
  return "redis";
}
