import { OAUTH } from "./config.js";

const PKCE_KEY = "cffreeusage.pkce";
let token = null;

export async function initializeAuth() {
  const url = new URL(location.href);

  if (url.searchParams.has("error")) {
    const message = url.searchParams.get("error_description") || url.searchParams.get("error");
    cleanupCallbackUrl();
    throw new Error(`OAuth authorization failed: ${message}`);
  }

  if (url.searchParams.has("code")) {
    try {
      await completeAuthorization(url);
      return true;
    } finally {
      cleanupCallbackUrl();
    }
  }

  // OAuth tokens deliberately live only in this JavaScript module's memory.
  // Reloading, closing, or restarting the PWA therefore requires sign-in again.
  return Boolean(token?.access_token) && !isExpired(token);
}

export async function signIn() {
  if (!OAUTH.clientId || OAUTH.clientId.startsWith("PASTE_")) {
    throw new Error("Set the Cloudflare OAuth Client ID in public/config.js first.");
  }

  const verifier = randomBase64Url(48);
  const challenge = base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
    )
  );
  const state = randomBase64Url(24);
  const redirectUri = callbackUri();

  // PKCE state must survive the round trip to Cloudflare. It is not a token and
  // is removed immediately when the callback is processed.
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, redirectUri }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH.clientId,
    redirect_uri: redirectUri,
    scope: OAUTH.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  location.assign(`${OAUTH.authorizationEndpoint}?${params}`);
}

export async function signOut() {
  const current = token;
  token = null;

  if (current?.refresh_token) {
    await fetch(OAUTH.revokeEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: current.refresh_token,
        client_id: OAUTH.clientId
      })
    }).catch(() => {});
  }
}

export async function getAccessToken() {
  if (!token) return null;

  if (isExpired(token)) {
    if (!token.refresh_token) {
      token = null;
      return null;
    }
    await refreshAccessToken();
  }

  return token.access_token;
}

export function isSignedIn() {
  return Boolean(token?.access_token) && !isExpired(token);
}

async function completeAuthorization(url) {
  const saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) || "null");
  sessionStorage.removeItem(PKCE_KEY);

  if (!saved || saved.state !== url.searchParams.get("state")) {
    throw new Error("OAuth state mismatch. Start sign-in again.");
  }

  const response = await fetch(OAUTH.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: OAUTH.clientId,
      code: url.searchParams.get("code"),
      redirect_uri: saved.redirectUri,
      code_verifier: saved.verifier
    })
  });

  token = normalizeToken(await parseTokenResponse(response));
}

async function refreshAccessToken() {
  if (!token?.refresh_token) throw new Error("No refresh token available.");

  const current = token;
  const response = await fetch(OAUTH.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: OAUTH.clientId,
      refresh_token: current.refresh_token
    })
  });

  const refreshed = await parseTokenResponse(response);
  token = normalizeToken({
    ...current,
    ...refreshed,
    refresh_token: refreshed.refresh_token || current.refresh_token
  });
}

async function parseTokenResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        `OAuth token endpoint returned HTTP ${response.status}`
    );
  }
  return payload;
}

function normalizeToken(value) {
  return {
    ...value,
    expires_at: Date.now() + Math.max(0, Number(value.expires_in || 3600) - 30) * 1000
  };
}

function isExpired(value) {
  return !value.expires_at || Date.now() >= value.expires_at;
}

function callbackUri() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  return url.href;
}

function cleanupCallbackUrl() {
  const clean = new URL(location.href);
  clean.search = "";
  clean.hash = "";
  history.replaceState({}, "", clean);
}

function randomBase64Url(length) {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)));
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
