import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/env.js";

/**
 * End-to-end test over real HTTP with a stubbed upstream. Unlike app.test.ts
 * this uses the REAL wrapper + axios, proving the CJS/ESM interop, the
 * Authorization header wiring and the Node server adapter all work.
 */

let upstream: Server;
let proxy: ReturnType<typeof serve>;
let proxyUrl: string;
let lastAuthorization: string | undefined;
let lastUpstreamPath: string | undefined;

beforeAll(async () => {
  // Request logging is on by default; keep test output clean.
  vi.spyOn(console, "log").mockImplementation(() => {});
  upstream = createServer((req, res) => {
    lastAuthorization = req.headers.authorization;
    lastUpstreamPath = req.url;
    res.setHeader("content-type", "application/json");
    if (req.url?.startsWith("/players/")) {
      res.end(JSON.stringify({ tag: "#2PP", name: "Test Player", expLevel: 50 }));
    } else if (req.url === "/cards") {
      res.end(JSON.stringify({ items: [{ name: "Knight", id: 26000000 }] }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ reason: "notFound", message: "resource not found" }));
    }
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

  const app = createApp(
    loadConfig({
      CLASH_ROYALE_API_TOKEN: "e2e-test-token",
      UPSTREAM_BASE_URL: upstreamUrl,
      RATE_LIMIT_MAX: "1000",
      CACHE_TTL_MS: "0",
    }),
  );
  proxy = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" });
  await new Promise<void>((resolve) => proxy.once("listening", resolve));
  proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => proxy.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
});

describe("end-to-end over real HTTP", () => {
  it("proxies a player request and forwards the bearer token upstream", async () => {
    const res = await fetch(`${proxyUrl}/api/players/2PP`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tag: "#2PP", name: "Test Player", expLevel: 50 });
    expect(lastAuthorization).toBe("Bearer e2e-test-token");
    expect(lastUpstreamPath).toMatch(/^\/players\/.*2PP$/);
  });

  it("proxies the cards endpoint", async () => {
    const res = await fetch(`${proxyUrl}/api/cards`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ name: "Knight", id: 26000000 }] });
    expect(lastUpstreamPath).toBe("/cards");
  });

  it("maps upstream 404 to a clean JSON 404", async () => {
    const res = await fetch(`${proxyUrl}/api/locations/999999`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "resource not found" });
  });

  it("serves the health endpoint", async () => {
    const res = await fetch(`${proxyUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "royale-proxy-api", status: "ok" });
  });
});
