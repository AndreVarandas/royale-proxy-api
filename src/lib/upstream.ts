export class UpstreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The Clash Royale API did not respond within ${timeoutMs}ms`);
    this.name = "UpstreamTimeoutError";
  }
}

/**
 * Run an upstream call with a hard timeout so a slow upstream can never pin
 * proxy connections indefinitely. (The wrapper's axios instance has no
 * timeout of its own.)
 */
export async function callUpstream<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new UpstreamTimeoutError(timeoutMs)), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
