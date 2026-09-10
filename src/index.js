const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

const FREE_LIMITS = {
  workersRequests: 100_000,
  kvRead: 100_000,
  kvWrite: 1_000,
  kvDelete: 1_000,
  kvList: 1_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
  r2StorageBytes: 10_000_000_000,
  r2ClassA: 1_000_000,
  r2ClassB: 10_000_000
};

const R2_CLASS_A = new Set([
  "ListBuckets", "PutBucket", "ListObjects", "PutObject", "CopyObject",
  "CompleteMultipartUpload", "CreateMultipartUpload", "LifecycleStorageTierTransition",
  "ListMultipartUploads", "UploadPart", "UploadPartCopy", "ListParts",
  "PutBucketEncryption", "PutBucketCors", "PutBucketLifecycleConfiguration"
]);

const R2_CLASS_B = new Set([
  "HeadBucket", "HeadObject", "GetObject", "UsageSummary", "GetBucketEncryption",
  "GetBucketLocation", "GetBucketCors", "GetBucketLifecycleConfiguration"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/usage") {
      return handleUsage(env);
    }
    return env.ASSETS.fetch(request);
  }
};

async function handleUsage(env) {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    return json({
      error: "Missing CF_ACCOUNT_ID or CF_API_TOKEN. Configure them as Worker secrets/variables."
    }, 503);
  }

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [workers, kv, d1, r2] = await Promise.all([
    queryWorkers(env, dayStart, now),
    queryKv(env, dayStart, now),
    queryD1(env, dayStart, now),
    queryR2(env, monthStart, now)
  ]);

  return json({
    generatedAt: now.toISOString(),
    reset: {
      daily: new Date(dayStart.getTime() + 86_400_000).toISOString(),
      monthly: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
    },
    limits: FREE_LIMITS,
    products: { workers, kv, d1, r2 }
  });
}

async function queryWorkers(env, start, end) {
  const query = `
    query WorkersUsage($accountTag: string!, $start: string!, $end: string!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 10000
            filter: { datetime_geq: $start, datetime_leq: $end }
          ) {
            sum { requests errors subrequests }
            dimensions { scriptName }
          }
        }
      }
    }`;

  return safeQuery(env, query, {
    accountTag: env.CF_ACCOUNT_ID,
    start: start.toISOString(),
    end: end.toISOString()
  }, data => {
    const rows = data.viewer.accounts[0]?.workersInvocationsAdaptive ?? [];
    const byScript = new Map();
    let requests = 0;
    let errors = 0;
    let subrequests = 0;
    for (const row of rows) {
      const r = row.sum?.requests ?? 0;
      requests += r;
      errors += row.sum?.errors ?? 0;
      subrequests += row.sum?.subrequests ?? 0;
      const name = row.dimensions?.scriptName || "(unknown)";
      byScript.set(name, (byScript.get(name) ?? 0) + r);
    }
    return {
      requests,
      errors,
      subrequests,
      byScript: [...byScript.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
    };
  });
}

async function queryKv(env, start, end) {
  const query = `
    query KvUsage($accountTag: string!, $start: Date, $end: Date) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          kvOperationsAdaptiveGroups(
            filter: { date_geq: $start, date_leq: $end }
            limit: 10000
          ) {
            sum { requests }
            dimensions { actionType }
          }
          kvStorageAdaptiveGroups(
            filter: { date_geq: $start, date_leq: $end }
            limit: 10000
          ) {
            max { byteCount }
          }
        }
      }
    }`;

  return safeQuery(env, query, {
    accountTag: env.CF_ACCOUNT_ID,
    start: dateOnly(start),
    end: dateOnly(end)
  }, data => {
    const account = data.viewer.accounts[0] ?? {};
    const operations = { read: 0, write: 0, delete: 0, list: 0, other: 0 };
    for (const row of account.kvOperationsAdaptiveGroups ?? []) {
      const action = String(row.dimensions?.actionType ?? "other").toLowerCase();
      const value = row.sum?.requests ?? 0;
      if (action in operations) operations[action] += value;
      else operations.other += value;
    }
    const storageBytes = (account.kvStorageAdaptiveGroups ?? [])
      .reduce((max, row) => Math.max(max, row.max?.byteCount ?? 0), 0);
    return { operations, storageBytes };
  });
}

async function queryD1(env, start, end) {
  const query = `
    query D1Usage($accountTag: string!, $start: Date, $end: Date) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          d1AnalyticsAdaptiveGroups(
            filter: { date_geq: $start, date_leq: $end }
            limit: 10000
          ) {
            sum { rowsRead rowsWritten readQueries writeQueries }
          }
          d1StorageAdaptiveGroups(
            filter: { date_geq: $start, date_leq: $end }
            limit: 10000
          ) {
            max { databaseSizeBytes }
          }
        }
      }
    }`;

  return safeQuery(env, query, {
    accountTag: env.CF_ACCOUNT_ID,
    start: dateOnly(start),
    end: dateOnly(end)
  }, data => {
    const account = data.viewer.accounts[0] ?? {};
    let rowsRead = 0;
    let rowsWritten = 0;
    let readQueries = 0;
    let writeQueries = 0;
    for (const row of account.d1AnalyticsAdaptiveGroups ?? []) {
      rowsRead += row.sum?.rowsRead ?? 0;
      rowsWritten += row.sum?.rowsWritten ?? 0;
      readQueries += row.sum?.readQueries ?? 0;
      writeQueries += row.sum?.writeQueries ?? 0;
    }
    const storageBytes = (account.d1StorageAdaptiveGroups ?? [])
      .reduce((sum, row) => sum + (row.max?.databaseSizeBytes ?? 0), 0);
    return { rowsRead, rowsWritten, readQueries, writeQueries, storageBytes };
  });
}

async function queryR2(env, start, end) {
  const query = `
    query R2Usage($accountTag: string!, $start: Time, $end: Time) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2OperationsAdaptiveGroups(
            filter: { datetime_geq: $start, datetime_leq: $end }
            limit: 10000
          ) {
            sum { requests }
            dimensions { actionType }
          }
          r2StorageAdaptiveGroups(
            filter: { datetime_geq: $start, datetime_leq: $end }
            limit: 10000
            orderBy: [datetime_DESC]
          ) {
            max { payloadSize metadataSize }
            dimensions { datetime }
          }
        }
      }
    }`;

  return safeQuery(env, query, {
    accountTag: env.CF_ACCOUNT_ID,
    start: start.toISOString(),
    end: end.toISOString()
  }, data => {
    const account = data.viewer.accounts[0] ?? {};
    let classA = 0;
    let classB = 0;
    let other = 0;
    for (const row of account.r2OperationsAdaptiveGroups ?? []) {
      const action = row.dimensions?.actionType ?? "";
      const value = row.sum?.requests ?? 0;
      if (R2_CLASS_A.has(action)) classA += value;
      else if (R2_CLASS_B.has(action)) classB += value;
      else other += value;
    }
    const latest = (account.r2StorageAdaptiveGroups ?? [])[0];
    const storageBytes = (latest?.max?.payloadSize ?? 0) + (latest?.max?.metadataSize ?? 0);
    return { classA, classB, other, storageBytes };
  });
}

async function safeQuery(env, query, variables, transform) {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, variables })
    });
    const payload = await response.json();
    if (!response.ok || payload.errors?.length) {
      return { unavailable: true, error: payload.errors?.[0]?.message || `HTTP ${response.status}` };
    }
    return transform(payload.data);
  } catch (error) {
    return { unavailable: true, error: error instanceof Error ? error.message : String(error) };
  }
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
