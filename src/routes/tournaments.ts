import { Hono } from "hono";
import type { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import { addTagRoute } from "../lib/route-helpers.js";
import { callUpstream } from "../lib/upstream.js";
import { parseQuery, tournamentSearchSchema } from "../lib/validation.js";

export function tournamentRoutes(api: ClashRoyaleAPI, timeoutMs: number): Hono {
  const routes = new Hono();

  routes.get("/", async (c) => {
    const params = parseQuery(tournamentSearchSchema, c);
    return c.json(await callUpstream(() => api.getTournaments(params), timeoutMs));
  });

  addTagRoute(routes, "/:tag", "tournament tag", timeoutMs, (tag) => api.getTournamentByTag(tag));

  return routes;
}
