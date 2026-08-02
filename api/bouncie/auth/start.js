import {
  createAuthorizationUrl,
  getBouncieConfig,
  getMissingConfig,
} from "../_shared.js";

export default function handler(_request, response) {
  const config = getBouncieConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length > 0) {
    response.status(500).json({
      error: `Missing Bouncie environment values: ${missingConfig.join(", ")}`,
    });
    return;
  }

  response.redirect(302, createAuthorizationUrl(config));
}
