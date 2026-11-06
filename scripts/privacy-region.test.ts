import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/_middleware.ts";

const marker = 'name="inshell-measurement-region"';
const shell = '<html><head><title>Fixture</title></head><body>App</body></html>';
function context(country: unknown, url = "https://inshell.art/", method = "GET", body = shell, status = 200, contentType = "text/html") {
  const request = new Request(url, { method, headers: { "cf-ipcountry": "US", "x-country": "US" } });
  if (country !== undefined) Object.defineProperty(request, "cf", { value: new Proxy({ country }, {
    get(target, key) { assert.equal(key, "country", "Only country may be read"); return target.country; },
  }) });
  let assets = 0, next = 0;
  return { request, env: { ASSETS: { fetch: async () => {
    assets++;
    return new Response(method === "HEAD" ? null : body, { status, headers: {
      "content-type": contentType, "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "cdn-cache-control": "public, max-age=600", "cloudflare-cdn-cache-control": "public, max-age=900",
      "surrogate-control": "max-age=1200", etag: '"shared-shell"', "last-modified": "Thu, 01 Jan 1970 00:00:00 GMT",
      expires: "Fri, 01 Jan 2100 00:00:00 GMT", age: "55",
    } });
  } } }, next: async () => { next++; return new Response("untouched", { headers: { "cache-control": "public, max-age=999" } }); },
  counts: () => ({ assets, next }) };
}

const denied = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH GB".split(" ");
for (const country of denied) test(`restricted ${country} emits only off`, async () => {
  const response = await onRequest(context(country));
  const text = await response.text();
  assert.ok(text.includes(`<meta ${marker} content="off" />`));
  assert.ok(!text.includes(`content="${country}"`));
  assert.equal(response.headers.get("set-cookie"), null);
});
for (const country of [undefined, null, "", "XX", "T1", "ZZ", "EU", "UK", "us", " US", "USA", 42, {}, "US\n"])
  test(`unknown/malformed country ${JSON.stringify(country)} fails closed despite headers`, async () => {
    assert.match(await (await onRequest(context(country))).text(), /inshell-measurement-region" content="off"/);
  });

test("native country cannot be substituted by query or asset response headers", async () => {
  assert.match(await (await onRequest(context(undefined, "https://inshell.art/path?country=US"))).text(), /content="off"/);
});
for (const countries of [["US", "DE"], ["DE", "US"], ["US", undefined], [undefined, "US"]]) {
  test(`same shell requested in order ${countries.join(" then ")}: no shared eligibility`, async () => {
    for (const country of countries) {
      const response = await onRequest(context(country));
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      for (const header of ["cdn-cache-control", "cloudflare-cdn-cache-control", "surrogate-control", "expires", "age", "etag", "last-modified", "vary", "set-cookie"])
        assert.equal(response.headers.get(header), null, header);
      const html = await response.text();
      assert.equal((html.match(/inshell-measurement-region/g) ?? []).length, 1);
      assert.ok(html.includes(`content="${country === "US" ? "eligible" : "off"}"`));
    }
  });
}
for (const url of ["https://preview.inshell.art/", "http://127.0.0.1:5177/", "https://staging.inshell-art.pages.dev/",
  "https://inshell.art/path", "https://inshell.art/docs", "https://inshell.art/docs/agent-art", "https://inshell.art/will", "https://inshell.art/gallery",
  "https://inshell.art:444/path", "http://inshell.art/path", "https://inshell.art/thought", "https://inshell.art/path/2", "https://inshell.art/path?q=1", "https://inshell.art/path#private"])
  test(`eligible country cannot qualify excluded URL ${url}`, async () => {
    assert.match(await (await onRequest(context("US", url))).text(), /inshell-measurement-region" content="off"/);
  });

test("existing asset marker is replaced, never shared", async () => {
  const html = await (await onRequest(context("DE", undefined, "GET", shell.replace("</head>", `<meta content="eligible" ${marker}></head>`)))).text();
  assert.equal((html.match(/inshell-measurement-region/g) ?? []).length, 1);
  assert.match(html, /inshell-measurement-region" content="off"/);
});
for (const [method, status, type] of [["HEAD", 200, "text/html"], ["POST", 200, "text/html"], ["GET", 503, "text/html"], ["GET", 200, "application/json"], ["GET", 200, "text/html-fake"]] as const)
  test(`${method} ${status} ${type} does not gain a marker`, async () => {
    const response = await onRequest(context("US", undefined, method, shell, status, type));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(await response.text(), method === "HEAD" ? "" : shell);
  });

for (const route of ["/api/ops/status", "/api/analytics/summary", "/api/analytics/visitors", "/assets/main.js", "/docs/agent-index.json"])
  test(`retained non-shell ${route} unchanged`, async () => {
    const ctx = context("US", `https://inshell.art${route}`);
    const response = await onRequest(ctx);
    assert.deepEqual(ctx.counts(), { assets: 0, next: 1 });
    assert.equal(await response.text(), "untouched");
    assert.equal(response.headers.get("cache-control"), "public, max-age=999");
  });
for (const method of ["GET", "HEAD"]) for (const route of ["/pub/contract/test", "/llms.txt", "/feed.xml", "/api/thought-agent/v2/runs"])
  test(`retired ${method} ${route} retains its non-SPA status`, async () => {
    const ctx = context("US", `https://inshell.art${route}`, method);
    const response = await onRequest(ctx);
    assert.equal(response.status, route.startsWith("/api/thought-agent/") ? 410 : 404);
    assert.deepEqual(ctx.counts(), { assets: 0, next: 0 });
    assert.ok(!(await response.text()).includes(marker));
  });

test("immutable protocol artifact retains bytes and shared immutable caching", async () => {
  const ctx = context("US", "https://inshell.art/protocol/releases/path-v0.5.0/manifest.json", "GET", '{"fixture":true}', 200, "application/json");
  const response = await onRequest(ctx);
  assert.equal(await response.text(), '{"fixture":true}');
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.deepEqual(ctx.counts(), { assets: 1, next: 0 });
});

test("unreadable native metadata fails closed", async () => {
  const ctx = context(undefined);
  Object.defineProperty(ctx.request, "cf", { get() { throw Error("synthetic metadata unavailable"); } });
  assert.match(await (await onRequest(ctx)).text(), /inshell-measurement-region" content="off"/);
});
