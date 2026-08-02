import {
  exchangeBouncieToken,
  getBouncieConfig,
  getMissingConfig,
} from "../_shared.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(request, response) {
  const code = request.query?.code || "";
  const config = getBouncieConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length > 0) {
    response.status(500).send(
      `Missing Bouncie environment values: ${missingConfig.join(", ")}`,
    );
    return;
  }

  if (!code) {
    response.status(400).send("Bouncie did not return an authorization code.");
    return;
  }

  let tokenData = null;
  let tokenError = "";

  try {
    tokenData = await exchangeBouncieToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    });
  } catch (error) {
    tokenError = error.message || "Token exchange failed.";
  }

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.status(tokenError ? 200 : 200).send(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Bouncie Connected</title>
        <style>
          body {
            margin: 0;
            background: #f8fafc;
            color: #0f172a;
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          main {
            max-width: 760px;
            margin: 40px auto;
            padding: 28px;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
          }
          h1 { margin: 0; font-size: 34px; letter-spacing: -0.04em; }
          p { color: #475569; line-height: 1.6; font-weight: 650; }
          code, pre {
            background: #0f172a;
            color: #f8fafc;
            border-radius: 14px;
            padding: 14px;
            display: block;
            white-space: pre-wrap;
            word-break: break-all;
          }
          .error { color: #b91c1c; }
        </style>
      </head>
      <body>
        <main>
          <h1>Bouncie authorization received</h1>
          ${
            tokenError
              ? `<p class="error">The code was received, but token exchange failed: ${escapeHtml(
                  tokenError,
                )}</p>`
              : `<p>Bouncie returned an authorization code and the token exchange worked.</p>`
          }
          <p>Bouncie returned this authorization code:</p>
          <pre>${escapeHtml(code)}</pre>
          ${
            tokenData?.access_token
              ? `<p>Add this value in Vercel as <strong>BOUNCIE_ACCESS_TOKEN</strong>, then redeploy:</p><pre>${escapeHtml(
                  tokenData.access_token,
                )}</pre>`
              : ""
          }
          ${
            tokenData?.refresh_token
              ? `<p>Save this refresh token somewhere private for later. Do not add it to the app yet:</p><pre>${escapeHtml(
                  tokenData.refresh_token,
                )}</pre>`
              : ""
          }
          <p>You can close this page after saving the access token in Vercel.</p>
        </main>
      </body>
    </html>`);
}
