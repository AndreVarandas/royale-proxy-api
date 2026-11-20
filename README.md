# Royale Proxy API

![Royale Proxy API Logo](art/logo.jpg)

A lean, secure proxy for the official [Clash Royale API](https://developer.clashroyale.com/). Clone it, add your API key, run it on your server — and let any client call the API through you, **without whitelisting every client's IP**.

Built with [Hono](https://hono.dev) on Node.js. v2 is a ground-up rewrite: ~400 lines of explicit, auditable TypeScript, zero known vulnerabilities, and safe defaults for self-hosters.

## 🌟 Motivation

The official Clash Royale API requires each API key to be bound to whitelisted IP addresses — a significant hurdle when your callers are browsers, mobile apps, or serverless functions with dynamic IPs. Royale Proxy API acts as a bridge: you whitelist **one** IP (your server), and the proxy forwards requests to the official API using your key.

> **Understand the trade-off:** every caller of your proxy spends the rate quota of _your_ key. That's why v2 ships with per-IP rate limiting and response caching enabled by default — so no single caller can drain your quota or get your key flagged. See [Security](#-security).

## 🚀 Quick Start

**Requirements:** Node.js ≥ 26 (see `.nvmrc`).

1. **Get your API key** from the [Clash Royale Developer Portal](https://developer.clashroyale.com/).
2. **Whitelist your server's IP** for that key on the portal.
3. **Clone and install:**

   ```bash
   git clone https://github.com/AndreVarandas/royale-proxy-api.git
   cd royale-proxy-api
   npm install
   ```

4. **Configure:** copy `.env.example` to `.env` and set `CLASH_ROYALE_API_TOKEN`.
5. **Run:**

   ```bash
   npm run dev      # development, with hot reload (http://localhost:3002)
   ```

### Production

```bash
npm run build      # compile TypeScript to dist/
npm start          # node dist/index.js
```

Or with pm2:

```bash
pm2 start ecosystem.config.cjs
```

Or with Docker:

```bash
docker build -t royale-proxy-api .
docker run -d --name royale-proxy -p 3002:3002 \
  -e CLASH_ROYALE_API_TOKEN=your-token \
  royale-proxy-api
```

> The proxy must run on a server with a **stable outgoing IP** (VPS, dedicated server, etc.) — that's the IP you whitelist for your key. Serverless/edge platforms with dynamic egress IPs won't work with Supercell's whitelisting.

## 📡 API

All endpoints are `GET` and mirror the official API's response shapes. Base path: `/api`.

| Endpoint                             | Description                                 |
| ------------------------------------ | ------------------------------------------- |
| `/api/players/:tag`                  | Player by tag                               |
| `/api/players/:tag/battlelog`        | Recent battles                              |
| `/api/players/:tag/upcomingchests`   | Upcoming chests                             |
| `/api/clans?name=…`                  | Search clans (`name` required, min 3 chars) |
| `/api/clans/:tag`                    | Clan by tag                                 |
| `/api/clans/:tag/members`            | Clan members                                |
| `/api/clans/:tag/warlog`             | Clan war log                                |
| `/api/clans/:tag/currentwar`         | Current clan war                            |
| `/api/clans/:tag/currentriverrace`   | Current river race                          |
| `/api/tournaments?name=…`            | Search tournaments (`name` required)        |
| `/api/tournaments/:tag`              | Tournament by tag                           |
| `/api/globaltournaments`             | Global tournaments                          |
| `/api/cards`                         | All cards                                   |
| `/api/locations`                     | All locations                               |
| `/api/locations/:id`                 | Location by ID                              |
| `/api/locations/:id/clanrankings`    | Clan rankings (`:id` may be `global`)       |
| `/api/locations/:id/playerrankings`  | Player rankings (`:id` may be `global`)     |
| `/api/locations/:id/clanwarrankings` | Clan war rankings (`:id` may be `global`)   |
| `/api/leaderboards`                  | Available leaderboards                      |
| `/api/leaderboards/:id`              | Leaderboard by ID                           |
| `/` and `/health`                    | Service health + version                    |

Tags may be given with or without `#` and are case-insensitive (`2pp`, `#2PP` → `#2PP`). List endpoints accept `limit`, `after`, `before` (only one cursor at a time); clan search also accepts `locationId`, `minMembers`, `maxMembers`, `minScore`. Unknown query parameters are ignored, malformed ones return `400`.

Example:

```bash
curl http://localhost:3002/api/players/2PP
```

See `tests/*.requests.http` for more ready-to-run examples.

## ⚙️ Configuration

Everything is environment-driven (see `.env.example`). Values are read from a `.env` file in the working directory (loaded automatically at startup) or from the real environment — **real environment variables always win**, which is what Docker/pm2/CI use:

| Variable                                  | Default            | Purpose                                                                           |
| ----------------------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `CLASH_ROYALE_API_TOKEN`                  | — (required)       | Your Supercell API key                                                            |
| `PORT` / `HOST`                           | `3002` / `0.0.0.0` | Listen address                                                                    |
| `UPSTREAM_BASE_URL`                       | official API       | Override upstream (e.g. another proxy)                                            |
| `UPSTREAM_TIMEOUT_MS`                     | `10000`            | Hard timeout on upstream calls                                                    |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `60` / `60000`     | Per-IP rate limit                                                                 |
| `CACHE_TTL_MS` / `CACHE_MAX_ENTRIES`      | `30000` / `500`    | Response cache (`0` disables)                                                     |
| `CORS_ORIGIN`                             | `*`                | Allowed origins (comma-separated list or `*`)                                     |
| `PROXY_AUTH_TOKEN`                        | unset              | When set, `/api/*` requires this bearer token                                     |
| `TRUST_PROXY`                             | `false`            | Trust `X-Forwarded-For` for rate-limit keys (only behind a trusted reverse proxy) |
| `LOG_LEVEL`                               | `info`             | Request log level: `debug`, `info`, `warn`, `error`, `silent`                     |
| `LOG_IP_MODE`                             | `hash`             | Caller IP in logs: `omit`, `hash` (SHA-256 prefix), `full`                        |
| `METRICS_ENABLED`                         | `false`            | Expose Prometheus-format counters at `/metrics`                                   |

## 🔒 Security

v2 was rebuilt with a security-first posture:

- **Up-to-date dependencies, audited in CI.** `npm audit` runs on every push/PR and fails on high/critical findings; Dependabot keeps things current.
- **Strict input validation.** Tags, IDs and query parameters are validated (zod) before anything reaches the upstream API; unknown parameters are stripped, never forwarded.
- **Key-quota protection.** Per-IP rate limiting + short-TTL response caching are on by default, so a single caller can't exhaust your Supercell key's quota.
- **Optional private mode.** Set `PROXY_AUTH_TOKEN` to require a bearer token on every API call.
- **Correct CORS.** No credentials-with-wildcard; only `GET`/`HEAD`/`OPTIONS` are allowed, other methods get `405`.
- **Hardened responses.** Security headers, request body size limits, upstream timeouts, and normalized JSON errors that never dump upstream internals.
- **Fail-fast startup.** Missing/invalid configuration stops the server with a clear message instead of failing per-request.

Found a vulnerability? Please open a private security advisory on GitHub rather than a public issue.

## 📈 Observability

Lean, dependency-free observability so you can see who's spending your key's quota:

- **Structured request logs.** One JSON line per request on stdout (errors on stderr) — method, path, route pattern, status, duration, cache `HIT`/`MISS`, and caller IP. Works out of the box with `pm2 logs`, Docker log drivers, Loki, etc. Tune with `LOG_LEVEL`; `silent` disables logging entirely.
- **Privacy-safe IPs.** `LOG_IP_MODE=hash` (default) logs a 12-char SHA-256 prefix instead of the raw address; `omit` drops it, `full` opts into raw IPs. Authorization headers and query strings are never logged.
- **Optional metrics.** Set `METRICS_ENABLED=true` to expose Prometheus text counters at `/metrics`: requests by status class, cache hits/misses, local rate-limit rejections, upstream errors/timeouts, and uptime. Off by default (404); when `PROXY_AUTH_TOKEN` is set, `/metrics` requires the same bearer token.

Example log line:

```json
{
  "ts": "2026-11-20T12:00:00.000Z",
  "level": "info",
  "method": "GET",
  "path": "/api/players/2PP",
  "route": "/api/players/:tag",
  "status": 200,
  "durationMs": 142,
  "cache": "MISS",
  "ip": "a1b2c3d4e5f6"
}
```

Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: royale-proxy
    static_configs:
      - targets: ["localhost:3002"]
```

Like the rate limiter and cache, metrics are in-memory and per-process — keep a single instance.

## 🧪 Development

```bash
npm run typecheck    # strict TypeScript
npm run lint         # ESLint (type-checked typescript-eslint rules)
npm run lint:fix     # ESLint with autofix
npm run format       # Prettier (write)
npm run format:check # Prettier (verify, used in CI)
npm test             # 60+ tests: full middleware stack in-process + real-HTTP e2e with a stubbed upstream
npm run audit        # npm audit --audit-level=high
```

Tests need **no API key** — the upstream is mocked/stubbed.

## 📜 License

MIT — see [LICENSE](LICENSE).

## ⚠️ Disclaimer

This project is unofficial and not endorsed by Supercell. Review Supercell's Fan Content Policy: <https://supercell.com/en/fan-content-policy>.
