import assert from "node:assert/strict";

import {
  buildThoughtRunPayload,
  toAnthropicMessagesPayload,
  toOpenAIResponsesPayload,
  toOpenRouterChatPayload,
  type ThoughtRunProvider,
  type ThoughtRunRoute,
  type ThoughtRunSpec,
} from "../apps/thought/src/thought-run-payload";
import {
  normalizePreviewMode,
  prevalidateThoughtCandidate,
  previewUnavailableCliLines,
} from "../apps/thought/src/thought-preview-policy";
import {
  JSON_RPC_NO_BATCH_OPTIONS,
  createSingleRequestJsonRpcProvider,
} from "../apps/thought/src/rpc-provider";
import { runThoughtShellAdapterTests } from "../apps/thought/src/surfaceShell/thoughtGoldenTranscripts.test";
import {
  createMemoryStorageAdapter,
  createSurfaceShell,
  parseSurfaceInput,
  redactSurfaceInput,
  shouldRecordSurfaceInput,
  type SurfaceRedactionRule,
} from "../packages/surface-shell-core/src";

const thoughtSpec: ThoughtRunSpec = {
  id: "THOUGHT.v1.md",
  ref: "repo:apps/thought/THOUGHT.md",
  hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  text: "Return one THOUGHT candidate only.",
};

const assertNoToolPayload = (label: string, payload: Record<string, unknown>) => {
  assert.equal(payload.tools, undefined, `${label} must not attach web-search tools`);
  assert.equal(payload.tool_choice, undefined, `${label} must not force tool choice`);
};

const cases: Array<{
  route: ThoughtRunRoute;
  provider: ThoughtRunProvider;
  model: string;
}> = [
  { route: "connect", provider: "openrouter", model: "openrouter/free" },
  { route: "direct", provider: "openrouter", model: "openrouter/free" },
  { route: "direct", provider: "openai", model: "gpt-5.4-mini" },
  { route: "direct", provider: "anthropic", model: "claude-sonnet-4.5" },
];

for (const item of cases) {
  const payload = buildThoughtRunPayload({
    ...item,
    prompt: "make it quiet",
    thoughtSpec,
  });

  assert.equal(
    payload.config.web.enabled,
    false,
    `${item.route}/${item.provider} must keep browser web search disabled`,
  );
  assert.equal(payload.config.web.tool, "unavailable");
}

const openRouterPayload = buildThoughtRunPayload({
  route: "connect",
  provider: "openrouter",
  model: "openrouter/free",
  prompt: "make it quiet",
  thoughtSpec,
});
assertNoToolPayload(
  "OpenRouter chat payload",
  toOpenRouterChatPayload(openRouterPayload) as Record<string, unknown>,
);

const openAiPayload = buildThoughtRunPayload({
  route: "direct",
  provider: "openai",
  model: "gpt-5.4-mini",
  prompt: "make it quiet",
  thoughtSpec,
});
assertNoToolPayload(
  "OpenAI responses payload",
  toOpenAIResponsesPayload(openAiPayload) as Record<string, unknown>,
);

const anthropicPayload = buildThoughtRunPayload({
  route: "direct",
  provider: "anthropic",
  model: "claude-sonnet-4.5",
  prompt: "make it quiet",
  thoughtSpec,
});
assertNoToolPayload(
  "Anthropic messages payload",
  toAnthropicMessagesPayload(anthropicPayload) as Record<string, unknown>,
);

assert.equal(normalizePreviewMode("wallet"), "wallet");
assert.equal(normalizePreviewMode("rpc"), "auto");
assert.equal(normalizePreviewMode("bad"), "auto");
const autoPreviewUnavailableLines = previewUnavailableCliLines("auto", "preview service unavailable.");
assert(autoPreviewUnavailableLines.includes("preview service unavailable or wallet not connected."));
assert(autoPreviewUnavailableLines.includes("use: preview retry"));
assert(autoPreviewUnavailableLines.includes("use: wallet connect"));
assert(
  !autoPreviewUnavailableLines.some((line) => line.includes("rpc")),
  "auto preview fallback must not ask normal visitors to configure RPC",
);
const walletPreviewUnavailableLines = previewUnavailableCliLines("wallet");
assert(walletPreviewUnavailableLines.includes("use: wallet connect"));
assert(walletPreviewUnavailableLines.includes("use: config preview auto"));
const offPreviewUnavailableLines = previewUnavailableCliLines("off");
assert(offPreviewUnavailableLines.includes("preview is off."));
assert(offPreviewUnavailableLines.includes("use: config preview auto"));
assert.equal(JSON_RPC_NO_BATCH_OPTIONS.batchMaxCount, 1);
assert.equal(
  createSingleRequestJsonRpcProvider("/api/thought-rpc")._getOption("batchMaxCount"),
  1,
);
assert.equal(
  createSingleRequestJsonRpcProvider("/api/thought-rpc", 11155111)._getOption("staticNetwork"),
  true,
);

const secretRules: SurfaceRedactionRule[] = [
  {
    id: "key",
    tokens: ["config", "direct", "key"],
    allowRestValues: ["clear", "help"],
  },
];
assert.deepEqual(parseSurfaceInput("  PATH   list  ", { mode: "command-first" }), {
  raw: "  PATH   list  ",
  trimmed: "PATH   list",
  mode: "command-first",
  isBlank: false,
  isCommand: true,
  isQuestion: false,
  commandToken: "PATH",
  commandKey: "path",
  rest: "list",
  args: ["list"],
  question: "",
});
assert.equal(
  redactSurfaceInput("config direct key sk-private", secretRules),
  "config direct key ********",
);
assert.equal(shouldRecordSurfaceInput("config direct key sk-private", secretRules), false);
assert.equal(shouldRecordSurfaceInput("config direct key clear", secretRules), true);
await runThoughtShellAdapterTests();

const storage = createMemoryStorageAdapter();
const shell = createSurfaceShell<{ value: string }>({
  mode: "question-first",
  commandPrefix: "/",
  storage,
  historyLimit: 2,
  transcriptLimit: 4,
  commands: [
    {
      id: "echo",
      run: ({ input, context }) => [`${context.value}:${input.rest}`],
    },
    {
      id: "slow",
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "done";
      },
    },
  ],
  redactionRules: secretRules,
});
assert.equal(shell.parse("hello").isQuestion, true);
assert.equal(shell.parse("/echo hi").commandKey, "echo");
await shell.dispatch("/echo hi", { value: "ok" });
const slowDispatch = shell.dispatch("/slow", { value: "ok" });
const blockedDispatch = await shell.dispatch("/echo blocked", { value: "ok" });
assert.equal(blockedDispatch.reason, "in_flight");
await slowDispatch;
assert.deepEqual(shell.getHistory(), ["/echo hi", "/slow"]);

const validCandidate = prevalidateThoughtCandidate("quiet green sky", {
  maxRawBytes: 512,
  maxTextBytes: 128,
});
assert.equal(validCandidate.ok, true);
assert.equal(validCandidate.canonical, "QUIET GREEN SKY");

for (const [label, raw, reasonCode] of [
  ["blank", "  ", 1],
  ["multi-line", "ONE\nTWO", 6],
  ["unsupported", "ONE!", 4],
] as const) {
  const result = prevalidateThoughtCandidate(raw, {
    maxRawBytes: 512,
    maxTextBytes: 128,
  });
  assert.equal(result.ok, false, `${label} candidate must be rejected before RPC`);
  assert.equal(result.ok ? 0 : result.reasonCode, reasonCode);
}

console.log("[test-thought-runtime] OK");
