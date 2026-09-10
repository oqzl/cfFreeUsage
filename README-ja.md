# cfFreeUsage

Cloudflare の Free tier 使用量をアカウント全体で確認するための小さな PWA です。

English: [README.md](README.md)

## 構成

- Cloudflare Workers Static Assets で配信する静的 PWA
- Cloudflare self-managed OAuth の Authorization Code + PKCE (`S256`)
- OAuth Client Secret はアプリに持たない
- access token / refresh token は **JavaScript のメモリだけ**に保持
- 再読み込み、PWA の終了・再起動でログイン状態は消える
- OAuth リダイレクトを跨ぐため、PKCE の `state` と `code_verifier` だけを `sessionStorage` に一時保存し、callback 処理直後に削除
- Cloudflare GraphQL Analytics をブラウザから直接取得
- リソースごとの値をアカウント全体で合計してから、Free allowance を1回だけ適用
- 日次上限は rolling 24 hours ではなく UTC 00:00 起点
- データセット未提供・権限不足・取得エラーは 0 ではなく `Unavailable` と表示

GraphQL Analytics は運用監視用のテレメトリであり、請求の正本ではありません。データセットによって sampling、遅延、プラン差、利用不可があり得ます。

## 現在表示する指標

- Workers requests: 100,000/day
- Workers KV reads: 100,000/day
- Workers KV writes: 1,000/day
- Workers KV deletes: 1,000/day
- Workers KV lists: 1,000/day
- Workers KV storage: 1 GiB / account
- D1 rows read: 5,000,000/day
- D1 rows written: 100,000/day
- D1 storage: 5 GiB / account
- Queues billable operations: 10,000/day
- R2 requests: 月初からの Analytics 総数を参考値として表示
- R2 storage: 現在スナップショットを 10 GiB と比較。ただし Free allowance は GB-month なので `estimate` 扱い

R2 の Class A / Class B は raw `actionType` から推測していません。課金と同等の分類を保証できないものは、無理に Free quota の残量へ変換しない方針です。

## Cloudflare OAuth 設定

Cloudflare で self-managed OAuth client を作成します。

1. Authorization Code grant を使用
2. 利用可能なら refresh token を有効化
3. token endpoint authentication method は `none`
4. PKCE `S256` を使用
5. デプロイ先 PWA の正確な URL を Redirect URI に登録
6. デプロイ先 origin を Allowed CORS Origins に登録
7. scope に以下を追加
   - `account-settings.read`
   - `account-analytics.read`
8. 発行された OAuth Client ID を `public/config.js` に設定

ブラウザだけで完結する構成なので Client Secret は使いません。

Cloudflare OAuth documentation:
https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/

## ローカル開発

```sh
npm install
npm run dev
```

OAuth の Redirect URI は完全一致です。ローカルで認証まで試す場合は Wrangler のローカル URL を OAuth client の Redirect URI / Allowed CORS Origins に追加するか、開発用 OAuth client を別に作成してください。

## デプロイ

```sh
npm run deploy
```

`wrangler.jsonc` は `./public` を Static Assets として配信します。Cloudflare API の取得処理のための dynamic Worker は置きません。

## セキュリティ境界

ログイン永続化を捨てて、credential の永続化面を小さくしています。

- OAuth token を IndexedDB、`localStorage`、Cache Storage、Cookie、Service Worker cache に保存しない
- Service Worker は静的 app shell だけを cache
- OAuth / Cloudflare API リクエストは Service Worker の cache 対象外
- CSP で script を same-origin のみに制限し、接続先を Cloudflare endpoint に限定

ただし、ページ実行中の XSS に対してメモリ上の token が安全になるわけではありません。同一 origin の JavaScript からは token にアクセスできます。第三者 script を置かず、この PWA 専用 origin として運用する前提です。

## 利用データセット

利用可能な場合、以下の GraphQL Analytics dataset を取得します。

- `workersInvocationsAdaptive`
- `kvOperationsAdaptiveGroups`
- `kvStorageAdaptiveGroups`
- `d1AnalyticsAdaptiveGroups`
- `d1StorageAdaptiveGroups`
- `queueMessageOperationsAdaptiveGroups`
- `r2OperationsAdaptiveGroups`
- `r2StorageAdaptiveGroups`

取得できない dataset は 0 と見なさず、その product card を `Unavailable` として表示します。
