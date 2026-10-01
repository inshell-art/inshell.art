import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import process from "node:process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { handlePlainRequest, READ_TTL, WRITE_TTL, type PlainEnv } from "../../../../functions/api/thought-plain/v1/_middleware";
import { servePlainRequest, sqliteD1 } from "../../scripts/plain-return-dev";
import { ACK_SCHEMA, API, PENDING_KEY, PINS, SAVED_KEY, createBrief, handoff, makeWork, validateWork } from "./model";
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
function curlArguments(task: string): string[] {
  return [...JSON.parse(/^Curl arguments \(JSON array\): (.+)$/m.exec(task)![1]),
    "--header", /^Authorization: .+$/m.exec(task)![0],
    "--header", /^Content-Type: .+$/m.exec(task)![0],
    "--url", /^URL: (.+)$/m.exec(task)![1]];
}
// Test-only invocation of the handoff's arguments, not a second delivery client.
function nativeCurl(task: string, body: string, curlHome?: string) {
  return new Promise<{ exit: number | null; stdout: string }>((resolve, reject) => {
    const child = spawn("/usr/bin/curl", curlArguments(task), {
      shell: false,
      env: { ...process.env, ...(curlHome ? { CURL_HOME: curlHome } : {}), NO_PROXY: "127.0.0.1", no_proxy: "127.0.0.1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.resume(); // No capability-bearing diagnostics in test output.
    child.on("error", reject);
    child.on("close", exit => resolve({ exit, stdout }));
    child.stdin.on("error", reject);
    child.stdin.end(Buffer.from(body, "utf8"));
  });
}
function verifiedCurlAck(result: Awaited<ReturnType<typeof nativeCurl>>, runId: string, line: string) {
  assert.equal(result.exit, 0);
  assert.equal(result.stdout.slice(-4), "\n200");
  const ack = JSON.parse(result.stdout.slice(0, -4));
  assert.equal(ack.schema, ACK_SCHEMA); assert.equal(ack.runId, runId);
  assert.equal(ack.state, "returned"); assert.equal(ack.agentLine, line);
  return ack;
}
test("both launch paths retain the shared native-curl-only handoff and frozen creative brief", async () => {
  const task = handoff("plain_test0001", "Hello?", origin, "a".repeat(43), Date.now()).text;
  const args = curlArguments(task);
  assert.deepEqual(args.slice(0, -6), ["-q", "--silent", "--show-error", "--request", "POST", "--no-location", "--max-redirs", "0", "--retry", "0", "--connect-timeout", "10", "--max-time", "30", "--data-binary", "@-", "--write-out", "\\n%{http_code}"]);
  for (const text of ["already installed native curl executable", "not a shell alias or wrapper", "do not override User-Agent", "No Python urllib, requests, fetch or other HTTP transport fallback", "stop before submission", "normal host approval", "Keep -q as the first argument", "do not interpolate artwork into shell code or use echo", "must not perform HTTP itself", "do not regenerate or automatically resend", "identical original bytes", "safe error code"]) assert.ok(task.includes(text), text);
  assert.ok(task.includes(createBrief("plain_test0001", "Hello?").text));
  assert.equal(task.split("Authorization: Bearer").length, 2, "Capability is not duplicated into a generated client");
  // The UI uses the identical server handoff for both installed-app launch URLs.
  const view = await readFile(new URL("./view.ts", import.meta.url), "utf8");
  assert.ok(view.includes('[["ChatGPT", "codex://new?", "prompt"], ["Claude", "claude://code/new?", "q"]]'));
  assert.ok(view.includes('link.href = prefix + new URLSearchParams({ [key]: task })'));
  for (const [prefix, key] of [["codex://new?", "prompt"], ["claude://code/new?", "q"]]) {
    const delivered = new URL(prefix + new URLSearchParams({ [key]: task })).searchParams.get(key)!;
    assert.equal(delivered, task);
    // These are generated-instruction checks, not a simulated desktop approval gate.
    const permission = delivered.slice(delivered.indexOf("PHASE 2 — DELIVER THAT SAME LINE"), delivered.indexOf("Method: POST"));
    for (const requirement of [
      "Before the single credential-bearing POST", "inspect the host-provided execution and network permissions",
      "request normal host approval scoped to this delivery in the delivery tool invocation, before the command executes",
      "entire execution command, including any interpreter invoking native curl",
      "Do not assume a curl child inherits a curl-prefix allow rule or that Auto mode grants network access",
      "If permission is denied or unavailable, report the blocker and stop before submission",
      "Do not probe connectivity with the capability or add a handshake",
    ]) assert.ok(permission.includes(requirement), `${prefix}: ${requirement}`);
  }
});
test("native curl ignores config redirects/retries/extra destinations; ACK and uncertain boundaries stay strict", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "thought-curl-config-test-"));
  const requests: { url: string; body: string; userAgent: string }[] = [];
  const runId = "plain_curltest01", line = `"One's: (two), three!"`;
  let mode = "redirect";
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push({ url: req.url!, body: Buffer.concat(chunks).toString("utf8"), userAgent: req.headers["user-agent"] ?? "" });
    if (mode === "disconnect") { req.socket.destroy(); return; }
    if (mode === "redirect") { res.writeHead(307, { Location: "/unexpected" }); res.end(); return; }
    if (mode === "unavailable") { res.writeHead(503, { "Retry-After": "0" }); res.end('{"code":"UNAVAILABLE"}'); return; }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(mode === "malformed" ? "not-json" : JSON.stringify({ schema: ACK_SCHEMA, runId, state: "returned", agentLine: "Different." }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const task = handoff(runId, "Hello?", base, "a".repeat(43), Date.now() + 60000).text;
  try {
    // Synthetic local-only config would add a request and alter client identity if -q regressed.
    await writeFile(path.join(dir, ".curlrc"), `location\nretry = 2\nurl = "${base}/unexpected"\nuser-agent = "wrong-client"\n`);
    for (mode of ["redirect", "unavailable", "malformed", "wrong-ack", "disconnect"]) {
      const before = requests.length;
      const result = await nativeCurl(task, line, dir);
      assert.equal(requests.length, before + 1, "Each synthetic trial makes one POST only");
      const observed = requests.at(-1)!;
      assert.equal(observed.url, `${API}/runs/${runId}/return`);
      assert.equal(observed.body, line); assert.ok(!observed.body.endsWith("\n"));
      assert.match(observed.userAgent, /^curl\/[\d.]+$/);
      if (mode === "redirect") assert.ok(result.stdout.endsWith("\n307"));
      if (mode === "unavailable") assert.ok(result.stdout.endsWith("\n503"));
      if (mode === "disconnect") assert.notEqual(result.exit, 0);
      assert.throws(() => verifiedCurlAck(result, runId, line));
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
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

test("restored pending prompt is available without exposing capability metadata", () => {
  const pending = mem();
  pending.setItem(PENDING_KEY, JSON.stringify({ runId: "plain_restore1", promptLine: "Hello?", browserToken: "a".repeat(43), readExpiresAt: Date.now() + 5000 }));
  const client = new PlainClient(pending, mem());
  client.restore();
  assert.equal(client.pendingPrompt, "Hello?");
  assert.equal(client.state, "waiting");
  pending.setItem(PENDING_KEY, JSON.stringify({ runId: "plain_restore1", promptLine: "Invalid\n", browserToken: "a".repeat(43), readExpiresAt: Date.now() + 5000 }));
  const invalid = new PlainClient(pending, mem()); invalid.restore();
  assert.equal(invalid.pendingPrompt, null);
});

test("cancel confirmation cannot be overwritten by an older poll or duplicate cancellation", async () => {
  const pending = mem();
  pending.setItem(PENDING_KEY, JSON.stringify({ runId: "plain_cancel01", promptLine: "Hello?", browserToken: "a".repeat(43), readExpiresAt: Date.now() + 5000 }));
  let finishRead!: (response: Response) => void, finishCancel!: (response: Response) => void;
  const methods: string[] = [];
  const client = new PlainClient(pending, mem(), async (_input, init) => {
    methods.push(init?.method ?? "GET");
    return new Promise<Response>(resolve => { if (init?.method === "DELETE") finishCancel = resolve; else finishRead = resolve; });
  });
  client.restore();
  const poll = client.poll(), cancel = client.cancel();
  await client.cancel(); await client.check();
  assert.equal(client.state, "waiting");
  assert.throws(() => client.reset());
  finishCancel(Response.json({ runId: "plain_cancel01", state: "cancelled", conflict: false, work: null }));
  await cancel;
  finishRead(Response.json({ runId: "plain_cancel01", state: "pending", conflict: false, work: null }));
  await poll;
  assert.equal(client.state, "cancelled");
  assert.equal(client.pendingPrompt, "Hello?");
  assert.deepEqual(methods, ["GET", "DELETE"]);
});
test("native curl exact-byte submission executes product SQL and ACK, survives reopen, synthetic only", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "thought-plain-product-test-"));
  const filename = path.join(dir, "runs.sqlite");
  let database = new DatabaseSync(filename);
  const env: PlainEnv = { THOUGHT_PLAIN_HTTP_ENABLED: "true", INSHELL_CHAIN_DATA_DB: sqliteD1(database) };
  let posts = 0;
  const server = createServer((req, res) => { if (req.method === "POST" && req.url?.endsWith("/return")) posts++; void servePlainRequest(req, res, env); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`; env.THOUGHT_PLAIN_HTTP_ORIGIN = base;
  try {
    const created = await fetch(base + API + "/runs", { method: "POST", headers: { Origin: base, "Content-Type": "application/json", "X-Thought-Create": "1" }, body: JSON.stringify({ promptLine: "Hello?" }) });
    assert.equal(created.status, 201);
    const run = await created.json();
    const line = `"One's: (two), three!"`;
    const response = await nativeCurl(run.handoff, line);
    verifiedCurlAck(response, run.runId, line);
    assert.equal(posts, 1);
    database.close(); database = new DatabaseSync(filename); env.INSHELL_CHAIN_DATA_DB = sqliteD1(database);
    const status = await fetch(base + API + `/runs/${run.runId}`, { headers: { Authorization: `Bearer ${run.browserToken}` } });
    const work = (await status.json()).work;
    assert.equal(work.agentLine, line);
    assert.ok(!work.agentLine.endsWith("\n"));
    assert.equal(validateWork(work).provenance.mintEligible, false);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    database.close(); await rm(dir, { recursive: true, force: true });
  }
});
