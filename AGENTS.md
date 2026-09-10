# cfFreeUsage project rules

This repository follows the PWA repository/deployment conventions in `oqzl/KnowledgeBase`.

## PWA source root

- The canonical PWA source directory is `web/`.
- Cloudflare Static Assets must deploy `web/` directly.
- Do not introduce `public/`, `dist/`, `build/`, or another deployment root only for cache busting, asset stamping, packaging, or convenience.
- Do not change the deployment root without changing and verifying every deployment path and its external Cloudflare configuration in the same task.

## Deployment identity

- All cache-busting URLs, Service Worker registration URLs, Service Worker cache names, precache URLs, manifest/icon URLs, and visible build identity must use the same Git commit SHA.
- Cloudflare Workers Builds must run `npm run build` before `npx wrangler deploy` so `__COMMIT_SHA__` is stamped in the ephemeral checkout.
- `wrangler.jsonc` must continue to point `assets.directory` at `./web`.
- Do not solve SHA stamping by changing the deploy root.

## Change checklist

When changing PWA layout, build, cache, Service Worker, or deployment configuration, verify all of the following together:

1. repository source root
2. `wrangler.jsonc`
3. Cloudflare Build command
4. Cloudflare Deploy command
5. Cloudflare static assets directory
6. Service Worker cache/precache identity
7. production asset URLs after deployment

A source-code-only change is not considered deployment-safe until these stay consistent.
