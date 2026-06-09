export type ThoughtShellRoute = "connect" | "direct" | "local" | "my-brain";

export type ThoughtShellState = {
  prompt: string;
  route: ThoughtShellRoute;
  routeConfigured: boolean;
  provider: string;
  model: string;
  apiKeyConfigured: boolean;
  localEndpoint: string;
  localAvailable: boolean | null;
  openRouterLinked: boolean;
  previewMode: string;
  previewProvider: string;
  walletConnected: boolean;
  walletChainReady: boolean;
  pathSelected: boolean;
  pathAuthorized: boolean;
  candidateReady: boolean;
  workReady: boolean;
  myBrainWaiting: boolean;
};

export const defaultThoughtShellState = (): ThoughtShellState => ({
  prompt: "",
  route: "connect",
  routeConfigured: false,
  provider: "openrouter",
  model: "",
  apiKeyConfigured: false,
  localEndpoint: "",
  localAvailable: null,
  openRouterLinked: false,
  previewMode: "auto",
  previewProvider: "auto",
  walletConnected: false,
  walletChainReady: false,
  pathSelected: false,
  pathAuthorized: false,
  candidateReady: false,
  workReady: false,
  myBrainWaiting: false,
});
