import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { methodNotAllowed } from "hono/method-not-allowed";
import { secureHeaders } from "hono/secure-headers";
import type { AppConfig } from "./env.js";
import { createApiClient } from "./lib/api-client.js";
import { toHttpException } from "./lib/errors.js";
import { createLogger, errorFields } from "./lib/logger.js";
import { createMetrics } from "./lib/metrics.js";
import { callUpstream, UpstreamTimeoutError } from "./lib/upstream.js";
import { responseCache } from "./middleware/cache.js";
import { ipRateLimit } from "./middleware/rate-limit.js";
import { requestLog } from "./middleware/request-log.js";
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
  const logger = createLogger(config.LOG_LEVEL);
  const metrics = config.METRICS_ENABLED ? createMetrics() : undefined;
  const app = new Hono();

  // --- Observability (first, so it also sees rejected requests) --------------
  app.use(
    requestLog({
      logger,
      ipMode: config.LOG_IP_MODE,
      trustProxy: config.TRUST_PROXY,
      metrics,
    }),
  );

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
  const limiter = ipRateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX,
    trustProxy: config.TRUST_PROXY,
  });
  // Wrap the limiter to count local rejections (upstream 429s are not ours):
  // if it never calls next(), it rejected the request itself.
  app.use(async (c, next) => {
    let passed = false;
    const res = await limiter(c, async () => {
      passed = true;
      await next();
    });
    if (!passed) metrics?.rateLimited();
    return res;
  });

  // Optional bearer-token gate for private deployments.
  if (config.PROXY_AUTH_TOKEN) {
    const auth = bearerAuth({
      token: config.PROXY_AUTH_TOKEN,
      realm: "royale-proxy-api",
      noAuthenticationHeader: { message: { message: "Missing bearer token" } },
      invalidAuthenticationHeader: { message: { message: "Malformed Authorization header" } },
      invalidToken: { message: { message: "Invalid bearer token" } },
    });
    app.use("/api/*", auth);
    // Traffic stats should not be public on private deployments.
    if (config.METRICS_ENABLED) app.use("/metrics", auth);
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
  if (metrics) {
    app.get("/metrics", (c) =>
      c.body(metrics.render(), 200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" }),
    );
  }

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
    // HTTPExceptions are our own validation/auth errors, not upstream failures.
    if (!(error instanceof HTTPException)) {
      if (error instanceof UpstreamTimeoutError) metrics?.upstreamTimeout();
      else if (httpError.status >= 500) metrics?.upstreamError();
    }
    if (httpError.status >= 500) {
      logger.error({
        method: c.req.method,
        path: c.req.path,
        status: httpError.status,
        error: errorFields(error),
      });
    }
    // Preserve responses crafted by middleware (e.g. bearer auth's
    // WWW-Authenticate header); otherwise emit a normalized JSON error.
    return httpError.res ?? c.json({ message: httpError.message }, httpError.status);
  });

  return app;
}
