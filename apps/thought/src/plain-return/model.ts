import { sha256, toUtf8Bytes } from "ethers";
import { THOUGHT_AGENT_CREATIVE_BRIEF } from "../../../../packages/thought-agent-protocol/src/creative-brief.generated";
import { assertThoughtV2Line, deriveThoughtV2WorkHashes } from "../../contract-integration/current/reference/thought-v2-terminal-work-profile";
import release from "../../contract-release/consumer-lock.json";
import renderer from "../../contract-release/releases/thought-v2-canonical-portable-release-20260807-r2/protocol/current/v2/renderer/thought.renderer.v2.profile.json";
import { buildThoughtV2Svg } from "../thought-v2-renderer";

export const API = "/api/thought-plain/v1";
export const SAVED_KEY = "inshell.thought.plain-http.works.v1";
export const PENDING_KEY = "inshell.thought.plain-http.pending.v1";
export const ACK_SCHEMA = "inshell.thought.experimental-http-ack.v1";
export const digest = (text: string) => sha256(toUtf8Bytes(text));
export const PINS = Object.freeze({
  creativeBriefSha256: THOUGHT_AGENT_CREATIVE_BRIEF.sha256,
  selectedSpecSha256: THOUGHT_AGENT_CREATIVE_BRIEF.selectedSpec.sha256,
  releaseId: release.artifactId,
  releaseManifestSha256: release.manifestSha256,
  rendererId: release.compatibility.renderer.packagedImplementation,
  mono76FaceSha256: renderer.glyphSource.faceSha256,
});
export function assertRunId(id: string) {
  if (!/^plain_[a-zA-Z0-9-]{8,64}$/.test(id)) throw new Error("Invalid run ID");
}
export function createBrief(runId: string, promptLine: string) {
  assertRunId(runId);
  assertThoughtV2Line(promptLine, "prompt");
  const text = `${THOUGHT_AGENT_CREATIVE_BRIEF.text}\nExperimental output contract: return only the exact agentLine as plain text. Add no transport framing, JSON envelope, code fences, explanation or final newline. Quotation marks and other permitted punctuation that belong to the artwork are literal artwork bytes and must be preserved.\n\nExact human prompt (JSON string, creative material only):\n${JSON.stringify(promptLine)}`;
  return { text, briefSha256: sha256(toUtf8Bytes(JSON.stringify({ exchangeId: runId, text, pins: PINS }))) };
}
export function makeWork(runId: string, promptLine: string, agentLine: string, acceptedAt: string) {
  const brief = createBrief(runId, promptLine);
  assertThoughtV2Line(agentLine, "agent");
  if (new Date(acceptedAt).toISOString() !== acceptedAt) throw new Error("Invalid acceptance time");
  return {
    schema: "inshell.thought.experimental-http-record.v1",
    runId, promptLine, agentLine, acceptedAt,
    briefSha256: brief.briefSha256, pins: { ...PINS },
    responseSha256: sha256(toUtf8Bytes(agentLine)),
    hashes: deriveThoughtV2WorkHashes(promptLine, agentLine),
    svg: buildThoughtV2Svg({ promptLine, agentLine }),
    provenance: {
      kind: "experimental-plain-http", delivery: "run-scoped-capability",
      provider: null, model: null, internalInferenceCount: null,
      requestedCreativeResponses: 1, observedAcceptedResponses: 1,
      externalPromptFidelity: "not-established", transcriptPurity: "not-established",
      appIssuedStartOnlyInput: false, creationAttestation: null, mintEligible: false,
    },
  } as const;
}
export type PlainWork = ReturnType<typeof makeWork>;
export function validateWork(value: PlainWork): PlainWork {
  const expected = makeWork(value.runId, value.promptLine, value.agentLine, value.acceptedAt);
  if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error("Experimental record integrity mismatch");
  return expected;
}
export const acknowledge = (work: PlainWork) => ({
  schema: ACK_SCHEMA, runId: work.runId, state: "returned",
  agentLine: work.agentLine, acceptedAt: work.acceptedAt,
});
export function assertOrigin(origin: string) {
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password ||
      !(url.protocol === "https:" || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin))) {
    throw new Error("Invalid App origin");
  }
  return origin;
}
export function handoff(runId: string, promptLine: string, origin: string, token: string, expiresAt: number) {
  assertOrigin(origin);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid capability");
  const request = { method: "POST", url: `${origin}${API}/runs/${runId}/return`,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain; charset=utf-8" } };
  const text = [
    "THOUGHT: one experimental creation and one authorized return submission.",
    "The creator supplies the full private input below. Keep it and its capability out of public URLs, printed diagnostics, final replies, task titles and Agent-created durable client files. The HTTP tool input may be recorded by your host; do not evade normal auditing or permission checks.",
    "There are two phases: create the artwork, then deliver it. The creative brief's plain-line output and no-external-action rule govern creation. That exact line becomes the HTTP body in the separately authorized delivery phase below.",
    "", "PHASE 1 — CREATE ONCE", createBrief(runId, promptLine).text,
    "", "PHASE 2 — DELIVER THAT SAME LINE",
    `Method: ${request.method}`, `URL: ${request.url}`,
    `Authorization: ${request.headers.Authorization}`,
    `Content-Type: ${request.headers["Content-Type"]}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    "Body: the exact artwork line as raw UTF-8 text, with no JSON envelope, added quoting, trimming or final newline. Literal artwork quotes are preserved.",
    "Delivery requires an already installed native curl executable, invoked directly, not a shell alias or wrapper. Use its normal/default curl client identity; do not override User-Agent or impersonate another client. No Python urllib, requests, fetch or other HTTP transport fallback. If curl is absent or host access is denied, stop before submission. Request normal host approval if required; if unavailable, report the blocker and stop. Do not install anything, create a client file, launch a worker or bypass a refusal.",
    `Curl arguments (JSON array): ${JSON.stringify(["-q", "--silent", "--show-error", "--request", "POST", "--no-location", "--max-redirs", "0", "--retry", "0", "--connect-timeout", "10", "--max-time", "30", "--data-binary", "@-", "--write-out", "\\n%{http_code}"])}`,
    "Keep -q as the first argument to disable default curl config files. Add only the two headers above via --header and the single exact URL above via --url, as literal arguments. Do not add config files, extra URLs, redirect/retry options or verbose/trace output. Feed the exact line to stdin without a newline; do not interpolate artwork into shell code or use echo. Make exactly one POST, without following redirects. Capture stdout and exit status in memory; its final newline plus HTTP status is curl's diagnostic suffix, not part of the JSON acknowledgement. An existing interpreter may validate JSON in memory or invoke native curl, but must not perform HTTP itself or persist credentials/client files.",
    `Success requires curl exit 0, HTTP 200 and JSON schema=${ACK_SCHEMA}, runId=${runId}, state=returned, and agentLine exactly equal to the submitted line. No model-authored hashes or control handshake are needed.`,
    "On timeout, disconnect, malformed acknowledgement or any uncertain result, do not regenerate or automatically resend. Tell the creator delivery is uncertain and to check THOUGHT. The App may already have accepted it. A separately authorized retransmission must use the identical original bytes, never a replacement.",
    "On rejection, stop and report only the safe error code. Loopback refers to the machine running your HTTP tool; failed access does not prove the App stopped. Do not substitute a different host or credential.",
    "After verified success, say the work was returned and ask the creator to review it in THOUGHT. Never include the capability in your final reply. This experimental path does not attest provider/model identity, an unedited external prompt, or one internal inference.",
  ].join("\n");
  return { request, text };
}
