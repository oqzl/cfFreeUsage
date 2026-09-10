# cfFreeUsage

A small PWA that shows account-wide Cloudflare free-tier usage from Cloudflare Analytics.

Japanese: [README-ja.md](README-ja.md)

## Repository layout

The PWA source and Cloudflare Static Assets root are both `web/`.

```text
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

Do not move the deploy root to `public/`, `dist/`, `build/`, or another generated directory just to implement cache busting. `wrangler.jsonc`, Cloudflare Builds, and any other deployment path must all keep `web/` as the static asset root unless the repository requirements are deliberately changed together.

## Design

- Static PWA deployed with Cloudflare Workers Static Assets.
- Cloudflare self-managed OAuth using Authorization Code + PKCE (`S256`).
- No OAuth client secret in the app.
- Access and refresh tokens are kept in JavaScript memory only.
- Only PKCE state and code verifier are temporarily stored in `sessionStorage` across the OAuth redirect.
- Cloudflare GraphQL Analytics is queried directly from the browser.
- Daily quotas use the current UTC day.
- Missing/unsupported analytics are shown as `Unavailable`, never as zero.

## Cloudflare OAuth setup

Use Authorization Code + PKCE (`S256`), token endpoint authentication method `none`, and scopes:

- `account-settings.read`
- `account-analytics.read`

Set the OAuth Client ID in `web/config.js`. No client secret is used.

## Cloudflare Builds

Production cache identity is derived from the Git commit SHA. Source files contain `__COMMIT_SHA__`; the Cloudflare build step replaces it before deployment.

Cloudflare configuration:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Static assets directory: web
```

`npm run build` stamps the current `WORKERS_CI_COMMIT_SHA` (falling back to other CI/git SHA values) into asset URLs, Service Worker registration, Service Worker cache name, precache URLs, manifest icon URL, and the visible build label.

`wrangler.jsonc` also points directly to `./web`. There is no `dist/` deployment layer.

## Local development

```sh
npm install
npm run dev
```

OAuth redirect URIs are exact. To test OAuth locally, add the local Wrangler URL to the OAuth client or use a separate development OAuth client.

## Security boundary

OAuth tokens are never written to IndexedDB, `localStorage`, Cache Storage, cookies, or Service Worker caches. API and OAuth traffic is never cached by the Service Worker, and CSP restricts scripts to same-origin and connections to Cloudflare endpoints.
