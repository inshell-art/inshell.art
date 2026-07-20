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
  buildThoughtV2LocalProvenance,
  thoughtV2AgentLineHash,
} from "../apps/thought/src/thought-v2-local-mint";
import {
  THOUGHT_V2_LOCAL_RELEASE,
  isThoughtV2LocalMintRuntime,
  type ThoughtV2LocalRuntimeFacts,
} from "../apps/thought/src/thought-v2-local-release";
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
  parseThoughtV2LocalAgentResult,
} from "../apps/thought/src/thought-v2-local-agent";
import {
  buildThoughtAgentFixtureLine,
  shouldUseThoughtAgentFixture,
} from "../apps/thought/src/thought-agent-fixture";
import {
  THOUGHT_V2_ARTIFACT,
  THOUGHT_V2_RENDER_CONTRACT,
  buildThoughtV2Svg,
  measureThoughtV2Line,
} from "../apps/thought/src/thought-v2-renderer";
import { describeThoughtTextPolicyIssue } from "../apps/thought/src/thought-text-policy";
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
assert.equal(canonicalThoughtTitle("quiet signal"), "QUIET SIGNAL");
assert.equal(thoughtProtocolText("quiet signal", true), "quiet signal");
assert.equal(thoughtProtocolText("静かな信号 🟢", true), "静かな信号 🟢");
assert.equal(
  thoughtProtocolText("静かな信号 🟢", false),
  "",
  "legacy V1 text behavior must remain unchanged",
);
assert.equal(
  localRelease.source.status,
  "dirty-local-snapshot",
  "the local draft must not claim its producer base commit reproduces uncommitted V2 artifacts",
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
};
assert.equal(
  shouldUseThoughtAgentFixture({ dev: true, hostname: "127.0.0.1", search: "" }),
  true,
  "local dev defaults to the fast Agent fixture path",
);
assert.equal(
  shouldUseThoughtAgentFixture({ dev: true, hostname: "localhost", search: "?agent=live" }),
  false,
  "the operator can explicitly restore the live Agent path",
);
assert.equal(
  shouldUseThoughtAgentFixture({ dev: false, hostname: "127.0.0.1", search: "?agent=fixture" }),
  false,
  "production builds cannot enable Agent fixtures",
);
assert.equal(
  shouldUseThoughtAgentFixture({ dev: true, hostname: "preview.inshell.art", search: "?agent=fixture" }),
  false,
  "non-local deployments cannot enable Agent fixtures",
);
assert.equal(
  buildThoughtAgentFixtureLine("claude", "fixture-nonce"),
  "fixture claude fixture-nonce",
);
assert.equal(
  formatSavedWorkPromptLabel("  a prompt   with spaces  "),
  "a prompt with spaces",
);
assert.equal(
  formatSavedWorkPromptLabel("abcdefghijklmnopqrstuvwxyz", 12),
  "abcdefghi...",
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
    agentDeclaration: declaredLocalAgentEnvelope.declaration,
    transport: {
      adapter: "codex",
      runId: "tar_local_v2",
      rawResponseSha256: "a".repeat(64),
    },
  },
  "mint provenance must preserve validated Agent declaration and transport evidence",
);
assert.throws(
  () => buildThoughtV2LocalAgentProcess(
    { ...localAgentEvidence, result: localAgentEnvelope },
    localAgentEnvelope.agentLine,
  ),
  /declaration is required/i,
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
  new URL("../apps/thought/spec/THOUGHT.v2.local.md", import.meta.url),
  "utf8",
);
const localAddresses = JSON.parse(await readFile(
  new URL("../apps/thought/evm/addresses.anvil.json", import.meta.url),
  "utf8",
)) as {
  rpcUrl: string;
  chainId: number;
  pathNft: { address: string };
  thoughtNft: { address: string };
  thoughtSpecRegistry: { address: string };
  thoughtRenderer: { address: string };
  protocolRegistry: { address: string };
  protocolRelease: {
    id: string;
    manifestHash: string;
    rendererProfileHash: string;
    workProfileHash: string;
  };
  recommendedThoughtSpecId: string;
  recommendedThoughtSpecHash: string;
  thoughtSpecs: Array<{ byteLength: number }>;
};
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
  rpcUrl: localAddresses.rpcUrl,
  pathRpcUrl: localAddresses.rpcUrl,
  chainId: localAddresses.chainId,
  contracts: {
    pathNft: localAddresses.pathNft.address,
    thoughtNft: localAddresses.thoughtNft.address,
    thoughtSpecRegistry: localAddresses.thoughtSpecRegistry.address,
    thoughtRenderer: localAddresses.thoughtRenderer.address,
    protocolRegistry: localAddresses.protocolRegistry.address,
  },
  protocolReleaseId: localAddresses.protocolRelease.id,
  manifestHash: localAddresses.protocolRelease.manifestHash,
  rendererProfileHash: localAddresses.protocolRelease.rendererProfileHash,
  workProfileHash: localAddresses.protocolRelease.workProfileHash,
  specId: localAddresses.recommendedThoughtSpecId,
  specHash: localAddresses.recommendedThoughtSpecHash,
  specByteLength: localAddresses.thoughtSpecs[0]!.byteLength,
};
const localBytes32Anchors = [
  localRelease.protocol.protocolReleaseId,
  localRelease.protocol.manifestKeccak256,
  localRelease.protocol.creativeSpec.keccak256,
  localRelease.protocol.agentResultSchema.keccak256,
  localRelease.protocol.workProfile.keccak256,
  localRelease.protocol.rendererProfile.keccak256,
  localRelease.spec.evmSpecId,
  localRelease.spec.evmSpecHash,
  localAddresses.protocolRelease.id,
  localAddresses.protocolRelease.manifestHash,
  localAddresses.protocolRelease.rendererProfileHash,
  localAddresses.protocolRelease.workProfileHash,
  localAddresses.recommendedThoughtSpecId,
  localAddresses.recommendedThoughtSpecHash,
];
for (const anchor of localBytes32Anchors) {
  assert.match(anchor, /^0x[0-9a-f]{64}$/i, `invalid local bytes32 anchor: ${anchor}`);
}
assert.equal(isThoughtV2LocalMintRuntime(localRuntimeFacts), true);
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
  "the source-only production protocol snapshot must remain mint-disabled",
);

const localProvenanceJson = buildThoughtV2LocalProvenance({
  promptLine: "what survives?",
  agentLine: "the exact line survives",
  process: {
    kind: "agent-run",
    agentDeclaration: {
      schema: "inshell.thought.agent-declaration.v1",
      status: "declared-unverified",
      agentLabel: "Codex",
      declaredOneCreativeResult: true,
    },
  },
  mintContext: {
    chainId: "31337",
    thoughtNft: localAddresses.thoughtNft.address,
    pathNft: localAddresses.pathNft.address,
    minter: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    movement: "THOUGHT",
    pathId: "1",
  },
});
const localProvenance = JSON.parse(localProvenanceJson) as {
  schema: string;
  protocol: { protocolReleaseId: string };
  work: { agentLineKeccak256: string; promptLine: string; agentLine: string };
  mintContext: { thoughtNft: string; pathNft: string; minter: string };
};
assert.equal(localProvenance.schema, "inshell.thought.provenance.v2");
assert.equal(localProvenance.protocol.protocolReleaseId, localRelease.protocol.protocolReleaseId);
assert.equal(localProvenance.work.promptLine, "what survives?");
assert.equal(localProvenance.work.agentLine, "the exact line survives");
assert.equal(
  localProvenance.work.agentLineKeccak256,
  thoughtV2AgentLineHash("the exact line survives"),
  "V2 duplicate identity must use the exact Agent-line hash",
);
assert.equal(localProvenance.mintContext.thoughtNft, localAddresses.thoughtNft.address.toLowerCase());
assert.equal(localProvenance.mintContext.pathNft, localAddresses.pathNft.address.toLowerCase());
assert.equal(localProvenance.mintContext.minter, "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
assert(new TextEncoder().encode(localProvenanceJson).length < THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES);

const localThoughtInterface = new Interface(THOUGHT_V2_LOCAL_NFT_ABI);
assert(localThoughtInterface.getFunction("previewSvg"), "local V2 ABI must expose onchain previewSvg");
assert(localThoughtInterface.getFunction("RENDERER_PROFILE_KECCAK256"), "local V2 ABI must expose renderer profile anchor");
assert(localThoughtInterface.getFunction("WORK_PROFILE_KECCAK256"), "local V2 ABI must expose work profile anchor");
const localMintCalldata = localThoughtInterface.encodeFunctionData("mint", [{
  promptLine: "what survives?",
  agentLine: "the exact line survives",
  pathId: 1n,
  thoughtSpecId: localRelease.spec.evmSpecId,
  thoughtSpecHash: localRelease.spec.evmSpecHash,
  provenanceJson: localProvenanceJson,
  deadline: 1n,
  pathSignature: "0x1234",
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
    message: "mint blocked. provenance too large. 9000 / 8192 bytes.",
    kind: "thought",
  },
  "provenance size errors must retain their measured copy",
);

assert.deepEqual(
  formatThoughtAuthorizationError(
    new Error("provenance is 20001/20000 bytes"),
    "preparing",
  ),
  { message: "provenance is 20001/20000 bytes", kind: "thought" },
  "the local V2 provenance limit wording must remain visible",
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

const thoughtV2Svg = buildThoughtV2Svg({
  agentLine: "QUIET",
  promptLine: "soft question",
});
assert.equal(THOUGHT_V2_ARTIFACT.artifactId, "thought-v2-stable-look-meaningful-boundaries-20260714T035935Z");
assert.equal(
  THOUGHT_V2_ARTIFACT.manifestSha256,
  "ac838251d86bea1a5e3c4340cb1a1f0aba9e2a663245e4489ef0fd2788ea48dd",
);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.canvas.defaultBg, "#000000");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.rendererId, THOUGHT_V2_PROTOCOL_RELEASE.identifiers.renderer);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.binaryBackground.side, 32);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.binaryBackground.capacity, 1024);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.agentLine.defaultTextColor, "#ffffff");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.promptLine.defaultTextColor, "#ffffff");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.agentLine.defaultFontSize, 44);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.promptLine.defaultFontSize, 16);
assert(thoughtV2Svg.includes('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960">'));
assert(thoughtV2Svg.includes('<rect id="canvas-bg" width="960" height="960" fill="#000000"/>'));
assert(thoughtV2Svg.includes('id="binary-background" opacity="1"'));
assert(thoughtV2Svg.includes('data-bit-capacity="1024"'));
assert(thoughtV2Svg.includes('data-pack="msb-first-128-bytes"'));
assert(thoughtV2Svg.includes('<clipPath id="agent-line-clip">'));
assert(thoughtV2Svg.includes('<clipPath id="prompt-line-clip">'));
assert(!thoughtV2Svg.includes('id="agent-line-bg"'));
assert(!thoughtV2Svg.includes('id="prompt-line-bg"'));
assert(thoughtV2Svg.includes('id="agent-line-text" x="480" y="410"'));
assert(thoughtV2Svg.includes('text-anchor="middle" dominant-baseline="middle"'));
assert(thoughtV2Svg.includes('font-size="44" fill="#ffffff"'));
assert(thoughtV2Svg.includes('id="prompt-line-text" x="480" y="844"'));
assert(thoughtV2Svg.includes('font-size="16" fill="#ffffff"'));
assert(thoughtV2Svg.includes("'Noto Sans Mono'"));
assert(!thoughtV2Svg.includes("&apos;Noto Sans Mono&apos;"));
assert(!thoughtV2Svg.includes("<animateTransform"));

const carouselThoughtV2Svg = buildThoughtV2Svg({
  agentLine: "A".repeat(27),
  promptLine: "P".repeat(64),
});
assert(carouselThoughtV2Svg.includes('<g id="agent-line-carousel">'));
assert(!carouselThoughtV2Svg.includes('<g id="prompt-line-carousel">'));
assert(carouselThoughtV2Svg.includes('id="agent-line-text" x="94"'));
assert(carouselThoughtV2Svg.includes('<animate attributeName="x"'));
assert(!carouselThoughtV2Svg.includes("textLength"));
assert(!carouselThoughtV2Svg.includes("<animateTransform"));

assert.deepEqual(measureThoughtV2Line("Bad prompt 你好", "prompt").errors, []);
assert.deepEqual(measureThoughtV2Line("bad Agent مرحبا", "agent").errors, []);
assert.deepEqual(measureThoughtV2Line("double  space", "prompt").errors, []);

assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "keep exact bytes ",
    line: "prompt",
    measure: measureThoughtV2Line("keep exact bytes ", "prompt"),
    maxBytes: 64,
  }),
  {
    title: "trailing space",
    detail: "prompt ends with U+0020",
    nextStep: "delete the final space",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "zero\u200Bwidth",
    line: "prompt",
    measure: measureThoughtV2Line("zero\u200Bwidth", "prompt"),
    maxBytes: 64,
  }),
  {
    title: "invisible character",
    detail: "prompt contains zero-width space U+200B at character 5",
    nextStep: "delete U+200B at character 5",
  },
);
assert.deepEqual(
  describeThoughtTextPolicyIssue({
    value: "Agent answer ",
    line: "agent output",
    measure: measureThoughtV2Line("Agent answer ", "agent"),
    maxBytes: 64,
  }),
  {
    title: "trailing space",
    detail: "Agent output ends with U+0020",
    nextStep: "reset and run the Agent again; output is never auto-corrected",
  },
);
assert.equal(
  describeThoughtTextPolicyIssue({
    value: "double  space",
    line: "prompt",
    measure: measureThoughtV2Line("double  space", "prompt"),
    maxBytes: 64,
  }),
  null,
  "valid internal spaces must remain byte-identical",
);

console.log("[test-thought-runtime] OK");
