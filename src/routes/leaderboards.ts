import { Hono } from "hono";
import type { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import { callUpstream } from "../lib/upstream.js";
import {
  leaderboardIdSchema,
  leaderboardQuerySchema,
  parseParam,
  parseQuery,
} from "../lib/validation.js";

export function leaderboardRoutes(api: ClashRoyaleAPI, timeoutMs: number): Hono {
  const routes = new Hono();

  routes.get("/", async (c) => {
    return c.json(await callUpstream(() => api.getLeaderboards(), timeoutMs));
  });

  routes.get("/:leaderboardId", async (c) => {
    const id = parseParam(leaderboardIdSchema, c.req.param("leaderboardId"), "leaderboard ID");
    const params = parseQuery(leaderboardQuerySchema, c);
    return c.json(await callUpstream(() => api.getLeaderboardById(id, params), timeoutMs));
  });

  return routes;
}
