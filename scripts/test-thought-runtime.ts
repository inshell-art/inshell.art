import assert from "node:assert/strict";
import { createHash } from "node:crypto";

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
  THOUGHT_V2_ARTIFACT,
  THOUGHT_V2_RENDER_CONTRACT,
  buildThoughtV2Svg,
  measureThoughtV2Line,
} from "../apps/thought/src/thought-v2-renderer";
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
  { route: "codex", provider: "codex", model: "codex" },
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

const codexPayload = buildThoughtRunPayload({
  route: "codex",
  provider: "codex",
  model: "codex",
  prompt: "make it quiet",
  thoughtSpec,
});
assert.equal(codexPayload.config.request.maxOutputTokens, null);
assert.equal(codexPayload.config.request.stop, null);
assert.equal(codexPayload.config.web.enabled, false);
assert.equal(codexPayload.config.web.tool, "unavailable");

assert.equal(normalizePreviewMode("wallet"), "wallet");
assert.equal(normalizePreviewMode("rpc"), "auto");
assert.equal(normalizePreviewMode("bad"), "auto");
const autoPreviewUnavailableLines = previewUnavailableCliLines("auto", "preview service unavailable.");
assert(autoPreviewUnavailableLines.includes("fix the reason above, then retry."));
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
  ["digits-only", "123", 1],
  ["raw-too-large", "A".repeat(513), 2],
] as const) {
  const result = prevalidateThoughtCandidate(raw, {
    maxRawBytes: 512,
    maxTextBytes: 128,
  });
  assert.equal(result.ok, false, `${label} candidate must be rejected before RPC`);
  assert.equal(result.ok ? 0 : result.reasonCode, reasonCode);
}

for (const [raw, canonical] of [
  ["ONE!", "ONE"],
  ["ONE\nTWO", "ONE TWO"],
  ["ONE-TWO", "ONE TWO"],
] as const) {
  const result = prevalidateThoughtCandidate(raw, {
    maxRawBytes: 512,
    maxTextBytes: 128,
  });
  assert.equal(result.ok, true, `${JSON.stringify(raw)} must canonicalize like ThoughtNFT.previewWork`);
  assert.equal(result.ok ? result.canonical : "", canonical);
}

const thoughtV2Svg = buildThoughtV2Svg({
  agentLine: "QUIET",
  promptLine: "soft question",
  lineBgPadding: 99,
});
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
assert.equal(THOUGHT_V2_ARTIFACT.artifactId, "thought-v2-thin-line-frames-20260703T024833Z");
assert.equal(
  THOUGHT_V2_ARTIFACT.manifestSha256,
  "c309e69e96e82f45b1b992933aa1e679ada29961599a8c7d7689b19816546b9e",
);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.canvas.defaultBg, "#000000");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.agentLine.defaultBgColor, "#ffffff");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.agentLine.defaultFrameColor, "#000000");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.agentLine.defaultTextColor, "#000000");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.promptLine.defaultTextColor, "#ffffff");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.agentLine.defaultFontSize, 44);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.promptLine.defaultFontSize, 16);
assert(thoughtV2Svg.includes('<rect id="canvas-bg" width="960" height="960" fill="#000000"/>'));
assert(thoughtV2Svg.includes('<clipPath id="agent-line-clip">'));
assert(thoughtV2Svg.includes('<clipPath id="prompt-line-clip">'));
assert(thoughtV2Svg.includes('<rect id="agent-line-bg" x="87" y="378" width="786" height="70" rx="0" fill="#ffffff" stroke="#000000" stroke-width="1"/>'));
assert(!thoughtV2Svg.includes("agent-line-tail"));
assert(thoughtV2Svg.includes('<rect id="prompt-line-bg" x="165" y="868" width="630" height="44" rx="0" fill="#000000" stroke="#ffffff" stroke-width="1"/>'));
assert(!thoughtV2Svg.includes("carousel"));
assert(thoughtV2Svg.includes('id="agent-line-text" x="480" y="413"'));
assert(thoughtV2Svg.includes('text-anchor="middle" dominant-baseline="middle"'));
assert(thoughtV2Svg.includes('font-size="44" fill="#000000"'));
assert(thoughtV2Svg.includes('id="prompt-line-text" x="480" y="890"'));
assert(thoughtV2Svg.includes('font-size="16" fill="#ffffff"'));
assert(thoughtV2Svg.includes("'Noto Sans Mono'"));
assert(!thoughtV2Svg.includes("&apos;Noto Sans Mono&apos;"));
assert(!thoughtV2Svg.includes("<animateTransform"));

const defaultThoughtV2Svg = buildThoughtV2Svg({
  agentLine: "quiet Agent مرحبا",
  promptLine: "Quiet signal 你好",
});
assert.equal(sha256(defaultThoughtV2Svg), THOUGHT_V2_ARTIFACT.files["samples/default.svg"]);

const carouselThoughtV2Svg = buildThoughtV2Svg({
  agentLine: "A".repeat(140),
  promptLine: "P".repeat(110),
});
assert(carouselThoughtV2Svg.includes('<g id="agent-line-carousel">'));
assert(carouselThoughtV2Svg.includes('id="agent-line-text" x="88"'));
assert(carouselThoughtV2Svg.includes('id="agent-line-text-copy"'));
assert(carouselThoughtV2Svg.includes('<animate attributeName="x"'));
assert(carouselThoughtV2Svg.includes('<g id="prompt-line-carousel">'));
assert(carouselThoughtV2Svg.includes('id="prompt-line-text" x="166"'));
assert(carouselThoughtV2Svg.includes('id="prompt-line-text-copy"'));
assert(carouselThoughtV2Svg.includes('repeatCount="indefinite"'));
assert(!carouselThoughtV2Svg.includes("textLength"));
assert(!carouselThoughtV2Svg.includes("<animateTransform"));

assert.deepEqual(measureThoughtV2Line("Bad prompt 你好", "prompt").errors, []);
assert.deepEqual(measureThoughtV2Line("bad Agent مرحبا", "agent").errors, []);
assert(measureThoughtV2Line("double  space", "prompt").errors.includes("prompt line has invalid spacing"));

console.log("[test-thought-runtime] OK");
