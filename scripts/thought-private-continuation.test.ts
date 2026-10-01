import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  buildThoughtClaudeTask,
  buildThoughtCodexTask,
  THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
  THOUGHT_HANDOFF_OPERATION_DIAGNOSTICS,
  THOUGHT_HANDOFF_OPERATION_RECOVERY,
} from "../packages/thought-agent-protocol/src/index";

const codexBootstrapFor = (runUrl: string) => ({
  url: `${runUrl.replace(/\/+$/g, "")}/bootstrap`,
  workerSha256: THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
  configSha256: `sha256:${"b".repeat(64)}` as const,
});

const LAUNCH_TOKEN = "synthetic-launch-token-never-print";
const BRIDGE_TOKEN = "synthetic-bridge-token-never-print";
const PTY_SENTINEL = "synthetic-pty-echo-sentinel-never-print";
const PTY_LAUNCH_TOKEN = "synthetic-pty-launch-token-never-print";
const PTY_TRANSITION_SECRET = "synthetic-transition-secret-never-print";

// Synthetic only: this worker proves the process/input lifetime contract. It
// does not contact THOUGHT, exercise an Agent desktop app, or count as canary
// evidence.
const WORKER_SOURCE = String.raw`
const readline = require("node:readline");
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const lines = input[Symbol.asyncIterator]();
const emit = (value) => process.stdout.write(value + "\n");
const take = async (stage) => {
  const item = await lines.next();
  if (item.done) {
    emit("TERMINAL_INPUT_CLOSED:" + stage);
    process.exitCode = 2;
    return null;
  }
  return item.value;
};

(async () => {
  if (process.env.SYNTHETIC_CONTINUATION_AVAILABLE !== "1") {
    emit("THOUGHT_CONTINUATION_UNAVAILABLE");
    input.close();
    return;
  }
  if (!process.env.SYNTHETIC_BRIDGE_TOKEN) {
    emit("TERMINAL_PRIVATE_STATE_MISSING");
    process.exitCode = 2;
    input.close();
    return;
  }

  emit("THOUGHT_CONTINUATION_READY");
  const nonce = await take("nonce");
  if (nonce === null) return;
  if (!nonce.startsWith("NONCE:")) {
    emit("PRECLAIM_ABORT:bad_nonce");
    input.close();
    return;
  }
  emit("THOUGHT_CONTINUATION_OK");
  const launchInput = await take("launch");
  if (launchInput === null) return;
  if (!launchInput.startsWith("LAUNCH:")) {
    emit("PRECLAIM_ABORT:bad_launch");
    input.close();
    return;
  }

  // Tokens remain process-private. Only stage markers and validated creative
  // fields cross stdout.
  const launchToken = launchInput.slice("LAUNCH:".length);
  const bridgeToken = process.env.SYNTHETIC_BRIDGE_TOKEN;
  if (launchToken.length === 0 || bridgeToken.length === 0) return;
  emit("STAGE:claim");
  emit("STAGE:ready");
  emit("STAGE:start");
  emit('VERIFIED_CREATIVE_INPUT:{"promptLine":"One synthetic line"}');
  emit('VERIFIED_OUTPUT_RULE:{"mediaType":"application/json","maxUtf8Bytes":64}');

  const candidate = await take("candidate");
  if (candidate === null) return;
  if (!candidate.startsWith("CANDIDATE:")) {
    emit("TERMINAL_INVALID_CANDIDATE");
    input.close();
    return;
  }
  emit("STAGE:result");
  emit("RECEIPT:synthetic-accepted");
  input.close();
})().catch((error) => {
  emit("TERMINAL_WORKER_ERROR:" + error.name);
  process.exitCode = 2;
});
`;

const PTY_WORKER_SOURCE = String.raw`
const { spawnSync } = require("node:child_process");
const readline = require("node:readline");
const stty = spawnSync("stty", ["-echo", "-echonl"], {
  stdio: ["inherit", "ignore", "ignore"],
});
if (stty.status !== 0) process.exit(3);
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const lines = input[Symbol.asyncIterator]();
const emit = (value) => process.stdout.write(value + "\n");
const take = async () => {
  const item = await lines.next();
  if (item.done) process.exit(2);
  return item.value;
};
(async () => {
  emit("ECHO_READY");
  const nonce = await take();
  if (nonce !== "NONCE:${PTY_SENTINEL}") process.exit(4);
  emit("ECHO_OK");
  if (await take() !== "LAUNCH:${PTY_LAUNCH_TOKEN}") process.exit(5);
  emit("FINAL_WORKER_ACCEPTED_LAUNCH");
  input.close();
})().catch(() => process.exit(6));
`;

// Fake-only reproduction of the Codex-48 failure mode. The parent proves
// no-echo, then replaces itself with an interactive zsh; its later prompt
// redraw/echo exposes write_stdin data.
const PTY_TRANSITION_SOURCE = String.raw`
stty -echo -echonl || exit 3
printf 'ECHO_READY\n'
IFS= read -r nonce || exit 2
[ "$nonce" = 'NONCE:${PTY_SENTINEL}' ] || exit 4
printf 'ECHO_OK\n'
IFS= read -r proceed || exit 2
[ "$proceed" = 'PROCEED' ] || exit 5
printf 'UNSAFE_REPLACEMENT\n'
exec zsh -f
`;

const PTY_RELAY_SOURCE = String.raw`
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
            break
        os.write(master, data)
_, status = os.waitpid(pid, 0)
if os.WIFEXITED(status):
    raise SystemExit(os.WEXITSTATUS(status))
raise SystemExit(128 + os.WTERMSIG(status))
`;

type SyntheticWorker = {
  child: ChildProcessWithoutNullStreams;
  lines: string[];
  stderr: string[];
  write: (value: string) => void;
  closeInput: () => void;
  waitFor: (value: string) => Promise<void>;
  waitForContains: (value: string) => Promise<void>;
  exited: Promise<{ code: number | null; signal: string | null }>;
  cleanup: () => Promise<void>;
};

const startWorker = (available = true): SyntheticWorker => {
  const child = spawn(process.execPath, ["-e", WORKER_SOURCE], {
    env: {
      PATH: process.env.PATH,
      SYNTHETIC_CONTINUATION_AVAILABLE: available ? "1" : "0",
      SYNTHETIC_BRIDGE_TOKEN: BRIDGE_TOKEN,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines: string[] = [];
  const stderr: string[] = [];
  const waiters = new Set<() => void>();
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => {
    lines.push(line);
    for (const wake of waiters) wake();
  });
  createInterface({ input: child.stderr, crlfDelay: Infinity }).on("line", (line) => {
    stderr.push(line);
    for (const wake of waiters) wake();
  });
  let settled = false;
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  void exited.finally(() => {
    settled = true;
  });
  const waitFor = async (value: string) => {
    const deadline = Date.now() + 5_000;
    while (!lines.includes(value)) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for ${value}. stdout=${JSON.stringify(lines)} stderr=${JSON.stringify(stderr)}`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          waiters.delete(wake);
          resolve();
        }, 25);
        const wake = () => {
          clearTimeout(timer);
          waiters.delete(wake);
          resolve();
        };
        waiters.add(wake);
      });
    }
  };
  const waitForContains = async (value: string) => {
    const deadline = Date.now() + 5_000;
    while (![...lines, ...stderr].some((line) => line.includes(value))) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for text ${value}. stdout=${JSON.stringify(lines)} stderr=${JSON.stringify(stderr)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  return {
    child,
    lines,
    stderr,
    write: (value) => child.stdin.write(`${value}\n`),
    closeInput: () => child.stdin.end(),
    waitFor,
    waitForContains,
    exited,
    cleanup: async () => {
      if (!settled) child.kill("SIGKILL");
      await exited;
    },
  };
};

const startPtyProcess = (command: string, args: string[]): SyntheticWorker => {
  const child = spawn("python3", [
    "-c",
    PTY_RELAY_SOURCE,
    command,
    ...args,
  ], {
    env: { PATH: process.env.PATH },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines: string[] = [];
  const stderr: string[] = [];
  const waiters = new Set<() => void>();
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => {
    lines.push(line.replace(/\r$/, ""));
    for (const wake of waiters) wake();
  });
  createInterface({ input: child.stderr, crlfDelay: Infinity }).on("line", (line) => {
    stderr.push(line.replace(/\r$/, ""));
    for (const wake of waiters) wake();
  });
  let settled = false;
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  void exited.finally(() => {
    settled = true;
  });
  const waitFor = async (value: string) => {
    const deadline = Date.now() + 5_000;
    while (!lines.includes(value)) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for ${value}. stdout=${JSON.stringify(lines)} stderr=${JSON.stringify(stderr)}`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          waiters.delete(wake);
          resolve();
        }, 25);
        const wake = () => {
          clearTimeout(timer);
          waiters.delete(wake);
          resolve();
        };
        waiters.add(wake);
      });
    }
  };
  const waitForContains = async (value: string) => {
    const deadline = Date.now() + 5_000;
    while (![...lines, ...stderr].some((line) => line.includes(value))) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for text ${value}. stdout=${JSON.stringify(lines)} stderr=${JSON.stringify(stderr)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  return {
    child,
    lines,
    stderr,
    write: (value) => child.stdin.write(`${value}\n`),
    closeInput: () => child.stdin.end(),
    waitFor,
    waitForContains,
    exited,
    cleanup: async () => {
      if (!settled) child.kill("SIGKILL");
      await exited;
    },
  };
};

const startPtyWorker = () =>
  startPtyProcess(process.execPath, ["-e", PTY_WORKER_SOURCE]);

const startLeakyTransitionWorker = () =>
  startPtyProcess("zsh", ["-c", PTY_TRANSITION_SOURCE]);

const assertPrivateDiagnostics = (worker: SyntheticWorker) => {
  const diagnostics = [...worker.lines, ...worker.stderr].join("\n");
  assert.doesNotMatch(diagnostics, new RegExp(LAUNCH_TOKEN));
  assert.doesNotMatch(diagnostics, new RegExp(BRIDGE_TOKEN));
};

type FakeFailure = {
  operation: "preflight" | "claim" | "ready" | "start" | "result";
  dispatched: boolean;
  exactEndpoint?: boolean;
  status?: number;
  parsed?: boolean;
  protocolEnvelope?: boolean;
  code?: string;
};

const KNOWN_NO_COMMIT_CODES = new Set([
  "PROTOCOL_UNSUPPORTED",
  "TOKEN_INVALID",
  "RUN_EXPIRED",
  "RUN_ALREADY_CLAIMED",
]);

const diagnoseFakeFailure = (failure: FakeFailure) => {
  if (!failure.dispatched) {
    return { stage: failure.operation, certainty: "N", marker: "THOUGHT_STOP", className: "permission" };
  }
  const className = !failure.status
    ? "transport"
    : !failure.parsed
      ? "parse"
      : !failure.protocolEnvelope
        ? "schema"
        : "http";
  const verifiedNoCommit = Boolean(
    failure.exactEndpoint &&
    failure.status &&
    failure.status >= 400 &&
    failure.status < 500 &&
    failure.parsed &&
    failure.protocolEnvelope &&
    failure.code &&
    KNOWN_NO_COMMIT_CODES.has(failure.code),
  );
  return {
    stage: failure.operation,
    certainty: verifiedNoCommit ? "R" : "U",
    marker: verifiedNoCommit ? "THOUGHT_STOP" : "THOUGHT_UNCERTAIN",
    className,
  };
};

test("synthetic private continuation completes prompt-to-answer in one live worker", async (context) => {
  const worker = startWorker();
  context.after(() => worker.cleanup());
  await worker.waitFor("THOUGHT_CONTINUATION_READY");
  assert.equal(worker.lines.includes("STAGE:claim"), false);
  worker.write("NONCE:synthetic");
  await worker.waitFor("THOUGHT_CONTINUATION_OK");
  assert.equal(worker.lines.includes("STAGE:claim"), false);
  worker.write(`LAUNCH:${LAUNCH_TOKEN}`);
  await worker.waitFor("VERIFIED_CREATIVE_INPUT:{\"promptLine\":\"One synthetic line\"}");
  worker.write("CANDIDATE:{\"agentLine\":\"One.\"}");
  await worker.waitFor("RECEIPT:synthetic-accepted");
  const outcome = await worker.exited;
  assert.equal(outcome.code, 0);
  assert.deepEqual(
    worker.lines.filter((line) => line.startsWith("STAGE:")),
    ["STAGE:claim", "STAGE:ready", "STAGE:start", "STAGE:result"],
  );
  assertPrivateDiagnostics(worker);
});

test("final synthetic PTY worker accepts fake nonce then fake credential without echo", async (context) => {
  const worker = startPtyWorker();
  context.after(() => worker.cleanup());
  await worker.waitFor("ECHO_READY");
  worker.write(`NONCE:${PTY_SENTINEL}`);
  await worker.waitFor("ECHO_OK");
  assert.doesNotMatch([...worker.lines, ...worker.stderr].join("\n"), new RegExp(PTY_SENTINEL));
  worker.write(`LAUNCH:${PTY_LAUNCH_TOKEN}`);
  await worker.waitFor("FINAL_WORKER_ACCEPTED_LAUNCH");
  const outcome = await worker.exited;
  assert.equal(outcome.code, 0);
  const output = [...worker.lines, ...worker.stderr].join("\n");
  assert.doesNotMatch(output, new RegExp(PTY_LAUNCH_TOKEN));
});

test("fake oracle detects the observed no-echo to interactive-shell transition leak", async (context) => {
  const worker = startLeakyTransitionWorker();
  context.after(() => worker.cleanup());
  await worker.waitFor("ECHO_READY");
  worker.write(`NONCE:${PTY_SENTINEL}`);
  await worker.waitFor("ECHO_OK");
  assert.doesNotMatch([...worker.lines, ...worker.stderr].join("\n"), new RegExp(PTY_SENTINEL));
  worker.write("PROCEED");
  await worker.waitFor("UNSAFE_REPLACEMENT");
  worker.write(`: '${PTY_TRANSITION_SECRET}'`);
  await worker.waitForContains(PTY_TRANSITION_SECRET);
  worker.write("exit");
  const outcome = await worker.exited;
  assert.equal(outcome.code, 0);
});

test("fake diagnostics do not trust JSON, unknown codes, or 5xx as no-commit", () => {
  assert.deepEqual(
    diagnoseFakeFailure({ operation: "preflight", dispatched: false }),
    { stage: "preflight", certainty: "N", marker: "THOUGHT_STOP", className: "permission" },
  );
  const uncertainCases: FakeFailure[] = [
    { operation: "claim", dispatched: true },
    { operation: "ready", dispatched: true, exactEndpoint: true, status: 502, parsed: false },
    { operation: "start", dispatched: true, exactEndpoint: true, status: 400, parsed: true, protocolEnvelope: false },
    { operation: "result", dispatched: true, exactEndpoint: true, status: 503, parsed: true, protocolEnvelope: true, code: "RUN_EXPIRED" },
    { operation: "claim", dispatched: true, exactEndpoint: true, status: 409, parsed: true, protocolEnvelope: true, code: "SERVER_UNAVAILABLE" },
    { operation: "ready", dispatched: true, exactEndpoint: true, status: 200, parsed: true, protocolEnvelope: true, code: "RUN_EXPIRED" },
    { operation: "start", dispatched: true, exactEndpoint: true, status: 302, parsed: true, protocolEnvelope: true, code: "RUN_EXPIRED" },
    { operation: "result", dispatched: true, exactEndpoint: false, status: 409, parsed: true, protocolEnvelope: true, code: "RUN_EXPIRED" },
  ];
  for (const failure of uncertainCases) {
    const diagnostic = diagnoseFakeFailure(failure);
    assert.equal(diagnostic.stage, failure.operation);
    assert.equal(diagnostic.certainty, "U");
    assert.equal(diagnostic.marker, "THOUGHT_UNCERTAIN");
  }
  assert.equal(diagnoseFakeFailure(uncertainCases[0]!).className, "transport");
  assert.equal(diagnoseFakeFailure(uncertainCases[1]!).className, "parse");
  assert.equal(diagnoseFakeFailure(uncertainCases[2]!).className, "schema");
  assert.equal(diagnoseFakeFailure(uncertainCases[3]!).className, "http");
  assert.deepEqual(
    diagnoseFakeFailure({ operation: "claim", dispatched: true, exactEndpoint: true, status: 409, parsed: true, protocolEnvelope: true, code: "RUN_ALREADY_CLAIMED" }),
    { stage: "claim", certainty: "R", marker: "THOUGHT_STOP", className: "http" },
  );
});

test("Codex handoff binds composition to verified post-start input", () => {
  const runUrl = `https://preview.inshell.art/api/thought-agent/v2/runs/tar_${"p".repeat(24)}`;
  const task = buildThoughtCodexTask({
    product: "ChatGPT",
    runId: `tar_${"p".repeat(24)}`,
    runUrl,
    launchToken: "q".repeat(43),
    bootstrap: codexBootstrapFor(runUrl),
  });
  assert.match(task, /Wait for `OK:start` and `THOUGHT_INPUT_READY`/);
  assert.match(task, /Only then compose from displayed verified input/);
  assert.match(task, /the exact `THOUGHT_END` line/);
  assert.match(task, /No CR\/extra line\/JSON\/trim\/repair\/retry\/replacement/);
  assert.doesNotMatch(task, /precomputed agentLine|hardcoded agentLine/i);
});

test("synthetic closed input is terminal before claim", async (context) => {
  const worker = startWorker();
  context.after(() => worker.cleanup());
  await worker.waitFor("THOUGHT_CONTINUATION_READY");
  worker.closeInput();
  await worker.waitFor("TERMINAL_INPUT_CLOSED:nonce");
  const outcome = await worker.exited;
  assert.equal(outcome.code, 2);
  assert.equal(worker.lines.some((line) => line.startsWith("STAGE:claim")), false);
  assertPrivateDiagnostics(worker);
});

test("synthetic unavailable continuation fails closed before claim", async (context) => {
  const worker = startWorker(false);
  context.after(() => worker.cleanup());
  await worker.waitFor("THOUGHT_CONTINUATION_UNAVAILABLE");
  const outcome = await worker.exited;
  assert.equal(outcome.code, 0);
  assert.equal(worker.lines.some((line) => line.startsWith("STAGE:claim")), false);
  assertPrivateDiagnostics(worker);
});

test("synthetic EOF after creative input is terminal without a result", async (context) => {
  const worker = startWorker();
  context.after(() => worker.cleanup());
  await worker.waitFor("THOUGHT_CONTINUATION_READY");
  worker.write("NONCE:synthetic");
  await worker.waitFor("THOUGHT_CONTINUATION_OK");
  worker.write(`LAUNCH:${LAUNCH_TOKEN}`);
  await worker.waitFor("VERIFIED_CREATIVE_INPUT:{\"promptLine\":\"One synthetic line\"}");
  worker.closeInput();
  await worker.waitFor("TERMINAL_INPUT_CLOSED:candidate");
  const outcome = await worker.exited;
  assert.equal(outcome.code, 2);
  assert.equal(worker.lines.filter((line) => line === "STAGE:claim").length, 1);
  assert.equal(worker.lines.includes("STAGE:result"), false);
  assertPrivateDiagnostics(worker);
});

test("synthetic child loss after claim cannot replay or return", async (context) => {
  const worker = startWorker();
  context.after(() => worker.cleanup());
  await worker.waitFor("THOUGHT_CONTINUATION_READY");
  worker.write("NONCE:synthetic");
  await worker.waitFor("THOUGHT_CONTINUATION_OK");
  worker.write(`LAUNCH:${LAUNCH_TOKEN}`);
  await worker.waitFor("VERIFIED_CREATIVE_INPUT:{\"promptLine\":\"One synthetic line\"}");
  worker.child.kill("SIGKILL");
  const outcome = await worker.exited;
  assert.equal(outcome.signal, "SIGKILL");
  assert.equal(worker.lines.filter((line) => line === "STAGE:claim").length, 1);
  assert.equal(worker.lines.includes("STAGE:result"), false);
  assert.equal(worker.lines.some((line) => line.includes("ready-replay")), false);
  assertPrivateDiagnostics(worker);
});

test("Codex keeps its executable continuation boundary without inventing one for Claude", () => {
  const input = {
    runId: `tar_${"r".repeat(24)}`,
    runUrl: `https://staging.inshell-art.pages.dev/api/thought-agent/v2/runs/tar_${"r".repeat(24)}`,
    launchToken: "s".repeat(43),
  };
  const claude = buildThoughtClaudeTask({ ...input, product: "Claude", surface: "code" });
  for (const networkAuthorization of ["managed", "preauthorized"] as const) {
    for (const declarationLabelField of ["label", "agentLabel"] as const) {
      const codex = buildThoughtCodexTask({
        ...input,
        product: "ChatGPT",
        bootstrap: codexBootstrapFor(input.runUrl),
        networkAuthorization,
        resultContract: { declarationLabelField },
      });
      assert.ok(
        Buffer.byteLength(codex) <= 7_000,
        `Codex ${networkAuthorization}/${declarationLabelField} handoff is ${Buffer.byteLength(codex)} bytes`,
      );
      assert.match(codex, /exec_command\(tty:true\)/);
      assert.match(codex, /request one origin\/network escalation on that first call/);
      assert.match(codex, /reconstruct\/edit\/save\/install\/fallback\/manual HTTP/);
      assert.match(codex, /nonce must be absent onscreen/);
      assert.match(codex, /`OK:preflight` and `CREDENTIAL_READY`/);
      assert.match(codex, /Wait for `OK:start` and `THOUGHT_INPUT_READY`/);
      assert.match(codex, /the exact `THOUGHT_END` line/);
      assert.match(codex, /unproven 429=U/);
      assert.doesNotMatch(codex, /precomputed agentLine|hardcoded agentLine/i);
    }
  }
  assert.ok(Buffer.byteLength(claude) <= 14_000, `Claude handoff is ${Buffer.byteLength(claude)} bytes`);
  assert.equal(claude.split(THOUGHT_HANDOFF_OPERATION_DIAGNOSTICS).length - 1, 1);
  for (const line of THOUGHT_HANDOFF_OPERATION_RECOVERY) {
    assert.equal(claude.split(line).length - 1, 1);
  }
  assert.doesNotMatch(claude, /PRIVATE_CONTINUATION|THOUGHT_CONTINUATION_READY|THOUGHT_CONTINUATION_OK|send PROCEED/);
  assert.doesNotMatch(claude, /run_in_background|TaskOutput|mkfifo|mode-600|mode-700/i);
});
