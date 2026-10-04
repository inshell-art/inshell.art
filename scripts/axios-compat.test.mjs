import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

// Resolve Axios through its actual wallet SDK consumer, not a direct test-only
// dependency. Never instantiate a wallet, authenticate, or access the network.
const require = createRequire(new URL("../node_modules/.pnpm/node_modules/@coinbase/cdp-sdk/package.json", import.meta.url));
const axios = require("axios");

test("wallet SDK and Axios retry integration still import", () => {
  assert.equal(typeof require("./").CdpClient, "function");
  assert.equal(typeof require("axios-retry").default, "function");
  assert.equal(axios.VERSION, "1.20.0");
});

test("wallet's Axios fetch adapter preserves resolved request and interceptors without network", async () => {
  const calls = [];
  const client = axios.create({
    baseURL: "https://wallet.invalid",
    adapter: "fetch",
    env: { fetch: async (request) => {
      assert.ok(request instanceof Request);
      calls.push({ url: request.url, method: request.method, body: await request.text(), header: request.headers.get("x-test") });
      return Response.json({ ok: true });
    } },
  });
  client.interceptors.request.use(config => {
    config.headers.set("x-test", "local-fixture");
    return config;
  });
  client.interceptors.response.use(response => ({ ...response, data: { ...response.data, intercepted: true } }));
  const response = await client.post("/smoke", { hello: "world" });
  assert.deepEqual(response.data, { ok: true, intercepted: true });
  assert.deepEqual(calls, [{ url: "https://wallet.invalid/smoke", method: "POST", body: '{"hello":"world"}', header: "local-fixture" }]);
});
