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

    return json({ error: "Not found" }, 404);
  }
};

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
