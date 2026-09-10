const API_BASE = "/api/cloudflare";
const GRAPHQL_ENDPOINT = `${API_BASE}/graphql`;

const GiB = 1024 ** 3;
const PLAN = {
  free: {
    workersRequests: 100_000,
    kvRead: 100_000,
    kvWrite: 1_000,
    kvDelete: 1_000,
    kvList: 1_000,
    d1RowsRead: 5_000_000,
    d1RowsWritten: 100_000,
    queuesOperations: 10_000,
    workersBuildMinutes: 3_000,
    behavior: "blocks"
  },
  paid: {
    workersRequests: 10_000_000,
    kvRead: 10_000_000,
    kvWrite: 1_000_000,
    kvDelete: 1_000_000,
    kvList: 1_000_000,
    d1RowsRead: 25_000_000_000,
    d1RowsWritten: 50_000_000,
    queuesOperations: 1_000_000,
    workersBuildMinutes: 6_000,
    behavior: "bills"
  }
};

export async function listAccounts(accessToken) {
  const response = await fetch(`${API_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(apiError(payload, `Accounts API returned HTTP ${response.status}`));
  }
  return payload.result || [];
}

export async function loadUsage(accessToken, accountId, plan = "free", options = {}) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const selectedPlan = plan === "paid" ? "paid" : "free";
  const rangeStart = selectedPlan === "paid" ? monthStart : dayStart;

  const context = {
    accessToken,
    accountId,
    now,
    dayStart,
    nextDay,
    monthStart,
    rangeStart,
    startDate: rangeStart.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    plan: selectedPlan,
    limits: PLAN[selectedPlan],
    deploymentAccess: Boolean(options.deploymentAccess)
  };

  const groups = await Promise.all([
    safely(() => workers(context), "Workers", "Requests"),
    safely(() => kv(context), "Workers KV", "Operations"),
    safely(() => d1(context), "D1", "Rows"),
    safely(() => queues(context), "Queues", "Operations"),
    safely(() => r2(context), "R2", "Storage / operations"),
    safely(() => workerBuilds(context), "Workers Builds", "Build usage"),
    safely(() => pagesBuilds(context), "Pages", "Builds")
  ]);

  return groups.flat();
}

async function workers(ctx) {
  const data = await graphql(ctx.accessToken, `
    query WorkersRange($accountTag: string!, $start: string!, $end: string!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 10000
            filter: { datetime_geq: $start, datetime_lt: $end }
          ) {
            sum { requests }
          }
        }
      }
    }
  `, {
    accountTag: ctx.accountId,
    start: ctx.rangeStart.toISOString(),
    end: ctx.now.toISOString()
  });

  const rows = account(data)?.workersInvocationsAdaptive || [];
  return [rangeCard("Workers", "Requests", sum(rows, row => row.sum?.requests), ctx.limits.workersRequests, "count", ctx)];
}

async function kv(ctx) {
  const data = await graphql(ctx.accessToken, `
    query KvRange($accountTag: string!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          kvOperationsAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $start, date_leq: $end }
          ) {
            sum { requests }
            dimensions { actionType }
          }
          kvStorageAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $end, date_leq: $end }
          ) {
            max { byteCount }
            dimensions { namespaceId date }
          }
        }
      }
    }
  `, { accountTag: ctx.accountId, start: ctx.startDate, end: ctx.endDate });

  const acc = account(data);
  const operations = acc?.kvOperationsAdaptiveGroups || [];
  const usageByAction = new Map();
  for (const row of operations) {
    const action = String(row.dimensions?.actionType || "").toLowerCase();
    usageByAction.set(action, (usageByAction.get(action) || 0) + Number(row.sum?.requests || 0));
  }

  const storage = sum(acc?.kvStorageAdaptiveGroups || [], row => row.max?.byteCount);

  return [
    rangeCard("Workers KV", "Reads", pickActions(usageByAction, ["read"]), ctx.limits.kvRead, "count", ctx),
    rangeCard("Workers KV", "Writes", pickActions(usageByAction, ["write"]), ctx.limits.kvWrite, "count", ctx),
    rangeCard("Workers KV", "Deletes", pickActions(usageByAction, ["delete"]), ctx.limits.kvDelete, "count", ctx),
    rangeCard("Workers KV", "Lists", pickActions(usageByAction, ["list"]), ctx.limits.kvList, "count", ctx),
    fixedCard("Workers KV", "Storage", storage, GiB, "bytes", "current account total", ctx.limits.behavior, ctx)
  ];
}

async function d1(ctx) {
  const data = await graphql(ctx.accessToken, `
    query D1Range($accountTag: string!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $start, date_leq: $end }
          ) {
            sum { rowsRead rowsWritten }
          }
          d1StorageAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $end, date_leq: $end }
          ) {
            max { databaseSizeBytes }
            dimensions { databaseId date }
          }
        }
      }
    }
  `, { accountTag: ctx.accountId, start: ctx.startDate, end: ctx.endDate });

  const acc = account(data);
  const analytics = acc?.d1AnalyticsAdaptiveGroups || [];
  const storage = sum(acc?.d1StorageAdaptiveGroups || [], row => row.max?.databaseSizeBytes);

  return [
    rangeCard("D1", "Rows read", sum(analytics, row => row.sum?.rowsRead), ctx.limits.d1RowsRead, "count", ctx),
    rangeCard("D1", "Rows written", sum(analytics, row => row.sum?.rowsWritten), ctx.limits.d1RowsWritten, "count", ctx),
    fixedCard("D1", "Storage", storage, 5 * GiB, "bytes", "current account total", ctx.limits.behavior, ctx)
  ];
}

async function queues(ctx) {
  const data = await graphql(ctx.accessToken, `
    query QueuesRange($accountTag: string!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          queueMessageOperationsAdaptiveGroups(
            limit: 10000
            filter: { datetime_geq: $start, datetime_lt: $end }
          ) {
            sum { billableOperations }
          }
        }
      }
    }
  `, {
    accountTag: ctx.accountId,
    start: ctx.rangeStart.toISOString(),
    end: ctx.now.toISOString()
  });

  const rows = account(data)?.queueMessageOperationsAdaptiveGroups || [];
  return [rangeCard("Queues", "Billable operations", sum(rows, row => row.sum?.billableOperations), ctx.limits.queuesOperations, "count", ctx)];
}

async function r2(ctx) {
  const startDate = ctx.monthStart.toISOString().slice(0, 10);

  const data = await graphql(ctx.accessToken, `
    query R2Usage($accountTag: string!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2OperationsAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $start, date_leq: $end }
          ) {
            sum { requests }
            dimensions { actionType }
          }
          r2StorageAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $end, date_leq: $end }
          ) {
            max { payloadSize metadataSize }
            dimensions { bucketName date }
          }
        }
      }
    }
  `, { accountTag: ctx.accountId, start: startDate, end: ctx.endDate });

  const acc = account(data);
  const operations = sum(acc?.r2OperationsAdaptiveGroups || [], row => row.sum?.requests);
  const storage = sum(acc?.r2StorageAdaptiveGroups || [], row =>
    Number(row.max?.payloadSize || 0) + Number(row.max?.metadataSize || 0)
  );

  return [
    infoCard("R2", "Requests", operations, "calendar month to date", "Analytics total; Class A/B quota classification unavailable", ctx),
    fixedCard("R2", "Storage snapshot", storage, 10 * GiB, "bytes", "current snapshot; free allowance is GB-month", "bills", ctx, "estimate")
  ];
}

async function workerBuilds(ctx) {
  if (!ctx.deploymentAccess) {
    return [unavailableCard("Workers Builds", "Build usage", "Enable deploy metrics to request Workers Scripts Read + Workers CI Read.")];
  }

  const scriptsPayload = await rest(ctx.accessToken, "/workers/scripts", { account_id: ctx.accountId });
  const scripts = scriptsPayload.result || [];
  const allBuilds = [];

  for (const script of scripts) {
    if (!script.tag) continue;
    const builds = await paginatedRest(ctx.accessToken, "/workers/builds", {
      account_id: ctx.accountId,
      tag: script.tag
    }, ctx.monthStart);
    allBuilds.push(...builds);
  }

  const builds = allBuilds.filter(build => inCurrentMonth(build.created_on, ctx.monthStart, ctx.now));
  const minutes = builds.reduce((total, build) => {
    const start = parseTime(build.running_on || build.initializing_on || build.created_on);
    const end = parseTime(build.stopped_on || (build.status === "stopped" ? build.modified_on : ctx.now));
    if (!start || !end || end < start) return total;
    return total + (end - start) / 60_000;
  }, 0);

  return [
    infoCard("Workers Builds", "Build count", builds.length, "calendar month to date", "Informational only; the quota is build minutes, not number of builds.", ctx, "Cloudflare REST API"),
    metricCard(
      "Workers Builds",
      "Build minutes",
      minutes,
      ctx.limits.workersBuildMinutes,
      "minutes",
      "calendar month to date",
      ctx.limits.behavior,
      ctx,
      "estimate",
      "Estimated from build timestamps. Paid includes 6,000 build minutes/month, then $0.005/min."
    )
  ];
}

async function pagesBuilds(ctx) {
  if (!ctx.deploymentAccess) {
    return [unavailableCard("Pages", "Builds", "Enable deploy metrics to request Pages Read.")];
  }

  const projects = await paginatedRest(ctx.accessToken, "/pages/projects", {
    account_id: ctx.accountId
  });
  const deployments = [];

  for (const project of projects) {
    const rows = await paginatedRest(ctx.accessToken, "/pages/deployments", {
      account_id: ctx.accountId,
      project: project.name || project.id
    }, ctx.monthStart);
    deployments.push(...rows);
  }

  const builds = deployments.filter(deployment => {
    if (!inCurrentMonth(deployment.created_on, ctx.monthStart, ctx.now)) return false;
    if (deployment.is_skipped) return false;
    return ["github:push", "deploy_hook"].includes(deployment.deployment_trigger?.type);
  });

  return [
    infoCard(
      "Pages",
      "Builds",
      builds.length,
      "calendar month to date",
      "Pages limits are Free 500 / Pro 5,000 / Business 20,000 builds per month. Pages plan is separate from Workers Paid, so this card does not apply a quota ratio.",
      ctx,
      "Cloudflare REST API"
    )
  ];
}

async function graphql(accessToken, query, variables) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);
  if (payload.errors?.length) {
    throw new Error(payload.errors.map(error => error.message).join("; "));
  }
  return payload.data;
}

async function rest(accessToken, path, params = {}) {
  const url = new URL(`${API_BASE}${path}`, location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(apiError(payload, `${path} returned HTTP ${response.status}`));
  }
  return payload;
}

async function paginatedRest(accessToken, path, params, cutoff = null) {
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    const payload = await rest(accessToken, path, { ...params, page, per_page: 100 });
    const result = Array.isArray(payload.result) ? payload.result : [];
    rows.push(...result);

    if (cutoff && result.some(item => parseTime(item.created_on) && parseTime(item.created_on) < cutoff)) break;
    const totalPages = Number(payload.result_info?.total_pages || 0);
    if (totalPages && page >= totalPages) break;
    if (!totalPages && result.length < 100) break;
  }
  return rows;
}

function rangeCard(service, metric, usage, allowance, unit, ctx) {
  const paid = ctx.plan === "paid";
  return metricCard(
    service,
    metric,
    usage,
    allowance,
    unit,
    paid ? "calendar month to date" : "UTC day",
    ctx.limits.behavior,
    ctx,
    paid ? "estimate" : "operational",
    paid ? "Paid included usage resets on the subscription billing cycle; calendar month-to-date is an operational comparison." : null,
    paid ? null : ctx.nextDay.toISOString()
  );
}

function metricCard(service, metric, usage, allowance, unit, period, limitBehavior, ctx, confidence = "operational", note = null, resetAt = null) {
  return {
    service,
    metric,
    usage,
    allowance,
    unit,
    remaining: Math.max(0, allowance - usage),
    ratio: allowance ? usage / allowance : null,
    period,
    periodStart: null,
    periodEnd: ctx.now.toISOString(),
    resetAt,
    limitBehavior,
    dataSource: "Cloudflare API",
    freshness: ctx.now.toISOString(),
    confidence,
    note
  };
}

function fixedCard(service, metric, usage, allowance, unit, period, limitBehavior, ctx, confidence = "operational") {
  return metricCard(service, metric, usage, allowance, unit, period, limitBehavior, ctx, confidence);
}

function infoCard(service, metric, usage, period, note, ctx, dataSource = "GraphQL Analytics") {
  return {
    service,
    metric,
    usage,
    allowance: null,
    unit: "count",
    remaining: null,
    ratio: null,
    period,
    periodStart: null,
    periodEnd: ctx.now.toISOString(),
    resetAt: null,
    limitBehavior: "unknown",
    dataSource,
    freshness: ctx.now.toISOString(),
    confidence: "informational",
    note
  };
}

function unavailableCard(service, metric, error) {
  return {
    service,
    metric,
    usage: null,
    allowance: null,
    unit: "count",
    remaining: null,
    ratio: null,
    period: null,
    resetAt: null,
    limitBehavior: "unknown",
    dataSource: "Cloudflare API",
    freshness: null,
    confidence: "unavailable",
    error
  };
}

function account(data) {
  return data?.viewer?.accounts?.[0] || null;
}

async function safely(loader, service, metric) {
  try {
    return await loader();
  } catch (error) {
    return [unavailableCard(service, metric, error instanceof Error ? error.message : String(error))];
  }
}

function inCurrentMonth(value, start, now) {
  const time = parseTime(value);
  return Boolean(time && time >= start && time <= now);
}

function parseTime(value) {
  if (!value) return null;
  const time = new Date(value);
  return Number.isNaN(time.valueOf()) ? null : time;
}

function sum(rows, getter) {
  return rows.reduce((total, row) => total + Number(getter(row) || 0), 0);
}

function pickActions(map, names) {
  let total = 0;
  for (const [action, usage] of map) {
    if (names.some(name => action === name || action.includes(name))) total += usage;
  }
  return total;
}

function apiError(payload, fallback) {
  const messages = payload?.errors?.map(error => error.message).filter(Boolean);
  return messages?.length ? messages.join("; ") : fallback;
}
