export const CATALOG_LAST_REVIEWED = "2026-10-05";

export const CATALOG_SOURCE_CHECKS = [
  {
    id: "enterprise-for-all",
    source_url: "https://blog.cloudflare.com/enterprise-for-all-update/",
    check_url: "https://blog.cloudflare.com/enterprise-for-all-update/",
    assertions: [
      "Every generally available (GA) feature we launched this week",
      "most are available on the free tier",
      "introducing no new Enterprise-only features",
      "Logpush and Logpush Transformers now available to all plans"
    ]
  },
  {
    id: "workers-pricing",
    source_url: "https://developers.cloudflare.com/workers/platform/pricing/",
    check_url: "https://developers.cloudflare.com/workers/platform/pricing/index.md",
    assertions: [
      "100,000 per day",
      "$0.30 per additional million",
      "100,000 / day",
      "10,000 operations/day included",
      "5 million / day",
      "3,000 per day",
      "Vectorize is currently only available on the Workers paid plan",
      "10 GB-month / month"
    ]
  },
  {
    id: "workers-ai-pricing",
    source_url: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
    check_url: "https://developers.cloudflare.com/workers-ai/platform/pricing/index.md",
    assertions: [
      "10,000 Neurons per day",
      "$0.011 / 1,000 Neurons"
    ]
  },
  {
    id: "ai-gateway-pricing",
    source_url: "https://developers.cloudflare.com/ai-gateway/reference/pricing/",
    check_url: "https://developers.cloudflare.com/ai-gateway/reference/pricing/index.md",
    assertions: [
      "AI Gateway is available to use on all plans",
      "100,000 logs total across all gateways"
    ]
  },
  {
    id: "ai-gateway-limits",
    source_url: "https://developers.cloudflare.com/ai-gateway/reference/limits/",
    check_url: "https://developers.cloudflare.com/ai-gateway/reference/limits/index.md",
    assertions: [
      "New AI Gateway customers",
      "Customers who create their first gateway on or after September 24, 2026",
      "Logs stored, free plan"
    ]
  },
  {
    id: "ai-search-pricing",
    source_url: "https://developers.cloudflare.com/ai-search/platform/limits-pricing/",
    check_url: "https://developers.cloudflare.com/ai-search/platform/limits-pricing/index.md",
    assertions: [
      "5 million ingestion tokens",
      "1,000 semantic queries",
      "1,000 full-text queries",
      "$0.75 per 1,000 queries",
      "500"
    ]
  },
  {
    id: "vectorize-pricing",
    source_url: "https://developers.cloudflare.com/vectorize/platform/pricing/",
    check_url: "https://developers.cloudflare.com/vectorize/platform/pricing/index.md",
    assertions: [
      "30 million queried vector dimensions / month",
      "5 million stored vector dimensions",
      "$0.01 per million",
      "Workers free tier"
    ]
  },
  {
    id: "browser-run-pricing",
    source_url: "https://developers.cloudflare.com/browser-run/pricing/",
    check_url: "https://developers.cloudflare.com/browser-run/pricing/index.md",
    assertions: [
      "10 minutes per day",
      "$0.09 per additional hour"
    ]
  },
  {
    id: "images-pricing",
    source_url: "https://developers.cloudflare.com/images/pricing/",
    check_url: "https://developers.cloudflare.com/images/pricing/index.md",
    assertions: [
      "5,000 unique transformations",
      "$0.50 / 1,000 unique transformations"
    ]
  },
  {
    id: "workers-builds-pricing",
    source_url: "https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/",
    check_url: "https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/index.md",
    assertions: [
      "3,000 per month",
      "6,000 per month",
      "$0.005 per minute"
    ]
  },
  {
    id: "pages-limits",
    source_url: "https://developers.cloudflare.com/pages/platform/limits/",
    check_url: "https://developers.cloudflare.com/pages/platform/limits/index.md",
    assertions: [
      "Builds per month",
      "500",
      "5,000",
      "20,000"
    ]
  },
  {
    id: "realtime-pricing",
    source_url: "https://developers.cloudflare.com/realtime/sfu/platform/pricing/",
    check_url: "https://developers.cloudflare.com/realtime/sfu/platform/pricing/index.md",
    assertions: [
      "$0.05 per GB",
      "first 1,000 GB each month is free"
    ]
  },
  {
    id: "dynamic-workers-pricing",
    source_url: "https://developers.cloudflare.com/dynamic-workers/pricing/",
    check_url: "https://developers.cloudflare.com/dynamic-workers/pricing/index.md",
    assertions: [
      "Dynamic Workers are currently only available on the",
      "$0.002 per Dynamic Worker per day"
    ]
  }
];

export const SERVICE_CATALOG = [
  {
    id: "workers",
    name: "Workers",
    category: "Compute",
    available_on_free: true,
    free_quota: "100,000 requests/day; 10 ms CPU per invocation",
    payg_price: "$5/month minimum; 10M requests/month included, then $0.30/M; 30M CPU-ms included, then $0.02/M CPU-ms",
    enterprise_only: false,
    status: "verified",
    note: "Static asset requests are free and unlimited; Workers Paid uses the Standard usage model.",
    source_ids: ["workers-pricing"]
  },
  {
    id: "workers-logs",
    name: "Workers Logs",
    category: "Observability",
    available_on_free: true,
    free_quota: "200,000 log events/day; 3-day retention",
    payg_price: "20M events/month included, then $0.60/M through 2026-11-30; pricing changes 2026-12-01",
    enterprise_only: false,
    status: "transition",
    note: "Cloudflare has announced a pricing transition to Cloudflare Observability on 2026-12-01.",
    source_ids: ["workers-pricing"]
  },
  {
    id: "workers-ai",
    name: "Workers AI",
    category: "AI",
    available_on_free: true,
    free_quota: "10,000 Neurons/day; some resource-intensive models require Workers Paid",
    payg_price: "$0.011 / 1,000 Neurons above the free allocation on Workers Paid",
    enterprise_only: false,
    status: "verified",
    note: "Model-level availability can be narrower than product-level availability.",
    source_ids: ["workers-ai-pricing"]
  },
  {
    id: "ai-gateway",
    name: "AI Gateway",
    category: "AI",
    available_on_free: true,
    free_quota: "Core features are free. Log limits depend on gateway creation date; legacy Free is 100,000 stored logs/account.",
    payg_price: "Core gateway features are free; provider/model usage and current Workers Logs rules apply separately.",
    enterprise_only: false,
    status: "transition",
    note: "New customers creating their first gateway on/after 2026-09-24 follow Workers Logs limits/pricing instead of legacy log storage limits.",
    source_ids: ["ai-gateway-pricing", "ai-gateway-limits", "workers-pricing"]
  },
  {
    id: "ai-search",
    name: "AI Search",
    category: "AI",
    available_on_free: true,
    free_quota: "5M ingestion tokens/month; 10 GB-month storage; 1,000 semantic + 1,000 full-text queries/month; 500 crawled pages/day on Free",
    payg_price: "Billing starts 2026-11-01: ingestion $0.75/M tokens; storage $2/GB-month; semantic/vector/hybrid $0.75/1,000; full-text $0.10/1,000",
    enterprise_only: false,
    status: "transition",
    note: "GA pricing replaced the earlier 20,000-queries/month Free limit. Usage-based billing begins 2026-11-01.",
    source_ids: ["ai-search-pricing"]
  },
  {
    id: "vectorize",
    name: "Vectorize",
    category: "AI / Storage",
    available_on_free: true,
    free_quota: "30M queried vector dimensions/month; 5M stored vector dimensions",
    payg_price: "Workers Paid includes 50M queried + 10M stored dimensions; then $0.01/M queried and $0.05/100M stored",
    enterprise_only: false,
    status: "source-conflict",
    note: "The Vectorize-specific pricing page and changelog support Free-tier use, while the Workers aggregate pricing page updated 2026-10-02 says Vectorize is currently Workers Paid only. Treat Free availability as needing re-verification if either page changes.",
    source_ids: ["vectorize-pricing", "workers-pricing"]
  },
  {
    id: "hyperdrive",
    name: "Hyperdrive",
    category: "Database",
    available_on_free: true,
    free_quota: "100,000 database queries/day",
    payg_price: "Unlimited database queries on Workers Paid; Workers Paid minimum is $5/month",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["workers-pricing"]
  },
  {
    id: "durable-objects",
    name: "Durable Objects",
    category: "Compute / Storage",
    available_on_free: true,
    free_quota: "SQLite-backed DOs only; 100,000 requests/day; 13,000 GB-s/day; SQLite rows/storage have Free limits",
    payg_price: "1M requests/month included, then $0.15/M; 400,000 GB-s/month included, then $12.50/M GB-s; storage billed separately",
    enterprise_only: false,
    status: "verified",
    note: "KV-backed namespaces are not available for new Free usage.",
    source_ids: ["workers-pricing"]
  },
  {
    id: "workflows",
    name: "Workflows",
    category: "Compute",
    available_on_free: true,
    free_quota: "3,000 steps/day; Workers request/CPU Limits also apply; 1 GB-month storage",
    payg_price: "500,000 steps/month included, then $0.80/100,000; storage 1 GB-month included, then $0.20/GB-month",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["workers-pricing"]
  },
  {
    id: "browser-run",
    name: "Browser Run",
    category: "Compute",
    available_on_free: true,
    free_quota: "10 browser minutes/day; 3 concurrent browsers for Browser Sessions",
    payg_price: "Workers Paid includes 10 browser hours/month, then $0.09/hour; extra concurrency $2/browser",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["browser-run-pricing"]
  },
  {
    id: "images",
    name: "Images Transformations",
    category: "Media",
    available_on_free: true,
    free_quota: "5,000 unique transformations/month",
    payg_price: "First 5,000 included, then $0.50/1,000 transformations; Images-hosted storage/delivery requires Images Paid",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["images-pricing"]
  },
  {
    id: "workers-kv",
    name: "Workers KV",
    category: "Storage",
    available_on_free: true,
    free_quota: "100,000 reads/day; 1,000 writes, deletes and list requests/day; 1 GB stored",
    payg_price: "10M reads/month included then $0.50/M; 1M writes/deletes/lists included then $5/M; storage above 1 GB $0.50/GB-month",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["workers-pricing"]
  },
  {
    id: "d1",
    name: "D1",
    category: "Database",
    available_on_free: true,
    free_quota: "5M rows read/day; 100,000 rows written/day; 5 GB total storage",
    payg_price: "25B rows read/month included then $0.001/M; 50M written included then $1/M; storage above 5 GB $0.75/GB-month",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["workers-pricing"]
  },
  {
    id: "queues",
    name: "Queues",
    category: "Messaging",
    available_on_free: true,
    free_quota: "10,000 operations/day; 24-hour message retention",
    payg_price: "1M operations/month included, then $0.40/M; paid retention configurable up to 14 days",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["workers-pricing"]
  },
  {
    id: "r2",
    name: "R2 Standard",
    category: "Storage",
    available_on_free: true,
    free_quota: "10 GB-month storage; 1M Class A + 10M Class B operations/month; egress free",
    payg_price: "$0.015/GB-month; $4.50/M Class A; $0.36/M Class B; Internet egress free",
    enterprise_only: false,
    status: "verified",
    note: "The Free tier shown here is for Standard storage, not Infrequent Access.",
    source_ids: ["workers-pricing"]
  },
  {
    id: "realtime",
    name: "Realtime SFU + TURN",
    category: "Realtime",
    available_on_free: true,
    free_quota: "1,000 GB egress/month shared across SFU and TURN",
    payg_price: "$0.05/GB egress above the shared allowance",
    enterprise_only: false,
    status: "verified",
    note: "SFU and TURN share one allowance; traffic between TURN and SFU/Stream is not double-billed.",
    source_ids: ["realtime-pricing"]
  },
  {
    id: "workers-builds",
    name: "Workers Builds",
    category: "CI / Deploy",
    available_on_free: true,
    free_quota: "3,000 build minutes/month; 1 concurrent build",
    payg_price: "6,000 build minutes/month included on Paid, then $0.005/minute; 6 concurrent builds",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["workers-builds-pricing"]
  },
  {
    id: "pages",
    name: "Pages Builds",
    category: "CI / Deploy",
    available_on_free: true,
    free_quota: "500 builds/month; 1 concurrent build",
    payg_price: "Plan limits: Pro 5,000 builds/month; Business 20,000 builds/month",
    enterprise_only: false,
    status: "verified",
    note: "Pages plan limits are separate from the Workers Free/Paid selector.",
    source_ids: ["pages-limits"]
  },
  {
    id: "dynamic-workers",
    name: "Dynamic Workers",
    category: "Compute",
    available_on_free: false,
    free_quota: null,
    payg_price: "Workers Paid only; 1,000 unique Dynamic Workers/month included, then $0.002 per Dynamic Worker/day; Workers request/CPU pricing also applies",
    enterprise_only: false,
    status: "verified",
    note: "This is PAYG-accessible but not Free. It is not an Enterprise-only feature.",
    source_ids: ["dynamic-workers-pricing", "enterprise-for-all"]
  },
  {
    id: "logpush",
    name: "Logpush",
    category: "Observability",
    available_on_free: true,
    free_quota: "Available on Free; dataset-specific limits apply",
    payg_price: "Self-service PAYG availability; pricing varies by product/dataset",
    enterprise_only: false,
    status: "verified",
    note: "Moved from Enterprise-only to Free, Pro and Business self-service availability in Birthday Week 2026.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "logpush-transformers",
    name: "Logpush Transformers",
    category: "Observability",
    available_on_free: true,
    free_quota: "Available on all plans",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "SQL-based filtering, redaction, enrichment and reformatting moved from Enterprise-only to all customers.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "custom-dashboards",
    name: "Custom Dashboards",
    category: "Observability",
    available_on_free: true,
    free_quota: "Available to all customers",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "Birthday Week 2026 announcement says Custom Dashboards are available to all customers.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "resource-rbac",
    name: "Resource-level RBAC",
    category: "Account / Security",
    available_on_free: true,
    free_quota: "Available across nearly all products; resource-level coverage varies by product",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "Workers joined R2 and Access in resource-level RBAC. Product coverage is not identical.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "multiple-accounts",
    name: "Multiple Accounts",
    category: "Account",
    available_on_free: true,
    free_quota: "New Account button can create additional Free Cloudflare accounts",
    payg_price: "Each account is billed independently when paid services are enabled",
    enterprise_only: false,
    status: "verified",
    note: null,
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "organizations",
    name: "Organizations",
    category: "Account",
    available_on_free: false,
    free_quota: null,
    payg_price: null,
    enterprise_only: true,
    status: "transition",
    note: "As of 2026-10-05 the article describes Organizations as Enterprise beta, GA in October, with rollout to Free accounts planned for early 2027.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "authentik-idp",
    name: "Authentik IdP",
    category: "Zero Trust",
    available_on_free: true,
    free_quota: "Available beyond Enterprise",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "Listed by Cloudflare as a formerly Enterprise-only capability now available more broadly.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "scim-audit",
    name: "SCIM Audit Logging",
    category: "Zero Trust",
    available_on_free: true,
    free_quota: "Available beyond Enterprise",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "Listed by Cloudflare as formerly Enterprise-only.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "scim-group-sync",
    name: "SCIM 2.0 Group Sync",
    category: "Zero Trust",
    available_on_free: true,
    free_quota: "Available beyond Enterprise",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "Listed by Cloudflare as formerly Enterprise-only.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "mcp-server-portals",
    name: "MCP Server Portals",
    category: "AI / Platform",
    available_on_free: true,
    free_quota: "GA; available beyond Enterprise",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "Birthday Week 2026 says MCP Server Portals moved to GA and were formerly Enterprise-only in some way.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "network-overview",
    name: "Network Overview",
    category: "Network",
    available_on_free: true,
    free_quota: "Available to all",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "Cloudflare describes network management as moving to self-service.",
    source_ids: ["enterprise-for-all"]
  },
  {
    id: "unified-routing",
    name: "Unified Routing",
    category: "Network",
    available_on_free: true,
    free_quota: "Available to all",
    payg_price: null,
    enterprise_only: false,
    status: "verified",
    note: "Cloudflare describes network management as moving to self-service.",
    source_ids: ["enterprise-for-all"]
  }
];

export function sourceById(id) {
  return CATALOG_SOURCE_CHECKS.find(source => source.id === id) || null;
}
