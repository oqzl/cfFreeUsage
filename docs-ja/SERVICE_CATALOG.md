# Service catalog

`web/catalog/data.js` を `/catalog.html` に表示する Cloudflare feature catalog の正本とする

各 item では次の事実を分離して持つ

- `available_on_free`: 現時点で Free plan から機能を利用できるか
- `free_quota`: 公開されている Free allowance、または短い利用条件
- `payg_price`: self-service / pay-as-you-go の価格を一つの要約にできる場合の価格情報
- `enterprise_only`: 現時点でも Enterprise access が必要か

4つの field を相互に推定しない。Free quota に見える値が公開されていても current availability が Paid-only と書かれている場合があり、反対に PAYG で self-service 利用できても Free では利用できない場合がある

`CATALOG_SOURCE_CHECKS` に Cloudflare 公式 source と、catalog が依存している stable assertion を置く。`npm run check:catalog` と weekly GitHub Actions が低頻度で公式 source を取得し、assertion が消えた場合に fail する。価格や quota を自動更新はしない

公式文書同士の矛盾は catalog から隠さない。2026-10-05 時点では Vectorize の product-specific pricing は Workers Free allowance を記載する一方、2026-10-02 更新の Workers aggregate pricing は Workers Paid only と記載しているため、`source-conflict` として保持する
