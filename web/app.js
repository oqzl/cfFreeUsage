import {
  getAccessToken,
  getAuthDiagnostics,
  hasDeployMetricsAccess,
  initializeAuth,
  isSignedIn,
  signIn,
  signOut
} from "./auth.js?v=__COMMIT_SHA__";
import { listAccounts, loadUsage } from "./usage.js?v=__COMMIT_SHA__";

const els = {
  authButton: document.querySelector("#auth-button"),
  refreshButton: document.querySelector("#refresh"),
  accountSelect: document.querySelector("#account"),
  planSelect: document.querySelector("#plan"),
  status: document.querySelector("#status"),
  updated: document.querySelector("#updated"),
  dashboard: document.querySelector("#dashboard")
};

const BUILD_ID = "__COMMIT_SHA__";
const diagnostics = [];
let accounts = [];
let selectedAccountId = null;
let selectedPlan = "free";
let loading = false;

boot();

async function boot() {
  bindEvents();
  logDiagnostic("boot.start", runtimeDiagnostics());
  registerServiceWorker();

  try {
    const signedIn = await initializeAuth();
    logDiagnostic("auth.initialized", getAuthDiagnostics());
    updateAuthUi();
    if (signedIn) await loadAccountsAndUsage();
    else renderSignedOut();
  } catch (error) {
    logDiagnosticError("boot.error", error, { auth: getAuthDiagnostics() });
    updateAuthUi();
    if (isSignedIn()) {
      renderSignedInError(error);
    } else {
      renderSignedOut();
      setStatus(errorMessage(error), true);
    }
  }
}

function bindEvents() {
  els.authButton.addEventListener("click", async () => {
    if (loading) return;
    try {
      if (isSignedIn()) {
        logDiagnostic("auth.sign_out", getAuthDiagnostics());
        await signOut();
        accounts = [];
        selectedAccountId = null;
        updateAuthUi();
        renderSignedOut();
      } else {
        logDiagnostic("auth.sign_in", { requested: "all dashboard scopes" });
        await signIn();
      }
    } catch (error) {
      logDiagnosticError("auth.action_error", error, { auth: getAuthDiagnostics() });
      setStatus(errorMessage(error), true);
    }
  });

  els.refreshButton.addEventListener("click", () => refreshUsage());

  els.accountSelect.addEventListener("change", () => {
    selectedAccountId = els.accountSelect.value;
    refreshUsage();
  });

  els.planSelect.addEventListener("change", () => {
    selectedPlan = els.planSelect.value === "paid" ? "paid" : "free";
    if (isSignedIn() && selectedAccountId) refreshUsage();
  });
}

async function loadAccountsAndUsage() {
  setLoading(true);
  setStatus("Loading Cloudflare accounts…");

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Session expired. Sign in again.");

    const auth = getAuthDiagnostics();
    logDiagnostic("accounts.request", {
      path: "/api/cloudflare/accounts",
      auth,
      runtime: runtimeDiagnostics()
    });

    try {
      accounts = await listAccounts(accessToken);
      logDiagnostic("accounts.success", { count: accounts.length });
    } catch (error) {
      logDiagnosticError("accounts.error", error, {
        path: "/api/cloudflare/accounts",
        auth,
        runtime: runtimeDiagnostics()
      });
      throw error;
    }

    if (!accounts.length) throw new Error("No Cloudflare account is available to this OAuth grant.");

    selectedAccountId = accounts[0].id;
    renderAccountSelect();
  } finally {
    setLoading(false);
  }

  await refreshUsage();
}

async function refreshUsage() {
  if (loading || !selectedAccountId) return;

  setLoading(true);
  setStatus("Refreshing usage…");
  els.updated.textContent = "";

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      updateAuthUi();
      renderSignedOut();
      throw new Error("Session expired. Sign in again.");
    }

    logDiagnostic("usage.request", {
      plan: selectedPlan,
      deployMetricsAccess: hasDeployMetricsAccess(),
      auth: getAuthDiagnostics()
    });

    const cards = await loadUsage(accessToken, selectedAccountId, selectedPlan, {
      deploymentAccess: hasDeployMetricsAccess()
    });
    renderCards(cards);
    const now = new Date();
    const loaded = cards.filter(card => card.confidence !== "unavailable").length;
    const unavailable = cards
      .filter(card => card.confidence === "unavailable")
      .map(card => ({ service: card.service, metric: card.metric, error: card.error || null }));
    logDiagnostic("usage.success", { loaded, unavailable });
    setStatus(`${loaded} metrics loaded · Workers ${selectedPlan === "paid" ? "Paid" : "Free"}`);
    els.updated.textContent = `Updated ${formatTime(now)}`;
  } catch (error) {
    logDiagnosticError("usage.error", error, { auth: getAuthDiagnostics() });
    setStatus(errorMessage(error), true);
  } finally {
    setLoading(false);
    updateAuthUi();
  }
}

function renderSignedOut() {
  els.accountSelect.replaceChildren(new Option("Sign in first", ""));
  els.accountSelect.disabled = true;
  els.refreshButton.disabled = true;
  els.dashboard.innerHTML = `
    <section class="empty-state">
      <h2>Sign in to Cloudflare</h2>
      <p>OAuth tokens are held in memory only. Reloading or closing this PWA signs you out.</p>
      <button type="button" data-sign-in>Sign in with Cloudflare</button>
    </section>
  `;
  els.dashboard.querySelector("[data-sign-in]")?.addEventListener("click", () => signIn().catch(error => {
    logDiagnosticError("auth.inline_sign_in_error", error, { auth: getAuthDiagnostics() });
    setStatus(errorMessage(error), true);
  }));
  setStatus("Signed out");
  els.updated.textContent = "";
}

function renderSignedInError(error) {
  els.refreshButton.disabled = true;
  els.dashboard.innerHTML = `
    <section class="empty-state">
      <h2>Could not load Cloudflare data</h2>
      <p>${escapeHtml(errorMessage(error))}</p>
      <p>You are still signed in. Sign out and sign in again only if the OAuth grant or scopes need to be changed.</p>
      ${diagnosticMarkup()}
    </section>
  `;
  els.dashboard.querySelector("[data-copy-diagnostics]")?.addEventListener("click", copyDiagnostics);
  setStatus(errorMessage(error), true);
  els.updated.textContent = "";
}

function renderAccountSelect() {
  els.accountSelect.replaceChildren(...accounts.map(account => new Option(account.name, account.id)));
  els.accountSelect.value = selectedAccountId;
  els.accountSelect.disabled = accounts.length < 2;
  els.refreshButton.disabled = false;
}

function renderCards(cards) {
  const grouped = new Map();
  for (const card of cards) {
    if (!grouped.has(card.service)) grouped.set(card.service, []);
    grouped.get(card.service).push(card);
  }

  els.dashboard.replaceChildren(...[...grouped.entries()].map(([service, metrics]) => {
    const section = document.createElement("details");
    section.className = "service";
    section.open = true;

    const summary = document.createElement("summary");
    const heading = document.createElement("h2");
    heading.textContent = service;
    summary.append(heading);
    section.append(summary);

    const grid = document.createElement("div");
    grid.className = "metric-grid";
    for (const metric of metrics) grid.append(renderMetric(metric));
    section.append(grid);
    return section;
  }));
}

function renderMetric(card) {
  const article = document.createElement("article");
  const level = card.confidence === "unavailable" ? "unavailable" : severity(card.ratio);
  article.className = `metric ${level}`;

  if (card.confidence === "unavailable") {
    article.innerHTML = `
      <div class="metric-head"><h3>${escapeHtml(card.metric)}</h3><span class="badge">Unavailable</span></div>
      <p class="metric-value">—</p>
      <p class="metric-note">${escapeHtml(card.error || "Analytics are unavailable for this account or plan.")}</p>
    `;
    return article;
  }

  const usage = formatValue(card.usage, card.unit);
  const allowance = card.allowance == null ? null : formatValue(card.allowance, card.unit);
  const percent = card.ratio == null ? null : Math.max(0, card.ratio * 100);
  const remaining = card.remaining == null ? null : formatValue(card.remaining, card.unit);
  const behavior = behaviorText(card.limitBehavior);

  article.innerHTML = `
    <div class="metric-head">
      <h3>${escapeHtml(card.metric)}</h3>
      <span class="badge">${percent == null ? escapeHtml(card.confidence) : `${formatPercent(percent)}%`}</span>
    </div>
    <p class="metric-value">${usage}${allowance ? `<span> / ${allowance}</span>` : ""}</p>
    ${percent == null ? "" : `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, percent).toFixed(0)}"><span style="width:${Math.min(100, percent)}%"></span></div>`}
    <dl>
      ${remaining == null ? "" : `<div><dt>Remaining</dt><dd>${remaining}</dd></div>`}
      <div><dt>Period</dt><dd>${escapeHtml(card.period || "—")}</dd></div>
      ${card.resetAt ? `<div><dt>Reset</dt><dd>${escapeHtml(formatReset(card.resetAt))}</dd></div>` : ""}
      <div><dt>Limit</dt><dd>${escapeHtml(behavior)}</dd></div>
    </dl>
    ${card.note ? `<p class="metric-note">${escapeHtml(card.note)}</p>` : ""}
    ${card.confidence === "estimate" ? `<p class="metric-note">Estimate — not billing-canonical.</p>` : ""}
  `;
  return article;
}

function updateAuthUi() {
  const signedIn = isSignedIn();
  els.authButton.textContent = signedIn ? "Sign out" : "Sign in";
  if (!signedIn) {
    els.refreshButton.disabled = true;
    els.accountSelect.disabled = true;
  }
}

function setLoading(value) {
  loading = value;
  els.refreshButton.toggleAttribute("aria-busy", value);
  els.authButton.disabled = value;
  if (value) els.refreshButton.disabled = true;
  else if (isSignedIn() && selectedAccountId) els.refreshButton.disabled = false;
}

function setStatus(message, error = false) {
  els.status.textContent = message;
  els.status.dataset.level = error ? "error" : "normal";
}

function logDiagnostic(event, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    event,
    ...details
  };
  const line = JSON.stringify(entry);
  diagnostics.push(line);
  if (diagnostics.length > 80) diagnostics.shift();
  console.info("[cfFreeUsage]", entry);
}

function logDiagnosticError(event, error, details = {}) {
  logDiagnostic(event, {
    ...details,
    error: {
      name: error instanceof Error ? error.name : typeof error,
      message: errorMessage(error),
      kind: error instanceof TypeError ? "network-or-browser-fetch" : "api-or-application"
    }
  });
}

function runtimeDiagnostics() {
  const controller = navigator.serviceWorker?.controller;
  return {
    build: BUILD_ID,
    online: navigator.onLine,
    standalone: window.matchMedia?.("(display-mode: standalone)")?.matches || false,
    serviceWorkerControlled: Boolean(controller),
    serviceWorkerScript: controller?.scriptURL || null,
    origin: location.origin,
    path: location.pathname
  };
}

function diagnosticMarkup() {
  return `
    <details open>
      <summary>Diagnostics</summary>
      <pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:.68rem;line-height:1.35;max-height:24rem;overflow:auto">${escapeHtml(diagnostics.join("\n"))}</pre>
      <button type="button" data-copy-diagnostics>Copy diagnostics</button>
      <p class="metric-note">Tokens, OAuth codes, PKCE verifiers, and account IDs are not logged.</p>
    </details>
  `;
}

async function copyDiagnostics() {
  const text = diagnostics.join("\n");
  try {
    await navigator.clipboard.writeText(text);
    logDiagnostic("diagnostics.copied", { lines: diagnostics.length });
  } catch (error) {
    logDiagnosticError("diagnostics.copy_error", error);
  }
}

function severity(ratio) {
  if (ratio == null) return "normal";
  if (ratio >= 1) return "danger";
  if (ratio >= 0.8) return "warning";
  return "normal";
}

function behaviorText(value) {
  if (value === "blocks") return "Stops / rejects at limit";
  if (value === "bills") return "Overage may be billed";
  if (value === "feature_unavailable") return "Feature unavailable";
  return "Unknown";
}

function formatValue(value, unit) {
  if (value == null) return "—";
  if (unit === "bytes") return formatBytes(value);
  if (unit === "minutes") {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} min`;
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: index ? 2 : 0 }).format(value)} ${units[index]}`;
}

function formatPercent(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
}

function formatReset(iso) {
  const date = new Date(iso);
  return `${date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} (${date.toLocaleTimeString(undefined, { timeZoneName: "short" }).split(" ").at(-1)})`;
}

function formatTime(date) {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    logDiagnostic("service_worker.unsupported");
    return;
  }

  navigator.serviceWorker.register("/sw.js?v=__COMMIT_SHA__", { updateViaCache: "none" })
    .then(registration => {
      logDiagnostic("service_worker.registered", {
        scope: registration.scope,
        controllerScript: navigator.serviceWorker.controller?.scriptURL || null
      });
      return registration.update();
    })
    .then(() => logDiagnostic("service_worker.update_checked"))
    .catch(error => logDiagnosticError("service_worker.error", error));
}
