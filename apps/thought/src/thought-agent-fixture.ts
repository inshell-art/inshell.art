const LOCAL_AGENT_FIXTURE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export const shouldUseThoughtAgentFixture = (input: {
  dev: boolean;
  hostname: string;
  search: string;
}) => {
  if (!input.dev || !LOCAL_AGENT_FIXTURE_HOSTS.has(input.hostname.toLowerCase())) {
    return false;
  }

  return new URLSearchParams(input.search).get("agent") !== "live";
};

export const buildThoughtAgentFixtureLine = (
  adapterId: "codex" | "claude",
  nonce: string,
) => `fixture ${adapterId} ${nonce}`;
