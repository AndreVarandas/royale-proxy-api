import { Hono } from "hono";
import type { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import { addTagRoute } from "../lib/route-helpers.js";
import { callUpstream } from "../lib/upstream.js";
import { clanSearchSchema, parseQuery } from "../lib/validation.js";

export function clanRoutes(api: ClashRoyaleAPI, timeoutMs: number): Hono {
  const routes = new Hono();

  routes.get("/", async (c) => {
    const params = parseQuery(clanSearchSchema, c);
    return c.json(await callUpstream(() => api.getClans(params), timeoutMs));
  });

  addTagRoute(routes, "/:tag", "clan tag", timeoutMs, (tag) => api.getClanByTag(tag));
  addTagRoute(routes, "/:tag/members", "clan tag", timeoutMs, (tag) => api.getClanMembers(tag));
  addTagRoute(routes, "/:tag/warlog", "clan tag", timeoutMs, (tag) => api.getClanWarlog(tag));
  addTagRoute(routes, "/:tag/currentwar", "clan tag", timeoutMs, (tag) =>
    api.getClanCurrentWar(tag),
  );
  addTagRoute(routes, "/:tag/currentriverrace", "clan tag", timeoutMs, (tag) =>
    api.getClanCurrentRiverRace(tag),
  );

  return routes;
}
