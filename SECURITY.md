# Security Policy

## Supported versions

| Version | Supported                                                 |
| ------- | --------------------------------------------------------- |
| 2.x     | ✅ Yes                                                    |
| 1.x     | ❌ No — the Nuxt-based v1 is superseded by the v2 rewrite |

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting:

<https://github.com/AndreVarandas/royale-proxy-api/security/advisories/new>

Include the affected version/commit, reproduction steps or a proof of concept, and
the impact you see. You'll receive an acknowledgment as soon as possible; confirmed
issues are fixed in patch releases and disclosed via a GitHub security advisory
(with credit, unless you prefer otherwise).

## Deployment notes for self-hosters

- Every caller spends your Supercell key's quota. Keep the per-IP rate limiter and
  response cache enabled (the defaults), and set `PROXY_AUTH_TOKEN` for private use.
- `TRUST_PROXY=true` is only safe behind a trusted reverse proxy — otherwise clients
  can spoof `X-Forwarded-For` to evade rate limits.
- Keep `CLASH_ROYALE_API_TOKEN` secret (never commit `.env`) and your server's
  egress IP whitelisted on the developer portal.
