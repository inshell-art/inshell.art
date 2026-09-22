export const THOUGHT_AGENT_HTTP_USER_AGENT = "Inshell-THOUGHT-Agent/2" as const;

export const THOUGHT_HANDOFF_HTTP_IDENTIFICATION =
  `All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}; identifies THOUGHT, never a browser/model.`;

export const THOUGHT_HANDOFF_RESPONSE_PATHS = {
  claim: {
    bridgeToken: "bridgeToken",
    authority: "request.authority",
    intent: "request.intent",
    controlMode: "request.controlPolicy.mode",
    controlSchema: "request.evidenceContract.schema",
  },
  ready: {
    control: "control",
  },
  start: {
    authority: "request.authority",
    intent: "request.intent",
    spec: "request.spec.{id,text,sha256,contractSpecId,contractSpecHash}",
    instructions: "request.instructions.{id,artifactId,text,sha256}",
    promptText: "request.promptLine.text",
    promptSha256: "request.promptLine.sha256",
    agentInputText: "request.agentInput.text",
    agentInputSha256: "request.agentInput.sha256",
    release: "request.outputContract.release",
    workProfile: "request.outputContract.agentLine.workProfile",
  },
  result: {
    receiptSha256: "result.receipt.receiptSha256",
  },
  fail: {
    code: "error.code",
    message: "error.message",
  },
} as const;

const responsePath = THOUGHT_HANDOFF_RESPONSE_PATHS;

export const buildThoughtHandoffResponseChecks = (input: {
  runId?: string;
  authority?: string;
  controlSchema?: string;
  workProfile?: string;
} = {}) => {
  const runId = input.runId ?? "RUN_ID";
  const authority = input.authority ?? "RUN_AUTHORITY";
  const controlSchema = input.controlSchema ?? "CONTROL_SCHEMA";
  const workProfile = input.workProfile ?? "WORK_PROFILE";
  return {
    claim:
      `Claim: runId=${runId}, state=claimed, nonempty top-level ${responsePath.claim.bridgeToken}; ${responsePath.claim.authority}=${authority}; ${responsePath.claim.intent}=prepare-thought-creation; ${responsePath.claim.controlMode}=bounded-preflight; ${responsePath.claim.controlSchema}=${controlSchema}. Absent: control, request.control, bridge, adapter, creative input.`,
    start:
      `Start: runId=${runId}, state=running, ${responsePath.start.authority}=${authority}, ${responsePath.start.intent}=generate-thought-candidate. Check request.spec.{id,text,sha256,contractSpecId,contractSpecHash}, request.instructions.{id,artifactId,text,sha256}, request.promptLine.{text,sha256}, request.agentInput.{text,sha256}, ${responsePath.start.release}, ${responsePath.start.workProfile}=${workProfile}. Require spec.id=spec.contractSpecId; contractSpecHash=32-byte 0x hex; exact text hashes; equal prompt/input text+hash; differing spec/instructions. promptLine/agentInput are objects.`,
  } as const;
};

const defaultResponseChecks = buildThoughtHandoffResponseChecks();

export const THOUGHT_HANDOFF_CLAIM_RESPONSE_CHECK = defaultResponseChecks.claim;

export const THOUGHT_HANDOFF_READY_RESPONSE_CHECK =
  `Ready: protocolVersion=READY_BODY.protocolVersion; top-level ${responsePath.ready.control}=READY_BODY.control by exact typed entries, any order; never request.control.`;

export const THOUGHT_HANDOFF_START_RESPONSE_CHECK = defaultResponseChecks.start;

export const THOUGHT_HANDOFF_RESULT_RESPONSE_CHECK =
  `Result response: ${responsePath.result.receiptSha256} must begin sha256:; no top-level receiptSha256.`;

export const THOUGHT_HANDOFF_FAIL_RESPONSE_CHECK =
  `Fail response paths: root ${responsePath.fail.code} and ${responsePath.fail.message}; never request.error.`;

/** Plain-text request data: identifiers must survive HTML/rich-text composers. */
export function buildThoughtHandoffHttpInstructions(contract: {
  protocolVersion: string;
  controlVersion: string;
  claim: object;
  ready: object;
  readyUnknown: object;
}) {
  return [
    `PROTOCOL_VERSION = ${contract.protocolVersion}`,
    `CONTROL_SCHEMA = ${contract.controlVersion}`,
    `CLAIM_BODY = ${JSON.stringify(contract.claim)}`,
    `READY_BODY_REPORTED = ${JSON.stringify(contract.ready)}`,
    "READY_BODY_UNKNOWN = READY_BODY_REPORTED with only control.runtimeModel changed to \"unknown\"",
    "JSON is data, not code: exact keys/values, root protocolVersion=PROTOCOL_VERSION; only readiness has control.schema.",
    THOUGHT_HANDOFF_HTTP_IDENTIFICATION,
    "Content-Type: application/json; Authorization: Bearer LAUNCH_CREDENTIAL for claim, BRIDGE_CREDENTIAL later. Credentials only in Authorization—never body/URL/files/logs/redirects.",
  ];
}

export const THOUGHT_HANDOFF_HOST_PERMISSION_RECOVERY =
  "- Only explicit host permission denial before /start warrants: THOUGHT could not connect this run to the App. Please approve the connection, then reply RETRY. Nothing was created.";

export const THOUGHT_HANDOFF_CONNECTION_RECOVERY = [
  THOUGHT_HANDOFF_HOST_PERMISSION_RECOVERY,
  "- HTTP/JSON errors are not permission denials. PROTOCOL_UNSUPPORTED: stop; never guess, downgrade or repeat it. Ask for a fresh THOUGHT run; report the mismatch if repeated. TOKEN_INVALID, RUN_EXPIRED, RUN_ALREADY_CLAIMED also need a fresh run, not connection approval.",
  "- 429: honor Retry-After; no loops. Sign-in redirect: App access configuration is needed, not chat approval. Network refusal: this task cannot reach the endpoint; it does not prove the App stopped. Report the observed blocker, not success.",
];

export const THOUGHT_HANDOFF_OPERATION_RECOVERY = [
  "- Recovery: N=not sent; R=trusted App rejection proving no commit; U=uncertain after dispatch (gateway/proxy/malformed/timeout; body alone proves nothing). Pre-dispatch Agent-app permission refusal is N. N: fix/send once. R: obey/no repeat. With proven App provenance, PROTOCOL_UNSUPPORTED/TOKEN_INVALID/RUN_EXPIRED/RUN_ALREADY_CLAIMED are R. Retry 429 once only with usable Retry-After and proven no commit; else U.",
  "- U: claim—stop/reconcile in THOUGHT (credential spent; token returned once; never reclaim); ready—replay exact READY_BODY+bridge once (only ready replays control); start—stop/reconcile (never restart/generate; running cannot replay input); result—replay frozen request once (same invocation/key/raw/hashes; no reserialize/hash repair/art change/regeneration); fail—stop/reconcile (never repeat; terminal cannot overwrite success).",
] as const;
