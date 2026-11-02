import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/analytics/event.ts";
import { recordAnalyticsEvent, isAnalyticsEnabled, isAnalyticsReadAuthorized, readAnalyticsStatus } from "../functions/api/analytics/store.ts";

test("legacy ingestion and direct writer reject before body, identity or D1 access", async () => {
  const request = new Proxy({} as Request, { get() { throw Error("request accessed"); } });
  const disabledEnv = { INSHELL_ANALYTICS_ENABLED: "true", get INSHELL_CHAIN_DATA_DB(): never { throw Error("D1 touched"); } };
  const result = await onRequest({ request, env: disabledEnv });
  assert.equal(result.status, 410);
  assert.equal(result.headers.get("set-cookie"), null);
  assert.deepEqual(await result.json(), { ok: false, code: "ANALYTICS_RETIRED", stored: false });
  assert.equal(isAnalyticsEnabled(disabledEnv), false);
  assert.deepEqual(await recordAnalyticsEvent(disabledEnv, request, {}), { ok: true, stored: false, duplicate: false, disabled: true });
});
test("retirement preserves auth and reports historical storage separately", async () => {
  const historyEnv = { INSHELL_ANALYTICS_READ_TOKEN: "synthetic-history-fixture" };
  assert.equal(isAnalyticsReadAuthorized(new Request("https://inshell.art/api/analytics/summary"), historyEnv), false);
  assert.equal(isAnalyticsReadAuthorized(new Request("https://inshell.art/api/analytics/summary", { headers: { authorization: "Bearer synthetic-history-fixture" } }), historyEnv), true);
  const status = await readAnalyticsStatus({});
  assert.equal(status.enabled, false); assert.equal(status.collection, "retired");
  assert.equal(status.summaryRoute, "/api/analytics/summary");
  assert.equal(status.visitorRoute, "/api/analytics/visitors");
});
