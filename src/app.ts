import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { methodNotAllowed } from "hono/method-not-allowed";
import { secureHeaders } from "hono/secure-headers";
import type { AppConfig } from "./env.js";
import { createApiClient } from "./lib/api-client.js";
import { toHttpException } from "./lib/errors.js";
import { callUpstream } from "./lib/upstream.js";
import { responseCache } from "./middleware/cache.js";
import { ipRateLimit } from "./middleware/rate-limit.js";
import { clanRoutes } from "./routes/clans.js";
import { leaderboardRoutes } from "./routes/leaderboards.js";
import { locationRoutes } from "./routes/locations.js";
import { playerRoutes } from "./routes/players.js";
import { tournamentRoutes } from "./routes/tournaments.js";
import { version } from "./version.js";

/**
 * Build the proxy app. Exported separately from the entry point so tests can
 * exercise the full middleware stack in-process via `app.request()`.
 */
export function createApp(config: AppConfig): Hono {
  const api = createApiClient(config);
  const timeoutMs = config.UPSTREAM_TIMEOUT_MS;
  const app = new Hono();

  // --- Security middleware -------------------------------------------------
  app.use(secureHeaders());
  app.use(
    cors({
      origin:
        config.CORS_ORIGIN === "*"
          ? "*"
          : config.CORS_ORIGIN.split(",")
              .map((o) => o.trim())
              .filter(Boolean),
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 86_400,
    }),
  );
  app.use(bodyLimit({ maxSize: 1024 }));
  app.use(
    ipRateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
      trustProxy: config.TRUST_PROXY,
    }),
  );

  // Optional bearer-token gate for private deployments.
  if (config.PROXY_AUTH_TOKEN) {
    app.use(
      "/api/*",
      bearerAuth({
        token: config.PROXY_AUTH_TOKEN,
        realm: "royale-proxy-api",
        noAuthenticationHeader: { message: { message: "Missing bearer token" } },
        invalidAuthenticationHeader: { message: { message: "Malformed Authorization header" } },
        invalidToken: { message: { message: "Invalid bearer token" } },
      }),
    );
  }

  // --- Abuse protection ----------------------------------------------------
  app.use(
    "/api/*",
    responseCache({ ttlMs: config.CACHE_TTL_MS, maxEntries: config.CACHE_MAX_ENTRIES }),
  );
  app.use(
    methodNotAllowed({
      app,
      onMethodNotAllowed: (c, methods) =>
        c.json({ message: "Method not allowed" }, 405, { Allow: methods.join(", ") }),
    }),
  );

  // --- Routes (same surface as v1) -----------------------------------------
  app.get("/", (c) => c.json({ name: "royale-proxy-api", version, status: "ok" }));
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/api/players", playerRoutes(api, timeoutMs));
  app.route("/api/clans", clanRoutes(api, timeoutMs));
  app.route("/api/tournaments", tournamentRoutes(api, timeoutMs));
  app.route("/api/locations", locationRoutes(api, timeoutMs));
  app.route("/api/leaderboards", leaderboardRoutes(api, timeoutMs));

  app.get("/api/cards", async (c) => {
    return c.json(await callUpstream(() => api.getCards(), timeoutMs));
  });
  app.get("/api/globaltournaments", async (c) => {
    return c.json(await callUpstream(() => api.getGlobalTournaments(), timeoutMs));
  });

  // --- Errors --------------------------------------------------------------
  app.notFound((c) => c.json({ message: "Route not found" }, 404));
  app.onError((error, c) => {
    const httpError = toHttpException(error);
    if (httpError.status >= 500) {
      console.error(`[royale-proxy] ${c.req.method} ${c.req.path} -> ${httpError.status}`, error);
    }
    // Preserve responses crafted by middleware (e.g. bearer auth's
    // WWW-Authenticate header); otherwise emit a normalized JSON error.
    return httpError.res ?? c.json({ message: httpError.message }, httpError.status);
  });

  return app;
}
