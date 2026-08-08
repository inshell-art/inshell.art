import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  buildThoughtRunPayload,
  buildThoughtRuntimePrompt,
  toAnthropicMessagesPayload,
  toOpenAIResponsesPayload,
  toOpenRouterChatPayload,
  type ThoughtRunProvider,
  type ThoughtRunRoute,
  type ThoughtRunSpec,
} from "../apps/thought/src/thought-run-payload";
import {
  THOUGHT_V2_PROTOCOL_RELEASE,
  measureThoughtLine,
} from "../packages/thought-agent-protocol/src/index";
import {
  formatThoughtByteLimitUsage,
  normalizePreviewMode,
  prevalidateThoughtCandidate,
  previewUnavailableCliLines,
  thoughtByteLimitPercentage,
} from "../apps/thought/src/thought-preview-policy";
import { createThoughtPollWakeScheduler } from "../apps/thought/src/thought-poll-wake";
import {
  formatThoughtAuthorizationError,
  getThoughtWorkReadyPresentation,
  THOUGHT_PANEL_MINT_UI_MODE,
  THOUGHT_V2_MINT_UNAVAILABLE_COPY,
} from "../apps/thought/src/thought-mint-ui";
import { buildThoughtConsoleLines } from "../apps/thought/src/thought-console";
import { runThoughtConsoleTests } from "../apps/thought/src/thought-console.test";
import { runThoughtMintPresentationTests } from "../apps/thought/src/thought-mint-presentation.test";
import { runThoughtPathAcquisitionTests } from "../apps/thought/src/thought-path-acquisition.test";
import { runThoughtMintTransactionTests } from "../apps/thought/src/thought-mint-transaction.test";
import { runThoughtPathConsumeAuthorizationTests } from "../apps/thought/src/thought-path-consume-authorization.test";
import { runThoughtMintSubmissionLockTests } from "../apps/thought/src/thought-mint-submission-lock.test";
import {
  formatSavedWorkPromptLabel,
  sanitizeWorkRecord,
} from "../apps/thought/src/works";
import {
  canonicalThoughtTitle,
  thoughtProtocolText,
} from "../apps/thought/src/thought-display-text";
import {
  THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES,
  THOUGHT_V2_LOCAL_NFT_ABI,
  THOUGHT_V2_LOCAL_RENDERER_ABI,
  buildThoughtV2LocalProvenance,
  measureThoughtV2TerminalLine,
  thoughtV2AgentLineHash,
  thoughtV2ConversationIdentityHashForLines,
} from "../apps/thought/src/thought-v2-local-mint";
import {
  THOUGHT_V2_WORK_PROFILE_ID as CONTRACT_THOUGHT_V2_WORK_PROFILE_ID,
  deriveThoughtV2WorkHashes as deriveContractThoughtV2WorkHashes,
  measureThoughtV2Line as measureContractThoughtV2Line,
} from "../apps/thought/contract-integration/current/reference/thought-v2-terminal-work-profile";
import {
  CREATION_ATTESTATION_TYPEHASH,
  hashCreationAttestationClaim,
  hashCreationAttestationStruct,
  type ThoughtCreationAttestationClaim,
} from "../apps/thought/contract-integration/current/reference/thought-v2-current-creation-attestation";
import {
  parseThoughtV2EmptyFrameStyle,
  thoughtV2EmptyFrameCanvasRect,
} from "../apps/thought/src/thought-v2-empty-frame";
import {
  THOUGHT_V2_LOCAL_RELEASE,
  alignThoughtV2LocalRpcHost,
  isThoughtV2LocalMintRuntime,
  type ThoughtV2LocalRelease,
  type ThoughtV2LocalRuntimeFacts,
} from "../apps/thought/src/thought-v2-local-release";
import { buildThoughtV2PathAcquisitionBrowserAddresses } from "../apps/thought/src/thought-v2-path-acquisition-runtime";
import {
  assertThoughtV2AnvilRuntime,
  THOUGHT_V2_CURRENT_MINTED_TOPIC,
  type ThoughtV2AnvilRuntime,
} from "../apps/thought/src/thought-v2-contract-client";
import {
  THOUGHT_V2_LOCAL_DEPLOYMENT_MISMATCH_COPY,
  THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY,
  isThoughtV2LocalDeploymentError,
  verifyThoughtV2LocalDeployment,
} from "../apps/thought/src/thought-v2-local-deployment";
import {
  THOUGHT_V2_LOCAL_AGENT_OUTPUT_SCHEMA,
  buildThoughtV2LocalAgentProcess,
  buildThoughtV2LocalAgentResult,
  buildThoughtV2LocalAgentTaskBinding,
  parseThoughtV2LocalAgentResult,
} from "../apps/thought/src/thought-v2-local-agent";
import { describeThoughtTextPolicyIssue } from "../apps/thought/src/thought-text-policy";
import {
  appendThoughtPromptHistory,
  navigateThoughtPromptHistory,
  parseThoughtPromptHistory,
} from "../apps/thought/src/thought-prompt-history";
import {
  JSON_RPC_NO_BATCH_OPTIONS,
  createSingleRequestJsonRpcProvider,
} from "../apps/thought/src/rpc-provider";
import { runThoughtShellAdapterTests } from "../apps/thought/src/surfaceShell/thoughtGoldenTranscripts.test";
import {
  createMemoryStorageAdapter,
  createSurfaceShell,
  parseSurfaceInput,
  redactSurfaceInput,
  shouldRecordSurfaceInput,
  type SurfaceRedactionRule,
} from "../packages/surface-shell-core/src";

const require = createRequire(import.meta.url);
const ethersEntry = require.resolve("ethers", {
  paths: [fileURLToPath(new URL("../apps/thought", import.meta.url))],
});
const { AbiCoder, Interface, id, keccak256, toUtf8Bytes } = await import(ethersEntry);

const thoughtSpec: ThoughtRunSpec = {
  id: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
  ref: THOUGHT_V2_PROTOCOL_RELEASE.spec.ref,
  hash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,
  text: THOUGHT_V2_PROTOCOL_RELEASE.spec.text,
};

const localRelease = THOUGHT_V2_LOCAL_RELEASE;
assert.equal(
  THOUGHT_V2_CURRENT_MINTED_TOPIC,
  id("ThoughtMinted(uint256,address,bytes32,bytes32,bytes32,bytes32,uint256,uint256,bytes32,bytes32)"),
  "gallery reads must use the exact ThoughtMinted topic from the pinned current-V2 ABI",
);
assert.equal(canonicalThoughtTitle("quiet signal"), "QUIET SIGNAL");
assert.equal(thoughtProtocolText("quiet signal", true), "quiet signal");
assert.equal(thoughtProtocolText("静かな信号 🟢", true), "静かな信号 🟢");
assert.equal(
  thoughtProtocolText("静かな信号 🟢", false),
  "",
  "legacy V1 text behavior must remain unchanged",
);
assert.equal(
  localRelease.artifact.id,
  "thought-v2-canonical-portable-release-20260801-r1",
  "local development must bind the immutable canonical portable Contract release",
);
assert.equal(localRelease.artifact.productionConsumable, true);
assert.equal(localRelease.artifact.deploymentAuthorized, false);
const neutralRecordFixtures = JSON.parse(
  await readFile(
    new URL(
      "../apps/thought/contract-release/releases/thought-v2-canonical-portable-release-20260801-r1/fixtures/neutral-agent-model-token-uri-examples.anvil.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  examples: Array<{
    tokenId: number;
    metadata: {
      attributes: Array<{ trait_type: string; value: unknown }>;
      description: string;
      external_url: string;
      properties: Record<string, unknown>;
      thought: {
        records: {
          agent: { keccak256: string; label: string };
          model: { keccak256: string; label: string };
          workIdentityInput: boolean;
        };
      };
    };
  }>;
};
assert.equal(neutralRecordFixtures.examples.length, 3);
for (const { metadata, tokenId } of neutralRecordFixtures.examples) {
  assert.deepEqual(
    metadata.attributes.map(({ trait_type }) => trait_type),
    ["Agent", "Model", "Creation Attestation", "Prompt Bytes", "Agent Bytes"],
  );
  assert.equal(
    metadata.description,
    "THOUGHT V2 preserves a narrow terminal channel between human intention and Agent response, transforming their dialogue into an on-chain artwork.",
  );
  assert.equal(metadata.external_url, `https://inshell.art/thought/${tokenId}`);
  assert.equal(metadata.properties.agent, metadata.thought.records.agent.label);
  assert.equal(
    metadata.properties.agentKeccak256,
    metadata.thought.records.agent.keccak256,
  );
  assert.equal(metadata.properties.model, metadata.thought.records.model.label);
  assert.equal(
    metadata.properties.modelKeccak256,
    metadata.thought.records.model.keccak256,
  );
  assert.equal(metadata.thought.records.workIdentityInput, false);
  assert.equal(
    metadata.attributes.some(({ trait_type }) =>
      /^(Declared|Attested) (Agent|Model)$/.test(trait_type)
    ),
    false,
  );
}
const attestationVectors = JSON.parse(
  await readFile(
    new URL(
      "../apps/thought/contract-release/releases/thought-v2-canonical-portable-release-20260801-r1/protocol/current/v2/attestation/fixtures/creation-attestation-v2-vectors.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  domain: { chainId: string; verifyingContract: `0x${string}` };
  typeHash: `0x${string}`;
  vectors: Array<{
    claim: Omit<ThoughtCreationAttestationClaim, "deadline" | "authorityEpoch"> & {
      deadline: string;
      authorityEpoch: string;
    };
    digest: `0x${string}`;
    structHash: `0x${string}`;
  }>;
};
assert.equal(CREATION_ATTESTATION_TYPEHASH, attestationVectors.typeHash);
for (const vector of attestationVectors.vectors) {
  const claim: ThoughtCreationAttestationClaim = {
    ...vector.claim,
    deadline: BigInt(vector.claim.deadline),
    authorityEpoch: BigInt(vector.claim.authorityEpoch),
  };
  assert.equal(hashCreationAttestationStruct(claim), vector.structHash);
  assert.equal(
    hashCreationAttestationClaim(
      BigInt(attestationVectors.domain.chainId),
      attestationVectors.domain.verifyingContract,
      claim,
    ),
    vector.digest,
  );
}
assert.ok(
  THOUGHT_V2_LOCAL_RENDERER_ABI.some(
    (entry) =>
      entry.type === "function" &&
      entry.name === "IMPLEMENTATION_ID" &&
      entry.stateMutability === "view",
  ),
  "the App must read the active renderer implementation before drawing its empty frame",
);
const currentFrameStyle = parseThoughtV2EmptyFrameStyle(
  "inshell.thought.renderer.v2.mono-76-v1-im76-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom",
);
assert.deepEqual(currentFrameStyle, {
  canvasSize: 960,
  color: "#006100",
  inset: 32,
});
assert.deepEqual(
  thoughtV2EmptyFrameCanvasRect(1024, 1024, currentFrameStyle!),
  { x: 32, y: 32, width: 960, height: 960 },
  "the empty canvas must reserve the exact native 32px work frame",
);
assert.equal(
  parseThoughtV2EmptyFrameStyle("inshell.thought.renderer.v2.native-paths"),
  null,
  "unknown renderer implementation IDs must not silently invent frame geometry",
);
assert.deepEqual(
  THOUGHT_V2_LOCAL_AGENT_OUTPUT_SCHEMA.required,
  ["schema", "release", "agentLine"],
  "the current declaration is optional in the latest Agent result envelope",
);
const localAgentEnvelope = {
  schema: "inshell.thought.agent-result.v2",
  release: {
    protocolReleaseId: localRelease.protocol.protocolReleaseId,
    manifestKeccak256: localRelease.protocol.manifestKeccak256,
  },
  agentLine: "the exact line survives",
} as const;
assert.deepEqual(
  parseThoughtV2LocalAgentResult(JSON.stringify(localAgentEnvelope)),
  localAgentEnvelope,
  "the latest Agent result may omit its declaration",
);
const declaredLocalAgentEnvelope = buildThoughtV2LocalAgentResult(
  "the exact line survives",
  "Codex",
);
assert.deepEqual(
  parseThoughtV2LocalAgentResult(JSON.stringify(declaredLocalAgentEnvelope)),
  declaredLocalAgentEnvelope,
  "the latest Agent result may carry the current declaration",
);
const localAgentEvidence = {
  result: declaredLocalAgentEnvelope,
  runId: "tar_local_v2",
  adapter: "codex",
  rawResponseSha256: "a".repeat(64),
  model: "gpt-5.6-sol",
  reasoningEffort: "ultra",
  metadataSource: "reported",
} as const;
assert.equal(
  formatSavedWorkPromptLabel("  a prompt   with spaces  "),
  "a prompt with spaces",
);
assert.equal(
  formatSavedWorkPromptLabel("abcdefghijklmnopqrstuvwxyz", 12),
  "abcdefghi...",
);

assert.deepEqual(
  parseThoughtPromptHistory('["first prompt","second prompt"]', 50),
  ["first prompt", "second prompt"],
);
assert.deepEqual(parseThoughtPromptHistory("not json", 50), []);
assert.deepEqual(
  appendThoughtPromptHistory(["first prompt"], "first prompt", 50),
  ["first prompt"],
  "consecutive duplicate prompts must not create duplicate history entries",
);
assert.deepEqual(
  appendThoughtPromptHistory(["first prompt", "second prompt"], "third prompt", 2),
  ["second prompt", "third prompt"],
  "prompt history must retain only its newest configured entries",
);
const promptHistoryOlder = navigateThoughtPromptHistory({
  history: ["first prompt", "second prompt"],
  cursor: { index: null, draft: "" },
  currentValue: "draft prompt",
  direction: "older",
});
assert.deepEqual(promptHistoryOlder, {
  handled: true,
  index: 1,
  draft: "draft prompt",
  value: "second prompt",
});
const promptHistoryOldest = navigateThoughtPromptHistory({
  history: ["first prompt", "second prompt"],
  cursor: promptHistoryOlder,
  currentValue: promptHistoryOlder.value,
  direction: "older",
});
assert.equal(promptHistoryOldest.value, "first prompt");
const promptHistoryNewer = navigateThoughtPromptHistory({
  history: ["first prompt", "second prompt"],
  cursor: promptHistoryOldest,
  currentValue: promptHistoryOldest.value,
  direction: "newer",
});
assert.equal(promptHistoryNewer.value, "second prompt");
const promptHistoryDraft = navigateThoughtPromptHistory({
  history: ["first prompt", "second prompt"],
  cursor: promptHistoryNewer,
  currentValue: promptHistoryNewer.value,
  direction: "newer",
});
assert.deepEqual(promptHistoryDraft, {
  handled: true,
  index: null,
  draft: "",
  value: "draft prompt",
});
assert.equal(
  navigateThoughtPromptHistory({
    history: ["first prompt", "second prompt"],
    cursor: { index: null, draft: "" },
    currentValue: "second prompt",
    direction: "older",
  }).value,
  "first prompt",
  "ArrowUp from the currently submitted prompt should reveal the preceding entry",
);
const storedCodexWork = sanitizeWorkRecord({
  id: 1,
  title: declaredLocalAgentEnvelope.agentLine,
  rawOutput: declaredLocalAgentEnvelope.agentLine,
  image: "data:image/svg+xml,local",
  createdAt: "2026-07-16T00:00:00.000Z",
  runContext: {
    mode: "codex",
    provider: "codex",
    model: "codex",
    prompt: "what survives?",
    returnedText: declaredLocalAgentEnvelope.agentLine,
    clientGeneratedAt: "2026-07-16T00:00:00.000Z",
    agentEvidence: localAgentEvidence,
  },
});
assert(storedCodexWork, "Codex work history must survive storage sanitization");
assert.deepEqual(storedCodexWork.runContext.agentEvidence, localAgentEvidence);
assert.equal(
  sanitizeWorkRecord({
    ...storedCodexWork,
    runContext: {
      ...storedCodexWork.runContext,
      agentEvidence: { ...localAgentEvidence, rawResponseSha256: "bad" },
    },
  }),
  null,
  "invalid Agent evidence must fail closed during work-history restore",
);
assert.deepEqual(
  buildThoughtV2LocalAgentProcess(localAgentEvidence, declaredLocalAgentEnvelope.agentLine),
  {
    kind: "agent-run",
    agent: {
      identifier: "codex",
      label: "Codex",
      source: "producer-selected",
    },
    model: {
      identifier: "gpt-5.6-sol/reasoning_effort/ultra",
      label: "GPT-5.6 Sol · Ultra",
      source: "runtime-reported",
    },
    run: {
      adapter: "codex",
      route: "inshell.thought.agent-run",
      reference: "tar_local_v2",
      resultEnvelope: declaredLocalAgentEnvelope,
    },
  },
  "mint provenance must preserve validated Agent declaration and transport evidence",
);
assert.equal(
  buildThoughtV2LocalAgentProcess(
    { ...localAgentEvidence, result: localAgentEnvelope },
    localAgentEnvelope.agentLine,
  ).agent.label,
  "Codex",
  "the selected adapter must supply Agent identity when the result has no legacy declaration",
);
assert.throws(
  () => buildThoughtV2LocalAgentProcess(localAgentEvidence, "different work"),
  /does not match the current work/i,
);
assert.throws(
  () => buildThoughtV2LocalAgentProcess(
    { ...localAgentEvidence, rawResponseSha256: "sha256:bad" },
    declaredLocalAgentEnvelope.agentLine,
  ),
  /transport evidence is incomplete/i,
);
const rejectLocalAgentEnvelope = (value: unknown, message: string) => {
  assert.throws(
    () => parseThoughtV2LocalAgentResult(JSON.stringify(value)),
    undefined,
    message,
  );
};
rejectLocalAgentEnvelope(
  { schema: localAgentEnvelope.schema, agentLine: localAgentEnvelope.agentLine },
  "a legacy result without release anchors must be rejected locally",
);
rejectLocalAgentEnvelope(
  { ...localAgentEnvelope, release: { manifestKeccak256: localRelease.protocol.manifestKeccak256 } },
  "a missing protocol release ID must be rejected locally",
);
rejectLocalAgentEnvelope(
  {
    ...localAgentEnvelope,
    release: { ...localAgentEnvelope.release, protocolReleaseId: `0x${"00".repeat(32)}` },
  },
  "a mismatched protocol release ID must be rejected locally",
);
rejectLocalAgentEnvelope(
  {
    ...localAgentEnvelope,
    release: { ...localAgentEnvelope.release, manifestKeccak256: `0x${"00".repeat(32)}` },
  },
  "a mismatched manifest hash must be rejected locally",
);
rejectLocalAgentEnvelope(
  { ...localAgentEnvelope, extra: true },
  "unknown Agent result fields must be rejected locally",
);
rejectLocalAgentEnvelope(
  { ...localAgentEnvelope, release: { ...localAgentEnvelope.release, extra: true } },
  "unknown release fields must be rejected locally",
);
rejectLocalAgentEnvelope(
  {
    ...declaredLocalAgentEnvelope,
    declaration: { ...declaredLocalAgentEnvelope.declaration, extra: true },
  },
  "unknown declaration fields must be rejected locally",
);
const localSpecText = await readFile(
  new URL("../apps/thought/spec/THOUGHT.v2.md", import.meta.url),
  "utf8",
);
const activeAnvilRuntime = assertThoughtV2AnvilRuntime(
  JSON.parse(
    await readFile(
      new URL("../apps/thought/evm/addresses.anvil.json", import.meta.url),
      "utf8",
    ),
  ),
) as ThoughtV2AnvilRuntime;
assert.deepEqual(
  buildThoughtV2PathAcquisitionBrowserAddresses(activeAnvilRuntime),
  {
    pathPulseAdapter: activeAnvilRuntime.pathPulseAdapter,
    pulseAuction: activeAnvilRuntime.pulseAuction,
    paymentToken: activeAnvilRuntime.paymentToken,
  },
  "the THOUGHT browser runtime must retain all in-place $PATH acquisition addresses",
);
const localPathFixtureOwner = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const localPathFixtures = {
  schema: "inshell.thought.local-path-fixtures.v1",
  purpose: "routine-thought-development-without-path-auction-dependency",
  disposableOnly: true,
  source: "reserved-spark-self-claim",
  pathReleaseTag: "v0.5.0",
  ownerSignerIndex: 1,
  initialOwner: localPathFixtureOwner,
  movement: "THOUGHT",
  movementQuotaPerToken: 1,
  count: 1,
  tokens: [{
    tokenId: "1000000000000000",
    initialOwner: localPathFixtureOwner,
    initialStage: 0,
    initialStageMinted: 0,
    sparker: true,
    sparkName: "THOUGHT fixture 1",
  }],
} as const;
assert.doesNotThrow(
  () => assertThoughtV2AnvilRuntime({
    ...activeAnvilRuntime,
    pathFixtures: localPathFixtures,
  }),
  "canonical disposable PATH fixture descriptors must pass the runtime gate",
);
const dedicatedThoughtLane = {
  id: "thought",
  isolation: "dedicated-anvil",
  pathRelease: {
    releaseTag: "v0.5.0",
    releasePublicationCommit: "085cfc084b0e568740e0da639e968eb535f7e5c8",
    contractSourceCommit: "5a1ab1f137e76c80dc69045dc520454f6e07cbb1",
    manifestSha256: "a81355b459b40faea894cf1dfb7f484765a7ec62672039dd62d58a3a52849921",
    consumeAuthorizationSchema: "permission-epoch-v1",
    pathNftRedeploymentRequired: true,
  },
} as const;
assert.doesNotThrow(
  () => assertThoughtV2AnvilRuntime({
    ...activeAnvilRuntime,
    chainId: 31338,
    localLane: dedicatedThoughtLane,
    pathFixtures: localPathFixtures,
  }),
  "the isolated THOUGHT lane must use its wallet-distinct local chain ID",
);
assert.throws(
  () => assertThoughtV2AnvilRuntime({
    ...activeAnvilRuntime,
    chainId: 31338,
    pathFixtures: localPathFixtures,
  }),
  /runtime descriptor is incompatible/,
  "a noncanonical local chain ID must fail without the dedicated THOUGHT lane marker",
);
for (const invalidFixtures of [
  { ...localPathFixtures, source: "auction" },
  { ...localPathFixtures, count: 2 },
  {
    ...localPathFixtures,
    tokens: [{ ...localPathFixtures.tokens[0], initialStage: 1 }],
  },
  {
    ...localPathFixtures,
    tokens: [{ ...localPathFixtures.tokens[0], sparker: false }],
  },
]) {
  assert.throws(
    () => assertThoughtV2AnvilRuntime({
      ...activeAnvilRuntime,
      pathFixtures: invalidFixtures,
    }),
    /invalid local \$PATH fixtures/,
    "malformed disposable PATH fixture descriptors must fail closed",
  );
}
for (const invalidRuntime of [
  { ...activeAnvilRuntime, pathPulseAdapter: undefined },
  { ...activeAnvilRuntime, pulseAuction: undefined },
  {
    ...activeAnvilRuntime,
    pathPulseAdapter: { address: "0x0000000000000000000000000000000000000000" },
  },
  {
    ...activeAnvilRuntime,
    pulseAuction: { address: "0x0000000000000000000000000000000000000000" },
  },
  { ...activeAnvilRuntime, paymentToken: { address: "not-an-address" } },
]) {
  assert.throws(
    () => assertThoughtV2AnvilRuntime(invalidRuntime),
    /invalid \$PATH acquisition wiring/,
    "a malformed $PATH acquisition runtime must fail before browser injection",
  );
}
const fakeLocalAddress = "0x1111111111111111111111111111111111111111";
const eligibleLocalRelease = {
  ...localRelease,
  eligibleForLocalMint: true,
  contracts: {
    pathNft: fakeLocalAddress,
    thoughtNft: fakeLocalAddress,
    thoughtSpecRegistry: fakeLocalAddress,
    thoughtRenderer: fakeLocalAddress,
    protocolRegistry: fakeLocalAddress,
    creationAttestationVerifier: fakeLocalAddress,
  },
} satisfies ThoughtV2LocalRelease;
assert.equal(new TextEncoder().encode(localSpecText).length, localRelease.spec.byteLength);
assert.equal(keccak256(toUtf8Bytes(localSpecText)), localRelease.spec.evmSpecHash);
assert.equal(
  keccak256(AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32"],
    [id("INSHELL_THOUGHT_PROTOCOL_RELEASE"), localRelease.protocol.manifestKeccak256],
  )),
  localRelease.protocol.protocolReleaseId,
  "local release ID must derive from the exact draft manifest hash",
);
const localRuntimeFacts: ThoughtV2LocalRuntimeFacts = {
  dev: true,
  hostname: "127.0.0.1",
  rpcUrl: "http://127.0.0.1:8546",
  pathRpcUrl: "http://127.0.0.1:8546",
  chainId: localRelease.chainId,
  contracts: {
    pathNft: fakeLocalAddress,
    thoughtNft: fakeLocalAddress,
    thoughtSpecRegistry: fakeLocalAddress,
    thoughtRenderer: fakeLocalAddress,
    protocolRegistry: fakeLocalAddress,
    creationAttestationVerifier: fakeLocalAddress,
  },
  protocolReleaseId: localRelease.protocol.protocolReleaseId,
  manifestHash: localRelease.protocol.manifestKeccak256,
  rendererProfileHash: localRelease.protocol.rendererProfile.keccak256,
  workProfileHash: localRelease.protocol.workProfile.keccak256,
  contextProfileHash: localRelease.protocol.contextProfile.keccak256,
  metadataProfileHash: localRelease.protocol.metadataProfile.keccak256,
  specId: localRelease.spec.evmSpecId,
  specHash: localRelease.spec.evmSpecHash,
  specByteLength: localRelease.spec.byteLength,
};
const localBytes32Anchors = [
  localRelease.protocol.protocolReleaseId,
  localRelease.protocol.manifestKeccak256,
  localRelease.protocol.workProfile.keccak256,
  localRelease.protocol.rendererProfile.keccak256,
  localRelease.protocol.contextProfile.keccak256,
  localRelease.protocol.metadataProfile.keccak256,
  localRelease.spec.evmSpecId,
  localRelease.spec.evmSpecHash,
];
assert.deepEqual(
  buildThoughtV2LocalAgentTaskBinding(localRelease),
  {
    release: {
      protocolReleaseId: localRelease.protocol.protocolReleaseId,
      manifestKeccak256: localRelease.protocol.manifestKeccak256,
    },
    resultContract: {
      workProfile: "inshell.thought.work.v2.terminal-english-64",
      lineValidation: "terminal-english-64",
    },
  },
  "the dev Agent task must verify the same output contract served by the active local release",
);
for (const anchor of localBytes32Anchors) {
  assert.match(anchor, /^0x[0-9a-f]{64}$/i, `invalid local bytes32 anchor: ${anchor}`);
}
assert.equal(
  isThoughtV2LocalMintRuntime(localRuntimeFacts),
  false,
  "a committed address-free fallback cannot enable minting",
);
const eligibleLocalRuntimeFacts: ThoughtV2LocalRuntimeFacts = {
  ...localRuntimeFacts,
  contracts: {
    pathNft: eligibleLocalRelease.contracts.pathNft,
    thoughtNft: eligibleLocalRelease.contracts.thoughtNft,
    thoughtSpecRegistry: eligibleLocalRelease.contracts.thoughtSpecRegistry,
    thoughtRenderer: eligibleLocalRelease.contracts.thoughtRenderer,
    protocolRegistry: eligibleLocalRelease.contracts.protocolRegistry,
    creationAttestationVerifier: eligibleLocalRelease.contracts.creationAttestationVerifier,
  },
};
assert.equal(
  isThoughtV2LocalMintRuntime(eligibleLocalRuntimeFacts, eligibleLocalRelease),
  true,
  "an exact eligible loopback runtime must enable local V2",
);
assert.equal(
  isThoughtV2LocalMintRuntime({
    ...eligibleLocalRuntimeFacts,
    hostname: "192.168.0.104",
    rpcUrl: "http://192.168.0.104:8546",
    pathRpcUrl: "http://192.168.0.104:8546",
  }, eligibleLocalRelease),
  true,
  "an exact eligible private-LAN runtime must keep the local V2 contract",
);
assert.equal(
  alignThoughtV2LocalRpcHost("http://127.0.0.1:8546", "192.168.0.104"),
  "http://192.168.0.104:8546/",
  "the LAN App must advertise the host-reachable Anvil address instead of loopback",
);
assert.equal(
  alignThoughtV2LocalRpcHost("http://192.168.0.104:8546", "127.0.0.1"),
  "http://127.0.0.1:8546/",
  "the loopback App must keep its local Anvil request on loopback",
);
assert.equal(
  alignThoughtV2LocalRpcHost("https://rpc.example", "192.168.0.104"),
  "https://rpc.example",
  "a configured public RPC must not be rewritten as a LAN endpoint",
);
assert.equal(
  isThoughtV2LocalMintRuntime({
    ...eligibleLocalRuntimeFacts,
    hostname: "preview.inshell.art",
  }, eligibleLocalRelease),
  false,
  "a public preview host must not enable the local V2 contract",
);
assert.equal(
  isThoughtV2LocalMintRuntime({
    ...eligibleLocalRuntimeFacts,
    rpcUrl: "https://rpc.example",
  }, eligibleLocalRelease),
  false,
  "a public RPC must not enable the local V2 contract",
);
assert.equal(isThoughtV2LocalMintRuntime({ ...localRuntimeFacts, dev: false }), false);
assert.equal(isThoughtV2LocalMintRuntime({ ...localRuntimeFacts, hostname: "preview.inshell.art" }), false);
assert.equal(isThoughtV2LocalMintRuntime({ ...localRuntimeFacts, rpcUrl: "https://rpc.example" }), false);
assert.equal(isThoughtV2LocalMintRuntime({ ...localRuntimeFacts, pathRpcUrl: "https://rpc.example" }), false);
assert.equal(isThoughtV2LocalMintRuntime({ ...localRuntimeFacts, chainId: 11155111 }), false);
assert.equal(isThoughtV2LocalMintRuntime({
  ...localRuntimeFacts,
  protocolReleaseId: `0x${"00".repeat(32)}`,
}), false);

let localDeploymentAnchorReads = 0;
const verifyLocalDeployment = (codes: readonly string[], anchorsMatch = true) =>
  verifyThoughtV2LocalDeployment({
    contractAddresses: codes.map((_, index) => `contract-${index}`),
    readCode: async (address) => codes[Number(address.split("-")[1])],
    readAnchors: async () => {
      localDeploymentAnchorReads += 1;
      return { anchorsMatch };
    },
    anchorsMatch: (anchors) => anchors.anchorsMatch,
  });

await assert.rejects(
  verifyThoughtV2LocalDeployment({
    contractAddresses: [],
    readCode: async () => "0x1234",
    readAnchors: async () => ({ anchorsMatch: true }),
    anchorsMatch: (anchors) => anchors.anchorsMatch,
  }),
  new RegExp(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY.replaceAll(".", "\\.")),
);

await assert.rejects(
  verifyThoughtV2LocalDeployment({
    contractAddresses: ["contract-0"],
    readCode: async () => {
      throw new Error("RPC unavailable");
    },
    readAnchors: async () => ({ anchorsMatch: true }),
    anchorsMatch: (anchors) => anchors.anchorsMatch,
  }),
  new RegExp(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY.replaceAll(".", "\\.")),
  "code-read failures must become stable deployment-unavailable copy",
);

localDeploymentAnchorReads = 0;
await assert.rejects(
  verifyLocalDeployment(["0x1234", "0x"]),
  new RegExp(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY.replaceAll(".", "\\.")),
);
assert.equal(
  localDeploymentAnchorReads,
  0,
  "local deployment ABI reads must not run when any contract has no bytecode",
);

localDeploymentAnchorReads = 0;
await assert.rejects(
  verifyThoughtV2LocalDeployment({
    contractAddresses: ["contract-0"],
    readCode: async () => "0x1234",
    readAnchors: async () => {
      localDeploymentAnchorReads += 1;
      throw new Error('could not decode result data (method="thoughtRenderer")');
    },
    anchorsMatch: () => true,
  }),
  new RegExp(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY.replaceAll(".", "\\.")),
  "ABI decode failures must become stable deployment-unavailable copy",
);
assert.equal(localDeploymentAnchorReads, 1);

await assert.rejects(
  verifyLocalDeployment(["0x1234"], false),
  new RegExp(THOUGHT_V2_LOCAL_DEPLOYMENT_MISMATCH_COPY.replaceAll(".", "\\.")),
);

await verifyLocalDeployment(["0x1234"]);
await assert.rejects(
  verifyLocalDeployment(["0x"]),
  new RegExp(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY.replaceAll(".", "\\.")),
  "a later local-node reset must be detected after an earlier successful verification",
);
assert.equal(isThoughtV2LocalDeploymentError(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY), true);
assert.equal(isThoughtV2LocalDeploymentError(THOUGHT_V2_LOCAL_DEPLOYMENT_MISMATCH_COPY), true);
assert.equal(isThoughtV2LocalDeploymentError("path list unavailable."), false);
assert.equal(
  THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled,
  false,
  "the canonical portable release must remain disabled until a persistent deployment is authorized",
);

const localProvenanceJson = buildThoughtV2LocalProvenance({
  promptLine: "what survives?",
  agentLine: "the exact line survives",
  process: {
    kind: "agent-run",
    agent: {
      identifier: "codex",
      label: "Codex",
      source: "producer-selected",
    },
    model: {
      identifier: "gpt-5.6-sol/reasoning_effort/ultra",
      label: "GPT-5.6 Sol · Ultra",
      source: "runtime-reported",
    },
    run: {
      adapter: "codex",
      route: "inshell.thought.agent-run",
      reference: "tar_local_v2",
      resultEnvelope: declaredLocalAgentEnvelope,
    },
  },
  mintContext: {
    chainId: "31337",
    thoughtNft: fakeLocalAddress,
    intendedMinter: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  },
  selectedSpec: {
    name: localRelease.spec.name,
    text: await readFile(
      new URL("../apps/thought/spec/THOUGHT.v2.md", import.meta.url),
      "utf8",
    ),
  },
});
const localProvenance = JSON.parse(localProvenanceJson) as {
  schema: string;
  protocol: { protocolReleaseId: string };
  work: {
    agentLineKeccak256: string;
    conversationIdentityHash: string;
    promptLine: string;
    agentLine: string;
  };
  mintContext: { thoughtNft: string; intendedMinter: string };
};
assert.equal(localProvenance.schema, "inshell.thought.provenance.v2");
assert.equal(localProvenance.protocol.protocolReleaseId, localRelease.protocol.protocolReleaseId);
assert.equal(localProvenance.work.promptLine, "what survives?");
assert.equal(localProvenance.work.agentLine, "the exact line survives");
assert.equal(
  localProvenance.work.agentLineKeccak256,
  thoughtV2AgentLineHash("the exact line survives"),
  "Agent-line hash must preserve exact bytes",
);
assert.equal(
  localProvenance.work.conversationIdentityHash,
  thoughtV2ConversationIdentityHashForLines("what survives?", "the exact line survives"),
  "V2 duplicate identity must commit to the ordered prompt + Agent pair",
);
assert.equal(localProvenance.mintContext.thoughtNft, fakeLocalAddress);
assert.equal(localProvenance.mintContext.intendedMinter, "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
assert(new TextEncoder().encode(localProvenanceJson).length < THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES);

const localThoughtInterface = new Interface(THOUGHT_V2_LOCAL_NFT_ABI);
assert(localThoughtInterface.getFunction("tokenOfConversationIdentityHash"), "local V2 ABI must expose ordered-pair lookup");
assert(localThoughtInterface.getFunction("RENDERER_ID_HASH"), "local V2 ABI must expose renderer identity anchor");
assert(localThoughtInterface.getFunction("WORK_PROFILE_ID_HASH"), "local V2 ABI must expose work-profile identity anchor");
assert(new Interface(THOUGHT_V2_LOCAL_RENDERER_ABI).getFunction("render"), "preview renderer ABI must expose render");
assert.equal(
  localThoughtInterface.getFunction("mint")!.selector,
  "0x8836aa1b",
  "local V2 ABI must match the deployed neutral-record-and-attestation mint shape",
);
const localMintCalldata = localThoughtInterface.encodeFunctionData("mint", [{
  promptLine: "what survives?",
  agentLine: "the exact line survives",
  agent: "Codex",
  model: "GPT-5.6 Sol · Ultra",
  pathId: 1n,
  thoughtSpecId: localRelease.spec.evmSpecId,
  thoughtSpecHash: localRelease.spec.evmSpecHash,
  provenanceJson: localProvenanceJson,
  deadline: 1n,
  pathSignature: "0x1234",
  creationAttestation: {
    runIdHash: `0x${"00".repeat(32)}`,
    deadline: 0,
    authorityEpoch: 0,
    signature: "0x",
  },
}]);
assert(localMintCalldata.startsWith(localThoughtInterface.getFunction("mint")!.selector));

assert.equal(
  THOUGHT_PANEL_MINT_UI_MODE,
  "dock",
  "THOUGHT panel mint controls must stay inline instead of opening the legacy sheet",
);

assert.deepEqual(
  getThoughtWorkReadyPresentation({ mintEnabled: false }),
  {
    canMint: false,
    detail: THOUGHT_V2_MINT_UNAVAILABLE_COPY,
  },
  "work-ready UI must not offer mint or request a wallet while V2 minting is disabled",
);

assert.deepEqual(
  getThoughtWorkReadyPresentation({ mintEnabled: true }),
  {
    canMint: true,
    detail: "ready to mint",
  },
  "work-ready UI must stay independent from wallet state",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    { code: 4001, message: "User rejected the request." },
    "signature",
  ),
  { message: "signature rejected in wallet.", kind: "signature" },
  "only a confirmed wallet rejection may use rejected copy",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    {
      code: "ACTION_REJECTED",
      shortMessage: "user rejected action",
      info: { error: { code: 4001, message: "User denied message signature" } },
    },
    "signature",
  ),
  { message: "signature rejected in wallet.", kind: "signature" },
  "nested ethers wallet rejections must stay recognizable",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    { code: -32002, message: "Request already pending" },
    "signature",
  ),
  { message: "signature request already pending in wallet.", kind: "signature" },
  "a pending wallet request must not be presented as rejected",
);

assert.deepEqual(
  formatThoughtAuthorizationError(new Error("could not decode result data"), "nonce"),
  { message: "$PATH signature unavailable.", kind: "signature" },
  "a nonce RPC failure must not be presented as a wallet rejection",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    { code: "NETWORK_ERROR", shortMessage: "network changed" },
    "nonce",
  ),
  { message: "$PATH signature unavailable.", kind: "signature" },
  "a PATH RPC network failure must not blame the signing wallet",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    { code: -32600, message: "request rejected by RPC" },
    "nonce",
  ),
  { message: "$PATH signature unavailable.", kind: "signature" },
  "an RPC-level request rejection must not be presented as a user rejection",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    { code: "NETWORK_ERROR", shortMessage: "network changed" },
    "wallet",
  ),
  { message: "wrong network.", kind: "wrong_network" },
  "wallet network changes need the existing network recovery flow",
);

assert.deepEqual(
  formatThoughtAuthorizationError({}, "signature"),
  { message: "signature failed.", kind: "signature" },
  "unknown signature failures must never claim the wallet rejected them",
);

assert.deepEqual(
  formatThoughtAuthorizationError(new Error("spec mismatch."), "preparing"),
  { message: "spec mismatch.", kind: "spec" },
  "spec errors must retain their concise actionable copy",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    new Error("mint blocked. provenance too large. 9000 / 8192 bytes."),
    "preparing",
  ),
  {
    message: "Work data is too large to mint. Shorten the prompt or Agent response, then run the work again.",
    kind: "thought",
  },
  "work-size guidance must not expose internal provenance terminology",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    new Error("provenance is 20001/20000 bytes"),
    "preparing",
  ),
  {
    message: "Work data is too large to mint. Shorten the prompt or Agent response, then run the work again.",
    kind: "thought",
  },
  "local V2 size guidance must explain the recovery in product language",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    new Error("THOUGHT.md request timed out."),
    "preparing",
  ),
  { message: "THOUGHT.md request timed out.", kind: "spec" },
  "THOUGHT.md failures must retain the spec recovery path",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "21:50:02",
    title: "mint error",
    detail: THOUGHT_V2_MINT_UNAVAILABLE_COPY,
    actions: ["retry", "reset"],
  }),
  [
    "[21:50:02] mint error",
    THOUGHT_V2_MINT_UNAVAILABLE_COPY,
  ],
  "console must retain the outcome without projecting live controls",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "09:10:11",
    title: "work ready",
    detail: "ready to mint",
    actions: ["mint", "reset"],
  }),
  [
    "[09:10:11] work ready",
    "ready to mint",
  ],
  "console must keep work-ready guidance concise",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "09:10:12",
    title: "checking THOUGHT",
    detail: "checking uniqueness and mint state",
  }),
  [
    "[09:10:12] checking THOUGHT",
    "checking uniqueness and mint state",
  ],
  "console must omit an empty next-actions line",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "09:10:13",
    title: "text too long",
    detail: "prompt: 120% used · 77 / 64 UTF-8 bytes",
    nextStep: "reduce prompt to 64 UTF-8 bytes or less",
  }),
  [
    "[09:10:13] text too long",
    "prompt: 120% used · 77 / 64 UTF-8 bytes",
    "next: reduce prompt to 64 UTF-8 bytes or less",
  ],
  "console warnings must include one concise suggested next step",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "09:10:14",
    title: "minted",
    detail: "Minted",
  }),
  ["[09:10:14] minted"],
  "console must not repeat a detail that matches its title",
);

runThoughtConsoleTests();
runThoughtMintPresentationTests();
await runThoughtPathAcquisitionTests();
runThoughtMintTransactionTests();
runThoughtPathConsumeAuthorizationTests();
await runThoughtMintSubmissionLockTests();

assert.equal(
  buildThoughtRuntimePrompt("make it quiet"),
  "make it quiet",
  "provider user content must remain byte-identical to promptLine",
);

const pollWakeScheduler = createThoughtPollWakeScheduler();
let pollWaitResolved = false;
let immediatePollCount = 0;
const immediatePoll = () => {
  immediatePollCount += 1;
};
pollWakeScheduler.setImmediatePoll(immediatePoll);
const pollWait = pollWakeScheduler.wait(60_000).then(() => {
  pollWaitResolved = true;
});
pollWakeScheduler.pollNow();
assert.equal(immediatePollCount, 1, "foreground refresh must issue an independent status poll");
pollWakeScheduler.wake();
await pollWait;
assert.equal(pollWaitResolved, true, "foreground wake must resume status polling immediately");
pollWakeScheduler.clearImmediatePoll(immediatePoll);
pollWakeScheduler.pollNow();
assert.equal(immediatePollCount, 1, "cleared foreground poll must not run again");
assert.equal(
  measureThoughtLine("A".repeat(THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes), "agent").errors.length,
  0,
);
assert(
  measureThoughtLine("A".repeat(THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes + 1), "agent").errors.some((error) =>
    error.includes("bytes"),
  ),
  "one byte beyond the advertised limit must fail V2 validation",
);
assert(
  measureThoughtLine("A".repeat(27), "agent").errors.length === 0,
  "renderer display-unit measurements must not reject a valid byte-length line",
);

const assertNoToolPayload = (label: string, payload: Record<string, unknown>) => {
  assert.equal(payload.tools, undefined, `${label} must not attach web-search tools`);
  assert.equal(payload.tool_choice, undefined, `${label} must not force tool choice`);
};

const cases: Array<{
  route: ThoughtRunRoute;
  provider: ThoughtRunProvider;
  model: string;
}> = [
  { route: "connect", provider: "openrouter", model: "openrouter/free" },
  { route: "direct", provider: "openrouter", model: "openrouter/free" },
  { route: "direct", provider: "openai", model: "gpt-5.4-mini" },
  { route: "direct", provider: "anthropic", model: "claude-sonnet-4.5" },
  { route: "codex", provider: "codex", model: "codex" },
];

for (const item of cases) {
  const payload = buildThoughtRunPayload({
    ...item,
    promptLine: "make it quiet",
    thoughtSpec,
  });

  assert.equal(
    payload.config.web.enabled,
    false,
    `${item.route}/${item.provider} must keep browser web search disabled`,
  );
  assert.equal(payload.config.web.tool, "unavailable");
}

const openRouterPayload = buildThoughtRunPayload({
  route: "connect",
  provider: "openrouter",
  model: "openrouter/free",
  promptLine: "make it quiet",
  thoughtSpec,
});
assertNoToolPayload(
  "OpenRouter chat payload",
  toOpenRouterChatPayload(openRouterPayload) as Record<string, unknown>,
);

const openAiPayload = buildThoughtRunPayload({
  route: "direct",
  provider: "openai",
  model: "gpt-5.4-mini",
  promptLine: "make it quiet",
  thoughtSpec,
});
assertNoToolPayload(
  "OpenAI responses payload",
  toOpenAIResponsesPayload(openAiPayload) as Record<string, unknown>,
);

const anthropicPayload = buildThoughtRunPayload({
  route: "direct",
  provider: "anthropic",
  model: "claude-sonnet-4.5",
  promptLine: "make it quiet",
  thoughtSpec,
});
assertNoToolPayload(
  "Anthropic messages payload",
  toAnthropicMessagesPayload(anthropicPayload) as Record<string, unknown>,
);

const codexPayload = buildThoughtRunPayload({
  route: "codex",
  provider: "codex",
  model: "codex",
  promptLine: "make it quiet",
  thoughtSpec,
});
assert.equal(codexPayload.config.request.maxOutputTokens, null);
assert.equal(codexPayload.config.request.stop, null);
assert.equal(codexPayload.config.web.enabled, false);
assert.equal(codexPayload.config.web.tool, "unavailable");

assert.equal(normalizePreviewMode("wallet"), "wallet");
assert.equal(normalizePreviewMode("rpc"), "auto");
assert.equal(normalizePreviewMode("bad"), "auto");
const autoPreviewUnavailableLines = previewUnavailableCliLines("auto", "preview service unavailable.");
assert(autoPreviewUnavailableLines.includes("fix the reason above, then retry."));
assert(autoPreviewUnavailableLines.includes("use: preview retry"));
assert(autoPreviewUnavailableLines.includes("use: wallet connect"));
assert(
  !autoPreviewUnavailableLines.some((line) => line.includes("rpc")),
  "auto preview fallback must not ask normal visitors to configure RPC",
);
const walletPreviewUnavailableLines = previewUnavailableCliLines("wallet");
assert(walletPreviewUnavailableLines.includes("use: wallet connect"));
assert(walletPreviewUnavailableLines.includes("use: config preview auto"));
const offPreviewUnavailableLines = previewUnavailableCliLines("off");
assert(offPreviewUnavailableLines.includes("preview is off."));
assert(offPreviewUnavailableLines.includes("use: config preview auto"));
assert.equal(JSON_RPC_NO_BATCH_OPTIONS.batchMaxCount, 1);
assert.equal(
  createSingleRequestJsonRpcProvider("/api/thought-rpc")._getOption("batchMaxCount"),
  1,
);
assert.equal(
  createSingleRequestJsonRpcProvider("/api/thought-rpc", 11155111)._getOption("staticNetwork"),
  true,
);

const secretRules: SurfaceRedactionRule[] = [
  {
    id: "key",
    tokens: ["config", "direct", "key"],
    allowRestValues: ["clear", "help"],
  },
];
assert.deepEqual(parseSurfaceInput("  PATH   list  ", { mode: "command-first" }), {
  raw: "  PATH   list  ",
  trimmed: "PATH   list",
  mode: "command-first",
  isBlank: false,
  isCommand: true,
  isQuestion: false,
  commandToken: "PATH",
  commandKey: "path",
  rest: "list",
  args: ["list"],
  question: "",
});
assert.equal(
  redactSurfaceInput("config direct key sk-private", secretRules),
  "config direct key ********",
);
assert.equal(shouldRecordSurfaceInput("config direct key sk-private", secretRules), false);
assert.equal(shouldRecordSurfaceInput("config direct key clear", secretRules), true);
await runThoughtShellAdapterTests();

const storage = createMemoryStorageAdapter();
const shell = createSurfaceShell<{ value: string }>({
  mode: "question-first",
  commandPrefix: "/",
  storage,
  historyLimit: 2,
  transcriptLimit: 4,
  commands: [
    {
      id: "echo",
      run: ({ input, context }) => [`${context.value}:${input.rest}`],
    },
    {
      id: "slow",
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "done";
      },
    },
  ],
  redactionRules: secretRules,
});
assert.equal(shell.parse("hello").isQuestion, true);
assert.equal(shell.parse("/echo hi").commandKey, "echo");
await shell.dispatch("/echo hi", { value: "ok" });
const slowDispatch = shell.dispatch("/slow", { value: "ok" });
const blockedDispatch = await shell.dispatch("/echo blocked", { value: "ok" });
assert.equal(blockedDispatch.reason, "in_flight");
await slowDispatch;
assert.deepEqual(shell.getHistory(), ["/echo hi", "/slow"]);

const validCandidate = prevalidateThoughtCandidate("quiet green sky", {
  maxRawBytes: 512,
  maxTextBytes: 128,
});
assert.equal(validCandidate.ok, true);
assert.equal(validCandidate.canonical, "QUIET GREEN SKY");
assert.equal(
  thoughtByteLimitPercentage({ line: "agent output", usedBytes: 77, maxBytes: 64 }),
  120,
);
assert.equal(
  formatThoughtByteLimitUsage({ line: "agent output", usedBytes: 77, maxBytes: 64 }),
  "Agent output: 120% used · 77 / 64 UTF-8 bytes",
);

for (const [label, raw, reasonCode] of [
  ["blank", "  ", 1],
  ["digits-only", "123", 1],
  ["raw-too-large", "A".repeat(513), 2],
] as const) {
  const result = prevalidateThoughtCandidate(raw, {
    maxRawBytes: 512,
    maxTextBytes: 128,
  });
  assert.equal(result.ok, false, `${label} candidate must be rejected before RPC`);
  assert.equal(result.ok ? 0 : result.reasonCode, reasonCode);
}

for (const [raw, canonical] of [
  ["ONE!", "ONE"],
  ["ONE\nTWO", "ONE TWO"],
  ["ONE-TWO", "ONE TWO"],
] as const) {
  const result = prevalidateThoughtCandidate(raw, {
    maxRawBytes: 512,
    maxTextBytes: 128,
  });
  assert.equal(result.ok, true, `${JSON.stringify(raw)} must canonicalize like ThoughtNFT.previewWork`);
  assert.equal(result.ok ? result.canonical : "", canonical);
}

assert.equal(
  localRelease.protocol.workProfile.id,
  CONTRACT_THOUGHT_V2_WORK_PROFILE_ID,
  "the App-owned Terminal English policy must identify the Contract work profile exactly",
);
for (const [value, kind] of [
  ["Terminal English: valid?!", "prompt"],
  ["", "prompt"],
  ["A".repeat(64), "agent"],
  ["A".repeat(65), "agent"],
  ["double  space", "prompt"],
  [" leading", "prompt"],
  ["trailing ", "agent"],
  ["Bad prompt 你好", "prompt"],
  ["tab\tcharacter", "agent"],
] as const) {
  assert.deepEqual(
    measureThoughtV2TerminalLine(value, kind),
    measureContractThoughtV2Line(value, kind),
    `the App-owned and Contract-vendored Terminal English policies must agree for ${JSON.stringify(value)}`,
  );
}
assert.equal(
  thoughtV2ConversationIdentityHashForLines("what survives?", "the exact line survives"),
  deriveContractThoughtV2WorkHashes("what survives?", "the exact line survives")
    .conversationIdentityHash,
  "the App-owned and Contract-vendored work hashes must remain byte-for-byte equivalent",
);

assert.deepEqual(
  measureThoughtV2TerminalLine("Terminal English: valid?!", "prompt").errors,
  [],
  "the current work profile must accept its complete punctuation repertoire",
);
assert.match(
  measureThoughtV2TerminalLine("double  space", "prompt").errors.join("; "),
  /repeated internal spaces/,
  "the integration-preview work profile must reject repeated internal spaces",
);
assert.match(
  measureThoughtV2TerminalLine("Bad prompt 你好", "prompt").errors.join("; "),
  /unsupported U\+4F60/,
  "the integration-preview work profile must reject characters outside Terminal English",
);
assert.match(
  measureThoughtV2TerminalLine(" trailing", "agent").errors.join("; "),
  /outer space/,
  "the integration-preview work profile must reject outer spaces without rewriting input",
);

assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "@hello",
    line: "prompt",
    measure: measureThoughtV2TerminalLine("@hello", "prompt"),
    maxBytes: 64,
  }),
  {
    title: "\"@\" can't be used",
    detail:
      "The \"@\" at character 1 isn't supported in THOUGHT text.\n" +
      "Allowed: [space] A-Z a-z 0-9 . , ? ! : ; ' \" - ( ) / &",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "keep exact bytes ",
    line: "prompt",
    measure: measureThoughtV2TerminalLine("keep exact bytes ", "prompt"),
    maxBytes: 64,
  }),
  {
    title: "trailing space",
    detail: "The prompt ends with a space.",
    nextStep: "delete the final space",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "zero\u200Bwidth",
    line: "prompt",
    measure: measureThoughtV2TerminalLine("zero\u200Bwidth", "prompt"),
    maxBytes: 64,
  }),
  {
    title: "invisible character",
    detail: "The prompt contains an invisible character at character 5.",
    nextStep: "delete the invisible character at character 5",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "Agent answer ",
    line: "agent output",
    measure: measureThoughtV2TerminalLine("Agent answer ", "agent"),
    maxBytes: 64,
  }),
  {
    title: "trailing space",
    detail: "The Agent output ends with a space.",
    nextStep: "reset and run the Agent again; output is never auto-corrected",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "double  space",
    line: "prompt",
    measure: measureThoughtV2TerminalLine("double  space", "prompt"),
    maxBytes: 64,
  }),
  {
    title: "extra spaces",
    detail: "The prompt has more than one space together at character 8.",
    nextStep: "delete the extra space at character 8",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "",
    line: "prompt",
    measure: measureThoughtV2TerminalLine("", "prompt"),
    maxBytes: 64,
  }),
  {
    title: "prompt empty",
    detail: "The prompt is empty.",
    nextStep: "enter a prompt",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "tab\there",
    line: "prompt",
    measure: measureThoughtV2TerminalLine("tab\there", "prompt"),
    maxBytes: 64,
  }),
  {
    title: "tab not allowed",
    detail: "The prompt contains a tab at character 4.",
    nextStep: "replace the tab at character 4 with one regular space",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "test",
    line: "prompt",
    measure: {
      byteLength: 4,
      errors: ["prompt line has an unknown policy mismatch"],
    },
    maxBytes: 64,
  }),
  {
    title: "prompt not accepted",
    detail: "The prompt does not match THOUGHT text rules.",
    nextStep: "check the prompt for extra spaces or unsupported characters",
  },
);
console.log("[test-thought-runtime] OK");
