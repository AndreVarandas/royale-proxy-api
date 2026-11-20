import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/env.js";

/** Mock the upstream wrapper so tests never need a real Supercell key. */
const mocks = vi.hoisted(() => ({
  getPlayerByTag: vi.fn(),
  getPlayerBattleLog: vi.fn(),
  getPlayerUpcomingChests: vi.fn(),
  getClans: vi.fn(),
  getClanByTag: vi.fn(),
  getClanMembers: vi.fn(),
  getClanWarlog: vi.fn(),
  getClanCurrentWar: vi.fn(),
  getClanCurrentRiverRace: vi.fn(),
  getTournaments: vi.fn(),
  getTournamentByTag: vi.fn(),
  getGlobalTournaments: vi.fn(),
  getCards: vi.fn(),
  getLocations: vi.fn(),
  getLocationById: vi.fn(),
  getClanRankinsForLocation: vi.fn(),
  getPlayerRankingsForLocation: vi.fn(),
  getClanWarRankingsForLocation: vi.fn(),
  getLeaderboards: vi.fn(),
  getLeaderboardById: vi.fn(),
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

/** res.json() is typed unknown; tests inspect arbitrary shapes. */
const json = (res: Response): Promise<Record<string, unknown>> =>
  res.json() as Promise<Record<string, unknown>>;

beforeEach(() => {
  // Full reset so no implementation (e.g. a never-resolving promise from the
  // timeout test) can leak into the next test.
  vi.resetAllMocks();
  // The app logs 5xx errors for observability; keep test output clean and
  // assert on the spy where relevant instead.
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

describe("health", () => {
  it("GET / reports name, version and status", async () => {
    const res = await makeApp().request("/");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ name: "royale-proxy-api", status: "ok" });
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("GET /health is ok", async () => {
    const res = await makeApp().request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("endpoint surface (parity with v1)", () => {
  const fixture = { items: [{ tag: "#TEST" }] };
  const cases: Array<{
    path: string;
    method: keyof typeof mocks;
    args: unknown[];
  }> = [
    { path: "/api/players/2PP", method: "getPlayerByTag", args: ["#2PP"] },
    { path: "/api/players/2PP/battlelog", method: "getPlayerBattleLog", args: ["#2PP"] },
    { path: "/api/players/2PP/upcomingchests", method: "getPlayerUpcomingChests", args: ["#2PP"] },
    { path: "/api/clans?name=royale", method: "getClans", args: [{ name: "royale" }] },
    {
      path: "/api/clans?name=royale&limit=5&minMembers=10&locationId=57000000",
      method: "getClans",
      args: [{ name: "royale", limit: 5, minMembers: 10, locationId: 57000000 }],
    },
    { path: "/api/clans/2PP", method: "getClanByTag", args: ["#2PP"] },
    { path: "/api/clans/2PP/members", method: "getClanMembers", args: ["#2PP"] },
    { path: "/api/clans/2PP/warlog", method: "getClanWarlog", args: ["#2PP"] },
    { path: "/api/clans/2PP/currentwar", method: "getClanCurrentWar", args: ["#2PP"] },
    { path: "/api/clans/2PP/currentriverrace", method: "getClanCurrentRiverRace", args: ["#2PP"] },
    { path: "/api/tournaments?name=fun", method: "getTournaments", args: [{ name: "fun" }] },
    { path: "/api/tournaments/2PP", method: "getTournamentByTag", args: ["#2PP"] },
    { path: "/api/globaltournaments", method: "getGlobalTournaments", args: [] },
    { path: "/api/cards", method: "getCards", args: [] },
    { path: "/api/locations", method: "getLocations", args: [{}] },
    { path: "/api/locations?limit=10", method: "getLocations", args: [{ limit: 10 }] },
    { path: "/api/locations/57000000", method: "getLocationById", args: ["57000000"] },
    {
      path: "/api/locations/57000000/clanrankings?limit=5",
      method: "getClanRankinsForLocation",
      args: ["57000000", { limit: 5, locationId: "57000000" }],
    },
    {
      path: "/api/locations/global/playerrankings",
      method: "getPlayerRankingsForLocation",
      args: ["global", { locationId: "global" }],
    },
    {
      path: "/api/locations/57000000/clanwarrankings",
      method: "getClanWarRankingsForLocation",
      args: ["57000000", { locationId: "57000000" }],
    },
    { path: "/api/leaderboards", method: "getLeaderboards", args: [] },
    {
      path: "/api/leaderboards/71000000?limit=3",
      method: "getLeaderboardById",
      args: [71000000, { limit: 3 }],
    },
  ];

  for (const { path, method, args } of cases) {
    it(`GET ${path} -> 200 and calls ${method} correctly`, async () => {
      mocks[method].mockResolvedValue(fixture);
      const res = await makeApp().request(path);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(fixture);
      expect(mocks[method]).toHaveBeenCalledTimes(1);
      expect(mocks[method]).toHaveBeenCalledWith(...args);
    });
  }
});

describe("input validation", () => {
  it("normalizes tags: strips '#' and uppercases", async () => {
    mocks.getPlayerByTag.mockResolvedValue({});
    const res = await makeApp().request("/api/players/%232pp");
    expect(res.status).toBe(200);
    expect(mocks.getPlayerByTag).toHaveBeenCalledWith("#2PP");
  });

  it("rejects malformed tags with 400", async () => {
    const res = await makeApp().request("/api/players/bad!!tag");
    expect(res.status).toBe(400);
    expect((await json(res)).message).toContain("player tag");
    expect(mocks.getPlayerByTag).not.toHaveBeenCalled();
  });

  it("rejects path traversal attempts in tags", async () => {
    const res = await makeApp().request("/api/players/..%2F..%2Fclans");
    expect(res.status).toBe(400);
    expect(mocks.getPlayerByTag).not.toHaveBeenCalled();
  });

  it("strips unknown query parameters instead of forwarding them", async () => {
    mocks.getClans.mockResolvedValue([]);
    const res = await makeApp().request("/api/clans?name=royale&evil=1&limit=5");
    expect(res.status).toBe(200);
    expect(mocks.getClans).toHaveBeenCalledWith({ name: "royale", limit: 5 });
  });

  it("rejects non-numeric limit", async () => {
    const res = await makeApp().request("/api/locations?limit=abc");
    expect(res.status).toBe(400);
    expect(mocks.getLocations).not.toHaveBeenCalled();
  });

  it("rejects out-of-range limit", async () => {
    const res = await makeApp().request("/api/locations?limit=99999");
    expect(res.status).toBe(400);
  });

  it("rejects after and before together", async () => {
    const res = await makeApp().request("/api/locations?after=1&before=2");
    expect(res.status).toBe(400);
    expect((await json(res)).message).toContain("after");
  });

  it("requires clan search name of at least 3 characters", async () => {
    expect((await makeApp().request("/api/clans")).status).toBe(400);
    expect((await makeApp().request("/api/clans?name=ab")).status).toBe(400);
    expect(mocks.getClans).not.toHaveBeenCalled();
  });

  it("requires tournament search name", async () => {
    const res = await makeApp().request("/api/tournaments");
    expect(res.status).toBe(400);
    expect(mocks.getTournaments).not.toHaveBeenCalled();
  });

  it("rejects non-numeric location IDs", async () => {
    const res = await makeApp().request("/api/locations/abc");
    expect(res.status).toBe(400);
    expect(mocks.getLocationById).not.toHaveBeenCalled();
  });

  it("rejects 'global' for location details but allows it for rankings", async () => {
    mocks.getPlayerRankingsForLocation.mockResolvedValue([]);
    expect((await makeApp().request("/api/locations/global")).status).toBe(400);
    expect((await makeApp().request("/api/locations/global/playerrankings")).status).toBe(200);
  });

  it("rejects non-numeric leaderboard IDs", async () => {
    const res = await makeApp().request("/api/leaderboards/abc");
    expect(res.status).toBe(400);
    expect(mocks.getLeaderboardById).not.toHaveBeenCalled();
  });
});

describe("upstream error mapping", () => {
  const axiosError = (status: number, data: unknown) =>
    Object.assign(new Error("Request failed"), { response: { status, data } });

  it("maps upstream 404 with its message", async () => {
    mocks.getPlayerByTag.mockRejectedValue(
      axiosError(404, { reason: "notFound", message: "player not found" }),
    );
    const res = await makeApp().request("/api/players/2PP");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "player not found" });
  });

  it("maps upstream 403 to a helpful token message", async () => {
    mocks.getCards.mockRejectedValue(axiosError(403, { reason: "accessDenied" }));
    const res = await makeApp().request("/api/cards");
    expect(res.status).toBe(403);
    expect((await json(res)).message).toContain("CLASH_ROYALE_API_TOKEN");
  });

  it("maps upstream 429", async () => {
    mocks.getCards.mockRejectedValue(axiosError(429, {}));
    const res = await makeApp().request("/api/cards");
    expect(res.status).toBe(429);
  });

  it("maps upstream 5xx to 502 without leaking the body", async () => {
    mocks.getCards.mockRejectedValue(axiosError(500, { secret: "internal details" }));
    const res = await makeApp().request("/api/cards");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ message: "The Clash Royale API returned an error" });
    // Server-side observability: 5xx must be logged.
    expect(console.error).toHaveBeenCalled();
  });

  it("maps network failures to 502", async () => {
    mocks.getCards.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const res = await makeApp().request("/api/cards");
    expect(res.status).toBe(502);
    expect((await json(res)).message).toContain("Could not reach");
  });

  it("times out slow upstream calls with 504", async () => {
    mocks.getCards.mockImplementation(() => new Promise(() => {}));
    const res = await makeApp({ UPSTREAM_TIMEOUT_MS: "100" }).request("/api/cards");
    expect(res.status).toBe(504);
  });
});

describe("HTTP semantics", () => {
  it("returns 405 with Allow header for non-GET methods", async () => {
    const res = await makeApp().request("/api/cards", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toContain("GET");
    expect(await res.json()).toEqual({ message: "Method not allowed" });
  });

  it("returns 405 for POST on tag routes", async () => {
    const res = await makeApp().request("/api/players/2PP", { method: "POST" });
    expect(res.status).toBe(405);
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await makeApp().request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Route not found" });
  });

  it("rejects oversized request bodies with 413", async () => {
    const res = await makeApp().request("/api/cards", {
      method: "POST",
      body: "x".repeat(2048),
    });
    expect(res.status).toBe(413);
  });
});

describe("security headers & CORS", () => {
  it("sets security headers", async () => {
    const res = await makeApp().request("/");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("allows any origin without credentials", async () => {
    const res = await makeApp().request("/api/cards", {
      headers: { Origin: "https://example.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("answers preflight with 204 and GET-only methods", async () => {
    const res = await makeApp().request("/api/cards", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
    expect(res.headers.get("access-control-allow-methods")).not.toContain("POST");
  });

  it("restricts origins when CORS_ORIGIN is configured", async () => {
    const app = makeApp({ CORS_ORIGIN: "https://a.example, https://b.example" });
    const allowed = await app.request("/api/cards", { headers: { Origin: "https://a.example" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://a.example");
    const denied = await app.request("/api/cards", { headers: { Origin: "https://evil.example" } });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("rate limiting", () => {
  it("returns 429 after the per-window limit", async () => {
    mocks.getCards.mockResolvedValue({});
    const app = makeApp({ RATE_LIMIT_MAX: "2" });
    expect((await app.request("/api/cards")).status).toBe(200);
    expect((await app.request("/api/cards")).status).toBe(200);
    const limited = await app.request("/api/cards");
    expect(limited.status).toBe(429);
    expect((await json(limited)).message).toContain("Too many requests");
    expect(limited.headers.get("ratelimit-limit")).toBe("2");
  });
});

describe("response caching", () => {
  it("serves repeated GETs from cache and marks X-Cache", async () => {
    mocks.getCards.mockResolvedValue({ items: [] });
    const app = makeApp({ CACHE_TTL_MS: "60000" });
    const first = await app.request("/api/cards");
    expect(first.status).toBe(200);
    expect(first.headers.get("x-cache")).toBe("MISS");
    const second = await app.request("/api/cards");
    expect(second.status).toBe(200);
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(await second.json()).toEqual({ items: [] });
    expect(mocks.getCards).toHaveBeenCalledTimes(1);
  });

  it("keys the cache by full URL (query included)", async () => {
    mocks.getLocations.mockResolvedValue([]);
    const app = makeApp({ CACHE_TTL_MS: "60000" });
    await app.request("/api/locations?limit=5");
    await app.request("/api/locations?limit=10");
    expect(mocks.getLocations).toHaveBeenCalledTimes(2);
  });

  it("does not cache error responses", async () => {
    mocks.getCards
      .mockRejectedValueOnce(Object.assign(new Error("fail"), { response: { status: 500 } }))
      .mockResolvedValueOnce({ items: [] });
    const app = makeApp({ CACHE_TTL_MS: "60000" });
    expect((await app.request("/api/cards")).status).toBe(502);
    expect((await app.request("/api/cards")).status).toBe(200);
    expect(mocks.getCards).toHaveBeenCalledTimes(2);
  });
});

describe("optional bearer auth", () => {
  it("is disabled by default", async () => {
    mocks.getCards.mockResolvedValue({});
    expect((await makeApp().request("/api/cards")).status).toBe(200);
  });

  it("rejects missing and wrong tokens, accepts the right one", async () => {
    mocks.getCards.mockResolvedValue({});
    const app = makeApp({ PROXY_AUTH_TOKEN: "secret-token" });

    const missing = await app.request("/api/cards");
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");
    expect((await json(missing)).message).toContain("bearer token");

    const wrong = await app.request("/api/cards", {
      headers: { Authorization: "Bearer nope" },
    });
    expect(wrong.status).toBe(401);

    const right = await app.request("/api/cards", {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(right.status).toBe(200);
  });

  it("does not gate the health endpoints", async () => {
    const app = makeApp({ PROXY_AUTH_TOKEN: "secret-token" });
    expect((await app.request("/")).status).toBe(200);
    expect((await app.request("/health")).status).toBe(200);
  });
});

describe("configuration", () => {
  it("fails fast when the token is missing", () => {
    expect(() => loadConfig({})).toThrow(/CLASH_ROYALE_API_TOKEN/);
  });

  it("rejects invalid PORT", () => {
    expect(() => loadConfig({ ...baseEnv, PORT: "not-a-port" })).toThrow(/PORT/);
  });

  it("applies sensible defaults", () => {
    const config = loadConfig({ CLASH_ROYALE_API_TOKEN: "test-token" });
    expect(config.PORT).toBe(3002);
    expect(config.RATE_LIMIT_MAX).toBe(60);
    expect(config.CACHE_TTL_MS).toBe(30_000);
    expect(config.UPSTREAM_TIMEOUT_MS).toBe(10_000);
    expect(config.TRUST_PROXY).toBe(false);
  });
});
