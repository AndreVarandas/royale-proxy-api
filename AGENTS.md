# AGENTS.md

## Commands

- Node ≥ 26 (`.nvmrc`); `.npmrc` sets `engine-strict=true` — npm install fails on older Node.
- Verify in CI order: `npm run audit` (fails on high/critical) → `npm run lint` → `npm run format:check` → `npm run typecheck` → `npm run build` → `npm test`.
- Single test file: `npm test -- tests/app.test.ts`. Single test by name: `npm test -- -t "pattern"`.
- Dev: `npm run dev` (tsx watch, port 3002). Prod: `npm run build` then `npm start`. `dist/` is gitignored build output.

## Architecture

- Hono proxy for the Clash Royale API. `createApp(config)` (src/app.ts) is separate from the entrypoint (src/index.ts) so tests exercise the full middleware stack in-process via `app.request()`. Middleware order is deliberate: request log → security headers → CORS → body limit → rate limit → optional bearer auth → response cache → routes.
- All config goes through the zod schema in src/env.ts (fail-fast at startup). New knobs: add to `envSchema` + `.env.example` + the README config table. `loadConfig(env)` accepts an explicit string record (tests use this; zod coerces types). Real env vars win over `.env` (Node built-in `process.loadEnvFile`).
- The upstream wrapper `@varandas/clash-royale-api` keeps axios defaults in module-level state: exactly ONE client per process (src/lib/api-client.ts). Never create a second client with a different token/URL.
- Every upstream call must go through `callUpstream(fn, timeoutMs)` — the wrapper's axios has no timeout of its own.
- Errors: throw `HTTPException`; `toHttpException` (src/lib/errors.ts) normalizes everything else. Never dump upstream error bodies verbatim — only `message`/`reason` fields are surfaced.
- Validation: zod schemas in src/lib/validation.ts via `parseQuery`/`parseParam` (malformed → 400, unknown query params stripped). Tag endpoints use `addTagRoute` (src/lib/route-helpers.ts); tags normalize to uppercase without `#`, then `#` is re-prefixed for upstream.
- Observability is dependency-free: JSON request logs via `createLogger` (console.log/error under the hood, so tests spy on them) and opt-in Prometheus counters at `/metrics` (`METRICS_ENABLED`, bearer-gated when `PROXY_AUTH_TOKEN` is set). Never log tokens, Authorization headers, or query strings; caller IPs follow `LOG_IP_MODE` (default: hash).
- ESM + NodeNext: relative imports need explicit `.js` extensions even in TS; `verbatimModuleSyntax` requires `import type` for type-only imports. Strict TS incl. `noUncheckedIndexedAccess`. Target/lib is ES2022 — no ES2023 array methods (e.g. `findLast`).
- App version comes from package.json via src/version.ts — don't hardcode it.

## Tests

- No API key or network needed. app.test.ts and observability.test.ts mock the wrapper (`vi.hoisted` + `vi.mock`); `beforeEach` resets mocks and silences `console.log`/`console.error` — assert on the spies, not stdout.
- e2e.test.ts uses the REAL wrapper/axios over real HTTP against a stub upstream on an ephemeral port (proves CJS/ESM interop). Test config: `UPSTREAM_BASE_URL` → stub, `CACHE_TTL_MS=0`, high `RATE_LIMIT_MAX`.
- In-process `app.request()` has no socket → all requests share rate-limit key `"unknown"`. Keep `RATE_LIMIT_MAX` high in test configs unless testing the limiter itself.
- `tests/*.requests.http` are manual examples; vitest only runs `tests/**/*.test.ts`.

## Deployment gotchas

- pm2 must stay single-instance fork mode — rate limiting, caching, and metrics are in-memory; cluster mode silently breaks them (ecosystem.config.cjs).
- Requires a stable egress IP whitelisted for the Supercell key; serverless/edge platforms won't work.
- `TRUST_PROXY=true` only behind a trusted reverse proxy; otherwise clients can spoof `X-Forwarded-For` to evade rate limits (and poison log IPs).

## Style & constraints

- Lean by design (~400 lines, minimal audited deps): prefer Node built-ins over new dependencies; CI gates on `npm audit --audit-level=high`.
- Security-first: never log tokens or Authorization headers; keep error responses normalized.
- Prettier: 100 cols, double quotes, trailing commas, LF. ESLint is type-checked; prefix intentionally unused vars/args with `_`.
