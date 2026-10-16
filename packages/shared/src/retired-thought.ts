// Retirement is independent of deployment, credentials and stored run content.
// Match before proxies, canonical-host redirects and SPA routing.
export function isRetiredThoughtPath(pathname: string): boolean {
  const decoded = pathname.replace(/%([0-9a-f]{2})/gi,
    (_, byte: string) => String.fromCharCode(Number.parseInt(byte, 16)));
  return /^\/api\/thought-agent\/v[12](?:\/|$)/.test(decoded) ||
    /^(?:\/thought)?\/(?:runs|agent-demo|plugin)(?:\/|$)/.test(decoded);
}

export function retiredThoughtResponse(method: string): Response {
  return new Response(method === "HEAD" ? null : JSON.stringify({
    error: { code: "LEGACY_THOUGHT_RETIRED", message: "This THOUGHT interface is retired. Open /thought to create a new work." },
  }), { status: 410, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  } });
}
