export const THOUGHT_AGENT_HTTP_USER_AGENT = "Inshell-THOUGHT-Agent/2" as const;

export const THOUGHT_HANDOFF_HTTP_IDENTIFICATION =
  `All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}; identifies THOUGHT, never a browser/model.`;

/**
 * Codex returns the bridge token once, so the process that receives it must
 * remain alive until result submission. Bind the supported Codex host to its
 * concrete private input channel and fail closed before the irreversible
 * claim when that channel is unavailable.
 */
export const buildThoughtCodexPrivateContinuationInstructions = () => [
  "WORKER: one exec_command(tty:true) -c; disable ECHO+ECHONL before markers or stop. Emit ECHO_READY; write fake nonce; assert absent in output; await OK; write PROCEED. No heredoc.",
  "CREDENTIALS: after no-echo proof, launch may enter once via write_stdin if needed; never terminal output/stdout/stderr/files/logs. Bridge remains worker-private; no relay/storage.",
  "PRECLAIM: same-worker credential-free GET CONNECTIVITY_ENDPOINT; require schema=CONNECTIVITY_SCHEMA,status=reachable,protocolVersion=PROTOCOL_VERSION. Failure=no claim; permission fix permits fresh worker. Possible claim dispatch forbids replacement/reclaim.",
  "DIAGNOSTICS: stage+class only; THOUGHT_STOP pre-dispatch or for trusted App rejection; THOUGHT_UNCERTAIN only after possible unproven dispatch; never raw exception/reason/body/headers/URL/credential. Worker loss after claim=>stop/reconcile.",
  "CREATIVE: no agentLine/candidate before verified /start. Same worker displays verified brief/input/rules then waits for CANDIDATE via write_stdin; compose valid 1-64-byte Terminal English; validate/hash/PUT; no creator clarification.",
];

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
      `Claim: runId=${runId},state=claimed; nonempty top-level ${responsePath.claim.bridgeToken}; ${responsePath.claim.authority}=${authority}; ${responsePath.claim.intent}=prepare-thought-creation; ${responsePath.claim.controlMode}=bounded-preflight; ${responsePath.claim.controlSchema}=${controlSchema}; no control/request.control/bridge/adapter/creative input.`,
    start:
      `Start: runId=${runId},state=running; ${responsePath.start.authority}=${authority}; ${responsePath.start.intent}=generate-thought-candidate. Under request require: spec.{id,text,sha256,contractSpecId,contractSpecHash}; instructions.{id,artifactId,text,sha256}; promptLine/agentInput objects with text,sha256; outputContract.release; outputContract.agentLine.workProfile=${workProfile}; spec.id=spec.contractSpecId; contractSpecHash=32-byte 0x hex; exact text hashes; prompt/input text+hash equal; spec/instructions differ.`,
  } as const;
};

const defaultResponseChecks = buildThoughtHandoffResponseChecks();

export const THOUGHT_HANDOFF_CLAIM_RESPONSE_CHECK = defaultResponseChecks.claim;

export const THOUGHT_HANDOFF_READY_RESPONSE_CHECK =
  `Ready: protocolVersion=READY_BODY.protocolVersion; top-level ${responsePath.ready.control}=READY_BODY.control by exact typed entries, any order; no request.control.`;

export const THOUGHT_HANDOFF_START_RESPONSE_CHECK = defaultResponseChecks.start;

export const THOUGHT_HANDOFF_RESULT_RESPONSE_CHECK =
  `Result: ${responsePath.result.receiptSha256} begins sha256:; no top-level receiptSha256.`;

export const THOUGHT_HANDOFF_FAIL_RESPONSE_CHECK =
  `Fail: root ${responsePath.fail.code} and ${responsePath.fail.message}; no request.error.`;

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
  "- Recovery: N=not sent; R=trusted App rejection proving no commit; U=uncertain after dispatch (gateway/proxy/malformed/timeout; body alone proves nothing). Pre-dispatch permission refusal=N. N: fix/send once; R: obey/no repeat. Proven-App PROTOCOL_UNSUPPORTED/TOKEN_INVALID/RUN_EXPIRED/RUN_ALREADY_CLAIMED=R. 429: retry once only with usable Retry-After+proven no commit; else U.",
  "- U rules: claim stop/reconcile (credential spent/token once/no reclaim); ready replay exact READY_BODY+bridge once (sole control replay); start stop/reconcile (no restart/generate/input replay); result replay frozen request once (same invocation/key/raw/hashes; no reserialize/hash repair/art change/regeneration); fail stop/reconcile (no repeat/success overwrite).",
] as const;
