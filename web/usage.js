const API_BASE = "https://api.cloudflare.com/client/v4";
const GRAPHQL_ENDPOINT = `${API_BASE}/graphql`;

const GiB = 1024 ** 3;

const DAILY = {
  workersRequests: 100_000,
  kvRead: 100_000,
  kvWrite: 1_000,
  kvDelete: 1_000,
  kvList: 1_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
  queuesOperations: 10_000
};

export async function listAccounts(accessToken) {
  const response = await fetch(`${API_BASE}/accounts?per_page=50`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(apiError(payload, `Accounts API returned HTTP ${response.status}`));
  }
  return payload.result || [];
}

export async function loadUsage(accessToken, accountId) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const context = {
    accessToken,
    accountId,
    now,
    dayStart,
    nextDay,
    date: dayStart.toISOString().slice(0, 10)
  };

  const groups = await Promise.all([
    safely(() => workers(context), "Workers", "Requests"),
    safely(() => kv(context), "Workers KV", "Operations"),
    safely(() => d1(context), "D1", "Rows"),
    safely(() => queues(context), "Queues", "Operations"),
    safely(() => r2(context), "R2", "Storage / operations")
  ]);

  return groups.flat();
}

async function workers(ctx) {
  const data = await graphql(ctx.accessToken, `
    query WorkersDaily($accountTag: string!, $start: string!, $end: string!) {
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
    start: ctx.dayStart.toISOString(),
    end: ctx.now.toISOString()
  });

  const rows = account(data)?.workersInvocationsAdaptive || [];
  return [dailyCard("Workers", "Requests", sum(rows, row => row.sum?.requests), DAILY.workersRequests, ctx)];
}

async function kv(ctx) {
  const data = await graphql(ctx.accessToken, `
    query KvDaily($accountTag: string!, $start: Date!, $end: Date!) {
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
            filter: { date_geq: $start, date_leq: $end }
          ) {
            max { byteCount }
            dimensions { namespaceId date }
          }
        }
      }
    }
  `, { accountTag: ctx.accountId, start: ctx.date, end: ctx.date });

  const acc = account(data);
  const operations = acc?.kvOperationsAdaptiveGroups || [];
  const usageByAction = new Map();
  for (const row of operations) {
    const action = String(row.dimensions?.actionType || "").toLowerCase();
    usageByAction.set(action, (usageByAction.get(action) || 0) + Number(row.sum?.requests || 0));
  }

  const storage = sum(acc?.kvStorageAdaptiveGroups || [], row => row.max?.byteCount);

  return [
    dailyCard("Workers KV", "Reads", pickActions(usageByAction, ["read"]), DAILY.kvRead, ctx),
    dailyCard("Workers KV", "Writes", pickActions(usageByAction, ["write"]), DAILY.kvWrite, ctx),
    dailyCard("Workers KV", "Deletes", pickActions(usageByAction, ["delete"]), DAILY.kvDelete, ctx),
    dailyCard("Workers KV", "Lists", pickActions(usageByAction, ["list"]), DAILY.kvList, ctx),
    fixedCard("Workers KV", "Storage", storage, GiB, "bytes", "account total", "blocks", ctx)
  ];
}

async function d1(ctx) {
  const data = await graphql(ctx.accessToken, `
    query D1Daily($accountTag: string!, $start: Date!, $end: Date!) {
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
            filter: { date_geq: $start, date_leq: $end }
          ) {
            max { databaseSizeBytes }
            dimensions { databaseId date }
          }
        }
      }
    }
  `, { accountTag: ctx.accountId, start: ctx.date, end: ctx.date });

  const acc = account(data);
  const analytics = acc?.d1AnalyticsAdaptiveGroups || [];
  const storage = sum(acc?.d1StorageAdaptiveGroups || [], row => row.max?.databaseSizeBytes);

  return [
    dailyCard("D1", "Rows read", sum(analytics, row => row.sum?.rowsRead), DAILY.d1RowsRead, ctx),
    dailyCard("D1", "Rows written", sum(analytics, row => row.sum?.rowsWritten), DAILY.d1RowsWritten, ctx),
    fixedCard("D1", "Storage", storage, 5 * GiB, "bytes", "account total", "blocks", ctx)
  ];
}

async function queues(ctx) {
  const data = await graphql(ctx.accessToken, `
    query QueuesDaily($accountTag: string!, $start: Time!, $end: Time!) {
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
    start: ctx.dayStart.toISOString(),
    end: ctx.now.toISOString()
  });

  const rows = account(data)?.queueMessageOperationsAdaptiveGroups || [];
  return [dailyCard("Queues", "Billable operations", sum(rows, row => row.sum?.billableOperations), DAILY.queuesOperations, ctx)];
}

async function r2(ctx) {
  const monthStart = new Date(Date.UTC(ctx.now.getUTCFullYear(), ctx.now.getUTCMonth(), 1));
  const startDate = monthStart.toISOString().slice(0, 10);
  const endDate = ctx.date;

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
  `, { accountTag: ctx.accountId, start: startDate, end: endDate });

  const acc = account(data);
  const operations = sum(acc?.r2OperationsAdaptiveGroups || [], row => row.sum?.requests);
  const storage = sum(acc?.r2StorageAdaptiveGroups || [], row =>
    Number(row.max?.payloadSize || 0) + Number(row.max?.metadataSize || 0)
  );

  return [
    infoCard("R2", "Requests", operations, "month to date", "Analytics total; Class A/B quota classification unavailable", ctx),
    fixedCard("R2", "Storage snapshot", storage, 10 * GiB, "bytes", "current snapshot; free allowance is GB-month", "bills", ctx, "estimate")
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

function dailyCard(service, metric, usage, allowance, ctx) {
  return {
    service,
    metric,
    usage,
    allowance,
    unit: "count",
    remaining: Math.max(0, allowance - usage),
    ratio: allowance ? usage / allowance : null,
    period: "UTC day",
    periodStart: ctx.dayStart.toISOString(),
    periodEnd: ctx.now.toISOString(),
    resetAt: ctx.nextDay.toISOString(),
    limitBehavior: "blocks",
    dataSource: "GraphQL Analytics",
    freshness: ctx.now.toISOString(),
    confidence: "operational"
  };
}

function fixedCard(service, metric, usage, allowance, unit, period, limitBehavior, ctx, confidence = "operational") {
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
    resetAt: null,
    limitBehavior,
    dataSource: "GraphQL Analytics",
    freshness: ctx.now.toISOString(),
    confidence
  };
}

function infoCard(service, metric, usage, period, note, ctx) {
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
    dataSource: "GraphQL Analytics",
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
    dataSource: "GraphQL Analytics",
    freshness: null,
    confidence: "unavailable",
    error
  };
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
