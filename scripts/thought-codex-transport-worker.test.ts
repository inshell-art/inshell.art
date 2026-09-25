import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createServer, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  THOUGHT_AGENT_RUN_AUTHORITY,
  THOUGHT_CODEX_BOOTSTRAP_MAX_BYTES,
  THOUGHT_CODEX_BOOTSTRAP_SCHEMA,
  THOUGHT_CODEX_BOOTSTRAP_TIMEOUT_MS,
  THOUGHT_CODEX_TRANSPORT_WORKER_READABLE_SOURCE,
  THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
  THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtCodexTransportWorkerConfigText,
  buildThoughtCodexTransportWorkerCommand,
  type ThoughtCodexBootstrapBinding,
} from "../packages/thought-agent-protocol/src/index";

const PROTOCOL = THOUGHT_V2_PROTOCOL_RELEASE.agentRunId;
const CONTROL = "inshell.thought.agent-control.v2";
const RESULT = THOUGHT_V2_PROTOCOL_RELEASE.identifiers.agentResult;
const RUN_ID = `tar_${"w".repeat(24)}`;
const LAUNCH = "synthetic-launch-secret-never-print";
const BRIDGE = "synthetic-bridge-secret-never-print";
const NONCE = `NONCE:${"n".repeat(24)}`;
const RECEIPT = `sha256:${"a".repeat(64)}`;
const PROMPT = "One exact prompt?";
const sha256 = (value: string | Buffer) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const PTY_RELAY = String.raw`
import os, pty, select, sys
pid, master = pty.fork()
if pid == 0:
    os.execvp(sys.argv[1], sys.argv[1:])
stdin_fd = sys.stdin.fileno()
while True:
    readable, _, _ = select.select([master, stdin_fd], [], [])
    if master in readable:
        try:
            data = os.read(master, 4096)
        except OSError:
            break
        if not data:
            break
        os.write(sys.stdout.fileno(), data)
    if stdin_fd in readable:
        data = os.read(stdin_fd, 4096)
        if not data:
            try:
                os.close(master)
            except OSError:
                pass
            break
        os.write(master, data)
_, status = os.waitpid(pid, 0)
if os.WIFEXITED(status):
    raise SystemExit(os.WEXITSTATUS(status))
raise SystemExit(128 + os.WTERMSIG(status))
`;

type EndpointOptions = {
  nullOperation?: "connectivity" | "claim" | "ready" | "start" | "result";
  claimTransportFailure?: boolean;
  readyBodyDropOnce?: boolean;
  readyRateLimit?: boolean;
  readyCreatorAction?: boolean;
  readyDelayMs?: number;
  startTransportFailure?: boolean;
  resultBodyDropOnce?: boolean;
  claimAuthority?: Record<string, unknown>;
  readyControlMutation?: (control: Record<string, unknown>) => Record<string, unknown>;
  bootstrap?: BootstrapOptions;
};

type BootstrapOptions = {
  status?: number;
  redirect?: boolean;
  mediaType?: string;
  declaredLength?: number;
  omitContentLength?: boolean;
  stalledBody?: boolean;
  workerSource?: string;
  workerSha256?: string;
  configText?: string;
  configMutation?: (configText: string) => string;
  configSha256?: string;
  bindingConfigSha256?: string;
  bindResponseConfig?: boolean;
};

type RecordedRequest = {
  operation: string;
  authorization: string;
  idempotencyKey: string;
  body: string;
};

const json = (response: ServerResponse, status: number, value: unknown, headers?: Record<string, string>) => {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body).toString(),
    ...headers,
  });
  response.end(body);
};

async function startEndpoint(options: EndpointOptions = {}) {
  const requests: RecordedRequest[] = [];
  const sockets = new Set<Socket>();
  let resultAgentLine = "";
  let readyDrops = 0;
  let resultDrops = 0;
  let runUrl = "";
  let bootstrapBinding: ThoughtCodexBootstrapBinding | null = null;
  const canonicalConfigText = () => buildThoughtCodexTransportWorkerConfigText({
    product: "Codex",
    runId: RUN_ID,
    runUrl,
    protocolVersion: PROTOCOL,
    controlVersion: CONTROL,
    resultVersion: RESULT,
    workProfile: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile,
    declarationLabelField: "label",
    release: THOUGHT_V2_PROTOCOL_RELEASE.release,
  });
  const responseConfigText = () => {
    const canonical = canonicalConfigText();
    return options.bootstrap?.configMutation?.(canonical) ?? options.bootstrap?.configText ?? canonical;
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const operation = url.pathname.endsWith("/connectivity")
      ? "connectivity"
      : url.pathname.split("/").at(-1) ?? "unknown";
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({
      operation,
      authorization: request.headers.authorization ?? "",
      idempotencyKey: String(request.headers["idempotency-key"] ?? ""),
      body,
    });
    if (operation === "bootstrap") {
      const bootstrap = options.bootstrap ?? {};
      if (bootstrap.redirect) {
        response.writeHead(302, {
          location: `${runUrl}/bootstrap-elsewhere`,
          "content-type": "application/json",
        });
        if (bootstrap.stalledBody) {
          response.write("{");
          return;
        }
        return response.end("{}");
      }
      const configText = responseConfigText();
      const workerSource = bootstrap.workerSource ?? THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE;
      const responseBody = JSON.stringify({
        schema: THOUGHT_CODEX_BOOTSTRAP_SCHEMA,
        worker: {
          mediaType: "application/javascript",
          sha256: bootstrap.workerSha256 ?? THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
          source: workerSource,
        },
        config: {
          mediaType: "application/json",
          sha256: bootstrap.configSha256 ?? sha256(configText),
          text: configText,
        },
      });
      response.writeHead(bootstrap.status ?? 200, {
        "content-type": bootstrap.mediaType ?? "application/json",
        ...(bootstrap.declaredLength === undefined
          ? (bootstrap.stalledBody || bootstrap.omitContentLength
              ? {}
              : { "content-length": Buffer.byteLength(responseBody).toString() })
          : { "content-length": bootstrap.declaredLength.toString() }),
      });
      if (bootstrap.stalledBody) {
        response.write(responseBody.slice(0, 16));
        return;
      }
      return response.end(responseBody);
    }
    if (options.nullOperation === operation) return json(response, 200, null);
    if (operation === "connectivity") {
      return json(response, 200, {
        schema: "inshell.thought.agent-connectivity.v1",
        status: "reachable",
        protocolVersion: PROTOCOL,
      });
    }
    if (operation === "claim") {
      assert.equal(request.headers.authorization, `Bearer ${LAUNCH}`);
      assert.deepEqual(JSON.parse(body), {
        protocolVersion: PROTOCOL,
        bridge: {
          bridgeId: "inshell-thought-agent-direct",
          bridgeVersion: "0.0.4+fixed-worker",
          platform: "codex-direct-http",
        },
        adapter: { adapterId: "codex", adapterVersion: "fixed-worker-v1" },
      });
      if (options.claimTransportFailure) return request.socket.destroy();
      return json(response, 200, {
        protocolVersion: PROTOCOL,
        runId: RUN_ID,
        state: "claimed",
        bridgeToken: BRIDGE,
        request: {
          authority: options.claimAuthority ?? {
            transcriptPurityAttested: false,
            creativeInputSource: "start-response-only",
            schema: "inshell.thought.agent-run-authority.v1",
            chatEditsAffectCanonicalRun: false,
            canonicalRunCapsule: "app-issued",
            launchHandoff: "bootstrap-only",
          },
          intent: "prepare-thought-creation",
          requestedAgent: { adapterId: "codex" },
          controlPolicy: { mode: "bounded-preflight", creativeInputState: "sealed" },
          evidenceContract: { schema: CONTROL },
        },
      });
    }
    assert.equal(request.headers.authorization, `Bearer ${BRIDGE}`);
    if (operation === "ready") {
      if (options.readyDelayMs) await new Promise((resolve) => setTimeout(resolve, options.readyDelayMs));
      if (options.readyRateLimit) {
        return json(response, 429, {
          protocolVersion: PROTOCOL,
          error: { code: "RATE_LIMITED", message: "plausible but unproven" },
        }, { "retry-after": "0" });
      }
      if (options.readyBodyDropOnce && readyDrops++ === 0) {
        response.writeHead(200, { "content-type": "application/json", "content-length": "4096" });
        response.write('{"protocolVersion":"');
        return response.socket?.destroy();
      }
      const control = JSON.parse(body).control as Record<string, unknown>;
      return json(response, 200, {
        stage: "control-verified",
        control: options.readyControlMutation?.(control) ?? Object.fromEntries(Object.entries(control).reverse()),
        state: "ready",
        runId: RUN_ID,
        protocolVersion: PROTOCOL,
        ...(options.readyCreatorAction ? { creatorAction: "CREATE" } : {}),
      });
    }
    if (operation === "start") {
      if (options.startTransportFailure) return request.socket.destroy();
      const parsed = JSON.parse(body);
      return json(response, 200, {
        protocolVersion: PROTOCOL,
        runId: RUN_ID,
        state: "running",
        invocationId: parsed.invocationId,
        startedAt: parsed.startedAt,
        request: {
          authority: Object.fromEntries(Object.entries(THOUGHT_AGENT_RUN_AUTHORITY).reverse()),
          intent: "generate-thought-candidate",
          spec: {
            id: "exact-spec",
            contractSpecId: "exact-spec",
            contractSpecHash: `0x${"b".repeat(64)}`,
            sha256: `sha256:${THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256}`,
            text: THOUGHT_V2_PROTOCOL_RELEASE.spec.text,
          },
          instructions: {
            id: THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.id,
            artifactId: THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.artifactId,
            sha256: `sha256:${THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.sha256}`,
            text: THOUGHT_V2_PROTOCOL_RELEASE.creativeBrief.text,
          },
          promptLine: { text: PROMPT, sha256: sha256(PROMPT) },
          agentInput: { sha256: sha256(PROMPT), text: PROMPT },
          outputContract: {
            resultSchema: RESULT,
            release: THOUGHT_V2_PROTOCOL_RELEASE.release,
            agentLine: {
              workProfile: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile,
              minUtf8Bytes: 1,
              maxUtf8Bytes: 64,
              normalization: "none",
              displayUnitsAreAcceptanceLimits: false,
            },
          },
        },
      });
    }
    if (operation === "result") {
      if (options.resultBodyDropOnce && resultDrops++ === 0) {
        response.writeHead(200, { "content-type": "application/json", "content-length": "4096" });
        response.write('{"protocolVersion":"');
        return response.socket?.destroy();
      }
      const parsed = JSON.parse(body);
      resultAgentLine = parsed.output.agentLine;
      assert.equal(parsed.output.agentLineSha256, sha256(resultAgentLine));
      assert.equal(parsed.output.rawSha256, sha256(parsed.output.raw));
      return json(response, 200, {
        protocolVersion: PROTOCOL,
        runId: RUN_ID,
        state: "returned",
        result: { agentLine: resultAgentLine, receipt: { receiptSha256: RECEIPT } },
      });
    }
    if (operation === "fail") {
      const parsed = JSON.parse(body);
      return json(response, 200, {
        protocolVersion: PROTOCOL,
        runId: RUN_ID,
        state: "failed",
        error: parsed.error,
      });
    }
    return json(response, 404, { protocolVersion: PROTOCOL, error: { code: "ROUTE_NOT_FOUND" } });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  runUrl = `http://127.0.0.1:${address.port}/api/thought-agent/v2/runs/${RUN_ID}`;
  bootstrapBinding = {
    url: `${runUrl}/bootstrap`,
    workerSha256: THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
    configSha256: options.bootstrap?.bindingConfigSha256 ?? sha256(
      options.bootstrap?.bindResponseConfig ? responseConfigText() : canonicalConfigText(),
    ),
  };
  return {
    runUrl,
    bootstrap: bootstrapBinding,
    requests,
    result: () => resultAgentLine,
    close: () => new Promise<void>((resolve, reject) => {
      for (const socket of sockets) socket.destroy();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

type Worker = {
  child: ChildProcessWithoutNullStreams;
  lines: string[];
  raw: () => string;
  write: (value: string | Buffer) => void;
  waitFor: (value: string | RegExp) => Promise<void>;
  exited: Promise<{ code: number | null; signal: string | null }>;
  closeInput: () => void;
  cleanup: () => Promise<void>;
};

function startWorker(bootstrap: ThoughtCodexBootstrapBinding): Worker {
  const command = buildThoughtCodexTransportWorkerCommand(bootstrap);
  const child = spawn("python3", ["-c", PTY_RELAY, "zsh", "-f", "-c", command], {
    env: { PATH: process.env.PATH },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines: string[] = [];
  let raw = "";
  const wake = new Set<() => void>();
  child.stdout.on("data", (chunk) => { raw += String(chunk); });
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => {
    lines.push(line.replace(/\r$/, ""));
    for (const fn of wake) fn();
  });
  child.stderr.on("data", (chunk) => { raw += String(chunk); });
  createInterface({ input: child.stderr, crlfDelay: Infinity }).on("line", (line) => {
    lines.push(line.replace(/\r$/, ""));
    for (const fn of wake) fn();
  });
  let settled = false;
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  void exited.finally(() => { settled = true; });
  return {
    child,
    lines,
    raw: () => raw,
    write: (value) => child.stdin.write(value),
    waitFor: async (value) => {
      const deadline = Date.now() + 8_000;
      const matches = () => lines.some((line) => typeof value === "string" ? line === value : value.test(line));
      while (!matches()) {
        if (Date.now() >= deadline) throw new Error(`Timed out for ${String(value)}: ${JSON.stringify(lines.slice(-20))}`);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => { wake.delete(onWake); resolve(); }, 25);
          const onWake = () => { clearTimeout(timer); wake.delete(onWake); resolve(); };
          wake.add(onWake);
        });
      }
    },
    exited,
    closeInput: () => child.stdin.end(),
    cleanup: async () => {
      if (!settled) child.kill("SIGKILL");
      await exited;
    },
  };
}

const waitForExitWithin = async (worker: Worker, timeoutMs: number) =>
  new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Worker remained alive after ${timeoutMs}ms: ${worker.raw()}`)),
      timeoutMs,
    );
    worker.exited.then(
      (outcome) => {
        clearTimeout(timer);
        resolve(outcome);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

async function expectBootstrapStop(
  bootstrap: BootstrapOptions,
  className: string,
  exitTimeoutMs = 2_000,
) {
  const endpoint = await startEndpoint({ bootstrap });
  const worker = startWorker(endpoint.bootstrap);
  try {
    const outcome = await waitForExitWithin(worker, exitTimeoutMs);
    assert.equal(outcome.code, 2);
    assert.match(worker.lines.join("\n"), new RegExp(`stage=bootstrap,class=${className} THOUGHT_STOP\\(N\\)`));
    assert.deepEqual(endpoint.requests.map((request) => request.operation), ["bootstrap"]);
    assert.equal(endpoint.requests[0]?.authorization, "");
  } finally {
    await worker.cleanup();
    await endpoint.close();
  }
}

async function reachInput(worker: Worker, metadata: "reported" | "unknown" = "reported") {
  await worker.waitFor("ECHO_READY");
  worker.write(`${NONCE}\n`);
  await worker.waitFor("ECHO_OK");
  assert.doesNotMatch(worker.raw(), new RegExp(NONCE));
  await worker.waitFor("CREDENTIAL_READY");
  worker.write(`${JSON.stringify(metadata === "reported" ? {
    credential: LAUNCH,
    echoProbe: NONCE,
    metadataSource: "reported",
    model: "gpt-test",
    reasoningEffort: "low",
  } : {
    credential: LAUNCH,
    echoProbe: NONCE,
    metadataSource: "unknown",
  })}\n`);
  await worker.waitFor("THOUGHT_INPUT_READY");
}

async function runCandidate(candidateFrame: string | Buffer, options: EndpointOptions = {}) {
  const endpoint = await startEndpoint(options);
  const worker = startWorker(endpoint.bootstrap);
  try {
    await reachInput(worker);
    worker.write(candidateFrame);
    await worker.exited;
    return { endpoint, worker };
  } catch (error) {
    await worker.cleanup();
    await endpoint.close();
    throw error;
  }
}

test("fetched worker bytes match the readable source and approved hash", async () => {
  const require = createRequire(import.meta.url);
  const viteEntry = require.resolve("vite", { paths: [`${process.cwd()}/apps/home`] });
  const { transformWithEsbuild } = await import(pathToFileURL(viteEntry).href) as typeof import("vite");
  const transformed = await transformWithEsbuild(
    THOUGHT_CODEX_TRANSPORT_WORKER_READABLE_SOURCE,
    "thought-codex-transport-worker.cjs",
    { minify: true, format: "cjs", target: "node20", legalComments: "none" },
  );
  assert.equal(transformed.code, THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE);
  assert.equal(sha256(THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE), THOUGHT_CODEX_TRANSPORT_WORKER_SHA256);
});

test("bootstrap command contains only the readable loader and pinned retrieval binding", async () => {
  const endpoint = await startEndpoint();
  try {
    const command = buildThoughtCodexTransportWorkerCommand(endpoint.bootstrap);
    assert.match(command, /node -e/);
    assert.ok(command.includes(endpoint.bootstrap.url));
    assert.ok(command.includes(endpoint.bootstrap.workerSha256));
    assert.ok(command.includes(endpoint.bootstrap.configSha256));
    assert.equal(command.includes(THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE), false);
    assert.equal(command.includes(buildThoughtCodexTransportWorkerConfigText({
      product: "Codex",
      runId: RUN_ID,
      runUrl: endpoint.runUrl,
      protocolVersion: PROTOCOL,
      controlVersion: CONTROL,
      resultVersion: RESULT,
      workProfile: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile,
      declarationLabelField: "label",
      release: THOUGHT_V2_PROTOCOL_RELEASE.release,
    })), false);
  } finally {
    await endpoint.close();
  }
});

test("bootstrap rejects stalled error, redirect, and invalid-media responses and exits", async () => {
  await expectBootstrapStop({ status: 500, stalledBody: true }, "http");
  await expectBootstrapStop({ redirect: true, stalledBody: true }, "redirect");
  await expectBootstrapStop({ mediaType: "text/plain", stalledBody: true }, "media-type");
});

test("bootstrap enforces declared and streamed response size limits", async () => {
  await expectBootstrapStop({ declaredLength: THOUGHT_CODEX_BOOTSTRAP_MAX_BYTES + 1, stalledBody: true }, "size");
  await expectBootstrapStop({
    workerSource: "x".repeat(THOUGHT_CODEX_BOOTSTRAP_MAX_BYTES),
    omitContentLength: true,
  }, "size");
});

test("bootstrap timeout remains active while the success body stalls", async () => {
  const startedAt = Date.now();
  await expectBootstrapStop(
    { stalledBody: true },
    "timeout",
    THOUGHT_CODEX_BOOTSTRAP_TIMEOUT_MS + 3_000,
  );
  assert.ok(Date.now() - startedAt >= THOUGHT_CODEX_BOOTSTRAP_TIMEOUT_MS - 250);
});

test("bootstrap rejects worker and config integrity drift before preflight", async () => {
  await expectBootstrapStop({
    workerSource: `${THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE}\n`,
  }, "integrity");
  await expectBootstrapStop({
    configMutation: (value) => `${value} `,
  }, "integrity");
});

test("bootstrap rejects replayed run and origin config even with matching config hashes", async () => {
  for (const field of ["i", "u"] as const) {
    await expectBootstrapStop({
      configMutation: (value) => {
        const config = JSON.parse(value) as Record<string, unknown>;
        config[field] = field === "i" ? `tar_${"z".repeat(24)}` : "https://example.invalid/api/thought-agent/v2/runs/tar_replayed";
        return JSON.stringify(config);
      },
      bindResponseConfig: true,
    }, "config");
  }
});

test("exact worker accepts the observed 34-byte candidate only after start", async () => {
  const endpoint = await startEndpoint();
  const worker = startWorker(endpoint.bootstrap);
  try {
    await reachInput(worker);
    assert.equal(endpoint.requests.some((entry) => entry.operation === "result"), false);
    const candidate = "Signal held; the quiet line opens.";
    assert.equal(Buffer.byteLength(candidate), 34);
    worker.write(`${candidate}\nTHOUGHT_END\n`);
    await worker.waitFor("OK:result");
    const outcome = await worker.exited;
    assert.equal(outcome.code, 0);
    assert.equal(endpoint.result(), candidate);
    assert.doesNotMatch(worker.raw(), new RegExp(LAUNCH));
    assert.doesNotMatch(worker.raw(), new RegExp(BRIDGE));
  } finally {
    await worker.cleanup();
    await endpoint.close();
  }
});

for (const candidate of ["A", "A".repeat(64)]) {
  test(`exact worker accepts ${Buffer.byteLength(candidate)}-byte boundary`, async () => {
    const { endpoint, worker } = await runCandidate(`${candidate}\nTHOUGHT_END\n`);
    try {
      assert.equal(endpoint.result(), candidate);
      assert.equal((await worker.exited).code, 0);
    } finally {
      await endpoint.close();
    }
  });
}

for (const [name, candidate] of [
  ["empty", ""],
  ["74-byte", "A".repeat(74)],
  ["invalid alphabet", "Not @ valid"],
  ["leading space", " leading"],
  ["trailing space", "trailing "],
  ["repeated space", "two  spaces"],
] as const) {
  test(`exact worker rejects ${name} candidate without result`, async () => {
    const { endpoint, worker } = await runCandidate(`${candidate}\nTHOUGHT_END\n`);
    try {
      assert.equal(endpoint.requests.filter((entry) => entry.operation === "result").length, 0);
      assert.equal(endpoint.requests.filter((entry) => entry.operation === "fail").length, 1);
      assert.match(worker.lines.join("\n"), /CANDIDATE_INVALID/);
    } finally {
      await endpoint.close();
    }
  });
}

for (const [name, frame] of [
  ["embedded CR", Buffer.from("Valid prefix\rTHOUGHT_END\n")],
  ["CRLF", Buffer.from("Valid prefix\r\nTHOUGHT_END\n")],
  ["multiple lines", Buffer.from("Valid prefix\nInjected line\nTHOUGHT_END\n")],
] as const) {
  test(`PTY framing rejects ${name} without submitting a prefix`, async () => {
    const { endpoint, worker } = await runCandidate(frame);
    try {
      assert.equal(endpoint.requests.filter((entry) => entry.operation === "result").length, 0);
      assert.equal(endpoint.requests.filter((entry) => entry.operation === "fail").length, 1);
      assert.match(worker.lines.join("\n"), /code=framing/);
    } finally {
      await endpoint.close();
    }
  });
}

test("missing echo proof stops before claim and never exposes secrets", async () => {
  const endpoint = await startEndpoint();
  const worker = startWorker(endpoint.bootstrap);
  try {
    await worker.waitFor("ECHO_READY");
    worker.write(`${NONCE}\n`);
    await worker.waitFor("CREDENTIAL_READY");
    worker.write(`${JSON.stringify({ credential: LAUNCH, metadataSource: "unknown" })}\n`);
    await worker.waitFor(/stage=claim,class=schema THOUGHT_STOP\(N\)/);
    await worker.exited;
    assert.equal(endpoint.requests.filter((entry) => entry.operation === "claim").length, 0);
    assert.doesNotMatch(worker.raw(), new RegExp(LAUNCH));
  } finally {
    await worker.cleanup();
    await endpoint.close();
  }
});

test("candidate queued with bootstrap is rejected without a result", async () => {
  const endpoint = await startEndpoint();
  const worker = startWorker(endpoint.bootstrap);
  try {
    await worker.waitFor("ECHO_READY");
    worker.write(`${NONCE}\n`);
    await worker.waitFor("CREDENTIAL_READY");
    const bootstrap = JSON.stringify({ credential: LAUNCH, echoProbe: NONCE, metadataSource: "unknown" });
    worker.write(`${bootstrap}\nToo early.\nTHOUGHT_END\n`);
    await worker.waitFor(/CANDIDATE_INVALID code=premature/);
    await worker.exited;
    assert.equal(endpoint.requests.filter((entry) => entry.operation === "result").length, 0);
    assert.equal(endpoint.requests.filter((entry) => entry.operation === "fail").length, 1);
  } finally {
    await worker.cleanup();
    await endpoint.close();
  }
});

test("candidate arriving during a pending control request is rejected after verified start", async () => {
  const endpoint = await startEndpoint({ readyDelayMs: 150 });
  const worker = startWorker(endpoint.bootstrap);
  try {
    await worker.waitFor("ECHO_READY");
    worker.write(`${NONCE}\n`);
    await worker.waitFor("CREDENTIAL_READY");
    worker.write(`${JSON.stringify({ credential: LAUNCH, echoProbe: NONCE, metadataSource: "unknown" })}\n`);
    await worker.waitFor("OK:claim");
    worker.write("Still too early.\nTHOUGHT_END\n");
    await worker.waitFor(/CANDIDATE_INVALID code=premature/);
    await worker.exited;
    assert.equal(endpoint.requests.filter((entry) => entry.operation === "result").length, 0);
    assert.equal(endpoint.requests.filter((entry) => entry.operation === "fail").length, 1);
  } finally {
    await worker.cleanup();
    await endpoint.close();
  }
});

test("nonobject success bodies stop with stage-specific schema diagnostics", async () => {
  for (const operation of ["connectivity", "claim", "ready", "start", "result"] as const) {
    const endpoint = await startEndpoint({ nullOperation: operation });
    const worker = startWorker(endpoint.bootstrap);
    try {
      await worker.waitFor("ECHO_READY");
      worker.write(`${NONCE}\n`);
      if (operation !== "connectivity") {
        await worker.waitFor("CREDENTIAL_READY");
        worker.write(`${JSON.stringify({ credential: LAUNCH, echoProbe: NONCE, metadataSource: "unknown" })}\n`);
      }
      if (operation === "result") {
        await worker.waitFor("THOUGHT_INPUT_READY");
        worker.write("One exact result.\nTHOUGHT_END\n");
      }
      const stage = operation === "connectivity" ? "preflight" : operation;
      const certainty = operation === "connectivity" ? "THOUGHT_STOP(N)" : "THOUGHT_UNCERTAIN(U)";
      await worker.waitFor(`stage=${stage},class=schema ${certainty}`);
      await worker.exited;
      assert.equal(endpoint.requests.filter((entry) => entry.operation === "result").length, operation === "result" ? 1 : 0);
    } finally {
      await worker.cleanup();
      await endpoint.close();
    }
  }
});

test("ready creatorAction and control drift stop before start", async () => {
  const variants: EndpointOptions[] = [
    { readyCreatorAction: true },
    { readyControlMutation: (control) => ({ ...control, extra: false }) },
    { readyControlMutation: (control) => Object.fromEntries(Object.entries(control).slice(1)) },
    { readyControlMutation: (control) => ({ ...control, installationsRequired: 0 }) },
  ];
  for (const options of variants) {
    const endpoint = await startEndpoint(options);
    const worker = startWorker(endpoint.bootstrap);
    try {
      await worker.waitFor("ECHO_READY");
      worker.write(`${NONCE}\n`);
      await worker.waitFor("CREDENTIAL_READY");
      worker.write(`${JSON.stringify({ credential: LAUNCH, echoProbe: NONCE, metadataSource: "unknown" })}\n`);
      await worker.waitFor(/stage=ready,class=schema THOUGHT_UNCERTAIN\(U\)/);
      await worker.exited;
      assert.equal(endpoint.requests.filter((entry) => entry.operation === "start").length, 0);
    } finally {
      await worker.cleanup();
      await endpoint.close();
    }
  }
});

test("EOF after verified start is uncertain and never submits a result", async () => {
  const endpoint = await startEndpoint();
  const worker = startWorker(endpoint.bootstrap);
  try {
    await reachInput(worker);
    // VEOF on the real PTY, not pipe EOF in the relay process.
    worker.write(Buffer.from([4]));
    await worker.waitFor(/stage=candidate,class=transport THOUGHT_UNCERTAIN\(U\)/);
    await worker.exited;
    assert.equal(endpoint.requests.filter((entry) => entry.operation === "result").length, 0);
  } finally {
    await worker.cleanup();
    await endpoint.close();
  }
});

test("claim and start remain one-shot under transport uncertainty", async () => {
  for (const options of [{ claimTransportFailure: true }, { startTransportFailure: true }]) {
    const endpoint = await startEndpoint(options);
    const worker = startWorker(endpoint.bootstrap);
    try {
      await worker.waitFor("ECHO_READY");
      worker.write(`${NONCE}\n`);
      await worker.waitFor("CREDENTIAL_READY");
      worker.write(`${JSON.stringify({ credential: LAUNCH, echoProbe: NONCE, metadataSource: "unknown" })}\n`);
      await worker.waitFor(/THOUGHT_UNCERTAIN\(U\)/);
      await worker.exited;
      const operation = options.claimTransportFailure ? "claim" : "start";
      assert.equal(endpoint.requests.filter((entry) => entry.operation === operation).length, 1);
      assert.equal(endpoint.requests.filter((entry) => entry.operation === "result").length, 0);
    } finally {
      await worker.cleanup();
      await endpoint.close();
    }
  }
});

test("ready and frozen result replay exact bytes once after body transport loss", async () => {
  const endpoint = await startEndpoint({ readyBodyDropOnce: true, resultBodyDropOnce: true });
  const worker = startWorker(endpoint.bootstrap);
  try {
    await reachInput(worker, "unknown");
    worker.write("One exact return.\nTHOUGHT_END\n");
    await worker.waitFor("OK:result");
    await worker.exited;
    for (const operation of ["ready", "result"]) {
      const calls = endpoint.requests.filter((entry) => entry.operation === operation);
      assert.equal(calls.length, 2);
      assert.equal(calls[0]?.body, calls[1]?.body);
      assert.equal(calls[0]?.authorization, calls[1]?.authorization);
      assert.equal(calls[0]?.idempotencyKey, calls[1]?.idempotencyKey);
    }
  } finally {
    await worker.cleanup();
    await endpoint.close();
  }
});

test("plausible RATE_LIMITED response without operation proof is uncertain and not replayed", async () => {
  const endpoint = await startEndpoint({ readyRateLimit: true });
  const worker = startWorker(endpoint.bootstrap);
  try {
    await worker.waitFor("ECHO_READY");
    worker.write(`${NONCE}\n`);
    await worker.waitFor("CREDENTIAL_READY");
    worker.write(`${JSON.stringify({ credential: LAUNCH, echoProbe: NONCE, metadataSource: "unknown" })}\n`);
    await worker.waitFor(/stage=ready,class=http THOUGHT_UNCERTAIN\(U\)/);
    await worker.exited;
    assert.equal(endpoint.requests.filter((entry) => entry.operation === "ready").length, 1);
    assert.equal(endpoint.requests.filter((entry) => entry.operation === "start").length, 0);
  } finally {
    await worker.cleanup();
    await endpoint.close();
  }
});

test("exact object validation ignores order but rejects missing, extra, and wrong types", async () => {
  for (const authority of [
    { ...THOUGHT_AGENT_RUN_AUTHORITY, extra: false },
    Object.fromEntries(Object.entries(THOUGHT_AGENT_RUN_AUTHORITY).slice(1)),
    { ...THOUGHT_AGENT_RUN_AUTHORITY, transcriptPurityAttested: "false" },
  ]) {
    const endpoint = await startEndpoint({ claimAuthority: authority });
    const worker = startWorker(endpoint.bootstrap);
    try {
      await worker.waitFor("ECHO_READY");
      worker.write(`${NONCE}\n`);
      await worker.waitFor("CREDENTIAL_READY");
      worker.write(`${JSON.stringify({ credential: LAUNCH, echoProbe: NONCE, metadataSource: "unknown" })}\n`);
      await worker.waitFor(/stage=claim,class=schema THOUGHT_UNCERTAIN\(U\)/);
      await worker.exited;
      assert.equal(endpoint.requests.filter((entry) => entry.operation === "ready").length, 0);
    } finally {
      await worker.cleanup();
      await endpoint.close();
    }
  }
});
