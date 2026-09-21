export const THOUGHT_AGENT_HTTP_USER_AGENT = "Inshell-THOUGHT-Agent/2" as const;

export const THOUGHT_HANDOFF_HTTP_IDENTIFICATION =
  `All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}; identifies THOUGHT, never a browser/model.`;

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
    `READY_BODY_UNKNOWN = ${JSON.stringify(contract.readyUnknown)}`,
    "JSON is data, not code. Exact keys/values; root protocolVersion=PROTOCOL_VERSION; readiness control.schema=CONTROL_SCHEMA.",
    THOUGHT_HANDOFF_HTTP_IDENTIFICATION,
    "All requests: Content-Type: application/json; Authorization: Bearer LAUNCH_CREDENTIAL for claim, BRIDGE_CREDENTIAL later. Substitute values. Credentials only in Authorization—never body/URL/files/logs or redirects.",
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
