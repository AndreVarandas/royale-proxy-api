import { z } from "zod";

/**
 * Environment-driven configuration, validated once at startup.
 * Every knob a self-hoster might want to tune lives here and in .env.example.
 */
const envSchema = z.object({
  CLASH_ROYALE_API_TOKEN: z
    .string()
    .trim()
    .min(
      1,
      "is required — create a key at https://developer.clashroyale.com and whitelist this server's IP",
    ),
  PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  HOST: z.string().min(1).default("0.0.0.0"),
  /** Override the upstream base URL (e.g. another proxy). Defaults to the official API. */
  UPSTREAM_BASE_URL: z.url().optional(),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),
  /** Response cache TTL in ms. 0 disables caching. */
  CACHE_TTL_MS: z.coerce.number().int().min(0).default(30_000),
  CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).default(500),
  /** Comma-separated list of allowed origins, or "*" (default) for any origin. */
  CORS_ORIGIN: z.string().min(1).default("*"),
  /** When set, /api/* requires this bearer token. Leave unset for a public proxy. */
  PROXY_AUTH_TOKEN: z.string().trim().min(1).optional(),
  /** Trust X-Forwarded-For for rate-limit keys (enable only behind a trusted reverse proxy). */
  TRUST_PROXY: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  /** Structured JSON request logs to stdout. "silent" disables all logging. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  /** Caller IP in request logs: omit, hash (12-char SHA-256 prefix) or full. */
  LOG_IP_MODE: z.enum(["omit", "hash", "full"]).default("hash"),
  /** Expose Prometheus-format counters at /metrics (gated by PROXY_AUTH_TOKEN when set). */
  METRICS_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
});

export type AppConfig = z.output<typeof envSchema>;

/**
 * Load a .env file (Node built-in, no dependency). Real environment variables
 * always take precedence over the file. A missing file is fine (Docker/pm2/CI
 * inject real env vars); other I/O errors propagate. Node's parser is lenient
 * about file content — invalid lines are skipped, not fatal.
 */
export function loadEnvFile(path?: string): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid configuration:\n${details}\n\nCopy .env.example to .env and fill in the values.`,
    );
  }
  return result.data;
}
