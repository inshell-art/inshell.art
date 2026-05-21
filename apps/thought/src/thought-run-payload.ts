export type ThoughtRunRoute = "connect" | "direct" | "local" | "my-brain";

export type ThoughtRunProvider = "openrouter" | "openai" | "anthropic" | "ollama" | "me";

export type ThoughtMaxOutputTokens = 48 | 32 | null;

export type ThoughtRunProvenanceRequestConfig = {
  maxOutputTokens: "48" | "32" | "none";
  stop: "\\n" | "none";
};

export type ThoughtRunWebConfig = {
  enabled: boolean;
  tool: string;
};

export type ThoughtRunSpec = {
  id: string;
  ref: string;
  hash: string;
  text: string;
};

export type ThoughtRunPayload = {
  config: {
    route: ThoughtRunRoute;
    provider: ThoughtRunProvider;
    model: string;
    request: {
      maxOutputTokens: ThoughtMaxOutputTokens;
      stop: "\n" | null;
    };
    web: ThoughtRunWebConfig;
  };
  input: {
    thoughtSpec: ThoughtRunSpec;
    prompt: string;
  };
  outputContract: {
    oneRoundOnly: true;
    normalize: true;
    validate: true;
  };
};

export const THOUGHT_MAX_OUTPUT_TOKENS = 48 as const;
export const THOUGHT_LOCAL_MAX_OUTPUT_TOKENS = 32 as const;

export const supportsProviderWebSearch = (_provider: ThoughtRunProvider) => false;

export const thoughtRunWebConfig = (input: {
  route: ThoughtRunRoute;
  provider: ThoughtRunProvider;
}): ThoughtRunWebConfig => {
  const enabled = input.route !== "local" && supportsProviderWebSearch(input.provider);
  return {
    enabled,
    tool: enabled
      ? input.provider === "openrouter"
        ? "openrouter:web_search"
        : `${input.provider}:web_search`
      : "unavailable",
  };
};

export const thoughtRunRequestConfig = (route: ThoughtRunRoute): {
  maxOutputTokens: ThoughtMaxOutputTokens;
  stop: "\n" | null;
} => {
  if (route === "my-brain") {
    return {
      maxOutputTokens: null,
      stop: null,
    };
  }

  return {
    maxOutputTokens: route === "local" ? THOUGHT_LOCAL_MAX_OUTPUT_TOKENS : THOUGHT_MAX_OUTPUT_TOKENS,
    stop: "\n" as const,
  };
};

export const buildThoughtRunPayload = (input: {
  route: ThoughtRunRoute;
  provider: ThoughtRunProvider;
  model: string;
  prompt: string;
  thoughtSpec: ThoughtRunSpec;
}): ThoughtRunPayload => {
  return {
    config: {
      route: input.route,
      provider: input.provider,
      model: input.model,
      request: thoughtRunRequestConfig(input.route),
      web: thoughtRunWebConfig(input),
    },
    input: {
      thoughtSpec: input.thoughtSpec,
      prompt: input.prompt,
    },
    outputContract: {
      oneRoundOnly: true,
      normalize: true,
      validate: true,
    },
  };
};

export const thoughtRunSpecAnchor = (payload: ThoughtRunPayload) => {
  const { id, ref, hash } = payload.input.thoughtSpec;
  return { id, ref, hash };
};

export const thoughtRunProvenanceConfig = (payload: ThoughtRunPayload) => ({
  route: payload.config.route,
  provider: payload.config.provider,
  model: payload.config.model,
  request: {
    maxOutputTokens: payload.config.request.maxOutputTokens === null
      ? "none" as const
      : payload.config.request.maxOutputTokens === THOUGHT_LOCAL_MAX_OUTPUT_TOKENS
        ? "32" as const
        : "48" as const,
    stop: payload.config.request.stop === "\n" ? "\\n" as const : "none" as const,
  },
  web: payload.config.web,
  thoughtSpec: thoughtRunSpecAnchor(payload),
});

export const buildThoughtRuntimePrompt = (prompt: string) => [
  "Return one THOUGHT candidate only.",
  "",
  "Hard output rules:",
  "- one line only",
  "- 128 characters max after normalization",
  "- letters and spaces only",
  "- no punctuation",
  "- no markdown",
  "- no explanation",
  "- no alternatives",
  "",
  "Prompt:",
  prompt,
].join("\n");

export const toOpenRouterChatPayload = (payload: ThoughtRunPayload) => ({
  model: payload.config.model,
  messages: [
    { role: "system", content: payload.input.thoughtSpec.text },
    { role: "user", content: buildThoughtRuntimePrompt(payload.input.prompt) },
  ],
  ...(payload.config.request.maxOutputTokens === null
    ? {}
    : { max_tokens: payload.config.request.maxOutputTokens }),
  ...(payload.config.request.stop
    ? { stop: [payload.config.request.stop] }
    : {}),
  ...(payload.config.web.enabled
    ? { tools: [{ type: "openrouter:web_search" }] }
    : {}),
});

export const toOpenAIResponsesPayload = (payload: ThoughtRunPayload) => ({
  model: payload.config.model,
  instructions: payload.input.thoughtSpec.text,
  input: [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: buildThoughtRuntimePrompt(payload.input.prompt),
        },
      ],
    },
  ],
  ...(payload.config.request.maxOutputTokens === null
    ? {}
    : { max_output_tokens: payload.config.request.maxOutputTokens }),
  store: false,
  // Responses API browser payload currently relies on the hard-output wrapper for newline stopping.
  ...(payload.config.web.enabled
    ? { tools: [{ type: "web_search" }], tool_choice: "auto" }
    : {}),
});

export const toAnthropicMessagesPayload = (payload: ThoughtRunPayload) => ({
  model: payload.config.model,
  system: payload.input.thoughtSpec.text,
  ...(payload.config.request.maxOutputTokens === null
    ? {}
    : { max_tokens: payload.config.request.maxOutputTokens }),
  messages: [{ role: "user", content: buildThoughtRuntimePrompt(payload.input.prompt) }],
  ...(payload.config.request.stop
    ? { stop_sequences: [payload.config.request.stop] }
    : {}),
  ...(payload.config.web.enabled
    ? {
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
          },
        ],
      }
    : {}),
});

export const toOllamaGeneratePayload = (payload: ThoughtRunPayload) => ({
  model: payload.config.model.replace(/^ollama:/, "").trim(),
  system: payload.input.thoughtSpec.text,
  prompt: buildThoughtRuntimePrompt(payload.input.prompt),
  stream: false,
  options: {
    ...(payload.config.request.maxOutputTokens === null
      ? {}
      : { num_predict: payload.config.request.maxOutputTokens }),
    ...(payload.config.request.stop
      ? { stop: [payload.config.request.stop] }
      : {}),
  },
});
