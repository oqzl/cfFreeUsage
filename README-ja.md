# cfFreeUsage

Cloudflare の Free tier 使用量をアカウント全体で確認するための小さな PWA です。

English: [README.md](README.md)

## リポジトリ構成

PWA の正本と Cloudflare Static Assets の配布 root はどちらも `web/` とします。

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

cache bust のためだけに配布 root を `public/`、`dist/`、`build/` 等へ変更しません。`wrangler.jsonc`、Cloudflare Builds、その他の deployment path は、プロジェクト要件として明示的に一括変更しない限り `web/` を静的配布 root として維持します。

## 構成

- Cloudflare Workers Static Assets で配信する静的 PWA
- Cloudflare self-managed OAuth の Authorization Code + PKCE (`S256`)
- OAuth Client Secret は使わない
- access token / refresh token は JavaScript のメモリだけに保持
- OAuth リダイレクトを跨ぐため PKCE state / code verifier だけを `sessionStorage` に一時保存
- Cloudflare GraphQL Analytics をブラウザから直接取得
- 日次 quota は UTC 00:00 起点
- 取得不可・権限不足は 0 ではなく `Unavailable` と表示

## Cloudflare OAuth 設定

Authorization Code + PKCE (`S256`)、token endpoint authentication method `none` を使い、scope は以下です。

- `account-settings.read`
- `account-analytics.read`

OAuth Client ID は `web/config.js` に設定します。Client Secret は使いません。

## Cloudflare Builds

production の cache identity は Git commit SHA に統一します。source 内の `__COMMIT_SHA__` を Cloudflare の build step で置換してから配布します。

Cloudflare 側の設定:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Static assets directory: web
```

`npm run build` は `WORKERS_CI_COMMIT_SHA` を優先し、asset URL、Service Worker registration URL、Service Worker cache 名、precache URL、manifest icon URL、画面下部の Build 表示へ同じ SHA を stamp します。

`wrangler.jsonc` も `./web` を直接参照します。`dist/` を deployment layer として挟みません。

## ローカル開発

```sh
npm install
npm run dev
```

OAuth の Redirect URI は完全一致です。ローカルで認証まで試す場合は Wrangler のローカル URL を OAuth client に追加するか、開発用 OAuth client を別に用意します。

## セキュリティ境界

OAuth token は IndexedDB、`localStorage`、Cache Storage、Cookie、Service Worker cache に保存しません。OAuth / Cloudflare API traffic は Service Worker で cache せず、CSP で script を same-origin、connect 先を Cloudflare endpoint に限定します。
