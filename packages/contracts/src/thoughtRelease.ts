import sepolia from "./releases/thought-release.sepolia.json";

type ReleaseBook = Record<string, unknown>;

export type ThoughtRelease = {
  schema_version: 1;
  protocol: "thought";
  network: "sepolia";
  chain_id: number;
  release_tier: "temporary" | "candidate" | "final";
  path_dependency?: {
    pathNft?: string;
    pathPulseAdapter?: string;
    pulseAuction?: string;
    movement?: string;
    movementBytes32?: string;
    movementQuota?: number;
  };
  contracts?: Record<string, string | number>;
  movement?: {
    name?: string;
    bytes32?: string;
    quota?: number;
    frozen?: boolean;
  };
  recommended_thought_spec?: {
    name?: string;
    ref?: string;
    id?: string;
    hash?: string;
    byteLength?: number;
    file?: string;
  };
  deploy_txs?: Record<string, string>;
  deploy_blocks?: Record<string, number>;
  code_hashes?: Record<string, string>;
};

const RELEASES: Record<string, ReleaseBook> = {
  sepolia,
};

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, any> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

function currentNetwork(): string {
  return getEnv("VITE_NETWORK") ?? "devnet";
}

function isThoughtRelease(value: unknown): value is ThoughtRelease {
  const release = value as ThoughtRelease;
  return (
    release != null &&
    typeof release === "object" &&
    release.schema_version === 1 &&
    release.protocol === "thought" &&
    typeof release.network === "string" &&
    typeof release.chain_id === "number"
  );
}

export function getThoughtRelease(
  network = currentNetwork()
): ThoughtRelease | undefined {
  const release = RELEASES[network];
  return isThoughtRelease(release) ? release : undefined;
}

export function getThoughtReleaseContract(
  id: string,
  network = currentNetwork()
): string | undefined {
  const release = getThoughtRelease(network);
  const value = release?.contracts?.[id.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

export function getRecommendedThoughtSpec(network = currentNetwork()) {
  return getThoughtRelease(network)?.recommended_thought_spec;
}

export function getThoughtReleaseDeployBlock(
  id: string,
  network = currentNetwork()
): number | undefined {
  const release = getThoughtRelease(network);
  const value = release?.deploy_blocks?.[id.toLowerCase()];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : undefined;
}

export function getThoughtReleaseCodeHash(
  id: string,
  network = currentNetwork()
): string | undefined {
  const release = getThoughtRelease(network);
  const value = release?.code_hashes?.[id.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}
