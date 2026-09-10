# cfFreeUsage

A small PWA for viewing account-wide Cloudflare usage against plan allowances.

Japanese: [README-ja.md](README-ja.md)

## Design

- `web/` is served directly with Cloudflare Workers Static Assets.
- `src/worker.js` is a narrow same-origin read-only relay for Cloudflare APIs.
- Cloudflare self-managed OAuth with Authorization Code + PKCE (`S256`).
- Access and refresh tokens are kept in JavaScript memory only.
- The dashboard can switch between Workers Free and Workers Paid quota views.
- GraphQL Analytics and selected REST APIs are aggregated account-wide.
- Missing metrics are shown as `Unavailable`, never as zero.

```text
src/
  worker.js
web/
  index.html
  app.js
  auth.js
  usage.js
  config.js
  style.css
  manifest.webmanifest
  sw.js
  icon.svg
  _headers
```

The canonical PWA source and Static Assets root are both `web/`. Do not introduce `dist/`, `public/`, or `build/` only for cache busting.

## Metrics

### Workers Free

- Workers requests: 100,000/day
- Workers KV reads: 100,000/day
- Workers KV writes/deletes/lists: 1,000/day each
- Workers KV storage: 1 GiB
- D1 rows read: 5,000,000/day
- D1 rows written: 100,000/day
- D1 storage: 5 GiB
- Queues operations: 10,000/day
- Workers Builds: 3,000 build-minutes/month
- Pages builds: current month count; Pages plan limits are shown separately
- R2 requests/storage: month-to-date operational estimates

Free daily quotas reset at 00:00 UTC.

### Workers Paid

Selecting `Paid` changes Workers/KV/D1/Queues to monthly included usage:

- Workers requests: 10,000,000/month included
- Workers KV reads: 10,000,000/month included
- Workers KV writes/deletes/lists: 1,000,000/month included each
- D1 rows read: 25 billion/month included
- D1 rows written: 50 million/month included
- Queues operations: 1,000,000/month included
- Workers Builds: 6,000 build-minutes/month included

The actual paid billing cycle follows the subscription renewal date. The UI currently compares calendar month-to-date operational analytics with the monthly included amounts, so it is not a billing-canonical remaining balance.

R2 free tier and overage are treated separately from the Workers plan.

## Deployment metrics

Workers Builds and Pages metrics use Cloudflare REST APIs rather than GraphQL.

Normal sign-in still requests only these base scopes:

- `account-settings.read`
- `account-analytics.read`

Add these as optional scopes to the Cloudflare OAuth client:

- `page.read`
- `workers-ci.read`
- `workers-scripts.read`

After that, use `Enable deploy metrics` in the PWA to re-authorize with the additional scopes. The normal dashboard remains usable before those optional scopes are configured.

Workers build minutes are estimated from build timestamps (`running_on` through `stopped_on`), so they are not Cloudflare's canonical billed usage.

Pages counts non-skipped `github:push` and `deploy_hook` deployments in the current calendar month. Direct Upload (`ad_hoc`) deployments are excluded. Pages plans are separate from Workers Paid: Free 500 / Pro 5,000 / Business 20,000 builds per month.

## OAuth setup

Create a Cloudflare self-managed OAuth client:

1. Authorization Code grant.
2. Token endpoint authentication method: `none`.
3. PKCE: `S256`.
4. Add the production PWA URL as a Redirect URI.
5. Add the production origin to Allowed CORS Origins.
6. Base scopes:
   - `account-settings.read`
   - `account-analytics.read`
7. Optional deployment scopes:
   - `page.read`
   - `workers-ci.read`
   - `workers-scripts.read`
8. Put the Client ID in `web/config.js`.

No client secret is used.

## Security boundary

- OAuth tokens are never persisted to IndexedDB, `localStorage`, Cache Storage, cookies, or service-worker caches.
- The bearer token passes through the app's own Worker but is not persisted.
- The relay forwards only fixed allowlisted Cloudflare API operations.
- Relay responses use `Cache-Control: no-store`.
- The service worker bypasses `/api/`.
- Avoid third-party scripts on this origin.

Memory-only storage does not protect an in-memory token from same-origin XSS.

## Cloudflare Builds

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Static assets directory: web
```

`npm run build` stamps `__COMMIT_SHA__`, preferring `WORKERS_CI_COMMIT_SHA`, so asset URLs, module imports, Service Worker registration/cache identity, manifest icon URLs, and the visible build label use the same commit identity.

`wrangler.jsonc` points directly to `./web` and runs `src/worker.js` first only for `/api/*`.

## Local development

```sh
npm install
npm run dev
```

GraphQL Analytics and REST-derived usage are operational telemetry. Cloudflare Billing and invoices remain the billing source of truth.
