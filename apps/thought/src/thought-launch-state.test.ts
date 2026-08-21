import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveThoughtLaunchState,
  getThoughtLaunchGuidance,
  parseThoughtLaunchReadModel,
  shouldFetchThoughtLaunchReadModel,
  thoughtSavedWorkMatchesRelease,
  type ThoughtLaunchDeployment,
} from "./thought-launch-state";

const deployment: ThoughtLaunchDeployment = {
  artifactId: "thought-v2-canonical-portable-release-20260807-r2",
  manifestSha256: "a".repeat(64),
  chainId: 11155111,
  pulseAuction: `0x${"1".repeat(40)}`,
};

const readModel = (overrides: Record<string, unknown> = {}) =>
  parseThoughtLaunchReadModel({
    schema: "inshell.thought.launch-state.v1",
    artifactId: deployment.artifactId,
    manifestSha256: deployment.manifestSha256,
    chainId: deployment.chainId,
    pulseAuction: deployment.pulseAuction,
    openTime: "2026-08-21T10:00:00.000Z",
    observedAt: "2026-08-21T10:00:30.000Z",
    status: "open",
    ...overrides,
  });

test("launch state fails closed without a verified deployment", () => {
  assert.deepEqual(
    deriveThoughtLaunchState({ deployment: null, readModel: null }),
    {
      environment: "public-beta-sepolia",
      phase: "studio-preview",
      chainId: null,
      openTime: null,
      deploymentVerified: false,
      mintEnabled: false,
    },
  );
  assert.equal(shouldFetchThoughtLaunchReadModel({
    deployment: null,
    localRuntime: false,
    simulatedPhase: null,
  }), false);
});

test("countdown requires matching fresh public evidence before opening", () => {
  const nowMs = Date.parse("2026-08-21T10:00:45.000Z");
  assert.equal(deriveThoughtLaunchState({
    deployment,
    readModel: null,
    nowMs,
  }).phase, "onchain-countdown");
  assert.equal(deriveThoughtLaunchState({
    deployment,
    readModel: readModel({ manifestSha256: "b".repeat(64) }),
    nowMs,
  }).mintEnabled, false);
  assert.equal(deriveThoughtLaunchState({
    deployment,
    readModel: readModel({ observedAt: "2026-08-21T09:30:00.000Z" }),
    nowMs,
  }).mintEnabled, false);
  assert.deepEqual(deriveThoughtLaunchState({
    deployment,
    readModel: readModel(),
    nowMs,
  }), {
    environment: "public-beta-sepolia",
    phase: "onchain-open",
    chainId: 11155111,
    openTime: "2026-08-21T10:00:00.000Z",
    deploymentVerified: true,
    mintEnabled: true,
  });
});

test("browser clock never opens a countdown-only read model", () => {
  const state = deriveThoughtLaunchState({
    deployment,
    readModel: readModel({ status: "countdown" }),
    nowMs: Date.parse("2026-08-21T10:00:45.000Z"),
  });
  assert.equal(state.phase, "onchain-countdown");
  assert.equal(state.mintEnabled, false);
});

test("create-only guidance is plain, wallet-free, and does not mention PATH before work", () => {
  const guidance = getThoughtLaunchGuidance({
    state: deriveThoughtLaunchState({ deployment: null, readModel: null }),
    workExists: false,
    workCompatible: false,
    nowMs: Date.now(),
  });
  assert.equal(guidance.eyebrow, "CREATE");
  assert.equal(guidance.title, "Create a THOUGHT");
  assert.match(guidance.meta, /no wallet needed/);
  assert.doesNotMatch(
    `${guidance.eyebrow} ${guidance.title} ${guidance.detail} ${guidance.meta}`,
    /PATH|Studio|Onchain/i,
  );
});

test("countdown introduces one-PATH guidance only after work exists", () => {
  const state = deriveThoughtLaunchState({
    deployment,
    readModel: readModel({ status: "countdown" }),
    nowMs: Date.parse("2026-08-21T09:59:00.000Z"),
  });
  const beforeWork = getThoughtLaunchGuidance({
    state,
    workExists: false,
    workCompatible: false,
    nowMs: Date.parse("2026-08-21T09:59:00.000Z"),
  });
  const afterWork = getThoughtLaunchGuidance({
    state,
    workExists: true,
    workCompatible: true,
    nowMs: Date.parse("2026-08-21T09:59:00.000Z"),
  });
  assert.doesNotMatch(beforeWork.detail, /PATH/i);
  assert.doesNotMatch(
    `${beforeWork.eyebrow} ${beforeWork.title} ${beforeWork.detail}`,
    /Studio|Onchain/i,
  );
  assert.match(
    afterWork.detail,
    /one available THOUGHT mint from a \$PATH token/,
  );
});

test("saved frontend work stays mint-compatible only with its exact release", () => {
  const release = {
    manifestSha256: "c".repeat(64),
    thoughtSpecId: `0x${"d".repeat(64)}`,
    thoughtSpecHash: `0x${"e".repeat(64)}`,
  };
  const evidence = {
    thoughtSpecId: release.thoughtSpecId,
    thoughtSpecHash: release.thoughtSpecHash,
    previewMethod: "frontendRender",
    previewEndpointLabel: `pinned:${release.manifestSha256}`,
  };
  assert.equal(thoughtSavedWorkMatchesRelease(evidence, release), true);
  assert.equal(thoughtSavedWorkMatchesRelease({
    ...evidence,
    previewEndpointLabel: `pinned:${"f".repeat(64)}`,
  }, release), false);
  assert.equal(thoughtSavedWorkMatchesRelease({
    ...evidence,
    previewMethod: "previewWork",
  }, release), false);
});
