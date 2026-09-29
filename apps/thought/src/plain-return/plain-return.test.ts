import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { handlePlainRequest, READ_TTL, WRITE_TTL, type PlainEnv } from "../../../../functions/api/thought-plain/v1/_middleware";
import { servePlainRequest, sqliteD1 } from "../../scripts/plain-return-dev";
import { API, PENDING_KEY, PINS, SAVED_KEY, createBrief, handoff, makeWork, validateWork } from "./model";
import { PlainClient, readSaved } from "./client";
import { readThoughtWorks } from "../works";

const origin = "http://127.0.0.1:5190";
const mem = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
};
function setup() {
  const db = new DatabaseSync(":memory:");
  const env: PlainEnv = { THOUGHT_PLAIN_HTTP_ENABLED: "true", THOUGHT_PLAIN_HTTP_ORIGIN: origin, INSHELL_CHAIN_DATA_DB: sqliteD1(db) };
  const call = (suffix: string, init: RequestInit = {}, now?: number) => handlePlainRequest({ request: new Request(origin + API + suffix, init), env }, now);
  const create = async (promptLine = "Hello?", now?: number) => {
    const response = await call("/runs", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Thought-Create": "1", "CF-Connecting-IP": "127.0.0.1" }, body: JSON.stringify({ promptLine }) }, now);
    assert.equal(response.status, 201);
    return response.json() as Promise<{ runId: string; handoff: string; browserToken: string; readExpiresAt: number }>;
  };
  const submit = (run: Awaited<ReturnType<typeof create>>, body: globalThis.BodyInit, headers = {}, now?: number) => call(`/runs/${run.runId}/return`, {
    method: "POST", headers: { Authorization: /Authorization: (Bearer [A-Za-z0-9_-]+)/.exec(run.handoff)![1], "Content-Type": "text/plain; charset=utf-8", ...headers }, body,
    ...(body instanceof globalThis.ReadableStream ? { duplex: "half" } : {}),
  }, now);
  const status = (run: Awaited<ReturnType<typeof create>>, method = "GET", now?: number) => call(`/runs/${run.runId}`, { method, headers: { Authorization: `Bearer ${run.browserToken}` } }, now);
  const browserFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Origin", origin);
    headers.set("CF-Connecting-IP", "127.0.0.1");
    return handlePlainRequest({ request: new Request(origin + String(input), { ...init, headers }), env });
  };
  return { db, env, call, create, submit, status, browserFetch };
}

test("disabled is the default; no D1 access or fallback route", async () => {
  let touched = false;
  const response = await handlePlainRequest({ request: new Request(origin + API + "/runs", { method: "POST" }), env: { INSHELL_CHAIN_DATA_DB: { prepare() { touched = true; throw Error(); } } } });
  assert.equal(response.status, 404); assert.equal(touched, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("explicit origin and binding required; strict route/method/query isolation", async () => {
  const s = setup();
  try {
    for (const suffix of ["/claim", "/runs/plain_test0001/result", "/capabilities?token=x"]) assert.notEqual((await s.call(suffix)).status, 200);
    assert.equal((await s.call("/capabilities", { method: "POST" })).status, 405);
    s.env.THOUGHT_PLAIN_HTTP_ORIGIN = "";
    assert.equal((await s.call("/capabilities")).status, 503);
    s.env.THOUGHT_PLAIN_HTTP_ORIGIN = origin;
    delete s.env.INSHELL_CHAIN_DATA_DB;
    assert.equal((await s.call("/capabilities")).status, 503);
  } finally { s.db.close(); }
});
test("frozen complete brief, canonical rendering, exact quotes and unknown provenance", () => {
  const brief = createBrief("plain_test0001", "Hello?");
  assert.ok(brief.text.includes("Exact human prompt"));
  assert.ok(PINS.creativeBriefSha256 && PINS.selectedSpecSha256 && PINS.mono76FaceSha256);
  const work = makeWork("plain_test0001", "Hello?", '"One."', new Date().toISOString());
  assert.equal(validateWork(work).agentLine, '"One."');
  assert.equal(work.provenance.provider, null);
  assert.equal(work.provenance.model, null);
  assert.equal(work.provenance.appIssuedStartOnlyInput, false);
  assert.equal(work.provenance.mintEligible, false);
  assert.throws(() => validateWork({ ...work, svg: "<svg/>" }));
  const task = handoff(work.runId, work.promptLine, "https://preview.inshell.art", "a".repeat(43), Date.now() + 1000);
  assert.ok(task.text.includes(brief.text));
  assert.ok(task.text.includes("do not regenerate or automatically resend"));
  assert.throws(() => handoff(work.runId, work.promptLine, "http://evil.example", "a".repeat(43), Date.now()));
});
test("same-origin create, scoped capabilities, no token reflection or cleartext persistence", async () => {
  const s = setup();
  try {
    for (const originHeader of ["https://evil.example", "null", ""]) {
      assert.equal((await s.call("/runs", { method: "POST", headers: { Origin: originHeader }, body: "{}" })).status, 403);
    }
    const run = await s.create();
    assert.equal((await s.call(`/runs/${run.runId}`)).status, 401);
    assert.equal((await s.submit(run, "One.", { Authorization: `Bearer ${run.browserToken}` })).status, 401);
    const returnToken = /Bearer ([A-Za-z0-9_-]+)/.exec(run.handoff)![1];
    assert.equal((await s.call(`/runs/${run.runId}`, { headers: { Authorization: `Bearer ${returnToken}` } })).status, 401);
    assert.equal((await s.submit(run, "One.", { Origin: "https://evil.example" })).status, 403);
    const row = JSON.stringify(s.db.prepare("SELECT * FROM thought_plain_runs_v1").all());
    assert.ok(!row.includes(returnToken) && !row.includes(run.browserToken));
    assert.equal((await s.status(run)).headers.get("access-control-allow-origin"), null);
  } finally { s.db.close(); }
});
for (const [label, body, headers] of [
  ["newline", "One.\n", {}], ["empty", "", {}], ["overlong", "a".repeat(65), {}],
  ["JSON envelope", '{"agentLine":"One."}', { "Content-Type": "application/json" }],
  ["BOM", new Uint8Array([239, 187, 191, 65]), {}], ["invalid UTF8", new Uint8Array([255]), {}],
  ["compressed", "One.", { "Content-Encoding": "gzip" }], ["unsupported glyph", "🙂", {}],
] as [string, globalThis.BodyInit, Record<string, string>][]) {
  test(`${label} is rejected without a replacement attempt`, async () => {
    const s = setup();
    try {
      const run = await s.create();
      assert.ok((await s.submit(run, body, headers)).status >= 400);
      assert.equal((await s.submit(run, "One.")).status, 422);
      const status = await (await s.status(run)).json();
      assert.equal(status.state, "rejected"); assert.equal(status.work, null);
    } finally { s.db.close(); }
  });
}
test("64 bytes accepted; idempotent same bytes; conflicting delivery retains first", async () => {
  const s = setup();
  try {
    const run = await s.create();
    const first = await s.submit(run, "a".repeat(64));
    assert.equal(first.status, 200);
    assert.deepEqual(await (await s.submit(run, "a".repeat(64))).json(), await first.json());
    assert.equal((await s.submit(run, "Different.")).status, 409);
    const result = await (await s.status(run)).json();
    assert.equal(result.conflict, true); assert.equal(result.work.agentLine, "a".repeat(64));
  } finally { s.db.close(); }
});
test("simultaneous different returns and cancellation are atomic", async () => {
  const s = setup();
  try {
    const run = await s.create();
    const responses = await Promise.all([s.submit(run, "One."), s.submit(run, "Two.")]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const next = await s.create();
    await Promise.all([s.submit(next, "One."), s.status(next, "DELETE")]);
    const result = await (await s.status(next)).json();
    assert.ok(["returned", "cancelled"].includes(result.state));
    if (result.state === "returned") assert.equal(result.work.agentLine, "One.");
    else assert.equal(result.work, null);
  } finally { s.db.close(); }
});
test("write expires separately from read; release drift cannot silently rebind", async () => {
  const s = setup(), now = Date.now();
  try {
    const run = await s.create("Hello?", now);
    assert.equal((await s.submit(run, "One.", {}, now + WRITE_TTL)).status, 410);
    assert.equal((await (await s.status(run, "GET", now + WRITE_TTL)).json()).state, "expired");
    assert.equal((await s.status(run, "GET", now + READ_TTL)).status, 410);
    s.db.prepare("UPDATE thought_plain_runs_v1 SET brief_hash = 'changed'").run();
    assert.equal((await s.submit(run, "One.")).status, 409);
  } finally { s.db.close(); }
});
test("atomic create limits also apply after cancellation", async () => {
  const s = setup();
  try {
    const init = { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Thought-Create": "1", "CF-Connecting-IP": "127.0.0.1" }, body: JSON.stringify({ promptLine: "Hi" }) };
    const responses = await Promise.all(Array.from({ length: 6 }, () => s.call("/runs", init)));
    assert.equal(responses.filter(r => r.status === 201).length, 2);
    assert.equal(responses.filter(r => r.status === 429).length, 4);
  } finally { s.db.close(); }
});
test("slow request body is bounded, terminal and private", async () => {
  const s = setup();
  try {
    const run = await s.create();
    const response = await s.submit(run, new globalThis.ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([65])); } }));
    assert.equal(response.status, 408);
    assert.deepEqual(await response.json(), { code: "BODY_TIMEOUT" });
    assert.equal((await s.submit(run, "One.")).status, 422);
  } finally { s.db.close(); }
});
test("browser automatic return, lost Agent ack, refresh, review/save/load; legacy store isolation", async () => {
  const s = setup(), pending = mem(), saved = mem();
  try {
    const client = new PlainClient(pending, saved, s.browserFetch);
    await client.available();
    const task = await client.create("Hello?");
    assert.ok(!pending.getItem(PENDING_KEY)!.includes(task));
    const data = JSON.parse(pending.getItem(PENDING_KEY)!);
    const run = { ...data, handoff: task };
    await s.submit(run, '"One."'); // Deliberately never consume the Agent acknowledgement.
    const refreshed = new PlainClient(pending, saved, s.browserFetch);
    refreshed.restore(); await refreshed.check();
    assert.equal(refreshed.state, "review");
    assert.equal(refreshed.work?.agentLine, '"One."');
    assert.throws(() => refreshed.save());
    refreshed.review(); refreshed.save();
    assert.equal(readSaved(saved).length, 1);
    assert.equal(readThoughtWorks(saved, SAVED_KEY).length, 0);
    refreshed.reset(); refreshed.load(data.runId);
    assert.equal(refreshed.state, "saved");
    assert.equal(refreshed.work?.provenance.mintEligible, false);
    saved.setItem(SAVED_KEY, saved.getItem(SAVED_KEY)!.replace('"One.', '"Two.'));
    // All stored artwork used on load is independently reconstructed/validated.
    const tampered = JSON.parse(saved.getItem(SAVED_KEY)!);
    const work = JSON.parse(tampered[0].provenanceJson); work.svg = "<svg onload='alert(1)'/>";
    tampered[0].provenanceJson = JSON.stringify(work); saved.setItem(SAVED_KEY, JSON.stringify(tampered));
    assert.equal(readSaved(saved).length, 0);
  } finally { s.db.close(); }
});
test("lost create acknowledgement does not auto-create another run", async () => {
  let creates = 0;
  const client = new PlainClient(mem(), mem(), async () => { creates++; throw Error("lost reply"); });
  await assert.rejects(client.create("Hello?"));
  await assert.rejects(client.create("Hello?"));
  await client.poll(); await client.check(); await client.cancel();
  assert.throws(() => client.reset());
  assert.equal(client.canInspect, false);
  assert.equal(creates, 1); assert.equal(client.state, "preparation-uncertain");
});
test("unavailable session storage never exposes an unresumable launch or retries creation", async () => {
  const s = setup(); let requests = 0;
  const storage = { ...mem(), setItem() { throw Error("Storage denied"); } };
  const client = new PlainClient(storage, mem(), async (...args) => { requests++; return s.browserFetch(...args); });
  try {
    await assert.rejects(client.create("Hello?"));
    await client.poll(); await client.check(); await client.cancel();
    await assert.rejects(client.create("Hello?"));
    assert.equal(client.state, "preparation-uncertain");
    assert.equal(client.canInspect, false); assert.equal(requests, 1);
  } finally { s.db.close(); }
});
test("automatic reads stop after every terminal state, without resend; manual inspection detects conflicts", async () => {
  for (const terminal of ["review", "saved", "cancelled", "rejected", "expired"] as const) {
    const s = setup(), pending = mem(); let reads = 0, creates = 0;
    const client = new PlainClient(pending, mem(), async (input, init) => {
      if (init?.method === "POST") creates++; else if (!init?.method) reads++;
      return s.browserFetch(input, init);
    });
    try {
      const task = await client.create("Hello?");
      const run = { ...JSON.parse(pending.getItem(PENDING_KEY)!), handoff: task };
      if (terminal === "review" || terminal === "saved") await s.submit(run, "One.");
      if (terminal === "cancelled") await client.cancel();
      if (terminal === "rejected") await s.submit(run, "\n");
      if (terminal === "expired") s.db.prepare("UPDATE thought_plain_runs_v1 SET expires_at = 0").run();
      await client.poll();
      if (terminal === "saved") { client.review(); client.save(); }
      assert.equal(client.state, terminal);
      const before = reads;
      for (let i = 0; i < 10; i++) await client.poll();
      assert.equal(reads, before); assert.equal(creates, 1);
      if (terminal === "review") {
        await s.submit(run, "Two."); await client.check();
        assert.equal(reads, before + 1); assert.equal(client.conflict, true);
        assert.throws(() => client.review());
      }
    } finally { s.db.close(); }
  }
});
test("expired read capability stops uncertain recovery polling locally", async () => {
  const pending = mem(); let reads = 0;
  pending.setItem(PENDING_KEY, JSON.stringify({ runId: "plain_test0001", promptLine: "Hi", browserToken: "a".repeat(43), readExpiresAt: Date.now() + 5000 }));
  const client = new PlainClient(pending, mem(), async () => { reads++; throw Error("offline"); });
  client.restore(); await client.poll(); assert.equal(client.state, "uncertain");
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + READ_TTL;
    await client.poll(); await client.poll();
    assert.equal(reads, 1); assert.equal(client.state, "expired");
  } finally { Date.now = originalNow; }
});
test("real local HTTP executes product SQL, survives reopen, and uses only synthetic capabilities", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "thought-plain-product-test-"));
  const filename = path.join(dir, "runs.sqlite");
  let database = new DatabaseSync(filename);
  const env: PlainEnv = { THOUGHT_PLAIN_HTTP_ENABLED: "true", INSHELL_CHAIN_DATA_DB: sqliteD1(database) };
  const server = createServer((req, res) => { void servePlainRequest(req, res, env); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`; env.THOUGHT_PLAIN_HTTP_ORIGIN = base;
  try {
    const created = await fetch(base + API + "/runs", { method: "POST", headers: { Origin: base, "Content-Type": "application/json", "X-Thought-Create": "1" }, body: JSON.stringify({ promptLine: "Hello?" }) });
    assert.equal(created.status, 201);
    const run = await created.json();
    const response = await fetch(base + API + `/runs/${run.runId}/return`, { method: "POST", headers: { Authorization: /Authorization: (Bearer \S+)/.exec(run.handoff)![1], "Content-Type": "text/plain" }, body: "One." });
    assert.equal(response.status, 200);
    database.close(); database = new DatabaseSync(filename); env.INSHELL_CHAIN_DATA_DB = sqliteD1(database);
    const status = await fetch(base + API + `/runs/${run.runId}`, { headers: { Authorization: `Bearer ${run.browserToken}` } });
    assert.equal((await status.json()).work.agentLine, "One.");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    database.close(); await rm(dir, { recursive: true, force: true });
  }
});
