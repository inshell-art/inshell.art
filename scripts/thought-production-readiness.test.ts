import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  THOUGHT_V2_PRODUCTION_DEPLOYMENT,
  readThoughtV2ProductionDeployment,
  readThoughtDeploymentLock, readThoughtActivationPolicy, THOUGHT_DEPLOYMENT_LOCK,
  THOUGHT_ACTIVATION_POLICY, THOUGHT_DEPLOYMENT_LOCK_STATUS,
  DEPLOYMENT_CONTRACT_NAMES, deploymentConfigurationDrift, deploymentOverrideDrift,
} from "../apps/thought/src/thought-v2-production-deployment";
import { assertReviewedLockTransition, verifyDeploymentLockEvidence } from "./deployment-lock-evidence";
import {
  onRequestGet,
  onRequestPost,
} from "../functions/api/thought-contract/v2/attestation";

test("no approved deployment is a valid always-enforced lock", () => {
  assert.equal(readThoughtV2ProductionDeployment(), null);
  assert.equal(THOUGHT_V2_PRODUCTION_DEPLOYMENT, null);
  assert.equal(THOUGHT_DEPLOYMENT_LOCK.state, "no-approved-deployment");
  assert.equal(THOUGHT_DEPLOYMENT_LOCK_STATUS.enforcement, "always");
  assert.deepEqual(deploymentConfigurationDrift(THOUGHT_DEPLOYMENT_LOCK, null), []);
  assert.deepEqual(deploymentConfigurationDrift(THOUGHT_DEPLOYMENT_LOCK, {}), ["deployment"]);
});

const approvedFixture = () => ({
  ...globalThis.structuredClone(THOUGHT_DEPLOYMENT_LOCK), revision: 2, state: "approved-deployment",
  deployment: {
    ...THOUGHT_DEPLOYMENT_LOCK.requiredRelease, chainId: 11155111,
    contracts: Object.fromEntries(DEPLOYMENT_CONTRACT_NAMES.map((name, i) => [name, `0x${String(i + 1).repeat(40)}`])),
    deployBlocks: Object.fromEntries(DEPLOYMENT_CONTRACT_NAMES.map((name, i) => [name, 100 + i])),
    release: { protocolReleaseId: `0x${"a".repeat(64)}`, manifestKeccak256: `0x${"b".repeat(64)}` },
    attestation: { authority: `0x${"c".repeat(40)}`, authorityEpoch: 1 },
  },
  review: { reference: "docs/review-deployment-2.md" },
  evidence: { reference: "evidence/deployment-2.json", sha256: "d".repeat(64) },
});

test("one complete approved deployment is valid without activation approval", () => {
  const lock = readThoughtDeploymentLock(approvedFixture());
  const activation = readThoughtActivationPolicy({ ...THOUGHT_ACTIVATION_POLICY, deploymentRevision: 2 }, lock);
  assert.equal(lock.state, "approved-deployment");
  assert.equal(activation.frontendActivationApproved, false);
  assert.equal(activation.signerActivationApproved, false);
  assert.equal(activation.mintActivationApproved, false);
  assert.deepEqual(deploymentConfigurationDrift(lock, globalThis.structuredClone(lock.deployment)), []);
  assert.deepEqual(deploymentConfigurationDrift(lock, null), ["deployment"]);
  for (const name of DEPLOYMENT_CONTRACT_NAMES) {
    const actual = globalThis.structuredClone(lock.deployment)!;
    actual.contracts[name] = `0x${"f".repeat(40)}`;
    assert.deepEqual(deploymentConfigurationDrift(lock, actual), [`deployment.contracts.${name}`]);
    actual.contracts[name] = lock.deployment!.contracts[name];
    actual.deployBlocks[name] += 1;
    assert.deepEqual(deploymentConfigurationDrift(lock, actual), [`deployment.deployBlocks.${name}`]);
  }
});

test("malformed, legacy, partial, or unpinned references are drift", () => {
  for (const mutation of [
    { schema: "inshell.thought.production-deployment-lock.v1" },
    { enabled: false }, { enabled: true }, { authorization: {} },
    { revision: 0 }, { revision: 1.5 }, { state: "disabled" },
    { requiredRelease: { ...THOUGHT_DEPLOYMENT_LOCK.requiredRelease, manifestSha256: "a".repeat(64) } },
    { deployment: {} }, { evidence: {} },
  ]) {
    assert.throws(() => readThoughtDeploymentLock({ ...THOUGHT_DEPLOYMENT_LOCK, ...mutation }), /drift/);
  }
  for (const name of DEPLOYMENT_CONTRACT_NAMES) {
    const fixture = approvedFixture();
    delete fixture.deployment.contracts[name];
    assert.throws(() => readThoughtDeploymentLock(fixture), /drift/);
    const zero = approvedFixture();
    zero.deployment.contracts[name] = `0x${"0".repeat(40)}`;
    assert.throws(() => readThoughtDeploymentLock(zero), /drift/);
  }
  for (const mutation of [
    { deployment: null }, { evidence: null },
    { evidence: { reference: "../outside.json", sha256: "d".repeat(64) } },
    { deployment: { ...approvedFixture().deployment, chainId: 0 } },
    { deployment: { ...approvedFixture().deployment, manifestSha256: "a".repeat(64) } },
  ]) assert.throws(() => readThoughtDeploymentLock({ ...approvedFixture(), ...mutation }), /drift/);
});

test("explicit deployment override drift is reported without its values", () => {
  const lock = readThoughtDeploymentLock(approvedFixture());
  assert.deepEqual(deploymentOverrideDrift({}), []);
  assert.deepEqual(deploymentOverrideDrift({ VITE_PULSE_AUCTION: lock.deployment!.contracts.pulseAuction }), ["VITE_PULSE_AUCTION"]);
  assert.deepEqual(deploymentOverrideDrift({ VITE_PULSE_AUCTION: lock.deployment!.contracts.pulseAuction }, lock), []);
  assert.deepEqual(deploymentOverrideDrift({ VITE_THOUGHT_CHAIN_ID: "1" }, lock), ["VITE_THOUGHT_CHAIN_ID"]);
});

test("Studio Preview validates deployment overrides in dev as well as published builds", () => {
  const thought = readFileSync(new URL("../apps/thought/src/main.ts", import.meta.url), "utf8");
  const home = readFileSync(new URL("../apps/home/src/main.tsx", import.meta.url), "utf8");
  assert.ok(thought.includes("if (!IS_LOCAL_THOUGHT_V2) assertDeploymentOverrides(import.meta.env)"));
  assert.ok(!thought.includes("if (!IS_DEV_MODE) assertDeploymentOverrides"));
  assert.ok(home.includes("!import.meta.env.DEV || !globalThis.__INSHELL_PATH_CONTRACT_RUNTIME__"));
  assert.ok(home.includes("assertDeploymentOverrides(runtimeEnv)"));
});

test("activation is separately reviewed and revision-bound, never inferred", () => {
  for (const field of ["frontendActivationApproved", "signerActivationApproved", "mintActivationApproved"]) {
    assert.throws(() => readThoughtActivationPolicy({ ...THOUGHT_ACTIVATION_POLICY, [field]: true }), /without approved deployment/);
    assert.throws(() => readThoughtActivationPolicy({ ...THOUGHT_ACTIVATION_POLICY, [field]: "false" }), /drift/);
  }
  assert.throws(() => readThoughtActivationPolicy({ ...THOUGHT_ACTIVATION_POLICY, deploymentRevision: 0 }), /deploymentRevision/);
});

test("intentional changes need a higher revision and new review record", () => {
  assert.doesNotThrow(() => assertReviewedLockTransition(THOUGHT_DEPLOYMENT_LOCK, THOUGHT_DEPLOYMENT_LOCK));
  const next = readThoughtDeploymentLock(approvedFixture());
  assert.doesNotThrow(() => assertReviewedLockTransition(THOUGHT_DEPLOYMENT_LOCK, next));
  assert.throws(() => assertReviewedLockTransition(THOUGHT_DEPLOYMENT_LOCK, { ...next, revision: 1 }), /higher revision/);
  assert.throws(() => assertReviewedLockTransition(THOUGHT_DEPLOYMENT_LOCK, { ...next, review: THOUGHT_DEPLOYMENT_LOCK.review }), /new review/);
  const olderRelease = { ...THOUGHT_DEPLOYMENT_LOCK,
    requiredRelease: { artifactId: "historical-release", manifestSha256: "a".repeat(64) } };
  assert.doesNotThrow(() => assertReviewedLockTransition(olderRelease, next));
  const legacy = { schema: "inshell.thought.production-deployment-lock.v1",
    status: "not-deployed", enabled: false, contracts: null,
    authorization: { deploymentApproved: false, frontendActivationApproved: false, signerActivationApproved: false } };
  assert.doesNotThrow(() => assertReviewedLockTransition(legacy, THOUGHT_DEPLOYMENT_LOCK));
  assert.throws(() => assertReviewedLockTransition({ ...legacy, enabled: true }, THOUGHT_DEPLOYMENT_LOCK), /higher revision/);
  assert.throws(() => assertReviewedLockTransition(legacy, { ...next, revision: 1 }), /higher revision/);
});

test("approved reference requires matching checksummed deployment evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "inshell-lock-evidence-"));
  try {
    mkdirSync(join(root, "docs")); mkdirSync(join(root, "evidence"));
    writeFileSync(join(root, "docs/review-deployment-2.md"), "Synthetic regression fixture, not deployment approval.");
    const fixture = approvedFixture();
    const report = { schema: "inshell.deployment-evidence.v1", deployment: fixture.deployment,
      contracts: Object.fromEntries(DEPLOYMENT_CONTRACT_NAMES.map((name) => [name, {
        address: fixture.deployment.contracts[name], blockNumber: fixture.deployment.deployBlocks[name],
        transactionHash: `0x${"e".repeat(64)}`, runtimeBytecodeSha256: "f".repeat(64),
      }])) };
    const bytes = JSON.stringify(report);
    writeFileSync(join(root, fixture.evidence.reference), bytes);
    fixture.evidence.sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.doesNotThrow(() => verifyDeploymentLockEvidence(readThoughtDeploymentLock(fixture), root));
    fixture.deployment.chainId = 1;
    assert.throws(() => verifyDeploymentLockEvidence(readThoughtDeploymentLock(fixture), root), /identity drift/);
    fixture.deployment.chainId = 11155111;
    writeFileSync(join(root, fixture.evidence.reference), bytes + " ");
    assert.throws(() => verifyDeploymentLockEvidence(readThoughtDeploymentLock(fixture), root), /checksum drift/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("THOUGHT production attestation is observable and fail-closed", async () => {
  const status = onRequestGet();
  assert.equal(status.status, 200);
  assert.equal(status.headers.get("cache-control"), "no-store");
  assert.deepEqual(await status.json(), {
    schema: "inshell.thought.production-attestation-status.v2",
    browserSigning: false,
    deploymentLock: { ...THOUGHT_DEPLOYMENT_LOCK_STATUS, differences: [] },
    activationPolicy: THOUGHT_ACTIVATION_POLICY,
    enabled: false,
    signerLocation: "backend-only",
    status: "not-deployed",
  });

  const rejected = onRequestPost();
  assert.equal(rejected.status, 503);
  assert.deepEqual(await rejected.json(), {
    error: {
      code: "PRODUCTION_ATTESTATION_NOT_AUTHORIZED",
      message: "THOUGHT production attestation is not authorized.",
    },
  });
});

test("attestation status reports unexpected environment configuration as drift", async () => {
  const response = onRequestGet({ env: { VITE_THOUGHT_CHAIN_ID: "unapproved-config-value" } });
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.deploymentLock.integrity, "drift");
  assert.deepEqual(payload.deploymentLock.differences, ["VITE_THOUGHT_CHAIN_ID"]);
  assert.equal(payload.enabled, false);
  assert.doesNotMatch(JSON.stringify(payload), /unapproved-config-value/);
});
