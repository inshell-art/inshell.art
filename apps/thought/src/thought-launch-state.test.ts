import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveThoughtLaunchState,
  getThoughtMintClosedNotice,
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
    activationApproved: true,
    nowMs,
  }).mintEnabled, false);
  assert.equal(deriveThoughtLaunchState({
    deployment,
    readModel: readModel({ observedAt: "2026-08-21T09:30:00.000Z" }),
    activationApproved: true,
    nowMs,
  }).mintEnabled, false);
  assert.deepEqual(deriveThoughtLaunchState({
    deployment,
    activationApproved: true,
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
    activationApproved: true,
    readModel: readModel({ status: "countdown" }),
    nowMs: Date.parse("2026-08-21T10:00:45.000Z"),
  });
  assert.equal(state.phase, "onchain-countdown");
  assert.equal(state.mintEnabled, false);
});

test("a valid approved deployment and an open auction do not authorize activation", () => {
  const state = deriveThoughtLaunchState({
    deployment, readModel: readModel(), nowMs: Date.parse("2026-08-21T10:00:45.000Z"),
  });
  assert.equal(state.deploymentVerified, true);
  assert.equal(state.phase, "onchain-open");
  assert.equal(state.mintEnabled, false);
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

test("mint-closed notice answers the click instead of describing the surface", () => {
  const notice = getThoughtMintClosedNotice({
    state: deriveThoughtLaunchState({ deployment: null, readModel: null }),
    workCompatible: true,
  });
  assert.equal(notice.title, "Minting is not open yet");
  assert.equal(
    notice.detail,
    "Save this work in your browser and it will be here when minting opens.",
  );
  assert.equal(notice.nextStep, "Save this work in your browser");
  // The banner copy told visitors to create; the click notice must not, since
  // the visitor has already made something and just reached for mint.
  assert.doesNotMatch(
    `${notice.title} ${notice.detail}`,
    /Create a THOUGHT|Write a prompt|Studio|Onchain/i,
  );
});

test("mint-closed notice names the opening when the read model carries one", () => {
  const state = deriveThoughtLaunchState({
    deployment,
    readModel: readModel({
      status: "countdown",
      openTime: "2026-09-01T12:00:00.000Z",
      observedAt: "2026-08-21T10:00:00.000Z",
    }),
    nowMs: Date.parse("2026-08-21T10:00:30.000Z"),
  });
  const notice = getThoughtMintClosedNotice({
    state,
    workCompatible: true,
  });
  // The state stays in the title; the opening time leads the body, ahead of
  // the action the visitor can take.
  assert.equal(notice.title, "Minting is not open yet");
  assert.match(notice.detail, /^Minting opens .+\. Save this work in your browser/);
  assert.equal(notice.nextStep, "Save this work in your browser");
});

test("mint-closed notice explains stale work when minting is open", () => {
  const state = deriveThoughtLaunchState({
    deployment,
    activationApproved: true,
    readModel: readModel({
      status: "open",
      openTime: "2026-08-21T09:00:00.000Z",
      observedAt: "2026-08-21T10:00:00.000Z",
    }),
    nowMs: Date.parse("2026-08-21T10:00:30.000Z"),
  });
  assert.equal(state.mintEnabled, true);
  const notice = getThoughtMintClosedNotice({
    state,
    workCompatible: false,
  });
  assert.equal(notice.title, "Run this work again first");
  assert.equal(notice.nextStep, "Run this work again with your Agent");
});
