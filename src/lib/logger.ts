/**
 * Minimal level-filtered JSON-lines logger — no dependencies. Info/debug go to
 * stdout, warn/error to stderr, so pm2/Docker log drivers can split streams.
 * Uses console.* under the hood so tests can spy on it like the rest of the app.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(fields: LogFields): void;
  info(fields: LogFields): void;
  warn(fields: LogFields): void;
  error(fields: LogFields): void;
}

/** Serialize an unknown thrown value without dumping arbitrary internals. */
export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

export function createLogger(level: LogLevel): Logger {
  const threshold = LEVEL_PRIORITY[level];
  const emit = (lvl: Exclude<LogLevel, "silent">, fields: LogFields): void => {
    if (LEVEL_PRIORITY[lvl] < threshold) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, ...fields });
    if (lvl === "warn" || lvl === "error") console.error(line);
    else console.log(line);
  };
  return {
    debug: (fields) => emit("debug", fields),
    info: (fields) => emit("info", fields),
    warn: (fields) => emit("warn", fields),
    error: (fields) => emit("error", fields),
  };
}
