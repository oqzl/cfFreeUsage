# cfFreeUsage

Cloudflare の利用量をアカウント全体で確認するための小さな PWA です。

English: [README.md](README.md)

## 構成

- Cloudflare Workers Static Assets で `web/` をそのまま配信
- `src/worker.js` の same-origin relay から Cloudflare API を read-only で取得
- Cloudflare self-managed OAuth + Authorization Code + PKCE (`S256`)
- access token / refresh token は JavaScript メモリだけに保持
- Free / Workers Paid の quota view を切替可能
- GraphQL Analytics と REST API の値を account-wide に集計
- 取得不能な metric は `0` ではなく `Unavailable`
- 各サービス単位で表示を折りたたみ可能

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

PWA の正本と Cloudflare Static Assets の配布 root は `web/` です。`dist/`、`public/`、`build/` 等を cache bust のためだけに追加しません。

## 表示する指標

### Workers Free

- Workers requests: 100,000/day
- Workers AI: 10,000 Neurons/day
- AI Gateway persistent logs: 100,000/account
- AI Search: 20,000 queries/month、web crawl 500 pages/day
- Vectorize: queried vector dimensions 30M/month、stored vector dimensions 5M
- Hyperdrive: 100,000 database queries/day
- Durable Objects: 100,000 requests/day、SQLite storage 5 GiB
- Workflows: 3,000 steps/day
- Browser Run: browser duration 10 minutes/day
- Images: 5,000 unique transformations/month
- Workers KV reads: 100,000/day
- Workers KV writes/deletes/lists: 各 1,000/day
- Workers KV storage: 1 GiB
- D1 rows read: 5,000,000/day
- D1 rows written: 100,000/day
- D1 storage: 5 GiB
- Queues operations: 10,000/day
- Workers Builds: 3,000 build-minutes/month
- Pages builds: 当月の build 回数を表示し、Pages plan の上限は別記
- R2 requests / storage: month-to-date の operational estimate
- Realtime SFU egress / ingress: month-to-date の operational analytics

Free の日次 quota は UTC 00:00 で reset します。

### Workers Paid

Workers plan selector を `Paid` にすると、Workers/KV/D1/Queues を月次 included usage と比較します。

- Workers requests: 10,000,000/month included
- Workers AI: 10,000 Neurons/day free、その後従量課金
- Vectorize: queried vector dimensions 50M/month、stored vector dimensions 10M included
- Durable Objects: 1,000,000 requests/month included
- Workflows: 500,000 steps/month included
- Browser Run: 10 browser hours/month included
- Images: 最初の 5,000 unique transformations/month included
- Workers KV reads: 10,000,000/month included
- Workers KV writes/deletes/lists: 各 1,000,000/month included
- D1 rows read: 25 billion/month included
- D1 rows written: 50 million/month included
- Queues operations: 1,000,000/month included
- Workers Builds: 6,000 build-minutes/month included

Paid の実際の billing cycle は subscription renewal date に依存します。現行 UI は calendar month-to-date の operational analytics と included usage を比較するため、billing-canonical な残量ではありません。

R2 の free tier / overage は Workers plan と別に扱います。

Realtime SFU は GraphQL Analytics の `callsUsageAdaptiveGroups` から利用量を取得します。Cloudflare Realtime の egress 無料枠は SFU と TURN の合算で 1,000 GB/月です。TURN と SFU 間の traffic は二重課金されないため、cfFreeUsage では SFU の egress / ingress を表示し、SFU と TURN の telemetry を単純加算した誤った共通残量は表示しません。

Hyperdrive、Durable Objects、Workflows は、妥当な operational metric を account-wide に集計できる場合に GraphQL Analytics を使います。Workers AI、AI Gateway、AI Search、Vectorize、Browser Run、Images は、現行 OAuth dashboard から安定した account-wide usage endpoint を確認できないものについて、usage を 0 や推定値で埋めず published allowance だけを表示します。信頼できる source が追加されるまでは `— / allowance` 表示です。

## デプロイ系 metric

Workers Builds と Pages の metric は GraphQL ではなく Cloudflare REST API を使います。

最初の Cloudflare ログインで dashboard に必要な scope をすべて要求します。

- `account-settings.read`
- `account-analytics.read`
- `page.read`
- `workers-ci.read`
- `workers-scripts.read`

Cloudflare の OAuth client 側にも、この5つの scope を設定してください。deployment metric 用の追加認証操作はありません。

Workers Builds は各 build の timestamp から `running_on`〜`stopped_on` を集計して build minutes を推定します。Cloudflare の請求値そのものではありません。

Pages は当月の deployment のうち `github:push` / `deploy_hook` かつ skipped でないものを build として数えます。Direct Upload (`ad_hoc`) は含めません。Pages の plan は Workers Paid と別系統で、Free 500 / Pro 5,000 / Business 20,000 builds per month です。

## OAuth

Cloudflare で self-managed OAuth client を作成します。

1. Authorization Code grant
2. token endpoint authentication method: `none`
3. PKCE: `S256`
4. production PWA URL を Redirect URI に登録
5. production origin を Allowed CORS Origins に登録
6. scopes:
   - `account-settings.read`
   - `account-analytics.read`
   - `page.read`
   - `workers-ci.read`
   - `workers-scripts.read`
7. Client ID を `web/config.js` に設定

Client Secret は使いません。

## セキュリティ境界

- OAuth token を IndexedDB、`localStorage`、Cache Storage、Cookie、Service Worker cache に保存しない
- bearer token は自分の Worker を通るが永続化しない
- relay は固定 allowlist の Cloudflare endpoint だけを中継
- relay response は `Cache-Control: no-store`
- Service Worker は `/api/` を cache しない
- third-party script を置かない

メモリ保存は XSS から token を守るものではありません。同一 origin の JavaScript からは実行中 token にアクセスできます。

## Cloudflare Builds

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Static assets directory: web
```

`npm run build` は `WORKERS_CI_COMMIT_SHA` を優先して `__COMMIT_SHA__` を stamp します。asset URL、ES module import、Service Worker registration、cache name、precache URL、manifest icon URL、画面下部の Build 表示を同じ SHA に揃えます。

`wrangler.jsonc` は `./web` を直接参照し、`/api/*` だけを `src/worker.js` に通します。

## ローカル開発

```sh
npm install
npm run dev
```

GraphQL Analytics と REST-derived usage は operational telemetry です。請求の正本は Cloudflare Billing / invoice とします。
