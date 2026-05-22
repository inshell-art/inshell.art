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
  isPreviewRpcEndpointCommand,
  maskRpcEndpoint,
  normalizePreviewMode,
  prevalidateThoughtCandidate,
} from "../apps/thought/src/thought-preview-policy";

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
assert.equal(normalizePreviewMode("bad"), "auto");
assert.equal(
  maskRpcEndpoint("https://user:pass@example.test/rpc?key=abc&safe=1"),
  "https://***@example.test/rpc?key=***&safe=1",
);
assert.equal(isPreviewRpcEndpointCommand("config rpc endpoint https://example.test"), true);
assert.equal(isPreviewRpcEndpointCommand("rpc endpoint https://example.test"), true);
assert.equal(isPreviewRpcEndpointCommand("rpc call eth_blockNumber"), false);

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
