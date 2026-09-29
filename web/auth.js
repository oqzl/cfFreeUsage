import { OAUTH } from "./config.js?v=__COMMIT_SHA__";

const PKCE_KEY = "cffreeusage.pkce";
const AUTH_DB_NAME = "cffreeusage.auth";
const AUTH_DB_VERSION = 1;
const AUTH_STORE_NAME = "oauth";
const AUTH_SESSION_KEY = "refresh-session";
const PERSISTED_SESSION_MS = 14 * 24 * 60 * 60 * 1000;

let token = null;
let persistentSessionStored = false;
let persistentSessionExpiresAt = null;
let persistenceAvailable = "indexedDB" in globalThis;

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

  if (isSignedIn()) return true;
  return restorePersistedSession();
}

export async function signIn() {
  if (!OAUTH.clientId || OAUTH.clientId.startsWith("PASTE_")) {
    throw new Error("Set the Cloudflare OAuth Client ID in web/config.js first.");
  }

  const requestedScopes = [...OAUTH.scopes];
  const verifier = randomBase64Url(48);
  const challenge = base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
    )
  );
  const state = randomBase64Url(24);
  const redirectUri = callbackUri();

  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, redirectUri, requestedScopes }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH.clientId,
    redirect_uri: redirectUri,
    scope: requestedScopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  location.assign(`${OAUTH.authorizationEndpoint}?${params}`);
}

export function hasDeployMetricsAccess() {
  return hasGrantedScopes(OAUTH.deploymentScopes);
}

export function getAuthDiagnostics() {
  return {
    signedIn: isSignedIn(),
    accessTokenPresent: Boolean(token?.access_token),
    refreshTokenPresent: Boolean(token?.refresh_token),
    persistentSessionStored,
    persistenceAvailable,
    persistentSessionExpiresAt: Number.isFinite(persistentSessionExpiresAt)
      ? new Date(persistentSessionExpiresAt).toISOString()
      : null,
    requestedScopes: Array.isArray(token?.requested_scopes) ? [...token.requested_scopes] : [],
    grantedScopes: Array.isArray(token?.granted_scopes) ? [...token.granted_scopes] : [],
    grantedScopesSource: token?.granted_scopes_source || null,
    expiresAt: Number.isFinite(token?.expires_at) ? new Date(token.expires_at).toISOString() : null
  };
}

export async function signOut() {
  const current = token;
  const persisted = await readStoredSessionSafe();
  const tokenToRevoke = current?.refresh_token || persisted?.refresh_token || current?.access_token;

  token = null;
  persistentSessionStored = false;
  persistentSessionExpiresAt = null;
  await clearStoredSessionSafe();

  if (tokenToRevoke) await revokeToken(tokenToRevoke);
}

export async function getAccessToken() {
  if (!token) return null;

  if (isSessionExpired(token)) {
    await expireLocalSession();
    return null;
  }

  if (isExpired(token)) {
    if (!token.refresh_token) {
      token = null;
      return null;
    }

    try {
      await refreshAccessToken();
    } catch (error) {
      if (isPermanentRefreshError(error)) {
        token = null;
        persistentSessionStored = false;
        persistentSessionExpiresAt = null;
        await clearStoredSessionSafe();
        return null;
      }
      throw error;
    }
  }

  return token.access_token;
}

export function isSignedIn() {
  return Boolean(token?.access_token) && !isExpired(token) && !isSessionExpired(token);
}

function hasGrantedScopes(scopes) {
  if (!token) return false;
  const granted = new Set(token.granted_scopes || []);
  return scopes.every(scope => granted.has(scope));
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

  const value = await parseTokenResponse(response);
  const responseScopes = parseScopes(value.scope);
  const sessionExpiresAt = Date.now() + PERSISTED_SESSION_MS;
  token = normalizeToken({
    ...value,
    requested_scopes: saved.requestedScopes,
    granted_scopes: responseScopes.length ? responseScopes : saved.requestedScopes,
    granted_scopes_source: responseScopes.length ? "token-response" : "requested-fallback",
    session_expires_at: sessionExpiresAt
  });

  if (token.refresh_token) await persistRefreshSessionSafe(token);
}

async function restorePersistedSession() {
  const saved = await readStoredSessionSafe();
  if (!saved?.refresh_token) return false;

  const sessionExpiresAt = Number(saved.session_expires_at);
  if (!Number.isFinite(sessionExpiresAt) || Date.now() >= sessionExpiresAt) {
    const refreshToken = saved.refresh_token;
    persistentSessionStored = false;
    persistentSessionExpiresAt = null;
    await clearStoredSessionSafe();
    revokeToken(refreshToken).catch(() => {});
    return false;
  }

  token = {
    refresh_token: saved.refresh_token,
    requested_scopes: Array.isArray(saved.requested_scopes) ? saved.requested_scopes : [...OAUTH.scopes],
    granted_scopes: Array.isArray(saved.granted_scopes) ? saved.granted_scopes : [],
    granted_scopes_source: saved.granted_scopes_source || "persisted",
    session_expires_at: sessionExpiresAt
  };
  persistentSessionStored = true;
  persistentSessionExpiresAt = sessionExpiresAt;

  try {
    await refreshAccessToken();
    return isSignedIn();
  } catch (error) {
    token = null;
    if (isPermanentRefreshError(error)) {
      persistentSessionStored = false;
      persistentSessionExpiresAt = null;
      await clearStoredSessionSafe();
      return false;
    }
    throw error;
  }
}

async function refreshAccessToken() {
  if (!token?.refresh_token) throw new Error("No refresh token available.");
  if (isSessionExpired(token)) throw new Error("Persistent session expired.");

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
  const responseScopes = parseScopes(refreshed.scope);
  token = normalizeToken({
    ...current,
    ...refreshed,
    refresh_token: refreshed.refresh_token || current.refresh_token,
    granted_scopes: responseScopes.length ? responseScopes : current.granted_scopes,
    granted_scopes_source: responseScopes.length ? "token-response" : current.granted_scopes_source,
    session_expires_at: current.session_expires_at
  });

  await persistRefreshSessionSafe(token);
}

async function parseTokenResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const error = new Error(
      payload.error_description ||
        payload.error ||
        `OAuth token endpoint returned HTTP ${response.status}`
    );
    error.oauthError = payload.error || null;
    error.httpStatus = response.status;
    throw error;
  }
  return payload;
}

function parseScopes(scope) {
  if (Array.isArray(scope)) return scope;
  if (typeof scope === "string" && scope.trim()) return scope.trim().split(/\s+/);
  return [];
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

function isSessionExpired(value) {
  return Number.isFinite(value?.session_expires_at) && Date.now() >= value.session_expires_at;
}

function isPermanentRefreshError(error) {
  return error?.oauthError === "invalid_grant" || error?.oauthError === "invalid_token";
}

async function expireLocalSession() {
  const refreshToken = token?.refresh_token;
  token = null;
  persistentSessionStored = false;
  persistentSessionExpiresAt = null;
  await clearStoredSessionSafe();
  if (refreshToken) revokeToken(refreshToken).catch(() => {});
}

async function revokeToken(value) {
  await fetch(OAUTH.revokeEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token: value,
      client_id: OAUTH.clientId
    })
  }).catch(() => {});
}

async function persistRefreshSessionSafe(value) {
  if (!value?.refresh_token || !Number.isFinite(value.session_expires_at)) return;

  const session = {
    refresh_token: value.refresh_token,
    session_expires_at: value.session_expires_at,
    requested_scopes: Array.isArray(value.requested_scopes) ? [...value.requested_scopes] : [],
    granted_scopes: Array.isArray(value.granted_scopes) ? [...value.granted_scopes] : [],
    granted_scopes_source: value.granted_scopes_source || null
  };

  try {
    await writeStoredSession(session);
    persistentSessionStored = true;
    persistentSessionExpiresAt = session.session_expires_at;
    persistenceAvailable = true;
  } catch {
    persistentSessionStored = false;
    persistentSessionExpiresAt = null;
    persistenceAvailable = false;
  }
}

async function readStoredSessionSafe() {
  try {
    const session = await readStoredSession();
    persistenceAvailable = true;
    persistentSessionStored = Boolean(session?.refresh_token);
    persistentSessionExpiresAt = Number.isFinite(Number(session?.session_expires_at))
      ? Number(session.session_expires_at)
      : null;
    return session;
  } catch {
    persistenceAvailable = false;
    persistentSessionStored = false;
    persistentSessionExpiresAt = null;
    return null;
  }
}

async function clearStoredSessionSafe() {
  try {
    await deleteStoredSession();
    persistenceAvailable = true;
  } catch {
    persistenceAvailable = false;
  }
}

async function openAuthDb() {
  if (!("indexedDB" in globalThis)) throw new Error("IndexedDB is unavailable.");

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTH_DB_NAME, AUTH_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUTH_STORE_NAME)) db.createObjectStore(AUTH_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open auth storage."));
    request.onblocked = () => reject(new Error("Auth storage upgrade is blocked."));
  });
}

async function readStoredSession() {
  const db = await openAuthDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(AUTH_STORE_NAME, "readonly");
      const request = transaction.objectStore(AUTH_STORE_NAME).get(AUTH_SESSION_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read auth storage."));
      transaction.onabort = () => reject(transaction.error || new Error("Auth storage read was aborted."));
    });
  } finally {
    db.close();
  }
}

async function writeStoredSession(value) {
  const db = await openAuthDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(AUTH_STORE_NAME, "readwrite");
      transaction.objectStore(AUTH_STORE_NAME).put(value, AUTH_SESSION_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error("Auth storage write was aborted."));
      transaction.onerror = () => reject(transaction.error || new Error("Could not write auth storage."));
    });
  } finally {
    db.close();
  }
}

async function deleteStoredSession() {
  const db = await openAuthDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(AUTH_STORE_NAME, "readwrite");
      transaction.objectStore(AUTH_STORE_NAME).delete(AUTH_SESSION_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error("Auth storage delete was aborted."));
      transaction.onerror = () => reject(transaction.error || new Error("Could not clear auth storage."));
    });
  } finally {
    db.close();
  }
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
