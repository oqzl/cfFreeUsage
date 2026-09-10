# cfFreeUsage

A small PWA that shows account-wide Cloudflare free-tier usage from Cloudflare Analytics.

Japanese: [README-ja.md](README-ja.md)

## Design

- Static PWA deployed with Cloudflare Workers Static Assets.
- Cloudflare self-managed OAuth using Authorization Code + PKCE (`S256`).
- No OAuth client secret in the app.
- Access and refresh tokens are kept **in JavaScript memory only**.
- Reloading, closing, or restarting the PWA signs the user out.
- Only PKCE `state` and `code_verifier` are temporarily stored in `sessionStorage` so the OAuth redirect can complete; they are deleted on callback.
- Cloudflare GraphQL Analytics is queried directly from the browser.
- Account-wide totals are compared with one free allowance per account.
- Daily quotas use the current UTC day (00:00 UTC reset), not a rolling 24-hour window.
- Missing/unsupported analytics are shown as `Unavailable`, never as zero.

GraphQL Analytics is operational telemetry. It is not a billing-canonical source, and some datasets may be sampled, delayed, plan-dependent, or unavailable.

## Current metrics

- Workers requests: 100,000/day
- Workers KV reads: 100,000/day
- Workers KV writes: 1,000/day
- Workers KV deletes: 1,000/day
- Workers KV lists: 1,000/day
- Workers KV storage: 1 GiB account total
- D1 rows read: 5,000,000/day
- D1 rows written: 100,000/day
- D1 storage: 5 GiB account total
- Queues billable operations: 10,000/day
- R2 request analytics: informational month-to-date total
- R2 storage: current snapshot compared with 10 GiB, explicitly marked as an estimate because the free allowance is GB-month

R2 Class A/Class B request quotas are intentionally not inferred from raw `actionType` values yet. The dashboard does not guess when it cannot provide a billing-equivalent classification.

## Cloudflare OAuth setup

Create a Cloudflare self-managed OAuth client:

1. Use Authorization Code grant.
2. Enable refresh tokens if available for the client.
3. Set token endpoint authentication method to `none`.
4. Require PKCE with `S256`.
5. Add the exact deployed PWA URL as a redirect URI.
6. Add the exact deployed origin to allowed CORS origins.
7. Grant these scopes:
   - `account-settings.read`
   - `account-analytics.read`
8. Copy the OAuth Client ID into `public/config.js`.

No client secret is required or supported by this browser-only architecture.

Cloudflare OAuth documentation:
https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/

## Local development

```sh
npm install
npm run dev
```

OAuth redirect URIs are exact. To test OAuth locally, add the local Wrangler URL to the OAuth client's redirect URIs and allowed CORS origins, or create a separate development OAuth client.

## Deploy

```sh
npm run deploy
```

`wrangler.jsonc` deploys only `./public` as static assets. The dashboard itself does not run a dynamic Worker for API requests.

## Security boundary

This project deliberately trades persistent login for a smaller credential persistence surface:

- OAuth tokens are never written to IndexedDB, `localStorage`, Cache Storage, cookies, or service-worker caches.
- The service worker caches only the static app shell.
- API and OAuth requests are never cached by the service worker.
- A strict Content Security Policy limits scripts to the same origin and connections to Cloudflare endpoints.

This does **not** make a browser token immune to XSS while the page is running. Same-origin JavaScript can access an in-memory token. Keep the deployment origin dedicated and avoid third-party scripts.

## Data-source notes

The implementation currently queries these Cloudflare GraphQL Analytics datasets where available:

- `workersInvocationsAdaptive`
- `kvOperationsAdaptiveGroups`
- `kvStorageAdaptiveGroups`
- `d1AnalyticsAdaptiveGroups`
- `d1StorageAdaptiveGroups`
- `queueMessageOperationsAdaptiveGroups`
- `r2OperationsAdaptiveGroups`
- `r2StorageAdaptiveGroups`

An unavailable dataset or GraphQL error is surfaced on the corresponding product card instead of being treated as zero usage.
