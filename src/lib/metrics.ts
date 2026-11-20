/**
 * In-memory counters rendered as Prometheus text exposition format — no
 * dependencies, no histograms. State is per-process (like the rate limiter and
 * cache), so run a single instance. Created only when METRICS_ENABLED is set.
 */

export interface Metrics {
  /** Count a finished request by status class and cache outcome (HIT/MISS/null). */
  observeRequest(status: number, cache: string | null): void;
  /** A request rejected by the local per-IP rate limiter (not upstream 429s). */
  rateLimited(): void;
  /** Upstream returned 5xx or was unreachable. */
  upstreamError(): void;
  /** Upstream call exceeded UPSTREAM_TIMEOUT_MS. */
  upstreamTimeout(): void;
  render(): string;
}

const STATUS_CLASSES = ["2xx", "3xx", "4xx", "5xx"] as const;
type StatusClass = (typeof STATUS_CLASSES)[number];

function metric(
  name: string,
  type: "counter" | "gauge",
  help: string,
  samples: Array<[labels: string, value: number]>,
): string[] {
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} ${type}`,
    ...samples.map(([labels, value]) => `${name}${labels} ${value}`),
  ];
}

export function createMetrics(now: () => number = Date.now): Metrics {
  const startedAt = now();
  const requests: Record<StatusClass, number> = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  let cacheHits = 0;
  let cacheMisses = 0;
  let rateLimited = 0;
  let upstreamErrors = 0;
  let upstreamTimeouts = 0;

  return {
    observeRequest(status, cache) {
      const cls = `${Math.floor(status / 100)}xx`;
      if (STATUS_CLASSES.includes(cls as StatusClass)) requests[cls as StatusClass] += 1;
      if (cache === "HIT") cacheHits += 1;
      else if (cache === "MISS") cacheMisses += 1;
    },
    rateLimited() {
      rateLimited += 1;
    },
    upstreamError() {
      upstreamErrors += 1;
    },
    upstreamTimeout() {
      upstreamTimeouts += 1;
    },
    render() {
      const uptimeSeconds = Math.max(0, (now() - startedAt) / 1000);
      return (
        [
          ...metric("royale_requests_total", "counter", "Requests by status class.", [
            ...STATUS_CLASSES.map((cls): [string, number] => [`{status="${cls}"}`, requests[cls]]),
          ]),
          ...metric("royale_cache_hits_total", "counter", "Requests served from cache.", [
            ["", cacheHits],
          ]),
          ...metric("royale_cache_misses_total", "counter", "Requests forwarded upstream.", [
            ["", cacheMisses],
          ]),
          ...metric(
            "royale_rate_limited_total",
            "counter",
            "Requests rejected by the local per-IP rate limiter.",
            [["", rateLimited]],
          ),
          ...metric(
            "royale_upstream_errors_total",
            "counter",
            "Upstream 5xx responses and unreachable-upstream errors.",
            [["", upstreamErrors]],
          ),
          ...metric("royale_upstream_timeouts_total", "counter", "Upstream call timeouts.", [
            ["", upstreamTimeouts],
          ]),
          ...metric("royale_uptime_seconds", "gauge", "Seconds since the app was created.", [
            ["", Math.round(uptimeSeconds * 1000) / 1000],
          ]),
        ].join("\n") + "\n"
      );
    },
  };
}
