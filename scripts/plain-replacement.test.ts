import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { collectPlainEvidence, collectPlainExports } from "./collect-thought-plain-evidence";
import { makeWork, acknowledge, PENDING_KEY } from "../apps/thought/src/plain-return/model";
import { onRequestPost as v1 } from "../functions/api/thought-agent/v1/runs";
import { onRequestPost as v2 } from "../functions/api/thought-agent/v2/runs";
import { PlainClient, readEarlierWorks } from "../apps/thought/src/plain-return/client";
import { appendThoughtWork } from "../apps/thought/src/works";
import { plainReturnEntryPlugin } from "../apps/thought/scripts/plain-return-entry";

test("public legacy admission is gone before body, credentials or database access", async () => {
  for (const handler of [v1, v2]) {
    const context = new Proxy({}, { get() { throw Error("No context access permitted"); } });
    const response = await handler(context as Parameters<typeof v1>[0]);
    assert.equal(response.status, 410);
    assert.equal((await response.json()).error.code, "LEGACY_CREATION_RETIRED");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("entry includes plain default independently of obsolete transport queries", () => {
  // The actual Vite plugin, not a parallel routing implementation.
  const plugin = plainReturnEntryPlugin(process.cwd());
  assert.equal(plugin.name, "thought-explicit-plain-return-entry");
  assert.equal(plugin.enforce, "pre", "Retirement must precede the pre-enforced legacy dev API");
  const source = readFileSync(new URL("../apps/thought/scripts/plain-return-entry.ts", import.meta.url), "utf8");
  assert.match(source, /if\(p==="\/thought"\|\|p===""\)/);
  assert.doesNotMatch(source, /searchParams.get/);
});

test("old saved works are previewed separately and never written or converted", () => {
  const record = appendThoughtWork([], { prompt: "Past?", returnedText: "One.", title: "Past?", rawOutput: "One.", image: "", route: "agent-v2", provider: "codex", model: "unknown", runContext: { mode: "codex", provider: "codex", model: "unknown", prompt: "Past?", clientGeneratedAt: "2026-09-24T00:00:00.000Z" } }).work;
  const bytes = JSON.stringify([record]);
  const storage = { getItem: (key: string) => key === "thought-works" ? bytes : null, setItem() { throw Error("Must not write"); }, removeItem() { throw Error("Must not delete"); } };
  const [preview] = readEarlierWorks(storage);
  assert.equal(preview.promptLine, "Past?"); assert.equal(preview.agentLine, "One.");
  assert.match(preview.runId, /^historical:/);
  assert.ok(!("provenance" in preview));
  assert.equal(storage.getItem("thought-works"), bytes);
});

function input() {
  const work = makeWork("plain_synthetic-codex", "Hello?", '"One."', "2026-09-30T00:00:00.000Z");
  return { work, acknowledgement: acknowledge(work), savedWork: work, loadedWork: work, conflict: false,
    observations: { machine: "mac-a", agent: "codex", testedCommit: "a".repeat(40), mode: "real-canary", execution: "desktop-deep-link", surface: "codex", osVersion: "macOS test", appVersion: "test", browserVersion: "Chrome test", launchObserved: true, previewObserved: true, returnObserved: true, reviewObserved: true, saveObserved: true, reloadObserved: true, loadObserved: true, completedAt: "2026-09-30T00:01:00.000Z", origin: "https://preview.inshell.art" } };
}
test("collector verifies exact artistic records and actual acknowledgement, emits no text or credentials", () => {
  const result = collectPlainEvidence(input());
  assert.equal(result.metadataSource, "unknown");
  assert.equal(result.recordSha256, result.loadedRecordSha256);
  for (const text of ["Hello?", 'One.', "promptLine\"", "agentLine\"", "browserToken", "Bearer", "svg\""]) assert.ok(!JSON.stringify(result).includes(text));
  assert.match(result.acknowledgementSha256, /^sha256:[a-f0-9]{64}$/);
});
test("collector rejects altered bytes, contradictory acknowledgements and missing observations", () => {
  let value = input(); value.acknowledgement.agentLine = "Two.";
  assert.throws(() => collectPlainEvidence(value));
  value = input(); value.loadedWork = makeWork(value.work.runId, "Hello?", "Two.", value.work.acceptedAt);
  assert.throws(() => collectPlainEvidence(value));
  value = input(); value.conflict = true;
  assert.throws(() => collectPlainEvidence(value));
  value = input(); value.observations.saveObserved = false;
  assert.throws(() => collectPlainEvidence(value));
  value = input(); value.work = { ...value.work, svg: "<svg/>" };
  assert.throws(() => collectPlainEvidence(value));
});

test("visible exports capture acceptance, actual save and reloaded Load without private state", async () => {
  const value = input();
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, text: string) => { data.set(key, text); }, removeItem: (key: string) => { data.delete(key); } };
  const token = "Z".repeat(43);
  data.set(PENDING_KEY, JSON.stringify({ runId: value.work.runId, promptLine: value.work.promptLine, browserToken: token, readExpiresAt: Date.now() + 60000 }));
  const client = new PlainClient(storage, storage, async () => Response.json({ runId: value.work.runId, state: "returned", conflict: false, work: value.work }));
  assert.throws(() => client.exportWork());
  client.restore(); await client.check();
  const accepted = client.exportWork();
  assert.equal(accepted.stage, "accepted");
  assert.equal(accepted.reviewed, false);
  client.review(); client.save();
  const saved = client.exportWork();
  const reloaded = new PlainClient(storage, storage);
  reloaded.load(value.work.runId);
  const loaded = reloaded.exportWork();
  const evidence = collectPlainExports(accepted, saved, loaded, value.acknowledgement, value.observations);
  assert.equal(evidence.recordSha256, evidence.loadedRecordSha256);
  assert.equal(JSON.stringify([accepted, saved, loaded]).includes(token), false);
  assert.deepEqual(Object.keys(accepted).sort(), ["schema", "stage", "work", "conflict", "reviewed"].sort());
  assert.throws(() => collectPlainExports(accepted, saved, saved, value.acknowledgement, value.observations));
  assert.throws(() => collectPlainExports(accepted, { ...saved, reviewed: false }, loaded, value.acknowledgement, value.observations));
  assert.throws(() => collectPlainExports(accepted, saved, loaded, { ...value.acknowledgement, agentLine: "Two." }, value.observations));
  data.clear();
  assert.throws(() => reloaded.exportWork(), "Missing storage is not fabricated from the displayed record");
});
