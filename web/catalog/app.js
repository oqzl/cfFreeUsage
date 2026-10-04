import {
  CATALOG_LAST_REVIEWED,
  SERVICE_CATALOG,
  sourceById
} from "./data.js?v=__COMMIT_SHA__";

const els = {
  filter: document.querySelector("#catalog-filter"),
  search: document.querySelector("#catalog-search"),
  count: document.querySelector("#catalog-count"),
  list: document.querySelector("#catalog-list")
};

els.filter.addEventListener("change", render);
els.search.addEventListener("input", render);
render();

function render() {
  const filter = els.filter.value;
  const query = els.search.value.trim().toLocaleLowerCase();

  const rows = SERVICE_CATALOG.filter(item => {
    if (filter === "free" && !item.available_on_free) return false;
    if (filter === "payg-only" && (item.available_on_free || item.enterprise_only)) return false;
    if (filter === "enterprise" && !item.enterprise_only) return false;
    if (filter === "review" && !["source-conflict", "transition"].includes(item.status)) return false;

    if (!query) return true;
    return [
      item.name,
      item.category,
      item.free_quota,
      item.payg_price,
      item.note,
      item.status
    ].filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(query));
  });

  els.count.textContent = `${rows.length} / ${SERVICE_CATALOG.length} · reviewed ${CATALOG_LAST_REVIEWED}`;
  els.list.replaceChildren(...rows.map(renderRow));
}

function renderRow(item) {
  const article = document.createElement("article");
  article.className = `catalog-card status-${item.status}`;

  const sources = item.source_ids
    .map(sourceById)
    .filter(Boolean)
    .map(source => `<code>${escapeHtml(source.source_url)}</code>`)
    .join("");

  article.innerHTML = `
    <header class="catalog-head">
      <div>
        <p class="catalog-category">${escapeHtml(item.category)}</p>
        <h2>${escapeHtml(item.name)}</h2>
      </div>
      <div class="catalog-badges">
        <span class="catalog-badge">${item.available_on_free ? "FREE" : "NO FREE"}</span>
        <span class="catalog-badge">${item.enterprise_only ? "ENTERPRISE ONLY" : "SELF-SERVE"}</span>
        ${item.status === "verified" ? "" : `<span class="catalog-badge">${escapeHtml(item.status.toUpperCase())}</span>`}
      </div>
    </header>
    <dl class="catalog-facts">
      <div><dt>available_on_free</dt><dd>${item.available_on_free ? "true" : "false"}</dd></div>
      <div><dt>free_quota</dt><dd>${escapeHtml(item.free_quota ?? "—")}</dd></div>
      <div><dt>payg_price</dt><dd>${escapeHtml(item.payg_price ?? "—")}</dd></div>
      <div><dt>enterprise_only</dt><dd>${item.enterprise_only ? "true" : "false"}</dd></div>
    </dl>
    ${item.note ? `<p class="catalog-note">${escapeHtml(item.note)}</p>` : ""}
    <details class="catalog-sources">
      <summary>Official sources</summary>
      ${sources}
    </details>
  `;
  return article;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
