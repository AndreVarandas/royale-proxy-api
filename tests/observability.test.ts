import { createHash } from "node:crypto";
import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/env.js";

/** Mock the upstream wrapper so tests never need a real Supercell key. */
const mocks = vi.hoisted(() => ({
  getPlayerByTag: vi.fn(),
  getClans: vi.fn(),
  getCards: vi.fn(),
}));

vi.mock("@varandas/clash-royale-api", () => ({
  ClashRoyaleAPI: vi.fn(function () {
    return mocks;
  }),
}));

const baseEnv: Record<string, string> = {
  CLASH_ROYALE_API_TOKEN: "test-token",
  RATE_LIMIT_MAX: "10000",
  CACHE_TTL_MS: "0",
};

function makeApp(overrides: Record<string, string> = {}) {
  return createApp(loadConfig({ ...baseEnv, ...overrides }));
}

/** Request logs are JSON lines on console.log; 5xx errors on console.error. */
const logLines = (): Array<Record<string, unknown>> =>
  vi
    .mocked(console.log)
    .mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);

const errorLines = (): Array<Record<string, unknown>> =>
  vi
    .mocked(console.error)
    .mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);

async function metricsText(app: Hono, headers?: Record<string, string>): Promise<string> {
  const res = await app.request("/metrics", { headers });
  expect(res.status).toBe(200);
  return res.text();
}

const axiosError = (status: number) =>
  Object.assign(new Error("Request failed"), { response: { status } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(ClashRoyaleAPI).mockImplementation(function () {
    return mocks as unknown as ClashRoyaleAPI;
  });
  for (const fn of Object.values(mocks)) {
    fn.mockResolvedValue({});
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request logging", () => {
  it("logs one JSON line per request with the expected fields", async () => {
    mocks.getPlayerByTag.mockResolvedValue({ tag: "#2PP" });
    const res = await makeApp().request("/api/players/2PP");
    expect(res.status).toBe(200);
    const lines = logLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "info",
      method: "GET",
      path: "/api/players/2PP",
      route: "/api/players/:tag",
      status: 200,
    });
    expect(typeof lines[0]?.ts).toBe("string");
    expect(typeof lines[0]?.durationMs).toBe("number");
  });

  it("LOG_LEVEL=silent suppresses all output, even 5xx", async () => {
    mocks.getCards.mockRejectedValue(axiosError(500));
    const app = makeApp({ LOG_LEVEL: "silent" });
    await app.request("/api/cards");
    await app.request("/api/players/2PP");
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("LOG_LEVEL=error suppresses request lines but keeps structured 5xx errors", async () => {
    mocks.getCards.mockRejectedValue(axiosError(500));
    const app = makeApp({ LOG_LEVEL: "error" });
    await app.request("/api/cards");
    expect(console.log).not.toHaveBeenCalled();
    const errors = errorLines();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ level: "error", path: "/api/cards", status: 502 });
    expect(errors[0]?.error).toMatchObject({ message: "Request failed" });
  });

  it("never logs Authorization headers or query strings", async () => {
    mocks.getClans.mockResolvedValue([]);
    const app = makeApp({ PROXY_AUTH_TOKEN: "super-secret-token" });
    await app.request("/api/clans?name=royale&secret=leak-me", {
      headers: { Authorization: "Bearer super-secret-token" },
    });
    const output = vi
      .mocked(console.log)
      .mock.calls.map((args) => args.join(" "))
      .join("\n");
    expect(output).not.toContain("super-secret-token");
    expect(output).not.toContain("leak-me");
    expect(logLines()[0]?.path).toBe("/api/clans");
  });

  describe("caller IP modes (via trusted X-Forwarded-For)", () => {
    const headers = { "X-Forwarded-For": "203.0.113.7" };
    const ipApp = (mode?: string) =>
      makeApp({ TRUST_PROXY: "true", ...(mode ? { LOG_IP_MODE: mode } : {}) });

    it("logs the full IP when LOG_IP_MODE=full", async () => {
      await ipApp("full").request("/health", { headers });
      expect(logLines()[0]?.ip).toBe("203.0.113.7");
    });

    it("logs a 12-char SHA-256 prefix by default", async () => {
      await ipApp().request("/health", { headers });
      const expected = createHash("sha256").update("203.0.113.7").digest("hex").slice(0, 12);
      expect(logLines()[0]?.ip).toBe(expected);
    });

    it("omits the IP entirely when LOG_IP_MODE=omit", async () => {
      await ipApp("omit").request("/health", { headers });
      expect(logLines()[0]).not.toHaveProperty("ip");
    });
  });

  it("logs cache MISS then HIT for repeated requests", async () => {
    mocks.getCards.mockResolvedValue({ items: [] });
    const app = makeApp({ CACHE_TTL_MS: "60000" });
    await app.request("/api/cards");
    await app.request("/api/cards");
    const lines = logLines();
    expect(lines[0]?.cache).toBe("MISS");
    expect(lines[1]?.cache).toBe("HIT");
  });

  it("logs rate-limited requests too", async () => {
    const app = makeApp({ RATE_LIMIT_MAX: "1" });
    await app.request("/api/cards");
    const limited = await app.request("/api/cards");
    expect(limited.status).toBe(429);
    expect(logLines()[1]?.status).toBe(429);
  });
});

describe("metrics", () => {
  it("is disabled by default (404)", async () => {
    expect((await makeApp().request("/metrics")).status).toBe(404);
  });

  it("serves Prometheus text when enabled", async () => {
    const res = await makeApp({ METRICS_ENABLED: "true" }).request("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("# TYPE royale_requests_total counter");
    expect(text).toContain("# TYPE royale_uptime_seconds gauge");
  });

  it("counts requests by status class", async () => {
    const app = makeApp({ METRICS_ENABLED: "true" });
    await app.request("/api/cards"); // 200
    await app.request("/api/nope"); // 404
    const text = await metricsText(app);
    expect(text).toContain('royale_requests_total{status="2xx"} 1');
    expect(text).toContain('royale_requests_total{status="4xx"} 1');
  });

  it("counts cache hits and misses", async () => {
    mocks.getCards.mockResolvedValue({});
    const app = makeApp({ METRICS_ENABLED: "true", CACHE_TTL_MS: "60000" });
    await app.request("/api/cards");
    await app.request("/api/cards");
    const text = await metricsText(app);
    expect(text).toContain("royale_cache_hits_total 1");
    expect(text).toContain("royale_cache_misses_total 1");
  });

  it("counts local rate-limit rejections", async () => {
    const app = makeApp({ METRICS_ENABLED: "true", RATE_LIMIT_MAX: "1", TRUST_PROXY: "true" });
    const caller = { "X-Forwarded-For": "203.0.113.1" };
    await app.request("/api/cards", { headers: caller });
    await app.request("/api/cards", { headers: caller }); // rejected locally
    // Scrape from a different IP: /metrics is rate-limited like everything else.
    const text = await metricsText(app, { "X-Forwarded-For": "203.0.113.2" });
    expect(text).toContain("royale_rate_limited_total 1");
  });

  it("does not count upstream 429s as local rate limiting", async () => {
    mocks.getCards.mockRejectedValue(axiosError(429));
    const app = makeApp({ METRICS_ENABLED: "true" });
    expect((await app.request("/api/cards")).status).toBe(429);
    const text = await metricsText(app);
    expect(text).toContain("royale_rate_limited_total 0");
    expect(text).toContain("royale_upstream_errors_total 0");
  });

  it("counts upstream 5xx but not upstream 4xx or validation errors", async () => {
    mocks.getCards.mockRejectedValueOnce(axiosError(500)).mockRejectedValueOnce(axiosError(404));
    const app = makeApp({ METRICS_ENABLED: "true" });
    await app.request("/api/cards"); // 502
    await app.request("/api/cards"); // 404
    await app.request("/api/players/bad!!tag"); // 400 (our own HTTPException)
    expect(await metricsText(app)).toContain("royale_upstream_errors_total 1");
  });

  it("counts upstream timeouts", async () => {
    mocks.getCards.mockImplementation(() => new Promise(() => {}));
    const app = makeApp({ METRICS_ENABLED: "true", UPSTREAM_TIMEOUT_MS: "100" });
    expect((await app.request("/api/cards")).status).toBe(504);
    expect(await metricsText(app)).toContain("royale_upstream_timeouts_total 1");
  });

  it("gates /metrics behind the bearer token when configured", async () => {
    const app = makeApp({ METRICS_ENABLED: "true", PROXY_AUTH_TOKEN: "secret-token" });
    expect((await app.request("/metrics")).status).toBe(401);
    const ok = await app.request("/metrics", {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(ok.status).toBe(200);
  });
});
