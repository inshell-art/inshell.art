export const THOUGHT_AGENT_HTTP_USER_AGENT = "Inshell-THOUGHT-Agent/2" as const;

export const THOUGHT_HANDOFF_HTTP_IDENTIFICATION =
  `All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}; identifies THOUGHT, never a browser/model.`;

export const THOUGHT_HANDOFF_INPUT_HASH_CONVENTION =
  "INPUT_HASH: spec/instructions/promptLine/agentInput sha256=\"sha256:\"+64 lowercase hex SHA-256(exact decoded .text UTF-8 bytes); no trim/normalize/JSON-hash; promptLine=agentInput text+hash.";

export const THOUGHT_HANDOFF_OPERATION_DIAGNOSTICS =
  "DIAG each preflight/claim/ready/start/result: emit OK:name only after HTTP+JSON+schema validation; failure only stage=name,class=permission|transport|http|parse|schema plus THOUGHT_STOP(N/R) or THOUGHT_UNCERTAIN(U). Never raw error/body/headers/URL/credential.";

/**
 * Codex returns the bridge token once, so the process that receives it must
 * remain alive until result submission. Bind the supported Codex host to its
 * concrete private input channel and fail closed before the irreversible
 * claim when that channel is unavailable.
 */
export const buildThoughtCodexPrivateContinuationInstructions = () => [
  "WORKER: one exec_command(tty:true) starts final noninteractive worker; all source secret-free in initial cmd; ECHO+ECHONL off before ECHO_READY. No child/replacement after proof; never write_stdin code/command.",
  "After fake nonce absent+ECHO_OK, send LAUNCH_CREDENTIAL once. Never output/store it. Then write_stdin only candidate. Bridge stays in worker; no file/storage/log/relay.",
  "PRECLAIM: worker GET CONNECTIVITY_ENDPOINT unauthenticated; require schema=CONNECTIVITY_SCHEMA,status=reachable,protocolVersion=PROTOCOL_VERSION. Failure=no claim; permission fix may fresh worker. Possible claim dispatch=>no replace/reclaim.",
  THOUGHT_HANDOFF_OPERATION_DIAGNOSTICS,
  "CREATIVE: only after valid /start, same worker shows input/rules; CANDIDATE via write_stdin; validate/hash/PUT one 1-64-byte Terminal English line; no clarification.",
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
      `Start: runId=${runId},state=running; ${responsePath.start.authority}=${authority}; ${responsePath.start.intent}=generate-thought-candidate. Under request require: spec.{id,text,sha256,contractSpecId,contractSpecHash}; instructions.{id,artifactId,text,sha256}; promptLine/agentInput objects with text,sha256; outputContract.release; outputContract.agentLine.workProfile=${workProfile}; spec.id=spec.contractSpecId; contractSpecHash=32-byte 0x hex; ${THOUGHT_HANDOFF_INPUT_HASH_CONVENTION} spec/instructions differ.`,
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
  "- Recovery: N=not sent: fix/send once; R=verified App no-commit: obey/no repeat; U=unproven after dispatch. Exact endpoint+parsed protocol error is insufficient; R also needs 4xx+known no-commit code; else U. Pre-send permission=N. PROTOCOL_UNSUPPORTED/TOKEN_INVALID/RUN_EXPIRED/RUN_ALREADY_CLAIMED are no-commit codes. 429 replay once only with usable Retry-After+proof no commit; else U.",
  "- U rules: claim stop/reconcile (credential spent/token once/no reclaim); ready replay exact READY_BODY+bridge once (sole control replay); start stop/reconcile (no restart/generate/input replay); result replay frozen request once (same invocation/key/raw/hashes; no reserialize/hash repair/art change/regeneration); fail stop/reconcile (no repeat/success overwrite).",
] as const;
