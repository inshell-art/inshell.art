// Read-only shapes retained by the pinned detail/presentation source. These
// describe historical records, not executable transports or supported APIs.
export type ThoughtClaudeSurface = "cowork" | "code";
export type ThoughtCodexBootstrapBinding = {
  url: string;
  workerSha256: `sha256:${string}`;
  configSha256: `sha256:${string}`;
};
export type ThoughtCodexReleaseBinding = {
  protocolReleaseId: `0x${string}`;
  manifestKeccak256: `0x${string}`;
};
export type ThoughtCodexResultContractBinding = {
  workProfile: string;
  declarationLabelField?: "agentLabel" | "label";
  lineValidation?: "terminal-english-64";
};
