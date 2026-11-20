import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { z } from "zod";

/**
 * Strict input validation. Only whitelisted, well-formed parameters ever
 * reach the upstream API — unknown query parameters are stripped, malformed
 * ones are rejected with 400.
 */

/** Clash Royale tags: letters/digits, optionally prefixed with '#'. Normalized to uppercase. */
export const tagSchema = z
  .string()
  .transform((t) => t.trim().replace(/^#/, "").toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[0-9A-Z]{2,12}$/, "must be 2-12 letters/digits (a Clash Royale tag, without '#')"),
  );

export const locationIdSchema = z.string().regex(/^\d{1,12}$/, "must be a numeric location ID");

/** Rankings also accept the special "global" location. */
export const rankingLocationIdSchema = z.union([z.literal("global"), locationIdSchema]);

export const leaderboardIdSchema = z
  .string()
  .regex(/^\d{1,12}$/, "must be a numeric leaderboard ID")
  .transform(Number);

const pagingShape = {
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  after: z.coerce.number().int().min(0).optional(),
  before: z.coerce.number().int().min(0).optional(),
};

const notBothCursors = (d: { after?: unknown; before?: unknown }) =>
  !(d.after !== undefined && d.before !== undefined);
const cursorRule = { message: "only one of 'after' or 'before' may be given" };

export const pagingSchema = z.object(pagingShape).refine(notBothCursors, cursorRule);

export const clanSearchSchema = z
  .object({
    name: z.string().trim().min(3, "must be at least 3 characters").max(100),
    locationId: z.coerce.number().int().positive().optional(),
    minMembers: z.coerce.number().int().min(0).optional(),
    maxMembers: z.coerce.number().int().min(0).optional(),
    minScore: z.coerce.number().int().min(0).optional(),
    ...pagingShape,
  })
  .refine(notBothCursors, cursorRule);

export const tournamentSearchSchema = z
  .object({
    name: z.string().trim().min(1, "is required").max(100),
    ...pagingShape,
  })
  .refine(notBothCursors, cursorRule);

/** Leaderboard paging markers are strings in the upstream API. */
export const leaderboardQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    after: z.string().regex(/^\d+$/, "must be a numeric cursor").optional(),
    before: z.string().regex(/^\d+$/, "must be a numeric cursor").optional(),
  })
  .refine(notBothCursors, cursorRule);

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "value"} ${issue.message}`)
    .join("; ");
}

export function parseWith<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HTTPException(400, { message: `Invalid ${label}: ${formatIssues(result.error)}` });
  }
  return result.data;
}

export function parseQuery<T>(schema: z.ZodType<T>, c: Context): T {
  const raw = Object.fromEntries(new URL(c.req.url).searchParams);
  return parseWith(schema, raw, "query parameters");
}

export function parseParam<T>(schema: z.ZodType<T>, value: string | undefined, label: string): T {
  return parseWith(schema, value ?? "", label);
}
