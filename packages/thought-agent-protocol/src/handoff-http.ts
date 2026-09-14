export const THOUGHT_AGENT_HTTP_USER_AGENT = "Inshell-THOUGHT-Agent/2" as const;

export const THOUGHT_HANDOFF_HTTP_IDENTIFICATION =
  `All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}. Identifies THOUGHT protocol; never impersonate a browser or model.`;

/** Plain-text request data: identifiers must survive HTML/rich-text composers. */
export function buildThoughtHandoffHttpInstructions(contract: {
  protocolVersion: string;
  controlVersion: string;
  claim: object;
  ready: object;
}) {
  return [
    `PROTOCOL_VERSION = ${contract.protocolVersion}`,
    `CONTROL_SCHEMA = ${contract.controlVersion}`,
    `CLAIM_BODY = ${JSON.stringify(contract.claim)}`,
    `READY_BODY = ${JSON.stringify(contract.ready)}`,
    "JSON bodies are data, not code. Send exact names/values. Every root protocolVersion uses PROTOCOL_VERSION; CONTROL_SCHEMA is only readiness control.schema, never protocolVersion.",
    THOUGHT_HANDOFF_HTTP_IDENTIFICATION,
    "All requests: Content-Type: application/json. Claim header: Authorization: Bearer LAUNCH_CREDENTIAL. Remaining headers: Authorization: Bearer BRIDGE_CREDENTIAL. Substitute values, not identifier names. Credentials go only in Authorization, never body, URL, files or logs; never forward across redirects.",
  ];
}

export const THOUGHT_HANDOFF_CONNECTION_RECOVERY = [
  "- Only explicit host permission denial before /start warrants: THOUGHT could not connect this run to the App. Please approve the connection, then reply RETRY. Nothing was created.",
  "- HTTP/JSON errors are not permission denials. PROTOCOL_UNSUPPORTED: stop; never guess, downgrade or repeat it. Ask for a fresh THOUGHT run; report the mismatch if repeated. TOKEN_INVALID, RUN_EXPIRED, RUN_ALREADY_CLAIMED also need a fresh run, not connection approval.",
  "- 429: honor Retry-After; no loops. Sign-in redirect: App access configuration is needed, not chat approval. Network refusal: this task cannot reach the endpoint; it does not prove the App stopped. Report the observed blocker, not success.",
];
