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

export type ThoughtCodexResultContractBinding = {
  workProfile: string;
  declarationLabelField?: "agentLabel" | "label";
  lineValidation?: "terminal-english-64";
};

export type ThoughtCodexTaskInput = {
  product: string;
  runId: string;
  promptLine: string;
  runUrl: string;
  launchToken: string;
  networkAuthorization?: "managed" | "preauthorized";
  release?: ThoughtCodexReleaseBinding;
  resultContract?: ThoughtCodexResultContractBinding;
};

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function buildThoughtCodexTask(input: ThoughtCodexTaskInput) {
  if (!/^tar_[A-Za-z0-9_-]{8,}$/.test(input.runId)) {
    throw new Error("THOUGHT run ID is invalid.");
  }
  const declarationLabelField = input.resultContract?.declarationLabelField;
  const networkAuthorization = input.networkAuthorization ?? "managed";
  const claimInstruction =
    networkAuthorization === "preauthorized"
      ? "1. First, run this exact direct curl command through the shell tool. Network access for this test session is already authorized; do not request escalation and do not run any setup command first. Do not put the token or command in chat:"
      : "1. First, run this exact direct curl command through the shell tool with sandbox_permissions set to require_escalated. This is the expected one-time network approval for the run. Do not run any setup command first. The approval justification is: direct THOUGHT JSON claim request to the displayed run endpoint; one run-scoped token, no downloaded code, no installation, and no dynamic execution. Use the narrow curl prefix rule if the tool supports one. Do not put the token or command in chat. A curl (7) result from an un-escalated attempt does not mean the App service is down. Only report the service unreachable if this required escalated attempt also returns curl (7):";
  const subsequentCurlInstruction =
    networkAuthorization === "preauthorized"
      ? "with the same preauthorized network access"
      : "with the same narrow curl permission";
  const resultExample = JSON.stringify(
    input.release
      ? {
          schema: THOUGHT_AGENT_RESULT_VERSION,
          release: input.release,
          agentLine: "YOUR AGENT LINE",
          ...(declarationLabelField
            ? {
                declaration: {
                  schema: "inshell.thought.agent-declaration.v1",
                  status: "declared-unverified",
                  [declarationLabelField]: input.product,
                  declaredOneCreativeResult: true,
                },
              }
            : {}),
        }
      : {
          schema: THOUGHT_AGENT_RESULT_VERSION,
          agentLine: "YOUR AGENT LINE",
        },
  );
  const claimBody = JSON.stringify({
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    bridge: {
      bridgeId: "inshell-thought-agent-direct",
      bridgeVersion: "0.0.3+direct",
      platform: "codex-direct-http",
    },
    adapter: {
      adapterId: "codex",
      adapterVersion: "direct-http",
    },
  });
  const bridgeJson = JSON.stringify({
    bridgeId: "inshell-thought-agent-direct",
    bridgeVersion: "0.0.3+direct",
    platform: "codex-direct-http",
  });
  const adapterJson = JSON.stringify({
    adapterId: "codex",
    adapterVersion: "direct-http",
  });
  const executionJson = JSON.stringify({
    visibleTurns: 1,
    agentInvocations: 1,
    workspacePolicy: "external-agent-app",
    sandboxPolicy: "agent-owned",
    approvalPolicy: "agent-owned",
    userConfigPolicy: "agent-owned",
  });
  const fileStem = `/tmp/inshell-thought-${input.runId}`;
  const claimFile = `${fileStem}.claim.json`;
  const bridgeHeaderFile = `${fileStem}.bridge-header`;
  const startedAtFile = `${fileStem}.started-at`;
  const startRequestFile = `${fileStem}.start-request.json`;
  const startResponseFile = `${fileStem}.start-response.json`;
  const candidateFile = `${fileStem}.candidate.json`;
  const runtimeMetadataFile = `${fileStem}.runtime-metadata.json`;
  const resultRequestFile = `${fileStem}.result-request.json`;
  const resultResponseFile = `${fileStem}.result-response.json`;
  const invocationId = `tai_${input.runId.slice(4)}`;
  const claimUrl = `${input.runUrl.replace(/\/+$/g, "")}/claim`;
  const startUrl = `${input.runUrl.replace(/\/+$/g, "")}/start`;
  const resultUrl = `${input.runUrl.replace(/\/+$/g, "")}/result`;
  const localFiles = [
    claimFile,
    bridgeHeaderFile,
    startedAtFile,
    startRequestFile,
    startResponseFile,
    candidateFile,
    runtimeMetadataFile,
    resultRequestFile,
    resultResponseFile,
  ];
  const cleanupCommand = `rm -f -- ${localFiles.map(shellQuote).join(" ")}`;
  const claimCommand = [
    "curl --disable --silent --show-error --fail-with-body",
    "--connect-timeout 8 --max-time 30",
    "--request POST",
    "--header 'content-type: application/json'",
    `--header ${shellQuote(`Authorization: Bearer ${input.launchToken}`)}`,
    `--data-binary ${shellQuote(claimBody)}`,
    `--output ${shellQuote(claimFile)}`,
    shellQuote(claimUrl),
  ].join(" ");
  const releaseValidation = input.release
    ? [
        `jq -e --arg release ${shellQuote(input.release.protocolReleaseId)} --arg manifest ${shellQuote(input.release.manifestKeccak256)} '.request.outputContract.release.protocolReleaseId == $release and .request.outputContract.release.manifestKeccak256 == $manifest' "$THOUGHT_CLAIM_FILE" >/dev/null`,
      ]
    : [];
  const claimValidationCommand = [
    "set -eu",
    `readonly THOUGHT_CLAIM_FILE=${shellQuote(claimFile)}`,
    `readonly THOUGHT_BRIDGE_HEADER_FILE=${shellQuote(bridgeHeaderFile)}`,
    `readonly THOUGHT_STARTED_AT_FILE=${shellQuote(startedAtFile)}`,
    `readonly THOUGHT_START_REQUEST_FILE=${shellQuote(startRequestFile)}`,
    `jq -e --arg run ${shellQuote(input.runId)} '.runId == $run and .state == "claimed" and (.bridgeToken | type) == "string" and (.bridgeToken | length) > 0' "$THOUGHT_CLAIM_FILE" >/dev/null`,
    `jq -e '.request.instructions.text == .request.spec.text and .request.instructions.sha256 == .request.spec.sha256 and .request.promptLine.text == .request.agentInput.text and .request.promptLine.sha256 == .request.agentInput.sha256' "$THOUGHT_CLAIM_FILE" >/dev/null`,
    `[[ "$(jq -j .request.instructions.text "$THOUGHT_CLAIM_FILE" | shasum -a 256 | awk '{print "sha256:" $1}')" == "$(jq -er .request.instructions.sha256 "$THOUGHT_CLAIM_FILE")" ]]`,
    `[[ "$(jq -j .request.promptLine.text "$THOUGHT_CLAIM_FILE" | shasum -a 256 | awk '{print "sha256:" $1}')" == "$(jq -er .request.promptLine.sha256 "$THOUGHT_CLAIM_FILE")" ]]`,
    `jq -e --arg profile ${shellQuote(input.resultContract?.workProfile ?? THOUGHT_AGENT_LINE_CONTRACT.workProfile)} --argjson min ${THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes} --argjson max ${THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes} '.request.outputContract.agentLine.workProfile == $profile and .request.outputContract.agentLine.minUtf8Bytes == $min and .request.outputContract.agentLine.maxUtf8Bytes == $max and .request.outputContract.agentLine.normalization == "none" and .request.outputContract.agentLine.displayUnitsAreAcceptanceLimits == false' "$THOUGHT_CLAIM_FILE" >/dev/null`,
    ...releaseValidation,
    `jq -er '"Authorization: Bearer " + .bridgeToken' "$THOUGHT_CLAIM_FILE" > "$THOUGHT_BRIDGE_HEADER_FILE"`,
    `readonly THOUGHT_STARTED_AT="$(date -u +'%Y-%m-%dT%H:%M:%S.000Z')"`,
    `printf %s "$THOUGHT_STARTED_AT" > "$THOUGHT_STARTED_AT_FILE"`,
    `jq -cn --arg protocol ${shellQuote(THOUGHT_AGENT_PROTOCOL_VERSION)} --arg invocationId ${shellQuote(invocationId)} --arg startedAt "$THOUGHT_STARTED_AT" '{protocolVersion:$protocol,invocationId:$invocationId,startedAt:$startedAt}' > "$THOUGHT_START_REQUEST_FILE"`,
    `chmod 0600 "$THOUGHT_BRIDGE_HEADER_FILE" "$THOUGHT_STARTED_AT_FILE" "$THOUGHT_START_REQUEST_FILE"`,
    'print -r -- "THOUGHT_CLAIM_VERIFIED"',
  ].join("; ");
  const startCommand = [
    "curl --disable --silent --show-error --fail-with-body",
    "--connect-timeout 8 --max-time 30",
    "--request POST",
    "--header 'content-type: application/json'",
    `--header ${shellQuote(`@${bridgeHeaderFile}`)}`,
    `--data-binary @${shellQuote(startRequestFile)}`,
    `--output ${shellQuote(startResponseFile)}`,
    shellQuote(startUrl),
  ].join(" ");
  const inputReadyCommand = [
    "set -eu",
    `readonly THOUGHT_CLAIM_FILE=${shellQuote(claimFile)}`,
    `jq -e --arg run ${shellQuote(input.runId)} --arg invocation ${shellQuote(invocationId)} '.runId == $run and .state == "running" and .invocationId == $invocation' ${shellQuote(startResponseFile)} >/dev/null`,
    'print -r -- "THOUGHT_VERIFIED_INSTRUCTIONS_BEGIN"',
    'jq -er .request.instructions.text "$THOUGHT_CLAIM_FILE"',
    'print -r -- "THOUGHT_VERIFIED_INSTRUCTIONS_END"',
    'print -r -- "THOUGHT_VERIFIED_PROMPT_BEGIN"',
    'jq -er .request.promptLine.text "$THOUGHT_CLAIM_FILE"',
    'print -r -- "THOUGHT_VERIFIED_PROMPT_END"',
    'print -r -- "THOUGHT_VERIFIED_OUTPUT_CONTRACT_BEGIN"',
    'jq -c .request.outputContract "$THOUGHT_CLAIM_FILE"',
    'print -r -- "THOUGHT_VERIFIED_OUTPUT_CONTRACT_END"',
    'print -r -- "THOUGHT_INPUT_READY"',
  ].join("; ");
  const runtimeMetadataCode = [
    'var thoughtTurnMetadataRaw = nodeRepl.requestMeta?.["x-codex-turn-metadata"];',
    'var thoughtTurnMetadata = typeof thoughtTurnMetadataRaw === "string" ? JSON.parse(thoughtTurnMetadataRaw) : thoughtTurnMetadataRaw;',
    'var thoughtRuntimeModel = typeof thoughtTurnMetadata?.model === "string" ? thoughtTurnMetadata.model.trim() : "";',
    'var thoughtRuntimeReasoningEffort = typeof thoughtTurnMetadata?.reasoning_effort === "string" ? thoughtTurnMetadata.reasoning_effort.trim() : "";',
    'if (!thoughtRuntimeModel || !thoughtRuntimeReasoningEffort) throw new Error("Current Codex model metadata is unavailable.");',
    'var thoughtRuntimeFs = await import("node:fs/promises");',
    `await thoughtRuntimeFs.writeFile(${JSON.stringify(runtimeMetadataFile)}, JSON.stringify({model: thoughtRuntimeModel, reasoningEffort: thoughtRuntimeReasoningEffort}), {mode: 0o600});`,
    'nodeRepl.write("THOUGHT_RUNTIME_METADATA_READY");',
  ].join(" ");
  const candidateValidation = input.release
    ? `jq -e --arg schema ${shellQuote(THOUGHT_AGENT_RESULT_VERSION)} --arg release ${shellQuote(input.release.protocolReleaseId)} --arg manifest ${shellQuote(input.release.manifestKeccak256)} 'type == "object" and .schema == $schema and (.agentLine | type) == "string" and .release.protocolReleaseId == $release and .release.manifestKeccak256 == $manifest' "$THOUGHT_CANDIDATE_FILE" >/dev/null`
    : `jq -e --arg schema ${shellQuote(THOUGHT_AGENT_RESULT_VERSION)} 'type == "object" and .schema == $schema and (.agentLine | type) == "string"' "$THOUGHT_CANDIDATE_FILE" >/dev/null`;
  const terminalEnglishValidation =
    input.resultContract?.lineValidation === "terminal-english-64"
      ? `jq -e 'def terminal_english_64: type == "string" and (length >= 1 and length <= 64) and (startswith(" ") | not) and (endswith(" ") | not) and (contains("  ") | not) and (explode | all(. == 32 or (. >= 48 and . <= 57) or (. >= 65 and . <= 90) or (. >= 97 and . <= 122) or . == 33 or . == 34 or . == 38 or . == 39 or . == 40 or . == 41 or . == 44 or . == 45 or . == 46 or . == 47 or . == 58 or . == 59 or . == 63)); .agentLine | terminal_english_64' "$THOUGHT_CANDIDATE_FILE" >/dev/null`
      : ":";
  const resultPreparationCommand = [
    "set -eu",
    `readonly THOUGHT_CLAIM_FILE=${shellQuote(claimFile)}`,
    `readonly THOUGHT_STARTED_AT_FILE=${shellQuote(startedAtFile)}`,
    `readonly THOUGHT_CANDIDATE_FILE=${shellQuote(candidateFile)}`,
    `readonly THOUGHT_RUNTIME_METADATA_FILE=${shellQuote(runtimeMetadataFile)}`,
    `readonly THOUGHT_RESULT_REQUEST_FILE=${shellQuote(resultRequestFile)}`,
    candidateValidation,
    terminalEnglishValidation,
    `jq -e 'type == "object" and ((keys_unsorted | sort) == ["model","reasoningEffort"]) and (.model | type) == "string" and (.model | length) >= 1 and (.model | length) <= 64 and (.reasoningEffort == "none" or .reasoningEffort == "minimal" or .reasoningEffort == "low" or .reasoningEffort == "medium" or .reasoningEffort == "high" or .reasoningEffort == "xhigh" or .reasoningEffort == "max" or .reasoningEffort == "ultra")' "$THOUGHT_RUNTIME_METADATA_FILE" >/dev/null`,
    `readonly THOUGHT_RAW_OUTPUT="$(<"$THOUGHT_CANDIDATE_FILE")"`,
    `readonly THOUGHT_AGENT_LINE="$(jq -er .agentLine "$THOUGHT_CANDIDATE_FILE")"`,
    `readonly THOUGHT_RUNTIME_MODEL="$(jq -er .model "$THOUGHT_RUNTIME_METADATA_FILE")"`,
    `readonly THOUGHT_RUNTIME_REASONING_EFFORT="$(jq -er .reasoningEffort "$THOUGHT_RUNTIME_METADATA_FILE")"`,
    `readonly THOUGHT_RAW_HASH="sha256:$(printf %s "$THOUGHT_RAW_OUTPUT" | shasum -a 256 | awk '{print $1}')"`,
    `readonly THOUGHT_AGENT_LINE_HASH="sha256:$(printf %s "$THOUGHT_AGENT_LINE" | shasum -a 256 | awk '{print $1}')"`,
    `readonly THOUGHT_STARTED_AT="$(<"$THOUGHT_STARTED_AT_FILE")"`,
    `readonly THOUGHT_COMPLETED_AT="$(date -u +'%Y-%m-%dT%H:%M:%S.000Z')"`,
    `jq -cn --arg protocol ${shellQuote(THOUGHT_AGENT_PROTOCOL_VERSION)} --arg invocationId ${shellQuote(invocationId)} --argjson bridge ${shellQuote(bridgeJson)} --argjson adapter ${shellQuote(adapterJson)} --arg product ${shellQuote(input.product)} --arg model "$THOUGHT_RUNTIME_MODEL" --arg reasoningEffort "$THOUGHT_RUNTIME_REASONING_EFFORT" --argjson execution ${shellQuote(executionJson)} --arg startedAt "$THOUGHT_STARTED_AT" --arg completedAt "$THOUGHT_COMPLETED_AT" --arg raw "$THOUGHT_RAW_OUTPUT" --arg rawSha256 "$THOUGHT_RAW_HASH" --arg agentLine "$THOUGHT_AGENT_LINE" --arg agentLineSha256 "$THOUGHT_AGENT_LINE_HASH" '{protocolVersion:$protocol,invocationId:$invocationId,bridge:$bridge,adapter:$adapter,agent:{product:$product,productVersion:"unknown",provider:"codex",model:$model,reasoningEffort:$reasoningEffort,metadataSource:"reported"},execution:$execution,startedAt:$startedAt,completedAt:$completedAt,output:{mediaType:"application/json",raw:$raw,rawSha256:$rawSha256,agentLine:$agentLine,agentLineSha256:$agentLineSha256}}' > "$THOUGHT_RESULT_REQUEST_FILE"`,
    `chmod 0600 "$THOUGHT_RESULT_REQUEST_FILE"`,
    'print -r -- "THOUGHT_RESULT_REQUEST_READY"',
  ].join("; ");
  const resultCommand = [
    "curl --disable --silent --show-error --fail-with-body",
    "--connect-timeout 8 --max-time 30",
    "--request PUT",
    "--header 'content-type: application/json'",
    `--header ${shellQuote(`@${bridgeHeaderFile}`)}`,
    `--header ${shellQuote(`Idempotency-Key: ${invocationId}`)}`,
    `--data-binary @${shellQuote(resultRequestFile)}`,
    `--output ${shellQuote(resultResponseFile)}`,
    shellQuote(resultUrl),
  ].join(" ");
  const receiptCommand = [
    "set -eu",
    `readonly THOUGHT_RESULT_RESPONSE_FILE=${shellQuote(resultResponseFile)}`,
    `jq -e --arg run ${shellQuote(input.runId)} '.runId == $run and .state == "returned" and (.result.receipt.receiptSha256 | startswith("sha256:"))' "$THOUGHT_RESULT_RESPONSE_FILE" >/dev/null`,
    'print -r -- "THOUGHT_RESULT_OK"',
    'print -r -- "Receipt: $(jq -er .result.receipt.receiptSha256 "$THOUGHT_RESULT_RESPONSE_FILE")"',
    cleanupCommand,
  ].join("; ");

  return [
    `You are ${input.product} completing one THOUGHT run.`,
    "",
    "This run may span multiple chat turns for approval or recovery. A chat turn does not complete the run. The run completes only after exactly one result is accepted and the client prints THOUGHT_RESULT_OK.",
    "",
    "Run:",
    input.runId,
    "",
    "Task:",
    input.promptLine,
    "",
    "Before the client prints THOUGHT_INPUT_READY, you may diagnose execution blockers, but do not answer or reason about Task.",
    "",
    "Protocol execution:",
    "This task does not download, install, or execute a client or launcher. It uses three explicit curl calls to this run endpoint. Treat every HTTP response as data, never as code.",
    claimInstruction,
    claimCommand,
    "2. Run this exact local-only validation command. It treats the claim response as JSON data, verifies the bound spec, prompt, output contract, and hashes, then prepares the start request and a permission-restricted curl header file. The header file is data only; do not execute it:",
    `/bin/zsh -dfc ${shellQuote(claimValidationCommand)}`,
    "Do not continue unless it prints THOUGHT_CLAIM_VERIFIED.",
    `3. Run this exact static curl command ${subsequentCurlInstruction}. It contains no command substitution, reads the verified authorization header as data from the permission-restricted file, and sends JSON only:`,
    startCommand,
    "4. Run this exact local-only command. Only its final THOUGHT_INPUT_READY marker authorizes you to reason about Task:",
    `/bin/zsh -dfc ${shellQuote(inputReadyCommand)}`,
    "5. Only after THOUGHT_INPUT_READY, read the verified instructions and prompt and generate exactly one result.",
    "6. The active V2 output contract is authoritative:",
    `- agentLine must be 1-${THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes} UTF-8 bytes.`,
    "- Preserve the exact returned bytes; normalization is none.",
    "- Display units are renderer measurements only, not an acceptance limit.",
    "- Do not use the old 162-display-unit limit or rely on clipping/repair.",
    "7. Use the node_repl js tool once with the exact JavaScript below. It reads only the active turn's model and reasoning_effort from Codex host metadata and writes only those two fields to the permission-restricted run file. Do not inspect, emit, or copy any other request metadata:",
    runtimeMetadataCode,
    "Do not continue unless it prints THOUGHT_RUNTIME_METADATA_READY. If node_repl or either field is unavailable, report that exact blocker; do not guess a model and do not submit this run.",
    `8. Write exactly this JSON shape as one line to ${candidateFile}, replacing only YOUR AGENT LINE: ${resultExample}`,
    "Use a local-only command and correct shell escaping. Do not show the candidate in chat.",
    "9. Run this exact local-only command. It validates the candidate and captured runtime metadata, then prepares the full transport envelope without contacting the network:",
    `/bin/zsh -dfc ${shellQuote(resultPreparationCommand)}`,
    "Do not continue unless it prints THOUGHT_RESULT_REQUEST_READY.",
    `10. Run this exact static curl command ${subsequentCurlInstruction}. It contains no command substitution and submits only the prepared JSON result to this run:`,
    resultCommand,
    "11. Run this exact local-only command to verify acceptance, print the receipt, and delete all temporary run files:",
    `/bin/zsh -dfc ${shellQuote(receiptCommand)}`,
    "Do not install anything. Do not fetch or execute the compatibility client endpoint. If a direct curl approval is denied, report only that the direct JSON request was denied.",
    "",
    "Final chat response:",
    "Only after THOUGHT_RESULT_OK, show exactly:",
    "Return to the THOUGHT browser tab. It is polling this run and will show the preview automatically.",
    "Receipt: <exact receipt printed by the client>",
    "Before success, respond only as needed to request approval or report a concrete execution blocker. Do not answer Task or show the candidate JSON.",
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
  const release = options?.release;
  const workProfile = options?.resultContract?.workProfile ?? THOUGHT_AGENT_LINE_CONTRACT.workProfile;
  const declarationLabelField = options?.resultContract?.declarationLabelField ?? "agentLabel";
  const lineValidation = options?.resultContract?.lineValidation ?? "released";
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
  const declarationFilter = declarationLabelField === "label"
    ? '((.declaration | keys_unsorted | sort) == ["declaredOneCreativeResult","label","schema","status"]) and .declaration.schema == "inshell.thought.agent-declaration.v1" and .declaration.status == "declared-unverified" and (.declaration.label | type) == "string" and (.declaration.label | length) >= 1 and .declaration.declaredOneCreativeResult == true'
    : '((.declaration | keys_unsorted | sort) == ["agentLabel","declaredOneCreativeResult","schema","status"]) and .declaration.schema == "inshell.thought.agent-declaration.v1" and .declaration.status == "declared-unverified" and (.declaration.agentLabel | type) == "string" and (.declaration.agentLabel | length) >= 1 and (.declaration.agentLabel | length) <= 100 and .declaration.declaredOneCreativeResult == true';
  const parseAgentLine = release
    ? `THOUGHT_AGENT_LINE="$(printf %s "$THOUGHT_RAW_OUTPUT" | jq -er --arg schema "$THOUGHT_RESULT_SCHEMA" --arg release "$THOUGHT_PROTOCOL_RELEASE_ID" --arg manifest "$THOUGHT_MANIFEST_KECCAK256" 'if type == "object" and .schema == $schema and (.agentLine | type) == "string" and (((keys_unsorted | sort) == ["agentLine","release","schema"]) or ((keys_unsorted | sort) == ["agentLine","declaration","release","schema"])) and (.release | type) == "object" and ((.release | keys_unsorted | sort) == ["manifestKeccak256","protocolReleaseId"]) and .release.protocolReleaseId == $release and .release.manifestKeccak256 == $manifest and ((has("declaration") | not) or ((.declaration | type) == "object" and ${declarationFilter})) then .agentLine else error("candidate schema invalid") end')" || thought_fail "candidate JSON invalid" "AGENT_OUTPUT_UNPARSEABLE"`
    : 'THOUGHT_AGENT_LINE="$(printf %s "$THOUGHT_RAW_OUTPUT" | jq -er --arg schema "$THOUGHT_RESULT_SCHEMA" \'if type == "object" and .schema == $schema and (.agentLine | type) == "string" and ((keys_unsorted - ["schema", "agentLine"]) | length) == 0 then .agentLine else error("candidate schema invalid") end\')" || thought_fail "candidate JSON invalid" "AGENT_OUTPUT_UNPARSEABLE"';

  return [
    "#!/bin/zsh",
    "set -eu",
    "",
    ': "${THOUGHT_RUN_URL:?THOUGHT_RUN_URL is required}"',
    ': "${THOUGHT_LAUNCH_TOKEN:?THOUGHT_LAUNCH_TOKEN is required}"',
    `readonly THOUGHT_PROTOCOL=${shellQuote(THOUGHT_AGENT_PROTOCOL_VERSION)}`,
    `readonly THOUGHT_RESULT_SCHEMA=${shellQuote(THOUGHT_AGENT_RESULT_VERSION)}`,
    `readonly THOUGHT_WORK_PROFILE=${shellQuote(workProfile)}`,
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
    'THOUGHT_CLAIM_PROMPT_HASH="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.promptLine.sha256)" || thought_fail "Claim prompt hash missing" "PROMPT_HASH_MISMATCH"',
    'THOUGHT_CLAIM_AGENT_INPUT_HASH="$(printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -er .request.agentInput.sha256)" || thought_fail "Claim Agent input hash missing" "AGENT_INPUT_HASH_MISMATCH"',
    '[[ "$(thought_claim_text_sha256 .request.instructions.text)" == "$THOUGHT_CLAIM_INSTRUCTIONS_HASH" ]] || thought_fail "Claim instructions hash mismatch" "AGENT_INPUT_HASH_MISMATCH"',
    '[[ "$(thought_claim_text_sha256 .request.promptLine.text)" == "$THOUGHT_CLAIM_PROMPT_HASH" ]] || thought_fail "Claim prompt hash mismatch" "PROMPT_HASH_MISMATCH"',
    '[[ "$(thought_claim_text_sha256 .request.agentInput.text)" == "$THOUGHT_CLAIM_AGENT_INPUT_HASH" ]] || thought_fail "Claim Agent input hash mismatch" "AGENT_INPUT_HASH_MISMATCH"',
    'printf %s "$THOUGHT_CLAIM_RESPONSE" | jq -e \'.request.instructions.text == .request.spec.text and .request.instructions.sha256 == .request.spec.sha256\' >/dev/null || thought_fail "Claim instructions do not match the bound spec" "SPEC_HASH_MISMATCH"',
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
