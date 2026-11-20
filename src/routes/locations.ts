import { Hono } from "hono";
import type { ClashRoyaleAPI } from "@varandas/clash-royale-api";
import { callUpstream } from "../lib/upstream.js";
import {
  locationIdSchema,
  pagingSchema,
  parseParam,
  parseQuery,
  rankingLocationIdSchema,
} from "../lib/validation.js";

export function locationRoutes(api: ClashRoyaleAPI, timeoutMs: number): Hono {
  const routes = new Hono();

  routes.get("/", async (c) => {
    const params = parseQuery(pagingSchema, c);
    return c.json(await callUpstream(() => api.getLocations(params), timeoutMs));
  });

  routes.get("/:id", async (c) => {
    const id = parseParam(locationIdSchema, c.req.param("id"), "location ID");
    return c.json(await callUpstream(() => api.getLocationById(id), timeoutMs));
  });

  routes.get("/:id/clanrankings", async (c) => {
    const id = parseParam(rankingLocationIdSchema, c.req.param("id"), "location ID");
    const params = parseQuery(pagingSchema, c);
    return c.json(
      await callUpstream(
        () => api.getClanRankinsForLocation(id, { ...params, locationId: id }),
        timeoutMs,
      ),
    );
  });

  routes.get("/:id/playerrankings", async (c) => {
    const id = parseParam(rankingLocationIdSchema, c.req.param("id"), "location ID");
    const params = parseQuery(pagingSchema, c);
    return c.json(
      await callUpstream(
        () => api.getPlayerRankingsForLocation(id, { ...params, locationId: id }),
        timeoutMs,
      ),
    );
  });

  routes.get("/:id/clanwarrankings", async (c) => {
    const id = parseParam(rankingLocationIdSchema, c.req.param("id"), "location ID");
    const params = parseQuery(pagingSchema, c);
    return c.json(
      await callUpstream(
        () => api.getClanWarRankingsForLocation(id, { ...params, locationId: id }),
        timeoutMs,
      ),
    );
  });

  return routes;
}
