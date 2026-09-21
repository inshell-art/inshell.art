import { THOUGHT_V2_PROTOCOL_RELEASE } from "./release.generated";
import { THOUGHT_AGENT_RUN_AUTHORITY } from "./run-authority";
import { removeTrailingSlashes } from "./run-url";
import {
  buildThoughtHandoffHttpInstructions,
  THOUGHT_HANDOFF_HOST_PERMISSION_RECOVERY,
  THOUGHT_HANDOFF_OPERATION_RECOVERY,
} from "./handoff-http";

const THOUGHT_AGENT_PROTOCOL_VERSION = THOUGHT_V2_PROTOCOL_RELEASE.agentRunId;
const THOUGHT_AGENT_RESULT_VERSION =
  THOUGHT_V2_PROTOCOL_RELEASE.identifiers.agentResult;
const THOUGHT_AGENT_CONTROL_VERSION =
  "inshell.thought.agent-control.v2" as const;
const THOUGHT_AGENT_LINE_CONTRACT = {
  workProfile: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile,
  minUtf8Bytes: 1,
  maxUtf8Bytes: THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes,
} as const;

export const THOUGHT_CODEX_CLIENT_ROUTE = "/api/thought-agent/v2/client" as const;

export type ThoughtCodexReleaseBinding = {
  protocolReleaseId: `0x${string}`;
  manifestKeccak256: `0x${string}`;
};

export type ThoughtCodexResultContractBinding = {
  workProfile: string;
  declarationLabelField?: "agentLabel" | "label";
  lineValidation?: "terminal-english-64";
};

export type ThoughtCodexTaskInput = {
  product: string;
  runId: string;
  runUrl: string;
  launchToken: string;
  networkAuthorization?: "managed" | "preauthorized";
  release?: ThoughtCodexReleaseBinding;
  resultContract?: ThoughtCodexResultContractBinding;
};

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function buildThoughtCodexOperationContract(input: ThoughtCodexTaskInput) {
  if (!/^tar_[A-Za-z0-9_-]{8,}$/.test(input.runId)) {
    throw new Error("THOUGHT run ID is invalid.");
  }
  const release = input.release ?? THOUGHT_V2_PROTOCOL_RELEASE.release;
  const declarationLabelField =
    input.resultContract?.declarationLabelField ?? "label";
  const candidateTemplate = {
    schema: THOUGHT_AGENT_RESULT_VERSION,
    release,
    agentLine: "YOUR AGENT LINE",
    declaration: {
      schema: "inshell.thought.agent-declaration.v1",
      status: "declared-unverified",
      [declarationLabelField]: input.product,
      declaredOneCreativeResult: true,
    },
  };
  const bridge = {
    bridgeId: "inshell-thought-agent-direct",
    bridgeVersion: "0.0.3+direct",
    platform: "codex-direct-http",
  } as const;
  const adapter = {
    adapterId: "codex",
    adapterVersion: "direct-http",
  } as const;
  const claim = {
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    bridge,
    adapter,
  } as const;
  const ready = {
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    control: {
      schema: THOUGHT_AGENT_CONTROL_VERSION,
      mode: "bounded-preflight",
      appExchange: "verified",
      agentProduct: "declared",
      runtimeModel: "reported",
      localPreparation: "verified",
      installationsRequired: false,
      creativeInputOpened: false,
    },
  } as const;
  const readyUnknown = {
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    control: {
      ...ready.control,
      runtimeModel: "unknown",
    },
  } as const;
  const execution = {
    visibleTurns: 1,
    agentInvocations: 1,
    workspacePolicy: "external-agent-app",
    sandboxPolicy: "agent-owned",
    approvalPolicy: "bounded-control-complete",
    userConfigPolicy: "agent-owned",
  } as const;
  const invocationId = `tai_${input.runId.slice(4)}`;
  const baseUrl = removeTrailingSlashes(input.runUrl);
  return {
    schema: "inshell.thought.codex-operation-contract.v1" as const,
    runId: input.runId,
    baseUrl,
    launchToken: input.launchToken,
    networkAuthorization: input.networkAuthorization ?? "managed",
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    controlVersion: THOUGHT_AGENT_CONTROL_VERSION,
    resultVersion: THOUGHT_AGENT_RESULT_VERSION,
    workProfile: input.resultContract?.workProfile ?? THOUGHT_AGENT_LINE_CONTRACT.workProfile,
    lineValidation: input.resultContract?.lineValidation ?? "terminal-english-64",
    declarationLabelField,
    release,
    authority: THOUGHT_AGENT_RUN_AUTHORITY,
    invocationId,
    bridge,
    adapter,
    execution,
    claim,
    ready,
    readyUnknown,
    candidateTemplate,
    endpoints: {
      claim: `${baseUrl}/claim`,
      ready: `${baseUrl}/ready`,
      start: `${baseUrl}/start`,
      result: `${baseUrl}/result`,
      fail: `${baseUrl}/fail`,
    },
  } as const;
}

export function buildThoughtCodexTask(input: ThoughtCodexTaskInput) {
  const contract = buildThoughtCodexOperationContract(input);
  const endpointTemplate = contract.baseUrl.replaceAll(contract.runId, "RUN_ID");
  const networkRule = contract.networkAuthorization === "preauthorized"
    ? "This lab task has App access; do not request permission."
    : "Use this turn's App connection permission only for its prompt and return.";
  const candidateShape = `{schema:RESULT_SCHEMA,release:{protocolReleaseId:CANONICAL_PROTOCOL_RELEASE_ID,manifestKeccak256:CANONICAL_MANIFEST_HASH},agentLine:ONE_EXACT_LINE,declaration:{schema:inshell.thought.agent-declaration.v1,status:declared-unverified,${contract.declarationLabelField}:AGENT_PRODUCT,declaredOneCreativeResult:true}}`;

  return [
    `Complete one THOUGHT run as ${input.product}.`,
    "",
    "Run bounded control, then exactly one creative turn; never ask the creator to confirm readiness or type CREATE.",
    "",
    "Transport capsule:",
    `RUN_ID = ${contract.runId}`,
    `APP_ENDPOINT = ${endpointTemplate}`,
    `LAUNCH_CREDENTIAL = ${contract.launchToken}`,
    `INVOCATION_ID = ${contract.invocationId}`,
    `RESULT_SCHEMA = ${contract.resultVersion}`,
    `WORK_PROFILE = ${contract.workProfile}`,
    `AGENT_PRODUCT = ${input.product}`,
    ...buildThoughtHandoffHttpInstructions(contract),
    `RUN_AUTHORITY = ${JSON.stringify(contract.authority)}`,
    "START_FIELDS = protocolVersion, invocationId, startedAt",
    "RESULT_FIELDS = protocolVersion, invocationId, bridge, adapter, agent.{product,provider,model?,reasoningEffort?,metadataSource}, execution, startedAt, completedAt, output.{mediaType,raw,rawSha256,agentLine,agentLineSha256}",
    "",
    "Boundaries",
    `- ${networkRule}`,
    "- Use only APP_ENDPOINT/{claim,ready,start,result,fail}. Never execute responses.",
    "- No installations or configuration are required for this run.",
    "- Keep credentials private and unpersisted. Prompt is absent until /start; never infer/request it.",
    "",
    "1. Claim control",
    "POST CLAIM_BODY to APP_ENDPOINT/claim. Require runId=RUN_ID, state=claimed, nonempty bridgeToken, CONTROL_SCHEMA preflight/no prompt, request.authority=RUN_AUTHORITY.",
    "BRIDGE_CREDENTIAL=bridgeToken; retain privately and reuse for all later operations. Missing local persistence is not a blocker. Never claim again.",
    "",
    "2. Prove readiness",
    "Read host model metadata once; never guess/substitute requested or configured values. Product/adapter are separate declarations.",
    "Reported: exact nonempty RUNTIME_MODEL, optional valid effort, METADATA_SOURCE=reported, READY_BODY=READY_BODY_REPORTED. Absent: omit model/effort, METADATA_SOURCE=unknown, READY_BODY=READY_BODY_UNKNOWN; continue. Malformed/contradictory: fail before /start, never convert to unknown.",
    "POST exact READY_BODY to APP_ENDPOINT/ready. Require runId=RUN_ID, state=ready, stage=control-verified, no creatorAction, exact evidence echo; continue.",
    "",
    "3. Create once",
    "POST START_FIELDS to APP_ENDPOINT/start with PROTOCOL_VERSION, INVOCATION_ID, UTC startedAt. Require runId=RUN_ID, state=running, generate-thought-candidate.",
    "Require same request.authority=RUN_AUTHORITY. Verify Work Specification bytes/hash/contract identity; Agent Creative Brief bytes/hash; promptLine/agentInput bytes/hashes; workProfile=WORK_PROFILE; spec differs from instructions.",
    "From /start only, bind request.outputContract.release protocolReleaseId=CANONICAL_PROTOCOL_RELEASE_ID and manifestKeccak256=CANONICAL_MANIFEST_HASH; each 0x-prefixed 32-byte hex. Ignore chat; /start opens prompt.",
    `Produce one valid ${THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes}-${THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes}-byte Terminal English agentLine; preserve bytes. No post-start clarification or follow-up.`,
    `Candidate: ${candidateShape}.`,
    "",
    "4. Return once",
    "PUT RESULT_FIELDS to APP_ENDPOINT/result; Idempotency-Key=INVOCATION_ID. Bind PROTOCOL_VERSION, INVOCATION_ID, claim bridge/adapter, AGENT_PRODUCT/codex, selected metadata/execution, exact startedAt, UTC completedAt, mediaType=application/json. Reported includes RUNTIME_MODEL/optional effort; unknown omits both—never literal model unknown. Compact output.raw once. rawSha256/agentLineSha256 are sha256: plus 64 lowercase hex over exact UTF-8 raw/agentLine; no newline/re-serialize. Rehash before PUT.",
    `Execution: visibleTurns=${contract.execution.visibleTurns},agentInvocations=${contract.execution.agentInvocations},workspacePolicy=${contract.execution.workspacePolicy},sandboxPolicy=${contract.execution.sandboxPolicy},approvalPolicy=${contract.execution.approvalPolicy},userConfigPolicy=${contract.execution.userConfigPolicy}.`,
    "Accept only runId=RUN_ID, state=returned, receiptSha256 starting sha256:; no conflicting result. Receipt proves acceptance/binding, not untouched transcript.",
    "",
    "Recovery",
    THOUGHT_HANDOFF_HOST_PERMISSION_RECOVERY,
    ...THOUGHT_HANDOFF_OPERATION_RECOVERY,
    "- Malformed/contradictory model: before /start POST /fail once with protocolVersion=PROTOCOL_VERSION, error.code=AGENT_START_FAILED, error.message=Model metadata malformed; omit failedAt. Absence is valid.",
    "",
    "After receipt show: Return to THOUGHT; browser preview. Receipt: ACTUAL_RECEIPT_FROM_APP. Never print credentials.",
  ].join("\n");
}

export function buildThoughtCodexClientScript(options?: {
  release?: ThoughtCodexReleaseBinding;
  resultContract?: ThoughtCodexResultContractBinding;
}) {
  const claimBody = JSON.stringify({
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    bridge: {
      bridgeId: "inshell-thought-agent-demo",
      bridgeVersion: "0.0.2+dev",
      platform: "browser-demo",
    },
    adapter: {
      adapterId: "codex",
      adapterVersion: "demo-callback",
    },
  });
  const bridgeJson = JSON.stringify({
    bridgeId: "inshell-thought-agent-demo",
    bridgeVersion: "0.0.2+dev",
    platform: "browser-demo",
  });
  const adapterJson = JSON.stringify({
    adapterId: "codex",
    adapterVersion: "demo-callback",
  });
  const agentJson = JSON.stringify({
    product: "Codex",
    productVersion: "demo",
    provider: "codex",
    model: "codex",
    metadataSource: "configured",
  });
  const executionJson = JSON.stringify({
    visibleTurns: 1,
    agentInvocations: 1,
    workspacePolicy: "external-agent-app",
    sandboxPolicy: "agent-owned",
    approvalPolicy: "agent-owned",
    userConfigPolicy: "agent-owned",
  });
  const release = options?.release ?? THOUGHT_V2_PROTOCOL_RELEASE.release;
  const workProfile = options?.resultContract?.workProfile ?? THOUGHT_AGENT_LINE_CONTRACT.workProfile;
  const declarationLabelField = options?.resultContract?.declarationLabelField ?? "label";
  const lineValidation = options?.resultContract?.lineValidation ?? "terminal-english-64";
  const releaseConstantLines = [
    `readonly THOUGHT_PROTOCOL_RELEASE_ID=${shellQuote(release.protocolReleaseId)}`,
    `readonly THOUGHT_MANIFEST_KECCAK256=${shellQuote(release.manifestKeccak256)}`,
  ];
  const claimReleaseLines = [
    'THOUGHT_CLAIM_RELEASE_ID="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.outputContract.release.protocolReleaseId)" || thought_fail "Claim protocol release ID missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
    'THOUGHT_CLAIM_MANIFEST_HASH="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.outputContract.release.manifestKeccak256)" || thought_fail "Claim manifest hash missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_CLAIM_RELEASE_ID" == "$THOUGHT_PROTOCOL_RELEASE_ID" ]] || thought_fail "Claim protocol release ID mismatch" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_CLAIM_MANIFEST_HASH" == "$THOUGHT_MANIFEST_KECCAK256" ]] || thought_fail "Claim manifest hash mismatch" "AGENT_OUTPUT_SCHEMA_INVALID"',
  ];
  const declarationFilter = declarationLabelField === "label"
    ? '((.declaration | keys_unsorted | sort) == ["declaredOneCreativeResult","label","schema","status"]) and .declaration.schema == "inshell.thought.agent-declaration.v1" and .declaration.status == "declared-unverified" and (.declaration.label | type) == "string" and (.declaration.label | length) >= 1 and .declaration.declaredOneCreativeResult == true'
    : '((.declaration | keys_unsorted | sort) == ["agentLabel","declaredOneCreativeResult","schema","status"]) and .declaration.schema == "inshell.thought.agent-declaration.v1" and .declaration.status == "declared-unverified" and (.declaration.agentLabel | type) == "string" and (.declaration.agentLabel | length) >= 1 and (.declaration.agentLabel | length) <= 100 and .declaration.declaredOneCreativeResult == true';
  const parseAgentLine = `THOUGHT_AGENT_LINE="$(printf %s "$THOUGHT_RAW_OUTPUT" | jq -er --arg schema "$THOUGHT_RESULT_SCHEMA" --arg release "$THOUGHT_PROTOCOL_RELEASE_ID" --arg manifest "$THOUGHT_MANIFEST_KECCAK256" 'if type == "object" and .schema == $schema and (.agentLine | type) == "string" and (((keys_unsorted | sort) == ["agentLine","release","schema"]) or ((keys_unsorted | sort) == ["agentLine","declaration","release","schema"])) and (.release | type) == "object" and ((.release | keys_unsorted | sort) == ["manifestKeccak256","protocolReleaseId"]) and .release.protocolReleaseId == $release and .release.manifestKeccak256 == $manifest and ((has("declaration") | not) or ((.declaration | type) == "object" and ${declarationFilter})) then .agentLine else error("candidate schema invalid") end')" || thought_fail "candidate JSON invalid" "AGENT_OUTPUT_UNPARSEABLE"`;

  return [
    "#!/bin/zsh",
    "set -eu",
    "",
    ': "${THOUGHT_RUN_URL:?THOUGHT_RUN_URL is required}"',
    ': "${THOUGHT_LAUNCH_TOKEN:?THOUGHT_LAUNCH_TOKEN is required}"',
    `readonly THOUGHT_PROTOCOL=${shellQuote(THOUGHT_AGENT_PROTOCOL_VERSION)}`,
    `readonly THOUGHT_RESULT_SCHEMA=${shellQuote(THOUGHT_AGENT_RESULT_VERSION)}`,
    `readonly THOUGHT_WORK_PROFILE=${shellQuote(workProfile)}`,
    `readonly THOUGHT_SELECTED_SPEC_SHA256=${shellQuote(`sha256:${THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256}`)}`,
    `readonly THOUGHT_CREATIVE_BRIEF_ID=${shellQuote(THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.id)}`,
    `readonly THOUGHT_CREATIVE_BRIEF_SHA256=${shellQuote(`sha256:${THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.sha256}`)}`,
    `readonly THOUGHT_LINE_VALIDATION=${shellQuote(lineValidation)}`,
    `readonly THOUGHT_AGENT_LINE_MIN_BYTES=${shellQuote(String(THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes))}`,
    `readonly THOUGHT_AGENT_LINE_MAX_BYTES=${shellQuote(String(THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes))}`,
    ...releaseConstantLines,
    `readonly THOUGHT_CLAIM_BODY=${shellQuote(claimBody)}`,
    `readonly THOUGHT_BRIDGE_JSON=${shellQuote(bridgeJson)}`,
    `readonly THOUGHT_ADAPTER_JSON=${shellQuote(adapterJson)}`,
    `readonly THOUGHT_AGENT_JSON=${shellQuote(agentJson)}`,
    `readonly THOUGHT_EXECUTION_JSON=${shellQuote(executionJson)}`,
    'readonly THOUGHT_CLAIM_URL="${THOUGHT_RUN_URL}/claim"',
    'readonly THOUGHT_START_URL="${THOUGHT_RUN_URL}/start"',
    'readonly THOUGHT_RESULT_URL="${THOUGHT_RUN_URL}/result"',
    'readonly THOUGHT_FAIL_URL="${THOUGHT_RUN_URL}/fail"',
    'THOUGHT_BRIDGE_TOKEN=""',
    'THOUGHT_INVOCATION_ID=""',
    'THOUGHT_FAILURE_REPORTING=0',
    "",
    "thought_report_failure() {",
    '  local failure_code="$1"',
    '  local failure_message="$2"',
    '  [[ -n "$THOUGHT_BRIDGE_TOKEN" ]] || return 0',
    '  [[ "$THOUGHT_FAILURE_REPORTING" == "0" ]] || return 0',
    '  THOUGHT_FAILURE_REPORTING=1',
    '  local failed_at="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"',
    '  local failure_body',
    '  failure_body="$(jq -cn --arg protocol "$THOUGHT_PROTOCOL" --arg invocationId "$THOUGHT_INVOCATION_ID" --arg failedAt "$failed_at" --arg code "$failure_code" --arg message "$failure_message" \'{protocolVersion:$protocol,failedAt:$failedAt,error:{code:$code,message:$message}} + (if $invocationId == "" then {} else {invocationId:$invocationId} end)\')" || true',
    '  if [[ -n "$failure_body" ]]; then',
    '    curl --disable --silent --show-error --connect-timeout 8 --max-time 30 --request POST --header "content-type: application/json" --header "Authorization: Bearer $THOUGHT_BRIDGE_TOKEN" --data-binary "$failure_body" "$THOUGHT_FAIL_URL" >/dev/null 2>&1 || true',
    "  fi",
    '  THOUGHT_FAILURE_REPORTING=0',
    "}",
    "",
    "thought_fail() {",
    '  local failure_message="$1"',
    '  local failure_code="${2:-AGENT_START_FAILED}"',
    '  thought_report_failure "$failure_code" "$failure_message"',
    '  print -u2 -r -- "THOUGHT_CLIENT_ERROR $failure_message"',
    "  exit 1",
    "}",
    "",
    "command -v curl >/dev/null 2>&1 || thought_fail 'curl is required'",
    "command -v jq >/dev/null 2>&1 || thought_fail 'jq is required'",
    "command -v shasum >/dev/null 2>&1 || thought_fail 'shasum is required'",
    "command -v openssl >/dev/null 2>&1 || thought_fail 'openssl is required'",
    "",
    "thought_request() {",
    '  local request_method="$1"',
    '  local request_url="$2"',
    '  local bearer_value="${3:-}"',
    '  local request_body="${4:-}"',
    '  local idempotency_value="${5:-}"',
    "  local -a request_args",
    '  request_args=(--disable --silent --show-error --connect-timeout 8 --max-time 30 --request "$request_method" --header "content-type: application/json" --write-out $\'\\n%{http_code}\')',
    '  [[ -n "$bearer_value" ]] && request_args+=(--header "Authorization: Bearer $bearer_value")',
    '  [[ -n "$idempotency_value" ]] && request_args+=(--header "Idempotency-Key: $idempotency_value")',
    '  [[ -n "$request_body" ]] && request_args+=(--data-binary "$request_body")',
    "  local request_response",
    '  request_response="$(curl "${request_args[@]}" "$request_url")" || thought_fail "request failed"',
    '  THOUGHT_HTTP_BODY="${request_response%$\'\\n\'*}"',
    '  THOUGHT_HTTP_CODE="${request_response##*$\'\\n\'}"',
    "}",
    "",
    "thought_api_error() {",
    '  local error_code="$(printf %s "$THOUGHT_HTTP_BODY" | jq -r \'.error.code // "UNKNOWN"\' 2>/dev/null || print UNKNOWN)"',
    `  local error_message="$(printf %s "$THOUGHT_HTTP_BODY" | jq -r '.error.message // "request rejected"' 2>/dev/null || print 'request rejected')"`,
    '  thought_fail "HTTP ${THOUGHT_HTTP_CODE} ${error_code}: ${error_message}" "$error_code"',
    "}",
    "",
    "thought_claim_text_sha256() {",
    '  local jq_path="$1"',
    '  printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -j "$jq_path" | shasum -a 256 | awk \'{print "sha256:" $1}\'',
    "}",
    "",
    "thought_validate_terminal_english_64_json() {",
    '  local json_value="$1"',
    '  local jq_path="$2"',
    '  local line_label="$3"',
    '  printf %s "$json_value" | jq -e "def terminal_english_64: type == \\"string\\" and (length >= 1 and length <= 64) and (startswith(\\" \\") | not) and (endswith(\\" \\") | not) and (contains(\\"  \\") | not) and (explode | all(. == 32 or (. >= 48 and . <= 57) or (. >= 65 and . <= 90) or (. >= 97 and . <= 122) or . == 33 or . == 34 or . == 38 or . == 39 or . == 40 or . == 41 or . == 44 or . == 45 or . == 46 or . == 47 or . == 58 or . == 59 or . == 63)); ${jq_path} | terminal_english_64" >/dev/null || thought_fail "${line_label} violates terminal-english-64" "AGENT_OUTPUT_SCHEMA_INVALID"',
    "}",
    "",
    'thought_request POST "$THOUGHT_CLAIM_URL" "$THOUGHT_LAUNCH_TOKEN" "$THOUGHT_CLAIM_BODY"',
    '[[ "$THOUGHT_HTTP_CODE" == "200" ]] || thought_api_error',
    "",
    'THOUGHT_CLAIM_RESPONSE="$THOUGHT_HTTP_BODY"',
    'THOUGHT_BRIDGE_TOKEN="$(printf %s "$THOUGHT_HTTP_BODY" | jq -er .bridgeToken)" || thought_fail "bridge token missing" "TOKEN_INVALID"',
    'THOUGHT_CLAIM_WORK_PROFILE="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.outputContract.agentLine.workProfile)" || thought_fail "Claim output work profile missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
    'THOUGHT_CLAIM_MIN_BYTES="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.outputContract.agentLine.minUtf8Bytes)" || thought_fail "Claim output minimum missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
    'THOUGHT_CLAIM_MAX_BYTES="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.outputContract.agentLine.maxUtf8Bytes)" || thought_fail "Claim output maximum missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
    'THOUGHT_CLAIM_NORMALIZATION="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.outputContract.agentLine.normalization)" || thought_fail "Claim normalization contract missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
    'THOUGHT_CLAIM_DISPLAY_LIMIT="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -r .request.outputContract.agentLine.displayUnitsAreAcceptanceLimits)" || thought_fail "Claim display-unit contract missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_CLAIM_WORK_PROFILE" == "$THOUGHT_WORK_PROFILE" ]] || thought_fail "Claim work profile mismatch" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_CLAIM_MIN_BYTES" == "$THOUGHT_AGENT_LINE_MIN_BYTES" ]] || thought_fail "Claim output minimum mismatch" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_CLAIM_MAX_BYTES" == "$THOUGHT_AGENT_LINE_MAX_BYTES" ]] || thought_fail "Claim output maximum mismatch" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_CLAIM_NORMALIZATION" == "none" ]] || thought_fail "Claim normalization mismatch" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_CLAIM_DISPLAY_LIMIT" == "false" ]] || thought_fail "Claim incorrectly makes display units an acceptance limit" "AGENT_OUTPUT_SCHEMA_INVALID"',
    ...claimReleaseLines,
    'THOUGHT_CLAIM_INSTRUCTIONS_HASH="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.instructions.sha256)" || thought_fail "Claim instructions hash missing" "AGENT_INPUT_HASH_MISMATCH"',
    'THOUGHT_CLAIM_SPEC_HASH="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.spec.sha256)" || thought_fail "Claim selected-spec hash missing" "SPEC_HASH_MISMATCH"',
    'THOUGHT_CLAIM_INSTRUCTIONS_ID="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.instructions.id)" || thought_fail "Claim creative-brief ID missing" "AGENT_INPUT_HASH_MISMATCH"',
    'THOUGHT_CLAIM_PROMPT_HASH="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.promptLine.sha256)" || thought_fail "Claim prompt hash missing" "PROMPT_HASH_MISMATCH"',
    'THOUGHT_CLAIM_AGENT_INPUT_HASH="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.agentInput.sha256)" || thought_fail "Claim Agent input hash missing" "AGENT_INPUT_HASH_MISMATCH"',
    '[[ "$THOUGHT_CLAIM_SPEC_HASH" == "$THOUGHT_SELECTED_SPEC_SHA256" ]] || thought_fail "Claim selected-spec hash mismatch" "SPEC_HASH_MISMATCH"',
    '[[ "$THOUGHT_CLAIM_INSTRUCTIONS_ID" == "$THOUGHT_CREATIVE_BRIEF_ID" ]] || thought_fail "Claim creative-brief ID mismatch" "AGENT_INPUT_HASH_MISMATCH"',
    '[[ "$THOUGHT_CLAIM_INSTRUCTIONS_HASH" == "$THOUGHT_CREATIVE_BRIEF_SHA256" ]] || thought_fail "Claim creative-brief hash mismatch" "AGENT_INPUT_HASH_MISMATCH"',
    '[[ "$(thought_claim_text_sha256 .request.spec.text)" == "$THOUGHT_CLAIM_SPEC_HASH" ]] || thought_fail "Claim selected-spec byte mismatch" "SPEC_HASH_MISMATCH"',
    '[[ "$(thought_claim_text_sha256 .request.instructions.text)" == "$THOUGHT_CLAIM_INSTRUCTIONS_HASH" ]] || thought_fail "Claim instructions hash mismatch" "AGENT_INPUT_HASH_MISMATCH"',
    '[[ "$(thought_claim_text_sha256 .request.promptLine.text)" == "$THOUGHT_CLAIM_PROMPT_HASH" ]] || thought_fail "Claim prompt hash mismatch" "PROMPT_HASH_MISMATCH"',
    '[[ "$(thought_claim_text_sha256 .request.agentInput.text)" == "$THOUGHT_CLAIM_AGENT_INPUT_HASH" ]] || thought_fail "Claim Agent input hash mismatch" "AGENT_INPUT_HASH_MISMATCH"',
    'printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -e \'.request.instructions.text != .request.spec.text and .request.instructions.sha256 != .request.spec.sha256\' >/dev/null || thought_fail "Claim selected spec and creative brief were conflated" "SPEC_HASH_MISMATCH"',
    'printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -e \'.request.promptLine.text == .request.agentInput.text and .request.promptLine.sha256 == .request.agentInput.sha256\' >/dev/null || thought_fail "Claim prompt does not match Agent input" "AGENT_INPUT_HASH_MISMATCH"',
    'if [[ "$THOUGHT_LINE_VALIDATION" == "terminal-english-64" ]]; then',
    '  thought_validate_terminal_english_64_json "$THOUGHT_CLAIM_RESPONSE" ".request.promptLine.text" "prompt line"',
    "fi",
    'THOUGHT_INVOCATION_ID="tai_$(openssl rand -hex 12)"',
    'THOUGHT_STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"',
    'THOUGHT_START_BODY="$(jq -cn --arg protocol "$THOUGHT_PROTOCOL" --arg invocationId "$THOUGHT_INVOCATION_ID" --arg startedAt "$THOUGHT_STARTED_AT" \'{protocolVersion:$protocol,invocationId:$invocationId,startedAt:$startedAt}\')"',
    'thought_request POST "$THOUGHT_START_URL" "$THOUGHT_BRIDGE_TOKEN" "$THOUGHT_START_BODY"',
    '[[ "$THOUGHT_HTTP_CODE" == "200" ]] || thought_api_error',
    "",
    'print -r -- "THOUGHT_VERIFIED_INSTRUCTIONS_BEGIN"',
    'printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.instructions.text',
    'print -r -- "THOUGHT_VERIFIED_INSTRUCTIONS_END"',
    'print -r -- "THOUGHT_VERIFIED_PROMPT_BEGIN"',
    'printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.promptLine.text',
    'print -r -- "THOUGHT_VERIFIED_PROMPT_END"',
    'print -r -- "THOUGHT_VERIFIED_OUTPUT_CONTRACT_BEGIN"',
    'print -r -- "Agent line work profile: ${THOUGHT_CLAIM_WORK_PROFILE}"',
    'print -r -- "Agent line UTF-8 bytes: ${THOUGHT_CLAIM_MIN_BYTES}-${THOUGHT_CLAIM_MAX_BYTES}"',
    'print -r -- "Agent line normalization: ${THOUGHT_CLAIM_NORMALIZATION}"',
    'if [[ "$THOUGHT_LINE_VALIDATION" == "terminal-english-64" ]]; then',
    '  print -r -- "Agent line characters: closed 76-character Terminal English repertoire."',
    '  print -r -- "Agent line spacing: single internal U+0020 spaces only."',
    "fi",
    'print -r -- "Display units are not acceptance limits."',
    'print -r -- "THOUGHT_VERIFIED_OUTPUT_CONTRACT_END"',
    'print -r -- "THOUGHT_INPUT_READY"',
    "",
    'IFS= read -r THOUGHT_RAW_OUTPUT || thought_fail "candidate input missing" "AGENT_OUTPUT_MISSING"',
    parseAgentLine,
    'THOUGHT_AGENT_LINE_BYTES="$(LC_ALL=C printf %s "$THOUGHT_AGENT_LINE" | wc -c | tr -d "[:space:]")"',
    '[[ "$THOUGHT_AGENT_LINE_BYTES" -ge "$THOUGHT_CLAIM_MIN_BYTES" ]] || thought_fail "agent line is ${THOUGHT_AGENT_LINE_BYTES}/${THOUGHT_CLAIM_MAX_BYTES} UTF-8 bytes" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_AGENT_LINE_BYTES" -le "$THOUGHT_CLAIM_MAX_BYTES" ]] || thought_fail "agent line is ${THOUGHT_AGENT_LINE_BYTES}/${THOUGHT_CLAIM_MAX_BYTES} UTF-8 bytes" "AGENT_OUTPUT_SCHEMA_INVALID"',
    'if [[ "$THOUGHT_LINE_VALIDATION" == "terminal-english-64" ]]; then',
    '  thought_validate_terminal_english_64_json "$THOUGHT_RAW_OUTPUT" ".agentLine" "agent line"',
    "fi",
    'THOUGHT_RAW_HASH="sha256:$(printf %s "$THOUGHT_RAW_OUTPUT" | shasum -a 256 | awk \'{print $1}\')"',
    'THOUGHT_AGENT_LINE_HASH="sha256:$(printf %s "$THOUGHT_AGENT_LINE" | shasum -a 256 | awk \'{print $1}\')"',
    'THOUGHT_COMPLETED_AT="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"',
    'THOUGHT_RESULT_BODY="$(jq -cn --arg protocol "$THOUGHT_PROTOCOL" --arg invocationId "$THOUGHT_INVOCATION_ID" --argjson bridge "$THOUGHT_BRIDGE_JSON" --argjson adapter "$THOUGHT_ADAPTER_JSON" --argjson agent "$THOUGHT_AGENT_JSON" --argjson execution "$THOUGHT_EXECUTION_JSON" --arg startedAt "$THOUGHT_STARTED_AT" --arg completedAt "$THOUGHT_COMPLETED_AT" --arg raw "$THOUGHT_RAW_OUTPUT" --arg rawSha256 "$THOUGHT_RAW_HASH" --arg agentLine "$THOUGHT_AGENT_LINE" --arg agentLineSha256 "$THOUGHT_AGENT_LINE_HASH" \'{protocolVersion:$protocol,invocationId:$invocationId,bridge:$bridge,adapter:$adapter,agent:$agent,execution:$execution,startedAt:$startedAt,completedAt:$completedAt,output:{mediaType:"application/json",raw:$raw,rawSha256:$rawSha256,agentLine:$agentLine,agentLineSha256:$agentLineSha256}}\')"',
    'thought_request PUT "$THOUGHT_RESULT_URL" "$THOUGHT_BRIDGE_TOKEN" "$THOUGHT_RESULT_BODY" "$THOUGHT_INVOCATION_ID"',
    '[[ "$THOUGHT_HTTP_CODE" == "200" ]] || thought_api_error',
    'THOUGHT_RETURN_STATE="$(printf %s "$THOUGHT_HTTP_BODY" | jq -er .state)" || thought_fail "result state missing"',
    '[[ "$THOUGHT_RETURN_STATE" == "returned" ]] || thought_fail "result state is not returned"',
    'THOUGHT_RECEIPT="$(printf %s "$THOUGHT_HTTP_BODY" | jq -er .result.receipt.receiptSha256)" || thought_fail "receipt missing"',
    '[[ "$THOUGHT_RECEIPT" == sha256:* ]] || thought_fail "receipt is invalid"',
    'print -r -- "THOUGHT_RESULT_OK"',
    'print -r -- "Receipt: ${THOUGHT_RECEIPT}"',
  ].join("\n") + "\n";
}
