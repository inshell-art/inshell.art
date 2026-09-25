import { THOUGHT_V2_PROTOCOL_RELEASE } from "./release.generated";
import { THOUGHT_AGENT_RUN_AUTHORITY } from "./run-authority";
import { removeTrailingSlashes } from "./run-url";

export type ThoughtCodexTransportWorkerInput = {
  product: string;
  runId: string;
  runUrl: string;
  protocolVersion: string;
  controlVersion: string;
  resultVersion: string;
  workProfile: string;
  declarationLabelField: "agentLabel" | "label";
  release: {
    protocolReleaseId: `0x${string}`;
    manifestKeccak256: `0x${string}`;
  };
};

export type ThoughtCodexBootstrapBinding = {
  url: string;
  workerSha256: `sha256:${string}`;
  configSha256: `sha256:${string}`;
};

export type ThoughtCodexTransportWorkerConfig = {
  i: string;
  u: string;
  p: string;
  v: [string, string, string];
  w: string;
  l: "agentLabel" | "label";
  r: [`0x${string}`, `0x${string}`];
};

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export const buildThoughtCodexTransportWorkerConfig = (
  input: ThoughtCodexTransportWorkerInput,
): ThoughtCodexTransportWorkerConfig => ({
  i: input.runId,
  u: removeTrailingSlashes(input.runUrl),
  p: input.product,
  v: [input.protocolVersion, input.controlVersion, input.resultVersion],
  w: input.workProfile,
  l: input.declarationLabelField,
  r: [input.release.protocolReleaseId, input.release.manifestKeccak256],
});

export const buildThoughtCodexTransportWorkerConfigText = (
  input: ThoughtCodexTransportWorkerInput,
) => JSON.stringify(buildThoughtCodexTransportWorkerConfig(input));

/**
 * Exact source executed by the Codex handoff. The maintained form stays
 * readable here. Delivery retrieves the source and run-bound configuration
 * from the same origin, verifies both integrity references, executes the
 * verified bytes in memory, and writes neither payload to disk.
 */
const readableWorkerSource = String.raw`
const { spawnSync } = require("node:child_process"), { createHash, randomBytes } = require("node:crypto");
const c = JSON.parse(process.argv[1]);
const V = c.v[0], C = c.v[1], R = c.v[2], L = { protocolReleaseId: c.r[0], manifestKeccak256: c.r[1] };
const A = ${JSON.stringify(THOUGHT_AGENT_RUN_AUTHORITY)};
const B = { bridgeId: "inshell-thought-agent-direct", bridgeVersion: "0.0.4+fixed-worker", platform: "codex-direct-http" };
const D = { adapterId: "codex", adapterVersion: "fixed-worker-v1" };
const X = { visibleTurns: 1, agentInvocations: 1, workspacePolicy: "external-agent-app", sandboxPolicy: "agent-owned", approvalPolicy: "bounded-control-complete", userConfigPolicy: "agent-owned" };
const CS = "inshell.thought.agent-connectivity.v1", SS = "sha256:${THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256}", BI = ${JSON.stringify(THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.id)}, BA = ${JSON.stringify(THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.artifactId)}, BS = "sha256:${THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.sha256}", U = "Inshell-THOUGHT-Agent/2";
const say = value => process.stdout.write(value + "\n");
const hash = value => "sha256:" + createHash("sha256").update(value).digest("hex");
const knownNoCommit = new Set(["PROTOCOL_UNSUPPORTED", "TOKEN_INVALID", "RUN_EXPIRED", "RUN_ALREADY_CLAIMED"]);
const efforts = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);
const allowed = /^[ A-Za-z0-9.,?!:;'"()\/&-]+$/;
let done = false, stage = "preflight", bridge = "", invocation = "", startedAt = "", bootstrap, inputEnded = false, inputWake, inputLocked = false, prematureInput = false, inputBuffer = Buffer.alloc(0);

process.stdin.on("data", chunk => {
  if (inputLocked) prematureInput = true;
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  inputWake?.();
  inputWake = undefined;
});
process.stdin.on("end", () => {
  inputEnded = true;
  inputWake?.();
  inputWake = undefined;
});

const deepExact = (left, right) => {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) || Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && deepExact(left[key], right[key]));
};
const exactKeys = (value, expected) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...expected].sort().join(",");
const stop = (operation, className, certainty, detail = "") => {
  if (done) return;
  done = true;
  say("stage=" + operation + ",class=" + className + (detail ? "," + detail : "") + " " + (certainty === "U" ? "THOUGHT_UNCERTAIN(U)" : "THOUGHT_STOP(" + certainty + ")"));
  process.exitCode = 2;
  process.stdin.pause();
};
const ok = operation => say("OK:" + operation);
const nextRawLine = async () => {
  while (true) {
    const newline = inputBuffer.indexOf(10);
    if (newline >= 0) {
      const raw = inputBuffer.subarray(0, newline);
      inputBuffer = inputBuffer.subarray(newline + 1);
      return { raw, terminated: true };
    }
    if (inputEnded) {
      const raw = inputBuffer;
      inputBuffer = Buffer.alloc(0);
      return { raw, terminated: false };
    }
    await new Promise(resolve => { inputWake = resolve; });
  }
};
const decodeRawLine = raw => {
  if (raw.includes(13)) return { error: "carriage-return" };
  const value = raw.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(raw)) return { error: "invalid-utf8" };
  return { value };
};
const take = async (operation, certainty) => {
  const item = await nextRawLine();
  if (!item.terminated) {
    stop(operation, "transport", certainty);
    return;
  }
  const decoded = decodeRawLine(item.raw);
  if (decoded.error) {
    stop(operation, "framing", certainty);
    return;
  }
  return decoded.value;
};

const request = async (operation, method, url, bearer, body, idempotencyKey, replayExact = false) => {
  stage = operation;
  const headers = { "content-type": "application/json", "user-agent": U };
  if (bearer) headers.authorization = "Bearer " + bearer;
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  const attempts = replayExact ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { method, headers, body, redirect: "manual" });
    } catch {
      if (attempt + 1 < attempts) continue;
      return stop(operation, "transport", operation === "preflight" ? "N" : "U");
    }
    let text;
    try {
      text = await response.text();
    } catch {
      if (attempt + 1 < attempts) continue;
      return stop(operation, "transport", operation === "preflight" ? "N" : "U");
    }
    if (!response.ok) {
      if (response.status >= 300 && response.status < 400) return stop(operation, "http", "U");
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        return stop(operation, "parse", "U");
      }
      const envelope = payload?.protocolVersion === V && typeof payload?.error?.code === "string";
      const noCommit = response.status >= 400 && response.status < 500 && envelope && knownNoCommit.has(payload.error.code);
      return stop(operation, "http", noCommit ? "R" : "U");
    }
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return stop(operation, "schema", operation === "preflight" ? "N" : "U");
      return parsed;
    } catch {
      return stop(operation, "parse", "U");
    }
  }
};

const lineError = value => {
  const bytes = Buffer.byteLength(value, "utf8");
  if (!bytes) return { code: "empty", bytes };
  if (bytes > 64) return { code: "too-long", bytes, limit: 64 };
  if (value.startsWith(" ") || value.endsWith(" ")) return { code: "outer-space", bytes };
  if (value.includes("  ")) return { code: "repeated-space", bytes };
  if (!allowed.test(value)) {
    const characters = Array.from(value), index = characters.findIndex(character => !allowed.test(character));
    return { code: "invalid-character", bytes, index, codepoint: "U+" + characters[index].codePointAt(0).toString(16).toUpperCase().padStart(4, "0") };
  }
};
const validHash = value => /^sha256:[0-9a-f]{64}$/.test(value);
const validRelease = value => exactKeys(value, ["manifestKeccak256", "protocolReleaseId"]) && value.protocolReleaseId === L.protocolReleaseId && value.manifestKeccak256 === L.manifestKeccak256;

const rejectCandidate = async error => {
  say("CANDIDATE_INVALID " + Object.entries(error).map(([key, value]) => key + "=" + value).join(","));
  const body = JSON.stringify({ protocolVersion: V, invocationId: invocation, error: { code: "AGENT_OUTPUT_SCHEMA_INVALID", message: "Agent line failed exact Terminal English validation." } });
  const failed = await request("fail", "POST", c.u + "/fail", bridge, body);
  if (!failed) return;
  if (failed.protocolVersion !== V || failed.runId !== c.i || failed.state !== "failed" || failed.error?.code !== "AGENT_OUTPUT_SCHEMA_INVALID") return stop("fail", "schema", "U");
  ok("fail");
  say("stage=candidate,class=validation THOUGHT_STOP(R)");
  done = true;
  process.exitCode = 2;
  process.stdin.pause();
};

const takeCandidate = async () => {
  const candidateFrame = await nextRawLine();
  if (!candidateFrame.terminated) return stop("candidate", "transport", "U");
  const candidate = decodeRawLine(candidateFrame.raw);
  if (candidate.error) return rejectCandidate({ code: "framing", reason: candidate.error, bytes: candidateFrame.raw.length });
  const endFrame = await nextRawLine();
  if (!endFrame.terminated) return stop("candidate", "transport", "U");
  const end = decodeRawLine(endFrame.raw);
  if (end.error || end.value !== "THOUGHT_END" || inputBuffer.length !== 0) return rejectCandidate({ code: "framing", bytes: candidateFrame.raw.length });
  return candidate.value;
};

const main = async () => {
  if (!process.stdin.isTTY || spawnSync("stty", ["-echo", "-echonl", "-icrnl", "-inlcr", "-igncr"], { stdio: ["inherit", "ignore", "ignore"] }).status !== 0) return stop("preflight", "permission", "N");
  say("ECHO_READY");
  const nonce = await take("preflight", "N");
  if (done) return;
  if (!/^NONCE:[A-Za-z0-9_-]{16,128}$/.test(nonce)) return stop("preflight", "schema", "N");
  say("ECHO_OK");

  const connectivityUrl = new URL("/api/thought-agent/v2/connectivity", c.u).toString();
  const connectivity = await request("preflight", "GET", connectivityUrl);
  if (!connectivity) return;
  if (connectivity.schema !== CS || connectivity.status !== "reachable" || connectivity.protocolVersion !== V) return stop("preflight", "schema", "N");
  ok("preflight");
  say("CREDENTIAL_READY");

  let bootstrapText = await take("claim", "N");
  if (done) return;
  try {
    bootstrap = JSON.parse(bootstrapText);
  } catch {
    return stop("claim", "schema", "N");
  } finally {
    bootstrapText = "";
  }
  const bootstrapKeys = Object.keys(bootstrap).sort().join(",");
  const hasEffort = Object.hasOwn(bootstrap, "reasoningEffort");
  const unknown = bootstrap.metadataSource === "unknown" && bootstrapKeys === "credential,echoProbe,metadataSource";
  const reported = bootstrap.metadataSource === "reported" && (bootstrapKeys === "credential,echoProbe,metadataSource,model" || bootstrapKeys === "credential,echoProbe,metadataSource,model,reasoningEffort") && typeof bootstrap.model === "string" && bootstrap.model === bootstrap.model.trim() && bootstrap.model.length > 0 && bootstrap.model.toLowerCase() !== "unknown" && (!hasEffort || (typeof bootstrap.reasoningEffort === "string" && efforts.has(bootstrap.reasoningEffort)));
  if (typeof bootstrap.credential !== "string" || !bootstrap.credential || bootstrap.echoProbe !== nonce || (!unknown && !reported)) return stop("claim", "schema", "N");
  if (inputBuffer.length !== 0) return stop("claim", "framing", "N");
  inputLocked = true;

  const claimBody = { protocolVersion: V, bridge: B, adapter: D };
  const launchCredential = bootstrap.credential;
  const claim = await request("claim", "POST", c.u + "/claim", launchCredential, JSON.stringify(claimBody));
  bootstrap.credential = "";
  if (!claim) return;
  const claimedRequest = claim.request;
  const forbiddenCreativeInput = ["spec", "instructions", "promptLine", "agentInput", "outputContract"].some(key => Object.hasOwn(claimedRequest || {}, key));
  if (claim.protocolVersion !== V || claim.runId !== c.i || claim.state !== "claimed" || typeof claim.bridgeToken !== "string" || !claim.bridgeToken || !claimedRequest || !deepExact(claimedRequest.authority, A) || claimedRequest.intent !== "prepare-thought-creation" || claimedRequest.requestedAgent?.adapterId !== "codex" || claimedRequest.controlPolicy?.mode !== "bounded-preflight" || claimedRequest.controlPolicy?.creativeInputState !== "sealed" || claimedRequest.evidenceContract?.schema !== C || forbiddenCreativeInput) return stop("claim", "schema", "U");
  bridge = claim.bridgeToken;
  ok("claim");

  const control = { schema: C, mode: "bounded-preflight", appExchange: "verified", agentProduct: "declared", runtimeModel: reported ? "reported" : "unknown", localPreparation: "verified", installationsRequired: false, creativeInputOpened: false };
  const readyBody = JSON.stringify({ protocolVersion: V, control });
  const ready = await request("ready", "POST", c.u + "/ready", bridge, readyBody, undefined, true);
  if (!ready) return;
  if (ready.protocolVersion !== V || ready.runId !== c.i || ready.state !== "ready" || ready.stage !== "control-verified" || Object.hasOwn(ready, "creatorAction") || !deepExact(ready.control, control)) return stop("ready", "schema", "U");
  ok("ready");

  invocation = "tai_" + randomBytes(18).toString("base64url");
  startedAt = new Date().toISOString();
  const startBody = JSON.stringify({ protocolVersion: V, invocationId: invocation, startedAt });
  const start = await request("start", "POST", c.u + "/start", bridge, startBody);
  if (!start) return;
  const creative = start.request, spec = creative?.spec, instructions = creative?.instructions, prompt = creative?.promptLine, agentInput = creative?.agentInput, outputContract = creative?.outputContract, agentLineContract = outputContract?.agentLine;
  if (start.protocolVersion !== V || start.runId !== c.i || start.state !== "running" || start.invocationId !== invocation || start.startedAt !== startedAt || !creative || !deepExact(creative.authority, A) || creative.intent !== "generate-thought-candidate" || spec?.id !== spec?.contractSpecId || !/^0x[0-9a-fA-F]{64}$/.test(spec?.contractSpecHash || "") || spec?.sha256 !== SS || hash(spec?.text || "") !== spec?.sha256 || instructions?.id !== BI || instructions?.artifactId !== BA || instructions?.sha256 !== BS || hash(instructions?.text || "") !== instructions?.sha256 || spec.text === instructions.text || spec.sha256 === instructions.sha256 || prompt?.text !== agentInput?.text || prompt?.sha256 !== agentInput?.sha256 || hash(prompt?.text || "") !== prompt?.sha256 || lineError(prompt.text) || outputContract?.resultSchema !== R || !validRelease(outputContract?.release) || agentLineContract?.workProfile !== c.w || agentLineContract?.minUtf8Bytes !== 1 || agentLineContract?.maxUtf8Bytes !== 64 || agentLineContract?.normalization !== "none" || agentLineContract?.displayUnitsAreAcceptanceLimits !== false) return stop("start", "schema", "U");
  if (prematureInput || inputBuffer.length !== 0) return rejectCandidate({ code: "premature", bytes: inputBuffer.length });
  ok("start");
  say("THOUGHT_VERIFIED_SPEC_BEGIN");
  say(spec.text);
  say("THOUGHT_VERIFIED_SPEC_END");
  say("THOUGHT_VERIFIED_INSTRUCTIONS_BEGIN");
  say(instructions.text);
  say("THOUGHT_VERIFIED_INSTRUCTIONS_END");
  say("THOUGHT_VERIFIED_PROMPT_BEGIN");
  say(prompt.text);
  say("THOUGHT_VERIFIED_PROMPT_END");
  say("THOUGHT_CANDIDATE_RULE exact one 1-64-byte Terminal English line followed by THOUGHT_END; no CR, extra line, JSON, trim, repair, or replacement");
  say("THOUGHT_INPUT_READY");
  inputLocked = false;

  const candidate = await takeCandidate();
  if (done) return;
  inputLocked = true;
  const candidateError = lineError(candidate);
  if (candidateError) return rejectCandidate(candidateError);
  const declaration = { schema: "inshell.thought.agent-declaration.v1", status: "declared-unverified", [c.l]: c.p, declaredOneCreativeResult: true };
  const outputObject = { schema: R, release: outputContract.release, agentLine: candidate, declaration };
  const raw = JSON.stringify(outputObject);
  const agent = { product: c.p, provider: "codex", metadataSource: bootstrap.metadataSource };
  if (reported) {
    agent.model = bootstrap.model;
    if (hasEffort) agent.reasoningEffort = bootstrap.reasoningEffort;
  }
  const completedAt = new Date().toISOString();
  const resultBody = JSON.stringify({ protocolVersion: V, invocationId: invocation, bridge: B, adapter: D, agent, execution: X, startedAt, completedAt, output: { mediaType: "application/json", raw, rawSha256: hash(raw), agentLine: candidate, agentLineSha256: hash(candidate) } });
  const result = await request("result", "PUT", c.u + "/result", bridge, resultBody, invocation, true);
  if (!result) return;
  const receipt = result.result?.receipt?.receiptSha256;
  if (result.protocolVersion !== V || result.runId !== c.i || result.state !== "returned" || result.result?.agentLine !== candidate || !validHash(receipt)) return stop("result", "schema", "U");
  ok("result");
  say("Receipt: " + receipt);
  done = true;
  process.stdin.pause();
};

main().catch(() => stop(stage, "schema", stage === "preflight" ? "N" : "U"));
`;

export const THOUGHT_CODEX_TRANSPORT_WORKER_READABLE_SOURCE = readableWorkerSource.trim();

// Generated from the readable source with esbuild 0.28.1
// (`minify=true, format=cjs, target=node20, legalComments=none`).
// The exact generated bytes are independently hashed and executed by tests.
export const THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE = "const{spawnSync:pe}=require(\"node:child_process\"),{createHash:he,randomBytes:ge}=require(\"node:crypto\"),o=JSON.parse(process.argv[1]),u=o.v[0],W=o.v[1],X=o.v[2],Z={protocolReleaseId:o.r[0],manifestKeccak256:o.r[1]},Q={schema:\"inshell.thought.agent-run-authority.v1\",launchHandoff:\"bootstrap-only\",canonicalRunCapsule:\"app-issued\",creativeInputSource:\"start-response-only\",chatEditsAffectCanonicalRun:!1,transcriptPurityAttested:!1},ee={bridgeId:\"inshell-thought-agent-direct\",bridgeVersion:\"0.0.4+fixed-worker\",platform:\"codex-direct-http\"},te={adapterId:\"codex\",adapterVersion:\"fixed-worker-v1\"},me={visibleTurns:1,agentInvocations:1,workspacePolicy:\"external-agent-app\",sandboxPolicy:\"agent-owned\",approvalPolicy:\"bounded-control-complete\",userConfigPolicy:\"agent-owned\"},ye=\"inshell.thought.agent-connectivity.v1\",Ie=\"sha256:90df786a3ffb5ec38bffd09ff356ec560d0b7dddcdf57170891149a92a399e9b\",Te=\"inshell.thought.agent-creative-brief.v2\",Oe=\"thought-v2-agent-creative-brief-20260807-r1\",Ee=\"sha256:8f89266863caa47599c3f162e703fb2197f7b33343c3ea249151d471c706b244\",Se=\"Inshell-THOUGHT-Agent/2\",i=e=>process.stdout.write(e+`\n`),v=e=>\"sha256:\"+he(\"sha256\").update(e).digest(\"hex\"),be=new Set([\"PROTOCOL_UNSUPPORTED\",\"TOKEN_INVALID\",\"RUN_EXPIRED\",\"RUN_ALREADY_CLAIMED\"]),Ne=new Set([\"none\",\"minimal\",\"low\",\"medium\",\"high\",\"xhigh\",\"max\",\"ultra\"]),re=/^[ A-Za-z0-9.,?!:;'\"()\\/&-]+$/;let E=!1,K=\"preflight\",C=\"\",w=\"\",k=\"\",s,ne=!1,H,L=!1,ae=!1,f=Buffer.alloc(0);process.stdin.on(\"data\",e=>{L&&(ae=!0),f=Buffer.concat([f,e]),H?.(),H=void 0}),process.stdin.on(\"end\",()=>{ne=!0,H?.(),H=void 0});const V=(e,t)=>{if(e===t)return!0;if(!e||!t||typeof e!=\"object\"||typeof t!=\"object\"||Array.isArray(e)||Array.isArray(t))return!1;const r=Object.keys(e).sort(),a=Object.keys(t).sort();return r.length===a.length&&r.every((d,y)=>d===a[y]&&V(e[d],t[d]))},we=(e,t)=>e&&typeof e==\"object\"&&!Array.isArray(e)&&Object.keys(e).sort().join(\",\")===[...t].sort().join(\",\"),n=(e,t,r,a=\"\")=>{E||(E=!0,i(\"stage=\"+e+\",class=\"+t+(a?\",\"+a:\"\")+\" \"+(r===\"U\"?\"THOUGHT_UNCERTAIN(U)\":\"THOUGHT_STOP(\"+r+\")\")),process.exitCode=2,process.stdin.pause())},U=e=>i(\"OK:\"+e),q=async()=>{for(;;){const e=f.indexOf(10);if(e>=0){const t=f.subarray(0,e);return f=f.subarray(e+1),{raw:t,terminated:!0}}if(ne){const t=f;return f=Buffer.alloc(0),{raw:t,terminated:!1}}await new Promise(t=>{H=t})}},F=e=>{if(e.includes(13))return{error:\"carriage-return\"};const t=e.toString(\"utf8\");return Buffer.from(t,\"utf8\").equals(e)?{value:t}:{error:\"invalid-utf8\"}},oe=async(e,t)=>{const r=await q();if(!r.terminated){n(e,\"transport\",t);return}const a=F(r.raw);if(a.error){n(e,\"framing\",t);return}return a.value},A=async(e,t,r,a,d,y,j=!1)=>{K=e;const I={\"content-type\":\"application/json\",\"user-agent\":Se};a&&(I.authorization=\"Bearer \"+a),y&&(I[\"idempotency-key\"]=y);const _=j?2:1;for(let S=0;S<_;S+=1){let c;try{c=await fetch(r,{method:t,headers:I,body:d,redirect:\"manual\"})}catch{if(S+1<_)continue;return n(e,\"transport\",e===\"preflight\"?\"N\":\"U\")}let l;try{l=await c.text()}catch{if(S+1<_)continue;return n(e,\"transport\",e===\"preflight\"?\"N\":\"U\")}if(!c.ok){if(c.status>=300&&c.status<400)return n(e,\"http\",\"U\");let p;try{p=JSON.parse(l)}catch{return n(e,\"parse\",\"U\")}const P=p?.protocolVersion===u&&typeof p?.error?.code==\"string\",G=c.status>=400&&c.status<500&&P&&be.has(p.error.code);return n(e,\"http\",G?\"R\":\"U\")}try{const p=JSON.parse(l);return!p||typeof p!=\"object\"||Array.isArray(p)?n(e,\"schema\",e===\"preflight\"?\"N\":\"U\"):p}catch{return n(e,\"parse\",\"U\")}}},se=e=>{const t=Buffer.byteLength(e,\"utf8\");if(!t)return{code:\"empty\",bytes:t};if(t>64)return{code:\"too-long\",bytes:t,limit:64};if(e.startsWith(\" \")||e.endsWith(\" \"))return{code:\"outer-space\",bytes:t};if(e.includes(\"  \"))return{code:\"repeated-space\",bytes:t};if(!re.test(e)){const r=Array.from(e),a=r.findIndex(d=>!re.test(d));return{code:\"invalid-character\",bytes:t,index:a,codepoint:\"U+\"+r[a].codePointAt(0).toString(16).toUpperCase().padStart(4,\"0\")}}},Ue=e=>/^sha256:[0-9a-f]{64}$/.test(e),Ae=e=>we(e,[\"manifestKeccak256\",\"protocolReleaseId\"])&&e.protocolReleaseId===Z.protocolReleaseId&&e.manifestKeccak256===Z.manifestKeccak256,B=async e=>{i(\"CANDIDATE_INVALID \"+Object.entries(e).map(([a,d])=>a+\"=\"+d).join(\",\"));const t=JSON.stringify({protocolVersion:u,invocationId:w,error:{code:\"AGENT_OUTPUT_SCHEMA_INVALID\",message:\"Agent line failed exact Terminal English validation.\"}}),r=await A(\"fail\",\"POST\",o.u+\"/fail\",C,t);if(r){if(r.protocolVersion!==u||r.runId!==o.i||r.state!==\"failed\"||r.error?.code!==\"AGENT_OUTPUT_SCHEMA_INVALID\")return n(\"fail\",\"schema\",\"U\");U(\"fail\"),i(\"stage=candidate,class=validation THOUGHT_STOP(R)\"),E=!0,process.exitCode=2,process.stdin.pause()}},_e=async()=>{const e=await q();if(!e.terminated)return n(\"candidate\",\"transport\",\"U\");const t=F(e.raw);if(t.error)return B({code:\"framing\",reason:t.error,bytes:e.raw.length});const r=await q();if(!r.terminated)return n(\"candidate\",\"transport\",\"U\");const a=F(r.raw);return a.error||a.value!==\"THOUGHT_END\"||f.length!==0?B({code:\"framing\",bytes:e.raw.length}):t.value},xe=async()=>{if(!process.stdin.isTTY||pe(\"stty\",[\"-echo\",\"-echonl\",\"-icrnl\",\"-inlcr\",\"-igncr\"],{stdio:[\"inherit\",\"ignore\",\"ignore\"]}).status!==0)return n(\"preflight\",\"permission\",\"N\");i(\"ECHO_READY\");const e=await oe(\"preflight\",\"N\");if(E)return;if(!/^NONCE:[A-Za-z0-9_-]{16,128}$/.test(e))return n(\"preflight\",\"schema\",\"N\");i(\"ECHO_OK\");const t=new URL(\"/api/thought-agent/v2/connectivity\",o.u).toString(),r=await A(\"preflight\",\"GET\",t);if(!r)return;if(r.schema!==ye||r.status!==\"reachable\"||r.protocolVersion!==u)return n(\"preflight\",\"schema\",\"N\");U(\"preflight\"),i(\"CREDENTIAL_READY\");let a=await oe(\"claim\",\"N\");if(E)return;try{s=JSON.parse(a)}catch{return n(\"claim\",\"schema\",\"N\")}finally{a=\"\"}const d=Object.keys(s).sort().join(\",\"),y=Object.hasOwn(s,\"reasoningEffort\"),j=s.metadataSource===\"unknown\"&&d===\"credential,echoProbe,metadataSource\",I=s.metadataSource===\"reported\"&&(d===\"credential,echoProbe,metadataSource,model\"||d===\"credential,echoProbe,metadataSource,model,reasoningEffort\")&&typeof s.model==\"string\"&&s.model===s.model.trim()&&s.model.length>0&&s.model.toLowerCase()!==\"unknown\"&&(!y||typeof s.reasoningEffort==\"string\"&&Ne.has(s.reasoningEffort));if(typeof s.credential!=\"string\"||!s.credential||s.echoProbe!==e||!j&&!I)return n(\"claim\",\"schema\",\"N\");if(f.length!==0)return n(\"claim\",\"framing\",\"N\");L=!0;const _={protocolVersion:u,bridge:ee,adapter:te},S=s.credential,c=await A(\"claim\",\"POST\",o.u+\"/claim\",S,JSON.stringify(_));if(s.credential=\"\",!c)return;const l=c.request,p=[\"spec\",\"instructions\",\"promptLine\",\"agentInput\",\"outputContract\"].some(fe=>Object.hasOwn(l||{},fe));if(c.protocolVersion!==u||c.runId!==o.i||c.state!==\"claimed\"||typeof c.bridgeToken!=\"string\"||!c.bridgeToken||!l||!V(l.authority,Q)||l.intent!==\"prepare-thought-creation\"||l.requestedAgent?.adapterId!==\"codex\"||l.controlPolicy?.mode!==\"bounded-preflight\"||l.controlPolicy?.creativeInputState!==\"sealed\"||l.evidenceContract?.schema!==W||p)return n(\"claim\",\"schema\",\"U\");C=c.bridgeToken,U(\"claim\");const P={schema:W,mode:\"bounded-preflight\",appExchange:\"verified\",agentProduct:\"declared\",runtimeModel:I?\"reported\":\"unknown\",localPreparation:\"verified\",installationsRequired:!1,creativeInputOpened:!1},G=JSON.stringify({protocolVersion:u,control:P}),T=await A(\"ready\",\"POST\",o.u+\"/ready\",C,G,void 0,!0);if(!T)return;if(T.protocolVersion!==u||T.runId!==o.i||T.state!==\"ready\"||T.stage!==\"control-verified\"||Object.hasOwn(T,\"creatorAction\")||!V(T.control,P))return n(\"ready\",\"schema\",\"U\");U(\"ready\"),w=\"tai_\"+ge(18).toString(\"base64url\"),k=new Date().toISOString();const ie=JSON.stringify({protocolVersion:u,invocationId:w,startedAt:k}),O=await A(\"start\",\"POST\",o.u+\"/start\",C,ie);if(!O)return;const g=O.request,h=g?.spec,m=g?.instructions,b=g?.promptLine,M=g?.agentInput,D=g?.outputContract,x=D?.agentLine;if(O.protocolVersion!==u||O.runId!==o.i||O.state!==\"running\"||O.invocationId!==w||O.startedAt!==k||!g||!V(g.authority,Q)||g.intent!==\"generate-thought-candidate\"||h?.id!==h?.contractSpecId||!/^0x[0-9a-fA-F]{64}$/.test(h?.contractSpecHash||\"\")||h?.sha256!==Ie||v(h?.text||\"\")!==h?.sha256||m?.id!==Te||m?.artifactId!==Oe||m?.sha256!==Ee||v(m?.text||\"\")!==m?.sha256||h.text===m.text||h.sha256===m.sha256||b?.text!==M?.text||b?.sha256!==M?.sha256||v(b?.text||\"\")!==b?.sha256||se(b.text)||D?.resultSchema!==X||!Ae(D?.release)||x?.workProfile!==o.w||x?.minUtf8Bytes!==1||x?.maxUtf8Bytes!==64||x?.normalization!==\"none\"||x?.displayUnitsAreAcceptanceLimits!==!1)return n(\"start\",\"schema\",\"U\");if(ae||f.length!==0)return B({code:\"premature\",bytes:f.length});U(\"start\"),i(\"THOUGHT_VERIFIED_SPEC_BEGIN\"),i(h.text),i(\"THOUGHT_VERIFIED_SPEC_END\"),i(\"THOUGHT_VERIFIED_INSTRUCTIONS_BEGIN\"),i(m.text),i(\"THOUGHT_VERIFIED_INSTRUCTIONS_END\"),i(\"THOUGHT_VERIFIED_PROMPT_BEGIN\"),i(b.text),i(\"THOUGHT_VERIFIED_PROMPT_END\"),i(\"THOUGHT_CANDIDATE_RULE exact one 1-64-byte Terminal English line followed by THOUGHT_END; no CR, extra line, JSON, trim, repair, or replacement\"),i(\"THOUGHT_INPUT_READY\"),L=!1;const R=await _e();if(E)return;L=!0;const Y=se(R);if(Y)return B(Y);const ce={schema:\"inshell.thought.agent-declaration.v1\",status:\"declared-unverified\",[o.l]:o.p,declaredOneCreativeResult:!0},de={schema:X,release:D.release,agentLine:R,declaration:ce},z=JSON.stringify(de),J={product:o.p,provider:\"codex\",metadataSource:s.metadataSource};I&&(J.model=s.model,y&&(J.reasoningEffort=s.reasoningEffort));const le=new Date().toISOString(),ue=JSON.stringify({protocolVersion:u,invocationId:w,bridge:ee,adapter:te,agent:J,execution:me,startedAt:k,completedAt:le,output:{mediaType:\"application/json\",raw:z,rawSha256:v(z),agentLine:R,agentLineSha256:v(R)}}),N=await A(\"result\",\"PUT\",o.u+\"/result\",C,ue,w,!0);if(!N)return;const $=N.result?.receipt?.receiptSha256;if(N.protocolVersion!==u||N.runId!==o.i||N.state!==\"returned\"||N.result?.agentLine!==R||!Ue($))return n(\"result\",\"schema\",\"U\");U(\"result\"),i(\"Receipt: \"+$),E=!0,process.stdin.pause()};xe().catch(()=>n(K,\"schema\",K===\"preflight\"?\"N\":\"U\"));\n" as const;

// Updated only when the exact source above intentionally changes. Tests
// independently decompress and hash the exact bytes before fake execution.
export const THOUGHT_CODEX_TRANSPORT_WORKER_SHA256 =
  "sha256:c19e87a41720a347c6dc80791a78bf114cd21793e8b3c80470343f95867ee280" as const;
export const THOUGHT_CODEX_TRANSPORT_WORKER_BROTLI_BASE64 =
  "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" as const;

export const THOUGHT_CODEX_BOOTSTRAP_SCHEMA =
  "inshell.thought.codex-bootstrap.v1" as const;
export const THOUGHT_CODEX_BOOTSTRAP_MAX_BYTES = 24 * 1024;
export const THOUGHT_CODEX_BOOTSTRAP_TIMEOUT_MS = 8_000;

const THOUGHT_CODEX_TRANSPORT_WORKER_READABLE_LOADER = String.raw`
const { createHash } = require("node:crypto"), { runInThisContext } = require("node:vm");
const [url, workerHash, configHash] = process.argv.slice(1);
const limit = ${THOUGHT_CODEX_BOOTSTRAP_MAX_BYTES}, timeoutMs = ${THOUGHT_CODEX_BOOTSTRAP_TIMEOUT_MS};
let stopped = false;
const stop = className => {
  if (stopped) return;
  stopped = true;
  process.stdout.write("stage=bootstrap,class=" + className + " THOUGHT_STOP(N)\n");
  process.exitCode = 2;
};
const hash = value => "sha256:" + createHash("sha256").update(value).digest("hex");
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
(async () => {
  if (!/^sha256:[0-9a-f]{64}$/.test(workerHash || "") || !/^sha256:[0-9a-f]{64}$/.test(configHash || "")) return stop("argument");
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { return stop("argument"); }
  const bootstrapMatch = parsedUrl.pathname.match(/^\/api\/thought-agent\/v2\/runs\/(tar_[A-Za-z0-9_-]{8,})\/bootstrap$/);
  if (!bootstrapMatch || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash || (parsedUrl.protocol !== "https:" && !(parsedUrl.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(parsedUrl.hostname)))) return stop("argument");
  const expectedRunUrl = parsedUrl.origin + parsedUrl.pathname.slice(0, -"/bootstrap".length);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  let response;
  try {
    response = await fetch(parsedUrl, { method: "GET", redirect: "manual", signal: controller.signal, headers: { accept: "application/json" } });
  } catch (error) {
    clearTimeout(timeout);
    return stop(error?.name === "AbortError" ? "timeout" : "transport");
  }
  const rejectResponse = async className => {
    controller.abort();
    await response.body?.cancel().catch(() => undefined);
    clearTimeout(timeout);
    return stop(className);
  };
  if (response.status >= 300 && response.status < 400) return rejectResponse("redirect");
  if (response.status !== 200) return rejectResponse("http");
  if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return rejectResponse("media-type");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) return rejectResponse("size");
  if (!response.body) return rejectResponse("transport");
  const reader = response.body.getReader(), chunks = [];
  let total = 0;
  while (true) {
    let item;
    try { item = await reader.read(); } catch { clearTimeout(timeout); return stop(timedOut ? "timeout" : "transport"); }
    if (item.done) break;
    total += item.value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      clearTimeout(timeout);
      return stop("size");
    }
    chunks.push(Buffer.from(item.value));
  }
  clearTimeout(timeout);
  let payload;
  try { payload = JSON.parse(Buffer.concat(chunks, total).toString("utf8")); } catch { return stop("parse"); }
  if (!exactKeys(payload, ["schema", "worker", "config"]) || payload.schema !== ${JSON.stringify(THOUGHT_CODEX_BOOTSTRAP_SCHEMA)} ||
      !exactKeys(payload.worker, ["mediaType", "sha256", "source"]) || payload.worker.mediaType !== "application/javascript" || typeof payload.worker.source !== "string" || payload.worker.sha256 !== workerHash || hash(payload.worker.source) !== workerHash ||
      !exactKeys(payload.config, ["mediaType", "sha256", "text"]) || payload.config.mediaType !== "application/json" || typeof payload.config.text !== "string" || payload.config.sha256 !== configHash || hash(payload.config.text) !== configHash) return stop("integrity");
  try {
    const config = JSON.parse(payload.config.text);
    if (!exactKeys(config, ["i", "u", "p", "v", "w", "l", "r"]) || config.i !== bootstrapMatch[1] || config.u !== expectedRunUrl) return stop("config");
  } catch { return stop("config"); }
  process.argv.splice(1, 3, payload.config.text);
  runInThisContext(payload.worker.source, { filename: "thought-codex-transport-worker.js" });
})().catch(() => stop("schema"));
`.trim();

// The handoff must survive HTML-to-text conversion as one exact shell command.
// Keep the authored loader readable above, but emit a single line so transport
// validators and Agent apps never need to reconstruct a multiline command.
export const THOUGHT_CODEX_TRANSPORT_WORKER_LOADER =
  THOUGHT_CODEX_TRANSPORT_WORKER_READABLE_LOADER.replace(/\s*\n\s*/g, " ");

export function buildThoughtCodexTransportWorkerCommand(
  binding: ThoughtCodexBootstrapBinding,
) {
  return [
    "node -e",
    shellQuote(THOUGHT_CODEX_TRANSPORT_WORKER_LOADER),
    "--",
    shellQuote(binding.url),
    shellQuote(binding.workerSha256),
    shellQuote(binding.configSha256),
  ].join(" ");
}
