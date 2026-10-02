import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { load } from "js-yaml";
import { checkReleaseEvidence, CODEX57_CARRY_FORWARD, COMPOSITE57, COMPOSITE57_RUNS, EVIDENCE_PATH, QUALIFICATION_FILES, validateReleaseEvidence } from "./check-release-evidence.mjs";
import { dependencySecurityErrors } from "./check-dependency-security.mjs";
import { candidatePreviewInvocation } from "./preview-candidate.mjs";
import { checkHome, checkThought, parseArgs, validateOpsStatus, validateContractArrayResponse, validatePlainCapabilities, validatePreviewAliasRejection } from "./smoke-cloudflare-api-routes.mjs";

const commit = "a".repeat(40);
const hash = `sha256:${"b".repeat(64)}`;

const smokeLock = JSON.parse(readFileSync(new URL("../apps/thought/production/deployment-lock.json", import.meta.url)));
const inactiveGallery = { code: "THOUGHT_GALLERY_DEPLOYMENT_INACTIVE", error: "Current THOUGHT collection is not deployed.", status: "not-deployed" };
function smokeStatus() {
  return {
    ok: true, contract: { name: "inshell-dev-ops-chain-read-model", version: 2 },
    deploymentLock: { schema: smokeLock.schema, revision: smokeLock.revision, state: smokeLock.state, requiredRelease: { ...smokeLock.requiredRelease }, enforcement: "always", integrity: "valid", differences: [] },
    network: null, activationPolicy: { deploymentRevision: smokeLock.revision, frontendActivationApproved: false, signerActivationApproved: false, mintActivationApproved: false },
    historicalReadModel: { status: "historical-only", notApprovedForCurrentDeployment: true },
    contracts: { pathNft: { address: null, deployBlock: null }, pulseAuction: { address: null, deployBlock: null }, thoughtNft: { address: null, deployBlock: null, artifactId: null, manifestSha256: null, status: "not-deployed" } },
    routes: { refresh: { route: "/api/indexer/refresh" }, readModel: [{ route: "/api/thought-gallery", status: "not-deployed", snapshotKey: null }], analytics: { eventRoute: "/api/analytics/event", visitorRoute: "/api/analytics/visitors" } },
    anonymousAnalytics: { identity: "anonymous-browser-session", rawIpStored: false, rawUserAgentStored: false, rawVisitIdStored: false, rawWalletAddressStored: false, metadataAllowlist: true, visitTimeoutMinutes: 30 },
  };
}
test("smoke admits only exact gallery absence under the checked source lock; PATH errors are never absence", () => {
  const closed = validateOpsStatus(smokeStatus());
  assert.equal(closed, true);
  assert.doesNotThrow(() => validateContractArrayResponse("/api/thought-gallery", "thoughts", 503, inactiveGallery, closed));
  for (const status of [200, 401, 403, 404, 429, 500, 502, 504]) {
    assert.throws(() => validateContractArrayResponse("/api/thought-gallery", "thoughts", status, inactiveGallery, closed));
  }
  for (const payload of [{ code: "STORE_UNAVAILABLE" }, { ...inactiveGallery, code: "OTHER" }, { ...inactiveGallery, status: "active" }, { ...inactiveGallery, error: "outage" }, { ...inactiveGallery, thoughts: [] }, null]) {
    assert.throws(() => validateContractArrayResponse("/api/thought-gallery", "thoughts", 503, payload, closed));
  }
  assert.throws(() => validateContractArrayResponse("/api/thought-gallery", "thoughts", 200, { thoughts: [] }, closed));
  assert.throws(() => validateContractArrayResponse("/api/thought-gallery", "thoughts", 503, inactiveGallery, false));
  assert.doesNotThrow(() => validateContractArrayResponse("/api/thought-gallery", "thoughts", 200, { thoughts: [] }, false));
  for (const closedState of [false, true]) {
    assert.doesNotThrow(() => validateContractArrayResponse("/api/path-tokens", "items", 200, { items: [] }, closedState));
    for (const status of [401, 403, 404, 429, 500, 503]) assert.throws(() => validateContractArrayResponse("/api/path-tokens", "items", status, { error: "PATH tokens unavailable" }, closedState));
  }
});
for (const [name, mutate] of Object.entries({
  "drift": p => { p.deploymentLock.integrity = "drift"; },
  "differences": p => { p.deploymentLock.differences = ["unexpected-address"]; },
  "disabled enforcement": p => { p.deploymentLock.enforcement = "disabled"; },
  "wrong revision": p => { p.deploymentLock.revision++; },
  "wrong schema": p => { p.deploymentLock.schema = "v1"; },
  "wrong release": p => { p.deploymentLock.requiredRelease.manifestSha256 = "a".repeat(64); },
  "approved mismatch": p => { p.deploymentLock.state = "approved-deployment"; },
  "missing contracts": p => { p.contracts = {}; },
  "missing historical scope": p => { delete p.historicalReadModel; },
  "unscoped old inventory": p => { p.historicalReadModel.notApprovedForCurrentDeployment = false; },
  "non-null contract": p => { p.contracts.pathNft.address = "0x123"; },
  "non-null block": p => { p.contracts.pulseAuction.deployBlock = 1; },
  "non-null artifact": p => { p.contracts.thoughtNft.artifactId = "old"; },
  "network": p => { p.network = { chainId: 11155111 }; },
  "activation": p => { p.activationPolicy.mintActivationApproved = true; },
  "active route": p => { p.routes.readModel[0].status = "active"; },
  "cached gallery": p => { p.routes.readModel[0].snapshotKey = "old"; },
  "missing route": p => { p.routes.readModel = []; },
  "privacy": p => { p.anonymousAnalytics.rawIpStored = true; },
  "raw endpoint": p => { p.endpoint = "https://example.invalid"; },
})) test(`smoke rejects unverified closed state: ${name}`, () => {
  const payload = smokeStatus(); mutate(payload); assert.throws(() => validateOpsStatus(payload));
});
const capabilities = origin => ({ schema: "inshell.thought.plain-capabilities.v1", origin, enabled: true, mintEligible: false, writeTtlMs: 1_800_000, readTtlMs: 86_400_000 });
test("smoke keeps Home plain capability/config and standalone-disabled boundaries strict", () => {
  const origin = "https://inshell.art";
  assert.doesNotThrow(() => validatePlainCapabilities(200, capabilities(origin), origin, true));
  assert.doesNotThrow(() => validatePlainCapabilities(404, { code: "NOT_FOUND" }, origin, false));
  for (const status of [403, 404, 500, 503]) assert.throws(() => validatePlainCapabilities(status, { code: "STORE_UNAVAILABLE" }, origin, true));
  for (const change of [{ enabled: false }, { origin: "https://preview.inshell.art" }, { mintEligible: true }, { writeTtlMs: 0 }, { schema: "other" }]) assert.throws(() => validatePlainCapabilities(200, { ...capabilities(origin), ...change }, origin, true));
  assert.throws(() => validatePlainCapabilities(200, capabilities(origin), origin, false));
  assert.throws(() => validatePlainCapabilities(503, { code: "NOT_FOUND" }, origin, false));
  assert.throws(() => parseArgs(["--allow-unavailable-contracts"]));
});
test("smoke approved deployment never inherits the historical inventory skip", () => {
  const expected = { ...smokeLock, state: "approved-deployment", deployment: { chainId: 11155111 } };
  const payload = smokeStatus();
  payload.deploymentLock.state = expected.state;
  payload.network = { chainId: 11155111 };
  assert.equal(validateOpsStatus(payload, expected), false);
  assert.throws(() => validateContractArrayResponse("/api/path-tokens", "items", 500, { error: "PATH tokens unavailable" }, false));
});
test("smoke staging alias proves only exact origin rejection, never canonical availability", () => {
  assert.doesNotThrow(() => validatePreviewAliasRejection(403, { code: "ORIGIN_NOT_ALLOWED" }));
  for (const status of [200, 302, 401, 404, 500, 503]) assert.throws(() => validatePreviewAliasRejection(status, { code: "ORIGIN_NOT_ALLOWED" }));
  for (const payload of [{ code: "NOT_FOUND" }, { code: "NOT_CONFIGURED" }, { code: "STORE_UNAVAILABLE" }, { code: "ORIGIN_NOT_ALLOWED", enabled: true }, null]) assert.throws(() => validatePreviewAliasRejection(403, payload));
});
test("smoke Home and THOUGHT sequences retain PUB/RPC/read-model checks and never create runs", async t => {
  const calls = [];
  const logs = [];
  t.mock.method(console, "log", line => { logs.push(line); });
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const u = new URL(url); calls.push({ host: u.host, path: u.pathname, method: init.method });
    assert.equal(init.redirect, "error");
    let payload, status = 200;
    if (u.pathname === "/api/ops/status") payload = smokeStatus();
    else if (u.pathname.endsWith("-rpc")) { assert.equal(JSON.parse(init.body).method, "eth_chainId"); payload = { result: "0xaa36a7" }; }
    else if (u.pathname === "/api/pulse-auction") payload = { bids: [] };
    else if (u.pathname === "/api/path-tokens") assert.fail("closed inventory must be skipped, not request or accept a generic 500");
    else if (u.pathname === "/api/thought-gallery") { payload = inactiveGallery; status = 503; }
    else if (u.pathname === "/api/thought-preview") payload = { ok: false };
    else if (u.pathname === "/api/thought-plain/v1/capabilities") {
      if (u.host.includes("thought")) { payload = { code: "NOT_FOUND" }; status = 404; }
      else if (u.host === "staging.inshell-art.pages.dev") { payload = { code: "ORIGIN_NOT_ALLOWED" }; status = 403; }
      else payload = capabilities(u.origin);
    } else if (u.pathname === "/llms.txt") return new Response("PUB test fixture", { headers: { "content-type": "text/plain" } });
    else if (u.pathname === "/pub.manifest.json") payload = { schemaVersion: 1, files: [] };
    else if (u.pathname === "/pub/contract/pub-path-boundary.json") payload = { schemaVersion: 1, origin: "https://inshell.art", owner: "PUB", paths: { exact: [], prefixes: [] } };
    else assert.fail(`unexpected request ${u.pathname}`);
    return Response.json(payload, { status });
  });
  await checkHome("https://inshell.art");
  await checkThought("https://thought.inshell.art");
  await checkHome("https://staging.inshell-art.pages.dev");
  assert.equal(calls.filter(c => c.path === "/api/ops/status").length, 3);
  assert.equal(calls.filter(c => c.path === "/api/path-tokens").length, 0);
  assert.equal(logs.filter(line => line.includes("SKIP") && line.includes("/api/path-tokens") && line.includes("unassessed, not passed")).length, 3);
  assert.equal(calls.filter(c => c.path === "/api/thought-gallery").length, 3);
  assert.equal(calls.filter(c => c.path === "/api/path-rpc").length, 3);
  assert.equal(calls.filter(c => c.path === "/api/thought-rpc").length, 1);
  assert.equal(calls.filter(c => c.path.startsWith("/pub/")).length, 2);
  assert.equal(calls.filter(c => c.path.endsWith("/capabilities")).length, 3);
  assert.equal(calls.some(c => c.host === "preview.inshell.art"), false);
  assert.equal(logs.filter(line => line.includes("NOT CHECKED preview canonical plain capabilities") && line.includes("OPS authenticated verification")).length, 1);
  assert.equal(calls.some(c => c.path.includes("/runs")), false);
});
for (const failure of ["lock", "PUB", "RPC", "auction", "gallery", "plain-config", "redirect"]) {
  test(`smoke full Home sequence blocks ${failure} failure before reporting success`, async t => {
    const timer = globalThis.setTimeout;
    const paths = [], logs = [];
    t.mock.method(globalThis, "setTimeout", (fn, ms, ...args) => timer(fn, ms === 12_000 ? ms : 0, ...args));
    t.mock.method(console, "log", line => { logs.push(line); });
    t.mock.method(globalThis, "fetch", async (url, init) => {
      const path = new URL(url).pathname;
      paths.push(path);
      assert.equal(init.redirect, "error");
      if (failure === "redirect") throw new Error("redirect rejected");
      if (path === "/api/ops/status") {
        const value = smokeStatus(); if (failure === "lock") value.deploymentLock.integrity = "drift";
        return Response.json(value);
      }
      if (path === "/llms.txt") return new Response(failure === "PUB" ? '<div id="root"></div>' : "PUB", { headers: { "content-type": failure === "PUB" ? "text/html" : "text/plain" } });
      if (path === "/pub.manifest.json") return Response.json({ schemaVersion: 1, files: [] });
      if (path === "/pub/contract/pub-path-boundary.json") return Response.json({ schemaVersion: 1, origin: "https://inshell.art", owner: "PUB", paths: { exact: [], prefixes: [] } });
      if (path === "/api/path-rpc") return Response.json({ result: failure === "RPC" ? "0x1" : "0xaa36a7" });
      if (path === "/api/pulse-auction") return Response.json(failure === "auction" ? {} : { bids: [] });
      if (path === "/api/thought-gallery") return Response.json(failure === "gallery" ? { code: "OTHER" } : inactiveGallery, { status: 503 });
      if (path === "/api/thought-plain/v1/capabilities") return Response.json({ code: "STORE_UNAVAILABLE" }, { status: 503 });
      assert.fail(`unexpected request ${path}`);
    });
    const reason = { lock: /reference/, PUB: /DEV app shell/, RPC: /chain id/, auction: /array field/, gallery: /exact inactive/, "plain-config": /capabilities/, redirect: /redirect/ }[failure];
    await assert.rejects(checkHome("https://inshell.art"), reason);
    assert.equal(paths[0], "/api/ops/status");
    if (failure === "lock" || failure === "redirect") {
      assert.ok(paths.every(path => path === "/api/ops/status"));
      assert.equal(logs.some(line => line.includes("SKIP")), false);
    }
  });
}
test("smoke workflow uses lock-driven checks in both branches and tests before publication", () => {
  const deploy = load(readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8"));
  for (const name of ["deploy-home", "deploy-thought"]) {
    const steps = deploy.jobs[name].steps;
    const regression = steps.findIndex(s => /--test-name-pattern=smoke/.test(s.run ?? ""));
    const publication = steps.findIndex(s => /pages deploy/.test(s.run ?? ""));
    assert.ok(regression >= 0 && regression < publication);
    const smoke = steps.find(s => s.name === (name === "deploy-home" ? "Smoke home API routes" : "Smoke THOUGHT API routes"));
    assert.doesNotMatch(smoke.run, /allow-unavailable/);
    assert.match(smoke.run, /main/);
    assert.match(smoke.run, /staging\./);
    assert.equal(steps.find(s => s.uses?.startsWith("actions/checkout@")).with.ref, "${{ github.event.inputs.branch }}");
    assert.match(steps[publication].run, /--branch="\$\{\{ github.event.inputs.branch \}\}"/);
  }
});

test("qualification CI jobs retain history for exact historical delta regressions", () => {
  const workflow = load(readFileSync(new URL("../.github/workflows/test.yml", import.meta.url), "utf8"));
  for (const name of ["build", "fast-feedback"]) {
    const checkout = workflow.jobs[name].steps.find(step => step.uses?.startsWith("actions/checkout@"));
    assert.equal(checkout.with?.["fetch-depth"], 0, name);
  }
});

test("candidate preview uses pinned Pages runtime without inherited deployment authority", () => {
  const invocation = candidatePreviewInvocation("/fixture/repo", {
    PATH: "/fixture/path", HOME: "/operator/home",
    CLOUDFLARE_API_TOKEN: "synthetic-secret", VITE_DEPLOY_ENV: "prod",
    NODE_OPTIONS: "--require=/unrelated/module", HTTPS_PROXY: "http://unrelated.invalid",
  }, "/fixture/node/bin/node");
  assert.equal(invocation.command, "/fixture/node/bin/npx");
  assert.deepEqual(invocation.args.slice(0, 5), ["--yes", "wrangler@4.94.0", "pages", "dev", "dist/home"]);
  assert.ok(!invocation.args.includes("deploy") && !invocation.args.includes("--remote"));
  assert.equal(invocation.args[invocation.args.indexOf("--ip") + 1], "127.0.0.1");
  assert.equal(invocation.args[invocation.args.indexOf("--port") + 1], "4175");
  assert.equal(invocation.args[invocation.args.indexOf("--compatibility-date") + 1], "2026-05-28");
  assert.equal(invocation.env.npm_config_userconfig, "/fixture/repo/tmp/candidate-pages/npm-userconfig");
  assert.equal(invocation.env.npm_config_globalconfig, "/fixture/repo/tmp/candidate-pages/npm-globalconfig");
  assert.equal(Object.hasOwn(invocation.env, "HOME"), false);
  assert.equal(invocation.env.XDG_CONFIG_HOME, "/fixture/repo/tmp/candidate-pages/config");
  assert.equal(invocation.env.WRANGLER_SEND_METRICS, "false");
  assert.equal(invocation.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV, "false");
  for (const name of ["CLOUDFLARE_API_TOKEN", "VITE_DEPLOY_ENV", "NODE_OPTIONS", "HTTPS_PROXY"]) {
    assert.equal(Object.hasOwn(invocation.env, name), false, `${name} must not be inherited`);
  }
  const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts;
  assert.equal(scripts["preview:candidate"], "node scripts/preview-candidate.mjs");
  assert.equal(scripts["test:candidate-browser"], "node scripts/check-candidate-browser.mjs");
});

test("Pages disables implicit all-path SPA fallback with an explicit top-level 404", () => {
  // https://developers.cloudflare.com/pages/configuration/serving-pages/
  // Known app routes are handled by functions/_middleware.ts. Missing assets
  // and API routes must not become a successful Home document response.
  const html = readFileSync(new URL("../apps/home/public/404.html", import.meta.url), "utf8");
  assert.match(html, /<title>Page not found — Inshell<\/title>/);
  assert.match(html, /<a href="\/">Return to Inshell<\/a>/);
  assert.doesNotMatch(html, /<script\b|http-equiv=["']refresh/i);
});
// Synthetic metadata ONLY for validator tests. Never release evidence.
function evidence() {
  return {
    schema: "inshell.thought.release-evidence.v1", candidateCommit: commit,
    reviewedBy: "test-reviewer", reviewedAt: "2026-08-26T01:00:00.000Z",
    cells: ["mac-a"].flatMap((machine) => ["codex", "claude"].map((agent) => ({
      machine, agent, testedCommit: commit, mode: "real-canary", execution: "desktop-deep-link",
      surface: agent === "claude" ? "code" : "codex", state: "returned", runId: `tar_${machine}_${agent}`,
      taskSha256: hash, receiptSha256: `sha256:${(machine === "mac-a" ? (agent === "codex" ? "1" : "2") : (agent === "codex" ? "3" : "4")).repeat(64)}`, agentLineSha256: hash,
      osVersion: "macOS test", appVersion: "test-version", browserVersion: "Chrome test",
      metadataSource: "reported", model: agent === "codex" ? "gpt-5.6" : "claude-opus-5",
      launchObserved: true, previewObserved: true, completedAt: "2026-08-26T00:00:00.000Z",
      origin: "https://preview.inshell.art",
    }))),
  };
}

// Synthetic plain metadata, used only in isolated git-gate tests.
function plainEvidence() {
  const value = unknownModels(evidence());
  value.schema = "inshell.thought.release-evidence.v2";
  for (const cell of value.cells) {
    cell.transport = "plain-http";
    cell.runId = `plain_gate-${cell.agent}`;
    cell.acknowledgementSha256 = cell.receiptSha256;
    delete cell.receiptSha256; delete cell.taskSha256;
    for (const key of ["briefSha256", "recordSha256", "promptLineSha256", "savedRecordSha256", "loadedRecordSha256"]) cell[key] = hash;
    for (const key of ["returnObserved", "reviewObserved", "saveObserved", "reloadObserved", "loadObserved", "integrityChecked"]) cell[key] = true;
    cell.conflict = false; cell.acceptedAt = cell.completedAt;
  }
  return value;
}

test("replacement qualification requires actual plain records; historical v1 stays readable", () => {
  assert.deepEqual(validateReleaseEvidence(plainEvidence()), []);
  assert.deepEqual(validateReleaseEvidence(evidence()), []);
});

function carriedEvidence() {
  const value = plainEvidence();
  value.candidateCommit = CODEX57_CARRY_FORWARD.candidateCommit;
  value.cells.forEach(c => { c.testedCommit = value.candidateCommit; });
  value.cells[0].testedCommit = CODEX57_CARRY_FORWARD.baseCommit;
  value.cells[0].runId = "plain_8f798ee8-9a50-442a-8032-cdec312e21b6";
  value.carryForward = { ...CODEX57_CARRY_FORWARD, qualificationFiles: Object.fromEntries(QUALIFICATION_FILES.map(p => [p, hash])) };
  return value;
}

// Validator fixtures copy the explicitly reviewed identities. They are not new
// canary observations or evidence of execution.
function compositeEvidence() {
  const value = carriedEvidence();
  value.composite = { ...COMPOSITE57 };
  value.reviewedAt = "2026-10-01T12:00:00.000Z";
  for (const cell of value.cells) {
    Object.assign(cell, COMPOSITE57_RUNS[cell.agent]);
    cell.osVersion = "macOS 26.7 (25G229)";
    cell.browserVersion = "unknown";
    cell.savedRecordSha256 = cell.loadedRecordSha256 = cell.recordSha256;
    cell.completedAt = "2026-10-01T11:05:00.000Z";
  }
  return value;
}
const compositeNow = Date.parse("2026-10-02T00:00:00Z");
test("bounded composite preserves Codex source, unknown Claude shell and unknown browsers", () => {
  const value = compositeEvidence();
  assert.equal(value.cells[0].testedCommit, CODEX57_CARRY_FORWARD.baseCommit);
  assert.equal(value.cells[1].testedCommit, null);
  assert.deepEqual(validateReleaseEvidence(value, compositeNow), []);
});
for (const [name, mutate] of Object.entries({
  "missing explicit approval proof": e => { delete e.composite; },
  "missing exact carry-forward": e => { delete e.carryForward; },
  "future candidate": e => { e.candidateCommit = commit; },
  "invented proof field": e => { e.composite.waiver = true; },
  ...Object.fromEntries(Object.keys(COMPOSITE57).map(key => [`altered proof ${key}`, e => { e.composite[key] = "other"; }])),
  ...Object.fromEntries(Object.keys(COMPOSITE57_RUNS.claude).map(key => [`altered Claude ${key}`, e => { e.cells[1][key] = "other"; }])),
  "invented Claude build": e => { e.cells[1].testedCommit = e.candidateCommit; },
  "omitted Claude build": e => { delete e.cells[1].testedCommit; },
  "invented browser version": e => { e.cells[1].browserVersion = "Chrome 154.0.8037.92"; },
  "omitted browser version": e => { delete e.cells[1].browserVersion; },
  "wrong Codex run": e => { e.cells[0].runId = "plain_another-real-run"; },
  "wrong Codex acknowledgement": e => { e.cells[0].acknowledgementSha256 = hash; },
  "invented Codex build": e => { e.cells[0].testedCommit = e.candidateCommit; },
  "wrong machine": e => { e.cells[1].machine = "mac-b"; },
  "wrong OS": e => { e.cells[1].osVersion = "unknown"; },
  "invented model": e => { e.cells[1].model = "invented"; },
  "reported provenance": e => { e.cells[1].metadataSource = "reported"; },
  "missing integrity": e => { e.cells[1].integrityChecked = false; },
  "conflicting return": e => { e.cells[1].conflict = true; },
  "changed saved record": e => { e.cells[1].savedRecordSha256 = hash; },
  "changed loaded record": e => { e.cells[0].loadedRecordSha256 = hash; },
  ...Object.fromEntries(["launchObserved", "previewObserved", "returnObserved", "reviewObserved", "saveObserved", "reloadObserved", "loadObserved"].map(key => [`missing ${key}`, e => { e.cells[1][key] = false; }])),
})) test(`bounded composite rejects ${name}`, () => {
  const value = compositeEvidence(); mutate(value);
  assert.ok(validateReleaseEvidence(value, compositeNow).length);
});
test("unknown source/browser permission never extends to ordinary or optional runs", () => {
  const ordinary = plainEvidence(); ordinary.cells[0].browserVersion = "unknown";
  assert.ok(validateReleaseEvidence(ordinary).length);
  const value = compositeEvidence();
  value.cells.push({ ...value.cells[1], machine: "mac-b", runId: "plain_other-claude-run", acknowledgementSha256: hash });
  assert.ok(validateReleaseEvidence(value, compositeNow).length);
});

test("only the reviewed exact Codex-57 source may carry forward; v1 remains unchanged", () => {
  assert.deepEqual(validateReleaseEvidence(carriedEvidence()), []);
  const value = evidence(); value.carryForward = carriedEvidence().carryForward;
  assert.ok(validateReleaseEvidence(value).length);
});
for (const [name, mutate] of Object.entries({
  "wrong base": e => { e.carryForward.baseCommit = commit; },
  "wrong candidate": e => { e.candidateCommit = commit; },
  "wrong approved target": e => { e.carryForward.candidateCommit = commit; },
  "wrong diff": e => { e.carryForward.diffSha256 = hash; },
  "generic path approval": e => { e.carryForward.paths = ["apps/**"]; },
  "missing qualification digest": e => { delete e.carryForward.qualificationFiles[QUALIFICATION_FILES[0]]; },
  "additional exempt product file": e => { e.carryForward.qualificationFiles["functions/_middleware.ts"] = hash; },
  "different run": e => { e.cells[0].runId = "plain_another-codex-run"; },
  "relabeled Codex source": e => { e.cells[0].testedCommit = e.candidateCommit; },
  "unknown Claude source": e => { delete e.cells[1].testedCommit; },
  "unapproved Claude reuse": e => { e.cells[1].testedCommit = CODEX57_CARRY_FORWARD.baseCommit; },
  "missing real acknowledgement": e => { delete e.cells[0].acknowledgementSha256; },
  "contradictory loaded record": e => { e.cells[1].loadedRecordSha256 = `sha256:${"e".repeat(64)}`; },
  "contradictory provenance": e => { e.cells[0].model = "invented"; },
  ...Object.fromEntries(["launchObserved", "previewObserved", "returnObserved", "reviewObserved", "saveObserved", "reloadObserved", "loadObserved"].map(key => [key, e => { e.cells[0][key] = false; }])),
})) test(`exact carry-forward rejects ${name}`, () => {
  const value = carriedEvidence(); mutate(value);
  assert.ok(validateReleaseEvidence(value).length);
});

test("exact Git delta and reviewed tooling bytes never exempt product or untracked drift", () => {
  const tmp = mkdtempSync(join(tmpdir(), "inshell-exact-carry-"));
  const root = join(tmp, "candidate");
  const source = fileURLToPath(new URL("..", import.meta.url));
  const sha256 = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  try {
    execFileSync("git", ["clone", "--shared", "--no-checkout", source, root], { stdio: "ignore" });
    execFileSync("git", ["checkout", "--detach", CODEX57_CARRY_FORWARD.candidateCommit], { cwd: root, stdio: "ignore" });
    const value = carriedEvidence();
    for (const path of QUALIFICATION_FILES) {
      const file = join(root, path); mkdirSync(dirname(file), { recursive: true });
      // Synthetic internal tooling bytes, not operational release evidence.
      const bytes = `synthetic reviewed correction: ${path}\n`;
      writeFileSync(file, bytes); value.carryForward.qualificationFiles[path] = sha256(bytes);
    }
    writeFileSync(join(root, EVIDENCE_PATH), JSON.stringify(value));
    assert.deepEqual(checkReleaseEvidence(root), []);
    const composite = compositeEvidence();
    composite.reviewedAt = new Date().toISOString();
    composite.carryForward.qualificationFiles = { ...value.carryForward.qualificationFiles };
    writeFileSync(join(root, EVIDENCE_PATH), JSON.stringify(composite));
    assert.deepEqual(checkReleaseEvidence(root), []);
    // Verify complete product equality, not a category/path allowlist. These
    // files cover handoff/permission, launch, transport/auth, storage/artwork,
    // dependencies, provenance, configuration and the supposedly UI-only area.
    for (const path of ["apps/thought/src/plain-return/model.ts", "apps/thought/src/plain-return/view.ts",
      "apps/thought/src/plain-return/client.ts", "functions/_middleware.ts",
      "functions/api/thought-plain/v1/_middleware.ts", "pnpm-lock.yaml",
      "apps/thought/src/thought-v2-renderer.ts", ".github/workflows/deploy-pages.yml",
      "apps/home/src/main.tsx", ...QUALIFICATION_FILES]) {
      const file = join(root, path); const original = readFileSync(file);
      writeFileSync(file, Buffer.concat([original, Buffer.from("\n// unexpected change\n")]));
      assert.ok(checkReleaseEvidence(root).length, path);
      writeFileSync(file, original);
    }
    const requiredFile = join(root, QUALIFICATION_FILES[0]);
    const requiredBytes = readFileSync(requiredFile);
    rmSync(requiredFile);
    assert.match(checkReleaseEvidence(root).join(), /qualification file is unavailable/);
    writeFileSync(requiredFile, requiredBytes);
    writeFileSync(join(root, "unexpected-source.ts"), "export const drift = true;");
    assert.match(checkReleaseEvidence(root).join(), /differs/);
    rmSync(join(root, "unexpected-source.ts"));
    value.carryForward.diffSha256 = hash;
    writeFileSync(join(root, EVIDENCE_PATH), JSON.stringify(value));
    assert.match(checkReleaseEvidence(root).join(), /exact reviewed/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
for (const [name, mutate] of Object.entries({
  "wrong transport": c => { c.transport = "agent-v2"; },
  "legacy run": c => { c.runId = "tar_obsolete"; },
  "fabricated legacy receipt": c => { c.receiptSha256 = hash; },
  "missing acknowledgement": c => { delete c.acknowledgementSha256; },
  "changed save": c => { c.savedRecordSha256 = `sha256:${"d".repeat(64)}`; },
  "changed reload": c => { c.loadedRecordSha256 = `sha256:${"e".repeat(64)}`; },
  "unverified integrity": c => { c.integrityChecked = false; },
  "conflict": c => { c.conflict = true; },
  "uninspected conflict": c => { delete c.conflict; },
  "invented model": c => { c.metadataSource = "reported"; c.model = "some-model"; },
  "future acceptance": c => { c.acceptedAt = "2999-01-01T00:00:00Z"; },
  ...Object.fromEntries(["returnObserved", "reviewObserved", "saveObserved", "reloadObserved", "loadObserved"].map(key => [key, c => { c[key] = false; }])),
})) test(`plain evidence rejects ${name}`, () => {
  const value = plainEvidence(); mutate(value.cells[0]);
  assert.ok(validateReleaseEvidence(value).length);
});

test("two reviewed operator-Mac cells pass; an unqualified template never does", () => {
  assert.deepEqual(validateReleaseEvidence(evidence()), []);
  assert.ok(validateReleaseEvidence({ schema: "inshell.thought.release-evidence.v1", cells: [] }).length);
});

function unknownModels(value) {
  for (const cell of value.cells) {
    cell.metadataSource = "unknown";
    delete cell.model;
  }
  return value;
}

test("explicit unknown metadata qualifies either Agent without inventing a model", () => {
  for (const indices of [[0], [1], [0, 1]]) {
    const value = evidence();
    for (const index of indices) {
      value.cells[index].metadataSource = "unknown";
      delete value.cells[index].model;
    }
    assert.deepEqual(validateReleaseEvidence(value), []);
  }
});

for (const [name, mutate] of Object.entries({
  "missing provenance": (c) => { delete c.metadataSource; },
  "configured provenance": (c) => { c.metadataSource = "configured"; },
  "invalid provenance": (c) => { c.metadataSource = null; },
  "unknown with exact model": (c) => { c.metadataSource = "unknown"; },
  "unknown with null model": (c) => { c.metadataSource = "unknown"; c.model = null; },
  "unknown with literal unknown": (c) => { c.metadataSource = "unknown"; c.model = "unknown"; },
  "reported without model": (c) => { delete c.model; },
  "reported with null model": (c) => { c.model = null; },
  "reported with blank model": (c) => { c.model = " "; },
  "reported with literal unknown": (c) => { c.model = "unknown"; },
  "reported with non-string model": (c) => { c.model = 42; },
})) {
  test(`release model evidence rejects ${name}`, () => {
    const value = evidence(); mutate(value.cells[0]);
    assert.ok(validateReleaseEvidence(value).length > 0);
  });
}

for (const [name, mutate] of Object.entries({
  "missing cell": (e) => e.cells.pop(),
  "duplicate cell": (e) => { e.cells[1] = e.cells[0]; },
  "ordinary ChatGPT": (e) => { e.cells[0].surface = "chatgpt"; },
  "reused run": (e) => { e.cells[1].runId = e.cells[0].runId; },
  "reused receipt": (e) => { e.cells[1].receiptSha256 = e.cells[0].receiptSha256; },
  "wrong candidate": (e) => { e.cells[0].testedCommit = "c".repeat(40); },
  "simulated run": (e) => { e.cells[0].mode = "deterministic"; },
  "timeout": (e) => { e.cells[0].state = "timeout"; },
  "missing receipt": (e) => { e.cells[0].receiptSha256 = null; },
  "fixture model": (e) => { e.cells[0].model = "gpt-5-lab"; },
  "unknown app version": (e) => { e.cells[0].appVersion = "unknown"; },
  "Cowork": (e) => { e.cells[1].surface = "cowork"; },
  "CLI without browser evidence": (e) => { e.cells[0].execution = "cli"; e.cells[0].launchObserved = false; },
  "no visible artwork": (e) => { e.cells[0].previewObserved = false; },
  "localhost only": (e) => { e.cells[0].origin = "http://127.0.0.1:5177"; },
  "credential URL": (e) => { e.cells[0].origin = "https://example:example@preview.inshell.art"; },
  "session field": (e) => { e.cells[0].browserToken = "fixture"; },
  "no review": (e) => { e.reviewedBy = null; },
  "review before completion": (e) => { e.reviewedAt = "2026-08-25T00:00:00Z"; },
  "future completion": (e) => { e.cells[0].completedAt = "2999-01-01T00:00:00Z"; },
  "malformed cell": (e) => { e.cells[0] = null; },
})) {
  test(`release gate rejects ${name}`, () => {
    for (const value of [evidence(), unknownModels(evidence())]) {
      mutate(value);
      assert.ok(validateReleaseEvidence(value).length > 0);
    }
  });
}

test("CLI protocol evidence remains valid with separately recorded launch/preview observations", () => {
  const value = evidence(); value.cells[0].execution = "cli";
  assert.deepEqual(validateReleaseEvidence(value), []);
});

test("optional second-Mac evidence is validated, never required or substituted", () => {
  const value = evidence();
  value.cells.push({ ...value.cells[0], machine: "mac-b", runId: "tar_mac_b_codex", receiptSha256: "sha256:" + "3".repeat(64) });
  assert.deepEqual(validateReleaseEvidence(value), []);
  value.cells[2].mode = "simulated";
  assert.ok(validateReleaseEvidence(value).length);
  value.cells.shift();
  assert.ok(validateReleaseEvidence(value).some((error) => error.includes("Missing cell")));
});

test("git gate permits evidence-only commits and content-identical promotions, rejects drift and missing history", () => {
  const root = mkdtempSync(join(tmpdir(), "inshell-release-gate-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.invalid");
    git("config", "commit.gpgsign", "false");
    writeFileSync(join(root, "app.txt"), "candidate"); git("add", "app.txt"); git("commit", "-m", "candidate");
    const candidate = git("rev-parse", "HEAD");
    const value = plainEvidence(); value.candidateCommit = candidate;
    value.cells.forEach((cell) => { cell.testedCommit = candidate; });
    mkdirSync(join(root, "release-evidence"));
    const save = () => writeFileSync(join(root, EVIDENCE_PATH), JSON.stringify(value));
    save(); git("add", EVIDENCE_PATH); git("commit", "-m", "evidence only");
    assert.deepEqual(checkReleaseEvidence(root), []);
    value.reviewedBy = "second test reviewer"; save(); git("add", EVIDENCE_PATH); git("commit", "-m", "evidence review only");
    assert.deepEqual(checkReleaseEvidence(root), []);
    writeFileSync(join(root, "app.txt"), "drift");
    assert.match(checkReleaseEvidence(root).join(), /differs/);
    git("add", "app.txt"); git("commit", "-m", "source drift");
    assert.match(checkReleaseEvidence(root).join(), /differs/);
    writeFileSync(join(root, "app.txt"), "candidate"); git("add", "app.txt"); git("commit", "-m", "restore source");
    writeFileSync(join(root, "new-code.txt"), "untracked");
    assert.match(checkReleaseEvidence(root).join(), /differs/);
    rmSync(join(root, "new-code.txt"));
    git("checkout", "--orphan", "squash-promotion"); git("commit", "-m", "same tested source, different ancestry");
    assert.deepEqual(checkReleaseEvidence(root), []);
    value.candidateCommit = commit; value.cells.forEach((cell) => { cell.testedCommit = commit; }); save();
    assert.match(checkReleaseEvidence(root).join(), /unavailable/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const lock = (keys) => ({ lockfileVersion: "9.0", packages: Object.fromEntries(keys.map((k) => [k, {}])), snapshots: {} });
test("dependency floors accept current resolved lock, not merely root overrides", () => {
  const actual = load(readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8"));
  assert.deepEqual(dependencySecurityErrors(actual), []);
  const resolved = lock(["@humanfs/node@0.16.8", "browserslist@4.28.7", "nanoid@3.3.18", "nanoid@5.1.6", "postcss@8.5.23", "js-yaml@4.3.2"]);
  resolved.snapshots["@humanfs/node@0.16.8"] = {};
  resolved.snapshots["browserslist@4.28.7"] = {};
  assert.deepEqual(dependencySecurityErrors(resolved), []);
});
for (const version of ["@humanfs/node@0.16.7", "browserslist@4.28.6", "nanoid@3.3.16", "nanoid@5.1.5", "nanoid@4.0.0", "postcss@8.5.22", "js-yaml@4.3.0", "js-yaml@4.3.1", "js-yaml@4.3.2-rc.1", "extract-zip@2.0.1", "nanoid@3.3.18-rc.1"]) {
  test(`dependency guard rejects ${version}, including transitive snapshots`, () => {
    assert.equal(dependencySecurityErrors(lock([version])).length, 1);
    const value = lock(["postcss@8.5.23"]); value.snapshots[version] = {};
    assert.equal(dependencySecurityErrors(value).length, 1);
  });
}
test("dependency guard fails closed for an incomplete lock", () => {
  assert.ok(dependencySecurityErrors({}).length);
});

test("production CI and both publish jobs require release evidence; staging can collect it", () => {
  const ci = load(readFileSync(new URL("../.github/workflows/test.yml", import.meta.url), "utf8"));
  const step = ci.jobs.build.steps.find((s) => s.run === "pnpm run check:release-evidence");
  assert.ok(step); assert.match(step.if, /main/); assert.match(step.if, /base\.ref/);
  const deploy = load(readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8"));
  for (const name of ["deploy-home", "deploy-thought"]) {
    const steps = deploy.jobs[name].steps;
    const gate = steps.findIndex((s) => s.run === "pnpm run check:release-evidence");
    assert.ok(gate >= 0);
    assert.equal(steps[gate].if, "${{ github.event.inputs.branch == 'main' }}");
    assert.equal(steps.find((s) => s.uses?.startsWith("actions/checkout@")).with["fetch-depth"], 0);
    assert.ok(gate < steps.findIndex((s) => /wrangler@[^ ]+ pages deploy/.test(s.run ?? "")));
  }
});
