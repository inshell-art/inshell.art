import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  buildThoughtClaudeTask,
  buildThoughtCodexTask,
} from "../packages/thought-agent-protocol/src/index";

const LAUNCH_TOKEN = "synthetic-launch-token-never-print";
const BRIDGE_TOKEN = "synthetic-bridge-token-never-print";

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
  if (!process.env.SYNTHETIC_LAUNCH_TOKEN || !process.env.SYNTHETIC_BRIDGE_TOKEN) {
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
  const proceed = await take("proceed");
  if (proceed === null) return;
  if (proceed !== "PROCEED") {
    emit("PRECLAIM_ABORT:no_proceed");
    input.close();
    return;
  }

  // Tokens remain process-private. Only stage markers and validated creative
  // fields cross stdout.
  const launchToken = process.env.SYNTHETIC_LAUNCH_TOKEN;
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

type SyntheticWorker = {
  child: ChildProcessWithoutNullStreams;
  lines: string[];
  stderr: string[];
  write: (value: string) => void;
  closeInput: () => void;
  waitFor: (value: string) => Promise<void>;
  exited: Promise<{ code: number | null; signal: string | null }>;
  cleanup: () => Promise<void>;
};

const startWorker = (available = true): SyntheticWorker => {
  const child = spawn(process.execPath, ["-e", WORKER_SOURCE], {
    env: {
      PATH: process.env.PATH,
      SYNTHETIC_CONTINUATION_AVAILABLE: available ? "1" : "0",
      SYNTHETIC_LAUNCH_TOKEN: LAUNCH_TOKEN,
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
  return {
    child,
    lines,
    stderr,
    write: (value) => child.stdin.write(`${value}\n`),
    closeInput: () => child.stdin.end(),
    waitFor,
    exited,
    cleanup: async () => {
      if (!settled) child.kill("SIGKILL");
      await exited;
    },
  };
};

const assertPrivateDiagnostics = (worker: SyntheticWorker) => {
  const diagnostics = [...worker.lines, ...worker.stderr].join("\n");
  assert.doesNotMatch(diagnostics, new RegExp(LAUNCH_TOKEN));
  assert.doesNotMatch(diagnostics, new RegExp(BRIDGE_TOKEN));
};

test("synthetic private continuation completes prompt-to-answer in one live worker", async (context) => {
  const worker = startWorker();
  context.after(() => worker.cleanup());
  await worker.waitFor("THOUGHT_CONTINUATION_READY");
  assert.equal(worker.lines.includes("STAGE:claim"), false);
  worker.write("NONCE:synthetic");
  await worker.waitFor("THOUGHT_CONTINUATION_OK");
  assert.equal(worker.lines.includes("STAGE:claim"), false);
  worker.write("PROCEED");
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
  worker.write("PROCEED");
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
  worker.write("PROCEED");
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
        networkAuthorization,
        resultContract: { declarationLabelField },
      });
      assert.ok(
        Buffer.byteLength(codex) <= 7_000,
        `Codex ${networkAuthorization}/${declarationLabelField} handoff is ${Buffer.byteLength(codex)} bytes`,
      );
      assert.match(codex, /exec_command\(tty:true\)=>live session_id/);
      assert.match(codex, /write PROCEED; then claim/);
    }
  }
  assert.ok(Buffer.byteLength(claude) <= 14_000, `Claude handoff is ${Buffer.byteLength(claude)} bytes`);
  assert.doesNotMatch(claude, /PRIVATE_CONTINUATION|THOUGHT_CONTINUATION_READY|THOUGHT_CONTINUATION_OK|send PROCEED/);
  assert.doesNotMatch(claude, /run_in_background|TaskOutput|mkfifo|mode-600|mode-700/i);
});
