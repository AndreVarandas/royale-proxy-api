import { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import type { AppConfig } from "../env.js";

/**
 * Create the shared upstream API client.
 *
 * IMPORTANT: the wrapper keeps its axios defaults in module-level state, so
 * exactly ONE client (and one app) must exist per process. `createApp` calls
 * this once; do not create additional clients with different tokens/URLs.
 */
export function createApiClient(config: AppConfig): ClashRoyaleAPI {
  return new ClashRoyaleAPI(config.CLASH_ROYALE_API_TOKEN, config.UPSTREAM_BASE_URL);
}
