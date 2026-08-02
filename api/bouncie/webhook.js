import { getBouncieConfig } from "./_shared.js";

export default function handler(request, response) {
  const config = getBouncieConfig();

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!config.webhookKey) {
    response.status(500).json({ error: "BOUNCIE_WEBHOOK_KEY is not set." });
    return;
  }

  const authorization =
    request.headers.authorization ||
    request.headers["x-bouncie-authorization"] ||
    "";

  if (authorization !== config.webhookKey) {
    response.status(401).json({ error: "Invalid Bouncie webhook key." });
    return;
  }

  response.status(200).json({
    received: true,
    receivedAt: new Date().toISOString(),
  });
}
