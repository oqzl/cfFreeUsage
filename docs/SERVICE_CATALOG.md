# Service catalog

`web/catalog/data.js` is the source of truth for the static Cloudflare feature catalog shown at `/catalog.html`.

Each catalog item keeps these facts separate:

- `available_on_free`: whether the product or feature is usable on the Free plan now.
- `free_quota`: the published Free allowance or a short availability description.
- `payg_price`: self-service / pay-as-you-go pricing when a single useful summary is available.
- `enterprise_only`: whether the item still requires Enterprise access now.

The four fields must not be inferred from one another. A feature can have published Free-looking quota text while current availability documentation says Paid-only, or it can be self-service PAYG without being available on Free.

`CATALOG_SOURCE_CHECKS` contains official Cloudflare source pages and stable assertions used by `npm run check:catalog`. The weekly GitHub Actions workflow fetches those official pages at low frequency. It fails when a source no longer contains an assertion used by the catalog. The checker does not automatically rewrite prices or quotas.

Known source conflicts stay explicit in the catalog instead of being silently resolved. As of 2026-10-05, Vectorize is marked `source-conflict` because the product-specific pricing page describes a Workers Free allowance while the Workers aggregate pricing page updated on 2026-10-02 says Vectorize is currently available only on Workers Paid.
