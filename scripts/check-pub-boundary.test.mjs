import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import test from "node:test";

const checker = readFileSync(new URL("./check-pub-boundary.mjs", import.meta.url), "utf8");
const middleware = [
  "export async function onRequest(ctx) {",
  "  const url = new globalThis.URL(ctx.request.url);",
  "  if (isRetiredPublicPathname(url.pathname)) {",
  "    return retiredPublicNotFound(ctx.request);",
  "  }",
  "  return ctx.next();",
  "}",
  "function isRetiredPublicPathname(pathname) {",
  '  return ["/llms.txt", "/pub.manifest.json", "/rss.xml", "/feed.xml", "/rss.sepolia.xml", "/events.json"].includes(pathname)',
  '    || ["/pub", "/source", "/source-assets"].some(',
  "      (root) => pathname === root || pathname.startsWith(`${root}/`),",
  "    );",
  "}",
  "function retiredPublicNotFound(request) {",
  '  return new Response(request.method === "HEAD" ? null : "Not found.", {',
  "    status: 404,",
  "  });",
  "}",
].join("\n");

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "inshell-pub-retirement-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write("scripts/check-pub-boundary.mjs", checker);
  write("functions/_middleware.ts", middleware);
  const run = (args = []) => spawnSync(process.execPath, ["--input-type=module", "-e",
    // The checker must not fetch, even when legacy environment settings survive.
    'globalThis.fetch = () => { throw new Error("Unexpected network fetch"); };' +
    `process.argv = [process.execPath, ${JSON.stringify(join(root, "scripts/check-pub-boundary.mjs"))}, ...${JSON.stringify(args)}];` +
    `await import(${JSON.stringify(pathToFileURL(join(root, "scripts/check-pub-boundary.mjs")).href)});`,
  ], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PUB_BOUNDARY_CONTRACT_URL: "https://retired.invalid/contract.json" },
  });
  return { write, run };
}

function expectFailure(result, pattern) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, pattern);
  assert.doesNotMatch(result.stderr, /Unexpected network fetch/);
}

test("accepts local retirement guards while preserving docs and active chain API paths without fetching", (t) => {
  const { write, run } = fixture(t);
  write("apps/home/public/docs/agent-index.json", JSON.stringify({ topic: "THOUGHT" }));
  write("apps/home/public/docs/topics/path.md", "$PATH documentation");
  write("functions/api/pulse-auction.ts", "export const onRequest = () => new Response('ok');");
  write("apps/home/public/_redirects", "/old /docs/path 302\n");
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /owner=retired exact=9 prefixes=3/);
  assert.match(result.stdout, /externalFetches=0/);
});

for (const path of [
  "llms.txt", "pub.manifest.json", "pub", "pub/index.html", "pub/contract/pub-path-boundary.json",
  "rss.xml", "feed.xml", "rss.sepolia.xml", "events.json", "source", "source/index.html",
  "source/record.json", "source-assets", "source-assets/image.svg", "pub.html", "%70ub/index.html",
  "rss.xml/index.html", "llms.txt.html",
]) {
  test(`rejects retired static output ${path}`, (t) => {
    const { write, run } = fixture(t);
    write(`apps/home/public/${path}`, "retired output");
    expectFailure(run(), /static/);
  });
}

test("checks compiled output as well as source public directories", (t) => {
  const { write, run } = fixture(t);
  write("dist/home/pub/record.json", "{}");
  expectFailure(run(), /dist\/home\/pub\/record.json/);
});

for (const rule of [
  "/pub /index.html 200", "/pub/* /docs/:splat 200", "/old /source/item 302",
  "/* /index.html 200", "/:slug /index.html 200",
  "/old https://inshell-public-feed.pages.dev/anything 302",
  "/old https://d807d286.inshell-public-feed.pages.dev/anything 302",
]) {
  test(`rejects retired redirect or SPA rewrite: ${rule}`, (t) => {
    const { write, run } = fixture(t);
    write("dist/home/_redirects", `${rule}\n`);
    expectFailure(run(), /redirect-|legacy-upstream/);
  });
}

for (const path of ["pub.ts", "pub/index.ts", "pub/[artifact].ts", "source/[id].ts", "[slug].ts", "[[path]].ts"]) {
  test(`rejects a Function route reclaiming a retired URL: ${path}`, (t) => {
    const { write, run } = fixture(t);
    write(`functions/${path}`, "export const onRequest = () => new Response('content');");
    expectFailure(run(), /api-route/);
  });
}

test("rejects retired hosts in active API code and built JavaScript", (t) => {
  const { write, run } = fixture(t);
  write("functions/api/feed-proxy.ts", 'fetch("https://branch.inshell-public-feed.pages.dev/rss.xml");');
  write("dist/home/assets/index.js", 'fetch("https://inshell-pub.pages.dev/pub/catalog.json");');
  const result = run();
  expectFailure(result, /legacy-upstream/);
  assert.match(result.stderr, /functions\/api\/feed-proxy.ts/);
  assert.match(result.stderr, /dist\/home\/assets\/index.js/);
});

for (const [name, mutate, expected] of [
  ["missing route guard", (text) => text.replace("isRetiredPublicPathname(url.pathname)", "false"), /missing-runtime-guard/],
  ["late route guard", (text) => text.replace("  const url =", "  if (ctx.redirect) return ctx.next();\n  const url ="), /invalid-retirement-guard/],
  ["HTTP 200 fallback", (text) => text.replace("status: 404", "status: 200") + '\nfunction unrelated() { return new Response("", {status: 404}); }', /invalid-retirement-guard/],
  ["incomplete inventory", (text) => text.replace('"/pub"', '"/different"'), /missing-router-coverage/],
  ["missing descendants", (text) => text.replace("pathname.startsWith(`${root}/`)", "false"), /invalid-retirement-guard/],
  ["resurrected proxy", (text) => `${text}\nfunction proxyPubArtifact() {}`, /legacy-proxy/],
  ["resurrected upstream", (text) => `${text}\nconst upstream = "https://inshell-pub.pages.dev";`, /legacy-proxy/],
  ["extra middleware route", (text) => `${text}\nfunction accidentalRoute() { return "/pub/record"; }`, /middleware-literal/],
]) {
  test(`fails closed for ${name}`, (t) => {
    const { write, run } = fixture(t);
    write("functions/_middleware.ts", mutate(middleware));
    expectFailure(run(), expected);
  });
}

test("legacy bypass flags cannot change retirement ownership checks", (t) => {
  const { run } = fixture(t);
  expectFailure(run(["--skip-contract-fetch"]), /always enforced/);
});
