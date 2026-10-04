import {
  CATALOG_LAST_REVIEWED,
  CATALOG_SOURCE_CHECKS,
  SERVICE_CATALOG
} from "../web/catalog/data.js";

validateCatalog();

let failed = false;
for (const source of CATALOG_SOURCE_CHECKS) {
  try {
    const response = await fetch(source.check_url, {
      headers: { "User-Agent": "cfFreeUsage-catalog-check/1.0" },
      redirect: "follow"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = normalize(await response.text());
    const missing = source.assertions.filter(assertion => !text.includes(normalize(assertion)));
    if (missing.length) {
      failed = true;
      console.error(`\n[${source.id}] source changed: ${source.source_url}`);
      for (const assertion of missing) console.error(`  missing: ${assertion}`);
    } else {
      console.log(`[ok] ${source.id}`);
    }
  } catch (error) {
    failed = true;
    console.error(`\n[${source.id}] could not verify ${source.source_url}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) {
  console.error(`\nCatalog review date: ${CATALOG_LAST_REVIEWED}`);
  console.error("One or more official-source assertions no longer match. Review the affected catalog entries before updating assertions.");
  process.exitCode = 1;
} else {
  console.log(`\n${SERVICE_CATALOG.length} catalog entries checked against ${CATALOG_SOURCE_CHECKS.length} official source groups.`);
}

function validateCatalog() {
  const sourceIds = new Set(CATALOG_SOURCE_CHECKS.map(source => source.id));
  const seen = new Set();

  for (const item of SERVICE_CATALOG) {
    if (!item.id || seen.has(item.id)) throw new Error(`Duplicate or missing catalog id: ${item.id}`);
    seen.add(item.id);

    for (const field of ["available_on_free", "enterprise_only"]) {
      if (typeof item[field] !== "boolean") throw new Error(`${item.id}.${field} must be boolean`);
    }
    for (const field of ["free_quota", "payg_price"]) {
      if (item[field] !== null && typeof item[field] !== "string") {
        throw new Error(`${item.id}.${field} must be string or null`);
      }
    }
    if (!Array.isArray(item.source_ids) || item.source_ids.length === 0) {
      throw new Error(`${item.id}.source_ids must not be empty`);
    }
    for (const sourceId of item.source_ids) {
      if (!sourceIds.has(sourceId)) throw new Error(`${item.id} references unknown source ${sourceId}`);
    }
    if (item.available_on_free && item.enterprise_only) {
      throw new Error(`${item.id} cannot be both available_on_free and enterprise_only`);
    }
  }
}

function normalize(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}
