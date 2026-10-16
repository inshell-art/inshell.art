import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/_middleware";
import { isRetiredThoughtPath } from "../packages/shared/src/retired-thought";
import { plainReturnEntryPlugin } from "../apps/thought/scripts/plain-return-entry";

const paths = ["", "/runs", "/runs/fake", ...["bootstrap", "claim-authorization", "claim", "ready", "start", "result", "fail", "cancel"].map(x => `/runs/fake/${x}`), "/connectivity", "/client"];
const retired = [1, 2].flatMap(v => paths.map(p => `/api/thought-agent/v${v}${p}`));
retired.push("/thought/runs/fake", "/runs/fake", "/thought/agent-demo", "/thought/plugin/codex", "/plugin/claude", "/api/%74hought-agent/v2/runs/fake");
const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

test("all legacy routes and methods retire before environment, storage, redirect or SPA access", async () => {
  for (const pathname of retired) for (const method of methods) {
    const response = await onRequest({
      request: new Request(`https://thought.inshell.art${pathname}`, { method }),
      get env(): never { throw Error("Retirement must not inspect bindings or D1"); },
      next: async () => { throw Error("Must not reach asset/SPA fallback"); },
    });
    assert.equal(response.status, 410, `${method} ${pathname}`);
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.text();
    if (method === "HEAD") assert.equal(body, "");
    else assert.equal(JSON.parse(body).error.code, "LEGACY_THOUGHT_RETIRED");
  }
});

test("current plain and retained product paths are not retired", () => {
  for (const path of ["/thought", "/thought/2", "/gallery", "/path", "/docs", "/api/pulse-auction", "/api/thought-plain/v1/runs/fake/return", "/api/thought-agent/v20/runs"]) {
    assert.equal(isRetiredThoughtPath(path), false, path);
  }
});

test("Vite rejects retired paths before proxying without body/header/storage access", async () => {
  let handler: (req: unknown, res: unknown, next: () => void) => void;
  const plugin = plainReturnEntryPlugin(process.cwd());
  const configure = plugin.configureServer as (server: unknown) => void;
  configure({ middlewares: { use(value: typeof handler) { handler = value; } } });
  for (const url of retired) for (const method of methods) {
    let status = 0;
    const body = await new Promise<string>((resolve) => {
      handler({ url, method, get headers() { throw Error("No credentials"); } }, {
        writeHead(code: number) { status = code; }, end: resolve,
      }, () => { throw Error(`Unexpected proxy: ${url}`); });
    });
    assert.equal(status, 410);
    if (method === "HEAD") assert.equal(body, "");
    else assert.equal(JSON.parse(body).error.code, "LEGACY_THOUGHT_RETIRED");
  }
});
