import { Hono } from "hono";
import type { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import { addTagRoute } from "../lib/route-helpers.js";

export function playerRoutes(api: ClashRoyaleAPI, timeoutMs: number): Hono {
  const routes = new Hono();
  addTagRoute(routes, "/:tag", "player tag", timeoutMs, (tag) => api.getPlayerByTag(tag));
  addTagRoute(routes, "/:tag/battlelog", "player tag", timeoutMs, (tag) =>
    api.getPlayerBattleLog(tag),
  );
  addTagRoute(routes, "/:tag/upcomingchests", "player tag", timeoutMs, (tag) =>
    api.getPlayerUpcomingChests(tag),
  );
  return routes;
}
