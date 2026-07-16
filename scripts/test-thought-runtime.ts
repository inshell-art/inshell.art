import assert from "node:assert/strict";

import {
  buildThoughtRunPayload,
  buildThoughtRuntimePrompt,
  toAnthropicMessagesPayload,
  toOpenAIResponsesPayload,
  toOpenRouterChatPayload,
  type ThoughtRunProvider,
  type ThoughtRunRoute,
  type ThoughtRunSpec,
} from "../apps/thought/src/thought-run-payload";
import {
  THOUGHT_V2_PROTOCOL_RELEASE,
  measureThoughtLine,
} from "../packages/thought-agent-protocol/src/index";
import {
  normalizePreviewMode,
  prevalidateThoughtCandidate,
  previewUnavailableCliLines,
} from "../apps/thought/src/thought-preview-policy";
import { createThoughtPollWakeScheduler } from "../apps/thought/src/thought-poll-wake";
import {
  getThoughtWorkReadyPresentation,
  THOUGHT_PANEL_MINT_UI_MODE,
  THOUGHT_V2_MINT_UNAVAILABLE_COPY,
} from "../apps/thought/src/thought-mint-ui";
import { buildThoughtConsoleLines } from "../apps/thought/src/thought-console";
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
  id: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
  ref: THOUGHT_V2_PROTOCOL_RELEASE.spec.ref,
  hash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,
  text: THOUGHT_V2_PROTOCOL_RELEASE.spec.text,
};

assert.equal(
  THOUGHT_PANEL_MINT_UI_MODE,
  "dock",
  "THOUGHT panel mint controls must stay inline instead of opening the legacy sheet",
);

assert.deepEqual(
  getThoughtWorkReadyPresentation({ mintEnabled: false, walletConnected: true }),
  {
    canMint: false,
    detail: THOUGHT_V2_MINT_UNAVAILABLE_COPY,
  },
  "work-ready UI must not offer mint or request a wallet while V2 minting is disabled",
);

assert.deepEqual(
  getThoughtWorkReadyPresentation({ mintEnabled: true, walletConnected: true }),
  {
    canMint: true,
    detail: "ready to mint",
  },
  "work-ready UI must recognize an already connected wallet",
);

assert.deepEqual(
  getThoughtWorkReadyPresentation({ mintEnabled: true, walletConnected: false }),
  {
    canMint: true,
    detail: "connect wallet to mint",
  },
  "work-ready UI may request a wallet only when minting is enabled and none is connected",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "21:50:02",
    title: "mint error",
    detail: THOUGHT_V2_MINT_UNAVAILABLE_COPY,
    actions: ["retry", "reset"],
  }),
  [
    "[21:50:02] mint error",
    THOUGHT_V2_MINT_UNAVAILABLE_COPY,
    "next: retry / reset",
  ],
  "console must reduce mint failures to status, useful detail, and next actions",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "09:10:11",
    title: "work ready",
    detail: "connect wallet to mint",
    actions: ["mint", "reset"],
  }),
  [
    "[09:10:11] work ready",
    "connect wallet to mint",
    "next: mint / reset",
  ],
  "console must keep work-ready guidance concise",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "09:10:12",
    title: "checking THOUGHT",
    detail: "checking uniqueness and mint state",
  }),
  [
    "[09:10:12] checking THOUGHT",
    "checking uniqueness and mint state",
  ],
  "console must omit an empty next-actions line",
);

assert.deepEqual(
  buildThoughtConsoleLines({
    time: "09:10:13",
    title: "minted",
    detail: "Minted",
  }),
  ["[09:10:13] minted"],
  "console must not repeat a detail that matches its title",
);

assert.equal(
  buildThoughtRuntimePrompt("make it quiet"),
  "make it quiet",
  "provider user content must remain byte-identical to promptLine",
);

const pollWakeScheduler = createThoughtPollWakeScheduler();
let pollWaitResolved = false;
let immediatePollCount = 0;
const immediatePoll = () => {
  immediatePollCount += 1;
};
pollWakeScheduler.setImmediatePoll(immediatePoll);
const pollWait = pollWakeScheduler.wait(60_000).then(() => {
  pollWaitResolved = true;
});
pollWakeScheduler.pollNow();
assert.equal(immediatePollCount, 1, "foreground refresh must issue an independent status poll");
pollWakeScheduler.wake();
await pollWait;
assert.equal(pollWaitResolved, true, "foreground wake must resume status polling immediately");
pollWakeScheduler.clearImmediatePoll(immediatePoll);
pollWakeScheduler.pollNow();
assert.equal(immediatePollCount, 1, "cleared foreground poll must not run again");
assert.equal(
  measureThoughtLine("A".repeat(THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes), "agent").errors.length,
  0,
);
assert(
  measureThoughtLine("A".repeat(THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes + 1), "agent").errors.some((error) =>
    error.includes("bytes"),
  ),
  "one byte beyond the advertised limit must fail V2 validation",
);
assert(
  measureThoughtLine("A".repeat(27), "agent").errors.length === 0,
  "renderer display-unit measurements must not reject a valid byte-length line",
);

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
    promptLine: "make it quiet",
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
  promptLine: "make it quiet",
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
  promptLine: "make it quiet",
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
  promptLine: "make it quiet",
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
  promptLine: "make it quiet",
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
});
assert.equal(THOUGHT_V2_ARTIFACT.artifactId, "thought-v2-stable-look-meaningful-boundaries-20260714T035935Z");
assert.equal(
  THOUGHT_V2_ARTIFACT.manifestSha256,
  "ac838251d86bea1a5e3c4340cb1a1f0aba9e2a663245e4489ef0fd2788ea48dd",
);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.canvas.defaultBg, "#000000");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.rendererId, THOUGHT_V2_PROTOCOL_RELEASE.identifiers.renderer);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.binaryBackground.side, 32);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.binaryBackground.capacity, 1024);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.agentLine.defaultTextColor, "#ffffff");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.promptLine.defaultTextColor, "#ffffff");
assert.equal(THOUGHT_V2_RENDER_CONTRACT.agentLine.defaultFontSize, 44);
assert.equal(THOUGHT_V2_RENDER_CONTRACT.promptLine.defaultFontSize, 16);
assert(thoughtV2Svg.includes('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960">'));
assert(thoughtV2Svg.includes('<rect id="canvas-bg" width="960" height="960" fill="#000000"/>'));
assert(thoughtV2Svg.includes('id="binary-background" opacity="1"'));
assert(thoughtV2Svg.includes('data-bit-capacity="1024"'));
assert(thoughtV2Svg.includes('data-pack="msb-first-128-bytes"'));
assert(thoughtV2Svg.includes('<clipPath id="agent-line-clip">'));
assert(thoughtV2Svg.includes('<clipPath id="prompt-line-clip">'));
assert(!thoughtV2Svg.includes('id="agent-line-bg"'));
assert(!thoughtV2Svg.includes('id="prompt-line-bg"'));
assert(thoughtV2Svg.includes('id="agent-line-text" x="480" y="410"'));
assert(thoughtV2Svg.includes('text-anchor="middle" dominant-baseline="middle"'));
assert(thoughtV2Svg.includes('font-size="44" fill="#ffffff"'));
assert(thoughtV2Svg.includes('id="prompt-line-text" x="480" y="844"'));
assert(thoughtV2Svg.includes('font-size="16" fill="#ffffff"'));
assert(thoughtV2Svg.includes("'Noto Sans Mono'"));
assert(!thoughtV2Svg.includes("&apos;Noto Sans Mono&apos;"));
assert(!thoughtV2Svg.includes("<animateTransform"));

const carouselThoughtV2Svg = buildThoughtV2Svg({
  agentLine: "A".repeat(27),
  promptLine: "P".repeat(64),
});
assert(carouselThoughtV2Svg.includes('<g id="agent-line-carousel">'));
assert(!carouselThoughtV2Svg.includes('<g id="prompt-line-carousel">'));
assert(carouselThoughtV2Svg.includes('id="agent-line-text" x="94"'));
assert(carouselThoughtV2Svg.includes('<animate attributeName="x"'));
assert(!carouselThoughtV2Svg.includes("textLength"));
assert(!carouselThoughtV2Svg.includes("<animateTransform"));

assert.deepEqual(measureThoughtV2Line("Bad prompt 你好", "prompt").errors, []);
assert.deepEqual(measureThoughtV2Line("bad Agent مرحبا", "agent").errors, []);
assert.deepEqual(measureThoughtV2Line("double  space", "prompt").errors, []);

console.log("[test-thought-runtime] OK");
