import type { Hono } from "hono";
import { callUpstream } from "./upstream.js";
import { parseParam, tagSchema } from "./validation.js";

/**
 * Register a GET route addressed by a Clash Royale tag. The tag is validated
 * and normalized, prefixed with '#', and the upstream call is time-boxed.
 */
export function addTagRoute(
  routes: Hono,
  path: string,
  label: string,
  timeoutMs: number,
  call: (tag: string) => Promise<unknown>,
): void {
  routes.get(path, async (c) => {
    const tag = parseParam(tagSchema, c.req.param("tag"), label);
    return c.json(await callUpstream(() => call(`#${tag}`), timeoutMs));
  });
}
