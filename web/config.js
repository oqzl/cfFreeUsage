export const OAUTH = {
  clientId: "b46be3b9dbc67bb0fc81c09d7b3734a3",
  scopes: [
    "account-settings.read",
    "account-analytics.read",
    "page.read",
    "workers-ci.read",
    "workers-scripts.read"
  ],
  deploymentScopes: ["page.read", "workers-ci.read", "workers-scripts.read"],
  authorizationEndpoint: "https://dash.cloudflare.com/oauth2/auth",
  tokenEndpoint: "https://dash.cloudflare.com/oauth2/token",
  revokeEndpoint: "https://dash.cloudflare.com/oauth2/revoke"
};
