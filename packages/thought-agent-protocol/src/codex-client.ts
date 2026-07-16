import { THOUGHT_V2_PROTOCOL_RELEASE } from "./release.generated";

const THOUGHT_AGENT_PROTOCOL_VERSION = THOUGHT_V2_PROTOCOL_RELEASE.agentRunId;
const THOUGHT_AGENT_RESULT_VERSION =
  THOUGHT_V2_PROTOCOL_RELEASE.identifiers.agentResult;
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

export type ThoughtCodexTaskInput = {
  product: string;
  runId: string;
  promptLine: string;
  runUrl: string;
  clientUrl: string;
  launchToken: string;
  release?: ThoughtCodexReleaseBinding;
};

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function buildThoughtCodexTask(input: ThoughtCodexTaskInput) {
  const resultExample = JSON.stringify(input.release
    ? {
        schema: THOUGHT_AGENT_RESULT_VERSION,
        release: input.release,
        agentLine: "YOUR AGENT LINE",
        declaration: {
          schema: "inshell.thought.agent-declaration.v1",
          status: "declared-unverified",
          agentLabel: input.product,
          declaredOneCreativeResult: true,
        },
      }
    : {
        schema: THOUGHT_AGENT_RESULT_VERSION,
        agentLine: "YOUR AGENT LINE",
      });
  const command = [
    `THOUGHT_RUN_URL=${shellQuote(input.runUrl)}`,
    `THOUGHT_LAUNCH_TOKEN=${shellQuote(input.launchToken)}`,
    "/bin/zsh -c",
    `"$(curl -fsS ${shellQuote(input.clientUrl)})"`,
  ].join(" ");

  return [
    `You are ${input.product} running one THOUGHT round.`,
    "",
    "Run:",
    input.runId,
    "",
    "Task:",
    input.promptLine,
    "",
    "Do not answer or reason about Task before the client prints THOUGHT_INPUT_READY.",
    "",
    "Protocol execution:",
    "1. Your first action must be this exact shell command in a PTY:",
    command,
    "2. If localhost is blocked by the managed sandbox, rerun that exact command with network escalation. Do not change the command.",
    "3. Only after the client prints THOUGHT_INPUT_READY, read the verified instructions and prompt and generate exactly one result.",
    "4. The active V2 output contract is authoritative:",
    `- agentLine must be 1-${THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes} UTF-8 bytes.`,
    "- Preserve the exact returned bytes; normalization is none.",
    "- Display units are renderer measurements only, not an acceptance limit.",
    "- Do not use the old 162-display-unit limit or rely on clipping/repair.",
    `5. Send one JSON line to the same shell session: ${resultExample}`,
    "6. Wait for THOUGHT_RESULT_OK and an exact Receipt line. Any other terminal output is failure.",
    "",
    "Final chat response:",
    "Only after THOUGHT_RESULT_OK, show exactly:",
    "Return to the THOUGHT browser tab. It is polling this run and will show the preview automatically.",
    "Receipt: <exact receipt printed by the client>",
    "Do not show the candidate JSON.",
  ].join("\n");
}

export function buildThoughtCodexClientScript(options?: { release?: ThoughtCodexReleaseBinding }) {
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
  const release = options?.release;
  const releaseConstantLines = release
    ? [
        `readonly THOUGHT_PROTOCOL_RELEASE_ID=${shellQuote(release.protocolReleaseId)}`,
        `readonly THOUGHT_MANIFEST_KECCAK256=${shellQuote(release.manifestKeccak256)}`,
      ]
    : [];
  const claimReleaseLines = release
    ? [
        'THOUGHT_CLAIM_RELEASE_ID="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.outputContract.release.protocolReleaseId)" || thought_fail "Claim protocol release ID missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
        'THOUGHT_CLAIM_MANIFEST_HASH="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.outputContract.release.manifestKeccak256)" || thought_fail "Claim manifest hash missing" "AGENT_OUTPUT_SCHEMA_INVALID"',
        '[[ "$THOUGHT_CLAIM_RELEASE_ID" == "$THOUGHT_PROTOCOL_RELEASE_ID" ]] || thought_fail "Claim protocol release ID mismatch" "AGENT_OUTPUT_SCHEMA_INVALID"',
        '[[ "$THOUGHT_CLAIM_MANIFEST_HASH" == "$THOUGHT_MANIFEST_KECCAK256" ]] || thought_fail "Claim manifest hash mismatch" "AGENT_OUTPUT_SCHEMA_INVALID"',
      ]
    : [];
  const parseAgentLine = release
    ? 'THOUGHT_AGENT_LINE="$(printf %s "$THOUGHT_RAW_OUTPUT" | jq -er --arg schema "$THOUGHT_RESULT_SCHEMA" --arg release "$THOUGHT_PROTOCOL_RELEASE_ID" --arg manifest "$THOUGHT_MANIFEST_KECCAK256" \'if type == "object" and .schema == $schema and (.agentLine | type) == "string" and (((keys_unsorted | sort) == ["agentLine","release","schema"]) or ((keys_unsorted | sort) == ["agentLine","declaration","release","schema"])) and (.release | type) == "object" and ((.release | keys_unsorted | sort) == ["manifestKeccak256","protocolReleaseId"]) and .release.protocolReleaseId == $release and .release.manifestKeccak256 == $manifest and ((has("declaration") | not) or ((.declaration | type) == "object" and ((.declaration | keys_unsorted | sort) == ["agentLabel","declaredOneCreativeResult","schema","status"]) and .declaration.schema == "inshell.thought.agent-declaration.v1" and .declaration.status == "declared-unverified" and (.declaration.agentLabel | type) == "string" and (.declaration.agentLabel | length) >= 1 and (.declaration.agentLabel | length) <= 100 and .declaration.declaredOneCreativeResult == true)) then .agentLine else error("candidate schema invalid") end\')" || thought_fail "candidate JSON invalid" "AGENT_OUTPUT_UNPARSEABLE"'
    : 'THOUGHT_AGENT_LINE="$(printf %s "$THOUGHT_RAW_OUTPUT" | jq -er --arg schema "$THOUGHT_RESULT_SCHEMA" \'if type == "object" and .schema == $schema and (.agentLine | type) == "string" and ((keys_unsorted - ["schema", "agentLine"]) | length) == 0 then .agentLine else error("candidate schema invalid") end\')" || thought_fail "candidate JSON invalid" "AGENT_OUTPUT_UNPARSEABLE"';

  return [
    "#!/bin/zsh",
    "set -eu",
    "",
    ': "${THOUGHT_RUN_URL:?THOUGHT_RUN_URL is required}"',
    ': "${THOUGHT_LAUNCH_TOKEN:?THOUGHT_LAUNCH_TOKEN is required}"',
    `readonly THOUGHT_PROTOCOL=${shellQuote(THOUGHT_AGENT_PROTOCOL_VERSION)}`,
    `readonly THOUGHT_RESULT_SCHEMA=${shellQuote(THOUGHT_AGENT_RESULT_VERSION)}`,
    `readonly THOUGHT_WORK_PROFILE=${shellQuote(THOUGHT_AGENT_LINE_CONTRACT.workProfile)}`,
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
    '    curl --silent --show-error --connect-timeout 8 --max-time 30 --request POST --header "content-type: application/json" --header "Authorization: Bearer $THOUGHT_BRIDGE_TOKEN" --data-binary "$failure_body" "$THOUGHT_FAIL_URL" >/dev/null 2>&1 || true',
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
    '  request_args=(--silent --show-error --connect-timeout 8 --max-time 30 --request "$request_method" --header "content-type: application/json" --write-out $\'\\n%{http_code}\')',
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
    'print -r -- "Display units are not acceptance limits."',
    'print -r -- "THOUGHT_VERIFIED_OUTPUT_CONTRACT_END"',
    'print -r -- "THOUGHT_INPUT_READY"',
    "",
    'IFS= read -r THOUGHT_RAW_OUTPUT || thought_fail "candidate input missing" "AGENT_OUTPUT_MISSING"',
    parseAgentLine,
    'THOUGHT_AGENT_LINE_BYTES="$(LC_ALL=C printf %s "$THOUGHT_AGENT_LINE" | wc -c | tr -d "[:space:]")"',
    '[[ "$THOUGHT_AGENT_LINE_BYTES" -ge "$THOUGHT_CLAIM_MIN_BYTES" ]] || thought_fail "agent line is ${THOUGHT_AGENT_LINE_BYTES}/${THOUGHT_CLAIM_MAX_BYTES} UTF-8 bytes" "AGENT_OUTPUT_SCHEMA_INVALID"',
    '[[ "$THOUGHT_AGENT_LINE_BYTES" -le "$THOUGHT_CLAIM_MAX_BYTES" ]] || thought_fail "agent line is ${THOUGHT_AGENT_LINE_BYTES}/${THOUGHT_CLAIM_MAX_BYTES} UTF-8 bytes" "AGENT_OUTPUT_SCHEMA_INVALID"',
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
