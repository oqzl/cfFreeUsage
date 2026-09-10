const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/cloudflare/")) {
      return json({ error: "Not found" }, 404);
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Missing bearer token" }, 401);
    }

    if (url.pathname === "/api/cloudflare/accounts" && request.method === "GET") {
      return proxyCloudflare(request, `${CLOUDFLARE_API}/accounts?per_page=50`, authorization);
    }

    if (url.pathname === "/api/cloudflare/graphql" && request.method === "POST") {
      return proxyCloudflare(request, `${CLOUDFLARE_API}/graphql`, authorization);
    }

    if (request.method === "GET") {
      const upstream = extendedReadUrl(url);
      if (upstream) return proxyCloudflare(request, upstream, authorization);
    }

    return json({ error: "Not found" }, 404);
  }
};

function extendedReadUrl(url) {
  const accountId = safeId(url.searchParams.get("account_id"));
  if (!accountId) return null;

  const page = safePage(url.searchParams.get("page"));
  const perPage = safePerPage(url.searchParams.get("per_page"));
  const paging = `page=${page}&per_page=${perPage}`;

  if (url.pathname === "/api/cloudflare/workers/scripts") {
    return `${CLOUDFLARE_API}/accounts/${accountId}/workers/scripts`;
  }

  if (url.pathname === "/api/cloudflare/workers/builds") {
    const tag = safeId(url.searchParams.get("tag"));
    if (!tag) return null;
    return `${CLOUDFLARE_API}/accounts/${accountId}/builds/workers/${tag}/builds?${paging}`;
  }

  if (url.pathname === "/api/cloudflare/pages/projects") {
    return `${CLOUDFLARE_API}/accounts/${accountId}/pages/projects?${paging}`;
  }

  if (url.pathname === "/api/cloudflare/pages/deployments") {
    const project = safeName(url.searchParams.get("project"));
    if (!project) return null;
    return `${CLOUDFLARE_API}/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}/deployments?${paging}`;
  }

  return null;
}

function safeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}

function safeName(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value) ? value : null;
}

function safePage(value) {
  const number = Number.parseInt(value || "1", 10);
  return Number.isInteger(number) && number >= 1 && number <= 1000 ? number : 1;
}

function safePerPage(value) {
  const number = Number.parseInt(value || "100", 10);
  return Number.isInteger(number) && number >= 1 && number <= 100 ? number : 100;
}

async function proxyCloudflare(request, upstreamUrl, authorization) {
  const headers = new Headers({
    Authorization: authorization,
    Accept: "application/json"
  });

  let body;
  if (request.method === "POST") {
    headers.set("Content-Type", "application/json");
    body = await request.text();
  }

  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual"
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function json(value, status) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
